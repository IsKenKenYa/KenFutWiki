package usecase

import (
	"context"
	"fmt"
	"net/url"
	"sort"
	"strings"

	"github.com/chaitin/panda-wiki/consts"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/repo/pg"
	"github.com/chaitin/panda-wiki/utils"
)

type KenFutContentUsecase struct {
	repo  *pg.KenFutContentRepository
	nodes *NodeUsecase
	kb    *pg.KnowledgeBaseRepository
}

func NewKenFutContentUsecase(repo *pg.KenFutContentRepository, nodes *NodeUsecase, kb *pg.KnowledgeBaseRepository) *KenFutContentUsecase {
	return &KenFutContentUsecase{repo: repo, nodes: nodes, kb: kb}
}

func (u *KenFutContentUsecase) GetDraft(ctx context.Context, kbID, nodeID string) (*domain.KenFutContentMetadata, error) {
	return u.repo.GetDraft(ctx, kbID, nodeID)
}

func (u *KenFutContentUsecase) SaveDraft(ctx context.Context, kbID string, m domain.KenFutContentMetadata) error {
	if err := NormalizeKenFutContentMetadata(&m); err != nil {
		return err
	}
	auth := domain.GetAuthInfoFromCtx(ctx)
	if auth == nil {
		return fmt.Errorf("authentication required")
	}
	return u.repo.SaveDraft(ctx, kbID, m, auth.UserId)
}

func (u *KenFutContentUsecase) visibility(ctx context.Context, authID uint) (pg.KenFutVisibility, error) {
	if authID == 0 {
		return pg.KenFutVisibility{}, nil
	}
	visible, err := u.nodes.GetNodeIdsByAuthId(ctx, authID, consts.NodePermNameVisible)
	if err != nil {
		return pg.KenFutVisibility{}, err
	}
	visitable, err := u.nodes.GetNodeIdsByAuthId(ctx, authID, consts.NodePermNameVisitable)
	return pg.KenFutVisibility{VisibleIDs: visible, VisitableIDs: visitable}, err
}

func (u *KenFutContentUsecase) List(ctx context.Context, req domain.KenFutContentListReq, authID uint) (*domain.KenFutContentListResp, error) {
	if req.Page < 1 {
		req.Page = 1
	}
	if req.PageSize < 1 {
		req.PageSize = 20
	}
	if req.PageSize > 100 {
		req.PageSize = 100
	}
	if req.Channel != "" && req.Channel != "all" && req.Channel != "docs" && req.Channel != "article" {
		return nil, fmt.Errorf("invalid channel")
	}
	if len([]rune(req.Query)) > 200 {
		return nil, fmt.Errorf("search query is too long")
	}
	releaseID, err := u.repo.LatestReleaseID(ctx, req.KBID)
	if err != nil {
		return nil, err
	}
	resp := &domain.KenFutContentListResp{Items: []domain.KenFutContentItem{}, Page: req.Page, PageSize: req.PageSize, ReleaseID: releaseID}
	if releaseID == "" {
		return resp, nil
	}
	visibility, err := u.visibility(ctx, authID)
	if err != nil {
		return nil, err
	}
	rows, total, err := u.repo.List(ctx, req, releaseID, visibility)
	if err != nil {
		return nil, err
	}
	baseURL, err := u.baseURL(ctx, req.KBID)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		resp.Items = append(resp.Items, contentItem(row, baseURL))
	}
	resp.Total = total
	return resp, nil
}

func (u *KenFutContentUsecase) Detail(ctx context.Context, kbID, nodeID string, authID uint) (*domain.KenFutContentItem, error) {
	releaseID, err := u.repo.LatestReleaseID(ctx, kbID)
	if err != nil {
		return nil, err
	}
	visibility, err := u.visibility(ctx, authID)
	if err != nil {
		return nil, err
	}
	row, err := u.repo.Detail(ctx, kbID, nodeID, releaseID, visibility)
	if err != nil {
		return nil, err
	}
	baseURL, err := u.baseURL(ctx, kbID)
	if err != nil {
		return nil, err
	}
	item := contentItem(*row, baseURL)
	item.PV, err = u.repo.CurrentPV(ctx, nodeID)
	if err != nil {
		return nil, err
	}
	item.Related, err = u.related(ctx, *row, releaseID, visibility, baseURL)
	return &item, err
}

func (u *KenFutContentUsecase) Article(ctx context.Context, kbID, slug string, authID uint) (*domain.KenFutContentItem, error) {
	nodeID, err := u.repo.ResolveSlug(ctx, kbID, slug)
	if err != nil {
		return nil, err
	}
	return u.Detail(ctx, kbID, nodeID, authID)
}

func (u *KenFutContentUsecase) Related(ctx context.Context, kbID, nodeID string, authID uint) ([]domain.KenFutContentItem, error) {
	item, err := u.Detail(ctx, kbID, nodeID, authID)
	if err != nil {
		return nil, err
	}
	return item.Related, nil
}

func (u *KenFutContentUsecase) baseURL(ctx context.Context, kbID string) (string, error) {
	kb, err := u.kb.GetKnowledgeBaseByID(ctx, kbID)
	if err != nil {
		return "", err
	}
	return strings.TrimRight(kb.AccessSettings.GetBaseUrl(), "/"), nil
}

