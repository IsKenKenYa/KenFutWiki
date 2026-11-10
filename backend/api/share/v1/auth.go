package v1

import "github.com/chaitin/panda-wiki/consts"

type AuthLoginSimpleReq struct {
	Password string `json:"password" validate:"required"`
}

type AuthLoginSimpleResp struct {
}

type AuthGetReq struct {
}
type AuthGetResp struct {
	AuthType       consts.AuthType       `json:"auth_type"`
	SourceType     consts.SourceType     `json:"source_type"`
	LicenseEdition consts.LicenseEdition `json:"license_edition"`
}

type AuthGitHubReq struct {
	KbID        string `json:"kb_id"`
	RedirectUrl string `json:"redirect_url"`
}

type AuthGitHubResp struct {
	Url string `json:"url"`
}

type GitHubCallbackReq struct {
	Code  string `json:"code" query:"code"`
	State string `json:"state" query:"state"`
}

type GitHubCallbackResp struct {
}

type SSOAuthReq struct {
	KbID        string `json:"kb_id"`
	RedirectURL string `json:"redirect_url"`
	IsApp       bool   `json:"is_app"`
}

type SSOAuthResp struct {
	URL string `json:"url"`
}

type LDAPAuthReq struct {
	KbID     string `json:"kb_id" validate:"required"`
	Username string `json:"username" validate:"required"`
	Password string `json:"password" validate:"required"`
}

type SSOCallbackReq struct {
	Code   string `json:"code" query:"code"`
	State  string `json:"state" query:"state"`
	Ticket string `json:"ticket" query:"ticket"`
}

type AuthInfoResp struct {
	ID        uint   `json:"id"`
	Username  string `json:"username"`
	AvatarURL string `json:"avatar_url"`
	Email     string `json:"email"`
}
