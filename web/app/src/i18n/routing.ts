// 站点语言配置：zh 为默认语言（URL 无前缀），en 通过 /en 前缀承载
import { DEFAULT_LOCALE } from './constants';

export const locales = ['zh', 'en'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = DEFAULT_LOCALE;

export const localeLabels: Record<Locale, string> = {
  zh: '中文',
  en: 'English',
};

// html lang 属性值
export const localeHtmlLang: Record<Locale, string> = {
  zh: 'zh-CN',
  en: 'en',
};

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

// MUI / @ctzhian/ui 的 locale 对象映射
import { enUS, zhCN } from '@mui/material/locale';

export const muiLocales = { zh: zhCN, en: enUS } as const;
