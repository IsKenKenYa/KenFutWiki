-- 文档模板：供新建文档时复制内容
CREATE TABLE node_templates (
    id TEXT PRIMARY KEY,
    kb_id TEXT NOT NULL,
    name TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    content_type TEXT NOT NULL DEFAULT 'md',
    creator_id TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_node_templates_kb ON node_templates (kb_id);
