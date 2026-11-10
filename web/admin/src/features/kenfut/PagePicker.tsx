import { getApiV1NodeListGroupNav } from '@/request/Node';
import { useAppSelector } from '@/store';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Tab,
  Tabs,
  TextField,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getProducts } from './api';
import type { LinkTarget, PageOption } from './types';

type NodeGroup = {
  list?: Array<{ id?: string; name?: string; type?: number }>;
};

interface PagePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (target: LinkTarget, page: PageOption) => void;
  nodeOnly?: boolean;
  excludeIds?: string[];
}

export default function PagePicker({
  open,
  onClose,
  onSelect,
  nodeOnly = false,
  excludeIds = [],
}: PagePickerProps) {
  const { t } = useTranslation();
  const { kb_id } = useAppSelector(state => state.config);
  const [pages, setPages] = useState<PageOption[]>([]);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('all');
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const [urlTitle, setUrlTitle] = useState('');
  useEffect(() => {
    if (!open || !kb_id) return;
    let cancelled = false;
    setError('');
    setQuery('');
    setTab('all');
    setUrl('');
    setUrlTitle('');
    setPages([]);
    Promise.all([
      getApiV1NodeListGroupNav({ kb_id, status: 'released' }),
      nodeOnly ? Promise.resolve({ items: [] }) : getProducts(kb_id),
    ])
      .then(([groups, products]) => {
        if (cancelled) return;
        const groupsList = Array.isArray(groups)
          ? (groups as NodeGroup[])
          : (groups as { data?: NodeGroup[] }).data || [];
        const nodes = groupsList
          .flatMap(group => group.list || [])
          .filter(node => node.type === 2 && node.id)
          .map(node => ({
            id: node.id!,
            title: node.name || t('doc.untitled'),
            url: `/node/${node.id}`,
            type: 'node' as const,
            target: { type: 'node' as const, node_id: node.id },
          }));
        const unique = Array.from(
          new Map(nodes.map(node => [node.id, node])).values(),
        );
        const site: PageOption[] = nodeOnly
          ? []
          : [
              {
                id: 'home',
                title: t('kenfut.picker.siteHome'),
                url: '/',
                type: 'site',
                target: { type: 'site', page: 'home' },
              },
              {
                id: 'docs',
                title: t('kenfut.picker.docsEntry'),
                url: '/node',
                type: 'site',
                target: { type: 'site', page: 'docs' },
              },
              {
                id: 'blog',
                title: t('kenfut.picker.blogChannel'),
                url: '/blog',
                type: 'site',
                target: { type: 'site', page: 'blog' },
              },
            ];
        const external: PageOption[] = products.items
          .filter(product => product.enabled)
          .flatMap(product =>
            (product.pages || []).map(page => ({
              id: `${product.id}:${page.key}`,
              title: `${product.name} / ${page.name}`,
              url: new URL(page.path, product.origin).toString(),
              type: 'product' as const,
              target: {
                type: 'product' as const,
                product_id: product.id,
                page_key: page.key,
              },
            })),
          );
        setPages([...site, ...unique, ...external]);
      })
      .catch(err => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : t('kenfut.picker.loadFailed'),
          );
      });
    return () => {
      cancelled = true;
    };
  }, [open, kb_id, nodeOnly, t]);
  const select = (page: PageOption) => {
    onSelect(page.target, page);
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth='sm'>
      <DialogTitle>{t('kenfut.picker.title')}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label={t('kenfut.picker.searchPlaceholder')}
          value={query}
          onChange={event => setQuery(event.target.value)}
          sx={{ mt: 1, mb: 2 }}
        />
        {!nodeOnly && (
          <Tabs
            value={tab}
            onChange={(_, value) => setTab(value)}
            variant='scrollable'
          >
            <Tab value='all' label={t('kenfut.picker.tabAll')} />
            <Tab value='node' label={t('kenfut.common.docsAndArticles')} />
            <Tab value='product' label={t('kenfut.picker.tabProduct')} />
            <Tab value='url' label={t('kenfut.picker.tabUrl')} />
          </Tabs>
        )}
        {error && (
          <Alert severity='error' sx={{ my: 1 }}>
            {error}
          </Alert>
        )}
        {tab === 'url' && !nodeOnly ? (
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              label={t('kenfut.picker.linkText')}
              value={urlTitle}
              onChange={event => setUrlTitle(event.target.value)}
            />
            <TextField
              label={t('kenfut.picker.linkUrl')}
              value={url}
              onChange={event => setUrl(event.target.value)}
            />
            <Button
              disabled={!/^(https?:\/\/|\/[^/])/.test(url)}
              onClick={() =>
                select({
                  id: url,
                  title: urlTitle || url,
                  url,
                  type: 'site',
                  target: { type: 'url', url },
                })
              }
            >
              {t('kenfut.picker.selectLink')}
            </Button>
          </Stack>
        ) : (
          <List sx={{ maxHeight: 420, overflow: 'auto' }}>
            {pages
              .filter(
                page =>
                  !excludeIds.includes(page.id) &&
                  (nodeOnly
                    ? page.type === 'node'
                    : tab === 'all' || page.type === tab) &&
                  `${page.title} ${page.url}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
              )
              .map(page => (
                <ListItemButton key={page.id} onClick={() => select(page)}>
                  <ListItemText primary={page.title} secondary={page.url} />
                  <Chip
                    size='small'
                    label={
                      page.type === 'node'
                        ? t('kenfut.picker.typeContent')
                        : page.type === 'product'
                          ? t('kenfut.common.product')
                          : t('kenfut.picker.typeSite')
                    }
                  />
                </ListItemButton>
              ))}
          </List>
        )}
        {nodeOnly && (
          <Box sx={{ color: 'text.secondary', mt: 1 }}>
            {t('kenfut.picker.nodeOnlyHint')}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
      </DialogActions>
    </Dialog>
  );
}

export function PagePickerButton({
  onSelect,
}: {
  onSelect: (href: string, title: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size='small' onClick={() => setOpen(true)}>
        {t('kenfut.picker.selectPage')}
      </Button>
      <PagePicker
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(target, page) =>
          onSelect(
            target.type === 'node' ? `/node/${target.node_id}` : page.url,
            page.title,
          )
        }
      />
    </>
  );
}
