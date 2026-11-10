'use client';

import { useStore } from '@/provider';
import { postShareProV1DocumentFeedback } from '@/request/pro/DocumentFeedback';
import { Box, Stack, TextField } from '@mui/material';
import { Modal, message } from '@ctzhian/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

// 文档反馈弹窗：读者对当前文档提交问题反馈与修改建议
const DocFeedbackModal = ({
  open,
  nodeId,
  onClose,
}: {
  open: boolean;
  nodeId?: string;
  onClose: () => void;
}) => {
  const t = useTranslations('doc');
  const { themeMode } = useStore();
  const [content, setContent] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [loading, setLoading] = useState(false);

  const fieldSx = {
    '.MuiInputBase-root': {
      p: 0,
      overflow: 'hidden',
      bgcolor:
        themeMode === 'dark' ? 'background.paper3' : 'background.default',
    },
    textarea: {
      lineHeight: '26px',
      borderRadius: 0,
      '&::-webkit-scrollbar': {
        display: 'none',
      },
      '&::placeholder': {
        fontSize: 14,
      },
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
    },
    fieldset: {
      border: 'none',
    },
  };

  const handleCancel = () => {
    setContent('');
    setSuggestion('');
    onClose();
  };

  const handleOk = () => {
    if (!content.trim()) {
      message.warning(t('feedbackContentRequired'));
      return;
    }
    setLoading(true);
    postShareProV1DocumentFeedback({
      node_id: nodeId || '',
      content: content.trim(),
      correction_suggestion: suggestion.trim() || undefined,
    })
      .then(() => {
        message.success(t('feedbackSuccess'));
        handleCancel();
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      title={t('docFeedbackTitle')}
      cancelText={t('feedbackCancel')}
      okText={t('feedbackSubmit')}
      okButtonProps={{ disabled: loading }}
      cancelButtonProps={{
        sx: {
          color: 'text.primary',
        },
      }}
      onOk={handleOk}
    >
      <Stack gap={2} sx={{ mt: 1 }}>
        <Box
          sx={{
            borderRadius: '10px',
            border: '1px solid',
            borderColor: 'divider',
            p: 2,
          }}
        >
          <TextField
            fullWidth
            multiline
            rows={4}
            size='small'
            placeholder={t('docFeedbackPlaceholder')}
            value={content}
            sx={fieldSx}
            onChange={e => setContent(e.target.value)}
          />
        </Box>
        <Box
          sx={{
            borderRadius: '10px',
            border: '1px solid',
            borderColor: 'divider',
            p: 2,
          }}
        >
          <TextField
            fullWidth
            multiline
            rows={2}
            size='small'
            placeholder={t('docFeedbackSuggestionPlaceholder')}
            value={suggestion}
            sx={fieldSx}
            onChange={e => setSuggestion(e.target.value)}
          />
        </Box>
      </Stack>
    </Modal>
  );
};

export default DocFeedbackModal;
