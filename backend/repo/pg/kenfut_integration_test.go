package pg

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/chaitin/panda-wiki/domain"
	storePG "github.com/chaitin/panda-wiki/store/pg"
)

func integrationTestDB(t *testing.T) *storePG.DB {
	t.Helper()
	db := contentTestDB(t)
	if err := db.AutoMigrate(&domain.StatPage{}); err != nil {
		t.Fatal(err)
	}
	migration, err := os.ReadFile("../../store/pg/kenfut_migration/000002_integration.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Exec(string(migration)).Error; err != nil {
		t.Fatal(err)
	}
	contentFixture(t, db, "article", "Article", "Published body")
	for _, id := range []string{"product-a", "product-b"} {
		if err := db.Create(&domain.KenFutProduct{ID: id, KBID: "kb", Name: id, Origin: "https://example.test", Enabled: true, Pages: []domain.KenFutProductPage{}}).Error; err != nil {
			t.Fatal(err)
		}
	}
	return db
}

func clickFixture(t *testing.T, repo *KenFutIntegrationRepository, product, session, node string, when time.Time) string {
	t.Helper()
	clickID := uuid.NewString()
	event := &domain.KenFutEvent{EventID: uuid.NewString(), Kind: "cta_click", KBID: "kb", ProductID: product, NodeID: node, SessionID: session, ClickID: &clickID, PayloadHash: uuid.NewString(), OccurredAt: when, ReceivedAt: time.Now()}
	if _, err := repo.RecordEvent(context.Background(), event, nil); err != nil {
		t.Fatal(err)
	}
	return clickID
}

func conversionFixture(t *testing.T, repo *KenFutIntegrationRepository, subject, kind, clickID string, when time.Time) {
	t.Helper()
	event := &domain.KenFutEvent{EventID: uuid.NewString(), Kind: kind, KBID: "kb", ProductID: "product-a", SubjectHash: subject, PayloadHash: uuid.NewString(), OccurredAt: when, ReceivedAt: time.Now()}
	if err := repo.RecordConversion(context.Background(), event, clickID); err != nil {
		t.Fatal(err)
	}
}

func TestKenFutEventRetriesAreDurableAndScoped(t *testing.T) {
	db := integrationTestDB(t)
	repo := NewKenFutIntegrationRepository(db)
	ctx := context.Background()
	id := uuid.NewString()
	now := time.Now()
	newEvent := func(hash string) *domain.KenFutEvent {
		return &domain.KenFutEvent{EventID: id, Kind: "article_view", KBID: "kb", NodeID: "article", SessionID: "visitor", PayloadHash: hash, OccurredAt: now, ReceivedAt: now}
	}
	stat := &domain.StatPage{KBID: "kb", NodeID: "article", SessionID: "visitor", Scene: domain.StatPageSceneNodeDetail, CreatedAt: now}
	if _, err := repo.RecordEvent(ctx, newEvent("same"), stat); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.RecordEvent(ctx, newEvent("same"), stat); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.RecordEvent(ctx, newEvent("different"), nil); !errors.Is(err, ErrKenFutEventConflict) {
		t.Fatalf("conflicting retry: %v", err)
	}
	var events, stats int64
	_ = db.Model(&domain.KenFutEvent{}).Count(&events).Error
	_ = db.Model(&domain.StatPage{}).Count(&stats).Error
	if events != 1 || stats != 1 {
		t.Fatalf("retry inflated analytics: events=%d PV=%d", events, stats)
	}
	if err := repo.View(ctx, "kb", "article", id, "another-visitor"); err == nil {
		t.Fatal("view belonging to another visitor was accepted")
	}
	if err := repo.View(ctx, "other-kb", "article", id, "visitor"); err == nil {
		t.Fatal("view belonging to another site was accepted")
	}
}

