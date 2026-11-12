package share

import (
	"encoding/json"
	"encoding/xml"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/chaitin/panda-wiki/domain"
)

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
	Author      string `xml:"author"`
}

type rssFeed struct {
	XMLName xml.Name `xml:"rss"`
	Version string   `xml:"version,attr"`
	Channel struct {
		Title       string        `xml:"title"`
		SelfLink    rssSelfLink   `xml:"http://www.w3.org/2005/Atom link"`
		Link        string        `xml:"link"`
		Description string        `xml:"description"`
		Language    string        `xml:"language"`
		Items       []rssFeedItem `xml:"item"`
	} `xml:"channel"`
}

func TestKenFutRSSFeedHTTP(t *testing.T) {
	s := actionFixture(t)
	e := echo.New()
	registerBrowserHandlers(e, s)

	req := httptest.NewRequest(http.MethodGet, "/rss.xml?lang=zh", nil)
	req.Header.Set("X-KB-ID", browserKBID)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /rss.xml: HTTP%d %s", rec.Code, rec.Body.String())
	}
	if ct := rec.Header().Get("Content-Type"); !strings.Contains(ct, "xml") {
		t.Fatalf("content type must be xml: %s", ct)
	}
	var feed rssFeed
	if err := xml.Unmarshal(rec.Body.Bytes(), &feed); err != nil {
		t.Fatalf("invalid rss xml: %v\n%s", err, rec.Body.String())
	}
	if feed.Version != "2.0" {
		t.Fatalf("rss version: %s", feed.Version)
	}
	if feed.Channel.Link != "https://docs.example.test" {
		t.Fatalf("channel link: %q\n%s", feed.Channel.Link, rec.Body.String())
	}
	if feed.Channel.SelfLink.Href != "https://docs.example.test/rss.xml" || feed.Channel.SelfLink.Rel != "self" {
		t.Fatalf("atom self link: %#v", feed.Channel.SelfLink)
	}
	if len(feed.Channel.Items) != 2 {
		t.Fatalf("article channel must contain both and article items, got %d", len(feed.Channel.Items))
	}
	links := map[string]rssFeedItem{}
	for _, item := range feed.Channel.Items {
		if !strings.HasPrefix(item.Link, "https://docs.example.test/blog/") {
			t.Fatalf("item link must be an absolute blog address: %s", item.Link)
		}
		if item.Link != item.GUID {
			t.Fatalf("guid must equal the link: %s vs %s", item.GUID, item.Link)
		}
		if _, err := time.Parse(time.RFC1123Z, item.PubDate); err != nil {
			t.Fatalf("pubDate must follow RFC 822: %s (%v)", item.PubDate, err)
		}
		links[item.Title] = item
	}
	if _, ok := links["模型生成教程"]; !ok {
		t.Fatalf("both-channel article missing from feed: %v", feed.Channel.Items)
	}
	if _, ok := links["产品更新"]; !ok {
		t.Fatalf("article-channel item missing from feed: %v", feed.Channel.Items)
	}
	if item := links["模型生成教程"]; !strings.Contains(item.Description, "KenFutWiki") {
		t.Fatalf("summary missing from item description: %q", item.Description)
	}

	// 语言过滤：fixture 只有默认语言内容，en 请求得到空频道。
	req = httptest.NewRequest(http.MethodGet, "/rss.xml?lang=en", nil)
	req.Header.Set("X-KB-ID", browserKBID)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /rss.xml?lang=en: HTTP%d", rec.Code)
	}
	feed = rssFeed{}
	if err := xml.Unmarshal(rec.Body.Bytes(), &feed); err != nil {
		t.Fatal(err)
	}
	if len(feed.Channel.Items) != 0 {
		t.Fatalf("english feed must be empty for zh-only fixture, got %d", len(feed.Channel.Items))
	}

	// 缺少知识库标识时与 sitemap 相同，返回统一的错误应答。
	req = httptest.NewRequest(http.MethodGet, "/rss.xml", nil)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	var reply domain.PWResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &reply); err != nil || reply.Success {
		t.Fatalf("missing X-KB-ID must return an error reply: HTTP%d %s", rec.Code, rec.Body.String())
	}
}
