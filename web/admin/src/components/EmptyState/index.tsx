import NoData from '@/assets/images/nodata.png';
import { Box, SxProps, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface EmptyStateProps {
  /** 提示文案，默认为「暂无数据」 */
  text?: string;
  /** 图片宽度，默认 150 */
  imageWidth?: number;
  sx?: SxProps;
}

const EmptyState = ({ text, imageWidth = 150, sx }: EmptyStateProps) => {
  const { t } = useTranslation();
  return (
    <Stack alignItems='center' sx={sx}>
      <img src={NoData} width={imageWidth} alt='' />
      <Box
        sx={{
          fontSize: 12,
          lineHeight: '20px',
          color: 'text.tertiary',
        }}
      >
        {text ?? t('common.noData')}
      </Box>
    </Stack>
  );
};

export default EmptyState;
