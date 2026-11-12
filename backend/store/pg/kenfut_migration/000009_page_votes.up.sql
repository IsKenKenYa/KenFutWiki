-- 页面级"有帮助吗"投票明细；同访客同文档一票，重复提交更新票向
CREATE TABLE IF NOT EXISTS kenfut_page_votes (
    id BIGSERIAL PRIMARY KEY,
    kb_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    visitor_hash TEXT NOT NULL,
    vote SMALLINT NOT NULL CHECK (vote IN (1, -1)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_kenfut_page_votes_visitor ON kenfut_page_votes (kb_id, node_id, visitor_hash);
CREATE INDEX IF NOT EXISTS idx_kenfut_page_votes_node ON kenfut_page_votes (kb_id, node_id);
