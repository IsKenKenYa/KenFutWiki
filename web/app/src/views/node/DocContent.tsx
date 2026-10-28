'use client';

import type { CommentInputRef, ImageItem } from '@/components/commentInput';
import { DocWidth } from '@/constant';
import { useBasePath } from '@/hooks';
import { getDocContentSx } from '@/utils/getDocContentSx';
import { useStore } from '@/provider';
import {
  getShareV1CommentList,
  postShareV1Comment,
} from '@/request/ShareComment';
import { ConstsCopySetting, V1ShareNodeDetailResp } from '@/request/types';
import { copyText, findAdjacentDocuments } from '@/utils';
import { Editor, UseTiptapReturn } from '@ctzhian/tiptap';
import { message } from '@ctzhian/ui';
import { Box, alpha } from '@mui/material';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import FolderList from './folderList';
import AdjacentDocNav from './components/AdjacentDocNav';
import DocMetaInfo from './components/DocMetaInfo';
import CommentSection from './components/CommentSection';
import ContentEngagement from '@/features/kenfut/ContentEngagement';
import ContentBreadcrumbs from '@/features/kenfut/ContentBreadcrumbs';
import { getImagePath } from '@/utils/getImagePath';
import type { PageTarget, PublishedContent } from '@/features/kenfut/types';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const DocContent = ({
  info,
  docWidth,
  editorRef,
  commentList: propsCommentList,
  characterCount,
  publishedContent,
  pageTargets,
  articleLayout = false,
}: {
  docWidth?: string;
  info?: V1ShareNodeDetailResp;
  editorRef: UseTiptapReturn;
  commentList?: any[];
  characterCount?: number;
  publishedContent?: PublishedContent;
  pageTargets?: PageTarget[];
  articleLayout?: boolean;
}) => {
  const { mobile = false, authInfo, kbDetail, catalogWidth, tree } = useStore();
  const basePath = useBasePath();
  const [commentLoading, setCommentLoading] = useState(false);
  const docId = info?.id || '';
  const [commentList, setCommentList] = useState<any[]>(propsCommentList ?? []);
  const appDetail = kbDetail?.settings;
  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    defaultValues: { content: '', name: '' },
  });

  const commentInputRef = useRef<CommentInputRef>(null);
  const [contentFocused, setContentFocused] = useState(false);
  const [commentImages, setCommentImages] = useState<ImageItem[]>([]);

  const adjacentDocs = useMemo(() => {
    if (articleLayout || !tree || !docId || info?.type !== 2) return undefined;
    return findAdjacentDocuments(tree, docId);
  }, [articleLayout, tree, docId, info?.type]);

  const getComment = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const res = await getShareV1CommentList({ id: docId }, { signal });
        setCommentList(res.data ?? []);
      } catch {
        if (!signal?.aborted) message.error('评论暂时无法加载');
      }
    },
    [docId],
  );

  useEffect(() => {
    if (
      docId &&
      info?.kb_id &&
      appDetail?.web_app_comment_settings?.is_enable
    ) {
      const controller = new AbortController();
      void getComment(controller.signal);
      return () => controller.abort();
    }
  }, [
    docId,
    info?.kb_id,
    appDetail?.web_app_comment_settings?.is_enable,
    getComment,
  ]);

  const onSubmit = handleSubmit(
    async (data: { content: string; name: string }) => {
      setCommentLoading(true);
      let token = '';
      try {
        const Cap = (await import('@cap.js/widget')).default;
        const cap = new Cap({ apiEndpoint: `${basePath}/share/v1/captcha/` });
        const solution = await cap.solve();
        token = solution.token;
      } catch {
        message.error('验证失败');
        setCommentLoading(false);
        return;
      }
      try {
        let imageUrls: string[] = [];
        if (commentImages.length > 0 && commentInputRef.current) {
          imageUrls = await commentInputRef.current.uploadImages();
        }
        await postShareV1Comment({
          content: data.content,
          pic_urls: imageUrls,
          node_id: docId,
          user_name: data.name,
          captcha_token: token,
        });
        getComment();
        reset();
        commentInputRef.current?.clearImages();
        setCommentImages([]);
        message.success(
          appDetail?.web_app_comment_settings?.moderation_enable
            ? '评论已提交，请耐心等待审核'
            : '评论成功',
        );
      } catch (error: any) {
        message.error(error.message || '评论发布失败');
      } finally {
        setCommentLoading(false);
      }
    },
  );

  useEffect(() => {
    window.CAP_CUSTOM_WASM_URL =
      window.location.origin + `${basePath}/cap@0.0.6/cap_wasm.min.js`;
  }, [basePath]);

  if (!editorRef || !info) return null;

  const onCopyDocMd = () => {
    let context = editorRef.getMarkdown() || '';
    if (
      kbDetail?.settings?.copy_setting === ConstsCopySetting.CopySettingAppend
    ) {
      context += `\n\n-----------------------------------------\n内容来自 ${typeof window !== 'undefined' ? window.location.href : ''}`;
    }
    copyText(context);
  };

  return (
    <Box
      id='doc-content'
      sx={theme => ({
        wordBreak: 'break-all',
        color: 'text.primary',
        position: 'relative',
        zIndex: 1,
        '& ::selection': {
          backgroundColor: `${alpha(theme.palette.primary.main, 0.2)} !important`,
        },
        ...(articleLayout
          ? { width: '100%', maxWidth: 880, mx: 'auto' }
          : (getDocContentSx({
              docWidth: docWidth || 'full',
              mobile,
              catalogWidth: catalogWidth ?? 260,
            }) as Record<string, unknown>)),
      })}
    >
      {publishedContent && (
        <ContentBreadcrumbs
          content={publishedContent}
          article={articleLayout}
        />
      )}
      <DocMetaInfo
        info={info}
        characterCount={characterCount}
        publication={publishedContent}
        showPV={kbDetail?.settings?.stats_setting?.pv_enable === true}
        kbDetailCopySetting={kbDetail?.settings?.copy_setting}
        onCopyDocMd={onCopyDocMd}
      />

      {publishedContent?.cover_url && (
        <Box
          component='img'
          src={getImagePath(publishedContent.cover_url, basePath)}
          alt=''
          sx={{
            width: '100%',
            maxHeight: 480,
            objectFit: 'cover',
            borderRadius: 2,
            mb: 4,
          }}
        />
      )}

      {info?.meta?.summary && (
        <Box
          sx={{
            mb: 6,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '10px',
            bgcolor: 'background.paper3',
            p: '20px',
            fontSize: 14,
            lineHeight: '28px',
            backdropFilter: 'blur(5px)',
          }}
        >
          <Box sx={{ fontWeight: 'bold', mb: 2, lineHeight: '22px' }}>
            内容摘要
          </Box>
          <Box>{info?.meta?.summary}</Box>
        </Box>
      )}

      <Box
        className='editor-container'
        sx={{
          mt: 6,
          '.tiptap.ProseMirror': {
            '.tableWrapper': {
              width:
                docWidth === 'full'
                  ? '100%'
                  : DocWidth[docWidth as keyof typeof DocWidth].value,
              overflowX: 'auto',
              ...(docWidth !== 'full' && { maxWidth: '100%' }),
              ...(mobile && { width: '100%' }),
            },
          },
        }}
      >
        {info.type === 2 && editorRef.editor && (
          <Editor editor={editorRef.editor} />
        )}
        {info.type === 1 && <FolderList list={info.list} />}
      </Box>

      {publishedContent && (
        <ContentEngagement
          content={publishedContent}
          pages={pageTargets}
          article={articleLayout}
        />
      )}

      {adjacentDocs && (adjacentDocs.prev || adjacentDocs.next) && (
        <AdjacentDocNav
          prev={adjacentDocs.prev}
          next={adjacentDocs.next}
          basePath={basePath}
          hasCommentSection={appDetail?.web_app_comment_settings?.is_enable}
        />
      )}

      {appDetail?.web_app_comment_settings?.is_enable && (
        <CommentSection
          commentList={commentList}
          contentFocused={contentFocused}
          control={control}
          errors={errors}
          onSubmit={onSubmit}
          commentLoading={commentLoading}
          commentInputRef={commentInputRef}
          commentImages={commentImages}
          onContentFocus={() => setContentFocused(true)}
          onContentBlur={() => setContentFocused(false)}
          onImagesChange={setCommentImages}
          basePath={basePath}
          showNameInput={!authInfo?.username}
        />
      )}
    </Box>
  );
};

export default DocContent;
