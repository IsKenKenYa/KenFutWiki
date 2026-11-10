package pg

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/chaitin/panda-wiki/consts"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/store/pg"
)

type ContributeRepository struct {
	db     *pg.DB
	logger *log.Logger
}

func NewContributeRepository(db *pg.DB, logger *log.Logger) *ContributeRepository {
	return &ContributeRepository{db: db, logger: logger.WithModule("repo.pg.contribute")}
}

func (r *ContributeRepository) Create(ctx context.Context, contribute *domain.Contribute) error {
	if err := r.db.WithContext(ctx).Create(contribute).Error; err != nil {
		return fmt.Errorf("create contribute failed: %w", err)
	}
	return nil
}

func (r *ContributeRepository) List(ctx context.Context, req *domain.ContributeListReq) ([]*domain.ContributeListItem, int64, error) {
	query := r.db.WithContext(ctx).
		Table("contributes c").
		Joins("LEFT JOIN auths a ON a.id = c.auth_id").
		Joins("LEFT JOIN nodes n ON n.id = c.node_id AND n.kb_id = c.kb_id").
		Where("c.kb_id = ?", req.KBID)
	if req.NodeName != "" {
		query = query.Where("COALESCE(n.name, c.name) ILIKE ?", "%"+req.NodeName+"%")
	}
	if req.AuthName != "" {
		query = query.Where("COALESCE(a.user_info->>'username', '') ILIKE ?", "%"+req.AuthName+"%")
	}
	if req.Status != "" {
		query = query.Where("c.status = ?", req.Status)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	items := make([]*domain.ContributeListItem, 0)
	if err := query.
		Select(`c.id,
			c.auth_id,
			COALESCE(a.user_info->>'username', '') AS auth_name,
			c.kb_id,
			c.name AS contribute_name,
			c.node_id,
			COALESCE(n.name, '') AS node_name,
			c.meta,
			c.status,
			c.type,
			c.reason,
			c.remote_ip,
			c.audit_user_id,
			c.audit_time,
			c.created_at,
			c.updated_at`).
		Order("c.created_at DESC").
		Offset(req.Offset()).
		Limit(req.Limit()).
		Scan(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *ContributeRepository) Get(ctx context.Context, kbID, id string) (*domain.ContributeDetailResp, error) {
	var detail domain.ContributeDetailResp
	if err := r.db.WithContext(ctx).
		Table("contributes c").
		Joins("LEFT JOIN auths a ON a.id = c.auth_id").
		Joins("LEFT JOIN nodes n ON n.id = c.node_id AND n.kb_id = c.kb_id").
		Select(`c.id,
			c.auth_id,
			COALESCE(a.user_info->>'username', '') AS auth_name,
			c.kb_id,
			c.node_id,
			COALESCE(n.name, c.name) AS node_name,
			c.name AS contribute_name,
			c.content,
			c.meta,
			c.reason,
			c.status,
			c.type,
			c.audit_user_id,
			c.audit_time,
			c.created_at,
			c.updated_at`).
		Where("c.kb_id = ? AND c.id = ?", kbID, id).
		Scan(&detail).Error; err != nil {
		return nil, err
	}
	if detail.ID == "" {
		return nil, gorm.ErrRecordNotFound
	}
	if detail.Type == consts.ContributeTypeEdit && detail.NodeID != "" {
		var node domain.Node
		if err := r.db.WithContext(ctx).
			Where("kb_id = ? AND id = ?", kbID, detail.NodeID).
			First(&node).Error; err == nil {
			detail.OriginalNode = &domain.ContributeOriginalNode{
				ID:      node.ID,
				Name:    node.Name,
				Content: node.Content,
				Meta:    node.Meta,
			}
		} else if err != gorm.ErrRecordNotFound {
			return nil, err
		}
	}
	return &detail, nil
}

func (r *ContributeRepository) ApproveAdd(ctx context.Context, req *domain.ContributeAuditReq, auditUserID, name, content, contentType, emoji string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		contribute, err := lockPendingContribute(tx, req.KBID, req.ID)
		if err != nil {
			return err
		}
		if contribute.Type != consts.ContributeTypeAdd {
			return fmt.Errorf("contribute %s is not an add request", contribute.Id)
		}
		if req.NavID == "" {
			return fmt.Errorf("nav_id is required to approve an add request")
		}

		var maxPos float64
		query := tx.Model(&domain.Node{}).
			Where("kb_id = ?", req.KBID)
		if req.ParentID == "" {
			query = query.Where("parent_id IS NULL OR parent_id = ''")
		} else {
			query = query.Where("parent_id = ?", req.ParentID)
		}
		if err := query.Select("COALESCE(MAX(position::float), 0)").Scan(&maxPos).Error; err != nil {
			return err
		}
		position := maxPos + (domain.MaxPosition-maxPos)/2
		if req.Position != nil {
			if *req.Position < 0 || *req.Position > domain.MaxPosition {
				return fmt.Errorf("position is out of range")
			}
			position = *req.Position
		}

		nodeID, err := uuid.NewV7()
		if err != nil {
			return err
		}
		now := time.Now()
		node := &domain.Node{
			ID:        nodeID.String(),
			KBID:      req.KBID,
			NavId:     req.NavID,
			Name:      name,
			Content:   content,
			Meta:      domain.NodeMeta{ContentType: contentType, Emoji: emoji},
			Type:      domain.NodeTypeDocument,
			ParentID:  req.ParentID,
			Position:  position,
			Status:    domain.NodeStatusUnreleased,
			CreatorId: auditUserID,
			EditorId:  auditUserID,
			Lang:      domain.DefaultNodeLang,
			CreatedAt: now,
			UpdatedAt: now,
			EditTime:  now,
			RagInfo: domain.RagInfo{
				Status: consts.NodeRagStatusPending,
			},
			Permissions: domain.NodePermissions{
				Answerable: consts.NodeAccessPermOpen,
				Visitable:  consts.NodeAccessPermOpen,
				Visible:    consts.NodeAccessPermOpen,
			},
		}
		if err := tx.Create(node).Error; err != nil {
			return err
		}
		return markContributeAudited(tx, req.KBID, req.ID, auditUserID, consts.ContributeStatusApproved)
	})
}

