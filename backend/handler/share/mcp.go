package share

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"gorm.io/gorm"

	"github.com/chaitin/panda-wiki/consts"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/repo/pg"
	"github.com/chaitin/panda-wiki/usecase"
)

const mcpToolCallResponseLimit = 64 * 1024

var mcpToolScopes = map[string]domain.MCPScope{
	"get_wiki_info":       domain.MCPScopeRead,
	"list_navs":           domain.MCPScopeRead,
	"list_docs":           domain.MCPScopeRead,
	"get_doc":             domain.MCPScopeRead,
	"search_docs":         domain.MCPScopeRead,
	"list_releases":       domain.MCPScopeRead,
	"list_doc_versions":   domain.MCPScopeRead,
	"get_doc_version":     domain.MCPScopeRead,
	"create_nav":          domain.MCPScopeWrite,
	"update_nav":          domain.MCPScopeWrite,
	"delete_nav":          domain.MCPScopeWrite,
	"create_doc":          domain.MCPScopeWrite,
	"update_doc":          domain.MCPScopeWrite,
	"move_doc":            domain.MCPScopeWrite,
	"delete_doc":          domain.MCPScopeWrite,
	"restore_doc_version": domain.MCPScopeWrite,
	"upload_asset":        domain.MCPScopeWrite,
	"publish_docs":        domain.MCPScopePublish,
	"list_comments":       domain.MCPScopeOps,
	"moderate_comment":    domain.MCPScopeOps,
	"list_contributions":  domain.MCPScopeOps,
	"audit_contribution":  domain.MCPScopeOps,
	"get_stats":           domain.MCPScopeOps,
}

type MCPServerHandler struct {
	logger       *log.Logger
	appUsecase   *usecase.AppUsecase
	kbUsecase    *usecase.KnowledgeBaseUsecase
	mcpUsecase   *usecase.MCPUsecase
	apiTokenRepo *pg.APITokenRepo
	mcpRepo      *pg.MCPRepository
	httpServer   *server.StreamableHTTPServer
}

func NewMCPServerHandler(
	e *echo.Echo,
	logger *log.Logger,
	appUsecase *usecase.AppUsecase,
	kbUsecase *usecase.KnowledgeBaseUsecase,
	mcpUsecase *usecase.MCPUsecase,
	apiTokenRepo *pg.APITokenRepo,
	mcpRepo *pg.MCPRepository,
) *MCPServerHandler {
	h := &MCPServerHandler{
		logger:       logger.WithModule("handler.share.mcp"),
		appUsecase:   appUsecase,
		kbUsecase:    kbUsecase,
		mcpUsecase:   mcpUsecase,
		apiTokenRepo: apiTokenRepo,
		mcpRepo:      mcpRepo,
	}

	mcpServer := server.NewMCPServer(
		"kenfut-wiki",
		serverVersion(),
		server.WithToolCapabilities(false),
		server.WithInstructions("Use list_navs/list_docs/search_docs to locate content, get_doc to read it, update_doc to edit a draft, and publish_docs to publish. Writes require an API token. Respect content_type; Markdown is the preferred format for edits."),
		server.WithToolFilter(h.filterTools),
		server.WithToolHandlerMiddleware(h.toolMiddleware),
	)
	h.registerTools(mcpServer)
	h.httpServer = server.NewStreamableHTTPServer(mcpServer, server.WithStateLess(true))

	e.Any("/mcp", echo.WrapHandler(h.httpServer), h.authenticate)
	return h
}

func serverVersion() string {
	if version := strings.TrimSpace(os.Getenv("VERSION")); version != "" {
		return version
	}
	return "dev"
}

