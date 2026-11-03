package v1

import (
	"github.com/labstack/echo/v4"

	"github.com/chaitin/panda-wiki/consts"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/handler"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/middleware"
	"github.com/chaitin/panda-wiki/usecase"
)

type StorageHandler struct {
	*handler.BaseHandler
	logger  *log.Logger
	auth    middleware.AuthMiddleware
	usecase *usecase.StorageUsecase
}

func NewStorageHandler(echo *echo.Echo, baseHandler *handler.BaseHandler, logger *log.Logger, auth middleware.AuthMiddleware, usecase *usecase.StorageUsecase) *StorageHandler {
	h := &StorageHandler{
		BaseHandler: baseHandler,
		logger:      logger.WithModule("handler.v1.storage"),
		auth:        auth,
		usecase:     usecase,
	}
	group := echo.Group("/api/v1/storage", h.auth.Authorize, h.auth.ValidateUserRole(consts.UserRoleAdmin))
	group.GET("/setting", h.GetSetting)
	group.POST("/setting", h.UpdateSetting)
	group.POST("/test", h.TestConnection)
	group.DELETE("/setting", h.ResetSetting)
	return h
}

// GetSetting
//
//	@Summary		get storage setting
//	@Description	get current effective storage setting (secret masked) and client status
//	@Tags			storage
//	@Accept			json
//	@Produce		json
//	@Success		200	{object}	domain.Response{data=domain.StorageSettingDetail}
//	@Router			/api/v1/storage/setting [get]
func (h *StorageHandler) GetSetting(c echo.Context) error {
	ctx := c.Request().Context()
	detail, err := h.usecase.GetSetting(ctx)
	if err != nil {
		return h.NewResponseWithError(c, "get storage setting failed", err)
	}
	return h.NewResponseWithData(c, detail)
}

// UpdateSetting
//
//	@Summary		update storage setting
//	@Description	validate, save storage setting and rebuild client; empty or masked secret keeps current value
//	@Tags			storage
//	@Accept			json
//	@Produce		json
//	@Param			request	body		domain.StorageSetting	true	"storage setting"
//	@Success		200		{object}	domain.Response{data=domain.StorageSettingDetail}
//	@Router			/api/v1/storage/setting [post]
func (h *StorageHandler) UpdateSetting(c echo.Context) error {
	var req domain.StorageSetting
	if err := c.Bind(&req); err != nil {
		return h.NewResponseWithError(c, "bind request failed", err)
	}
	ctx := c.Request().Context()
	detail, err := h.usecase.UpdateSetting(ctx, &req)
	if err != nil {
		return h.NewResponseWithError(c, err.Error(), err)
	}
	return h.NewResponseWithData(c, detail)
}

// TestConnection
//
//	@Summary		test storage connection
//	@Description	probe storage connectivity with the given setting without saving
//	@Tags			storage
//	@Accept			json
//	@Produce		json
//	@Param			request	body		domain.StorageSetting	true	"storage setting"
//	@Success		200		{object}	domain.Response{data=domain.StorageTestResult}
//	@Router			/api/v1/storage/test [post]
func (h *StorageHandler) TestConnection(c echo.Context) error {
	var req domain.StorageSetting
	if err := c.Bind(&req); err != nil {
		return h.NewResponseWithError(c, "bind request failed", err)
	}
	ctx := c.Request().Context()
	result, err := h.usecase.TestConnection(ctx, &req)
	if err != nil {
		return h.NewResponseWithError(c, err.Error(), err)
	}
	return h.NewResponseWithData(c, result)
}

// ResetSetting
//
//	@Summary		reset storage setting
//	@Description	delete saved storage setting and fall back to env default
//	@Tags			storage
//	@Accept			json
//	@Produce		json
//	@Success		200	{object}	domain.Response
//	@Router			/api/v1/storage/setting [delete]
func (h *StorageHandler) ResetSetting(c echo.Context) error {
	ctx := c.Request().Context()
	if err := h.usecase.ResetSetting(ctx); err != nil {
		return h.NewResponseWithError(c, "reset storage setting failed", err)
	}
	return h.NewResponseWithData(c, nil)
}
