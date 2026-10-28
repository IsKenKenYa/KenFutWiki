package usecase

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/url"
	"slices"
	"strings"
	"time"

	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/repo/pg"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var ErrKenFutInvalid = errors.New("invalid integration request")
var ErrKenFutUnauthorized = errors.New("invalid product credential or scope")

type KenFutIntegrationUsecase struct {
	repo    *pg.KenFutIntegrationRepository
	content *KenFutContentUsecase
}

func NewKenFutIntegrationUsecase(repo *pg.KenFutIntegrationRepository, content *KenFutContentUsecase) *KenFutIntegrationUsecase {
	return &KenFutIntegrationUsecase{repo: repo, content: content}
}

func validateKenFutProduct(p *domain.KenFutProduct) error {
	if strings.TrimSpace(p.Name) == "" || len(p.Name) > 120 || len(p.Pages) > 100 {
		return fmt.Errorf("%w: product name or pages", ErrKenFutInvalid)
	}
	origin, err := url.Parse(p.Origin)
	if err != nil {
		return fmt.Errorf("%w: origin", ErrKenFutInvalid)
	}
	ip := net.ParseIP(origin.Hostname())
	local := origin.Hostname() == "localhost" || (ip != nil && ip.IsLoopback())
	if origin.Host == "" || origin.User != nil || (origin.Scheme != "https" && (origin.Scheme != "http" || !local)) || (origin.Path != "" && origin.Path != "/") || origin.RawQuery != "" || origin.Fragment != "" {
		return fmt.Errorf("%w: origin must be HTTPS (localhost HTTP is allowed)", ErrKenFutInvalid)
	}
	p.Origin = strings.TrimSuffix(origin.String(), "/")
	keys := map[string]bool{}
	for i := range p.Pages {
		page := &p.Pages[i]
		parsed, e := url.Parse(page.Path)
		decoded, _ := url.PathUnescape(page.Path)
		if e != nil || page.Key == "" || len(page.Key) > 100 || keys[page.Key] || page.Name == "" || parsed.IsAbs() || parsed.Host != "" || !strings.HasPrefix(page.Path, "/") || strings.HasPrefix(decoded, "//") || strings.Contains(decoded, "\\") {
			return fmt.Errorf("%w: invalid product page", ErrKenFutInvalid)
		}
		keys[page.Key] = true
		for _, param := range page.Parameters {
			if param == "" || len(param) > 64 || param == "kf_click_id" {
				return fmt.Errorf("%w: invalid page parameter", ErrKenFutInvalid)
			}
		}
	}
	if p.Pages == nil {
		p.Pages = []domain.KenFutProductPage{}
	}
	return nil
}
func (u *KenFutIntegrationUsecase) Products(ctx context.Context, kbID string) ([]domain.KenFutProduct, error) {
	return u.repo.Products(ctx, kbID)
}
func (u *KenFutIntegrationUsecase) SaveProduct(ctx context.Context, p domain.KenFutProduct, create bool) (*domain.KenFutProduct, error) {
	if p.KBID == "" {
		return nil, ErrKenFutInvalid
	}
	if err := validateKenFutProduct(&p); err != nil {
		return nil, err
	}
	p.UpdatedAt = time.Now()
	if create {
		p.ID = uuid.NewString()
		p.CreatedAt = p.UpdatedAt
	}
	if err := u.repo.SaveProduct(ctx, &p, create); err != nil {
		return nil, err
	}
	return &p, nil
}
func (u *KenFutIntegrationUsecase) DisableProduct(ctx context.Context, kbID, id string) error {
	p, err := u.repo.Product(ctx, kbID, id)
	if err != nil {
		return err
	}
	p.Enabled = false
	return u.repo.SaveProduct(ctx, p, false)
}
func (u *KenFutIntegrationUsecase) Credentials(ctx context.Context, kbID, productID string) ([]domain.KenFutCredential, error) {
	if err := u.repo.CheckProduct(ctx, kbID, productID); err != nil {
		return nil, err
	}
	return u.repo.Credentials(ctx, productID)
}
func (u *KenFutIntegrationUsecase) CreateCredential(ctx context.Context, kbID, productID string, scopes []string) (*domain.KenFutCredential, string, error) {
	if err := u.repo.CheckProduct(ctx, kbID, productID); err != nil {
		return nil, "", err
	}
	if len(scopes) == 0 || len(scopes) > 2 {
		return nil, "", ErrKenFutInvalid
	}
	for _, s := range scopes {
		if s != "conversion:write" && s != "analytics:read" {
			return nil, "", ErrKenFutInvalid
		}
	}
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return nil, "", err
	}
	token := "kfi_" + hex.EncodeToString(bytes)
	key := &domain.KenFutCredential{ID: uuid.NewString(), ProductID: productID, TokenHash: kenFutHash([]byte(token)), Scopes: scopes, CreatedAt: time.Now()}
	if err := u.repo.CreateCredential(ctx, key); err != nil {
		return nil, "", err
	}
	return key, token, nil
}
func (u *KenFutIntegrationUsecase) RevokeCredential(ctx context.Context, kbID, productID, id string) error {
	if err := u.repo.CheckProduct(ctx, kbID, productID); err != nil {
		return err
	}
	return u.repo.Revoke(ctx, productID, id)
}
func (u *KenFutIntegrationUsecase) Authenticate(ctx context.Context, token, scope string) (*domain.KenFutProduct, error) {
	if !strings.HasPrefix(token, "kfi_") {
		return nil, ErrKenFutUnauthorized
	}
	key, product, err := u.repo.Authenticate(ctx, kenFutHash([]byte(token)))
	if err != nil || !slices.Contains(key.Scopes, scope) {
		return nil, ErrKenFutUnauthorized
	}
	return product, nil
}
func kenFutHash(data []byte) string      { sum := sha256.Sum256(data); return hex.EncodeToString(sum[:]) }
func kenFutPayloadHash(value any) string { data, _ := json.Marshal(value); return kenFutHash(data) }
func validKenFutEventID(id string) bool  { _, err := uuid.Parse(id); return err == nil }

