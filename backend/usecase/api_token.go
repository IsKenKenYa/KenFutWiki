package usecase

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/repo/pg"
)

const apiTokenPrefix = "kfw_"

type APITokenUsecase struct {
	repo   *pg.APITokenRepo
	logger *log.Logger
}

func NewAPITokenUsecase(repo *pg.APITokenRepo, logger *log.Logger) *APITokenUsecase {
	return &APITokenUsecase{
		repo:   repo,
		logger: logger.WithModule("usecase.api_token"),
	}
}

func (u *APITokenUsecase) Create(ctx context.Context, req *domain.CreateAPITokenReq, userID string) (*domain.APIToken, error) {
	if userID == "" {
		return nil, fmt.Errorf("authentication required")
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, fmt.Errorf("name is required")
	}
	token, err := generateAPIToken()
	if err != nil {
		return nil, err
	}
	item := &domain.APIToken{
		ID:         uuid.NewString(),
		Name:       name,
		UserID:     userID,
		Token:      token,
		KbId:       req.KBID,
		Permission: req.Permission,
	}
	if err := u.repo.Create(ctx, item); err != nil {
		return nil, err
	}
	return item, nil
}

func (u *APITokenUsecase) List(ctx context.Context, kbID string) ([]*domain.APITokenListItem, error) {
	tokens, err := u.repo.List(ctx, kbID)
	if err != nil {
		return nil, err
	}
	items := make([]*domain.APITokenListItem, 0, len(tokens))
	for _, token := range tokens {
		items = append(items, &domain.APITokenListItem{
			ID:         token.ID,
			Name:       token.Name,
			Permission: token.Permission,
			Token:      token.Token,
			CreatedAt:  token.CreatedAt,
			UpdatedAt:  token.UpdatedAt,
		})
	}
	return items, nil
}

func (u *APITokenUsecase) Update(ctx context.Context, req *domain.UpdateAPITokenReq) error {
	var name *string
	if req.Name != nil {
		trimmed := strings.TrimSpace(*req.Name)
		if trimmed == "" {
			return fmt.Errorf("name is required")
		}
		name = &trimmed
	}
	return u.repo.Update(ctx, req.ID, req.KBID, name, req.Permission)
}

func (u *APITokenUsecase) Delete(ctx context.Context, kbID, id string) error {
	if id == "" {
		return fmt.Errorf("id is required")
	}
	return u.repo.Delete(ctx, id, kbID)
}

func generateAPIToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate API token failed: %w", err)
	}
	return apiTokenPrefix + hex.EncodeToString(buf), nil
}
