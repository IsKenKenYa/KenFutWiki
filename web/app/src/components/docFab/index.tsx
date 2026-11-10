'use client';
import { useStore } from '@/provider';
import { useBasePath } from '@/hooks';
import { Modal } from '@ctzhian/ui';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import MenuIcon from '@mui/icons-material/Menu';
import {
  Fab,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Tooltip,
  Zoom,
} from '@mui/material';
import { IconFankuiwenti } from '@panda-wiki/icons';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import DocFeedbackModal from '@/components/docFeedbackModal';

const DocFab = ({ nodeId }: { nodeId?: string }) => {
  const pathname = usePathname();
  const docId = nodeId;
  const { kbDetail, mobile } = useStore();
  const [showActions, setShowActions] = useState(false);
  const [contentType, setContentType] = useState<'html' | 'md'>('html');
  const [openSelectContentTypeModal, setOpenSelectContentTypeModal] =
    useState(false);
  const [openFeedbackModal, setOpenFeedbackModal] = useState(false);
  const basePath = useBasePath();
  const t = useTranslations('doc');
  if (mobile) return null;

  const feedbackEnabled =
    kbDetail?.settings?.document_feedback_is_enabled === true;

  return (
    <>
      <DocFeedbackModal
        open={openFeedbackModal}
        nodeId={docId}
        onClose={() => setOpenFeedbackModal(false)}
      />
      <Modal
        title={t('newDocType')}
        open={openSelectContentTypeModal}
        onCancel={() => {
          setOpenSelectContentTypeModal(false);
          setContentType('html');
        }}
        onOk={() => {
          setOpenSelectContentTypeModal(false);
          window.open(
            `${basePath}/editor?contentType=${contentType}`,
            '_blank',
          );
        }}
      >
        <RadioGroup
          value={contentType}
          onChange={e => setContentType(e.target.value as 'html' | 'md')}
        >
          <FormControlLabel
            value='html'
            control={<Radio size='small' />}
            label={t('richText')}
          />
          <FormControlLabel
            value='md'
            control={<Radio size='small' />}
            label='Markdown'
          />
        </RadioGroup>
      </Modal>
      <Stack
        gap={1}
        sx={{
          position: 'fixed',
          bottom: 70,
          right: 16,
          zIndex: 10000,
        }}
        onMouseLeave={() => setShowActions(false)}
      >
        {feedbackEnabled && pathname.startsWith(basePath + '/node/') && (
          <Zoom
            in={showActions}
            style={{ transitionDelay: showActions ? '70ms' : '0ms' }}
          >
            <Tooltip title={t('docFeedbackEntry')} placement='left' arrow>
              <Fab
                color='primary'
                size='small'
                onClick={() => {
                  setOpenFeedbackModal(true);
                }}
              >
                <IconFankuiwenti sx={{ fontSize: 18 }} />
              </Fab>
            </Tooltip>
          </Zoom>
        )}
        {kbDetail?.settings.contribute_settings?.is_enable && (
          <>
            <Zoom
              in={showActions}
              style={{ transitionDelay: showActions ? '100ms' : '0ms' }}
            >
              <Tooltip title={t('createDoc')} placement='left' arrow>
                <Fab
                  color='primary'
                  size='small'
                  onClick={() => {
                    setOpenSelectContentTypeModal(true);
                  }}
                >
                  <AddIcon />
                </Fab>
              </Tooltip>
            </Zoom>
            {pathname.startsWith(basePath + '/node/') && (
              <Zoom
                in={showActions}
                style={{ transitionDelay: showActions ? '40ms' : '0ms' }}
              >
                <Tooltip title={t('editDoc')} placement='left' arrow>
                  <Fab
                    color='primary'
                    size='small'
                    onClick={() => {
                      window.open(`${basePath}/editor/${docId}`, '_blank');
                    }}
                  >
                    <EditIcon />
                  </Fab>
                </Tooltip>
              </Zoom>
            )}
            <Fab
              size='small'
              sx={{
                backgroundColor: 'background.paper2',
                color: 'text.secondary',
                '&:hover': { backgroundColor: 'background.paper2' },
              }}
              onMouseEnter={() => setShowActions(true)}
            >
              <MenuIcon
                sx={{
                  transition: 'transform 200ms',
                  transform: showActions ? 'rotate(90deg)' : 'rotate(0deg)',
                }}
              />
            </Fab>
          </>
        )}
      </Stack>
    </>
  );
};

export default DocFab;
