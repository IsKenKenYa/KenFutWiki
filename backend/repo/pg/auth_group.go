package pg

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/lib/pq"
	"gorm.io/gorm"

	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/store/pg"
)

type AuthGroupRepository struct {
	db     *pg.DB
	logger *log.Logger
}

func NewAuthGroupRepository(db *pg.DB, logger *log.Logger) *AuthGroupRepository {
	return &AuthGroupRepository{db: db, logger: logger.WithModule("repo.pg.auth_group")}
}

func (r *AuthGroupRepository) Create(ctx context.Context, group *domain.AuthGroup) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if group.ParentID != nil {
			if err := ensureAuthGroupParent(tx, group.KbID, *group.ParentID, 0); err != nil {
				return err
			}
		}
		if group.Position == 0 {
			position, err := nextAuthGroupPosition(tx, group.KbID, group.ParentID)
			if err != nil {
				return err
			}
			group.Position = position
		}
		return tx.Create(group).Error
	})
}

func (r *AuthGroupRepository) Update(ctx context.Context, group *domain.AuthGroup) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if group.ParentID != nil {
			if err := ensureAuthGroupParent(tx, group.KbID, *group.ParentID, group.ID); err != nil {
				return err
			}
		}
		updateMap := map[string]any{
			"name":       group.Name,
			"parent_id":  group.ParentID,
			"auth_ids":   group.AuthIDs,
			"position":   group.Position,
			"updated_at": time.Now(),
		}
		result := tx.Model(&domain.AuthGroup{}).
			Where("id = ? AND kb_id = ?", group.ID, group.KbID).
			Updates(updateMap)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})
}

func (r *AuthGroupRepository) Delete(ctx context.Context, kbID string, id uint) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var group domain.AuthGroup
		if err := tx.Where("id = ? AND kb_id = ?", id, kbID).First(&group).Error; err != nil {
			return err
		}
		var children int64
		if err := tx.Model(&domain.AuthGroup{}).
			Where("kb_id = ? AND parent_id = ?", kbID, id).
			Count(&children).Error; err != nil {
			return err
		}
		if children > 0 {
			return fmt.Errorf("auth group has child groups")
		}
		if err := tx.Where("auth_group_id = ?", id).Delete(&domain.NodeAuthGroup{}).Error; err != nil {
			return err
		}
		return tx.Delete(&domain.AuthGroup{}, "id = ? AND kb_id = ?", id, kbID).Error
	})
}

func (r *AuthGroupRepository) Move(ctx context.Context, req *domain.AuthGroupMoveReq) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var group domain.AuthGroup
		if err := tx.Where("id = ? AND kb_id = ?", req.ID, req.KBID).First(&group).Error; err != nil {
			return err
		}
		if req.ParentID != nil {
			if err := ensureAuthGroupParent(tx, req.KBID, *req.ParentID, req.ID); err != nil {
				return err
			}
		}
		position, err := moveAuthGroupPosition(tx, req.KBID, req.ID, req.PrevID, req.NextID, req.ParentID)
		if err != nil {
			return err
		}
		return tx.Model(&domain.AuthGroup{}).
			Where("id = ? AND kb_id = ?", req.ID, req.KBID).
			Updates(map[string]any{
				"parent_id":  req.ParentID,
				"position":   position,
				"updated_at": time.Now(),
			}).Error
	})
}

func (r *AuthGroupRepository) UpsertSyncedGroup(ctx context.Context, group *domain.AuthGroup) (*domain.AuthGroup, error) {
	var existing domain.AuthGroup
	err := r.db.WithContext(ctx).
		Where("kb_id = ? AND sync_id = ? AND sync_id <> ''", group.KbID, group.SyncId).
		First(&existing).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		if err := r.Create(ctx, group); err != nil {
			return nil, err
		}
		return group, nil
	}
	updateMap := map[string]any{
		"name":           group.Name,
		"position":       group.Position,
		"source_type":    group.SourceType,
		"sync_parent_id": group.SyncParentId,
		"updated_at":     time.Now(),
	}
	if err := r.db.WithContext(ctx).
		Model(&domain.AuthGroup{}).
		Where("id = ? AND kb_id = ?", existing.ID, group.KbID).
		Updates(updateMap).Error; err != nil {
		return nil, err
	}
	existing.Name = group.Name
	existing.Position = group.Position
	existing.SourceType = group.SourceType
	existing.SyncParentId = group.SyncParentId
	return &existing, nil
}

