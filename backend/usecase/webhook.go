package usecase

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/google/uuid"

	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/repo/pg"
)

const (
	webhookTimeout = 5 * time.Second
	// 每次投递最多尝试次数（首次 + 两次重试）
	webhookMaxAttempts = 3
	// 投递记录保留时长
	webhookDeliveryRetention = 30 * 24 * time.Hour
)

var ErrWebhookInvalid = errors.New("invalid webhook")

type WebhookUsecase struct {
	repo   *pg.WebhookRepository
	logger *log.Logger
	client *http.Client
}

func NewWebhookUsecase(repo *pg.WebhookRepository, logger *log.Logger) *WebhookUsecase {
	return &WebhookUsecase{
		repo:   repo,
		logger: logger.WithModule("usecase.webhook"),
		client: &http.Client{Timeout: webhookTimeout},
	}
}

func validWebhookURL(raw string) bool {
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" || parsed.User != nil {
		return false
	}
	if parsed.Scheme != "https" && parsed.Scheme != "http" {
		return false
	}
	host := parsed.Hostname()
	ip := net.ParseIP(host)
	if host == "localhost" || (ip != nil && ip.IsLoopback()) {
		return parsed.Scheme == "http" || parsed.Scheme == "https"
	}
	return parsed.Scheme == "https"
}

func validWebhookEvents(events []string) bool {
	if len(events) == 0 || len(events) > len(domain.WebhookEvents) {
		return false
	}
	seen := map[string]bool{}
	for _, event := range events {
		if !domain.ValidWebhookEvent(event) || seen[event] {
			return false
		}
		seen[event] = true
	}
	return true
}

