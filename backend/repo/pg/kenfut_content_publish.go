package pg

import (
	"context"
	"errors"
	stdhtml "html"
	"strings"
	"time"

	"github.com/gomarkdown/markdown"
	"github.com/google/uuid"
	"github.com/microcosm-cc/bluemonday"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/chaitin/panda-wiki/domain"
)

// PublishContentRelease commits body snapshots, extension snapshots and the public
// manifest together. Unselected drafts never enter a later manifest by accident.
func (r *KnowledgeBaseRepository) PublishContentRelease(ctx context.Context, release *domain.KBRelease, userID string, nodeIDs []string) ([]string, error) {
	created := []string{}
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var kb domain.KnowledgeBase
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", release.KBID).First(&kb).Error; err != nil {
			return err
		}
		// Use the database clock after acquiring the per-site lock. Request start
		// times can be out of order when different publishers wait for this lock.
		if err := tx.Raw("SELECT clock_timestamp()").Scan(&release.CreatedAt).Error; err != nil {
			return err
		}
		manifest, err := currentContentManifest(tx, release.KBID)
		if err != nil {
			return err
		}
		var nodes []domain.Node
		if len(nodeIDs) > 0 {
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("kb_id = ? AND id IN ?", release.KBID, nodeIDs).Find(&nodes).Error; err != nil {
				return err
			}
		}
		if len(nodes) != len(uniquePublishIDs(nodeIDs)) {
			return gorm.ErrRecordNotFound
		}
		for _, node := range nodes {
			snapshot := domain.NodeRelease{ID: uuid.NewString(), KBID: release.KBID, PublisherId: userID, EditorId: node.EditorId, NodeID: node.ID, Type: node.Type, Name: node.Name, Meta: node.Meta, Content: node.Content, ParentID: node.ParentID, Position: node.Position, CreatedAt: node.CreatedAt, UpdatedAt: release.CreatedAt}
			if err := tx.Create(&snapshot).Error; err != nil {
				return err
			}
			if err := snapshotContentMetadata(tx, node, snapshot); err != nil {
				return err
			}
			if node.Type == domain.NodeTypeDocument {
				if err := tx.Exec("INSERT INTO kenfut_rag_outbox(node_release_id,kb_id,created_at) VALUES(?,?,?)", snapshot.ID, snapshot.KBID, snapshot.UpdatedAt).Error; err != nil {
					return err
				}
			}
			if err := tx.Model(&domain.Node{}).Where("id = ? AND kb_id = ?", node.ID, node.KBID).Update("status", domain.NodeStatusPublished).Error; err != nil {
				return err
			}
			manifest[node.ID] = domain.KBReleaseNodeRelease{NodeID: node.ID, NodeReleaseID: snapshot.ID, NavID: node.NavId}
			created = append(created, snapshot.ID)
		}
		if err := tx.Create(release).Error; err != nil {
			return err
		}
		if err := writeContentManifest(tx, release, manifest); err != nil {
			return err
		}
		return snapshotContentNavs(tx, release)
	})
	return created, err
}

func (r *KnowledgeBaseRepository) PendingKenFutRAG(ctx context.Context, limit int) ([]*domain.NodeReleaseVectorRequest, error) {
	if limit < 1 || limit > 1000 {
		limit = 100
	}
	// Superseded/deleted versions must never be replayed over the current vector
	// document. An outbox row alone is not proof that its snapshot is still public.
	current := "EXISTS (SELECT 1 FROM kb_release_node_releases m WHERE m.node_release_id=task.node_release_id AND m.kb_id=task.kb_id AND m.release_id=(SELECT id FROM kb_releases WHERE kb_id=task.kb_id ORDER BY created_at DESC,id DESC LIMIT 1))"
	if err := r.db.WithContext(ctx).Exec("DELETE FROM kenfut_rag_outbox task WHERE NOT " + current).Error; err != nil {
		return nil, err
	}
	rows := []*domain.NodeReleaseVectorRequest{}
	err := r.db.WithContext(ctx).Table("kenfut_rag_outbox task").Select("task.kb_id,task.node_release_id,'upsert' AS action").Where(current).Order("task.created_at ASC,task.node_release_id ASC").Limit(limit).Scan(&rows).Error
	return rows, err
}

func (r *KnowledgeBaseRepository) CompleteKenFutRAG(ctx context.Context, releaseID string) error {
	return r.db.WithContext(ctx).Exec("DELETE FROM kenfut_rag_outbox WHERE node_release_id = ?", releaseID).Error
}

