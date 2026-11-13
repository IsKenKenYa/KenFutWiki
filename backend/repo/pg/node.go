package pg

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/samber/lo"
	"github.com/samber/lo/mutable"

	v1 "github.com/chaitin/panda-wiki/api/node/v1"
	shareV1 "github.com/chaitin/panda-wiki/api/share/v1"
	"github.com/chaitin/panda-wiki/consts"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/store/pg"
)

type NodeRepository struct {
	db     *pg.DB
	logger *log.Logger
}

func NewNodeRepository(db *pg.DB, logger *log.Logger) *NodeRepository {
	return &NodeRepository{db: db, logger: logger.WithModule("repo.pg.node")}
}

func (r *NodeRepository) Create(ctx context.Context, req *domain.CreateNodeReq, userId string) (string, error) {
	nodeID, err := uuid.NewV7()
	if err != nil {
		return "", err
	}
	nodeIDStr := nodeID.String()
	err = r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// check count
		var count int64
		if err := tx.Model(&domain.Node{}).
			Where("kb_id = ?", req.KBID).
			Count(&count).Error; err != nil {
			return err
		}
		if req.MaxNode > 0 && count >= int64(req.MaxNode) {
			return domain.ErrMaxNodeLimitReached
		}
		var maxPos float64
		query := tx.WithContext(ctx).
			Model(&domain.Node{}).
			Where("kb_id = ?", req.KBID)

		if req.ParentID == "" {
			query = query.Where("parent_id IS NULL OR parent_id = ''")
		} else {
			query = query.Where("parent_id = ?", req.ParentID)
		}

		if err := query.
			Select("COALESCE(MAX(position::float), 0)").
			Scan(&maxPos).Error; err != nil {
			return err
		}

		var newPos float64
		if req.Position != nil { // user specify position
			if *req.Position > domain.MaxPosition || *req.Position < 0 {
				return errors.New("specified position is out of range")
			}
			newPos = *req.Position
		} else { // default the last
			newPos = maxPos + (domain.MaxPosition-maxPos)/2.0
			if newPos-maxPos < domain.MinPositionGap {
				if err := r.reorderPositionsByParentID(tx, req.KBID, req.ParentID); err != nil {
					return err
				}
			}
		}

		now := time.Now()
		meta := domain.NodeMeta{Emoji: req.Emoji}
		if req.Summary != nil {
			meta.Summary = *req.Summary
		}
		if req.ContentType != nil {
			meta.ContentType = *req.ContentType
		}

		lang := req.Lang
		if lang == "" {
			lang = domain.DefaultNodeLang
		}
		if !domain.IsValidNodeLang(lang) {
			return fmt.Errorf("unsupported node lang: %s", lang)
		}

		// 译本组：源文档已有组则加入，否则建新组并把源文档收进组
		var groupID *string
		if req.TranslateFromNodeID != "" {
			var source domain.Node
			if err := tx.Where("kb_id = ? AND id = ?", req.KBID, req.TranslateFromNodeID).First(&source).Error; err != nil {
				return fmt.Errorf("translation source node not found: %w", err)
			}
			if source.Lang == lang {
				return fmt.Errorf("translation lang conflicts with source node lang %q", source.Lang)
			}
			if source.TranslationGroupID != nil {
				groupID = source.TranslationGroupID
			} else {
				newGroup := uuid.NewString()
				groupID = &newGroup
				if err := tx.Model(&domain.Node{}).Where("id = ?", source.ID).Update("translation_group_id", newGroup).Error; err != nil {
					return err
				}
			}
			// 组内语言唯一性
			var siblings int64
			if err := tx.Model(&domain.Node{}).
				Where("kb_id = ? AND translation_group_id = ? AND lang = ? AND id <> ?", req.KBID, *groupID, lang, source.ID).
				Count(&siblings).Error; err != nil {
				return err
			}
			if siblings > 0 {
				return fmt.Errorf("translation group already has a %s version", lang)
			}
		}

		node := &domain.Node{
			ID:                 nodeIDStr,
			KBID:               req.KBID,
			NavId:              req.NavId,
			Name:               req.Name,
			Content:            req.Content,
			Meta:               meta,
			Type:               req.Type,
			ParentID:           req.ParentID,
			Position:           newPos,
			Status:             domain.NodeStatusUnreleased,
			CreatorId:          userId,
			EditorId:           userId,
			Lang:               lang,
			TranslationGroupID: groupID,
			CreatedAt:          now,
			UpdatedAt:          now,
			EditTime:           now,
			RagInfo: domain.RagInfo{
				Status:  consts.NodeRagStatusPending,
				Message: "",
			},
			Permissions: domain.NodePermissions{
				Answerable: consts.NodeAccessPermOpen,
				Visitable:  consts.NodeAccessPermOpen,
				Visible:    consts.NodeAccessPermOpen,
			},
		}

		return tx.Create(node).Error
	})
	if err != nil {
		return "", err
	}

	return nodeIDStr, nil
}

func (r *NodeRepository) GetList(ctx context.Context, req *domain.GetNodeListReq) ([]*domain.NodeListItemResp, error) {
	var nodes []*domain.NodeListItemResp
	query := r.db.WithContext(ctx).
		Model(&domain.Node{}).
		Joins("LEFT JOIN users cu ON nodes.creator_id = cu.id").
		Joins("LEFT JOIN users eu ON nodes.editor_id = eu.id").
		Where("nodes.kb_id = ?", req.KBID).
		Select("cu.account AS creator, eu.account AS editor, nodes.editor_id, nodes.nav_id, nodes.rag_info, nodes.creator_id, nodes.id, nodes.permissions, nodes.type, nodes.status, nodes.name, nodes.parent_id, nodes.position, nodes.created_at, nodes.edit_time as updated_at, nodes.meta->>'summary' as summary, nodes.meta->>'emoji' as emoji, nodes.meta->>'content_type' as content_type, nodes.lang, nodes.translation_group_id")
	if req.Search != "" {
		searchPattern := "%" + req.Search + "%"
		query = query.Where("name LIKE ? OR content LIKE ?", searchPattern, searchPattern)
	}
	if req.NavId != "" {
		query = query.Where("nodes.nav_id = ?", req.NavId)
	}
	if err := query.Find(&nodes).Error; err != nil {
		return nil, err
	}
	return nodes, nil
}

// GetNodeTranslations 返回文档译本组内全部成员（含自身），按 lang 排序；
// slug/channel 取各译本最新一次发布的内容元数据（未发布过的译本为空）
func (r *NodeRepository) GetNodeTranslations(ctx context.Context, kbID, nodeID string) ([]*domain.NodeTranslation, error) {
	var source domain.Node
	if err := r.db.WithContext(ctx).
		Where("kb_id = ? AND id = ?", kbID, nodeID).
		Select("id, translation_group_id").
		First(&source).Error; err != nil {
		return nil, err
	}
	if source.TranslationGroupID == nil {
		return nil, nil
	}
	translations := []*domain.NodeTranslation{}
	err := r.db.WithContext(ctx).Raw(`
		SELECT n.id AS node_id, n.lang, n.name,
		       COALESCE(kcr.metadata->>'slug','') AS slug,
		       COALESCE(kcr.metadata->>'channel','docs') AS channel
		FROM nodes n
		LEFT JOIN LATERAL (
			SELECT metadata FROM kenfut_content_releases r
			WHERE r.node_id = n.id
			ORDER BY r.created_at DESC
			LIMIT 1
		) kcr ON true
		WHERE n.kb_id = ? AND n.translation_group_id = ?
		ORDER BY n.lang ASC`, kbID, *source.TranslationGroupID).Scan(&translations).Error
	return translations, err
}