func TestKenFutAttributionLastClickFreezeAndOutOfOrder(t *testing.T) {
	db := integrationTestDB(t)
	repo := NewKenFutIntegrationRepository(db)
	ctx := context.Background()
	now := time.Now()
	first := clickFixture(t, repo, "product-a", "visitor", "article", now.Add(-3*time.Hour))
	last := clickFixture(t, repo, "product-a", "visitor", "article", now.Add(-2*time.Hour))
	conversionFixture(t, repo, "new-user", "first_generation_success", first, now.Add(-30*time.Minute))
	conversionFixture(t, repo, "new-user", "registered", first, now.Add(-time.Hour))
	var registered domain.KenFutMilestone
	if err := db.Where("product_id=? AND subject_hash=? AND kind=?", "product-a", "new-user", "registered").First(&registered).Error; err != nil {
		t.Fatal(err)
	}
	if registered.ClickID != last {
		t.Fatalf("registration did not pick last CTA: got %s want %s", registered.ClickID, last)
	}
	_ = clickFixture(t, repo, "product-a", "visitor", "article", now)
	conversionFixture(t, repo, "new-user", "registered", first, now.Add(-time.Hour))
	if err := db.Where("product_id=? AND subject_hash=? AND kind=?", "product-a", "new-user", "registered").First(&registered).Error; err != nil {
		t.Fatal(err)
	}
	if registered.ClickID != last {
		t.Fatal("later callback rewrote locked registration attribution")
	}
	funnel, err := repo.Funnel(ctx, domain.KenFutFunnelReq{KBID: "kb", ProductID: "product-a", From: now.Add(-24 * time.Hour), To: now.Add(time.Hour)})
	if err != nil {
		t.Fatal(err)
	}
	if funnel.Registrations != 1 || funnel.FirstGenerations != 1 || funnel.Clicks != 3 {
		t.Fatalf("out-of-order conversion or deduplication failed: %#v", funnel)
	}
}

func TestKenFutAttributionExpiryAndProductIsolation(t *testing.T) {
	db := integrationTestDB(t)
	repo := NewKenFutIntegrationRepository(db)
	now := time.Now()
	expired := clickFixture(t, repo, "product-a", "old-visitor", "article", now.Add(-31*24*time.Hour))
	conversionFixture(t, repo, "expired-user", "registered", expired, now)
	foreign := clickFixture(t, repo, "product-b", "other-visitor", "article", now.Add(-time.Hour))
	conversionFixture(t, repo, "isolated-user", "registered", foreign, now)
	var assigned int64
	if err := db.Model(&domain.KenFutMilestone{}).Where("product_id=? AND click_id<>''", "product-a").Count(&assigned).Error; err != nil {
		t.Fatal(err)
	}
	if assigned != 0 {
		t.Fatal("foreign or expired click attributed to product")
	}
	for _, subject := range []string{"expired-user", "isolated-user"} {
		conversionFixture(t, repo, subject, "first_generation_success", "", now.Add(time.Minute))
	}
	funnel, err := repo.Funnel(context.Background(), domain.KenFutFunnelReq{KBID: "kb", ProductID: "product-a", From: now.Add(-24 * time.Hour), To: now.Add(time.Hour)})
	if err != nil {
		t.Fatal(err)
	}
	if funnel.Registrations != 0 || funnel.FirstGenerations != 0 || funnel.UnattributedRegistrations != 2 || funnel.UnattributedFirstGenerations != 2 {
		t.Fatalf("unattributed or cross-product counts were polluted: %#v", funnel)
	}
}

func TestKenFutFunnelQueryChainsRemainIndependent(t *testing.T) {
	db := integrationTestDB(t)
	repo := NewKenFutIntegrationRepository(db)
	now := time.Now()
	click := clickFixture(t, repo, "product-a", "visitor", "article", now.Add(-time.Hour))
	conversionFixture(t, repo, "registered-only", "registered", click, now.Add(-30*time.Minute))
	for i := 0; i < 2; i++ {
		funnel, err := repo.Funnel(context.Background(), domain.KenFutFunnelReq{KBID: "kb", ProductID: "product-a", From: now.Add(-24 * time.Hour), To: now.Add(time.Hour)})
		if err != nil {
			t.Fatal(err)
		}
		if funnel.Registrations != 1 || funnel.FirstGenerations != 0 || funnel.Clicks != 1 || len(funnel.Items) != 1 || funnel.Items[0].Clicks != 1 {
			t.Fatalf("funnel query leaked filters or joins: %#v", funnel)
		}
	}
}

