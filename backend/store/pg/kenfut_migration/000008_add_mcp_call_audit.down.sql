DROP INDEX IF EXISTS mcp_calls_kb_created_at_idx;
ALTER TABLE mcp_calls DROP COLUMN IF EXISTS scopes;
ALTER TABLE mcp_calls DROP COLUMN IF EXISTS token_id;
ALTER TABLE mcp_calls DROP COLUMN IF EXISTS duration_ms;
ALTER TABLE mcp_calls DROP COLUMN IF EXISTS error;
ALTER TABLE mcp_calls DROP COLUMN IF EXISTS status;
ALTER TABLE mcp_calls DROP COLUMN IF EXISTS tool_name;
