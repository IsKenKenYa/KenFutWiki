package share

// This opt-in loopback server exercises real PostgreSQL repositories, publication
// and content handlers behind a fixed anonymous test site. It deliberately does
// not claim acceptance of production authentication, Redis, RAG, S3 or NATS.

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormLogger "gorm.io/gorm/logger"

	"github.com/chaitin/panda-wiki/config"
	"github.com/chaitin/panda-wiki/consts"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/handler"
	adminV1 "github.com/chaitin/panda-wiki/handler/v1"
	"github.com/chaitin/panda-wiki/log"
	repo "github.com/chaitin/panda-wiki/repo/pg"
	storePG "github.com/chaitin/panda-wiki/store/pg"
	"github.com/chaitin/panda-wiki/usecase"
)

const browserKBID = "browser-kb"

const browserProductToken = "kfi_reference-browser-test-only"

// browserAuth is only installed in this explicitly enabled loopback fixture.
// It grants the synthetic editor access to this fixture KB, not to production.
type browserAuth struct{}

func (browserAuth) Authorize(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		ctx := context.WithValue(c.Request().Context(), domain.CtxAuthInfoKey, &domain.CtxAuthInfo{UserId: "browser-editor", KBId: browserKBID, Permission: consts.UserKBPermissionFullControl})
		c.SetRequest(c.Request().WithContext(ctx))
		return next(c)
	}
}
func (browserAuth) ValidateKBUserPerm(_ consts.UserKBPermission) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			kbID := c.QueryParam("kb_id")
			if kbID == "" {
				var body map[string]any
				if c.Request().Body != nil {
					data, err := io.ReadAll(c.Request().Body)
					if err != nil {
						return err
					}
					c.Request().Body = io.NopCloser(bytes.NewReader(data))
					if json.Unmarshal(data, &body) == nil {
						kbID, _ = body["kb_id"].(string)
					}
				}
			}
			if kbID != browserKBID {
				return c.NoContent(http.StatusForbidden)
			}
			return next(c)
		}
	}
}
func (browserAuth) ValidateUserRole(_ consts.UserRole) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc { return next }
}
func (browserAuth) ValidateLicenseEdition(_ ...consts.LicenseEdition) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc { return next }
}
func (browserAuth) MustGetUserID(_ echo.Context) (string, bool) { return "browser-editor", true }

func browserPostgres(t *testing.T, dsn string) *storePG.DB {
	t.Helper()
	base, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: gormLogger.Default.LogMode(gormLogger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	schema := "kenfut_browser_" + strings.ReplaceAll(uuid.NewString(), "-", "")
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
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: gormLogger.Default.LogMode(gormLogger.Silent)})
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
	if err := db.AutoMigrate(&domain.KnowledgeBase{}, &domain.Node{}, &domain.NodeRelease{}, &domain.KBRelease{}, &domain.KBReleaseNodeRelease{}, &domain.Nav{}, &domain.NavRelease{}, &domain.NodeStats{}, &domain.User{}, &domain.App{}, &domain.AuthGroup{}, &domain.StatPage{}); err != nil {
		t.Fatal(err)
	}
	// The upstream Comment model's unquoted array default is unsuitable for
	// AutoMigrate; use the same PostgreSQL shape as its checked-in migration.
	if err := db.Exec(`CREATE TABLE comments(id text PRIMARY KEY,kb_id text,user_id text,node_id text,info jsonb,parent_id text,root_id text,content text,status smallint,pic_urls text[] NOT NULL DEFAULT '{}',created_at timestamptz)`).Error; err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"000001_content.up.sql", "000002_integration.up.sql"} {
		data, err := os.ReadFile("../../store/pg/kenfut_migration/" + name)
		if err != nil {
			t.Fatal(err)
		}
		if err := db.Exec(string(data)).Error; err != nil {
			t.Fatal(err)
		}
	}
	return &storePG.DB{DB: db}
}

type browserServices struct {
	db          *storePG.DB
	kb          *repo.KnowledgeBaseRepository
	app         *repo.AppRepository
	node        *usecase.NodeUsecase
	content     *usecase.KenFutContentUsecase
	integration *usecase.KenFutIntegrationUsecase
	logger      *log.Logger
	cfg         *config.Config
	apiURL      string
}

