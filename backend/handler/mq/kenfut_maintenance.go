package mq

import (
	"context"
	"time"

	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/log"
	repoMQ "github.com/chaitin/panda-wiki/repo/mq"
	"github.com/chaitin/panda-wiki/repo/pg"
	"github.com/robfig/cron/v3"
)

type KenFutMaintenance struct {
	logger      *log.Logger
	kb          *pg.KnowledgeBaseRepository
	integration *pg.KenFutIntegrationRepository
	rag         *repoMQ.RAGRepository
}

func NewKenFutMaintenance(logger *log.Logger, kb *pg.KnowledgeBaseRepository, integration *pg.KenFutIntegrationRepository, rag *repoMQ.RAGRepository) (*KenFutMaintenance, error) {
	h := &KenFutMaintenance{logger: logger.WithModule("kenfut.maintenance"), kb: kb, integration: integration, rag: rag}
	scheduler := cron.New()
	if _, err := scheduler.AddFunc("*/5 * * * *", h.RetryRAG); err != nil {
		return nil, err
	}
	if _, err := scheduler.AddFunc("17 3 * * *", h.ArchiveEvents); err != nil {
		return nil, err
	}
	scheduler.Start()
	return h, nil
}

func (h *KenFutMaintenance) RetryRAG() {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	pending, err := h.kb.PendingKenFutRAG(ctx, 100)
	if err != nil {
		h.logger.Error("load pending RAG synchronization", log.Error(err))
		return
	}
	for _, request := range pending {
		if err := h.rag.AsyncUpdateNodeReleaseVector(ctx, []*domain.NodeReleaseVectorRequest{request}); err != nil {
			h.logger.Error("retry RAG synchronization", log.Error(err))
			return
		}
		if err := h.kb.CompleteKenFutRAG(ctx, request.NodeReleaseID); err != nil {
			h.logger.Error("complete RAG synchronization", log.Error(err))
			return
		}
	}
}
func (h *KenFutMaintenance) ArchiveEvents() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	before := time.Now().UTC().Truncate(24*time.Hour).AddDate(0, 0, -180)
	if err := h.integration.PurgeEvents(ctx, before); err != nil {
		h.logger.Error("archive old event detail", log.Error(err))
	}
}
