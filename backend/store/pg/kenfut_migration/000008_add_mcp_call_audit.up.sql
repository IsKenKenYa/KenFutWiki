ALTER TABLE mcp_calls ADD COLUMN IF NOT EXISTS tool_name text NOT NULL DEFAULT '';
ALTER TABLE mcp_calls ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT '';
ALTER TABLE mcp_calls ADD COLUMN IF NOT EXISTS error text NOT NULL DEFAULT '';
ALTER TABLE mcp_calls ADD COLUMN IF NOT EXISTS duration_ms integer NOT NULL DEFAULT 0;
ALTER TABLE mcp_calls ADD COLUMN IF NOT EXISTS token_id text NOT NULL DEFAULT '';
ALTER TABLE mcp_calls ADD COLUMN IF NOT EXISTS scopes text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS mcp_calls_kb_created_at_idx ON mcp_calls (kb_id, created_at DESC);
