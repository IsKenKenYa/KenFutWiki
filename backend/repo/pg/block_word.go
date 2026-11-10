package pg

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/store/pg"
)

type BlockWordRepo struct {
	db     *pg.DB
	logger *log.Logger
}

type BlockWords struct {
	Words []string
}

func NewBlockWordRepo(db *pg.DB, logger *log.Logger) *BlockWordRepo {
	return &BlockWordRepo{
		db:     db,
		logger: logger,
	}
}

func (r *BlockWordRepo) GetBlockWords(ctx context.Context, kbID string) ([]string, error) {
	var setting domain.Setting
	var words BlockWords
	err := r.db.WithContext(ctx).Table("settings").
		Where("kb_id = ? AND key = ?", kbID, domain.SettingBlockWords).
		First(&setting).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	if err := json.Unmarshal(setting.Value, &words); err != nil {
		return nil, err
	}
	return words.Words, nil
}

func (r *BlockWordRepo) SaveBlockWords(ctx context.Context, kbID string, words []string) error {
	data, err := json.Marshal(BlockWords{Words: words})
	if err != nil {
		return err
	}
	setting := &domain.Setting{
		KBID:  kbID,
		Key:   domain.SettingBlockWords,
		Value: data,
	}
	return r.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "kb_id"}, {Name: "key"}},
			DoUpdates: clause.Assignments(map[string]any{
				"value":      data,
				"updated_at": time.Now(),
			}),
		}).
		Create(setting).Error
}
