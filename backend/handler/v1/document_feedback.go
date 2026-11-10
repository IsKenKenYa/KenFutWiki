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

type DocumentFeedbackHandler struct {
	*handler.BaseHandler
	logger  *log.Logger
	usecase *usecase.DocumentFeedbackUsecase
}

func NewDocumentFeedbackHandler(e *echo.Echo, baseHandler *handler.BaseHandler, logger *log.Logger, auth middleware.AuthMiddleware, usecase *usecase.DocumentFeedbackUsecase) *DocumentFeedbackHandler {
	h := &DocumentFeedbackHandler{
		BaseHandler: baseHandler,
		logger:      logger.WithModule("handler.v1.document_feedback"),
		usecase:     usecase,
	}
	group := e.Group("/api/pro/v1/document", auth.Authorize, auth.ValidateKBUserPerm(consts.UserKBPermissionDataOperate))
	group.GET("/list", h.List)
	group.DELETE("/feedback", h.Delete)
	return h
}

// List
//
//	@Summary		List document feedback
//	@Description	List document feedback
//	@Tags			documentFeedback
//	@Accept			json
//	@Produce		json
//	@Security		bearerAuth
//	@Param			params	query		domain.DocumentFeedbackListReq	true	"Feedback list query"
//	@Success		200		{object}	domain.PWResponse{data=domain.DocumentFeedbackListResp}
//	@Router			/api/pro/v1/document/list [get]
func (h *DocumentFeedbackHandler) List(c echo.Context) error {
	var req domain.DocumentFeedbackListReq
	if err := c.Bind(&req); err != nil {
		return h.NewResponseWithError(c, "bind request", err)
	}
	if err := c.Validate(&req); err != nil {
		return h.NewResponseWithError(c, "invalid request", err)
	}
	result, err := h.usecase.List(c.Request().Context(), &req)
	if err != nil {
		return h.NewResponseWithError(c, "list document feedback failed", err)
	}
	return h.NewResponseWithData(c, result)
}

// Delete
//
//	@Summary		Delete document feedback
//	@Description	Delete document feedback
//	@Tags			documentFeedback
//	@Accept			json
//	@Produce		json
//	@Security		bearerAuth
//	@Param			kb_id	query		string	true	"Knowledge Base ID"
//	@Param			ids		query		[]int64	true	"Feedback IDs"
//	@Success		200		{object}	domain.PWResponse
//	@Router			/api/pro/v1/document/feedback [delete]
func (h *DocumentFeedbackHandler) Delete(c echo.Context) error {
	var req domain.DocumentFeedbackDeleteReq
	if err := c.Bind(&req); err != nil {
		return h.NewResponseWithError(c, "bind request", err)
	}
	if err := c.Validate(&req); err != nil {
		return h.NewResponseWithError(c, "invalid request", err)
	}
	if err := h.usecase.Delete(c.Request().Context(), req.KBID, req.IDs); err != nil {
		return h.NewResponseWithError(c, "delete document feedback failed", err)
	}
	return h.NewResponseWithData(c, nil)
}
