import { patchApiV1NavUpdate, postApiV1NavAdd } from '@/request/Nav';
import { V1NavListResp } from '@/request/types';
import { message, Modal } from '@ctzhian/ui';
import { Box, TextField } from '@mui/material';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';

type FormValues = { name: string };

interface NavEditModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (updated?: { id: string; name: string }) => void;
  nav: V1NavListResp | null;
  kb_id: string;
}

const NavEditModal = ({
  open,
  onClose,
  onSuccess,
  nav,
  kb_id,
}: NavEditModalProps) => {
  const { t } = useTranslation();
  const isEdit = !!nav;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { name: '' },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      name: nav?.name || '',
    });
  }, [open, nav, reset]);

  const submit = (value: FormValues) => {
    if (isEdit && nav?.id) {
      patchApiV1NavUpdate({
        id: nav.id,
        kb_id,
        name: value.name,
      }).then(() => {
        message.success(t('common.saveSuccess'));
        onSuccess({ id: nav.id!, name: value.name });
      });
    } else {
      postApiV1NavAdd({
        kb_id,
        name: value.name,
      }).then(() => {
        message.success(t('nav.addSuccess'));
        onSuccess();
      });
    }
  };

  return (
    <Modal
      title={isEdit ? t('nav.editTitle') : t('nav.addTitle')}
      open={open}
      width={400}
      okText={isEdit ? t('common.save') : t('nav.add')}
      onCancel={onClose}
      onOk={handleSubmit(submit)}
    >
      <Box sx={{ fontSize: 14, lineHeight: '36px' }}>{t('nav.nameLabel')}</Box>
      <Controller
        control={control}
        name='name'
        rules={{ required: t('nav.nameRequired') }}
        render={({ field }) => (
          <TextField
            {...field}
            fullWidth
            autoFocus
            size='small'
            placeholder={t('nav.nameRequired')}
            error={!!errors.name}
            helperText={errors.name?.message}
          />
        )}
      />
    </Modal>
  );
};

export default NavEditModal;
