import { getTranslations } from 'next-intl/server';
import { ArticleListingPage } from '@/features/kenfut/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const [t, { category }] = await Promise.all([
    getTranslations('blog'),
    params,
  ]);
  return { title: t('categoryMetadata', { name: category }) };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  return (
    <ArticleListingPage
      query={{
        category: (await params).category,
        page: Math.max(1, Number((await searchParams).page) || 1),
      }}
    />
  );
}
