package v1

import (
	"errors"
	"net/http"
	"strings"

	kenfutAPI "github.com/chaitin/panda-wiki/api/kenfut"
	"github.com/chaitin/panda-wiki/consts"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/handler"
	"github.com/chaitin/panda-wiki/middleware"
	repo "github.com/chaitin/panda-wiki/repo/pg"
	"github.com/chaitin/panda-wiki/usecase"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	echoMiddleware "github.com/labstack/echo/v4/middleware"
	"gorm.io/gorm"
)

type KenFutIntegrationHandler struct {
	u *usecase.KenFutIntegrationUsecase
}

func NewKenFutIntegrationHandler(e *echo.Echo, u *usecase.KenFutIntegrationUsecase, auth middleware.AuthMiddleware, base *handler.BaseHandler) *KenFutIntegrationHandler {
	h := &KenFutIntegrationHandler{u: u}
	e.GET("/share/kenfut/v1/openapi.json", func(c echo.Context) error {
		return c.Blob(http.StatusOK, echo.MIMEApplicationJSON, kenfutAPI.OpenAPI)
	})
	admin := e.Group("/api/kenfut/v1", auth.Authorize, func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			id, err := middleware.GetKbID(c)
			if err != nil {
				return kenFutResponse(c, nil, usecase.ErrKenFutInvalid)
			}
			c.Set("kenfut_kb_id", id)
			return next(c)
		}
	})
	admin.GET("/capabilities", h.Capabilities)
	config := admin.Group("", auth.ValidateKBUserPerm(consts.UserKBPermissionFullControl))
	admin.GET("/products", h.Products, auth.ValidateKBUserPerm(consts.UserKBPermissionNotNull))
	config.POST("/products", h.CreateProduct)
	config.PUT("/products/:id", h.UpdateProduct)
	config.DELETE("/products/:id", h.DisableProduct)
	config.GET("/products/:id/credentials", h.Credentials)
	config.POST("/products/:id/credentials", h.CreateCredential)
	config.DELETE("/products/:id/credentials/:key", h.RevokeCredential)
	config.GET("/prompts", h.GetPrompt)
	config.PUT("/prompts", h.SavePrompt)
	data := admin.Group("", auth.ValidateKBUserPerm(consts.UserKBPermissionDataOperate))
	data.GET("/funnel", h.Funnel)
	data.POST("/comments/:id/moderation", h.Moderate)
	public := e.Group("/share/kenfut/v1", base.ShareAuthMiddleware.Authorize, echoMiddleware.BodyLimit("64K"), echoMiddleware.RateLimiter(echoMiddleware.NewRateLimiterMemoryStore(30)))
	public.POST("/events/view", h.View)
	public.POST("/ctas/:id/click", h.Click)
	integration := e.Group("/integration/kenfut/v1", echoMiddleware.BodyLimit("64K"), echoMiddleware.RateLimiter(echoMiddleware.NewRateLimiterMemoryStore(30)))
	integration.POST("/events", h.Conversion)
	integration.GET("/funnel", h.ProductFunnel)
	return h
}
func kenFutResponse(c echo.Context, value any, err error) error {
	if err == nil {
		return c.JSON(http.StatusOK, domain.PWResponse{Success: true, Data: value})
	}
	status := http.StatusInternalServerError
	message := "请求暂时无法完成"
	switch {
	case errors.Is(err, usecase.ErrKenFutInvalid):
		status = http.StatusBadRequest
		message = err.Error()
	case errors.Is(err, usecase.ErrKenFutUnauthorized):
		status = http.StatusUnauthorized
		message = "产品凭证或权限无效"
	case errors.Is(err, repo.ErrKenFutEventConflict):
		status = http.StatusConflict
		message = "事件ID已用于其他内容"
	case errors.Is(err, gorm.ErrRecordNotFound):
		status = http.StatusNotFound
		message = "记录不存在或不可访问"
	case errors.Is(err, domain.ErrPermissionDenied):
		status = http.StatusForbidden
		message = "没有访问权限"
	}
	if status == http.StatusInternalServerError {
		c.Logger().Error(err)
	}
	return c.JSON(status, domain.PWResponse{Success: false, Message: message})
}
func kenFutKBID(c echo.Context) string {
	if id, ok := c.Get("kenfut_kb_id").(string); ok {
		return id
	}
	id, _ := middleware.GetKbID(c)
	return id
}
func (h *KenFutIntegrationHandler) Capabilities(c echo.Context) error {
	limits := domain.GetBaseEditionLimitation(c.Request().Context())
	return kenFutResponse(c, map[string]any{
		"content": true, "comment_audit": limits.AllowCommentAudit, "custom_prompts": true,
		"custom_branding": limits.AllowCustomCopyright, "node_stats": limits.AllowNodeStats,
		"admin_permissions": limits.AllowAdminPerm,
		"limits":            map[string]any{"max_kb": limits.MaxKb, "max_node": limits.MaxNode, "max_admin": limits.MaxAdmin},
		"stat_days":         []int{1, 7, 30, 90}, "source_url": "https://github.com/IsKenKenYa/KenFutWiki", "license": "AGPL-3.0",
	}, nil)
}

