package domain

import (
	"fmt"
	"net/url"
	"slices"
)

// ResolveKenFutProductPage applies the registered page's parameter allowlist.
// Both publication validation and public redirects use the same rules.
func ResolveKenFutProductPage(product KenFutProduct, target KenFutLinkTarget, clickID string) (string, error) {
	var page *KenFutProductPage
	for i := range product.Pages {
		if product.Pages[i].Key == target.PageKey {
			page = &product.Pages[i]
			break
		}
	}
	if page == nil {
		return "", fmt.Errorf("product page is not registered")
	}
	origin, err := url.Parse(product.Origin)
	if err != nil {
		return "", fmt.Errorf("invalid product origin: %w", err)
	}
	path, err := url.Parse(page.Path)
	if err != nil {
		return "", fmt.Errorf("invalid product page: %w", err)
	}
	address := origin.ResolveReference(path)
	query := address.Query()
	if len(target.Params) > 20 {
		return "", fmt.Errorf("too many target parameters")
	}
	for key, value := range target.Params {
		if !slices.Contains(page.Parameters, key) || key == "kf_click_id" || len(value) > 2048 {
			return "", fmt.Errorf("product page parameter %q is not allowed", key)
		}
		query.Set(key, value)
	}
	if clickID != "" {
		query.Set("kf_click_id", clickID)
	}
	address.RawQuery = query.Encode()
	return address.String(), nil
}
