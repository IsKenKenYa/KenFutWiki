import { putApiV1App } from '@/request/App';

import { FormItem, SettingCardItem } from './Common';
import {
  DomainAppDetailResp,
  DomainConversationSetting,
} from '@/request/types';
import { PROFESSION_VERSION_PERMISSION } from '@/constant/version';
import {
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Box,
} from '@mui/material';
import { message } from '@ctzhian/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import VersionMask from '@/components/VersionMask';
import { Controller, useForm } from 'react-hook-form';
import { useAppSelector } from '@/store';

const CardQaCopyright = ({
  data,
  refresh,
}: {
  data: DomainAppDetailResp;
  refresh: (value: DomainConversationSetting) => void;
}) => {
  const { t } = useTranslation();
  const [isEdit, setIsEdit] = useState<boolean>(false);
  const { kb_id } = useAppSelector(state => state.config);
  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      copyright_hide_enabled: false,
      copyright_info: '',
    },
  });

  const copyright_hide_enabled = watch('copyright_hide_enabled');

  const onSubmit = handleSubmit(value => {
    putApiV1App(
      { id: data.id! },
      { settings: { ...data.settings, conversation_setting: value }, kb_id },
    ).then(() => {
      refresh(value);
      message.success(t('common.saveSuccess'));
      setIsEdit(false);
    });
  });

  useEffect(() => {
    setValue(
      'copyright_hide_enabled',
      data.settings?.conversation_setting?.copyright_hide_enabled ?? false,
    );
    setValue(
      'copyright_info',
      data.settings?.conversation_setting?.copyright_info ?? '',
    );
  }, [data]);

  return (
    <SettingCardItem
      title={t('setting.qaCopyrightTitle')}
      isEdit={isEdit}
      onSubmit={onSubmit}
    >
      <VersionMask
        permission={PROFESSION_VERSION_PERMISSION}
        capability='custom_branding'
      >
        <FormItem
          label={t('setting.copyrightInfo')}
          sx={{ alignItems: 'flex-start' }}
          labelSx={{ mt: 1 }}
        >
          <Controller
            control={control}
            name='copyright_hide_enabled'
            render={({ field }) => {
              return (
                <RadioGroup
                  row
                  {...field}
                  onChange={e => {
                    field.onChange(e.target.value === 'true');
                    setIsEdit(true);
                  }}
                >
                  <FormControlLabel
                    value={false}
                    control={<Radio size='small' />}
                    label={<Box sx={{ width: 100 }}>{t('setting.show')}</Box>}
                  />
                  <FormControlLabel
                    value={true}
                    control={<Radio size='small' />}
                    label={<Box sx={{ width: 100 }}>{t('setting.hide')}</Box>}
                  />
                </RadioGroup>
              );
            }}
          />
        </FormItem>
        {!copyright_hide_enabled && (
          <FormItem
            label={t('setting.copyrightText')}
            sx={{ alignItems: 'flex-start' }}
            labelSx={{ mt: 1 }}
          >
            <Controller
              control={control}
              name='copyright_info'
              render={({ field }) => (
                <TextField
                  fullWidth
                  {...field}
                  placeholder={t('qa.poweredBy')}
                  error={!!errors.copyright_info}
                  helperText={errors.copyright_info?.message}
                  onChange={event => {
                    setIsEdit(true);
                    field.onChange(event);
                  }}
                />
              )}
            />
          </FormItem>
        )}
      </VersionMask>
    </SettingCardItem>
  );
};

export default CardQaCopyright;
