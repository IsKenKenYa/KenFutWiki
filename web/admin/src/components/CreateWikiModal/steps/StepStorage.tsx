import StorageSettingForm from '@/components/StorageSettingForm';
import {
  getApiV1StorageSetting,
  postApiV1StorageSetting,
} from '@/request/Storage';
import {
  DomainStorageSetting,
  DomainStorageSettingDetail,
} from '@/request/types';
import { message } from '@ctzhian/ui';
import { Box, Stack, Typography } from '@mui/material';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

const StepStorage = forwardRef<{ onSubmit: () => Promise<void> }>(
  (_props, ref) => {
    const { t } = useTranslation();
    const [useDefault, setUseDefault] = useState(true);
    const [detail, setDetail] = useState<DomainStorageSettingDetail | null>(
      null,
    );
    const formRef = useRef<{ buildRequest: () => DomainStorageSetting | null }>(
      null,
    );

    useEffect(() => {
      getApiV1StorageSetting()
        .then(res => setDetail(res))
        .catch(() => {
          // request 封装已弹错，保持默认存储即可
        });
    }, []);

    useImperativeHandle(ref, () => ({
      onSubmit: async () => {
        if (useDefault) return;
        const request = formRef.current?.buildRequest();
        if (!request) {
          return Promise.reject(new Error('storage form invalid'));
        }
        // 安装向导中未保存过配置时 secret 必须显式填写
        if (!request.secret_key) {
          message.error(t('storage.secretRequired'));
          return Promise.reject(new Error('secret key required'));
        }
        await postApiV1StorageSetting(request);
        message.success(t('storage.saved'));
      },
    }));

    return (
      <Box sx={{ pt: 1 }}>
        <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
          {t('wizard.storageHint')}
        </Typography>
        <Stack
          direction='row'
          spacing={1}
          alignItems='center'
          sx={{ mb: 2, cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setUseDefault(prev => !prev)}
        >
          <Box
            onClick={() => setUseDefault(prev => !prev)}
            sx={{
              width: 18,
              height: 18,
              borderRadius: '4px',
              border: '1px solid',
              borderColor: useDefault ? 'primary.main' : 'divider',
              backgroundColor: useDefault ? 'primary.main' : 'transparent',
              color: '#fff',
              fontSize: 13,
              lineHeight: '16px',
              textAlign: 'center',
            }}
          >
            {useDefault ? '✓' : ''}
          </Box>
          <Typography variant='body2'>
            {t('wizard.useDefaultStorage')}
          </Typography>
        </Stack>
        {!useDefault && (
          <StorageSettingForm
            ref={formRef}
            showActions={false}
            detail={detail}
          />
        )}
      </Box>
    );
  },
);

export default StepStorage;
