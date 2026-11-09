import { FreeSoloAutocomplete } from '@/components/FreeSoloAutocomplete';
import ShowText from '@/components/ShowText';
import UploadFile from '@/components/UploadFile';
import VersionMask from '@/components/VersionMask';
import { PROFESSION_VERSION_PERMISSION } from '@/constant/version';
import { useCommitPendingInput } from '@/hooks';
import { getApiV1AppDetail, putApiV1App } from '@/request/App';
import {
  DomainAppDetailResp,
  DomainKnowledgeBaseDetail,
} from '@/request/types';
import { useAppSelector } from '@/store';
import { message } from '@ctzhian/ui';
import { IconJinggao } from '@panda-wiki/icons';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Box,
  Button,
  Collapse,
  FormControlLabel,
  Link,
  Radio,
  RadioGroup,
  Stack,
  TextField,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { FormItem, SettingCardItem } from '../../Common';

interface CardRobotWebComponentProps {
  kb: DomainKnowledgeBaseDetail;
}

const CardRobotWebComponent = ({ kb }: CardRobotWebComponentProps) => {
  const { t } = useTranslation();
  const [isEdit, setIsEdit] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [detail, setDetail] = useState<DomainAppDetailResp | null>(null);
  const [widgetConfigOpen, setWidgetConfigOpen] = useState(false);
  const [modalConfigOpen, setModalConfigOpen] = useState(false);
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
      is_open: 0,
      theme_mode: 'light',
      btn_style: 'side_sticky',
      btn_id: '',
      btn_position: 'bottom_right',
      disclaimer: '',
      btn_text: '',
      btn_logo: '',
      modal_position: 'follow',
      copyright_hide_enabled: '0',
      copyright_info: '',
      search_mode: 'all',
      placeholder: '',
      recommend_questions: [] as string[],
      // recommend_node_ids: [] as string[],
    },
  });

  const [url, setUrl] = useState<string>('');

  const recommend_questions = watch('recommend_questions') || [];
  // const recommend_node_ids = watch('recommend_node_ids') || [];
  const btn_style = watch('btn_style') || 'side_sticky';
  const copyright_hide_enabled = watch('copyright_hide_enabled') || '0';
  const isCustomButton = btn_style === 'btn_trigger';

  const recommendQuestionsField = useCommitPendingInput<string>({
    value: recommend_questions,
    setValue: value => {
      setIsEdit(true);
      setValue('recommend_questions', value);
    },
  });

  useEffect(() => {
    if (kb.access_settings?.base_url) {
      setUrl(kb.access_settings.base_url);
      return;
    }
    const host = kb.access_settings?.hosts?.[0] || '';
    if (host === '') return;
    const { ssl_ports = [], ports = [] } = kb.access_settings || {};

    if (ssl_ports) {
      if (ssl_ports.includes(443)) setUrl(`https://${host}`);
      else if (ssl_ports.length > 0) setUrl(`https://${host}:${ssl_ports[0]}`);
    } else if (ports) {
      if (ports.includes(80)) setUrl(`http://${host}`);
      else if (ports.length > 0) setUrl(`http://${host}:${ports[0]}`);
    }
  }, [kb]);

  const getDetail = () => {
    getApiV1AppDetail({ kb_id: kb.id!, type: '2' }).then(res => {
      setDetail(res);
      const widget = res.settings?.widget_bot_settings;
      reset({
        is_open: widget?.is_open ? 1 : 0,
        theme_mode: widget?.theme_mode || 'light',
        btn_style: widget?.btn_style || 'side_sticky',
        btn_id: widget?.btn_id || '',
        btn_position: widget?.btn_position || 'bottom_right',
        btn_text: widget?.btn_text || t('widget.defaultBtnText'),
        btn_logo: widget?.btn_logo || '',
        modal_position: widget?.modal_position || 'follow',
        search_mode: widget?.search_mode || 'all',
        placeholder: widget?.placeholder || '',
        disclaimer: widget?.disclaimer || '',
        copyright_hide_enabled:
          widget?.copyright_hide_enabled === true ? '1' : '0',
        copyright_info: widget?.copyright_info || '',
        recommend_questions: widget?.recommend_questions || [],
        // recommend_node_ids:  widget?.recommend_node_ids || [],
      });
      setIsEnabled(res.settings?.widget_bot_settings?.is_open ? true : false);
    });
  };

  const onSubmit = handleSubmit(data => {
    if (!detail) return;
    putApiV1App(
      { id: detail.id! },
      {
        kb_id,
        settings: {
          widget_bot_settings: {
            ...data,
            is_open: data.is_open === 1 ? true : false,
            copyright_hide_enabled:
              data.copyright_hide_enabled === '1' ? true : false,
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

  return (
    <SettingCardItem
      title={t('enum.appType.widget')}
      isEdit={isEdit}
      onSubmit={onSubmit}
    >
      <Stack spacing={3}>
        <FormItem label={t('enum.appType.widget')}>
          <Controller
            control={control}
            name='is_open'
            render={({ field }) => (
              <RadioGroup
                row
                {...field}
                onChange={e => {
                  field.onChange(+e.target.value as 1 | 0);
                  setIsEnabled((+e.target.value as 1 | 0) === 1);
                  setIsEdit(true);
                }}
              >
                <FormControlLabel
                  value={1}
                  control={<Radio size='small' />}
                  label={<Box sx={{ width: 100 }}>启用</Box>}
                />
                <FormControlLabel
                  value={0}
                  control={<Radio size='small' />}
                  label={<Box sx={{ width: 100 }}>{t('common.disable')}</Box>}
                />
              </RadioGroup>
            )}
          />
        </FormItem>
        {isEnabled && (
          <>
            <FormItem
              label={t('widget.embedCode')}
              sx={{ alignItems: 'flex-start' }}
            >
              {url ? (
                <ShowText
                  noEllipsis
                  text={[
                    `<!--// Head 标签引入样式 -->`,
                    `<link rel="stylesheet" href="${url}/widget-bot.css">`,
                    `<!--// Body 标签引入挂件 -->`,
                    `<script src="${url}/widget-bot.js"></script>`,
                  ]}
                />
              ) : (
                <Stack
                  direction='row'
                  alignItems={'center'}
                  gap={0.5}
                  sx={{
                    color: 'warning.main',
                    fontSize: 14,
                  }}
                >
                  <IconJinggao sx={{ fontSize: 16 }} />
                  {t('widget.noDomainPrefix')}
                  <Box component={'span'} sx={{ fontWeight: 500 }}>
                    {t('setting.tabPortal')} / {t('kb.listenMode')}
                  </Box>{' '}
                  {t('widget.noDomainSuffix')}
                </Stack>
              )}
            </FormItem>
            <FormItem
              label={t('widget.themeConfig')}
              sx={{ alignItems: 'flex-start' }}
              labelSx={{ mt: 1 }}
            >
              <Controller
                control={control}
                name='theme_mode'
                render={({ field }) => (
                  <RadioGroup
                    row
                    {...field}
                    onChange={e => {
                      field.onChange(e.target.value);
                      setIsEdit(true);
                    }}
                  >
                    <FormControlLabel
                      value='light'
                      control={<Radio size='small' />}
                      label={
                        <Box sx={{ width: 100 }}>{t('setting.themeLight')}</Box>
                      }
                    />
                    <FormControlLabel
                      value='dark'
                      control={<Radio size='small' />}
                      label={
                        <Box sx={{ width: 100 }}>{t('setting.themeDark')}</Box>
                      }
                    />
                  </RadioGroup>
                )}
              />
            </FormItem>
            <FormItem
              label={t('widget.widgetConfig')}
              sx={{ alignItems: 'flex-start' }}
              labelSx={{ mt: 1 }}
            >
              <Box>
                {!widgetConfigOpen && (
                  <Button
                    size='small'
                    variant='outlined'
                    onClick={() => setWidgetConfigOpen(true)}
                    endIcon={<ExpandMoreIcon />}
                  >
                    {t('common.expand')}
                  </Button>
                )}
                <Collapse in={widgetConfigOpen}>
                  <Stack spacing={2.5}>
                    <FormItem
                      label={t('widget.btnStyle')}
                      sx={{ alignItems: 'flex-start' }}
                      labelSx={{ mt: 1 }}
                    >
                      <Controller
                        control={control}
                        name='btn_style'
                        render={({ field }) => (
                          <RadioGroup
                            row
                            {...field}
                            onChange={e => {
                              const value = e.target.value;
                              field.onChange(value);
                              if (value === 'btn_trigger') {
                                setValue('modal_position', 'fixed');
                              }
                              setIsEdit(true);
                            }}
                          >
                            <FormControlLabel
                              value='hover_ball'
                              control={<Radio size='small' />}
                              label={
                                <Box sx={{ width: 100 }}>
                                  {t('widget.styleHoverBall')}
                                </Box>
                              }
                            />
                            <FormControlLabel
                              value='side_sticky'
                              control={<Radio size='small' />}
                              label={
                                <Box sx={{ width: 100 }}>
                                  {t('widget.styleSideSticky')}
                                </Box>
                              }
                            />
                            <FormControlLabel
                              value='btn_trigger'
                              control={<Radio size='small' />}
                              label={
                                <Box sx={{ width: 100 }}>
                                  {t('widget.styleCustomBtn')}
                                </Box>
                              }
                            />
                          </RadioGroup>
                        )}
                      />
                    </FormItem>
                    {isCustomButton ? (
                      <FormItem
                        label={t('widget.customBtnId')}
                        required
                        sx={{ alignItems: 'flex-start' }}
                        labelSx={{ mt: 1 }}
                      >
                        <Controller
                          control={control}
                          name='btn_id'
                          rules={{
                            required: t('widget.customBtnIdRequired'),
                          }}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              fullWidth
                              placeholder={t('widget.customBtnIdPlaceholder')}
                              error={!!errors.btn_id}
                              helperText={errors.btn_id?.message}
                              onChange={event => {
                                setIsEdit(true);
                                field.onChange(event);
                              }}
                            />
                          )}
                        />
                      </FormItem>
                    ) : (
                      <>
                        <FormItem
                          label={t('widget.btnPosition')}
                          sx={{ alignItems: 'flex-start' }}
                          labelSx={{ mt: 1 }}
                        >
                          <Controller
                            control={control}
                            name='btn_position'
                            render={({ field }) => (
                              <RadioGroup
                                row
                                {...field}
                                onChange={e => {
                                  field.onChange(e.target.value);
                                  setIsEdit(true);
                                }}
                              >
                                <FormControlLabel
                                  value='top_left'
                                  control={<Radio size='small' />}
                                  label={<Box sx={{ width: 100 }}>左上</Box>}
                                />
                                <FormControlLabel
                                  value='top_right'
                                  control={<Radio size='small' />}
                                  label={<Box sx={{ width: 100 }}>右上</Box>}
                                />
                                <FormControlLabel
                                  value='bottom_left'
                                  control={<Radio size='small' />}
                                  label={<Box sx={{ width: 100 }}>左下</Box>}
                                />
                                <FormControlLabel
                                  value='bottom_right'
                                  control={<Radio size='small' />}
                                  label={<Box sx={{ width: 100 }}>右下</Box>}
                                />
                              </RadioGroup>
                            )}
                          />
                        </FormItem>
                        {btn_style !== 'hover_ball' && (
                          <FormItem
                            label={t('widget.btnText')}
                            sx={{ alignItems: 'flex-start' }}
                            labelSx={{ mt: 1 }}
                          >
                            <Controller
                              control={control}
                              name='btn_text'
                              render={({ field }) => (
                                <TextField
                                  {...field}
                                  fullWidth
                                  placeholder={t('widget.btnTextPlaceholder')}
                                  error={!!errors.btn_text}
                                  helperText={errors.btn_text?.message}
                                  onChange={event => {
                                    setIsEdit(true);
                                    field.onChange(event);
                                  }}
                                />
                              )}
                            />
                          </FormItem>
                        )}
                        <FormItem
                          label={t('widget.btnIcon')}
                          sx={{ alignItems: 'flex-start' }}
                          labelSx={{ mt: 1 }}
                        >
                          <Controller
                            control={control}
                            name='btn_logo'
                            render={({ field }) => (
                              <UploadFile
                                {...field}
                                id='btn_logo'
                                type='url'
                                accept='image/*'
                                width={80}
                                onChange={url => {
                                  field.onChange(url);
                                  setIsEdit(true);
                                }}
                              />
                            )}
                          />
                        </FormItem>
                      </>
                    )}
                  </Stack>
                </Collapse>
              </Box>
            </FormItem>
            <FormItem
              label='弹框配置'
              sx={{ alignItems: 'flex-start' }}
              labelSx={{ mt: 1 }}
            >
              <Box>
                {!modalConfigOpen && (
                  <Button
                    size='small'
                    variant='outlined'
                    onClick={() => setModalConfigOpen(true)}
                    endIcon={<ExpandMoreIcon />}
                  >
                    {t('common.expand')}
                  </Button>
                )}
                <Collapse in={modalConfigOpen}>
                  <Stack spacing={2.5}>
                    <FormItem
                      label={t('widget.modalPosition')}
                      sx={{ alignItems: 'flex-start' }}
                      labelSx={{ mt: 1 }}
                    >
                      <Controller
                        control={control}
                        name='modal_position'
                        render={({ field }) => {
                          const isDisabled = btn_style === 'btn_trigger';
                          return (
                            <RadioGroup
                              row
                              {...field}
                              value={isDisabled ? 'fixed' : field.value}
                              onChange={e => {
                                if (!isDisabled) {
                                  field.onChange(e.target.value);
                                  setIsEdit(true);
                                }
                              }}
                            >
                              <FormControlLabel
                                value='follow'
                                control={
                                  <Radio size='small' disabled={isDisabled} />
                                }
                                label={
                                  <Box sx={{ width: 100 }}>
                                    {t('widget.positionFollow')}
                                  </Box>
                                }
                              />
                              <FormControlLabel
                                value='fixed'
                                control={
                                  <Radio size='small' disabled={isDisabled} />
                                }
                                label={
                                  <Box sx={{ width: 100 }}>
                                    {t('widget.positionCenter')}
                                  </Box>
                                }
                              />
                            </RadioGroup>
                          );
                        }}
                      />
                    </FormItem>
                    <FormItem
                      label={t('widget.searchMode')}
                      sx={{ alignItems: 'flex-start' }}
                      labelSx={{ mt: 1 }}
                    >
                      <Controller
                        control={control}
                        name='search_mode'
                        render={({ field }) => (
                          <RadioGroup
                            row
                            {...field}
                            onChange={e => {
                              field.onChange(e.target.value);
                              setIsEdit(true);
                            }}
                          >
                            <FormControlLabel
                              value='all'
                              control={<Radio size='small' />}
                              label={
                                <Box sx={{ width: 100 }}>
                                  {t('widget.modeBoth')}
                                </Box>
                              }
                            />
                            <FormControlLabel
                              value='qa'
                              control={<Radio size='small' />}
                              label={
                                <Box sx={{ width: 100 }}>
                                  {t('widget.modeQa')}
                                </Box>
                              }
                            />
                            <FormControlLabel
                              value='doc'
                              control={<Radio size='small' />}
                              label={
                                <Box sx={{ width: 100 }}>
                                  {t('widget.modeDoc')}
                                </Box>
                              }
                            />
                          </RadioGroup>
                        )}
                      />
                    </FormItem>
                    <FormItem
                      label={t('widget.searchPlaceholderLabel')}
                      sx={{ alignItems: 'flex-start' }}
                      labelSx={{ mt: 1 }}
                    >
                      <Controller
                        control={control}
                        name='placeholder'
                        render={({ field }) => (
                          <TextField
                            fullWidth
                            {...field}
                            placeholder={t('widget.searchPlaceholderDefault')}
                            error={!!errors.placeholder}
                            helperText={errors.placeholder?.message}
                            onChange={event => {
                              setIsEdit(true);
                              field.onChange(event);
                            }}
                          />
                        )}
                      />
                    </FormItem>
                    <FormItem
                      label={t('widget.recommendQuestions')}
                      sx={{ alignItems: 'flex-start' }}
                      labelSx={{ mt: 1 }}
                    >
                      <FreeSoloAutocomplete
                        {...recommendQuestionsField}
                        placeholder={t('robot.keywordEnterNext')}
                      />
                    </FormItem>
                    {/* <FormItem
                      label='推荐文档'
                      sx={{ alignItems: 'flex-start' }}
                      labelSx={{ mt: 1 }}
                    >
                      <RecommendDocDragList
                        ids={recommend_node_ids}
                        onChange={(value: string[]) => {
                          setIsEdit(true);
                          setValue('recommend_node_ids', value);
                        }}
                      />
                    </FormItem> */}
                    <VersionMask permission={PROFESSION_VERSION_PERMISSION}>
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
                                  field.onChange(e.target.value);
                                  setIsEdit(true);
                                }}
                              >
                                <FormControlLabel
                                  value='0'
                                  control={<Radio size='small' />}
                                  label={
                                    <Box sx={{ width: 100 }}>
                                      {t('setting.show')}
                                    </Box>
                                  }
                                />
                                <FormControlLabel
                                  value='1'
                                  control={<Radio size='small' />}
                                  label={
                                    <Box sx={{ width: 100 }}>
                                      {t('setting.hide')}
                                    </Box>
                                  }
                                />
                              </RadioGroup>
                            );
                          }}
                        />
                      </FormItem>
                      {copyright_hide_enabled === '0' && (
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
                      <FormItem
                        label={t('setting.disclaimer')}
                        sx={{ alignItems: 'flex-start' }}
                        labelSx={{ mt: 1 }}
                      >
                        <Controller
                          control={control}
                          name='disclaimer'
                          render={({ field }) => (
                            <TextField
                              fullWidth
                              {...field}
                              placeholder={t('qa.aiDisclaimer')}
                              error={!!errors.disclaimer}
                              helperText={errors.disclaimer?.message}
                              onChange={event => {
                                setIsEdit(true);
                                field.onChange(event);
                              }}
                            />
                          )}
                        />
                      </FormItem>
                    </VersionMask>
                  </Stack>
                </Collapse>
              </Box>
            </FormItem>
          </>
        )}
      </Stack>
    </SettingCardItem>
  );
};

export default CardRobotWebComponent;
