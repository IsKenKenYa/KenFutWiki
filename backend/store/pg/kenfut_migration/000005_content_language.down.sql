DROP INDEX IF EXISTS kenfut_content_draft_slug;
CREATE UNIQUE INDEX kenfut_content_draft_slug ON kenfut_content_metadata(kb_id, (metadata->>'slug')) WHERE COALESCE(metadata->>'slug','') <> '';
ALTER TABLE kenfut_content_metadata DROP COLUMN IF EXISTS lang;
ALTER TABLE kenfut_slug_aliases DROP CONSTRAINT kenfut_slug_aliases_pkey;
ALTER TABLE kenfut_slug_aliases ADD PRIMARY KEY(kb_id, slug);
ALTER TABLE kenfut_slug_aliases DROP COLUMN IF EXISTS lang;
