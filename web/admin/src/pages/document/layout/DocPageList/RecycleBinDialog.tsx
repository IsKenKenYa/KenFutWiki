import { postApiV1NodeAction, getApiV1NodeRecycleBin } from '@/request/Node';
import { DomainNodeRecycleBinItem } from '@/request/types';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { message, Modal } from '@ctzhian/ui';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/store';

interface RecycleBinDialogProps {
  open: boolean;
  onClose: () => void;
  refresh?: () => void;
}

const RecycleBinDialog = ({
  open,
  onClose,
  refresh,
}: RecycleBinDialogProps) => {
  const { t } = useTranslation();
  const { kb_id } = useAppSelector(state => state.config);
  const [items, setItems] = useState<DomainNodeRecycleBinItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!open || !kb_id) return;
    setLoading(true);
    getApiV1NodeRecycleBin({ kb_id })
      .then(res => setItems(res.data || []))
      .catch(error =>
        message.error(
          error instanceof Error ? error.message : t('common.operationFailed'),
        ),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const act = async (
    action: 'restore' | 'purge',
    item: DomainNodeRecycleBinItem,
  ) => {
    setBusy(true);
    try {
      await postApiV1NodeAction({ action, ids: [item.id!], kb_id });
      message.success(
        action === 'restore'
          ? t('doc.recycleBin.restored')
          : t('doc.recycleBin.purged'),
      );
      load();
      if (action === 'restore') refresh?.();
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : t('common.operationFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={t('doc.recycleBin.title')}
      open={open}
      width={640}
      footer={null}
      onCancel={onClose}
    >
      {loading ? (
        <Typography color='text.secondary' sx={{ py: 4, textAlign: 'center' }}>
          {t('common.loading')}
        </Typography>
      ) : items.length ? (
        <Stack spacing={1} sx={{ maxHeight: 480, overflowY: 'auto' }}>
          {items.map(item => (
            <Stack
              key={item.id}
              direction='row'
              alignItems='center'
              spacing={1}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                px: 2,
                py: 1.5,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction='row' spacing={1} alignItems='center'>
                  <Typography noWrap>{item.name}</Typography>
                  {item.type === 1 && (
                    <Chip size='small' label={t('doc.recycleBin.folder')} />
                  )}
                </Stack>
                <Typography variant='caption' color='text.secondary'>
                  {t('doc.recycleBin.deletedAt', {
                    time: dayjs(item.deleted_at).format('YYYY-MM-DD HH:mm'),
                  })}
                </Typography>
              </Box>
              <Stack direction='row' spacing={1}>
                <Box
                  component='button'
                  disabled={busy}
                  onClick={() => act('restore', item)}
                  sx={{
                    border: 'none',
                    cursor: 'pointer',
                    background: 'none',
                    color: 'primary.main',
                    fontSize: 13,
                  }}
                >
                  {t('doc.recycleBin.restore')}
                </Box>
                <Box
                  component='button'
                  disabled={busy}
                  onClick={() => act('purge', item)}
                  sx={{
                    border: 'none',
                    cursor: 'pointer',
                    background: 'none',
                    color: 'error.main',
                    fontSize: 13,
                  }}
                >
                  {t('doc.recycleBin.purge')}
                </Box>
              </Stack>
            </Stack>
          ))}
        </Stack>
      ) : (
        <Typography color='text.secondary' sx={{ py: 4, textAlign: 'center' }}>
          {t('doc.recycleBin.empty')}
        </Typography>
      )}
    </Modal>
  );
};

export default RecycleBinDialog;