func contentItem(row pg.KenFutPublishedRow, baseURL string) domain.KenFutContentItem {
	m := row.Metadata
	if m.Channel == "" {
		m = domain.DefaultKenFutContentMetadata(row.ID)
	}
	m.NodeID = row.ID
	canonical := baseURL + "/node/" + url.PathEscape(row.ID)
	if m.Channel != "docs" && m.Slug != "" {
		canonical = baseURL + "/blog/" + url.PathEscape(m.Slug)
	}
	content := row.Content
	if content != "" && row.ContentType != domain.ContentTypeMD && !utils.IsLikelyHTML(content) {
		content = renderNodeMarkdown(content)
	}
	return domain.KenFutContentItem{KenFutContentMetadata: m, ID: row.ID, KBID: row.KBID, Title: row.Title, Summary: row.Summary, Content: content, ContentType: row.ContentType, CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt, URL: canonical, CanonicalURL: canonical, NodeReleaseID: row.NodeReleaseID, PV: row.PV}
}

func (u *KenFutContentUsecase) related(ctx context.Context, current pg.KenFutPublishedRow, releaseID string, visibility pg.KenFutVisibility, baseURL string) ([]domain.KenFutContentItem, error) {
	rows, err := u.repo.Candidates(ctx, current.KBID, releaseID, visibility)
	if err != nil {
		return nil, err
	}
	byID := map[string]pg.KenFutPublishedRow{}
	for _, row := range rows {
		if row.ID != current.ID {
			byID[row.ID] = row
		}
	}
	result := []domain.KenFutContentItem{}
	seen := map[string]bool{}
	for _, id := range current.Metadata.RelatedNodeIDs {
		if row, ok := byID[id]; ok && !seen[id] {
			result = append(result, contentItem(row, baseURL))
			seen[id] = true
			if len(result) == 2 {
				return result, nil
			}
		}
	}
	sort.SliceStable(rows, func(i, j int) bool {
		return relatedContentScore(current, rows[i]) > relatedContentScore(current, rows[j])
	})
	for _, row := range rows {
		if row.ID != current.ID && !seen[row.ID] && relatedContentScore(current, row) > 0 {
			result = append(result, contentItem(row, baseURL))
			seen[row.ID] = true
			if len(result) == 2 {
				break
			}
		}
	}
	return result, nil
}

func relatedContentScore(current, candidate pg.KenFutPublishedRow) int {
	score := 0
	tags := map[string]bool{}
	for _, tag := range current.Metadata.Tags {
		tags[tag] = true
	}
	for _, tag := range candidate.Metadata.Tags {
		if tags[tag] {
			score += 100
		}
	}
	if current.Metadata.Category != "" && current.Metadata.Category == candidate.Metadata.Category {
		score += 20
	}
	if current.ParentID != "" && current.ParentID == candidate.ParentID {
		score += 5
	}
	return score
}

func (u *KenFutContentUsecase) Pages(ctx context.Context, kbID string, authID uint) ([]domain.KenFutPage, error) {
	baseURL, err := u.baseURL(ctx, kbID)
	if err != nil {
		return nil, err
	}
	pages := []domain.KenFutPage{{ID: "home", Title: "首页", URL: baseURL + "/", Type: "site", Target: domain.KenFutLinkTarget{Type: "site", Page: "home"}}, {ID: "docs", Title: "文档", URL: baseURL + "/node", Type: "site", Target: domain.KenFutLinkTarget{Type: "site", Page: "docs"}}, {ID: "blog", Title: "文章", URL: baseURL + "/blog", Type: "site", Target: domain.KenFutLinkTarget{Type: "site", Page: "blog"}}}
	releaseID, err := u.repo.LatestReleaseID(ctx, kbID)
	if err != nil || releaseID == "" {
		return pages, err
	}
	visibility, err := u.visibility(ctx, authID)
	if err != nil {
		return nil, err
	}
	rows, err := u.repo.Candidates(ctx, kbID, releaseID, visibility)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		item := contentItem(row, baseURL)
		pages = append(pages, domain.KenFutPage{ID: item.ID, Title: item.Title, URL: item.CanonicalURL, Type: "node", Target: domain.KenFutLinkTarget{Type: "node", NodeID: item.ID}})
	}
	return pages, nil
}

func (u *KenFutContentUsecase) Taxonomies(ctx context.Context, kbID string, authID uint) (*domain.KenFutTaxonomies, error) {
	result := &domain.KenFutTaxonomies{Categories: []string{}, Tags: []string{}}
	releaseID, err := u.repo.LatestReleaseID(ctx, kbID)
	if err != nil || releaseID == "" {
		return result, err
	}
	visibility, err := u.visibility(ctx, authID)
	if err != nil {
		return nil, err
	}
	rows, err := u.repo.Candidates(ctx, kbID, releaseID, visibility)
	if err != nil {
		return nil, err
	}
	categories := map[string]bool{}
	tags := map[string]bool{}
	for _, row := range rows {
		if row.Metadata.Category != "" {
			categories[row.Metadata.Category] = true
		}
		for _, tag := range row.Metadata.Tags {
			tags[tag] = true
		}
	}
	for category := range categories {
		result.Categories = append(result.Categories, category)
	}
	for tag := range tags {
		result.Tags = append(result.Tags, tag)
	}
	sort.Strings(result.Categories)
	sort.Strings(result.Tags)
	return result, nil
}
