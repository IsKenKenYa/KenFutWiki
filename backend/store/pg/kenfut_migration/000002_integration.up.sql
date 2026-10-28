CREATE TABLE kenfut_products (
 id text PRIMARY KEY, kb_id text NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
 name text NOT NULL, origin text NOT NULL, enabled boolean NOT NULL DEFAULT true,
 pages jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON kenfut_products(kb_id);
CREATE TABLE kenfut_credentials (
 id text PRIMARY KEY, product_id text NOT NULL REFERENCES kenfut_products(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE, scopes jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz
);
CREATE TABLE kenfut_events (
 id bigserial PRIMARY KEY, event_id text NOT NULL, kind text NOT NULL,
 kb_id text NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
 product_id text NOT NULL DEFAULT '', node_id text NOT NULL DEFAULT '', node_release_id text NOT NULL DEFAULT '',
 cta_id text NOT NULL DEFAULT '', view_id text NOT NULL DEFAULT '', click_id text UNIQUE,
 session_id text NOT NULL DEFAULT '', subject_hash text NOT NULL DEFAULT '', payload_hash text NOT NULL,
 occurred_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(kb_id, product_id, event_id)
);
CREATE INDEX ON kenfut_events(kb_id, occurred_at);
CREATE INDEX ON kenfut_events(product_id, session_id, occurred_at DESC) WHERE kind='cta_click';
CREATE TABLE kenfut_milestones (
 product_id text NOT NULL REFERENCES kenfut_products(id) ON DELETE CASCADE,
 subject_hash text NOT NULL, kind text NOT NULL,
 click_id text NOT NULL DEFAULT '', occurred_at timestamptz NOT NULL,
 PRIMARY KEY(product_id,subject_hash,kind)
);
CREATE TABLE kenfut_daily_event_totals (
 day date NOT NULL, kb_id text NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
 product_id text NOT NULL DEFAULT '', node_id text NOT NULL DEFAULT '', cta_id text NOT NULL DEFAULT '',
 kind text NOT NULL, records bigint NOT NULL,
 PRIMARY KEY(day,kb_id,product_id,node_id,cta_id,kind)
);
