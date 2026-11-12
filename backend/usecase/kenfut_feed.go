package usecase

import (
	"bytes"
	"context"
	"encoding/xml"
	"fmt"
	"time"

	"github.com/chaitin/panda-wiki/domain"
)

// RSS 订阅单次输出的文章数量上限。
const feedItemLimit = 50

// rssFeed 系列为 RSS 2.0 序列化结构，转义与编码交由 encoding/xml 处理。
type rssFeed struct {
	XMLName xml.Name   `xml:"rss"`
	Version string     `xml:"version,attr"`
	Atom    string     `xml:"xmlns:atom,attr"`
	DC      string     `xml:"xmlns:dc,attr"`
	Channel rssChannel `xml:"channel"`
}

type rssChannel struct {
	Title       string        `xml:"title"`
	Link        string        `xml:"link"`
	Description string        `xml:"description"`
	Language    string        `xml:"language,omitempty"`
	LastBuild   string        `xml:"lastBuildDate,omitempty"`
	SelfLink    rssSelfLink   `xml:"atom:link"`
	Items       []rssFeedItem `xml:"item"`
}

type rssSelfLink struct {
	Href string `xml:"href,attr"`
	Rel  string `xml:"rel,attr"`
	Type string `xml:"type,attr"`
}

type rssFeedItem struct {
	Title       string `xml:"title"`
	Link        string `xml:"link"`
	GUID        string `xml:"guid"`
	Description string `xml:"description"`
	PubDate     string `xml:"pubDate"`
	Creator     string `xml:"dc:creator,omitempty"`
}

// Feed 输出博客频道（含 both 频道）已发布文章的 RSS 2.0 订阅。
// 与 sitemap 相同，仅包含当前发布清单中的内容，匿名口径可见。
func (u *KenFutContentUsecase) Feed(ctx context.Context, kbID, lang string) (string, error) {
	list, err := u.List(ctx, domain.KenFutContentListReq{KBID: kbID, Channel: "article", Lang: lang, Page: 1, PageSize: feedItemLimit}, 0)
	if err != nil {
		return "", fmt.Errorf("feed list: %w", err)
	}
	base, err := u.baseURL(ctx, kbID)
	if err != nil {
		return "", fmt.Errorf("feed base url: %w", err)
	}
	kb, err := u.kb.GetKnowledgeBaseByID(ctx, kbID)
	if err != nil {
		return "", fmt.Errorf("feed knowledge base: %w", err)
	}
	feedLang := lang
	if feedLang == "" {
		feedLang = domain.DefaultNodeLang
	}
	channel := rssChannel{
		Title:       kb.Name,
		Link:        base,
		Description: kb.Name,
		Language:    feedLang,
		SelfLink:    rssSelfLink{Href: base + "/rss.xml", Rel: "self", Type: "application/rss+xml"},
		Items:       make([]rssFeedItem, 0, len(list.Items)),
	}
	for i, item := range list.Items {
		// 与列表排序同口径：展示时间优先，缺省时用发布版本更新时间。
		published := item.UpdatedAt
		if item.DisplayDate != "" {
			if parsed, err := time.Parse(time.RFC3339, item.DisplayDate); err == nil {
				published = parsed
			}
		}
		if i == 0 {
			channel.LastBuild = published.Format(time.RFC1123Z)
		}
		channel.Items = append(channel.Items, rssFeedItem{
			Title:       item.Title,
			Link:        item.URL,
			GUID:        item.URL,
			Description: item.Summary,
			PubDate:     published.Format(time.RFC1123Z),
			Creator:     item.AuthorName,
		})
	}
	feed := rssFeed{Version: "2.0", Atom: "http://www.w3.org/2005/Atom", DC: "http://purl.org/dc/elements/1.1/", Channel: channel}
	var buf bytes.Buffer
	buf.WriteString(xml.Header)
	if err := xml.NewEncoder(&buf).Encode(feed); err != nil {
		return "", fmt.Errorf("feed encode: %w", err)
	}
	return buf.String(), nil
}
