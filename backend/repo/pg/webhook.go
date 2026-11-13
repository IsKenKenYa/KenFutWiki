package pg

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/chaitin/panda-wiki/domain"
	storePG "github.com/chaitin/panda-wiki/store/pg"
)

type WebhookRepository struct {
	db *storePG.DB
}

func NewWebhookRepository(db *storePG.DB) *WebhookRepository {
	return &WebhookRepository{db: db}
}

func (r *WebhookRepository) List(ctx context.Context, kbID string) ([]domain.Webhook, error) {
	items := make([]domain.Webhook, 0)
	err := r.db.WithContext(ctx).
		Where("kb_id = ?", kbID).
		Order("created_at DESC").
		Find(&items).Error
	return items, err
}

func (r *WebhookRepository) Get(ctx context.Context, kbID, id string) (*domain.Webhook, error) {
	item := &domain.Webhook{}
	if err := r.db.WithContext(ctx).
		Where("kb_id = ? AND id = ?", kbID, id).
		First(item).Error; err != nil {
		return nil, err
	}
	return item, nil
}

func (r *WebhookRepository) Create(ctx context.Context, item *domain.Webhook) error {
	item.ID = uuid.NewString()
	item.CreatedAt = time.Now()
	item.UpdatedAt = item.CreatedAt
	return r.db.WithContext(ctx).Create(item).Error
}

func (r *WebhookRepository) Update(ctx context.Context, item *domain.Webhook) error {
	item.UpdatedAt = time.Now()
	result := r.db.WithContext(ctx).
		Model(&domain.Webhook{}).
		Where("kb_id = ? AND id = ?", item.KBID, item.ID).
		Updates(map[string]any{
			"url":        item.URL,
			"secret":     item.Secret,
			"events":     item.Events,
			"enabled":    item.Enabled,
			"updated_at": item.UpdatedAt,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *WebhookRepository) Delete(ctx context.Context, kbID, id string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("kb_id = ? AND id = ?", kbID, id).
			Delete(&domain.Webhook{}).Error; err != nil {
			return err
		}
		return tx.Where("webhook_id = ?", id).
			Delete(&domain.WebhookDelivery{}).Error
	})
}

// ListEnabledForEvent 返回订阅了某事件且已启用的推送目标。
func (r *WebhookRepository) ListEnabledForEvent(ctx context.Context, kbID, event string) ([]domain.Webhook, error) {
	items := make([]domain.Webhook, 0)
	err := r.db.WithContext(ctx).
		Where("kb_id = ? AND enabled = ? AND ? = ANY(events)", kbID, true, event).
		Find(&items).Error
	return items, err
}

// RecordDelivery 记录一次投递结果。
func (r *WebhookRepository) RecordDelivery(ctx context.Context, delivery *domain.WebhookDelivery) error {
	return r.db.WithContext(ctx).Create(delivery).Error
}

// ListDeliveries 返回某 webhook 最近若干条投递记录。
func (r *WebhookRepository) ListDeliveries(ctx context.Context, webhookID string, limit int) ([]domain.WebhookDelivery, error) {
	items := make([]domain.WebhookDelivery, 0)
	err := r.db.WithContext(ctx).
		Where("webhook_id = ?", webhookID).
		Order("created_at DESC").
		Limit(limit).
		Find(&items).Error
	return items, err
}

// DeleteOldDeliveries 清理超期的投递记录，由维护任务周期执行。
func (r *WebhookRepository) DeleteOldDeliveries(ctx context.Context, before time.Time) error {
	return r.db.WithContext(ctx).
		Where("created_at < ?", before).
		Delete(&domain.WebhookDelivery{}).Error
}
