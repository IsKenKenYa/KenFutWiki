DROP INDEX IF EXISTS idx_nodes_kb_lang;
DROP INDEX IF EXISTS idx_nodes_translation_group;
ALTER TABLE nodes DROP COLUMN IF EXISTS translation_group_id;
ALTER TABLE nodes DROP COLUMN IF EXISTS lang;
