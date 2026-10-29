package share

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/chaitin/panda-wiki/domain"
	"github.com/labstack/echo/v4"
)

func TestKenFutPublicCTAFallbackRevalidatesProductParameters(t *testing.T) {
	s := actionFixture(t)
	e := echo.New()
	registerBrowserHandlers(e, s)
	read := func() domain.KenFutContentItem {
		t.Helper()
		request := httptest.NewRequest(http.MethodGet, "/share/kenfut/v1/articles/model-guide", nil)
		request.Header.Set("X-KB-ID", browserKBID)
		response := httptest.NewRecorder()
		e.ServeHTTP(response, request)
		var result struct {
			Success bool                     `json:"success"`
			Data    domain.KenFutContentItem `json:"data"`
		}
		if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil || response.Code != http.StatusOK || !result.Success {
			t.Fatalf("article body was unavailable: %d %s %v", response.Code, response.Body.String(), err)
		}
		return result.Data
	}
	content := read()
	if len(content.CTAs) == 0 {
		t.Fatal("published CTA missing")
	}
	address, err := url.Parse(content.CTAs[0].ResolvedURL)
	if err != nil || address.Host != "product.example.test" || address.Query().Get("template") != "example" {
		t.Fatalf("validated public fallback missing: %#v %v", content.CTAs[0], err)
	}
	// Existing published content stays readable after the product's page contract
	// changes, but its now-invalid CTA must have no clickable fallback.
	if err := s.db.Model(&domain.KenFutProduct{}).Where("id=?", "reference-product").Update("pages", `[{"key":"start","name":"开始使用","path":"/__test/reference-product","parameters":[]}]`).Error; err != nil {
		t.Fatal(err)
	}
	content = read()
	if content.Content == "" || content.CTAs[0].ResolvedURL != "" {
		t.Fatalf("stale CTA remained actionable or hid the article: %#v", content.CTAs[0])
	}
}
