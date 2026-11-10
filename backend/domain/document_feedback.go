package domain

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

type DocumentFeedback struct {
	ID                   int64                `json:"id" gorm:"primaryKey;autoIncrement"`
	UserID               string               `json:"user_id" gorm:"column:user_id"`
	KBID                 string               `json:"kb_id" gorm:"column:kb_id;not null"`
	NodeID               string               `json:"node_id" gorm:"column:node_id;not null;default:''"`
	Content              string               `json:"content" gorm:"column:content;not null;default:''"`
	CorrectionSuggestion string               `json:"correction_suggestion" gorm:"column:correction_suggestion;not null;default:''"`
	Info                 DocumentFeedbackInfo `json:"info" gorm:"column:info;type:jsonb"`
	CreatedAt            time.Time            `json:"created_at" gorm:"column:created_at"`
}

func (DocumentFeedback) TableName() string {
	return "document_feedbacks"
}

type DocumentFeedbackInfo struct {
	AuthUserID uint   `json:"auth_user_id"`
	UserName   string `json:"user_name"`
	Avatar     string `json:"avatar"`
	Email      string `json:"email"`
	RemoteIP   string `json:"remote_ip"`
	ScreenShot string `json:"screen_shot"`
}

func (i DocumentFeedbackInfo) Value() (driver.Value, error) {
	return json.Marshal(i)
}

func (i *DocumentFeedbackInfo) Scan(value any) error {
	if value == nil {
		return nil
	}
	switch v := value.(type) {
	case []byte:
		return json.Unmarshal(v, i)
	case string:
		return json.Unmarshal([]byte(v), i)
	default:
		return fmt.Errorf("cannot scan %T into DocumentFeedbackInfo", value)
	}
}

type DocumentFeedbackListReq struct {
	KBID   string `query:"kb_id" validate:"required"`
	NodeID string `query:"node_id"`
	Pager
}

type DocumentFeedbackListItem struct {
	ID                   string               `json:"id"`
	UserID               string               `json:"user_id"`
	KBID                 string               `json:"kb_id"`
	NodeID               string               `json:"node_id"`
	NodeName             string               `json:"node_name"`
	Content              string               `json:"content"`
	CorrectionSuggestion string               `json:"correction_suggestion"`
	Info                 DocumentFeedbackInfo `json:"info"`
	IPAddress            *IPAddress           `json:"ip_address,omitempty" gorm:"-"`
	CreatedAt            time.Time            `json:"created_at"`
}

type DocumentFeedbackListResp struct {
	Data  []*DocumentFeedbackListItem `json:"data"`
	Total int64                       `json:"total"`
}

type DocumentFeedbackDeleteReq struct {
	KBID string  `query:"kb_id" validate:"required"`
	IDs  []int64 `query:"ids" validate:"required,min=1"`
}
