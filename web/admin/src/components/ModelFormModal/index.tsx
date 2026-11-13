import { getModelNameList, testModel, createModel, updateModel } from '@/api';
import type {
  CreateModelData,
  DomainModelParam,
  ModelListItem,
} from '@/api/type';
import { ModelProvider } from '@/constant/enums';
import type { ModelMeta } from '@/utils/modelResolve';
import { presetModelIds, resolveModelMeta } from '@/utils/modelResolve';
import { Modal, message } from '@ctzhian/ui';
import {
  Alert,
  Autocomplete,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Link,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/store';

export type ModelFormType =
  | 'chat'
  | 'embedding'
  | 'rerank'
  | 'analysis'
  | 'analysis-vl';

// 类型名存 i18n key
const TYPE_LABEL: Record<ModelFormType, string> = {
  chat: 'model.typeChat',
  embedding: 'model.typeEmbedding',
  rerank: 'model.typeRerank',
  analysis: 'model.typeAnalysis',
  'analysis-vl': 'model.typeAnalysisVl',
};

const CONTEXT_PRESETS = [128000, 262144, 524288, 1048576];

// 枚举各条目能力字段不统一（部分 provider 缺 embedding/rerank 等字段），统一视图
interface ProviderConf {
  label: string;
  cn: string;
  urlWrite?: boolean;
  secretRequired?: boolean;
  customHeader?: boolean;
  chat?: boolean;
  embedding?: boolean;
  rerank?: boolean;
  analysis?: boolean;
  modelDocumentUrl?: string;
  defaultBaseUrl?: string;
  /** 自定义供应商：由用户命名并手填 Base URL */
  custom?: boolean;
}

const PROVIDERS = ModelProvider as unknown as Record<string, ProviderConf>;

// 自定义 Base URL 的服务商补 /v1 后缀（保留 # 结尾、显式版本号、火山 v3 等原样）
const processedBaseUrl = (baseUrl: string, conf: ProviderConf | null) => {
  let url = baseUrl.trim();
  if (!conf?.urlWrite || url.endsWith('#')) return url;
  if (url.endsWith('/')) url = url.slice(0, -1);
  if (/\/v\d+$/.test(url) || url.endsWith('volces.com/api/v3')) return url;
  return `${url}/v1`;
};

interface ModelFormModalProps {
  open: boolean;
  model_type: ModelFormType;
  data: ModelListItem | null;
  onClose: () => void;
  refresh: () => void | Promise<void>;
}

const ModelFormModal = ({
  open,
  model_type,
  data,
  onClose,
  refresh,
}: ModelFormModalProps) => {
  const { t, i18n } = useTranslation();
  const isEdit = !!data?.id;

  const [provider, setProvider] = useState<string>('');
  const [providerName, setProviderName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [headerKey, setHeaderKey] = useState('');
  const [headerValue, setHeaderValue] = useState('');
  const [apiVersion, setApiVersion] = useState('');
  const [modelName, setModelName] = useState('');
  const [showName, setShowName] = useState('');
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);
  const [meta, setMeta] = useState<ModelMeta | null>(null);
  const [metaApplied, setMetaApplied] = useState(false);
  // 选择已有配置的同供应商时自动带出连接信息，提示用户来源
  const [reusedFrom, setReusedFrom] = useState<string>('');

  const [contextWindow, setContextWindow] = useState<string>('');
  const [maxOutput, setMaxOutput] = useState<string>('');
  const [supportImage, setSupportImage] = useState(false);
  const [temperature, setTemperature] = useState('');

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<null | {
    ok: boolean;
    msg: string;
  }>(null);
  const [saving, setSaving] = useState(false);

  // 用户手动改过的高级字段不再被自动填充覆盖；切换模型后重置
  const touchedRef = useRef<Set<string>>(new Set());
  // 上一次自动填充的显示名，用于模型切换时跟随刷新（用户手填过则不覆盖）
  const lastAutoName = useRef('');
  const touch = (field: string) => touchedRef.current.add(field);

  const providerConf = provider ? (PROVIDERS[provider] ?? null) : null;
  const isCustomProvider = !!providerConf?.custom;

  // 已保存的模型列表：用于同供应商凭证复用
  const { modelList } = useAppSelector(state => state.config);

  // 按 model_type 过滤可用 provider
  const availableProviders = Object.entries(PROVIDERS).filter(([, conf]) => {
    if (model_type === 'embedding') return conf.embedding;
    if (model_type === 'rerank') return conf.rerank;
    if (model_type === 'analysis' || model_type === 'analysis-vl')
      return conf.analysis || conf.chat;
    return conf.chat;
  });

  useEffect(() => {
    if (!open) return;
    touchedRef.current = new Set();
    setMeta(null);
    setMetaApplied(false);
    setModelOptions([]);
    setTestResult(null);
    setAdvancedOpen(false);
    setReusedFrom('');
    if (data) {
      setProvider((data.provider as string) ?? '');
      setProviderName(
        (data as never as { provider_name?: string }).provider_name ?? '',
      );
      setBaseUrl(data.base_url ?? '');
      setApiKey(data.api_key ?? '');
      const header = (data.api_header ?? '').split(':');
      setHeaderKey(header.length > 1 ? header[0] : '');
      setHeaderValue(header.length > 1 ? header.slice(1).join(':') : '');
      setApiVersion(data.api_version ?? '');
      setModelName(data.model ?? '');
      setShowName((data as never as { show_name?: string }).show_name ?? '');
      const p = data.parameters ?? {};
      setContextWindow(p.context_window ? String(p.context_window) : '');
      setMaxOutput(p.max_tokens ? String(p.max_tokens) : '');
      setSupportImage(!!p.support_images);
      setTemperature(p.temperature != null ? String(p.temperature) : '');
    } else {
      setProvider('');
      setProviderName('');
      setBaseUrl('');
      setApiKey('');
      setHeaderKey('');
      setHeaderValue('');
      setApiVersion('');
      setModelName('');
      setShowName('');
      setContextWindow('');
      setMaxOutput('');
      setSupportImage(model_type === 'analysis-vl');
      setTemperature('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data]);

  // 从已保存的同供应商模型带出连接信息（仅新建模式，且对应字段为空时）
  const reuseCredentials = (next: string) => {
    if (isEdit) return;
    const saved = (modelList ?? []).find(
      it => it.provider === next && (it.base_url || it.api_key),
    );
    if (!saved) {
      setReusedFrom('');
      return;
    }
    setReusedFrom(saved.show_name || saved.model || '');
    if (!baseUrl && saved.base_url) setBaseUrl(saved.base_url);
    if (!apiKey && saved.api_key) setApiKey(saved.api_key);
    if (!headerKey && !headerValue && saved.api_header) {
      const header = saved.api_header.split(':');
      setHeaderKey(header.length > 1 ? header[0] : '');
      setHeaderValue(header.length > 1 ? header.slice(1).join(':') : '');
    }
    if (!apiVersion && saved.api_version) setApiVersion(saved.api_version);
  };

  const handleProviderChange = (next: string) => {
    setProvider(next);
    setProviderName('');
    setReusedFrom('');
    const conf = PROVIDERS[next];
    if (!conf) {
      setModelOptions([]);
      return;
    }
    const prevConf = provider ? PROVIDERS[provider] : null;
    // 之前是默认值或为空时跟随切换，用户自定义过则保留
    if (!baseUrl || (prevConf && baseUrl === prevConf.defaultBaseUrl)) {
      setBaseUrl(conf.defaultBaseUrl ?? '');
    }
    // 内置目录有该厂商的预设模型时直接预填下拉（仍可通过「获取模型列表」拉实时列表覆盖）
    setModelOptions(presetModelIds(next, model_type));
    // 同供应商已有保存过的模型时自动带出连接信息（用户改过则不覆盖）
    reuseCredentials(next);
  };

  // 模型 id 变化 → 元数据识别与自动填充
  useEffect(() => {
    if (!modelName) {
      setMeta(null);
      setMetaApplied(false);
      return;
    }
    const timer = setTimeout(() => {
      const m = resolveModelMeta(modelName);
      setMeta(m);
      setMetaApplied(!!m);
      if (m) {
        if (!touchedRef.current.has('cw') && m.contextWindow != null) {
          setContextWindow(String(m.contextWindow));
        }
        if (!touchedRef.current.has('mo') && m.maxOutputTokens != null) {
          setMaxOutput(String(m.maxOutputTokens));
        }
        if (!touchedRef.current.has('img')) {
          setSupportImage(!!m.supportsImage || model_type === 'analysis-vl');
        }
        if (
          !touchedRef.current.has('name') &&
          (!showName || showName === lastAutoName.current)
        ) {
          lastAutoName.current = m.name ?? '';
          setShowName(m.name ?? '');
        }
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelName]);

  const handleFetchModels = async () => {
    if (!baseUrl.trim()) {
      message.error(t('model.baseUrlFirst'));
      return;
    }
    setFetching(true);
    try {
      const res = await getModelNameList({
        type: model_type,
        provider: provider as CreateModelData['provider'],
        api_header: headerKey ? `${headerKey}:${headerValue}` : '',
        api_key: apiKey,
        base_url: processedBaseUrl(baseUrl, providerConf),
      });
      const models = (res?.models ?? []).map((m: { model: string }) => m.model);
      setModelOptions(models);
      if (models.length === 0) {
        message.warning(t('model.fetchEmpty'));
      } else {
        message.success(t('model.fetchSuccess', { count: models.length }));
      }
    } catch {
      // request 封装已弹错
    } finally {
      setFetching(false);
    }
  };

  const buildPayload = () => {
    const parameters: DomainModelParam = {};
    if (contextWindow) parameters.context_window = Number(contextWindow);
    if (maxOutput) parameters.max_tokens = Number(maxOutput);
    if (supportImage) parameters.support_images = true;
    if (temperature !== '') parameters.temperature = Number(temperature);
    return {
      type: model_type,
      provider: provider as CreateModelData['provider'],
      ...(isCustomProvider && providerName.trim()
        ? { provider_name: providerName.trim() }
        : {}),
      api_header: headerKey ? `${headerKey}:${headerValue}` : '',
      api_key: apiKey.trim(),
      base_url: processedBaseUrl(baseUrl, providerConf),
      model: modelName.trim(),
      ...(showName.trim() ? { show_name: showName.trim() } : {}),
      ...(apiVersion.trim() ? { api_version: apiVersion.trim() } : {}),
      parameters,
    };
  };

  const validate = (): string | null => {
    if (!provider) return t('model.selectProvider');
    if (!baseUrl.trim()) return t('model.baseUrlRequired');
    if (providerConf?.secretRequired !== false && !apiKey.trim() && !isEdit)
      return t('model.apiKeyRequired');
    if (!modelName.trim()) return t('model.modelIdRequired');
    if (contextWindow && !/^\d+$/.test(contextWindow.trim()))
      return t('model.contextNumber');
    if (maxOutput && !/^\d+$/.test(maxOutput.trim()))
      return t('model.maxOutputNumber');
    if (temperature !== '' && Number.isNaN(Number(temperature)))
      return t('model.temperatureNumber');
    return null;
  };

  const handleTest = async () => {
    const err = validate();
    if (err) {
      message.error(err);
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      await testModel(buildPayload() as never);
      setTestResult({ ok: true, msg: t('model.testSuccess') });
    } catch (e) {
      setTestResult({
        ok: false,
        msg: e instanceof Error ? e.message : t('model.testFailed'),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      message.error(err);
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      await testModel(payload as never);
      if (isEdit && data?.id) {
        await updateModel({ id: data.id, ...payload } as never);
      } else {
        await createModel(payload);
      }
      message.success(isEdit ? t('model.updated') : t('model.added'));
      await refresh();
    } catch {
      // request 封装已弹错
    } finally {
      setSaving(false);
    }
  };

  const metaChip =
    metaApplied && meta ? (
      <Alert severity='success'>
        {t('model.recognized', { name: meta.name ?? meta.id })}
        {meta.contextWindow
          ? t('model.metaContext', {
              size: Math.round(meta.contextWindow / 1024),
            })
          : ''}
        {meta.maxOutputTokens
          ? t('model.metaMaxOutput', {
              size:
                Math.round(meta.maxOutputTokens / 1024) || meta.maxOutputTokens,
            })
          : ''}
        {meta.supportsImage ? t('model.metaImage') : ''}
        {t('model.metaEditable')}
      </Alert>
    ) : modelName ? (
      <Alert severity='info'>{t('model.notInCatalog')}</Alert>
    ) : null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t(isEdit ? 'model.editTitle' : 'model.addTitle', {
        type: t(TYPE_LABEL[model_type]),
      })}
      width={640}
      okText={saving ? t('model.saving') : t('common.save')}
      okButtonProps={{ loading: saving }}
      onOk={handleSave}
      footer={
        <Stack
          direction='row'
          spacing={2}
          justifyContent='flex-end'
          sx={{ px: 3, pt: 2, pb: 3 }}
        >
          <Button onClick={handleTest} disabled={testing || saving}>
            {testing ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
            {testing ? t('model.testing') : t('model.testConnection')}
          </Button>
          <Button
            variant='contained'
            onClick={handleSave}
            disabled={testing || saving}
          >
            {saving ? t('model.saving') : t('common.save')}
          </Button>
        </Stack>
      }
    >
      <Stack spacing={2} sx={{ pt: 1, maxHeight: '65vh', overflow: 'auto' }}>
        <TextField
          select
          label={t('model.providerLabel')}
          value={provider}
          onChange={e => handleProviderChange(e.target.value)}
          size='small'
        >
          {availableProviders.map(([key, conf]) => (
            <MenuItem key={key} value={key}>
              {(i18n.language?.startsWith('zh') ? conf.cn : conf.label) ||
                conf.label ||
                conf.cn ||
                key}
            </MenuItem>
          ))}
        </TextField>

        {isCustomProvider && (
          <TextField
            size='small'
            label={t('model.providerNameLabel')}
            placeholder={t('model.providerNamePlaceholder')}
            value={providerName}
            onChange={e => setProviderName(e.target.value)}
          />
        )}

        {reusedFrom && !isEdit && (
          <Alert severity='info'>
            {t('model.reusedCredentials', { model: reusedFrom })}
          </Alert>
        )}

        <Stack direction='row' spacing={2}>
          <TextField
            fullWidth
            size='small'
            label='Base URL'
            placeholder={
              providerConf?.defaultBaseUrl ||
              (isCustomProvider
                ? 'https://your-endpoint.example.com/v1'
                : 'https://api.deepseek.com/v1')
            }
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
          />
          <Button
            size='small'
            variant='outlined'
            onClick={handleFetchModels}
            disabled={fetching}
            sx={{ flexShrink: 0, height: 40 }}
          >
            {fetching ? <CircularProgress size={16} /> : t('model.fetchList')}
          </Button>
        </Stack>

        <TextField
          size='small'
          label='API Key'
          type={showKey ? 'text' : 'password'}
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position='end'>
                  <IconButton
                    onClick={() => setShowKey(p => !p)}
                    edge='end'
                    size='small'
                  >
                    {showKey ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />

        {providerConf?.modelDocumentUrl && (
          <Link
            href={providerConf.modelDocumentUrl}
            target='_blank'
            rel='noreferrer'
            sx={{ fontSize: 14, alignSelf: 'flex-start' }}
          >
            {t('model.getApiKey', {
              provider:
                (i18n.language?.startsWith('zh')
                  ? providerConf.cn
                  : providerConf.label) ||
                providerConf.label ||
                providerConf.cn ||
                provider,
            })}
          </Link>
        )}

        <Autocomplete
          freeSolo
          size='small'
          options={modelOptions}
          value={modelName}
          onInputChange={(_, v) => setModelName(v ?? '')}
          renderInput={params => (
            <TextField
              {...params}
              label={t('model.modelIdLabel')}
              placeholder={t('model.modelIdPlaceholder')}
            />
          )}
        />
        {metaChip}

        <TextField
          size='small'
          label={t('model.showNameLabel')}
          placeholder={meta?.name ?? t('model.showNamePlaceholder')}
          value={showName}
          onChange={e => {
            touch('name');
            setShowName(e.target.value);
          }}
        />

        <Divider>
          <Button
            size='small'
            onClick={() => setAdvancedOpen(p => !p)}
            endIcon={
              <ExpandMore
                sx={{
                  transform: advancedOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform .2s',
                }}
              />
            }
          >
            {t('model.advanced')}
          </Button>
        </Divider>

        {/* flexShrink:0——父 Stack 是 flex 列容器，内容超高时 Collapse 会被收缩，
            溢出内容叠到底部提示上（文字错层）；禁止收缩让容器出现滚动条 */}
        <Collapse in={advancedOpen} sx={{ flexShrink: 0 }}>
          <Stack spacing={2}>
            <Stack direction='row' spacing={1} alignItems='center'>
              <TextField
                size='small'
                label={t('model.contextLabel')}
                placeholder='128000'
                value={contextWindow}
                onChange={e => {
                  touch('cw');
                  setContextWindow(e.target.value);
                }}
                sx={{ width: 220 }}
              />
              {CONTEXT_PRESETS.map(p => (
                <Chip
                  key={p}
                  label={p >= 1048576 ? `${p / 1048576}M` : `${p / 1024}K`}
                  size='small'
                  variant={contextWindow === String(p) ? 'filled' : 'outlined'}
                  onClick={() => {
                    touch('cw');
                    setContextWindow(String(p));
                  }}
                />
              ))}
            </Stack>
            <TextField
              size='small'
              label={t('model.maxOutputLabel')}
              placeholder='8192'
              value={maxOutput}
              onChange={e => {
                touch('mo');
                setMaxOutput(e.target.value);
              }}
              sx={{ width: 220 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={supportImage}
                  onChange={e => {
                    touch('img');
                    setSupportImage(e.target.checked);
                  }}
                />
              }
              label={t('model.imageSupport')}
            />
            <TextField
              size='small'
              label={t('model.temperatureLabel')}
              placeholder='0.7'
              value={temperature}
              onChange={e => setTemperature(e.target.value)}
              sx={{ width: 220 }}
            />
            {providerConf?.customHeader && (
              <Stack direction='row' spacing={2}>
                <TextField
                  size='small'
                  label={t('model.headerKeyLabel')}
                  value={headerKey}
                  onChange={e => setHeaderKey(e.target.value)}
                />
                <TextField
                  fullWidth
                  size='small'
                  label={t('model.headerValueLabel')}
                  value={headerValue}
                  onChange={e => setHeaderValue(e.target.value)}
                />
              </Stack>
            )}
            {provider === 'AzureOpenAI' && (
              <Tooltip title={t('model.apiVersionHint')}>
                <TextField
                  size='small'
                  label='API Version'
                  value={apiVersion}
                  onChange={e => setApiVersion(e.target.value)}
                  sx={{ width: 220 }}
                />
              </Tooltip>
            )}
          </Stack>
        </Collapse>

        {testResult && (
          <Alert severity={testResult.ok ? 'success' : 'error'}>
            {testResult.msg}
          </Alert>
        )}
        <Typography variant='caption' color='text.secondary'>
          {t('model.saveHint')}
        </Typography>
      </Stack>
    </Modal>
  );
};

export default ModelFormModal;
