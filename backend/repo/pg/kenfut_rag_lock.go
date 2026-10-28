package pg

import (
	"context"
	"errors"

	"gorm.io/gorm"
)

// WithKenFutRAGLock serializes vector writes for the same node across consumers.
// SQL publication remains independent of slow external vector requests.
func (r *NodeRepository) WithKenFutRAGLock(ctx context.Context, nodeID string, run func() error) error {
	return r.db.WithContext(ctx).Connection(func(tx *gorm.DB) (result error) {
		var acquired bool
		if err := tx.Raw("SELECT pg_try_advisory_lock(hashtextextended(?,0))", "kenfut-rag:"+nodeID).Scan(&acquired).Error; err != nil {
			return err
		}
		if !acquired {
			return errors.New("vector synchronization is already running for this node")
		}

		defer func() {
			result = errors.Join(result, tx.WithContext(context.WithoutCancel(ctx)).Exec("SELECT pg_advisory_unlock(hashtextextended(?,0))", "kenfut-rag:"+nodeID).Error)
		}()
		return run()
	})
}
func (r *KnowledgeBaseRepository) IsCurrentKenFutRelease(ctx context.Context, kbID, releaseID string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Table("kb_release_node_releases m").Where("m.kb_id=? AND m.node_release_id=? AND m.release_id=(SELECT id FROM kb_releases WHERE kb_id=? ORDER BY created_at DESC,id DESC LIMIT 1)", kbID, releaseID, kbID).Count(&count).Error
	return count > 0, err
}
