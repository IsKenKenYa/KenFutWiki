import { getTranslations } from 'next-intl/server';
import { ArticleListingPage } from '@/features/kenfut/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const [t, { tag }] = await Promise.all([getTranslations('blog'), params]);
  return { title: t('tagMetadata', { name: tag }) };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ tag: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  return (
    <ArticleListingPage
      query={{
        tag: (await params).tag,
        page: Math.max(1, Number((await searchParams).page) || 1),
      }}
    />
  );
}
