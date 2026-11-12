package domain

import "time"

// KenFutPageVote 公开站页面级"有帮助吗"投票。
// visitorHash 为访客会话标识的哈希，同一访客对同一文档仅保留一票。
type KenFutPageVote struct {
	ID          int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	KBID        string    `json:"kb_id" gorm:"column:kb_id;not null"`
	NodeID      string    `json:"node_id" gorm:"column:node_id;not null"`
	VisitorHash string    `json:"-" gorm:"column:visitor_hash;not null"`
	Vote        int16     `json:"vote" gorm:"column:vote;not null"`
	CreatedAt   time.Time `json:"created_at" gorm:"column:created_at"`
	UpdatedAt   time.Time `json:"updated_at" gorm:"column:updated_at"`
}

func (KenFutPageVote) TableName() string {
	return "kenfut_page_votes"
}

type KenFutVoteSummaryResp struct {
	Up   int64 `json:"up"`
	Down int64 `json:"down"`
	Mine int16 `json:"mine"`
}

type KenFutVoteReq struct {
	Vote int16 `json:"vote"`
}
