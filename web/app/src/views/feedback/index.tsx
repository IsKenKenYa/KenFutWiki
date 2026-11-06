'use client';
import feedback from '@/assets/images/feedback.png';
import Footer from '@/components/footer';
import { useStore } from '@/provider';
import { postShareV1ChatFeedback } from '@/request/ShareChat';
import { DomainFeedbackRequest } from '@/request/types';
import { Box, Button, Stack, TextField } from '@mui/material';
import { message } from '@ctzhian/ui';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

const Feedback = () => {
  const t = useTranslations('feedback');
  const searchParams = useSearchParams();
  const { kbDetail } = useStore();
  const message_id = searchParams.get('message_id') || '';
  const conversation_id = searchParams.get('conversation_id') || '';
  const score = parseInt(searchParams.get('score') || '-1') as -1 | 1;

  const tags: string[] =
    // @ts-ignore
    kbDetail?.settings?.ai_feedback_settings?.ai_feedback_type || [];

  const [type, setType] = useState<string>('');
  const [content, setContent] = useState('');
  const [success, setSuccess] = useState(score === 1);

  const handleSubmit = async () => {
    const data: DomainFeedbackRequest = {
      conversation_id,
      message_id,
      score,
      type,
      feedback_content: content,
    };
    await postShareV1ChatFeedback(data);
    setSuccess(true);
    message.success(t('success'));
  };

  useEffect(() => {
    if (score === 1) {
      // setSuccess 在 await 之后才触发，并非同步 setState
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleSubmit();
    }
  }, [score]);

  return (
    <>
      <Box
        sx={{
          width: '100vw',
          height: 'calc(100vh - 40px)',
          p: 3,
        }}
      >
        {success ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
            }}
          >
            <Image src={feedback.src} alt='success' width={300} height={300} />
            <Box
              sx={{
                fontSize: 16,
                mt: 2,
              }}
            >
              感谢您的反馈！
            </Box>
          </Box>
        ) : (
          <Box>
            <Box
              sx={{
                fontSize: 16,
                fontWeight: 'bold',
                mb: 2,
              }}
            >
              问题类型
            </Box>
            <Stack
              direction='row'
              spacing={2}
              sx={{
                flexWrap: 'wrap',
                mb: 4,
              }}
            >
              {tags.map(tag => (
                <Box
                  key={tag}
                  sx={{
                    py: 0.75,
                    px: 2,
                    fontSize: 12,
                    borderRadius: '10px',
                    border: '1px solid',
                    borderColor: type === tag ? 'primary.main' : 'divider',
                    cursor: 'pointer',
                    color: type === tag ? 'primary.main' : 'text.primary',
                    bgcolor: 'background.paper3',
                  }}
                  onClick={() => {
                    setType(tag);
                  }}
                >
                  {tag}
                </Box>
              ))}
            </Stack>
            <Box
              sx={{
                fontSize: 16,
                fontWeight: 'bold',
                my: 2,
              }}
            >
              反馈内容
            </Box>
            <Box
              sx={{
                borderRadius: '10px',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper3',
                p: 2,
              }}
            >
              <TextField
                fullWidth
                multiline
                rows={8}
                size='small'
                placeholder={t('placeholder')}
                value={content}
                sx={{
                  '.MuiInputBase-root': {
                    p: 0,
                    overflow: 'hidden',
                    transition: 'all 0.5s ease-in-out',
                  },
                  textarea: {
                    lineHeight: '26px',
                    borderRadius: 0,
                    transition: 'all 0.5s ease-in-out',
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
                }}
                onChange={e => setContent(e.target.value)}
              />
            </Box>
            <Button
              variant='contained'
              fullWidth
              color='primary'
              sx={{
                mt: 4,
                height: 50,
              }}
              onClick={handleSubmit}
            >
              提交
            </Button>
          </Box>
        )}
      </Box>
      <Box
        sx={{
          height: 40,
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
        }}
      >
        <Footer showBrand={false} />
      </Box>
    </>
  );
};

export default Feedback;
