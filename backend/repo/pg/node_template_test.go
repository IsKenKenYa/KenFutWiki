package pg

import (
	"context"
	"os"
	"testing"

	"github.com/chaitin/panda-wiki/domain"
)

// TestNodeTemplateCRUD 校验模板的创建、读取、更新与删除闭环。
func TestNodeTemplateCRUD(t *testing.T) {
	dsn := os.Getenv("KENFUT_TEST_DSN")
	if dsn == "" {
		t.Skip("KENFUT_TEST_DSN is required for PostgreSQL integration tests")
	}
	db := contentTestDB(t)
	repo := NewNodeTemplateRepository(db)
	ctx := context.Background()

	item := &domain.NodeTemplate{KBID: "kb", Name: "会议纪要", Summary: "周会纪要模板", Content: "# 会议纪要\n\n- 议题", ContentType: "md", CreatorID: "editor"}
	if err := repo.Create(ctx, item); err != nil {
		t.Fatal(err)
	}
	if item.ID == "" {
		t.Fatal("create must assign an id")
	}

	list, err := repo.List(ctx, "kb")
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].Name != "会议纪要" {
		t.Fatalf("list: %#v", list)
	}

	// 其他知识库读不到该模板。
	if _, err := repo.Get(ctx, "kb-other", item.ID); err == nil {
		t.Fatal("cross-kb template lookup must fail")
	}

	item.Name = "评审纪要"
	item.Content = "# 评审"
	if err := repo.Update(ctx, item); err != nil {
		t.Fatal(err)
	}
	updated, err := repo.Get(ctx, "kb", item.ID)
	if err != nil {
		t.Fatal(err)
	}
	if updated.Name != "评审纪要" || updated.Content != "# 评审" {
		t.Fatalf("update: %#v", updated)
	}

	// 更新与删除对不存在的模板按未找到处理。
	if err := repo.Update(ctx, &domain.NodeTemplate{ID: "missing", KBID: "kb", Name: "x"}); err == nil {
		t.Fatal("update missing template must fail")
	}
	if err := repo.Delete(ctx, "kb", "missing"); err == nil {
		t.Fatal("delete missing template must fail")
	}
	if err := repo.Delete(ctx, "kb", item.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.Get(ctx, "kb", item.ID); err == nil {
		t.Fatal("deleted template must be gone")
	}
}
