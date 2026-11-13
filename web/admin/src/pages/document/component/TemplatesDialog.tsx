import {
  getApiV1NodeTemplateList,
  postApiV1NodeTemplate,
  deleteApiV1NodeTemplateId,
} from '@/request/NodeTemplate';
import { postApiV1Node } from '@/request/Node';
import { DomainNodeTemplate } from '@/request/types';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { message, Modal } from '@ctzhian/ui';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/store';

export interface TemplateDraft {
  name: string;
  summary: string;
  content: string;
  content_type: string;
}

interface TemplatesDialogProps {
  open: boolean;
  onClose: () => void;
  /** 非空时直接进入新建表单并预填（如"存为模板"） */
  draft?: TemplateDraft | null;
  refresh?: () => void;
}

const TemplatesDialog = ({
  open,
  onClose,
  draft,
  refresh,
}: TemplatesDialogProps) => {
  const { t } = useTranslation();
  const { kb_id, nav_id } = useAppSelector(state => state.config);
  const [items, setItems] = useState<DomainNodeTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<TemplateDraft | null>(null);

  const load = () => {
    if (!open || !kb_id) return;
    setLoading(true);
    getApiV1NodeTemplateList({ kb_id })
      .then(res => setItems(res || []))
      .catch(error =>
        message.error(
          error instanceof Error ? error.message : t('common.operationFailed'),
        ),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open) return;
    setEditing(draft ? { ...draft } : null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft]);

  const applyTemplate = (item: DomainNodeTemplate) => {
    if (!kb_id) return;
    setBusy(true);
    postApiV1Node({
      name: item.name || '',
      content: item.content,
      kb_id,
      nav_id: nav_id || '',
      type: 2,
      content_type: item.content_type || 'md',
      lang: 'zh',
    })
      .then(({ id }) => {
        message.success(t('doc.templates.created'));
        onClose();
        refresh?.();
        if (id) window.open(`/doc/editor/${id}`, '_blank');
      })
      .catch(error =>
        message.error(
          error instanceof Error ? error.message : t('common.operationFailed'),
        ),
      )
      .finally(() => setBusy(false));
  };

  const removeTemplate = (item: DomainNodeTemplate) => {
    if (!kb_id || !item.id) return;
    setBusy(true);
    deleteApiV1NodeTemplateId({ id: item.id, kb_id })
      .then(() => {
        message.success(t('common.deleteSuccess'));
        load();
      })
      .catch(error =>
        message.error(
          error instanceof Error ? error.message : t('common.operationFailed'),
        ),
      )
      .finally(() => setBusy(false));
  };

  const submitDraft = () => {
    if (!kb_id || !editing || !editing.name.trim()) return;
    setBusy(true);
    postApiV1NodeTemplate({
      name: editing.name.trim(),
      summary: editing.summary,
      content: editing.content,
      content_type: editing.content_type === 'html' ? 'html' : 'md',
    })
      .then(() => {
        message.success(t('common.saveSuccess'));
        setEditing(null);
        load();
      })
      .catch(error =>
        message.error(
          error instanceof Error ? error.message : t('common.operationFailed'),
        ),
      )
      .finally(() => setBusy(false));
  };

  return (
    <Modal
      title={t('doc.templates.title')}
      open={open}
      width={720}
      footer={null}
      onCancel={onClose}
    >
      {editing ? (
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label={t('doc.templates.name')}
            value={editing.name}
            onChange={event =>
              setEditing({ ...editing, name: event.target.value })
            }
            fullWidth
          />
          <TextField
            label={t('doc.templates.summary')}
            value={editing.summary}
            onChange={event =>
              setEditing({ ...editing, summary: event.target.value })
            }
            fullWidth
          />
          <TextField
            label={t('doc.templates.content')}
            value={editing.content}
            onChange={event =>
              setEditing({ ...editing, content: event.target.value })
            }
            fullWidth
            multiline
            minRows={8}
            slotProps={{ input: { sx: { fontFamily: 'Mono', fontSize: 13 } } }}
          />
          <Stack direction='row' justifyContent='flex-end' spacing={1}>
            <Button onClick={() => setEditing(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant='contained'
              disabled={busy || !editing.name.trim()}
              onClick={submitDraft}
            >
              {t('common.save')}
            </Button>
          </Stack>
        </Stack>
      ) : (
        <Stack spacing={1} sx={{ pt: 1 }}>
          <Stack direction='row' justifyContent='flex-end'>
            <Button
              variant='contained'
              size='small'
              onClick={() =>
                setEditing({
                  name: '',
                  summary: '',
                  content: '',
                  content_type: 'md',
                })
              }
            >
              {t('doc.templates.create')}
            </Button>
          </Stack>
          {loading ? (
            <Typography
              color='text.secondary'
              sx={{ py: 4, textAlign: 'center' }}
            >
              {t('common.loading')}
            </Typography>
          ) : items.length ? (
            items.map(item => (
              <Stack
                key={item.id}
                direction='row'
                alignItems='center'
                spacing={1}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  px: 2,
                  py: 1.5,
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap>{item.name}</Typography>
                  <Typography variant='caption' color='text.secondary' noWrap>
                    {item.summary || t('doc.templates.noSummary')} ·{' '}
                    {t('doc.templates.updatedAt', {
                      time: dayjs(item.updated_at).format('YYYY-MM-DD'),
                    })}
                    {item.creator_name ? ` · ${item.creator_name}` : ''}
                  </Typography>
                </Box>
                <Box
                  component='button'
                  disabled={busy}
                  onClick={() => applyTemplate(item)}
                  sx={{
                    border: 'none',
                    cursor: 'pointer',
                    background: 'none',
                    color: 'primary.main',
                    fontSize: 13,
                  }}
                >
                  {t('doc.templates.use')}
                </Box>
                <Box
                  component='button'
                  disabled={busy}
                  onClick={() => removeTemplate(item)}
                  sx={{
                    border: 'none',
                    cursor: 'pointer',
                    background: 'none',
                    color: 'error.main',
                    fontSize: 13,
                  }}
                >
                  {t('common.delete')}
                </Box>
              </Stack>
            ))
          ) : (
            <Typography
              color='text.secondary'
              sx={{ py: 4, textAlign: 'center' }}
            >
              {t('doc.templates.empty')}
            </Typography>
          )}
        </Stack>
      )}
    </Modal>
  );
};

export default TemplatesDialog;
