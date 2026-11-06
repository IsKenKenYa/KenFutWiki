'use client';

import noDocImage from '@/assets/images/no-doc.png';
import { Box, Stack } from '@mui/material';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

interface EmptyDocPlaceholderProps {
  mobile?: boolean;
}

const EmptyDocPlaceholder = ({ mobile = false }: EmptyDocPlaceholderProps) => {
  const t = useTranslations('node');
  return (
    <Stack
      justifyContent='center'
      alignItems='center'
      gap={2}
      sx={{
        flex: 1,
        pt: '50px',
        pb: 10,
        px: mobile ? 5 : 0,
      }}
    >
      <Image src={noDocImage} alt={t('noDocs')} width={mobile ? 280 : 380} />
      <Box sx={{ fontSize: 14, color: 'text.tertiary' }}>{t('noDocsHint')}</Box>
    </Stack>
  );
};

export default EmptyDocPlaceholder;
