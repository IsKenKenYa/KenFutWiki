package pg

import (
	"context"
	"os"
	"testing"

	"github.com/chaitin/panda-wiki/config"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/log"
)

// TestNodeRecycleBin 校验删除进入回收站、恢复与彻底删除的完整闭环。
func TestNodeRecycleBin(t *testing.T) {
	dsn := os.Getenv("KENFUT_TEST_DSN")
	if dsn == "" {
		t.Skip("KENFUT_TEST_DSN is required for PostgreSQL integration tests")
	}
	db := contentTestDB(t)
	repo := NewNodeRepository(db, log.NewLogger(&config.Config{}))
	ctx := context.Background()

	// 回收站相关表对知识库有外键约束
	if err := db.Where("id = ?", "kb").FirstOrCreate(&domain.KnowledgeBase{ID: "kb", Name: "Test"}).Error; err != nil {
		t.Fatal(err)
	}

	parent := &domain.Node{ID: "node-parent", KBID: "kb", NavId: "nav", Name: "目录", Type: domain.NodeTypeFolder, Content: "", Status: domain.NodeStatusPublished, CreatorId: "editor", EditorId: "editor"}
	if err := db.Create(parent).Error; err != nil {
		t.Fatal(err)
	}
	child := &domain.Node{ID: "node-child", KBID: "kb", NavId: "nav", ParentID: "node-parent", Name: "正文", Type: domain.NodeTypeDocument, Content: "正文", Status: domain.NodeStatusPublished, CreatorId: "editor", EditorId: "editor"}
	if err := db.Create(child).Error; err != nil {
		t.Fatal(err)
	}
	release := &domain.NodeRelease{ID: "nr-child", KBID: "kb", NodeID: "node-child", Type: domain.NodeTypeDocument, Name: "正文", Content: "正文", DocID: "doc-child"}
	if err := db.Create(release).Error; err != nil {
		t.Fatal(err)
	}
	// 将快照挂入发布清单：恢复后才会进入检索重建队列
	kbRelease := &domain.KBRelease{ID: "release-1", KBID: "kb", Tag: "v1", PublisherId: "editor"}
	if err := db.Create(kbRelease).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&domain.KBReleaseNodeRelease{ID: "link-child", KBID: "kb", ReleaseID: "release-1", NodeID: "node-child", NodeReleaseID: "nr-child"}).Error; err != nil {
		t.Fatal(err)
	}

	// 删除父节点：子节点一并进入回收站。
	docIDs, err := repo.Delete(ctx, "kb", []string{"node-parent"})
	if err != nil {
		t.Fatal(err)
	}
	if len(docIDs) != 1 || docIDs[0] != "doc-child" {
		t.Fatalf("delete must report vector doc ids: %v", docIDs)
	}
	var count int64
	db.Model(&domain.Node{}).Where("kb_id = ?", "kb").Count(&count)
	if count != 0 {
		t.Fatalf("deleted nodes must be excluded from normal queries: %d", count)
	}
	deleted, err := repo.RecycleBinList(ctx, "kb")
	if err != nil {
		t.Fatal(err)
	}
	if len(deleted) != 2 {
		t.Fatalf("recycle bin must contain both nodes: %d", len(deleted))
	}

	// 发布快照在软删期间保留，恢复后可直接重建检索。
	var releaseCount int64
	db.Model(&domain.NodeRelease{}).Where("node_id = ?", "node-child").Count(&releaseCount)
	if releaseCount != 1 {
		t.Fatalf("soft delete must keep release snapshots: %d", releaseCount)
	}

	// 恢复：普通查询重新可见。
	if err := repo.Restore(ctx, "kb", []string{"node-parent"}); err != nil {
		t.Fatal(err)
	}
	db.Model(&domain.Node{}).Where("kb_id = ?", "kb").Count(&count)
	if count != 2 {
		t.Fatalf("restored nodes must be visible again: %d", count)
	}
	var outbox int64
	db.Table("kenfut_rag_outbox").Count(&outbox)
	if outbox != 1 {
		t.Fatalf("restore must enqueue vector rebuild for published snapshot: %d", outbox)
	}

	// 再次删除并彻底清除：节点、快照与关联全部移除。
	if _, err := repo.Delete(ctx, "kb", []string{"node-parent"}); err != nil {
		t.Fatal(err)
	}
	docIDs, err = repo.Purge(ctx, "kb", []string{"node-parent"})
	if err != nil {
		t.Fatal(err)
	}
	if len(docIDs) != 1 || docIDs[0] != "doc-child" {
		t.Fatalf("purge must report vector doc ids: %v", docIDs)
	}
	db.Unscoped().Model(&domain.Node{}).Where("kb_id = ?", "kb").Count(&count)
	if count != 0 {
		t.Fatalf("purged nodes must be gone: %d", count)
	}
	db.Model(&domain.NodeRelease{}).Where("node_id = ?", "node-child").Count(&releaseCount)
	if releaseCount != 0 {
		t.Fatalf("purge must remove release snapshots: %d", releaseCount)
	}
	deleted, err = repo.RecycleBinList(ctx, "kb")
	if err != nil {
		t.Fatal(err)
	}
	if len(deleted) != 0 {
		t.Fatalf("recycle bin must be empty after purge: %d", len(deleted))
	}
}
