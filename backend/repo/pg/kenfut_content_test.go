package pg

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/chaitin/panda-wiki/consts"
	"github.com/chaitin/panda-wiki/domain"
	storePG "github.com/chaitin/panda-wiki/store/pg"
)

func contentTestDB(t *testing.T) *storePG.DB {
	t.Helper()
	dsn := os.Getenv("KENFUT_TEST_DSN")
	if dsn == "" {
		t.Skip("KENFUT_TEST_DSN is required for PostgreSQL integration tests")
	}
	base, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	schema := "kenfut_test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if err := base.Exec("CREATE SCHEMA " + schema).Error; err != nil {
		t.Fatal(err)
	}
	if err := base.Exec("CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public").Error; err != nil {
		t.Fatal(err)
	}
	if strings.Contains(dsn, "://") {
		if strings.Contains(dsn, "?") {
			dsn += "&"
		} else {
			dsn += "?"
		}
		dsn += "search_path=" + schema + ",public"
	} else {
		dsn += " search_path=" + schema + ",public"
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
		_ = base.Exec("DROP SCHEMA " + schema + " CASCADE").Error
		sqlBase, _ := base.DB()
		_ = sqlBase.Close()
	})
	if err := db.AutoMigrate(&domain.KnowledgeBase{}, &domain.Node{}, &domain.NodeRelease{}, &domain.KBRelease{}, &domain.KBReleaseNodeRelease{}, &domain.Nav{}, &domain.NavRelease{}, &domain.NodeStats{}, &domain.StatPage{}); err != nil {
		t.Fatal(err)
	}
	migration, err := os.ReadFile("../../store/pg/kenfut_migration/000001_content.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Exec(string(migration)).Error; err != nil {
		t.Fatal(err)
	}
	return &storePG.DB{DB: db}
}

func contentFixture(t *testing.T, db *storePG.DB, nodeID, title, content string) {
	t.Helper()
	kb := domain.KnowledgeBase{ID: "kb", Name: "Test", AccessSettings: domain.AccessSettings{BaseURL: "https://docs.example.test/wiki"}}
	if err := db.Where("id = ?", kb.ID).FirstOrCreate(&kb).Error; err != nil {
		t.Fatal(err)
	}
	node := domain.Node{ID: nodeID, KBID: "kb", Name: title, Content: content, Type: domain.NodeTypeDocument, Meta: domain.NodeMeta{Summary: "已发布摘要", ContentType: "md"}, Permissions: domain.NodePermissions{Visible: consts.NodeAccessPermOpen, Visitable: consts.NodeAccessPermOpen, Answerable: consts.NodeAccessPermOpen}, CreatedAt: time.Now(), UpdatedAt: time.Now()}
	if err := db.Create(&node).Error; err != nil {
		t.Fatal(err)
	}
}

func publishFixture(t *testing.T, db *storePG.DB, nodeIDs ...string) string {
	t.Helper()
	release := &domain.KBRelease{ID: uuid.NewString(), KBID: "kb", Tag: uuid.NewString(), CreatedAt: time.Now()}
	repo := &KnowledgeBaseRepository{db: db}
	if _, err := repo.PublishContentRelease(context.Background(), release, "publisher", nodeIDs); err != nil {
		t.Fatal(err)
	}
	return release.ID
}

func TestKenFutContentPublishedIsolationAndSlugHistory(t *testing.T) {
	db := contentTestDB(t)
	contentFixture(t, db, "node", "公开教程", "中文全文，100% 可用")
	repo := &KenFutContentRepository{db: db}
	ctx := context.Background()
	m := domain.DefaultKenFutContentMetadata("node")
	m.Channel = "both"
	m.Slug = "tutorial"
	m.Tags = []string{"API"}
	if err := repo.SaveDraft(ctx, "kb", m, "editor"); err != nil {
		t.Fatal(err)
	}
	first := publishFixture(t, db, "node")
	legacy, err := (&NodeRepository{db: db}).GetNodeReleaseDetailByKBIDAndID(ctx, "kb", "node")
	if err != nil || legacy.ID != "node" || legacy.Status != domain.NodeStatusPublished {
		t.Fatalf("legacy public detail lost stable Node identity: %#v %v", legacy, err)
	}
	m.Slug = "new-tutorial"
	m.CoverURL = "https://example.test/draft.png"
	m.Tags = []string{"未发布"}
	if err := repo.SaveDraft(ctx, "kb", m, "editor"); err != nil {
		t.Fatal(err)
	}
	if err := db.Model(&domain.Node{}).Where("id = ?", "node").Updates(map[string]any{"name": "草稿标题", "content": "草稿机密"}).Error; err != nil {
		t.Fatal(err)
	}
	row, err := repo.Detail(ctx, "kb", "node", first, KenFutVisibility{})
	if err != nil {
		t.Fatal(err)
	}
	if row.Title != "公开教程" || row.Metadata.Slug != "tutorial" || row.Metadata.CoverURL != "" || strings.Contains(row.Content, "机密") {
		t.Fatalf("draft escaped published snapshot: %#v", row)
	}
	if _, err := repo.ResolveSlug(ctx, "kb", "new-tutorial"); err == nil {
		t.Fatal("draft slug resolved before publication")
	}
	second := publishFixture(t, db, "node")
	if _, err := repo.ResolveSlug(ctx, "kb", "tutorial"); err != nil {
		t.Fatal("old slug alias was removed", err)
	}
	row, err = repo.Detail(ctx, "kb", "node", second, KenFutVisibility{})
	if err != nil || row.Metadata.Slug != "new-tutorial" {
		t.Fatalf("new snapshot unavailable: %#v %v", row, err)
	}
}

