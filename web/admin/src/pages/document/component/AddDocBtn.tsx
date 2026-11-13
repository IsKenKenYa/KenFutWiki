import TreeMenu, { TreeMenuItem } from '@/components/Drag/DragTree/TreeMenu';
import { ConstsCrawlerSource } from '@/request';
import { Box, Button } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AddDocByType from './AddDocByType';
import DocAddByCustomText from './DocAddByCustomText';
import TemplatesDialog from './TemplatesDialog';

interface InputContentProps {
  exportFile?: boolean;
  refresh?: () => void;
  disabled?: boolean;
  context?: React.ReactElement<{ onClick?: any; 'aria-describedby'?: any }>;
  createLocal?: (node: {
    id: string;
    name: string;
    type: 1 | 2;
    emoji?: string;
    parentId?: string | null;
    content_type?: string;
  }) => void;
  scrollTo?: (id: string) => void;
}

const AddDocBtn = ({
  exportFile = true,
  refresh,
  disabled = false,
  context,
  createLocal,
  scrollTo,
}: InputContentProps) => {
  const [customDocOpen, setCustomDocOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [key, setKey] = useState<ConstsCrawlerSource | null>(null);
  const [docFileKey, setDocFileKey] = useState<1 | 2>(1);
  const { t } = useTranslation();

  const menuItems: TreeMenuItem[] = [
    {
      key: 'docFile',
      label: t('doc.createFolder'),
      onClick: () => {
        setDocFileKey(1);
        setCustomDocOpen(true);
      },
    },
    {
      key: 'next-line',
      label: t('doc.createDocument'),
      onClick: () => {
        setDocFileKey(2);
        setCustomDocOpen(true);
      },
    },
    {
      key: 'template',
      label: t('doc.templates.entry'),
      onClick: () => setTemplatesOpen(true),
    },
    ...(exportFile
      ? [
          {
            key: ConstsCrawlerSource.CrawlerSourceFile,
            label: t('doc.import.file'),
            onClick: () => {
              setUploadOpen(true);
              setKey(ConstsCrawlerSource.CrawlerSourceFile);
            },
          },
          {
            key: ConstsCrawlerSource.CrawlerSourceUrl,
            label: t('doc.import.url'),
            onClick: () => {
              setKey(ConstsCrawlerSource.CrawlerSourceUrl);
              setUploadOpen(true);
            },
          },
          {
            key: ConstsCrawlerSource.CrawlerSourceRSS,
            label: t('doc.import.rss'),
            onClick: () => {
              setUploadOpen(true);
              setKey(ConstsCrawlerSource.CrawlerSourceRSS);
            },
          },
          {
            key: ConstsCrawlerSource.CrawlerSourceSitemap,
            label: t('doc.import.sitemap'),
            onClick: () => {
              setUploadOpen(true);
              setKey(ConstsCrawlerSource.CrawlerSourceSitemap);
            },
          },
          {
            key: ConstsCrawlerSource.CrawlerSourceNotion,
            label: t('doc.import.notion'),
            onClick: () => {
              setUploadOpen(true);
              setKey(ConstsCrawlerSource.CrawlerSourceNotion);
            },
          },
          {
            key: ConstsCrawlerSource.CrawlerSourceEpub,
            label: t('doc.import.epub'),
            onClick: () => {
              setUploadOpen(true);
              setKey(ConstsCrawlerSource.CrawlerSourceEpub);
            },
          },
          {
            key: ConstsCrawlerSource.CrawlerSourceWikijs,
            label: t('doc.import.wikijs'),
            onClick: () => {
              setUploadOpen(true);
              setKey(ConstsCrawlerSource.CrawlerSourceWikijs);
            },
          },
          {
            key: ConstsCrawlerSource.CrawlerSourceYuque,
            label: t('doc.import.yuque'),
            onClick: () => {
              setUploadOpen(true);
              setKey(ConstsCrawlerSource.CrawlerSourceYuque);
            },
          },
          {
            key: ConstsCrawlerSource.CrawlerSourceSiyuan,
            label: t('doc.import.siyuan'),
            onClick: () => {
              setUploadOpen(true);
              setKey(ConstsCrawlerSource.CrawlerSourceSiyuan);
            },
          },
          {
            key: ConstsCrawlerSource.CrawlerSourceMindoc,
            label: t('doc.import.mindoc'),
            onClick: () => {
              setUploadOpen(true);
              setKey(ConstsCrawlerSource.CrawlerSourceMindoc);
            },
          },
          {
            key: ConstsCrawlerSource.CrawlerSourceFeishu,
            label: t('doc.import.feishu'),
            onClick: () => {
              setUploadOpen(true);
              setKey(ConstsCrawlerSource.CrawlerSourceFeishu);
            },
          },
          {
            key: ConstsCrawlerSource.CrawlerSourceDingtalk,
            label: t('doc.import.dingtalk'),
            onClick: () => {
              setUploadOpen(true);
              setKey(ConstsCrawlerSource.CrawlerSourceDingtalk);
            },
          },
          {
            key: ConstsCrawlerSource.CrawlerSourceConfluence,
            label: t('doc.import.confluence'),
            onClick: () => {
              setUploadOpen(true);
              setKey(ConstsCrawlerSource.CrawlerSourceConfluence);
            },
          },
        ]
      : []),
  ];

  const close = () => {
    setUploadOpen(false);
    setCustomDocOpen(false);
  };

  return (
    <Box>
      <TreeMenu
        menu={menuItems}
        context={
          context || (
            <Button variant='contained' disabled={disabled}>
              {t('doc.createDocument')}
            </Button>
          )
        }
      />
      {key && (
        <AddDocByType
          type={key}
          open={uploadOpen}
          refresh={refresh}
          onCancel={close}
          parentId={null}
        />
      )}
      <DocAddByCustomText
        type={docFileKey}
        open={customDocOpen}
        refresh={refresh}
        onCreated={node => {
          createLocal?.(node);
          scrollTo?.(node.id);
        }}
        onClose={() => setCustomDocOpen(false)}
      />
      <TemplatesDialog
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        refresh={refresh}
      />
    </Box>
  );
};

export default AddDocBtn;
