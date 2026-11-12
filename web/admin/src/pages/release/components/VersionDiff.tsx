import { getApiV1KnowledgeBaseReleaseIdContents } from '@/request/KnowledgeBase';
import {
  DomainKBReleaseContentItem,
  DomainKBReleaseListItemResp,
} from '@/request/types';
import {
  Box,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Modal } from '@ctzhian/ui';
import { diffLines } from 'diff';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/store';

type ContentMap = Record<string, DomainKBReleaseContentItem>;

type DiffStatus = 'added' | 'removed' | 'changed' | 'unchanged';

interface DiffRow {
  type: 'add' | 'del' | 'same';
  text: string;
}

// 将两段文本的行级差异展开为渲染行。
const buildDiffRows = (before: string, after: string): DiffRow[] => {
  const parts = diffLines(before || '', after || '');
  const rows: DiffRow[] = [];
  parts.forEach(part => {
    const lines = part.value.replace(/\n$/, '').split('\n');
    if (part.added) {
      lines.forEach(line => rows.push({ type: 'add', text: line }));
    } else if (part.removed) {
      lines.forEach(line => rows.push({ type: 'del', text: line }));
    } else {
      lines.forEach(line => rows.push({ type: 'same', text: line }));
    }
  });
  return rows;
};

const toContentMap = (
  items: DomainKBReleaseContentItem[] | undefined,
): ContentMap => {
  const map: ContentMap = {};
  (items || []).forEach(item => {
    if (item.node_id) map[item.node_id] = item;
  });
  return map;
};

interface VersionDiffProps {
  open: boolean;
  onClose: () => void;
  releases: DomainKBReleaseListItemResp[];
  /** 默认作为对比目标（右侧）的版本，通常为当前生效版本 */
  defaultTargetId?: string;
}

