package usecase

import (
	"context"
	"fmt"
	"mime/multipart"
	"strings"

	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/repo/ipdb"
	"github.com/chaitin/panda-wiki/repo/pg"
	"github.com/samber/lo"
)

type DocumentFeedbackUsecase struct {
	repo        *pg.DocumentFeedbackRepository
	nodeRepo    *pg.NodeRepository
	appUsecase  *AppUsecase
	fileUsecase *FileUsecase
	authUsecase *AuthUsecase
	ipRepo      *ipdb.IPAddressRepo
	logger      *log.Logger
	webhook     *WebhookUsecase
}

func NewDocumentFeedbackUsecase(
	repo *pg.DocumentFeedbackRepository,
	nodeRepo *pg.NodeRepository,
	appUsecase *AppUsecase,
	fileUsecase *FileUsecase,
	authUsecase *AuthUsecase,
	ipRepo *ipdb.IPAddressRepo,
	logger *log.Logger,
	webhook *WebhookUsecase,
) *DocumentFeedbackUsecase {
	return &DocumentFeedbackUsecase{
		repo:        repo,
		nodeRepo:    nodeRepo,
		appUsecase:  appUsecase,
		fileUsecase: fileUsecase,
		authUsecase: authUsecase,
		ipRepo:      ipRepo,
		logger:      logger.WithModule("usecase.document_feedback"),
		webhook:     webhook,
	}
}

func (u *DocumentFeedbackUsecase) Submit(ctx context.Context, kbID, nodeID, content, correction, remoteIP string, authID uint, screenshot *multipart.FileHeader) (int64, error) {
	app, err := u.appUsecase.GetAppDetailByKBIDAndAppType(ctx, kbID, domain.AppTypeWeb)
	if err != nil {
		return 0, err
	}
	if app.Settings.DocumentFeedBackIsEnabled == nil || !*app.Settings.DocumentFeedBackIsEnabled {
		return 0, fmt.Errorf("document feedback is not enabled")
	}
	content = strings.TrimSpace(content)
	correction = strings.TrimSpace(correction)
	if content == "" && correction == "" {
		return 0, fmt.Errorf("feedback content is empty")
	}
	if len([]rune(content)) > 2000 || len([]rune(correction)) > 2000 {
		return 0, fmt.Errorf("feedback content is too long")
	}
	if nodeID != "" {
		node, err := u.nodeRepo.GetNodeByID(ctx, nodeID)
		if err != nil {
			return 0, err
		}
		if node.KBID != kbID {
			return 0, fmt.Errorf("document does not belong to this knowledge base")
		}
	}
	info := domain.DocumentFeedbackInfo{RemoteIP: remoteIP}
	if authID > 0 {
		auth, err := u.authUsecase.GetAuthInfo(ctx, kbID, authID)
		if err != nil {
			return 0, err
		}
		info.AuthUserID = auth.ID
		info.UserName = auth.UserInfo.Username
		info.Avatar = auth.UserInfo.AvatarUrl
		info.Email = auth.UserInfo.Email
	}
	if screenshot != nil {
		url, err := u.fileUsecase.UploadFileGetUrl(ctx, kbID, screenshot)
		if err != nil {
			return 0, err
		}
		info.ScreenShot = url
	}
	feedback := &domain.DocumentFeedback{
		UserID:               fmt.Sprintf("%d", authID),
		KBID:                 kbID,
		NodeID:               nodeID,
		Content:              content,
		CorrectionSuggestion: correction,
		Info:                 info,
	}
	if err := u.repo.Create(ctx, feedback); err != nil {
		return 0, err
	}
	if u.webhook != nil {
		u.webhook.FeedbackCreated(kbID, nodeID, content)
	}
	return feedback.ID, nil
}

func (u *DocumentFeedbackUsecase) List(ctx context.Context, req *domain.DocumentFeedbackListReq) (*domain.DocumentFeedbackListResp, error) {
	items, total, err := u.repo.List(ctx, req)
	if err != nil {
		return nil, err
	}
	// 补充 IP 归属地，与管理员评论列表能力一致
	ipAddressMap := make(map[string]*domain.IPAddress)
	lo.Map(items, func(item *domain.DocumentFeedbackListItem, _ int) *domain.DocumentFeedbackListItem {
		ip := item.Info.RemoteIP
		if ip == "" {
			return item
		}
		if _, ok := ipAddressMap[ip]; !ok {
			ipAddress, err := u.ipRepo.GetIPAddress(ctx, ip)
			if err != nil {
				u.logger.Error("get ip address failed", log.Error(err), log.String("ip", ip))
				return item
			}
			ipAddressMap[ip] = ipAddress
		}
		item.IPAddress = ipAddressMap[ip]
		return item
	})
	return &domain.DocumentFeedbackListResp{Data: items, Total: total}, nil
}

func (u *DocumentFeedbackUsecase) Delete(ctx context.Context, kbID string, ids []int64) error {
	return u.repo.Delete(ctx, kbID, ids)
}
