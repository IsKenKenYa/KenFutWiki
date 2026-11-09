import SSEClient from '@/utils/fetch';
import { Editor, useTiptap, UseTiptapReturn } from '@ctzhian/tiptap';
import { Modal } from '@ctzhian/ui';
import { Box, Button, Divider, Stack } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface AIGenerateProps {
  open: boolean;
  selectText: string;
  onClose: () => void;
  editorRef: UseTiptapReturn;
}

// 语言自称（self-naming）不做翻译
const LANG_TARGETS: { value: string; label: string }[] = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
];

const AIGenerate = ({
  open,
  selectText,
  onClose,
  editorRef,
}: AIGenerateProps) => {
  const { t } = useTranslation();
  const sseClientRef = useRef<SSEClient<string> | null>(null);

  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');
  // null = 润色；'zh'/'en' = 翻译到目标语言
  const [targetLang, setTargetLang] = useState<null | string>(null);

  const defaultEditor = useTiptap({
    editable: false,
    baseUrl: window.__BASENAME__ || '',
  });

  const readEditor = useTiptap({
    editable: false,
    baseUrl: window.__BASENAME__ || '',
  });

  const onGenerate = useCallback(
    (lang: null | string) => {
      const client = sseClientRef.current;
      if (client) {
        setLoading(true);
        client.subscribe(
          JSON.stringify({
            text: selectText,
            action: lang == null ? 'rephrase' : 'translate',
            ...(lang == null ? {} : { target_lang: lang }),
            stream: true,
          }),
          data => {
            setContent(prev => {
              const newContent = prev + data;
              readEditor?.setContent(newContent);
              return newContent;
            });
          },
        );
      }
    },
    [selectText, readEditor],
  );

  const onCancel = () => {
    sseClientRef.current?.unsubscribe();
    defaultEditor?.setContent('');
    readEditor?.setContent('');
    setContent('');
    setTargetLang(null);
    onClose();
  };

  const onSubmit = () => {
    const { from, to } = editorRef.editor.state.selection;
    editorRef.editor.commands.insertContentAt({ from, to }, content);
    onCancel();
  };

  useEffect(() => {
    if (!open) return;
    sseClientRef.current = new SSEClient<string>({
      url: '/api/v1/creation/text',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('kfw_admin_token')}`,
      },
      onComplete: () => setLoading(false),
      onError: () => setLoading(false),
    });
    if (selectText) {
      defaultEditor?.setContent(selectText);
      setTimeout(() => {
        onGenerate(targetLang);
      }, 60);
    }
    return () => {
      sseClientRef.current?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectText, open]);

  // 切换目标语言：终止当前流并重新生成
  const handleSwitchLang = (lang: null | string) => {
    if (lang === targetLang) return;
    sseClientRef.current?.unsubscribe();
    setLoading(true);
    setContent('');
    readEditor?.setContent('');
    setTargetLang(lang);
    sseClientRef.current?.subscribe(
      JSON.stringify({
        text: selectText,
        action: lang == null ? 'rephrase' : 'translate',
        ...(lang == null ? {} : { target_lang: lang }),
        stream: true,
      }),
      data => {
        setContent(prev => {
          const newContent = prev + data;
          readEditor?.setContent(newContent);
          return newContent;
        });
      },
    );
  };

  useEffect(() => {
    return () => {
      defaultEditor?.editor.destroy();
      readEditor?.editor.destroy();
      sseClientRef.current?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      title={t('editor.aiPolish')}
      okText={t('editor.replace')}
      width={1000}
      onOk={onSubmit}
      okButtonProps={{
        loading,
        disabled: content.length === 0,
      }}
    >
      <Stack
        direction={'row'}
        sx={{
          '.tiptap.ProseMirror': {
            padding: '0px',
          },
        }}
      >
        <Stack
          sx={{
            width: '50%',
            flex: 1,
          }}
        >
          <Stack
            direction='row'
            alignItems='center'
            sx={{ mb: 0.5, ml: 1, gap: 1 }}
          >
            <Box
              sx={{
                fontSize: 14,
                fontWeight: 'bold',
                color: 'text.tertiary',
              }}
            >
              {t('editor.sourceText')}
            </Box>
          </Stack>
          <Box
            sx={{
              borderRadius: '10px',
              p: 2,
              bgcolor: 'background.paper3',
              flex: 1,
            }}
          >
            <Editor editor={defaultEditor.editor} />
          </Box>
        </Stack>
        <Divider orientation='vertical' flexItem sx={{ mx: 2 }} />
        <Stack sx={{ width: '50%', flex: 1 }}>
          <Stack
            direction='row'
            alignItems='center'
            spacing={1}
            sx={{ mb: 0.5, ml: 1 }}
          >
            <Box
              sx={{
                fontSize: 14,
                fontWeight: 'bold',
                color: 'text.tertiary',
              }}
            >
              {targetLang == null
                ? t('editor.polished')
                : t('editor.translated')}
            </Box>
            <Button
              size='small'
              variant={targetLang == null ? 'contained' : 'outlined'}
              onClick={() => handleSwitchLang(null)}
            >
              {t('editor.polish')}
            </Button>
            {LANG_TARGETS.map(option => (
              <Button
                key={option.value}
                size='small'
                variant={targetLang === option.value ? 'contained' : 'outlined'}
                onClick={() => handleSwitchLang(option.value)}
              >
                {t('editor.translateTo', { lang: option.label })}
              </Button>
            ))}
          </Stack>
          <Box
            sx={{
              borderRadius: '10px',
              p: 2,
              bgcolor: 'background.paper3',
              flex: 1,
            }}
          >
            <Editor editor={readEditor.editor} />
          </Box>
        </Stack>
      </Stack>
    </Modal>
  );
};

export default AIGenerate;
