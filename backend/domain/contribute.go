package domain

import (
	"time"

	"github.com/chaitin/panda-wiki/consts"
)

type Contribute struct {
	Id          string                  `json:"id" gorm:"primaryKey;type:text"`
	AuthId      *int64                  `json:"auth_id"`
	KBId        string                  `json:"kb_id" gorm:"type:text;not null"`
	Status      consts.ContributeStatus `json:"status" gorm:"type:text;not null"`
	Type        consts.ContributeType   `json:"type" gorm:"type:text;not null"`
	NodeId      string                  `json:"node_id" gorm:"type:text"`
	Name        string                  `json:"name" gorm:"type:text"`
	Content     string                  `json:"content" gorm:"type:text;not null"`
	Meta        NodeMeta                `json:"meta"`
	Reason      string                  `json:"reason" gorm:"type:text;not null"`
	AuditUserID string                  `json:"audit_user_id" gorm:"type:text;not null"`
	AuditTime   *time.Time              `json:"audit_time"`
	RemoteIP    string                  `json:"remote_ip" gorm:"type:text;not null"`
	CreatedAt   time.Time               `gorm:"column:created_at;not null;default:now()"`
	UpdatedAt   time.Time               `gorm:"column:updated_at;not null;default:now()"`
}

func (Contribute) TableName() string {
	return "contributes"
}

type SubmitContributeReq struct {
	KBID         string                `json:"kb_id" validate:"required"`
	Type         consts.ContributeType `json:"type" validate:"required,oneof=add edit"`
	NodeID       string                `json:"node_id"`
	Name         string                `json:"name"`
	Content      string                `json:"content" validate:"required"`
	ContentType  string                `json:"content_type" validate:"required,oneof=html md"`
	Emoji        string                `json:"emoji"`
	Reason       string                `json:"reason" validate:"required,max=500"`
	CaptchaToken string                `json:"captcha_token" validate:"required"`
}

type ContributeListReq struct {
	KBID     string `query:"kb_id" validate:"required"`
	NodeName string `query:"node_name"`
	AuthName string `query:"auth_name"`
	Status   string `query:"status" validate:"omitempty,oneof=pending approved rejected"`
	Pager
}

type ContributeAuditReq struct {
	ID       string                  `json:"id" validate:"required"`
	KBID     string                  `json:"kb_id" validate:"required"`
	NavID    string                  `json:"nav_id"`
	ParentID string                  `json:"parent_id"`
	Position *float64                `json:"position"`
	Status   consts.ContributeStatus `json:"status" validate:"required,oneof=approved rejected"`
}

type ContributeListItem struct {
	ID             string                  `json:"id"`
	AuthID         *int64                  `json:"auth_id"`
	AuthName       string                  `json:"auth_name"`
	KBID           string                  `json:"kb_id"`
	ContributeName string                  `json:"contribute_name"`
	NodeID         string                  `json:"node_id"`
	NodeName       string                  `json:"node_name"`
	Meta           NodeMeta                `json:"meta"`
	Status         consts.ContributeStatus `json:"status"`
	Type           consts.ContributeType   `json:"type"`
	Reason         string                  `json:"reason"`
	RemoteIP       string                  `json:"remote_ip"`
	IPAddress      *IPAddress              `json:"ip_address,omitempty" gorm:"-"`
	AuditUserID    string                  `json:"audit_user_id"`
	AuditTime      *time.Time              `json:"audit_time"`
	CreatedAt      time.Time               `json:"created_at"`
	UpdatedAt      time.Time               `json:"updated_at"`
}

type ContributeListResp struct {
	List  []*ContributeListItem `json:"list"`
	Total int64                 `json:"total"`
}

type ContributeOriginalNode struct {
	ID      string   `json:"id"`
	Name    string   `json:"name"`
	Content string   `json:"content"`
	Meta    NodeMeta `json:"meta"`
}

type ContributeDetailResp struct {
	ID             string                  `json:"id"`
	AuthID         *int64                  `json:"auth_id"`
	AuthName       string                  `json:"auth_name"`
	KBID           string                  `json:"kb_id"`
	NodeID         string                  `json:"node_id"`
	NodeName       string                  `json:"node_name"`
	ContributeName string                  `json:"contribute_name"`
	Content        string                  `json:"content"`
	Meta           NodeMeta                `json:"meta"`
	Reason         string                  `json:"reason"`
	Status         consts.ContributeStatus `json:"status"`
	Type           consts.ContributeType   `json:"type"`
	AuditUserID    string                  `json:"audit_user_id"`
	AuditTime      *time.Time              `json:"audit_time"`
	CreatedAt      time.Time               `json:"created_at"`
	UpdatedAt      time.Time               `json:"updated_at"`
	OriginalNode   *ContributeOriginalNode `json:"original_node,omitempty"`
}