func TestKenFutContentSearchAndPublicationRollback(t *testing.T) {
	db := contentTestDB(t)
	contentFixture(t, db, "a", "中文教程", "模型生成 100% 可用")
	contentFixture(t, db, "b", "Other", "no percentage")
	releaseID := publishFixture(t, db, "a", "b")
	repo := &KenFutContentRepository{db: db}
	ctx := context.Background()
	for _, q := range []string{"中文", "模型", "100%"} {
		rows, total, err := repo.List(ctx, domain.KenFutContentListReq{KBID: "kb", Query: q, Page: 1, PageSize: 20}, releaseID, KenFutVisibility{})
		if err != nil || total != 1 || len(rows) != 1 || rows[0].ID != "a" {
			t.Fatalf("query %q: rows=%#v total=%d err=%v", q, rows, total, err)
		}
	}
	broken := &domain.KBRelease{ID: uuid.NewString(), KBID: "kb", CreatedAt: time.Now()}
	if _, err := (&KnowledgeBaseRepository{db: db}).PublishContentRelease(ctx, broken, "publisher", []string{"a", "missing"}); err == nil {
		t.Fatal("invalid publish succeeded")
	}
	latest, err := repo.LatestReleaseID(ctx, "kb")
	if err != nil || latest != releaseID {
		t.Fatalf("failed publication changed active manifest: %s %v", latest, err)
	}
	if err := db.Model(&domain.Node{}).Where("id = ?", "a").Update("permissions", domain.NodePermissions{Visible: consts.NodeAccessPermOpen, Visitable: consts.NodeAccessPermClosed}).Error; err != nil {
		t.Fatal(err)
	}
	rows, total, err := repo.List(ctx, domain.KenFutContentListReq{KBID: "kb", Page: 1, PageSize: 20}, releaseID, KenFutVisibility{})
	if err != nil || total != 1 || rows[0].ID != "b" {
		t.Fatalf("permission filtering failed: %#v %d %v", rows, total, err)
	}
}

func TestContentSearchTextAndEscaping(t *testing.T) {
	text := ContentSearchText("Title", "Summary", "<p>中文 &amp; <b>模型</b></p>", domain.KenFutContentMetadata{Category: "教程", Tags: []string{"API"}})
	if strings.Contains(text, "<p>") || !strings.Contains(text, "中文") || !strings.Contains(text, "教程 API") {
		t.Fatalf("bad search text %q", text)
	}
	if got := escapeContentPattern("100%_\\"); got != "100\\%\\_\\\\" {
		t.Fatalf("literal query was not escaped: %q", got)
	}
}

func TestKenFutPublicationKeepsDurableRAGOutbox(t *testing.T) {
	db := contentTestDB(t)
	contentFixture(t, db, "document", "Document", "Content")
	publishFixture(t, db, "document")
	repo := &KnowledgeBaseRepository{db: db}
	pending, err := repo.PendingKenFutRAG(context.Background(), 100)
	if err != nil || len(pending) != 1 || pending[0].KBID != "kb" || pending[0].NodeReleaseID == "" || pending[0].Action != "upsert" {
		t.Fatalf("published content lost its durable sync task: %#v %v", pending, err)
	}
	if err := repo.CompleteKenFutRAG(context.Background(), pending[0].NodeReleaseID); err != nil {
		t.Fatal(err)
	}
	pending, err = repo.PendingKenFutRAG(context.Background(), 100)
	if err != nil || len(pending) != 0 {
		t.Fatalf("acknowledged sync task remains queued: %#v %v", pending, err)
	}
}

func TestKenFutRAGOutboxDoesNotReplaySupersededSnapshots(t *testing.T) {
	db := contentTestDB(t)
	contentFixture(t, db, "document", "First", "Version one")
	publishFixture(t, db, "document")
	if err := db.Model(&domain.Node{}).Where("id=?", "document").Update("content", "Version two").Error; err != nil {
		t.Fatal(err)
	}
	latest := publishFixture(t, db, "document")
	repo := &KnowledgeBaseRepository{db: db}
	pending, err := repo.PendingKenFutRAG(context.Background(), 100)
	if err != nil || len(pending) != 1 {
		t.Fatalf("superseded tasks survived: %#v %v", pending, err)
	}
	var manifest domain.KBReleaseNodeRelease
	if err := db.Where("release_id=? AND node_id=?", latest, "document").First(&manifest).Error; err != nil {
		t.Fatal(err)
	}
	if pending[0].NodeReleaseID != manifest.NodeReleaseID {
		t.Fatal("queued vector task does not match public snapshot")
	}
}

func TestKenFutPublicationOrdersByCommittedSiteLock(t *testing.T) {
	db := contentTestDB(t)
	contentFixture(t, db, "document", "Document", "Content")
	first := publishFixture(t, db, "document")
	var initial domain.KBRelease
	if err := db.Where("id=?", first).First(&initial).Error; err != nil {
		t.Fatal(err)
	}
	// Simulate a request which began earlier but acquired the publication lock later.
	later := &domain.KBRelease{ID: uuid.NewString(), KBID: "kb", Tag: "later", CreatedAt: initial.CreatedAt.Add(-time.Hour)}
	repo := &KnowledgeBaseRepository{db: db}
	if _, err := repo.PublishContentRelease(context.Background(), later, "editor", []string{"document"}); err != nil {
		t.Fatal(err)
	}
	latest, err := (&KenFutContentRepository{db: db}).LatestReleaseID(context.Background(), "kb")
	if err != nil || latest != later.ID || later.CreatedAt.Before(initial.CreatedAt) {
		t.Fatalf("a later committed publication did not become public: %s %#v %v", latest, later, err)
	}
}