func (r *NodeRepository) GetLatestNodeReleaseByNodeIDs(ctx context.Context, kbID string, ids []string) ([]*domain.NodeRelease, error) {
	var nodeReleases []*domain.NodeRelease
	if err := r.db.WithContext(ctx).
		Model(&domain.NodeRelease{}).
		Where("node_id IN ?", ids).
		Where("kb_id = ?", kbID).
		Select("DISTINCT ON (node_id) id, node_id, kb_id, doc_id").
		Order("node_id, updated_at DESC").
		Find(&nodeReleases).Error; err != nil {
		return nil, err
	}
	return nodeReleases, nil
}

func (r *NodeRepository) GetNodeReleasePublisherMap(ctx context.Context, kbID string) (map[string]string, error) {
	type Result struct {
		NodeID      string `gorm:"column:node_id"`
		PublisherID string `gorm:"column:publisher_id"`
	}

	var results []Result
	if err := r.db.WithContext(ctx).
		Model(&domain.NodeRelease{}).
		Select("node_id, publisher_id").
		Where("kb_id = ?", kbID).
		Where("node_releases.doc_id != '' ").
		Find(&results).Error; err != nil {
		return nil, err
	}

	publisherMap := make(map[string]string)
	for _, result := range results {
		if result.PublisherID != "" {
			publisherMap[result.NodeID] = result.PublisherID
		}
	}

	return publisherMap, nil
}

func (r *NodeRepository) UpdateNodeContent(ctx context.Context, req *domain.UpdateNodeReq, userId string) error {
	// Use transaction to ensure data consistency
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Get current node data with row-level lock
		var currentNode domain.Node
		if err := tx.Model(&domain.Node{}).
			Where("id = ?", req.ID).
			Where("kb_id = ?", req.KBID).
			// Use FOR UPDATE to lock the row until the transaction is complete
			Clauses(clause.Locking{Strength: "UPDATE"}).
			First(&currentNode).Error; err != nil {
			return err
		}
		if req.ExpectedUpdatedAt != nil && !currentNode.UpdatedAt.Equal(*req.ExpectedUpdatedAt) {
			return domain.ErrMCPVersionConflict
		}

		updateMap := make(map[string]any)
		updateStatus := false

		updateMap["editor_id"] = userId

		// Compare and update Name
		if req.Name != nil && *req.Name != currentNode.Name {
			updateMap["name"] = *req.Name
			updateStatus = true
		}

		// Compare and update Content
		if req.Content != nil && *req.Content != currentNode.Content {
			updateMap["content"] = *req.Content
			updateStatus = true
		}

		if req.NavId != nil && *req.NavId != currentNode.NavId {
			updateMap["nav_id"] = *req.NavId
			updateStatus = true
		}

		if req.Position != nil && *req.Position != currentNode.Position { // user specify position
			updateMap["position"] = *req.Position
			if *req.Position > domain.MaxPosition || *req.Position < 0 {
				return errors.New("specified position is out of range")
			}
			updateStatus = true
		}

		// Handle multiple meta field updates
		if req.Emoji != nil || req.Summary != nil || req.ContentType != nil {
			metaExpr := "meta"
			var args []any
			metaUpdated := false

			// Compare and update Emoji
			if req.Emoji != nil && *req.Emoji != currentNode.Meta.Emoji {
				// First jsonb_set: jsonb_set(meta, '{emoji}', to_jsonb(?::text))
				metaExpr = "jsonb_set(" + metaExpr + ", '{emoji}', to_jsonb(?::text))"
				args = append(args, *req.Emoji) // First parameter for emoji
				metaUpdated = true
			}

			// Compare and update Summary
			if req.Summary != nil && *req.Summary != currentNode.Meta.Summary {
				// Second jsonb_set: jsonb_set(previous_expr, '{summary}', to_jsonb(?::text))
				metaExpr = "jsonb_set(" + metaExpr + ", '{summary}', to_jsonb(?::text))"
				args = append(args, *req.Summary) // Second parameter for summary
				metaUpdated = true
			}

			// Compare and update ContentType
			if currentNode.Meta.ContentType == "" { // can only modify content_type if it was empty before
				if req.ContentType != nil && *req.ContentType != currentNode.Meta.ContentType {
					// Second jsonb_set: jsonb_set(previous_expr, '{content_type}', to_jsonb(?::text))
					metaExpr = "jsonb_set(" + metaExpr + ", '{content_type}', to_jsonb(?::text))"
					args = append(args, *req.ContentType) // Second parameter for content_type
					metaUpdated = true
				}
			}

			if metaUpdated {
				updateMap["meta"] = gorm.Expr(metaExpr, args...)
				updateStatus = true
			}
		}

		// If any field is updated and node released, set status to draft
		if updateStatus && currentNode.Status != domain.NodeStatusUnreleased {
			updateMap["status"] = domain.NodeStatusDraft
			updateMap["edit_time"] = time.Now()
		}

		// Perform update if there are changes
		if len(updateMap) > 0 {
			// Use the transaction's DB instance for the update
			return tx.Model(&domain.Node{}).
				Where("id = ?", req.ID).
				Where("kb_id = ?", req.KBID).
				Updates(updateMap).Error
		}
		return nil
	})

	// Return any error from the transaction
	return err
}

func (r *NodeRepository) GetByID(ctx context.Context, id, kbId string) (*v1.NodeDetailResp, error) {
	var node *v1.NodeDetailResp
	if err := r.db.WithContext(ctx).
		Model(&domain.Node{}).
		Select("nodes.*, creator.id as creator_id, creator.account as creator_account, editor.id as editor_id, editor.account as editor_account").
		Joins("left join users creator on creator.id = nodes.creator_id").
		Joins("left join users editor on editor.id = nodes.editor_id").
		Where("nodes.id = ?", id).
		Where("nodes.kb_id = ?", kbId).
		First(&node).Error; err != nil {
		return nil, err
	}
	return node, nil
}

// Delete 将文档（含子树）标记进回收站：gorm 软删除使普通查询自动排除，
// 发布清单与公开站按 join 天然不再展示。返回仍需从检索库移除的 docID。
func (r *NodeRepository) Delete(ctx context.Context, kbID string, ids []string) ([]string, error) {
	docIDs := make([]string, 0)
	if err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 递归收集全部子文档；已被软删的文档不会再次命中
		allIDs := r.collectAllChildNodeIDs(tx, kbID, ids)

		var releases []*domain.NodeRelease
		if err := tx.Model(&domain.NodeRelease{}).
			Where("node_id IN ?", allIDs).
			Find(&releases).Error; err != nil {
			return err
		}
		for _, release := range releases {
			if release.DocID != "" {
				docIDs = append(docIDs, release.DocID)
			}
		}

		result := tx.Model(&domain.Node{}).
			Where("id IN ? AND kb_id = ?", allIDs, kbID).
			Delete(&domain.Node{})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return lo.Uniq(docIDs), nil
}

// RecycleBinList 列出回收站中的文档，按删除时间倒序。
func (r *NodeRepository) RecycleBinList(ctx context.Context, kbID string) ([]domain.NodeRecycleBinItem, error) {
	items := make([]domain.NodeRecycleBinItem, 0)
	err := r.db.Unscoped().WithContext(ctx).
		Model(&domain.Node{}).
		Select("id, name, type, parent_id, nav_id, lang, deleted_at").
		Where("kb_id = ? AND deleted_at IS NOT NULL", kbID).
		Order("deleted_at DESC").
		Scan(&items).Error
	return items, err
}

