'use client';

import { ConstsCopySetting, V1ShareNodeDetailResp } from '@/request/types';
import { Avatar, Box, Chip, IconButton, Stack, Tooltip } from '@mui/material';
import Link from 'next/link';
import type { PublishedContent } from '@/features/kenfut/types';
import { localHref } from '@/features/kenfut/links';
import { useBasePath } from '@/hooks';
import { getImagePath } from '@/utils/getImagePath';
import { IconFuzhi, IconWenjian, IconWenjianjia } from '@panda-wiki/icons';
import dayjs from 'dayjs';

interface DocMetaInfoProps {
  info: V1ShareNodeDetailResp;
  characterCount?: number;
  kbDetailCopySetting?: string;
  onCopyDocMd: () => void;
  publication?: PublishedContent;
  showPV?: boolean;
}

const DocMetaInfo = ({
  info,
  characterCount,
  kbDetailCopySetting,
  onCopyDocMd,
  publication,
  showPV = false,
}: DocMetaInfoProps) => {
  const basePath = useBasePath();
  return (
    <>
      <Stack
        component='h1'
        direction='row'
        alignItems='flex-start'
        gap={1}
        sx={{
          fontSize: 30,
          lineHeight: '36px',
          fontWeight: 'bold',
          color: 'text.primary',
          mb: '10px',
        }}
      >
        {info?.meta?.emoji ? (
          <Box sx={{ flexShrink: 0 }}>{info?.meta?.emoji}</Box>
        ) : info?.type === 1 ? (
          <IconWenjianjia sx={{ flexShrink: 0, mt: 0.5 }} />
        ) : (
          <IconWenjian sx={{ flexShrink: 0, mt: 0.5 }} />
        )}
        {info?.name}
      </Stack>
      <Stack
        direction='row'
        justifyContent='space-between'
        alignItems='center'
        sx={{ mb: 4 }}
      >
        <Stack
          direction='row'
          alignItems='center'
          gap={1}
          sx={{ fontSize: 14, color: 'text.tertiary' }}
        >
          {publication && (
            <>
              {publication.author_avatar && (
                <Avatar
                  src={getImagePath(publication.author_avatar, basePath)}
                  sx={{ width: 28, height: 28 }}
                />
              )}
              <Box>{publication.author_name || '编辑团队'}</Box>
              <Box
                component='time'
                dateTime={publication.display_date || publication.created_at}
              >
                {new Date(
                  publication.display_date || publication.created_at,
                ).toLocaleDateString('zh-CN', {
                  timeZone: 'Asia/Shanghai',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Box>
            </>
          )}
          {!publication && info?.created_at && (
            <Box>
              {info?.creator_account === 'admin'
                ? '管理员'
                : info?.creator_account}{' '}
              {dayjs(info?.created_at).fromNow()}创建
            </Box>
          )}
          {!publication &&
            info?.updated_at &&
            info.updated_at.slice(0, 1) !== '0' && (
              <>
                <Box>·</Box>
                <Box>
                  {info?.publisher_account === 'admin'
                    ? '管理员'
                    : info?.publisher_account}{' '}
                  {dayjs(info.updated_at).fromNow()}更新
                </Box>
              </>
            )}
          {!!characterCount && characterCount > 0 && (
            <>
              <Box>·</Box>
              <Box>{characterCount} 字</Box>
            </>
          )}
          {showPV && (publication?.pv ?? info.pv ?? 0) > 0 && (
            <>
              <Box>·</Box>
              <Box>浏览量 {publication?.pv ?? info.pv}</Box>
            </>
          )}
        </Stack>
        {info?.type === 2 &&
          kbDetailCopySetting !== ConstsCopySetting.CopySettingDisabled && (
            <Tooltip title='复制 MarkDown 格式' arrow placement='top'>
              <IconButton size='small' onClick={onCopyDocMd}>
                <IconFuzhi sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
      </Stack>
      {publication && (
        <Stack direction='row' gap={1} flexWrap='wrap' sx={{ mb: 3 }}>
          {publication.category && (
            <Chip
              size='small'
              label={publication.category}
              component={Link}
              clickable
              href={localHref(
                basePath,
                `/blog/category/${encodeURIComponent(publication.category)}`,
              )}
            />
          )}
          {(publication.tags || []).map(tag => (
            <Chip
              key={tag}
              size='small'
              variant='outlined'
              label={tag}
              component={Link}
              clickable
              href={localHref(basePath, `/blog/tag/${encodeURIComponent(tag)}`)}
            />
          ))}
        </Stack>
      )}
    </>
  );
};

export default DocMetaInfo;
