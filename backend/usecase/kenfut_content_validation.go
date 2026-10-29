package usecase

import (
	"fmt"
	"net/url"
	"strings"
	"time"
	"unicode"

	"github.com/google/uuid"

	"github.com/chaitin/panda-wiki/domain"
)

func NormalizeKenFutContentMetadata(m *domain.KenFutContentMetadata) error {
	if m.NodeID == "" {
		return fmt.Errorf("node_id is required")
	}
	if m.Channel == "" {
		m.Channel = "docs"
	}
	if m.Channel != "docs" && m.Channel != "article" && m.Channel != "both" {
		return fmt.Errorf("invalid content channel")
	}
	m.Slug = strings.TrimSpace(m.Slug)
	if m.Channel != "docs" && m.Slug == "" {
		m.Slug = m.NodeID
	}
	if err := validateContentSlug(m.Slug); err != nil {
		return err
	}
	if m.DisplayDate != "" {
		if _, err := time.Parse(time.RFC3339, m.DisplayDate); err != nil {
			return fmt.Errorf("display_date must be RFC3339")
		}
	}
	if len([]rune(m.AuthorName)) > 100 || len([]rune(m.Category)) > 100 {
		return fmt.Errorf("author or category is too long")
	}
	if len(m.Tags) > 20 || len(m.RelatedNodeIDs) > 20 {
		return fmt.Errorf("at most 20 tags or related pages are allowed")
	}
	m.AuthorName = strings.TrimSpace(m.AuthorName)
	m.Category = strings.TrimSpace(m.Category)
	m.Tags = uniqueContentStrings(m.Tags)
	m.RelatedNodeIDs = uniqueContentStrings(m.RelatedNodeIDs)
	for _, tag := range m.Tags {
		if len([]rune(tag)) > 64 {
			return fmt.Errorf("tag is too long")
		}
	}
	if len(m.CTAs) > 2 {
		return fmt.Errorf("at most two CTA buttons are allowed")
	}
	if m.CTAs == nil {
		m.CTAs = []domain.KenFutCTA{}
	}
	ids := map[string]bool{}
	for i := range m.CTAs {
		cta := &m.CTAs[i]
		cta.ResolvedURL = ""
		cta.Label = strings.TrimSpace(cta.Label)
		if cta.ID == "" {
			cta.ID = uuid.NewString()
		}
		if len(cta.ID) > 64 || ids[cta.ID] {
			return fmt.Errorf("invalid or duplicate CTA id")
		}
		ids[cta.ID] = true
		if cta.Label == "" || len([]rune(cta.Label)) > 80 {
			return fmt.Errorf("CTA label must contain 1 to 80 characters")
		}
		if cta.Style == "" {
			cta.Style = "primary"
		}
		if cta.Style != "primary" && cta.Style != "secondary" {
			return fmt.Errorf("invalid CTA style")
		}
		if err := ValidateKenFutLinkTarget(cta.Target); err != nil {
			return err
		}
	}
	return nil
}

func validateContentSlug(slug string) error {
	if len([]rune(slug)) > 120 {
		return fmt.Errorf("slug is too long")
	}
	for _, r := range slug {
		if !unicode.IsLetter(r) && !unicode.IsDigit(r) && r != '-' && r != '_' {
			return fmt.Errorf("slug may contain letters, digits, hyphens and underscores")
		}
	}
	if slug == "tags" || slug == "categories" || slug == "search" {
		return fmt.Errorf("slug is reserved")
	}
	return nil
}

func uniqueContentStrings(values []string) []string {
	result := []string{}
	seen := map[string]bool{}
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" && !seen[value] {
			result = append(result, value)
			seen[value] = true
		}
	}
	return result
}

func ValidateKenFutLinkTarget(target domain.KenFutLinkTarget) error {
	switch target.Type {
	case "node":
		if target.NodeID == "" {
			return fmt.Errorf("target node_id is required")
		}
	case "site":
		if target.Page != "home" && target.Page != "docs" && target.Page != "blog" {
			return fmt.Errorf("invalid site page")
		}
	case "product":
		if target.ProductID == "" || target.PageKey == "" {
			return fmt.Errorf("product and page key are required")
		}
	case "url":
		u, err := url.Parse(target.URL)
		if err != nil {
			return fmt.Errorf("external target must use HTTPS")
		}
		localHTTP := u.Scheme == "http" && (u.Hostname() == "localhost" || u.Hostname() == "127.0.0.1")
		if u.Host == "" || u.User != nil || (u.Scheme != "https" && !localHTTP) {
			return fmt.Errorf("external target must use HTTPS")
		}
	default:
		return fmt.Errorf("invalid link target type")
	}
	if len(target.Params) > 20 {
		return fmt.Errorf("too many target parameters")
	}
	for key, value := range target.Params {
		if key == "kf_click_id" || len(key) > 64 || len(value) > 1000 {
			return fmt.Errorf("invalid or reserved target parameter")
		}
	}
	return nil
}
