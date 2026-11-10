package v1

import (
	"strconv"

	"github.com/labstack/echo/v4"

	"github.com/chaitin/panda-wiki/consts"
	"github.com/chaitin/panda-wiki/handler"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/middleware"
	"github.com/chaitin/panda-wiki/repo/pg"
)

type MCPAdminHandler struct {
	*handler.BaseHandler
	logger *log.Logger
	repo   *pg.MCPRepository
}

func NewMCPAdminHandler(e *echo.Echo, baseHandler *handler.BaseHandler, logger *log.Logger, auth middleware.AuthMiddleware, repo *pg.MCPRepository) *MCPAdminHandler {
	h := &MCPAdminHandler{
		BaseHandler: baseHandler,
		logger:      logger.WithModule("handler.v1.mcp"),
		repo:        repo,
	}
	group := e.Group("/api/v1/mcp", auth.Authorize, auth.ValidateKBUserPerm(consts.UserKBPermissionFullControl))
	group.GET("/calls", h.ListCalls)
	return h
}

// ListCalls
//
//	@Summary		List MCP tool calls
//	@Description	List recent MCP tool calls of the knowledge base
//	@Tags			MCP
//	@Accept			json
//	@Produce		json
//	@Security		bearerAuth
//	@Param			kb_id	query		string	true	"Knowledge Base ID"
//	@Param			limit	query		int		false	"Maximum number of records"
//	@Success		200		{object}	domain.PWResponse{data=[]domain.MCPCallListItem}
//	@Router			/api/v1/mcp/calls [get]
func (h *MCPAdminHandler) ListCalls(c echo.Context) error {
	kbID := c.QueryParam("kb_id")
	if kbID == "" {
		return h.NewResponseWithError(c, "kb_id is required", nil)
	}
	limit := 20
	if value := c.QueryParam("limit"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil || parsed <= 0 {
			return h.NewResponseWithError(c, "invalid limit", err)
		}
		limit = parsed
	}
	items, err := h.repo.ListMCPCallItems(c.Request().Context(), kbID, limit)
	if err != nil {
		return h.NewResponseWithError(c, "list MCP calls failed", err)
	}
	return h.NewResponseWithData(c, items)
}
