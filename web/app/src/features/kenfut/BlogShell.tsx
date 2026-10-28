'use client';

import { Box, Stack } from '@mui/material';
import Header from '@/components/header';
import { FooterProvider } from '@/components/footer';
import ScrollToTopFab from '@/components/scrollToTopFab';

export default function BlogShell({ children }: { children: React.ReactNode }) {
  return (
    <Stack sx={{ minHeight: '100vh' }}>
      <Header isWelcomePage />
      <Box
        component='main'
        sx={{
          width: '100%',
          maxWidth: 1200,
          mx: 'auto',
          px: { xs: 2.5, md: 5 },
          py: { xs: 4, md: 7 },
          flex: 1,
        }}
      >
        {children}
      </Box>
      <FooterProvider isWelcomePage />
      <ScrollToTopFab scrollContainerId='window' />
    </Stack>
  );
}
