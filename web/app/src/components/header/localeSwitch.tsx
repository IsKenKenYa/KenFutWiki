import { IconButton, Menu, MenuItem, alpha, Box } from '@mui/material';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { locales, localeLabels, type Locale } from '@/i18n/routing';

// 语言切换器：在 URL 上加/去 /en 前缀，其余路径与查询保持不变
const LocaleSwitch = () => {
  const t = useTranslations('header');
  const pathname = usePathname();
  const router = useRouter();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const [pending, startTransition] = useTransition();

  const current: Locale =
    pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'zh';

  const switchTo = (target: Locale) => {
    setAnchor(null);
    if (target === current) return;
    let rest = pathname;
    if (current === 'en') {
      rest = pathname === '/en' ? '/' : pathname.slice('/en'.length) || '/';
    }
    const next = target === 'en' ? `/en${rest === '/' ? '' : rest}` : rest;
    startTransition(() => router.push(next));
  };

  return (
    <>
      <IconButton
        size='small'
        title={t('language')}
        onClick={e => setAnchor(e.currentTarget)}
        disabled={pending}
      >
        <Box
          component='span'
          sx={{
            fontSize: 13,
            fontWeight: 600,
            color: theme => alpha(theme.palette.text.primary, 0.65),
          }}
        >
          {current.toUpperCase()}
        </Box>
      </IconButton>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {locales.map(l => (
          <MenuItem
            key={l}
            selected={l === current}
            onClick={() => switchTo(l)}
          >
            {localeLabels[l]}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default LocaleSwitch;
