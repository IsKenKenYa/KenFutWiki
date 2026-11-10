package share

import (
	"context"
	"net/http"

	"github.com/labstack/echo-contrib/session"
	"github.com/labstack/echo/v4"

	v1 "github.com/chaitin/panda-wiki/api/share/v1"
	"github.com/chaitin/panda-wiki/consts"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/handler"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/usecase"
)

type ShareSSOHandler struct {
	*handler.BaseHandler
	logger      *log.Logger
	authUsecase *usecase.AuthUsecase
}

func NewShareSSOHandler(e *echo.Echo, baseHandler *handler.BaseHandler, logger *log.Logger, authUsecase *usecase.AuthUsecase) *ShareSSOHandler {
	h := &ShareSSOHandler{
		BaseHandler: baseHandler,
		logger:      logger.WithModule("handler.share.sso"),
		authUsecase: authUsecase,
	}

	authGroup := e.Group("/share/pro/v1/auth", baseHandler.ShareAuthMiddleware.CheckForbidden)
	authGroup.POST("/dingtalk", h.DingTalk)
	authGroup.POST("/feishu", h.Feishu)
	authGroup.POST("/wecom", h.WeCom)
	authGroup.POST("/oauth", h.OAuth)
	authGroup.POST("/cas", h.CAS)
	authGroup.POST("/github", h.GitHub)
	authGroup.POST("/ldap", h.LDAP)
	authGroup.GET("/info", h.Info)
	authGroup.POST("/logout", h.Logout)

	openapi := e.Group("/share/pro/v1/openapi")
	openapi.GET("/dingtalk/callback", h.DingTalkCallback)
	openapi.GET("/feishu/callback", h.FeishuCallback)
	openapi.GET("/wecom/callback", h.WeComCallback)
	openapi.GET("/oauth/callback", h.OAuthCallback)
	openapi.GET("/cas/callback", h.CASCallback)
	openapi.GET("/github/callback", h.GitHubCallback)

	return h
}

func (h *ShareSSOHandler) DingTalk(c echo.Context) error {
	return h.generateURL(c, consts.SourceTypeDingTalk, false)
}

func (h *ShareSSOHandler) Feishu(c echo.Context) error {
	return h.generateURL(c, consts.SourceTypeFeishu, false)
}

func (h *ShareSSOHandler) WeCom(c echo.Context) error {
	var req v1.SSOAuthReq
	if err := c.Bind(&req); err != nil {
		return h.NewResponseWithError(c, "invalid request", err)
	}
	return h.generateURLWithRequest(c, consts.SourceTypeWeCom, &req)
}

func (h *ShareSSOHandler) OAuth(c echo.Context) error {
	return h.generateURL(c, consts.SourceTypeOAuth, false)
}

func (h *ShareSSOHandler) CAS(c echo.Context) error {
	return h.generateURL(c, consts.SourceTypeCAS, false)
}

func (h *ShareSSOHandler) GitHub(c echo.Context) error {
	return h.generateURL(c, consts.SourceTypeGitHub, false)
}

func (h *ShareSSOHandler) generateURL(c echo.Context, sourceType consts.SourceType, isApp bool) error {
	var req v1.SSOAuthReq
	if err := c.Bind(&req); err != nil {
		return h.NewResponseWithError(c, "invalid request", err)
	}
	req.IsApp = isApp
	return h.generateURLWithRequest(c, sourceType, &req)
}

func (h *ShareSSOHandler) generateURLWithRequest(c echo.Context, sourceType consts.SourceType, req *v1.SSOAuthReq) error {
	if req.KbID == "" {
		req.KbID = c.Request().Header.Get("X-KB-ID")
	}
	if req.KbID == "" {
		return h.NewResponseWithError(c, "kb_id is required", nil)
	}
	url, err := h.authUsecase.GenerateSSOAuthURL(h.requestContext(c), sourceType, req.KbID, req.RedirectURL, req.IsApp)
	if err != nil {
		return h.NewResponseWithError(c, "generate auth url failed", err)
	}
	return h.NewResponseWithData(c, v1.SSOAuthResp{URL: url})
}

