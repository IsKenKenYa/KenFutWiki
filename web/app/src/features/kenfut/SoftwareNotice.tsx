'use client';

import { Box, Link, Stack, Typography } from '@mui/material';
import { useTranslations } from 'next-intl';

const sourceURL =
  process.env.NEXT_PUBLIC_SOURCE_URL ||
  'https://github.com/IsKenKenYa/KenFutWiki';

export default function SoftwareNotice() {
  const t = useTranslations('notice');
  return (
    <Box
      component='aside'
      aria-label={t('softwareLicense')}
      sx={{
        px: 2,
        py: 2,
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        textAlign: 'center',
      }}
    >
      <Stack
        direction='row'
        justifyContent='center'
        gap={1.5}
        flexWrap='wrap'
        sx={{ fontSize: 12, color: 'text.secondary' }}
      >
        <Typography variant='caption'>KenFutWiki</Typography>
        <Link href={sourceURL} target='_blank' rel='noopener noreferrer'>
          {t('versionSource')}
        </Link>
        <Link
          href='https://www.gnu.org/licenses/agpl-3.0.html'
          target='_blank'
          rel='noopener noreferrer'
        >
          AGPL-3.0
        </Link>
        <Link
          href='https://github.com/chaitin/PandaWiki'
          target='_blank'
          rel='noopener noreferrer'
        >
          {t('upstream')}
        </Link>
      </Stack>
    </Box>
  );
}
