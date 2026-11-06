'use client';
import * as Sentry from '@sentry/nextjs';
import { useEffect, useSyncExternalStore } from 'react';
import ErrorPng from '@/assets/images/500.png';
import Footer from '@/components/footer';
import { lightTheme } from '@/theme';
import { Box, Stack } from '@mui/material';
import { ThemeProvider } from '@ctzhian/ui';
import Image from 'next/image';
import zhMessages from '@/messages/zh.json';
import enMessages from '@/messages/en.json';

const errorMessages = {
  zh: zhMessages.error,
  en: enMessages.error,
} as const;

// global-error 会替换根布局，无法使用 next-intl 的 Provider，只能依据 URL 判断语言。
// useSyncExternalStore 读取浏览器地址（SSR 端回落到默认语言 zh），避免 hydration 不一致。
const emptySubscribe = () => () => {};
const useErrorLocale = () =>
  useSyncExternalStore(
    emptySubscribe,
    () => (/\/en(\/|$)/.test(window.location.pathname) ? 'en' : 'zh'),
    () => 'zh' as const,
  );

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useErrorLocale();
  const t = errorMessages[locale];

  useEffect(() => {
    // 只在生产环境下上报错误到 Sentry
    if (process.env.NODE_ENV === 'production') {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <html lang={locale === 'zh' ? 'zh-CN' : 'en'}>
      <body>
        <ThemeProvider theme={lightTheme}>
          <Box
            sx={{
              position: 'relative',
              pt: 28,
              height: '100vh',
            }}
          >
            <Stack
              sx={{
                maxWidth: 1200,
                overflow: 'auto',
                pb: 6,
                mx: 'auto',
              }}
              justifyContent='center'
              alignItems='center'
            >
              <Image
                src={ErrorPng}
                unoptimized
                alt='404'
                width={380}
                height={200}
              />
              <Stack
                gap={3}
                alignItems='center'
                sx={{ color: 'text.tertiary', fontSize: 14, mt: 3 }}
              >
                {t.errorTitle} {error.digest}
              </Stack>
            </Stack>

            <Box
              sx={{
                height: 40,
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 1000,
              }}
            >
              <Footer showBrand={false} />
            </Box>
          </Box>
        </ThemeProvider>
      </body>
    </html>
  );
}