func (h *MCPServerHandler) authenticate(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		c.Response().Header().Set("Access-Control-Allow-Origin", "*")
		c.Response().Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		c.Response().Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key, X-KB-ID, Mcp-Session-Id, Mcp-Protocol-Version")
		if c.Request().Method == http.MethodOptions {
			return c.NoContent(http.StatusNoContent)
		}

		kbID := strings.TrimSpace(c.Request().Header.Get("X-KB-ID"))
		if kbID == "" {
			kbID = strings.TrimSpace(c.QueryParam("kb_id"))
		}
		if kbID == "" {
			return c.JSON(http.StatusBadRequest, domain.PWResponse{Success: false, Message: "kb_id is required"})
		}

		ctx := c.Request().Context()
		kb, err := h.kbUsecase.GetKnowledgeBase(ctx, kbID)
		if err != nil {
			h.logger.Error("get knowledge base failed", log.String("kb_id", kbID), log.Error(err))
			return c.JSON(http.StatusNotFound, domain.PWResponse{Success: false, Message: "knowledge base not found"})
		}
		if kb.AccessSettings.IsForbidden {
			return c.JSON(http.StatusForbidden, domain.PWResponse{Success: false, Message: "access is forbidden"})
		}

		appInfo, err := h.appUsecase.GetMCPServerAppInfo(ctx, kbID)
		if err != nil {
			h.logger.Error("get MCP server settings failed", log.String("kb_id", kbID), log.Error(err))
			return c.JSON(http.StatusInternalServerError, domain.PWResponse{Success: false, Message: "get MCP server settings failed"})
		}
		settings := appInfo.Settings.MCPServerSettings
		if !settings.IsEnabled {
			return c.JSON(http.StatusNotFound, domain.PWResponse{Success: false, Message: "MCP server is not enabled"})
		}

		authInfo := &domain.MCPAuthInfo{
			KBID:     kbID,
			RemoteIP: c.RealIP(),
			Scopes:   map[domain.MCPScope]bool{domain.MCPScopeRead: true},
		}

		token := mcpBearerToken(c.Request())
		legacyOK := false
		if token != "" {
			apiToken, err := h.apiTokenRepo.GetByTokenWithCache(ctx, token)
			if err != nil {
				h.logger.Error("validate MCP API token failed", log.String("kb_id", kbID), log.Error(err))
				return c.JSON(http.StatusUnauthorized, domain.PWResponse{Success: false, Message: "invalid API token"})
			}
			if apiToken != nil {
				if apiToken.KbId != kbID {
					return c.JSON(http.StatusForbidden, domain.PWResponse{Success: false, Message: "token does not belong to this knowledge base"})
				}
				authInfo.UserID = apiToken.UserID
				authInfo.Permission = apiToken.Permission
				authInfo.TokenID = apiToken.ID
				authInfo.Scopes = domain.ScopesForKBPermission(apiToken.Permission)
			} else if settings.SampleAuth.Enabled && settings.SampleAuth.Password != "" {
				legacyOK = subtle.ConstantTimeCompare([]byte(token), []byte(settings.SampleAuth.Password)) == 1
			}
		}

		requireAuth := settings.RequireAuth || (settings.SampleAuth.Enabled && settings.SampleAuth.Password != "")
		if requireAuth && authInfo.UserID == "" && !legacyOK {
			c.Response().Header().Set("WWW-Authenticate", `Bearer realm="kenfut-wiki"`)
			return c.JSON(http.StatusUnauthorized, domain.PWResponse{Success: false, Message: "API token is required"})
		}
		if token != "" && authInfo.UserID == "" && !legacyOK {
			return c.JSON(http.StatusUnauthorized, domain.PWResponse{Success: false, Message: "invalid API token"})
		}
		if authInfo.UserID == "" || legacyOK {
			authInfo.Scopes = map[domain.MCPScope]bool{domain.MCPScopeRead: true}
		}
		if readOnlyMode() {
			authInfo.Scopes = map[domain.MCPScope]bool{domain.MCPScopeRead: true}
		}

		ctx = context.WithValue(ctx, domain.CtxMCPAuthInfoKey, authInfo)
		ctx = context.WithValue(ctx, domain.CtxAuthInfoKey, &domain.CtxAuthInfo{
			IsToken:    authInfo.UserID != "",
			Permission: authInfo.Permission,
			UserId:     authInfo.UserID,
			KBId:       kbID,
		})
		ctx = context.WithValue(ctx, consts.ContextKeyEdition, consts.LicenseEditionEnterprise)
		c.SetRequest(c.Request().WithContext(ctx))
		return next(c)
	}
}

func mcpBearerToken(request *http.Request) string {
	authorization := strings.TrimSpace(request.Header.Get("Authorization"))
	if authorization != "" {
		if token, found := strings.CutPrefix(authorization, "Bearer "); found {
			return strings.TrimSpace(token)
		}
		return ""
	}
	return strings.TrimSpace(request.Header.Get("X-API-Key"))
}

func readOnlyMode() bool {
	value := strings.ToLower(strings.TrimSpace(os.Getenv("READONLY")))
	return value == "1" || value == "true"
}

func (h *MCPServerHandler) filterTools(ctx context.Context, tools []mcp.Tool) []mcp.Tool {
	authInfo := domain.GetMCPAuthInfo(ctx)
	result := make([]mcp.Tool, 0, len(tools))
	for _, tool := range tools {
		scope, ok := mcpToolScopes[tool.Name]
		if !ok {
			continue
		}
		if authInfo.HasScope(scope) {
			result = append(result, tool)
		}
	}
	return result
}

func (h *MCPServerHandler) toolMiddleware(next server.ToolHandlerFunc) server.ToolHandlerFunc {
	return func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		start := time.Now()
		authInfo := domain.GetMCPAuthInfo(ctx)
		scope, ok := mcpToolScopes[request.Params.Name]
		if !ok {
			result := mcp.NewToolResultError("unknown tool")
			h.recordToolCall(ctx, request, result, nil, time.Since(start), "error", "unknown tool")
			return result, nil
		}
		if !authInfo.HasScope(scope) {
			result := mcp.NewToolResultError("permission denied for this tool")
			h.recordToolCall(ctx, request, result, nil, time.Since(start), "denied", "permission denied")
			return result, nil
		}
		if readOnlyMode() && scope != domain.MCPScopeRead {
			result := mcp.NewToolResultError(domain.ErrMCPReadOnly.Error())
			h.recordToolCall(ctx, request, result, nil, time.Since(start), "denied", domain.ErrMCPReadOnly.Error())
			return result, nil
		}

		result, err := next(ctx, request)
		status := "success"
		errorMessage := ""
		if err != nil {
			status = "error"
			errorMessage = err.Error()
		} else if result != nil && result.IsError {
			status = "error"
			errorMessage = mcpResultText(result)
		}
		h.recordToolCall(ctx, request, result, err, time.Since(start), status, errorMessage)
		return result, err
	}
}

