-- 文档多语言：lang 为内容语言（BCP-47 小写主码），translation_group_id 标识互为译本的文档组
ALTER TABLE nodes ADD COLUMN lang TEXT NOT NULL DEFAULT 'zh';
ALTER TABLE nodes ADD COLUMN translation_group_id UUID;

CREATE INDEX idx_nodes_translation_group ON nodes (translation_group_id) WHERE translation_group_id IS NOT NULL;
CREATE INDEX idx_nodes_kb_lang ON nodes (kb_id, lang);
