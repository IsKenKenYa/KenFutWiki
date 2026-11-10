package usecase

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/chaitin/panda-wiki/consts"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/repo/pg"
)

const maxContributeContentBytes = 1 << 20

type ContributeUsecase struct {
	repo       *pg.ContributeRepository
	nodeRepo   *pg.NodeRepository
	navRepo    *pg.NavRepository
	appUsecase *AppUsecase
	logger     *log.Logger
}

func NewContributeUsecase(
	repo *pg.ContributeRepository,
	nodeRepo *pg.NodeRepository,
	navRepo *pg.NavRepository,
	appUsecase *AppUsecase,
	logger *log.Logger,
) *ContributeUsecase {
	return &ContributeUsecase{
		repo:       repo,
		nodeRepo:   nodeRepo,
		navRepo:    navRepo,
		appUsecase: appUsecase,
		logger:     logger.WithModule("usecase.contribute"),
	}
}

func (u *ContributeUsecase) Submit(ctx context.Context, req *domain.SubmitContributeReq, authID int64, remoteIP string) (string, error) {
	if req.KBID == "" {
		return "", fmt.Errorf("kb_id is required")
	}
	if len(req.Content) > maxContributeContentBytes {
		return "", fmt.Errorf("contribution content is too large")
	}
	app, err := u.appUsecase.GetAppDetailByKBIDAndAppType(ctx, req.KBID, domain.AppTypeWeb)
	if err != nil {
		return "", err
	}
	if !app.Settings.ContributeSettings.IsEnable {
		return "", fmt.Errorf("document contribution is not enabled")
	}
	name := strings.TrimSpace(req.Name)
	contentType := strings.ToLower(strings.TrimSpace(req.ContentType))
	if contentType != domain.ContentTypeMD && contentType != domain.ContentTypeHTML {
		return "", fmt.Errorf("content_type must be md or html")
	}
	switch req.Type {
	case consts.ContributeTypeAdd:
		if name == "" {
			return "", fmt.Errorf("name is required for a new document")
		}
	case consts.ContributeTypeEdit:
		if req.NodeID == "" {
			return "", fmt.Errorf("node_id is required for an edit request")
		}
		node, err := u.nodeRepo.GetNodeByID(ctx, req.NodeID)
		if err != nil {
			return "", err
		}
		if node.KBID != req.KBID {
			return "", gorm.ErrRecordNotFound
		}
		if name == "" {
			name = node.Name
		}
	default:
		return "", fmt.Errorf("unsupported contribution type %q", req.Type)
	}

	var authIDPtr *int64
	if authID > 0 {
		authIDPtr = &authID
	}
	contribute := &domain.Contribute{
		Id:       uuid.NewString(),
		AuthId:   authIDPtr,
		KBId:     req.KBID,
		Status:   consts.ContributeStatusPending,
		Type:     req.Type,
		NodeId:   req.NodeID,
		Name:     name,
		Content:  req.Content,
		Meta:     domain.NodeMeta{ContentType: contentType, Emoji: req.Emoji},
		Reason:   strings.TrimSpace(req.Reason),
		RemoteIP: remoteIP,
	}
	if err := u.repo.Create(ctx, contribute); err != nil {
		return "", err
	}
	return contribute.Id, nil
}

func (u *ContributeUsecase) List(ctx context.Context, req *domain.ContributeListReq) (*domain.ContributeListResp, error) {
	items, total, err := u.repo.List(ctx, req)
	if err != nil {
		return nil, err
	}
	return &domain.ContributeListResp{List: items, Total: total}, nil
}

func (u *ContributeUsecase) Detail(ctx context.Context, kbID, id string) (*domain.ContributeDetailResp, error) {
	return u.repo.Get(ctx, kbID, id)
}

func (u *ContributeUsecase) Audit(ctx context.Context, req *domain.ContributeAuditReq, auditUserID string) error {
	detail, err := u.repo.Get(ctx, req.KBID, req.ID)
	if err != nil {
		return err
	}
	if detail.Status != consts.ContributeStatusPending {
		return fmt.Errorf("contribute is already %s", detail.Status)
	}
	if req.Status == consts.ContributeStatusRejected {
		return u.repo.Reject(ctx, req, auditUserID)
	}
	if req.Status != consts.ContributeStatusApproved {
		return fmt.Errorf("unsupported audit status %q", req.Status)
	}
	contentType := strings.ToLower(strings.TrimSpace(detail.Meta.ContentType))
	if contentType == "" {
		contentType = domain.ContentTypeMD
	}
	if contentType != domain.ContentTypeMD && contentType != domain.ContentTypeHTML {
		return fmt.Errorf("content_type must be md or html")
	}
	switch detail.Type {
	case consts.ContributeTypeAdd:
		if req.NavID == "" {
			return fmt.Errorf("nav_id is required to approve a new document")
		}
		nav, err := u.navRepo.GetById(ctx, req.NavID)
		if err != nil {
			return err
		}
		if nav.KbID != req.KBID {
			return gorm.ErrRecordNotFound
		}
		if req.ParentID != "" {
			parent, err := u.nodeRepo.GetNodeByID(ctx, req.ParentID)
			if err != nil {
				return err
			}
			if parent.KBID != req.KBID || parent.Type != domain.NodeTypeFolder || parent.NavId != req.NavID {
				return fmt.Errorf("parent_id must be a folder in the target navigation")
			}
		}
		name := strings.TrimSpace(detail.ContributeName)
		if name == "" {
			name = strings.TrimSpace(detail.NodeName)
		}
		if name == "" {
			name = "未命名文档"
		}
		return u.repo.ApproveAdd(ctx, req, auditUserID, name, detail.Content, contentType, detail.Meta.Emoji)
	case consts.ContributeTypeEdit:
		name := strings.TrimSpace(detail.ContributeName)
		if name == "" {
			name = strings.TrimSpace(detail.NodeName)
		}
		return u.repo.ApproveEdit(ctx, req, auditUserID, name, detail.Content, contentType, detail.Meta.Emoji)
	default:
		return fmt.Errorf("unsupported contribution type %q", detail.Type)
	}
}
