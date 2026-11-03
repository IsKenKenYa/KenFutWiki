import StorageSettingForm from '@/components/StorageSettingForm';
import {
  deleteApiV1StorageSetting,
  getApiV1StorageSetting,
} from '@/request/Storage';
import { DomainStorageSettingDetail } from '@/request/types';
import { Modal, message } from '@ctzhian/ui';
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';

const sourceLabel = (source?: string) =>
  source === 'database' ? '页面配置' : '环境变量默认';

const CardStorage = () => {
  const [detail, setDetail] = useState<DomainStorageSettingDetail | null>(null);
  const [resetting, setResetting] = useState(false);

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
      title: '恢复默认存储配置',
      content:
        '将删除页面保存的存储配置，回退到环境变量/内置 MinIO 默认值。确定恢复？',
      onOk: async () => {
        setResetting(true);
        try {
          await deleteApiV1StorageSetting();
          message.success('已恢复默认配置');
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
    <Box sx={{ width: 640, margin: 'auto', pt: 3, pb: 4 }}>
      <Stack spacing={2} sx={{ mb: 2 }}>
        <Stack direction='row' spacing={1} alignItems='center'>
          <Typography variant='subtitle1' fontWeight='bold'>
            对象存储配置
          </Typography>
          <Chip
            size='small'
            label={`配置来源：${sourceLabel(detail?.source)}`}
            color={detail?.source === 'database' ? 'primary' : 'default'}
            variant='outlined'
          />
          <Chip
            size='small'
            label={detail?.ready ? '存储可用' : '存储不可用'}
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
              恢复默认
            </Button>
          )}
        </Stack>
        <Typography variant='body2' color='text.secondary'>
          全局配置，影响所有知识库的文件上传。支持任意 S3
          兼容存储（MinIO、阿里云 OSS 等）；未配置时使用内置 MinIO 默认值。
        </Typography>
        {detail?.error && (
          <Alert severity='error'>存储连接异常：{detail.error}</Alert>
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
