package v1

import (
	"github.com/google/wire"

	"github.com/chaitin/panda-wiki/handler"
	"github.com/chaitin/panda-wiki/middleware"
	"github.com/chaitin/panda-wiki/usecase"
)

type APIHandlers struct {
	KenFutContentHandler     *KenFutContentHandler
	KenFutIntegrationHandler *KenFutIntegrationHandler
	UserHandler              *UserHandler
	KnowledgeBaseHandler     *KnowledgeBaseHandler
	NodeHandler              *NodeHandler
	AppHandler               *AppHandler
	FileHandler              *FileHandler
	ModelHandler             *ModelHandler
	StorageHandler           *StorageHandler
	ConversationHandler      *ConversationHandler
	CrawlerHandler           *CrawlerHandler
	CreationHandler          *CreationHandler
	StatHandler              *StatHandler
	CommentHandler           *CommentHandler
	AuthV1Handler            *AuthV1Handler
	NavHandler               *NavHandler
	APITokenHandler          *APITokenHandler
	MCPAdminHandler          *MCPAdminHandler
	BlockWordHandler         *BlockWordHandler
	ContributeHandler        *ContributeHandler
	AuthGroupHandler         *AuthGroupHandler
	DocumentFeedbackHandler  *DocumentFeedbackHandler
}

var ProviderSet = wire.NewSet(
	middleware.ProviderSet,
	usecase.ProviderSet,

	handler.NewBaseHandler,
	NewKenFutContentHandler,
	NewKenFutIntegrationHandler,
	NewNodeHandler,
	NewAppHandler,
	NewConversationHandler,
	NewUserHandler,
	NewFileHandler,
	NewModelHandler,
	NewStorageHandler,
	NewKnowledgeBaseHandler,
	NewCrawlerHandler,
	NewCreationHandler,
	NewStatHandler,
	NewCommentHandler,
	NewAuthV1Handler,
	NewNavHandler,
	NewAPITokenHandler,
	NewMCPAdminHandler,
	NewBlockWordHandler,
	NewContributeHandler,
	NewAuthGroupHandler,
	NewDocumentFeedbackHandler,

	wire.Struct(new(APIHandlers), "*"),
)
