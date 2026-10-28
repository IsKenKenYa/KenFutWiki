import 'server-only';

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getShareV1AppWebInfo } from '@/request/ShareApp';
import { getBasePath } from '@/utils/getBasePath';
import { getContents, getTaxonomies } from './api';
import BlogListing from './BlogListing';
import type { ContentQuery, PublishedContent } from './types';
import { localHref } from './links';

export async function getPublicSite() {
  const info = await getShareV1AppWebInfo();
  const incoming = await headers();
  const configured = info?.base_url || '';
  let origin: string;
  try {
    origin = new URL(configured).origin;
  } catch {
    const host =
      incoming.get('x-forwarded-host') ||
      incoming.get('host') ||
      'localhost:3010';
    const protocol =
      incoming.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    origin = new URL(`${protocol}://${host.split(',')[0].trim()}`).origin;
  }
  return { info, origin, basePath: getBasePath(configured) };
}

export async function getContentMetadata(
  content: PublishedContent,
): Promise<Metadata> {
  const { origin, basePath } = await getPublicSite();
  const canonical = new URL(
    localHref(basePath, content.canonical_url || content.url),
    origin,
  ).toString();
  const image = content.cover_url
    ? new URL(localHref(basePath, content.cover_url), origin).toString()
    : undefined;
  return {
    title: content.title,
    description: content.summary,
    alternates: { canonical },
    authors: content.author_name ? [{ name: content.author_name }] : undefined,
    openGraph: {
      type: 'article',
      title: content.title,
      description: content.summary,
      url: canonical,
      images: image ? [{ url: image }] : [],
      publishedTime: content.display_date || content.created_at,
      modifiedTime: content.updated_at,
      authors: content.author_name ? [content.author_name] : undefined,
      tags: content.tags,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: content.title,
      description: content.summary,
      images: image ? [image] : undefined,
    },
  };
}

export async function ArticleListingPage({ query }: { query: ContentQuery }) {
  const results = await Promise.allSettled([
    getContents({ ...query, channel: 'article', page_size: 12 }),
    getContents({ channel: 'article', featured: true, page_size: 4 }),
    getTaxonomies(),
  ]);
  return (
    <BlogListing
      query={query}
      result={results[0].status === 'fulfilled' ? results[0].value : undefined}
      featured={
        results[1].status === 'fulfilled' ? results[1].value.items || [] : []
      }
      categories={
        results[2].status === 'fulfilled'
          ? results[2].value.categories || []
          : []
      }
      tags={
        results[2].status === 'fulfilled' ? results[2].value.tags || [] : []
      }
      error={
        results[0].status === 'rejected'
          ? '文章暂时无法加载，请稍后重试。'
          : undefined
      }
    />
  );
}
