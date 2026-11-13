import StorageSettingForm from '@/components/StorageSettingForm';
import {
  deleteApiV1StorageSetting,
  getApiV1StorageSetting,
} from '@/request/Storage';
import { DomainStorageSettingDetail } from '@/request/types';
import { Modal, message } from '@ctzhian/ui';
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const CardStorage = () => {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<DomainStorageSettingDetail | null>(null);
  const [resetting, setResetting] = useState(false);

  // 配置来源标签：页面保存 / 环境变量默认
  const sourceLabel = (source?: string) =>
    source === 'database'
      ? t('storage.sourceDatabase')
      : t('storage.sourceEnv');

  const loadDetail = useCallback(async () => {
    try {
      const res = await getApiV1StorageSetting();
      setDetail(res);
    } catch {
      // request 封装已弹错
    }
  }, []);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleReset = () => {
    Modal.confirm({
      title: t('storage.resetTitle'),
      content: t('storage.resetContent'),
      onOk: async () => {
        setResetting(true);
        try {
          await deleteApiV1StorageSetting();
          message.success(t('storage.resetSuccess'));
          await loadDetail();
        } catch {
          // request 封装已弹错
        } finally {
          setResetting(false);
        }
      },
    });
  };

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 1000,
        margin: 'auto',
        px: 3,
        pt: 3,
        pb: 4,
      }}
    >
      <Stack spacing={2} sx={{ mb: 2 }}>
        <Stack direction='row' spacing={1} alignItems='center'>
          <Typography variant='subtitle1' fontWeight='bold'>
            {t('storage.title')}
          </Typography>
          <Chip
            size='small'
            label={t('storage.sourceChip', {
              source: sourceLabel(detail?.source),
            })}
            color={detail?.source === 'database' ? 'primary' : 'default'}
            variant='outlined'
          />
          <Chip
            size='small'
            label={detail?.ready ? t('storage.ready') : t('storage.notReady')}
            color={detail?.ready ? 'success' : 'error'}
            variant='outlined'
          />
          {detail?.source === 'database' && (
            <Button
              size='small'
              color='warning'
              onClick={handleReset}
              disabled={resetting}
              sx={{ ml: 'auto' }}
            >
              {t('storage.resetAction')}
            </Button>
          )}
        </Stack>
        <Typography variant='body2' color='text.secondary'>
          {t('storage.hint')}
        </Typography>
        {detail?.error && (
          <Alert severity='error'>
            {t('storage.errorPrefix')}
            {detail.error}
          </Alert>
        )}
        {(detail?.warnings ?? []).map((w, i) => (
          <Alert key={i} severity='warning'>
            {w}
          </Alert>
        ))}
      </Stack>
      <StorageSettingForm
        key={detail?.source ?? 'default'}
        detail={detail}
        onSaved={() => loadDetail()}
      />
    </Box>
  );
};

export default CardStorage;
