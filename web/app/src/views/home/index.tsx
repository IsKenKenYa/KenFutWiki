'use client';

import { Banner } from '@panda-wiki/ui';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { DomainRecommendNodeListResp } from '@/request/types';
import { convertToTree } from '@/utils/tree';
import { useStore } from '@/provider';
import { useBasePath, useLocaleBasePath } from '@/hooks';
import { getImagePath } from '@/utils/getImagePath';

type Translate = (key: string) => string;

const handleFaqProps = (config: any = {}, t: Translate) => {
  return {
    title: config.title || t('linkGroup'),
    items:
      config.list?.map((item: any) => ({
        question: item.question,
        url: item.link,
      })) || [],
  };
};

const handleBasicDocProps = (
  config: any = {},
  docs: DomainRecommendNodeListResp[],
  basePath: string,
  t: Translate,
) => {
  return {
    title: config.title || t('docSummaryCard'),
    basePath,
    items:
      docs?.map(item => ({
        ...item,
        summary: item.summary || t('noSummary'),
      })) || [],
  };
};

const handleDirDocProps = (
  config: any = {},
  docs: DomainRecommendNodeListResp[],
  basePath: string,
  t: Translate,
) => {
  return {
    title: config.title || t('folderCard'),
    basePath,
    items:
      docs?.map(item => ({
        id: item.id,
        name: item.name,
        ...item,
        recommend_nodes: [...(item.recommend_nodes || [])].sort(
          (a, b) => (a.position ?? 0) - (b.position ?? 0),
        ),
      })) || [],
  };
};

const handleNavDocProps = (
  config: any = {},
  docs: DomainRecommendNodeListResp[],
  basePath: string,
  t: Translate,
) => {
  return {
    title: config.title || t('navCard'),
    basePath,
    items:
      docs?.map(item => ({
        id: item.id,
        name: item.name,
        ...item,
        // @ts-ignore
        list: convertToTree(item.recommend_nodes || []),
      })) || [],
  };
};

const handleSimpleDocProps = (
  config: any = {},
  docs: DomainRecommendNodeListResp[],
  basePath: string,
  t: Translate,
) => {
  return {
    title: config.title || t('simpleDocCard'),
    basePath,
    items:
      docs?.map(item => ({
        ...item,
      })) || [],
  };
};

const handleCarouselProps = (
  config: any = {},
  basePath: string,
  t: Translate,
) => {
  return {
    title: config.title || t('carousel'),
    items:
      config.list?.map((item: any) => ({
        id: item.id,
        title: item.title,
        url: getImagePath(item.url, basePath),
        desc: item.desc,
      })) || [],
  };
};

const handleBannerProps = (config: any = {}, basePath: string) => {
  return {
    title: {
      text: config.title,
    },
    subtitle: {
      text: config.subtitle,
    },
    bg_url: getImagePath(config.bg_url, basePath),
    search: {
      placeholder: config.placeholder,
      hot: config.hot_search,
    },
  };
};

const handleTextProps = (config: any = {}, t: Translate) => {
  return {
    title: config.title || t('title'),
  };
};

const handleCaseProps = (config: any = {}, t: Translate) => {
  return {
    title: config.title || t('cases'),
    items: config.list || [],
  };
};

const handleMetricsProps = (config: any = {}, t: Translate) => {
  return {
    title: config.title || t('metrics'),
    items: config.list || [],
  };
};

const handleFeatureProps = (config: any = {}, t: Translate) => {
  return {
    title: config.title || t('features'),
    items: config.list || [],
  };
};

const handleImgTextProps = (
  config: any = {},
  basePath: string,
  t: Translate,
) => {
  return {
    title: config.title || t('imageText'),
    item: {
      ...config.item,
      url: getImagePath(config.item?.url, basePath),
    },
    direction: 'row',
  };
};

const handleTextImgProps = (
  config: any = {},
  basePath: string,
  t: Translate,
) => {
  return {
    title: config.title || t('textImage'),
    item: {
      ...config.item,
      url: getImagePath(config.item?.url, basePath),
    },
    direction: 'row-reverse',
  };
};

const handleCommentProps = (
  config: any = {},
  basePath: string,
  t: Translate,
) => {
  return {
    title: config.title || t('reviewCard'),
    items:
      config.list?.map((item: any) => ({
        ...item,
        avatar: getImagePath(item.avatar, basePath),
      })) || [],
  };
};

const handleBlockGridProps = (
  config: any = {},
  basePath: string,
  t: Translate,
) => {
  return {
    title: config.title || t('grid'),
    basePath,
    items:
      config.list?.map((item: any) => ({
        ...item,
        url: getImagePath(item.url, basePath),
      })) || [],
  };
};

