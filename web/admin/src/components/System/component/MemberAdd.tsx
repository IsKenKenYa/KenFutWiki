import useCapabilities from '@/features/kenfut/useCapabilities';
import { postApiV1UserCreate } from '@/request/User';
import { postApiV1KnowledgeBaseUserInvite } from '@/request/KnowledgeBase';
import Card from '@/components/Card';
import { copyText, generatePassword } from '@/utils';
import { CheckCircle } from '@mui/icons-material';
import { Box, Button, MenuItem, Select, Stack, TextField } from '@mui/material';
import { FormItem } from '@/components/Form';
import { Modal, message } from '@ctzhian/ui';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { useAppSelector } from '@/store';
import { PROFESSION_VERSION_PERMISSION } from '@/constant/version';
import { VersionCanUse } from '@/components/VersionMask';
import { ConstsUserKBPermission, V1KBUserInviteReq } from '@/request/types';
import { ConstsLicenseEdition } from '@/request/pro/types';

type Role = 'admin' | 'user';

// 文案存 i18n key，渲染时翻译
const PERM_MAP = {
  [ConstsUserKBPermission.UserKBPermissionFullControl]:
    'member.permFullControl',
  [ConstsUserKBPermission.UserKBPermissionDocManage]: 'member.permDocManage',
  [ConstsUserKBPermission.UserKBPermissionDataOperate]:
    'member.permDataOperate',
};

