import i18n from '@/i18n';
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
import { useTranslation } from 'react-i18next';
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
  message.error(
    error instanceof Error ? error.message : i18n.t('common.operationFailed'),
  );

function ProductEditor({
  product,
  onClose,
  onSaved,
}: {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
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
      <DialogTitle>
        {value.id
          ? t('kenfut.operations.editTitle')
          : t('kenfut.operations.register')}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity='info'>{t('kenfut.operations.registerHint')}</Alert>
          <TextField
            label={t('kenfut.operations.productName')}
            value={value.name}
            onChange={event =>
              setValue(current => ({ ...current, name: event.target.value }))
            }
          />
          <TextField
            label={t('kenfut.operations.productOrigin')}
            placeholder='https://product.example'
            value={value.origin}
            onChange={event =>
              setValue(current => ({ ...current, origin: event.target.value }))
            }
            helperText={t('kenfut.operations.originHint')}
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
            label={t('kenfut.operations.enable')}
          />
          <Typography fontWeight='bold'>
            {t('kenfut.operations.pageCatalog')}
          </Typography>
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
                  label={t('kenfut.operations.stablePageKey')}
                  value={page.key}
                  onChange={event =>
                    updatePage(index, { key: event.target.value })
                  }
                />
                <TextField
                  fullWidth
                  size='small'
                  label={t('kenfut.operations.pageName')}
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
                  {t('kenfut.common.remove')}
                </Button>
              </Stack>
              <TextField
                size='small'
                label={t('kenfut.operations.pagePath')}
                placeholder='/workspace'
                value={page.path}
                onChange={event =>
                  updatePage(index, { path: event.target.value })
                }
              />
              <TextField
                size='small'
                label={t('kenfut.operations.allowedParams')}
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
            {t('kenfut.operations.addPage')}
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          variant='contained'
          disabled={saving || !value.name.trim() || !value.origin.trim()}
          onClick={async () => {
            if (!kb_id) return;
            setSaving(true);
            try {
              await saveProduct(value, kb_id);
              message.success(t('kenfut.operations.productSaved'));
              onSaved();
              onClose();
            } catch (error) {
              failure(error);
            } finally {
              setSaving(false);
            }
          }}
        >
          {t('common.save')}
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
  const { t } = useTranslation();
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
      <DialogTitle>
        {t('kenfut.operations.credentialsTitle', { name: product?.name })}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Alert severity='warning'>
            {t('kenfut.operations.credentialsHint')}
          </Alert>
          {token && (
            <>
              <TextField
                multiline
                label={t('kenfut.operations.newCredential')}
                value={token}
                slotProps={{ input: { readOnly: true } }}
              />
              <Button
                onClick={() =>
                  navigator.clipboard
                    .writeText(token)
                    .then(() => message.success(t('kenfut.operations.copied')))
                    .catch(failure)
                }
              >
                {t('kenfut.operations.copyCredential')}
              </Button>
            </>
          )}
          <Stack>
            {['conversion:write', 'analytics:read'].map(scope => (
              <FormControlLabel
                key={scope}
                label={
                  scope === 'conversion:write'
                    ? t('kenfut.operations.scopeConversion')
                    : t('kenfut.operations.scopeAnalytics')
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
            {t('kenfut.operations.createCredential')}
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
                <Chip label={t('kenfut.operations.revoked')} size='small' />
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
                      message.success(t('kenfut.operations.revokeSuccess'));
                    } catch (error) {
                      failure(error);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {t('kenfut.operations.revoke')}
                </Button>
              )}
            </Stack>
          ))}
          {!keys.length && (
            <Typography color='text.secondary'>
              {t('kenfut.operations.noCredentials')}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}

function FunnelPanel({ products }: { products: Product[] }) {
  const { t } = useTranslation();
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
      setError(
        reason instanceof Error
          ? reason.message
          : t('kenfut.operations.funnelLoadFailed'),
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <Stack spacing={3}>
      <Alert severity='info'>{t('kenfut.operations.attributionHint')}</Alert>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField
          select
          label={t('kenfut.common.product')}
          value={product}
          onChange={event => setProduct(event.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value=''>{t('kenfut.operations.allProducts')}</MenuItem>
          {products.map(item => (
            <MenuItem key={item.id} value={item.id}>
              {item.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          type='date'
          label={t('kenfut.operations.startDate')}
          value={from}
          onChange={event => setFrom(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          type='date'
          label={t('kenfut.operations.endDate')}
          value={to}
          onChange={event => setTo(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Button
          variant='contained'
          disabled={loading || !from || !to || from > to}
          onClick={load}
        >
          {loading
            ? t('kenfut.operations.querying')
            : t('kenfut.operations.queryFunnel')}
        </Button>
      </Stack>
      <Stack direction='row' spacing={1} alignItems='center'>
        <Button onClick={() => setPicker(true)}>
          {t('kenfut.operations.selectSourceArticle')}
        </Button>
        {node && <Chip label={node.slice(0, 8)} onDelete={() => setNode('')} />}
        <TextField
          size='small'
          label={t('kenfut.operations.ctaIdOptional')}
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
              [
                t('kenfut.operations.articleViews'),
                data.views,
                t('kenfut.operations.viewersArticleOnly', {
                  count: data.viewers,
                }),
              ],
              [
                t('kenfut.operations.ctaClicks'),
                data.clicks,
                t('kenfut.operations.viewers', { count: data.clickers }),
              ],
              [
                t('kenfut.operations.attributedRegistrations'),
                data.registration_connected
                  ? data.registrations
                  : t('kenfut.common.notConnected'),
                data.registration_connected
                  ? t('kenfut.operations.registrationsCaption')
                  : t('kenfut.operations.registrationsMissing'),
              ],
              [
                t('kenfut.operations.firstGenerations'),
                data.generation_connected
                  ? data.first_generations
                  : t('kenfut.common.notConnected'),
                data.generation_connected
                  ? t('kenfut.operations.generationsCaption')
                  : t('kenfut.operations.generationsMissing'),
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
          <Paper variant='outlined' sx={{ p: 2 }}>
            <Typography color='text.secondary'>
              {t('kenfut.operations.documentViews')}
            </Typography>
            <Typography variant='h6' sx={{ my: 1 }}>
              {data.document_views ?? 0}
            </Typography>
            <Typography variant='caption'>
              {t('kenfut.operations.viewers', {
                count: data.document_viewers ?? 0,
              })}
            </Typography>
          </Paper>
          <Stack direction='row' spacing={1} useFlexGap flexWrap='wrap'>
            <Chip
              label={t('kenfut.operations.rateViewToClick', {
                rate: formatFunnelRate(data.clickers, data.viewers),
              })}
            />
            <Chip
              label={t('kenfut.operations.rateClickToRegistration', {
                rate: formatFunnelRate(
                  data.registered_visitors,
                  data.clickers,
                  data.registration_connected,
                ),
              })}
            />
            <Chip
              label={t('kenfut.operations.rateRegistrationToGeneration', {
                rate: formatFunnelRate(
                  data.first_generation_visitors,
                  data.registered_visitors,
                  data.registration_connected && data.generation_connected,
                ),
              })}
            />
          </Stack>
          <Typography variant='body2' color='text.secondary'>
            {t('kenfut.operations.visitorSummary', {
              registered: data.registration_connected
                ? data.registered_visitors
                : t('kenfut.common.notConnected'),
              generations: data.generation_connected
                ? data.first_generation_visitors
                : t('kenfut.common.notConnected'),
            })}
          </Typography>
          <Typography color='text.secondary'>
            {t('kenfut.operations.unattributedSummary', {
              registrations: data.registration_connected
                ? (data.unattributed_registrations ?? 0)
                : t('kenfut.common.notConnected'),
              generations: data.generation_connected
                ? (data.unattributed_first_generations ?? 0)
                : t('kenfut.common.notConnected'),
            })}
          </Typography>
          {!data.conversion_connected && (
            <Alert severity='info'>
              {t('kenfut.operations.serverEventsHint')}
            </Alert>
          )}
          <Typography variant='body2' color='text.secondary'>
            {t('kenfut.operations.metricNote')}
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
                              ? t('kenfut.common.connected')
                              : t('kenfut.common.notConnected')
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
          {t('kenfut.operations.funnelEmptyHint')}
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
  const { t } = useTranslation();
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
      setError(
        reason instanceof Error
          ? reason.message
          : t('kenfut.common.loadFailed'),
      );
    }
  }, [kb_id, t]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    setTab(canManage ? 'products' : canEditContent ? 'content' : 'funnel');
  }, [kb_id, canManage, canEditContent]);
  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1300, mx: 'auto' }}>
      <Typography variant='h5' fontWeight='bold'>
        {t('kenfut.operations.title')}
      </Typography>
      <Typography color='text.secondary' sx={{ mt: 1 }}>
        {t('kenfut.operations.subtitle')}
      </Typography>
      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ my: 3 }}>
        {canManage && (
          <Tab value='products' label={t('kenfut.operations.tabProducts')} />
        )}
        {canReadAnalytics && (
          <Tab value='funnel' label={t('kenfut.operations.tabFunnel')} />
        )}
        {canEditContent && (
          <Tab value='content' label={t('kenfut.operations.tabContent')} />
        )}
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
              {t('kenfut.operations.register')}
            </Button>
            <Button onClick={load}>{t('common.refresh')}</Button>
          </Stack>
          {products.map(product => (
            <Paper key={product.id} variant='outlined' sx={{ p: 2 }}>
              <Stack direction='row' alignItems='center' spacing={1}>
                <Box sx={{ flex: 1 }}>
                  <Typography fontWeight='bold'>
                    {product.name}{' '}
                    {!product.enabled && (
                      <Chip size='small' label={t('common.disabled')} />
                    )}
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    {t('kenfut.operations.pageCount', {
                      origin: product.origin,
                      count: product.pages?.length || 0,
                    })}
                  </Typography>
                </Box>
                <Button onClick={() => setEditing(product)}>
                  {t('kenfut.operations.editPages')}
                </Button>
                <Button onClick={() => setCredentials(product)}>
                  {t('kenfut.operations.serverCredentials')}
                </Button>
                {product.enabled && (
                  <Button
                    color='error'
                    onClick={async () => {
                      if (!kb_id) return;
                      try {
                        await disableProduct(product.id, kb_id);
                        await load();
                        message.success(t('common.disabled'));
                      } catch (reason) {
                        failure(reason);
                      }
                    }}
                  >
                    {t('common.disable')}
                  </Button>
                )}
              </Stack>
            </Paper>
          ))}
          {!products.length && (
            <Alert severity='info'>
              {t('kenfut.operations.emptyProductsHint')}
            </Alert>
          )}
        </Stack>
      )}
      {canReadAnalytics && tab === 'funnel' && (
        <FunnelPanel products={products} />
      )}
      {canEditContent && tab === 'content' && (
        <Stack spacing={2}>
          <Alert severity='info'>{t('kenfut.operations.contentHint')}</Alert>
          <Button
            variant='contained'
            sx={{ alignSelf: 'flex-start' }}
            onClick={() => setPicker(true)}
          >
            {t('kenfut.operations.selectContent')}
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
