package pg

import "context"

// PublicContentSitemapRows includes articles as well as documents, but excludes
// content whose visibility or visit permission requires an authenticated group.
func (r *NodeRepository) PublicContentSitemapRows(ctx context.Context, kbID string) ([]KenFutPublishedRow, error) {
	repo := &KenFutContentRepository{db: r.db}
	releaseID, err := repo.LatestReleaseID(ctx, kbID)
	if err != nil || releaseID == "" {
		return []KenFutPublishedRow{}, err
	}
	return repo.Candidates(ctx, kbID, releaseID, KenFutVisibility{})
}
