package usecase

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"

	navV1 "github.com/chaitin/panda-wiki/api/nav/v1"
	nodeV1 "github.com/chaitin/panda-wiki/api/node/v1"
	"github.com/chaitin/panda-wiki/consts"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/repo/pg"
	"github.com/chaitin/panda-wiki/store/rag"
	"github.com/chaitin/panda-wiki/utils"
)

type MCPUsecase struct {
	nodeRepo          *pg.NodeRepository
	navRepo           *pg.NavRepository
	mcpRepo           *pg.MCPRepository
	nodeUsecase       *NodeUsecase
	navUsecase        *NavUsecase
	kbUsecase         *KnowledgeBaseUsecase
	fileUsecase       *FileUsecase
	commentUsecase    *CommentUsecase
	contributeUsecase *ContributeUsecase
	statUsecase       *StatUseCase
	ragService        rag.RAGService
	logger            *log.Logger
}

func NewMCPUsecase(
	nodeRepo *pg.NodeRepository,
	navRepo *pg.NavRepository,
	mcpRepo *pg.MCPRepository,
	nodeUsecase *NodeUsecase,
	navUsecase *NavUsecase,
	kbUsecase *KnowledgeBaseUsecase,
	fileUsecase *FileUsecase,
	commentUsecase *CommentUsecase,
	contributeUsecase *ContributeUsecase,
	statUsecase *StatUseCase,
	ragService rag.RAGService,
	logger *log.Logger,
) *MCPUsecase {
	return &MCPUsecase{
		nodeRepo:          nodeRepo,
		navRepo:           navRepo,
		mcpRepo:           mcpRepo,
		nodeUsecase:       nodeUsecase,
		navUsecase:        navUsecase,
		kbUsecase:         kbUsecase,
		fileUsecase:       fileUsecase,
		commentUsecase:    commentUsecase,
		contributeUsecase: contributeUsecase,
		statUsecase:       statUsecase,
		ragService:        ragService,
		logger:            logger.WithModule("usecase.mcp"),
	}
}

func (u *MCPUsecase) WikiInfo(ctx context.Context, kbID string) (map[string]any, error) {
	kb, err := u.kbUsecase.GetKnowledgeBase(ctx, kbID)
	if err != nil {
		return nil, err
	}
	navs, err := u.navUsecase.GetList(ctx, kbID)
	if err != nil {
		return nil, err
	}
	nodes, err := u.nodeUsecase.GetList(ctx, &domain.GetNodeListReq{KBID: kbID})
	if err != nil {
		return nil, err
	}
	var documentCount, folderCount, draftCount, publishedCount int
	for _, node := range nodes {
		switch node.Type {
		case domain.NodeTypeFolder:
			folderCount++
		case domain.NodeTypeDocument:
			documentCount++
		}
		if node.Status == domain.NodeStatusPublished {
			publishedCount++
		} else {
			draftCount++
		}
	}
	return map[string]any{
		"kb_id":           kb.ID,
		"name":            kb.Name,
		"base_url":        kb.AccessSettings.GetBaseUrl(),
		"default_lang":    domain.DefaultNodeLang,
		"supported_langs": domain.SupportedNodeLangs,
		"navigations":     navs,
		"counts": map[string]int{
			"documents": documentCount,
			"folders":   folderCount,
			"drafts":    draftCount,
			"published": publishedCount,
		},
	}, nil
}

func (u *MCPUsecase) ListNavs(ctx context.Context, kbID string) ([]navV1.NavListResp, error) {
	return u.navUsecase.GetList(ctx, kbID)
}

func (u *MCPUsecase) ListDocs(ctx context.Context, kbID string, req *domain.MCPListDocsReq) (*domain.MCPListDocsResp, error) {
	limit := domain.NormalizeMCPLimit(req.Limit, 50, 200)
	offset := req.Offset
	if offset < 0 {
		offset = 0
	}
	nodes, err := u.nodeUsecase.GetList(ctx, &domain.GetNodeListReq{
		KBID:   kbID,
		NavId:  req.NavID,
		Search: req.Search,
	})
	if err != nil {
		return nil, err
	}
	filtered := make([]*domain.NodeListItemResp, 0, len(nodes))
	for _, node := range nodes {
		if !matchesParent(node, req.ParentID) {
			continue
		}
		if !matchesStatus(node, req.Status) {
			continue
		}
		filtered = append(filtered, node)
	}
	total := int64(len(filtered))
	start := offset
	if start > len(filtered) {
		start = len(filtered)
	}
	end := start + limit
	if end > len(filtered) {
		end = len(filtered)
	}
	return &domain.MCPListDocsResp{
		Total: total,
		Items: filtered[start:end],
	}, nil
}

