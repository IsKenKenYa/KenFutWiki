package share

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"

	"github.com/chaitin/panda-wiki/domain"
)

func TestKenFutPageVoteHTTP(t *testing.T) {
	s := actionFixture(t)
	e := echo.New()
	registerBrowserHandlers(e, s)
	const nodeID = "22222222-2222-4222-8222-222222222222"

	post := func(vote int16, session string) *httptest.ResponseRecorder {
		t.Helper()
		body, err := json.Marshal(domain.KenFutVoteReq{Vote: vote})
		if err != nil {
			t.Fatal(err)
		}
		req := httptest.NewRequest(http.MethodPost, "/share/v1/node/"+nodeID+"/vote", bytes.NewReader(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		req.Header.Set("X-KB-ID", browserKBID)
		req.AddCookie(&http.Cookie{Name: "x-kfw-session-id", Value: session})
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		return rec
	}
	get := func(session string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(http.MethodGet, "/share/v1/node/"+nodeID+"/vote", nil)
		req.Header.Set("X-KB-ID", browserKBID)
		req.AddCookie(&http.Cookie{Name: "x-kfw-session-id", Value: session})
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		return rec
	}
	decode := func(rec *httptest.ResponseRecorder) []byte {
		t.Helper()
		var reply struct {
			Success bool            `json:"success"`
			Data    json.RawMessage `json:"data"`
		}
		if rec.Code != http.StatusOK || json.Unmarshal(rec.Body.Bytes(), &reply) != nil || !reply.Success {
			t.Fatalf("HTTP%d %s", rec.Code, rec.Body.String())
		}
		return reply.Data
	}
	summaryOf := func(session string) domain.KenFutVoteSummaryResp {
		t.Helper()
		var summary domain.KenFutVoteSummaryResp
		if err := json.Unmarshal(decode(get(session)), &summary); err != nil {
			t.Fatal(err)
		}
		return summary
	}

	if rec := post(1, "voter-a"); rec.Code != http.StatusOK {
		t.Fatalf("first vote: HTTP%d %s", rec.Code, rec.Body.String())
	}
	summary := summaryOf("voter-a")
	if summary.Up != 1 || summary.Down != 0 || summary.Mine != 1 {
		t.Fatalf("summary after up vote: %#v", summary)
	}

	// 同访客改票：计数迁移到反对，总量仍为一票。
	if rec := post(-1, "voter-a"); rec.Code != http.StatusOK {
		t.Fatalf("vote switch: HTTP%d %s", rec.Code, rec.Body.String())
	}
	summary = summaryOf("voter-a")
	if summary.Up != 0 || summary.Down != 1 || summary.Mine != -1 {
		t.Fatalf("summary after vote switch: %#v", summary)
	}

	// 第二位访客投赞同票。
	if rec := post(1, "voter-b"); rec.Code != http.StatusOK {
		t.Fatalf("second visitor vote: HTTP%d %s", rec.Code, rec.Body.String())
	}
	summary = summaryOf("voter-a")
	if summary.Up != 1 || summary.Down != 1 || summary.Mine != -1 {
		t.Fatalf("summary with two visitors: %#v", summary)
	}

	// 非法票向直接拒绝。
	if rec := post(0, "voter-c"); rec.Code != http.StatusOK {
		t.Fatalf("invalid vote must not 500: HTTP%d", rec.Code)
	} else {
		var reply struct {
			Success bool `json:"success"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &reply); err != nil || reply.Success {
			t.Fatalf("invalid vote must fail: %s", rec.Body.String())
		}
	}

	// 不存在的文档按未找到拒绝。
	req := httptest.NewRequest(http.MethodPost, "/share/v1/node/99999999-9999-4999-8999-999999999999/vote", bytes.NewReader([]byte(`{"vote":1}`)))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set("X-KB-ID", browserKBID)
	req.AddCookie(&http.Cookie{Name: "x-kfw-session-id", Value: "voter-c"})
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	var reply struct {
		Success bool `json:"success"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &reply); err != nil || reply.Success {
		t.Fatalf("unknown node vote must fail: HTTP%d %s", rec.Code, rec.Body.String())
	}
}
