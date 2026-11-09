import Card from '@/components/Card';
import DragTree from '@/components/Drag/DragTree';
import { postApiV1NodeAction } from '@/request/Node';
import { DomainNodeListItemResp } from '@/request/types';
import { useAppSelector } from '@/store';
import { convertToTree } from '@/utils/drag';
import { message, Modal } from '@ctzhian/ui';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface DocDeleteProps {
  open: boolean;
  onClose: () => void;
  data: DomainNodeListItemResp[];
  onDeleted?: (ids: string[]) => void;
}

const DocDelete = ({ open, onClose, data, onDeleted }: DocDeleteProps) => {
  const { t } = useTranslation();
  const { kb_id } = useAppSelector(state => state.config);
  if (!data) return null;

  const submit = () => {
    const ids = data.map(item => item.id!);
    postApiV1NodeAction({
      ids,
      kb_id,
      action: 'delete',
    }).then(() => {
      message.success(t('common.deleteSuccess'));
      onClose();
      onDeleted?.(ids);
    });
  };

  const tree = convertToTree(data);

  return (
    <Modal
      title={
        <Stack direction='row' alignItems='center' gap={1}>
          <ErrorOutlineIcon sx={{ color: 'warning.main' }} />
          {t('doc.deleteConfirm')}
        </Stack>
      }
      open={open}
      width={600}
      okText={t('common.delete')}
      okButtonProps={{ sx: { bgcolor: 'error.main' } }}
      onCancel={onClose}
      onOk={submit}
    >
      <Card
        sx={{
          bgcolor: 'background.paper3',
          '& .dndkit-drag-handle': {
            top: '-2px !important',
          },
        }}
      >
        <DragTree data={tree} readOnly={true} supportSelect={false} />
      </Card>
    </Modal>
  );
};

export default DocDelete;