func TestKenFutCredentialLookupAndRevocation(t *testing.T) {
	db := integrationTestDB(t)
	repo := NewKenFutIntegrationRepository(db)
	ctx := context.Background()
	key := &domain.KenFutCredential{ID: uuid.NewString(), ProductID: "product-a", TokenHash: "hashed-secret", Scopes: []string{"conversion:write"}, CreatedAt: time.Now()}
	if err := repo.CreateCredential(ctx, key); err != nil {
		t.Fatal(err)
	}
	_, product, err := repo.Authenticate(ctx, "hashed-secret")
	if err != nil || product.ID != "product-a" {
		t.Fatalf("wrong credential owner: %#v %v", product, err)
	}
	if err := repo.Revoke(ctx, "product-b", key.ID); err == nil {
		t.Fatal("other product revoked the credential")
	}
	if err := repo.Revoke(ctx, "product-a", key.ID); err != nil {
		t.Fatal(err)
	}
	if _, _, err := repo.Authenticate(ctx, "hashed-secret"); err == nil {
		t.Fatal("revoked credential still authenticated")
	}
}

func TestKenFutEventIDCannotBeReusedForAnotherMilestone(t *testing.T) {
	db := integrationTestDB(t)
	repo := NewKenFutIntegrationRepository(db)
	id := uuid.NewString()
	registered := &domain.KenFutEvent{EventID: id, Kind: "registered", KBID: "kb", ProductID: "product-a", SubjectHash: "subject", PayloadHash: "registration-payload", OccurredAt: time.Now(), ReceivedAt: time.Now()}
	if err := repo.RecordConversion(context.Background(), registered, ""); err != nil {
		t.Fatal(err)
	}
	generated := &domain.KenFutEvent{EventID: id, Kind: "first_generation_success", KBID: "kb", ProductID: "product-a", SubjectHash: "subject", PayloadHash: "generation-payload", OccurredAt: time.Now(), ReceivedAt: time.Now()}
	if err := repo.RecordConversion(context.Background(), generated, ""); !errors.Is(err, ErrKenFutEventConflict) {
		t.Fatalf("same product event ID was accepted for a different milestone: %v", err)
	}
}

func TestKenFutPublishedSearchExecutionPlans(t *testing.T) {
	if os.Getenv("KENFUT_SEARCH_BENCH") != "1" {
		t.Skip("set KENFUT_SEARCH_BENCH=1 for the 10,000-document PostgreSQL sample")
	}
	db := contentTestDB(t)
	contentFixture(t, db, "fixture", "Fixture", "Fixture")
	statements := []string{
		`INSERT INTO nodes(id,kb_id,type,status,name,content,meta,permissions,created_at,updated_at) SELECT 'bench-'||i,'kb',2,2,'文档 '||i,CASE WHEN i%100=0 THEN '中文模型生成教程' ELSE repeat('产品操作指南 ',30)||i END,'{"content_type":"md"}','{"visible":"open","visitable":"open","answerable":"open"}',now(),now() FROM generate_series(1,10000)i`,
		`INSERT INTO node_releases(id,kb_id,node_id,type,name,content,meta,created_at,updated_at) SELECT 'snapshot-'||id,kb_id,id,type,name,content,meta,created_at,updated_at FROM nodes WHERE id LIKE 'bench-%'`,
		`INSERT INTO kenfut_content_releases(node_release_id,node_id,kb_id,metadata,search_text) SELECT id,node_id,kb_id,jsonb_build_object('node_id',node_id,'channel','docs','tags',jsonb_build_array()),name||' '||content FROM node_releases`,
		`INSERT INTO kb_releases(id,kb_id,tag,created_at) VALUES('benchmark','kb','benchmark',now())`,
		`INSERT INTO kb_release_node_releases(id,kb_id,release_id,node_id,node_release_id) SELECT 'manifest-'||id,'kb','benchmark',node_id,id FROM node_releases`,
		`ANALYZE kenfut_content_releases`,
	}
	for _, statement := range statements {
		if err := db.Exec(statement).Error; err != nil {
			t.Fatal(err)
		}
	}
	repo := &KenFutContentRepository{db: db}
	for _, term := range []string{"模型", "中文模型生成"} {
		started := time.Now()
		items, total, err := repo.List(context.Background(), domain.KenFutContentListReq{KBID: "kb", Query: term, Page: 1, PageSize: 20}, "benchmark", KenFutVisibility{})
		if err != nil || total != 100 || len(items) != 20 {
			t.Fatalf("representative query %q failed: %d %d %v", term, total, len(items), err)
		}
		t.Logf("10,000 published documents, query %q: count + page %s", term, time.Since(started))
		var plans []struct {
			Plan string `gorm:"column:QUERY PLAN"`
		}
		if err := db.Raw(`EXPLAIN (ANALYZE, BUFFERS) SELECT node_release_id FROM kenfut_content_releases WHERE search_text ILIKE ?`, "%"+term+"%").Scan(&plans).Error; err != nil {
			t.Fatal(err)
		}
		for _, plan := range plans {
			t.Log(plan.Plan)
		}
	}
}

