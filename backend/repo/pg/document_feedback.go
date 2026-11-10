package pg

import (
	"context"
	"fmt"

	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/store/pg"
)

type DocumentFeedbackRepository struct {
	db     *pg.DB
	logger *log.Logger
}

func NewDocumentFeedbackRepository(db *pg.DB, logger *log.Logger) *DocumentFeedbackRepository {
	return &DocumentFeedbackRepository{db: db, logger: logger.WithModule("repo.pg.document_feedback")}
}

func (r *DocumentFeedbackRepository) Create(ctx context.Context, feedback *domain.DocumentFeedback) error {
	if err := r.db.WithContext(ctx).Create(feedback).Error; err != nil {
		return fmt.Errorf("create document feedback failed: %w", err)
	}
	return nil
}

func (r *DocumentFeedbackRepository) List(ctx context.Context, req *domain.DocumentFeedbackListReq) ([]*domain.DocumentFeedbackListItem, int64, error) {
	query := r.db.WithContext(ctx).
		Table("document_feedbacks f").
		Joins("LEFT JOIN nodes n ON n.id = f.node_id AND n.kb_id = f.kb_id").
		Where("f.kb_id = ?", req.KBID)
	if req.NodeID != "" {
		query = query.Where("f.node_id = ?", req.NodeID)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	items := make([]*domain.DocumentFeedbackListItem, 0)
	if err := query.
		Select(`f.id::text AS id,
			f.user_id,
			f.kb_id,
			f.node_id,
			COALESCE(n.name, '') AS node_name,
			f.content,
			f.correction_suggestion,
			f.info,
			f.created_at`).
		Order("f.created_at DESC").
		Offset(req.Offset()).
		Limit(req.Limit()).
		Scan(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *DocumentFeedbackRepository) Delete(ctx context.Context, kbID string, ids []int64) error {
	if err := r.db.WithContext(ctx).
		Where("kb_id = ? AND id IN ?", kbID, ids).
		Delete(&domain.DocumentFeedback{}).Error; err != nil {
		return fmt.Errorf("delete document feedback failed: %w", err)
	}
	return nil
}
