package usecase

import (
	"context"
	"encoding/xml"
	"fmt"
	"strings"
	"time"

	"github.com/chaitin/panda-wiki/domain"
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

	baseURL := strings.TrimRight(kb.AccessSettings.GetBaseUrl(), "/")

	// 译本组：groupID → lang → 该语言版本的规范地址
	alternatesByGroup := map[string]map[string]string{}
	items := make([]domain.KenFutContentItem, 0, len(nodes))
	for _, node := range nodes {
		item := contentItem(node, baseURL)
		items = append(items, item)
		if node.TranslationGroupID == nil {
			continue
		}
		langs, ok := alternatesByGroup[*node.TranslationGroupID]
		if !ok {
			langs = map[string]string{}
			alternatesByGroup[*node.TranslationGroupID] = langs
		}
		langs[node.Lang] = item.CanonicalURL
	}

	sb := strings.Builder{}
	sb.WriteString(`<?xml version="1.0" encoding="UTF-8"?>`)
	sb.WriteString(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`)

	// add welcome
	writeSitemapURL(&sb, baseURL+"/welcome", time.Now(), nil)
	writeSitemapURL(&sb, baseURL+"/blog", time.Now(), nil)

	// add nodes
	for _, item := range items {
		var alternates map[string]string
		if item.Translations != nil {
			alternates = map[string]string{}
			for _, t := range item.Translations {
				alternates[t.Lang] = baseURL + t.URL
			}
		}
		if node := findSitemapRow(nodes, item.ID); node != nil && node.TranslationGroupID != nil {
			if langs, ok := alternatesByGroup[*node.TranslationGroupID]; ok {
				alternates = langs
			}
		}
		writeSitemapURL(&sb, item.CanonicalURL, item.UpdatedAt, alternates)
	}

	sb.WriteString(`</urlset>`)

	return sb.String(), nil
}

func findSitemapRow(rows []pg.KenFutPublishedRow, nodeID string) *pg.KenFutPublishedRow {
	for i := range rows {
		if rows[i].ID == nodeID {
			return &rows[i]
		}
	}
	return nil
}

// writeSitemapURL 输出 <url> 条目；alternates 非空时输出各语言 hreflang（x-default 指向默认语言 zh）
func writeSitemapURL(sb *strings.Builder, location string, updatedAt time.Time, alternates map[string]string) {
	escapedLocation := escapeSitemapLocation(location)
	if len(alternates) > 1 {
		fmt.Fprintf(sb, `<url><loc>%s</loc><lastmod>%s</lastmod>`, escapedLocation, updatedAt.Format(time.DateOnly))
		for lang, href := range alternates {
			fmt.Fprintf(sb, `<xhtml:link rel="alternate" hreflang="%s" href="%s"/>`, lang, escapeSitemapLocation(href))
		}
		if zh, ok := alternates[domain.DefaultNodeLang]; ok {
			fmt.Fprintf(sb, `<xhtml:link rel="alternate" hreflang="x-default" href="%s"/>`, escapeSitemapLocation(zh))
		}
		sb.WriteString(`</url>`)
		return
	}
	fmt.Fprintf(sb, `<url><loc>%s</loc><lastmod>%s</lastmod></url>`, escapedLocation, updatedAt.Format(time.DateOnly))
}

func escapeSitemapLocation(location string) string {
	var escaped strings.Builder
	_ = xml.EscapeText(&escaped, []byte(location))
	return escaped.String()
}
