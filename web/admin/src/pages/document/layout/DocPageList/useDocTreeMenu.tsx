import { ITreeItem } from '@/api';
import {
  TreeMenuItem,
  TreeMenuOptions,
} from '@/components/Drag/DragTree/TreeMenu';
import { ConstsCrawlerSource } from '@/request/types';
import { ConstsNodeRagInfoStatus } from '@/request/types';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { DocTreeMenuHandlers } from './types';

// label 存 i18n key，构建菜单时按当前语言翻译
const IMPORT_SOURCES: { key: ConstsCrawlerSource; label: string }[] = [
  { key: ConstsCrawlerSource.CrawlerSourceFile, label: 'doc.import.file' },
  { key: ConstsCrawlerSource.CrawlerSourceUrl, label: 'doc.import.url' },
  { key: ConstsCrawlerSource.CrawlerSourceRSS, label: 'doc.import.rss' },
  {
    key: ConstsCrawlerSource.CrawlerSourceSitemap,
    label: 'doc.import.sitemap',
  },
  { key: ConstsCrawlerSource.CrawlerSourceNotion, label: 'doc.import.notion' },
  { key: ConstsCrawlerSource.CrawlerSourceEpub, label: 'doc.import.epub' },
  { key: ConstsCrawlerSource.CrawlerSourceWikijs, label: 'doc.import.wikijs' },
  { key: ConstsCrawlerSource.CrawlerSourceYuque, label: 'doc.import.yuque' },
  { key: ConstsCrawlerSource.CrawlerSourceSiyuan, label: 'doc.import.siyuan' },
  { key: ConstsCrawlerSource.CrawlerSourceMindoc, label: 'doc.import.mindoc' },
  { key: ConstsCrawlerSource.CrawlerSourceFeishu, label: 'doc.import.feishu' },
  {
    key: ConstsCrawlerSource.CrawlerSourceDingtalk,
    label: 'doc.import.dingtalk',
  },
  {
    key: ConstsCrawlerSource.CrawlerSourceConfluence,
    label: 'doc.import.confluence',
  },
];

export function useDocTreeMenu(
  handlers: DocTreeMenuHandlers,
): (opra: TreeMenuOptions) => TreeMenuItem[] {
  const { t } = useTranslation();
  const {
    handleUrl,
    handleDelete,
    handlePublish,
    handleRestudy,
    handleProperties,
    handleFrontDoc,
    handleSaveTemplate,
  } = handlers;

  return useCallback(
    (opra: TreeMenuOptions): TreeMenuItem[] => {
      const { item, createItem, renameItem, isEditing } = opra;
      const menuItems: TreeMenuItem[] = [];

      if (item.type === 1) {
        menuItems.push(
          {
            label: t('doc.createFolder'),
            key: 'folder',
            onClick: () => createItem(1),
          },
          {
            label: t('doc.createDocument'),
            key: 'doc',
            children: [
              {
                label: t('doc.createRichText'),
                key: 'rich_text',
                onClick: () => createItem(2, 'html'),
              },
              {
                label: t('doc.createMarkdown'),
                key: 'md',
                onClick: () => createItem(2, 'md'),
              },
            ],
          },
          {
            label: t('doc.importDocuments'),
            key: 'next-line',
            children: IMPORT_SOURCES.map(({ key: k, label }) => ({
              label: t(label),
              key: k,
              onClick: () => handleUrl(item, k),
            })),
          },
          // 文件夹与文档一样支持三项权限及用户组绑定（后端 permission 接口已支持 type=1）
          {
            label: t('doc.properties.title'),
            key: 'properties',
            onClick: () => handleProperties(item),
          },
        );
      }

      if (item.type === 2) {
        if (item.status === 1 || item.status === 0) {
          menuItems.push({
            label:
              item.status === 1 ? t('doc.publishUpdate') : t('doc.publish'),
            key: 'update_publish',
            onClick: () => handlePublish(item),
          });
        }
        if (item.status !== 0) {
          menuItems.push({
            label:
              item.rag_status === ConstsNodeRagInfoStatus.NodeRagStatusPending
                ? t('doc.restudy.title')
                : t('doc.restudyAgain'),
            key: 'restudy',
            onClick: () => handleRestudy(item),
          });
        }
        menuItems.push(
          {
            label: t('doc.properties.title'),
            key: 'properties',
            onClick: () => handleProperties(item),
          },
          {
            label: t('doc.templates.saveAs'),
            key: 'save_template',
            onClick: () => handleSaveTemplate(item),
          },
          {
            label: t('editor.viewOnSite'),
            key: 'front_doc',
            onClick: () => handleFrontDoc(item.id),
          },
        );
      }

      if (!isEditing) {
        menuItems.push({
          label: t('editor.rename'),
          key: 'rename',
          onClick: renameItem,
        });
      }
      menuItems.push({
        label: t('common.delete'),
        color: 'error',
        key: 'delete',
        onClick: () => handleDelete(item),
      });

      return menuItems;
    },
    [
      t,
      handleUrl,
      handleDelete,
      handlePublish,
      handleRestudy,
      handleProperties,
      handleFrontDoc,
      handleSaveTemplate,
    ],
  );
}
