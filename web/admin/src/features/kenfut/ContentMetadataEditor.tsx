import { v4 as uuidv4 } from 'uuid';
import { getApiV1NodeListGroupNav } from '@/request/Node';
import { uploadFile } from '@/api';
import { useAppDispatch, useAppSelector } from '@/store';
import { setIsRefreshDocList } from '@/store/slices/config';
import { message } from '@ctzhian/ui';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getMetadata, saveMetadata } from './api';
import PagePicker from './PagePicker';
import type { ContentMetadata, CTA } from './types';

const emptyMetadata = (id: string): ContentMetadata => ({
  node_id: id,
  channel: 'docs',
  slug: '',
  cover_url: '',
  author_name: '',
  author_avatar: '',
  display_date: '',
  category: '',
  tags: [],
  featured: false,
  featured_order: 0,
  related_node_ids: [],
  ctas: [],
});

function ImageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  return (
    <Stack direction='row' spacing={1} alignItems='center'>
      <TextField
        fullWidth
        size='small'
        label={label}
        value={value}
        onChange={event => onChange(event.target.value)}
      />
      <Button component='label' disabled={uploading} sx={{ flexShrink: 0 }}>
        {uploading ? t('kenfut.metadata.uploading') : t('common.upload')}
        <input
          hidden
          type='file'
          accept='image/*'
          onChange={async event => {
            const file = event.target.files?.[0];
            if (!file) return;
            setUploading(true);
            try {
              const data = new FormData();
              data.append('file', file);
              const result = await uploadFile(data);
              onChange(`/static-file/${result.key}`);
            } catch (error) {
              message.error(
                error instanceof Error ? error.message : t('upload.failed'),
              );
            } finally {
              setUploading(false);
              event.target.value = '';
            }
          }}
        />
      </Button>
    </Stack>
  );
}

