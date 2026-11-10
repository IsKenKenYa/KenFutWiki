import { Box, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';
import packageJson from '../../../package.json';

const Version = () => {
  const { t } = useTranslation();
  const version = import.meta.env.VITE_APP_VERSION || packageJson.version;
  const source =
    import.meta.env.VITE_APP_SOURCE_URL ||
    'https://github.com/IsKenKenYa/KenFutWiki';
  return (
    <Stack
      gap={0.5}
      sx={{
        borderTop: '1px solid',
        borderColor: 'divider',
        pt: 2,
        mt: 1,
        fontSize: 12,
      }}
    >
      <Box>KenFutWiki {version}</Box>
      <Box
        component='a'
        href={source}
        target='_blank'
        rel='noopener noreferrer'
        sx={{ color: 'text.secondary' }}
      >
        {t('layout.sourceCode')}
      </Box>
    </Stack>
  );
};

export default Version;
