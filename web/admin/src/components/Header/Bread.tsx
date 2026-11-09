import { useAppSelector } from '@/store';
import { Box, Stack, useTheme } from '@mui/material';
import { IconXiala } from '@panda-wiki/icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import KBSelect from '../KB/KBSelect';

// title 存 i18n key，渲染时按当前语言翻译
const HomeBread = { title: 'layout.bread.document', to: '/' };
const OtherBread = {
  document: { title: 'layout.bread.document', to: '/' },
  stat: { title: 'layout.bread.stat', to: '/stat' },
  conversation: { title: 'layout.bread.conversation', to: '/conversation' },
  feedback: { title: 'layout.bread.feedback', to: '/feedback' },
  application: { title: 'layout.bread.setting', to: '/setting' },
  release: { title: 'layout.bread.release', to: '/release' },
  contribution: { title: 'layout.bread.contribution', to: '/contribution' },
};

const Bread = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { pathname } = useLocation();
  const [breads, setBreads] = useState<{ title: string; to: string }[]>([]);
  const { pageName } = useAppSelector(state => state.breadcrumb);

  useEffect(() => {
    const curBreads: { title: string; to: string }[] = [];
    if (pathname === '/') {
      curBreads.push(HomeBread);
    } else {
      const pieces = pathname.split('/').filter(it => it !== '');
      pieces.forEach(it => {
        const bread = OtherBread[it as keyof typeof OtherBread];
        if (bread) {
          curBreads.push(bread);
        }
      });
    }
    if (pageName) {
      curBreads.push({ title: pageName, to: 'custom' });
    }
    setBreads(curBreads);
  }, [pathname, pageName, t]);

  return (
    <Stack
      direction={'row'}
      alignItems={'center'}
      gap={1}
      sx={{
        flexGrow: 1,
        color: 'text.tertiary',
        fontSize: '14px',
        a: { color: 'text.tertiary' },
        lineHeight: '22px',
      }}
    >
      <KBSelect />
      {breads.map((it, idx) => {
        return (
          <Stack
            direction={'row'}
            alignItems={'center'}
            gap={1}
            key={it.title}
            sx={{
              color:
                idx === breads.length - 1
                  ? `${theme.palette.text.primary} !important`
                  : 'text.disabled',
              a: {
                color:
                  idx === breads.length - 1
                    ? `${theme.palette.text.primary} !important`
                    : 'text.disabled',
              },
              ...(idx === breads.length - 1 && { fontWeight: 'bold' }),
            }}
          >
            <IconXiala sx={{ fontSize: 20, transform: 'rotate(-90deg)' }} />
            {it.to === 'custom' ? (
              <Box
                sx={{ cursor: 'pointer', ':hover': { color: 'primary.main' } }}
              >
                {it.title}
              </Box>
            ) : (
              <NavLink to={it.to}>
                <Box
                  sx={{
                    cursor: 'pointer',
                    ':hover': { color: 'primary.main' },
                  }}
                >
                  {t(it.title)}
                </Box>
              </NavLink>
            )}
          </Stack>
        );
      })}
    </Stack>
  );
};

export default Bread;
