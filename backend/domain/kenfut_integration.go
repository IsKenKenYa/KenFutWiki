package domain

import "time"

type KenFutProductPage struct {
	Key        string   `json:"key"`
	Name       string   `json:"name"`
	Path       string   `json:"path"`
	Parameters []string `json:"parameters"`
}

type KenFutProduct struct {
	ID        string              `json:"id" gorm:"primaryKey"`
	KBID      string              `json:"kb_id"`
	Name      string              `json:"name"`
	Origin    string              `json:"origin"`
	Enabled   bool                `json:"enabled"`
	Pages     []KenFutProductPage `json:"pages" gorm:"serializer:json;type:jsonb"`
	CreatedAt time.Time           `json:"created_at"`
	UpdatedAt time.Time           `json:"updated_at"`
}

func (KenFutProduct) TableName() string { return "kenfut_products" }

type KenFutCredential struct {
	ID        string     `json:"id" gorm:"primaryKey"`
	ProductID string     `json:"product_id"`
	TokenHash string     `json:"-"`
	Scopes    []string   `json:"scopes" gorm:"serializer:json;type:jsonb"`
	CreatedAt time.Time  `json:"created_at"`
	RevokedAt *time.Time `json:"revoked_at,omitempty"`
}

func (KenFutCredential) TableName() string { return "kenfut_credentials" }

type KenFutEvent struct {
	ID            int64     `json:"-" gorm:"primaryKey"`
	EventID       string    `json:"event_id"`
	Kind          string    `json:"event_type"`
	KBID          string    `json:"kb_id"`
	ProductID     string    `json:"product_id"`
	NodeID        string    `json:"node_id"`
	NodeReleaseID string    `json:"node_release_id"`
	CTAID         string    `json:"cta_id"`
	ViewID        string    `json:"view_id"`
	ClickID       *string   `json:"click_id,omitempty"`
	SessionID     string    `json:"-"`
	SubjectHash   string    `json:"-"`
	PayloadHash   string    `json:"-"`
	OccurredAt    time.Time `json:"occurred_at"`
	ReceivedAt    time.Time `json:"received_at"`
}

func (KenFutEvent) TableName() string { return "kenfut_events" }

type KenFutMilestone struct {
	ProductID   string `gorm:"primaryKey"`
	SubjectHash string `gorm:"primaryKey"`
	Kind        string `gorm:"primaryKey"`
	ClickID     string
	OccurredAt  time.Time
}

func (KenFutMilestone) TableName() string { return "kenfut_milestones" }

type KenFutViewReq struct {
	EventID       string `json:"event_id"`
	NodeID        string `json:"node_id"`
	NodeReleaseID string `json:"node_release_id"`
	Channel       string `json:"channel"`
}
type KenFutClickReq struct {
	EventID       string `json:"event_id"`
	NodeID        string `json:"node_id"`
	NodeReleaseID string `json:"node_release_id"`
	ViewID        string `json:"view_id"`
}
type KenFutConversionReq struct {
	EventID    string    `json:"event_id"`
	EventType  string    `json:"event_type"`
	OccurredAt time.Time `json:"occurred_at"`
	SubjectID  string    `json:"subject_id"`
	ClickID    string    `json:"click_id"`
}
type KenFutFunnelReq struct {
	KBID      string    `query:"kb_id"`
	ProductID string    `query:"product_id"`
	NodeID    string    `query:"node_id"`
	CTAID     string    `query:"cta_id"`
	From      time.Time `query:"from"`
	To        time.Time `query:"to"`
}
type KenFutFunnelResp struct {
	RegisteredVisitors           int64              `json:"registered_visitors"`
	FirstGenerationVisitors      int64              `json:"first_generation_visitors"`
	ConversionConnected          bool               `json:"conversion_connected"`
	RegistrationConnected        bool               `json:"registration_connected"`
	GenerationConnected          bool               `json:"generation_connected"`
	Views                        int64              `json:"views"`
	Viewers                      int64              `json:"viewers"`
	Clicks                       int64              `json:"clicks"`
	Clickers                     int64              `json:"clickers"`
	Registrations                int64              `json:"registrations"`
	FirstGenerations             int64              `json:"first_generations"`
	UnattributedRegistrations    int64              `json:"unattributed_registrations"`
	UnattributedFirstGenerations int64              `json:"unattributed_first_generations"`
	Items                        []KenFutFunnelItem `json:"items"`
}
type KenFutFunnelItem struct {
	NodeID           string `json:"node_id"`
	Views            int64  `json:"views"`
	Clicks           int64  `json:"clicks"`
	Registrations    int64  `json:"registrations"`
	FirstGenerations int64  `json:"first_generations"`
}
