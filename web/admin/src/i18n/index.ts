import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import zh from '../locales/zh.json';

// 支持的语言：zh 默认（无前缀语义），en 通过切换器启用
export const adminLocales = ['zh', 'en'] as const;

export type AdminLocale = (typeof adminLocales)[number];

export const ADMIN_LOCALE_STORAGE_KEY = 'kfw_admin_lang';

export const defaultAdminLocale: AdminLocale = 'zh';

export const localeHtmlLang: Record<AdminLocale, string> = {
  zh: 'zh-CN',
  en: 'en',
};

const isLocale = (value: string | null): value is AdminLocale =>
  !!value && (adminLocales as readonly string[]).includes(value);

// 语言优先级：localStorage > 浏览器语言 > 默认 zh
export const resolveAdminLocale = (): AdminLocale => {
  if (typeof window === 'undefined') return defaultAdminLocale;
  const stored = localStorage.getItem(ADMIN_LOCALE_STORAGE_KEY);
  if (isLocale(stored)) return stored;
  const browser = navigator.language?.toLowerCase() || '';
  return browser.startsWith('zh') ? 'zh' : 'en';
};

export const changeAdminLocale = (locale: AdminLocale) => {
  localStorage.setItem(ADMIN_LOCALE_STORAGE_KEY, locale);
  i18next.changeLanguage(locale);
  dayjs.locale(locale === 'en' ? 'en' : 'zh-cn');
  document.documentElement.lang = localeHtmlLang[locale];
};

void i18next.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en },
  },
  lng: resolveAdminLocale(),
  fallbackLng: defaultAdminLocale,
  interpolation: { escapeValue: false },
});

// 初始化时同步 dayjs 与 <html lang>
dayjs.locale(resolveAdminLocale() === 'en' ? 'en' : 'zh-cn');
document.documentElement.lang = localeHtmlLang[resolveAdminLocale()];

export default i18next;