func (h *MCPServerHandler) recordToolCall(ctx context.Context, request mcp.CallToolRequest, result *mcp.CallToolResult, callErr error, duration time.Duration, status, errorMessage string) {
	authInfo := domain.GetMCPAuthInfo(ctx)
	if authInfo == nil {
		h.logger.Error("skip MCP call audit without auth info", log.String("tool", request.Params.Name))
		return
	}
	call := &domain.MCPCallLog{
		KBID:       authInfo.KBID,
		RemoteIP:   authInfo.RemoteIP,
		ToolName:   request.Params.Name,
		Status:     status,
		Error:      errorMessage,
		DurationMS: int(duration.Milliseconds()),
		TokenID:    authInfo.TokenID,
		Scopes:     mcpScopeList(authInfo),
	}
	if session := server.ClientSessionFromContext(ctx); session != nil {
		call.MCPSessionID = session.SessionID()
	}
	if requestJSON, err := json.Marshal(request); err == nil {
		call.ToolCallReq = domain.MCPJSON(requestJSON)
	}
	if resultJSON, err := json.Marshal(result); err == nil {
		if len(resultJSON) > mcpToolCallResponseLimit {
			resultJSON = resultJSON[:mcpToolCallResponseLimit]
		}
		call.ToolCallResp = string(resultJSON)
	}
	if callErr != nil {
		call.Error = callErr.Error()
	}
	auditCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 3*time.Second)
	defer cancel()
	if err := h.mcpRepo.InsertMCPCall(auditCtx, call); err != nil {
		h.logger.Error("insert MCP call failed", log.String("kb_id", authInfo.KBID), log.String("tool", request.Params.Name), log.Error(err))
	}
}

func mcpScopeList(authInfo *domain.MCPAuthInfo) []string {
	if authInfo == nil {
		return []string{}
	}
	scopes := make([]string, 0, len(authInfo.Scopes))
	for scope, enabled := range authInfo.Scopes {
		if enabled {
			scopes = append(scopes, string(scope))
		}
	}
	return scopes
}

func mcpResultText(result *mcp.CallToolResult) string {
	if result == nil || len(result.Content) == 0 {
		return ""
	}
	if text, ok := mcp.AsTextContent(result.Content[0]); ok {
		return text.Text
	}
	return ""
}