const VersionDiff = ({
  open,
  onClose,
  releases,
  defaultTargetId,
}: VersionDiffProps) => {
  const { t } = useTranslation();
  const { kb_id } = useAppSelector(state => state.config);
  const [baseId, setBaseId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [loading, setLoading] = useState(false);
  const [baseMap, setBaseMap] = useState<ContentMap>({});
  const [targetMap, setTargetMap] = useState<ContentMap>({});
  const [selectedNodeId, setSelectedNodeId] = useState('');

  useEffect(() => {
    if (!open) return;
    // 默认对比：列表次新版本与指定目标版本；只有一个版本时退化为自身对比
    const target = defaultTargetId || releases[0]?.id || '';
    const fallback = releases.find(item => item.id !== target)?.id || target;
    setBaseId(fallback);
    setTargetId(target);
  }, [open, defaultTargetId, releases]);

  useEffect(() => {
    if (!open || !kb_id || !baseId || !targetId) return;
    let active = true;
    setLoading(true);
    setSelectedNodeId('');
    Promise.all([
      getApiV1KnowledgeBaseReleaseIdContents({
        id: baseId,
        kb_id,
        per_page: 1000,
      }),
      getApiV1KnowledgeBaseReleaseIdContents({
        id: targetId,
        kb_id,
        per_page: 1000,
      }),
    ])
      .then(([before, after]) => {
        if (!active) return;
        const beforeMap = toContentMap(before.data?.data);
        const afterMap = toContentMap(after.data?.data);
        setBaseMap(beforeMap);
        setTargetMap(afterMap);
        // 默认选中第一个有差异的文档
        const firstDiff = Object.keys(afterMap).find(
          id =>
            !beforeMap[id] || beforeMap[id].content !== afterMap[id].content,
        );
        setSelectedNodeId(firstDiff || Object.keys(afterMap)[0] || '');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, kb_id, baseId, targetId]);

  const entries = useMemo(() => {
    const ids = Array.from(
      new Set([...Object.keys(baseMap), ...Object.keys(targetMap)]),
    );
    return ids
      .map(id => {
        const before = baseMap[id];
        const after = targetMap[id];
        let status: DiffStatus;
        if (before && !after) status = 'removed';
        else if (!before && after) status = 'added';
        else if (before!.content !== after!.content) status = 'changed';
        else status = 'unchanged';
        return { id, name: (after || before!)?.name || id, status };
      })
      .sort((left, right) => {
        const weight = (status: DiffStatus) => (status === 'unchanged' ? 1 : 0);
        return weight(left.status) - weight(right.status);
      });
  }, [baseMap, targetMap]);

  const selectedRows = useMemo(() => {
    if (!selectedNodeId) return [];
    return buildDiffRows(
      baseMap[selectedNodeId]?.content || '',
      targetMap[selectedNodeId]?.content || '',
    );
  }, [baseMap, targetMap, selectedNodeId]);

  const statusLabel = (status: DiffStatus) => {
    if (status === 'added') return t('release.diffAdded');
    if (status === 'removed') return t('release.diffRemoved');
    if (status === 'changed') return t('release.diffChanged');
    return t('release.diffUnchanged');
  };
  const statusColor = (status: DiffStatus) =>
    status === 'unchanged'
      ? 'text.secondary'
      : status === 'removed'
        ? 'error.main'
        : 'success.main';

  const renderVersionSelect = (
    value: string,
    onChange: (value: string) => void,
    label: string,
  ) => (
    <TextField
      select
      size='small'
      label={label}
      value={value}
      onChange={event => onChange(event.target.value)}
      sx={{ minWidth: 220 }}
    >
      {releases.map(item => (
        <MenuItem key={item.id} value={item.id}>
          {item.tag}
          {item.message ? ` · ${item.message}` : ''}
        </MenuItem>
      ))}
    </TextField>
  );

  return (
    <Modal
      title={t('release.diffTitle')}
      open={open}
      width={1100}
      footer={null}
      onCancel={onClose}
    >
      <Stack spacing={2} sx={{ pt: 1 }}>
        <Stack direction='row' spacing={2}>
          {renderVersionSelect(baseId, setBaseId, t('release.diffBase'))}
          {renderVersionSelect(targetId, setTargetId, t('release.diffTarget'))}
        </Stack>
        {loading ? (
          <Stack alignItems='center' sx={{ py: 8 }}>
            <CircularProgress size={28} />
          </Stack>
        ) : (
          <Stack direction='row' spacing={2} sx={{ minHeight: 480 }}>
            <Stack
              spacing={0.5}
              sx={{
                width: 280,
                flexShrink: 0,
                overflowY: 'auto',
                maxHeight: 560,
              }}
            >
              {entries.map(entry => (
                <Stack
                  key={entry.id}
                  direction='row'
                  alignItems='center'
                  spacing={1}
                  onClick={() => setSelectedNodeId(entry.id)}
                  sx={{
                    cursor: 'pointer',
                    px: 1.5,
                    py: 1,
                    borderRadius: 1.5,
                    bgcolor:
                      entry.id === selectedNodeId
                        ? 'action.selected'
                        : 'transparent',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Typography variant='body2' noWrap sx={{ flex: 1 }}>
                    {entry.name}
                  </Typography>
                  <Typography
                    variant='caption'
                    color={statusColor(entry.status)}
                  >
                    {statusLabel(entry.status)}
                  </Typography>
                </Stack>
              ))}
              {!entries.length && (
                <Typography
                  variant='body2'
                  color='text.secondary'
                  sx={{ px: 1, py: 2 }}
                >
                  {t('release.diffEmpty')}
                </Typography>
              )}
            </Stack>
            <Box
              sx={{
                flex: 1,
                overflow: 'auto',
                maxHeight: 560,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                fontFamily: 'Mono',
                fontSize: 12,
                lineHeight: '20px',
                bgcolor: 'background.paper3',
              }}
            >
              {selectedRows.map((row, index) => (
                <Box
                  key={index}
                  component='pre'
                  sx={{
                    m: 0,
                    px: 1.5,
                    fontFamily: 'inherit',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    bgcolor:
                      row.type === 'add'
                        ? 'rgba(46, 160, 67, 0.16)'
                        : row.type === 'del'
                          ? 'rgba(248, 81, 73, 0.16)'
                          : 'transparent',
                  }}
                >
                  {row.type === 'add' ? '+ ' : row.type === 'del' ? '- ' : '  '}
                  {row.text}
                </Box>
              ))}
              {!selectedRows.length && (
                <Typography
                  variant='body2'
                  color='text.secondary'
                  sx={{ p: 2 }}
                >
                  {t('release.diffNoSelection')}
                </Typography>
              )}
            </Box>
          </Stack>
        )}
      </Stack>
    </Modal>
  );
};

export default VersionDiff;