func newBrowserServices(db *storePG.DB) *browserServices {
	cfg := &config.Config{}
	logger := log.NewLogger(cfg)
	// Construct before seeding the KB so its production constructor has no Caddy
	// configuration to synchronize. All browser content remains real DB data.
	kb := repo.NewKnowledgeBaseRepository(db, cfg, logger, nil)
	nodes := repo.NewNodeRepository(db, logger)
	navs := repo.NewNavRepository(db, logger)
	apps := repo.NewAppRepository(db, logger)
	users := repo.NewUserRepository(db, logger)
	auth := repo.NewAuthRepo(db, logger, nil)
	node := usecase.NewNodeUsecase(nodes, navs, apps, nil, users, kb, nil, nil, logger, nil, nil, auth, nil)
	content := usecase.NewKenFutContentUsecase(repo.NewKenFutContentRepository(db, logger), node, kb)
	integration := usecase.NewKenFutIntegrationUsecase(repo.NewKenFutIntegrationRepository(db), content)
	return &browserServices{db: db, kb: kb, app: apps, node: node, content: content, integration: integration, logger: logger, cfg: cfg}
}

func seedBrowserSite(t *testing.T, s *browserServices, siteURL, apiURL string) {
	t.Helper()
	s.apiURL = apiURL
	now := time.Now()
	kb := domain.KnowledgeBase{ID: browserKBID, Name: "KenFutWiki browser fixture", AccessSettings: domain.AccessSettings{BaseURL: strings.TrimRight(siteURL, "/")}, CreatedAt: now, UpdatedAt: now}
	if err := s.db.Create(&kb).Error; err != nil {
		t.Fatal(err)
	}
	if err := s.db.Create(&domain.User{ID: "browser-editor", Account: "编辑者", CreatedAt: now}).Error; err != nil {
		t.Fatal(err)
	}
	if err := s.db.Create(&domain.Nav{ID: "browser-nav", KbID: browserKBID, Name: "产品文档", CreatedAt: now, UpdatedAt: now}).Error; err != nil {
		t.Fatal(err)
	}
	showBrand := false
	app := domain.App{ID: "browser-app", KBID: browserKBID, Type: domain.AppTypeWeb, Name: "KenFutWiki", Settings: domain.AppSettings{Title: "KenFutWiki", Desc: "公开文档、文章与转化接入", ThemeMode: "light", HomePageSetting: consts.HomePageSettingDoc, ThemeAndStyle: domain.ThemeAndStyle{DocWidth: "normal"}, CatalogSettings: domain.CatalogSettings{CatalogVisible: 1, CatalogWidth: 260}, FooterSettings: domain.FooterSettings{BrandName: "KenFutWiki", BrandDesc: "开源内容与运营平台", CorpName: "Reference Publisher"}, WebAppCustomSettings: domain.WebAppCustomSettings{ShowBrandInfo: &showBrand, HeaderPlaceholder: "搜索文档或文章"}, WebAppCommentSettings: domain.WebAppCommentSettings{IsEnable: true, ModerationEnable: true}, StatsSetting: domain.StatsSetting{PVEnable: true}, Btns: []any{map[string]any{"id": "blog", "text": "文章", "url": "/blog", "type": "text", "target": "_self"}}}}
	if err := s.db.Create(&app).Error; err != nil {
		t.Fatal(err)
	}
	product := domain.KenFutProduct{ID: "reference-product", KBID: browserKBID, Name: "Reference Product", Origin: apiURL, Enabled: true, Pages: []domain.KenFutProductPage{{Key: "start", Name: "开始使用", Path: "/__test/reference-product", Parameters: []string{"template"}}}, CreatedAt: now, UpdatedAt: now}
	if err := s.db.Create(&product).Error; err != nil {
		t.Fatal(err)
	}
	hash := sha256.Sum256([]byte(browserProductToken))
	if err := s.db.Create(&domain.KenFutCredential{ID: "browser-product-key", ProductID: product.ID, TokenHash: hex.EncodeToString(hash[:]), Scopes: []string{"conversion:write", "analytics:read"}, CreatedAt: now}).Error; err != nil {
		t.Fatal(err)
	}
	if err := s.db.Exec(`CREATE TABLE kenfut_reference_users(id text PRIMARY KEY,click_id text NOT NULL,created_at timestamptz NOT NULL); CREATE TABLE kenfut_reference_generations(id text PRIMARY KEY,user_id text UNIQUE NOT NULL,created_at timestamptz NOT NULL,output text NOT NULL)`).Error; err != nil {
		t.Fatal(err)
	}
	body := "# 使用指南\n\n欢迎使用 KenFutWiki。这里展示真实数据库发布的正文。\n\n"
	for i := 1; i <= 12; i++ {
		body += fmt.Sprintf("## 第%d步：模型生成\n\n%s\n\n", i, strings.Repeat("发布的产品文档支持关键词搜索、页面选择与文章推荐。", 8))
	}
	items := []struct {
		id, title, channel, slug, category string
		featured                           bool
	}{{"11111111-1111-4111-8111-111111111111", "快速入门", "docs", "", "文档", false}, {"22222222-2222-4222-8222-222222222222", "模型生成教程", "both", "model-guide", "教程", true}, {"33333333-3333-4333-8333-333333333333", "产品更新", "article", "release-notes", "产品更新", true}}
	metadataRepo := repo.NewKenFutContentRepository(s.db, s.logger)
	ids := []string{}
	for i, item := range items {
		node := domain.Node{ID: item.id, KBID: browserKBID, NavId: "browser-nav", Name: item.title, Content: body, Type: domain.NodeTypeDocument, Status: domain.NodeStatusUnreleased, Meta: domain.NodeMeta{Summary: "KenFutWiki 已发布内容，支持文档与文章双入口。", ContentType: "md"}, Position: float64(i + 1), CreatorId: "browser-editor", EditorId: "browser-editor", CreatedAt: now.Add(-24 * time.Hour), UpdatedAt: now, Permissions: domain.NodePermissions{Visible: consts.NodeAccessPermOpen, Visitable: consts.NodeAccessPermOpen, Answerable: consts.NodeAccessPermOpen}}
		if err := s.db.Create(&node).Error; err != nil {
			t.Fatal(err)
		}
		metadata := domain.DefaultKenFutContentMetadata(item.id)
		metadata.Channel = item.channel
		metadata.Slug = item.slug
		metadata.Category = item.category
		metadata.Tags = []string{"API", "模型"}
		metadata.AuthorName = "KenFut 编辑团队"
		metadata.Featured = item.featured
		metadata.FeaturedOrder = i
		metadata.CoverURL = apiURL + "/__test/cover.svg"
		metadata.RelatedNodeIDs = []string{"11111111-1111-4111-8111-111111111111", "33333333-3333-4333-8333-333333333333"}
		if item.channel != "docs" {
			metadata.CTAs = []domain.KenFutCTA{{ID: "try-" + item.id, Label: "马上试用", Style: "primary", Target: domain.KenFutLinkTarget{Type: "product", ProductID: product.ID, PageKey: "start", Params: map[string]string{"template": "example"}}}}
		}
		if err := metadataRepo.SaveDraft(context.Background(), browserKBID, metadata, "browser-editor"); err != nil {
			t.Fatal(err)
		}
		ids = append(ids, item.id)
	}
	release := &domain.KBRelease{ID: uuid.NewString(), KBID: browserKBID, Tag: "browser-fixture", PublisherId: "browser-editor", CreatedAt: now}
	if _, err := s.kb.PublishContentRelease(context.Background(), release, "browser-editor", ids); err != nil {
		t.Fatal(err)
	}
	comment := domain.Comment{ID: uuid.NewString(), KbID: browserKBID, NodeID: items[1].id, Content: "已审核的公开评论", Status: domain.CommentStatusAccepted, Info: domain.CommentInfo{UserName: "读者"}, CreatedAt: now}
	if err := s.db.Create(&comment).Error; err != nil {
		t.Fatal(err)
	}
}