// Restore 将回收站中的文档恢复为可见；恢复目录时连带恢复整个子树，
// 恢复后的已发布快照重新进入检索重建队列。
func (r *NodeRepository) Restore(ctx context.Context, kbID string, ids []string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		allIDs := r.collectAllChildNodeIDsUnscoped(tx, kbID, ids)
		result := tx.Unscoped().Model(&domain.Node{}).
			Where("kb_id = ? AND id IN ? AND deleted_at IS NOT NULL", kbID, allIDs).
			Update("deleted_at", nil)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		// 恢复后向检索库重新灌入已发布快照：清单仍保留关联，outbox 会按当前清单校验
		return tx.Exec(
			`INSERT INTO kenfut_rag_outbox(node_release_id,kb_id,created_at)
			 SELECT nr.id, nr.kb_id, clock_timestamp() FROM node_releases nr
			 WHERE nr.kb_id = ? AND nr.node_id IN ?
			   AND EXISTS (SELECT 1 FROM kb_release_node_releases m WHERE m.node_release_id=nr.id AND m.kb_id=nr.kb_id
			               AND m.release_id=(SELECT id FROM kb_releases WHERE kb_id=nr.kb_id ORDER BY created_at DESC,id DESC LIMIT 1))
			 ON CONFLICT DO NOTHING`,
			kbID, allIDs,
		).Error
	})
}

// Purge 将回收站中的文档连同其全部发布快照、清单关联一并彻底清除，
// 返回仍需从检索库移除的 docID。
func (r *NodeRepository) Purge(ctx context.Context, kbID string, ids []string) ([]string, error) {
	docIDs := make([]string, 0)
	if err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		allIDs := r.collectAllChildNodeIDsUnscoped(tx, kbID, ids)

		var releases []*domain.NodeRelease
		if err := tx.Unscoped().Model(&domain.NodeRelease{}).
			Where("node_id IN ?", allIDs).
			Find(&releases).Error; err != nil {
			return err
		}
		for _, release := range releases {
			if release.DocID != "" {
				docIDs = append(docIDs, release.DocID)
			}
		}

		if err := tx.Unscoped().Where("kb_id = ? AND node_id IN ?", kbID, allIDs).
			Delete(&domain.KBReleaseNodeRelease{}).Error; err != nil {
			return err
		}
		if err := tx.Unscoped().Where("node_id IN ?", allIDs).
			Delete(&domain.NodeRelease{}).Error; err != nil {
			return err
		}
		result := tx.Unscoped().
			Where("id IN ? AND kb_id = ?", allIDs, kbID).
			Delete(&domain.Node{})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return lo.Uniq(docIDs), nil
}

// collectAllChildNodeIDsUnscoped 与 collectAllChildNodeIDs 相同，但包含回收站中的文档。
func (r *NodeRepository) collectAllChildNodeIDsUnscoped(tx *gorm.DB, kbID string, parentIDs []string) []string {
	allIDs := make([]string, 0)
	allIDs = append(allIDs, parentIDs...)

	currentParentIDs := parentIDs
	for len(currentParentIDs) > 0 {
		var childIDs []string
		if err := tx.Unscoped().Model(&domain.Node{}).
			Where("parent_id IN ?", currentParentIDs).
			Where("kb_id = ?", kbID).
			Pluck("id", &childIDs).Error; err != nil {
			break
		}
		next := make([]string, 0)
		for _, childID := range childIDs {
			if !lo.Contains(allIDs, childID) {
				next = append(next, childID)
			}
		}
		allIDs = append(allIDs, next...)
		if len(next) == 0 {
			break
		}
		currentParentIDs = next
	}
	return allIDs
}

// collectAllChildNodeIDs recursively collects all child node IDs for the given parent IDs
func (r *NodeRepository) collectAllChildNodeIDs(tx *gorm.DB, kbID string, parentIDs []string) []string {
	allIDs := make([]string, 0)
	allIDs = append(allIDs, parentIDs...)

	currentParentIDs := parentIDs
	for len(currentParentIDs) > 0 {
		var childIDs []string
		if err := tx.Model(&domain.Node{}).
			Where("parent_id IN ?", currentParentIDs).
			Where("kb_id = ?", kbID).
			Select("id").
			Find(&childIDs).Error; err != nil {
			break
		}

		if len(childIDs) == 0 {
			break
		}

		allIDs = append(allIDs, childIDs...)
		currentParentIDs = childIDs
	}

	return lo.Uniq(allIDs)
}

func (r *NodeRepository) CountChildren(ctx context.Context, kbID, nodeID string) (int64, error) {
	var count int64
	if err := r.db.WithContext(ctx).
		Model(&domain.Node{}).
		Where("kb_id = ? AND parent_id = ?", kbID, nodeID).
		Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

func (r *NodeRepository) GetNodeByID(ctx context.Context, id string) (*domain.Node, error) {
	var node *domain.Node
	if err := r.db.WithContext(ctx).
		Model(&domain.Node{}).
		Where("id = ?", id).
		First(&node).Error; err != nil {
		return nil, err
	}
	return node, nil
}

// GetNodesByIDs retrieves nodes by their IDs
func (r *NodeRepository) GetNodesByIDs(ctx context.Context, ids []string) (map[string]*domain.Node, error) {
	if len(ids) == 0 {
		return make(map[string]*domain.Node), nil
	}
	var nodes []*domain.Node
	if err := r.db.WithContext(ctx).
		Model(&domain.Node{}).
		Where("id IN ?", ids).
		Find(&nodes).Error; err != nil {
		return nil, err
	}
	nodesMap := make(map[string]*domain.Node, len(nodes))
	for _, node := range nodes {
		nodesMap[node.ID] = node
	}
	return nodesMap, nil
}

// buildNodePath builds the directory path for a node release by traversing up the parent hierarchy (max 5 levels)
func (r *NodeRepository) buildNodePath(ctx context.Context, kbID string, nodeRelease *domain.NodeRelease) (string, error) {
	// Build path by traversing up max 5 levels
	var pathParts []string
	currentParentNodeID := nodeRelease.ParentID

	// Traverse up the parent hierarchy, max 5 levels
	for i := 0; i < 5 && currentParentNodeID != ""; i++ {
		// Get the parent node release (ordered by created time to get the latest)
		var parentNodeRelease domain.NodeRelease
		if err := r.db.WithContext(ctx).
			Model(&domain.NodeRelease{}).
			Where("node_id = ? AND kb_id = ?", currentParentNodeID, kbID).
			Select("id, node_id, parent_id, name, type").
			Order("created_at DESC").
			First(&parentNodeRelease).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				break
			}
			return "", err
		}

		// Prepend current node name to path if it's a folder
		if parentNodeRelease.Type == domain.NodeTypeFolder {
			pathParts = append(pathParts, parentNodeRelease.Name)
		}

		// Move to parent's parent
		currentParentNodeID = parentNodeRelease.ParentID
	}

	// Build the final path
	if len(pathParts) == 0 {
		return "/", nil
	}

	mutable.Reverse(pathParts)
	path := "/" + strings.Join(pathParts, "/") + "/"
	return path, nil
}

func (r *NodeRepository) GetNodeNameByNodeIDs(ctx context.Context, ids []string) (map[string]string, error) {
	nodesMap := make(map[string]string)
	for _, chunk := range lo.Chunk(ids, 1000) {
		var nodes []*domain.Node
		if err := r.db.WithContext(ctx).
			Model(&domain.Node{}).
			Where("id IN ?", chunk).
			Select("id, name").
			Find(&nodes).Error; err != nil {
			return nil, err
		}
		for _, node := range nodes {
			nodesMap[node.ID] = node.Name
		}
	}
	return nodesMap, nil
}

func (r *NodeRepository) GetNodeReleaseByID(ctx context.Context, id string) (*domain.NodeRelease, error) {
	var nodeRelease *domain.NodeRelease
	if err := r.db.WithContext(ctx).
		Model(&domain.NodeRelease{}).
		Where("id = ?", id).
		First(&nodeRelease).Error; err != nil {
		return nil, err
	}
	return nodeRelease, nil
}

