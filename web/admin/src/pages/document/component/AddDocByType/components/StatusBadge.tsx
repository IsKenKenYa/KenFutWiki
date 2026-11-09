import { alpha, Box, CircularProgress, Stack, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ListDataItem } from '..';

interface StatusBadgeProps {
  status: ListDataItem['status'];
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const { t } = useTranslation();
  const theme = useTheme();

  type StatusConfigItem = {
    text: string;
    color: string;
    loading: boolean;
    bgColor?: string;
  };

  // text 为 i18n key，渲染时翻译
  const statusConfig: Record<string, StatusConfigItem> = {
    common: {
      text: 'addDoc.status.parsing',
      color: theme.palette.text.secondary,
      loading: true,
    },
    'upload-error': {
      text: 'addDoc.status.uploadError',
      color: theme.palette.error.main,
      loading: false,
    },
    parsing: {
      text: 'addDoc.status.parsing',
      color: theme.palette.warning.main,
      loading: true,
    },
    importing: {
      text: 'addDoc.status.importing',
      color: theme.palette.warning.main,
      loading: true,
    },
    'parse-error': {
      text: 'addDoc.status.parseError',
      color: 'white',
      bgColor: 'error.main',
      loading: false,
    },
    'import-error': {
      text: 'addDoc.status.importError',
      color: 'white',
      bgColor: 'error.main',
      loading: false,
    },
    imported: {
      text: 'addDoc.status.imported',
      color: 'white',
      bgColor: 'success.main',
      loading: false,
    },
  };

  const config = statusConfig[status];

  if (!config) return null;

  if (config.loading) {
    return (
      <Stack
        direction='row'
        gap={1}
        alignItems='center'
        sx={{
          fontSize: 12,
          bgcolor: alpha(config.color, 0.1),
          color: config.color,
          px: 1,
          py: 0.25,
          borderRadius: 1,
        }}
      >
        <CircularProgress size={12} sx={{ color: config.color }} />
        {t(config.text)}
      </Stack>
    );
  }

  return (
    <Box
      sx={{
        fontSize: 12,
        bgcolor: config.bgColor,
        color: config.color,
        px: 1,
        py: 0.25,
        borderRadius: 1,
      }}
    >
      {t(config.text)}
    </Box>
  );
};

export default StatusBadge;
