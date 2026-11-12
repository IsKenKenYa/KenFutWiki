package handler

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

// ShareVisitorSession 读取或发放公开站访客会话 Cookie。
// 浏览、点击、投票等公开端点共用同一 Cookie，保证访客身份一致。
func ShareVisitorSession(c echo.Context) string {
	if cookie, err := c.Cookie("x-kfw-session-id"); err == nil && cookie.Value != "" && len(cookie.Value) <= 128 {
		return cookie.Value
	}
	id := uuid.NewString()
	c.SetCookie(&http.Cookie{Name: "x-kfw-session-id", Value: id, Path: "/", HttpOnly: true, Secure: c.Scheme() == "https", SameSite: http.SameSiteLaxMode, MaxAge: 365 * 24 * 60 * 60})
	return id
}
