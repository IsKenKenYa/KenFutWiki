package pg

import (
	"context"

	"github.com/chaitin/panda-wiki/domain"
)

func (r *NodeRepository) GetNodeStatsByNodeId(ctx context.Context, nodeID string) (*domain.NodeStats, error) {
	stats := &domain.NodeStats{NodeID: nodeID}
	err := r.db.WithContext(ctx).Raw("SELECT node_id,pv FROM kenfut_node_pv WHERE node_id=?", nodeID).Scan(stats).Error
	return stats, err
}
