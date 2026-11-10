package usecase

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"gorm.io/gorm"

	"github.com/lib/pq"

	"github.com/chaitin/panda-wiki/consts"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/log"
	"github.com/chaitin/panda-wiki/pkg/dingtalk"
	"github.com/chaitin/panda-wiki/pkg/wecom"
	"github.com/chaitin/panda-wiki/repo/pg"
	"github.com/chaitin/panda-wiki/store/cache"
)

type AuthGroupUsecase struct {
	repo     *pg.AuthGroupRepository
	authRepo *pg.AuthRepo
	cache    *cache.Cache
	logger   *log.Logger
}

func NewAuthGroupUsecase(repo *pg.AuthGroupRepository, authRepo *pg.AuthRepo, cache *cache.Cache, logger *log.Logger) *AuthGroupUsecase {
	return &AuthGroupUsecase{
		repo:     repo,
		authRepo: authRepo,
		cache:    cache,
		logger:   logger.WithModule("usecase.auth_group"),
	}
}

func (u *AuthGroupUsecase) Create(ctx context.Context, req *domain.AuthGroupCreateReq) (uint, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return 0, fmt.Errorf("name is required")
	}
	group := &domain.AuthGroup{
		Name:     name,
		KbID:     req.KBID,
		ParentID: req.ParentID,
		Position: valueOrZero(req.Position),
		AuthIDs:  pg.AuthIDsToInt64Array(req.IDs),
	}
	if err := u.repo.Create(ctx, group); err != nil {
		return 0, err
	}
	return group.ID, nil
}

func (u *AuthGroupUsecase) Update(ctx context.Context, req *domain.AuthGroupUpdateReq) error {
	current, err := u.repo.Get(ctx, req.KBID, req.ID)
	if err != nil {
		return err
	}
	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			return fmt.Errorf("name cannot be empty")
		}
		current.Name = name
	}
	if req.AuthIDs != nil {
		current.AuthIDs = pg.AuthIDsToInt64Array(*req.AuthIDs)
	}
	if req.ParentID != nil {
		current.ParentID = req.ParentID
	}
	if req.Position != nil {
		current.Position = *req.Position
	}
	return u.repo.Update(ctx, current)
}

func (u *AuthGroupUsecase) Delete(ctx context.Context, kbID string, id uint) error {
	return u.repo.Delete(ctx, kbID, id)
}

func (u *AuthGroupUsecase) Move(ctx context.Context, req *domain.AuthGroupMoveReq) error {
	return u.repo.Move(ctx, req)
}

func (u *AuthGroupUsecase) List(ctx context.Context, kbID string) (*domain.AuthGroupListResp, error) {
	groups, err := u.repo.List(ctx, kbID)
	if err != nil {
		return nil, err
	}
	items := buildAuthGroupListItems(groups)
	return &domain.AuthGroupListResp{List: items, Total: len(items)}, nil
}

func (u *AuthGroupUsecase) Tree(ctx context.Context, kbID string) (*domain.AuthGroupTreeResp, error) {
	groups, err := u.repo.List(ctx, kbID)
	if err != nil {
		return nil, err
	}
	nodes := make(map[uint]*domain.AuthGroupTreeItem, len(groups))
	for _, group := range groups {
		nodes[group.ID] = &domain.AuthGroupTreeItem{
			ID:       group.ID,
			Name:     group.Name,
			ParentID: group.ParentID,
			Position: group.Position,
			AuthIDs:  pg.Int64ArrayToAuthIDs(group.AuthIDs),
			Count:    len(group.AuthIDs),
			SyncID:   group.SyncId,
		}
	}
	var level func(id uint, visiting map[uint]bool) int
	level = func(id uint, visiting map[uint]bool) int {
		node, ok := nodes[id]
		if !ok || node.ParentID == nil || visiting[id] {
			return 0
		}
		visiting[id] = true
		defer delete(visiting, id)
		return level(*node.ParentID, visiting) + 1
	}
	for id, node := range nodes {
		node.Level = level(id, make(map[uint]bool))
	}

	roots := make([]*domain.AuthGroupTreeItem, 0)
	for _, group := range groups {
		node := nodes[group.ID]
		if group.ParentID == nil {
			roots = append(roots, node)
			continue
		}
		parent, ok := nodes[*group.ParentID]
		if !ok {
			roots = append(roots, node)
			continue
		}
		parent.Children = append(parent.Children, node)
	}
	return &domain.AuthGroupTreeResp{List: roots}, nil
}

