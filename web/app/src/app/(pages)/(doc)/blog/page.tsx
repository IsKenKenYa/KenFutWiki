import { getTranslations } from 'next-intl/server';
import { getShareV1AppWebInfo } from '@/request/ShareApp';
import { getBasePath } from '@/utils';
import { ArticleListingPage } from '@/features/kenfut/server';

export async function generateMetadata() {
  const [t, info] = await Promise.all([
    getTranslations('blog'),
    getShareV1AppWebInfo(),
  ]);
  const basePath = getBasePath(info?.base_url || '');
  return {
    title: t('title'),
    alternates: {
      types: { 'application/rss+xml': `${basePath}/rss.xml` },
    },
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const value = (key: string) =>
    typeof params[key] === 'string' ? (params[key] as string) : undefined;
  return (
    <ArticleListingPage
      query={{
        q: value('q'),
        category: value('category'),
        tag: value('tag'),
        page: Math.max(1, Number(value('page')) || 1),
      }}
    />
  );
}
