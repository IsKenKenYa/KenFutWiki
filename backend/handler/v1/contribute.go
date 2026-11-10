package v1

import (
	"github.com/labstack/echo/v4"

	"github.com/chaitin/panda-wiki/consts"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/handler"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/middleware"
	"github.com/chaitin/panda-wiki/usecase"
)

type ContributeHandler struct {
	*handler.BaseHandler
	logger  *log.Logger
	usecase *usecase.ContributeUsecase
}

func NewContributeHandler(e *echo.Echo, baseHandler *handler.BaseHandler, logger *log.Logger, auth middleware.AuthMiddleware, usecase *usecase.ContributeUsecase) *ContributeHandler {
	h := &ContributeHandler{
		BaseHandler: baseHandler,
		logger:      logger.WithModule("handler.v1.contribute"),
		usecase:     usecase,
	}
	group := e.Group("/api/pro/v1/contribute", auth.Authorize, auth.ValidateKBUserPerm(consts.UserKBPermissionFullControl))
	group.GET("/list", h.List)
	group.GET("/detail", h.Detail)
	group.POST("/audit", h.Audit)
	return h
}

// List
//
//	@Summary		List contributions
//	@Description	List document contributions
//	@Tags			Contribute
//	@Accept			json
//	@Produce		json
//	@Security		bearerAuth
//	@Param			params	query		domain.ContributeListReq	true	"Contribution list query"
//	@Success		200		{object}	domain.PWResponse{data=domain.ContributeListResp}
//	@Router			/api/pro/v1/contribute/list [get]
func (h *ContributeHandler) List(c echo.Context) error {
	var req domain.ContributeListReq
	if err := c.Bind(&req); err != nil {
		return h.NewResponseWithError(c, "bind request", err)
	}
	if err := c.Validate(&req); err != nil {
		return h.NewResponseWithError(c, "invalid request", err)
	}
	result, err := h.usecase.List(c.Request().Context(), &req)
	if err != nil {
		return h.NewResponseWithError(c, "list contributions failed", err)
	}
	return h.NewResponseWithData(c, result)
}

// Detail
//
//	@Summary		Get contribution detail
//	@Description	Get contribution detail
//	@Tags			Contribute
//	@Accept			json
//	@Produce		json
//	@Security		bearerAuth
//	@Param			kb_id	query		string	true	"Knowledge Base ID"
//	@Param			id		query		string	true	"Contribution ID"
//	@Success		200		{object}	domain.PWResponse{data=domain.ContributeDetailResp}
//	@Router			/api/pro/v1/contribute/detail [get]
func (h *ContributeHandler) Detail(c echo.Context) error {
	kbID := c.QueryParam("kb_id")
	id := c.QueryParam("id")
	if kbID == "" || id == "" {
		return h.NewResponseWithError(c, "kb_id and id are required", nil)
	}
	result, err := h.usecase.Detail(c.Request().Context(), kbID, id)
	if err != nil {
		return h.NewResponseWithError(c, "get contribution detail failed", err)
	}
	return h.NewResponseWithData(c, result)
}

// Audit
//
//	@Summary		Audit contribution
//	@Description	Approve or reject a document contribution
//	@Tags			Contribute
//	@Accept			json
//	@Produce		json
//	@Security		bearerAuth
//	@Param			body	body		domain.ContributeAuditReq	true	"Contribution audit request"
//	@Success		200		{object}	domain.PWResponse{data=map[string]string}
//	@Router			/api/pro/v1/contribute/audit [post]
func (h *ContributeHandler) Audit(c echo.Context) error {
	var req domain.ContributeAuditReq
	if err := c.Bind(&req); err != nil {
		return h.NewResponseWithError(c, "bind request", err)
	}
	if err := c.Validate(&req); err != nil {
		return h.NewResponseWithError(c, "invalid request", err)
	}
	authInfo := domain.GetAuthInfoFromCtx(c.Request().Context())
	if authInfo == nil {
		return h.NewResponseWithError(c, "auth info is missing", nil)
	}
	if err := h.usecase.Audit(c.Request().Context(), &req, authInfo.UserId); err != nil {
		return h.NewResponseWithError(c, "audit contribution failed", err)
	}
	return h.NewResponseWithData(c, map[string]string{"message": "success"})
}