func (r *AuthGroupRepository) UpdateGroupAuthIDs(ctx context.Context, kbID string, id uint, authIDs pq.Int64Array) error {
	return r.db.WithContext(ctx).
		Model(&domain.AuthGroup{}).
		Where("id = ? AND kb_id = ?", id, kbID).
		Updates(map[string]any{
			"auth_ids":   authIDs,
			"updated_at": time.Now(),
		}).Error
}

func (r *AuthGroupRepository) List(ctx context.Context, kbID string) ([]*domain.AuthGroup, error) {
	groups := make([]*domain.AuthGroup, 0)
	if err := r.db.WithContext(ctx).
		Where("kb_id = ?", kbID).
		Order("position ASC, id ASC").
		Find(&groups).Error; err != nil {
		return nil, err
	}
	return groups, nil
}

func (r *AuthGroupRepository) Get(ctx context.Context, kbID string, id uint) (*domain.AuthGroup, error) {
	var group domain.AuthGroup
	if err := r.db.WithContext(ctx).
		Where("id = ? AND kb_id = ?", id, kbID).
		First(&group).Error; err != nil {
		return nil, err
	}
	return &group, nil
}

func (r *AuthGroupRepository) GetAuthsByIDs(ctx context.Context, ids []uint) ([]*domain.AuthGroupAuthItem, error) {
	items := make([]*domain.AuthGroupAuthItem, 0)
	if len(ids) == 0 {
		return items, nil
	}
	if err := r.db.WithContext(ctx).
		Table("auths").
		Select(`id,
			COALESCE(user_info->>'username', '') AS username,
			COALESCE(user_info->>'avatar_url', '') AS avatar_url,
			COALESCE(user_info->>'email', '') AS email,
			source_type,
			ip,
			last_login_time,
			created_at`).
		Where("id IN ?", ids).
		Scan(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func ensureAuthGroupParent(tx *gorm.DB, kbID string, parentID, groupID uint) error {
	for current := parentID; current != 0; {
		if groupID != 0 && current == groupID {
			return fmt.Errorf("auth group cannot be its own ancestor")
		}
		var parent domain.AuthGroup
		if err := tx.Where("id = ? AND kb_id = ?", current, kbID).First(&parent).Error; err != nil {
			return err
		}
		if parent.ParentID == nil {
			return nil
		}
		current = *parent.ParentID
	}
	return nil
}

func nextAuthGroupPosition(tx *gorm.DB, kbID string, parentID *uint) (float64, error) {
	var maxPosition float64
	query := tx.Model(&domain.AuthGroup{}).Where("kb_id = ?", kbID)
	if parentID == nil {
		query = query.Where("parent_id IS NULL")
	} else {
		query = query.Where("parent_id = ?", *parentID)
	}
	if err := query.Select("COALESCE(MAX(position), 0)").Scan(&maxPosition).Error; err != nil {
		return 0, err
	}
	if maxPosition+1000 > domain.MaxPosition {
		return (maxPosition + domain.MaxPosition) / 2, nil
	}
	return maxPosition + 1000, nil
}

func moveAuthGroupPosition(tx *gorm.DB, kbID string, groupID uint, prevID, nextID, parentID *uint) (float64, error) {
	if prevID == nil && nextID == nil {
		return nextAuthGroupPosition(tx, kbID, parentID)
	}
	var prevPosition, nextPosition float64
	if prevID != nil {
		var prev domain.AuthGroup
		if err := tx.Where("id = ? AND kb_id = ?", *prevID, kbID).First(&prev).Error; err != nil {
			return 0, err
		}
		prevPosition = prev.Position
	}
	if nextID != nil {
		var next domain.AuthGroup
		if err := tx.Where("id = ? AND kb_id = ?", *nextID, kbID).First(&next).Error; err != nil {
			return 0, err
		}
		nextPosition = next.Position
	} else {
		maxPosition, err := nextAuthGroupPosition(tx, kbID, parentID)
		if err != nil {
			return 0, err
		}
		nextPosition = maxPosition
	}
	if nextPosition-prevPosition <= domain.MinPositionGap {
		return (prevPosition + nextPosition) / 2, nil
	}
	return prevPosition + (nextPosition-prevPosition)/2, nil
}

func AuthIDsToInt64Array(ids []int) pq.Int64Array {
	result := make(pq.Int64Array, 0, len(ids))
	for _, id := range ids {
		result = append(result, int64(id))
	}
	return result
}

func Int64ArrayToAuthIDs(ids pq.Int64Array) []int {
	result := make([]int, 0, len(ids))
	for _, id := range ids {
		result = append(result, int(id))
	}
	return result
}
