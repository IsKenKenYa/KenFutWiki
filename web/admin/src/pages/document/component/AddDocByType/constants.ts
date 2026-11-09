import { ConstsCrawlerSource } from '@/request';

// 文档状态常量
export const DOCUMENT_STATUS = {
  DEFAULT: 'default',
  WAITING: 'waiting',
  UPLOADING: 'uploading',
  UPLOAD_DONE: 'upload-done',
  UPLOAD_ERROR: 'upload-error',
  PULLING: 'pulling',
  PULL_DONE: 'pull-done',
  PULL_ERROR: 'pull-error',
  CREATING: 'creating',
  SUCCESS: 'success',
  ERROR: 'error',
} as const;

// 项目类型常量
export const ITEM_TYPE = {
  FILE: 'file',
  OTHER: 'other',
  FOLDER: 'folder',
} as const;

export const NoParseTypes: readonly ConstsCrawlerSource[] = [
  ConstsCrawlerSource.CrawlerSourceFile,
  ConstsCrawlerSource.CrawlerSourceEpub,
] as const;

// 需要上传文件的导入类型
export const UPLOAD_FILE_TYPES: readonly ConstsCrawlerSource[] = [
  ConstsCrawlerSource.CrawlerSourceFile,
  ConstsCrawlerSource.CrawlerSourceEpub,
  ConstsCrawlerSource.CrawlerSourceWikijs,
  ConstsCrawlerSource.CrawlerSourceYuque,
  ConstsCrawlerSource.CrawlerSourceSiyuan,
  ConstsCrawlerSource.CrawlerSourceMindoc,
  ConstsCrawlerSource.CrawlerSourceConfluence,
] as const;

// 需要解析的导入类型
export const PARSE_TYPES: readonly ConstsCrawlerSource[] = [
  ConstsCrawlerSource.CrawlerSourceConfluence,
  ConstsCrawlerSource.CrawlerSourceWikijs,
  ConstsCrawlerSource.CrawlerSourceSiyuan,
  ConstsCrawlerSource.CrawlerSourceMindoc,
  ConstsCrawlerSource.CrawlerSourceNotion,
] as const;

// 需要抓取的导入类型
export const SCRAPE_TYPES: readonly ConstsCrawlerSource[] = [
  ConstsCrawlerSource.CrawlerSourceRSS,
  ConstsCrawlerSource.CrawlerSourceSitemap,
] as const;

// 类型配置：label/okText 存 i18n key，渲染时用 t() 翻译
export const TYPE_CONFIG: Record<
  ConstsCrawlerSource,
  {
    label: string;
    okText?: string;
    accept?: string;
    usage?: string;
  }
> = {
  [ConstsCrawlerSource.CrawlerSourceFile]: {
    label: 'doc.import.file',
    okText: 'addDoc.importFile',
    accept: '.txt, .md, .xls, .xlsx, .docx, .pdf, .html, .pptx',
  },
  [ConstsCrawlerSource.CrawlerSourceUrl]: {
    label: 'doc.import.url',
  },
  [ConstsCrawlerSource.CrawlerSourceRSS]: {
    label: 'doc.import.rss',
  },
  [ConstsCrawlerSource.CrawlerSourceSitemap]: {
    label: 'doc.import.sitemap',
  },
  [ConstsCrawlerSource.CrawlerSourceNotion]: {
    label: 'doc.import.notion',
  },
  [ConstsCrawlerSource.CrawlerSourceEpub]: {
    label: 'doc.import.epub',
    accept: '.epub',
  },
  [ConstsCrawlerSource.CrawlerSourceWikijs]: {
    label: 'doc.import.wikijs',
    accept: '.zip',
  },
  [ConstsCrawlerSource.CrawlerSourceYuque]: {
    label: 'doc.import.yuque',
    accept: '.lakebook',
  },
  [ConstsCrawlerSource.CrawlerSourceSiyuan]: {
    label: 'doc.import.siyuan',
    accept: '.zip',
  },
  [ConstsCrawlerSource.CrawlerSourceMindoc]: {
    label: 'doc.import.mindoc',
    accept: '.zip',
  },
  [ConstsCrawlerSource.CrawlerSourceFeishu]: {
    label: 'doc.import.feishu',
    okText: 'addDoc.pullKb',
  },
  [ConstsCrawlerSource.CrawlerSourceDingtalk]: {
    label: 'doc.import.dingtalk',
    okText: 'addDoc.pullKb',
  },
  [ConstsCrawlerSource.CrawlerSourceConfluence]: {
    label: 'doc.import.confluence',
    accept: '.zip',
  },
};
