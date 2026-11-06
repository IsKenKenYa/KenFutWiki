import { getTranslations } from 'next-intl/server';
import { ArticleListingPage } from '@/features/kenfut/server';

export async function generateMetadata() {
  const t = await getTranslations('blog');
  return { title: t('title') };
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
