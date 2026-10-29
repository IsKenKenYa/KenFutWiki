import { cache } from 'react';
import { permanentRedirect } from 'next/navigation';
import { getShareV1NodeDetail } from '@/request/ShareNode';
import type { V1ShareNodeDetailResp } from '@/request/types';
import { formatMeta } from '@/utils';
import Doc from '@/views/node';
import type { ResolvingMetadata } from 'next';
import { getContent, getPageTargets } from '@/features/kenfut/api';
import { getContentMetadata, getPublicSite } from '@/features/kenfut/server';
import {
  localHref,
  withSearchParams,
  type PageSearchParams,
} from '@/features/kenfut/links';

export interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<PageSearchParams>;
}

const loadContent = cache(getContent);

export async function generateMetadata(
  { params }: PageProps,
  parent: ResolvingMetadata,
) {
  const { id } = await params;
  try {
    return await getContentMetadata(await loadContent(id));
  } catch {
    try {
      const node = await getShareV1NodeDetail({ id, format: 'json' });
      return await formatMeta(
        { title: node?.name, description: node?.meta?.summary },
        parent,
      );
    } catch {
      return { title: '内容不可用', robots: { index: false, follow: false } };
    }
  }
}

export default async function DocPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const [legacy, publication, pageTargets] = await Promise.allSettled([
    getShareV1NodeDetail({ id, format: 'json' }),
    loadContent(id),
    getPageTargets(),
  ]);
  const legacyNode =
    legacy.status === 'fulfilled'
      ? (legacy.value as V1ShareNodeDetailResp)
      : undefined;
  const content =
    publication.status === 'fulfilled' ? publication.value : undefined;
  const node: V1ShareNodeDetailResp | undefined = content
    ? {
        ...legacyNode,
        id: content.node_id || content.id,
        kb_id: content.kb_id,
        type: 2,
        name: content.title,
        content: content.content,
        meta: {
          ...legacyNode?.meta,
          summary: content.summary,
          content_type: content.content_type,
        },
        created_at: content.created_at,
        updated_at: content.updated_at,
        pv: content.pv,
      }
    : legacyNode;
  if (content?.channel === 'article') {
    const { basePath } = await getPublicSite();
    permanentRedirect(
      withSearchParams(
        localHref(basePath, content.canonical_url || `/blog/${content.slug}`),
        await searchParams,
      ),
    );
  }
  return (
    <Doc
      key={id}
      node={node}
      error={
        !content && legacy.status === 'rejected' ? legacy.reason : undefined
      }
      publishedContent={content}
      pageTargets={
        pageTargets.status === 'fulfilled' ? pageTargets.value.items : []
      }
      publicationError={
        node?.type === 2 && publication.status === 'rejected'
          ? '内容运营信息暂时无法加载。'
          : undefined
      }
    />
  );
}