func (h *MCPServerHandler) registerTools(s *server.MCPServer) {
	read := func(tool mcp.Tool, handler server.ToolHandlerFunc) {
		s.AddTool(tool, handler)
	}
	write := func(tool mcp.Tool, handler server.ToolHandlerFunc) {
		s.AddTool(tool, handler)
	}

	read(mcp.NewTool("get_wiki_info",
		mcp.WithDescription("Get knowledge base metadata, navigation list, content counts, and current MCP scopes."),
		mcp.WithReadOnlyHintAnnotation(true),
	), h.getWikiInfo)

	read(mcp.NewTool("list_navs",
		mcp.WithDescription("List navigations (top-level content sections) of the knowledge base."),
		mcp.WithReadOnlyHintAnnotation(true),
	), h.listNavs)

	read(mcp.NewTool("list_docs",
		mcp.WithDescription("List documents and folders. Use status=draft or status=published to filter. parent_id=root returns top-level nodes."),
		mcp.WithString("nav_id", mcp.Description("Navigation ID")),
		mcp.WithString("parent_id", mcp.Description("Parent folder ID, or root for top-level nodes")),
		mcp.WithString("status", mcp.Description("all, draft, unpublished, or published")),
		mcp.WithString("search", mcp.Description("Keyword matched against name and content")),
		mcp.WithNumber("limit", mcp.Description("Maximum number of items, default 50, max 200")),
		mcp.WithNumber("offset", mcp.Description("Offset for pagination")),
		mcp.WithReadOnlyHintAnnotation(true),
	), h.listDocs)

	read(mcp.NewTool("get_doc",
		mcp.WithDescription("Read a document. source=draft reads editable content; source=published reads the latest published version. format=markdown converts HTML content to Markdown."),
		mcp.WithString("node_id", mcp.Required(), mcp.Description("Document ID")),
		mcp.WithString("source", mcp.Description("draft or published, default draft")),
		mcp.WithString("format", mcp.Description("raw or markdown, default raw")),
		mcp.WithReadOnlyHintAnnotation(true),
	), h.getDoc)

	read(mcp.NewTool("search_docs",
		mcp.WithDescription("Search documents. mode=keyword searches names and content of drafts; mode=semantic searches published content through the configured RAG service."),
		mcp.WithString("query", mcp.Required(), mcp.Description("Search query")),
		mcp.WithString("mode", mcp.Description("keyword or semantic, default keyword")),
		mcp.WithString("nav_id", mcp.Description("Optional navigation ID")),
		mcp.WithNumber("limit", mcp.Description("Maximum number of results, default 20, max 50")),
		mcp.WithReadOnlyHintAnnotation(true),
	), h.searchDocs)

	read(mcp.NewTool("list_releases",
		mcp.WithDescription("List publishing releases of the knowledge base."),
		mcp.WithNumber("page", mcp.Description("Page number, default 1")),
		mcp.WithNumber("page_size", mcp.Description("Page size, default 20, max 100")),
		mcp.WithReadOnlyHintAnnotation(true),
	), h.listReleases)

	read(mcp.NewTool("list_doc_versions",
		mcp.WithDescription("List published history versions of a document."),
		mcp.WithString("node_id", mcp.Required(), mcp.Description("Document ID")),
		mcp.WithNumber("limit", mcp.Description("Maximum number of versions, default 20, max 100")),
		mcp.WithNumber("offset", mcp.Description("Offset for pagination")),
		mcp.WithReadOnlyHintAnnotation(true),
	), h.listDocVersions)

	read(mcp.NewTool("get_doc_version",
		mcp.WithDescription("Read a published history version by version ID."),
		mcp.WithString("version_id", mcp.Required(), mcp.Description("Version ID returned by list_doc_versions")),
		mcp.WithReadOnlyHintAnnotation(true),
	), h.getDocVersion)

	write(mcp.NewTool("create_nav",
		mcp.WithDescription("Create a navigation section."),
		mcp.WithString("name", mcp.Required(), mcp.Description("Navigation name")),
		mcp.WithNumber("position", mcp.Description("Optional position")),
	), h.createNav)

	write(mcp.NewTool("update_nav",
		mcp.WithDescription("Rename a navigation section."),
		mcp.WithString("nav_id", mcp.Required(), mcp.Description("Navigation ID")),
		mcp.WithString("name", mcp.Required(), mcp.Description("New navigation name")),
	), h.updateNav)

	write(mcp.NewTool("delete_nav",
		mcp.WithDescription("Delete a navigation and all documents inside it. confirm_name must exactly match the navigation name."),
		mcp.WithString("nav_id", mcp.Required(), mcp.Description("Navigation ID")),
		mcp.WithString("confirm_name", mcp.Required(), mcp.Description("Current navigation name")),
		mcp.WithDestructiveHintAnnotation(true),
	), h.deleteNav)

	write(mcp.NewTool("create_doc",
		mcp.WithDescription("Create a document draft. Content is stored as Markdown by default."),
		mcp.WithString("nav_id", mcp.Required(), mcp.Description("Navigation ID")),
		mcp.WithString("parent_id", mcp.Description("Optional parent folder ID")),
		mcp.WithString("name", mcp.Required(), mcp.Description("Document title")),
		mcp.WithString("content", mcp.Description("Document content")),
		mcp.WithString("content_type", mcp.Description("md or html, default md")),
		mcp.WithString("emoji", mcp.Description("Optional emoji")),
		mcp.WithString("summary", mcp.Description("Optional summary")),
		mcp.WithString("lang", mcp.Description("Content language, default zh")),
		mcp.WithNumber("position", mcp.Description("Optional position")),
		mcp.WithString("idempotency_key", mcp.Description("Optional key that prevents duplicate creation on retries")),
		mcp.WithIdempotentHintAnnotation(true),
	), h.createDoc)

	write(mcp.NewTool("update_doc",
		mcp.WithDescription("Update a document draft. Pass expected_updated_at from get_doc to detect concurrent edits."),
		mcp.WithString("node_id", mcp.Required(), mcp.Description("Document ID")),
		mcp.WithString("name", mcp.Description("New title")),
		mcp.WithString("content", mcp.Description("New content")),
		mcp.WithString("content_type", mcp.Description("md or html; can only be set when currently empty")),
		mcp.WithString("emoji", mcp.Description("New emoji")),
		mcp.WithString("summary", mcp.Description("New summary")),
		mcp.WithString("nav_id", mcp.Description("Move the document to this navigation")),
		mcp.WithString("expected_updated_at", mcp.Description("updated_at from get_doc, RFC3339")),
		mcp.WithString("idempotency_key", mcp.Description("Optional idempotency key")),
		mcp.WithIdempotentHintAnnotation(true),
	), h.updateDoc)

	write(mcp.NewTool("move_doc",
		mcp.WithDescription("Move a document to another navigation, parent folder, or position."),
		mcp.WithString("node_id", mcp.Required(), mcp.Description("Document ID")),
		mcp.WithString("nav_id", mcp.Description("Target navigation ID")),
		mcp.WithString("parent_id", mcp.Description("Target parent folder ID; empty means root")),
		mcp.WithString("prev_id", mcp.Description("Place after this sibling ID")),
		mcp.WithString("next_id", mcp.Description("Place before this sibling ID")),
	), h.moveDoc)

	write(mcp.NewTool("delete_doc",
		mcp.WithDescription("Delete a document. confirm_name must exactly match the document title. Deleting a non-empty folder requires recursive=true."),
		mcp.WithString("node_id", mcp.Required(), mcp.Description("Document ID")),
		mcp.WithString("confirm_name", mcp.Required(), mcp.Description("Current document title")),
		mcp.WithBoolean("recursive", mcp.Description("Delete child nodes of a folder")),
		mcp.WithString("idempotency_key", mcp.Description("Optional idempotency key")),
		mcp.WithDestructiveHintAnnotation(true),
	), h.deleteDoc)

	write(mcp.NewTool("restore_doc_version",
		mcp.WithDescription("Restore a published history version into the editable draft. This does not publish automatically."),
		mcp.WithString("node_id", mcp.Required(), mcp.Description("Document ID")),
		mcp.WithString("version_id", mcp.Required(), mcp.Description("Version ID")),
		mcp.WithString("expected_updated_at", mcp.Description("updated_at from get_doc, RFC3339")),
		mcp.WithString("idempotency_key", mcp.Description("Optional idempotency key")),
	), h.restoreDocVersion)

	write(mcp.NewTool("upload_asset",
		mcp.WithDescription("Upload an image or attachment and return its public URL for use in document content."),
		mcp.WithString("filename", mcp.Required(), mcp.Description("File name with extension")),
		mcp.WithString("content_base64", mcp.Required(), mcp.Description("Base64 content or data URL")),
	), h.uploadAsset)

	write(mcp.NewTool("publish_docs",
		mcp.WithDescription("Publish the given documents as a new release. The public site and RAG index update from this release."),
		mcp.WithArray("node_ids", mcp.Required(), mcp.WithStringItems(), mcp.Description("Document IDs to publish")),
		mcp.WithString("message", mcp.Required(), mcp.Description("Release message")),
		mcp.WithString("tag", mcp.Description("Release tag, default mcp")),
		mcp.WithString("idempotency_key", mcp.Description("Optional idempotency key")),
		mcp.WithIdempotentHintAnnotation(true),
	), h.publishDocs)

	write(mcp.NewTool("list_comments",
		mcp.WithDescription("List document comments. status can be pending, approved, or rejected."),
		mcp.WithString("status", mcp.Description("pending, approved, or rejected")),
		mcp.WithNumber("page", mcp.Description("Page number, default 1")),
		mcp.WithNumber("page_size", mcp.Description("Page size, default 20, max 100")),
		mcp.WithReadOnlyHintAnnotation(true),
	), h.listComments)

	write(mcp.NewTool("moderate_comment",
		mcp.WithDescription("Accept or reject comments."),
		mcp.WithArray("comment_ids", mcp.Required(), mcp.WithStringItems(), mcp.Description("Comment IDs")),
		mcp.WithString("status", mcp.Required(), mcp.Description("approved or rejected")),
		mcp.WithIdempotentHintAnnotation(true),
	), h.moderateComments)

	write(mcp.NewTool("list_contributions",
		mcp.WithDescription("List document contributions submitted by public users."),
		mcp.WithString("status", mcp.Description("pending, approved, or rejected")),
		mcp.WithString("node_name", mcp.Description("Filter by document name")),
		mcp.WithString("auth_name", mcp.Description("Filter by contributor name")),
		mcp.WithNumber("page", mcp.Description("Page number, default 1")),
		mcp.WithNumber("page_size", mcp.Description("Page size, default 20, max 100")),
		mcp.WithReadOnlyHintAnnotation(true),
	), h.listContributions)

	write(mcp.NewTool("audit_contribution",
		mcp.WithDescription("Approve or reject a document contribution. Approving an add request requires nav_id."),
		mcp.WithString("contribution_id", mcp.Required(), mcp.Description("Contribution ID")),
		mcp.WithString("status", mcp.Required(), mcp.Description("approved or rejected")),
		mcp.WithString("nav_id", mcp.Description("Target navigation ID for an add request")),
		mcp.WithString("parent_id", mcp.Description("Target parent folder ID for an add request")),
		mcp.WithNumber("position", mcp.Description("Optional position for an add request")),
		mcp.WithString("idempotency_key", mcp.Description("Optional idempotency key")),
		mcp.WithIdempotentHintAnnotation(true),
	), h.auditContribution)

	write(mcp.NewTool("get_stats",
		mcp.WithDescription("Get traffic, conversation, and hot document statistics."),
		mcp.WithNumber("days", mcp.Description("1, 7, 30, or 90; default 30")),
		mcp.WithReadOnlyHintAnnotation(true),
	), h.getStats)
}

