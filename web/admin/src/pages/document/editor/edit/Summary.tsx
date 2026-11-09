import { putApiV1NodeDetail, V1NodeDetailResp } from '@/request';
import {
  createNodeSummaryStream,
  subscribeNodeSummaryStream,
  type StreamSummaryEvent,
} from '@/request/nodeStream';
import { useAppSelector } from '@/store';
import SSEClient from '@/utils/fetch';
import { message, Modal } from '@ctzhian/ui';
import { Button, CircularProgress, Stack, TextField } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import { WrapContext } from '..';
import { IconDJzhinengzhaiyao } from '@panda-wiki/icons';

interface SummaryProps {
  open: boolean;
  onClose: () => void;
  updateDetail: (detail: V1NodeDetailResp) => void;
}

const Summary = ({ open, onClose, updateDetail }: SummaryProps) => {
  const { t } = useTranslation();
  const { kb_id } = useAppSelector(state => state.config);
  const { nodeDetail } = useOutletContext<WrapContext>();
  const [summary, setSummary] = useState(nodeDetail?.meta?.summary || '');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState(false);
  const sseClientRef = useRef<SSEClient<StreamSummaryEvent> | null>(null);

  const handleClose = () => {
    sseClientRef.current?.unsubscribe();
    setEdit(false);
    setSummary('');
    onClose();
  };

  const createSummary = () => {
    if (!nodeDetail) return;
    setGenerating(true);
    setSummary('');
    setEdit(true);
    sseClientRef.current?.unsubscribe();
    sseClientRef.current = createNodeSummaryStream({
      onComplete: () => setGenerating(false),
      onError: error => {
        setGenerating(false);
        message.error(error.message || t('doc.summary.generateFailed'));
      },
    });
    subscribeNodeSummaryStream(
      sseClientRef.current,
      { kb_id, ids: [nodeDetail.id!] },
      event => {
        if (event.type === 'data') {
          setSummary(prev => prev + (event.content || ''));
          return;
        }
        if (event.type === 'error') {
          setGenerating(false);
          message.error(
            event.content || event.error || t('doc.summary.generateFailed'),
          );
          sseClientRef.current?.unsubscribe();
        }
      },
    );
  };

  useEffect(() => {
    if (open) {
      setSummary(nodeDetail?.meta?.summary || '');
    }
  }, [open, nodeDetail]);

  useEffect(() => {
    return () => {
      sseClientRef.current?.unsubscribe();
    };
  }, []);

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title={t('doc.summary.smartTitle')}
      okText={t('common.save')}
      okButtonProps={{
        loading: saving,
        disabled: generating || saving || !edit,
      }}
      onOk={() => {
        if (!nodeDetail) return;
        setSaving(true);
        updateDetail({
          meta: {
            ...nodeDetail?.meta,
            summary,
          },
        });
        putApiV1NodeDetail({
          id: nodeDetail.id!,
          kb_id,
          nav_id: nodeDetail.nav_id || '',
          summary,
        })
          .then(() => {
            message.success(t('common.saveSuccess'));
            handleClose();
          })
          .finally(() => {
            setSaving(false);
          });
      }}
    >
      <Stack gap={2}>
        <TextField
          autoFocus
          multiline
          disabled={generating || saving}
          rows={10}
          fullWidth
          value={summary}
          onChange={e => {
            setSummary(e.target.value);
            setEdit(true);
          }}
          placeholder={t('doc.summary.inputPlaceholder')}
        />
        <Button
          fullWidth
          variant='outlined'
          onClick={createSummary}
          disabled={generating || saving}
          startIcon={
            generating ? (
              <CircularProgress size={16} />
            ) : (
              <IconDJzhinengzhaiyao sx={{ fontSize: 16 }} />
            )
          }
        >
          {t('doc.summary.autoGenerateHint')}
        </Button>
      </Stack>
    </Modal>
  );
};

export default Summary;