func (r *NodeRepository) GetLatestNodeReleaseByNodeID(ctx context.Context, nodeID string) (*domain.NodeRelease, error) {
	var nodeRelease *domain.NodeRelease
	if err := r.db.WithContext(ctx).
		Model(&domain.NodeRelease{}).
		Where("node_id = ?", nodeID).
		Order("updated_at DESC").
		First(&nodeRelease).Error; err != nil {
		return nil, err
	}
	return nodeRelease, nil
}

func (r *NodeRepository) ListNodeReleaseHistory(ctx context.Context, kbID, nodeID string) ([]*domain.NodeReleaseHistoryItem, error) {
	items := make([]*domain.NodeReleaseHistoryItem, 0)
	err := r.db.WithContext(ctx).Raw(`
		SELECT nr.id,
		       nr.node_id,
		       nr.name,
		       nr.meta,
		       nr.updated_at,
		       n.creator_id,
		       COALESCE(cu.account, '') AS creator_account,
		       nr.editor_id,
		       COALESCE(eu.account, '') AS editor_account,
		       nr.publisher_id,
		       COALESCE(pu.account, '') AS publisher_account,
		       COALESCE(kr.id, '') AS release_id,
		       COALESCE(kr.tag, '') AS release_name,
		       COALESCE(kr.message, '') AS release_message
		FROM node_releases nr
		JOIN nodes n ON n.id = nr.node_id AND n.kb_id = nr.kb_id
		LEFT JOIN users cu ON cu.id = n.creator_id
		LEFT JOIN users eu ON eu.id = nr.editor_id
		LEFT JOIN users pu ON pu.id = nr.publisher_id
		LEFT JOIN kb_release_node_releases krnr ON krnr.node_release_id = nr.id AND krnr.kb_id = nr.kb_id
		LEFT JOIN kb_releases kr ON kr.id = krnr.release_id
		WHERE nr.kb_id = ? AND nr.node_id = ?
		ORDER BY nr.updated_at DESC`, kbID, nodeID).Scan(&items).Error
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *NodeRepository) ListNodeReleases(ctx context.Context, kbID, nodeID string, offset, limit int) ([]*domain.NodeRelease, int64, error) {
	var total int64
	query := r.db.WithContext(ctx).
		Model(&domain.NodeRelease{}).
		Where("kb_id = ? AND node_id = ?", kbID, nodeID)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	releases := make([]*domain.NodeRelease, 0)
	if err := query.
		Order("updated_at DESC").
		Offset(offset).
		Limit(limit).
		Find(&releases).Error; err != nil {
		return nil, 0, err
	}
	return releases, total, nil
}

func (r *NodeRepository) GetLatestNodeReleaseWithPublishAccount(ctx context.Context, nodeID string) (*domain.NodeReleaseWithPublisher, error) {
	var nodeRelease *domain.NodeReleaseWithPublisher
	if err := r.db.WithContext(ctx).
		Model(&domain.NodeRelease{}).
		Select("node_releases.id, node_releases.publisher_id, users.account as publisher_account").
		Joins("left join users on users.id = node_releases.publisher_id").
		Where("node_releases.node_id = ?", nodeID).
		Order("node_releases.updated_at DESC").
		Find(&nodeRelease).Error; err != nil {
		return nil, err
	}
	return nodeRelease, nil
}

// GetNodeReleaseWithDirPathByID gets a node release by ID and includes its directory path
func (r *NodeRepository) GetNodeReleaseWithDirPathByID(ctx context.Context, id string) (*domain.NodeReleaseWithDirPath, error) {
	// First get the node release
	var nodeRelease *domain.NodeRelease
	if err := r.db.WithContext(ctx).
		Model(&domain.NodeRelease{}).
		Where("id = ?", id).
		First(&nodeRelease).Error; err != nil {
		return nil, err
	}
	// don't build path for folders
	if nodeRelease != nil && nodeRelease.Type == domain.NodeTypeFolder {
		return &domain.NodeReleaseWithDirPath{
			NodeRelease: nodeRelease,
		}, nil
	}

	// Build the directory path
	path, err := r.buildNodePath(ctx, nodeRelease.KBID, nodeRelease)
	if err != nil {
		r.logger.Error("failed to build node path", log.String("id", id), log.Error(err))
	}

	// Return the extended struct with path information
	return &domain.NodeReleaseWithDirPath{
		NodeRelease: nodeRelease,
		Path:        path,
	}, nil
}

func (r *NodeRepository) GetNodeReleasesByDocIDs(ctx context.Context, ids []string) (map[string]*domain.NodeRelease, error) {
	var nodeReleases []*domain.NodeRelease
	if err := r.db.WithContext(ctx).
		Model(&domain.NodeRelease{}).
		Where("doc_id IN ?", ids).
		Find(&nodeReleases).Error; err != nil {
		return nil, err
	}
	nodesMap := make(map[string]*domain.NodeRelease)
	for _, nodeRelease := range nodeReleases {
		nodesMap[nodeRelease.DocID] = nodeRelease
	}
	return nodesMap, nil
}

// NodeReleaseWithPath represents a node release with path information
type NodeReleaseWithPath struct {
	*domain.NodeRelease
	PathIDs   []string `json:"path_ids"`
	PathNames []string `json:"path_names"`
	Depth     int      `json:"depth"`
}

// GetNodeReleasesWithPathsByDocIDs retrieving node releases with path information
func (r *NodeRepository) GetNodeReleasesWithPathsByDocIDs(ctx context.Context, ids []string) (map[string]*NodeReleaseWithPath, error) {
	if len(ids) == 0 {
		return make(map[string]*NodeReleaseWithPath), nil
	}

	// 1. 查询节点基本信息
	var nodeReleases []*domain.NodeRelease
	if err := r.db.WithContext(ctx).
		Model(&domain.NodeRelease{}).
		Where("doc_id IN ?", ids).
		Find(&nodeReleases).Error; err != nil {
		return nil, err
	}

	if len(nodeReleases) == 0 {
		return make(map[string]*NodeReleaseWithPath), nil
	}

	docIDs := lo.Map(nodeReleases, func(release *domain.NodeRelease, i int) string {
		return release.DocID
	})

	// 2. 批量查询路径
	paths, err := r.getNodePathsBatch(ctx, docIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to get paths: %w", err)
	}

	// 3. 组装结果
	result := make(map[string]*NodeReleaseWithPath, len(nodeReleases))
	for _, nr := range nodeReleases {
		nrWithPath := &NodeReleaseWithPath{
			NodeRelease: nr,
		}

		if path, ok := paths[nr.DocID]; ok {
			nrWithPath.PathIDs = path.PathIDs
			nrWithPath.PathNames = path.PathNames
			nrWithPath.Depth = path.Depth
		}

		result[nr.DocID] = nrWithPath
	}

	return result, nil
}

// NodePathInfo contains path information for a node
type NodePathInfo struct {
	DocID     string
	PathIDs   []string
	PathNames []string
	Depth     int
}

