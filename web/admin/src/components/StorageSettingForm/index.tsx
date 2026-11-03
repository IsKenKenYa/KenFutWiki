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

const STORAGE_PROVIDERS = [
  {
    value: 'minio',
    label: 'MinIO（默认）',
    endpoint: 'panda-wiki-minio:9000',
    region: 'us-east-1',
    secure: false,
  },
  {
    value: 'aliyun_oss',
    label: '阿里云 OSS',
    endpoint: 'oss-cn-hangzhou.aliyuncs.com',
    region: 'oss-cn-hangzhou',
    secure: true,
  },
  { value: 'custom', label: '自定义 S3 兼容存储' },
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
      message.error('请填写服务地址 Endpoint');
      return null;
    }
    if (!accessKey.trim()) {
      message.error('请填写 Access Key');
      return null;
    }
    const normalizedPublicUrl = publicUrl.trim().replace(/\/+$/, '');
    if (normalizedPublicUrl && !/^https?:\/\//i.test(normalizedPublicUrl)) {
      message.error('公网访问地址需以 http:// 或 https:// 开头');
      return null;
    }
    const normalizedBucket = bucket.trim() || 'static-file';
    // 站点反代按默认桶名前缀 /static-file/* 转发，自定义桶名只能走公网地址直连
    if (normalizedBucket !== 'static-file' && !normalizedPublicUrl) {
      message.error('使用非默认桶名时必须填写公网访问地址');
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
      message.error('请填写 Secret Key');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await postApiV1StorageTest(request);
      setTestResult(res);
      if (res.ok) {
        message.success('存储连接测试通过');
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
      message.error('请填写 Secret Key');
      return;
    }
    Modal.confirm({
      title: '保存存储配置',
      content:
        '保存后新上传的文件将写入新存储，历史文件不会迁移；其他进程最迟约 1 分钟内自动生效。确定保存？',
      onOk: async () => {
        setSaving(true);
        try {
          const res = await postApiV1StorageSetting(request);
          message.success('存储配置已保存');
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
        label='存储类型'
        value={provider}
        onChange={e => handleProviderChange(e.target.value as ProviderValue)}
      >
        {STORAGE_PROVIDERS.map(p => (
          <MenuItem key={p.value} value={p.value}>
            {p.label}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label='服务地址 Endpoint'
        placeholder='例如 oss-cn-hangzhou.aliyuncs.com（不含协议）'
        value={endpoint}
        onChange={e => setEndpoint(e.target.value)}
      />
      <TextField
        label='Access Key'
        value={accessKey}
        onChange={e => setAccessKey(e.target.value)}
      />
      <TextField
        label={detail?.secret_set ? 'Secret Key（留空保持不变）' : 'Secret Key'}
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
          label='存储桶 Bucket'
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
        label='公网访问地址（可选）'
        placeholder='例如 https://bucket.oss-cn-hangzhou.aliyuncs.com'
        value={publicUrl}
        onChange={e => setPublicUrl(e.target.value)}
        helperText='填写后文件 URL 直接指向该地址；留空则经由站点反代路径访问'
      />
      <Stack direction='row' spacing={2} alignItems='center'>
        <Tooltip title='存储桶不存在时自动创建；云厂商请在控制台预先创建并开放公共读'>
          <Typography variant='body2' sx={{ cursor: 'help' }}>
            桶不存在时自动创建
          </Typography>
        </Tooltip>
        <Button
          size='small'
          variant={autoBucket ? 'contained' : 'outlined'}
          onClick={() => setAutoBucket(prev => !prev)}
        >
          {autoBucket ? '已开启' : '已关闭'}
        </Button>
        <Tooltip title='通过 HTTPS 访问存储服务（云厂商一般为开启）'>
          <Typography variant='body2' sx={{ cursor: 'help' }}>
            HTTPS
          </Typography>
        </Tooltip>
        <Button
          size='small'
          variant={secure ? 'contained' : 'outlined'}
          onClick={() => setSecure(prev => !prev)}
        >
          {secure ? '已开启' : '已关闭'}
        </Button>
      </Stack>

      {testResult && (
        <Alert severity={testResult.ok ? 'success' : 'error'}>
          {(testResult.steps ?? []).map((step, i) => (
            <div key={i}>
              {step.ok ? '✓' : '✗'} {step.name}
              {step.message ? `：${step.message}` : ''}
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
            {testing ? '测试中…' : '测试连接'}
          </Button>
          <Button
            variant='contained'
            onClick={handleSave}
            disabled={testing || saving}
          >
            {saving ? '保存中…' : '保存配置'}
          </Button>
        </Stack>
      )}
    </Stack>
  );
});

export default StorageSettingForm;
