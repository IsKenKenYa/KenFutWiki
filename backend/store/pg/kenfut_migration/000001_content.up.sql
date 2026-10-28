CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE kenfut_content_metadata (
    node_id text PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
    kb_id text NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    metadata jsonb NOT NULL DEFAULT '{"channel":"docs","tags":[],"related_node_ids":[],"ctas":[]}',
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX kenfut_content_draft_slug ON kenfut_content_metadata(kb_id, (metadata->>'slug')) WHERE COALESCE(metadata->>'slug','') <> '';

CREATE TABLE kenfut_content_releases (
    node_release_id text PRIMARY KEY REFERENCES node_releases(id) ON DELETE CASCADE,
    node_id text NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    kb_id text NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    metadata jsonb NOT NULL,
    search_text text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kenfut_content_release_node ON kenfut_content_releases(kb_id,node_id);
CREATE INDEX kenfut_content_search ON kenfut_content_releases USING gin(search_text gin_trgm_ops);
CREATE INDEX kenfut_content_release_tags ON kenfut_content_releases USING gin((metadata->'tags'));

CREATE TABLE kenfut_slug_aliases (
    kb_id text NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    slug text NOT NULL,
    node_id text NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    PRIMARY KEY(kb_id,slug)
);
CREATE INDEX kenfut_slug_alias_node ON kenfut_slug_aliases(kb_id,node_id);

CREATE TABLE kenfut_rag_outbox (
    node_release_id text PRIMARY KEY REFERENCES node_releases(id) ON DELETE CASCADE,
    kb_id text NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Existing published documents remain documents; never infer article metadata from drafts.
INSERT INTO kenfut_content_releases(node_release_id,node_id,kb_id,metadata,search_text,created_at)
SELECT nr.id,nr.node_id,nr.kb_id,jsonb_build_object('node_id',nr.node_id,'channel','docs','tags',jsonb_build_array(),'related_node_ids',jsonb_build_array(),'ctas',jsonb_build_array()),
       nr.name || ' ' || COALESCE(nr.meta->>'summary','') || ' ' || regexp_replace(nr.content,'<[^>]*>',' ','g'),nr.updated_at
FROM node_releases nr JOIN nodes n ON n.id=nr.node_id;