// getNodePathsBatch batch query node paths
func (r *NodeRepository) getNodePathsBatch(ctx context.Context, docIDs []string) (map[string]*NodePathInfo, error) {
	type pathResult struct {
		DocID     string         `gorm:"column:doc_id"`
		PathIDs   pq.StringArray `gorm:"column:path_ids;type:text[]"`
		PathNames pq.StringArray `gorm:"column:path_names;type:text[]"`
		Depth     int            `gorm:"column:depth"`
	}

	var results []pathResult

	query := `
		WITH RECURSIVE node_paths AS (
			SELECT
				node_id,
				parent_id,
				name,
				doc_id as root_doc_id,
				ARRAY[node_id] as path_ids,
				ARRAY[name] as path_names,
				1 as depth
			FROM node_releases
			WHERE doc_id = ANY($1)

			UNION ALL

			SELECT
				n.node_id,
				n.parent_id,
				n.name,
				np.root_doc_id,
				n.node_id || np.path_ids,
				n.name || np.path_names,
				np.depth + 1
			FROM node_releases n
			INNER JOIN node_paths np ON n.node_id = np.parent_id
			WHERE np.depth < 20 AND n.doc_id != ''
		)
		SELECT
			root_doc_id as doc_id,
			path_ids,
			path_names,
			depth
		FROM node_paths
		WHERE parent_id IS NULL OR parent_id = ''
	`

	if err := r.db.WithContext(ctx).
		Raw(query, pq.Array(docIDs)).
		Scan(&results).Error; err != nil {
		return nil, err
	}

	// 转换为map
	pathMap := make(map[string]*NodePathInfo, len(results))
	for _, res := range results {
		pathMap[res.DocID] = &NodePathInfo{
			DocID:     res.DocID,
			PathIDs:   res.PathIDs,
			PathNames: res.PathNames,
			Depth:     res.Depth,
		}
	}

	return pathMap, nil
}

// GetRecommendNodeListByIDs get node list by ids
func (r *NodeRepository) GetRecommendNodeListByIDs(ctx context.Context, kbID string, releaseID string, ids []string) ([]*domain.RecommendNodeListResp, error) {
	var nodes []*domain.RecommendNodeListResp
	if err := r.db.WithContext(ctx).
		Model(&domain.KBReleaseNodeRelease{}).
		Joins("LEFT JOIN node_releases ON node_releases.id = kb_release_node_releases.node_release_id").
		Joins("LEFT JOIN nodes ON nodes.id = node_releases.node_id").
		Where("node_releases.kb_id = ?", kbID).
		Where("kb_release_node_releases.release_id = ?", releaseID).
		Where("node_releases.node_id IN ?", ids).
		Select("node_releases.node_id as id, node_releases.name, node_releases.type, node_releases.meta->>'summary' as summary, node_releases.meta->>'emoji' as emoji, node_releases.parent_id, node_releases.position, nodes.permissions").
		Find(&nodes).Error; err != nil {
		return nil, err
	}
	return nodes, nil
}

// GetRecommendNodeListByNavIDs get node list by nav ids
func (r *NodeRepository) GetRecommendNodeListByNavIDs(ctx context.Context, kbID string, releaseID string, navIds []string) ([]*domain.RecommendNodeListResp, error) {
	var nodes []*domain.RecommendNodeListResp
	if err := r.db.WithContext(ctx).
		Model(&domain.KBReleaseNodeRelease{}).
		Joins("LEFT JOIN node_releases ON node_releases.id = kb_release_node_releases.node_release_id").
		Joins("LEFT JOIN nodes ON nodes.id = node_releases.node_id").
		Where("node_releases.kb_id = ?", kbID).
		Where("kb_release_node_releases.release_id = ?", releaseID).
		Where("nodes.nav_id IN ?", navIds).
		Select("node_releases.node_id as id, node_releases.name, node_releases.type, node_releases.meta->>'summary' as summary, node_releases.meta->>'emoji' as emoji, node_releases.parent_id, node_releases.position, nodes.permissions, nodes.nav_id").
		Order("node_releases.position ASC").
		Find(&nodes).Error; err != nil {
		return nil, err
	}
	return nodes, nil
}

func (r *NodeRepository) GetRecommendNodeListByParentIDs(ctx context.Context, kbID string, releaseID string, parentIDs []string) (map[string][]*domain.RecommendNodeListResp, error) {
	var nodes []*domain.RecommendNodeListResp
	if err := r.db.WithContext(ctx).
		Model(&domain.KBReleaseNodeRelease{}).
		Joins("LEFT JOIN node_releases ON node_releases.id = kb_release_node_releases.node_release_id").
		Joins("LEFT JOIN nodes ON nodes.id = node_releases.node_id").
		Where("node_releases.kb_id = ?", kbID).
		Where("kb_release_node_releases.release_id = ?", releaseID).
		Where("node_releases.parent_id IN ?", parentIDs).
		Where("node_releases.type != ?", domain.NodeTypeFolder).
		Select("node_releases.node_id as id, node_releases.name, node_releases.type, node_releases.meta->>'summary' as summary, node_releases.meta->>'emoji' as emoji, node_releases.parent_id, node_releases.position, nodes.permissions").
		Find(&nodes).Error; err != nil {
		return nil, err
	}
	nodesMap := make(map[string][]*domain.RecommendNodeListResp)
	for _, node := range nodes {
		if _, ok := nodesMap[node.ParentID]; !ok {
			nodesMap[node.ParentID] = make([]*domain.RecommendNodeListResp, 0)
		}
		nodesMap[node.ParentID] = append(nodesMap[node.ParentID], node)
	}
	return nodesMap, nil
}

// GetNodeReleaseListByKBID get node list by kb id；lang 非空时仅返回该语言的文档
func (r *NodeRepository) GetNodeReleaseListByKBID(ctx context.Context, kbID string, lang string) ([]*domain.ShareNodeListItemResp, error) {
	// get kb release
	var kbRelease *domain.KBRelease
	if err := r.db.WithContext(ctx).
		Model(&domain.KBRelease{}).
		Where("kb_id = ?", kbID).
		Order("created_at DESC").
		First(&kbRelease).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	var nodes []*domain.ShareNodeListItemResp
	qs := r.db.WithContext(ctx).
		Model(&domain.KBReleaseNodeRelease{}).
		Joins("LEFT JOIN node_releases ON node_releases.id = kb_release_node_releases.node_release_id").
		Joins("LEFT JOIN nodes ON nodes.id = kb_release_node_releases.node_id").
		Joins("LEFT JOIN kenfut_content_releases kcr ON kcr.node_release_id = node_releases.id").
		Where("kb_release_node_releases.kb_id = ?", kbID).
		Where("kb_release_node_releases.release_id = ?", kbRelease.ID).
		Where("nodes.permissions->>'visible' != ?", consts.NodeAccessPermClosed).
		Where("COALESCE(kcr.metadata->>'channel','docs') IN ('docs','both')")
	if lang != "" {
		// 文件夹是各语言共享的结构容器（lang 恒为默认值），不参与语言过滤
		qs = qs.Where("nodes.type = ? OR nodes.lang = ?", domain.NodeTypeFolder, lang)
	}
	qs = qs.Select("node_releases.node_id as id, node_releases.name, node_releases.type, node_releases.parent_id, node_releases.position, node_releases.meta->>'emoji' as emoji, node_releases.updated_at, nodes.permissions, node_releases.meta, kb_release_node_releases.nav_id")

	if err := qs.Find(&nodes).Error; err != nil {
		return nil, err
	}
	return nodes, nil
}

func (r *NodeRepository) GetNodeReleaseDetailByKBIDAndID(ctx context.Context, kbID, id string) (*shareV1.ShareNodeDetailResp, error) {
	// get kb release
	var kbRelease *domain.KBRelease
	if err := r.db.WithContext(ctx).
		Model(&domain.KBRelease{}).
		Where("kb_id = ?", kbID).
		Order("created_at DESC").
		First(&kbRelease).Error; err != nil {
		return nil, err
	}

	var node *shareV1.ShareNodeDetailResp
	if err := r.db.WithContext(ctx).
		Model(&domain.KBReleaseNodeRelease{}).
		Select("node_releases.node_id AS id,node_releases.kb_id,node_releases.type,2 AS status,node_releases.name,node_releases.content,node_releases.meta,node_releases.parent_id,node_releases.created_at,node_releases.updated_at,node_releases.publisher_id,node_releases.editor_id,nodes.permissions,nodes.creator_id").
		Joins("LEFT JOIN node_releases ON node_releases.id = kb_release_node_releases.node_release_id").
		Joins("LEFT JOIN nodes ON nodes.id = kb_release_node_releases.node_id").
		Where("kb_release_node_releases.release_id = ?", kbRelease.ID).
		Where("node_releases.node_id = ?", id).
		Where("node_releases.kb_id = ?", kbID).
		First(&node).Error; err != nil {
		return nil, err
	}
	return node, nil
}

