package domain

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/lib/pq"

	"github.com/chaitin/panda-wiki/consts"
)

type MCPScope string

const (
	MCPScopeRead    MCPScope = "read"
	MCPScopeWrite   MCPScope = "write"
	MCPScopePublish MCPScope = "publish"
	MCPScopeOps     MCPScope = "ops"
)

const CtxMCPAuthInfoKey contextKey = "ctx_mcp_auth_info"

var (
	ErrMCPPermissionDenied    = errors.New("permission denied")
	ErrMCPReadOnly            = errors.New("server is in read-only mode")
	ErrMCPOperationInProgress = errors.New("operation is already in progress")
	ErrMCPVersionConflict     = errors.New("document has been modified by another editor")
	ErrMCPInvalidArgument     = errors.New("invalid argument")
)

type MCPAuthInfo struct {
	KBID       string
	UserID     string
	Permission consts.UserKBPermission
	TokenID    string
	Scopes     map[MCPScope]bool
	RemoteIP   string
}

func (a *MCPAuthInfo) HasScope(scope MCPScope) bool {
	if a == nil {
		return false
	}
	return a.Scopes[scope]
}

func GetMCPAuthInfo(ctx context.Context) *MCPAuthInfo {
	value := ctx.Value(CtxMCPAuthInfoKey)
	if value == nil {
		return nil
	}
	info, ok := value.(*MCPAuthInfo)
	if !ok {
		return nil
	}
	return info
}

func ScopesForKBPermission(permission consts.UserKBPermission) map[MCPScope]bool {
	switch permission {
	case consts.UserKBPermissionFullControl:
		return map[MCPScope]bool{
			MCPScopeRead:    true,
			MCPScopeWrite:   true,
			MCPScopePublish: true,
			MCPScopeOps:     true,
		}
	case consts.UserKBPermissionDocManage:
		return map[MCPScope]bool{
			MCPScopeRead:    true,
			MCPScopeWrite:   true,
			MCPScopePublish: true,
		}
	case consts.UserKBPermissionDataOperate:
		return map[MCPScope]bool{
			MCPScopeRead: true,
			MCPScopeOps:  true,
		}
	default:
		return map[MCPScope]bool{}
	}
}

type MCPJSON []byte

func (j MCPJSON) Value() (driver.Value, error) {
	if len(j) == 0 {
		return nil, nil
	}
	return []byte(j), nil
}

func (j *MCPJSON) Scan(value any) error {
	if value == nil {
		*j = nil
		return nil
	}
	switch v := value.(type) {
	case []byte:
		*j = append((*j)[:0], v...)
		return nil
	case string:
		*j = append((*j)[:0], v...)
		return nil
	default:
		return fmt.Errorf("cannot scan %T into MCPJSON", value)
	}
}

const (
	MCPOperationStatusInProgress = "in_progress"
	MCPOperationStatusCompleted  = "completed"
	MCPOperationStatusFailed     = "failed"
)