func TestKenFutCTAFunnelViewCohortIsLimitedToThatCTA(t *testing.T) {
	db := integrationTestDB(t)
	contentFixture(t, db, "other-article", "Other Article", "Other content")
	metadataRepo := &KenFutContentRepository{db: db}
	for _, pair := range [][2]string{{"article", "cta-a"}, {"other-article", "cta-b"}} {
		metadata := domain.DefaultKenFutContentMetadata(pair[0])
		metadata.CTAs = []domain.KenFutCTA{{ID: pair[1], Label: "Start", Style: "primary", Target: domain.KenFutLinkTarget{Type: "product", ProductID: "product-a", PageKey: "start"}}}
		if err := metadataRepo.SaveDraft(context.Background(), "kb", metadata, "editor"); err != nil {
			t.Fatal(err)
		}
	}
	releaseID := publishFixture(t, db, "article", "other-article")
	var entries []domain.KBReleaseNodeRelease
	if err := db.Where("release_id=?", releaseID).Find(&entries).Error; err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	repo := NewKenFutIntegrationRepository(db)
	for _, entry := range entries {
		event := &domain.KenFutEvent{EventID: uuid.NewString(), Kind: "article_view", KBID: "kb", NodeID: entry.NodeID, NodeReleaseID: entry.NodeReleaseID, SessionID: "visitor-" + entry.NodeID, PayloadHash: "view", OccurredAt: now, ReceivedAt: now}
		if _, err := repo.RecordEvent(context.Background(), event, nil); err != nil {
			t.Fatal(err)
		}
	}
	funnel, err := repo.Funnel(context.Background(), domain.KenFutFunnelReq{KBID: "kb", ProductID: "product-a", CTAID: "cta-a", From: now.Add(-time.Hour), To: now.Add(time.Hour)})
	if err != nil || funnel.Views != 1 || funnel.Viewers != 1 {
		t.Fatalf("CTA view denominator included unrelated pages: %#v %v", funnel, err)
	}
}

func TestKenFutRetentionArchivesCountsAndKeepsMilestones(t *testing.T) {
	db := integrationTestDB(t)
	repo := NewKenFutIntegrationRepository(db)
	ctx := context.Background()
	old := time.Now().AddDate(0, 0, -190)
	before := time.Now().AddDate(0, 0, -180)
	for _, when := range []time.Time{old, time.Now()} {
		event := &domain.KenFutEvent{EventID: uuid.NewString(), Kind: "article_view", KBID: "kb", NodeID: "article", SessionID: "visitor", PayloadHash: "hash", OccurredAt: when, ReceivedAt: when}
		if _, err := repo.RecordEvent(ctx, event, nil); err != nil {
			t.Fatal(err)
		}
	}
	if err := db.Create(&domain.KenFutMilestone{ProductID: "product-a", SubjectHash: "retained-subject", Kind: "registered", OccurredAt: old}).Error; err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		if err := repo.PurgeEvents(ctx, before); err != nil {
			t.Fatal(err)
		}
	}
	var events, milestones, archived int64
	if err := db.Model(&domain.KenFutEvent{}).Count(&events).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Model(&domain.KenFutMilestone{}).Count(&milestones).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Table("kenfut_daily_event_totals").Select("COALESCE(SUM(records),0)").Scan(&archived).Error; err != nil {
		t.Fatal(err)
	}
	if events != 1 || milestones != 1 || archived != 1 {
		t.Fatalf("retention mismatch: events=%d milestones=%d archived=%d", events, milestones, archived)
	}
}

