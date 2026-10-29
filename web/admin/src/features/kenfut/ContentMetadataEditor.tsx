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
        {uploading ? '上传中' : '上传'}
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
                error instanceof Error ? error.message : '上传失败',
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
          setError(reason instanceof Error ? reason.message : '加载失败');
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
  }, [open, nodeId, kb_id]);
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
          if (separator < 1) throw new Error('CTA 参数请按每行 key=value 填写');
          const key = line.slice(0, separator).trim();
          if (key === 'kf_click_id')
            throw new Error('kf_click_id 为系统保留参数');
          params[key] = line.slice(separator + 1);
        }
        if (!cta.label.trim()) throw new Error('请填写 CTA 按钮文字');
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
      message.success('内容属性已保存，请发布文档后对外生效');
      onSaved?.();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败');
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
      <DialogTitle>文章与运营属性</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity='info'>
            这些属性与正文一起发布。同一内容的文档入口和文章入口共用评论及浏览量。
          </Alert>
          {error && <Alert severity='error'>{error}</Alert>}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              select
              fullWidth
              label='展示入口'
              value={value.channel}
              onChange={event =>
                update(
                  'channel',
                  event.target.value as ContentMetadata['channel'],
                )
              }
            >
              <MenuItem value='docs'>仅文档目录</MenuItem>
              <MenuItem value='article'>仅文章频道</MenuItem>
              <MenuItem value='both'>文档与文章</MenuItem>
            </TextField>
            <TextField
              fullWidth
              label='文章短名'
              value={value.slug}
              onChange={event => update('slug', event.target.value)}
              helperText='文章地址 /blog/短名，修改后保留旧链接跳转'
              required={value.channel !== 'docs'}
            />
          </Stack>
          <ImageField
            label='封面图片'
            value={value.cover_url}
            onChange={next => update('cover_url', next)}
          />
          {value.cover_url && (
            <Box
              component='img'
              src={value.cover_url}
              alt='封面预览'
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
              label='公开署名'
              value={value.author_name}
              onChange={event => update('author_name', event.target.value)}
            />
            <TextField
              fullWidth
              label='展示发布日期'
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
              helperText='留空使用首次发布时间'
            />
          </Stack>
          <ImageField
            label='作者头像'
            value={value.author_avatar}
            onChange={next => update('author_avatar', next)}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              fullWidth
              label='主分类'
              value={value.category}
              onChange={event => update('category', event.target.value)}
              placeholder='例如：教程、产品更新、案例'
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
                  label='标签'
                  placeholder='输入后按回车'
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
              label='精选文章'
            />
            <TextField
              size='small'
              type='number'
              label='精选排序'
              value={value.featured_order}
              onChange={event =>
                update('featured_order', Number(event.target.value))
              }
              helperText='数字越小越靠前'
            />
          </Stack>
          <Typography fontWeight='bold'>文末相关推荐</Typography>
          <Typography variant='body2' color='text.secondary'>
            手选优先，按此顺序展示；不足两篇时按标签、分类或目录补足。
          </Typography>
          <Stack direction='row' spacing={1} flexWrap='wrap'>
            {value.related_node_ids.map((id, index) => (
              <Stack key={id} direction='row' alignItems='center'>
                <Chip
                  label={`${index + 1}. ${relatedTitles[id] || id.slice(0, 8)}`}
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
                  上移
                </Button>
              </Stack>
            ))}
            <Button
              size='small'
              disabled={value.related_node_ids.length >= 2}
              onClick={() => setPicker('related')}
            >
              选择推荐页面
            </Button>
          </Stack>
          <Typography fontWeight='bold'>文末动作引导 CTA</Typography>
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
                  label='按钮文字'
                  value={cta.label}
                  onChange={event =>
                    updateCTA(index, { label: event.target.value })
                  }
                />
                <TextField
                  select
                  size='small'
                  label='样式'
                  value={cta.style}
                  sx={{ minWidth: 110 }}
                  onChange={event =>
                    updateCTA(index, {
                      style: event.target.value as CTA['style'],
                    })
                  }
                >
                  <MenuItem value='primary'>主按钮</MenuItem>
                  <MenuItem value='secondary'>次按钮</MenuItem>
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
                  移除
                </Button>
              </Stack>
              <Stack direction='row' spacing={1} alignItems='center'>
                <Button onClick={() => setPicker(index)}>选择目标页面</Button>
                <Typography variant='body2' sx={{ wordBreak: 'break-all' }}>
                  {cta.target.type === 'node'
                    ? `/node/${cta.target.node_id || ''}`
                    : cta.target.type === 'site'
                      ? cta.target.page
                      : cta.target.type === 'product'
                        ? `${cta.target.product_id} / ${cta.target.page_key}`
                        : cta.target.url || '尚未选择'}
                </Typography>
              </Stack>
              <TextField
                size='small'
                label='跳转参数（每行 key=value）'
                multiline
                rows={2}
                value={ctaParams[cta.id] || ''}
                onChange={event =>
                  setCtaParams(current => ({
                    ...current,
                    [cta.id]: event.target.value,
                  }))
                }
                helperText='产品页面仅允许后台登记的参数，系统自动附加归因标识'
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
                label='新窗口打开'
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
            添加 CTA（最多两个）
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          取消
        </Button>
        <Button
          variant='contained'
          disabled={!loaded || loading || saving}
          onClick={save}
        >
          {saving ? '保存中' : '保存属性草稿'}
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
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size='small' onClick={() => setOpen(true)}>
        文章设置
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
