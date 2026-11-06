'use client';
import Link from 'next/link';
import { hasNavigation } from '@/features/kenfut/links';
import { Button } from '@mui/material';
import { useTranslations } from 'next-intl';

import Logo from '@/assets/images/logo.png';
import { useBasePath, useLocaleBasePath } from '@/hooks';
import { useStore } from '@/provider';
import { postShareProV1AuthLogout } from '@/request/pro/ShareAuth';
import { getImagePath } from '@/utils/getImagePath';
import { Modal } from '@ctzhian/ui';
import ErrorIcon from '@mui/icons-material/Error';
import { alpha, Box, IconButton, Stack, Tooltip } from '@mui/material';
import { IconDengchu, IconZhinengwenda } from '@panda-wiki/icons';
import type { NavBtn } from '@/assets/type';
import { localHref } from '@/features/kenfut/links';
import {
  Header as CustomHeader,
  WelcomeHeader as WelcomeHeaderComponent,
} from '@panda-wiki/ui';
import { useMemo, useState } from 'react';
import QaModal from '../QaModal';
import ThemeSwitch from './themeSwitch';
import LocaleSwitch from './localeSwitch';
interface HeaderProps {
  isDocPage?: boolean;
  isWelcomePage?: boolean;
}

const LogoutButton = () => {
  const t = useTranslations('header');
  const basePath = useBasePath();
  const [open, setOpen] = useState(false);
  const handleLogout = () => {
    return postShareProV1AuthLogout().then(() => {
      // 使用当前页面的协议（http 或 https）
      const protocol = window.location.protocol;
      const host = window.location.host;
      window.location.href = `${protocol}//${host}${basePath}/auth/login`;
    });
  };
  return (
    <>
      <Modal
        title={
          <Stack direction='row' alignItems='center' gap={1}>
            <ErrorIcon sx={{ fontSize: 24, color: 'warning.main' }} />
            <Box sx={{ mt: '2px' }}>{t('tip')}</Box>
          </Stack>
        }
        open={open}
        okText={t('confirm')}
        cancelText={t('cancel')}
        onCancel={() => setOpen(false)}
        onOk={handleLogout}
        closable={false}
      >
        <Box sx={{ pl: 4 }}>{t('logoutConfirmContent')}</Box>
      </Modal>
      <Tooltip title={t('logout')} arrow>
        <IconButton size='small' onClick={() => setOpen(true)}>
          <IconDengchu
            sx={theme => ({
              cursor: 'pointer',
              color: alpha(theme.palette.text.primary, 0.65),
              fontSize: 24,
              '&:hover': { color: theme.palette.primary.main },
            })}
          />
        </IconButton>
      </Tooltip>
    </>
  );
};

const navigationButtons = (
  buttons: NavBtn[] | undefined,
  basePath: string,
  linkBasePath: string,
  siteURL: string | undefined,
  mobile: boolean,
  t: (key: string) => string,
) => {
  const result = (buttons || []).map(item => ({
    ...item,
    url: localHref(linkBasePath, item.url),
    icon: getImagePath(item.icon, basePath),
    variant: item.variant || ('text' as const),
  }));
  if (mobile) {
    for (const [page, text] of [
      ['/node', t('docs')],
      ['/blog', t('blog')],
    ] as const) {
      if (!hasNavigation(buttons, page, basePath, siteURL))
        result.push({
          id: `kenfut-${page.slice(1)}`,
          url: `${linkBasePath}${page}`,
          variant: 'text',
          showIcon: false,
          icon: '',
          text,
          target: '_self',
        });
    }
  }
  return result;
};

const AIAction = ({
  mobile,
  onClick,
}: {
  mobile: boolean;
  onClick: () => void;
}) => {
  const t = useTranslations('header');
  return mobile ? (
    <Tooltip title={t('aiChat')}>
      <IconButton size='small' aria-label={t('aiChat')} onClick={onClick}>
        <IconZhinengwenda sx={{ fontSize: 21 }} />
      </IconButton>
    </Tooltip>
  ) : (
    <Button size='small' onClick={onClick}>
      {t('aiChat')}
    </Button>
  );
};

