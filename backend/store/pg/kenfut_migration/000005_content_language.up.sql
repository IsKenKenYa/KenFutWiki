-- slug 别名与草稿 slug 唯一性引入语言维度：同一 slug 可在各语言路由空间内并存
ALTER TABLE kenfut_slug_aliases ADD COLUMN lang TEXT NOT NULL DEFAULT 'zh';
ALTER TABLE kenfut_slug_aliases DROP CONSTRAINT kenfut_slug_aliases_pkey;
ALTER TABLE kenfut_slug_aliases ADD PRIMARY KEY(kb_id, slug, lang);

ALTER TABLE kenfut_content_metadata ADD COLUMN lang TEXT NOT NULL DEFAULT 'zh';
DROP INDEX IF EXISTS kenfut_content_draft_slug;
CREATE UNIQUE INDEX kenfut_content_draft_slug ON kenfut_content_metadata(kb_id, lang, (metadata->>'slug')) WHERE COALESCE(metadata->>'slug','') <> '';
