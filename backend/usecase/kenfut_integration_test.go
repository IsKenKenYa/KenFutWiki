package usecase

import (
	"context"
	"errors"
	"net/url"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/chaitin/panda-wiki/domain"
)

func TestValidateKenFutProductOriginsAndPages(t *testing.T) {
	valid := func() domain.KenFutProduct {
		return domain.KenFutProduct{Name: "Reference Product", Origin: "https://app.example.test", Pages: []domain.KenFutProductPage{{Key: "canvas", Name: "Canvas", Path: "/canvas?mode=example#start", Parameters: []string{"template"}}}}
	}
	for _, origin := range []string{"http://example.test", "https://user:password@example.test", "https://example.test/nested", "https://example.test?secret=value", "javascript:alert(1)", "//example.test"} {
		p := valid()
		p.Origin = origin
		if validateKenFutProduct(&p) == nil {
			t.Errorf("unsafe origin accepted: %s", origin)
		}
	}
	for _, path := range []string{"//other.test/path", "/%2F%2Fevil.test", "/\\other.test", "https://other.test/path", "relative"} {
		p := valid()
		p.Pages[0].Path = path
		if validateKenFutProduct(&p) == nil {
			t.Errorf("unsafe page accepted: %s", path)
		}
	}
	p := valid()
	p.Pages = append(p.Pages, p.Pages[0])
	if validateKenFutProduct(&p) == nil {
		t.Fatal("duplicate page keys accepted")
	}
	p = valid()
	p.Pages[0].Parameters = []string{"kf_click_id"}
	if validateKenFutProduct(&p) == nil {
		t.Fatal("reserved attribution parameter declared as business parameter")
	}
	for _, origin := range []string{"https://app.example.test/", "http://localhost:4567", "http://127.0.0.1:4567"} {
		p = valid()
		p.Origin = origin
		if err := validateKenFutProduct(&p); err != nil {
			t.Errorf("valid origin %s rejected: %v", origin, err)
		}
	}
}

func TestResolveKenFutProductPageEncodesAndRestrictsParameters(t *testing.T) {
	p := domain.KenFutProduct{Name: "Reference Product", Origin: "https://app.example.test", Pages: []domain.KenFutProductPage{{Key: "canvas", Name: "Canvas", Path: "/canvas?mode=example#start", Parameters: []string{"template"}}}}
	if err := validateKenFutProduct(&p); err != nil {
		t.Fatal(err)
	}
	target := domain.KenFutLinkTarget{Type: "product", ProductID: "product", PageKey: "canvas", Params: map[string]string{"template": "中文 & another=value"}}
	address, err := resolveKenFutProductPage(p, target, "click-id")
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := url.Parse(address)
	if err != nil {
		t.Fatal(err)
	}
	if parsed.Host != "app.example.test" || parsed.Path != "/canvas" || parsed.Fragment != "start" || parsed.Query().Get("mode") != "example" || parsed.Query().Get("template") != "中文 & another=value" || parsed.Query().Get("kf_click_id") != "click-id" {
		t.Fatalf("target URL components were lost or injected: %s", address)
	}
	for _, params := range []map[string]string{{"redirect_uri": "https://other.test"}, {"kf_click_id": "spoof"}} {
		target.Params = params
		if _, err := resolveKenFutProductPage(p, target, "real-click"); err == nil {
			t.Errorf("undeclared/reserved parameter accepted: %#v", params)
		}
	}
	target.PageKey = "unknown"
	if _, err := resolveKenFutProductPage(p, target, ""); err == nil {
		t.Fatal("unknown product page resolved")
	}
}

func TestKenFutConversionRejectsNonMilestoneAndInvalidEvents(t *testing.T) {
	u := &KenFutIntegrationUsecase{}
	valid := func() domain.KenFutConversionReq {
		return domain.KenFutConversionReq{EventID: uuid.NewString(), EventType: "registered", OccurredAt: time.Now(), SubjectID: "opaque-user"}
	}
	cases := []func(*domain.KenFutConversionReq){func(r *domain.KenFutConversionReq) { r.EventID = "not-an-id" }, func(r *domain.KenFutConversionReq) { r.SubjectID = "" }, func(r *domain.KenFutConversionReq) { r.EventType = "task_started" }, func(r *domain.KenFutConversionReq) { r.EventType = "generation_failed" }, func(r *domain.KenFutConversionReq) { r.OccurredAt = time.Time{} }, func(r *domain.KenFutConversionReq) { r.OccurredAt = time.Now().Add(time.Hour) }, func(r *domain.KenFutConversionReq) { r.OccurredAt = time.Now().Add(-181 * 24 * time.Hour) }, func(r *domain.KenFutConversionReq) { r.ClickID = "not-an-id" }}
	for i, mutate := range cases {
		req := valid()
		mutate(&req)
		if err := u.RecordConversion(context.Background(), domain.KenFutProduct{ID: "product", KBID: "kb"}, req); !errors.Is(err, ErrKenFutInvalid) {
			t.Errorf("case %d was not rejected: %v", i, err)
		}
	}
}

func TestKenFutIntegrationHashIsDeterministicAndNotPlaintext(t *testing.T) {
	value := domain.KenFutConversionReq{EventID: uuid.NewString(), SubjectID: "opaque-subject", EventType: "registered", OccurredAt: time.Now()}
	first := kenFutPayloadHash(value)
	if len(first) != 64 || first != kenFutPayloadHash(value) || first == value.SubjectID {
		t.Fatal("invalid payload fingerprint")
	}
	value.EventType = "first_generation_success"
	if kenFutPayloadHash(value) == first {
		t.Fatal("changing milestone did not change fingerprint")
	}
}
