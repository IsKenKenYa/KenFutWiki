'use client';

import { Breadcrumbs, Link as MuiLink, Typography } from '@mui/material';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ITreeItem } from '@/assets/type';
import { useLocaleBasePath } from '@/hooks';
import { useStore } from '@/provider';
import { localHref } from './links';
import type { PublishedContent } from './types';

function findPath(nodes: ITreeItem[], id: string): ITreeItem[] | undefined {
  for (const node of nodes) {
    if (node.id === id) return [node];
    const child = node.children && findPath(node.children, id);
    if (child) return [node, ...child];
  }
}

export default function ContentBreadcrumbs({
  content,
  article = false,
}: {
  content: PublishedContent;
  article?: boolean;
}) {
  const basePath = useLocaleBasePath();
  const t = useTranslations('common');
  const tHeader = useTranslations('header');
  const { tree } = useStore();
  const ancestors = article
    ? []
    : (findPath(tree || [], content.node_id || content.id) || []).slice(0, -1);
  return (
    <Breadcrumbs aria-label={t('breadcrumb')} sx={{ mb: 3, fontSize: 13 }}>
      <MuiLink
        component={Link}
        href={localHref(basePath, '/')}
        underline='hover'
        color='inherit'
      >
        {t('home')}
      </MuiLink>
      <MuiLink
        component={Link}
        href={localHref(basePath, article ? '/blog' : '/node')}
        underline='hover'
        color='inherit'
      >
        {article ? tHeader('blog') : tHeader('docs')}
      </MuiLink>
      {article && content.category && (
        <MuiLink
          component={Link}
          href={localHref(
            basePath,
            `/blog/category/${encodeURIComponent(content.category)}`,
          )}
          underline='hover'
          color='inherit'
        >
          {content.category}
        </MuiLink>
      )}
      {ancestors.map(node => (
        <MuiLink
          key={node.id}
          component={Link}
          href={localHref(basePath, `/node/${node.id}`)}
          underline='hover'
          color='inherit'
        >
          {node.name}
        </MuiLink>
      ))}
      <Typography variant='caption' color='text.primary'>
        {content.title}
      </Typography>
    </Breadcrumbs>
  );
}
