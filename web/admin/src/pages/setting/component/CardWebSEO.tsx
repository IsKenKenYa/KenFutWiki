import { SEOSetting } from '@/api';
import { Checkbox, TextField } from '@mui/material';
import { message } from '@ctzhian/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { DomainAppDetailResp } from '@/request/types';
import { SettingCardItem, FormItem } from './Common';
import { useAppSelector } from '@/store';
import { putApiV1App } from '@/request/App';

interface CardWebSEOProps {
  id: string;
  data: DomainAppDetailResp;
  refresh: (value: SEOSetting) => void;
}

const CardWebSEO = ({ data, id, refresh }: CardWebSEOProps) => {
  const { t } = useTranslation();
  const [isEdit, setIsEdit] = useState(false);
  const { kb_id } = useAppSelector(state => state.config);
  const {
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<SEOSetting>({
    defaultValues: {
      desc: '',
      keyword: '',
    },
  });

  const onSubmit = handleSubmit((value: SEOSetting) => {
    putApiV1App(
      { id },
      { kb_id, settings: { ...data.settings, ...value } },
    ).then(() => {
      message.success(t('common.saveSuccess'));
      refresh(value);
      setIsEdit(false);
    });
  });

  useEffect(() => {
    setValue('desc', data.settings?.desc || '');
    setValue('keyword', data.settings?.keyword || '');
  }, [data]);

  return (
    <SettingCardItem title='SEO' isEdit={isEdit} onSubmit={onSubmit}>
      <FormItem label={t('setting.siteDesc')}>
        <Controller
          control={control}
          name='desc'
          render={({ field }) => (
            <TextField
              fullWidth
              {...field}
              placeholder={t('setting.siteDescPlaceholder')}
              error={!!errors.desc}
              helperText={errors.desc?.message}
              onChange={event => {
                setIsEdit(true);
                field.onChange(event);
              }}
            />
          )}
        />
      </FormItem>

      <FormItem label={t('setting.keywords')}>
        <Controller
          control={control}
          name='keyword'
          render={({ field }) => (
            <TextField
              fullWidth
              {...field}
              placeholder={t('setting.keywordsPlaceholder')}
              error={!!errors.keyword}
              helperText={errors.keyword?.message}
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
export default CardWebSEO;
