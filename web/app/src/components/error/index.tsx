'use client';
import ErrorPng from '@/assets/images/500.png';
import NoPermissionImg from '@/assets/images/no-permission.png';
import NotFoundImg from '@/assets/images/404.png';
import BlockImg from '@/assets/images/block.png';
import { SxProps, Stack } from '@mui/material';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useStore } from '@/provider';

// 错误码映射到 i18n key，文案随语言切换
type ErrorTitleKey =
  | 'forbiddenTitle'
  | 'closedTitle'
  | 'notFoundTitle'
  | 'errorTitle';

const CODE_MAP: Record<string, { title: ErrorTitleKey; img: typeof ErrorPng }> =
  {
    '40003': {
      title: 'forbiddenTitle',
      img: NoPermissionImg,
    },
    '403': {
      title: 'closedTitle',
      img: BlockImg,
    },
    '40004': {
      title: 'notFoundTitle',
      img: NotFoundImg,
    },
  };

const DEFAULT_ERROR = {
  title: 'errorTitle' as ErrorTitleKey,
  img: ErrorPng,
};

export default function Error({
  sx,
  error,
  reset,
}: {
  error: Partial<Error> & { digest?: string } & { code?: number | string };
  reset?: () => void;
  sx?: SxProps;
}) {
  const { mobile } = useStore();
  const t = useTranslations('error');
  const errorInfo =
    CODE_MAP[(error.code ?? error.message) as '40003'] || DEFAULT_ERROR;
  return (
    <Stack
      flex={1}
      sx={{
        height: '100%',
        ...(mobile && {
          width: '100%',
          marginLeft: 0,
        }),
        ...sx,
      }}
      justifyContent='center'
      alignItems='center'
    >
      <Image
        src={errorInfo.img.src}
        alt='404'
        width={380}
        height={255}
        style={{
          height: 'auto',
          ...(mobile && { width: 200 }),
        }}
      />
      <Stack
        gap={3}
        alignItems='center'
        sx={{ color: 'text.tertiary', fontSize: 14, mt: 3 }}
      >
        {t(errorInfo.title)}
      </Stack>
    </Stack>
  );
}
