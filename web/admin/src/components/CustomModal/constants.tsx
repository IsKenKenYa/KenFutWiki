import { lazy } from 'react';
import i18n from '@/i18n';
import {
  IconMulushu,
  IconJichuwendang,
  IconJianyiwendang,
  IconChangjianwenti,
  IconLunbotu,
  IconDanwenzi,
  IconShuzikapian,
  IconKehuanli,
  IconTexing,
  IconZuotuyouzi,
  IconYoutuzuozi,
  IconKehupingjia,
  IconJiugongge,
  IconLianjiezu1,
  IconWenjianjia1,
} from '@panda-wiki/icons';
import {
  DomainRecommendNodeListResp,
  GithubComChaitinPandaWikiApiNodeV1NodeListGroupNavResp,
} from '@/request/types';

export const DEFAULT_DATA = {
  text: {
    title: i18n.t('customModal.defaults.textTitle'),
  },
  metrics: {
    title: i18n.t('customModal.defaults.metricsTitle'),
    list: [] as {
      name: string;
      number: string;
      id: string;
    }[],
  },
  case: {
    title: i18n.t('customModal.defaults.caseTitle'),
    list: [] as {
      id: string;
      name: string;
      link: string;
    }[],
  },
  feature: {
    title: i18n.t('customModal.defaults.featureTitle'),
    list: [] as {
      id: string;
      name: string;
      desc: string;
    }[],
  },
  img_text: {
    title: i18n.t('customModal.defaults.imgTextTitle'),
    item: {
      url: '',
      name: '',
      desc: '',
    },
  },
  text_img: {
    title: i18n.t('customModal.defaults.textImgTitle'),
    item: {
      url: '',
      name: '',
      desc: '',
    },
  },
  comment: {
    title: i18n.t('customModal.defaults.commentTitle'),
    list: [] as {
      id: string;
      user_name: string;
      avatar: string;
      profession: string;
      comment: string;
    }[],
  },
  block_grid: {
    title: i18n.t('customModal.defaults.blockGridTitle'),
    list: [] as {
      id: string;
      url: string;
      name: string;
    }[],
  },
  banner: {
    title: '',
    subtitle: '',
    placeholder: '',
    bg_url: '',
    hot_search: [] as string[],
    btns: [] as {
      id: string;
      text: string;
      type: 'contained' | 'outlined' | 'text';
      href: string;
    }[],
  },
  basic_doc: {
    title: i18n.t('customModal.defaults.basicDocTitle'),
    nodes: [] as DomainRecommendNodeListResp[],
  },
  dir_doc: {
    title: i18n.t('customModal.defaults.dirDocTitle'),
    nodes: [] as DomainRecommendNodeListResp[],
  },
  nav_doc: {
    title: i18n.t('customModal.defaults.navDocTitle'),
    nodes: [] as (GithubComChaitinPandaWikiApiNodeV1NodeListGroupNavResp & {
      id: string;
    })[],
  },
  simple_doc: {
    title: i18n.t('customModal.defaults.simpleDocTitle'),
    nodes: [] as DomainRecommendNodeListResp[],
  },
  carousel: {
    title: i18n.t('customModal.defaults.carouselTitle'),
    list: [] as {
      id: string;
      title: string;
      url: string;
      desc: string;
    }[],
  },
  faq: {
    title: i18n.t('customModal.defaults.faqTitle'),
    list: [] as {
      id: string;
      question: string;
      link: string;
    }[],
  },
  question: {
    title: i18n.t('customModal.defaults.questionTitle'),
    list: [] as {
      id: string;
      question: string;
    }[],
  },
};