func (r *NodeRepository) MoveNodeBetween(ctx context.Context, id, parentID, prevID, nextID, kbId string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var prevPos, maxPos float64 = 0, domain.MaxPosition
		if prevID != "" {
			var prevNode *domain.Node
			if err := tx.Model(&domain.Node{}).
				Where("id = ?", prevID).
				Where("kb_id = ?", kbId).
				Where("parent_id = ?", parentID).
				Select("position, parent_id").
				First(&prevNode).Error; err != nil {
				return err
			}
			prevPos = prevNode.Position
		}
		if nextID != "" {
			var nextNode *domain.Node
			if err := tx.Model(&domain.Node{}).
				Where("id = ?", nextID).
				Where("parent_id = ?", parentID).
				Where("kb_id = ?", kbId).
				Select("position, parent_id").
				First(&nextNode).Error; err != nil {
				return err
			}
			maxPos = nextNode.Position
		}

		node, err := r.GetNodeByID(ctx, id)
		if err != nil {
			return err
		}

		newPos := prevPos + (maxPos-prevPos)/2.0
		if newPos-prevPos < domain.MinPositionGap {
			if err := r.reorderPositionsByParentID(tx, node.KBID, parentID); err != nil {
				return err
			}
		}

		querySet := tx.Model(&domain.Node{}).Where("id = ?", id).Update("position", newPos).Update("parent_id", parentID)

		if node.Status == domain.NodeStatusPublished {
			querySet = querySet.Update("status", domain.NodeStatusDraft)
		}

		return querySet.Error
	})
}

// UpdateNodeDocID update node doc id
func (r *NodeRepository) UpdateNodeDocID(ctx context.Context, id, docID string) error {
	return r.db.WithContext(ctx).
		Model(&domain.Node{}).
		Omit("updated_at").
		Where("id = ?", id).
		Updates(map[string]any{
			"doc_id": docID,
		}).Error
}

// UpdateNodeReleaseDocID update node release doc id
func (r *NodeRepository) UpdateNodeReleaseDocID(ctx context.Context, id, docID string) error {
	return r.db.WithContext(ctx).
		Model(&domain.NodeRelease{}).
		Omit("updated_at").
		Where("id = ?", id).
		Updates(map[string]any{
			"doc_id": docID,
		}).Error
}

func (r *NodeRepository) UpdateNodeSummary(ctx context.Context, kbID, nodeID, summary, contentKey, requestID string) error {
	metaExpr := "jsonb_set(COALESCE(meta, '{}'::jsonb), '{summary}', to_jsonb(?::text))"
	args := []any{summary}
	if contentKey != "" {
		metaExpr = "jsonb_set(" + metaExpr + ", '{last_summary_content_key}', to_jsonb(?::text))"
		args = append(args, contentKey)
	}
	if requestID != "" {
		metaExpr = "jsonb_set(" + metaExpr + ", '{last_summary_request_id}', to_jsonb(?::text))"
		args = append(args, requestID)
	}
	return r.db.WithContext(ctx).
		Model(&domain.Node{}).
		Where("kb_id = ? AND id = ?", kbID, nodeID).
		Updates(map[string]any{
			"meta":   gorm.Expr(metaExpr, args...),
			"status": gorm.Expr("CASE WHEN status = ? THEN ? ELSE status END", domain.NodeStatusPublished, domain.NodeStatusDraft),
		}).Error
}

func (r *NodeRepository) UpdateNodeReleaseVectorState(ctx context.Context, id, contentKey, requestID string) error {
	metaExpr := "COALESCE(meta, '{}'::jsonb)"
	args := make([]any, 0, 2)
	if contentKey != "" {
		metaExpr = "jsonb_set(" + metaExpr + ", '{last_vector_content_key}', to_jsonb(?::text))"
		args = append(args, contentKey)
	}
	if requestID != "" {
		metaExpr = "jsonb_set(" + metaExpr + ", '{last_vector_request_id}', to_jsonb(?::text))"
		args = append(args, requestID)
	}
	if len(args) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).
		Model(&domain.NodeRelease{}).
		Omit("updated_at").
		Where("id = ?", id).
		Updates(map[string]any{
			"meta": gorm.Expr(metaExpr, args...),
		}).Error
}

func (r *NodeRepository) IsLatestNodeRelease(ctx context.Context, nodeID, nodeReleaseID string) (bool, error) {
	var latestID string
	if err := r.db.WithContext(ctx).
		Model(&domain.NodeRelease{}).
		Where("node_id = ?", nodeID).
		Order("updated_at DESC").
		Limit(1).
		Pluck("id", &latestID).Error; err != nil {
		return false, err
	}
	return latestID == nodeReleaseID, nil
}

func (r *NodeRepository) UpdateNodeStatus(ctx context.Context, kbID, nodeID string, nodeStatus domain.NodeStatus) error {
	return r.db.WithContext(ctx).
		Model(&domain.Node{}).
		Where("kb_id = ? AND id = ?", kbID, nodeID).
		Updates(map[string]any{
			"status": nodeStatus,
		}).Error
}

// traverse all nodes by pg cursor
func (r *NodeRepository) TraverseNodesByCursor(ctx context.Context, callback func(*domain.NodeRelease) error) error {
	rows, err := r.db.WithContext(ctx).
		Model(&domain.NodeRelease{}).
		Select("DISTINCT ON (node_id) id, node_id, kb_id").
		Order("node_id, updated_at DESC").
		Rows()
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var nodeRelease domain.NodeRelease
		if err := r.db.ScanRows(rows, &nodeRelease); err != nil {
			return err
		}
		if err := callback(&nodeRelease); err != nil {
			return err
		}
	}

	if err := rows.Err(); err != nil {
		return err
	}

	return nil
}

