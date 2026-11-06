'use client';

import LoadingIcon from '@/assets/images/loading.png';
import { alpha, Box, Stack } from '@mui/material';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

// 回答状态的 i18n key
const AnswerStatusKey = {
  1: 'searching',
  2: 'thinking',
  3: 'answering',
  4: '',
} as const;

interface ChatLoadingProps {
  thinking: keyof typeof AnswerStatusKey;
  onClick?: () => void;
}

const ChatLoading = ({ thinking, onClick }: ChatLoadingProps) => {
  const t = useTranslations('qa');
  return (
    <Stack
      direction={onClick ? 'row-reverse' : 'row'}
      alignItems={'center'}
      gap={1}
      sx={{
        color: 'text.tertiary',
        fontSize: 12,
      }}
      onClick={() => onClick?.()}
    >
      <Stack
        direction={onClick ? 'row-reverse' : 'row'}
        alignItems={'center'}
        sx={{ position: 'relative' }}
      >
        <Image
          src={LoadingIcon.src}
          alt='loading'
          width={20}
          height={20}
          style={{ animation: 'loadingRotate 1s linear infinite' }}
        />
        <Box
          sx={{
            width: 6,
            height: 6,
            bgcolor: 'primary.main',
            borderRadius: '1px',
            position: 'absolute',
            top: 7,
            left: 7,
          }}
        ></Box>
      </Stack>
      <Box
        sx={theme => ({
          lineHeight: 1,
          color: alpha(theme.palette.text.primary, 0.5),
        })}
      >
        {t(AnswerStatusKey[thinking])}
      </Box>
    </Stack>
  );
};

export default ChatLoading;
