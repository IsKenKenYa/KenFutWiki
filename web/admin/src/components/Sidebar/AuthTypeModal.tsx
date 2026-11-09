import {
  postApiV1License,
  getApiV1License,
  deleteApiV1License,
} from '@/request/pro/License';
import HelpCenter from '@/assets/json/help-center.json';
import Takeoff from '@/assets/json/takeoff.json';
import error from '@/assets/json/error.json';
import IconUpgrade from '@/assets/json/upgrade.json';
import Upload from '@/components/UploadFile/Drag';
import { useVersionInfo } from '@/hooks';
import { useAppDispatch, useAppSelector } from '@/store';
import { setLicense } from '@/store/slices/config';
import { Box, Button, IconButton, Stack, TextField } from '@mui/material';
import { CusTabs, message, Modal } from '@ctzhian/ui';
import { IconWenjian, IconIcon_tool_close } from '@panda-wiki/icons';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import LottieIcon from '../LottieIcon';
import { ConstsLicenseEdition } from '@/request/types';

interface AuthTypeModalProps {
  open: boolean;
  onClose: () => void;
  curVersion: string;
  latestVersion: string;
}

const AuthTypeModal = ({
  open,
  onClose,
  curVersion,
  latestVersion,
}: AuthTypeModalProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { license } = useAppSelector(state => state.config);

  const [selected, setSelected] = useState<'file' | 'code'>(
    license.edition === ConstsLicenseEdition.LicenseEditionEnterprise
      ? 'file'
      : 'code',
  );
  const [updateOpen, setUpdateOpen] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | undefined>(undefined);
  const [unbindLoading, setUnbindLoading] = useState(false);

  const versionInfo = useVersionInfo();

  const handleSubmit = () => {
    setLoading(true);
    postApiV1License({
      license_type: selected,
      license_code: code,
      license_file: file,
    })
      .then(() => {
        message.success(t('layout.version.activateSuccess'));
        setUpdateOpen(false);
        setCode('');
        setFile(undefined);

        getApiV1License().then(res => {
          dispatch(setLicense(res));
        });
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleUnbind = () => {
    Modal.confirm({
      title: t('layout.version.unbindTitle'),
      content: t('layout.version.unbindContent'),
      onOk: () => {
        setUnbindLoading(true);
        deleteApiV1License()
          .then(() => {
            message.success(t('layout.version.unbindSuccess'));
            getApiV1License()
              .then(res => {
                dispatch(setLicense(res));
              })
              .catch(() => {
                message.error(t('layout.version.refreshFailed'));
              });
          })
          .catch(() => {
            message.error(t('layout.version.unbindFailed'));
          })
          .finally(() => {
            setUnbindLoading(false);
          });
      },
    });
  };

  return (
    <>
      <Modal
        open={open}
        footer={null}
        title={t('layout.version.about')}
        onCancel={onClose}
      >
        <Stack gap={1} sx={{ fontSize: 14, lineHeight: '32px' }}>
          <Stack direction={'row'} alignItems={'center'}>
            <Box sx={{ width: 120, flexShrink: 0 }}>
              {t('layout.version.current')}
            </Box>
            <Stack direction={'row'} alignItems={'center'} gap={2}>
              <Box sx={{ fontWeight: 700, minWidth: 50 }}>{curVersion}</Box>
              {latestVersion === `v${curVersion}` ? (
                <Box sx={{ color: 'text.tertiary', fontSize: 12 }}>
                  {t('layout.version.upToDate')}
                </Box>
              ) : (
                <Button
                  size='small'
                  startIcon={
                    <Box>
                      <LottieIcon
                        id='version'
                        src={latestVersion === '' ? HelpCenter : IconUpgrade}
                        style={{ width: 16, height: 16, display: 'flex' }}
                      />
                    </Box>
                  }
                  onClick={() => {
                    window.open(
                      'https://github.com/IsKenKenYa/KenFutWiki/releases',
                    );
                  }}
                >
                  {t('layout.version.updateNow')}
                </Button>
              )}
            </Stack>
          </Stack>
          <Stack direction={'row'} alignItems={'center'}>
            <Box sx={{ width: 120, flexShrink: 0 }}>
              {t('layout.version.edition')}
            </Box>
            <Stack direction={'row'} alignItems={'center'} gap={2}>
              <Box sx={{ minWidth: 50 }}>{t(versionInfo.label)}</Box>
              {license.edition === ConstsLicenseEdition.LicenseEditionFree ? (
                <Stack direction={'row'} gap={2}>
                  <Button
                    size='small'
                    startIcon={
                      <Box>
                        <LottieIcon
                          id='version'
                          src={Takeoff}
                          style={{ width: 16, height: 16, display: 'flex' }}
                        />
                      </Box>
                    }
                    onClick={() => setUpdateOpen(true)}
                  >
                    {t('layout.version.activate')}
                  </Button>
                  <Button
                    size='small'
                    startIcon={
                      <Box>
                        <LottieIcon
                          id='consult'
                          src={HelpCenter}
                          style={{ width: 16, height: 16, display: 'flex' }}
                        />
                      </Box>
                    }
                    onClick={() => {
                      window.open('https://baizhi.cloud/consult');
                    }}
                  >
                    {t('layout.version.consult')}
                  </Button>
                </Stack>
              ) : (
                <Stack direction={'row'} gap={2}>
                  <Button
                    size='small'
                    startIcon={
                      <Box>
                        <LottieIcon
                          id='version'
                          src={Takeoff}
                          style={{ width: 16, height: 16, display: 'flex' }}
                        />
                      </Box>
                    }
                    onClick={() => setUpdateOpen(true)}
                  >
                    {t('layout.version.switchLicense')}
                  </Button>
                  <Button
                    size='small'
                    loading={unbindLoading}
                    startIcon={
                      <Box>
                        <LottieIcon
                          id='unbind'
                          src={error}
                          style={{ width: 16, height: 16, display: 'flex' }}
                        />
                      </Box>
                    }
                    onClick={handleUnbind}
                  >
                    {t('layout.version.unbind')}
                  </Button>
                  <Button
                    size='small'
                    startIcon={
                      <Box>
                        <LottieIcon
                          id='consult'
                          src={HelpCenter}
                          style={{ width: 16, height: 16, display: 'flex' }}
                        />
                      </Box>
                    }
                    onClick={() => {
                      window.open('https://baizhi.cloud/consult');
                    }}
                  >
                    {t('layout.version.consult')}
                  </Button>
                </Stack>
              )}
            </Stack>
          </Stack>
          {license.edition! !== ConstsLicenseEdition.LicenseEditionFree && (
            <Box>
              <Stack direction={'row'} alignItems={'center'}>
                <Box sx={{ width: 120, flexShrink: 0 }}>
                  {t('layout.version.period')}
                </Box>
                <Box>
                  {dayjs.unix(license.started_at!).format('YYYY-MM-DD')}
                </Box>
                <Box sx={{ mx: 1 }}>~</Box>
                <Box>
                  {dayjs.unix(license.expired_at!).format('YYYY-MM-DD')}
                </Box>
              </Stack>
              {dayjs.unix(license.expired_at!).diff(dayjs(), 'day') < 0 && (
                <Box
                  sx={{
                    color: 'error.main',
                    ml: '120px',
                    fontSize: 13,
                    mt: -1,
                  }}
                >
                  {t('layout.version.expired')}
                </Box>
              )}
            </Box>
          )}
        </Stack>
      </Modal>
      <Modal
        title={t('layout.version.activate')}
        open={updateOpen}
        onCancel={() => setUpdateOpen(false)}
        okText={t('layout.version.activateConfirm')}
        okButtonProps={{
          loading,
        }}
        width={500}
        onOk={handleSubmit}
      >
        <CusTabs
          sx={{ width: '100%', button: { width: '50%' } }}
          list={[
            {
              label: t('layout.version.onlineActivate'),
              value: 'code',
              disabled: loading,
            },
            {
              label: t('layout.version.offlineActivate'),
              value: 'file',
              disabled: loading,
            },
          ]}
          value={selected}
          change={(v: string) => setSelected(v as 'file' | 'code')}
        />
        {selected === 'code' && (
          <TextField
            sx={{ mt: 2 }}
            label={t('layout.version.licenseCode')}
            variant='outlined'
            value={code}
            fullWidth
            onChange={e => setCode(e.target.value)}
          />
        )}
        {selected === 'file' && (
          <Box sx={{ mt: 2 }}>
            <Upload
              file={file ? [file] : []}
              onChange={accept => setFile(accept[0])}
              type='drag'
              multiple={false}
              size={1024 * 1024}
            />
            {file && (
              <Stack
                direction={'row'}
                alignItems={'center'}
                justifyContent={'space-between'}
                sx={{
                  mt: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: '10px',
                  px: 2,
                  py: 1,
                  fontSize: 14,
                }}
              >
                <Stack direction={'row'} alignItems={'center'} gap={1}>
                  <IconWenjian sx={{ fontSize: 16 }} />
                  {file.name}
                </Stack>
                <IconButton onClick={() => setFile(undefined)}>
                  <IconIcon_tool_close sx={{ fontSize: 16 }} />
                </IconButton>
              </Stack>
            )}
          </Box>
        )}
      </Modal>
    </>
  );
};

export default AuthTypeModal;