func (h *MCPServerHandler) getWikiInfo(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	authInfo := domain.GetMCPAuthInfo(ctx)
	info, err := h.mcpUsecase.WikiInfo(ctx, authInfo.KBID)
	if err != nil {
		return mcpToolError(err)
	}
	info["scopes"] = mcpScopeList(authInfo)
	return mcp.NewToolResultJSON(info)
}

func (h *MCPServerHandler) listNavs(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	authInfo := domain.GetMCPAuthInfo(ctx)
	navs, err := h.mcpUsecase.ListNavs(ctx, authInfo.KBID)
	if err != nil {
		return mcpToolError(err)
	}
	return mcp.NewToolResultJSON(map[string]any{"items": navs})
}

func (h *MCPServerHandler) listDocs(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	authInfo := domain.GetMCPAuthInfo(ctx)
	req := &domain.MCPListDocsReq{
		NavID:    request.GetString("nav_id", ""),
		ParentID: request.GetString("parent_id", ""),
		Status:   request.GetString("status", ""),
		Search:   request.GetString("search", ""),
		Limit:    request.GetInt("limit", 0),
		Offset:   request.GetInt("offset", 0),
	}
	result, err := h.mcpUsecase.ListDocs(ctx, authInfo.KBID, req)
	if err != nil {
		return mcpToolError(err)
	}
	return mcp.NewToolResultJSON(result)
}

func (h *MCPServerHandler) getDoc(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	nodeID, err := request.RequireString("node_id")
	if err != nil {
		return mcpToolError(fmt.Errorf("%w: node_id is required", domain.ErrMCPInvalidArgument))
	}
	authInfo := domain.GetMCPAuthInfo(ctx)
	result, err := h.mcpUsecase.GetDoc(ctx, authInfo.KBID, &domain.MCPGetDocReq{
		NodeID: nodeID,
		Source: request.GetString("source", "draft"),
		Format: request.GetString("format", "raw"),
	})
	if err != nil {
		return mcpToolError(err)
	}
	return mcp.NewToolResultJSON(result)
}

func (h *MCPServerHandler) searchDocs(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	query, err := request.RequireString("query")
	if err != nil {
		return mcpToolError(fmt.Errorf("%w: query is required", domain.ErrMCPInvalidArgument))
	}
	authInfo := domain.GetMCPAuthInfo(ctx)
	result, err := h.mcpUsecase.SearchDocs(ctx, authInfo.KBID, &domain.MCPSearchReq{
		Query: query,
		Mode:  request.GetString("mode", "keyword"),
		NavID: request.GetString("nav_id", ""),
		Limit: request.GetInt("limit", 0),
	})
	if err != nil {
		return mcpToolError(err)
	}
	return mcp.NewToolResultJSON(result)
}