func (h *ShareSSOHandler) LDAP(c echo.Context) error {
	var req v1.LDAPAuthReq
	if err := c.Bind(&req); err != nil {
		return h.NewResponseWithError(c, "invalid request", err)
	}
	if req.KbID == "" {
		req.KbID = c.Request().Header.Get("X-KB-ID")
	}
	if err := c.Validate(&req); err != nil {
		return h.NewResponseWithError(c, "validate request failed", err)
	}
	auth, err := h.authUsecase.LDAPAuth(h.requestContext(c), req.KbID, req.Username, req.Password)
	if err != nil {
		return h.NewResponseWithError(c, "LDAP authentication failed", err)
	}
	if err := h.authUsecase.SaveNewSession(c, auth); err != nil {
		return h.NewResponseWithError(c, "save session failed", err)
	}
	return h.NewResponseWithData(c, nil)
}

func (h *ShareSSOHandler) Info(c echo.Context) error {
	sess, err := session.Get(domain.SessionName, c)
	if err != nil {
		return h.NewResponseWithError(c, "session not found", err)
	}
	userID, ok := sess.Values["user_id"].(uint)
	kbID, okKB := sess.Values["kb_id"].(string)
	if !ok || !okKB || userID == 0 || kbID == "" {
		return h.NewResponseWithError(c, "login required", nil)
	}
	auth, err := h.authUsecase.GetAuthInfo(c.Request().Context(), kbID, userID)
	if err != nil {
		return h.NewResponseWithError(c, "get auth info failed", err)
	}
	return h.NewResponseWithData(c, v1.AuthInfoResp{
		ID:        auth.ID,
		Username:  auth.UserInfo.Username,
		AvatarURL: auth.UserInfo.AvatarUrl,
		Email:     auth.UserInfo.Email,
	})
}

func (h *ShareSSOHandler) Logout(c echo.Context) error {
	sess, err := session.Get(domain.SessionName, c)
	if err != nil {
		return h.NewResponseWithError(c, "session not found", err)
	}
	sess.Options.MaxAge = -1
	if err := sess.Save(c.Request(), c.Response()); err != nil {
		return h.NewResponseWithError(c, "clear session failed", err)
	}
	return h.NewResponseWithData(c, nil)
}

func (h *ShareSSOHandler) DingTalkCallback(c echo.Context) error {
	return h.callback(c, consts.SourceTypeDingTalk)
}

func (h *ShareSSOHandler) FeishuCallback(c echo.Context) error {
	return h.callback(c, consts.SourceTypeFeishu)
}

func (h *ShareSSOHandler) WeComCallback(c echo.Context) error {
	return h.callback(c, consts.SourceTypeWeCom)
}

func (h *ShareSSOHandler) OAuthCallback(c echo.Context) error {
	return h.callback(c, consts.SourceTypeOAuth)
}

func (h *ShareSSOHandler) CASCallback(c echo.Context) error {
	return h.callback(c, consts.SourceTypeCAS)
}

func (h *ShareSSOHandler) GitHubCallback(c echo.Context) error {
	return h.callback(c, consts.SourceTypeGitHub)
}

func (h *ShareSSOHandler) requestContext(c echo.Context) context.Context {
	return context.WithValue(c.Request().Context(), consts.ContextKeyEdition, consts.GetLicenseEdition(c))
}

func (h *ShareSSOHandler) callback(c echo.Context, sourceType consts.SourceType) error {
	var req v1.SSOCallbackReq
	if err := c.Bind(&req); err != nil {
		return h.NewResponseWithError(c, "invalid callback request", err)
	}
	auth, redirectURL, err := h.authUsecase.SSOCallback(h.requestContext(c), sourceType, req.Code, req.State, req.Ticket)
	if err != nil {
		return h.NewResponseWithError(c, "handle auth callback failed", err)
	}
	if err := h.authUsecase.SaveNewSession(c, auth); err != nil {
		return h.NewResponseWithError(c, "save session failed", err)
	}
	return c.Redirect(http.StatusFound, redirectURL)
}
