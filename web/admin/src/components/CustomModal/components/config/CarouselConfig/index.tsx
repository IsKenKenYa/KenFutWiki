import React, { useEffect, useMemo } from 'react';
import { CommonItem, StyledCommonWrapper } from '../../components/StyledCommon';
import { TextField } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import DragList from '../../components/DragList';
import SortableItem from '../../components/SortableItem';
import Item from './Item';
import type { ConfigProps } from '../type';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/store';
import useDebounceAppPreviewData from '@/hooks/useDebounceAppPreviewData';
import { DEFAULT_DATA } from '../../../constants';
import { Empty } from '@ctzhian/ui';
import ColorPickerField from '../../components/ColorPickerField';
import { findConfigById, handleLandingConfigs } from '../../../utils';

const Config = ({ setIsEdit, id }: ConfigProps) => {
  const { t } = useTranslation();
  const { appPreviewData } = useAppSelector(state => state.config);
  const debouncedDispatch = useDebounceAppPreviewData();
  const { control, setValue, watch, subscribe, reset } = useForm<
    typeof DEFAULT_DATA.carousel
  >({
    defaultValues: findConfigById(
      appPreviewData?.settings?.web_app_landing_configs || [],
      id,
    ),
  });

  const list = watch('list') || [];

  const handleAddQuestion = () => {
    const nextId = `${Date.now()}`;
    setValue('list', [...list, { id: nextId, title: '', url: '', desc: '' }]);
  };

  const handleListChange = (
    newList: (typeof DEFAULT_DATA.carousel)['list'],
  ) => {
    setValue('list', newList);
    setIsEdit(true);
  };

  // 稳定的 SortableItemComponent 引用
  const ItemSortableComponent = useMemo(
    () => (props: any) => <SortableItem {...props} ItemComponent={Item} />,
    [],
  );

  useEffect(() => {
    reset(
      findConfigById(
        appPreviewData?.settings?.web_app_landing_configs || [],
        id,
      ),
      { keepDefaultValues: true },
    );
  }, [appPreviewData, id]);

  useEffect(() => {
    const callback = subscribe({
      formState: {
        values: true,
      },
      callback: ({ values }) => {
        const previewData = {
          ...appPreviewData,
          settings: {
            ...appPreviewData?.settings,
            web_app_landing_configs: handleLandingConfigs({
              id,
              config: appPreviewData?.settings?.web_app_landing_configs || [],
              values,
            }),
          },
        };
        setIsEdit(true);
        debouncedDispatch(previewData);
      },
    });
    return () => {
      callback();
    };
  }, [subscribe, id, appPreviewData]);

  return (
    <StyledCommonWrapper>
      <CommonItem title={t('customModal.common.title')}>
        <Controller
          control={control}
          name='title'
          render={({ field }) => (
            <TextField
              label={t('customModal.common.text')}
              {...field}
              placeholder={t('customModal.common.inputPlaceholder')}
            />
          )}
        />
        {/* <Controller
          control={control}
          name='title_color'
          render={({ field }) => (
            <ColorPickerField
              label='标题颜色'
              value={field.value}
              onChange={field.onChange}
              sx={{ flex: 1 }}
            />
          )}
        /> */}
      </CommonItem>
      {/* <CommonItem title='背景颜色'>
        <Controller
          control={control}
          name='bg_color'
          render={({ field }) => (
            <ColorPickerField
              value={field.value}
              onChange={field.onChange}
              sx={{ flex: 1 }}
            />
          )}
        />
      </CommonItem> */}
      <CommonItem
        title={t('customModal.common.image')}
        desc={t('customModal.common.recommendedSize', {
          size: '880*495, 16:9',
        })}
        onAdd={handleAddQuestion}
      >
        {list.length === 0 ? (
          <Empty />
        ) : (
          <DragList
            data={list}
            onChange={handleListChange}
            setIsEdit={setIsEdit}
            SortableItemComponent={ItemSortableComponent}
            ItemComponent={Item}
          />
        )}
      </CommonItem>
    </StyledCommonWrapper>
  );
};

export default Config;