func matchesParent(node *domain.NodeListItemResp, parentID string) bool {
	switch parentID {
	case "":
		return true
	case "root":
		return node.ParentID == ""
	default:
		return node.ParentID == parentID
	}
}

func matchesStatus(node *domain.NodeListItemResp, status string) bool {
	switch status {
	case "", "all":
		return true
	case "draft", "unpublished":
		return node.Status != domain.NodeStatusPublished
	case "published":
		return node.Status == domain.NodeStatusPublished
	default:
		return false
	}
}

func (u *MCPUsecase) GetDoc(ctx context.Context, kbID string, req *domain.MCPGetDocReq) (*domain.MCPDocDetail, error) {
	source := strings.ToLower(strings.TrimSpace(req.Source))
	if source == "" {
		source = "draft"
	}
	format := strings.ToLower(strings.TrimSpace(req.Format))
	if format == "" {
		format = "raw"
	}
	if format != "raw" && format != "markdown" {
		return nil, fmt.Errorf("%w: format must be raw or markdown", domain.ErrMCPInvalidArgument)
	}
	switch source {
	case "draft":
		node, err := u.nodeRepo.GetNodeByID(ctx, req.NodeID)
		if err != nil {
			return nil, err
		}
		if node.KBID != kbID {
			return nil, gorm.ErrRecordNotFound
		}
		contentType := node.Meta.ContentType
		if contentType == "" {
			contentType = domain.ContentTypeHTML
		}
		detail := &domain.MCPDocDetail{
			ID:          node.ID,
			Name:        node.Name,
			Type:        node.Type,
			Status:      node.Status,
			NavID:       node.NavId,
			ParentID:    node.ParentID,
			Lang:        node.Lang,
			Content:     node.Content,
			ContentType: contentType,
			Emoji:       node.Meta.Emoji,
			Summary:     node.Meta.Summary,
			UpdatedAt:   node.UpdatedAt,
		}
		if format == "markdown" && contentType == domain.ContentTypeHTML && utils.IsLikelyHTML(detail.Content) {
			converted, err := rag.NewHTML2MDConverter().ConvertString(detail.Content)
			if err != nil {
				return nil, fmt.Errorf("convert HTML to Markdown failed: %w", err)
			}
			detail.Content = converted
			detail.ContentType = domain.ContentTypeMD
		}
		return detail, nil
	case "published":
		release, err := u.nodeRepo.GetLatestNodeReleaseByNodeID(ctx, req.NodeID)
		if err != nil {
			return nil, err
		}
		if release.KBID != kbID {
			return nil, gorm.ErrRecordNotFound
		}
		contentType := release.Meta.ContentType
		if contentType == "" {
			contentType = domain.ContentTypeHTML
		}
		detail := &domain.MCPDocDetail{
			ID:          release.NodeID,
			Name:        release.Name,
			Type:        release.Type,
			Status:      domain.NodeStatusPublished,
			ParentID:    release.ParentID,
			Lang:        "",
			Content:     release.Content,
			ContentType: contentType,
			Emoji:       release.Meta.Emoji,
			Summary:     release.Meta.Summary,
			UpdatedAt:   release.UpdatedAt,
			VersionID:   release.ID,
		}
		if format == "markdown" && contentType == domain.ContentTypeHTML && utils.IsLikelyHTML(detail.Content) {
			converted, err := rag.NewHTML2MDConverter().ConvertString(detail.Content)
			if err != nil {
				return nil, fmt.Errorf("convert HTML to Markdown failed: %w", err)
			}
			detail.Content = converted
			detail.ContentType = domain.ContentTypeMD
		}
		return detail, nil
	default:
		return nil, fmt.Errorf("%w: source must be draft or published", domain.ErrMCPInvalidArgument)
	}
}

