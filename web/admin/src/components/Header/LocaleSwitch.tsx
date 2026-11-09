import { IconButton, Menu, MenuItem, alpha, Box } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminLocales, changeAdminLocale, type AdminLocale } from '@/i18n';

const localeLabels: Record<AdminLocale, string> = {
  zh: '中文',
  en: 'English',
};

// 管理后台语言切换器：写入 localStorage 并同步 dayjs / <html lang>
const LocaleSwitch = () => {
  const { t, i18n } = useTranslation();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const current = (i18n.language || 'zh').split('-')[0] as AdminLocale;

  return (
    <>
      <IconButton
        size='small'
        title={t('layout.language')}
        onClick={e => setAnchor(e.currentTarget)}
        sx={{
          bgcolor: 'background.paper',
          width: 28,
          height: 28,
          fontSize: 12,
          fontWeight: 600,
          color: theme => alpha(theme.palette.text.primary, 0.65),
        }}
      >
        {current.toUpperCase()}
      </IconButton>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {adminLocales.map(locale => (
          <MenuItem
            key={locale}
            selected={locale === current}
            onClick={() => {
              changeAdminLocale(locale);
              setAnchor(null);
            }}
          >
            {localeLabels[locale]}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default LocaleSwitch;
