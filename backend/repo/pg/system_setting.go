package pg

import (
	"context"
	"encoding/json"
	"fmt"

	"gorm.io/gorm/clause"

	"github.com/chaitin/panda-wiki/consts"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/store/pg"
)

type SystemSettingRepo struct {
	db     *pg.DB
	logger *log.Logger
}

func NewSystemSettingRepo(db *pg.DB, logger *log.Logger) *SystemSettingRepo {
	return &SystemSettingRepo{
		db:     db,
		logger: logger.WithModule("repo.pg.system_setting"),
	}
}

func (r *SystemSettingRepo) GetSystemSetting(ctx context.Context, key consts.SystemSettingKey) (*domain.SystemSetting, error) {
	var setting domain.SystemSetting
	result := r.db.WithContext(ctx).Where("key = ?", key).First(&setting)
	if result.Error != nil {
		return nil, result.Error
	}

	return &setting, nil
}

func (r *SystemSettingRepo) UpdateSystemSetting(ctx context.Context, key, value string) error {
	return r.db.WithContext(ctx).Model(&domain.SystemSetting{}).Where("key = ?", key).Update("value", value).Error
}

// GetStorageSetting 读取全局存储配置；未配置时返回 gorm.ErrRecordNotFound
func (r *SystemSettingRepo) GetStorageSetting(ctx context.Context) (*domain.StorageSetting, error) {
	setting, err := r.GetSystemSetting(ctx, consts.SystemSettingStorage)
	if err != nil {
		return nil, err
	}
	var s domain.StorageSetting
	if err := json.Unmarshal(setting.Value, &s); err != nil {
		return nil, fmt.Errorf("unmarshal storage setting: %w", err)
	}
	return &s, nil
}

// SaveStorageSetting 保存全局存储配置（不存在则插入）
func (r *SystemSettingRepo) SaveStorageSetting(ctx context.Context, s *domain.StorageSetting) error {
	value, err := json.Marshal(s)
	if err != nil {
		return fmt.Errorf("marshal storage setting: %w", err)
	}
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "key"}},
		DoUpdates: clause.AssignmentColumns([]string{"value", "updated_at"}),
	}).Create(&domain.SystemSetting{
		Key:   consts.SystemSettingStorage,
		Value: value,
	}).Error
}

// DeleteStorageSetting 删除全局存储配置（恢复环境变量默认值）
func (r *SystemSettingRepo) DeleteStorageSetting(ctx context.Context) error {
	return r.db.WithContext(ctx).
		Where("key = ?", consts.SystemSettingStorage).
		Delete(&domain.SystemSetting{}).Error
}
