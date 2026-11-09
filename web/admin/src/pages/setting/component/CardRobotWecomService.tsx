import { FreeSoloAutocomplete } from '@/components/FreeSoloAutocomplete';
import ShowText from '@/components/ShowText';
import { useCommitPendingInput } from '@/hooks';
import { getApiV1AppDetail, putApiV1App } from '@/request/App';
import {
  DomainAppDetailResp,
  DomainKnowledgeBaseDetail,
} from '@/request/types';
import { useAppSelector } from '@/store';
import { message } from '@ctzhian/ui';
import { IconJinggao } from '@panda-wiki/icons';
import {
  Box,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { FormItem, SettingCardItem, SecretTextField } from './Common';
import UploadFile from '@/components/UploadFile';
import VersionMask from '@/components/VersionMask';
import { PROFESSION_VERSION_PERMISSION } from '@/constant/version';

const CardRobotWecomService = ({
  kb,
  url,
}: {
  kb: DomainKnowledgeBaseDetail;
  url: string;
}) => {
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
    watch,
    setValue,
  } = useForm({
    defaultValues: {
      wechat_service_is_enabled: false,
      wechat_service_secret: '',
      wechat_service_token: '',
      wechat_service_encodingaeskey: '',
      wechat_service_corpid: '',
      wechat_service_contain_keywords: [] as string[],
      wechat_service_equal_keywords: [] as string[],
      wechat_service_logo: '',
    },
  });

  const getDetail = () => {
    getApiV1AppDetail({ kb_id: kb.id!, type: '6' }).then(res => {
      setDetail(res);
      setIsEnabled(res.settings?.wechat_service_is_enabled ?? false);
      reset({
        wechat_service_is_enabled:
          res.settings?.wechat_service_is_enabled ?? false,
        wechat_service_logo: res.settings?.wechat_service_logo ?? '',
        wechat_service_secret: res.settings?.wechat_service_secret ?? '',
        wechat_service_token: res.settings?.wechat_service_token ?? '',
        wechat_service_encodingaeskey:
          res.settings?.wechat_service_encodingaeskey ?? '',
        wechat_service_corpid: res.settings?.wechat_service_corpid ?? '',
        wechat_service_contain_keywords:
          res.settings?.wechat_service_contain_keywords ?? ([] as string[]),
        wechat_service_equal_keywords:
          res.settings?.wechat_service_equal_keywords ?? ([] as string[]),
      });
    });
  };

  const wechat_service_contain_keywords =
    watch('wechat_service_contain_keywords') || [];
  const wechat_service_equal_keywords =
    watch('wechat_service_equal_keywords') || [];

  const containKeywordsField = useCommitPendingInput<string>({
    value: wechat_service_contain_keywords,
    setValue: value => {
      setIsEdit(true);
      setValue('wechat_service_contain_keywords', value);
    },
  });

  const equalKeywordsField = useCommitPendingInput<string>({
    value: wechat_service_equal_keywords,
    setValue: value => {
      setIsEdit(true);
      setValue('wechat_service_equal_keywords', value);
    },
  });

  const onSubmit = handleSubmit(data => {
    if (!detail) return;
    putApiV1App(
      { id: detail.id! },
      {
        kb_id,
        settings: {
          wechat_service_is_enabled: data.wechat_service_is_enabled,
          wechat_service_logo: data.wechat_service_logo,
          wechat_service_secret: data.wechat_service_secret,
          wechat_service_token: data.wechat_service_token,
          wechat_service_encodingaeskey: data.wechat_service_encodingaeskey,
          wechat_service_corpid: data.wechat_service_corpid,
          wechat_service_contain_keywords: data.wechat_service_contain_keywords,
          wechat_service_equal_keywords: data.wechat_service_equal_keywords,
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
      title={t('enum.appType.wecomService')}
      isEdit={isEdit}
      onSubmit={onSubmit}
    >
      <FormItem label={t('enum.appType.wecomService')}>
        <Controller
          control={control}
          name='wechat_service_is_enabled'
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
                label={<Box sx={{ width: 100 }}>启用</Box>}
              />
              <FormControlLabel
                value={false}
                control={<Radio size='small' />}
                label={<Box sx={{ width: 100 }}>禁用</Box>}
              />
            </RadioGroup>
          )}
        />
      </FormItem>

      {isEnabled && (
        <>
          <FormItem label={t('robot.callbackUrl')}>
            <ShowText text={[`${url}/share/v1/app/wechat/service`]} />
          </FormItem>
          <FormItem label={t('robot.corpId')} required>
            <Controller
              control={control}
              name='wechat_service_corpid'
              rules={{
                required: t('robot.corpId'),
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  placeholder=''
                  onChange={e => {
                    field.onChange(e.target.value);
                    setIsEdit(true);
                  }}
                  error={!!errors.wechat_service_corpid}
                  helperText={errors.wechat_service_corpid?.message}
                />
              )}
            />
          </FormItem>
          <FormItem label='Corp Secret' required>
            <Controller
              control={control}
              name='wechat_service_secret'
              rules={{
                required: 'Corp Secret',
              }}
              render={({ field }) => (
                <SecretTextField
                  {...field}
                  fullWidth
                  placeholder=''
                  onChange={e => {
                    field.onChange(e.target.value);
                    setIsEdit(true);
                  }}
                  error={!!errors.wechat_service_secret}
                  helperText={errors.wechat_service_secret?.message}
                />
              )}
            />
          </FormItem>
          <FormItem label='Token' required>
            <Controller
              control={control}
              name='wechat_service_token'
              rules={{
                required: 'Suite Token',
              }}
              render={({ field }) => (
                <SecretTextField
                  {...field}
                  fullWidth
                  placeholder=''
                  onChange={e => {
                    field.onChange(e.target.value);
                    setIsEdit(true);
                  }}
                  error={!!errors.wechat_service_token}
                  helperText={errors.wechat_service_token?.message}
                />
              )}
            />
          </FormItem>
          <FormItem label='Encoding Aes Key' required>
            <Controller
              control={control}
              name='wechat_service_encodingaeskey'
              rules={{
                required: 'Suite Encoding Aes Key',
              }}
              render={({ field }) => (
                <SecretTextField
                  {...field}
                  fullWidth
                  placeholder=''
                  onChange={e => {
                    field.onChange(e.target.value);
                    setIsEdit(true);
                  }}
                  error={!!errors.wechat_service_encodingaeskey}
                  helperText={errors.wechat_service_encodingaeskey?.message}
                />
              )}
            />
          </FormItem>
          <FormItem label={t('robot.cardLogo')}>
            <Controller
              control={control}
              name='wechat_service_logo'
              render={({ field }) => (
                <UploadFile
                  {...field}
                  id='wechat_service_logo2'
                  type='url'
                  accept='image/jpeg,image/png'
                  width={80}
                  onChange={url => {
                    field.onChange(url);
                    setIsEdit(true);
                  }}
                />
              )}
            />
          </FormItem>
          <Stack
            direction={'row'}
            alignItems={'center'}
            gap={1}
            sx={{ fontSize: 14, fontWeight: 600, color: 'warning.main' }}
          >
            <IconJinggao sx={{ fontSize: 18 }} />
            人工客服转接配置：当用户触发以下场景时，会自动转接人工客服
          </Stack>
          <VersionMask permission={PROFESSION_VERSION_PERMISSION}>
            <FormItem
              label={
                <Box>
                  {t('robot.questionPrefix')}
                  <Box component={'span'} sx={{ fontWeight: 600 }}>
                    {t('robot.keywordContains')}
                  </Box>
                  {t('robot.keywordSuffix')}
                </Box>
              }
            >
              <FreeSoloAutocomplete
                placeholder={t('robot.keywordEnterNext')}
                {...containKeywordsField}
              />
            </FormItem>
            <FormItem
              label={
                <Box>
                  {t('robot.questionPrefix')}
                  <Box component={'span'} sx={{ fontWeight: 600 }}>
                    {t('robot.keywordExact')}
                  </Box>
                  {t('robot.keywordSuffix')}
                </Box>
              }
            >
              <FreeSoloAutocomplete
                placeholder={t('robot.keywordEnterNext')}
                {...equalKeywordsField}
              />
            </FormItem>
          </VersionMask>
        </>
      )}
    </SettingCardItem>
  );
};

export default CardRobotWecomService;
