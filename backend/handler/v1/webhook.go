package v1

import (
	"github.com/labstack/echo/v4"

	"github.com/chaitin/panda-wiki/consts"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/handler"
	"github.com/chaitin/panda-wiki/middleware"
	"github.com/chaitin/panda-wiki/usecase"
)

type WebhookHandler struct {
	*handler.BaseHandler
	usecase *usecase.WebhookUsecase
}

func NewWebhookHandler(e *echo.Echo, base *handler.BaseHandler, auth middleware.AuthMiddleware, u *usecase.WebhookUsecase) *WebhookHandler {
	h := &WebhookHandler{BaseHandler: base, usecase: u}
	group := e.Group("/api/v1/webhook", auth.Authorize, auth.ValidateKBUserPerm(consts.UserKBPermissionDocManage))
	group.GET("/list", h.List)
	group.POST("", h.Create)
	group.PUT("/:id", h.Update)
	group.DELETE("/:id", h.Delete)
	group.GET("/:id/deliveries", h.Deliveries)
	group.POST("/:id/test", h.SendTest)
	return h
}

// List
//
//	@Summary		Webhook 列表
//	@Description	列出当前知识库的全部 Webhook
//	@Tags			webhook
//	@Produce		json
//	@Param			kb_id	query		string	true	"Knowledge Base ID"
//	@Success		200		{object}	domain.PWResponse{data=[]domain.Webhook}
//	@Router			/api/v1/webhook/list [get]
func (h *WebhookHandler) List(c echo.Context) error {
	kbID, err := middleware.GetKbID(c)
	if err != nil {
		return h.NewResponseWithError(c, "kb_id is required", err)
	}
	items, err := h.usecase.List(c.Request().Context(), kbID)
	if err != nil {
		return h.NewResponseWithError(c, "get webhook list failed", err)
	}
	return h.NewResponseWithData(c, items)
}

// Create
//
//	@Summary		创建 Webhook
//	@Description	注册一个事件推送目标
//	@Tags			webhook
//	@Accept			json
//	@Produce		json
//	@Param			body	body		domain.Webhook	true	"Webhook"
//	@Success		200		{object}	domain.PWResponse{data=domain.Webhook}
//	@Router			/api/v1/webhook [post]
func (h *WebhookHandler) Create(c echo.Context) error {
	item := &domain.Webhook{}
	if err := c.Bind(item); err != nil {
		return h.NewResponseWithError(c, "request body is invalid", err)
	}
	kbID, err := middleware.GetKbID(c)
	if err != nil {
		return h.NewResponseWithError(c, "kb_id is required", err)
	}
	item.KBID = kbID
	authInfo := domain.GetAuthInfoFromCtx(c.Request().Context())
	userID := ""
	if authInfo != nil {
		userID = authInfo.UserId
	}
	created, err := h.usecase.Create(c.Request().Context(), item, userID)
	if err != nil {
		return h.NewResponseWithError(c, "create webhook failed", err)
	}
	return h.NewResponseWithData(c, created)
}

// Update
//
//	@Summary		更新 Webhook
//	@Description	修改推送地址、事件订阅与启用状态
//	@Tags			webhook
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string			true	"Webhook ID"
//	@Param			body	body		domain.Webhook	true	"Webhook"
//	@Success		200		{object}	domain.PWResponse
//	@Router			/api/v1/webhook/{id} [put]
func (h *WebhookHandler) Update(c echo.Context) error {
	item := &domain.Webhook{}
	if err := c.Bind(item); err != nil {
		return h.NewResponseWithError(c, "request body is invalid", err)
	}
	item.ID = c.Param("id")
	kbID, err := middleware.GetKbID(c)
	if err != nil {
		return h.NewResponseWithError(c, "kb_id is required", err)
	}
	item.KBID = kbID
	if err := h.usecase.Update(c.Request().Context(), item); err != nil {
		return h.NewResponseWithError(c, "update webhook failed", err)
	}
	return h.NewResponseWithData(c, nil)
}

// Delete
//
//	@Summary		删除 Webhook
//	@Description	删除推送目标及其投递记录
//	@Tags			webhook
//	@Produce		json
//	@Param			kb_id	query		string	true	"Knowledge Base ID"
//	@Param			id		path		string	true	"Webhook ID"
//	@Success		200		{object}	domain.PWResponse
//	@Router			/api/v1/webhook/{id} [delete]
func (h *WebhookHandler) Delete(c echo.Context) error {
	kbID, err := middleware.GetKbID(c)
	if err != nil {
		return h.NewResponseWithError(c, "kb_id is required", err)
	}
	if err := h.usecase.Delete(c.Request().Context(), kbID, c.Param("id")); err != nil {
		return h.NewResponseWithError(c, "delete webhook failed", err)
	}
	return h.NewResponseWithData(c, nil)
}

// Deliveries
//
//	@Summary		投递记录
//	@Description	返回某 Webhook 最近 20 条投递记录
//	@Tags			webhook
//	@Produce		json
//	@Param			kb_id	query		string	true	"Knowledge Base ID"
//	@Param			id		path		string	true	"Webhook ID"
//	@Success		200		{object}	domain.PWResponse{data=[]domain.WebhookDelivery}
//	@Router			/api/v1/webhook/{id}/deliveries [get]
func (h *WebhookHandler) Deliveries(c echo.Context) error {
	kbID, err := middleware.GetKbID(c)
	if err != nil {
		return h.NewResponseWithError(c, "kb_id is required", err)
	}
	items, err := h.usecase.Deliveries(c.Request().Context(), kbID, c.Param("id"))
	if err != nil {
		return h.NewResponseWithError(c, "get webhook deliveries failed", err)
	}
	return h.NewResponseWithData(c, items)
}

// SendTest
//
//	@Summary		发送测试事件
//	@Description	向该 Webhook 推送一条 test 事件用于验证连通性
//	@Tags			webhook
//	@Produce		json
//	@Param			kb_id	query		string	true	"Knowledge Base ID"
//	@Param			id		path		string	true	"Webhook ID"
//	@Success		200		{object}	domain.PWResponse
//	@Router			/api/v1/webhook/{id}/test [post]
func (h *WebhookHandler) SendTest(c echo.Context) error {
	kbID, err := middleware.GetKbID(c)
	if err != nil {
		return h.NewResponseWithError(c, "kb_id is required", err)
	}
	if err := h.usecase.SendTest(c.Request().Context(), kbID, c.Param("id")); err != nil {
		return h.NewResponseWithError(c, "webhook test failed", err)
	}
	return h.NewResponseWithData(c, nil)
}