// CreateNodeReleases create node releases
func (r *NodeRepository) CreateNodeReleases(ctx context.Context, kbID, userId string, nodeIDs []string) ([]string, error) {
	releaseIDs := make([]string, 0)
	if err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// update node status to published and return node ids
		var updatedNodes []*domain.Node
		if err := tx.Model(&domain.Node{}).
			Where("kb_id = ?", kbID).
			Where("id IN ?", nodeIDs).
			Update("status", domain.NodeStatusPublished).
			Find(&updatedNodes).Error; err != nil {
			return err
		}
		if len(updatedNodes) == 0 {
			return nil
		}
		nodeReleases := make([]*domain.NodeRelease, len(updatedNodes))
		for i, updatedNode := range updatedNodes {
			// create node release
			nodeRelease := &domain.NodeRelease{
				ID:          uuid.New().String(),
				KBID:        kbID,
				PublisherId: userId,
				EditorId:    updatedNode.EditorId,
				NodeID:      updatedNode.ID,
				Type:        updatedNode.Type,
				Name:        updatedNode.Name,
				Meta:        updatedNode.Meta,
				Content:     updatedNode.Content,
				ParentID:    updatedNode.ParentID,
				Position:    updatedNode.Position,
				CreatedAt:   updatedNode.CreatedAt,
				UpdatedAt:   time.Now(),
			}
			nodeReleases[i] = nodeRelease
			releaseIDs = append(releaseIDs, nodeRelease.ID)
		}

		if err := tx.CreateInBatches(&nodeReleases, 100).Error; err != nil {
			return err
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return releaseIDs, nil
}

func (r *NodeRepository) GetOldNodeDocIDsByNodeID(ctx context.Context, nodeReleaseID, nodeID string) ([]string, error) {
	var docIDs []string
	if err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// get old doc_ids by node_id
		if err := tx.Model(&domain.NodeRelease{}).
			Where("node_id = ?", nodeID).
			Where("id != ?", nodeReleaseID).
			Where("updated_at <= (SELECT updated_at FROM node_releases WHERE id = ?)", nodeReleaseID).
			Where("doc_id != ''").
			Select("doc_id").
			Find(&docIDs).Error; err != nil {
			return err
		}
		// update node_release.doc_id to ""
		if err := tx.Model(&domain.NodeRelease{}).
			Where("node_id = ?", nodeID).
			Where("id != ?", nodeReleaseID).
			Where("updated_at <= (SELECT updated_at FROM node_releases WHERE id = ?)", nodeReleaseID).
			Omit("updated_at").
			Update("doc_id", "").Error; err != nil {
			return err
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return docIDs, nil
}

func (r *NodeRepository) MoveNodeNav(ctx context.Context, kbID, navID string, nodeIDs []string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		allIDs := r.collectAllChildNodeIDs(tx, kbID, nodeIDs)
		if err := tx.Model(&domain.Node{}).
			Where("kb_id = ? AND id IN ?", kbID, allIDs).
			Update("nav_id", navID).Error; err != nil {
			return err
		}

		if err := tx.Model(&domain.Node{}).
			Where("kb_id = ? AND id IN ?", kbID, allIDs).
			Where("parent_id != ''").
			Where("parent_id NOT IN ?", allIDs).
			Update("parent_id", "").Error; err != nil {
			return err
		}

		if err := tx.Model(&domain.Node{}).
			Where("kb_id = ? AND id IN ?", kbID, allIDs).
			Where("status = ?", domain.NodeStatusPublished).
			Update("status", domain.NodeStatusDraft).Error; err != nil {
			return err
		}
		return nil
	})
}

func (r *NodeRepository) BatchMove(ctx context.Context, req *domain.BatchMoveReq) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// update node parent_id
		if err := tx.WithContext(ctx).Model(&domain.Node{}).
			Where("kb_id = ?", req.KBID).
			Where("id IN ?", req.IDs).
			Update("parent_id", req.ParentID).
			Error; err != nil {
			return err
		}
		if err := tx.WithContext(ctx).Model(&domain.Node{}).
			Where("kb_id = ?", req.KBID).
			Where("id IN ?", req.IDs).
			Where("status = ?", domain.NodeStatusPublished).
			Update("status", domain.NodeStatusDraft).
			Error; err != nil {
			return err
		}
		return nil
	})
}

// reorderPositionsByParentID 重排所给父节点下的所有子节点
func (r *NodeRepository) reorderPositionsByParentID(tx *gorm.DB, kbID, parentID string) error {
	var nodes []*domain.Node
	if parentID == "" {
		if err := tx.Model(&domain.Node{}).
			Where("kb_id = ?", kbID).
			Where("parent_id IS NULL OR parent_id = ''").
			Order("position").
			Find(&nodes).Error; err != nil {
			return err
		}
	} else {
		if err := tx.Model(&domain.Node{}).
			Where("kb_id = ?", kbID).
			Where("parent_id = ?", parentID).
			Order("position").
			Find(&nodes).Error; err != nil {
			return err
		}
	}
	return r.reorderPositions(tx, nodes)
}

// reorderPositions 重排所给节点
func (r *NodeRepository) reorderPositions(tx *gorm.DB, nodes []*domain.Node) error {
	if len(nodes) == 0 {
		return nil
	}

	basePosition := int64(1000) // 起始位置
	interval := int64(1000)     // 间隔

	updates := make([]map[string]interface{}, len(nodes))
	for i, node := range nodes {
		newPosition := float64(basePosition + int64(i)*interval)
		updates[i] = map[string]interface{}{
			"id":       node.ID,
			"position": newPosition,
		}
	}

	batchSize := 300
	for i := 0; i < len(updates); i += batchSize {
		end := i + batchSize
		if end > len(updates) {
			end = len(updates)
		}
		batch := updates[i:end]

		values := make([]string, 0, len(batch))
		for _, update := range batch {
			id := update["id"]
			pos := update["position"]
			values = append(values, fmt.Sprintf("('%v', %v)", id, pos))
		}

		sql := fmt.Sprintf("UPDATE nodes SET position = new_values.new_value FROM (VALUES %s) AS new_values(id, new_value) WHERE nodes.id = new_values.id", strings.Join(values, ", "))

		if err := tx.Exec(sql).Error; err != nil {
			return err
		}
	}

	return nil
}

// GetNodeIDsByReleaseID get node IDs by release ID
func (r *NodeRepository) GetNodeIDsByReleaseID(ctx context.Context, releaseID string) ([]string, error) {
	var nodeIDs []string
	if err := r.db.WithContext(ctx).
		Model(&domain.KBReleaseNodeRelease{}).
		Where("release_id = ?", releaseID).
		Select("node_id").
		Find(&nodeIDs).Error; err != nil {
		return nil, err
	}
	return nodeIDs, nil
}
func (r *NodeRepository) UpdateNodeByKbID(ctx context.Context, id, kbId string, updateMap map[string]interface{}) error {
	return r.db.WithContext(ctx).
		Model(&domain.Node{}).
		Where("id = ?", id).
		Where("kb_id = ?", kbId).
		Updates(updateMap).Error
}

func (r *NodeRepository) UpdateNodesByKbID(ctx context.Context, ids []string, kbId string, updateMap map[string]interface{}) error {
	const batchSize = 500 // 批处理大小，避免IN子句过长

	// 如果没有ID需要更新，直接返回
	if len(ids) == 0 {
		return nil
	}

	// 分批处理
	for i := 0; i < len(ids); i += batchSize {
		end := i + batchSize
		if end > len(ids) {
			end = len(ids)
		}

		batch := ids[i:end]
		if err := r.db.WithContext(ctx).
			Model(&domain.Node{}).
			Where("id in (?)", batch).
			Where("kb_id = ?", kbId).
			Updates(updateMap).Error; err != nil {
			return err
		}
	}

	return nil
}

