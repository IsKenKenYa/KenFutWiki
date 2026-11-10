package v1

import (
	"github.com/labstack/echo/v4"

	"github.com/chaitin/panda-wiki/consts"
	"github.com/chaitin/panda-wiki/handler"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/middleware"
	"github.com/chaitin/panda-wiki/usecase"
)

type BlockWordHandler struct {
	*handler.BaseHandler
	logger  *log.Logger
	usecase *usecase.BlockWordUsecase
}

type blockWordRequest struct {
	KBID       string   `json:"kb_id" validate:"required"`
	BlockWords []string `json:"block_words"`
}

func NewBlockWordHandler(e *echo.Echo, baseHandler *handler.BaseHandler, logger *log.Logger, auth middleware.AuthMiddleware, usecase *usecase.BlockWordUsecase) *BlockWordHandler {
	h := &BlockWordHandler{
		BaseHandler: baseHandler,
		logger:      logger.WithModule("handler.v1.block_word"),
		usecase:     usecase,
	}
	group := e.Group("/api/pro/v1/block", auth.Authorize, auth.ValidateKBUserPerm(consts.UserKBPermissionFullControl))
	group.GET("", h.Get)
	group.POST("", h.Save)
	return h
}

// Get
//
//	@Summary		Get question block words
//	@Description	Get question block words
//	@Tags			block
//	@Accept			json
//	@Produce		json
//	@Security		bearerAuth
//	@Param			kb_id	query		string	true	"Knowledge Base ID"
//	@Success		200		{object}	domain.PWResponse{data=map[string][]string}
//	@Router			/api/pro/v1/block [get]
func (h *BlockWordHandler) Get(c echo.Context) error {
	kbID := c.QueryParam("kb_id")
	if kbID == "" {
		return h.NewResponseWithError(c, "kb_id is required", nil)
	}
	words, err := h.usecase.Get(c.Request().Context(), kbID)
	if err != nil {
		return h.NewResponseWithError(c, "get block words failed", err)
	}
	return h.NewResponseWithData(c, map[string][]string{"words": words})
}

// Save
//
//	@Summary		Save question block words
//	@Description	Save question block words
//	@Tags			block
//	@Accept			json
//	@Produce		json
//	@Security		bearerAuth
//	@Param			body	body		blockWordRequest	true	"Block Words"
//	@Success		200		{object}	domain.PWResponse
//	@Router			/api/pro/v1/block [post]
func (h *BlockWordHandler) Save(c echo.Context) error {
	var req blockWordRequest
	if err := c.Bind(&req); err != nil {
		return h.NewResponseWithError(c, "request body is invalid", err)
	}
	if err := c.Validate(&req); err != nil {
		return h.NewResponseWithError(c, "validate request body failed", err)
	}
	if err := h.usecase.Save(c.Request().Context(), req.KBID, req.BlockWords); err != nil {
		return h.NewResponseWithError(c, "save block words failed", err)
	}
	return h.NewResponseWithData(c, nil)
}