func (u *AuthGroupUsecase) Detail(ctx context.Context, kbID string, id uint) (*domain.AuthGroupDetailResp, error) {
	group, err := u.repo.Get(ctx, kbID, id)
	if err != nil {
		return nil, err
	}
	groups, err := u.repo.List(ctx, kbID)
	if err != nil {
		return nil, err
	}
	listMap := make(map[uint]*domain.AuthGroupListItem, len(groups))
	for _, item := range buildAuthGroupListItems(groups) {
		listMap[item.ID] = item
	}
	children := make([]*domain.AuthGroupListItem, 0)
	for _, item := range groups {
		if item.ParentID != nil && *item.ParentID == id {
			children = append(children, listMap[item.ID])
		}
	}
	authIDs := pg.Int64ArrayToAuthIDs(group.AuthIDs)
	uintIDs := make([]uint, 0, len(authIDs))
	for _, authID := range authIDs {
		uintIDs = append(uintIDs, uint(authID))
	}
	auths, err := u.repo.GetAuthsByIDs(ctx, uintIDs)
	if err != nil {
		return nil, err
	}
	detail := &domain.AuthGroupDetailResp{
		ID:        group.ID,
		Name:      group.Name,
		ParentID:  group.ParentID,
		Position:  group.Position,
		AuthIDs:   authIDs,
		Auths:     auths,
		Children:  children,
		CreatedAt: group.CreatedAt,
	}
	if group.ParentID != nil {
		detail.Parent = listMap[*group.ParentID]
	}
	return detail, nil
}

func buildAuthGroupListItems(groups []*domain.AuthGroup) []*domain.AuthGroupListItem {
	groupMap := make(map[uint]*domain.AuthGroup, len(groups))
	for _, group := range groups {
		groupMap[group.ID] = group
	}
	items := make([]*domain.AuthGroupListItem, 0, len(groups))
	for _, group := range groups {
		pathParts := make([]string, 0)
		for current, ok := groupMap[group.ID]; ok; current, ok = groupMap[pointerValue(current.ParentID)] {
			pathParts = append([]string{current.Name}, pathParts...)
			if current.ParentID == nil {
				break
			}
		}
		items = append(items, &domain.AuthGroupListItem{
			ID:        group.ID,
			Name:      group.Name,
			ParentID:  group.ParentID,
			Path:      strings.Join(pathParts, "/"),
			Count:     len(group.AuthIDs),
			Position:  group.Position,
			CreatedAt: group.CreatedAt,
		})
	}
	return items
}

func pointerValue(value *uint) uint {
	if value == nil {
		return 0
	}
	return *value
}

func valueOrZero(value *float64) float64 {
	if value == nil {
		return 0
	}
	return *value
}

func (u *AuthGroupUsecase) Sync(ctx context.Context, req *domain.AuthGroupSyncReq) error {
	switch req.SourceType {
	case "dingtalk":
		return u.syncDingTalk(ctx, req.KBID)
	case "wecom":
		return u.syncWeCom(ctx, req.KBID)
	default:
		return fmt.Errorf("unsupported source type %q", req.SourceType)
	}
}

func (u *AuthGroupUsecase) syncDingTalk(ctx context.Context, kbID string) error {
	config, err := u.authRepo.GetAuthConfig(ctx, kbID, consts.SourceTypeDingTalk)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return fmt.Errorf("dingtalk auth config not found")
	}
	if err != nil {
		return err
	}
	client, err := dingtalk.NewDingTalkClient(ctx, u.logger, config.AuthSetting.ClientID, config.AuthSetting.ClientSecret, u.cache)
	if err != nil {
		return err
	}
	departments, err := client.GetDepartmentList()
	if err != nil {
		return err
	}
	if departments.Errcode != 0 {
		return fmt.Errorf("dingtalk department query failed: %s", departments.Errmsg)
	}

	groups := make(map[string]*domain.AuthGroup, len(departments.Department))
	for index, department := range departments.Department {
		syncID := fmt.Sprintf("dingtalk:%d", department.Id)
		syncParentID := ""
		if department.Parentid != 0 {
			syncParentID = fmt.Sprintf("dingtalk:%d", department.Parentid)
		}
		group, err := u.repo.UpsertSyncedGroup(ctx, &domain.AuthGroup{
			Name:         department.Name,
			KbID:         kbID,
			Position:     float64(index+1) * 1000,
			SyncId:       syncID,
			SyncParentId: syncParentID,
			SourceType:   consts.SourceTypeDingTalk,
		})
		if err != nil {
			return err
		}
		groups[syncID] = group
	}
	for _, group := range groups {
		if group.SyncParentId == "" {
			continue
		}
		parent, ok := groups[group.SyncParentId]
		if !ok {
			continue
		}
		if err := u.repo.Update(ctx, &domain.AuthGroup{
			ID:       group.ID,
			KbID:     kbID,
			Name:     group.Name,
			ParentID: &parent.ID,
			Position: group.Position,
			AuthIDs:  group.AuthIDs,
		}); err != nil {
			return err
		}
	}

	groupAuthIDs := make(map[uint]map[int64]bool)
	for _, department := range departments.Department {
		group := groups[fmt.Sprintf("dingtalk:%d", department.Id)]
		if group == nil {
			continue
		}
		users, err := client.GetAllUserList(department.Id)
		if err != nil {
			return err
		}
		for _, user := range users {
			unionID := user.Unionid
			if unionID == "" {
				unionID = user.Userid
			}
			auth, err := u.authRepo.GetOrCreateAuth(ctx, &domain.Auth{
				KBID:       kbID,
				UnionID:    unionID,
				SourceType: consts.SourceTypeDingTalk,
				UserInfo: domain.AuthUserInfo{
					Username:  user.Name,
					AvatarUrl: user.Avatar,
					Email:     user.Email,
				},
			}, consts.SourceTypeDingTalk)
			if err != nil {
				return err
			}
			if groupAuthIDs[group.ID] == nil {
				groupAuthIDs[group.ID] = make(map[int64]bool)
			}
			groupAuthIDs[group.ID][int64(auth.ID)] = true
		}
	}
	return u.updateGroupAuthIDs(ctx, kbID, groupAuthIDs)
}

