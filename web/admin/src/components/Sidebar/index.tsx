import Qrcode from '@/assets/images/qrcode.png';

import { Box, Button, Stack, Typography, useTheme } from '@mui/material';
import { ConstsUserKBPermission } from '@/request/types';
import { Modal } from '@ctzhian/ui';
import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import Version from './Version';
import { SIDEBAR_WIDTH } from '@/constant/layout';
import { useAppSelector } from '@/store';
import {
  IconBangzhuwendang1,
  IconNeirongguanli,
  IconTongjifenxi1,
  IconJushou,
  IconGongxian,
  IconPaperFull,
  IconDuihualishi1,
  IconChilun,
  IconGroup,
  IconGithub,
} from '@panda-wiki/icons';

// label 存 i18n key，渲染时按当前语言翻译
const MENUS = [
  {
    label: 'layout.nav.operations',
    value: '/kenfut',
    pathname: 'kenfut',
    icon: IconTongjifenxi1,
    show: true,
    perms: [
      ConstsUserKBPermission.UserKBPermissionFullControl,
      ConstsUserKBPermission.UserKBPermissionDataOperate,
      ConstsUserKBPermission.UserKBPermissionDocManage,
    ],
  },
  {
    label: 'layout.nav.document',
    value: '/',
    pathname: 'document',
    icon: IconNeirongguanli,
    show: true,
    perms: [
      ConstsUserKBPermission.UserKBPermissionFullControl,
      ConstsUserKBPermission.UserKBPermissionDocManage,
    ],
  },
  {
    label: 'layout.nav.stat',
    value: '/stat',
    pathname: 'stat',
    icon: IconTongjifenxi1,
    show: true,
    perms: [
      ConstsUserKBPermission.UserKBPermissionFullControl,
      ConstsUserKBPermission.UserKBPermissionDataOperate,
    ],
  },
  {
    label: 'layout.nav.contribution',
    value: '/contribution',
    pathname: 'contribution',
    icon: IconGongxian,
    show: true,
    perms: [ConstsUserKBPermission.UserKBPermissionFullControl],
  },
  {
    label: 'layout.nav.conversation',
    value: '/conversation',
    pathname: 'conversation',
    icon: IconDuihualishi1,
    show: true,
    perms: [
      ConstsUserKBPermission.UserKBPermissionFullControl,
      ConstsUserKBPermission.UserKBPermissionDataOperate,
    ],
  },
  {
    label: 'layout.nav.feedback',
    value: '/feedback',
    pathname: 'feedback',
    icon: IconJushou,
    show: true,
    perms: [
      ConstsUserKBPermission.UserKBPermissionFullControl,
      ConstsUserKBPermission.UserKBPermissionDataOperate,
    ],
  },
  {
    label: 'layout.nav.release',
    value: '/release',
    pathname: 'release',
    icon: IconPaperFull,
    show: true,
    perms: [
      ConstsUserKBPermission.UserKBPermissionFullControl,
      ConstsUserKBPermission.UserKBPermissionDocManage,
    ],
  },
  {
    label: 'layout.nav.setting',
    value: '/setting',
    pathname: 'application-setting',
    icon: IconChilun,
    show: true,
    perms: [ConstsUserKBPermission.UserKBPermissionFullControl],
  },
];

