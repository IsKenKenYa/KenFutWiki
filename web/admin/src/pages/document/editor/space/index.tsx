import EmptyState from '@/components/EmptyState';
import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';

const Space = () => {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
      }}
    >
      <EmptyState text={t('common.noData')} />
    </Box>
  );
};

export default Space;
