import { v4 as uuidv4 } from 'uuid';
import httpRequest, { ContentType } from '@/request/httpClient';
import type {
  ContentList,
  ContentQuery,
  PageTarget,
  PublishedContent,
} from './types';

const prefix = '/share/kenfut/v1';

const get = <T>(path: string, query?: Record<string, unknown>) =>
  httpRequest<{ data?: T }>({
    path: `${prefix}${path}`,
    method: 'GET',
    query,
    format: 'json',
    isAlert: false,
    cache: 'no-store',
  });

const post = <T>(
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
) =>
  httpRequest<{ data?: T }>({
    path: `${prefix}${path}`,
    method: 'POST',
    body,
    type: ContentType.Json,
    format: 'json',
    isAlert: false,
    keepalive: true,
    signal,
  });

export const getContents = (query: ContentQuery = {}) =>
  get<ContentList>('/contents', query);

export const getContent = (nodeId: string) =>
  get<PublishedContent>(`/contents/${encodeURIComponent(nodeId)}`);

export const getArticle = (slug: string) =>
  get<PublishedContent>(`/articles/${encodeURIComponent(slug)}`);

export const getRelated = (nodeId: string) =>
  get<PublishedContent[]>(`/contents/${encodeURIComponent(nodeId)}/related`);

export const getPageTargets = () => get<{ items: PageTarget[] }>('/pages');

export const getTaxonomies = () =>
  get<{ categories: string[]; tags: string[] }>('/taxonomies');

export const recordContentView = (
  content: PublishedContent,
  eventId: string,
  channel: 'docs' | 'article',
) =>
  post<unknown>('/events/view', {
    event_id: eventId,
    node_id: content.node_id || content.id,
    node_release_id: content.node_release_id,
    channel,
  });

export const recordCTAClick = (
  content: PublishedContent,
  ctaId: string,
  viewId: string,
  signal?: AbortSignal,
) =>
  post<{ click_id: string; url: string }>(
    `/ctas/${encodeURIComponent(ctaId)}/click`,
    {
      event_id: uuidv4(),
      node_id: content.node_id || content.id,
      node_release_id: content.node_release_id,
      view_id: viewId,
    },
    signal,
  );
