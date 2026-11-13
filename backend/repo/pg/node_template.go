package pg

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/chaitin/panda-wiki/domain"
	storePG "github.com/chaitin/panda-wiki/store/pg"
)

type NodeTemplateRepository struct {
	db *storePG.DB
}

func NewNodeTemplateRepository(db *storePG.DB) *NodeTemplateRepository {
	return &NodeTemplateRepository{db: db}
}

func (r *NodeTemplateRepository) List(ctx context.Context, kbID string) ([]domain.NodeTemplate, error) {
	items := make([]domain.NodeTemplate, 0)
	err := r.db.WithContext(ctx).
		Model(&domain.NodeTemplate{}).
		Select("node_templates.*, users.account AS creator_name").
		Joins("LEFT JOIN users ON users.id = node_templates.creator_id").
		Where("node_templates.kb_id = ?", kbID).
		Order("node_templates.updated_at DESC").
		Scan(&items).Error
	return items, err
}

func (r *NodeTemplateRepository) Get(ctx context.Context, kbID, id string) (*domain.NodeTemplate, error) {
	item := &domain.NodeTemplate{}
	if err := r.db.WithContext(ctx).
		Where("kb_id = ? AND id = ?", kbID, id).
		First(item).Error; err != nil {
		return nil, err
	}
	return item, nil
}

func (r *NodeTemplateRepository) Create(ctx context.Context, item *domain.NodeTemplate) error {
	item.ID = uuid.NewString()
	item.CreatedAt = time.Now()
	item.UpdatedAt = item.CreatedAt
	return r.db.WithContext(ctx).Create(item).Error
}

func (r *NodeTemplateRepository) Update(ctx context.Context, item *domain.NodeTemplate) error {
	item.UpdatedAt = time.Now()
	result := r.db.WithContext(ctx).
		Model(&domain.NodeTemplate{}).
		Where("kb_id = ? AND id = ?", item.KBID, item.ID).
		Updates(map[string]any{
			"name":         item.Name,
			"summary":      item.Summary,
			"content":      item.Content,
			"content_type": item.ContentType,
			"updated_at":   item.UpdatedAt,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *NodeTemplateRepository) Delete(ctx context.Context, kbID, id string) error {
	result := r.db.WithContext(ctx).
		Where("kb_id = ? AND id = ?", kbID, id).
		Delete(&domain.NodeTemplate{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
