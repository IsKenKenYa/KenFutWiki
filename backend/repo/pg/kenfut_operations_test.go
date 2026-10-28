package pg

import (
	"context"
	"testing"
	"time"

	"github.com/chaitin/panda-wiki/domain"
)

func TestKenFutPromptWritesReachExistingLLMConsumer(t *testing.T) {
	db := integrationTestDB(t)
	if err := db.AutoMigrate(&domain.Setting{}); err != nil {
		t.Fatal(err)
	}
	operations := NewKenFutIntegrationRepository(db)
	consumer := NewPromptRepo(db, nil)
	ctx := context.Background()
	custom := domain.Prompt{Content: "KenFut custom system instruction", SummaryContent: "KenFut custom summary instruction"}
	if err := operations.SavePrompt(ctx, "kb", custom); err != nil {
		t.Fatal(err)
	}
	content, err := consumer.GetPromptContent(ctx, "kb")
	if err != nil || content != custom.Content {
		t.Fatalf("LLM consumer did not receive custom prompt: %q %v", content, err)
	}
	summary, err := consumer.GetSummaryPrompt(ctx, "kb")
	if err != nil || summary != custom.SummaryContent {
		t.Fatalf("summary consumer mismatch: %q %v", summary, err)
	}
	if err := operations.SavePrompt(ctx, "kb", domain.Prompt{EnablePreset: true}); err != nil {
		t.Fatal(err)
	}
	content, err = consumer.GetPromptContent(ctx, "kb")
	if err != nil || content == "" || content == custom.Content {
		t.Fatalf("preset not consumed: %q %v", content, err)
	}
	summary, err = consumer.GetSummaryPrompt(ctx, "kb")
	if err != nil || summary != domain.SystemDefaultSummaryPrompt {
		t.Fatalf("default summary not restored: %q %v", summary, err)
	}
	var count int64
	if err := db.Model(&domain.Setting{}).Where("kb_id=? AND key=?", "kb", domain.SettingKeySystemPrompt).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("prompt save created conflicting settings: %d", count)
	}
}

func TestKenFutModerationOnlyPublishesAcceptedComments(t *testing.T) {
	db := integrationTestDB(t)
	if err := db.Exec(`CREATE TABLE comments(id text PRIMARY KEY,kb_id text,user_id text,node_id text,info jsonb,parent_id text,root_id text,content text,status smallint,pic_urls text[] NOT NULL DEFAULT '{}',created_at timestamptz)`).Error; err != nil {
		t.Fatal(err)
	}
	for _, status := range []int{0, -1} {
		id := "pending"
		if status == -1 {
			id = "rejected"
		}
		if err := db.Exec("INSERT INTO comments(id,kb_id,node_id,info,status,created_at) VALUES(?,'kb','article','{}',?,?)", id, status, time.Now()).Error; err != nil {
			t.Fatal(err)
		}
	}
	ctx := context.Background()
	operations := NewKenFutIntegrationRepository(db)
	public := &CommentRepository{db: db}
	visible := func(ctx context.Context, want int64) {
		t.Helper()
		items, total, err := public.GetCommentList(ctx, "article")
		if err != nil {
			t.Fatal(err)
		}
		if total != want || int64(len(items)) != want {
			t.Fatalf("public comments=%d/%d, want %d", len(items), total, want)
		}
	}
	visible(ctx, 0)
	if err := operations.Moderate(ctx, "kb", "pending", 1); err != nil {
		t.Fatal(err)
	}
	visible(ctx, 1)
	// An upstream capability/profile change must never expose rejected comments.
	restricted := context.WithValue(ctx, domain.ContextKeyEditionLimitation, []byte(`{"allow_comment_audit":false}`))
	visible(restricted, 1)
	if err := operations.Moderate(ctx, "kb", "pending", -1); err != nil {
		t.Fatal(err)
	}
	visible(ctx, 0)
	if err := operations.Moderate(ctx, "another-kb", "pending", 1); err == nil {
		t.Fatal("moderation crossed site boundary")
	}
	visible(ctx, 0)
}
