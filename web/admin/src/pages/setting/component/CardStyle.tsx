import { ThemeAndStyleSetting, ThemeMode } from '@/api/type';
import doc_width_full from '@/assets/images/full.png';
import doc_width_normal from '@/assets/images/normal.png';
import doc_width_wide from '@/assets/images/wide.png';
import { putApiV1App } from '@/request/App';
import { DomainAppDetailResp } from '@/request/types';
import { useAppSelector } from '@/store';
import { message } from '@ctzhian/ui';
import {
  Box,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Tooltip,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { FormItem, SettingCardItem } from './Common';

interface CardStyleProps {
  id: string;
  data: DomainAppDetailResp;
  refresh: (value: ThemeMode & ThemeAndStyleSetting) => void;
}

const CardStyle = ({ id, data, refresh }: CardStyleProps) => {
  const { t } = useTranslation();
  const [isEdit, setIsEdit] = useState(false);
  const { kb_id } = useAppSelector(state => state.config);
  const { control, handleSubmit, setValue } = useForm<
    ThemeMode & ThemeAndStyleSetting
  >({
    defaultValues: {
      // theme_mode: 'light',
      // bg_image: '',
      doc_width: 'full',
    },
  });

  const onSubmit = (value: ThemeMode & ThemeAndStyleSetting) => {
    putApiV1App(
      { id },
      {
        kb_id,
        settings: {
          ...data.settings,
          // theme_mode: value.theme_mode,
          theme_and_style: {
            // ...data.settings?.theme_and_style,
            // bg_image: value.bg_image,
            doc_width: value.doc_width,
          },
        },
      },
    ).then(() => {
      refresh(value);
      message.success(t('common.saveSuccess'));
      setIsEdit(false);
    });
  };

  useEffect(() => {
    // setValue('theme_mode', data.settings?.theme_mode as 'light' | 'dark');
    // setValue('bg_image', data.settings?.theme_and_style?.bg_image || '');
    setValue('doc_width', data.settings?.theme_and_style?.doc_width || 'full');
  }, [data]);

  return (
    <SettingCardItem
      title={t('setting.styleTitle')}
      isEdit={isEdit}
      onSubmit={handleSubmit(onSubmit)}
    >
      {/* <FormItem label='配色方案'>
        <Controller
          control={control}
          name='theme_mode'
          render={({ field }) => (
            <Select
              {...field}
              sx={{ width: '100%', height: 52 }}
              onChange={e => {
                field.onChange(e.target.value as 'light' | 'dark');
                setIsEdit(true);
              }}
            >
              <MenuItem value='light'>浅色模式</MenuItem>
              <MenuItem value='dark'>深色模式</MenuItem>
            </Select>
          )}
        />
      </FormItem> */}

      {/* <FormItem label='背景图片'>
        <Controller
          control={control}
          name='bg_image'
          render={({ field }) => (
            <UploadFile
              {...field}
              id='bg_image'
              type='url'
              accept='image/*'
              width={80}
              onChange={url => {
                field.onChange(url);
                setIsEdit(true);
              }}
            />
          )}
        />{' '}
      </FormItem> */}

      <FormItem
        label={t('setting.pageWidth')}
        sx={{ alignItems: 'flex-start' }}
      >
        <Controller
          control={control}
          name='doc_width'
          render={({ field }) => (
            <RadioGroup
              row
              {...field}
              onChange={e => {
                field.onChange(e.target.value);
                setIsEdit(true);
              }}
            >
              <Stack sx={{ width: 200, mr: 2 }}>
                <img
                  src={doc_width_full}
                  width={200}
                  alt={t('enum.docWidth.full')}
                />
                <FormControlLabel
                  value={'full'}
                  control={<Radio size='small' />}
                  label={<Box>{t('enum.docWidth.full')}</Box>}
                />
              </Stack>
              <Stack sx={{ width: 200, mr: 2, cursor: 'pointer' }}>
                <Tooltip
                  placement='top'
                  title={t('setting.widthHint', { width: 1120 })}
                  arrow
                >
                  <img
                    src={doc_width_wide}
                    width={200}
                    alt={t('enum.docWidth.wide')}
                  />
                </Tooltip>
                <FormControlLabel
                  value={'wide'}
                  control={<Radio size='small' />}
                  label={<Box>{t('enum.docWidth.wide')}</Box>}
                />
              </Stack>
              <Stack sx={{ width: 200, cursor: 'pointer' }}>
                <Tooltip
                  placement='top'
                  title={t('setting.widthHint', { width: 880 })}
                  arrow
                >
                  <img
                    src={doc_width_normal}
                    width={200}
                    alt={t('enum.docWidth.normal')}
                  />
                </Tooltip>
                <FormControlLabel
                  value={'normal'}
                  control={<Radio size='small' />}
                  label={<Box>{t('enum.docWidth.normal')}</Box>}
                />
              </Stack>
            </RadioGroup>
          )}
        />
      </FormItem>
    </SettingCardItem>
  );
};

export default CardStyle;
