import Card from '@/components/Card';
import DragTree from '@/components/Drag/DragTree';
import { postApiV1KnowledgeBaseRelease } from '@/request/KnowledgeBase';
import { getApiV1NodeListGroupNav } from '@/request/Node';
import {
  DomainNodeListItemResp,
  GithubComChaitinPandaWikiApiNodeV1NodeListGroupNavResp,
} from '@/request/types';
import { useAppSelector } from '@/store';
import { convertToTree } from '@/utils/drag';
import { message, Modal } from '@ctzhian/ui';
import {
  Box,
  Checkbox,
  Chip,
  IconButton,
  Stack,
  TextField,
} from '@mui/material';
import { IconXiajiantou } from '@panda-wiki/icons';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

function normalizeNavGroupResponse(
  res: any,
): GithubComChaitinPandaWikiApiNodeV1NodeListGroupNavResp[] {
  if (Array.isArray(res)) return res;
  if (res && typeof res === 'object') {
    for (const key of ['list', 'data', 'groups', 'items']) {
      if (Array.isArray(res[key])) return res[key];
    }
  }
  return [];
}

function getNavNodeList(
  nav:
    | GithubComChaitinPandaWikiApiNodeV1NodeListGroupNavResp
    | Record<string, any>,
): DomainNodeListItemResp[] {
  return (
    (nav as any).list ||
    (nav as any).nodes ||
    (nav as any).items ||
    nav.list ||
    []
  );
}

interface VersionPublishProps {
  open: boolean;
  defaultSelected?: string[];
  onClose: () => void;
  refresh: () => void;
}

