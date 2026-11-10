package v1

import (
	"errors"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"

	"github.com/chaitin/panda-wiki/consts"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/handler"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/middleware"
	"github.com/chaitin/panda-wiki/usecase"
)

type APITokenHandler struct {
	*handler.BaseHandler
	logger  *log.Logger
	usecase *usecase.APITokenUsecase
}

func NewAPITokenHandler(e *echo.Echo, baseHandler *handler.BaseHandler, logger *log.Logger, auth middleware.AuthMiddleware, usecase *usecase.APITokenUsecase) *APITokenHandler {
	h := &APITokenHandler{
		BaseHandler: baseHandler,
		logger:      logger.WithModule("handler.v1.api_token"),
		usecase:     usecase,
	}
	group := e.Group("/api/pro/v1/token", auth.Authorize, auth.ValidateKBUserPerm(consts.UserKBPermissionFullControl))
	group.POST("/create", h.Create)
	group.GET("/list", h.List)
	group.PATCH("/update", h.Update)
	group.DELETE("/delete", h.Delete)
	return h
}

// Create
//
//	@Summary		Create API Token
//	@Description	Create API Token
//	@Tags			ApiToken
//	@Accept			json
//	@Produce		json
//	@Security		bearerAuth
//	@Param			body	body		domain.CreateAPITokenReq	true	"Create API Token"
//	@Success		200		{object}	domain.PWResponse{data=domain.APITokenListItem}
//	@Router			/api/pro/v1/token/create [post]
func (h *APITokenHandler) Create(c echo.Context) error {
	var req domain.CreateAPITokenReq
	if err := c.Bind(&req); err != nil {
		return h.NewResponseWithError(c, "request body is invalid", err)
	}
	if err := c.Validate(&req); err != nil {
		return h.NewResponseWithError(c, "validate request body failed", err)
	}
	authInfo := domain.GetAuthInfoFromCtx(c.Request().Context())
	if authInfo == nil {
		return h.NewResponseWithError(c, "auth info is missing", nil)
	}
	token, err := h.usecase.Create(c.Request().Context(), &req, authInfo.UserId)
	if err != nil {
		return h.NewResponseWithError(c, "create API token failed", err)
	}
	return h.NewResponseWithData(c, &domain.APITokenListItem{
		ID:         token.ID,
		Name:       token.Name,
		Permission: token.Permission,
		Token:      token.Token,
		CreatedAt:  token.CreatedAt,
		UpdatedAt:  token.UpdatedAt,
	})
}

// List
//
//	@Summary		List API Tokens
//	@Description	List API Tokens
//	@Tags			ApiToken
//	@Accept			json
//	@Produce		json
//	@Security		bearerAuth
//	@Param			kb_id	query		string	true	"Knowledge Base ID"
//	@Success		200		{object}	domain.PWResponse{data=[]domain.APITokenListItem}
//	@Router			/api/pro/v1/token/list [get]
func (h *APITokenHandler) List(c echo.Context) error {
	kbID := c.QueryParam("kb_id")
	if kbID == "" {
		return h.NewResponseWithError(c, "kb_id is required", nil)
	}
	items, err := h.usecase.List(c.Request().Context(), kbID)
	if err != nil {
		return h.NewResponseWithError(c, "list API tokens failed", err)
	}
	return h.NewResponseWithData(c, items)
}

// Update
//
//	@Summary		Update API Token
//	@Description	Update API Token
//	@Tags			ApiToken
//	@Accept			json
//	@Produce		json
//	@Security		bearerAuth
//	@Param			body	body		domain.UpdateAPITokenReq	true	"Update API Token"
//	@Success		200		{object}	domain.PWResponse
//	@Router			/api/pro/v1/token/update [patch]
func (h *APITokenHandler) Update(c echo.Context) error {
	var req domain.UpdateAPITokenReq
	if err := c.Bind(&req); err != nil {
		return h.NewResponseWithError(c, "request body is invalid", err)
	}
	if err := c.Validate(&req); err != nil {
		return h.NewResponseWithError(c, "validate request body failed", err)
	}
	if err := h.usecase.Update(c.Request().Context(), &req); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return h.NewResponseWithError(c, "API token not found", err)
		}
		return h.NewResponseWithError(c, "update API token failed", err)
	}
	return h.NewResponseWithData(c, nil)
}

// Delete
//
//	@Summary		Delete API Token
//	@Description	Delete API Token
//	@Tags			ApiToken
//	@Accept			json
//	@Produce		json
//	@Security		bearerAuth
//	@Param			id		query		string	true	"Token ID"
//	@Param			kb_id	query		string	true	"Knowledge Base ID"
//	@Success		200		{object}	domain.PWResponse
//	@Router			/api/pro/v1/token/delete [delete]
func (h *APITokenHandler) Delete(c echo.Context) error {
	id := c.QueryParam("id")
	kbID := c.QueryParam("kb_id")
	if id == "" || kbID == "" {
		return h.NewResponseWithError(c, "id and kb_id are required", nil)
	}
	if err := h.usecase.Delete(c.Request().Context(), kbID, id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return h.NewResponseWithError(c, "API token not found", err)
		}
		return h.NewResponseWithError(c, "delete API token failed", err)
	}
	return h.NewResponseWithData(c, nil)
}