func (u *MCPUsecase) SearchDocs(ctx context.Context, kbID string, req *domain.MCPSearchReq) (*domain.MCPDocSearchResp, error) {
	query := strings.TrimSpace(req.Query)
	if query == "" {
		return nil, fmt.Errorf("%w: query is required", domain.ErrMCPInvalidArgument)
	}
	limit := domain.NormalizeMCPLimit(req.Limit, 20, 50)
	mode := strings.ToLower(strings.TrimSpace(req.Mode))
	if mode == "" {
		mode = "keyword"
	}
	switch mode {
	case "keyword":
		nodes, err := u.nodeUsecase.GetList(ctx, &domain.GetNodeListReq{
			KBID:   kbID,
			NavId:  req.NavID,
			Search: query,
		})
		if err != nil {
			return nil, err
		}
		items := make([]*domain.MCPDocSearchItem, 0, limit)
		for _, node := range nodes {
			if len(items) >= limit {
				break
			}
			snippet := node.Summary
			if snippet == "" {
				snippet = node.Name
			}
			items = append(items, &domain.MCPDocSearchItem{
				NodeID:   node.ID,
				Name:     node.Name,
				Snippet:  snippet,
				Status:   node.Status,
				NavID:    node.NavId,
				ParentID: node.ParentID,
				Lang:     node.Lang,
			})
		}
		return &domain.MCPDocSearchResp{Items: items}, nil
	case "semantic":
		kb, err := u.kbUsecase.GetKnowledgeBase(ctx, kbID)
		if err != nil {
			return nil, err
		}
		_, chunks, err := u.ragService.QueryRecords(ctx, &rag.QueryRecordsRequest{
			DatasetID:           kb.DatasetID,
			Query:               query,
			SimilarityThreshold: 0.25,
			MaxChunksPerDoc:     2,
		})
		if err != nil {
			return nil, fmt.Errorf("semantic search failed: %w", err)
		}
		seen := make(map[string]bool)
		items := make([]*domain.MCPDocSearchItem, 0, limit)
		for _, chunk := range chunks {
			if len(items) >= limit {
				break
			}
			nodeID, err := u.nodeRepo.GetNodeIdByDocId(ctx, chunk.DocID)
			if err != nil {
				u.logger.Warn("skip semantic chunk without node", log.String("doc_id", chunk.DocID), log.Error(err))
				continue
			}
			if seen[nodeID] {
				continue
			}
			node, err := u.nodeRepo.GetNodeByID(ctx, nodeID)
			if err != nil {
				return nil, err
			}
			if node.KBID != kbID {
				continue
			}
			if req.NavID != "" && node.NavId != req.NavID {
				continue
			}
			seen[nodeID] = true
			items = append(items, &domain.MCPDocSearchItem{
				NodeID:   node.ID,
				Name:     node.Name,
				Snippet:  truncateRunes(chunk.Content, 300),
				Status:   node.Status,
				NavID:    node.NavId,
				ParentID: node.ParentID,
				Lang:     node.Lang,
			})
		}
		return &domain.MCPDocSearchResp{Items: items}, nil
	default:
		return nil, fmt.Errorf("%w: mode must be keyword or semantic", domain.ErrMCPInvalidArgument)
	}
}

func (u *MCPUsecase) CreateNav(ctx context.Context, kbID, name string, position *float64) (map[string]any, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, fmt.Errorf("%w: name is required", domain.ErrMCPInvalidArgument)
	}
	navID, err := u.navUsecase.Add(ctx, &navV1.NavAddReq{
		KbId:     kbID,
		Name:     name,
		Position: position,
	})
	if err != nil {
		return nil, err
	}
	return map[string]any{"nav_id": navID, "name": name}, nil
}

func (u *MCPUsecase) UpdateNav(ctx context.Context, kbID, navID, name string) error {
	name = strings.TrimSpace(name)
	if name == "" || navID == "" {
		return fmt.Errorf("%w: nav_id and name are required", domain.ErrMCPInvalidArgument)
	}
	nav, err := u.navRepo.GetById(ctx, navID)
	if err != nil {
		return err
	}
	if nav.KbID != kbID {
		return gorm.ErrRecordNotFound
	}
	return u.navUsecase.Update(ctx, &navV1.NavUpdateReq{
		KbId: kbID,
		ID:   navID,
		Name: name,
	})
}

func (u *MCPUsecase) DeleteNav(ctx context.Context, kbID, navID, confirmName string) (map[string]any, error) {
	nav, err := u.navRepo.GetById(ctx, navID)
	if err != nil {
		return nil, err
	}
	if nav.KbID != kbID {
		return nil, gorm.ErrRecordNotFound
	}
	if strings.TrimSpace(confirmName) != nav.Name {
		return nil, fmt.Errorf("%w: confirm_name does not match navigation name %q", domain.ErrMCPInvalidArgument, nav.Name)
	}
	if err := u.navUsecase.Delete(ctx, &navV1.NavDeleteReq{KbId: kbID, ID: navID}); err != nil {
		return nil, err
	}
	return map[string]any{"deleted_nav_id": navID, "deleted_name": nav.Name}, nil
}

