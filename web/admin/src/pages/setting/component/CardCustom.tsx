import documentPng from '@/assets/images/document.png';
import welcomePng from '@/assets/images/welcome.png';
import CustomModal from '@/components/CustomModal';
import { putApiV1App } from '@/request/App';
import {
  ConstsHomePageSetting,
  DomainAppDetailResp,
  DomainKnowledgeBaseDetail,
} from '@/request/types';
import { useAppSelector } from '@/store';
import { message } from '@ctzhian/ui';
import {
  Box,
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { FormItem, SettingCardItem } from './Common';

interface CardCustomProps {
  kb: DomainKnowledgeBaseDetail;
  refresh: (value: { home_page_setting: ConstsHomePageSetting }) => void;
  info: DomainAppDetailResp;
}

const CardCustom = ({ kb, refresh, info }: CardCustomProps) => {
  const [curCustomType, setCurCustomType] = useState<
    'welcome' | 'header' | 'footer' | null
  >(null);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const { kb_id } = useAppSelector(state => state.config);
  const {
    control,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      home_page_setting: ConstsHomePageSetting.HomePageSettingDoc,
    },
  });
  const [isEdit, setIsEdit] = useState(false);
  const { t } = useTranslation();

  const onSubmit = handleSubmit(value => {
    putApiV1App(
      { id: info.id! },
      {
        kb_id,
        settings: {
          ...info.settings,
          home_page_setting: value.home_page_setting,
        },
      },
    ).then(() => {
      refresh(value);
      message.success(t('common.saveSuccess'));
      setIsEdit(false);
    });
  });

  useEffect(() => {
    setValue(
      'home_page_setting',
      info?.settings?.home_page_setting ||
        ConstsHomePageSetting.HomePageSettingDoc,
    );
  }, [info]);

  useEffect(() => {
    if (curCustomType) {
      setCustomModalOpen(true);
    }
  }, [curCustomType]);

  useEffect(() => {
    if (!customModalOpen) {
      setCurCustomType(null);
    }
  }, [customModalOpen]);

  const curCustomTitle = useMemo(() => {
    if (curCustomType === 'welcome') {
      return t('setting.customizeWelcome');
    } else if (curCustomType === 'header') {
      return t('setting.customizeNav');
    } else if (curCustomType === 'footer') {
      return t('setting.customizeFooter');
    }
    return '';
  }, [curCustomType, t]);

  const curCustomDisabledComponents = useMemo(() => {
    if (curCustomType === 'welcome') {
      return ['header', 'footer'];
    }
    return [];
  }, [curCustomType]);

  const curCustomShowComponents = useMemo(() => {
    if (curCustomType === 'header') {
      return ['header'];
    } else if (curCustomType === 'footer') {
      return ['footer'];
    }
    return null;
  }, [curCustomType]);

  return (
    <SettingCardItem
      title={t('setting.customStyleTitle')}
      isEdit={isEdit}
      onSubmit={onSubmit}
    >
      <FormItem
        label={t('setting.defaultHome')}
        sx={{ alignItems: 'flex-start' }}
      >
        <Controller
          control={control}
          name='home_page_setting'
          render={({ field }) => (
            <RadioGroup
              row
              {...field}
              value={field.value}
              onChange={e => {
                field.onChange(e.target.value);
                setIsEdit(true);
              }}
            >
              <Stack sx={{ width: 200, mr: 2 }}>
                <img
                  src={documentPng}
                  width={200}
                  height={115.28}
                  alt={t('setting.docPage')}
                />
                <FormControlLabel
                  value='doc'
                  control={<Radio size='small' />}
                  label={<Box sx={{ width: 65 }}>{t('setting.docPage')}</Box>}
                />
              </Stack>
              <Stack sx={{ mr: 2 }}>
                <img
                  src={welcomePng}
                  width={200}
                  height={115.28}
                  alt={t('setting.welcomePage')}
                />
                <FormControlLabel
                  value='custom'
                  control={<Radio size='small' />}
                  label={
                    <Stack direction={'row'} alignItems={'center'}>
                      <Box>{t('setting.welcomePage')}</Box>
                    </Stack>
                  }
                />
              </Stack>
            </RadioGroup>
          )}
        />
      </FormItem>
      <FormItem label={t('setting.customStyle')}>
        <Stack direction='row' gap={2}>
          <Button
            variant='outlined'
            onClick={() => setCurCustomType('welcome')}
          >
            {t('setting.customizeWelcome')}
          </Button>
          <Button variant='outlined' onClick={() => setCurCustomType('header')}>
            {t('setting.customizeNav')}
          </Button>
          <Button
            variant='outlined'
            onClick={() => setCurCustomType('footer')}
            sx={{ textTransform: 'none' }}
          >
            {t('setting.customizeFooter')}
          </Button>
        </Stack>
      </FormItem>

      <CustomModal
        open={customModalOpen}
        onCancel={() => setCustomModalOpen(false)}
        refresh={refresh}
        title={curCustomTitle}
        disabledComponents={curCustomDisabledComponents}
        components={curCustomShowComponents}
      />
    </SettingCardItem>
  );
};

export default CardCustom;
