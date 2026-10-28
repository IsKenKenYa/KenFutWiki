package pg

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/chaitin/panda-wiki/consts"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/log"
	storePG "github.com/chaitin/panda-wiki/store/pg"
)

type KenFutContentRepository struct {
	db     *storePG.DB
	logger *log.Logger
}

func (r *KenFutContentRepository) CurrentPV(ctx context.Context, nodeID string) (int64, error) {
	stats, err := NewNodeRepository(r.db, r.logger).GetNodeStatsByNodeId(ctx, nodeID)
	if err != nil {
		return 0, err
	}
	return stats.PV, nil
}

func NewKenFutContentRepository(db *storePG.DB, logger *log.Logger) *KenFutContentRepository {
	return &KenFutContentRepository{db: db, logger: logger.WithModule("repo.pg.kenfut_content")}
}

func (r *KenFutContentRepository) GetDraft(ctx context.Context, kbID, nodeID string) (*domain.KenFutContentMetadata, error) {
	var node domain.Node
	if err := r.db.WithContext(ctx).Where("kb_id = ? AND id = ? AND type = ?", kbID, nodeID, domain.NodeTypeDocument).First(&node).Error; err != nil {
		return nil, err
	}
	draft := domain.KenFutContentDraft{}
	err := r.db.WithContext(ctx).Where("kb_id = ? AND node_id = ?", kbID, nodeID).First(&draft).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		m := domain.DefaultKenFutContentMetadata(nodeID)
		return &m, nil
	}
	if err != nil {
		return nil, err
	}
	return &draft.Metadata, nil
}

func (r *KenFutContentRepository) SaveDraft(ctx context.Context, kbID string, m domain.KenFutContentMetadata, userID string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var kb domain.KnowledgeBase
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Select("id").Where("id = ?", kbID).First(&kb).Error; err != nil {
			return err
		}
		var node domain.Node
		if err := tx.Where("kb_id = ? AND id = ? AND type = ?", kbID, m.NodeID, domain.NodeTypeDocument).First(&node).Error; err != nil {
			return err
		}
		if m.Slug != "" {
			var conflicts int64
			if err := tx.Model(&domain.KenFutSlugAlias{}).Where("kb_id = ? AND slug = ? AND node_id <> ?", kbID, m.Slug, m.NodeID).Count(&conflicts).Error; err != nil {
				return err
			}
			if conflicts > 0 {
				return fmt.Errorf("slug is already reserved")
			}
			if err := tx.Model(&domain.KenFutContentDraft{}).Where("kb_id = ? AND metadata->>'slug' = ? AND node_id <> ?", kbID, m.Slug, m.NodeID).Count(&conflicts).Error; err != nil {
				return err
			}
			if conflicts > 0 {
				return fmt.Errorf("slug is already in use")
			}
		}
		draft := domain.KenFutContentDraft{NodeID: m.NodeID, KBID: kbID, Metadata: m, UpdatedAt: time.Now()}
		if err := tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "node_id"}}, DoUpdates: clause.AssignmentColumns([]string{"metadata", "updated_at"})}).Create(&draft).Error; err != nil {
			return err
		}
		changes := map[string]any{"edit_time": time.Now(), "editor_id": userID}
		if node.Status == domain.NodeStatusPublished {
			changes["status"] = domain.NodeStatusDraft
		}
		return tx.Model(&node).Updates(changes).Error
	})
}

type KenFutPublishedRow struct {
	ID            string
	KBID          string
	NodeReleaseID string
	Title         string
	Summary       string
	Content       string
	ContentType   string
	CreatedAt     time.Time
	UpdatedAt     time.Time
	ParentID      string
	Metadata      domain.KenFutContentMetadata `gorm:"type:jsonb"`
	PV            int64
}

type KenFutVisibility struct {
	VisibleIDs   []string
	VisitableIDs []string
}

func (r *KenFutContentRepository) LatestReleaseID(ctx context.Context, kbID string) (string, error) {
	var release domain.KBRelease
	err := r.db.WithContext(ctx).Select("id").Where("kb_id = ?", kbID).Order("created_at DESC, id DESC").First(&release).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", nil
	}
	return release.ID, err
}

func publishedContentBaseQuery(tx *gorm.DB, kbID, releaseID string) *gorm.DB {
	q := tx.Table("kb_release_node_releases manifest").Joins("JOIN node_releases nr ON nr.id = manifest.node_release_id").Joins("JOIN nodes n ON n.id = nr.node_id AND n.kb_id = nr.kb_id").Joins("LEFT JOIN kenfut_content_releases kcr ON kcr.node_release_id = nr.id").Joins("LEFT JOIN node_stats ns ON ns.node_id = nr.node_id").Where("manifest.kb_id = ? AND manifest.release_id = ? AND nr.type = ?", kbID, releaseID, domain.NodeTypeDocument)
	return q
}

