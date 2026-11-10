import {
  Box,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
} from '@mui/material';
import { message } from '@ctzhian/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import {
  DomainKnowledgeBaseDetail,
  DomainAppDetailResp,
} from '@/request/types';
import { getApiV1AppDetail, putApiV1App } from '@/request/App';
import { FormItem, SettingCardItem, SecretTextField } from './Common';
import { useAppSelector } from '@/store';

const CardRobotDiscord = ({ kb }: { kb: DomainKnowledgeBaseDetail }) => {
  const { t } = useTranslation();
  const [isEdit, setIsEdit] = useState(false);
  const [detail, setDetail] = useState<DomainAppDetailResp | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const { kb_id } = useAppSelector(state => state.config);
  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    defaultValues: {
      discord_bot_is_enabled: false,
      discord_bot_token: '',
    },
  });

  const getDetail = () => {
    getApiV1AppDetail({ kb_id: kb.id!, type: '7' }).then(res => {
      setDetail(res);
      setIsEnabled(res.settings?.discord_bot_is_enabled ?? false);
      reset({
        discord_bot_is_enabled: res.settings?.discord_bot_is_enabled ?? false,
        discord_bot_token: res.settings?.discord_bot_token ?? '',
      });
    });
  };

  const onSubmit = handleSubmit(data => {
    if (!detail) return;
    putApiV1App(
      { id: detail.id! },
      {
        kb_id,
        settings: {
          discord_bot_is_enabled: data.discord_bot_is_enabled,
          discord_bot_token: data.discord_bot_token,
        },
      },
    ).then(() => {
      message.success(t('common.saveSuccess'));
      setIsEdit(false);
      getDetail();
      reset();
    });
  });

  useEffect(() => {
    getDetail();
  }, [kb]);

  return (
    <SettingCardItem
      title={t('enum.appType.discord')}
      isEdit={isEdit}
      onSubmit={onSubmit}
    >
      <FormItem label={t('enum.appType.discord')}>
        <Controller
          control={control}
          name='discord_bot_is_enabled'
          render={({ field }) => (
            <RadioGroup
              row
              {...field}
              onChange={e => {
                field.onChange(e.target.value === 'true');
                setIsEnabled(e.target.value === 'true');
                setIsEdit(true);
              }}
            >
              <FormControlLabel
                value={true}
                control={<Radio size='small' />}
                label={<Box sx={{ width: 100 }}>{t('common.enable')}</Box>}
              />
              <FormControlLabel
                value={false}
                control={<Radio size='small' />}
                label={<Box sx={{ width: 100 }}>{t('common.disable')}</Box>}
              />
            </RadioGroup>
          )}
        />
      </FormItem>

      {isEnabled && (
        <FormItem label='Token' required>
          <Controller
            control={control}
            name='discord_bot_token'
            rules={{
              required: 'Token',
            }}
            render={({ field }) => (
              <SecretTextField
                {...field}
                fullWidth
                placeholder={t('robot.discordTokenHint')}
                onChange={e => {
                  field.onChange(e.target.value);
                  setIsEdit(true);
                }}
                error={!!errors.discord_bot_token}
                helperText={errors.discord_bot_token?.message}
              />
            )}
          />{' '}
        </FormItem>
      )}
    </SettingCardItem>
  );
};

export default CardRobotDiscord;
