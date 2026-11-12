package pg

import (
	"context"

	storePG "github.com/chaitin/panda-wiki/store/pg"
	"gorm.io/gorm/clause"

	"github.com/chaitin/panda-wiki/domain"
)

type KenFutVoteRepository struct {
	db *storePG.DB
}

func NewKenFutVoteRepository(db *storePG.DB) *KenFutVoteRepository {
	return &KenFutVoteRepository{db: db}
}

// Upsert 写入或更新访客票向；同一访客同文档仅保留最新一票。
func (r *KenFutVoteRepository) Upsert(ctx context.Context, vote *domain.KenFutPageVote) error {
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "kb_id"}, {Name: "node_id"}, {Name: "visitor_hash"}},
		DoUpdates: clause.AssignmentColumns([]string{"vote", "updated_at"}),
	}).Create(vote).Error
}

func (r *KenFutVoteRepository) Summary(ctx context.Context, kbID, nodeID, visitorHash string) (*domain.KenFutVoteSummaryResp, error) {
	summary := &domain.KenFutVoteSummaryResp{}
	err := r.db.WithContext(ctx).Raw(
		`SELECT
			COALESCE(SUM(CASE WHEN vote=1 THEN 1 ELSE 0 END),0) AS up,
			COALESCE(SUM(CASE WHEN vote=-1 THEN 1 ELSE 0 END),0) AS down,
			COALESCE(MAX(CASE WHEN visitor_hash=? THEN vote END),0) AS mine
		FROM kenfut_page_votes WHERE kb_id=? AND node_id=?`,
		visitorHash, kbID, nodeID,
	).Scan(summary).Error
	if err != nil {
		return nil, err
	}
	return summary, nil
}
