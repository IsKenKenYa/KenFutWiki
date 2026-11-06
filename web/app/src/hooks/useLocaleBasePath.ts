'use client';

import { useLocale } from 'next-intl';
import { defaultLocale } from '@/i18n/routing';
import { useBasePath } from './useBasePath';

// 语言感知的站内基路径：默认语言即 basePath，其它语言为 basePath/<locale>。
// 仅用于页面跳转链接；接口地址与静态资源必须继续使用 useBasePath。
export const useLocaleBasePath = () => {
  const basePath = useBasePath();
  const locale = useLocale();
  return locale === defaultLocale ? basePath : `${basePath}/${locale}`;
};
