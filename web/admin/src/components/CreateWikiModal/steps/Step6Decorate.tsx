import React, { useImperativeHandle, Ref } from 'react';
import { Box, Stack, FormControlLabel, Checkbox } from '@mui/material';
import decorate from '@/assets/images/init/decorate.png';
import { getInitLandingData } from './initData';
import { getApiV1AppDetail, putApiV1App } from '@/request/App';
import { useAppSelector } from '@/store';
import { useTranslation } from 'react-i18next';

interface Step6DecorateProps {
  ref: Ref<{ onSubmit: () => void }>;
  nodeIds: string[];
}

const Step6Decorate: React.FC<Step6DecorateProps> = ({ ref, nodeIds }) => {
  const { t } = useTranslation();
  const { kb_id } = useAppSelector(state => state.config);
  const onSubmit = () => {
    const landingData = getInitLandingData();
    return getApiV1AppDetail({
      kb_id: kb_id,
      type: '1',
    }).then(res => {
      return putApiV1App(
        { id: res.id! },
        {
          kb_id,
          settings: {
            ...res.settings,
            ...landingData,
            web_app_landing_configs: landingData.web_app_landing_configs.map(
              item => {
                if (item.type === 'basic_doc') {
                  return {
                    ...item,
                    node_ids: nodeIds,
                  };
                }
                return item;
              },
            ),
          },
        },
      );
    });
  };

  useImperativeHandle(ref, () => ({
    onSubmit,
  }));

  return (
    <Stack gap={2} sx={{ textAlign: 'center', py: 4 }}>
      <Box component='img' src={decorate} sx={{ width: '100%' }}></Box>
      <FormControlLabel
        control={
          <Checkbox
            checked
            sx={{ m: 1, color: 'rgba(50, 72, 242, 0.6) !important' }}
          />
        }
        label={t('wizard.applySampleDecorate')}
      />
    </Stack>
  );
};

export default Step6Decorate;
