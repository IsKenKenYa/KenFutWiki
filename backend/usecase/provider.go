package usecase

import (
	"github.com/google/wire"

	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/repo/ipdb"
	mqRepo "github.com/chaitin/panda-wiki/repo/mq"
	"github.com/chaitin/panda-wiki/repo/pg"
	"github.com/chaitin/panda-wiki/store/rag"
	"github.com/chaitin/panda-wiki/store/s3"
)

var ProviderSet = wire.NewSet(
	pg.ProviderSet,
	mqRepo.ProviderSet,
	ipdb.ProviderSet,
	rag.ProviderSet,
	s3.ProviderSet,

	NewKenFutContentUsecase,
	NewKenFutIntegrationUsecase,
	NewKenFutVoteUsecase,
	NewLLMUsecase,
	NewNodeUsecase,
	NewNodeTemplateUsecase,
	NewAppUsecase,
	NewConversationUsecase,
	NewUserUsecase,
	NewModelUsecase,
	NewKnowledgeBaseUsecase,
	NewChatUsecase,
	NewCrawlerUsecase,
	NewCreationUsecase,
	NewFileUsecase,
	NewSitemapUsecase,
	NewStatUseCase,
	NewCommentUsecase,
	NewWechatUsecase,
	NewWecomUsecase,
	NewWechatAppUsecase,
	NewAuthUsecase,
	NewNavUsecase,
	NewStorageUsecase,
	NewAPITokenUsecase,
	NewMCPUsecase,
	NewBlockWordUsecase,
	NewContributeUsecase,
	NewAuthGroupUsecase,
	NewDocumentFeedbackUsecase,

	wire.Bind(new(domain.StorageSettingSource), new(*pg.SystemSettingRepo)),
)
