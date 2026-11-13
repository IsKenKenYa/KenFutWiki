package pg

import (
	"github.com/google/wire"

	"github.com/chaitin/panda-wiki/store/pg"
)

var ProviderSet = wire.NewSet(
	pg.ProviderSet,

	NewKenFutContentRepository,
	NewKenFutIntegrationRepository,
	NewKenFutVoteRepository,
	NewNodeRepository,
	NewWebhookRepository,
	NewNodeTemplateRepository,
	NewAppRepository,
	NewConversationRepository,
	NewUserRepository,
	NewUserAccessRepository,
	NewModelRepository,
	NewKnowledgeBaseRepository,
	NewStatRepository,
	NewCommentRepository,
	NewPromptRepo,
	NewBlockWordRepo,
	NewAuthRepo,
	NewWechatRepository,
	NewAPITokenRepo,
	NewSystemSettingRepo,
	NewMCPRepository,
	NewNavRepository,
	NewContributeRepository,
	NewAuthGroupRepository,
	NewDocumentFeedbackRepository,
)