func TestKenFutVectorWritesSerializeAndReleaseLocks(t *testing.T) {
	db := contentTestDB(t)
	repo := &NodeRepository{db: db}
	acquired := make(chan struct{})
	release := make(chan struct{})
	done := make(chan error, 1)
	go func() {
		done <- repo.WithKenFutRAGLock(context.Background(), "same-node", func() error { close(acquired); <-release; return nil })
	}()
	<-acquired
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	err := repo.WithKenFutRAGLock(ctx, "same-node", func() error { return nil })
	if err == nil {
		t.Fatal("concurrent vector write acquired the same node lock")
	}
	close(release)
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	if err := repo.WithKenFutRAGLock(context.Background(), "same-node", func() error { return nil }); err != nil {
		t.Fatalf("lock not released: %v", err)
	}
}

func TestKenFutPVPreservesUpgradeBaselineAndAvoidsDailyDoubleCounting(t *testing.T) {
	db := contentTestDB(t)
	contentFixture(t, db, "pv-article", "PV article", "body")
	ctx := context.Background()
	if err := db.Exec("DROP TABLE kenfut_node_pv").Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&domain.NodeStats{NodeID: "pv-article", PV: 100}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&domain.StatPage{KBID: "kb", NodeID: "pv-article", SessionID: "old", Scene: domain.StatPageSceneNodeDetail, CreatedAt: time.Now()}).Error; err != nil {
		t.Fatal(err)
	}
	migration, err := os.ReadFile("../../store/pg/kenfut_migration/000003_node_pv.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Exec(string(migration)).Error; err != nil {
		t.Fatal(err)
	}
	nodes := &NodeRepository{db: db}
	assertPV := func(want int64) {
		t.Helper()
		stats, err := nodes.GetNodeStatsByNodeId(ctx, "pv-article")
		if err != nil {
			t.Fatal(err)
		}
		if stats.PV != want {
			t.Fatalf("PV=%d, want %d", stats.PV, want)
		}
	}
	assertPV(101)
	repo := NewKenFutIntegrationRepository(db)
	id := uuid.NewString()
	now := time.Now()
	for i := 0; i < 2; i++ {
		event := &domain.KenFutEvent{EventID: id, Kind: "article_view", KBID: "kb", NodeID: "pv-article", SessionID: "new", PayloadHash: "same", OccurredAt: now, ReceivedAt: now}
		stat := &domain.StatPage{KBID: "kb", NodeID: "pv-article", SessionID: "new", Scene: domain.StatPageSceneNodeDetail, CreatedAt: now}
		// This fixture only needs the event schema after the baseline has been captured.
		if i == 0 {
			sqlData, e := os.ReadFile("../../store/pg/kenfut_migration/000002_integration.up.sql")
			if e != nil {
				t.Fatal(e)
			}
			if e := db.Exec(string(sqlData)).Error; e != nil {
				t.Fatal(e)
			}
		}
		if _, err := repo.RecordEvent(ctx, event, stat); err != nil {
			t.Fatal(err)
		}
	}
	assertPV(102)
	legacy := NewStatRepository(db, nil)
	if err := legacy.UpsertNodeStats(ctx, "pv-article", 50); err != nil {
		t.Fatal(err)
	}
	assertPV(102)
	if err := legacy.CreateStatPage(ctx, &domain.StatPage{KBID: "kb", NodeID: "pv-article", Scene: domain.StatPageSceneNodeDetail, CreatedAt: now}); err != nil {
		t.Fatal(err)
	}
	assertPV(103)
	if err := legacy.CreateStatPage(ctx, &domain.StatPage{KBID: "another-kb", NodeID: "pv-article", Scene: domain.StatPageSceneNodeDetail, CreatedAt: now}); err == nil {
		t.Fatal("another site's node accepted")
	}
	assertPV(103)
}
