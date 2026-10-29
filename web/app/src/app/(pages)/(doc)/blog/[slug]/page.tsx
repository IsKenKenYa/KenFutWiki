import { cache } from 'react';
import { notFound, permanentRedirect } from 'next/navigation';
import { getArticle, getPageTargets } from '@/features/kenfut/api';
import { getContentMetadata, getPublicSite } from '@/features/kenfut/server';
import {
  localHref,
  withSearchParams,
  type PageSearchParams,
} from '@/features/kenfut/links';
import Doc from '@/views/node';

const loadArticle = cache(getArticle);
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<PageSearchParams>;
};

export async function generateMetadata({ params }: Props) {
  try {
    return await getContentMetadata(await loadArticle((await params).slug));
  } catch {
    return { title: '文章不可用', robots: { index: false, follow: false } };
  }
}

export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params;
  let content;
  try {
    content = await loadArticle(slug);
  } catch (error) {
    if ((error as { code?: number }).code === 404) notFound();
    throw error;
  }
  const { origin, basePath } = await getPublicSite();
  if (content.slug !== slug)
    permanentRedirect(
      withSearchParams(
        localHref(basePath, content.canonical_url || `/blog/${content.slug}`),
        await searchParams,
      ),
    );
  const pages = await getPageTargets().catch(() => ({ items: [] }));
  const canonical = new URL(
    localHref(basePath, content.canonical_url || content.url),
    origin,
  ).toString();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: content.title,
    description: content.summary,
    mainEntityOfPage: canonical,
    datePublished: content.display_date || content.created_at,
    dateModified: content.updated_at,
    ...(content.cover_url && {
      image: new URL(localHref(basePath, content.cover_url), origin).toString(),
    }),
    ...(content.author_name && {
      author: { '@type': 'Person', name: content.author_name },
    }),
  };
  const node = {
    id: content.node_id || content.id,
    kb_id: content.kb_id,
    type: 2,
    name: content.title,
    content: content.content,
    meta: { summary: content.summary, content_type: content.content_type },
    created_at: content.display_date || content.created_at,
    updated_at: content.updated_at,
    pv: content.pv,
  };
  return (
    <>
      <script
        type='application/ld+json'
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <Doc
        key={content.node_id || content.id}
        node={node}
        publishedContent={content}
        pageTargets={pages.items}
        articleLayout
      />
    </>
  );
}