const MemberAdd = ({
  refresh,
  userLen,
}: {
  refresh: () => void;
  userLen: number;
}) => {
  const { t } = useTranslation();
  const [addMember, setAddMember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const { kbList, license, refreshAdminRequest } = useAppSelector(
    state => state.config,
  );

  // 各版本的管理员上限与提示（i18n key）
  const VERSION_MAP = {
    [ConstsLicenseEdition.LicenseEditionFree]: {
      message: 'member.maxAdminFree',
      max: 1,
    },
    [ConstsLicenseEdition.LicenseEditionProfession]: {
      message: 'member.maxAdminPro',
      max: 20,
    },
    [ConstsLicenseEdition.LicenseEditionBusiness]: {
      message: 'member.maxAdminBusiness',
      max: 50,
    },
  };

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm({
    defaultValues: {
      account: '',
      role: 'user' as Role,
      kb_id: '',
      perm: '' as V1KBUserInviteReq['perm'],
    },
  });

  const account = watch('account');
  const watchRole = watch('role');
  const watchKbId = watch('kb_id');

  useEffect(() => {
    if (watchKbId) {
      setValue('perm', ConstsUserKBPermission.UserKBPermissionFullControl);
    }
  }, [watchKbId]);

  const copyUserInfo = ({
    account,
    password,
  }: {
    account: string;
    password: string;
  }) => {
    copyText(
      `${t('member.accountLabel')}: ${account}\n${t('member.passwordLabel')}: ${password}`,
      () => {
        setPassword('');
        reset();
      },
    );
  };

  const onSubmit = handleSubmit(data => {
    setLoading(true);
    const password = generatePassword();
    const onSuccess = () => {
      setPassword(password);
      setAddMember(false);
      refresh();
    };
    postApiV1UserCreate({ account: data.account, password, role: data.role })
      .then(res => {
        if (data.kb_id && data.role === 'user') {
          return postApiV1KnowledgeBaseUserInvite({
            kb_id: data.kb_id,
            // @ts-expect-error 类型错误
            user_id: res.id,
            perm: data.perm,
          })
            .then(() => {
              if (location.pathname.startsWith('/setting'))
                refreshAdminRequest();
            })
            .catch(() => {
              message.error(t('member.permAssignFailed'));
            })
            .finally(onSuccess);
        }
        onSuccess();
      })
      .finally(() => {
        setLoading(false);
      });
  });

  const capabilities = useCapabilities();
  const isPro = capabilities?.admin_permissions === true;

  return (
    <>
      <Button
        size='small'
        variant='outlined'
        onClick={() => {
          const versionLimit =
            VERSION_MAP[license.edition as keyof typeof VERSION_MAP];
          const maximum =
            capabilities?.limits.max_admin ?? versionLimit?.max ?? 0;
          if (maximum > 0 && userLen >= maximum) {
            message.error(t('member.maxAdminReached', { count: maximum }));
            return;
          }
          setAddMember(true);
        }}
      >
        {t('member.addTitle')}
      </Button>
      <Modal
        title={
          <Stack direction='row' alignItems='center' gap={1}>
            <CheckCircle sx={{ color: 'success.main' }} />
            {t('member.createdTitle')}
          </Stack>
        }
        open={!!password}
        closable={false}
        cancelText={t('common.close')}
        onCancel={() => {
          setPassword('');
          reset();
        }}
        okText={t('member.copyUserInfo')}
        okButtonProps={{
          sx: { minWidth: '120px' },
        }}
        onOk={() => copyUserInfo({ account, password })}
      >
        <Card sx={{ p: 2, fontSize: 14, bgcolor: 'background.paper3' }}>
          <Stack direction={'row'}>
            <Box sx={{ width: 80 }}>{t('member.accountLabel')}</Box>
            <Box sx={{ fontWeight: 700 }}>{account}</Box>
          </Stack>
          <Stack direction={'row'} sx={{ mt: 1 }}>
            <Box sx={{ width: 80 }}>{t('member.passwordLabel')}</Box>
            <Box sx={{ fontWeight: 700 }}>{password}</Box>
          </Stack>
        </Card>
      </Modal>
      <Modal
        title={t('member.addTitle')}
        open={addMember}
        onCancel={() => {
          setAddMember(false);
          reset();
        }}
        onOk={onSubmit}
        okButtonProps={{
          loading,
        }}
      >
        <FormItem label={t('member.accountLabel')} required>
          <Controller
            control={control}
            name='account'
            rules={{
              required: {
                value: true,
                message: t('member.accountRequired'),
              },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                autoFocus
                placeholder={t('member.accountPlaceholder')}
                error={!!errors.account}
                helperText={errors.account?.message}
              />
            )}
          />
        </FormItem>

        <FormItem label={t('member.roleLabel')} required sx={{ mt: 2 }}>
          <Controller
            control={control}
            name='role'
            render={({ field }) => (
              <TextField {...field} fullWidth select>
                <MenuItem value='user'>{t('member.roleUser')}</MenuItem>
                <MenuItem value='admin'>{t('member.roleAdmin')}</MenuItem>
              </TextField>
            )}
          />
        </FormItem>

        {watchRole === 'user' && (
          <>
            <FormItem label={t('member.wikiLabel')} sx={{ mt: 2 }}>
              <Controller
                control={control}
                name='kb_id'
                render={({ field }) => (
                  <Select
                    {...field}
                    fullWidth
                    displayEmpty
                    renderValue={(value: string) =>
                      value ? (
                        kbList?.find(i => i.id === value)?.name || value
                      ) : (
                        <Box sx={{ color: '#9e9fa3' }}>
                          {t('member.selectPlaceholder')}
                        </Box>
                      )
                    }
                    sx={{ height: 52 }}
                  >
                    {kbList?.map(item => (
                      <MenuItem key={item.id} value={item.id}>
                        {item.name}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
            </FormItem>
            <FormItem label={t('member.permLabel')} sx={{ mt: 2 }}>
              <Controller
                control={control}
                name='perm'
                render={({ field }) => (
                  <Select
                    {...field}
                    fullWidth
                    displayEmpty
                    sx={{ height: 52 }}
                    MenuProps={{
                      sx: {
                        '.Mui-disabled': {
                          opacity: '1 !important',
                          color: 'text.disabled',
                        },
                      },
                    }}
                    renderValue={(value: V1KBUserInviteReq['perm']) => {
                      return value ? (
                        t(PERM_MAP[value])
                      ) : (
                        <Box sx={{ color: '#9e9fa3' }}>
                          {t('member.selectPlaceholder')}
                        </Box>
                      );
                    }}
                  >
                    <MenuItem
                      value={ConstsUserKBPermission.UserKBPermissionFullControl}
                    >
                      {t('member.permFullControl')}
                    </MenuItem>

                    <MenuItem
                      value={ConstsUserKBPermission.UserKBPermissionDocManage}
                      disabled={!isPro}
                    >
                      {t('member.permDocManage')}{' '}
                      <VersionCanUse
                        permission={PROFESSION_VERSION_PERMISSION}
                        capability='admin_permissions'
                      />
                    </MenuItem>

                    <MenuItem
                      value={ConstsUserKBPermission.UserKBPermissionDataOperate}
                      disabled={!isPro}
                    >
                      {t('member.permDataOperate')}{' '}
                      <VersionCanUse
                        permission={PROFESSION_VERSION_PERMISSION}
                        capability='admin_permissions'
                      />
                    </MenuItem>
                  </Select>
                )}
              />
            </FormItem>
          </>
        )}
      </Modal>
    </>
  );
};

export default MemberAdd;