func (u *MCPUsecase) CreateDoc(ctx context.Context, kbID string, req *domain.MCPCreateDocReq) (*map[string]any, error) {
	authInfo, err := mcpWriteAuth(ctx)
	if err != nil {
		return nil, err
	}
	return runMCPIdempotent(ctx, u.mcpRepo, kbID, "create_doc", req.IdempotencyKey, func() (*map[string]any, error) {
		name := strings.TrimSpace(req.Name)
		if name == "" || req.NavID == "" {
			return nil, fmt.Errorf("%w: nav_id and name are required", domain.ErrMCPInvalidArgument)
		}
		if err := u.validateNav(ctx, kbID, req.NavID); err != nil {
			return nil, err
		}
		if req.ParentID != "" {
			parent, err := u.nodeRepo.GetNodeByID(ctx, req.ParentID)
			if err != nil {
				return nil, err
			}
			if parent.KBID != kbID || parent.Type != domain.NodeTypeFolder {
				return nil, fmt.Errorf("%w: parent_id must be a folder in this knowledge base", domain.ErrMCPInvalidArgument)
			}
			if parent.NavId != req.NavID {
				return nil, fmt.Errorf("%w: parent folder belongs to another navigation", domain.ErrMCPInvalidArgument)
			}
		}
		contentType := strings.ToLower(strings.TrimSpace(req.ContentType))
		if contentType == "" {
			contentType = domain.ContentTypeMD
		}
		if contentType != domain.ContentTypeMD && contentType != domain.ContentTypeHTML {
			return nil, fmt.Errorf("%w: content_type must be md or html", domain.ErrMCPInvalidArgument)
		}
		lang := req.Lang
		if lang == "" {
			lang = domain.DefaultNodeLang
		}
		if !domain.IsValidNodeLang(lang) {
			return nil, fmt.Errorf("%w: unsupported lang %q", domain.ErrMCPInvalidArgument, lang)
		}
		summary := req.Summary
		createReq := &domain.CreateNodeReq{
			KBID:        kbID,
			NavId:       req.NavID,
			ParentID:    req.ParentID,
			Type:        domain.NodeTypeDocument,
			Name:        name,
			Content:     req.Content,
			Emoji:       req.Emoji,
			Summary:     &summary,
			ContentType: &contentType,
			MaxNode:     domain.GetBaseEditionLimitation(ctx).MaxNode,
			Position:    req.Position,
			Lang:        lang,
		}
		nodeID, err := u.nodeUsecase.Create(ctx, createReq, authInfo.UserID)
		if err != nil {
			return nil, err
		}
		return &map[string]any{
			"node_id": nodeID,
			"status":  domain.NodeStatusUnreleased,
		}, nil
	})
}

func (u *MCPUsecase) UpdateDoc(ctx context.Context, kbID string, req *domain.MCPUpdateDocReq) (*map[string]any, error) {
	authInfo, err := mcpWriteAuth(ctx)
	if err != nil {
		return nil, err
	}
	if req.Name == nil && req.Content == nil && req.ContentType == nil && req.Emoji == nil && req.Summary == nil && req.NavID == nil {
		return nil, fmt.Errorf("%w: provide at least one field to update", domain.ErrMCPInvalidArgument)
	}
	return runMCPIdempotent(ctx, u.mcpRepo, kbID, "update_doc", req.IdempotencyKey, func() (*map[string]any, error) {
		current, err := u.nodeRepo.GetNodeByID(ctx, req.NodeID)
		if err != nil {
			return nil, err
		}
		if current.KBID != kbID {
			return nil, gorm.ErrRecordNotFound
		}
		if req.ExpectedUpdatedAt != nil && !current.UpdatedAt.Equal(*req.ExpectedUpdatedAt) {
			return nil, domain.ErrMCPVersionConflict
		}
		if req.NavID != nil && *req.NavID != current.NavId {
			if err := u.validateNav(ctx, kbID, *req.NavID); err != nil {
				return nil, err
			}
			if err := u.nodeUsecase.MoveNodeNav(ctx, &nodeV1.NodeMoveNavReq{
				IDs:   []string{req.NodeID},
				KbID:  kbID,
				NavID: *req.NavID,
			}); err != nil {
				return nil, err
			}
			// 移动操作已经改变 updated_at，版本检查在上面完成。
			req.ExpectedUpdatedAt = nil
		}
		if req.ContentType != nil {
			contentType := strings.ToLower(strings.TrimSpace(*req.ContentType))
			if contentType != domain.ContentTypeMD && contentType != domain.ContentTypeHTML {
				return nil, fmt.Errorf("%w: content_type must be md or html", domain.ErrMCPInvalidArgument)
			}
			if current.Meta.ContentType != "" && current.Meta.ContentType != contentType {
				return nil, fmt.Errorf("%w: content_type cannot be changed after it is set", domain.ErrMCPInvalidArgument)
			}
			req.ContentType = &contentType
		}
		if req.Name != nil {
			name := strings.TrimSpace(*req.Name)
			if name == "" {
				return nil, fmt.Errorf("%w: name cannot be empty", domain.ErrMCPInvalidArgument)
			}
			req.Name = &name
		}
		updateReq := &domain.UpdateNodeReq{
			ID:                req.NodeID,
			KBID:              kbID,
			Name:              req.Name,
			Content:           req.Content,
			Emoji:             req.Emoji,
			Summary:           req.Summary,
			ContentType:       req.ContentType,
			ExpectedUpdatedAt: req.ExpectedUpdatedAt,
		}
		if err := u.nodeUsecase.Update(ctx, updateReq, authInfo.UserID); err != nil {
			return nil, err
		}
		updated, err := u.nodeRepo.GetNodeByID(ctx, req.NodeID)
		if err != nil {
			return nil, err
		}
		return &map[string]any{
			"node_id":    updated.ID,
			"status":     updated.Status,
			"updated_at": updated.UpdatedAt,
		}, nil
	})
}

