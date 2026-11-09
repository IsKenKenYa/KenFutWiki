import { postApiV1NodeAction } from '@/request/Node';
import { DomainNodeListItemResp } from '@/request/types';
import Card from '@/components/Card';
import DragTree from '@/components/Drag/DragTree';
import { convertToTree } from '@/utils/drag';
import { filterEmptyFolders } from '@/utils/tree';
import ErrorIcon from '@mui/icons-material/Error';
import { Stack, Typography } from '@mui/material';
import { message, Modal } from '@ctzhian/ui';
import { useTranslation } from 'react-i18next';

interface DocStatusProps {
  open: boolean;
  status: 'delete';
  kb_id: string;
  onClose: () => void;
  data: DomainNodeListItemResp[];
  refresh?: () => void;
}

// 文案存 i18n key，渲染时按当前语言翻译
const textMap = {
  public: {
    title: 'doc.status.publicTitle',
    text: 'doc.status.publicText',
    btn: 'doc.status.publicBtn',
    doneText: 'doc.status.publicDone',
  },
  private: {
    title: 'doc.status.privateTitle',
    text: 'doc.status.privateText',
    btn: 'doc.status.privateBtn',
    doneText: 'doc.status.privateDone',
  },
};

const DocStatus = ({
  open,
  status,
  kb_id,
  onClose,
  data,
  refresh,
}: DocStatusProps) => {
  const { t } = useTranslation();
  const submit = () => {
    postApiV1NodeAction({
      ids: data.map(it => it.id!),
      kb_id,
      action: status,
    }).then(() => {
      message.success(t('common.saveSuccess'));
      onClose();
      refresh?.();
    });
  };

  if (!open) return <></>;

  const tree = filterEmptyFolders(
    convertToTree(data.filter(it => it.type === 1)),
  );

  return (
    <Modal
      title={
        tree.length > 0 ? (
          <Stack direction='row' alignItems='center' gap={1}>
            <ErrorIcon sx={{ color: 'warning.main' }} />
            {t(textMap[status as keyof typeof textMap].title)}
          </Stack>
        ) : (
          t(textMap[status as keyof typeof textMap].btn)
        )
      }
      open={open}
      width={600}
      okText={t(textMap[status as keyof typeof textMap].btn)}
      onCancel={onClose}
      onOk={submit}
      okButtonProps={{
        disabled: tree.length === 0,
      }}
    >
      <Typography variant='body1' color='text.secondary'>
        {t(textMap[status as keyof typeof textMap].text)}
      </Typography>
      {tree.length > 0 ? (
        <Card
          sx={{
            mt: 2,
            py: 1,
            bgcolor: 'background.paper3',
            '& .dndkit-drag-handle': {
              top: '-2px !important',
            },
          }}
        >
          <DragTree data={tree} readOnly={true} supportSelect={false} />
        </Card>
      ) : (
        <Stack
          direction='row'
          alignItems='center'
          gap={0.25}
          sx={{ color: 'success.main', mt: 1, fontSize: 12 }}
        >
          <ErrorIcon sx={{ fontSize: 16 }} />
          {t(textMap[status as keyof typeof textMap].doneText)}
        </Stack>
      )}
    </Modal>
  );
};

export default DocStatus;
