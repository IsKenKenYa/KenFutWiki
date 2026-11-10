import { getApiProV1ContributeDetail } from '@/request/pro/Contribute';
import type { GithubComChaitinPandaWikiProApiContributeV1ContributeItem } from '@/request/pro/types';
import {
  ConstsContributeStatus,
  ConstsContributeType,
  GithubComChaitinPandaWikiProApiContributeV1ContributeDetailResp,
} from '@/request/pro/types';
import { useAppSelector } from '@/store';
import { Editor, EditorDiff, useTiptap } from '@ctzhian/tiptap';
import { Modal } from '@ctzhian/ui';
import { Box, Button, Divider, Stack, Typography } from '@mui/material';
import { IconWenjian } from '@panda-wiki/icons';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type ContributePreviewModalProps = {
  open: boolean;
  row: GithubComChaitinPandaWikiProApiContributeV1ContributeItem | null;
  onClose: () => void;
  onAccept: () => void;
  onReject: () => void;
};

export default function ContributePreviewModal(
  props: ContributePreviewModalProps,
) {
  const [activeTab, setActiveTab] = useState('diff');
  const { t } = useTranslation();
  const { open, row, onClose, onAccept, onReject } = props;
  const { kb_id = '' } = useAppSelector(state => state.config);
  const [data, setData] =
    useState<GithubComChaitinPandaWikiProApiContributeV1ContributeDetailResp | null>(
      null,
    );

  const editorRef = useTiptap({
    content: '',
    editable: false,
    immediatelyRender: true,
    baseUrl: window.__BASENAME__ || '',
  });

  useEffect(() => {
    if (open && row) {
      getApiProV1ContributeDetail({ id: row.id!, kb_id }).then(res => {
        setData(res);
      });
    }
  }, [open, row, kb_id]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === 'content') {
      editorRef.setContent(data?.content || '');
    } else if (value === 'old_content') {
      editorRef.setContent(data?.original_node?.content || '');
    } else if (value === 'diff') {
      editorRef.setContent('');
    }
  };

  useEffect(() => {
    if (open) {
      handleTabChange('diff');
      setData(null);
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={'1200px'}
      sx={{
        '.MuiDialogContent-root': {
          display: 'flex',
          flexDirection: 'column',
        },
      }}
      title={
        <Stack direction='row' alignItems='center' gap={2}>
          <Box>
            {t(
              row?.type === ConstsContributeType.ContributeTypeAdd
                ? 'contribution.fromUserAdd'
                : 'contribution.fromUserEdit',
              { name: row?.auth_name || t('common.anonymous') },
            )}
          </Box>
          <Box sx={{ fontSize: 14, color: 'text.tertiary', fontWeight: 400 }}>
            {dayjs(row?.created_at).fromNow()}
          </Box>
        </Stack>
      }
      footer={
        !(
          row?.type === ConstsContributeType.ContributeTypeEdit &&
          (row?.status === ConstsContributeStatus.ContributeStatusPending ||
            row?.status === ConstsContributeStatus.ContributeStatusRejected)
        ) ? (
          <Stack
            direction='row'
            gap={1}
            justifyContent='flex-end'
            sx={{ p: 3 }}
          >
            {row?.status === ConstsContributeStatus.ContributeStatusPending ? (
              <>
                <Button
                  size='small'
                  variant='outlined'
                  color='error'
                  onClick={onReject}
                >
                  {t('contribution.reject')}
                </Button>
                <Button size='small' variant='contained' onClick={onAccept}>
                  {t('contribution.accept')}
                </Button>
              </>
            ) : (
              <Button onClick={onClose} size='small' variant='contained'>
                {t('common.close')}
              </Button>
            )}
          </Stack>
        ) : null
      }
    >
      <Stack direction='row' sx={{ overflow: 'hidden', height: '100%' }}>
        <Stack
          spacing={2}
          sx={{
            overflow: 'auto',
            flex: 1,
            pr: 2,
            borderRight: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack
            direction='row'
            gap={1}
            sx={{ bgcolor: 'background.paper2', p: 1, borderRadius: '10px' }}
          >
            <Box sx={{ fontSize: 14, fontWeight: 'bold', flexShrink: 0 }}>
              {t('contribution.submitNote')}
            </Box>

            <Box sx={{ fontSize: 14, color: 'text.tertiary' }}>
              {data?.reason || '-'}
            </Box>
          </Stack>

          <Stack
            direction='row'
            alignItems='center'
            gap={1}
            sx={{ fontSize: 24, fontWeight: 700, pb: 2 }}
          >
            <IconWenjian /> {row?.node_name || '-'}
          </Stack>

          <Box sx={{ display: activeTab === 'diff' ? 'none' : 'block' }}>
            <Editor editor={editorRef.editor} />
          </Box>

          {(data?.content || data?.original_node?.content) &&
            activeTab === 'diff' && (
              <EditorDiff
                oldHtml={data?.original_node?.content || ''}
                newHtml={data?.content || ''}
                baseUrl={window.__BASENAME__ || ''}
              />
            )}
        </Stack>

        {row?.type === ConstsContributeType.ContributeTypeEdit &&
          (row?.status === ConstsContributeStatus.ContributeStatusPending ||
            row?.status ===
              ConstsContributeStatus.ContributeStatusRejected) && (
            <Stack justifyContent='space-between' sx={{ width: 220, pl: 2 }}>
              <Box>
                <Typography sx={{ fontSize: 16, fontWeight: 600, pb: 2 }}>
                  {t('contribution.compare')}
                </Typography>
                <Stack gap={2}>
                  <Button
                    size='large'
                    variant={activeTab === 'diff' ? 'contained' : 'outlined'}
                    fullWidth
                    onClick={() => handleTabChange('diff')}
                    sx={{
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      borderRadius: '10px',
                      py: 1.5,
                    }}
                  >
                    <Stack alignItems='flex-start' spacing={0.25}>
                      <Box>{t('contribution.diffView')}</Box>
                      <Typography variant='caption' sx={{ opacity: 0.8 }}>
                        {t('contribution.diffViewDesc')}
                      </Typography>
                    </Stack>
                  </Button>

                  <Button
                    size='large'
                    variant={activeTab === 'content' ? 'contained' : 'outlined'}
                    fullWidth
                    onClick={() => handleTabChange('content')}
                    sx={{
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      borderRadius: '10px',
                      py: 1.5,
                    }}
                  >
                    <Stack alignItems='flex-start' spacing={0.25}>
                      <Box>{t('contribution.afterChange')}</Box>
                      <Typography variant='caption' sx={{ opacity: 0.8 }}>
                        {t('contribution.afterChangeDesc')}
                      </Typography>
                    </Stack>
                  </Button>

                  <Button
                    size='large'
                    variant={
                      activeTab === 'old_content' ? 'contained' : 'outlined'
                    }
                    fullWidth
                    onClick={() => handleTabChange('old_content')}
                    sx={{
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      borderRadius: '10px',
                      py: 1.5,
                    }}
                  >
                    <Stack alignItems='flex-start' spacing={0.25}>
                      <Box>{t('contribution.beforeChange')}</Box>
                      <Typography variant='caption' sx={{ opacity: 0.8 }}>
                        {t('contribution.beforeChangeDesc')}
                      </Typography>
                    </Stack>
                  </Button>
                </Stack>
              </Box>

              <Box>
                <Divider sx={{ my: 3 }} />
                <Stack direction='row' gap={1} justifyContent='flex-end'>
                  {row?.status ===
                  ConstsContributeStatus.ContributeStatusPending ? (
                    <>
                      <Button
                        size='small'
                        variant='outlined'
                        color='error'
                        onClick={onReject}
                      >
                        {t('contribution.reject')}
                      </Button>
                      <Button
                        size='small'
                        variant='contained'
                        onClick={onAccept}
                      >
                        {t('contribution.accept')}
                      </Button>
                    </>
                  ) : (
                    <Button onClick={onClose} size='small' variant='contained'>
                      {t('common.close')}
                    </Button>
                  )}
                </Stack>
              </Box>
            </Stack>
          )}
      </Stack>
    </Modal>
  );
}
