import { ConstsNodeRagInfoStatus } from '@/request';

// name 为 i18n key，渲染时用 t() 翻译
const RAG_SOURCES = {
  [ConstsNodeRagInfoStatus.NodeRagStatusReindexing]: {
    name: 'rag.reindexing',
    color: 'warning',
  },
  [ConstsNodeRagInfoStatus.NodeRagStatusPending]: {
    name: 'rag.pending',
    color: 'warning',
  },
  [ConstsNodeRagInfoStatus.NodeRagStatusRunning]: {
    name: 'rag.running',
    color: 'warning',
  },
  [ConstsNodeRagInfoStatus.NodeRagStatusFailed]: {
    name: 'rag.failed',
    color: 'error',
  },
  [ConstsNodeRagInfoStatus.NodeRagStatusSucceeded]: {
    name: 'rag.succeeded',
    color: 'success',
  },
};

export default RAG_SOURCES;
