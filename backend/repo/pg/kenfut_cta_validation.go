package pg

import (
	"fmt"

	"github.com/chaitin/panda-wiki/domain"
	"gorm.io/gorm"
)

func validateKenFutProductCTAs(tx *gorm.DB, kbID string, metadata *domain.KenFutContentMetadata) error {
	for i := range metadata.CTAs {
		cta := &metadata.CTAs[i]
		cta.ResolvedURL = ""
		if cta.Target.Type != "product" {
			continue
		}
		var product domain.KenFutProduct
		if err := tx.Where("id = ? AND kb_id = ? AND enabled = true", cta.Target.ProductID, kbID).First(&product).Error; err != nil {
			return fmt.Errorf("CTA product is unavailable: %w", err)
		}
		if _, err := domain.ResolveKenFutProductPage(product, cta.Target, ""); err != nil {
			return fmt.Errorf("invalid CTA target: %w", err)
		}
	}
	return nil
}
