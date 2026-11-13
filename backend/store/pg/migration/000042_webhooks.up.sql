-- Webhooks：站点事件推送到外部地址；投递记录用于排查
CREATE TABLE webhooks (
    id TEXT PRIMARY KEY,
    kb_id TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT NOT NULL DEFAULT '',
    events TEXT[] NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    creator_id TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_webhooks_kb ON webhooks (kb_id);

CREATE TABLE webhook_deliveries (
    id BIGSERIAL PRIMARY KEY,
    webhook_id TEXT NOT NULL,
    event TEXT NOT NULL,
    status_code INT NOT NULL DEFAULT 0,
    error TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_webhook_deliveries_hook ON webhook_deliveries (webhook_id, created_at DESC);