func (u *AuthGroupUsecase) syncWeCom(ctx context.Context, kbID string) error {
	config, err := u.authRepo.GetAuthConfig(ctx, kbID, consts.SourceTypeWeCom)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return fmt.Errorf("wecom auth config not found")
	}
	if err != nil {
		return err
	}
	client, err := wecom.NewClient(ctx, u.logger, config.AuthSetting.ClientID, config.AuthSetting.ClientSecret, config.AuthSetting.AgentID, "", u.cache, false)
	if err != nil {
		return err
	}
	departments, err := client.GetDepartmentList(ctx)
	if err != nil {
		return err
	}
	if departments.Errcode != 0 {
		return fmt.Errorf("wecom department query failed: %s", departments.Errmsg)
	}

	groups := make(map[string]*domain.AuthGroup, len(departments.Department))
	for index, department := range departments.Department {
		syncID := fmt.Sprintf("wecom:%d", department.Id)
		syncParentID := ""
		if department.Parentid != 0 {
			syncParentID = fmt.Sprintf("wecom:%d", department.Parentid)
		}
		group, err := u.repo.UpsertSyncedGroup(ctx, &domain.AuthGroup{
			Name:         department.Name,
			KbID:         kbID,
			Position:     float64(index+1) * 1000,
			SyncId:       syncID,
			SyncParentId: syncParentID,
			SourceType:   consts.SourceTypeWeCom,
		})
		if err != nil {
			return err
		}
		groups[syncID] = group
	}
	for _, group := range groups {
		if group.SyncParentId == "" {
			continue
		}
		parent, ok := groups[group.SyncParentId]
		if !ok {
			continue
		}
		if err := u.repo.Update(ctx, &domain.AuthGroup{
			ID:       group.ID,
			KbID:     kbID,
			Name:     group.Name,
			ParentID: &parent.ID,
			Position: group.Position,
			AuthIDs:  group.AuthIDs,
		}); err != nil {
			return err
		}
	}

	groupAuthIDs := make(map[uint]map[int64]bool)
	for _, department := range departments.Department {
		group := groups[fmt.Sprintf("wecom:%d", department.Id)]
		if group == nil {
			continue
		}
		users, err := client.GetUserList(ctx, strconv.Itoa(department.Id))
		if err != nil {
			return err
		}
		for _, user := range users.Userlist {
			auth, err := u.authRepo.GetOrCreateAuth(ctx, &domain.Auth{
				KBID:       kbID,
				UnionID:    user.Userid,
				SourceType: consts.SourceTypeWeCom,
				UserInfo: domain.AuthUserInfo{
					Username:  user.Name,
					AvatarUrl: user.Avatar,
					Email:     user.Email,
				},
			}, consts.SourceTypeWeCom)
			if err != nil {
				return err
			}
			if groupAuthIDs[group.ID] == nil {
				groupAuthIDs[group.ID] = make(map[int64]bool)
			}
			groupAuthIDs[group.ID][int64(auth.ID)] = true
		}
	}
	return u.updateGroupAuthIDs(ctx, kbID, groupAuthIDs)
}

func (u *AuthGroupUsecase) updateGroupAuthIDs(ctx context.Context, kbID string, groupAuthIDs map[uint]map[int64]bool) error {
	for groupID, idSet := range groupAuthIDs {
		ids := make(pq.Int64Array, 0, len(idSet))
		for id := range idSet {
			ids = append(ids, id)
		}
		if err := u.repo.UpdateGroupAuthIDs(ctx, kbID, groupID, ids); err != nil {
			return err
		}
	}
	return nil
}