func (h *MCPServerHandler) listReleases(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	authInfo := domain.GetMCPAuthInfo(ctx)
	result, err := h.mcpUsecase.ListReleases(ctx, authInfo.KBID, request.GetInt("page", 1), request.GetInt("page_size", 20))
	if err != nil {
		return mcpToolError(err)
	}
	return mcp.NewToolResultJSON(result)
}

func (h *MCPServerHandler) listDocVersions(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	nodeID, err := request.RequireString("node_id")
	if err != nil {
		return mcpToolError(fmt.Errorf("%w: node_id is required", domain.ErrMCPInvalidArgument))
	}
	authInfo := domain.GetMCPAuthInfo(ctx)
	result, err := h.mcpUsecase.ListVersions(ctx, authInfo.KBID, &domain.MCPListVersionsReq{
		NodeID: nodeID,
		Limit:  request.GetInt("limit", 0),
		Offset: request.GetInt("offset", 0),
	})
	if err != nil {
		return mcpToolError(err)
	}
	return mcp.NewToolResultJSON(result)
}

func (h *MCPServerHandler) getDocVersion(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	versionID, err := request.RequireString("version_id")
	if err != nil {
		return mcpToolError(fmt.Errorf("%w: version_id is required", domain.ErrMCPInvalidArgument))
	}
	authInfo := domain.GetMCPAuthInfo(ctx)
	result, err := h.mcpUsecase.GetVersion(ctx, authInfo.KBID, versionID)
	if err != nil {
		return mcpToolError(err)
	}
	return mcp.NewToolResultJSON(result)
}

func (h *MCPServerHandler) createNav(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	name, err := request.RequireString("name")
	if err != nil {
		return mcpToolError(fmt.Errorf("%w: name is required", domain.ErrMCPInvalidArgument))
	}
	position, err := optionalFloat(request, "position")
	if err != nil {
		return mcpToolError(err)
	}
	authInfo := domain.GetMCPAuthInfo(ctx)
	result, err := h.mcpUsecase.CreateNav(ctx, authInfo.KBID, name, position)
	if err != nil {
		return mcpToolError(err)
	}
	return mcp.NewToolResultJSON(result)
}

func (h *MCPServerHandler) updateNav(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	navID, err := request.RequireString("nav_id")
	if err != nil {
		return mcpToolError(fmt.Errorf("%w: nav_id is required", domain.ErrMCPInvalidArgument))
	}
	name, err := request.RequireString("name")
	if err != nil {
		return mcpToolError(fmt.Errorf("%w: name is required", domain.ErrMCPInvalidArgument))
	}
	authInfo := domain.GetMCPAuthInfo(ctx)
	if err := h.mcpUsecase.UpdateNav(ctx, authInfo.KBID, navID, name); err != nil {
		return mcpToolError(err)
	}
	return mcp.NewToolResultJSON(map[string]any{"nav_id": navID, "name": name})
}

func (h *MCPServerHandler) deleteNav(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	navID, err := request.RequireString("nav_id")
	if err != nil {
		return mcpToolError(fmt.Errorf("%w: nav_id is required", domain.ErrMCPInvalidArgument))
	}
	confirmName, err := request.RequireString("confirm_name")
	if err != nil {
		return mcpToolError(fmt.Errorf("%w: confirm_name is required", domain.ErrMCPInvalidArgument))
	}
	authInfo := domain.GetMCPAuthInfo(ctx)
	result, err := h.mcpUsecase.DeleteNav(ctx, authInfo.KBID, navID, confirmName)
	if err != nil {
		return mcpToolError(err)
	}
	return mcp.NewToolResultJSON(result)
}

func (h *MCPServerHandler) createDoc(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	navID, err := request.RequireString("nav_id")
	if err != nil {
		return mcpToolError(fmt.Errorf("%w: nav_id is required", domain.ErrMCPInvalidArgument))
	}
	name, err := request.RequireString("name")
	if err != nil {
		return mcpToolError(fmt.Errorf("%w: name is required", domain.ErrMCPInvalidArgument))
	}
	position, err := optionalFloat(request, "position")
	if err != nil {
		return mcpToolError(err)
	}
	authInfo := domain.GetMCPAuthInfo(ctx)
	result, err := h.mcpUsecase.CreateDoc(ctx, authInfo.KBID, &domain.MCPCreateDocReq{
		NavID:          navID,
		ParentID:       request.GetString("parent_id", ""),
		Name:           name,
		Content:        request.GetString("content", ""),
		ContentType:    request.GetString("content_type", ""),
		Emoji:          request.GetString("emoji", ""),
		Summary:        request.GetString("summary", ""),
		Lang:           request.GetString("lang", ""),
		Position:       position,
		IdempotencyKey: request.GetString("idempotency_key", ""),
	})
	if err != nil {
		return mcpToolError(err)
	}
	return mcp.NewToolResultJSON(result)
}