// signBody 计算推送的 HMAC-SHA256 签名；secret 为空时不签名
func signBody(secret string, body []byte) string {
	if secret == "" {
		return ""
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

func (u *WebhookUsecase) List(ctx context.Context, kbID string) ([]domain.Webhook, error) {
	return u.repo.List(ctx, kbID)
}

func (u *WebhookUsecase) Create(ctx context.Context, item *domain.Webhook, userID string) (*domain.Webhook, error) {
	if !validWebhookURL(item.URL) {
		return nil, fmt.Errorf("%w: url must be https", ErrWebhookInvalid)
	}
	if !validWebhookEvents(item.Events) {
		return nil, fmt.Errorf("%w: events", ErrWebhookInvalid)
	}
	item.CreatorID = userID
	if err := u.repo.Create(ctx, item); err != nil {
		return nil, err
	}
	return item, nil
}

func (u *WebhookUsecase) Update(ctx context.Context, item *domain.Webhook) error {
	if !validWebhookURL(item.URL) {
		return fmt.Errorf("%w: url must be https", ErrWebhookInvalid)
	}
	if !validWebhookEvents(item.Events) {
		return fmt.Errorf("%w: events", ErrWebhookInvalid)
	}
	return u.repo.Update(ctx, item)
}

func (u *WebhookUsecase) Delete(ctx context.Context, kbID, id string) error {
	return u.repo.Delete(ctx, kbID, id)
}

// Deliveries 返回某 webhook 的最近投递记录。
func (u *WebhookUsecase) Deliveries(ctx context.Context, kbID, id string) ([]domain.WebhookDelivery, error) {
	if _, err := u.repo.Get(ctx, kbID, id); err != nil {
		return nil, err
	}
	return u.repo.ListDeliveries(ctx, id, 20)
}

// SendTest 向目标推送一条 test 事件。
func (u *WebhookUsecase) SendTest(ctx context.Context, kbID, id string) error {
	item, err := u.repo.Get(ctx, kbID, id)
	if err != nil {
		return err
	}
	if !item.Enabled {
		return fmt.Errorf("%w: webhook disabled", ErrWebhookInvalid)
	}
	return u.deliver(ctx, item, "test", map[string]any{"hello": "kenfutwiki"})
}

// dispatch 异步推送事件给全部订阅者；失败只记录投递结果，不影响业务流程
func (u *WebhookUsecase) dispatch(kbID, event string, data any) {
	ctx, cancel := context.WithTimeout(context.Background(), webhookTimeout*webhookMaxAttempts)
	go func() {
		defer cancel()
		hooks, err := u.repo.ListEnabledForEvent(ctx, kbID, event)
		if err != nil {
			u.logger.Error("list webhooks for dispatch", "error", err)
			return
		}
		for _, hook := range hooks {
			if err := u.deliver(ctx, &hook, event, data); err != nil {
				u.logger.Error("webhook deliver", "error", err, "webhook_id", hook.ID)
			}
		}
	}()
}

func (u *WebhookUsecase) deliver(ctx context.Context, hook *domain.Webhook, event string, data any) error {
	payload := domain.WebhookPayload{Event: event, KBID: hook.KBID, Timestamp: time.Now().UTC().Format(time.RFC3339), Data: data}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	delivery := &domain.WebhookDelivery{WebhookID: hook.ID, Event: event}
	var lastErr error
	for attempt := 0; attempt < webhookMaxAttempts; attempt++ {
		if attempt > 0 {
			select {
			case <-time.After(time.Duration(attempt) * 2 * time.Second):
			case <-ctx.Done():
				delivery.Error = ctx.Err().Error()
				u.recordDelivery(delivery)
				return ctx.Err()
			}
		}
		request, reqErr := http.NewRequestWithContext(ctx, http.MethodPost, hook.URL, bytes.NewReader(body))
		if reqErr != nil {
			lastErr = reqErr
			break
		}
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("X-KFW-Event", event)
		request.Header.Set("X-KFW-Delivery", uuid.NewString())
		if signature := signBody(hook.Secret, body); signature != "" {
			request.Header.Set("X-KFW-Signature", signature)
		}
		response, reqErr := u.client.Do(request)
		if reqErr != nil {
			lastErr = reqErr
			continue
		}
		_, _ = io.Copy(io.Discard, response.Body)
		_ = response.Body.Close()
		if response.StatusCode >= 200 && response.StatusCode < 300 {
			delivery.StatusCode = response.StatusCode
			u.recordDelivery(delivery)
			return nil
		}
		delivery.StatusCode = response.StatusCode
		lastErr = fmt.Errorf("unexpected status %s", strconv.Itoa(response.StatusCode))
	}
	if lastErr != nil {
		delivery.Error = lastErr.Error()
	}
	u.recordDelivery(delivery)
	return lastErr
}

func (u *WebhookUsecase) recordDelivery(delivery *domain.WebhookDelivery) {
	recordCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := u.repo.RecordDelivery(recordCtx, delivery); err != nil {
		u.logger.Error("record webhook delivery", "error", err)
	}
}

// CleanupDeliveries 删除超期投递记录。
func (u *WebhookUsecase) CleanupDeliveries(ctx context.Context) error {
	return u.repo.DeleteOldDeliveries(ctx, time.Now().Add(-webhookDeliveryRetention))
}

// NodePublished 在知识库发布成功后推送 node.published。
func (u *WebhookUsecase) NodePublished(kbID, tag, message string, nodeIDs []string) {
	u.dispatch(kbID, domain.WebhookEventNodePublished, map[string]any{"tag": tag, "message": message, "node_ids": nodeIDs})
}

// NodeDeleted 在文档进入回收站后推送 node.deleted。
func (u *WebhookUsecase) NodeDeleted(kbID string, nodeIDs []string) {
	u.dispatch(kbID, domain.WebhookEventNodeDeleted, map[string]any{"node_ids": nodeIDs})
}

// NodeRestored 在文档从回收站恢复后推送 node.restored。
func (u *WebhookUsecase) NodeRestored(kbID string, nodeIDs []string) {
	u.dispatch(kbID, domain.WebhookEventNodeRestored, map[string]any{"node_ids": nodeIDs})
}

// CommentCreated 在公开评论创建后推送 comment.created。
func (u *WebhookUsecase) CommentCreated(kbID, commentID, nodeID string) {
	u.dispatch(kbID, domain.WebhookEventCommentCreate, map[string]any{"comment_id": commentID, "node_id": nodeID})
}

// FeedbackCreated 在文档反馈提交后推送 feedback.created。
func (u *WebhookUsecase) FeedbackCreated(kbID, nodeID, content string) {
	u.dispatch(kbID, domain.WebhookEventFeedback, map[string]any{"node_id": nodeID, "content": content})
}
