package pg

import (
	"context"
	"testing"
	"time"

	"github.com/chaitin/panda-wiki/domain"
	"github.com/google/uuid"
)

func TestKenFutProductCTAValidatedAtSaveAndPublication(t *testing.T) {
	db := integrationTestDB(t)
	ctx := context.Background()
	products := NewKenFutIntegrationRepository(db)
	product, err := products.Product(ctx, "kb", "product-a")
	if err != nil {
		t.Fatal(err)
	}
	product.Pages = []domain.KenFutProductPage{{Key: "canvas", Name: "画布", Path: "/canvas", Parameters: []string{"template"}}}
	if err := products.SaveProduct(ctx, product, false); err != nil {
		t.Fatal(err)
	}
	metadata := domain.DefaultKenFutContentMetadata("article")
	metadata.CTAs = []domain.KenFutCTA{{ID: "try", Label: "马上试用", Target: domain.KenFutLinkTarget{Type: "product", ProductID: product.ID, PageKey: "canvas", Params: map[string]string{"redirect_uri": "https://other.example.test"}}}}
	content := &KenFutContentRepository{db: db}
	if err := content.SaveDraft(ctx, "kb", metadata, "editor"); err == nil {
		t.Fatal("undeclared product parameter was saved")
	}
	metadata.CTAs[0].Target.Params = map[string]string{"template": "中文 & 示例"}
	metadata.CTAs[0].ResolvedURL = "https://untrusted.example.test"
	if err := content.SaveDraft(ctx, "kb", metadata, "editor"); err != nil {
		t.Fatal(err)
	}
	draft, err := content.GetDraft(ctx, "kb", "article")
	if err != nil || draft.CTAs[0].ResolvedURL != "" {
		t.Fatalf("editable fallback persisted: %#v %v", draft, err)
	}
	first := publishFixture(t, db, "article")
	// A product can change between saving the draft and publishing. Recheck the
	// latest registered page constraints inside the publication transaction.
	product.Pages[0].Parameters = []string{}
	if err := products.SaveProduct(ctx, product, false); err != nil {
		t.Fatal(err)
	}
	release := &domain.KBRelease{ID: uuid.NewString(), KBID: "kb", Tag: "invalid-cta", CreatedAt: time.Now()}
	if _, err := (&KnowledgeBaseRepository{db: db}).PublishContentRelease(ctx, release, "editor", []string{"article"}); err == nil {
		t.Fatal("a stale draft bypassed publication parameter validation")
	}
	active, err := content.LatestReleaseID(ctx, "kb")
	if err != nil || active != first {
		t.Fatalf("failed CTA validation replaced the active publication: %s %v", active, err)
	}
	var snapshots int64
	if err := db.Model(&domain.KenFutContentRelease{}).Count(&snapshots).Error; err != nil || snapshots != 1 {
		t.Fatalf("failed publication left mixed snapshots: %d %v", snapshots, err)
	}
}

func TestKenFutProductCTARejectsForeignDisabledAndMissingPages(t *testing.T) {
	db := integrationTestDB(t)
	ctx := context.Background()
	content := &KenFutContentRepository{db: db}
	metadata := domain.DefaultKenFutContentMetadata("article")
	metadata.CTAs = []domain.KenFutCTA{{ID: "try", Label: "马上试用", Target: domain.KenFutLinkTarget{Type: "product", ProductID: "product-a", PageKey: "missing"}}}
	if err := content.SaveDraft(ctx, "kb", metadata, "editor"); err == nil {
		t.Fatal("an unregistered product page was saved")
	}
	if err := db.Model(&domain.KenFutProduct{}).Where("id=?", "product-a").Update("enabled", false).Error; err != nil {
		t.Fatal(err)
	}
	if err := content.SaveDraft(ctx, "kb", metadata, "editor"); err == nil {
		t.Fatal("a disabled product was saved")
	}
	if err := db.Create(&domain.KnowledgeBase{ID: "foreign-kb", Name: "Foreign"}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&domain.KenFutProduct{ID: "foreign", KBID: "foreign-kb", Name: "Foreign", Origin: "https://other.example.test", Enabled: true, Pages: []domain.KenFutProductPage{{Key: "canvas", Name: "Canvas", Path: "/canvas"}}}).Error; err != nil {
		t.Fatal(err)
	}
	metadata.CTAs[0].Target = domain.KenFutLinkTarget{Type: "product", ProductID: "foreign", PageKey: "canvas"}
	if err := content.SaveDraft(ctx, "kb", metadata, "editor"); err == nil {
		t.Fatal("another site's product was saved")
	}
	// Stable NodeID self-links remain valid while the document is unpublished.
	metadata.CTAs[0].Target = domain.KenFutLinkTarget{Type: "node", NodeID: "article"}
	if err := content.SaveDraft(ctx, "kb", metadata, "editor"); err != nil {
		t.Fatalf("an unpublished self-link was rejected: %v", err)
	}
}