func (u *KenFutIntegrationUsecase) RecordView(ctx context.Context, kbID, session string, req domain.KenFutViewReq, stat domain.StatPage, authID uint) error {
	if !validKenFutEventID(req.EventID) || session == "" || len(session) > 128 {
		return ErrKenFutInvalid
	}
	content, err := u.content.Detail(ctx, kbID, req.NodeID, authID)
	if err != nil {
		return err
	}
	if content.NodeReleaseID != req.NodeReleaseID {
		return fmt.Errorf("%w: content changed; reload the page", ErrKenFutInvalid)
	}
	event := &domain.KenFutEvent{EventID: req.EventID, Kind: "article_view", KBID: kbID, NodeID: req.NodeID, NodeReleaseID: req.NodeReleaseID, SessionID: session, PayloadHash: kenFutPayloadHash(req), OccurredAt: time.Now(), ReceivedAt: time.Now()}
	stat.KBID = kbID
	stat.NodeID = req.NodeID
	stat.SessionID = session
	stat.Scene = domain.StatPageSceneNodeDetail
	stat.CreatedAt = event.OccurredAt
	_, err = u.repo.RecordEvent(ctx, event, &stat)
	return err
}

func (u *KenFutIntegrationUsecase) RecordClick(ctx context.Context, kbID, session, ctaID string, req domain.KenFutClickReq, authID uint) (map[string]string, error) {
	if !validKenFutEventID(req.EventID) || session == "" || len(session) > 128 {
		return nil, ErrKenFutInvalid
	}
	content, err := u.content.Detail(ctx, kbID, req.NodeID, authID)
	if err != nil {
		return nil, err
	}
	if content.NodeReleaseID != req.NodeReleaseID {
		return nil, ErrKenFutInvalid
	}
	if err := u.repo.View(ctx, kbID, req.NodeID, req.ViewID, session); err != nil {
		return nil, fmt.Errorf("%w: view is not recorded", ErrKenFutInvalid)
	}
	var cta *domain.KenFutCTA
	for i := range content.CTAs {
		if content.CTAs[i].ID == ctaID {
			cta = &content.CTAs[i]
			break
		}
	}
	if cta == nil {
		return nil, gorm.ErrRecordNotFound
	}
	productID := ""
	if cta.Target.Type == "product" {
		productID = cta.Target.ProductID
	}
	id := uuid.NewString()
	event := &domain.KenFutEvent{EventID: req.EventID, Kind: "cta_click", KBID: kbID, ProductID: productID, NodeID: req.NodeID, NodeReleaseID: req.NodeReleaseID, CTAID: ctaID, ViewID: req.ViewID, SessionID: session, ClickID: &id, PayloadHash: kenFutPayloadHash(req), OccurredAt: time.Now(), ReceivedAt: time.Now()}
	// Validate the saved target before persisting the click; no caller-provided redirect is accepted.
	if _, err := u.ResolveTarget(ctx, kbID, cta.Target, id, authID); err != nil {
		return nil, err
	}
	event, err = u.repo.RecordEvent(ctx, event, nil)
	if err != nil {
		return nil, err
	}
	target, err := u.ResolveTarget(ctx, kbID, cta.Target, *event.ClickID, authID)
	if err != nil {
		return nil, err
	}
	return map[string]string{"click_id": *event.ClickID, "url": target}, nil
}

