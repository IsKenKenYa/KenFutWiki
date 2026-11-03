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

const StepStorage = forwardRef<{ onSubmit: () => Promise<void> }>(
  (_props, ref) => {
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
          message.error('请填写 Secret Key');
          return Promise.reject(new Error('secret key required'));
        }
        await postApiV1StorageSetting(request);
        message.success('存储配置已保存');
      },
    }));

    return (
      <Box sx={{ pt: 1 }}>
        <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
          系统默认使用内置 MinIO 存储上传的文件。你也可以切换到阿里云 OSS 等任意
          S3 兼容对象存储；此步骤可跳过，之后在「系统设置 →
          存储配置」中随时修改。
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
            使用默认存储（推荐，无需配置）
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
