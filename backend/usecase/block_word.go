package usecase

import (
	"context"
	"fmt"
	"strings"

	"github.com/chaitin/panda-wiki/repo/pg"
)

const maxBlockWords = 200

type BlockWordUsecase struct {
	repo *pg.BlockWordRepo
}

func NewBlockWordUsecase(repo *pg.BlockWordRepo) *BlockWordUsecase {
	return &BlockWordUsecase{repo: repo}
}

func (u *BlockWordUsecase) Get(ctx context.Context, kbID string) ([]string, error) {
	return u.repo.GetBlockWords(ctx, kbID)
}

func (u *BlockWordUsecase) Save(ctx context.Context, kbID string, words []string) error {
	normalized := make([]string, 0, len(words))
	seen := make(map[string]bool, len(words))
	for _, word := range words {
		word = strings.TrimSpace(word)
		if word == "" || seen[word] {
			continue
		}
		seen[word] = true
		normalized = append(normalized, word)
		if len(normalized) > maxBlockWords {
			return fmt.Errorf("block words cannot exceed %d entries", maxBlockWords)
		}
	}
	return u.repo.SaveBlockWords(ctx, kbID, normalized)
}
