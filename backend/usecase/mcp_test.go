package usecase

import (
	"testing"

	"github.com/chaitin/panda-wiki/domain"
)

func TestMatchesParent(t *testing.T) {
	node := &domain.NodeListItemResp{ParentID: "folder-1"}
	if !matchesParent(node, "") {
		t.Fatal("empty parent filter must match every node")
	}
	if !matchesParent(node, "folder-1") {
		t.Fatal("exact parent filter did not match")
	}
	if matchesParent(node, "folder-2") {
		t.Fatal("different parent filter matched")
	}
	root := &domain.NodeListItemResp{}
	if !matchesParent(root, "root") {
		t.Fatal("root filter did not match a root node")
	}
	if matchesParent(node, "root") {
		t.Fatal("root filter matched a child node")
	}
}

func TestMatchesStatus(t *testing.T) {
	published := &domain.NodeListItemResp{Status: domain.NodeStatusPublished}
	draft := &domain.NodeListItemResp{Status: domain.NodeStatusDraft}
	if !matchesStatus(published, "published") || matchesStatus(published, "draft") {
		t.Fatal("published status filter failed")
	}
	if !matchesStatus(draft, "draft") || matchesStatus(draft, "published") {
		t.Fatal("draft status filter failed")
	}
	if !matchesStatus(draft, "all") || !matchesStatus(draft, "") {
		t.Fatal("all status filter failed")
	}
	if matchesStatus(draft, "unknown") {
		t.Fatal("unknown status must not match")
	}
}

func TestTruncateRunes(t *testing.T) {
	if got := truncateRunes("你好世界", 2); got != "你好..." {
		t.Fatalf("truncateRunes = %q, want %q", got, "你好...")
	}
	if got := truncateRunes("short", 10); got != "short" {
		t.Fatalf("truncateRunes changed a short string: %q", got)
	}
}