interface Props {
  nodeId: string;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function ContentMetadataEditor({
  nodeId,
  open,
  onClose,
  onSaved,
}: Props) {
  const { t } = useTranslation();
  const { kb_id } = useAppSelector(state => state.config);
  const dispatch = useAppDispatch();
  const [value, setValue] = useState<ContentMetadata>(emptyMetadata(nodeId));
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [picker, setPicker] = useState<'related' | number | null>(null);
  const [relatedTitles, setRelatedTitles] = useState<Record<string, string>>(
    {},
  );
  const [ctaParams, setCtaParams] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open || !nodeId || !kb_id) return;
    const controller = new AbortController();
    setLoading(true);
    setLoaded(false);
    setError('');
    getMetadata(nodeId, kb_id, controller.signal)
      .then(metadata => {
        const normalized = {
          ...emptyMetadata(nodeId),
          ...metadata,
          tags: metadata.tags || [],
          related_node_ids: metadata.related_node_ids || [],
          ctas: metadata.ctas || [],
        };
        setValue(normalized);
        setLoaded(true);
        setCtaParams(
          Object.fromEntries(
            normalized.ctas.map(cta => [
              cta.id,
              Object.entries(cta.target.params || {})
                .map(([key, val]) => `${key}=${val}`)
                .join('\n'),
            ]),
          ),
        );
      })
      .catch(reason => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : t('kenfut.common.loadFailed'),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    getApiV1NodeListGroupNav(
      { kb_id, status: 'released' },
      { signal: controller.signal },
    )
      .then(result => {
        if (controller.signal.aborted) return;
        const raw: unknown = result;
        const groups = (
          Array.isArray(raw) ? raw : (raw as { data?: unknown[] }).data || []
        ) as Array<{ list?: Array<{ id?: string; name?: string }> }>;
        setRelatedTitles(
          Object.fromEntries(
            groups
              .flatMap(group => group.list || [])
              .filter(node => node.id)
              .map(node => [node.id!, node.name || node.id!]),
          ),
        );
      })
      .catch(() => {
        /* IDs remain editable if optional display titles cannot be loaded. */
      });
    return () => controller.abort();
  }, [open, nodeId, kb_id, t]);
  const update = <K extends keyof ContentMetadata>(
    key: K,
    next: ContentMetadata[K],
  ) => setValue(current => ({ ...current, [key]: next }));
  const updateCTA = (index: number, next: Partial<CTA>) =>
    update(
      'ctas',
      value.ctas.map((cta, position) =>
        position === index ? { ...cta, ...next } : cta,
      ),
    );
  const save = async () => {
    if (!kb_id) return;
    setSaving(true);
    setError('');
    try {
      const ctas = value.ctas.map(cta => {
        const params: Record<string, string> = {};
        for (const line of (ctaParams[cta.id] || '')
          .split('\n')
          .filter(line => line.trim())) {
          const separator = line.indexOf('=');
          if (separator < 1)
            throw new Error(t('kenfut.metadata.ctaParamsInvalid'));
          const key = line.slice(0, separator).trim();
          if (key === 'kf_click_id')
            throw new Error(t('kenfut.metadata.reservedParam'));
          params[key] = line.slice(separator + 1);
        }
        if (!cta.label.trim())
          throw new Error(t('kenfut.metadata.ctaLabelRequired'));
        return { ...cta, target: { ...cta.target, params } };
      });
      await saveMetadata(
        {
          ...value,
          ctas,
          display_date: value.display_date
            ? new Date(value.display_date).toISOString()
            : '',
        },
        kb_id,
      );
      dispatch(setIsRefreshDocList(true));
      message.success(t('kenfut.metadata.saved'));
      onSaved?.();
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t('common.saveFailed'),
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullWidth
      maxWidth='md'
    >
      <DialogTitle>{t('kenfut.metadata.title')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity='info'>{t('kenfut.metadata.hint')}</Alert>
          {error && <Alert severity='error'>{error}</Alert>}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              select
              fullWidth
              label={t('kenfut.metadata.channel')}
              value={value.channel}
              onChange={event =>
                update(
                  'channel',
                  event.target.value as ContentMetadata['channel'],
                )
              }
            >
              <MenuItem value='docs'>
                {t('kenfut.metadata.channelDocs')}
              </MenuItem>
              <MenuItem value='article'>
                {t('kenfut.metadata.channelArticle')}
              </MenuItem>
              <MenuItem value='both'>
                {t('kenfut.common.docsAndArticles')}
              </MenuItem>
            </TextField>
            <TextField
              fullWidth
              label={t('kenfut.metadata.slug')}
              value={value.slug}
              onChange={event => update('slug', event.target.value)}
              helperText={t('kenfut.metadata.slugHint')}
              required={value.channel !== 'docs'}
            />
          </Stack>
          <ImageField
            label={t('kenfut.metadata.cover')}
            value={value.cover_url}
            onChange={next => update('cover_url', next)}
          />
          {value.cover_url && (
            <Box
              component='img'
              src={value.cover_url}
              alt={t('kenfut.metadata.coverPreview')}
              sx={{
                width: 160,
                height: 90,
                objectFit: 'cover',
                borderRadius: 1,
              }}
            />
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              fullWidth
              label={t('kenfut.metadata.authorName')}
              value={value.author_name}
              onChange={event => update('author_name', event.target.value)}
            />
            <TextField
              fullWidth
              label={t('kenfut.metadata.displayDate')}
              type='datetime-local'
              slotProps={{ inputLabel: { shrink: true } }}
              value={
                value.display_date
                  ? (() => {
                      const date = new Date(value.display_date);
                      return new Date(
                        date.getTime() - date.getTimezoneOffset() * 60000,
                      )
                        .toISOString()
                        .slice(0, 16);
                    })()
                  : ''
              }
              onChange={event =>
                update(
                  'display_date',
                  event.target.value
                    ? new Date(event.target.value).toISOString()
                    : '',
                )
              }
              helperText={t('kenfut.metadata.displayDateHint')}
            />
          </Stack>
          <ImageField
            label={t('kenfut.metadata.authorAvatar')}
            value={value.author_avatar}
            onChange={next => update('author_avatar', next)}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              fullWidth
              label={t('kenfut.metadata.category')}
              value={value.category}
              onChange={event => update('category', event.target.value)}
              placeholder={t('kenfut.metadata.categoryPlaceholder')}
            />
            <Autocomplete
              multiple
              freeSolo
              options={[]}
              value={value.tags}
              onChange={(_, tags) => update('tags', tags)}
              sx={{ width: '100%' }}
              renderInput={params => (
                <TextField
                  {...params}
                  label={t('kenfut.metadata.tags')}
                  placeholder={t('kenfut.metadata.tagsPlaceholder')}
                />
              )}
            />
          </Stack>
          <Stack direction='row' spacing={2} alignItems='center'>
            <FormControlLabel
              control={
                <Switch
                  checked={value.featured}
                  onChange={(_, checked) => update('featured', checked)}
                />
              }
              label={t('kenfut.metadata.featured')}
            />
            <TextField
              size='small'
              type='number'
              label={t('kenfut.metadata.featuredOrder')}
              value={value.featured_order}
              onChange={event =>
                update('featured_order', Number(event.target.value))
              }
              helperText={t('kenfut.metadata.featuredOrderHint')}
            />
          </Stack>
          <Typography fontWeight='bold'>
            {t('kenfut.metadata.relatedTitle')}
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            {t('kenfut.metadata.relatedHint')}
          </Typography>
          <Stack direction='row' spacing={1} flexWrap='wrap'>
            {value.related_node_ids.map((id, index) => (
              <Stack key={id} direction='row' alignItems='center'>
                <Chip
                  label={t('kenfut.metadata.relatedIndex', {
                    index: index + 1,
                    title: relatedTitles[id] || id.slice(0, 8),
                  })}
                  onDelete={() =>
                    update(
                      'related_node_ids',
                      value.related_node_ids.filter(item => item !== id),
                    )
                  }
                />
                <Button
                  size='small'
                  disabled={index === 0}
                  onClick={() => {
                    const next = [...value.related_node_ids];
                    [next[index - 1], next[index]] = [
                      next[index],
                      next[index - 1],
                    ];
                    update('related_node_ids', next);
                  }}
                >
                  {t('kenfut.metadata.moveUp')}
                </Button>
              </Stack>
            ))}
            <Button
              size='small'
              disabled={value.related_node_ids.length >= 2}
              onClick={() => setPicker('related')}
            >
              {t('kenfut.metadata.selectRelated')}
            </Button>
          </Stack>
          <Typography fontWeight='bold'>
            {t('kenfut.metadata.ctaTitle')}
          </Typography>
          {value.ctas.map((cta, index) => (
            <Stack
              key={cta.id}
              spacing={1.5}
              sx={{
                p: 2,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
              }}
            >
              <Stack direction='row' spacing={1}>
                <TextField
                  fullWidth
                  size='small'
                  label={t('kenfut.metadata.ctaLabel')}
                  value={cta.label}
                  onChange={event =>
                    updateCTA(index, { label: event.target.value })
                  }
                />
                <TextField
                  select
                  size='small'
                  label={t('kenfut.metadata.ctaStyle')}
                  value={cta.style}
                  sx={{ minWidth: 110 }}
                  onChange={event =>
                    updateCTA(index, {
                      style: event.target.value as CTA['style'],
                    })
                  }
                >
                  <MenuItem value='primary'>
                    {t('kenfut.metadata.ctaStylePrimary')}
                  </MenuItem>
                  <MenuItem value='secondary'>
                    {t('kenfut.metadata.ctaStyleSecondary')}
                  </MenuItem>
                </TextField>
                <Button
                  color='error'
                  onClick={() =>
                    update(
                      'ctas',
                      value.ctas.filter(item => item.id !== cta.id),
                    )
                  }
                >
                  {t('kenfut.common.remove')}
                </Button>
              </Stack>
              <Stack direction='row' spacing={1} alignItems='center'>
                <Button onClick={() => setPicker(index)}>
                  {t('kenfut.metadata.selectTarget')}
                </Button>
                <Typography variant='body2' sx={{ wordBreak: 'break-all' }}>
                  {cta.target.type === 'node'
                    ? `/node/${cta.target.node_id || ''}`
                    : cta.target.type === 'site'
                      ? cta.target.page
                      : cta.target.type === 'product'
                        ? `${cta.target.product_id} / ${cta.target.page_key}`
                        : cta.target.url || t('kenfut.metadata.noTarget')}
                </Typography>
              </Stack>
              <TextField
                size='small'
                label={t('kenfut.metadata.ctaParams')}
                multiline
                rows={2}
                value={ctaParams[cta.id] || ''}
                onChange={event =>
                  setCtaParams(current => ({
                    ...current,
                    [cta.id]: event.target.value,
                  }))
                }
                helperText={t('kenfut.metadata.ctaParamsHint')}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={cta.new_tab}
                    onChange={(_, checked) =>
                      updateCTA(index, { new_tab: checked })
                    }
                  />
                }
                label={t('kenfut.metadata.newTab')}
              />
            </Stack>
          ))}
          <Button
            disabled={value.ctas.length >= 2}
            onClick={() =>
              update('ctas', [
                ...value.ctas,
                {
                  id: uuidv4(),
                  label: '',
                  style: value.ctas.length ? 'secondary' : 'primary',
                  new_tab: false,
                  target: { type: 'site', page: 'home' },
                },
              ])
            }
          >
            {t('kenfut.metadata.addCta')}
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button
          variant='contained'
          disabled={!loaded || loading || saving}
          onClick={save}
        >
          {saving
            ? t('kenfut.metadata.saving')
            : t('kenfut.metadata.saveDraft')}
        </Button>
      </DialogActions>
      <PagePicker
        open={picker !== null}
        nodeOnly={picker === 'related'}
        excludeIds={
          picker === 'related' ? [nodeId, ...value.related_node_ids] : []
        }
        onClose={() => setPicker(null)}
        onSelect={(target, page) => {
          if (picker === 'related' && target.node_id) {
            setRelatedTitles(current => ({
              ...current,
              [target.node_id!]: page.title,
            }));
            update('related_node_ids', [
              ...value.related_node_ids,
              target.node_id,
            ]);
          } else if (typeof picker === 'number') updateCTA(picker, { target });
        }}
      />
    </Dialog>
  );
}

export function ContentMetadataButton({
  nodeId,
  onSaved,
}: {
  nodeId: string;
  onSaved?: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size='small' onClick={() => setOpen(true)}>
        {t('kenfut.metadata.articleSettings')}
      </Button>
      <ContentMetadataEditor
        nodeId={nodeId}
        open={open}
        onClose={() => setOpen(false)}
        onSaved={onSaved}
      />
    </>
  );
}
