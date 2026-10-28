import { message } from '@ctzhian/ui';
import type {
  Capabilities,
  ContentMetadata,
  Credential,
  Funnel,
  Product,
  Prompt,
} from './types';

export async function kenfutRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const base = (window.__BASENAME__ || '').replace(/\/$/, '');
  const response = await fetch(`${base}/api/kenfut/v1${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('panda_wiki_token') || ''}`,
      ...options.headers,
    },
  });
  const body = await response.json();
  if (!response.ok || !body.success) {
    throw new Error(body.message || `请求失败 (${response.status})`);
  }
  return body.data as T;
}

export const getCapabilities = (signal?: AbortSignal) =>
  kenfutRequest<Capabilities>('/capabilities', { signal });
export const getMetadata = (id: string, kb: string, signal?: AbortSignal) =>
  kenfutRequest<ContentMetadata>(
    `/contents/${encodeURIComponent(id)}?kb_id=${encodeURIComponent(kb)}`,
    { signal },
  );
export const saveMetadata = (metadata: ContentMetadata, kb: string) =>
  kenfutRequest<ContentMetadata>(
    `/contents/${encodeURIComponent(metadata.node_id)}`,
    { method: 'PUT', body: JSON.stringify({ ...metadata, kb_id: kb }) },
  );
export const getProducts = (kb: string, signal?: AbortSignal) =>
  kenfutRequest<{ items: Product[] }>(
    `/products?kb_id=${encodeURIComponent(kb)}`,
    { signal },
  );
export const saveProduct = (product: Product, kb: string) =>
  kenfutRequest<Product>(
    `/products${product.id ? `/${encodeURIComponent(product.id)}` : ''}`,
    {
      method: product.id ? 'PUT' : 'POST',
      body: JSON.stringify({ ...product, kb_id: kb }),
    },
  );
export const disableProduct = (id: string, kb: string) =>
  kenfutRequest<void>(
    `/products/${encodeURIComponent(id)}?kb_id=${encodeURIComponent(kb)}`,
    { method: 'DELETE' },
  );
export const getCredentials = (id: string, kb: string) =>
  kenfutRequest<{ items: Credential[] }>(
    `/products/${encodeURIComponent(id)}/credentials?kb_id=${encodeURIComponent(kb)}`,
  );
export const createCredential = (id: string, kb: string, scopes: string[]) =>
  kenfutRequest<Credential & { token: string }>(
    `/products/${encodeURIComponent(id)}/credentials`,
    { method: 'POST', body: JSON.stringify({ kb_id: kb, scopes }) },
  );
export const revokeCredential = (product: string, id: string, kb: string) =>
  kenfutRequest<void>(
    `/products/${encodeURIComponent(product)}/credentials/${encodeURIComponent(id)}?kb_id=${encodeURIComponent(kb)}`,
    { method: 'DELETE' },
  );
export const getFunnel = (params: URLSearchParams, signal?: AbortSignal) =>
  kenfutRequest<Funnel>(`/funnel?${params}`, { signal });
const reportSettingsFailure = (error: unknown): never => {
  message.error(error instanceof Error ? error.message : '操作失败');
  throw error;
};

export const getPrompts = ({ kb_id }: { kb_id: string }) =>
  kenfutRequest<Prompt>(`/prompts?kb_id=${encodeURIComponent(kb_id)}`).catch(
    reportSettingsFailure,
  );
export const putPrompts = (prompt: Prompt & { kb_id: string }) =>
  kenfutRequest<Prompt>('/prompts', {
    method: 'PUT',
    body: JSON.stringify(prompt),
  }).catch(reportSettingsFailure);
export const moderateComment = (id: string, kb: string, status: 1 | -1) =>
  kenfutRequest<void>(`/comments/${encodeURIComponent(id)}/moderation`, {
    method: 'POST',
    body: JSON.stringify({ kb_id: kb, status }),
  }).catch(reportSettingsFailure);
