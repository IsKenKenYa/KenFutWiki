package share

import (
	"errors"
	"mime/multipart"
	"net/http"

	"github.com/labstack/echo/v4"
	echoMiddleware "github.com/labstack/echo/v4/middleware"

	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/handler"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/usecase"
)

type ShareDocumentFeedbackHandler struct {
	*handler.BaseHandler
	logger  *log.Logger
	usecase *usecase.DocumentFeedbackUsecase
}

func NewShareDocumentFeedbackHandler(e *echo.Echo, baseHandler *handler.BaseHandler, logger *log.Logger, usecase *usecase.DocumentFeedbackUsecase) *ShareDocumentFeedbackHandler {
	h := &ShareDocumentFeedbackHandler{
		BaseHandler: baseHandler,
		logger:      logger.WithModule("handler.share.document_feedback"),
		usecase:     usecase,
	}
	group := e.Group("/share/pro/v1/document",
		baseHandler.ShareAuthMiddleware.Authorize,
		echoMiddleware.BodyLimit("10M"),
	)
	group.POST("/feedback", h.Submit)
	return h
}

// Submit
//
//	@Summary		Submit document feedback
//	@Description	Submit document feedback with an optional screenshot
//	@Tags			documentFeedback
//	@Accept			multipart/form-data
//	@Produce		json
//	@Param			X-KB-ID					header		string	true	"Knowledge Base ID"
//	@Param			node_id					formData	string	false	"Document ID"
//	@Param			content					formData	string	false	"Feedback content"
//	@Param			correction_suggestion	formData	string	false	"Correction suggestion"
//	@Param			screenshot				formData	file	false	"Screenshot"
//	@Success		200						{object}	domain.PWResponse{data=map[string]int64}
//	@Router			/share/pro/v1/document/feedback [post]
func (h *ShareDocumentFeedbackHandler) Submit(c echo.Context) error {
	kbID := c.Request().Header.Get("X-KB-ID")
	if kbID == "" {
		return h.NewResponseWithError(c, "kb_id is required", nil)
	}
	var screenshot *multipart.FileHeader
	file, err := c.FormFile("screenshot")
	if err == nil {
		screenshot = file
	} else if !errors.Is(err, http.ErrMissingFile) {
		return h.NewResponseWithError(c, "read screenshot failed", err)
	}
	id, err := h.usecase.Submit(
		c.Request().Context(),
		kbID,
		c.FormValue("node_id"),
		c.FormValue("content"),
		c.FormValue("correction_suggestion"),
		c.RealIP(),
		domain.GetAuthID(c),
		screenshot,
	)
	if err != nil {
		return h.NewResponseWithError(c, "submit document feedback failed", err)
	}
	return h.NewResponseWithData(c, map[string]int64{"id": id})
}
