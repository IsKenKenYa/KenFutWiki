'use client';

import { Box, Link, Stack } from '@mui/material';

export default function SocialLink({
  account,
}: {
  account: { link?: string; text?: string; icon?: string };
}) {
  const href = account.link || '';
  try {
    const url = new URL(href, 'https://kenfut.invalid');
    if (
      !href ||
      href.startsWith('//') ||
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
  } catch {
    return null;
  }
  return (
    <Link
      href={href}
      target='_blank'
      rel='noopener noreferrer'
      underline='hover'
      color='inherit'
    >
      <Stack
        direction='row'
        alignItems='center'
        gap={1}
        sx={{ fontSize: 14, overflowWrap: 'anywhere' }}
      >
        {account.icon && (
          <Box
            component='img'
            src={account.icon}
            alt=''
            sx={{ width: 20, height: 20, objectFit: 'contain' }}
          />
        )}
        {account.text || account.link}
      </Stack>
    </Link>
  );
}
