package domain

import (
	"time"

	"github.com/lib/pq"
)

// 站点事件类型；webhook 订阅这些事件并接收 JSON 推送
const (
	WebhookEventNodePublished = "node.published"
	WebhookEventNodeDeleted   = "node.deleted"
	WebhookEventNodeRestored  = "node.restored"
	WebhookEventCommentCreate = "comment.created"
	WebhookEventFeedback      = "feedback.created"
)

// WebhookEvents 全部可订阅事件，供接口校验与前端枚举
var WebhookEvents = []string{
	WebhookEventNodePublished,
	WebhookEventNodeDeleted,
	WebhookEventNodeRestored,
	WebhookEventCommentCreate,
	WebhookEventFeedback,
}

// ValidWebhookEvent 判断事件类型是否受支持
func ValidWebhookEvent(event string) bool {
	for _, item := range WebhookEvents {
		if item == event {
			return true
		}
	}
	return false
}

// Webhook 站点事件推送目标
type Webhook struct {
	ID        string         `json:"id" gorm:"primaryKey"`
	KBID      string         `json:"kb_id" gorm:"column:kb_id;not null"`
	URL       string         `json:"url" gorm:"column:url;not null"`
	Secret    string         `json:"secret" gorm:"column:secret;not null;default:''"`
	Events    pq.StringArray `json:"events" gorm:"column:events;type:text[]"`
	Enabled   bool           `json:"enabled" gorm:"column:enabled;not null;default:true"`
	CreatorID string         `json:"creator_id" gorm:"column:creator_id;not null;default:''"`
	CreatedAt time.Time      `json:"created_at" gorm:"column:created_at"`
	UpdatedAt time.Time      `json:"updated_at" gorm:"column:updated_at"`
}

func (Webhook) TableName() string {
	return "webhooks"
}

// WebhookDelivery 单次投递结果，用于排查
type WebhookDelivery struct {
	ID         int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	WebhookID  string    `json:"webhook_id" gorm:"column:webhook_id;not null"`
	Event      string    `json:"event" gorm:"column:event;not null"`
	StatusCode int       `json:"status_code" gorm:"column:status_code;not null;default:0"`
	Error      string    `json:"error" gorm:"column:error;not null;default:''"`
	CreatedAt  time.Time `json:"created_at" gorm:"column:created_at"`
}

func (WebhookDelivery) TableName() string {
	return "webhook_deliveries"
}

// WebhookPayload 事件推送的统一信封
type WebhookPayload struct {
	Event     string `json:"event"`
	KBID      string `json:"kb_id"`
	Timestamp string `json:"timestamp"`
	Data      any    `json:"data"`
}

type WebhookDeliveryItem struct {
	ID         int64     `json:"id"`
	Event      string    `json:"event"`
	StatusCode int       `json:"status_code"`
	Error      string    `json:"error"`
	CreatedAt  time.Time `json:"created_at"`
}