func (r *NodeRepository) UpdateNodeGroupByKbIDAndNodeIds(ctx context.Context, nodeIds []string, groupIds []int, perm consts.NodePermName) error {
	const batchSize = 1000 // 批处理大小，避免IN子句过长

	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 分批删除现有的权限记录，防止nodeIds过长
		for i := 0; i < len(nodeIds); i += batchSize {
			end := i + batchSize
			if end > len(nodeIds) {
				end = len(nodeIds)
			}

			batch := nodeIds[i:end]
			if err := tx.Model(&domain.NodeAuthGroup{}).
				Where("node_id in (?) AND perm = ?", batch, perm).
				Delete(&domain.NodeAuthGroup{}).Error; err != nil {
				return err
			}
		}

		// 如果 groupIds 为空，则只执行删除操作
		if len(groupIds) == 0 {
			return nil
		}

		nodeGroups := make([]domain.NodeAuthGroup, 0)
		for i := range nodeIds {
			// 批量插入新的数据
			for index := range groupIds {
				if groupIds[index] == 0 {
					continue
				}
				nodeGroups = append(nodeGroups, domain.NodeAuthGroup{
					NodeID:      nodeIds[i],
					AuthGroupID: groupIds[index],
					Perm:        perm,
				})
			}
		}

		if len(nodeGroups) != 0 {
			if err := tx.Model(&domain.NodeAuthGroup{}).CreateInBatches(&nodeGroups, 100).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *NodeRepository) GetNodeGroupByNodeId(ctx context.Context, nodeId string) ([]domain.NodeGroupDetail, error) {
	nodeGroup := make([]domain.NodeGroupDetail, 0)
	if err := r.db.WithContext(ctx).
		Model(&domain.NodeAuthGroup{}).
		Select("node_auth_groups.node_id, node_auth_groups.auth_group_id, node_auth_groups.perm, auth_groups.name, auth_groups.kb_id, auth_groups.auth_ids").
		Joins("left join auth_groups on auth_groups.id = node_auth_groups.auth_group_id").
		Where("node_auth_groups.node_id = ?", nodeId).
		Scan(&nodeGroup).Error; err != nil {
		return nil, err
	}
	return nodeGroup, nil
}

func (r *NodeRepository) Update(ctx context.Context, id string, m map[string]interface{}) error {
	return r.db.WithContext(ctx).Model(domain.Node{}).Where("id = ?", id).Updates(m).Error
}

func (r *NodeRepository) GetNodeIdByDocId(ctx context.Context, docId string) (string, error) {
	nodeIds := make([]string, 0)
	if err := r.db.WithContext(ctx).Model(domain.NodeRelease{}).
		Where("doc_id = ?", docId).
		Pluck("node_id", &nodeIds).Error; err != nil {
		return "", err
	}
	if len(nodeIds) < 1 {
		return "", fmt.Errorf("node not found for doc_id: %s", docId)
	}
	return nodeIds[0], nil
}

func (r *NodeRepository) GetNodeIdsWithoutStatusByKbId(ctx context.Context, kbId string) ([]string, error) {
	docIds := make([]string, 0)
	if err := r.db.WithContext(ctx).
		Model(&domain.Node{}).
		Joins("left join node_releases on node_releases.node_id = nodes.id").
		Where("(nodes.rag_info ->> 'status' IS NULL OR nodes.rag_info ->> 'status' = '')").
		Where("nodes.kb_id = ? ", kbId).
		Where("nodes.type = ? ", domain.NodeTypeDocument).
		Where("node_releases.doc_id != '' ").
		Pluck("node_releases.doc_id", &docIds).Error; err != nil {
		return nil, err
	}
	return docIds, nil
}

// GetNodeIdsByDocIds 批量获取 doc_id 到 node_id 的映射
func (r *NodeRepository) GetNodeIdsByDocIds(ctx context.Context, docIds []string) (map[string]string, error) {
	if len(docIds) == 0 {
		return make(map[string]string), nil
	}

	type Result struct {
		DocID  string `gorm:"column:doc_id"`
		NodeID string `gorm:"column:node_id"`
	}

	results := make([]Result, 0)
	if err := r.db.WithContext(ctx).
		Model(&domain.NodeRelease{}).
		Select("doc_id, node_id").
		Where("doc_id IN (?)", docIds).
		Find(&results).Error; err != nil {
		return nil, err
	}

	// 构建 doc_id -> node_id 的映射
	docToNodeMap := make(map[string]string, len(results))
	for _, result := range results {
		docToNodeMap[result.DocID] = result.NodeID
	}

	return docToNodeMap, nil
}

func (r *NodeRepository) DeleteOldNodeReleaseBackups(ctx context.Context, before time.Time) error {
	return r.db.WithContext(ctx).
		Where("deleted_at < ?", before).
		Delete(&domain.NodeReleaseBackup{}).Error
}

func (r *NodeRepository) GetNodeCount(ctx context.Context) (int, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&domain.Node{}).
		Count(&count).Error
	if err != nil {
		return 0, err
	}
	return int(count), nil
}

func (r *NodeRepository) CountNodeByNavId(ctx context.Context, kbId, navId string) (int64, error) {
	var count int64
	if err := r.db.WithContext(ctx).
		Model(&domain.Node{}).
		Where("kb_id = ?", kbId).
		Where("nav_id = ?", navId).
		Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

func (r *NodeRepository) GetNodeIDsByNavId(ctx context.Context, kbId, navId string) ([]string, error) {
	var ids []string
	if err := r.db.WithContext(ctx).
		Model(&domain.Node{}).
		Where("kb_id = ? AND nav_id = ?", kbId, navId).
		Pluck("id", &ids).Error; err != nil {
		return nil, err
	}
	return ids, nil
}

func (r *NodeRepository) GetNodeListByStatus(ctx context.Context, kbId, status, search string) ([]*domain.NodeListItemResp, error) {
	var nodes []*domain.NodeListItemResp
	query := r.db.WithContext(ctx).
		Model(&domain.Node{}).
		Joins("LEFT JOIN users cu ON nodes.creator_id = cu.id").
		Joins("LEFT JOIN users eu ON nodes.editor_id = eu.id").
		Where("nodes.kb_id = ?", kbId).
		Select("cu.account AS creator, eu.account AS editor, nodes.editor_id, nodes.nav_id, nodes.rag_info, nodes.creator_id, nodes.id, nodes.permissions, nodes.type, nodes.status, nodes.name, nodes.parent_id, nodes.position, nodes.created_at, nodes.edit_time as updated_at, nodes.meta->>'summary' as summary, nodes.meta->>'emoji' as emoji, nodes.meta->>'content_type' as content_type, nodes.lang, nodes.translation_group_id")

	if search != "" {
		searchPattern := "%" + search + "%"
		query = query.Where("name LIKE ? OR content LIKE ?", searchPattern, searchPattern)
	}

	switch status {
	// 发布后允许可配置的
	case "released":
		query = query.Where("nodes.status IN ?", []domain.NodeStatus{domain.NodeStatusDraft, domain.NodeStatusPublished})
	case "unpublished":
		query = query.Where("nodes.status IN ?", []domain.NodeStatus{domain.NodeStatusUnreleased, domain.NodeStatusDraft})
	case "unstudied":
		query = query.Where("nodes.type = ?", domain.NodeTypeDocument).
			Where("nodes.rag_info->>'status' NOT IN ? OR nodes.rag_info->>'status' IS NULL",
				[]string{string(consts.NodeRagStatusSucceeded), string(consts.NodeRagStatusRunning), string(consts.NodeRagStatusReindexing)})
	}

	if err := query.Find(&nodes).Error; err != nil {
		return nil, err
	}
	return nodes, nil
}

func (r *NodeRepository) GetNodeStats(ctx context.Context, kbId string) (*v1.NodeStatsResp, error) {
	var stats v1.NodeStatsResp

	// Count unpublished documents (status = 0 or 1)
	unpublishedQuery := r.db.WithContext(ctx).
		Model(&domain.Node{}).
		Where("kb_id = ? AND status IN ?", kbId, []domain.NodeStatus{domain.NodeStatusUnreleased, domain.NodeStatusDraft})

	if err := unpublishedQuery.Count(&stats.UnpublishedCount).Error; err != nil {
		return nil, err
	}

	studiedStatuses := []consts.NodeRagInfoStatus{
		consts.NodeRagStatusSucceeded,
		consts.NodeRagStatusRunning,
		consts.NodeRagStatusReindexing,
	}

	unstudiedQuery := r.db.WithContext(ctx).
		Model(&domain.Node{}).
		Where("kb_id = ?", kbId).
		Where("nodes.type = ?", domain.NodeTypeDocument).
		Where("rag_info->>'status' NOT IN ? OR rag_info->>'status' IS NULL", studiedStatuses)

	if err := unstudiedQuery.Count(&stats.UnstudiedCount).Error; err != nil {
		return nil, err
	}

	return &stats, nil
}
