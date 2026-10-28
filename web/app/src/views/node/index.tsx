'use client';

import DocFab from '@/components/docFab';
import DocSkeleton from '@/components/docSkeleton';
import ErrorComponent from '@/components/error';
import ScrollToTopFab from '@/components/scrollToTopFab';
import { useBasePath } from '@/hooks/useBasePath';
import { getDocContentSx } from '@/utils/getDocContentSx';
import useCopy from '@/hooks/useCopy';
import { useStore } from '@/provider';
import { ConstsCopySetting } from '@/request/types';
import { TocList, useTiptap } from '@ctzhian/tiptap';
import { Alert, Box } from '@mui/material';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import DocAnchor from './DocAnchor';
import DocContent from './DocContent';
import type { PageTarget, PublishedContent } from '@/features/kenfut/types';

const Doc = ({
  node,
  error,
  publishedContent,
  pageTargets,
  articleLayout = false,
  publicationError,
}: {
  node?: any;
  publishedContent?: PublishedContent;
  pageTargets?: PageTarget[];
  articleLayout?: boolean;
  publicationError?: string;
  error?: Partial<Error> & { digest?: string } & { code?: number | string };
}) => {
  const { kbDetail, mobile, catalogWidth } = useStore();
  const [loading, setLoading] = useState(true);
  const [headings, setHeadings] = useState<TocList>([]);
  const [characterCount, setCharacterCount] = useState(0);
  const pathname = usePathname();
  const isMarkdown = useMemo(() => {
    return node?.meta?.content_type === 'md';
  }, [node?.meta?.content_type]);
  const baseUrl = useBasePath();
  const editorRef = useTiptap({
    content: node?.content || '',
    editable: false,
    contentType: isMarkdown ? 'markdown' : 'html',
    immediatelyRender: false,
    baseUrl: baseUrl,
    onTocUpdate: (toc: TocList) => {
      setHeadings(toc);
    },
    onBeforeCreate: () => {
      setLoading(true);
    },
    onCreate: ({ editor }) => {
      setLoading(false);
      setCharacterCount((editor.storage as any).characterCount.characters());
    },
  });

  const docWidth = useMemo(() => {
    if (articleLayout) return 'full';
    return kbDetail?.settings?.theme_and_style?.doc_width || 'full';
  }, [articleLayout, kbDetail]);

  useCopy({
    mode:
      kbDetail?.settings?.copy_setting !== ConstsCopySetting.CopySettingDisabled
        ? 'allow'
        : 'disable',
    blockContextMenuWhenDisabled: false,
    suffix:
      kbDetail?.settings?.copy_setting === ConstsCopySetting.CopySettingAppend
        ? `\n\n-----------------------------------------\n内容来自 ${typeof window !== 'undefined' ? window.location.href : ''}`
        : '',
  });

  useEffect(() => {
    if (!node || !editorRef.editor) return;

    const frame = requestAnimationFrame(() => {
      setHeadings([]);
      editorRef.setContent(
        node?.content || '',
        isMarkdown ? 'markdown' : 'html',
      );
    });
    return () => cancelAnimationFrame(frame);
    // Synchronize the editor instance, not the changing hook wrapper.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorRef.editor, isMarkdown, node]);

  useEffect(() => {
    document.querySelector('#scroll-container')?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <>
      {error ? (
        <Box
          sx={{
            height: '100%',
            ...getDocContentSx({
              docWidth,
              mobile: mobile ?? false,
              catalogWidth: catalogWidth ?? 260,
              variant: 'error',
            }),
          }}
        >
          <ErrorComponent error={error} />
        </Box>
      ) : (
        <>
          {publicationError && (
            <Alert severity='info'>{publicationError}</Alert>
          )}
          {loading ? (
            <Box
              sx={
                articleLayout
                  ? { width: '100%', maxWidth: 880, mx: 'auto' }
                  : getDocContentSx({
                      docWidth,
                      mobile: mobile ?? false,
                      catalogWidth: catalogWidth ?? 260,
                    })
              }
            >
              <DocSkeleton showSummary={node?.type === 2} />
            </Box>
          ) : (
            <DocContent
              info={node}
              docWidth={docWidth}
              editorRef={editorRef}
              characterCount={characterCount}
              publishedContent={publishedContent}
              pageTargets={pageTargets}
              articleLayout={articleLayout}
            />
          )}
          {!mobile && !articleLayout && <DocAnchor headings={headings} />}
          {!articleLayout && <DocFab nodeId={node?.id} />}
          {!articleLayout && <ScrollToTopFab />}
        </>
      )}
    </>
  );
};

export default Doc;