func (u *KenFutIntegrationUsecase) ResolveTarget(ctx context.Context, kbID string, target domain.KenFutLinkTarget, clickID string, authID uint) (string, error) {
	var address string
	switch target.Type {
	case "node":
		item, err := u.content.Detail(ctx, kbID, target.NodeID, authID)
		if err != nil {
			return "", err
		}
		address = item.CanonicalURL
	case "site":
		switch target.Page {
		case "home":
			address = "/"
		case "docs":
			address = "/node"
		case "blog":
			address = "/blog"
		default:
			return "", ErrKenFutInvalid
		}
	case "product":
		product, err := u.repo.Product(ctx, kbID, target.ProductID)
		if err != nil {
			return "", err
		}
		if !product.Enabled {
			return "", gorm.ErrRecordNotFound
		}
		return resolveKenFutProductPage(*product, target, clickID)
	case "url":
		address = target.URL
		parsed, err := url.Parse(address)
		if err != nil || parsed.User != nil || parsed.Host == "" || parsed.Scheme != "https" {
			return "", ErrKenFutInvalid
		}
	default:
		return "", ErrKenFutInvalid
	}
	if target.Type == "site" {
		base, err := u.content.baseURL(ctx, kbID)
		if err != nil {
			return "", err
		}
		address = strings.TrimSuffix(base, "/") + address
	}
	parsed, err := url.Parse(address)
	if err != nil {
		return "", ErrKenFutInvalid
	}
	query := parsed.Query()
	for key, value := range target.Params {
		if key == "kf_click_id" || len(value) > 2048 {
			return "", ErrKenFutInvalid
		}
		query.Set(key, value)
	}
	parsed.RawQuery = query.Encode()
	return parsed.String(), nil
}
func resolveKenFutProductPage(product domain.KenFutProduct, target domain.KenFutLinkTarget, clickID string) (string, error) {
	var page *domain.KenFutProductPage
	for i := range product.Pages {
		if product.Pages[i].Key == target.PageKey {
			page = &product.Pages[i]
			break
		}
	}
	if page == nil {
		return "", gorm.ErrRecordNotFound
	}
	origin, err := url.Parse(product.Origin)
	if err != nil {
		return "", ErrKenFutInvalid
	}
	path, err := url.Parse(page.Path)
	if err != nil {
		return "", ErrKenFutInvalid
	}
	address := origin.ResolveReference(path)
	query := address.Query()
	if len(target.Params) > 20 {
		return "", ErrKenFutInvalid
	}
	for key, value := range target.Params {
		if !slices.Contains(page.Parameters, key) || key == "kf_click_id" || len(value) > 2048 {
			return "", ErrKenFutInvalid
		}
		query.Set(key, value)
	}
	if clickID != "" {
		query.Set("kf_click_id", clickID)
	}
	address.RawQuery = query.Encode()
	return address.String(), nil
}

func (u *KenFutIntegrationUsecase) RecordConversion(ctx context.Context, product domain.KenFutProduct, req domain.KenFutConversionReq) error {
	if !validKenFutEventID(req.EventID) || req.SubjectID == "" || len(req.SubjectID) > 256 || (req.EventType != "registered" && req.EventType != "first_generation_success") || req.OccurredAt.IsZero() || req.OccurredAt.After(time.Now().Add(5*time.Minute)) || req.OccurredAt.Before(time.Now().Add(-180*24*time.Hour)) {
		return ErrKenFutInvalid
	}
	if req.ClickID != "" && !validKenFutEventID(req.ClickID) {
		return ErrKenFutInvalid
	}
	event := &domain.KenFutEvent{EventID: req.EventID, Kind: req.EventType, KBID: product.KBID, ProductID: product.ID, SubjectHash: kenFutHash([]byte(req.SubjectID)), PayloadHash: kenFutPayloadHash(req), OccurredAt: req.OccurredAt, ReceivedAt: time.Now()}
	return u.repo.RecordConversion(ctx, event, req.ClickID)
}
func (u *KenFutIntegrationUsecase) Funnel(ctx context.Context, req domain.KenFutFunnelReq) (*domain.KenFutFunnelResp, error) {
	if req.KBID == "" {
		return nil, ErrKenFutInvalid
	}
	if req.To.IsZero() {
		req.To = time.Now()
	}
	if req.From.IsZero() {
		req.From = req.To.Add(-30 * 24 * time.Hour)
	}
	if req.From.Before(time.Now().Add(-180 * 24 * time.Hour)) {
		return nil, fmt.Errorf("%w: 漏斗明细仅支持最近180天；每日事件汇总保留", ErrKenFutInvalid)
	}
	if !req.To.After(req.From) || req.To.Sub(req.From) > 180*24*time.Hour {
		return nil, ErrKenFutInvalid
	}
	if req.ProductID != "" {
		if err := u.repo.CheckProduct(ctx, req.KBID, req.ProductID); err != nil {
			return nil, err
		}
	}
	return u.repo.Funnel(ctx, req)
}
func (u *KenFutIntegrationUsecase) GetPrompt(ctx context.Context, kbID string) (*domain.Prompt, error) {
	if kbID == "" {
		return nil, ErrKenFutInvalid
	}
	return u.repo.GetPrompt(ctx, kbID)
}
func (u *KenFutIntegrationUsecase) SavePrompt(ctx context.Context, kbID string, p domain.Prompt) error {
	if kbID == "" || len(p.Content) > 32768 || len(p.SummaryContent) > 32768 {
		return ErrKenFutInvalid
	}
	return u.repo.SavePrompt(ctx, kbID, p)
}
func (u *KenFutIntegrationUsecase) Moderate(ctx context.Context, kbID, id string, status int) error {
	if kbID == "" || (status != 1 && status != -1) {
		return ErrKenFutInvalid
	}
	return u.repo.Moderate(ctx, kbID, id, status)
}
