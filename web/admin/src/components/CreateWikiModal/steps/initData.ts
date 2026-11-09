import i18next from '@/i18n';
import { ConstsHomePageSetting } from '@/request/types';
import { getBasePath } from '@/utils/getBasePath';

// 示例站点初始化数据：文案随后台语言生成（写入站点的内容，而非界面文案）
export const getInitDocData = () => [
  {
    type: 2 as const,
    emoji: '📘',
    name: i18next.t('wizard.init.docTitle'),
    summary: i18next.t('wizard.init.docSummary'),
    content: i18next.t('wizard.init.docContent'),
  },
];

export const getInitLandingData = () => ({
  title: 'KenFutWiki',
  theme_mode: 'light',
  home_page_setting:
    ConstsHomePageSetting.HomePageSettingCustom as ConstsHomePageSetting,
  icon: getBasePath('/images/init/icon.png'),
  btns: [],
  web_app_custom_style: {
    allow_theme_switching: false,
    header_search_placeholder: i18next.t('wizard.init.searchPlaceholder'),
    show_brand_info: true,
    footer_show_intro: true,
    social_media_accounts: [],
  },
  footer_settings: {
    footer_style: 'complex',
    corp_name: '',
    icp: '',
    brand_name: 'KenFutWiki',
    brand_desc: i18next.t('wizard.init.brandDesc'),
    brand_logo: getBasePath('/images/init/brand_logo.png'),
    brand_groups: [],
  },
  web_app_landing_configs: [
    {
      type: 'banner',
      banner_config: {
        title: i18next.t('wizard.init.docTitle'),
        title_color: '#6E73FE',
        title_font_size: 60,
        subtitle: i18next.t('wizard.init.bannerSubtitle'),
        placeholder: i18next.t('wizard.init.bannerPlaceholder'),
        subtitle_color: '#ffffff80',
        subtitle_font_size: 16,
        bg_url: '',
        hot_search: [
          i18next.t('wizard.init.hotSearch1'),
          i18next.t('wizard.init.hotSearch2'),
          i18next.t('wizard.init.hotSearch3'),
        ],
        btns: [],
      },
      node_ids: [],
      nodes: null,
    },
    {
      type: 'basic_doc',
      basic_doc_config: {
        title: i18next.t('wizard.init.quickStart'),
        title_color: '#000000',
        bg_color: '#ffffff00',
      },
      node_ids: [],
    },
    {
      type: 'faq',
      faq_config: {
        title: i18next.t('home.faqTitle'),
        title_color: '#000000',
        bg_color: '#ffffff00',
        list: [],
      },
      node_ids: [],
      nodes: null,
    },
  ],
});
