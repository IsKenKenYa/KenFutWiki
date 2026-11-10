import {
  DomainStorageSetting,
  DomainStorageSettingDetail,
  DomainStorageTestResult,
} from '@/request/types';
import {
  postApiV1StorageSetting,
  postApiV1StorageTest,
} from '@/request/Storage';
import { Modal, message } from '@ctzhian/ui';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import {
  Alert,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  forwardRef,
  useImperativeHandle,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';

// 供应商预设：label 为 i18n key，渲染时翻译
const STORAGE_PROVIDERS = [
  {
    value: 'minio',
    label: 'storage.providerMinio',
    endpoint: 'panda-wiki-minio:9000',
    region: 'us-east-1',
    secure: false,
  },
  {
    value: 'aliyun_oss',
    label: 'storage.providerOss',
    endpoint: 'oss-cn-hangzhou.aliyuncs.com',
    region: 'oss-cn-hangzhou',
    secure: true,
  },
  { value: 'custom', label: 'storage.providerCustom' },
] as const;

type ProviderValue = (typeof STORAGE_PROVIDERS)[number]['value'];

const providerPresetEndpoints: string[] = STORAGE_PROVIDERS.map(p =>
  'endpoint' in p ? p.endpoint : '',
).filter(Boolean);

export type StorageSettingFormRef = {
  // 校验并构造保存/测试用的请求体；校验失败时提示错误并返回 null
  buildRequest: () => DomainStorageSetting | null;
};

type StorageSettingFormProps = {
  // 当前生效配置（回填默认值）；为空时使用内置 MinIO 预设
  detail?: DomainStorageSettingDetail | null;
  // 显示「测试连接/保存」操作按钮（设置页 true，向导步骤 false 由外部触发）
  showActions?: boolean;
  onSaved?: (detail: DomainStorageSettingDetail) => void;
  extra?: ReactNode;
};

const StorageSettingForm = forwardRef<
  StorageSettingFormRef,
  StorageSettingFormProps
>(({ detail, showActions = true, onSaved, extra }, ref) => {
  const { t } = useTranslation();
  const initial = detail?.setting ?? {};
  const [provider, setProvider] = useState<ProviderValue>(
    (initial.provider as ProviderValue) ?? 'minio',
  );
  const [endpoint, setEndpoint] = useState(initial.endpoint ?? '');
  const [accessKey, setAccessKey] = useState(initial.access_key ?? '');
  const [secretKey, setSecretKey] = useState('');
  const [bucket, setBucket] = useState(initial.bucket ?? 'static-file');
  const [region, setRegion] = useState(initial.region ?? 'us-east-1');
  const [secure, setSecure] = useState(initial.secure ?? false);
  const [publicUrl, setPublicUrl] = useState(initial.public_url ?? '');
  const [autoBucket, setAutoBucket] = useState(initial.auto_bucket ?? true);
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<DomainStorageTestResult | null>(
    null,
  );

  const handleProviderChange = (next: ProviderValue) => {
    const preset = STORAGE_PROVIDERS.find(p => p.value === next);
    setProvider(next);
    if (preset && 'endpoint' in preset) {
      // 仅当用户未自定义过 endpoint/region 时跟随预设切换
      if (!endpoint || providerPresetEndpoints.includes(endpoint)) {
        setEndpoint(preset.endpoint ?? '');
      }
      if (!region || region === 'us-east-1' || region.startsWith('oss-')) {
        setRegion(preset.region ?? 'us-east-1');
      }
      setSecure(preset.secure ?? false);
    }
  };

  const buildRequest = () => {
    let normalizedEndpoint = endpoint.trim();
    let normalizedSecure = secure;
    // 用户粘贴完整 URL 时自动剥离协议并推导 HTTPS
    const urlMatch = normalizedEndpoint.match(/^(https?):\/\/(.+)$/i);
    if (urlMatch) {
      normalizedSecure = urlMatch[1].toLowerCase() === 'https';
      normalizedEndpoint = urlMatch[2].replace(/\/+$/, '');
    }
    if (!normalizedEndpoint) {
      message.error(t('storage.endpointRequired'));
      return null;
    }
    if (!accessKey.trim()) {
      message.error(t('storage.accessKeyRequired'));
      return null;
    }
    const normalizedPublicUrl = publicUrl.trim().replace(/\/+$/, '');
    if (normalizedPublicUrl && !/^https?:\/\//i.test(normalizedPublicUrl)) {
      message.error(t('storage.publicUrlInvalid'));
      return null;
    }
    const normalizedBucket = bucket.trim() || 'static-file';
    // 站点反代按默认桶名前缀 /static-file/* 转发，自定义桶名只能走公网地址直连
    if (normalizedBucket !== 'static-file' && !normalizedPublicUrl) {
      message.error(t('storage.publicUrlRequiredForBucket'));
      return null;
    }
    return {
      provider,
      endpoint: normalizedEndpoint,
      access_key: accessKey.trim(),
      // 留空 = 沿用已保存的 secret（后端处理），新建配置时必须填写
      secret_key: secretKey.trim() || (detail?.secret_set ? '******' : ''),
      bucket: normalizedBucket,
      region: region.trim() || 'us-east-1',
      secure: normalizedSecure,
      public_url: normalizedPublicUrl,
      auto_bucket: autoBucket,
    };
  };

  useImperativeHandle(ref, () => ({ buildRequest }));

  const handleTest = async () => {
    const request = buildRequest();
    if (!request) return;
    if (!secretKey.trim() && !detail?.secret_set) {
      message.error(t('storage.secretRequired'));
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await postApiV1StorageTest(request);
      setTestResult(res);
      if (res.ok) {
        message.success(t('storage.testPassed'));
      }
    } catch {
      // request 封装已弹错
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    const request = buildRequest();
    if (!request) return;
    if (!secretKey.trim() && !detail?.secret_set) {
      message.error(t('storage.secretRequired'));
      return;
    }
    Modal.confirm({
      title: t('storage.saveTitle'),
      content: t('storage.saveContent'),
      onOk: async () => {
        setSaving(true);
        try {
          const res = await postApiV1StorageSetting(request);
          message.success(t('storage.saved'));
          onSaved?.(res);
        } catch {
          // request 封装已弹错
        } finally {
          setSaving(false);
        }
      },
    });
  };

  return (
    <Stack spacing={2}>
      {extra}
      <TextField
        select
        label={t('storage.typeLabel')}
        value={provider}
        onChange={e => handleProviderChange(e.target.value as ProviderValue)}
      >
        {STORAGE_PROVIDERS.map(p => (
          <MenuItem key={p.value} value={p.value}>
            {t(p.label)}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label={t('storage.endpointLabel')}
        placeholder={t('storage.endpointPlaceholder')}
        value={endpoint}
        onChange={e => setEndpoint(e.target.value)}
      />
      <TextField
        label='Access Key'
        value={accessKey}
        onChange={e => setAccessKey(e.target.value)}
      />
      <TextField
        label={
          detail?.secret_set ? t('storage.secretKeepPlaceholder') : 'Secret Key'
        }
        type={showSecret ? 'text' : 'password'}
        value={secretKey}
        onChange={e => setSecretKey(e.target.value)}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position='end'>
                <IconButton
                  onClick={() => setShowSecret(prev => !prev)}
                  edge='end'
                  size='small'
                >
                  {showSecret ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
      <Stack direction='row' spacing={2}>
        <TextField
          fullWidth
          label={t('storage.bucketLabel')}
          value={bucket}
          onChange={e => setBucket(e.target.value)}
        />
        <TextField
          fullWidth
          label='Region'
          value={region}
          onChange={e => setRegion(e.target.value)}
        />
      </Stack>
      <TextField
        label={t('storage.publicUrlLabel')}
        placeholder='https://bucket.oss-cn-hangzhou.aliyuncs.com'
        value={publicUrl}
        onChange={e => setPublicUrl(e.target.value)}
        helperText={t('storage.publicUrlHint')}
      />
      <Stack direction='row' spacing={2} alignItems='center'>
        <Tooltip title={t('storage.autoBucketHint')}>
          <Typography variant='body2' sx={{ cursor: 'help' }}>
            {t('storage.autoBucketLabel')}
          </Typography>
        </Tooltip>
        <Button
          size='small'
          variant={autoBucket ? 'contained' : 'outlined'}
          onClick={() => setAutoBucket(prev => !prev)}
        >
          {autoBucket ? t('storage.on') : t('storage.off')}
        </Button>
        <Tooltip title={t('storage.secureHint')}>
          <Typography variant='body2' sx={{ cursor: 'help' }}>
            HTTPS
          </Typography>
        </Tooltip>
        <Button
          size='small'
          variant={secure ? 'contained' : 'outlined'}
          onClick={() => setSecure(prev => !prev)}
        >
          {secure ? t('storage.on') : t('storage.off')}
        </Button>
      </Stack>

      {testResult && (
        <Alert severity={testResult.ok ? 'success' : 'error'}>
          {(testResult.steps ?? []).map((step, i) => (
            <div key={i}>
              {step.ok ? '✓' : '✗'}{' '}
              {step.message
                ? t('storage.testStepMessage', {
                    name: step.name,
                    message: step.message,
                  })
                : step.name}
            </div>
          ))}
          {(testResult.warnings ?? []).map((w, i) => (
            <div key={`w-${i}`}>⚠ {w}</div>
          ))}
        </Alert>
      )}

      {showActions && (
        <Stack direction='row' spacing={2}>
          <Button
            variant='outlined'
            onClick={handleTest}
            disabled={testing || saving}
            startIcon={testing ? <CircularProgress size={16} /> : undefined}
          >
            {testing ? t('model.testing') : t('model.testConnection')}
          </Button>
          <Button
            variant='contained'
            onClick={handleSave}
            disabled={testing || saving}
          >
            {saving ? t('model.saving') : t('storage.saveAction')}
          </Button>
        </Stack>
      )}
    </Stack>
  );
});

export default StorageSettingForm;