export const COMPONENTS_MAP = {
  header: {
    name: 'header',
    title: 'customModal.components.header',
    component: lazy(() => import('@panda-wiki/ui/welcomeHeader')),
    config: lazy(() => import('./components/config/HeaderConfig')),
    fixed: true,
    disabled: false,
    hidden: false,
  },
  banner: {
    name: 'banner',
    title: 'customModal.components.banner',
    component: lazy(() => import('@panda-wiki/ui/banner')),
    config: lazy(() => import('./components/config/BannerConfig')),
    fixed: true,
    disabled: false,
    hidden: false,
  },
  basic_doc: {
    name: 'basic_doc',
    title: 'customModal.components.basicDoc',
    icon: IconJichuwendang,
    component: lazy(() => import('@panda-wiki/ui/basicDoc')),
    config: lazy(() => import('./components/config/BasicDocConfig')),
    fixed: false,
    disabled: false,
    hidden: false,
  },
  dir_doc: {
    name: 'dir_doc',
    title: 'customModal.components.dirDoc',
    icon: IconWenjianjia1,
    component: lazy(() => import('@panda-wiki/ui/dirDoc')),
    config: lazy(() => import('./components/config/DirDocConfig')),
    fixed: false,
    disabled: false,
    hidden: false,
  },
  nav_doc: {
    name: 'nav_doc',
    title: 'customModal.components.navDoc',
    icon: IconMulushu,
    component: lazy(() => import('@panda-wiki/ui/navDoc')),
    config: lazy(() => import('./components/config/NavDocConfig')),
    fixed: false,
    disabled: false,
    hidden: false,
  },
  simple_doc: {
    name: 'simple_doc',
    title: 'customModal.components.simpleDoc',
    icon: IconJianyiwendang,
    component: lazy(() => import('@panda-wiki/ui/simpleDoc')),
    config: lazy(() => import('./components/config/SimpleDocConfig')),
    fixed: false,
    disabled: false,
    hidden: false,
  },
  carousel: {
    name: 'carousel',
    title: 'customModal.components.carousel',
    icon: IconLunbotu,
    component: lazy(() => import('@panda-wiki/ui/carousel')),
    config: lazy(() => import('./components/config/CarouselConfig')),
    fixed: false,
    disabled: false,
    hidden: false,
  },
  faq: {
    name: 'faq',
    title: 'customModal.components.faq',
    icon: IconLianjiezu1,
    component: lazy(() => import('@panda-wiki/ui/faq')),
    config: lazy(() => import('./components/config/FaqConfig')),
    fixed: false,
    disabled: false,
    hidden: false,
  },
  footer: {
    name: 'footer',
    title: 'customModal.components.footer',
    component: lazy(() => import('@panda-wiki/ui/welcomeFooter')),
    config: lazy(() => import('./components/config/FooterConfig')),
    fixed: true,
    disabled: false,
    hidden: false,
  },
  text: {
    name: 'text',
    title: 'customModal.components.text',
    icon: IconDanwenzi,
    component: lazy(() => import('@panda-wiki/ui/text')),
    config: lazy(() => import('./components/config/TextConfig')),
    fixed: false,
    disabled: false,
    hidden: false,
  },
  case: {
    name: 'case',
    title: 'customModal.components.case',
    icon: IconKehuanli,
    component: lazy(() => import('@panda-wiki/ui/case')),
    config: lazy(() => import('./components/config/CaseConfig')),
    fixed: false,
    disabled: false,
    hidden: false,
  },
  metrics: {
    name: 'metrics',
    title: 'customModal.components.metrics',
    icon: IconShuzikapian,
    component: lazy(() => import('@panda-wiki/ui/metrics')),
    config: lazy(() => import('./components/config/MetricsConfig')),
    fixed: false,
    disabled: false,
    hidden: false,
  },
  feature: {
    name: 'feature',
    title: 'customModal.components.feature',
    icon: IconTexing,
    component: lazy(() => import('@panda-wiki/ui/feature')),
    config: lazy(() => import('./components/config/FeatureConfig')),
    fixed: false,
    disabled: false,
    hidden: false,
  },
  img_text: {
    name: 'img_text',
    title: 'customModal.components.imgText',
    icon: IconZuotuyouzi,
    component: lazy(() => import('@panda-wiki/ui/imgText')),
    config: lazy(() => import('./components/config/ImgTextConfig')),
    fixed: false,
    disabled: false,
    hidden: false,
  },
  text_img: {
    name: 'text_img',
    title: 'customModal.components.textImg',
    icon: IconYoutuzuozi,
    component: lazy(() => import('@panda-wiki/ui/imgText')),
    config: lazy(() => import('./components/config/ImgTextConfig')),
    fixed: false,
    disabled: false,
    hidden: false,
  },
  comment: {
    name: 'comment',
    title: 'customModal.components.comment',
    icon: IconKehupingjia,
    component: lazy(() => import('@panda-wiki/ui/comment')),
    config: lazy(() => import('./components/config/CommentConfig')),
    fixed: false,
    disabled: false,
    hidden: false,
  },
  block_grid: {
    name: 'block_grid',
    title: 'customModal.components.blockGrid',
    icon: IconJiugongge,
    component: lazy(() => import('@panda-wiki/ui/blockGrid')),
    config: lazy(() => import('./components/config/BlockGridConfig')),
    fixed: false,
    disabled: false,
    hidden: false,
  },
  question: {
    name: 'question',
    title: 'customModal.components.question',
    icon: IconChangjianwenti,
    component: lazy(() => import('@panda-wiki/ui/question')),
    config: lazy(() => import('./components/config/QuestionConfig')),
    fixed: false,
    disabled: false,
    hidden: false,
  },
};

export const TYPE_TO_CONFIG_LABEL = {
  banner: 'banner_config',
  basic_doc: 'basic_doc_config',
  dir_doc: 'dir_doc_config',
  nav_doc: 'nav_doc_config',
  simple_doc: 'simple_doc_config',
  carousel: 'carousel_config',
  faq: 'faq_config',
  text: 'text_config',
  case: 'case_config',
  metrics: 'metrics_config',
  feature: 'feature_config',
  text_img: 'text_img_config',
  img_text: 'img_text_config',
  comment: 'comment_config',
  block_grid: 'block_grid_config',
  question: 'question_config',
} as const;
