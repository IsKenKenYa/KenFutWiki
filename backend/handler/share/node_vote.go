package share

import (
	"errors"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"

	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/handler"
	"github.com/chaitin/panda-wiki/usecase"
)

type ShareNodeVoteHandler struct {
	*handler.BaseHandler
	usecase *usecase.KenFutVoteUsecase
}

func NewShareNodeVoteHandler(e *echo.Echo, base *handler.BaseHandler, u *usecase.KenFutVoteUsecase) *ShareNodeVoteHandler {
	h := &ShareNodeVoteHandler{BaseHandler: base, usecase: u}
	group := e.Group("/share/v1/node", base.ShareAuthMiddleware.Authorize)
	group.POST("/:node_id/vote", h.Vote)
	group.GET("/:node_id/vote", h.Summary)
	return h
}

// Vote 记录当前访客对已发布内容的投票。
//
//	@Summary	Vote a published page
//	@Tags		share
//	@Param		X-KB-ID	header		string					true	"Knowledge base"
//	@Param		node_id	path		string					true	"Node ID"
//	@Param		body	body		domain.KenFutVoteReq	true	"Vote"
//	@Success	200		{object}	domain.PWResponse
//	@Router		/share/v1/node/{node_id}/vote [post]
func (h *ShareNodeVoteHandler) Vote(c echo.Context) error {
	var req domain.KenFutVoteReq
	if err := c.Bind(&req); err != nil {
		return h.NewResponseWithError(c, "invalid vote", err)
	}
	kbID := c.Request().Header.Get("X-KB-ID")
	if kbID == "" {
		return h.NewResponseWithError(c, "kb_id is required", nil)
	}
	visitor := handler.ShareVisitorSession(c)
	if err := h.usecase.Record(c.Request().Context(), kbID, c.Param("node_id"), req.Vote, visitor, domain.GetAuthID(c)); err != nil {
		if errors.Is(err, usecase.ErrKenFutInvalid) || errors.Is(err, gorm.ErrRecordNotFound) {
			return h.NewResponseWithError(c, "vote rejected", err)
		}
		return h.NewResponseWithError(c, "failed to record vote", err)
	}
	return h.NewResponseWithData(c, map[string]bool{"recorded": true})
}

// Summary 返回投票计数与当前访客票向。
//
//	@Summary	Page vote summary
//	@Tags		share
//	@Param		X-KB-ID	header		string	true	"Knowledge base"
//	@Param		node_id	path		string	true	"Node ID"
//	@Success	200		{object}	domain.PWResponse{data=domain.KenFutVoteSummaryResp}
//	@Router		/share/v1/node/{node_id}/vote [get]
func (h *ShareNodeVoteHandler) Summary(c echo.Context) error {
	kbID := c.Request().Header.Get("X-KB-ID")
	if kbID == "" {
		return h.NewResponseWithError(c, "kb_id is required", nil)
	}
	summary, err := h.usecase.Summary(c.Request().Context(), kbID, c.Param("node_id"), handler.ShareVisitorSession(c), domain.GetAuthID(c))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return h.NewResponseWithError(c, "vote summary unavailable", err)
		}
		return h.NewResponseWithError(c, "failed to load vote summary", err)
	}
	return h.NewResponseWithData(c, summary)
}
