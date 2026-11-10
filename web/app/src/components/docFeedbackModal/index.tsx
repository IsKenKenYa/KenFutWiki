'use client';

import { useStore } from '@/provider';
import { submitDocumentFeedback } from '@/request/pro/docFeedback';
import {
  Box,
  Button,
  ButtonBase,
  IconButton,
  Stack,
  TextField,
} from '@mui/material';
import { Modal, message } from '@ctzhian/ui';
import CloseIcon from '@mui/icons-material/Close';
import ImageIcon from '@mui/icons-material/Image';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

// 文档反馈弹窗：读者对当前文档提交问题反馈、修改建议与截图
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
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setScreenshot(null);
    if (screenshotUrl) URL.revokeObjectURL(screenshotUrl);
    setScreenshotUrl('');
    onClose();
  };

  const handleScreenshotChange = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setScreenshot(file);
    setScreenshotUrl(URL.createObjectURL(file));
  };

  const handleRemoveScreenshot = () => {
    setScreenshot(null);
    if (screenshotUrl) URL.revokeObjectURL(screenshotUrl);
    setScreenshotUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleOk = () => {
    if (!content.trim()) {
      message.warning(t('feedbackContentRequired'));
      return;
    }
    setLoading(true);
    submitDocumentFeedback({
      node_id: nodeId,
      content: content.trim(),
      correction_suggestion: suggestion.trim() || undefined,
      screenshot: screenshot || undefined,
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
        <Stack direction='row' alignItems='center' gap={1} flexWrap='wrap'>
          <Button
            size='small'
            variant='outlined'
            startIcon={<ImageIcon />}
            onClick={() => fileInputRef.current?.click()}
          >
            {t('docFeedbackScreenshot')}
          </Button>
          {screenshot && (
            <Stack direction='row' alignItems='center' gap={0.5}>
              <ButtonBase
                disableRipple
                onClick={() => fileInputRef.current?.click()}
                sx={{ borderRadius: '6px', overflow: 'hidden' }}
              >
                <Box
                  component='img'
                  src={screenshotUrl}
                  alt=''
                  sx={{ height: 40, display: 'block' }}
                />
              </ButtonBase>
              <IconButton size='small' onClick={handleRemoveScreenshot}>
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Stack>
          )}
          <input
            ref={fileInputRef}
            type='file'
            accept='.jpg,.jpeg,.png,.webp'
            style={{ display: 'none' }}
            onChange={e => handleScreenshotChange(e.target.files)}
          />
        </Stack>
      </Stack>
    </Modal>
  );
};

export default DocFeedbackModal;
