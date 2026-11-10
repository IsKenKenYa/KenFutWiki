package usecase

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/url"
	"strings"

	"github.com/chaitin/panda-wiki/consts"
	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/pkg/cas"
	"github.com/chaitin/panda-wiki/pkg/dingtalk"
	"github.com/chaitin/panda-wiki/pkg/feishu"
	"github.com/chaitin/panda-wiki/pkg/ldap"
	"github.com/chaitin/panda-wiki/pkg/oauth"
	"github.com/chaitin/panda-wiki/pkg/wecom"
)

func (u *AuthUsecase) GenerateSSOAuthURL(ctx context.Context, sourceType consts.SourceType, kbID, redirectURL string, isApp bool) (string, error) {
	valid, err := u.ValidateRedirectUrl(ctx, kbID, redirectURL)
	if err != nil {
		return "", err
	}
	if !valid {
		return "", fmt.Errorf("invalid redirect url")
	}
	stateInfo := StateInfo{KbId: kbID, RedirectUrl: redirectURL}
	if sourceType == consts.SourceTypeFeishu {
		verifier, err := randomVerifier()
		if err != nil {
			return "", err
		}
		stateInfo.Verifier = verifier
	}
	state, err := u.genState(ctx, stateInfo)
	if err != nil {
		return "", fmt.Errorf("gen state failed: %w", err)
	}
	config, err := u.AuthRepo.GetAuthConfig(ctx, kbID, sourceType)
	if err != nil {
		return "", fmt.Errorf("get auth config failed: %w", err)
	}
	baseURL, err := baseURLFromRedirect(redirectURL)
	if err != nil {
		return "", err
	}

	switch sourceType {
	case consts.SourceTypeDingTalk:
		client, err := dingtalk.NewDingTalkClient(ctx, u.logger, config.AuthSetting.ClientID, config.AuthSetting.ClientSecret, u.cache)
		if err != nil {
			return "", err
		}
		return client.GenerateAuthURL(baseURL, state), nil
	case consts.SourceTypeFeishu:
		client, err := feishu.NewClient(ctx, u.logger, config.AuthSetting.ClientID, config.AuthSetting.ClientSecret, baseURL)
		if err != nil {
			return "", err
		}
		return client.GenerateAuthURL(state, stateInfo.Verifier), nil
	case consts.SourceTypeWeCom:
		client, err := wecom.NewClient(ctx, u.logger, config.AuthSetting.ClientID, config.AuthSetting.ClientSecret, config.AuthSetting.AgentID, baseURL, u.cache, isApp)
		if err != nil {
			return "", err
		}
		return client.GenerateAuthURL(state), nil
	case consts.SourceTypeOAuth:
		client, err := u.newOAuthClient(ctx, config, baseURL)
		if err != nil {
			return "", err
		}
		return client.GetAuthorizeURL(state), nil
	case consts.SourceTypeCAS:
		client, err := u.newCASClient(ctx, config, baseURL)
		if err != nil {
			return "", err
		}
		return client.GetLoginURL(state), nil
	case consts.SourceTypeGitHub:
		client, err := u.getGitHubClient(ctx, kbID, redirectURL)
		if err != nil {
			return "", err
		}
		return client.GetAuthorizeURL(state), nil
	default:
		return "", fmt.Errorf("unsupported source type %q", sourceType)
	}
}

