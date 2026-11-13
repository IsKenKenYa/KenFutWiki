package pg

import (
	"context"
	"os"
	"testing"

	"github.com/chaitin/panda-wiki/config"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/log"
)

// TestNodeListCarriesChannel 校验管理端文档列表带出运营元数据中的展示入口。
func TestNodeListCarriesChannel(t *testing.T) {
	dsn := os.Getenv("KENFUT_TEST_DSN")
	if dsn == "" {
		t.Skip("KENFUT_TEST_DSN is required for PostgreSQL integration tests")
	}
	db := contentTestDB(t)
	logger := log.NewLogger(&config.Config{})
	repo := NewNodeRepository(db, logger)
	contentRepo := NewKenFutContentRepository(db, logger)
	ctx := context.Background()

	contentFixture(t, db, "channel-node", "标题", "正文")
	if err := contentRepo.SaveDraft(ctx, "kb", domain.KenFutContentMetadata{
		NodeID:  "channel-node",
		Channel: "article",
		Slug:    "article-slug",
		Tags:    []string{},
	}, "editor"); err != nil {
		t.Fatal(err)
	}

	nodes, err := repo.GetNodeListByStatus(ctx, "kb", "", "")
	if err != nil {
		t.Fatal(err)
	}
	var found *domain.NodeListItemResp
	for _, node := range nodes {
		if node.ID == "channel-node" {
			found = node
		}
	}
	if found == nil {
		t.Fatal("channel node missing from list")
	}
	if found.Channel != "article" {
		t.Fatalf("channel must come from draft metadata: %q", found.Channel)
	}

	// 未配置元数据的文档默认 docs。
	contentFixture(t, db, "plain-node", "普通文档", "正文")
	nodes, err = repo.GetNodeListByStatus(ctx, "kb", "", "")
	if err != nil {
		t.Fatal(err)
	}
	for _, node := range nodes {
		if node.ID == "plain-node" && node.Channel != "docs" {
			t.Fatalf("default channel must be docs: %q", node.Channel)
		}
	}
}
