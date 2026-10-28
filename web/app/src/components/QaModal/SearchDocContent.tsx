'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useBasePath } from '@/hooks';
import { useStore } from '@/provider';
import { getContents } from '@/features/kenfut/api';
import { contentHref } from '@/features/kenfut/links';
import type { ContentList } from '@/features/kenfut/types';

interface SearchDocContentProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
  placeholder: string;
}

export default function SearchDocContent({
  inputRef,
  placeholder,
}: SearchDocContentProps) {
  const basePath = useBasePath();
  const { setQaModalOpen, qaModalOpen } = useStore();
  const [input, setInput] = useState('');
  const [scope, setScope] = useState<'all' | 'docs' | 'article'>('all');
  const [result, setResult] = useState<ContentList>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);

  const search = async (page = 1, value = input, channel = scope) => {
    if (!value.trim()) return;
    const id = ++request.current;
    setLoading(true);
    setError('');
    try {
      const response = await getContents({
        q: value.trim(),
        channel,
        page,
        page_size: 10,
      });
      if (id === request.current) setResult(response);
    } catch {
      if (id === request.current) setError('搜索暂时不可用，请稍后重试。');
    } finally {
      if (id === request.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (!qaModalOpen) return;
    const initial = sessionStorage.getItem('content_search_query');
    if (initial) {
      sessionStorage.removeItem('content_search_query');
      setInput(initial);
      void search(1, initial);
    }
    // The pending query is consumed once when the search dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qaModalOpen]);

  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );

  return (
    <Stack sx={{ minHeight: 200, overflow: 'hidden' }}>
      <Stack
        component='form'
        direction='row'
        gap={1}
        onSubmit={event => {
          event.preventDefault();
          void search();
        }}
        sx={{ mb: 2 }}
      >
        <TextField
          ref={inputRef}
          value={input}
          onChange={event => setInput(event.target.value)}
          fullWidth
          placeholder={placeholder || '搜索已发布内容'}
          inputProps={{ 'aria-label': '搜索已发布内容', maxLength: 200 }}
          size='small'
        />
        <Button
          type='submit'
          variant='contained'
          disabled={loading || !input.trim()}
        >
          搜索
        </Button>
      </Stack>
      <TextField
        select
        size='small'
        label='搜索范围'
        value={scope}
        onChange={event => {
          const channel = event.target.value as typeof scope;
          setScope(channel);
          if (result && input.trim()) void search(1, input, channel);
        }}
        sx={{ width: 180, mb: 2 }}
      >
        <MenuItem value='all'>全部内容</MenuItem>
        <MenuItem value='docs'>文档</MenuItem>
        <MenuItem value='article'>文章</MenuItem>
      </TextField>
      {loading && (
        <Stack alignItems='center' sx={{ py: 3 }}>
          <CircularProgress size={28} />
        </Stack>
      )}
      {error && <Alert severity='error'>{error}</Alert>}
      {!loading && !error && result && (
        <Box sx={{ overflowY: 'auto' }}>
          <Typography variant='caption' color='text.secondary'>
            找到 {result.total} 条已发布内容
          </Typography>
          {result.items.length ? (
            result.items.map(item => (
              <Box
                key={item.id || item.node_id}
                component={Link}
                href={contentHref(item, basePath)}
                prefetch={false}
                onClick={() => setQaModalOpen?.(false)}
                sx={{
                  display: 'block',
                  textDecoration: 'none',
                  color: 'inherit',
                  py: 2,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Typography sx={{ fontWeight: 600, mb: 0.5 }}>
                  {item.title}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {item.summary}
                </Typography>
                <Typography variant='caption' color='text.secondary'>
                  {[item.category, ...(item.tags || [])]
                    .filter(Boolean)
                    .join(' · ')}
                </Typography>
              </Box>
            ))
          ) : (
            <Alert severity='info' sx={{ mt: 2 }}>
              没有找到匹配内容。
            </Alert>
          )}
          {result.total > result.page_size && (
            <Pagination
              size='small'
              sx={{ my: 2 }}
              count={Math.ceil(result.total / result.page_size)}
              page={result.page}
              onChange={(_, page) => {
                void search(page);
              }}
            />
          )}
        </Box>
      )}
      {!result && !loading && !error && (
        <Typography color='text.secondary' sx={{ py: 3 }}>
          输入关键词，搜索文档与文章。普通搜索无需配置 AI。
        </Typography>
      )}
    </Stack>
  );
}
