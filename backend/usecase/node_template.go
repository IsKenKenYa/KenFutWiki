package usecase

import (
	"context"
	"errors"

	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/repo/pg"
)

var ErrNodeTemplateInvalid = errors.New("invalid node template")

type NodeTemplateUsecase struct {
	repo *pg.NodeTemplateRepository
}

func NewNodeTemplateUsecase(repo *pg.NodeTemplateRepository) *NodeTemplateUsecase {
	return &NodeTemplateUsecase{repo: repo}
}

func validNodeTemplateName(name string) bool {
	return len([]rune(name)) > 0 && len([]rune(name)) <= 120
}

// Create 校验模板名称后保存。
func (u *NodeTemplateUsecase) Create(ctx context.Context, req *domain.CreateNodeTemplateReq, userID string) (*domain.NodeTemplate, error) {
	if !validNodeTemplateName(req.Name) {
		return nil, ErrNodeTemplateInvalid
	}
	item := &domain.NodeTemplate{
		KBID:        req.KBID,
		Name:        req.Name,
		Summary:     req.Summary,
		Content:     req.Content,
		ContentType: req.ContentType,
		CreatorID:   userID,
	}
	if item.ContentType == "" {
		item.ContentType = "md"
	}
	if err := u.repo.Create(ctx, item); err != nil {
		return nil, err
	}
	return item, nil
}

func (u *NodeTemplateUsecase) Update(ctx context.Context, req *domain.UpdateNodeTemplateReq) error {
	if !validNodeTemplateName(req.Name) {
		return ErrNodeTemplateInvalid
	}
	item := &domain.NodeTemplate{
		ID:          req.ID,
		KBID:        req.KBID,
		Name:        req.Name,
		Summary:     req.Summary,
		Content:     req.Content,
		ContentType: req.ContentType,
	}
	if item.ContentType == "" {
		item.ContentType = "md"
	}
	return u.repo.Update(ctx, item)
}

func (u *NodeTemplateUsecase) Delete(ctx context.Context, kbID, id string) error {
	return u.repo.Delete(ctx, kbID, id)
}

func (u *NodeTemplateUsecase) List(ctx context.Context, kbID string) ([]domain.NodeTemplate, error) {
	return u.repo.List(ctx, kbID)
}
