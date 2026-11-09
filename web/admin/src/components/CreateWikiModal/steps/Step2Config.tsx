import React, { useState, useImperativeHandle, Ref, useEffect } from 'react';
import {
  Checkbox,
  FormControlLabel,
  TextField,
  Typography,
  Stack,
  FormControl,
  FormHelperText,
} from '@mui/material';
import {
  getApiV1KnowledgeBaseList,
  getApiV1KnowledgeBaseDetail,
  postApiV1KnowledgeBase,
} from '@/request/KnowledgeBase';
import { DomainCreateKnowledgeBaseReq } from '@/request/types';
import { setKbId, setKbList, setKbDetail } from '@/store/slices/config';
import { SettingCardItem, FormItem } from '@/pages/setting/component/Common';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import FileText from '@/components/UploadFile/FileText';
import { message } from '@ctzhian/ui';
import { useAppDispatch } from '@/store';

interface Step2ConfigProps {
  ref: Ref<{ onSubmit: () => Promise<unknown> }>;
}

const Step2Config: React.FC<Step2ConfigProps> = ({ ref }) => {
  const { t } = useTranslation();
  // 验证规则依赖 t，随语言切换重建
  const VALIDATION_RULES = {
    name: {
      required: {
        value: true,
        message: t('kb.nameEmpty'),
      },
    },
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
    http: {
      validate: (
        value: boolean,
        formValues: { http: boolean; https: boolean },
      ) => {
        if (!value && !formValues.https) {
          return t('kb.listenerRequired');
        }
        return true;
      },
    },
    https: {
      validate: (
        value: boolean,
        formValues: { http: boolean; https: boolean },
      ) => {
        if (!value && !formValues.http) {
          return t('kb.listenerRequired');
        }
        return true;
      },
    },
  };

  const {
    control,
    formState: { errors },
    trigger,
    watch,
    reset,
    getValues,
  } = useForm({
    defaultValues: {
      name: '',
      domain: window.location.hostname,
      port: 80,
      ssl_port: 443,
      httpsCert: '',
      httpsKey: '',
      http: true,
      https: false,
    },
  });

  const { http, https } = watch();

  useEffect(() => {
    return () => {
      reset();
    };
  }, []);

  const dispatch = useAppDispatch();

  const getKb = (id?: string) => {
    const kb_id = id || localStorage.getItem('kb_id') || '';
    return Promise.all([
      getApiV1KnowledgeBaseList().then(res => {
        dispatch(setKbList(res));
        if (res.find(item => item.id === kb_id)) {
          dispatch(setKbId(kb_id));
        } else {
          dispatch(setKbId(res[0]?.id || ''));
        }
      }),
      getApiV1KnowledgeBaseDetail({ id: kb_id }).then(res => {
        dispatch(setKbDetail(res));
      }),
    ]);
  };

  const onSubmit = async () => {
    const isRHFValid = await trigger();
    if (!isRHFValid) {
      return Promise.reject();
    } else {
      const value = getValues();
      if (!value.http && !value.https) {
        message.error(t('kb.listenerRequired'));
        return Promise.reject(new Error('listener required'));
      }
      const formData: DomainCreateKnowledgeBaseReq = { name: value.name };
      if (value.domain) formData.hosts = [value.domain];
      if (value.http) formData.ports = [+value.port];
      if (value.https) {
        formData.ssl_ports = [+value.ssl_port];
        if (value.httpsCert) formData.public_key = value.httpsCert;
        if (value.httpsKey) formData.private_key = value.httpsKey;
      }

      return (
        postApiV1KnowledgeBase(formData)
          // @ts-expect-error 类型错误
          .then(({ id }) => {
            return getKb(id).then(() => {
              // message.success('创建成功');
            });
          })
      );
    }
  };

  useImperativeHandle(ref, () => ({
    onSubmit,
  }));

  return (
    <>
      <SettingCardItem title={t('kb.wikiSection')}>
        {/* Knowledge Base Name Section */}
        <FormItem
          label={t('kb.nameShortLabel')}
          required
          labelWidth={100}
          sx={{ alignItems: 'flex-start' }}
          labelSx={{ height: 52 }}
        >
          <Controller
            control={control}
            name='name'
            rules={VALIDATION_RULES.name}
            render={({ field }) => (
              <TextField
                {...field}
                autoFocus
                placeholder={t('common.enter')}
                fullWidth
                error={!!errors.name}
                helperText={errors.name?.message}
              />
            )}
          />
        </FormItem>
      </SettingCardItem>
      <SettingCardItem title={t('kb.listenMode')}>
        <FormItem
          label={t('kb.domainOrIp')}
          labelWidth={100}
          sx={{ alignItems: 'flex-start' }}
          labelSx={{ height: 52 }}
        >
          <Controller
            control={control}
            name='domain'
            rules={VALIDATION_RULES.domain}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                placeholder={t('common.enter')}
                error={!!errors.domain}
                helperText={errors.domain?.message}
              />
            )}
          />
        </FormItem>
        <FormItem
          label={t('kb.httpPort')}
          labelWidth={100}
          sx={{ alignItems: 'flex-start' }}
          labelSx={{ height: 52 }}
        >
          <Stack direction='row' gap={2} sx={{ flex: 1 }}>
            <FormControl error={!!errors.http}>
              <Controller
                control={control}
                name='http'
                // rules={VALIDATION_RULES.http}
                render={({ field }) => (
                  <FormControlLabel
                    sx={{ mr: 0, height: 52 }}
                    control={
                      <Checkbox
                        checked={field.value}
                        onChange={e => field.onChange(e.target.checked)}
                        sx={{ padding: '4px' }}
                      />
                    }
                    label={
                      <Typography sx={{ fontSize: '14px', minWidth: '30px' }}>
                        {t('common.enable')}
                      </Typography>
                    }
                  />
                )}
              />
              {/* {errors.http && (
                <FormHelperText>{errors.http.message}</FormHelperText>
              )} */}
            </FormControl>

            <Controller
              control={control}
              name='port'
              rules={VALIDATION_RULES.port}
              render={({ field }) => (
                <TextField
                  {...field}
                  placeholder={t('kb.httpPort')}
                  disabled={!http}
                  fullWidth
                  error={!!errors.port}
                  helperText={errors.port?.message}
                />
              )}
            />
          </Stack>
        </FormItem>
        <FormItem
          label={t('kb.httpsPort')}
          labelWidth={100}
          sx={{ alignItems: 'flex-start' }}
          labelSx={{ height: 52 }}
        >
          <Stack direction='row' gap={2} sx={{ flex: 1 }}>
            <FormControl error={!!errors.https}>
              <Controller
                control={control}
                name='https'
                // rules={VALIDATION_RULES.https}
                render={({ field }) => (
                  <FormControlLabel
                    sx={{ mr: 0, height: 52 }}
                    control={
                      <Checkbox
                        checked={field.value}
                        onChange={e => field.onChange(e.target.checked)}
                        sx={{ padding: '4px' }}
                      />
                    }
                    label={
                      <Typography sx={{ fontSize: '14px', minWidth: '30px' }}>
                        {t('common.enable')}
                      </Typography>
                    }
                  />
                )}
              />
              {/* {errors.https && (
                <FormHelperText>{errors.https.message}</FormHelperText>
              )} */}
            </FormControl>

            <Controller
              control={control}
              name='ssl_port'
              rules={VALIDATION_RULES.port}
              render={({ field }) => (
                <TextField
                  {...field}
                  placeholder={t('kb.httpsPort')}
                  disabled={!https}
                  sx={{ width: 137 }}
                  error={!!errors.ssl_port}
                  helperText={errors.ssl_port?.message}
                />
              )}
            />

            <FormControl error={!!errors.httpsCert} sx={{ width: 137 }}>
              <Controller
                control={control}
                name='httpsCert'
                rules={{ required: https ? t('kb.uploadRequired') : false }}
                render={({ field }) => (
                  <FileText
                    {...field}
                    sx={{ width: 137 }}
                    textSx={{ fontSize: 14 }}
                    tip={t('kb.certFile')}
                    disabled={!https}
                  />
                )}
              />
              {errors.httpsCert && (
                <FormHelperText>{errors.httpsCert.message}</FormHelperText>
              )}
            </FormControl>
            <FormControl error={!!errors.httpsKey} sx={{ width: 137 }}>
              <Controller
                control={control}
                name='httpsKey'
                rules={{ required: https ? t('kb.uploadRequired') : false }}
                render={({ field }) => (
                  <FileText
                    {...field}
                    sx={{ width: 137 }}
                    textSx={{ fontSize: 14 }}
                    tip={t('kb.keyFile')}
                    disabled={!https}
                  />
                )}
              />
              {errors.httpsKey && (
                <FormHelperText>{errors.httpsKey.message}</FormHelperText>
              )}
            </FormControl>
          </Stack>
        </FormItem>
      </SettingCardItem>
    </>
  );
};

export default Step2Config;
