import { putApiV1KnowledgeBaseDetail } from '@/request/KnowledgeBase';
import { DomainKnowledgeBaseDetail } from '@/request/types';
import { FormItem, SettingCardItem } from './Common';
import { validateUrl } from '@/utils';
import { TextField } from '@mui/material';
import { message } from '@ctzhian/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const CardBasicInfo = ({
  kb,
  refresh,
}: {
  kb: DomainKnowledgeBaseDetail;
  refresh: () => void;
}) => {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string>('');
  const [isEdit, setIsEdit] = useState<boolean>(false);

  const handleSave = () => {
    try {
      if (!validateUrl(url) && url.trim() !== '') {
        throw new Error(t('setting.invalidUrl'));
      }

      putApiV1KnowledgeBaseDetail({
        id: kb.id!,
        access_settings: { ...kb.access_settings, base_url: url },
      }).then(() => {
        message.success(t('common.saveSuccess'));
        setIsEdit(false);
        refresh();
      });
    } catch (e) {
      message.error(t('setting.invalidUrl'));
    }
  };

  useEffect(() => {
    setUrl(kb?.access_settings?.base_url || '');
    setIsEdit(false);
  }, [kb]);

  const baseUrlPlaceholder = () => {
    const host = kb.access_settings?.hosts?.[0] || '';
    if (!host) {
      return;
    }

    if (
      kb.access_settings?.ssl_ports &&
      kb.access_settings.ssl_ports.length > 0
    ) {
      return kb.access_settings.ssl_ports.includes(443)
        ? `https://${host}`
        : `https://${host}:${kb.access_settings.ssl_ports[0]}`;
    } else if (
      kb.access_settings?.ports &&
      kb.access_settings.ports.length > 0
    ) {
      return kb.access_settings.ports.includes(80)
        ? `http://${host}`
        : `http://${host}:${kb.access_settings.ports[0]}`;
    } else {
      return '';
    }
  };

  return (
    <SettingCardItem
      title={t('setting.basicInfoTitle')}
      isEdit={isEdit}
      onSubmit={handleSave}
    >
      <FormItem label={t('setting.baseUrlPrefix')}>
        <TextField
          fullWidth
          label={t('setting.baseUrlPrefix')}
          value={url}
          onChange={e => {
            setUrl(e.target.value);
            setIsEdit(true);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              handleSave();
            }
          }}
          placeholder={baseUrlPlaceholder()}
        />
      </FormItem>
    </SettingCardItem>
  );
};

export default CardBasicInfo;