func (u *MCPUsecase) MoveDoc(ctx context.Context, kbID string, req *domain.MCPMoveDocReq) (map[string]any, error) {
	if _, err := mcpWriteAuth(ctx); err != nil {
		return nil, err
	}
	current, err := u.nodeRepo.GetNodeByID(ctx, req.NodeID)
	if err != nil {
		return nil, err
	}
	if current.KBID != kbID {
		return nil, gorm.ErrRecordNotFound
	}
	if req.NavID != "" && req.NavID != current.NavId {
		if err := u.validateNav(ctx, kbID, req.NavID); err != nil {
			return nil, err
		}
		if err := u.nodeUsecase.MoveNodeNav(ctx, &nodeV1.NodeMoveNavReq{
			IDs:   []string{req.NodeID},
			KbID:  kbID,
			NavID: req.NavID,
		}); err != nil {
			return nil, err
		}
	}
	if req.ParentID != "" {
		parent, err := u.nodeRepo.GetNodeByID(ctx, req.ParentID)
		if err != nil {
			return nil, err
		}
		if parent.KBID != kbID || parent.Type != domain.NodeTypeFolder {
			return nil, fmt.Errorf("%w: parent_id must be a folder in this knowledge base", domain.ErrMCPInvalidArgument)
		}
	}
	if req.ParentID != "" || req.PrevID != "" || req.NextID != "" {
		if err := u.nodeUsecase.MoveNode(ctx, &domain.MoveNodeReq{
			ID:       req.NodeID,
			KbID:     kbID,
			ParentID: req.ParentID,
			PrevID:   req.PrevID,
			NextID:   req.NextID,
		}); err != nil {
			return nil, err
		}
	}
	return map[string]any{"node_id": req.NodeID, "moved": true}, nil
}

func (u *MCPUsecase) DeleteDoc(ctx context.Context, kbID string, req *domain.MCPDeleteDocReq) (*map[string]any, error) {
	if _, err := mcpWriteAuth(ctx); err != nil {
		return nil, err
	}
	return runMCPIdempotent(ctx, u.mcpRepo, kbID, "delete_doc", req.IdempotencyKey, func() (*map[string]any, error) {
		node, err := u.nodeRepo.GetNodeByID(ctx, req.NodeID)
		if err != nil {
			return nil, err
		}
		if node.KBID != kbID {
			return nil, gorm.ErrRecordNotFound
		}
		if strings.TrimSpace(req.ConfirmName) != node.Name {
			return nil, fmt.Errorf("%w: confirm_name does not match document name %q", domain.ErrMCPInvalidArgument, node.Name)
		}
		if node.Type == domain.NodeTypeFolder {
			count, err := u.nodeRepo.CountChildren(ctx, kbID, node.ID)
			if err != nil {
				return nil, err
			}
			if count > 0 && !req.Recursive {
				return nil, fmt.Errorf("%w: folder has %d child node(s); pass recursive=true to delete them", domain.ErrMCPInvalidArgument, count)
			}
		}
		if err := u.nodeUsecase.NodeAction(ctx, &domain.NodeActionReq{
			IDs:    []string{req.NodeID},
			KBID:   kbID,
			Action: "delete",
		}); err != nil {
			return nil, err
		}
		return &map[string]any{
			"deleted_node_id": req.NodeID,
			"deleted_name":    node.Name,
		}, nil
	})
}

