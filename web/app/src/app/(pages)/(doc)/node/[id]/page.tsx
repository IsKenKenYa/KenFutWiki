import { cache } from 'react';
import { permanentRedirect, redirect } from 'next/navigation';
import { getShareV1NodeDetail } from '@/request/ShareNode';
import type { V1ShareNodeDetailResp } from '@/request/types';
import { formatMeta } from '@/utils';
import Doc from '@/views/node';
import type { ResolvingMetadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getContent, getPageTargets } from '@/features/kenfut/api';
import { getContentMetadata, getPublicSite } from '@/features/kenfut/server';
import { resolveLocale } from '@/i18n/request';
import { defaultLocale } from '@/i18n/routing';
import {
  localHref,
  withSearchParams,
  type PageSearchParams,
} from '@/features/kenfut/links';

export interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<PageSearchParams>;
}

const loadContent = cache(async (id: string) => getContent(id));

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
      const t = await getTranslations('error');
      return {
        title: t('unavailableTitle'),
        robots: { index: false, follow: false },
      };
    }
  }
}

export default async function DocPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const [legacy, publication, pageTargets] = await Promise.allSettled([
    getShareV1NodeDetail({ id, format: 'json' }),
    loadContent(id),
    resolveLocale().then(locale =>
      getPageTargets(locale === defaultLocale ? undefined : locale),
    ),
  ]);
  const [locale, t] = await Promise.all([
    resolveLocale(),
    getTranslations('error'),
  ]);
  const legacyNode =
    legacy.status === 'fulfilled'
      ? (legacy.value as V1ShareNodeDetailResp)
      : undefined;
  const content =
    publication.status === 'fulfilled' ? publication.value : undefined;
  // 访问到与当前语言不一致的版本时，跳转到该语言的译本
  const translated =
    content?.lang && content.lang !== locale
      ? content.translations?.find(item => item.lang === locale)
      : undefined;
  if (translated) {
    const { basePath } = await getPublicSite();
    redirect(
      withSearchParams(
        localHref(
          basePath,
          locale === defaultLocale
            ? translated.url
            : `/${locale}${translated.url}`,
        ),
        await searchParams,
      ),
    );
  }
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
          ? t('contentUnavailable')
          : undefined
      }
    />
  );
}
