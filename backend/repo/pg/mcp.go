package pg

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/store/pg"
)

type MCPRepository struct {
	db     *pg.DB
	logger *log.Logger
}

func NewMCPRepository(db *pg.DB, logger *log.Logger) *MCPRepository {
	return &MCPRepository{db: db, logger: logger}
}

func (r *MCPRepository) GetMCPCallCount(ctx context.Context) (int64, error) {
	var count int64
	if err := r.db.WithContext(ctx).Table("mcp_calls").Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

func (r *MCPRepository) InsertMCPCall(ctx context.Context, call *domain.MCPCallLog) error {
	if call.CreatedAt.IsZero() {
		call.CreatedAt = time.Now()
	}
	if err := r.db.WithContext(ctx).Create(call).Error; err != nil {
		return fmt.Errorf("insert MCP call failed: %w", err)
	}
	return nil
}

func (r *MCPRepository) ListMCPCallItems(ctx context.Context, kbID string, limit int) ([]*domain.MCPCallListItem, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	items := make([]*domain.MCPCallListItem, 0)
	if err := r.db.WithContext(ctx).
		Table("mcp_calls").
		Select("id, tool_name, status, error, duration_ms, remote_ip, token_id, created_at").
		Where("kb_id = ?", kbID).
		Order("created_at DESC").
		Limit(limit).
		Scan(&items).Error; err != nil {
		return nil, fmt.Errorf("list MCP call items failed: %w", err)
	}
	return items, nil
}

func (r *MCPRepository) ListMCPCalls(ctx context.Context, kbID string, limit int) ([]*domain.MCPCallLog, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	calls := make([]*domain.MCPCallLog, 0)
	if err := r.db.WithContext(ctx).
		Where("kb_id = ?", kbID).
		Order("created_at DESC").
		Limit(limit).
		Find(&calls).Error; err != nil {
		return nil, fmt.Errorf("list MCP calls failed: %w", err)
	}
	return calls, nil
}

// BeginMCPOperation 写入幂等记录。返回 created=true 表示当前请求获得执行权；
// 返回 created=false 时 existing 是该幂等键此前的结果。
func (r *MCPRepository) BeginMCPOperation(ctx context.Context, operation *domain.MCPOperation) (*domain.MCPOperation, bool, error) {
	operation.Status = domain.MCPOperationStatusInProgress
	result := r.db.WithContext(ctx).
		Clauses(clause.OnConflict{DoNothing: true}).
		Create(operation)
	if result.Error != nil {
		return nil, false, fmt.Errorf("begin MCP operation failed: %w", result.Error)
	}
	if result.RowsAffected == 1 {
		return operation, true, nil
	}

	var existing domain.MCPOperation
	if err := r.db.WithContext(ctx).
		Where("kb_id = ? AND idempotency_key = ?", operation.KBID, operation.IdempotencyKey).
		First(&existing).Error; err != nil {
		return nil, false, fmt.Errorf("get MCP operation failed: %w", err)
	}
	return &existing, false, nil
}

func (r *MCPRepository) CompleteMCPOperation(ctx context.Context, id string, value any) error {
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("marshal MCP operation result failed: %w", err)
	}
	if err := r.db.WithContext(ctx).
		Model(&domain.MCPOperation{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"status":     domain.MCPOperationStatusCompleted,
			"result":     gorm.Expr("?::jsonb", string(data)),
			"error":      "",
			"updated_at": time.Now(),
		}).Error; err != nil {
		return fmt.Errorf("complete MCP operation failed: %w", err)
	}
	return nil
}

func (r *MCPRepository) FailMCPOperation(ctx context.Context, id, message string) error {
	if err := r.db.WithContext(ctx).
		Model(&domain.MCPOperation{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"status":     domain.MCPOperationStatusFailed,
			"error":      message,
			"updated_at": time.Now(),
		}).Error; err != nil {
		return fmt.Errorf("fail MCP operation failed: %w", err)
	}
	return nil
}
