'use client';

import { alpha, Box, Divider, Link, Stack } from '@mui/material';
import { useTranslations } from 'next-intl';

const sourceURL =
  process.env.NEXT_PUBLIC_SOURCE_URL ||
  'https://github.com/IsKenKenYa/KenFutWiki';

const linkSx = {
  color: 'inherit',
  '&:hover': {
    color: 'primary.main',
    textDecoration: 'underline',
  },
};

export default function SoftwareNotice() {
  const t = useTranslations('notice');
  return (
    <Box
      component='aside'
      aria-label={t('softwareLicense')}
      sx={theme => ({
        px: { xs: 2, sm: 5 },
        py: 1,
        bgcolor: alpha(theme.palette.text.primary, 0.05),
        textAlign: 'center',
      })}
    >
      <Stack
        direction='row'
        justifyContent='center'
        alignItems='center'
        columnGap={1.5}
        rowGap={0.5}
        flexWrap='wrap'
        sx={{
          maxWidth: 1200,
          mx: 'auto',
          fontSize: 11,
          lineHeight: '18px',
          color: theme => alpha(theme.palette.text.primary, 0.42),
        }}
      >
        <Link
          href={sourceURL}
          target='_blank'
          rel='noopener noreferrer'
          sx={linkSx}
        >
          {t('versionSource')}
        </Link>
        <Divider
          orientation='vertical'
          flexItem
          sx={theme => ({
            display: { xs: 'none', sm: 'block' },
            my: 0.25,
            borderColor: alpha(theme.palette.text.primary, 0.15),
          })}
        />
        <Link
          href='https://www.gnu.org/licenses/agpl-3.0.html'
          target='_blank'
          rel='noopener noreferrer'
          sx={linkSx}
        >
          AGPL-3.0
        </Link>
        <Divider
          orientation='vertical'
          flexItem
          sx={theme => ({
            display: { xs: 'none', sm: 'block' },
            my: 0.25,
            borderColor: alpha(theme.palette.text.primary, 0.15),
          })}
        />
        <Link
          href='https://github.com/chaitin/PandaWiki'
          target='_blank'
          rel='noopener noreferrer'
          sx={linkSx}
        >
          {t('upstream')}
        </Link>
      </Stack>
    </Box>
  );
}
