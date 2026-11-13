package domain

import "time"

// NodeTemplate 文档模板：新建文档时复制其内容。
type NodeTemplate struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	KBID        string    `json:"kb_id" gorm:"column:kb_id;not null"`
	Name        string    `json:"name" gorm:"column:name;not null"`
	Summary     string    `json:"summary" gorm:"column:summary;not null;default:''"`
	Content     string    `json:"content" gorm:"column:content;not null;default:''"`
	ContentType string    `json:"content_type" gorm:"column:content_type;not null;default:'md'"`
	CreatorID   string    `json:"creator_id" gorm:"column:creator_id;not null;default:''"`
	CreatorName string    `json:"creator_name" gorm:"-"`
	CreatedAt   time.Time `json:"created_at" gorm:"column:created_at"`
	UpdatedAt   time.Time `json:"updated_at" gorm:"column:updated_at"`
}

func (NodeTemplate) TableName() string {
	return "node_templates"
}

type CreateNodeTemplateReq struct {
	KBID        string `json:"-" validate:"required"`
	Name        string `json:"name" validate:"required,max=120"`
	Summary     string `json:"summary" validate:"max=500"`
	Content     string `json:"content" validate:"max=1000000"`
	ContentType string `json:"content_type" validate:"omitempty,oneof=md html"`
}

type UpdateNodeTemplateReq struct {
	ID          string `json:"-" validate:"required"`
	KBID        string `json:"-"`
	Name        string `json:"name" validate:"required,max=120"`
	Summary     string `json:"summary" validate:"max=500"`
	Content     string `json:"content" validate:"max=1000000"`
	ContentType string `json:"content_type" validate:"omitempty,oneof=md html"`
}
