package usecase

import (
	"context"
	"encoding/xml"
	"fmt"
	"strings"
	"time"

	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/repo/pg"
)

type SitemapUsecase struct {
	nodeUsecase *pg.NodeRepository
	appUsecase  *pg.KnowledgeBaseRepository
	logger      *log.Logger
}

func NewSitemapUsecase(nodeUsecase *pg.NodeRepository, appUsecase *pg.KnowledgeBaseRepository, logger *log.Logger) *SitemapUsecase {
	return &SitemapUsecase{nodeUsecase: nodeUsecase, appUsecase: appUsecase, logger: logger.WithModule("usecase.sitemap")}
}

func (u *SitemapUsecase) GetSitemap(ctx context.Context, kbID string) (string, error) {
	nodes, err := u.nodeUsecase.PublicContentSitemapRows(ctx, kbID)
	if err != nil {
		return "", fmt.Errorf("failed to get node release list: %w", err)
	}

	kb, err := u.appUsecase.GetKnowledgeBaseByID(ctx, kbID)
	if err != nil {
		return "", fmt.Errorf("failed to get knowledge base: %w", err)
	}

	sb := strings.Builder{}
	sb.WriteString(`<?xml version="1.0" encoding="UTF-8"?>`)
	sb.WriteString(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`)

	// add welcome
	baseURL := strings.TrimRight(kb.AccessSettings.GetBaseUrl(), "/")
	writeSitemapURL(&sb, baseURL+"/welcome", time.Now())
	writeSitemapURL(&sb, baseURL+"/blog", time.Now())

	// add nodes
	for _, node := range nodes {
		item := contentItem(node, baseURL)
		writeSitemapURL(&sb, item.CanonicalURL, node.UpdatedAt)
	}

	sb.WriteString(`</urlset>`)

	return sb.String(), nil
}

func writeSitemapURL(sb *strings.Builder, location string, updatedAt time.Time) {
	escapedLocation := escapeSitemapLocation(location)
	fmt.Fprintf(sb, `<url><loc>%s</loc><lastmod>%s</lastmod></url>`, escapedLocation, updatedAt.Format(time.DateOnly))
}

func escapeSitemapLocation(location string) string {
	var escaped strings.Builder
	_ = xml.EscapeText(&escaped, []byte(location))
	return escaped.String()
}
