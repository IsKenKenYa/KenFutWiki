package share

import (
	"github.com/labstack/echo/v4"
	echoMiddleware "github.com/labstack/echo/v4/middleware"

	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/handler"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/usecase"
)

type ShareContributeHandler struct {
	*handler.BaseHandler
	logger  *log.Logger
	usecase *usecase.ContributeUsecase
}

func NewShareContributeHandler(e *echo.Echo, baseHandler *handler.BaseHandler, logger *log.Logger, usecase *usecase.ContributeUsecase) *ShareContributeHandler {
	h := &ShareContributeHandler{
		BaseHandler: baseHandler,
		logger:      logger.WithModule("handler.share.contribute"),
		usecase:     usecase,
	}
	group := e.Group("/share/pro/v1/contribute",
		baseHandler.ShareAuthMiddleware.Authorize,
		echoMiddleware.BodyLimit("1M"),
	)
	group.POST("/submit", h.Submit)
	return h
}

// Submit
//
//	@Summary		Submit document contribution
//	@Description	Submit a document edit or new document contribution
//	@Tags			ShareContribute
//	@Accept			json
//	@Produce		json
//	@Param			X-KB-ID	header		string						true	"Knowledge Base ID"
//	@Param			body	body		domain.SubmitContributeReq	true	"Contribution"
//	@Success		200		{object}	domain.PWResponse{data=map[string]string}
//	@Router			/share/pro/v1/contribute/submit [post]
func (h *ShareContributeHandler) Submit(c echo.Context) error {
	kbID := c.Request().Header.Get("X-KB-ID")
	if kbID == "" {
		return h.NewResponseWithError(c, "kb_id is required", nil)
	}
	var req domain.SubmitContributeReq
	if err := c.Bind(&req); err != nil {
		return h.NewResponseWithError(c, "invalid request", err)
	}
	req.KBID = kbID
	if err := c.Validate(&req); err != nil {
		return h.NewResponseWithError(c, "validate request failed", err)
	}
	if !h.Captcha.ValidateToken(c.Request().Context(), req.CaptchaToken) {
		return h.NewResponseWithError(c, "failed to validate captcha token", nil)
	}
	id, err := h.usecase.Submit(c.Request().Context(), &req, int64(domain.GetAuthID(c)), c.RealIP())
	if err != nil {
		return h.NewResponseWithError(c, "submit contribution failed", err)
	}
	return h.NewResponseWithData(c, map[string]string{"id": id})
}
