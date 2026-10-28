package v1

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/chaitin/panda-wiki/domain"
	repo "github.com/chaitin/panda-wiki/repo/pg"
	storePG "github.com/chaitin/panda-wiki/store/pg"
	"github.com/chaitin/panda-wiki/usecase"
)

func TestKenFutHTTPErrorStatuses(t *testing.T) {
	cases := []struct {
		err    error
		status int
	}{{usecase.ErrKenFutInvalid, http.StatusBadRequest}, {usecase.ErrKenFutUnauthorized, http.StatusUnauthorized}, {repo.ErrKenFutEventConflict, http.StatusConflict}, {gorm.ErrRecordNotFound, http.StatusNotFound}, {domain.ErrPermissionDenied, http.StatusForbidden}, {errors.New("private diagnostic"), http.StatusInternalServerError}}
	for _, tc := range cases {
		rec := httptest.NewRecorder()
		c := echo.New().NewContext(httptest.NewRequest(http.MethodGet, "/", nil), rec)
		if err := kenFutResponse(c, nil, tc.err); err != nil {
			t.Fatal(err)
		}
		if rec.Code != tc.status {
			t.Fatalf("error %v returned %d, want %d", tc.err, rec.Code, tc.status)
		}
		if tc.status == http.StatusInternalServerError && strings.Contains(rec.Body.String(), "private diagnostic") {
			t.Fatal("internal diagnostics leaked to client")
		}
	}
}

func TestKenFutPublicSessionCookie(t *testing.T) {
	e := echo.New()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "https://docs.example.test/", nil)
	c := e.NewContext(req, rec)
	id := kenFutSession(c)
	if _, err := uuid.Parse(id); err != nil {
		t.Fatal("session identifier is not random UUID")
	}
	cookies := rec.Result().Cookies()
	if len(cookies) != 1 || !cookies[0].HttpOnly || !cookies[0].Secure || cookies[0].SameSite != http.SameSiteLaxMode {
		t.Fatalf("incorrect session cookie: %#v", cookies)
	}
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "https://docs.example.test/", nil)
	req.AddCookie(cookies[0])
	c = e.NewContext(req, rec)
	if reused := kenFutSession(c); reused != id {
		t.Fatal("existing anonymous identity was discarded")
	}
}

func handlerIntegrationFixture(t *testing.T) (*KenFutIntegrationHandler, *storePG.DB, string) {
	t.Helper()
	dsn := os.Getenv("KENFUT_TEST_DSN")
	if dsn == "" {
		t.Skip("KENFUT_TEST_DSN is required for HTTP/PostgreSQL integration tests")
	}
	base, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	schema := "kenfut_http_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if err := base.Exec("CREATE SCHEMA " + schema).Error; err != nil {
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
	if err := db.Exec("CREATE TABLE knowledge_bases(id text PRIMARY KEY); INSERT INTO knowledge_bases(id) VALUES('kb'); CREATE TABLE kenfut_content_releases(node_release_id text PRIMARY KEY,metadata jsonb);").Error; err != nil {
		t.Fatal(err)
	}
	migration, err := os.ReadFile("../../store/pg/kenfut_migration/000002_integration.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Exec(string(migration)).Error; err != nil {
		t.Fatal(err)
	}
	product := &domain.KenFutProduct{ID: "product-a", KBID: "kb", Name: "Reference Product", Origin: "https://app.example.test", Enabled: true, Pages: []domain.KenFutProductPage{}, CreatedAt: time.Now(), UpdatedAt: time.Now()}
	if err := db.Create(product).Error; err != nil {
		t.Fatal(err)
	}
	token := "kfi_reference-server-token"
	hash := sha256.Sum256([]byte(token))
	key := &domain.KenFutCredential{ID: "key", ProductID: product.ID, TokenHash: hex.EncodeToString(hash[:]), Scopes: []string{"analytics:read"}, CreatedAt: time.Now()}
	if err := db.Create(key).Error; err != nil {
		t.Fatal(err)
	}
	wrapped := &storePG.DB{DB: db}
	u := usecase.NewKenFutIntegrationUsecase(repo.NewKenFutIntegrationRepository(wrapped), nil)
	return &KenFutIntegrationHandler{u: u}, wrapped, token
}

func TestKenFutProductFunnelHTTPIsolationAndScope(t *testing.T) {
	h, db, token := handlerIntegrationFixture(t)
	request := func(path string, handler echo.HandlerFunc) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		if err := handler(echo.New().NewContext(req, rec)); err != nil {
			t.Fatal(err)
		}
		return rec
	}
	if rec := request("/integration/kenfut/v1/funnel?product_id=product-b", h.ProductFunnel); rec.Code != http.StatusForbidden {
		t.Fatalf("cross-product query returned %d: %s", rec.Code, rec.Body.String())
	}
	rec := request("/integration/kenfut/v1/funnel?kb_id=other-kb", h.ProductFunnel)
	if rec.Code != http.StatusOK {
		t.Fatalf("credential did not pin its own site: %d %s", rec.Code, rec.Body.String())
	}
	var response struct {
		Success bool                    `json:"success"`
		Data    domain.KenFutFunnelResp `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil || !response.Success || response.Data.Clicks != 0 {
		t.Fatalf("invalid own-product report %s: %v", rec.Body.String(), err)
	}
	if rec := request("/integration/kenfut/v1/events", h.Conversion); rec.Code != http.StatusUnauthorized {
		t.Fatalf("analytics-only credential wrote conversion: %d %s", rec.Code, rec.Body.String())
	}
	if err := db.Model(&domain.KenFutCredential{}).Where("id=?", "key").Update("revoked_at", time.Now()).Error; err != nil {
		t.Fatal(err)
	}
	if rec := request("/integration/kenfut/v1/funnel", h.ProductFunnel); rec.Code != http.StatusUnauthorized {
		t.Fatalf("revoked credential returned %d", rec.Code)
	}
}
