import Card from '@/components/Card';
import { putApiV1UserResetPassword } from '@/request/User';
import { V1UserListItemResp } from '@/request/types';
import { copyText, generatePassword } from '@/utils';
import { Modal } from '@ctzhian/ui';
import { CheckCircle } from '@mui/icons-material';
import { Box, IconButton, Stack, TextField } from '@mui/material';
import { IconShuaxin } from '@panda-wiki/icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';

type UpdateMemberProps = {
  user: V1UserListItemResp;
  refresh: () => void;
  type: 'reset' | 'update';
};

const MemberUpdate = ({ user, refresh, type }: UpdateMemberProps) => {
  const { t } = useTranslation();
  const [updateOpen, setUpdateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm({
    defaultValues: {
      password: '',
    },
  });

  const close = () => {
    setResetOpen(false);
    setUpdateOpen(false);
    setPassword('');
    reset();
    setLoading(false);
    refresh();
  };

  const copyUserInfo = () => {
    copyText(
      `${t('member.accountLabel')}: ${user.account}\n${t('member.passwordLabel')}: ${password}`,
      close,
    );
  };

  const onSumbit = (data: { password: string }) => {
    setLoading(true);
    putApiV1UserResetPassword({ id: user.id!, new_password: data.password })
      .then(() => {
        setPassword(data.password);
        setUpdateOpen(false);
        setResetOpen(true);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (type === 'reset') {
      const password = generatePassword();
      setPassword(password);
    }
    setUpdateOpen(true);
  }, [user, type]);

  return (
    <>
      <Modal
        title={
          <Stack direction='row' alignItems='center' gap={1}>
            <CheckCircle sx={{ color: 'success.main' }} />
            {t('member.passwordChanged')}
          </Stack>
        }
        open={resetOpen}
        onCancel={close}
        okText={t('member.copyUserInfo')}
        cancelText={t('common.close')}
        closable={false}
        okButtonProps={{ sx: { minWidth: '120px' } }}
        onOk={copyUserInfo}
      >
        <Card sx={{ p: 2, fontSize: 14, bgcolor: 'background.paper3' }}>
          <Stack direction={'row'}>
            <Box sx={{ width: 80 }}>{t('member.accountLabel')}</Box>
            <Box sx={{ fontWeight: 700 }}>{user.account}</Box>
          </Stack>
          <Stack direction={'row'} sx={{ mt: 1 }}>
            <Box sx={{ width: 80 }}>{t('member.newPassword')}</Box>
            <Box sx={{ fontWeight: 700 }}>{password}</Box>
          </Stack>
        </Card>
      </Modal>
      <Modal
        title={
          type === 'reset' ? t('member.resetTitle') : t('member.changeTitle')
        }
        open={updateOpen}
        onOk={handleSubmit(onSumbit)}
        onCancel={close}
        okButtonProps={{
          loading,
        }}
      >
        <Box sx={{ fontSize: 14, lineHeight: '32px' }}>
          {t('member.accountLabel')}{' '}
          <Box component={'span'} sx={{ color: 'red', mb: 1 }}>
            *
          </Box>
        </Box>
        <Box
          sx={{
            lineHeight: '36px',
            bgcolor: 'background.paper3',
            px: '14px',
            borderRadius: '10px',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'not-allowed',
          }}
        >
          {user.account}
        </Box>
        <Box sx={{ fontSize: 14, lineHeight: '32px', mt: 2, mb: 1 }}>
          {t('member.passwordLabel')}{' '}
          <Box component={'span'} sx={{ color: 'red' }}>
            *
          </Box>
        </Box>
        <Stack direction={'row'} alignItems={'center'} gap={2}>
          <Controller
            control={control}
            name='password'
            rules={{
              required: {
                value: true,
                message: t('member.passwordRequired'),
              },
              minLength: {
                value: 8,
                message: t('member.passwordMinLength'),
              },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                autoFocus
                size='small'
                placeholder={t('member.passwordPlaceholder')}
                error={!!errors.password}
                helperText={errors.password?.message}
              />
            )}
          />
          <IconButton
            color='primary'
            size='small'
            onClick={() => setValue('password', generatePassword())}
            sx={{ flexShrink: 0 }}
          >
            <IconShuaxin sx={{ fontSize: 16 }} />
          </IconButton>
        </Stack>
      </Modal>
    </>
  );
};

export default MemberUpdate;
