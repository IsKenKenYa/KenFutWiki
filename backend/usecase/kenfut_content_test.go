package usecase

import (
	"strings"
	"testing"

	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/repo/pg"
)

func TestNormalizeKenFutContentMetadata(t *testing.T) {
	m := domain.KenFutContentMetadata{NodeID: "stable-node", Channel: "both", Tags: []string{"教程", " 教程 ", "API"}, CTAs: []domain.KenFutCTA{{Label: "试用", Target: domain.KenFutLinkTarget{Type: "site", Page: "home"}}}}
	if err := NormalizeKenFutContentMetadata(&m); err != nil {
		t.Fatal(err)
	}
	if m.Slug != "stable-node" || len(m.Tags) != 2 || m.CTAs[0].ID == "" || m.CTAs[0].Style != "primary" {
		t.Fatalf("normalization lost stable defaults: %#v", m)
	}
	for _, slug := range []string{"../secret", "a/b", "tags", "x?draft=true"} {
		m.Slug = slug
		if NormalizeKenFutContentMetadata(&m) == nil {
			t.Errorf("accepted invalid slug %q", slug)
		}
	}
}

func TestKenFutContentKeepsLegacyMarkdownRendering(t *testing.T) {
	row := pg.KenFutPublishedRow{ID: "node", Content: "# Legacy heading\n\n**strong**", ContentType: "html", Metadata: domain.DefaultKenFutContentMetadata("node")}
	item := contentItem(row, "https://docs.example.test/wiki")
	if !strings.Contains(item.Content, "<h1>") || !strings.Contains(item.Content, "<strong>strong</strong>") {
		t.Fatalf("legacy Markdown was exposed as unrendered HTML content: %s", item.Content)
	}
	row.ContentType = "md"
	if got := contentItem(row, "").Content; got != row.Content {
		t.Fatal("explicit Markdown content was unexpectedly converted")
	}
}

func TestValidateKenFutLinkTarget(t *testing.T) {
	for _, target := range []domain.KenFutLinkTarget{{Type: "url", URL: "javascript:alert(1)"}, {Type: "url", URL: "https://user:password@example.test/path"}, {Type: "site", Page: "../../admin"}, {Type: "product", ProductID: "product"}, {Type: "node", NodeID: "node", Params: map[string]string{"kf_click_id": "spoof"}}} {
		if ValidateKenFutLinkTarget(target) == nil {
			t.Errorf("accepted unsafe target %#v", target)
		}
	}
	for _, target := range []domain.KenFutLinkTarget{{Type: "node", NodeID: "node"}, {Type: "url", URL: "https://example.test/start?a=1#step"}, {Type: "url", URL: "http://localhost:4567/start"}, {Type: "product", ProductID: "product", PageKey: "canvas", Params: map[string]string{"template": "example"}}} {
		if err := ValidateKenFutLinkTarget(target); err != nil {
			t.Errorf("valid target rejected: %v", err)
		}
	}
}

func TestRelatedContentScore(t *testing.T) {
	current := pg.KenFutPublishedRow{ID: "current", ParentID: "folder", Metadata: domain.KenFutContentMetadata{Category: "教程", Tags: []string{"API"}}}
	tag := pg.KenFutPublishedRow{Metadata: domain.KenFutContentMetadata{Tags: []string{"API"}}}
	category := pg.KenFutPublishedRow{Metadata: domain.KenFutContentMetadata{Category: "教程"}}
	folder := pg.KenFutPublishedRow{ParentID: "folder"}
	if relatedContentScore(current, tag) <= relatedContentScore(current, category) || relatedContentScore(current, category) <= relatedContentScore(current, folder) || relatedContentScore(current, folder) <= 0 {
		t.Fatal("related content priority changed")
	}
	if relatedContentScore(current, pg.KenFutPublishedRow{}) != 0 {
		t.Fatal("unrelated content must not be recommended")
	}
}
