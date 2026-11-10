CREATE TABLE IF NOT EXISTS mcp_operations (
    id              text        NOT NULL,
    kb_id           text        NOT NULL,
    idempotency_key text        NOT NULL,
    tool_name       text        NOT NULL,
    status          text        NOT NULL,
    result          jsonb,
    error           text        NOT NULL DEFAULT '',
    created_at      timestamptz NOT NULL DEFAULT NOW(),
    updated_at      timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT mcp_operations_pkey PRIMARY KEY (id),
    CONSTRAINT mcp_operations_idempotency_key UNIQUE (kb_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS mcp_operations_kb_created_at_idx ON mcp_operations (kb_id, created_at DESC);
