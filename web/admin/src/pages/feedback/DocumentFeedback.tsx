import {
  getApiProV1DocumentList,
  deleteApiProV1DocumentFeedback,
} from '@/request/pro';
import { DomainDocumentFeedbackListItem } from '@/request/pro/types';

import NoData from '@/assets/images/nodata.png';
import { tableSx } from '@/constant/styles';
import { useAppSelector } from '@/store';
import { Box, Stack, ButtonBase } from '@mui/material';
import { Ellipsis, Table, Modal, message } from '@ctzhian/ui';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// 文档反馈列表：读者在文档页提交的纠错与意见，支持删除与截图预览
const DocumentFeedback = () => {
  const { t } = useTranslation();
  const { kb_id = '' } = useAppSelector(state => state.config);
  const [data, setData] = useState<DomainDocumentFeedbackListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [preview, setPreview] = useState<string>('');

  const onDelete = (id: string) => {
    Modal.confirm({
      title: t('feedback.deleteDocFeedbackTitle'),
      content: t('feedback.deleteDocFeedbackConfirm'),
      okText: t('common.delete'),
      okButtonProps: {
        color: 'error',
      },
      cancelButtonProps: {
        color: 'primary',
      },
      onOk: () => {
        deleteApiProV1DocumentFeedback({ ids: [id] }).then(() => {
          message.success(t('common.deleteSuccess'));
          if (page === 1) {
            getData({});
          } else {
            setPage(1);
          }
        });
      },
    });
  };

  const columns = [
    {
      dataIndex: 'node_name',
      title: t('feedback.colDoc'),
      width: 240,
      render: (text: string, record: DomainDocumentFeedbackListItem) => {
        return <Ellipsis>{text || record.node_id || '-'}</Ellipsis>;
      },
    },
    {
      dataIndex: 'content',
      title: t('feedback.colDocFeedbackContent'),
      render: (text: string, record: DomainDocumentFeedbackListItem) => {
        return (
          <Stack gap={0.5}>
            {text && <Box>{text}</Box>}
            {record.correction_suggestion && (
              <Box sx={{ color: 'text.secondary', fontSize: 12 }}>
                {t('feedback.colDocCorrection')}：{record.correction_suggestion}
              </Box>
            )}
          </Stack>
        );
      },
    },
    {
      dataIndex: 'info',
      title: t('feedback.colName'),
      width: 140,
      render: (text: DomainDocumentFeedbackListItem['info']) => {
        return <Box>{text?.user_name || '-'}</Box>;
      },
    },
    {
      dataIndex: 'ip_address',
      title: t('feedback.colIp'),
      width: 200,
      render: (ip_address: DomainDocumentFeedbackListItem['ip_address']) => {
        const {
          city = '',
          country = '',
          province = '',
          ip = '',
        } = ip_address || {};
        return (
          <>
            <Box>{ip || '-'}</Box>
            <Box sx={{ color: 'text.tertiary', fontSize: 12 }}>
              {country === '中国' ? `${province}-${city}` : `${country}`}
            </Box>
          </>
        );
      },
    },
    {
      dataIndex: 'info.screen_shot',
      title: t('feedback.colScreenshot'),
      width: 100,
      render: (text: string, record: DomainDocumentFeedbackListItem) => {
        return record.info?.screen_shot ? (
          <ButtonBase
            disableRipple
            className='primary-color'
            onClick={() => setPreview(record.info!.screen_shot!)}
          >
            {t('feedback.viewScreenshot')}
          </ButtonBase>
        ) : (
          '-'
        );
      },
    },
    {
      dataIndex: 'created_at',
      title: t('feedback.colPublishedAt'),
      width: 180,
      render: (text: string) => {
        return text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '';
      },
    },
    {
      dataIndex: 'opt',
      title: t('feedback.colActions'),
      width: 100,
      render: (text: string, record: DomainDocumentFeedbackListItem) => {
        return (
          <ButtonBase
            disableRipple
            sx={{ color: 'error.main' }}
            onClick={() => onDelete(record.id!)}
          >
            {t('common.delete')}
          </ButtonBase>
        );
      },
    },
  ];

  const getData = ({
    paramKbId,
    paramPage,
    paramPageSize,
  }: {
    paramKbId?: string;
    paramPage?: number;
    paramPageSize?: number;
  }) => {
    setLoading(true);
    return getApiProV1DocumentList({
      kb_id: paramKbId || kb_id,
      page: paramPage || page,
      per_page: paramPageSize || pageSize,
    })
      .then(res => {
        setData(res.data || []);
        setTotal(res.total || 0);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!kb_id) return;
    setPage(1);
    getData({ paramPage: 1, paramKbId: kb_id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kb_id]);

  return (
    <>
      <Table
        columns={columns}
        dataSource={data}
        rowKey='id'
        height='calc(100vh - 250px)'
        size='small'
        sx={tableSx}
        pagination={{
          total,
          pageSize,
          page,
          onChange: (page, pageSize) => {
            setPage(page);
            setPageSize(pageSize);
            getData({ paramPage: page, paramPageSize: pageSize });
          },
        }}
        renderEmpty={
          loading ? (
            <Box></Box>
          ) : (
            <Stack alignItems={'center'} sx={{ mt: 20 }}>
              <img src={NoData} width={174} alt='' />
              <Box>{t('feedback.noDocFeedback')}</Box>
            </Stack>
          )
        }
        loading={loading}
      />
      <Modal
        title={t('feedback.colScreenshot')}
        open={!!preview}
        footer={null}
        onCancel={() => setPreview('')}
      >
        {preview && (
          <Box
            component='img'
            src={preview}
            alt=''
            sx={{ width: '100%', display: 'block' }}
          />
        )}
      </Modal>
    </>
  );
};

export default DocumentFeedback;
