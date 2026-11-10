package v1

import (
	"strconv"

	"github.com/labstack/echo/v4"

	"github.com/chaitin/panda-wiki/consts"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/handler"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/middleware"
	"github.com/chaitin/panda-wiki/usecase"
)

type AuthGroupHandler struct {
	*handler.BaseHandler
	logger  *log.Logger
	usecase *usecase.AuthGroupUsecase
}

func NewAuthGroupHandler(e *echo.Echo, baseHandler *handler.BaseHandler, logger *log.Logger, auth middleware.AuthMiddleware, usecase *usecase.AuthGroupUsecase) *AuthGroupHandler {
	h := &AuthGroupHandler{
		BaseHandler: baseHandler,
		logger:      logger.WithModule("handler.v1.auth_group"),
		usecase:     usecase,
	}
	group := e.Group("/api/pro/v1/auth/group", auth.Authorize, auth.ValidateKBUserPerm(consts.UserKBPermissionFullControl))
	group.POST("/create", h.Create)
	group.PATCH("/update", h.Update)
	group.DELETE("/delete", h.Delete)
	group.PATCH("/move", h.Move)
	group.GET("/list", h.List)
	group.GET("/tree", h.Tree)
	group.GET("/detail", h.Detail)
	group.POST("/sync", h.Sync)
	return h
}

// Sync
//
//	@Summary		Sync organization groups
//	@Description	Sync auth groups from DingTalk or WeCom
//	@Tags			AuthGroup
//	@Accept			json
//	@Produce		json
//	@Security		bearerAuth
//	@Param			body	body		domain.AuthGroupSyncReq	true	"Sync request"
//	@Success		200		{object}	domain.PWResponse
//	@Router			/api/pro/v1/auth/group/sync [post]
func (h *AuthGroupHandler) Sync(c echo.Context) error {
	var req domain.AuthGroupSyncReq
	if err := c.Bind(&req); err != nil {
		return h.NewResponseWithError(c, "request body is invalid", err)
	}
	if err := c.Validate(&req); err != nil {
		return h.NewResponseWithError(c, "validate request body failed", err)
	}
	if err := h.usecase.Sync(c.Request().Context(), &req); err != nil {
		return h.NewResponseWithError(c, "sync auth groups failed", err)
	}
	return h.NewResponseWithData(c, nil)
}

// Create
//
//	@Summary		Create auth group
//	@Description	Create auth group
//	@Tags			AuthGroup
//	@Accept			json
//	@Produce		json
//	@Security		bearerAuth
//	@Param			body	body		domain.AuthGroupCreateReq	true	"Auth group"
//	@Success		200		{object}	domain.PWResponse{data=map[string]uint}
//	@Router			/api/pro/v1/auth/group/create [post]
func (h *AuthGroupHandler) Create(c echo.Context) error {
	var req domain.AuthGroupCreateReq
	if err := c.Bind(&req); err != nil {
		return h.NewResponseWithError(c, "request body is invalid", err)
	}
	if err := c.Validate(&req); err != nil {
		return h.NewResponseWithError(c, "validate request body failed", err)
	}
	id, err := h.usecase.Create(c.Request().Context(), &req)
	if err != nil {
		return h.NewResponseWithError(c, "create auth group failed", err)
	}
	return h.NewResponseWithData(c, map[string]uint{"id": id})
}

// Update
//
//	@Summary		Update auth group
//	@Description	Update auth group
//	@Tags			AuthGroup
//	@Accept			json
//	@Produce		json
//	@Security		bearerAuth
//	@Param			body	body		domain.AuthGroupUpdateReq	true	"Auth group"
//	@Success		200		{object}	domain.PWResponse
//	@Router			/api/pro/v1/auth/group/update [patch]
func (h *AuthGroupHandler) Update(c echo.Context) error {
	var req domain.AuthGroupUpdateReq
	if err := c.Bind(&req); err != nil {
		return h.NewResponseWithError(c, "request body is invalid", err)
	}
	if err := c.Validate(&req); err != nil {
		return h.NewResponseWithError(c, "validate request body failed", err)
	}
	if err := h.usecase.Update(c.Request().Context(), &req); err != nil {
		return h.NewResponseWithError(c, "update auth group failed", err)
	}
	return h.NewResponseWithData(c, nil)
}

