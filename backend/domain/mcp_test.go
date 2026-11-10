package domain

import (
	"testing"

	"github.com/chaitin/panda-wiki/consts"
)

func TestScopesForKBPermission(t *testing.T) {
	cases := []struct {
		permission consts.UserKBPermission
		expected   map[MCPScope]bool
	}{
		{
			permission: consts.UserKBPermissionFullControl,
			expected: map[MCPScope]bool{
				MCPScopeRead: true, MCPScopeWrite: true, MCPScopePublish: true, MCPScopeOps: true,
			},
		},
		{
			permission: consts.UserKBPermissionDocManage,
			expected: map[MCPScope]bool{
				MCPScopeRead: true, MCPScopeWrite: true, MCPScopePublish: true,
			},
		},
		{
			permission: consts.UserKBPermissionDataOperate,
			expected: map[MCPScope]bool{
				MCPScopeRead: true, MCPScopeOps: true,
			},
		},
		{
			permission: consts.UserKBPermissionNull,
			expected:   map[MCPScope]bool{},
		},
	}
	for _, tc := range cases {
		actual := ScopesForKBPermission(tc.permission)
		if len(actual) != len(tc.expected) {
			t.Fatalf("permission %q returned %d scopes, want %d", tc.permission, len(actual), len(tc.expected))
		}
		for scope, expected := range tc.expected {
			if actual[scope] != expected {
				t.Fatalf("permission %q scope %q = %v, want %v", tc.permission, scope, actual[scope], expected)
			}
		}
	}
}

func TestMCPAuthInfoHasScope(t *testing.T) {
	var nilInfo *MCPAuthInfo
	if nilInfo.HasScope(MCPScopeRead) {
		t.Fatal("nil auth info must not grant scopes")
	}
	info := &MCPAuthInfo{Scopes: map[MCPScope]bool{MCPScopeRead: true}}
	if !info.HasScope(MCPScopeRead) {
		t.Fatal("read scope was not granted")
	}
	if info.HasScope(MCPScopeWrite) {
		t.Fatal("write scope must not be granted")
	}
}

func TestDecodeMCPJSON(t *testing.T) {
	value, err := DecodeMCPJSON[map[string]any](MCPJSON(`{"node_id":"n1"}`))
	if err != nil {
		t.Fatal(err)
	}
	if (*value)["node_id"] != "n1" {
		t.Fatalf("unexpected decoded value: %#v", *value)
	}
	if _, err := DecodeMCPJSON[map[string]any](nil); err == nil {
		t.Fatal("empty result must return an error")
	}
}

func TestNormalizeMCPLimit(t *testing.T) {
	if got := NormalizeMCPLimit(0, 20, 50); got != 20 {
		t.Fatalf("zero limit = %d, want 20", got)
	}
	if got := NormalizeMCPLimit(500, 20, 50); got != 50 {
		t.Fatalf("oversized limit = %d, want 50", got)
	}
	if got := NormalizeMCPLimit(10, 20, 50); got != 10 {
		t.Fatalf("valid limit = %d, want 10", got)
	}
}
