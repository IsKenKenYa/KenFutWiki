package v1

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"

	"github.com/chaitin/panda-wiki/consts"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/middleware"
	"github.com/chaitin/panda-wiki/usecase"
)

type KenFutContentHandler struct{ usecase *usecase.KenFutContentUsecase }

func NewKenFutContentHandler(e *echo.Echo, u *usecase.KenFutContentUsecase, auth middleware.AuthMiddleware) *KenFutContentHandler {
	h := &KenFutContentHandler{usecase: u}
	group := e.Group("/api/kenfut/v1/contents", auth.Authorize, auth.ValidateKBUserPerm(consts.UserKBPermissionDocManage))
	group.GET("/:node_id", h.Get)
	group.PUT("/:node_id", h.Update)
	return h
}

func contentAdminError(c echo.Context, err error, status int) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		status = http.StatusNotFound
	}
	if status >= http.StatusInternalServerError {
		c.Logger().Error(err)
		return c.JSON(status, domain.PWResponse{Success: false, Message: "content operation failed"})
	}
	return c.JSON(status, domain.PWResponse{Success: false, Message: err.Error()})
}

// Get reads editable content metadata.
//
//	@Summary	Get content metadata draft
//	@Tags		kenfut_content
//	@Security	bearerAuth
//	@Param		kb_id	query		string	true	"Knowledge base"
//	@Param		node_id	path		string	true	"Node ID"
//	@Success	200		{object}	domain.PWResponse{data=domain.KenFutContentMetadata}
//	@Router		/api/kenfut/v1/contents/{node_id} [get]
func (h *KenFutContentHandler) Get(c echo.Context) error {
	kbID := c.QueryParam("kb_id")
	if kbID == "" {
		return c.JSON(http.StatusBadRequest, domain.PWResponse{Message: "kb_id is required"})
	}
	metadata, err := h.usecase.GetDraft(c.Request().Context(), kbID, c.Param("node_id"))
	if err != nil {
		return contentAdminError(c, err, http.StatusInternalServerError)
	}
	return c.JSON(http.StatusOK, domain.PWResponse{Success: true, Data: metadata})
}

// Update saves a draft and marks a published node as changed.
//
//	@Summary	Update content metadata draft
//	@Tags		kenfut_content
//	@Security	bearerAuth
//	@Param		node_id	path		string							true	"Node ID"
//	@Param		body	body		domain.KenFutContentMetadata	true	"Metadata; kb_id is required as query parameter"
//	@Param		kb_id	query		string							true	"Knowledge base"
//	@Success	200		{object}	domain.PWResponse{data=domain.KenFutContentMetadata}
//	@Router		/api/kenfut/v1/contents/{node_id} [put]
func (h *KenFutContentHandler) Update(c echo.Context) error {
	var req struct {
		domain.KenFutContentMetadata
		KBID string `json:"kb_id"`
	}
	if err := c.Bind(&req); err != nil {
		return contentAdminError(c, err, http.StatusBadRequest)
	}
	kbID := c.QueryParam("kb_id")
	if kbID == "" {
		kbID = req.KBID
	}
	if kbID == "" {
		return c.JSON(http.StatusBadRequest, domain.PWResponse{Message: "kb_id is required"})
	}
	// The query and body may not disagree with the scope checked by middleware.
	if req.KBID != "" && req.KBID != kbID {
		return c.JSON(http.StatusBadRequest, domain.PWResponse{Message: "conflicting knowledge base"})
	}
	req.NodeID = c.Param("node_id")
	if err := h.usecase.SaveDraft(c.Request().Context(), kbID, req.KenFutContentMetadata); err != nil {
		return contentAdminError(c, err, http.StatusBadRequest)
	}
	metadata, err := h.usecase.GetDraft(c.Request().Context(), kbID, req.NodeID)
	if err != nil {
		return contentAdminError(c, err, http.StatusInternalServerError)
	}
	return c.JSON(http.StatusOK, domain.PWResponse{Success: true, Data: metadata})
}
