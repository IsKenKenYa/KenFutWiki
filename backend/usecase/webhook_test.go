package usecase

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"testing"

	"github.com/chaitin/panda-wiki/domain"
)

func TestValidWebhookURL(t *testing.T) {
	cases := map[string]bool{
		"https://hooks.example.test/x":         true,
		"http://localhost:9000/hook":           true,
		"http://127.0.0.1:9000/hook":           true,
		"http://hooks.example.test/x":          false,
		"https://user:pass@hooks.example.test": false,
		"ftp://hooks.example.test":             false,
		"":                                     false,
	}
	for raw, want := range cases {
		if got := validWebhookURL(raw); got != want {
			t.Fatalf("validWebhookURL(%q) = %v, want %v", raw, got, want)
		}
	}
}

func TestValidWebhookEvents(t *testing.T) {
	if !validWebhookEvents([]string{domain.WebhookEventNodePublished, domain.WebhookEventCommentCreate}) {
		t.Fatal("valid events must pass")
	}
	if validWebhookEvents(nil) {
		t.Fatal("empty events must fail")
	}
	if validWebhookEvents([]string{domain.WebhookEventNodePublished, domain.WebhookEventNodePublished}) {
		t.Fatal("duplicated events must fail")
	}
	if validWebhookEvents([]string{"unknown.event"}) {
		t.Fatal("unknown event must fail")
	}
}

func TestSignBody(t *testing.T) {
	body := []byte(`{"event":"test"}`)
	if signBody("", body) != "" {
		t.Fatal("empty secret must not sign")
	}
	signature := signBody("shared-secret", body)
	mac := hmac.New(sha256.New, []byte("shared-secret"))
	mac.Write(body)
	want := "sha256=" + hex.EncodeToString(mac.Sum(nil))
	if signature != want {
		t.Fatalf("signature mismatch: %s vs %s", signature, want)
	}
}
