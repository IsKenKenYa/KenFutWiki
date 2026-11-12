DROP INDEX IF EXISTS idx_nodes_recycle_bin;
ALTER TABLE nodes DROP COLUMN IF EXISTS deleted_at;
