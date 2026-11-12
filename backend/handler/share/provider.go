package share

import (
	"github.com/google/wire"

	"github.com/chaitin/panda-wiki/pkg/captcha"
)

type ShareHandler struct {
	ShareFeedHandler             *ShareFeedHandler
	ShareKenFutContentHandler    *ShareKenFutContentHandler
	ShareNodeHandler             *ShareNodeHandler
	ShareNavHandler              *ShareNavHandler
	ShareAppHandler              *ShareAppHandler
	ShareChatHandler             *ShareChatHandler
	ShareSitemapHandler          *ShareSitemapHandler
	ShareStatHandler             *ShareStatHandler
	ShareCommentHandler          *ShareCommentHandler
	ShareAuthHandler             *ShareAuthHandler
	ShareConversationHandler     *ShareConversationHandler
	ShareWechatHandler           *ShareWechatHandler
	ShareCaptchaHandler          *ShareCaptchaHandler
	OpenapiV1Handler             *OpenapiV1Handler
	ShareCommonHandler           *ShareCommonHandler
	MCPServerHandler             *MCPServerHandler
	ShareContributeHandler       *ShareContributeHandler
	ShareSSOHandler              *ShareSSOHandler
	ShareDocumentFeedbackHandler *ShareDocumentFeedbackHandler
}

var ProviderSet = wire.NewSet(
	captcha.NewCaptcha,

	NewShareFeedHandler,
	NewShareKenFutContentHandler,
	NewShareNodeHandler,
	NewShareNavHandler,
	NewShareAppHandler,
	NewShareChatHandler,
	NewShareSitemapHandler,
	NewShareStatHandler,
	NewShareCommentHandler,
	NewShareAuthHandler,
	NewShareConversationHandler,
	NewShareWechatHandler,
	NewShareCaptchaHandler,
	NewShareCommonHandler,
	NewOpenapiV1Handler,
	NewMCPServerHandler,
	NewShareContributeHandler,
	NewShareSSOHandler,
	NewShareDocumentFeedbackHandler,

	wire.Struct(new(ShareHandler), "*"),
)
