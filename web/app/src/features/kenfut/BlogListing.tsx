'use client';

import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { useBasePath } from '@/hooks';
import ContentCard from './ContentCard';
import { localHref } from './links';
import type { ContentList, ContentQuery, PublishedContent } from './types';

export default function BlogListing({
  result,
  featured = [],
  categories = [],
  tags = [],
  query,
  error,
}: {
  result?: ContentList;
  featured?: PublishedContent[];
  categories?: string[];
  tags?: string[];
  query: ContentQuery;
  error?: string;
}) {
  const router = useRouter();
  const basePath = useBasePath();
  const [search, setSearch] = useState(query.q || '');
  const navigate = (page = 1) => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (query.category) params.set('category', query.category);
    if (query.tag) params.set('tag', query.tag);
    if (page > 1) params.set('page', String(page));
    router.push(
      `${localHref(basePath, '/blog')}${params.size ? `?${params}` : ''}`,
    );
  };
  const title = query.category
    ? `分类：${query.category}`
    : query.tag
      ? `标签：${query.tag}`
      : '文章';
  return (
    <>
      <Stack
        direction='row'
        gap={1}
        alignItems='center'
        sx={{ mb: 2, color: 'text.secondary', fontSize: 14 }}
      >
        <Link href={localHref(basePath, '/')} style={{ color: 'inherit' }}>
          首页
        </Link>
        <span>/</span>
        <Link href={localHref(basePath, '/blog')} style={{ color: 'inherit' }}>
          文章
        </Link>
        {(query.category || query.tag) && (
          <>
            <span>/</span>
            <span>{query.category || query.tag}</span>
          </>
        )}
      </Stack>
      <Typography component='h1' variant='h3' sx={{ fontWeight: 700, mb: 3 }}>
        {title}
      </Typography>
      <Stack
        component='form'
        direction='row'
        gap={1}
        onSubmit={event => {
          event.preventDefault();
          navigate();
        }}
        sx={{ mb: 3 }}
      >
        <TextField
          value={search}
          onChange={event => setSearch(event.target.value)}
          label='搜索文章'
          placeholder='搜索标题、正文或主题'
          size='small'
          fullWidth
          inputProps={{ maxLength: 200 }}
        />
        <Button type='submit' variant='contained'>
          搜索
        </Button>
      </Stack>
      {!!categories.length && (
        <Stack direction='row' gap={1} flexWrap='wrap' sx={{ mb: 2 }}>
          <Chip
            component={Link}
            href={localHref(basePath, '/blog')}
            clickable
            label='全部分类'
            color={!query.category ? 'primary' : 'default'}
          />
          {categories.map(category => (
            <Chip
              key={category}
              component={Link}
              href={localHref(
                basePath,
                `/blog/category/${encodeURIComponent(category)}`,
              )}
              clickable
              label={category}
              color={query.category === category ? 'primary' : 'default'}
            />
          ))}
        </Stack>
      )}
      {!!tags.length && (
        <Stack direction='row' gap={0.75} flexWrap='wrap' sx={{ mb: 4 }}>
          {tags.map(tag => (
            <Chip
              size='small'
              key={tag}
              component={Link}
              href={localHref(basePath, `/blog/tag/${encodeURIComponent(tag)}`)}
              clickable
              label={`# ${tag}`}
              variant='outlined'
              color={query.tag === tag ? 'primary' : 'default'}
            />
          ))}
        </Stack>
      )}
      {!!featured.length && !query.q && !query.category && !query.tag && (
        <Box component='section' sx={{ mb: 5 }}>
          <Typography
            component='h2'
            variant='h5'
            sx={{ fontWeight: 600, mb: 3 }}
          >
            精选文章
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
              },
              gap: 4,
            }}
          >
            {featured.map(item => (
              <ContentCard key={item.id} content={item} />
            ))}
          </Box>
          <Divider sx={{ mt: 5 }} />
        </Box>
      )}
      {error ? (
        <Alert severity='error'>{error}</Alert>
      ) : !result?.items?.length ? (
        <Alert severity='info'>
          {query.q ? '没有找到匹配的已发布文章。' : '暂时没有已发布文章。'}
        </Alert>
      ) : (
        <>
          <Typography color='text.secondary' sx={{ mb: 3 }}>
            共 {result.total} 篇文章
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(3, minmax(0, 1fr))',
              },
              gap: { xs: 4, md: 5 },
            }}
          >
            {result.items.map(item => (
              <ContentCard key={item.id} content={item} />
            ))}
          </Box>
          {result.total > result.page_size && (
            <Stack alignItems='center' sx={{ mt: 6 }}>
              <Pagination
                page={result.page}
                count={Math.ceil(result.total / result.page_size)}
                onChange={(_, page) => navigate(page)}
                color='primary'
              />
            </Stack>
          )}
        </>
      )}
    </>
  );
}