type MCPOperation struct {
	ID             string    `json:"id" gorm:"primaryKey"`
	KBID           string    `json:"kb_id" gorm:"not null"`
	IdempotencyKey string    `json:"idempotency_key" gorm:"not null"`
	ToolName       string    `json:"tool_name" gorm:"not null"`
	Status         string    `json:"status" gorm:"not null"`
	Result         MCPJSON   `json:"result" gorm:"type:jsonb"`
	Error          string    `json:"error"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

func (MCPOperation) TableName() string {
	return "mcp_operations"
}

type MCPCallLog struct {
	ID             int64          `json:"id" gorm:"primaryKey;autoIncrement"`
	MCPSessionID   string         `json:"mcp_session_id" gorm:"column:mcp_session_id"`
	KBID           string         `json:"kb_id" gorm:"column:kb_id"`
	RemoteIP       string         `json:"remote_ip" gorm:"column:remote_ip"`
	InitializeReq  MCPJSON        `json:"initialize_req" gorm:"column:initialize_req;type:jsonb"`
	InitializeResp MCPJSON        `json:"initialize_resp" gorm:"column:initialize_resp;type:jsonb"`
	ToolCallReq    MCPJSON        `json:"tool_call_req" gorm:"column:tool_call_req;type:jsonb"`
	ToolCallResp   string         `json:"tool_call_resp" gorm:"column:tool_call_resp"`
	ToolName       string         `json:"tool_name" gorm:"column:tool_name"`
	Status         string         `json:"status" gorm:"column:status"`
	Error          string         `json:"error" gorm:"column:error"`
	DurationMS     int            `json:"duration_ms" gorm:"column:duration_ms"`
	TokenID        string         `json:"token_id" gorm:"column:token_id"`
	Scopes         pq.StringArray `json:"scopes" gorm:"column:scopes;type:text[]"`
	CreatedAt      time.Time      `json:"created_at" gorm:"column:created_at"`
}

func (MCPCallLog) TableName() string {
	return "mcp_calls"
}

type MCPCallListItem struct {
	ID         int64     `json:"id"`
	ToolName   string    `json:"tool_name"`
	Status     string    `json:"status"`
	Error      string    `json:"error"`
	DurationMS int       `json:"duration_ms"`
	RemoteIP   string    `json:"remote_ip"`
	TokenID    string    `json:"token_id"`
	CreatedAt  time.Time `json:"created_at"`
}

type MCPListDocsReq struct {
	NavID    string
	ParentID string
	Status   string
	Search   string
	Limit    int
	Offset   int
}

type MCPListDocsResp struct {
	Total int64               `json:"total"`
	Items []*NodeListItemResp `json:"items"`
}

type MCPDocSearchResp struct {
	Items []*MCPDocSearchItem `json:"items"`
}

type MCPDocDetail struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Type        NodeType   `json:"type"`
	Status      NodeStatus `json:"status"`
	NavID       string     `json:"nav_id"`
	ParentID    string     `json:"parent_id"`
	Lang        string     `json:"lang"`
	Content     string     `json:"content"`
	ContentType string     `json:"content_type"`
	Emoji       string     `json:"emoji"`
	Summary     string     `json:"summary"`
	UpdatedAt   time.Time  `json:"updated_at"`
	VersionID   string     `json:"version_id,omitempty"`
}

type MCPGetDocReq struct {
	NodeID string
	Source string
	Format string
}

type MCPSearchReq struct {
	Query string
	Mode  string
	NavID string
	Limit int
}

type MCPDocSearchItem struct {
	NodeID   string     `json:"node_id"`
	Name     string     `json:"name"`
	Snippet  string     `json:"snippet"`
	Score    float64    `json:"score,omitempty"`
	Status   NodeStatus `json:"status"`
	NavID    string     `json:"nav_id"`
	ParentID string     `json:"parent_id"`
	Lang     string     `json:"lang"`
}

type MCPCreateDocReq struct {
	NavID          string
	ParentID       string
	Name           string
	Content        string
	ContentType    string
	Emoji          string
	Summary        string
	Lang           string
	Position       *float64
	IdempotencyKey string
}

type MCPUpdateDocReq struct {
	NodeID            string
	Name              *string
	Content           *string
	ContentType       *string
	Emoji             *string
	Summary           *string
	NavID             *string
	ExpectedUpdatedAt *time.Time
	IdempotencyKey    string
}

type MCPMoveDocReq struct {
	NodeID   string
	ParentID string
	PrevID   string
	NextID   string
	NavID    string
}

type MCPDeleteDocReq struct {
	NodeID         string
	ConfirmName    string
	Recursive      bool
	IdempotencyKey string
}

type MCPPublishReq struct {
	NodeIDs        []string
	Message        string
	Tag            string
	IdempotencyKey string
}

type MCPListVersionsReq struct {
	NodeID string
	Limit  int
	Offset int
}

type MCPVersionItem struct {
	ID          string    `json:"id"`
	NodeID      string    `json:"node_id"`
	Name        string    `json:"name"`
	PublisherID string    `json:"publisher_id"`
	EditorID    string    `json:"editor_id"`
	CreatedAt   time.Time `json:"created_at"`
}

type MCPRestoreVersionReq struct {
	NodeID            string
	VersionID         string
	ExpectedUpdatedAt *time.Time
	IdempotencyKey    string
}

type MCPUploadAssetReq struct {
	Filename      string
	ContentBase64 string
	MimeType      string
}

type MCPModerateCommentReq struct {
	CommentIDs []string
	Status     CommentStatus
}

type MCPAuditContributionReq struct {
	ID             string
	Status         string
	NavID          string
	ParentID       string
	Position       *float64
	IdempotencyKey string
}

type MCPListCommentsReq struct {
	Status   string
	Page     int
	PageSize int
}

type MCPListContributionsReq struct {
	Status   string
	NodeName string
	AuthName string
	Page     int
	PageSize int
}

type MCPStatsReq struct {
	Days int
}

func NormalizeMCPLimit(limit, defaultValue, maxValue int) int {
	if limit <= 0 {
		return defaultValue
	}
	if limit > maxValue {
		return maxValue
	}
	return limit
}

func DecodeMCPJSON[T any](data MCPJSON) (*T, error) {
	if len(data) == 0 {
		return nil, errors.New("empty MCP operation result")
	}
	var value T
	if err := json.Unmarshal(data, &value); err != nil {
		return nil, fmt.Errorf("decode MCP operation result: %w", err)
	}
	return &value, nil
}