// Delete
//
//	@Summary		Delete auth group
//	@Description	Delete auth group
//	@Tags			AuthGroup
//	@Accept			json
//	@Produce		json
//	@Security		bearerAuth
//	@Param			kb_id	query		string	true	"Knowledge Base ID"
//	@Param			id		query		uint	true	"Auth group ID"
//	@Success		200		{object}	domain.PWResponse
//	@Router			/api/pro/v1/auth/group/delete [delete]
func (h *AuthGroupHandler) Delete(c echo.Context) error {
	kbID := c.QueryParam("kb_id")
	id, err := strconv.ParseUint(c.QueryParam("id"), 10, 64)
	if err != nil || kbID == "" {
		return h.NewResponseWithError(c, "kb_id and id are required", err)
	}
	if err := h.usecase.Delete(c.Request().Context(), kbID, uint(id)); err != nil {
		return h.NewResponseWithError(c, "delete auth group failed", err)
	}
	return h.NewResponseWithData(c, nil)
}

// Move
//
//	@Summary		Move auth group
//	@Description	Move auth group
//	@Tags			AuthGroup
//	@Accept			json
//	@Produce		json
//	@Security		bearerAuth
//	@Param			body	body		domain.AuthGroupMoveReq	true	"Auth group move request"
//	@Success		200		{object}	domain.PWResponse
//	@Router			/api/pro/v1/auth/group/move [patch]
func (h *AuthGroupHandler) Move(c echo.Context) error {
	var req domain.AuthGroupMoveReq
	if err := c.Bind(&req); err != nil {
		return h.NewResponseWithError(c, "request body is invalid", err)
	}
	if err := c.Validate(&req); err != nil {
		return h.NewResponseWithError(c, "validate request body failed", err)
	}
	if err := h.usecase.Move(c.Request().Context(), &req); err != nil {
		return h.NewResponseWithError(c, "move auth group failed", err)
	}
	return h.NewResponseWithData(c, nil)
}

// List
//
//	@Summary		List auth groups
//	@Description	List auth groups
//	@Tags			AuthGroup
//	@Accept			json
//	@Produce		json
//	@Security		bearerAuth
//	@Param			kb_id	query		string	true	"Knowledge Base ID"
//	@Success		200		{object}	domain.PWResponse{data=domain.AuthGroupListResp}
//	@Router			/api/pro/v1/auth/group/list [get]
func (h *AuthGroupHandler) List(c echo.Context) error {
	kbID := c.QueryParam("kb_id")
	if kbID == "" {
		return h.NewResponseWithError(c, "kb_id is required", nil)
	}
	result, err := h.usecase.List(c.Request().Context(), kbID)
	if err != nil {
		return h.NewResponseWithError(c, "list auth groups failed", err)
	}
	return h.NewResponseWithData(c, result)
}

// Tree
//
//	@Summary		Auth group tree
//	@Description	Auth group tree
//	@Tags			AuthGroup
//	@Accept			json
//	@Produce		json
//	@Security		bearerAuth
//	@Param			kb_id	query		string	true	"Knowledge Base ID"
//	@Success		200		{object}	domain.PWResponse{data=domain.AuthGroupTreeResp}
//	@Router			/api/pro/v1/auth/group/tree [get]
func (h *AuthGroupHandler) Tree(c echo.Context) error {
	kbID := c.QueryParam("kb_id")
	if kbID == "" {
		return h.NewResponseWithError(c, "kb_id is required", nil)
	}
	result, err := h.usecase.Tree(c.Request().Context(), kbID)
	if err != nil {
		return h.NewResponseWithError(c, "get auth group tree failed", err)
	}
	return h.NewResponseWithData(c, result)
}

// Detail
//
//	@Summary		Auth group detail
//	@Description	Auth group detail
//	@Tags			AuthGroup
//	@Accept			json
//	@Produce		json
//	@Security		bearerAuth
//	@Param			kb_id	query		string	true	"Knowledge Base ID"
//	@Param			id		query		uint	true	"Auth group ID"
//	@Success		200		{object}	domain.PWResponse{data=domain.AuthGroupDetailResp}
//	@Router			/api/pro/v1/auth/group/detail [get]
func (h *AuthGroupHandler) Detail(c echo.Context) error {
	kbID := c.QueryParam("kb_id")
	id, err := strconv.ParseUint(c.QueryParam("id"), 10, 64)
	if err != nil || kbID == "" {
		return h.NewResponseWithError(c, "kb_id and id are required", err)
	}
	result, err := h.usecase.Detail(c.Request().Context(), kbID, uint(id))
	if err != nil {
		return h.NewResponseWithError(c, "get auth group detail failed", err)
	}
	return h.NewResponseWithData(c, result)
}
