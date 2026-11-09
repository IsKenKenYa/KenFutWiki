import { updateKnowledgeBase, UpdateKnowledgeBaseData } from '@/api';
import FileText from '@/components/UploadFile/FileText';
import { DomainKnowledgeBaseDetail } from '@/request/types';
import { message } from '@ctzhian/ui';
import { Box, Checkbox, Stack, TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { FormItem, SettingCardItem } from './Common';

const CardListen = ({
  kb,
  refresh,
}: {
  kb: DomainKnowledgeBaseDetail;
  refresh: () => void;
}) => {
  const { t } = useTranslation();
  const [isEdit, setIsEdit] = useState<boolean>(false);

  // 验证规则依赖 t，随语言切换重建
  const VALIDATION_RULES = {
    port: {
      required: {
        value: true,
        message: t('kb.portRequired'),
      },
      min: {
        value: 1,
        message: t('kb.portMin'),
      },
      max: {
        value: 65535,
        message: t('kb.portMax'),
      },
    },
    domain: {
      pattern: {
        value:
          /^(localhost|((([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)\.)+[a-zA-Z]{2,})|(\d{1,3}(?:\.\d{1,3}){3})|(\[[0-9a-fA-F:]+\]))$/,
        message: t('kb.domainInvalid'),
      },
    },
  };

  const {
    control,
    formState: { errors },
    setValue,
    watch,
    handleSubmit,
  } = useForm({
    defaultValues: {
      domain: '',
      http: false,
      https: false,
      port: 80,
      ssl_port: 443,
      httpsCert: '',
      httpsKey: '',
    },
  });

  const { http, https } = watch();

  const onSubmit = handleSubmit(value => {
    const formData: Partial<UpdateKnowledgeBaseData['access_settings']> = {};
    if (!value.http && !value.https) {
      message.error(t('kb.listenerRequired'));
      return;
    }
    if (value.domain) formData.hosts = [value.domain];
    if (value.http) formData.ports = [+value.port];
    if (value.https) {
      formData.ssl_ports = [+value.ssl_port];
      if (value.httpsCert) formData.public_key = value.httpsCert;
      else {
        message.error(t('kb.certRequired'));
        return;
      }
      if (value.httpsKey) formData.private_key = value.httpsKey;
      else {
        message.error(t('kb.keyRequired'));
        return;
      }
    }
    updateKnowledgeBase({
      id: kb.id!,
      access_settings: {
        base_url: kb.access_settings?.base_url || '',
        simple_auth: kb.access_settings?.simple_auth || null,
        ...formData,
      },
    }).then(() => {
      message.success(t('common.saveSuccess'));
      setIsEdit(false);
      refresh();
    });
  });

  useEffect(() => {
    setValue('domain', kb.access_settings?.hosts?.[0] || '');
    setValue('http', (kb.access_settings?.ports?.length || 0) > 0);
    setValue('https', (kb.access_settings?.ssl_ports?.length || 0) > 0);
    setValue('port', kb.access_settings?.ports?.[0] || 80);
    setValue('ssl_port', kb.access_settings?.ssl_ports?.[0] || 443);
    setValue('httpsCert', kb.access_settings?.public_key || '');
    setValue('httpsKey', kb.access_settings?.private_key || '');
  }, [kb]);

  return (
    <SettingCardItem
      title={t('kb.listenMode')}
      isEdit={isEdit}
      onSubmit={onSubmit}
    >
      <FormItem label={t('kb.domainOrIp')}>
        <Controller
          control={control}
          name='domain'
          rules={VALIDATION_RULES.domain}
          render={({ field }) => (
            <TextField
              {...field}
              fullWidth
              label={t('kb.domainOrIp')}
              onChange={e => {
                field.onChange(e.target.value);
                setIsEdit(true);
              }}
              error={!!errors.domain}
              helperText={errors.domain?.message}
            />
          )}
        />
      </FormItem>

      <FormItem
        label={
          <Stack direction={'row'} gap={2} alignItems={'center'}>
            <Controller
              control={control}
              name='http'
              render={({ field: { value, onChange, ...field } }) => (
                <Checkbox
                  {...field}
                  id='http'
                  checked={value}
                  onChange={e => {
                    onChange(e.target.checked);
                    setIsEdit(true);
                  }}
                  size='small'
                  sx={{ p: 0 }}
                />
              )}
            />
            <Box
              component={'label'}
              htmlFor='http'
              sx={{
                width: 120,
                flexShrink: 0,
                cursor: 'pointer',
                fontSize: 14,
                color: http ? 'text.primary' : 'text.tertiary',
              }}
            >
              {t('kb.enableHttp')}
            </Box>
          </Stack>
        }
      >
        <Controller
          control={control}
          name='port'
          rules={VALIDATION_RULES.port}
          render={({ field }) => (
            <TextField
              {...field}
              label={t('kb.httpPort')}
              fullWidth
              disabled={!http}
              onChange={e => {
                field.onChange(e.target.value);
                setIsEdit(true);
              }}
              type='number'
              value={http ? +field.value || 80 : ''}
              error={!!errors.port}
              helperText={errors.port?.message}
            />
          )}
        />
      </FormItem>

      <FormItem
        label={
          <Stack direction={'row'} gap={2} alignItems={'center'}>
            <Controller
              control={control}
              name='https'
              render={({ field: { value, onChange, ...field } }) => (
                <Checkbox
                  {...field}
                  id='https'
                  size='small'
                  checked={value}
                  onChange={e => {
                    onChange(e.target.checked);
                    setIsEdit(true);
                  }}
                  sx={{ p: 0 }}
                />
              )}
            />
            <Box
              component={'label'}
              htmlFor='https'
              sx={{
                width: 120,
                flexShrink: 0,
                cursor: 'pointer',
                fontSize: 14,
                color: https ? 'text.primary' : 'text.tertiary',
              }}
            >
              {t('kb.enableHttps')}
            </Box>
          </Stack>
        }
      >
        <Controller
          control={control}
          name='ssl_port'
          rules={VALIDATION_RULES.port}
          render={({ field }) => (
            <TextField
              {...field}
              label={t('kb.httpsPort')}
              fullWidth
              disabled={!https}
              onChange={e => {
                field.onChange(e.target.value);
                setIsEdit(true);
              }}
              type='number'
              value={https ? +field.value || 443 : ''}
              error={!!errors.ssl_port}
              helperText={errors.ssl_port?.message}
            />
          )}
        />

        <Controller
          control={control}
          name='httpsCert'
          render={({ field }) => (
            <FileText
              {...field}
              tip={t('kb.certFile')}
              disabled={!https}
              onChange={value => {
                setIsEdit(true);
                field.onChange(value);
              }}
            />
          )}
        />
        <Controller
          control={control}
          name='httpsKey'
          render={({ field }) => (
            <FileText
              {...field}
              tip={t('kb.keyFile')}
              disabled={!https}
              onChange={value => {
                setIsEdit(true);
                field.onChange(value);
              }}
            />
          )}
        />
      </FormItem>
    </SettingCardItem>
  );
};

export default CardListen;