func (h *MCPServerHandler) updateDoc(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	nodeID, err := request.RequireString("node_id")
	if err != nil {
		return mcpToolError(fmt.Errorf("%w: node_id is required", domain.ErrMCPInvalidArgument))
	}
	name, err := optionalString(request, "name")
	if err != nil {
		return mcpToolError(err)
	}
	content, err := optionalString(request, "content")
	if err != nil {
		return mcpToolError(err)
	}
	contentType, err := optionalString(request, "content_type")
	if err != nil {
		return mcpToolError(err)
	}
	emoji, err := optionalString(request, "emoji")
	if err != nil {
		return mcpToolError(err)
	}
	summary, err := optionalString(request, "summary")
	if err != nil {
		return mcpToolError(err)
	}
	navID, err := optionalString(request, "nav_id")
	if err != nil {
		return mcpToolError(err)
	}
	expectedUpdatedAt, err := optionalTime(request, "expected_updated_at")
	if err != nil {
		return mcpToolError(err)
	}
	authInfo := domain.GetMCPAuthInfo(ctx)
	result, err := h.mcpUsecase.UpdateDoc(ctx, authInfo.KBID, &domain.MCPUpdateDocReq{
		NodeID:            nodeID,
		Name:              name,
		Content:           content,
		ContentType:       contentType,
		Emoji:             emoji,
		Summary:           summary,
		NavID:             navID,
		ExpectedUpdatedAt: expectedUpdatedAt,
		IdempotencyKey:    request.GetString("idempotency_key", ""),
	})
	if err != nil {
		return mcpToolError(err)
	}
	return mcp.NewToolResultJSON(result)
}

func (h *MCPServerHandler) moveDoc(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	nodeID, err := request.RequireString("node_id")
	if err != nil {
		return mcpToolError(fmt.Errorf("%w: node_id is required", domain.ErrMCPInvalidArgument))
	}
	navID := request.GetString("nav_id", "")
	parentID := request.GetString("parent_id", "")
	prevID := request.GetString("prev_id", "")
	nextID := request.GetString("next_id", "")
	if navID == "" && parentID == "" && prevID == "" && nextID == "" {
		return mcpToolError(fmt.Errorf("%w: provide nav_id, parent_id, prev_id, or next_id", domain.ErrMCPInvalidArgument))
	}
	authInfo := domain.GetMCPAuthInfo(ctx)
	result, err := h.mcpUsecase.MoveDoc(ctx, authInfo.KBID, &domain.MCPMoveDocReq{
		NodeID:   nodeID,
		NavID:    navID,
		ParentID: parentID,
		PrevID:   prevID,
		NextID:   nextID,
	})
	if err != nil {
		return mcpToolError(err)
	}
	return mcp.NewToolResultJSON(result)
}

func (h *MCPServerHandler) deleteDoc(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	nodeID, err := request.RequireString("node_id")
	if err != nil {
		return mcpToolError(fmt.Errorf("%w: node_id is required", domain.ErrMCPInvalidArgument))
	}
	confirmName, err := request.RequireString("confirm_name")
	if err != nil {
		return mcpToolError(fmt.Errorf("%w: confirm_name is required", domain.ErrMCPInvalidArgument))
	}
	authInfo := domain.GetMCPAuthInfo(ctx)
	result, err := h.mcpUsecase.DeleteDoc(ctx, authInfo.KBID, &domain.MCPDeleteDocReq{
		NodeID:         nodeID,
		ConfirmName:    confirmName,
		Recursive:      request.GetBool("recursive", false),
		IdempotencyKey: request.GetString("idempotency_key", ""),
	})
	if err != nil {
		return mcpToolError(err)
	}
	return mcp.NewToolResultJSON(result)
}

func (h *MCPServerHandler) restoreDocVersion(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	nodeID, err := request.RequireString("node_id")
	if err != nil {
		return mcpToolError(fmt.Errorf("%w: node_id is required", domain.ErrMCPInvalidArgument))
	}
	versionID, err := request.RequireString("version_id")
	if err != nil {
		return mcpToolError(fmt.Errorf("%w: version_id is required", domain.ErrMCPInvalidArgument))
	}
	expectedUpdatedAt, err := optionalTime(request, "expected_updated_at")
	if err != nil {
		return mcpToolError(err)
	}
	authInfo := domain.GetMCPAuthInfo(ctx)
	result, err := h.mcpUsecase.RestoreVersion(ctx, authInfo.KBID, &domain.MCPRestoreVersionReq{
		NodeID:            nodeID,
		VersionID:         versionID,
		ExpectedUpdatedAt: expectedUpdatedAt,
		IdempotencyKey:    request.GetString("idempotency_key", ""),
	})
	if err != nil {
		return mcpToolError(err)
	}
	return mcp.NewToolResultJSON(result)
}

func (h *MCPServerHandler) uploadAsset(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	filename, err := request.RequireString("filename")
	if err != nil {
		return mcpToolError(fmt.Errorf("%w: filename is required", domain.ErrMCPInvalidArgument))
	}
	content, err := request.RequireString("content_base64")
	if err != nil {
		return mcpToolError(fmt.Errorf("%w: content_base64 is required", domain.ErrMCPInvalidArgument))
	}
	authInfo := domain.GetMCPAuthInfo(ctx)
	result, err := h.mcpUsecase.UploadAsset(ctx, authInfo.KBID, &domain.MCPUploadAssetReq{
		Filename:      filename,
		ContentBase64: content,
	})
	if err != nil {
		return mcpToolError(err)
	}
	return mcp.NewToolResultJSON(result)
}