func registerBrowserHandlers(e *echo.Echo, s *browserServices) {
	base := handler.NewBaseHandler(e, s.logger, s.cfg, nil, nil, nil)
	content := &ShareKenFutContentHandler{usecase: s.content, integration: s.integration}
	e.GET("/share/kenfut/v1/contents", content.List)
	e.GET("/share/kenfut/v1/contents/:node_id", content.Detail)
	e.GET("/share/kenfut/v1/contents/:node_id/related", content.Related)
	e.GET("/share/kenfut/v1/articles/:slug", content.Article)
	e.GET("/share/kenfut/v1/pages", content.Pages)
	e.GET("/share/kenfut/v1/taxonomies", content.Taxonomies)
	legacy := &ShareNodeHandler{BaseHandler: base, logger: s.logger, usecase: s.node}
	e.GET("/share/v1/node/detail", legacy.GetNodeDetail)
	e.GET("/share/v1/node/list", legacy.ShareNodeList)
	e.GET("/share/v1/app/web/info", func(c echo.Context) error {
		app, err := s.app.GetOrCreateAppByKBIDAndType(c.Request().Context(), browserKBID, domain.AppTypeWeb)
		if err != nil {
			return err
		}
		kb, err := s.kb.GetKnowledgeBaseByID(c.Request().Context(), browserKBID)
		if err != nil {
			return err
		}
		return c.JSON(http.StatusOK, domain.PWResponse{Success: true, Data: map[string]any{"name": app.Name, "settings": app.Settings, "base_url": kb.AccessSettings.BaseURL}})
	})
	e.GET("/share/v1/nav/list", func(c echo.Context) error {
		items, err := repo.NewNavRepository(s.db, s.logger).GetReleaseList(c.Request().Context(), browserKBID)
		if err != nil {
			return err
		}
		return c.JSON(http.StatusOK, domain.PWResponse{Success: true, Data: items})
	})
	e.GET("/share/v1/comment/list", func(c echo.Context) error {
		items := []domain.ShareCommentListItem{}
		if err := s.db.WithContext(c.Request().Context()).Table("comments").Where("kb_id=? AND node_id=? AND status=1", browserKBID, c.QueryParam("id")).Order("created_at DESC").Find(&items).Error; err != nil {
			return err
		}
		return c.JSON(http.StatusOK, domain.PWResponse{Success: true, Data: items})
	})
	actualIntegration := adminV1.NewKenFutIntegrationHandler(e, s.integration, browserAuth{}, base)
	// Replace only the fixture's anonymous view/click middleware. These still
	// execute the production HTTP methods and all real DB/usecase validation.
	e.POST("/share/kenfut/v1/events/view", actualIntegration.View)
	e.POST("/share/kenfut/v1/ctas/:id/click", actualIntegration.Click)
	e.GET("/sitemap.xml", func(c echo.Context) error {
		value, err := usecase.NewSitemapUsecase(repo.NewNodeRepository(s.db, s.logger), s.kb, s.logger).GetSitemap(c.Request().Context(), browserKBID)
		if err != nil {
			return err
		}
		return c.Blob(http.StatusOK, "application/xml", []byte(value))
	})
	e.GET("/__test/cover.svg", func(c echo.Context) error {
		return c.Blob(http.StatusOK, "image/svg+xml", []byte(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#214ecc"/><text x="50" y="190" font-family="sans-serif" font-size="64" fill="white">KenFutWiki</text></svg>`))
	})
	e.GET("/__test/reference-product", browserReferencePage)
	e.POST("/__test/reference-product/register", func(c echo.Context) error { return browserReferenceMilestone(c, s, "registered") })
	e.POST("/__test/reference-product/generate", func(c echo.Context) error { return browserReferenceMilestone(c, s, "first_generation_success") })
}

func browserReferencePage(c echo.Context) error {
	subject := browserReferenceSubject(c)
	click := html.EscapeString(c.QueryParam("kf_click_id"))
	page := `<html><head><meta charset="utf-8"><title>Reference Product</title></head><body><h1>Reference Product</h1><p>通用参考产品：真实本地注册与可控成功任务；不调用付费模型。</p><p>测试用户 ` + html.EscapeString(subject) + `</p><form method="post" action="/__test/reference-product/register"><input type="hidden" name="kf_click_id" value="` + click + `"><button>注册示例账号</button></form><form method="post" action="/__test/reference-product/generate"><input type="hidden" name="kf_click_id" value="` + click + `"><button>完成首次生成</button></form></body></html>`
	return c.HTML(http.StatusOK, page)
}

func browserReferenceSubject(c echo.Context) string {
	if cookie, err := c.Cookie("kenfut-reference-user"); err == nil && cookie.Value != "" {
		return cookie.Value
	}
	id := uuid.NewString()
	c.SetCookie(&http.Cookie{Name: "kenfut-reference-user", Value: id, Path: "/", HttpOnly: true, SameSite: http.SameSiteLaxMode})
	return id
}

func browserReferenceMilestone(c echo.Context, s *browserServices, kind string) error {
	subject, click := browserReferenceSubject(c), c.FormValue("kf_click_id")
	var eventID string
	var occurred time.Time
	if kind == "registered" {
		if err := s.db.WithContext(c.Request().Context()).Exec("INSERT INTO kenfut_reference_users(id,click_id,created_at) VALUES(?,?,now()) ON CONFLICT DO NOTHING", subject, click).Error; err != nil {
			return err
		}
		var record struct {
			ID        string
			ClickID   string
			CreatedAt time.Time
		}
		if err := s.db.Table("kenfut_reference_users").Where("id=?", subject).First(&record).Error; err != nil {
			return err
		}
		eventID, click, occurred = record.ID, record.ClickID, record.CreatedAt
	} else {
		var count int64
		if err := s.db.Table("kenfut_reference_users").Where("id=?", subject).Count(&count).Error; err != nil {
			return err
		}
		if count == 0 {
			return c.HTML(http.StatusConflict, "<p>请先注册示例账号。</p>")
		}
		if err := s.db.Exec("INSERT INTO kenfut_reference_generations(id,user_id,created_at,output) VALUES(?,?,now(),?) ON CONFLICT(user_id) DO NOTHING", uuid.NewString(), subject, "Reference generation completed").Error; err != nil {
			return err
		}
		var record struct {
			ID        string
			CreatedAt time.Time
		}
		if err := s.db.Table("kenfut_reference_generations").Where("user_id=?", subject).First(&record).Error; err != nil {
			return err
		}
		eventID, occurred = record.ID, record.CreatedAt
	}
	data, err := json.Marshal(domain.KenFutConversionReq{EventID: eventID, EventType: kind, SubjectID: subject, ClickID: click, OccurredAt: occurred})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(c.Request().Context(), http.MethodPost, s.apiURL+"/integration/kenfut/v1/events", bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+browserProductToken)
	response, err := (&http.Client{Timeout: 5 * time.Second}).Do(req)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return c.HTML(http.StatusBadGateway, "<p>转化回传失败。</p>")
	}
	return c.HTML(http.StatusOK, "<h1>Reference Product</h1><p>"+html.EscapeString(kind)+" 已通过真实 HTTP 接口回传。</p><a href=\"/__test/reference-product?kf_click_id="+url.QueryEscape(click)+"\">继续</a>")
}

func TestKenFutBrowserServer(t *testing.T) {
	dsn, addr := os.Getenv("KENFUT_BROWSER_TEST_DSN"), os.Getenv("KENFUT_BROWSER_ADDR")
	if dsn == "" || addr == "" {
		t.Skip("explicit KENFUT_BROWSER_TEST_DSN and KENFUT_BROWSER_ADDR enable the isolated browser fixture")
	}
	host, _, err := net.SplitHostPort(addr)
	if err != nil || (host != "127.0.0.1" && host != "localhost" && host != "::1") {
		t.Fatal("browser fixture must bind loopback with explicit port")
	}
	siteURL := os.Getenv("KENFUT_BROWSER_SITE_URL")
	if siteURL == "" {
		siteURL = "http://127.0.0.1:3010"
	}
	db := browserPostgres(t, dsn)
	services := newBrowserServices(db)
	seedBrowserSite(t, services, siteURL, "http://"+addr)
	e := echo.New()
	e.HideBanner = true
	e.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error { c.Request().Header.Set("X-KB-ID", browserKBID); return next(c) }
	})
	registerBrowserHandlers(e, services)
	done := make(chan struct{})
	var stop sync.Once
	e.GET("/__test/health", func(c echo.Context) error {
		kb, err := services.kb.GetKnowledgeBaseByID(c.Request().Context(), browserKBID)
		if err != nil {
			return err
		}
		return c.JSON(http.StatusOK, map[string]string{"kb_id": browserKBID, "site_url": kb.AccessSettings.BaseURL})
	})
	e.POST("/__test/site-url", func(c echo.Context) error {
		var req struct {
			URL string `json:"url"`
		}
		if err := c.Bind(&req); err != nil {
			return c.NoContent(http.StatusBadRequest)
		}
		initial, err := url.Parse(siteURL)
		if err != nil {
			return err
		}
		candidate, err := url.Parse(req.URL)
		if err != nil || candidate.Scheme != initial.Scheme || candidate.Host != initial.Host || candidate.User != nil || candidate.RawQuery != "" || candidate.Fragment != "" || strings.HasPrefix(candidate.Path, "//") || strings.Contains(candidate.Path, "\\") {
			return c.NoContent(http.StatusBadRequest)
		}
		if err := db.WithContext(c.Request().Context()).Model(&domain.KnowledgeBase{}).Where("id=?", browserKBID).Update("access_settings", gorm.Expr("jsonb_set(access_settings,'{base_url}',to_jsonb(?::text))", strings.TrimRight(candidate.String(), "/"))).Error; err != nil {
			return err
		}
		return c.NoContent(http.StatusNoContent)
	})
	e.POST("/__test/stop", func(c echo.Context) error { stop.Do(func() { close(done) }); return c.NoContent(http.StatusNoContent) })
	server := &http.Server{Addr: addr, Handler: e, ReadHeaderTimeout: 5 * time.Second}
	errorsCh := make(chan error, 1)
	go func() { errorsCh <- server.ListenAndServe() }()
	t.Logf("real PostgreSQL browser fixture ready: API=http://%s KBID=%s slug=model-guide article-only=release-notes", addr, browserKBID)
	select {
	case <-done:
	case err := <-errorsCh:
		if !errors.Is(err, http.ErrServerClosed) {
			t.Fatal(err)
		}
	case <-time.After(20 * time.Minute):
		t.Error("browser fixture expired after 20 minutes")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		t.Fatal(err)
	}
}
