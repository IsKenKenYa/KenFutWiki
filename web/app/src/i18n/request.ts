import { getRequestConfig } from 'next-intl/server';
import { headers } from 'next/headers';
import { defaultLocale, isLocale, type Locale } from './routing';
import { LOCALE_HEADER } from './constants';

// proxy.ts 把 URL 上的 /en 前缀剥离后通过请求头传递 locale
export async function resolveLocale(): Promise<Locale> {
  const value = (await headers()).get(LOCALE_HEADER);
  return isLocale(value) ? value : defaultLocale;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const messages = (await import(`../messages/${locale}.json`)).default;
  return { locale, messages };
});
