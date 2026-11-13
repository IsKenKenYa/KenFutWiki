package pg

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/chaitin/panda-wiki/domain"
)

// TestWebhookRepository 校验 webhook 的增删改查、事件订阅过滤与投递记录闭环。
func TestWebhookRepository(t *testing.T) {
	dsn := os.Getenv("KENFUT_TEST_DSN")
	if dsn == "" {
		t.Skip("KENFUT_TEST_DSN is required for PostgreSQL integration tests")
	}
	db := contentTestDB(t)
	if err := db.AutoMigrate(&domain.Webhook{}, &domain.WebhookDelivery{}); err != nil {
		t.Fatal(err)
	}
	repo := NewWebhookRepository(db)
	ctx := context.Background()

	hook := &domain.Webhook{KBID: "kb", URL: "https://hooks.example.test/x", Secret: "s", Events: []string{domain.WebhookEventNodePublished, domain.WebhookEventCommentCreate}, Enabled: true}
	if err := repo.Create(ctx, hook); err != nil {
		t.Fatal(err)
	}
	if hook.ID == "" {
		t.Fatal("create must assign an id")
	}

	subscribed, err := repo.ListEnabledForEvent(ctx, "kb", domain.WebhookEventNodePublished)
	if err != nil {
		t.Fatal(err)
	}
	if len(subscribed) != 1 {
		t.Fatalf("subscribed hooks: %d", len(subscribed))
	}
	if none, err := repo.ListEnabledForEvent(ctx, "kb", domain.WebhookEventFeedback); err != nil || len(none) != 0 {
		t.Fatalf("unsubscribed event must return nothing: %d %v", len(none), err)
	}

	// 停用后不再命中订阅。
	hook.Enabled = false
	if err := repo.Update(ctx, hook); err != nil {
		t.Fatal(err)
	}
	subscribed, err = repo.ListEnabledForEvent(ctx, "kb", domain.WebhookEventNodePublished)
	if err != nil {
		t.Fatal(err)
	}
	if len(subscribed) != 0 {
		t.Fatalf("disabled hook must not match: %d", len(subscribed))
	}

	// 投递记录写入与按时间倒序读取。
	for i := 0; i < 3; i++ {
		if err := repo.RecordDelivery(ctx, &domain.WebhookDelivery{WebhookID: hook.ID, Event: domain.WebhookEventNodePublished, StatusCode: 200}); err != nil {
			t.Fatal(err)
		}
	}
	deliveries, err := repo.ListDeliveries(ctx, hook.ID, 2)
	if err != nil {
		t.Fatal(err)
	}
	if len(deliveries) != 2 {
		t.Fatalf("delivery limit: %d", len(deliveries))
	}
	if deliveries[0].CreatedAt.Before(deliveries[1].CreatedAt) {
		t.Fatalf("deliveries must be newest first")
	}

	// 清理超期记录。
	if err := repo.DeleteOldDeliveries(ctx, time.Now().Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	deliveries, err = repo.ListDeliveries(ctx, hook.ID, 20)
	if err != nil {
		t.Fatal(err)
	}
	if len(deliveries) != 0 {
		t.Fatalf("expired deliveries must be purged: %d", len(deliveries))
	}

	// 删除 webhook 连带删除投递记录。
	if err := repo.RecordDelivery(ctx, &domain.WebhookDelivery{WebhookID: hook.ID, Event: domain.WebhookEventNodePublished, StatusCode: 500}); err != nil {
		t.Fatal(err)
	}
	if err := repo.Delete(ctx, "kb", hook.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.Get(ctx, "kb", hook.ID); err == nil {
		t.Fatal("deleted webhook must be gone")
	}
	deliveries, err = repo.ListDeliveries(ctx, hook.ID, 20)
	if err != nil {
		t.Fatal(err)
	}
	if len(deliveries) != 0 {
		t.Fatalf("webhook deletion must remove deliveries: %d", len(deliveries))
	}
}