func (h *MCPServerHandler) publishDocs(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	nodeIDs, err := request.RequireStringSlice("node_ids")
	if err != nil {
		return mcpToolError(fmt.Errorf("%w: node_ids is required", domain.ErrMCPInvalidArgument))
	}
	message, err := request.RequireString("message")
	if err != nil {
		return mcpToolError(fmt.Errorf("%w: message is required", domain.ErrMCPInvalidArgument))
	}
	authInfo := domain.GetMCPAuthInfo(ctx)
	result, err := h.mcpUsecase.PublishDocs(ctx, authInfo.KBID, &domain.MCPPublishReq{
		NodeIDs:        nodeIDs,
		Message:        message,
		Tag:            request.GetString("tag", ""),
		IdempotencyKey: request.GetString("idempotency_key", ""),
	})
	if err != nil {
		return mcpToolError(err)
	}
	return mcp.NewToolResultJSON(result)
}

func (h *MCPServerHandler) listComments(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	authInfo := domain.GetMCPAuthInfo(ctx)
	result, err := h.mcpUsecase.ListComments(ctx, authInfo.KBID, &domain.MCPListCommentsReq{
		Status:   request.GetString("status", ""),
		Page:     request.GetInt("page", 1),
		PageSize: request.GetInt("page_size", 20),
	})
	if err != nil {
		return mcpToolError(err)
	}
	return mcp.NewToolResultJSON(result)
}

func (h *MCPServerHandler) moderateComments(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	ids, err := request.RequireStringSlice("comment_ids")
	if err != nil {
		return mcpToolError(fmt.Errorf("%w: comment_ids is required", domain.ErrMCPInvalidArgument))
	}
	status, err := request.RequireString("status")
	if err != nil {
		return mcpToolError(fmt.Errorf("%w: status is required", domain.ErrMCPInvalidArgument))
	}
	authInfo := domain.GetMCPAuthInfo(ctx)
	if err := h.mcpUsecase.ModerateComments(ctx, authInfo.KBID, ids, status); err != nil {
		return mcpToolError(err)
	}
	return mcp.NewToolResultJSON(map[string]any{"comment_ids": ids, "status": status})
}

func (h *MCPServerHandler) listContributions(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	authInfo := domain.GetMCPAuthInfo(ctx)
	result, err := h.mcpUsecase.ListContributions(ctx, authInfo.KBID, &domain.MCPListContributionsReq{
		Status:   request.GetString("status", ""),
		NodeName: request.GetString("node_name", ""),
		AuthName: request.GetString("auth_name", ""),
		Page:     request.GetInt("page", 1),
		PageSize: request.GetInt("page_size", 20),
	})
	if err != nil {
		return mcpToolError(err)
	}
	return mcp.NewToolResultJSON(result)
}

func (h *MCPServerHandler) auditContribution(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	contributionID, err := request.RequireString("contribution_id")
	if err != nil {
		return mcpToolError(fmt.Errorf("%w: contribution_id is required", domain.ErrMCPInvalidArgument))
	}
	status, err := request.RequireString("status")
	if err != nil {
		return mcpToolError(fmt.Errorf("%w: status is required", domain.ErrMCPInvalidArgument))
	}
	position, err := optionalFloat(request, "position")
	if err != nil {
		return mcpToolError(err)
	}
	authInfo := domain.GetMCPAuthInfo(ctx)
	result, err := h.mcpUsecase.AuditContribution(ctx, authInfo.KBID, &domain.MCPAuditContributionReq{
		ID:             contributionID,
		Status:         status,
		NavID:          request.GetString("nav_id", ""),
		ParentID:       request.GetString("parent_id", ""),
		Position:       position,
		IdempotencyKey: request.GetString("idempotency_key", ""),
	})
	if err != nil {
		return mcpToolError(err)
	}
	return mcp.NewToolResultJSON(result)
}

func (h *MCPServerHandler) getStats(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	authInfo := domain.GetMCPAuthInfo(ctx)
	result, err := h.mcpUsecase.Stats(ctx, authInfo.KBID, &domain.MCPStatsReq{
		Days: request.GetInt("days", 30),
	})
	if err != nil {
		return mcpToolError(err)
	}
	return mcp.NewToolResultJSON(result)
}

func optionalString(request mcp.CallToolRequest, key string) (*string, error) {
	args := request.GetArguments()
	raw, ok := args[key]
	if !ok || raw == nil {
		return nil, nil
	}
	value, ok := raw.(string)
	if !ok {
		return nil, fmt.Errorf("%w: %s must be a string", domain.ErrMCPInvalidArgument, key)
	}
	return &value, nil
}

func optionalFloat(request mcp.CallToolRequest, key string) (*float64, error) {
	args := request.GetArguments()
	raw, ok := args[key]
	if !ok || raw == nil {
		return nil, nil
	}
	value, ok := raw.(float64)
	if !ok {
		return nil, fmt.Errorf("%w: %s must be a number", domain.ErrMCPInvalidArgument, key)
	}
	return &value, nil
}

func optionalTime(request mcp.CallToolRequest, key string) (*time.Time, error) {
	value := strings.TrimSpace(request.GetString(key, ""))
	if value == "" {
		return nil, nil
	}
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return nil, fmt.Errorf("%w: %s must be RFC3339", domain.ErrMCPInvalidArgument, key)
	}
	return &parsed, nil
}

func mcpToolError(err error) (*mcp.CallToolResult, error) {
	switch {
	case errors.Is(err, domain.ErrMCPVersionConflict):
		return mcp.NewToolResultError("document has been modified; call get_doc again and retry with the latest updated_at"), nil
	case errors.Is(err, gorm.ErrRecordNotFound):
		return mcp.NewToolResultError("not found"), nil
	default:
		return mcp.NewToolResultError(err.Error()), nil
	}
}