func (h *KenFutIntegrationHandler) Products(c echo.Context) error {
	items, err := h.u.Products(c.Request().Context(), kenFutKBID(c))
	return kenFutResponse(c, map[string]any{"items": items}, err)
}
func (h *KenFutIntegrationHandler) CreateProduct(c echo.Context) error { return h.saveProduct(c, true) }
func (h *KenFutIntegrationHandler) UpdateProduct(c echo.Context) error {
	return h.saveProduct(c, false)
}
func (h *KenFutIntegrationHandler) saveProduct(c echo.Context, create bool) error {
	var item domain.KenFutProduct
	if err := c.Bind(&item); err != nil {
		return kenFutResponse(c, nil, usecase.ErrKenFutInvalid)
	}
	if item.KBID == "" {
		item.KBID = kenFutKBID(c)
	}
	item.ID = c.Param("id")
	value, err := h.u.SaveProduct(c.Request().Context(), item, create)
	return kenFutResponse(c, value, err)
}
func (h *KenFutIntegrationHandler) DisableProduct(c echo.Context) error {
	return kenFutResponse(c, nil, h.u.DisableProduct(c.Request().Context(), kenFutKBID(c), c.Param("id")))
}
func (h *KenFutIntegrationHandler) Credentials(c echo.Context) error {
	items, err := h.u.Credentials(c.Request().Context(), kenFutKBID(c), c.Param("id"))
	return kenFutResponse(c, map[string]any{"items": items}, err)
}
func (h *KenFutIntegrationHandler) CreateCredential(c echo.Context) error {
	var req struct {
		Scopes []string `json:"scopes"`
	}
	if err := c.Bind(&req); err != nil {
		return kenFutResponse(c, nil, usecase.ErrKenFutInvalid)
	}
	key, token, err := h.u.CreateCredential(c.Request().Context(), kenFutKBID(c), c.Param("id"), req.Scopes)
	if err != nil {
		return kenFutResponse(c, nil, err)
	}
	return kenFutResponse(c, map[string]any{"id": key.ID, "token": token, "scopes": key.Scopes}, nil)
}
func (h *KenFutIntegrationHandler) RevokeCredential(c echo.Context) error {
	return kenFutResponse(c, nil, h.u.RevokeCredential(c.Request().Context(), kenFutKBID(c), c.Param("id"), c.Param("key")))
}
func (h *KenFutIntegrationHandler) GetPrompt(c echo.Context) error {
	p, err := h.u.GetPrompt(c.Request().Context(), kenFutKBID(c))
	return kenFutResponse(c, p, err)
}
func (h *KenFutIntegrationHandler) SavePrompt(c echo.Context) error {
	var p domain.Prompt
	if err := c.Bind(&p); err != nil {
		return kenFutResponse(c, nil, usecase.ErrKenFutInvalid)
	}
	return kenFutResponse(c, p, h.u.SavePrompt(c.Request().Context(), kenFutKBID(c), p))
}
func (h *KenFutIntegrationHandler) Moderate(c echo.Context) error {
	var req struct {
		Status int `json:"status"`
	}
	if err := c.Bind(&req); err != nil {
		return kenFutResponse(c, nil, usecase.ErrKenFutInvalid)
	}
	return kenFutResponse(c, nil, h.u.Moderate(c.Request().Context(), kenFutKBID(c), c.Param("id"), req.Status))
}
func (h *KenFutIntegrationHandler) Funnel(c echo.Context) error {
	var req domain.KenFutFunnelReq
	if err := c.Bind(&req); err != nil {
		return kenFutResponse(c, nil, usecase.ErrKenFutInvalid)
	}
	req.KBID = kenFutKBID(c)
	value, err := h.u.Funnel(c.Request().Context(), req)
	return kenFutResponse(c, value, err)
}
func kenFutSession(c echo.Context) string {
	if cookie, err := c.Cookie("x-pw-session-id"); err == nil && cookie.Value != "" && len(cookie.Value) <= 128 {
		return cookie.Value
	}
	id := uuid.NewString()
	c.SetCookie(&http.Cookie{Name: "x-pw-session-id", Value: id, Path: "/", HttpOnly: true, Secure: c.Scheme() == "https", SameSite: http.SameSiteLaxMode, MaxAge: 365 * 24 * 60 * 60})
	return id
}
func (h *KenFutIntegrationHandler) View(c echo.Context) error {
	var req domain.KenFutViewReq
	if err := c.Bind(&req); err != nil {
		return kenFutResponse(c, nil, usecase.ErrKenFutInvalid)
	}
	stat := domain.StatPage{IP: c.RealIP(), UA: c.Request().UserAgent(), Referer: c.Request().Referer()}
	err := h.u.RecordView(c.Request().Context(), c.Request().Header.Get("X-KB-ID"), kenFutSession(c), req, stat, domain.GetAuthID(c))
	return kenFutResponse(c, map[string]bool{"recorded": err == nil}, err)
}
func (h *KenFutIntegrationHandler) Click(c echo.Context) error {
	var req domain.KenFutClickReq
	if err := c.Bind(&req); err != nil {
		return kenFutResponse(c, nil, usecase.ErrKenFutInvalid)
	}
	value, err := h.u.RecordClick(c.Request().Context(), c.Request().Header.Get("X-KB-ID"), kenFutSession(c), c.Param("id"), req, domain.GetAuthID(c))
	return kenFutResponse(c, value, err)
}
func (h *KenFutIntegrationHandler) Conversion(c echo.Context) error {
	product, err := h.u.Authenticate(c.Request().Context(), strings.TrimPrefix(c.Request().Header.Get("Authorization"), "Bearer "), "conversion:write")
	if err != nil {
		return kenFutResponse(c, nil, err)
	}
	var req domain.KenFutConversionReq
	if err := c.Bind(&req); err != nil {
		return kenFutResponse(c, nil, usecase.ErrKenFutInvalid)
	}
	err = h.u.RecordConversion(c.Request().Context(), *product, req)
	return kenFutResponse(c, map[string]bool{"accepted": err == nil}, err)
}
func (h *KenFutIntegrationHandler) ProductFunnel(c echo.Context) error {
	product, err := h.u.Authenticate(c.Request().Context(), strings.TrimPrefix(c.Request().Header.Get("Authorization"), "Bearer "), "analytics:read")
	if err != nil {
		return kenFutResponse(c, nil, err)
	}
	var req domain.KenFutFunnelReq
	if err := c.Bind(&req); err != nil {
		return kenFutResponse(c, nil, usecase.ErrKenFutInvalid)
	}
	if req.ProductID != "" && req.ProductID != product.ID {
		return c.JSON(http.StatusForbidden, domain.PWResponse{Success: false, Message: "不能查询其他产品"})
	}
	req.KBID = product.KBID
	req.ProductID = product.ID
	value, err := h.u.Funnel(c.Request().Context(), req)
	return kenFutResponse(c, value, err)
}
