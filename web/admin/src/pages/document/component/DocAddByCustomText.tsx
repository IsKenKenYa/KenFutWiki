import Emoji from '@/components/Emoji';
import { saveMetadata } from '@/features/kenfut/api';
import type { ContentMetadata } from '@/features/kenfut/types';
import {
  DomainCreateNodeReq,
  DomainNodeListItemResp,
  V1NodeDetailResp,
} from '@/request';
import { postApiV1Node, putApiV1NodeDetail } from '@/request/Node';
import { useAppSelector } from '@/store';
import { message, Modal } from '@ctzhian/ui';
import {
  Box,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
} from '@mui/material';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';

type FormValues = {
  name: string;
  emoji: string;
  content_type: string;
  lang: string;
};

// 语言自称（self-naming）不做翻译
const LANG_OPTIONS: { value: string; label: string }[] = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
];

interface DocAddByCustomTextProps {
  open: boolean;
  data?: V1NodeDetailResp;
  autoJump?: boolean;
  onClose: () => void;
  parentId?: string;
  setDetail?: (data: V1NodeDetailResp) => void;
  refresh?: () => void;
  type?: 1 | 2;
  // 以文章形态创建：创建后写入 article 频道元数据并生成默认 slug
  article?: boolean;
  // 创建译本：指定源文档后，语言选择默认排除源文档语言
  translateFrom?: DomainNodeListItemResp | null;
  onCreated?: (node: {
    id: string;
    name: string;
    type: 1 | 2;
    content_type?: string;
    emoji?: string;
  }) => void;
}

// 优先用名称生成 ASCII slug，包含非 ASCII 字符时退回 node id
const defaultArticleSlug = (name: string, nodeID: string) => {
  const ascii = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return ascii || nodeID;
};

const DocAddByCustomText = ({
  open,
  data,
  autoJump = true,
  parentId,
  onClose,
  refresh,
  setDetail,
  type = 2,
  article = false,
  translateFrom,
  onCreated,
}: DocAddByCustomTextProps) => {
  const { t } = useTranslation();
  const { kb_id: id, nav_id } = useAppSelector(state => state.config);
  // 实体类型名：文件夹 / 文档 / 文章
  const text =
    type === 1
      ? t('doc.folder')
      : article
        ? t('doc.article')
        : t('doc.document');

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: '',
      emoji: '',
      content_type: '',
      lang: 'zh',
    },
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = (value: FormValues) => {
    if (data) {
      putApiV1NodeDetail({
        id: data.id || '',
        kb_id: id,
        nav_id: data.nav_id || nav_id || '',
        name: value.name,
        emoji: value.emoji,
      }).then(() => {
        message.success(t('common.saveSuccess'));
        reset();
        handleClose();
        refresh?.();
        setDetail?.({
          name: value.name,
          meta: { ...data.meta, emoji: value.emoji },
          status: 1,
        });
      });
    } else {
      if (!id) return;
      const params: DomainCreateNodeReq = {
        name: value.name,
        content: '',
        kb_id: id,
        nav_id: nav_id || '',
        type,
        emoji: value.emoji,
        content_type: value.content_type,
        lang: value.lang,
        translate_from_node_id: translateFrom?.id,
      };
      if (parentId) {
        params.parent_id = parentId;
      }
      postApiV1Node(params).then(async ({ id: nodeID }) => {
        if (article) {
          // 文章形态：写入 article 频道元数据与默认 slug；失败要明确提示，避免文章只落在文档目录
          const metadata: ContentMetadata = {
            node_id: nodeID,
            channel: 'article',
            slug: defaultArticleSlug(value.name, nodeID),
            cover_url: '',
            author_name: '',
            author_avatar: '',
            display_date: '',
            category: '',
            tags: [],
            featured: false,
            featured_order: 0,
            related_node_ids: [],
            ctas: [],
          };
          try {
            await saveMetadata(metadata, id);
          } catch (error) {
            message.error(
              error instanceof Error
                ? error.message
                : t('doc.articleInitFailed'),
            );
            return;
          }
        }
        message.success(
          article ? t('doc.createArticleSuccess') : t('doc.createSuccess'),
        );
        reset();
        handleClose();
        // 回传创建结果给上层，由上层本地追加并滚动
        onCreated?.({
          id: nodeID,
          name: value.name,
          type,
          content_type: value.content_type,
          emoji: value.emoji,
        });
        refresh?.();
        if (type === 2 && autoJump) {
          window.open(`/doc/editor/${nodeID}`, '_blank');
        }
      });
    }
  };

  useEffect(() => {
    if (!open) return;
    if (data) {
      reset({
        name: data.name || '',
        emoji: data.meta?.emoji || '',
        content_type: type === 1 ? '' : data.meta?.content_type || 'html',
      });
    } else {
      setValue('content_type', type === 1 ? '' : 'html');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, type, open]);

  return (
    <Modal
      title={
        data
          ? t('doc.editEntity', { entity: text })
          : t('doc.createEntity', { entity: text })
      }
      open={open}
      width={600}
      okText={data ? t('common.save') : t('common.create')}
      onCancel={handleClose}
      onOk={handleSubmit(submit)}
    >
      <Box sx={{ fontSize: 14, lineHeight: '36px' }}>
        {t('doc.nameLabel', { entity: text })}
      </Box>
      <Controller
        control={control}
        name='name'
        rules={{
          required: t('doc.nameRequired', { entity: text }),
        }}
        render={({ field }) => (
          <TextField
            {...field}
            fullWidth
            autoFocus
            size='small'
            placeholder={t('doc.nameRequired', { entity: text })}
            error={!!errors.name}
            helperText={errors.name?.message}
          />
        )}
      />
      <Box sx={{ fontSize: 14, lineHeight: '36px', mt: 1 }}>
        {t('doc.iconLabel', { entity: text })}
      </Box>
      <Controller
        control={control}
        name='emoji'
        render={({ field }) => <Emoji {...field} type={type} />}
      />
      {type === 2 && !data && (
        <>
          <Box sx={{ fontSize: 14, lineHeight: '36px', mt: 1 }}>
            {t('doc.contentType')}
          </Box>
          <Controller
            control={control}
            name='content_type'
            render={({ field }) => (
              <RadioGroup {...field} row>
                <FormControlLabel
                  value='html'
                  control={<Radio size='small' />}
                  label={t('doc.createRichText')}
                />
                <FormControlLabel
                  value='md'
                  control={<Radio size='small' />}
                  label='Markdown'
                />
              </RadioGroup>
            )}
          />
          <Box sx={{ fontSize: 14, lineHeight: '36px', mt: 1 }}>
            {t('doc.contentLang')}
          </Box>
          <Controller
            control={control}
            name='lang'
            render={({ field }) => (
              <RadioGroup
                {...field}
                row
                onChange={e => field.onChange(e.target.value)}
              >
                {LANG_OPTIONS.map(option => (
                  <FormControlLabel
                    key={option.value}
                    value={option.value}
                    control={<Radio size='small' />}
                    label={option.label}
                    disabled={
                      !!translateFrom && translateFrom.lang === option.value
                    }
                  />
                ))}
              </RadioGroup>
            )}
          />
          {translateFrom && (
            <Box sx={{ fontSize: 12, color: 'text.secondary', mt: 1 }}>
              {t('doc.translationGroupHint', {
                name: translateFrom.name || '',
              })}
            </Box>
          )}
        </>
      )}
    </Modal>
  );
};

export default DocAddByCustomText;
