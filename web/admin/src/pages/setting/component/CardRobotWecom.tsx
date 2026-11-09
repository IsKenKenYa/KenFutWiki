import ShowText from '@/components/ShowText';
import {
  Box,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Autocomplete,
  Chip,
} from '@mui/material';
import { PROFESSION_VERSION_PERMISSION } from '@/constant/version';
import VersionMask from '@/components/VersionMask';
import { message, Modal } from '@ctzhian/ui';
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

// AI 评价预置选项：随当前语言生成（选项值会写入站点配置）
const getAiFeedbackOptions = (t: (key: string) => string) => [
  t('enum.feedback.inaccurate'),
  t('setting.feedbackIrrelevant'),
  t('enum.feedback.other'),
];

const CardRobotWecom = ({
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
  const [inputValue, setInputValue] = useState('');

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm({
    defaultValues: {
      wechat_app_is_enabled: false,
      wechat_app_agent_id: '',
      wechat_app_secret: '',
      wechat_app_token: '',
      wechat_app_encodingaeskey: '',
      wechat_app_corpid: '',
      text_response_enable: false,
      feedback_enable: false,
      feedback_type: [] as string[],
      prompt: '',
      disclaimer_content: '',
    },
  });

  const getDetail = () => {
    getApiV1AppDetail({ kb_id: kb.id!, type: '5' }).then(res => {
      setDetail(res);
      setIsEnabled(res.settings?.wechat_app_is_enabled ?? false);
      reset({
        wechat_app_is_enabled: res.settings?.wechat_app_is_enabled ?? false,
        wechat_app_agent_id: res.settings?.wechat_app_agent_id ?? '',
        wechat_app_secret: res.settings?.wechat_app_secret ?? '',
        wechat_app_token: res.settings?.wechat_app_token ?? '',
        wechat_app_encodingaeskey:
          res.settings?.wechat_app_encodingaeskey ?? '',
        wechat_app_corpid: res.settings?.wechat_app_corpid ?? '',
        text_response_enable:
          res.settings?.wechat_app_advanced_setting?.text_response_enable ??
          false,
        feedback_enable:
          res.settings?.wechat_app_advanced_setting?.feedback_enable ?? false,
        feedback_type:
          res.settings?.wechat_app_advanced_setting?.feedback_type ?? [],
        prompt: res.settings?.wechat_app_advanced_setting?.prompt ?? '',
        disclaimer_content:
          res.settings?.wechat_app_advanced_setting?.disclaimer_content ?? '',
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
          wechat_app_is_enabled: data.wechat_app_is_enabled,
          wechat_app_agent_id: data.wechat_app_agent_id,
          wechat_app_secret: data.wechat_app_secret,
          wechat_app_token: data.wechat_app_token,
          wechat_app_encodingaeskey: data.wechat_app_encodingaeskey,
          wechat_app_corpid: data.wechat_app_corpid,
          wechat_app_advanced_setting: {
            text_response_enable: data.text_response_enable,
            feedback_enable: data.feedback_enable,
            feedback_type: data.feedback_type,
            prompt: data.prompt,
            disclaimer_content: data.disclaimer_content,
          },
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

  const onResetPrompt = () => {
    Modal.confirm({
      title: t('common.tip'),
      content: t('setting.resetQaPromptConfirm'),
      onOk: () => {
        putApiV1App(
          { id: detail!.id! },
          {
            kb_id,
            settings: {
              ...detail?.settings,
              wechat_app_advanced_setting: {
                ...detail?.settings?.wechat_app_advanced_setting,
                prompt: '',
              },
            },
          },
        ).then(() => {
          getApiV1AppDetail({ kb_id: kb.id!, type: '5' }).then(res => {
            setDetail(res);
            setValue(
              'prompt',
              res.settings?.wechat_app_advanced_setting?.prompt ?? '',
            );
          });
          message.success(t('common.saveSuccess'));
        });
      },
    });
  };

  return (
    <SettingCardItem
      title={t('enum.appType.wecomBot')}
      isEdit={isEdit}
      onSubmit={onSubmit}
    >
      <FormItem label={t('enum.appType.wecomBot')}>
        <Controller
          control={control}
          name='wechat_app_is_enabled'
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
            <ShowText text={[`${url}/share/v1/app/wechat/app`]} />
          </FormItem>

          <FormItem label='Agent ID' required>
            <Controller
              control={control}
              name='wechat_app_agent_id'
              rules={{
                required: 'Agent ID',
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
                  error={!!errors.wechat_app_agent_id}
                  helperText={errors.wechat_app_agent_id?.message}
                />
              )}
            />
          </FormItem>

          <FormItem label={t('robot.corpId')} required>
            <Controller
              control={control}
              name='wechat_app_corpid'
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
                  error={!!errors.wechat_app_corpid}
                  helperText={errors.wechat_app_corpid?.message}
                />
              )}
            />
          </FormItem>

          <FormItem label='Secret' required>
            <Controller
              control={control}
              name='wechat_app_secret'
              rules={{
                required: 'Secret',
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
                  error={!!errors.wechat_app_secret}
                  helperText={errors.wechat_app_secret?.message}
                />
              )}
            />
          </FormItem>

          <FormItem label='Token' required>
            <Controller
              control={control}
              name='wechat_app_token'
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
                  error={!!errors.wechat_app_token}
                  helperText={errors.wechat_app_token?.message}
                />
              )}
            />
          </FormItem>

          <FormItem label='Encoding Aes Key' required>
            <Controller
              control={control}
              name='wechat_app_encodingaeskey'
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
                  error={!!errors.wechat_app_encodingaeskey}
                  helperText={errors.wechat_app_encodingaeskey?.message}
                />
              )}
            />
          </FormItem>

          <VersionMask permission={PROFESSION_VERSION_PERMISSION}>
            <FormItem label={t('setting.answerType')}>
              <Controller
                control={control}
                name='text_response_enable'
                render={({ field }) => (
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
                      label={<Box sx={{ width: 100 }}>卡片</Box>}
                    />
                    <FormControlLabel
                      value={true}
                      control={<Radio size='small' />}
                      label={<Box sx={{ width: 100 }}>文本</Box>}
                    />
                  </RadioGroup>
                )}
              />
            </FormItem>
            <FormItem
              label={t('setting.qaPromptLabel')}
              sx={{ alignItems: 'flex-start' }}
            >
              <Controller
                control={control}
                name='prompt'
                render={({ field }) => (
                  <Box sx={{ position: 'relative', flex: 1 }}>
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 12,
                        left: 12,
                        fontSize: 12,
                        color: 'primary.main',
                        display: 'block',
                        cursor: 'pointer',
                        zIndex: 1,
                      }}
                      onClick={onResetPrompt}
                    >
                      重置为默认提示词
                    </Box>
                    <TextField
                      {...field}
                      fullWidth
                      multiline
                      minRows={6}
                      maxRows={20}
                      slotProps={{
                        input: {
                          sx: { pt: '36px' },
                        },
                      }}
                      placeholder={t('setting.qaPromptPlaceholder')}
                      onChange={e => {
                        field.onChange(e.target.value);
                        setIsEdit(true);
                      }}
                    />
                  </Box>
                )}
              />
            </FormItem>
            <FormItem label={t('setting.aiFeedbackTitle')}>
              <Controller
                control={control}
                name='feedback_type'
                render={({ field }) => (
                  <Autocomplete
                    {...field}
                    multiple
                    freeSolo
                    fullWidth
                    options={getAiFeedbackOptions(t)}
                    inputValue={inputValue}
                    onInputChange={(_, newInputValue) =>
                      setInputValue(newInputValue)
                    }
                    onChange={(_, newValue) => {
                      setIsEdit(true);
                      const newValues = [...new Set(newValue as string[])];
                      field.onChange(newValues);
                    }}
                    renderValue={(value, getTagProps) => {
                      return value.map((option, index: number) => {
                        return (
                          <Chip
                            variant='outlined'
                            size='small'
                            label={
                              <Box sx={{ fontSize: '12px' }}>{option}</Box>
                            }
                            {...getTagProps({ index })}
                            key={index}
                          />
                        );
                      });
                    }}
                    renderInput={params => (
                      <TextField
                        {...params}
                        placeholder={t('setting.aiFeedbackPlaceholder')}
                        variant='outlined'
                      />
                    )}
                  />
                )}
              />
            </FormItem>
            <FormItem label={t('setting.aiFeedbackSwitch')}>
              <Controller
                control={control}
                name='feedback_enable'
                render={({ field }) => (
                  <RadioGroup
                    row
                    {...field}
                    onChange={e => {
                      setIsEdit(true);
                      field.onChange(e.target.value === 'true');
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
            <FormItem label={t('setting.disclaimer')}>
              <Controller
                control={control}
                name='disclaimer_content'
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    value={field.value || ''}
                    placeholder={t('setting.disclaimerPlaceholder')}
                    onChange={e => {
                      setIsEdit(true);
                      field.onChange(e.target.value);
                    }}
                  ></TextField>
                )}
              />
            </FormItem>
          </VersionMask>
        </>
      )}
    </SettingCardItem>
  );
};

export default CardRobotWecom;