const Header = ({ isDocPage = false, isWelcomePage = false }: HeaderProps) => {
  const {
    mobile = false,
    kbDetail,
    catalogWidth,
    setQaModalOpen,
    setQaMode,
    authInfo,
  } = useStore();
  const tHeader = useTranslations('header');
  const basePath = useBasePath();
  const linkBasePath = useLocaleBasePath();
  const docWidth = useMemo(() => {
    if (isWelcomePage) return 'full';
    return kbDetail?.settings?.theme_and_style?.doc_width || 'full';
  }, [kbDetail, isWelcomePage]);

  const handleSearch = (value?: string, type: 'chat' | 'search' = 'search') => {
    if (value?.trim()) {
      setQaMode?.(type);
      setQaModalOpen?.(true);
      if (type === 'chat') {
        sessionStorage.setItem('chat_search_query', value.trim());
        setQaModalOpen?.(true);
      } else {
        sessionStorage.setItem('content_search_query', value.trim());
      }
    }
  };

  return (
    <CustomHeader
      isDocPage={isDocPage}
      mobile={mobile}
      docWidth={docWidth}
      catalogWidth={catalogWidth}
      logo={getImagePath(kbDetail?.settings?.icon || Logo.src, basePath)}
      title={kbDetail?.settings?.title}
      placeholder={
        kbDetail?.settings?.web_app_custom_style?.header_search_placeholder
      }
      showSearch
      homePath={linkBasePath || '/'}
      btns={navigationButtons(
        kbDetail?.settings?.btns,
        basePath,
        linkBasePath,
        kbDetail?.base_url,
        mobile,
        tHeader,
      )}
      onSearch={handleSearch}
      onQaClick={() => {
        setQaMode?.('search');
        setQaModalOpen?.(true);
      }}
    >
      <Stack
        sx={{ ml: mobile ? 0 : 2, flexShrink: 0 }}
        direction='row'
        alignItems='center'
        gap={mobile ? 0.25 : 1}
      >
        {!mobile &&
          !hasNavigation(
            kbDetail?.settings?.btns,
            '/node',
            basePath,
            kbDetail?.base_url,
          ) && (
            <Button component={Link} href={`${linkBasePath}/node`} size='small'>
              {tHeader('docs')}
            </Button>
          )}
        {!mobile &&
          !hasNavigation(
            kbDetail?.settings?.btns,
            '/blog',
            basePath,
            kbDetail?.base_url,
          ) && (
            <Button component={Link} href={`${linkBasePath}/blog`} size='small'>
              {tHeader('blog')}
            </Button>
          )}
        <AIAction
          mobile={mobile}
          onClick={() => {
            setQaMode?.('chat');
            setQaModalOpen?.(true);
          }}
        />
        <LocaleSwitch />
        <ThemeSwitch />
        {!!authInfo && <LogoutButton />}
      </Stack>
      <QaModal />
    </CustomHeader>
  );
};

export const WelcomeHeader = ({
  showSearch = true,
}: {
  showSearch?: boolean;
}) => {
  const tHeader = useTranslations('header');
  const basePath = useBasePath();
  const linkBasePath = useLocaleBasePath();
  const {
    mobile = false,
    kbDetail,
    catalogWidth,
    setQaModalOpen,
    setQaMode,
    authInfo,
  } = useStore();
  const handleSearch = (value?: string, type: 'chat' | 'search' = 'search') => {
    if (value?.trim()) {
      setQaMode?.(type);
      setQaModalOpen?.(true);
      if (type === 'chat') {
        sessionStorage.setItem('chat_search_query', value.trim());
        setQaModalOpen?.(true);
      } else {
        sessionStorage.setItem('content_search_query', value.trim());
      }
    }
  };
  return (
    <WelcomeHeaderComponent
      isDocPage={false}
      mobile={mobile}
      docWidth='full'
      catalogWidth={catalogWidth}
      logo={getImagePath(kbDetail?.settings?.icon || Logo.src, basePath)}
      title={kbDetail?.settings?.title}
      placeholder={
        kbDetail?.settings?.web_app_custom_style?.header_search_placeholder
      }
      showSearch={showSearch}
      homePath={linkBasePath || '/'}
      btns={navigationButtons(
        kbDetail?.settings?.btns,
        basePath,
        linkBasePath,
        kbDetail?.base_url,
        mobile,
        tHeader,
      )}
      onSearch={handleSearch}
      onQaClick={() => {
        setQaMode?.('search');
        setQaModalOpen?.(true);
      }}
    >
      {!mobile &&
        !hasNavigation(
          kbDetail?.settings?.btns,
          '/node',
          basePath,
          kbDetail?.base_url,
        ) && (
          <Button component={Link} href={`${linkBasePath}/node`} size='small'>
            {tHeader('docs')}
          </Button>
        )}
      {!mobile &&
        !hasNavigation(
          kbDetail?.settings?.btns,
          '/blog',
          basePath,
          kbDetail?.base_url,
        ) && (
          <Button component={Link} href={`${linkBasePath}/blog`} size='small'>
            {tHeader('blog')}
          </Button>
        )}
      <AIAction
        mobile={mobile}
        onClick={() => {
          setQaMode?.('chat');
          setQaModalOpen?.(true);
        }}
      />
      {!!authInfo && (
        <Box sx={{ ml: 2 }}>
          <LogoutButton />
        </Box>
      )}
      <QaModal />
    </WelcomeHeaderComponent>
  );
};

export default Header;
