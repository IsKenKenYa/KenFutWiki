import { ArticleListingPage } from '@/features/kenfut/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  return { title: `${(await params).category} · 文章分类` };
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
