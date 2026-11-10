import { DomainNodeReleaseListItem } from '@/request/pro';
import { Modal } from '@ctzhian/ui';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Box, Stack, alpha } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface VersionRollbackProps {
  open: boolean;
  onClose: () => void;
  onOk: () => void;
  data: DomainNodeReleaseListItem | null;
}

const VersionRollback = ({
  open,
  onClose,
  data,
  onOk,
}: VersionRollbackProps) => {
  const { t } = useTranslation();
  if (!data) return null;
  return (
    <Modal
      title={
        <Stack direction='row' alignItems='center' gap={1}>
          {t('history.rollbackTitle')}
        </Stack>
      }
      open={open}
      onOk={onOk}
      onCancel={onClose}
    >
      <Stack
        direction='row'
        gap={1}
        alignItems='center'
        sx={{
          py: 1,
          px: 1.5,
          borderRadius: 1,
          mb: 2,
          fontSize: 12,
          color: 'warning.main',
          bgcolor: theme => alpha(theme.palette.warning.main, 0.05),
        }}
      >
        <ErrorOutlineIcon sx={{ color: 'warning.main', fontSize: 12 }} />
        {t('history.rollbackWarning')}
      </Stack>
      <Stack direction='row' spacing={2}>
        <Box sx={{ fontSize: 14, width: 100, flexShrink: 0 }}>
          {t('history.versionNumber')}
        </Box>
        <Box sx={{ fontWeight: 700 }}>{data.release_name}</Box>
      </Stack>
      <Stack direction='row' spacing={2} sx={{ mt: 2 }}>
        <Box sx={{ fontSize: 14, width: 100, flexShrink: 0 }}>
          {t('history.versionDescription')}
        </Box>
        <Box sx={{ fontSize: 14 }}>{data.release_message}</Box>
      </Stack>
      {data.creator_account && (
        <Stack direction='row' spacing={2} sx={{ mt: 2 }}>
          <Box sx={{ fontSize: 14, width: 100, flexShrink: 0 }}>
            {t('history.creatorLabel')}
          </Box>
          <Box sx={{ fontSize: 14 }}>{data.creator_account}</Box>
        </Stack>
      )}
      {data.editor_account && (
        <Stack direction='row' spacing={2} sx={{ mt: 2 }}>
          <Box sx={{ fontSize: 14, width: 100, flexShrink: 0 }}>
            {t('history.editorLabel')}
          </Box>
          <Box sx={{ fontSize: 14 }}>{data.editor_account}</Box>
        </Stack>
      )}
      {data.publisher_account && (
        <Stack direction='row' spacing={2} sx={{ mt: 2 }}>
          <Box sx={{ fontSize: 14, width: 100, flexShrink: 0 }}>
            {t('history.publisherLabel')}
          </Box>
          <Box sx={{ fontSize: 14 }}>{data.publisher_account}</Box>
        </Stack>
      )}
    </Modal>
  );
};

export default VersionRollback;
