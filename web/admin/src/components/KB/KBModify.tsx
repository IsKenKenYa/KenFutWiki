import { KnowledgeBaseListItem, updateKnowledgeBase } from '@/api';
import { useAppDispatch, useAppSelector } from '@/store';
import { setKbList } from '@/store/slices/config';
import { message, Modal } from '@ctzhian/ui';
import { TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface KBModifyProps {
  open: boolean;
  data: KnowledgeBaseListItem | null;
  onClose: () => void;
}

const KBModify = ({ open, data, onClose }: KBModifyProps) => {
  const { t } = useTranslation();
  const [kbName, setKbName] = useState(data?.name || '');
  const { kbList } = useAppSelector(state => state.config);
  const dispatch = useAppDispatch();

  const handleClose = () => {
    setKbName(data?.name || '');
    onClose();
  };

  const handleSave = () => {
    if (!data?.id) return;
    if (!kbName) {
      message.warning(t('kb.nameRequired'));
      return;
    }
    updateKnowledgeBase({ id: data.id, name: kbName }).then(() => {
      message.success(t('common.saveSuccess'));
      dispatch(
        setKbList(
          kbList?.map(item =>
            item.id === data.id ? { ...item, name: kbName } : item,
          ),
        ),
      );
      onClose();
    });
  };

  useEffect(() => {
    setKbName(data?.name || '');
  }, [data]);

  return (
    <Modal
      title={t('kb.modifyTitle')}
      open={open}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      onOk={handleSave}
      onCancel={handleClose}
    >
      <TextField
        fullWidth
        value={kbName}
        placeholder={t('kb.nameRequired')}
        onChange={e => {
          setKbName(e.target.value);
        }}
      />
    </Modal>
  );
};

export default KBModify;
