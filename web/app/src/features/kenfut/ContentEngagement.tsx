'use client';

import { v4 as uuidv4 } from 'uuid';

import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useLocaleBasePath } from '@/hooks';
import {
  getRelated,
  getVoteSummary,
  recordContentView,
  recordCTAClick,
  recordVote,
  type VoteSummary,
} from './api';
import ContentCard from './ContentCard';
import { resolveTarget } from './links';
import type { ContentCTA, PageTarget, PublishedContent } from './types';

// 页面级"有帮助吗"投票：提交后锁定票向，统计失败时静默降级。
function PageVote({ nodeId }: { nodeId: string }) {
  const t = useTranslations('node');
  const [summary, setSummary] = useState<VoteSummary>();
  const [voted, setVoted] = useState<1 | -1>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setSummary(undefined);
    setVoted(undefined);
    getVoteSummary(nodeId)
      .then(result => {
        if (!active) return;
        setSummary(result);
        if (result?.mine === 1 || result?.mine === -1) {
          setVoted(result.mine);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [nodeId]);

  const submit = async (vote: 1 | -1) => {
    if (busy || voted) return;
    setBusy(true);
    try {
      await recordVote(nodeId, vote);
      setVoted(vote);
      setSummary(previous =>
        previous
          ? {
              up: previous.up + (vote === 1 ? 1 : 0),
              down: previous.down + (vote === -1 ? 1 : 0),
              mine: vote,
            }
          : { up: vote === 1 ? 1 : 0, down: vote === -1 ? 1 : 0, mine: vote },
      );
    } catch {
      // 提交失败保持按钮可用，访客可重试
    } finally {
      setBusy(false);
    }
  };

  if (voted) {
    return (
      <Box sx={{ textAlign: 'center', mt: 5 }}>
        <Typography variant='body2' color='text.secondary'>
          {t('voteThanks')}
        </Typography>
        {!!summary?.up && (
          <Typography variant='caption' color='text.secondary'>
            {t('voteCount', { count: summary.up })}
          </Typography>
        )}
      </Box>
    );
  }
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1.5}
      alignItems='center'
      justifyContent='center'
      sx={{ mt: 6 }}
    >
      <Typography variant='body2' color='text.secondary'>
        {t('voteTitle')}
      </Typography>
      <Stack direction='row' spacing={1.5}>
        <Button
          size='small'
          variant='outlined'
          disabled={busy}
          onClick={() => void submit(1)}
        >
          {t('voteUp')}
        </Button>
        <Button
          size='small'
          variant='outlined'
          disabled={busy}
          onClick={() => void submit(-1)}
        >
          {t('voteDown')}
        </Button>
      </Stack>
      {!!summary?.up && (
        <Typography variant='caption' color='text.secondary'>
          {t('voteCount', { count: summary.up })}
        </Typography>
      )}
    </Stack>
  );
}

export default function ContentEngagement({
  content,
  pages = [],
  article = false,
}: {
  content: PublishedContent;
  pages?: PageTarget[];
  article?: boolean;
}) {
  const basePath = useLocaleBasePath();
  const t = useTranslations('node');
  const view = useRef({ key: '', id: '' });
  const [related, setRelated] = useState(content.related || []);
  const [relatedError, setRelatedError] = useState(false);
  const [pending, setPending] = useState<string>();
  const nodeId = content.node_id || content.id;

  useEffect(() => {
    const key = `${nodeId}:${content.node_release_id}`;
    if (view.current.key !== key) {
      view.current = { key, id: uuidv4() };
      void recordContentView(
        content,
        view.current.id,
        article ? 'article' : 'docs',
      ).catch(() => undefined);
    }
  }, [article, content, nodeId]);

  useEffect(() => {
    let active = true;
    setRelated(content.related || []);
    setRelatedError(false);
    if (content.related) return;
    getRelated(nodeId)
      .then(items => {
        if (active) setRelated(items || []);
      })
      .catch(() => {
        if (active) setRelatedError(true);
      });
    return () => {
      active = false;
    };
  }, [content.related, nodeId]);

  const onClick = async (
    event: React.MouseEvent<HTMLAnchorElement>,
    cta: ContentCTA,
    fallback: string,
  ) => {
    // A normal href remains available when JavaScript or tracking is unavailable.
    if (event.altKey || event.button > 1) return;
    event.preventDefault();
    if (pending) return;
    const openNewTab =
      cta.new_tab ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.button === 1;
    const popup = openNewTab ? window.open('about:blank', '_blank') : null;
    if (popup) popup.opener = null;
    setPending(cta.id);
    let destination = fallback;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    try {
      const result = await recordCTAClick(
        content,
        cta.id,
        view.current.id,
        controller.signal,
      );
      if (result?.url) destination = result.url;
    } catch {
      // Analytics must never prevent a configured action from working.
    } finally {
      clearTimeout(timeout);
      setPending(undefined);
    }
    if (popup) popup.location.href = destination;
    else window.location.assign(destination);
  };

  return (
    <>
      {!!content.ctas?.length && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          gap={2}
          sx={{ mt: 5, py: 3 }}
        >
          {content.ctas.slice(0, 2).map(cta => {
            const href = resolveTarget(
              cta.target,
              basePath,
              pages,
              cta.resolved_url ?? '',
            );
            if (!href) return null;
            return (
              <Button
                key={cta.id}
                component='a'
                href={href}
                target={cta.new_tab ? '_blank' : undefined}
                rel={cta.new_tab ? 'noopener noreferrer' : undefined}
                variant={cta.style === 'secondary' ? 'outlined' : 'contained'}
                size='large'
                aria-busy={pending === cta.id}
                onClick={event => {
                  void onClick(event, cta, href);
                }}
                onAuxClick={event => {
                  if (event.button === 1) void onClick(event, cta, href);
                }}
              >
                {cta.label}
              </Button>
            );
          })}
        </Stack>
      )}
      {!!related.length && (
        <Box
          component='section'
          aria-label={t('related')}
          sx={{ mt: 5, pt: 4, borderTop: '1px solid', borderColor: 'divider' }}
        >
          <Typography variant='h6' sx={{ fontWeight: 600, mb: 3 }}>
            {t('related')}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
              },
              gap: 4,
            }}
          >
            {related.slice(0, 2).map(item => (
              <ContentCard key={item.id || item.node_id} content={item} />
            ))}
          </Box>
        </Box>
      )}
      {relatedError && (
        <Alert severity='info' sx={{ mt: 3 }}>
          {t('relatedError')}
        </Alert>
      )}
      <PageVote nodeId={nodeId} />
    </>
  );
}