func (u *MCPUsecase) PublishDocs(ctx context.Context, kbID string, req *domain.MCPPublishReq) (*map[string]any, error) {
	authInfo, err := mcpWriteAuth(ctx)
	if err != nil {
		return nil, err
	}
	return runMCPIdempotent(ctx, u.mcpRepo, kbID, "publish_docs", req.IdempotencyKey, func() (*map[string]any, error) {
		if len(req.NodeIDs) == 0 {
			return nil, fmt.Errorf("%w: node_ids is required", domain.ErrMCPInvalidArgument)
		}
		message := strings.TrimSpace(req.Message)
		if message == "" {
			return nil, fmt.Errorf("%w: message is required", domain.ErrMCPInvalidArgument)
		}
		tag := strings.TrimSpace(req.Tag)
		if tag == "" {
			tag = "mcp"
		}
		releaseID, err := u.kbUsecase.CreateKBRelease(ctx, &domain.CreateKBReleaseReq{
			KBID:    kbID,
			Message: message,
			Tag:     tag,
			NodeIDs: req.NodeIDs,
		}, authInfo.UserID)
		if err != nil {
			return nil, err
		}
		return &map[string]any{
			"release_id": releaseID,
			"node_ids":   req.NodeIDs,
		}, nil
	})
}

func (u *MCPUsecase) ListReleases(ctx context.Context, kbID string, page, pageSize int) (*domain.GetKBReleaseListResp, error) {
	if page < 1 {
		page = 1
	}
	pageSize = domain.NormalizeMCPLimit(pageSize, 20, 100)
	return u.kbUsecase.GetKBReleaseList(ctx, &domain.GetKBReleaseListReq{
		KBID: kbID,
		Pager: domain.Pager{
			Page:     page,
			PageSize: pageSize,
		},
	})
}

func (u *MCPUsecase) ListVersions(ctx context.Context, kbID string, req *domain.MCPListVersionsReq) (map[string]any, error) {
	if req.NodeID == "" {
		return nil, fmt.Errorf("%w: node_id is required", domain.ErrMCPInvalidArgument)
	}
	limit := domain.NormalizeMCPLimit(req.Limit, 20, 100)
	offset := req.Offset
	if offset < 0 {
		offset = 0
	}
	releases, total, err := u.nodeRepo.ListNodeReleases(ctx, kbID, req.NodeID, offset, limit)
	if err != nil {
		return nil, err
	}
	items := make([]*domain.MCPVersionItem, 0, len(releases))
	for _, release := range releases {
		items = append(items, &domain.MCPVersionItem{
			ID:          release.ID,
			NodeID:      release.NodeID,
			Name:        release.Name,
			PublisherID: release.PublisherId,
			EditorID:    release.EditorId,
			CreatedAt:   release.CreatedAt,
		})
	}
	return map[string]any{"total": total, "items": items}, nil
}

func (u *MCPUsecase) GetVersion(ctx context.Context, kbID, versionID string) (*domain.MCPDocDetail, error) {
	release, err := u.nodeRepo.GetNodeReleaseByID(ctx, versionID)
	if err != nil {
		return nil, err
	}
	if release.KBID != kbID {
		return nil, gorm.ErrRecordNotFound
	}
	contentType := release.Meta.ContentType
	if contentType == "" {
		contentType = domain.ContentTypeHTML
	}
	return &domain.MCPDocDetail{
		ID:          release.NodeID,
		Name:        release.Name,
		Type:        release.Type,
		Status:      domain.NodeStatusPublished,
		ParentID:    release.ParentID,
		Content:     release.Content,
		ContentType: contentType,
		Emoji:       release.Meta.Emoji,
		Summary:     release.Meta.Summary,
		UpdatedAt:   release.UpdatedAt,
		VersionID:   release.ID,
	}, nil
}

