import {
  getPrompts as getApiProV1Prompt,
  putPrompts as putApiProV1Prompt,
} from '@/features/kenfut/api';
import useCapabilities from '@/features/kenfut/useCapabilities';
import type { Prompt } from '@/features/kenfut/types';
import { DomainKnowledgeBaseDetail } from '@/request/types';
import { PROFESSION_VERSION_PERMISSION } from '@/constant/version';
import { message, Modal } from '@ctzhian/ui';
import VersionMask from '@/components/VersionMask';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  RadioGroup,
  Radio,
  TextField,
  styled,
} from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { FormItem, SettingCardItem } from './Common';
type DomainUpdatePromptReq = Prompt & { kb_id: string };

interface CardAIProps {
  kb: DomainKnowledgeBaseDetail;
}

const StyledRadioLabel = styled(Box)(({ theme }) => ({
  width: 100,
}));

const CardAI = ({ kb }: CardAIProps) => {
  const { t } = useTranslation();
  const [isEdit, setIsEdit] = useState(false);
  const capabilities = useCapabilities();
  const [loadedKbId, setLoadedKbId] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const requestVersion = useRef(0);

  const { control, handleSubmit, setValue, getValues, watch } = useForm({
    defaultValues: {
      interval: 0,
      content: '',
      summary_content: '',
      enable_preset: false,
      enable_preset_auto_language: true,
      enable_preset_general_info: true,
      enable_preset_reference: true,
    },
  });

  const enable_preset = watch('enable_preset');

  const isPro = capabilities?.custom_prompts === true;
  const canEdit = isPro && loadedKbId === kb.id && !loading && !busy;
  const applyPrompt = useCallback(
    (res: Prompt) => {
      setValue('content', res.content || '');
      setValue('summary_content', res.summary_content || '');
      setValue('enable_preset', res.enable_preset ?? false);
      setValue(
        'enable_preset_auto_language',
        res.enable_preset_auto_language ?? true,
      );
      setValue(
        'enable_preset_general_info',
        res.enable_preset_general_info ?? true,
      );
      setValue('enable_preset_reference', res.enable_preset_reference ?? true);
    },
    [setValue],
  );

  const onSubmit = handleSubmit(async data => {
    if (!canEdit || !kb.id) return;
    const version = requestVersion.current;
    setBusy(true);
    try {
      await putApiProV1Prompt({
        kb_id: kb.id,
        content: data.content,
        summary_content: data.summary_content,
        enable_preset: data.enable_preset,
        enable_preset_auto_language: data.enable_preset_auto_language,
        enable_preset_general_info: data.enable_preset_general_info,
        enable_preset_reference: data.enable_preset_reference,
      });
      if (version !== requestVersion.current) return;
      message.success(t('common.saveSuccess'));
      setIsEdit(false);
    } catch {
      // The request wrapper already displays the error; preserve unsaved values.
    } finally {
      if (version === requestVersion.current) setBusy(false);
    }
  });

  useEffect(() => {
    const version = ++requestVersion.current;
    let active = true;
    setLoadedKbId('');
    setLoading(false);
    setBusy(false);
    setLoadError('');
    setIsEdit(false);
    if (!kb.id || !isPro) return;
    setLoading(true);
    getApiProV1Prompt({ kb_id: kb.id })
      .then(res => {
        if (!active || version !== requestVersion.current) return;
        applyPrompt(res);
        setLoadedKbId(kb.id!);
      })
      .catch(error => {
        if (active && version === requestVersion.current)
          setLoadError(
            error instanceof Error
              ? error.message
              : t('setting.promptLoadFailed'),
          );
      })
      .finally(() => {
        if (active && version === requestVersion.current) setLoading(false);
      });
    return () => {
      active = false;
      requestVersion.current = version + 1;
    };
  }, [kb.id, isPro, reload, applyPrompt]);

  const onResetPrompt = (type: 'content' | 'summary_content' = 'content') => {
    if (!canEdit || !kb.id) return;
    const version = requestVersion.current;
    const kbId = kb.id;
    Modal.confirm({
      title: t('common.tip'),
      content: t(
        type === 'content'
          ? 'setting.resetQaPromptConfirm'
          : 'setting.resetSummaryPromptConfirm',
      ),
      onOk: async () => {
        if (version !== requestVersion.current) return;
        const params: DomainUpdatePromptReq = {
          kb_id: kbId,
          content: type === 'content' ? '' : getValues('content'),
          summary_content:
            type === 'summary_content' ? '' : getValues('summary_content'),
          enable_preset: getValues('enable_preset'),
          enable_preset_auto_language: getValues('enable_preset_auto_language'),
          enable_preset_general_info: getValues('enable_preset_general_info'),
          enable_preset_reference: getValues('enable_preset_reference'),
        };
        let saved = false;
        setBusy(true);
        try {
          await putApiProV1Prompt(params);
          saved = true;
          const result = await getApiProV1Prompt({ kb_id: kbId });
          if (version !== requestVersion.current) return;
          applyPrompt(result);
          setIsEdit(false);
          message.success(t('setting.resetSuccess'));
        } catch {
          // A failed reread must not allow stale form values to overwrite the reset.
          if (saved && version === requestVersion.current) {
            setLoadedKbId('');
            setLoadError(t('setting.resetReadFailed'));
          }
        } finally {
          if (version === requestVersion.current) setBusy(false);
        }
      },
    });
  };

  return (
    <Box
      sx={{
        width: 1000,
        margin: 'auto',
        pb: 4,
      }}
    >
      <SettingCardItem
        title={t('setting.qaTitle')}
        isEdit={isEdit && canEdit}
        onSubmit={onSubmit}
        extra={
          loading || busy ? (
            <CircularProgress size={18} aria-label={t('setting.promptBusy')} />
          ) : undefined
        }
      >
        {loadError && (
          <Alert
            severity='error'
            action={
              <Button
                size='small'
                disabled={loading || busy}
                onClick={() => setReload(value => value + 1)}
              >
                {t('common.retry')}
              </Button>
            }
          >
            {loadError}
          </Alert>
        )}
        <VersionMask
          permission={PROFESSION_VERSION_PERMISSION}
          capability='custom_prompts'
        >
          <FormItem label={t('setting.qaPromptLabel')}>
            <Controller
              control={control}
              name='enable_preset'
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
                    disabled={!canEdit}
                    value={false}
                    control={<Radio size='small' />}
                    label={
                      <StyledRadioLabel>{t('setting.custom')}</StyledRadioLabel>
                    }
                  />
                  <FormControlLabel
                    disabled={!canEdit}
                    value={true}
                    control={<Radio size='small' />}
                    label={
                      <StyledRadioLabel>{t('setting.preset')}</StyledRadioLabel>
                    }
                  />
                </RadioGroup>
              )}
            />
          </FormItem>

          {!enable_preset ? (
            <FormItem
              vertical
              extra={
                <Box
                  sx={{
                    fontSize: 12,
                    color: 'primary.main',
                    display: 'block',
                    cursor: 'pointer',
                  }}
                  onClick={() => onResetPrompt('content')}
                >
                  {t('setting.resetToDefault')}
                </Box>
              }
              label=''
            >
              <Controller
                control={control}
                name='content'
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    disabled={!canEdit}
                    multiline
                    rows={20}
                    placeholder={t('setting.qaPromptPlaceholder')}
                    onChange={e => {
                      field.onChange(e.target.value);
                      setIsEdit(true);
                    }}
                  />
                )}
              />
            </FormItem>
          ) : (
            <>
              <FormItem label={t('setting.autoLanguage')}>
                <Controller
                  control={control}
                  name='enable_preset_auto_language'
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
                        disabled={!canEdit}
                        value={true}
                        control={<Radio size='small' />}
                        label={
                          <StyledRadioLabel>
                            {t('common.enable')}
                          </StyledRadioLabel>
                        }
                      />
                      <FormControlLabel
                        disabled={!canEdit}
                        value={false}
                        control={<Radio size='small' />}
                        label={
                          <StyledRadioLabel>
                            {t('common.disable')}
                          </StyledRadioLabel>
                        }
                      />
                    </RadioGroup>
                  )}
                />
              </FormItem>
              <FormItem label={t('setting.generalKnowledge')}>
                <Controller
                  control={control}
                  name='enable_preset_general_info'
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
                        disabled={!canEdit}
                        value={true}
                        control={<Radio size='small' />}
                        label={
                          <StyledRadioLabel>
                            {t('common.enable')}
                          </StyledRadioLabel>
                        }
                      />
                      <FormControlLabel
                        disabled={!canEdit}
                        value={false}
                        control={<Radio size='small' />}
                        label={
                          <StyledRadioLabel>
                            {t('common.disable')}
                          </StyledRadioLabel>
                        }
                      />
                    </RadioGroup>
                  )}
                />
              </FormItem>
              <FormItem label={t('setting.showReference')}>
                <Controller
                  control={control}
                  name='enable_preset_reference'
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
                        disabled={!canEdit}
                        value={true}
                        control={<Radio size='small' />}
                        label={
                          <StyledRadioLabel>
                            {t('common.enable')}
                          </StyledRadioLabel>
                        }
                      />
                      <FormControlLabel
                        disabled={!canEdit}
                        value={false}
                        control={<Radio size='small' />}
                        label={
                          <StyledRadioLabel>
                            {t('common.disable')}
                          </StyledRadioLabel>
                        }
                      />
                    </RadioGroup>
                  )}
                />
              </FormItem>
            </>
          )}
          <FormItem
            vertical
            extra={
              <Box
                sx={{
                  fontSize: 12,
                  color: 'primary.main',
                  display: 'block',
                  cursor: 'pointer',
                }}
                onClick={() => onResetPrompt('summary_content')}
              >
                {t('setting.resetToDefault')}
              </Box>
            }
            label={t('setting.summaryPromptLabel')}
          >
            <Controller
              control={control}
              name='summary_content'
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  disabled={!canEdit}
                  multiline
                  rows={5}
                  placeholder={t('setting.summaryPromptPlaceholder')}
                  onChange={e => {
                    field.onChange(e.target.value);
                    setIsEdit(true);
                  }}
                />
              )}
            />
          </FormItem>
        </VersionMask>

        {/* <FormItem vertical label='连续提问时间间隔（敬请期待）'>
          <Controller
            control={control}
            name='interval'
            render={({ field }) => (
              <Slider
                {...field}
                disabled
                valueLabelDisplay='auto'
                min={200}
                max={300}
                step={5}
                sx={{
                  width: 432,
                  '& .MuiSlider-thumb': {
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    backgroundColor: '#fff',
                    border: '2px solid currentColor',
                    '&:focus, &:hover, &.Mui-active, &.Mui-focusVisible': {
                      boxShadow: 'inherit',
                    },
                    '&::before': {
                      display: 'none',
                    },
                  },
                  '& .MuiSlider-track': {
                    bgcolor: 'primary.main',
                  },
                  '& .MuiSlider-rail': {
                    bgcolor: 'text.disabled',
                  },
                  '& .MuiSlider-valueLabel': {
                    lineHeight: 1.2,
                    fontSize: 12,
                    fontWeight: 'bold',
                    background: 'unset',
                    p: 0,
                    width: 24,
                    height: 24,
                    borderRadius: '50% 50% 50% 0',
                    bgcolor: 'primary.main',
                    transformOrigin: 'bottom left',
                    transform: 'translate(50%, -100%) rotate(-45deg) scale(0)',
                    '&::before': { display: 'none' },
                    '&.MuiSlider-valueLabelOpen': {
                      transform:
                        'translate(50%, -100%) rotate(-45deg) scale(1)',
                    },
                    '& > *': {
                      transform: 'rotate(45deg)',
                    },
                  },
                }}
                onChange={(e, value) => {
                  field.onChange(+value);
                  setIsEdit(true);
                }}
              />
            )}
          />
        </FormItem> */}
      </SettingCardItem>
    </Box>
  );
};

export default CardAI;
