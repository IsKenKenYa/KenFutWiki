import NoData from '@/assets/images/nodata.png';
import Card from '@/components/Card';
import { tableSx } from '@/constant/styles';
import { getApiV1UserList } from '@/request/User';
import { ConstsUserRole, V1UserListItemResp } from '@/request/types';
import { useAppSelector } from '@/store';
import { Table } from '@ctzhian/ui';
import { ColumnType } from '@ctzhian/ui/dist/Table';
import { Box, Button, Stack, Tooltip } from '@mui/material';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MemberAdd from './MemberAdd';
import MemberDelete from './MemberDelete';
import MemberUpdate from './MemberUpdate';

// 角色名存 i18n key，渲染时翻译
const ConstsUserRoleMap = {
  [ConstsUserRole.UserRoleAdmin]: 'member.roleAdmin',
  [ConstsUserRole.UserRoleUser]: 'member.roleUser',
};

const Member = () => {
  const { t } = useTranslation();
  const { user } = useAppSelector(state => state.config);
  const [loading, setLoading] = useState(false);
  const [userList, setUserList] = useState<V1UserListItemResp[]>([]);
  const [curUser, setCurUser] = useState<V1UserListItemResp | null>(null);
  const [curType, setCurType] = useState<'delete' | 'reset-password' | null>(
    null,
  );

  const columns: ColumnType<V1UserListItemResp>[] = [
    {
      title: t('member.colAccount'),
      dataIndex: 'account',
      render: (text: string, record) => (
        <Stack direction={'row'} alignItems={'center'} gap={2}>
          {text}
          {user?.id === record.id ? (
            <Box
              sx={{
                borderColor: 'text.primary',
                border: '1px solid',
                p: '0 8px',
                borderRadius: '10px',
                fontSize: '12px',
                lineHeight: '18px',
              }}
            >
              {t('member.me')}
            </Box>
          ) : null}
        </Stack>
      ),
    },
    {
      title: t('member.colRole'),
      dataIndex: 'role',
      render: (text: ConstsUserRole) => <Box>{t(ConstsUserRoleMap[text])}</Box>,
    },
    {
      title: t('member.colLastAccess'),
      dataIndex: 'last_access',
      render: (text: string) => (
        <Box>{text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-'}</Box>
      ),
    },
    {
      title: '',
      dataIndex: 'action',
      width: 140,
      render: (_, record) => (
        <Stack direction={'row'} gap={2}>
          {record.account === 'admin' ? (
            <Tooltip
              arrow
              slotProps={{
                tooltip: {
                  sx: {
                    maxWidth: 'none',
                  },
                },
              }}
              title={
                <Box>
                  <Stack
                    direction={'row'}
                    alignItems={'center'}
                    gap={1}
                    sx={{ mb: 1, whiteSpace: 'nowrap' }}
                  >
                    {t('member.adminEnvPrefix')}
                    <Box
                      sx={{
                        fontWeight: 700,
                        bgcolor: 'background.paper',
                        px: 1.5,
                        py: 0.25,
                        borderRadius: '4px',
                        color: 'text.primary',
                      }}
                    >
                      .env
                    </Box>
                    {t('member.adminEnvField')}
                    <Box
                      sx={{
                        fontWeight: 700,
                        bgcolor: 'background.paper',
                        px: 1.5,
                        py: 0.25,
                        borderRadius: '4px',
                        color: 'text.primary',
                      }}
                    >
                      ADMIN_PASSWORD
                    </Box>
                    {t('member.adminEnvSuffix')}
                  </Stack>
                  <Stack direction={'row'} alignItems={'center'} gap={1}>
                    {t('member.adminEnvRun')}
                    <Box
                      sx={{
                        fontWeight: 700,
                        bgcolor: 'background.paper',
                        px: 1.5,
                        py: 0.25,
                        borderRadius: '4px',
                        color: 'text.primary',
                      }}
                    >
                      docker compose up -d
                    </Box>
                    {t('member.adminEnvEffect')}
                  </Stack>
                </Box>
              }
            >
              <Button
                size='small'
                sx={{
                  color: 'var(--mui-palette-action-disabled)',
                  cursor: 'not-allowed',
                  p: 0,
                  minWidth: 'auto',
                }}
              >
                {t('member.changePassword')}
              </Button>
            </Tooltip>
          ) : (
            <Button
              size='small'
              sx={{ p: 0, minWidth: 'auto' }}
              color='primary'
              disabled={
                record.role === 'admin' &&
                user.account !== 'admin' &&
                user.id !== record.id
              }
              onClick={() => {
                setCurUser(record);
                setCurType('reset-password');
              }}
            >
              {user?.id === record.id
                ? t('member.changePassword')
                : t('member.resetPassword')}
            </Button>
          )}
          {user?.id !== record.id &&
            (user.account === 'admin' ||
              (user.role === 'admin' && record.role !== 'admin')) && (
              <Button
                size='small'
                color='error'
                sx={{ p: 0, minWidth: 'auto' }}
                onClick={() => {
                  setCurUser(record);
                  setCurType('delete');
                }}
              >
                {t('common.delete')}
              </Button>
            )}
        </Stack>
      ),
    },
  ];

  const getData = () => {
    setLoading(true);
    getApiV1UserList()
      .then(data => {
        const res = data.users || [];
        const idx = res.findIndex(item => item.id === user?.id);
        if (idx !== -1) {
          setUserList([res[idx], ...res.slice(0, idx), ...res.slice(idx + 1)]);
        } else {
          setUserList(res);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    getData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card
      sx={{
        flex: 1,
        py: 2,
        overflow: 'hidden',
        overflowY: 'auto',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Stack
        direction={'row'}
        justifyContent={'space-between'}
        alignItems={'center'}
        sx={{ mb: 2, px: 2 }}
      >
        <Box sx={{ fontSize: 14, lineHeight: '24px', fontWeight: 'bold' }}>
          {t('member.title')}
        </Box>
        <MemberAdd refresh={getData} userLen={userList.length} />
      </Stack>
      <Table
        columns={columns}
        dataSource={userList}
        rowKey='id'
        size='small'
        updateScrollTop={false}
        height='338px'
        sx={{ overflow: 'hidden', ...tableSx }}
        pagination={false}
        renderEmpty={
          loading ? (
            <Box></Box>
          ) : (
            <Stack alignItems={'center'}>
              <img src={NoData} width={150} />
              <Box
                sx={{
                  fontSize: 12,
                  lineHeight: '20px',
                  color: 'text.tertiary',
                }}
              >
                {t('common.noData')}
              </Box>
            </Stack>
          )
        }
      />
      {curUser && curType === 'reset-password' && (
        <MemberUpdate
          user={curUser}
          refresh={getData}
          type={user?.id === curUser.id ? 'update' : 'reset'}
        />
      )}
      <MemberDelete
        open={!!curUser && curType === 'delete'}
        onClose={() => {
          setCurType(null);
          setCurUser(null);
        }}
        user={curUser}
        refresh={getData}
      />
    </Card>
  );
};

export default Member;
