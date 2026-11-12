package usecase

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/repo/pg"
)

type KenFutVoteUsecase struct {
	repo    *pg.KenFutVoteRepository
	content *KenFutContentUsecase
}

func NewKenFutVoteUsecase(repo *pg.KenFutVoteRepository, content *KenFutContentUsecase) *KenFutVoteUsecase {
	return &KenFutVoteUsecase{repo: repo, content: content}
}

// Record 校验内容处于发布清单且当前访客可见后，记录或更新投票。
func (u *KenFutVoteUsecase) Record(ctx context.Context, kbID, nodeID string, vote int16, visitorHash string, authID uint) error {
	if vote != 1 && vote != -1 {
		return ErrKenFutInvalid
	}
	if visitorHash == "" {
		return ErrKenFutInvalid
	}
	// 已发布且当前口径可见的内容才允许投票；未发布或无权限时按不存在处理。
	if _, err := u.content.Detail(ctx, kbID, nodeID, authID); err != nil {
		if err == gorm.ErrRecordNotFound {
			return gorm.ErrRecordNotFound
		}
		return fmt.Errorf("vote content check: %w", err)
	}
	return u.repo.Upsert(ctx, &domain.KenFutPageVote{KBID: kbID, NodeID: nodeID, VisitorHash: visitorHash, Vote: vote})
}

// Summary 返回投票计数与当前访客的票向。
func (u *KenFutVoteUsecase) Summary(ctx context.Context, kbID, nodeID, visitorHash string, authID uint) (*domain.KenFutVoteSummaryResp, error) {
	if _, err := u.content.Detail(ctx, kbID, nodeID, authID); err != nil {
		return nil, err
	}
	return u.repo.Summary(ctx, kbID, nodeID, visitorHash)
}
