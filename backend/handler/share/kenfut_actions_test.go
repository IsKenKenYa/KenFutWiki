package share

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/chaitin/panda-wiki/consts"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/handler"
	repo "github.com/chaitin/panda-wiki/repo/pg"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

func actionFixture(t *testing.T) *browserServices {
	t.Helper()
	dsn := os.Getenv("KENFUT_TEST_DSN")
	if dsn == "" {
		t.Skip("KENFUT_TEST_DSN enables isolated PostgreSQL HTTP tests")
	}
	services := newBrowserServices(browserPostgres(t, dsn))
	seedBrowserSite(t, services, "https://docs.example.test", "https://product.example.test")
	return services
}

func TestKenFutClickRetryCannotSwitchCTATarget(t *testing.T) {
	s := actionFixture(t)
	ctx := context.Background()
	const nodeID = "22222222-2222-4222-8222-222222222222"
	metadataRepo := repo.NewKenFutContentRepository(s.db, s.logger)
	metadata, err := metadataRepo.GetDraft(ctx, browserKBID, nodeID)
	if err != nil {
		t.Fatal(err)
	}
	second := metadata.CTAs[0]
	second.ID = "second-target"
	second.Label = "Second action"
	metadata.CTAs = append(metadata.CTAs, second)
	if err := metadataRepo.SaveDraft(ctx, browserKBID, *metadata, "browser-editor"); err != nil {
		t.Fatal(err)
	}
	release := &domain.KBRelease{ID: uuid.NewString(), KBID: browserKBID, Tag: "action-retry", CreatedAt: time.Now()}
	if _, err := s.kb.PublishContentRelease(ctx, release, "browser-editor", []string{nodeID}); err != nil {
		t.Fatal(err)
	}
	content, err := s.content.Detail(ctx, browserKBID, nodeID, 0)
	if err != nil {
		t.Fatal(err)
	}
	e := echo.New()
	registerBrowserHandlers(e, s)
	post := func(path string, body any, want int) {
		t.Helper()
		data, _ := json.Marshal(body)
		request := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(data))
		request.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		request.Header.Set("X-KB-ID", browserKBID)
		request.AddCookie(&http.Cookie{Name: "x-pw-session-id", Value: "action-visitor"})
		response := httptest.NewRecorder()
		e.ServeHTTP(response, request)
		if response.Code != want {
			t.Fatalf("%s: HTTP%d %s", path, response.Code, response.Body.String())
		}
	}
	viewID := uuid.NewString()
	post("/share/kenfut/v1/events/view", domain.KenFutViewReq{EventID: viewID, NodeID: nodeID, NodeReleaseID: content.NodeReleaseID, Channel: "article"}, 200)
	click := domain.KenFutClickReq{EventID: uuid.NewString(), NodeID: nodeID, NodeReleaseID: content.NodeReleaseID, ViewID: viewID}
	path := "/share/kenfut/v1/ctas/" + metadata.CTAs[0].ID + "/click"
	post(path, click, 200)
	post(path, click, 200)
	post("/share/kenfut/v1/ctas/second-target/click", click, 409)
	var count int64
	if err := s.db.Model(&domain.KenFutEvent{}).Where("kind='cta_click'").Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("retry inflated clicks: %d", count)
	}
}

func TestKenFutCommentsRejectForeignOrPrivateNodesBeforeReading(t *testing.T) {
	s := actionFixture(t)
	e := echo.New()
	base := handler.NewBaseHandler(e, s.logger, s.cfg, nil, nil, nil)
	h := &ShareCommentHandler{BaseHandler: base, nodeAccess: s.node}
	e.GET("/comments", h.GetCommentList)
	const nodeID = "22222222-2222-4222-8222-222222222222"
	if err := s.db.Model(&domain.Node{}).Where("id=?", nodeID).Update("permissions", domain.NodePermissions{Visible: consts.NodeAccessPermOpen, Visitable: consts.NodeAccessPermClosed, Answerable: consts.NodeAccessPermClosed}).Error; err != nil {
		t.Fatal(err)
	}
	for _, scope := range []struct {
		kb, node string
		want     domain.PWResponseErrCode
	}{
		{"foreign-site", nodeID, domain.ErrCodeNotFound},
		{browserKBID, "unpublished-or-missing", domain.ErrCodeNotFound},
		{browserKBID, nodeID, domain.ErrCodePermissionDenied},
	} {
		request := httptest.NewRequest(http.MethodGet, "/comments?id="+scope.node, nil)
		request.Header.Set("X-KB-ID", scope.kb)
		response := httptest.NewRecorder()
		e.ServeHTTP(response, request)
		var result domain.PWResponseErrCode
		if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		if result.Code != scope.want.Code {
			t.Fatalf("unexpected scope denial: %s", response.Body.String())
		}
	}
}