func (u *MCPUsecase) RestoreVersion(ctx context.Context, kbID string, req *domain.MCPRestoreVersionReq) (*map[string]any, error) {
	authInfo, err := mcpWriteAuth(ctx)
	if err != nil {
		return nil, err
	}
	return runMCPIdempotent(ctx, u.mcpRepo, kbID, "restore_doc_version", req.IdempotencyKey, func() (*map[string]any, error) {
		release, err := u.nodeRepo.GetNodeReleaseByID(ctx, req.VersionID)
		if err != nil {
			return nil, err
		}
		if release.KBID != kbID || release.NodeID != req.NodeID {
			return nil, gorm.ErrRecordNotFound
		}
		name := release.Name
		content := release.Content
		emoji := release.Meta.Emoji
		summary := release.Meta.Summary
		contentType := release.Meta.ContentType
		updateReq := &domain.UpdateNodeReq{
			ID:                req.NodeID,
			KBID:              kbID,
			Name:              &name,
			Content:           &content,
			Emoji:             &emoji,
			Summary:           &summary,
			ExpectedUpdatedAt: req.ExpectedUpdatedAt,
		}
		if contentType != "" {
			updateReq.ContentType = &contentType
		}
		if err := u.nodeUsecase.Update(ctx, updateReq, authInfo.UserID); err != nil {
			return nil, err
		}
		updated, err := u.nodeRepo.GetNodeByID(ctx, req.NodeID)
		if err != nil {
			return nil, err
		}
		return &map[string]any{
			"node_id":    updated.ID,
			"status":     updated.Status,
			"updated_at": updated.UpdatedAt,
		}, nil
	})
}

func (u *MCPUsecase) UploadAsset(ctx context.Context, kbID string, req *domain.MCPUploadAssetReq) (map[string]any, error) {
	if _, err := mcpWriteAuth(ctx); err != nil {
		return nil, err
	}
	filename := strings.TrimSpace(req.Filename)
	if filename == "" {
		return nil, fmt.Errorf("%w: filename is required", domain.ErrMCPInvalidArgument)
	}
	raw := strings.TrimSpace(req.ContentBase64)
	if raw == "" {
		return nil, fmt.Errorf("%w: content_base64 is required", domain.ErrMCPInvalidArgument)
	}
	if strings.HasPrefix(raw, "data:") {
		if index := strings.Index(raw, ","); index >= 0 {
			raw = raw[index+1:]
		}
	}
	data, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		return nil, fmt.Errorf("%w: content_base64 is invalid: %v", domain.ErrMCPInvalidArgument, err)
	}
	url, err := u.fileUsecase.UploadBytesGetUrl(ctx, kbID, filename, data)
	if err != nil {
		return nil, err
	}
	return map[string]any{"url": url}, nil
}

func (u *MCPUsecase) validateNav(ctx context.Context, kbID, navID string) error {
	nav, err := u.navRepo.GetById(ctx, navID)
	if err != nil {
		return err
	}
	if nav.KbID != kbID {
		return fmt.Errorf("%w: navigation does not belong to this knowledge base", domain.ErrMCPInvalidArgument)
	}
	return nil
}

func mcpWriteAuth(ctx context.Context) (*domain.MCPAuthInfo, error) {
	info := domain.GetMCPAuthInfo(ctx)
	if info == nil || info.UserID == "" {
		return nil, fmt.Errorf("write operation requires an API token")
	}
	return info, nil
}

func runMCPIdempotent[T any](ctx context.Context, repo *pg.MCPRepository, kbID, toolName, key string, fn func() (*T, error)) (*T, error) {
	if strings.TrimSpace(key) == "" {
		return fn()
	}
	operation := &domain.MCPOperation{
		ID:             uuid.NewString(),
		KBID:           kbID,
		IdempotencyKey: key,
		ToolName:       toolName,
	}
	existing, created, err := repo.BeginMCPOperation(ctx, operation)
	if err != nil {
		return nil, err
	}
	if !created {
		if existing.ToolName != toolName {
			return nil, fmt.Errorf("%w: idempotency key was already used by %s", domain.ErrMCPInvalidArgument, existing.ToolName)
		}
		switch existing.Status {
		case domain.MCPOperationStatusCompleted:
			return domain.DecodeMCPJSON[T](existing.Result)
		case domain.MCPOperationStatusInProgress:
			return nil, domain.ErrMCPOperationInProgress
		default:
			return nil, fmt.Errorf("previous operation failed: %s", existing.Error)
		}
	}
	value, err := fn()
	if err != nil {
		if failErr := repo.FailMCPOperation(ctx, operation.ID, err.Error()); failErr != nil {
			return nil, errors.Join(err, failErr)
		}
		return nil, err
	}
	if err := repo.CompleteMCPOperation(ctx, operation.ID, value); err != nil {
		return nil, err
	}
	return value, nil
}