func publishedContentQuery(tx *gorm.DB, kbID, releaseID string, visibility KenFutVisibility) *gorm.DB {
	q := publishedContentBaseQuery(tx, kbID, releaseID)
	q = q.Where("(n.permissions->>'visible' = ? OR (n.permissions->>'visible' = ? AND n.id IN ?))", consts.NodeAccessPermOpen, consts.NodeAccessPermPartial, visibility.VisibleIDs)
	return q.Where("(n.permissions->>'visitable' = ? OR (n.permissions->>'visitable' = ? AND n.id IN ?))", consts.NodeAccessPermOpen, consts.NodeAccessPermPartial, visibility.VisitableIDs)
}

const contentSelect = "nr.node_id AS id,nr.kb_id,nr.id AS node_release_id,nr.name AS title,nr.meta->>'summary' AS summary,nr.meta->>'content_type' AS content_type,nr.created_at,nr.updated_at,nr.parent_id,COALESCE(kcr.metadata, jsonb_build_object('node_id',nr.node_id,'channel','docs','tags','[]'::jsonb,'related_node_ids','[]'::jsonb,'ctas','[]'::jsonb)) AS metadata,COALESCE(ns.pv,0) AS pv"

func escapeContentPattern(value string) string {
	return strings.NewReplacer("\\", "\\\\", "%", "\\%", "_", "\\_").Replace(value)
}

func filterContentQuery(q *gorm.DB, req domain.KenFutContentListReq) *gorm.DB {
	if req.Channel == "article" {
		q = q.Where("kcr.metadata->>'channel' IN ('article','both')")
	}
	if req.Channel == "docs" {
		q = q.Where("COALESCE(kcr.metadata->>'channel','docs') IN ('docs','both')")
	}
	if req.Category != "" {
		q = q.Where("kcr.metadata->>'category' = ?", req.Category)
	}
	if req.Tag != "" {
		q = q.Where("kcr.metadata->'tags' @> to_jsonb(ARRAY[?]::text[])", req.Tag)
	}
	if req.Featured {
		q = q.Where("kcr.metadata->>'featured' = 'true'")
	}
	for _, term := range strings.Fields(req.Query) {
		pattern := "%" + escapeContentPattern(term) + "%"
		q = q.Where("COALESCE(kcr.search_text,nr.name || ' ' || COALESCE(nr.meta->>'summary','') || ' ' || nr.content) ILIKE ? ESCAPE E'\\\\'", pattern)
	}
	return q
}

func (r *KenFutContentRepository) List(ctx context.Context, req domain.KenFutContentListReq, releaseID string, visibility KenFutVisibility) ([]KenFutPublishedRow, int64, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	q := filterContentQuery(publishedContentQuery(r.db.WithContext(ctx), req.KBID, releaseID, visibility), req)
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	order := "COALESCE(NULLIF(kcr.metadata->>'display_date','')::timestamptz,nr.updated_at) DESC,nr.node_id ASC"
	if req.Featured {
		order = "COALESCE((kcr.metadata->>'featured_order')::integer,0) ASC," + order
	}
	if req.Query != "" {
		q = q.Clauses(clause.OrderBy{Expression: clause.Expr{SQL: "CASE WHEN nr.name ILIKE ? ESCAPE E'\\\\' THEN 0 WHEN nr.meta->>'summary' ILIKE ? ESCAPE E'\\\\' THEN 1 ELSE 2 END," + order, Vars: []any{"%" + escapeContentPattern(req.Query) + "%", "%" + escapeContentPattern(req.Query) + "%"}}})
	}
	rows := []KenFutPublishedRow{}
	err := q.Select(contentSelect).Order(order).Offset((req.Page - 1) * req.PageSize).Limit(req.PageSize).Scan(&rows).Error
	return rows, total, err
}

func (r *KenFutContentRepository) Detail(ctx context.Context, kbID, nodeID, releaseID string, visibility KenFutVisibility) (*KenFutPublishedRow, error) {
	var row KenFutPublishedRow
	result := publishedContentBaseQuery(r.db.WithContext(ctx), kbID, releaseID).Where("(n.permissions->>'visitable' = ? OR (n.permissions->>'visitable' = ? AND n.id IN ?))", consts.NodeAccessPermOpen, consts.NodeAccessPermPartial, visibility.VisitableIDs).Select(contentSelect+",nr.content").Where("nr.node_id = ?", nodeID).Limit(1).Scan(&row)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	return &row, nil
}

func (r *KenFutContentRepository) ResolveSlug(ctx context.Context, kbID, slug string) (string, error) {
	var alias domain.KenFutSlugAlias
	err := r.db.WithContext(ctx).Where("kb_id = ? AND slug = ?", kbID, slug).First(&alias).Error
	return alias.NodeID, err
}

func (r *KenFutContentRepository) Candidates(ctx context.Context, kbID, releaseID string, visibility KenFutVisibility) ([]KenFutPublishedRow, error) {
	rows := []KenFutPublishedRow{}
	err := publishedContentQuery(r.db.WithContext(ctx), kbID, releaseID, visibility).Select(contentSelect).Order("nr.updated_at DESC,nr.node_id ASC").Scan(&rows).Error
	return rows, err
}
