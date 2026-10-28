package domain

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"
)

type KenFutLinkTarget struct {
	Type      string            `json:"type"`
	NodeID    string            `json:"node_id,omitempty"`
	Page      string            `json:"page,omitempty"`
	ProductID string            `json:"product_id,omitempty"`
	PageKey   string            `json:"page_key,omitempty"`
	URL       string            `json:"url,omitempty"`
	Params    map[string]string `json:"params,omitempty"`
}

type KenFutCTA struct {
	ID     string           `json:"id"`
	Label  string           `json:"label"`
	Target KenFutLinkTarget `json:"target"`
	Style  string           `json:"style"`
	NewTab bool             `json:"new_tab"`
}

type KenFutContentMetadata struct {
	NodeID         string      `json:"node_id"`
	Channel        string      `json:"channel"`
	Slug           string      `json:"slug"`
	CoverURL       string      `json:"cover_url"`
	AuthorName     string      `json:"author_name"`
	AuthorAvatar   string      `json:"author_avatar"`
	DisplayDate    string      `json:"display_date"`
	Category       string      `json:"category"`
	Tags           []string    `json:"tags"`
	Featured       bool        `json:"featured"`
	FeaturedOrder  int         `json:"featured_order"`
	RelatedNodeIDs []string    `json:"related_node_ids"`
	CTAs           []KenFutCTA `json:"ctas"`
}

func DefaultKenFutContentMetadata(nodeID string) KenFutContentMetadata {
	return KenFutContentMetadata{NodeID: nodeID, Channel: "docs", Tags: []string{}, RelatedNodeIDs: []string{}, CTAs: []KenFutCTA{}}
}

func (m KenFutContentMetadata) Value() (driver.Value, error) { return json.Marshal(m) }
func (m *KenFutContentMetadata) Scan(value any) error {
	var data []byte
	switch v := value.(type) {
	case []byte:
		data = v
	case string:
		data = []byte(v)
	case nil:
		return nil
	default:
		return errors.New("invalid content metadata")
	}
	return json.Unmarshal(data, m)
}

type KenFutContentDraft struct {
	NodeID    string `gorm:"primaryKey"`
	KBID      string
	Metadata  KenFutContentMetadata `gorm:"type:jsonb"`
	UpdatedAt time.Time
}

func (KenFutContentDraft) TableName() string { return "kenfut_content_metadata" }

type KenFutContentRelease struct {
	NodeReleaseID string `gorm:"primaryKey"`
	NodeID        string
	KBID          string
	Metadata      KenFutContentMetadata `gorm:"type:jsonb"`
	SearchText    string
	CreatedAt     time.Time
}

func (KenFutContentRelease) TableName() string { return "kenfut_content_releases" }

type KenFutSlugAlias struct {
	KBID   string `gorm:"primaryKey"`
	Slug   string `gorm:"primaryKey"`
	NodeID string
}

func (KenFutSlugAlias) TableName() string { return "kenfut_slug_aliases" }

type KenFutContentItem struct {
	KenFutContentMetadata
	ID            string              `json:"id"`
	KBID          string              `json:"kb_id"`
	Title         string              `json:"title"`
	Summary       string              `json:"summary"`
	Content       string              `json:"content,omitempty"`
	ContentType   string              `json:"content_type"`
	CreatedAt     time.Time           `json:"created_at"`
	UpdatedAt     time.Time           `json:"updated_at"`
	URL           string              `json:"url"`
	CanonicalURL  string              `json:"canonical_url"`
	NodeReleaseID string              `json:"node_release_id"`
	PV            int64               `json:"pv"`
	Related       []KenFutContentItem `json:"related,omitempty"`
}

type KenFutContentListReq struct {
	KBID     string `query:"-"`
	Query    string `query:"q"`
	Channel  string `query:"channel"`
	Category string `query:"category"`
	Tag      string `query:"tag"`
	Featured bool   `query:"featured"`
	Page     int    `query:"page"`
	PageSize int    `query:"page_size"`
}

type KenFutContentListResp struct {
	Items     []KenFutContentItem `json:"items"`
	Total     int64               `json:"total"`
	Page      int                 `json:"page"`
	PageSize  int                 `json:"page_size"`
	ReleaseID string              `json:"release_id"`
}

type KenFutPage struct {
	ID     string           `json:"id"`
	Title  string           `json:"title"`
	URL    string           `json:"url"`
	Type   string           `json:"type"`
	Target KenFutLinkTarget `json:"target"`
}

type KenFutTaxonomies struct {
	Categories []string `json:"categories"`
	Tags       []string `json:"tags"`
}