const Sidebar = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { kbDetail } = useAppSelector(state => state.config);
  const theme = useTheme();
  const [showQrcode, setShowQrcode] = useState(false);
  const navigate = useNavigate();
  const menus = useMemo(() => {
    return MENUS.filter(it => {
      return it.perms.includes(kbDetail.perm!);
    });
  }, [kbDetail]);

  useEffect(() => {
    const menu = menus.find(it => {
      if (it.value === '/') {
        return pathname === '/';
      }
      return pathname.startsWith(it.value);
    });

    if (!menu && menus.length > 0) {
      navigate(menus[0].value);
    }
  }, [pathname, menus]);

  return (
    <Stack
      sx={{
        width: SIDEBAR_WIDTH,
        m: 2,
        zIndex: 999,
        p: 2,
        height: 'calc(100vh - 32px)',
        bgcolor: '#FFFFFF',
        borderRadius: '10px',
        position: 'fixed',
        top: 0,
        left: 0,
        overflow: 'auto',
      }}
    >
      <Stack
        direction={'row'}
        alignItems={'center'}
        justifyContent={'center'}
        sx={{ flexShrink: 0 }}
      >
        <Box
          sx={{
            width: 30,
            height: 30,
            borderRadius: 1,
            bgcolor: 'primary.main',
            color: 'white',
            textAlign: 'center',
            lineHeight: '30px',
            fontWeight: 700,
          }}
        >
          K
        </Box>
      </Stack>
      <Box
        sx={{
          fontSize: '16px',
          fontWeight: 'bold',
          color: 'text.primary',
          textAlign: 'center',
          lineHeight: '36px',
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        KenFutWiki
      </Box>
      <Stack sx={{ py: 2, flexGrow: 1 }} gap={1}>
        {menus.map(it => {
          let isActive = false;
          if (it.value === '/') {
            isActive = pathname === '/';
          } else {
            isActive = pathname.includes(it.value);
          }
          if (!it.show) return null;
          const IconMenu = it.icon;
          return (
            <NavLink
              key={it.pathname}
              to={it.value}
              title={t(it.label)}
              style={{
                zIndex: isActive ? 2 : 1,
              }}
            >
              <Button
                variant={isActive ? 'contained' : 'text'}
                color='dark'
                sx={{
                  width: '100%',
                  minWidth: 0,
                  height: 50,
                  px: 2,
                  justifyContent: 'flex-start',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  color: isActive ? '#FFFFFF' : 'text.primary',
                  fontWeight: isActive ? '500' : '400',
                  boxShadow: isActive
                    ? '0px 10px 25px 0px rgba(33,34,45,0.2)'
                    : 'none',
                  ':hover': {
                    boxShadow: isActive
                      ? '0px 10px 25px 0px rgba(33,34,45,0.2)'
                      : 'none',
                  },
                }}
              >
                <IconMenu
                  sx={{
                    fontSize: 14,
                    mr: 1,
                    flexShrink: 0,
                    color: isActive ? '#FFFFFF' : 'text.disabled',
                  }}
                />
                <Box
                  component='span'
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {t(it.label)}
                </Box>
              </Button>
            </NavLink>
          );
        })}
      </Stack>
      <Stack gap={1} sx={{ flexShrink: 0 }}>
        <Button
          variant='outlined'
          color='dark'
          sx={{
            fontSize: 14,
            flexShrink: 0,
            fontWeight: 400,
            minWidth: 0,
            whiteSpace: 'nowrap',
            pr: 1.5,
            pl: 1.5,
            gap: 0.5,
            justifyContent: 'flex-start',
            border: `1px solid ${theme.palette.divider}`,
            '.MuiButton-startIcon': {
              mr: '3px',
            },
            '&:hover': {
              color: 'primary.main',
            },
          }}
          startIcon={
            <IconBangzhuwendang1 sx={{ fontSize: '14px !important' }} />
          }
          onClick={() =>
            window.open('https://github.com/IsKenKenYa/KenFutWiki', '_blank')
          }
        >
          {t('layout.helpDocs')}
        </Button>
        <Button
          variant='outlined'
          color='dark'
          sx={{
            fontSize: 14,
            flexShrink: 0,
            fontWeight: 400,
            minWidth: 0,
            textTransform: 'none',
            whiteSpace: 'nowrap',
            pr: 1.5,
            pl: 1.5,
            gap: 0.5,
            justifyContent: 'flex-start',
            border: `1px solid ${theme.palette.divider}`,
            '.MuiButton-startIcon': {
              mr: '3px',
            },
            '&:hover': {
              color: 'primary.main',
            },
          }}
          startIcon={<IconGithub sx={{ fontSize: '14px !important' }} />}
          onClick={() =>
            window.open('https://github.com/IsKenKenYa/KenFutWiki', '_blank')
          }
        >
          GitHub
        </Button>
        <Button
          variant='outlined'
          color='dark'
          sx={{
            fontSize: 14,
            flexShrink: 0,
            fontWeight: 400,
            minWidth: 0,
            whiteSpace: 'nowrap',
            pr: 1.5,
            pl: 1.5,
            gap: 0.5,
            justifyContent: 'flex-start',
            border: `1px solid ${theme.palette.divider}`,
            '.MuiButton-startIcon': {
              mr: '3px',
            },
            '&:hover': {
              color: 'primary.main',
            },
          }}
          onClick={() => setShowQrcode(true)}
          startIcon={<IconGroup sx={{ fontSize: '14px !important' }} />}
        >
          {t('layout.onlineSupport')}
        </Button>
        <Version />
      </Stack>
      <Modal
        open={showQrcode}
        onCancel={() => setShowQrcode(false)}
        title={t('layout.onlineSupport')}
        footer={null}
        width={600}
      >
        <Box sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
            {/* Enterprise WeChat Group */}
            <Box sx={{ flex: 1, display: 'flex' }}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  background:
                    'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                  textAlign: 'center',
                  width: '100%',
                  height: 280,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <Stack alignItems='center' spacing={1.5}>
                  <Typography
                    variant='subtitle1'
                    sx={{ fontWeight: 600, color: '#2d3748' }}
                  >
                    {t('layout.support.wechatGroup')}
                  </Typography>
                  <Box
                    component='img'
                    src={Qrcode}
                    sx={{
                      width: 120,
                      height: 120,
                      borderRadius: 2,
                      border: '2px solid white',
                      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
                    }}
                  />
                  <Typography
                    variant='body2'
                    sx={{ color: '#4a5568', fontSize: 13 }}
                  >
                    {t('layout.support.wechatScan')}
                  </Typography>
                </Stack>
              </Box>
            </Box>

            {/* Divider */}
            <Box
              sx={{
                display: { xs: 'none', sm: 'flex' },
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Box
                sx={{
                  width: 1,
                  height: '60%',
                  background:
                    'linear-gradient(to bottom, transparent, #e2e8f0, transparent)',
                }}
              />
            </Box>

            {/* Community Forum */}
            <Box sx={{ flex: 1, display: 'flex' }}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  background:
                    'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                  textAlign: 'center',
                  width: '100%',
                  height: 280,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <Stack alignItems='center' spacing={2}>
                  <Typography
                    variant='subtitle1'
                    sx={{ fontWeight: 600, color: '#2d3748' }}
                  >
                    {t('layout.support.communityTitle')}
                  </Typography>
                  <Button
                    variant='contained'
                    onClick={() =>
                      window.open(
                        'https://github.com/IsKenKenYa/KenFutWiki/discussions',
                        '_blank',
                      )
                    }
                    sx={{
                      px: 3,
                      py: 1,
                      fontSize: 13,
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 600,
                      background:
                        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
                      '&:hover': {
                        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.5)',
                        transform: 'translateY(-1px)',
                      },
                      transition: 'all 0.3s ease',
                    }}
                  >
                    {t('layout.support.communityAction')}
                  </Button>
                  <Typography
                    variant='body2'
                    sx={{ color: '#4a5568', fontSize: 13, textAlign: 'center' }}
                  >
                    {t('layout.support.communityDesc')}
                  </Typography>
                </Stack>
              </Box>
            </Box>
          </Stack>
        </Box>
      </Modal>
    </Stack>
  );
};

export default Sidebar;
