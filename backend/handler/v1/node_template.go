package v1

import (
	"github.com/labstack/echo/v4"

	"github.com/chaitin/panda-wiki/consts"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/handler"
	"github.com/chaitin/panda-wiki/middleware"
	"github.com/chaitin/panda-wiki/usecase"
)

type NodeTemplateHandler struct {
	*handler.BaseHandler
	usecase *usecase.NodeTemplateUsecase
}

func NewNodeTemplateHandler(e *echo.Echo, base *handler.BaseHandler, auth middleware.AuthMiddleware, u *usecase.NodeTemplateUsecase) *NodeTemplateHandler {
	h := &NodeTemplateHandler{BaseHandler: base, usecase: u}
	group := e.Group("/api/v1/node_template", auth.Authorize, auth.ValidateKBUserPerm(consts.UserKBPermissionDocManage))
	group.GET("/list", h.List)
	group.POST("", h.Create)
	group.PUT("/:id", h.Update)
	group.DELETE("/:id", h.Delete)
	return h
}

// List
//
//	@Summary		文档模板列表
//	@Description	列出当前知识库的全部文档模板
//	@Tags			node_template
//	@Produce		json
//	@Param			kb_id	query		string	true	"Knowledge Base ID"
//	@Success		200		{object}	domain.PWResponse{data=[]domain.NodeTemplate}
//	@Router			/api/v1/node_template/list [get]
func (h *NodeTemplateHandler) List(c echo.Context) error {
	kbID, err := middleware.GetKbID(c)
	if err != nil {
		return h.NewResponseWithError(c, "kb_id is required", err)
	}
	items, err := h.usecase.List(c.Request().Context(), kbID)
	if err != nil {
		return h.NewResponseWithError(c, "get node template list failed", err)
	}
	return h.NewResponseWithData(c, items)
}

// Create
//
//	@Summary		创建文档模板
//	@Description	保存一份文档模板供新建文档时复制
//	@Tags			node_template
//	@Accept			json
//	@Produce		json
//	@Param			body	body		domain.CreateNodeTemplateReq	true	"Template"
//	@Success		200		{object}	domain.PWResponse{data=domain.NodeTemplate}
//	@Router			/api/v1/node_template [post]
func (h *NodeTemplateHandler) Create(c echo.Context) error {
	req := &domain.CreateNodeTemplateReq{}
	if err := c.Bind(req); err != nil {
		return h.NewResponseWithError(c, "request body is invalid", err)
	}
	kbID, err := middleware.GetKbID(c)
	if err != nil {
		return h.NewResponseWithError(c, "kb_id is required", err)
	}
	req.KBID = kbID
	authInfo := domain.GetAuthInfoFromCtx(c.Request().Context())
	userID := ""
	if authInfo != nil {
		userID = authInfo.UserId
	}
	item, err := h.usecase.Create(c.Request().Context(), req, userID)
	if err != nil {
		return h.NewResponseWithError(c, "create node template failed", err)
	}
	return h.NewResponseWithData(c, item)
}

// Update
//
//	@Summary		更新文档模板
//	@Description	修改模板名称、摘要与内容
//	@Tags			node_template
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string							true	"Template ID"
//	@Param			body	body		domain.UpdateNodeTemplateReq	true	"Template"
//	@Success		200		{object}	domain.PWResponse
//	@Router			/api/v1/node_template/{id} [put]
func (h *NodeTemplateHandler) Update(c echo.Context) error {
	req := &domain.UpdateNodeTemplateReq{}
	if err := c.Bind(req); err != nil {
		return h.NewResponseWithError(c, "request body is invalid", err)
	}
	req.ID = c.Param("id")
	kbID, err := middleware.GetKbID(c)
	if err != nil {
		return h.NewResponseWithError(c, "kb_id is required", err)
	}
	req.KBID = kbID
	if err := h.usecase.Update(c.Request().Context(), req); err != nil {
		return h.NewResponseWithError(c, "update node template failed", err)
	}
	return h.NewResponseWithData(c, nil)
}

// Delete
//
//	@Summary		删除文档模板
//	@Description	删除指定的文档模板
//	@Tags			node_template
//	@Produce		json
//	@Param			kb_id	query		string	true	"Knowledge Base ID"
//	@Param			id		path		string	true	"Template ID"
//	@Success		200		{object}	domain.PWResponse
//	@Router			/api/v1/node_template/{id} [delete]
func (h *NodeTemplateHandler) Delete(c echo.Context) error {
	kbID, err := middleware.GetKbID(c)
	if err != nil {
		return h.NewResponseWithError(c, "kb_id is required", err)
	}
	if err := h.usecase.Delete(c.Request().Context(), kbID, c.Param("id")); err != nil {
		return h.NewResponseWithError(c, "delete node template failed", err)
	}
	return h.NewResponseWithData(c, nil)
}
