package share

import (
	"net/http"
	"testing"

	"github.com/mark3labs/mcp-go/mcp"

	"github.com/chaitin/panda-wiki/domain"
)

func TestMCPBearerToken(t *testing.T) {
	request := &http.Request{Header: http.Header{}}
	request.Header.Set("Authorization", "Bearer kfw_test")
	if got := mcpBearerToken(request); got != "kfw_test" {
		t.Fatalf("bearer token = %q, want kfw_test", got)
	}
	request = &http.Request{Header: http.Header{}}
	request.Header.Set("X-API-Key", "kfw_header")
	if got := mcpBearerToken(request); got != "kfw_header" {
		t.Fatalf("X-API-Key token = %q, want kfw_header", got)
	}
	request = &http.Request{Header: http.Header{}}
	request.Header.Set("Authorization", "Basic abc")
	if got := mcpBearerToken(request); got != "" {
		t.Fatalf("unsupported auth header returned %q", got)
	}
}

func TestMCPToolScopes(t *testing.T) {
	cases := map[string]domain.MCPScope{
		"get_doc":            domain.MCPScopeRead,
		"update_doc":         domain.MCPScopeWrite,
		"publish_docs":       domain.MCPScopePublish,
		"moderate_comment":   domain.MCPScopeOps,
		"get_stats":          domain.MCPScopeOps,
		"audit_contribution": domain.MCPScopeOps,
	}
	for tool, expected := range cases {
		if actual, ok := mcpToolScopes[tool]; !ok || actual != expected {
			t.Fatalf("tool %q scope = %q (exists=%v), want %q", tool, actual, ok, expected)
		}
	}
}

func TestMCPResultText(t *testing.T) {
	result := mcp.NewToolResultText("hello")
	if got := mcpResultText(result); got != "hello" {
		t.Fatalf("mcpResultText = %q, want hello", got)
	}
	if got := mcpResultText(nil); got != "" {
		t.Fatalf("nil result text = %q, want empty", got)
	}
}
