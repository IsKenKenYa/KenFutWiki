import { ConstsHomePageSetting } from '@/request/types';
import { getBasePath } from '@/utils/getBasePath';

export const INIT_DOC_DATA = [
  {
    type: 2,
    emoji: '📘',
    name: '欢迎使用 KenFutWiki',
    summary:
      '这是一篇中性的示例文档，用于演示文档创建与发布流程，不包含任何第三方账号、密钥或外部链接。',
    content:
      '<h1>欢迎使用 KenFutWiki</h1><p>KenFutWiki 是一个面向内容运营的知识库与文章发布系统。</p><p>你可以在这里创建文档、发布文章，并在文章末尾配置 CTA 按钮与关联链接。</p><p>清理这篇示例文档后即可开始录入自己的内容。</p>',
  },
] as const;

export const INIT_LADING_DATA = {
  title: 'KenFutWiki',
  theme_mode: 'light',
  home_page_setting:
    ConstsHomePageSetting.HomePageSettingCustom as ConstsHomePageSetting,
  icon: getBasePath('/images/init/icon.png'),
  btns: [],
  web_app_custom_style: {
    allow_theme_switching: false,
    header_search_placeholder: '搜索文档或提问',
    show_brand_info: true,
    footer_show_intro: true,
    social_media_accounts: [],
  },
  footer_settings: {
    footer_style: 'complex',
    corp_name: '',
    icp: '',
    brand_name: 'KenFutWiki',
    brand_desc: 'KenFutWiki 是面向内容运营的知识库与文章发布系统。',
    brand_logo: getBasePath('/images/init/brand_logo.png'),
    brand_groups: [],
  },
  web_app_landing_configs: [
    {
      type: 'banner',
      banner_config: {
        title: '欢迎使用 KenFutWiki',
        title_color: '#6E73FE',
        title_font_size: 60,
        subtitle: '创建文档、发布文章，并配置 CTA 与关联链接。',
        placeholder: '有问题？问问 AI',
        subtitle_color: '#ffffff80',
        subtitle_font_size: 16,
        bg_url: '',
        hot_search: [
          'KenFutWiki 是什么？',
          '如何创建第一篇文档？',
          '如何配置文章 CTA？',
        ],
        btns: [],
      },
      node_ids: [],
      nodes: null,
    },
    {
      type: 'basic_doc',
      basic_doc_config: {
        title: '快速开始',
        title_color: '#000000',
        bg_color: '#ffffff00',
      },
      node_ids: [],
    },
    {
      type: 'faq',
      faq_config: {
        title: '常见问题',
        title_color: '#000000',
        bg_color: '#ffffff00',
        list: [],
      },
      node_ids: [],
      nodes: null,
    },
  ],
};