func uniquePublishIDs(ids []string) []string {
	seen := map[string]bool{}
	result := []string{}
	for _, id := range ids {
		if !seen[id] {
			result = append(result, id)
			seen[id] = true
		}
	}
	return result
}

func currentContentManifest(tx *gorm.DB, kbID string) (map[string]domain.KBReleaseNodeRelease, error) {
	manifest := map[string]domain.KBReleaseNodeRelease{}
	var release domain.KBRelease
	err := tx.Select("id").Where("kb_id = ?", kbID).Order("created_at DESC,id DESC").First(&release).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return manifest, nil
	}
	if err != nil {
		return nil, err
	}
	var rows []domain.KBReleaseNodeRelease
	if err := tx.Table("kb_release_node_releases").Select("kb_release_node_releases.*").Joins("JOIN nodes n ON n.id = kb_release_node_releases.node_id AND n.kb_id = kb_release_node_releases.kb_id").Where("kb_release_node_releases.kb_id = ? AND release_id = ?", kbID, release.ID).Scan(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		manifest[row.NodeID] = row
	}
	return manifest, nil
}

func snapshotContentMetadata(tx *gorm.DB, node domain.Node, snapshot domain.NodeRelease) error {
	var draft domain.KenFutContentDraft
	err := tx.Where("node_id = ? AND kb_id = ?", node.ID, node.KBID).First(&draft).Error
	metadata := domain.DefaultKenFutContentMetadata(node.ID)
	if err == nil {
		metadata = draft.Metadata
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	if metadata.DisplayDate == "" {
		var first domain.KenFutContentRelease
		err := tx.Where("node_id = ? AND metadata->>'display_date' <> ''", node.ID).Order("created_at ASC").First(&first).Error
		if err == nil {
			metadata.DisplayDate = first.Metadata.DisplayDate
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		} else {
			metadata.DisplayDate = snapshot.UpdatedAt.Format(time.RFC3339)
		}
	}
	if metadata.Slug != "" {
		alias := domain.KenFutSlugAlias{KBID: node.KBID, Slug: metadata.Slug, NodeID: node.ID}
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&alias).Error; err != nil {
			return err
		}
		var owner domain.KenFutSlugAlias
		if err := tx.Where("kb_id = ? AND slug = ?", node.KBID, metadata.Slug).First(&owner).Error; err != nil {
			return err
		}
		if owner.NodeID != node.ID {
			return errors.New("slug is already reserved")
		}
	}
	searchText := ContentSearchText(snapshot.Name, snapshot.Meta.Summary, snapshot.Content, metadata)
	extension := domain.KenFutContentRelease{NodeReleaseID: snapshot.ID, NodeID: node.ID, KBID: node.KBID, Metadata: metadata, SearchText: searchText, CreatedAt: snapshot.UpdatedAt}
	return tx.Create(&extension).Error
}

// ContentSearchText stores normalized text once at publication rather than
// stripping markup for each query. Chinese substrings work without tokenizers.
func ContentSearchText(title, summary, content string, metadata domain.KenFutContentMetadata) string {
	rendered := markdown.ToHTML([]byte(content), nil, nil)
	plain := stdhtml.UnescapeString(bluemonday.StrictPolicy().Sanitize(string(rendered)))
	return strings.Join(strings.Fields(title+" "+summary+" "+metadata.Category+" "+strings.Join(metadata.Tags, " ")+" "+plain), " ")
}

func writeContentManifest(tx *gorm.DB, release *domain.KBRelease, manifest map[string]domain.KBReleaseNodeRelease) error {
	rows := make([]domain.KBReleaseNodeRelease, 0, len(manifest))
	for _, entry := range manifest {
		entry.ID = uuid.NewString()
		entry.KBID = release.KBID
		entry.ReleaseID = release.ID
		entry.CreatedAt = release.CreatedAt
		rows = append(rows, entry)
	}
	if len(rows) == 0 {
		return nil
	}
	return tx.CreateInBatches(&rows, 500).Error
}

func snapshotContentNavs(tx *gorm.DB, release *domain.KBRelease) error {
	var navs []domain.Nav
	if err := tx.Where("kb_id = ?", release.KBID).Order("position ASC").Find(&navs).Error; err != nil {
		return err
	}
	rows := make([]domain.NavRelease, 0, len(navs))
	for _, nav := range navs {
		rows = append(rows, domain.NavRelease{ID: uuid.NewString(), NavID: nav.ID, ReleaseID: release.ID, KbID: release.KBID, Name: nav.Name, Position: nav.Position, CreatedAt: release.CreatedAt})
	}
	if len(rows) == 0 {
		return nil
	}
	return tx.CreateInBatches(&rows, 500).Error
}
