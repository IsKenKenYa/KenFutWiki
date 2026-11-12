package pg

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/chaitin/panda-wiki/config"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/log"
)

// TestGetKBReleaseContents 校验版本内容快照的分页查询与归属校验。
func TestGetKBReleaseContents(t *testing.T) {
	dsn := os.Getenv("KENFUT_TEST_DSN")
	if dsn == "" {
		t.Skip("KENFUT_TEST_DSN is required for PostgreSQL integration tests")
	}
	db := contentTestDB(t)
	// 绕开生产构造函数：它会同步 Caddy 配置，测试环境没有该依赖。
	repo := &KnowledgeBaseRepository{db: db, config: &config.Config{}, logger: log.NewLogger(&config.Config{})}
	ctx := context.Background()

	now := time.Now()
	release := &domain.KBRelease{ID: "release-1", KBID: "kb", Tag: "v1", PublisherId: "editor", CreatedAt: now}
	if err := repo.CreateKBRelease(ctx, release); err != nil {
		t.Fatal(err)
	}
	otherRelease := &domain.KBRelease{ID: "release-2", KBID: "kb", Tag: "v2", PublisherId: "editor", CreatedAt: now}
	if err := repo.CreateKBRelease(ctx, otherRelease); err != nil {
		t.Fatal(err)
	}

	names := []string{"安装指南", "快速入门", "版本说明"}
	for i, name := range names {
		nodeRelease := &domain.NodeRelease{
			ID: "nr-" + name, KBID: "kb", NodeID: "node-" + name,
			Type: domain.NodeTypeDocument, Name: name,
			Meta: domain.NodeMeta{Summary: "摘要", ContentType: "md"},
			Content: "正文 " + name, Position: float64(i + 1),
			CreatedAt: now, UpdatedAt: now,
		}
		if err := db.Create(nodeRelease).Error; err != nil {
			t.Fatal(err)
		}
		link := &domain.KBReleaseNodeRelease{ID: "link-" + name, KBID: "kb", ReleaseID: "release-1", NodeID: "node-" + name, NodeReleaseID: "nr-" + name, CreatedAt: now}
		if err := db.Create(link).Error; err != nil {
			t.Fatal(err)
		}
	}
	// 其他版本一个关联、以及一个其他站点的文档，均不应出现在查询结果里。
	if err := db.Create(&domain.KBReleaseNodeRelease{ID: "link-other", KBID: "kb", ReleaseID: "release-2", NodeID: "node-x", NodeReleaseID: "nr-x", CreatedAt: now}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&domain.NodeRelease{ID: "nr-x", KBID: "kb2", NodeID: "node-x", Type: domain.NodeTypeDocument, Name: "其他站", Meta: domain.NodeMeta{ContentType: "md"}, Content: "x", CreatedAt: now, UpdatedAt: now}).Error; err != nil {
		t.Fatal(err)
	}

	total, items, err := repo.GetKBReleaseContents(ctx, "kb", "release-1", 0, 10)
	if err != nil {
		t.Fatal(err)
	}
	if total != 3 || len(items) != 3 {
		t.Fatalf("release contents count: total=%d items=%d", total, len(items))
	}
	if items[0].Name != "安装指南" || items[0].Content != "正文 安装指南" || items[0].ContentType != "md" {
		t.Fatalf("first item: %#v", items[0])
	}

	// 分页：跳过第一条取两条。
	total, items, err = repo.GetKBReleaseContents(ctx, "kb", "release-1", 1, 2)
	if err != nil {
		t.Fatal(err)
	}
	if total != 3 || len(items) != 2 {
		t.Fatalf("paged contents: total=%d items=%d", total, len(items))
	}

	// 版本归属校验：用错误的知识库读取版本应返回未找到。
	var releaseRow domain.KBRelease
	if err := repo.GetReleaseByID(ctx, "kb-other", "release-1", &releaseRow); err == nil {
		t.Fatal("cross-kb release lookup must fail")
	}
	if err := repo.GetReleaseByID(ctx, "kb", "release-1", &releaseRow); err != nil {
		t.Fatal(err)
	}
}
