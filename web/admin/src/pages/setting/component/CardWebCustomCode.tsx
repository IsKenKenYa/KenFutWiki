import { CustomCodeSetting } from '@/api';
import { TextField } from '@mui/material';
import { message } from '@ctzhian/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { DomainKnowledgeBaseDetail } from '@/request/types';
import { SettingCardItem, FormItem } from './Common';
import { useAppSelector } from '@/store';
import { putApiV1App } from '@/request/App';

interface CardWebCustomCodeProps {
  id: string;
  data: DomainKnowledgeBaseDetail;
  refresh: (value: CustomCodeSetting) => void;
}

const CardWebCustomCode = ({ id, data, refresh }: CardWebCustomCodeProps) => {
  const { t } = useTranslation();
  const [isEdit, setIsEdit] = useState(false);
  const { kb_id } = useAppSelector(state => state.config);
  const {
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      head_code: '',
      body_code: '',
    },
  });

  const onSubmit = handleSubmit((value: CustomCodeSetting) => {
    putApiV1App(
      { id },
      // @ts-expect-error 类型不匹配
      { kb_id, settings: { ...data.settings, ...value } },
    ).then(() => {
      message.success(t('common.saveSuccess'));
      refresh(value);
      setIsEdit(false);
    });
  });

  useEffect(() => {
    // @ts-expect-error 类型不匹配
    setValue('head_code', data.settings?.head_code || '');
    // @ts-expect-error 类型不匹配
    setValue('body_code', data.settings?.body_code || '');
  }, [data]);

  return (
    <SettingCardItem
      title={t('setting.customCode')}
      isEdit={isEdit}
      onSubmit={onSubmit}
    >
      <FormItem label={t('setting.headCode')} sx={{ alignItems: 'flex-start' }}>
        <Controller
          control={control}
          name='head_code'
          render={({ field }) => (
            <TextField
              sx={{ fontFamily: 'monospace' }}
              fullWidth
              multiline
              rows={4}
              {...field}
              placeholder={t('setting.headCodePlaceholder')}
              error={!!errors.head_code}
              helperText={errors.head_code?.message}
              onChange={event => {
                setIsEdit(true);
                field.onChange(event);
              }}
            />
          )}
        />
      </FormItem>

      <FormItem label={t('setting.bodyCode')} sx={{ alignItems: 'flex-start' }}>
        <Controller
          control={control}
          name='body_code'
          render={({ field }) => (
            <TextField
              sx={{ fontFamily: 'monospace' }}
              fullWidth
              {...field}
              multiline
              rows={4}
              placeholder={t('setting.bodyCodePlaceholder')}
              error={!!errors.body_code}
              helperText={errors.body_code?.message}
              onChange={event => {
                setIsEdit(true);
                field.onChange(event);
              }}
            />
          )}
        />
      </FormItem>
    </SettingCardItem>
  );
};
export default CardWebCustomCode;
