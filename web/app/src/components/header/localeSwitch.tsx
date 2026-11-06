'use client';

import { IconButton, Menu, MenuItem, alpha, Box } from '@mui/material';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { locales, localeLabels, type Locale } from '@/i18n/routing';
import { useBasePath } from '@/hooks';
import { getArticle, getContentTranslations } from '@/features/kenfut/api';
import type { ContentTranslation } from '@/features/kenfut/types';

const NODE_PATH = /^\/node\/([^/?#]+)/;
const ARTICLE_PATH = /^\/blog\/(?!category\/|tag\/)([^/?#]+)/;

// 语言切换器：优先跳转到当前文档的对应译本，否则在 URL 上加/去语言前缀
const LocaleSwitch = () => {
  const t = useTranslations('header');
  const pathname = usePathname();
  const router = useRouter();
  const basePath = useBasePath();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const [pending, startTransition] = useTransition();
  const [translations, setTranslations] = useState<ContentTranslation[]>([]);
  const [resolvedKey, setResolvedKey] = useState('');

  const appPath =
    basePath && pathname.startsWith(basePath)
      ? pathname.slice(basePath.length) || '/'
      : pathname;
  const current: Locale =
    appPath === '/en' || appPath.startsWith('/en/') ? 'en' : 'zh';
  const rest =
    current === 'en'
      ? appPath === '/en'
        ? '/'
        : appPath.slice('/en'.length)
      : appPath;
  const routeKey = `${current}:${rest}`;

  useEffect(() => {
    if (resolvedKey === routeKey) return;
    let cancelled = false;
    // 译本属于可选元数据：没有发布内容或接口不可用时退回纯 URL 前缀切换
    const resolve = async () => {
      let nodeId: string | undefined;
      const nodeMatch = rest.match(NODE_PATH);
      if (nodeMatch) {
        nodeId = decodeURIComponent(nodeMatch[1]);
      } else {
        const articleMatch = rest.match(ARTICLE_PATH);
        if (articleMatch) {
          const article = await getArticle(
            decodeURIComponent(articleMatch[1]),
            current === 'zh' ? undefined : current,
          );
          nodeId = article.node_id || article.id;
        }
      }
      const list = nodeId ? await getContentTranslations(nodeId) : [];
      if (!cancelled) {
        setTranslations(list);
        setResolvedKey(routeKey);
      }
    };
    resolve().catch(() => {
      if (!cancelled) {
        setTranslations([]);
        setResolvedKey(routeKey);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [routeKey, rest, current, resolvedKey]);

  const switchTo = (target: Locale) => {
    setAnchor(null);
    if (target === current) return;
    const translated = translations.find(item => item.lang === target)?.url;
    const isArticle = ARTICLE_PATH.test(rest);
    let path: string;
    if (translated) {
      path = `${basePath}${target === 'zh' ? '' : `/${target}`}${translated}`;
    } else if (target === 'en') {
      path = isArticle
        ? `${basePath}/en/blog`
        : `${basePath}/en${rest === '/' ? '' : rest}`;
    } else {
      path = isArticle ? `${basePath}/blog` : `${basePath}${rest}`;
    }
    const suffix = `${window.location.search}${window.location.hash}`;
    startTransition(() => router.push(`${path || '/'}${suffix}`));
  };

  return (
    <>
      <IconButton
        size='small'
        title={t('language')}
        onClick={e => setAnchor(e.currentTarget)}
        disabled={pending}
      >
        <Box
          component='span'
          sx={{
            fontSize: 13,
            fontWeight: 600,
            color: theme => alpha(theme.palette.text.primary, 0.65),
          }}
        >
          {current.toUpperCase()}
        </Box>
      </IconButton>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {locales.map(l => (
          <MenuItem
            key={l}
            selected={l === current}
            onClick={() => switchTo(l)}
          >
            {localeLabels[l]}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default LocaleSwitch;