const VersionPublish = ({
  open,
  defaultSelected = [],
  onClose,
  refresh,
}: VersionPublishProps) => {
  const { t, i18n } = useTranslation();
  const { kb_id } = useAppSelector(state => state.config);

  const [selected, setSelected] = useState<string[]>([]);
  const [folderIds, setFolderIds] = useState<string[]>([]);
  const [navList, setNavList] = useState<
    GithubComChaitinPandaWikiApiNodeV1NodeListGroupNavResp[]
  >([]);
  const [expandedNavIds, setExpandedNavIds] = useState<Set<string>>(new Set());
  const [list, setList] = useState<DomainNodeListItemResp[]>([]);

  const {
    handleSubmit,
    control,
    formState: { errors },
    reset,
    setValue,
  } = useForm({
    defaultValues: {
      tag: '',
      message: '',
    },
  });

  const getData = () => {
    getApiV1NodeListGroupNav({ kb_id, status: 'unpublished' }).then(res => {
      const navData = normalizeNavGroupResponse(res);
      setNavList(navData);
      const allNodes = navData.flatMap(nav => getNavNodeList(nav));
      setList(allNodes);
      const allIds = allNodes.map(it => it.id!);
      setSelected(defaultSelected.length > 0 ? defaultSelected : allIds);
      const folders = allNodes
        .filter(item => item.type === 1)
        .map(item => item.id!);
      setFolderIds(folders);
      setExpandedNavIds(new Set());
    });
  };

  const onSubmit = handleSubmit(data => {
    const nodeIds = Array.from(new Set([...selected, ...folderIds]));
    const hasReleasedNavs = releasedNavs.length > 0;

    // 有选中的文档/文件夹，或存在未发布目录时，允许提交
    if (nodeIds.length > 0 || hasReleasedNavs) {
      postApiV1KnowledgeBaseRelease({
        kb_id,
        ...data,
        ...(nodeIds.length ? { node_ids: nodeIds } : {}),
      }).then(() => {
        message.success(t('release.publishSuccess', { tag: data.tag }));
        reset();
        setSelected([]);
        onClose();
        refresh();
      });
    } else {
      message.error(
        list.length > 0 ? t('release.selectDocs') : t('release.noUnpublished'),
      );
    }
  });

  useEffect(() => {
    const curTime = dayjs();
    if (open) {
      getData();
      setValue('tag', curTime.format('YYYY-MM-DD HH:mm:ss'));
      const timeText =
        i18n.language === 'en'
          ? curTime.format('YYYY-MM-DD HH:mm:ss')
          : curTime.format('YYYY 年 MM 月 DD 日 HH 时 mm 分 ss 秒');
      setValue('message', t('release.defaultMessage', { time: timeText }));
    }
  }, [open, kb_id, i18n.language, t]);

  const selectedTotal = list.filter(it => selected.includes(it.id!)).length;

  const releasedNavs = navList.filter(
    nav => (nav as any).is_released === false || nav.is_released === false,
  );

  return (
    <Modal
      title={t('release.publishTitle')}
      open={open}
      onCancel={onClose}
      onOk={onSubmit}
      okButtonProps={{
        disabled: releasedNavs.length === 0 && list.length === 0,
      }}
    >
      <>
        <Box sx={{ fontSize: 14, lineHeight: '32px' }}>
          {t('release.versionNo')}
          <Box component='span' sx={{ color: 'error.main', ml: 0.5 }}>
            *
          </Box>
        </Box>
        <Controller
          control={control}
          name='tag'
          rules={{ required: t('release.versionNoRequired') }}
          render={({ field }) => (
            <TextField
              {...field}
              fullWidth
              size='small'
              placeholder={t('release.versionNoPlaceholder')}
              error={!!errors.tag}
              helperText={errors.tag?.message}
            />
          )}
        />
        <Box sx={{ fontSize: 14, lineHeight: '32px', mt: 1 }}>
          {t('release.versionDesc')}
          <Box component='span' sx={{ color: 'error.main', ml: 0.5 }}>
            *
          </Box>
        </Box>
        <Controller
          control={control}
          name='message'
          rules={{ required: t('release.versionDescRequired') }}
          render={({ field }) => (
            <TextField
              {...field}
              fullWidth
              multiline
              rows={2}
              size='small'
              placeholder={t('release.versionDescPlaceholder')}
              error={!!errors.message}
              helperText={errors.message?.message}
            />
          )}
        />
        {releasedNavs.length > 0 && (
          <Stack sx={{ mt: 1 }}>
            <Box sx={{ fontSize: 14, mb: 0.5 }}>
              {t('release.unpublishedNavs')}
              <Box
                component='span'
                sx={{ color: 'text.tertiary', fontSize: 12, pl: 1 }}
              >
                {t('release.navCount', { count: releasedNavs.length })}
              </Box>
            </Box>
            <Stack direction='row' flexWrap='wrap' gap={0.5} useFlexGap>
              {releasedNavs.map((nav, idx) => {
                const navId =
                  nav.nav_id || (nav as any).navId || `released-nav-${idx}`;
                return (
                  <Chip
                    key={navId}
                    label={
                      nav.nav_name ||
                      (nav as any).navName ||
                      t('doc.uncategorized')
                    }
                    size='small'
                    variant='outlined'
                    sx={{
                      fontSize: 12,
                      height: 24,
                      borderRadius: 2,
                      '& .MuiChip-label': { px: 1 },
                    }}
                  />
                );
              })}
            </Stack>
          </Stack>
        )}
        {list.length > 0 && (
          <Stack
            direction='row'
            component='label'
            alignItems='center'
            justifyContent='space-between'
            gap={1}
            sx={{
              py: 1,
              pr: 1.5,
              cursor: 'pointer',
              borderRadius: '10px',
              fontSize: 14,
              mt: 1,
            }}
          >
            <Box>
              {t('release.unpublishedDocs')}
              <Box
                component='span'
                sx={{ color: 'text.tertiary', fontSize: 12, pl: 1 }}
              >
                {t('release.countSummary', {
                  total: list.length,
                  selected: selectedTotal,
                })}
              </Box>
            </Box>
            <Stack direction='row' alignItems='center'>
              <Box sx={{ color: 'text.tertiary', fontSize: 12 }}>
                {t('doc.selectAll')}
              </Box>
              <Checkbox
                size='small'
                sx={{
                  p: 0,
                  color: 'text.disabled',
                  width: '35px',
                  height: '35px',
                }}
                checked={list.length > 0 && selectedTotal === list.length}
                onChange={() => {
                  setSelected(
                    selectedTotal === list.length ? [] : list.map(it => it.id!),
                  );
                }}
              />
            </Stack>
          </Stack>
        )}
        {releasedNavs.length === 0 && list.length === 0 && (
          <Box sx={{ mt: 1, fontSize: 13, color: 'text.tertiary' }}>
            {t('release.noUnpublished')}
          </Box>
        )}
        <Box
          sx={{
            fontSize: 14,
            maxHeight: 'calc(100vh - 520px)',
            overflowY: 'auto',
            mt: 0,
          }}
        >
          <Stack gap={1}>
            {navList
              .map((nav, idx) => ({ nav, idx, navNodes: getNavNodeList(nav) }))
              .filter(({ navNodes }) => navNodes.length > 0)
              .map(({ nav, idx, navNodes }) => {
                const navId = nav.nav_id || (nav as any).navId || `nav-${idx}`;
                const navTreeList = convertToTree(navNodes);
                const navSelected = navNodes
                  .filter(n => selected.includes(n.id!))
                  .map(n => n.id!);
                const navSelectedCount = navSelected.length;
                const navTotal = navNodes.length;
                const isExpanded = expandedNavIds.has(navId);
                const toggleExpand = () => {
                  setExpandedNavIds(prev => {
                    const next = new Set(prev);
                    if (next.has(navId)) next.delete(navId);
                    else next.add(navId);
                    return next;
                  });
                };
                return (
                  <Card
                    key={navId}
                    sx={{ bgcolor: 'background.paper3', overflow: 'hidden' }}
                  >
                    <Stack
                      direction='row'
                      component='label'
                      alignItems='center'
                      sx={{ py: 1, px: 1.5, cursor: 'pointer', fontSize: 14 }}
                    >
                      <IconButton
                        size='small'
                        onClick={e => {
                          e.preventDefault();
                          toggleExpand();
                        }}
                        sx={{ p: 0.25, mr: 0.5 }}
                      >
                        <IconXiajiantou
                          sx={{
                            fontSize: 16,
                            color: 'text.disabled',
                            transform: isExpanded ? 'none' : 'rotate(-90deg)',
                            transition: 'transform 0.2s',
                          }}
                        />
                      </IconButton>
                      <Box sx={{ flex: 1 }}>
                        {nav.nav_name ||
                          (nav as any).navName ||
                          t('doc.uncategorized')}
                        <Box
                          component='span'
                          sx={{ color: 'text.tertiary', fontSize: 12, pl: 1 }}
                        >
                          {navSelectedCount > 0
                            ? t('release.countSummary', {
                                total: navTotal,
                                selected: navSelectedCount,
                              })
                            : t('release.navCount', { count: navTotal })}
                        </Box>
                      </Box>
                      <Stack direction='row' alignItems='center'>
                        <Box sx={{ color: 'text.tertiary', fontSize: 12 }}>
                          {t('doc.selectAll')}
                        </Box>
                        <Checkbox
                          size='small'
                          sx={{
                            p: 0,
                            color: 'text.disabled',
                            width: '35px',
                            height: '35px',
                          }}
                          checked={
                            navTotal > 0 && navSelectedCount === navTotal
                          }
                          onChange={() => {
                            const navIds = navNodes.map(n => n.id!);
                            if (navSelectedCount === navTotal) {
                              setSelected(prev =>
                                prev.filter(id => !navIds.includes(id)),
                              );
                            } else {
                              setSelected(prev => {
                                const added = new Set(prev);
                                navIds.forEach(id => added.add(id));
                                return [...added];
                              });
                            }
                          }}
                        />
                      </Stack>
                    </Stack>
                    {isExpanded && (
                      <Stack gap={0.25} sx={{ fontSize: 14, px: 2, pb: 1 }}>
                        <DragTree
                          ui='select'
                          readOnly
                          selected={selected}
                          data={navTreeList}
                          refresh={getData}
                          onSelectChange={ids => setSelected(ids)}
                        />
                      </Stack>
                    )}
                  </Card>
                );
              })}
          </Stack>
        </Box>
      </>
    </Modal>
  );
};

export default VersionPublish;
