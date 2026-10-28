package pg

import "gorm.io/gorm"

func incrementKenFutPV(tx *gorm.DB, kbID, nodeID string) error {
	result := tx.Exec(`INSERT INTO kenfut_node_pv(node_id,pv)
 SELECT id,1 FROM nodes WHERE id=? AND kb_id=?
 ON CONFLICT(node_id) DO UPDATE SET pv=kenfut_node_pv.pv+1`, nodeID, kbID)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
