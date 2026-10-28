'use client';

import { Avatar, Box, Chip, Stack, Typography } from '@mui/material';
import Link from 'next/link';
import { useBasePath } from '@/hooks';
import { getImagePath } from '@/utils/getImagePath';
import { contentHref, localHref } from './links';
import type { PublishedContent } from './types';

export default function ContentCard({
  content,
}: {
  content: PublishedContent;
}) {
  const basePath = useBasePath();
  const href = contentHref(content, basePath);
  const date = content.display_date || content.created_at;
  return (
    <Box component='article' sx={{ minWidth: 0, height: '100%' }}>
      <Link
        href={href}
        prefetch={false}
        style={{ color: 'inherit', textDecoration: 'none' }}
      >
        {content.cover_url ? (
          <Box
            component='img'
            src={getImagePath(content.cover_url, basePath)}
            alt=''
            sx={{
              width: '100%',
              height: 200,
              objectFit: 'cover',
              borderRadius: 2,
              mb: 2,
            }}
          />
        ) : (
          <Box
            sx={{
              height: 140,
              mb: 2,
              borderRadius: 2,
              bgcolor: 'action.hover',
              display: 'flex',
              alignItems: 'center',
              px: 3,
            }}
          >
            <Typography variant='h6'>{content.title}</Typography>
          </Box>
        )}
        <Stack
          direction='row'
          alignItems='center'
          gap={1}
          sx={{ mb: 1, color: 'text.secondary' }}
        >
          {content.author_avatar && (
            <Avatar
              src={getImagePath(content.author_avatar, basePath)}
              sx={{ width: 26, height: 26 }}
            />
          )}
          <Typography variant='caption'>
            {content.author_name || '编辑团队'}
          </Typography>
          {date && (
            <Typography component='time' dateTime={date} variant='caption'>
              {new Date(date).toLocaleDateString('zh-CN', {
                timeZone: 'Asia/Shanghai',
              })}
            </Typography>
          )}
        </Stack>
        <Typography component='h2' variant='h6' sx={{ fontWeight: 600, mb: 1 }}>
          {content.title}
        </Typography>
        {content.summary && (
          <Typography
            color='text.secondary'
            sx={{
              fontSize: 14,
              lineHeight: 1.8,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {content.summary}
          </Typography>
        )}
      </Link>
      <Stack direction='row' gap={0.75} flexWrap='wrap' sx={{ mt: 1.5 }}>
        {content.category && (
          <Chip
            size='small'
            component={Link}
            clickable
            href={localHref(
              basePath,
              `/blog/category/${encodeURIComponent(content.category)}`,
            )}
            label={content.category}
          />
        )}
        {(content.tags || []).map(tag => (
          <Chip
            key={tag}
            size='small'
            variant='outlined'
            component={Link}
            clickable
            href={localHref(basePath, `/blog/tag/${encodeURIComponent(tag)}`)}
            label={tag}
          />
        ))}
      </Stack>
    </Box>
  );
}
