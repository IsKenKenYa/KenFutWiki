-- Preserve the previous displayed baseline once. Subsequent views increment
-- directly and must not be added again by the upstream daily rollup.
CREATE TABLE kenfut_node_pv (
 node_id text PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
 pv bigint NOT NULL DEFAULT 0
);
INSERT INTO kenfut_node_pv(node_id,pv)
SELECT n.id,COALESCE(ns.pv,0)+(
 SELECT COUNT(*) FROM stat_pages s
 WHERE s.node_id=n.id AND s.created_at >=
 ((date_trunc('hour',CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')-INTERVAL '24 hours')
)
FROM nodes n LEFT JOIN node_stats ns ON ns.node_id=n.id;
