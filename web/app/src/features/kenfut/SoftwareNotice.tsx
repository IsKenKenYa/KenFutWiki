'use client';

import { alpha, Box, Divider, Link, Stack, Typography } from '@mui/material';
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
        py: 1.5,
        bgcolor: alpha(theme.palette.text.primary, 0.05),
        textAlign: 'center',
      })}
    >
      <Stack
        direction='row'
        justifyContent='center'
        alignItems='center'
        columnGap={1.5}
        rowGap={0.75}
        flexWrap='wrap'
        sx={{
          maxWidth: 1200,
          mx: 'auto',
          fontSize: 12,
          color: 'text.secondary',
        }}
      >
        <Typography
          component='span'
          sx={{ fontWeight: 600, color: 'text.primary' }}
        >
          KenFutWiki
        </Typography>
        <Divider
          orientation='vertical'
          flexItem
          sx={{ display: { xs: 'none', sm: 'block' }, my: 0.25 }}
        />
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
          sx={{ display: { xs: 'none', sm: 'block' }, my: 0.25 }}
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
          sx={{ display: { xs: 'none', sm: 'block' }, my: 0.25 }}
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