const handleQuestionProps = (config: any = {}, t: Translate) => {
  return {
    title: config.title || t('faq'),
    items: config.list || [],
  };
};

const componentMap = {
  banner: Banner,
  basic_doc: dynamic(() => import('@panda-wiki/ui').then(mod => mod.BasicDoc)),
  dir_doc: dynamic(() => import('@panda-wiki/ui').then(mod => mod.DirDoc)),
  simple_doc: dynamic(() =>
    import('@panda-wiki/ui').then(mod => mod.SimpleDoc),
  ),
  carousel: dynamic(() => import('@panda-wiki/ui').then(mod => mod.Carousel)),
  faq: dynamic(() => import('@panda-wiki/ui').then(mod => mod.Faq)),
  text: dynamic(() => import('@panda-wiki/ui').then(mod => mod.Text)),
  nav_doc: dynamic(() => import('@panda-wiki/ui').then(mod => mod.NavDoc)),
  case: dynamic(() => import('@panda-wiki/ui').then(mod => mod.Case)),
  metrics: dynamic(() => import('@panda-wiki/ui').then(mod => mod.Metrics)),
  feature: dynamic(() => import('@panda-wiki/ui').then(mod => mod.Feature)),
  text_img: dynamic(() => import('@panda-wiki/ui').then(mod => mod.ImgText)),
  img_text: dynamic(() => import('@panda-wiki/ui').then(mod => mod.ImgText)),
  comment: dynamic(() => import('@panda-wiki/ui').then(mod => mod.Comment)),
  block_grid: dynamic(() =>
    import('@panda-wiki/ui').then(mod => mod.BlockGrid),
  ),
  question: dynamic(() => import('@panda-wiki/ui').then(mod => mod.Question)),
} as const;

const Welcome = () => {
  const basePath = useBasePath();
  const linkBasePath = useLocaleBasePath();
  const t = useTranslations('home');
  const { mobile = false, kbDetail, setQaModalOpen } = useStore();
  const settings = kbDetail?.settings;
  const onBannerSearch = (
    searchText: string,
    type: 'chat' | 'search' = 'chat',
  ) => {
    if (searchText.trim()) {
      if (type === 'chat') {
        sessionStorage.setItem('chat_search_query', searchText.trim());
        setQaModalOpen?.(true);
      } else {
        sessionStorage.setItem('chat_search_query', searchText.trim());
      }
    }
  };

  const TYPE_TO_CONFIG_LABEL = {
    banner: 'banner_config',
    basic_doc: 'basic_doc_config',
    nav_doc: 'nav_doc_config',
    dir_doc: 'dir_doc_config',
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

  const handleComponentProps = (data: any) => {
    const config =
      data[
        TYPE_TO_CONFIG_LABEL[data.type as keyof typeof TYPE_TO_CONFIG_LABEL]
      ];

    switch (data.type) {
      case 'faq':
        return handleFaqProps(config, t);
      case 'basic_doc':
        return handleBasicDocProps(config, data.nodes, linkBasePath, t);
      case 'dir_doc':
        return handleDirDocProps(config, data.nodes, linkBasePath, t);
      case 'nav_doc':
        return handleNavDocProps(config, data.nodes, linkBasePath, t);
      case 'simple_doc':
        return handleSimpleDocProps(config, data.nodes, linkBasePath, t);
      case 'carousel':
        return handleCarouselProps(config, basePath, t);
      case 'banner':
        return {
          ...handleBannerProps(config, basePath),
          onSearch: onBannerSearch,
          btns: (config?.btns || []).map((item: any) => ({
            ...item,
            href: getImagePath(item.href || '/node', linkBasePath),
          })),
        };
      case 'text':
        return handleTextProps(config, t);
      case 'case':
        return handleCaseProps(config, t);
      case 'metrics':
        return handleMetricsProps(config, t);
      case 'feature':
        return handleFeatureProps(config, t);
      case 'text_img':
        return handleTextImgProps(config, basePath, t);
      case 'img_text':
        return handleImgTextProps(config, basePath, t);
      case 'comment':
        return handleCommentProps(config, basePath, t);
      case 'block_grid':
        return handleBlockGridProps(config, basePath, t);
      case 'question':
        return {
          ...handleQuestionProps(config, t),
          onSearch: (text: string) => {
            onBannerSearch(text, 'chat');
          },
        };
    }
  };
  return (
    <>
      {settings?.web_app_landing_configs?.map((item, index) => {
        const Component = componentMap[item.type as keyof typeof componentMap];
        const props = handleComponentProps(item);
        return Component ? (
          // @ts-ignore
          <Component key={index} mobile={mobile} {...props} />
        ) : null;
      })}
    </>
  );
};

export default Welcome;
