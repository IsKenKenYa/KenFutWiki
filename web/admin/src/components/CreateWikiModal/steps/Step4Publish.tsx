import { Box, Stack, FormControlLabel, Checkbox } from '@mui/material';
import publish from '@/assets/images/init/publish.png';
import { useTranslation } from 'react-i18next';

const Step4Publish = () => {
  const { t } = useTranslation();
  return (
    <Stack gap={2} sx={{ textAlign: 'center', py: 4 }}>
      <Box component='img' src={publish} sx={{ width: '100%' }}></Box>
      <FormControlLabel
        control={
          <Checkbox
            checked
            sx={{ m: 1, color: 'rgba(50, 72, 242, 0.6) !important' }}
          />
        }
        label={t('wizard.step.publish')}
      />
    </Stack>
  );
};

export default Step4Publish;
