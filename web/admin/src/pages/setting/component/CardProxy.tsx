import { updateKnowledgeBase } from '@/api';
import { DomainKnowledgeBaseDetail } from '@/request/types';
import { SettingCardItem, FormItem } from './Common';

import {
  Box,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
} from '@mui/material';
import { message } from '@ctzhian/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const CardProxy = ({
  kb,
  refresh,
}: {
  kb: DomainKnowledgeBaseDetail;
  refresh: () => void;
}) => {
  const { t } = useTranslation();
  const [isEdit, setIsEdit] = useState(false);
  const [hasProxy, setHasProxy] = useState(
    !!kb.access_settings?.trusted_proxies?.length,
  );
  const [proxyIPs, setProxyIPs] = useState<string[]>(
    kb.access_settings?.trusted_proxies || [],
  );

  const handleSave = () => {
    try {
      updateKnowledgeBase({
        id: kb.id,
        access_settings: {
          ...kb.access_settings,
          trusted_proxies: hasProxy
            ? proxyIPs.filter(ip => ip.trim() !== '')
            : null,
        },
      }).then(() => {
        message.success(t('common.saveSuccess'));
        setIsEdit(false);
        refresh();
      });
    } catch (e) {
      message.error(t('common.saveFailed'));
    }
  };

  useEffect(() => {
    setHasProxy(!!kb.access_settings?.trusted_proxies?.length);
    setProxyIPs(kb.access_settings?.trusted_proxies || []);
  }, [kb]);

  return (
    <SettingCardItem
      title={t('setting.proxyTitle')}
      more={
        <Box
          sx={{
            flexGrow: 1,
            fontSize: 12,
            color: 'text.tertiary',
            ml: 1,
            fontWeight: 'normal',
          }}
        >
          {t('setting.proxyHint')}
        </Box>
      }
      isEdit={isEdit}
      onSubmit={handleSave}
    >
      <FormItem label={t('setting.proxyTitle')}>
        <FormControl>
          <RadioGroup
            value={hasProxy}
            onChange={e => {
              setHasProxy(e.target.value === 'true');
              if (proxyIPs.length === 0) {
                setProxyIPs(['0.0.0.0/0']);
              }
              setIsEdit(true);
            }}
          >
            <Stack direction={'row'}>
              <FormControlLabel
                value={false}
                control={<Radio size='small' />}
                label={t('setting.proxyNone')}
              />
              <FormControlLabel
                value={true}
                control={<Radio size='small' />}
                label={t('setting.proxyPresent')}
              />
            </Stack>
          </RadioGroup>
        </FormControl>
      </FormItem>

      {hasProxy && (
        <FormItem
          label={t('setting.trustedProxies')}
          sx={{ alignItems: 'flex-start' }}
        >
          <TextField
            fullWidth
            label={t('setting.trustedProxiesLabel')}
            multiline
            minRows={2}
            value={proxyIPs.join('\n')}
            helperText={t('setting.trustedProxiesHint')}
            onChange={e => {
              const lines = e.target.value.split(/\r?\n/).map(s => s.trim());
              setProxyIPs(lines);
              setIsEdit(true);
            }}
          />
        </FormItem>
      )}
    </SettingCardItem>
  );
};

export default CardProxy;
