import ErrorComponent from '@/components/error';
import StoreProvider from '@/provider';
import type { KBDetail } from '@/assets/type';
import { ThemeStoreProvider } from '@/provider/themeStore';
import { getShareV1AppWebInfo } from '@/request/ShareApp';
import Script from 'next/script';
import { Box } from '@mui/material';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { headers, cookies } from 'next/headers';
import { getSelectorsByUserAgent } from 'react-device-detect';
import { getBasePath, getImagePath } from '@/utils';
import { getPublicSite } from '@/features/kenfut/server';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { localeHtmlLang } from '@/i18n/routing';
import './globals.css';

const gilory = localFont({
  variable: '--font-gilory',
  src: [
    {
      path: '../assets/fonts/gilroy-bold-700.otf',
      weight: '700',
    },
    {
      path: '../assets/fonts/gilroy-medium-500.otf',
      weight: '400',
    },
    {
      path: '../assets/fonts/gilroy-regular-400.otf',
      weight: '300',
    },
  ],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export async function generateMetadata(): Promise<Metadata> {
  const kbDetail: any = await getShareV1AppWebInfo();
  const basePath = getBasePath(kbDetail?.base_url || '');
  const icon = getImagePath(kbDetail?.settings?.icon || '', basePath);
  return {
    metadataBase: new URL((await getPublicSite()).origin),
    title: kbDetail?.settings?.title || 'KenFutWiki',
    description: kbDetail?.settings?.desc || '',
    keywords: kbDetail?.settings?.keyword || '',
    icons: {
      icon: icon
        ? icon
        : [
            {
              url: `${basePath}/favicon.png`,
              sizes: '32x32',
              type: 'image/png',
            },
            {
              url: `${basePath}/icon-192.png`,
              sizes: '192x192',
              type: 'image/png',
            },
            {
              url: `${basePath}/icon-512.png`,
              sizes: '512x512',
              type: 'image/png',
            },
          ],
    },
    openGraph: {
      title: kbDetail?.settings?.title || 'KenFutWiki',
      description: kbDetail?.settings?.desc || '',
      images: icon ? [icon] : [],
    },
  };
}

const Layout = async ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  const headersList = await headers();
  const userAgent = headersList.get('user-agent');
  const cookieStore = await cookies();
  const themeMode = (cookieStore.get('theme_mode')?.value || 'light') as
    | 'light'
    | 'dark';

  let error: any = null;

  const [kbDetailResolve] = await Promise.allSettled([getShareV1AppWebInfo()]);
  const kbDetail = (
    kbDetailResolve.status === 'fulfilled' ? kbDetailResolve.value : undefined
  ) as KBDetail | undefined;
  if (kbDetailResolve.status === 'rejected') error = kbDetailResolve.reason;

  const { isMobile } = getSelectorsByUserAgent(userAgent || '') || {
    isMobile: false,
  };

  const basePath = getBasePath(kbDetail?.base_url || '');
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);

  return (
    <html
      lang={localeHtmlLang[locale as keyof typeof localeHtmlLang] ?? 'zh-CN'}
    >
      <Script
        id='base-path'
        strategy='beforeInteractive'
        dangerouslySetInnerHTML={{
          __html: `window._BASE_PATH_ = ${JSON.stringify(basePath).replace(/</g, '\\u003c')};`,
        }}
      />
      <body
        className={`${gilory.variable} ${themeMode === 'dark' ? 'dark' : 'light'}`}
      >
        <AppRouterCacheProvider>
          <NextIntlClientProvider messages={messages}>
            <ThemeStoreProvider themeMode={themeMode}>
              <StoreProvider
                kbDetail={kbDetail}
                themeMode={themeMode || 'light'}
                mobile={isMobile}
              >
                <Box
                  sx={{
                    bgcolor: 'background.paper',
                    height: error ? '100vh' : 'auto',
                  }}
                  id='app-theme-root'
                >
                  {error ? <ErrorComponent error={error} /> : children}
                </Box>
              </StoreProvider>
            </ThemeStoreProvider>
          </NextIntlClientProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
};

export default Layout;
