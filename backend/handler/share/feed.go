package share

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/chaitin/panda-wiki/handler"
	"github.com/chaitin/panda-wiki/usecase"
)

type ShareFeedHandler struct {
	*handler.BaseHandler
	contentUsecase *usecase.KenFutContentUsecase
}

func NewShareFeedHandler(e *echo.Echo, base *handler.BaseHandler, u *usecase.KenFutContentUsecase) *ShareFeedHandler {
	h := &ShareFeedHandler{BaseHandler: base, contentUsecase: u}
	e.GET("/rss.xml", h.GetRSS)
	return h
}

// GetRSS 输出博客频道的 RSS 2.0 订阅，与 sitemap 一致依赖网关注入 X-KB-ID。
//
//	@Summary	Blog channel RSS feed
//	@Tags		share
//	@Param		X-KB-ID	header		string	true	"Knowledge base"
//	@Param		lang	query		string	false	"Content language"
//	@Success	200		{string}	string
//	@Router		/rss.xml [get]
func (h *ShareFeedHandler) GetRSS(c echo.Context) error {
	kbID := c.Request().Header.Get("X-KB-ID")
	if kbID == "" {
		return h.NewResponseWithError(c, "kb_id is required", nil)
	}
	feed, err := h.contentUsecase.Feed(c.Request().Context(), kbID, c.QueryParam("lang"))
	if err != nil {
		return h.NewResponseWithError(c, "failed to generate feed", err)
	}
	return c.Blob(http.StatusOK, echo.MIMEApplicationXMLCharsetUTF8, []byte(feed))
}
