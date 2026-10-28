'use client';

import { Box, Link, Stack, Typography } from '@mui/material';

const sourceURL =
  process.env.NEXT_PUBLIC_SOURCE_URL ||
  'https://github.com/IsKenKenYa/KenFutWiki';

export default function SoftwareNotice() {
  return (
    <Box
      component='aside'
      aria-label='软件许可与源码'
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
          本版本对应源码
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
          基于 PandaWiki
        </Link>
      </Stack>
    </Box>
  );
}