func (u *MCPUsecase) ListComments(ctx context.Context, kbID string, req *domain.MCPListCommentsReq) (*domain.PaginatedResult[[]*domain.CommentListItem], error) {
	var status *domain.CommentStatus
	switch req.Status {
	case "":
	case "pending":
		value := domain.CommentStatusPending
		status = &value
	case "approved":
		value := domain.CommentStatusAccepted
		status = &value
	case "rejected":
		value := domain.CommentStatusReject
		status = &value
	default:
		return nil, fmt.Errorf("%w: status must be pending, approved, or rejected", domain.ErrMCPInvalidArgument)
	}
	page := req.Page
	if page < 1 {
		page = 1
	}
	pageSize := domain.NormalizeMCPLimit(req.PageSize, 20, 100)
	return u.commentUsecase.GetCommentListByKbID(ctx, &domain.CommentListReq{
		KbID:   kbID,
		Status: status,
		Pager:  domain.Pager{Page: page, PageSize: pageSize},
	}, consts.LicenseEditionEnterprise)
}

func (u *MCPUsecase) ModerateComments(ctx context.Context, kbID string, ids []string, status string) error {
	if len(ids) == 0 {
		return fmt.Errorf("%w: comment_ids is required", domain.ErrMCPInvalidArgument)
	}
	var commentStatus domain.CommentStatus
	switch status {
	case "approved":
		commentStatus = domain.CommentStatusAccepted
	case "rejected":
		commentStatus = domain.CommentStatusReject
	default:
		return fmt.Errorf("%w: status must be approved or rejected", domain.ErrMCPInvalidArgument)
	}
	return u.commentUsecase.ModerateComments(ctx, &domain.CommentModerateListReq{
		KBID:   kbID,
		IDs:    ids,
		Status: commentStatus,
	})
}

func (u *MCPUsecase) ListContributions(ctx context.Context, kbID string, req *domain.MCPListContributionsReq) (*domain.ContributeListResp, error) {
	page := req.Page
	if page < 1 {
		page = 1
	}
	pageSize := domain.NormalizeMCPLimit(req.PageSize, 20, 100)
	return u.contributeUsecase.List(ctx, &domain.ContributeListReq{
		KBID:     kbID,
		NodeName: req.NodeName,
		AuthName: req.AuthName,
		Status:   req.Status,
		Pager:    domain.Pager{Page: page, PageSize: pageSize},
	})
}

func (u *MCPUsecase) AuditContribution(ctx context.Context, kbID string, req *domain.MCPAuditContributionReq) (*map[string]any, error) {
	authInfo, err := mcpWriteAuth(ctx)
	if err != nil {
		return nil, err
	}
	if req.Status != string(consts.ContributeStatusApproved) && req.Status != string(consts.ContributeStatusRejected) {
		return nil, fmt.Errorf("%w: status must be approved or rejected", domain.ErrMCPInvalidArgument)
	}
	return runMCPIdempotent(ctx, u.mcpRepo, kbID, "audit_contribution", req.IdempotencyKey, func() (*map[string]any, error) {
		if err := u.contributeUsecase.Audit(ctx, &domain.ContributeAuditReq{
			ID:       req.ID,
			KBID:     kbID,
			NavID:    req.NavID,
			ParentID: req.ParentID,
			Position: req.Position,
			Status:   consts.ContributeStatus(req.Status),
		}, authInfo.UserID); err != nil {
			return nil, err
		}
		return &map[string]any{
			"contribution_id": req.ID,
			"status":          req.Status,
		}, nil
	})
}

func (u *MCPUsecase) Stats(ctx context.Context, kbID string, req *domain.MCPStatsReq) (map[string]any, error) {
	days := req.Days
	var day consts.StatDay
	switch days {
	case 1:
		day = consts.StatDay1
	case 7:
		day = consts.StatDay7
	case 30:
		day = consts.StatDay30
	case 90:
		day = consts.StatDay90
	case 0:
		days = 30
		day = consts.StatDay30
	default:
		return nil, fmt.Errorf("%w: days must be 1, 7, 30, or 90", domain.ErrMCPInvalidArgument)
	}
	count, err := u.statUsecase.GetStatCount(ctx, kbID, day)
	if err != nil {
		return nil, err
	}
	hotPages, err := u.statUsecase.GetHotPages(ctx, kbID, day)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"days":      days,
		"count":     count,
		"hot_pages": hotPages,
	}, nil
}

func truncateRunes(value string, max int) string {
	runes := []rune(value)
	if len(runes) <= max {
		return value
	}
	return string(runes[:max]) + "..."
}
