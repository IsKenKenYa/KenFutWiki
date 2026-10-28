import { useAppSelector } from '@/store';
import { ConstsUserKBPermission } from '@/request/types';
import { message } from '@ctzhian/ui';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import {
  createCredential,
  disableProduct,
  getCredentials,
  getFunnel,
  getProducts,
  revokeCredential,
  saveProduct,
} from './api';
import ContentMetadataEditor from './ContentMetadataEditor';
import PagePicker from './PagePicker';
import type { Credential, Funnel, Product } from './types';
import { formatFunnelRate } from './funnelRates';

const emptyProduct = (): Product => ({
  id: '',
  name: '',
  origin: '',
  enabled: true,
  pages: [],
});
const failure = (error: unknown) =>
  message.error(error instanceof Error ? error.message : '操作失败');

function ProductEditor({
  product,
  onClose,
  onSaved,
}: {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { kb_id } = useAppSelector(state => state.config);
  const [value, setValue] = useState<Product>(emptyProduct());
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (product) setValue({ ...product, pages: product.pages || [] });
  }, [product]);
  const updatePage = (
    index: number,
    patch: Partial<Product['pages'][number]>,
  ) =>
    setValue(current => ({
      ...current,
      pages: current.pages.map((page, position) =>
        position === index ? { ...page, ...patch } : page,
      ),
    }));
  return (
    <Dialog
      open={Boolean(product)}
      onClose={saving ? undefined : onClose}
      fullWidth
      maxWidth='md'
    >
      <DialogTitle>{value.id ? '编辑产品接入' : '登记产品'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity='info'>
            登记页面后，运营可在页面选择器中选择目标；产品凭证只在其服务器使用。
          </Alert>
          <TextField
            label='产品名称'
            value={value.name}
            onChange={event =>
              setValue(current => ({ ...current, name: event.target.value }))
            }
          />
          <TextField
            label='产品 Origin'
            placeholder='https://product.example'
            value={value.origin}
            onChange={event =>
              setValue(current => ({ ...current, origin: event.target.value }))
            }
            helperText='仅协议、域名和端口，不含路径；本地参考产品允许 localhost HTTP'
          />
          <FormControlLabel
            control={
              <Switch
                checked={value.enabled}
                onChange={(_, checked) =>
                  setValue(current => ({ ...current, enabled: checked }))
                }
              />
            }
            label='启用接入'
          />
          <Typography fontWeight='bold'>页面目录</Typography>
          {value.pages.map((page, index) => (
            <Stack
              spacing={1}
              key={index}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                p: 2,
                borderRadius: 2,
              }}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <TextField
                  fullWidth
                  size='small'
                  label='稳定页面键'
                  value={page.key}
                  onChange={event =>
                    updatePage(index, { key: event.target.value })
                  }
                />
                <TextField
                  fullWidth
                  size='small'
                  label='页面名称'
                  value={page.name}
                  onChange={event =>
                    updatePage(index, { name: event.target.value })
                  }
                />
                <Button
                  color='error'
                  onClick={() =>
                    setValue(current => ({
                      ...current,
                      pages: current.pages.filter(
                        (_, position) => position !== index,
                      ),
                    }))
                  }
                >
                  移除
                </Button>
              </Stack>
              <TextField
                size='small'
                label='页面路径'
                placeholder='/workspace'
                value={page.path}
                onChange={event =>
                  updatePage(index, { path: event.target.value })
                }
              />
              <TextField
                size='small'
                label='允许的参数（逗号分隔）'
                placeholder='campaign,template'
                value={page.parameters.join(',')}
                onChange={event =>
                  updatePage(index, {
                    parameters: event.target.value
                      .split(',')
                      .map(key => key.trim())
                      .filter(Boolean),
                  })
                }
              />
            </Stack>
          ))}
          <Button
            onClick={() =>
              setValue(current => ({
                ...current,
                pages: [
                  ...current.pages,
                  { key: '', name: '', path: '/', parameters: [] },
                ],
              }))
            }
          >
            添加页面
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          variant='contained'
          disabled={saving || !value.name.trim() || !value.origin.trim()}
          onClick={async () => {
            if (!kb_id) return;
            setSaving(true);
            try {
              await saveProduct(value, kb_id);
              message.success('产品配置已保存');
              onSaved();
              onClose();
            } catch (error) {
              failure(error);
            } finally {
              setSaving(false);
            }
          }}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function CredentialsDialog({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const { kb_id } = useAppSelector(state => state.config);
  const [keys, setKeys] = useState<Credential[]>([]);
  const [token, setToken] = useState('');
  const [scopes, setScopes] = useState(['conversion:write', 'analytics:read']);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (product && kb_id) {
      const result = await getCredentials(product.id, kb_id);
      setKeys(result.items || []);
    }
  }, [product, kb_id]);
  useEffect(() => {
    setToken('');
    setKeys([]);
    if (product) void load().catch(failure);
  }, [load, product]);
  const close = () => {
    setToken('');
    onClose();
  };
  return (
    <Dialog open={Boolean(product)} onClose={close} fullWidth maxWidth='sm'>
      <DialogTitle>{product?.name} · 服务端凭证</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Alert severity='warning'>
            完整凭证仅在创建后显示一次。保存在产品服务器环境变量中，不放入浏览器或跳转链接。
          </Alert>
          {token && (
            <>
              <TextField
                multiline
                label='新凭证（关闭后不再显示）'
                value={token}
                slotProps={{ input: { readOnly: true } }}
              />
              <Button
                onClick={() =>
                  navigator.clipboard
                    .writeText(token)
                    .then(() => message.success('已复制'))
                    .catch(failure)
                }
              >
                复制凭证
              </Button>
            </>
          )}
          <Stack>
            {['conversion:write', 'analytics:read'].map(scope => (
              <FormControlLabel
                key={scope}
                label={
                  scope === 'conversion:write'
                    ? '回传注册与首次成功事件'
                    : '查询本产品聚合漏斗'
                }
                control={
                  <Checkbox
                    checked={scopes.includes(scope)}
                    onChange={(_, checked) =>
                      setScopes(current =>
                        checked
                          ? [...current, scope]
                          : current.filter(item => item !== scope),
                      )
                    }
                  />
                }
              />
            ))}
          </Stack>
          <Button
            variant='contained'
            disabled={busy || !scopes.length}
            onClick={async () => {
              if (!product || !kb_id) return;
              setBusy(true);
              try {
                const key = await createCredential(product.id, kb_id, scopes);
                setToken(key.token);
                await load();
              } catch (error) {
                failure(error);
              } finally {
                setBusy(false);
              }
            }}
          >
            创建凭证
          </Button>
          <Divider />
          {keys.map(key => (
            <Stack key={key.id} direction='row' spacing={1} alignItems='center'>
              <Box sx={{ flex: 1 }}>
                <Typography variant='body2'>{key.id}</Typography>
                <Typography variant='caption' color='text.secondary'>
                  {key.scopes.join(' · ')}
                </Typography>
              </Box>
              {key.revoked_at ? (
                <Chip label='已撤销' size='small' />
              ) : (
                <Button
                  color='error'
                  disabled={busy}
                  onClick={async () => {
                    if (!product || !kb_id) return;
                    setBusy(true);
                    try {
                      await revokeCredential(product.id, key.id, kb_id);
                      await load();
                      message.success('凭证已撤销');
                    } catch (error) {
                      failure(error);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  撤销
                </Button>
              )}
            </Stack>
          ))}
          {!keys.length && (
            <Typography color='text.secondary'>尚无凭证</Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
}

function FunnelPanel({ products }: { products: Product[] }) {
  const { kb_id } = useAppSelector(state => state.config);
  const [product, setProduct] = useState('');
  const [from, setFrom] = useState(() =>
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
  );
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [node, setNode] = useState('');
  const [cta, setCta] = useState('');
  const [data, setData] = useState<Funnel>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [picker, setPicker] = useState(false);
  const load = async () => {
    if (!kb_id) return;
    setLoading(true);
    setError('');
    const query = new URLSearchParams({
      kb_id,
      from: new Date(`${from}T00:00:00`).toISOString(),
      to: new Date(`${to}T23:59:59.999`).toISOString(),
    });
    if (product) query.set('product_id', product);
    if (node) query.set('node_id', node);
    if (cta) query.set('cta_id', cta);
    try {
      setData(await getFunnel(query));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '统计加载失败');
    } finally {
      setLoading(false);
    }
  };
  return (
    <Stack spacing={3}>
      <Alert severity='info'>
        归因按产品计算：点击后 30 天内最后一次有效
        CTA，注册锁定来源，首次成功生成沿用。浏览和点击来自站点，后两段由产品服务器回传。
      </Alert>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField
          select
          label='产品'
          value={product}
          onChange={event => setProduct(event.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value=''>全部产品</MenuItem>
          {products.map(item => (
            <MenuItem key={item.id} value={item.id}>
              {item.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          type='date'
          label='开始日期'
          value={from}
          onChange={event => setFrom(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          type='date'
          label='结束日期'
          value={to}
          onChange={event => setTo(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Button
          variant='contained'
          disabled={loading || !from || !to || from > to}
          onClick={load}
        >
          {loading ? '查询中' : '查询漏斗'}
        </Button>
      </Stack>
      <Stack direction='row' spacing={1} alignItems='center'>
        <Button onClick={() => setPicker(true)}>选择来源文章</Button>
        {node && <Chip label={node.slice(0, 8)} onDelete={() => setNode('')} />}
        <TextField
          size='small'
          label='CTA ID（可选）'
          value={cta}
          onChange={event => setCta(event.target.value)}
        />
      </Stack>
      {error && <Alert severity='error'>{error}</Alert>}
      {data ? (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(4, 1fr)' },
              gap: 2,
            }}
          >
            {[
              ['文章浏览', data.views, `${data.viewers} 位访客`],
              ['CTA 点击', data.clicks, `${data.clickers} 位访客`],
              [
                '归因注册',
                data.registration_connected ? data.registrations : '未接入',
                data.registration_connected
                  ? '产品内注册账号'
                  : '尚未收到注册服务端事件',
              ],
              [
                '首次成功生成',
                data.generation_connected ? data.first_generations : '未接入',
                data.generation_connected
                  ? '产品内成功账号'
                  : '尚未收到首次成功生成服务端事件',
              ],
            ].map(([label, count, caption]) => (
              <Paper key={String(label)} variant='outlined' sx={{ p: 2 }}>
                <Typography color='text.secondary'>{label}</Typography>
                <Typography variant='h4' sx={{ my: 1 }}>
                  {count ?? 0}
                </Typography>
                <Typography variant='caption'>{caption}</Typography>
              </Paper>
            ))}
          </Box>
          <Stack direction='row' spacing={1} useFlexGap flexWrap='wrap'>
            <Chip
              label={`浏览 → 点击：${formatFunnelRate(data.clickers, data.viewers)}`}
            />
            <Chip
              label={`点击 → 注册：${formatFunnelRate(data.registered_visitors, data.clickers, data.registration_connected)}`}
            />
            <Chip
              label={`注册 → 首次成功：${formatFunnelRate(data.first_generation_visitors, data.registered_visitors, data.registration_connected && data.generation_connected)}`}
            />
          </Stack>
          <Typography variant='body2' color='text.secondary'>
            归因注册访客：
            {data.registration_connected
              ? data.registered_visitors
              : '未接入'}{' '}
            · 首次成功访客：
            {data.generation_connected
              ? data.first_generation_visitors
              : '未接入'}
            。转化率按同一来源访客去重计算，产品账号数单独展示。
          </Typography>
          <Typography color='text.secondary'>
            未归因注册：
            {data.registration_connected
              ? (data.unattributed_registrations ?? 0)
              : '未接入'}{' '}
            · 未归因首次成功生成：
            {data.generation_connected
              ? (data.unattributed_first_generations ?? 0)
              : '未接入'}
          </Typography>
          {!data.conversion_connected && (
            <Alert severity='info'>
              服务端事件尚未全部接入。接入状态按是否收到过对应事件判断，与当前日期范围无关。
            </Alert>
          )}
          <Typography variant='body2' color='text.secondary'>
            浏览次数、去重访客和产品账号为不同口径；未归因事件不会被强行计入文章转化。
          </Typography>
          {data.items && data.items.length > 0 && (
            <Box sx={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {Object.keys(data.items[0]).map(key => (
                      <th key={key} style={{ textAlign: 'left', padding: 8 }}>
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item, index) => (
                    <tr key={index}>
                      {Object.entries(item).map(([key, entry]) => (
                        <td
                          key={key}
                          style={{ padding: 8, borderTop: '1px solid #ddd' }}
                        >
                          {typeof entry === 'boolean'
                            ? entry
                              ? '已接入'
                              : '未接入'
                            : entry}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          )}
        </>
      ) : (
        <Typography color='text.secondary'>
          选择日期和产品后查询。尚未回传事件的产品不代表已经完成转化接入。
        </Typography>
      )}
      <PagePicker
        open={picker}
        nodeOnly
        onClose={() => setPicker(false)}
        onSelect={target => setNode(target.node_id || '')}
      />
    </Stack>
  );
}

export default function Operations() {
  const { kb_id, kbDetail } = useAppSelector(state => state.config);
  const canManage =
    kbDetail.perm === ConstsUserKBPermission.UserKBPermissionFullControl;
  const canEditContent =
    canManage ||
    kbDetail.perm === ConstsUserKBPermission.UserKBPermissionDocManage;
  const canReadAnalytics =
    canManage ||
    kbDetail.perm === ConstsUserKBPermission.UserKBPermissionDataOperate;
  const [tab, setTab] = useState('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [credentials, setCredentials] = useState<Product | null>(null);
  const [error, setError] = useState('');
  const [picker, setPicker] = useState(false);
  const [node, setNode] = useState('');
  const load = useCallback(async () => {
    if (!kb_id) return;
    setError('');
    try {
      const result = await getProducts(kb_id);
      setProducts(result.items || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '加载失败');
    }
  }, [kb_id]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    setTab(canManage ? 'products' : canEditContent ? 'content' : 'funnel');
  }, [kb_id, canManage, canEditContent]);
  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1300, mx: 'auto' }}>
      <Typography variant='h5' fontWeight='bold'>
        内容运营与产品接入
      </Typography>
      <Typography color='text.secondary' sx={{ mt: 1 }}>
        KenFutWiki · 公开内容、多产品跳转与转化分析
      </Typography>
      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ my: 3 }}>
        {canManage && <Tab value='products' label='产品接入' />}
        {canReadAnalytics && <Tab value='funnel' label='转化漏斗' />}
        {canEditContent && <Tab value='content' label='内容运营' />}
      </Tabs>
      {error && (
        <Alert severity='error' sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {canManage && tab === 'products' && (
        <Stack spacing={2}>
          <Stack direction='row' spacing={1}>
            <Button
              variant='contained'
              onClick={() => setEditing(emptyProduct())}
            >
              登记产品
            </Button>
            <Button onClick={load}>刷新</Button>
          </Stack>
          {products.map(product => (
            <Paper key={product.id} variant='outlined' sx={{ p: 2 }}>
              <Stack direction='row' alignItems='center' spacing={1}>
                <Box sx={{ flex: 1 }}>
                  <Typography fontWeight='bold'>
                    {product.name}{' '}
                    {!product.enabled && <Chip size='small' label='已停用' />}
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    {product.origin} · {product.pages?.length || 0} 个页面
                  </Typography>
                </Box>
                <Button onClick={() => setEditing(product)}>编辑页面</Button>
                <Button onClick={() => setCredentials(product)}>
                  服务端凭证
                </Button>
                {product.enabled && (
                  <Button
                    color='error'
                    onClick={async () => {
                      if (!kb_id) return;
                      try {
                        await disableProduct(product.id, kb_id);
                        await load();
                        message.success('已停用');
                      } catch (reason) {
                        failure(reason);
                      }
                    }}
                  >
                    停用
                  </Button>
                )}
              </Stack>
            </Paper>
          ))}
          {!products.length && (
            <Alert severity='info'>
              先登记一个产品及其页面，再在文章 CTA
              中选择目标。注册和生成结果由产品服务器回传。
            </Alert>
          )}
        </Stack>
      )}
      {canReadAnalytics && tab === 'funnel' && (
        <FunnelPanel products={products} />
      )}
      {canEditContent && tab === 'content' && (
        <Stack spacing={2}>
          <Alert severity='info'>
            编辑器顶部“文章设置”支持草稿内容。这里可选择已发布页面调整文章入口、封面、分类标签、推荐及
            CTA；保存后需发布。
          </Alert>
          <Button
            variant='contained'
            sx={{ alignSelf: 'flex-start' }}
            onClick={() => setPicker(true)}
          >
            选择内容并编辑运营属性
          </Button>
        </Stack>
      )}
      <ProductEditor
        product={editing}
        onClose={() => setEditing(null)}
        onSaved={load}
      />
      <CredentialsDialog
        product={credentials}
        onClose={() => setCredentials(null)}
      />
      <PagePicker
        open={picker}
        nodeOnly
        onClose={() => setPicker(false)}
        onSelect={target => setNode(target.node_id || '')}
      />
      <ContentMetadataEditor
        nodeId={node}
        open={Boolean(node)}
        onClose={() => setNode('')}
      />
    </Box>
  );
}