func (u *AuthUsecase) SSOCallback(ctx context.Context, sourceType consts.SourceType, code, state, ticket string) (*domain.Auth, string, error) {
	stateInfo, err := u.getStateInfo(ctx, state)
	if err != nil {
		return nil, "", err
	}
	config, err := u.AuthRepo.GetAuthConfig(ctx, stateInfo.KbId, sourceType)
	if err != nil {
		return nil, "", fmt.Errorf("get auth config failed: %w", err)
	}
	baseURL, err := baseURLFromRedirect(stateInfo.RedirectUrl)
	if err != nil {
		return nil, "", err
	}

	var auth *domain.Auth
	switch sourceType {
	case consts.SourceTypeDingTalk:
		client, err := dingtalk.NewDingTalkClient(ctx, u.logger, config.AuthSetting.ClientID, config.AuthSetting.ClientSecret, u.cache)
		if err != nil {
			return nil, "", err
		}
		user, err := client.GetUserInfoByCode(code)
		if err != nil {
			return nil, "", err
		}
		auth = &domain.Auth{
			KBID:       stateInfo.KbId,
			UnionID:    user.UnionID,
			SourceType: consts.SourceTypeDingTalk,
			UserInfo: domain.AuthUserInfo{
				Username:  user.Nick,
				AvatarUrl: user.AvatarURL,
			},
		}
	case consts.SourceTypeFeishu:
		client, err := feishu.NewClient(ctx, u.logger, config.AuthSetting.ClientID, config.AuthSetting.ClientSecret, baseURL)
		if err != nil {
			return nil, "", err
		}
		user, err := client.GetUserInfoByCode(ctx, code, stateInfo.Verifier)
		if err != nil {
			return nil, "", err
		}
		auth = &domain.Auth{
			KBID:       stateInfo.KbId,
			UnionID:    user.UnionId,
			SourceType: consts.SourceTypeFeishu,
			UserInfo: domain.AuthUserInfo{
				Username:  user.Name,
				AvatarUrl: user.AvatarUrl,
				Email:     user.Email,
			},
		}
	case consts.SourceTypeWeCom:
		client, err := wecom.NewClient(ctx, u.logger, config.AuthSetting.ClientID, config.AuthSetting.ClientSecret, config.AuthSetting.AgentID, baseURL, u.cache, false)
		if err != nil {
			return nil, "", err
		}
		user, err := client.GetUserInfoByCode(ctx, code)
		if err != nil {
			return nil, "", err
		}
		auth = &domain.Auth{
			KBID:       stateInfo.KbId,
			UnionID:    user.Userid,
			SourceType: consts.SourceTypeWeCom,
			UserInfo: domain.AuthUserInfo{
				Username:  user.Name,
				AvatarUrl: user.Avatar,
				Email:     user.Email,
			},
		}
	case consts.SourceTypeOAuth:
		client, err := u.newOAuthClient(ctx, config, baseURL)
		if err != nil {
			return nil, "", err
		}
		user, err := client.GetUserInfo(code)
		if err != nil {
			return nil, "", err
		}
		auth = &domain.Auth{
			KBID:       stateInfo.KbId,
			UnionID:    user.ID,
			SourceType: consts.SourceTypeOAuth,
			UserInfo: domain.AuthUserInfo{
				Username:  user.Name,
				AvatarUrl: user.AvatarUrl,
				Email:     user.Email,
			},
		}
	case consts.SourceTypeCAS:
		client, err := u.newCASClient(ctx, config, baseURL)
		if err != nil {
			return nil, "", err
		}
		user, err := client.ValidateTicket(ticket, state)
		if err != nil {
			return nil, "", err
		}
		auth = &domain.Auth{
			KBID:       stateInfo.KbId,
			UnionID:    user.Username,
			SourceType: consts.SourceTypeCAS,
			UserInfo: domain.AuthUserInfo{
				Username:  firstNonEmpty(user.Attributes["name"], user.Username),
				AvatarUrl: user.Attributes["avatar_url"],
				Email:     user.Attributes["email"],
			},
		}
	case consts.SourceTypeGitHub:
		client, err := u.getGitHubClient(ctx, stateInfo.KbId, stateInfo.RedirectUrl)
		if err != nil {
			return nil, "", err
		}
		user, err := client.GetUserInfo(code)
		if err != nil {
			return nil, "", err
		}
		auth = &domain.Auth{
			KBID:       stateInfo.KbId,
			UnionID:    user.ID,
			SourceType: consts.SourceTypeGitHub,
			UserInfo: domain.AuthUserInfo{
				Username:  user.Name,
				AvatarUrl: user.AvatarUrl,
				Email:     user.Email,
			},
		}
	default:
		return nil, "", fmt.Errorf("unsupported source type %q", sourceType)
	}

	auth, err = u.AuthRepo.GetOrCreateAuth(ctx, auth, sourceType)
	if err != nil {
		return nil, "", fmt.Errorf("create auth failed: %w", err)
	}
	return auth, stateInfo.RedirectUrl, nil
}

func (u *AuthUsecase) LDAPAuth(ctx context.Context, kbID, username, password string) (*domain.Auth, error) {
	config, err := u.AuthRepo.GetAuthConfig(ctx, kbID, consts.SourceTypeLDAP)
	if err != nil {
		return nil, fmt.Errorf("get LDAP config failed: %w", err)
	}
	client, err := ldap.NewClient(ctx, u.logger, ldap.Config{
		ServerURL:     config.AuthSetting.LDAPServerURL,
		BindDN:        config.AuthSetting.BindDN,
		BindPassword:  config.AuthSetting.BindPassword,
		UserBaseDN:    config.AuthSetting.UserBaseDN,
		UserFilter:    config.AuthSetting.UserFilter,
		UserIDAttr:    config.AuthSetting.IDField,
		UserNameAttr:  config.AuthSetting.NameField,
		UserEmailAttr: config.AuthSetting.EmailField,
	})
	if err != nil {
		return nil, err
	}
	user, err := client.Authenticate(username, password)
	if err != nil {
		return nil, err
	}
	auth := &domain.Auth{
		KBID:       kbID,
		UnionID:    user.ID,
		SourceType: consts.SourceTypeLDAP,
		UserInfo: domain.AuthUserInfo{
			Username: user.Username,
			Email:    user.Email,
		},
	}
	return u.AuthRepo.GetOrCreateAuth(ctx, auth, consts.SourceTypeLDAP)
}

func baseURLFromRedirect(redirectURL string) (string, error) {
	parsed, err := url.Parse(redirectURL)
	if err != nil {
		return "", fmt.Errorf("invalid redirect url: %w", err)
	}
	if parsed.Scheme == "" || parsed.Host == "" {
		return "", fmt.Errorf("redirect url must be absolute")
	}
	return parsed.Scheme + "://" + parsed.Host, nil
}

func (u *AuthUsecase) newOAuthClient(ctx context.Context, config *domain.AuthConfig, baseURL string) (*oauth.Client, error) {
	return oauth.NewClient(ctx, u.logger, baseURL, oauth.Config{
		ClientID:     config.AuthSetting.ClientID,
		ClientSecret: config.AuthSetting.ClientSecret,
		Scopes:       config.AuthSetting.Scopes,
		AuthorizeURL: config.AuthSetting.AuthorizeURL,
		TokenURL:     config.AuthSetting.TokenURL,
		UserInfoURL:  config.AuthSetting.UserInfoURL,
		IDField:      config.AuthSetting.IDField,
		NameField:    config.AuthSetting.NameField,
		AvatarField:  config.AuthSetting.AvatarField,
		EmailField:   config.AuthSetting.EmailField,
	})
}

func (u *AuthUsecase) newCASClient(ctx context.Context, config *domain.AuthConfig, baseURL string) (*cas.Client, error) {
	return cas.NewClient(ctx, u.logger, cas.Config{
		ServerURL:  config.AuthSetting.CASURL,
		ServiceURL: baseURL,
		Version:    config.AuthSetting.CASVersion,
	})
}

func randomVerifier() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate verifier failed: %w", err)
	}
	return hex.EncodeToString(buf), nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