func (r *ContributeRepository) ApproveEdit(ctx context.Context, req *domain.ContributeAuditReq, auditUserID, name, content, contentType, emoji string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		contribute, err := lockPendingContribute(tx, req.KBID, req.ID)
		if err != nil {
			return err
		}
		if contribute.Type != consts.ContributeTypeEdit || contribute.NodeId == "" {
			return fmt.Errorf("contribute %s is not an edit request", contribute.Id)
		}
		var node domain.Node
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("kb_id = ? AND id = ?", req.KBID, contribute.NodeId).
			First(&node).Error; err != nil {
			return err
		}
		meta := node.Meta
		if name != "" {
			node.Name = name
		}
		meta.ContentType = contentType
		meta.Emoji = emoji
		status := node.Status
		if status != domain.NodeStatusUnreleased {
			status = domain.NodeStatusDraft
		}
		if err := tx.Model(&domain.Node{}).
			Where("kb_id = ? AND id = ?", req.KBID, node.ID).
			Updates(map[string]any{
				"name":      node.Name,
				"content":   content,
				"meta":      meta,
				"status":    status,
				"editor_id": auditUserID,
				"edit_time": time.Now(),
			}).Error; err != nil {
			return err
		}
		return markContributeAudited(tx, req.KBID, req.ID, auditUserID, consts.ContributeStatusApproved)
	})
}

func (r *ContributeRepository) Reject(ctx context.Context, req *domain.ContributeAuditReq, auditUserID string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if _, err := lockPendingContribute(tx, req.KBID, req.ID); err != nil {
			return err
		}
		return markContributeAudited(tx, req.KBID, req.ID, auditUserID, consts.ContributeStatusRejected)
	})
}

func lockPendingContribute(tx *gorm.DB, kbID, id string) (*domain.Contribute, error) {
	var contribute domain.Contribute
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("kb_id = ? AND id = ?", kbID, id).
		First(&contribute).Error; err != nil {
		return nil, err
	}
	if contribute.Status != consts.ContributeStatusPending {
		return nil, fmt.Errorf("contribute is already %s", contribute.Status)
	}
	return &contribute, nil
}

func markContributeAudited(tx *gorm.DB, kbID, id, auditUserID string, status consts.ContributeStatus) error {
	now := time.Now()
	result := tx.Model(&domain.Contribute{}).
		Where("kb_id = ? AND id = ?", kbID, id).
		Updates(map[string]any{
			"status":        status,
			"audit_user_id": auditUserID,
			"audit_time":    now,
			"updated_at":    now,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
