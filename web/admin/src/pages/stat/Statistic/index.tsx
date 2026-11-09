import { Box, Stack, useMediaQuery } from '@mui/material';
import { CusTabs } from '@ctzhian/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AreaMap from './AreaMap';
import ClientStat from './ClientStat';
import HostReferer from './HostReferer';
import HotDocs from './HotDocs';
import QAReferer from './QAReferer';
import RTVisitor from './RTVisitor';
import TypeCount from './TypeCount';
import useCapabilities from '@/features/kenfut/useCapabilities';

// 时间范围选项：label 为 i18n key，渲染时翻译
export const TimeList = [
  { label: 'stat.last24h', value: 1 },
  { label: 'stat.last7d', value: 7 },
  { label: 'stat.last30d', value: 30 },
  { label: 'stat.last90d', value: 90 },
];

export type ActiveTab = 1 | 7 | 30 | 90;

const Statistic = () => {
  const { t } = useTranslation();
  const capabilities = useCapabilities();
  const [tab, setTab] = useState<ActiveTab>(1);
  const isWideScreen = useMediaQuery('(min-width:1190px)');

  const timeList = useMemo(
    () =>
      TimeList.map(item => ({
        ...item,
        label: t(item.label),
        disabled: !(capabilities?.stat_days || [1]).includes(item.value),
      })),
    [capabilities, t],
  );

  return (
    <Box sx={{ p: 2 }}>
      <RTVisitor isWideScreen={isWideScreen} />
      <Box sx={{ py: 2 }}>
        <CusTabs
          list={timeList}
          value={tab}
          change={(value: ActiveTab) => setTab(value)}
        />
      </Box>
      <TypeCount tab={tab} />
      <Stack
        direction={isWideScreen ? 'row' : 'column'}
        gap={2}
        alignItems={'stretch'}
        sx={{ my: 2 }}
      >
        <AreaMap tab={tab} />
        <Box sx={{ width: isWideScreen ? 400 : '100%' }}>
          <QAReferer tab={tab} />
        </Box>
      </Stack>
      <Stack
        direction={isWideScreen ? 'row' : 'column'}
        gap={2}
        alignItems={'stretch'}
      >
        <Box sx={{ width: isWideScreen ? 340 : '100%', flexShrink: 0 }}>
          <HostReferer tab={tab} />
        </Box>
        <Box sx={{ width: isWideScreen ? 340 : '100%', flexShrink: 0 }}>
          <HotDocs tab={tab} />
        </Box>
        <Box sx={{ width: isWideScreen ? 340 : '100%', flex: 1 }}>
          <ClientStat tab={tab} />
        </Box>
      </Stack>
    </Box>
  );
};

export default Statistic;
