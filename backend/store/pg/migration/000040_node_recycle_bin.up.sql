-- 文档回收站：删除改为标记 deleted_at（gorm 软删除），可恢复或彻底清除
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_nodes_recycle_bin ON nodes (kb_id, deleted_at) WHERE deleted_at IS NOT NULL;
