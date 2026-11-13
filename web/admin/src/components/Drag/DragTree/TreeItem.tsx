import { ITreeItem } from '@/api';
import Emoji from '@/components/Emoji';
import {
  TreeItemComponentProps,
  TreeItemWrapper,
} from '@/components/TreeDragSortable';
import RAG_SOURCES from '@/constant/rag';
import { treeSx } from '@/constant/styles';
import { postApiV1Node, putApiV1NodeDetail } from '@/request/Node';
import { ConstsNodeAccessPerm } from '@/request/types';
import { useAppSelector } from '@/store';
import { AppContext, updateTree } from '@/utils/drag';
import {
  handleMultiSelect,
  handleParentControlledSelect,
  hasSelectedDescendant,
  updateAllParentStatus,
} from '@/utils/tree';
import { Ellipsis, message } from '@ctzhian/ui';
import {
  Box,
  Button,
  Checkbox,
  PaletteColor,
  Stack,
  TextField,
  Theme,
  Tooltip,
  alpha,
  styled,
} from '@mui/material';
import dayjs from 'dayjs';
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import TreeMenu from './TreeMenu';

const StyledTag = styled('div')<{ color: keyof Theme['palette'] }>(
  ({ theme, color }) => ({
    color: (theme.palette[color] as PaletteColor).main,
    border: '1px solid',
    borderColor: (theme.palette[color] as PaletteColor).main,
    borderRadius: '10px',
    padding: theme.spacing(0, 1),
    bgcolor: alpha((theme.palette[color] as PaletteColor).main, 0.1),
  }),
);

// 权限标签文案为 i18n key，渲染时翻译
const ANSWERABLE_PERMISSIONS_MAP = {
  [ConstsNodeAccessPerm.NodeAccessPermClosed]: {
    label: 'perm.answerableClosed',
    color: 'warning',
  },
  [ConstsNodeAccessPerm.NodeAccessPermPartial]: {
    label: 'perm.answerablePartial',
    color: 'warning',
  },
  [ConstsNodeAccessPerm.NodeAccessPermOpen]: {
    label: 'perm.answerableOpen',
    color: 'success',
  },
} as const;

const VISITABLE_PERMISSIONS_MAP = {
  [ConstsNodeAccessPerm.NodeAccessPermClosed]: {
    label: 'perm.visitableClosed',
    color: 'warning',
  },
  [ConstsNodeAccessPerm.NodeAccessPermPartial]: {
    label: 'perm.visitablePartial',
    color: 'warning',
  },
  [ConstsNodeAccessPerm.NodeAccessPermOpen]: {
    label: 'perm.visitableOpen',
    color: 'success',
  },
} as const;

const VISIBLE_PERMISSIONS_MAP = {
  [ConstsNodeAccessPerm.NodeAccessPermClosed]: {
    label: 'perm.visibleClosed',
    color: 'warning',
  },
  [ConstsNodeAccessPerm.NodeAccessPermPartial]: {
    label: 'perm.visiblePartial',
    color: 'warning',
  },
  [ConstsNodeAccessPerm.NodeAccessPermOpen]: {
    label: 'perm.visibleOpen',
    color: 'success',
  },
} as const;

const TreeItem = React.forwardRef<
  HTMLDivElement,
  TreeItemComponentProps<ITreeItem>
>((props, ref) => {
  const { t } = useTranslation();
  const { kb_id: id, nav_id } = useAppSelector(state => state.config);
  const { item, collapsed } = props;
  const context = useContext(AppContext);

  if (!context)
    throw new Error('TreeItem must be used inside AppContext.Provider');

  const {
    data,
    ui = 'move',
    selected = [],
    onSelectChange,
    readOnly,
    supportSelect = false,
    menu,
    relativeSelect = true,
    selectionModel = 'cascade-parent-sync',
    updateData,
    refresh,
    disabled,
    scrollToItem,
  } = context;

  const [value, setValue] = useState(item.name);
  const [emoji, setEmoji] = useState(item.emoji);
  const isEditting = item.isEditting ?? false;
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const createItem = useCallback(
    (type: 1 | 2, contentType?: string) => {
      const newItemId = new Date().getTime().toString();
      const temp = [...data];
      updateTree(temp, item.id, {
        ...item,
        collapsed: false, // 展开父节点
        children: [
          ...(item.children ?? []),
          {
            id: newItemId,
            name: '',
            level: item.level + 1,
            type,
            emoji: '',
            content_type: contentType,
            status: 1,
            isEditting: true,
            parentId: item.id,
          },
        ],
      });
      updateData?.(temp);
      // 延迟滚动，等待 DOM 更新
      setTimeout(() => {
        scrollToItem?.(newItemId);
      }, 100);
    },
    [data, item, updateData, scrollToItem],
  );

  const renameItem = useCallback(() => {
    const temp = [...data];
    updateTree(temp, item.id, {
      ...item,
      isEditting: true,
    });
    updateData?.(temp);
  }, [data, item, updateData]);

  const removeItem = useCallback(
    (id: string) => {
      const temp = [...data];
      const remove = (value: ITreeItem[]) => {
        return value.filter(item => {
          if (item.id === id) return false;
          if (item.children) {
            item.children = remove(item.children);
          }
          return true;
        });
      };
      const newItems = remove(temp);
      updateData?.(newItems);
    },
    [data, item, updateData],
  );

  const handleSelectChange = useCallback(
    (id: string) => {
      if (relativeSelect && selectionModel === 'cascade-parent-sync') {
        const newSelected = handleMultiSelect(data, id, selected);
        onSelectChange?.(newSelected || [], id);
      } else if (relativeSelect && selectionModel === 'parent-controls-child') {
        const newSelected = handleParentControlledSelect(data, id, selected);
        onSelectChange?.(newSelected || [], id);
      } else {
        const temp = [...selected];
        if (temp.includes(id)) {
          onSelectChange?.(
            temp.filter(item => item !== id),
            id,
          );
        } else {
          onSelectChange?.([...temp, id], id);
        }
      }
    },
    [onSelectChange, selected, data, relativeSelect, selectionModel],
  );

  useEffect(() => {
    if (
      relativeSelect &&
      selectionModel === 'cascade-parent-sync' &&
      selected.length > 0
    ) {
      const temp = [...data];
      const selectedSet = new Set(selected);
      updateAllParentStatus(temp, selectedSet);
      const newSelected = Array.from(selectedSet);
      if (newSelected.length !== selected.length) {
        onSelectChange?.(newSelected);
      }
    }
  }, [selected, data, relativeSelect, onSelectChange, selectionModel]);

  useEffect(() => {
    setValue(item.name);
    setEmoji(item.emoji);
  }, [item]);

  useEffect(() => {
    if (isEditting && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditting]);

  const menuList = useMemo(() => {
    if (menu) {
      return (
        menu({
          item,
          createItem,
          renameItem,
          isEditing: isEditting,
          removeItem,
        }) || []
      );
    }
    return [];
  }, [item, isEditting, createItem, renameItem, removeItem]);

  const permissions = useMemo(() => {
    if (item.permissions) {
      return item.permissions;
    }
    return null;
  }, [item.permissions]);

  const isChecked = selectedSet.has(item.id);
  const isIndeterminate =
    selectionModel === 'parent-controls-child' &&
    !isChecked &&
    item.type === 1 &&
    hasSelectedDescendant(item, selectedSet);

  return (
    <Box
      sx={[
        treeSx(readOnly ?? false),
        {
          '&:hover': {
            '.dnd-sortable-tree_simple_handle': {
              opacity: 1,
            },
          },
        },
      ]}
    >
      <Stack
        direction='row'
        alignItems={'center'}
        gap={supportSelect ? 0 : 0}
        onClick={e => e.stopPropagation()}
      >
        {!readOnly ? (
          <div
            className={'dnd-sortable-tree_simple_handle'}
            {...props.handleProps}
          />
        ) : (
          <Box />
        )}

        {supportSelect && (
          <Checkbox
            sx={{
              visibility: disabled?.(item) ? 'hidden' : 'visible',
              flexShrink: 0,
              color: 'text.disabled',
              width: '35px',
              height: '35px',
            }}
            checked={isChecked}
            indeterminate={isIndeterminate}
            onChange={e => {
              e.stopPropagation();
              handleSelectChange(item.id);
            }}
            disabled={disabled?.(item)}
          />
        )}

        <Box sx={{ flex: 1, pl: 3 }}>
          <TreeItemWrapper
            {...props}
            ref={ref}
            indentationWidth={23}
            showDragHandle={false}
          >
            <Stack
              direction='row'
              alignItems={'center'}
              justifyContent='space-between'
              gap={2}
              flex={1}
              sx={{ pr: 2 }}
              onClick={() => {
                if (readOnly) return;
                if (ui === 'select') {
                  handleSelectChange(item.id);
                  return;
                }
                if (item.type === 2)
                  window.open(`/doc/editor/${item.id}`, '_blank');
              }}
            >
              {item.isEditting ? (
                <Stack
                  direction='row'
                  alignItems={'center'}
                  gap={2}
                  onClick={e => e.stopPropagation()}
                >
                  <Emoji
                    type={item.type}
                    collapsed={collapsed}
                    value={emoji}
                    onChange={setEmoji}
                  />
                  <TextField
                    size='small'
                    value={value}
                    inputRef={inputRef}
                    placeholder={t('editor.namePlaceholder')}
                    sx={{
                      width: 300,
                      input: {
                        bgcolor: 'background.paper',
                      },
                    }}
                    onPointerDown={e => e.stopPropagation()}
                    onMouseDown={e => e.stopPropagation()}
                    onTouchStart={e => e.stopPropagation()}
                    onChange={e => setValue(e.target.value)}
                  />
                  <Button
                    variant='contained'
                    size='small'
                    onClick={e => {
                      e.stopPropagation();
                      if (item.name) {
                        putApiV1NodeDetail({
                          id: item.id,
                          kb_id: id,
                          nav_id:
                            (item as { nav_id?: string }).nav_id ||
                            nav_id ||
                            '',
                          name: value,
                          emoji,
                        }).then(() => {
                          message.success(t('common.saveSuccess'));
                          const temp = [...data];
                          updateTree(temp, item.id, {
                            ...item,
                            name: value,
                            emoji,
                            isEditting: false,
                            status: item.name === value ? item.status : 1,
                            updated_at: dayjs().toString(),
                          });
                          updateData?.(temp);
                          refresh?.();
                        });
                      } else {
                        if (value === '') {
                          message.error(t('doc.properties.nameRequired'));
                          return;
                        }
                        postApiV1Node({
                          name: value,
                          content: '',
                          kb_id: id,
                          nav_id: nav_id || '',
                          parent_id: item.parentId,
                          type: item.type,
                          emoji,
                          content_type: item.content_type,
                        }).then(res => {
                          message.success(t('doc.createSuccess'));
                          const temp = [...data];
                          const newItem = {
                            ...item,
                            id: res.id,
                            name: value,
                            emoji,
                            isEditting: false,
                            updated_at: dayjs().toString(),
                          };
                          if (item.type === 1) {
                            newItem.children = [];
                          }
                          updateTree(temp, item.id, newItem);
                          updateData?.(temp);
                          refresh?.();
                          // 滚动到保存后的项
                          setTimeout(() => {
                            scrollToItem?.(res.id);
                          }, 100);
                        });
                      }
                    }}
                  >
                    {t('common.save')}
                  </Button>
                  <Button
                    variant='outlined'
                    size='small'
                    onClick={e => {
                      e.stopPropagation();
                      if (!item.name) {
                        removeItem(item.id);
                      } else {
                        const temp = [...data];
                        updateTree(temp, item.id, {
                          ...item,
                          isEditting: false,
                        });
                        updateData?.(temp);
                      }
                    }}
                  >
                    {t('common.cancel')}
                  </Button>
                </Stack>
              ) : (
                <Stack
                  direction='row'
                  alignItems={'center'}
                  gap={1}
                  sx={{
                    fontSize: 14,
                    cursor: 'pointer',
                    ...(ui === 'select' && { width: '100%', flex: 1 }),
                  }}
                >
                  <Box
                    onClick={e => e.stopPropagation()}
                    sx={{ flexShrink: 0, cursor: 'pointer' }}
                  >
                    <Emoji
                      readOnly={readOnly}
                      sx={{ width: 24, height: 24, fontSize: 14 }}
                      type={item.type}
                      collapsed={collapsed}
                      value={item.emoji}
                      onChange={async value => {
                        try {
                          await putApiV1NodeDetail({
                            id: item.id,
                            kb_id: id,
                            nav_id:
                              (item as { nav_id?: string }).nav_id ||
                              nav_id ||
                              '',
                            emoji: value,
                          });
                          message.success(t('common.saveSuccess'));
                          const temp = [...data];
                          updateTree(temp, item.id, {
                            ...item,
                            updated_at: dayjs().toString(),
                            status: 1,
                            emoji: value,
                          });
                          updateData?.(temp);
                          refresh?.();
                        } catch (error) {
                          message.error(t('common.saveFailed'));
                        }
                      }}
                    />
                  </Box>
                  {ui === 'select' ? (
                    <Ellipsis sx={{ width: 0, flex: 1, overflow: 'hidden' }}>
                      {item.name}
                    </Ellipsis>
                  ) : (
                    <>
                      <Box>
                        {item.name}
                        {item.content_type === 'md' && (
                          <Box
                            component={'span'}
                            sx={{
                              fontSize: 10,
                              color: 'white',
                              background:
                                'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
                              px: 1,
                              ml: 1,
                              fontWeight: '500',
                              borderRadius: '4px',
                              height: '14px',
                              lineHeight: '14px',
                              display: 'inline-block',
                            }}
                          >
                            MD
                          </Box>
                        )}
                        {item.type === 2 && item.lang && item.lang !== 'zh' && (
                          <Box
                            component={'span'}
                            sx={{
                              fontSize: 10,
                              color: 'white',
                              background:
                                'linear-gradient(135deg, #8ec5fc 0%, #e0c3fc 100%)',
                              px: 1,
                              ml: 1,
                              fontWeight: '500',
                              borderRadius: '4px',
                              height: '14px',
                              lineHeight: '14px',
                              display: 'inline-block',
                              textTransform: 'uppercase',
                            }}
                          >
                            {item.lang}
                          </Box>
                        )}
                        {item.type === 2 &&
                          (item.channel === 'article' ||
                            item.channel === 'both') && (
                            <Box
                              component={'span'}
                              sx={{
                                fontSize: 10,
                                color: 'white',
                                background:
                                  item.channel === 'both'
                                    ? 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)'
                                    : 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
                                px: 1,
                                ml: 1,
                                fontWeight: '500',
                                borderRadius: '4px',
                                height: '14px',
                                lineHeight: '14px',
                                display: 'inline-block',
                              }}
                            >
                              {item.channel === 'both'
                                ? t('doc.channelBoth')
                                : t('doc.channelArticle')}
                            </Box>
                          )}
                      </Box>
                    </>
                  )}
                </Stack>
              )}
              {menu && (
                <>
                  <Box
                    sx={{
                      flex: 1,
                      alignSelf: 'center',
                      borderBottom: '1px dashed',
                      borderColor: 'divider',
                    }}
                  />
                  <Stack
                    direction='row'
                    alignItems={'center'}
                    gap={2}
                    sx={{ flexShrink: 0 }}
                  >
                    <Stack
                      direction='row'
                      alignItems={'center'}
                      gap={1}
                      sx={{ flexShrink: 0, fontSize: 12 }}
                    >
                      {item.status === 0 && (
                        <StyledTag color='error'>
                          {t('doc.tagUnpublished')}
                        </StyledTag>
                      )}
                      {item.status === 1 && (
                        <StyledTag color='error'>
                          {t('doc.tagUpdateUnpublished')}
                        </StyledTag>
                      )}
                      {item.type === 2 &&
                        item.rag_status &&
                        item.status !== 0 && (
                          <Tooltip title={item.rag_message}>
                            <StyledTag
                              color={
                                RAG_SOURCES[item.rag_status]?.color ||
                                ('warning' as any)
                              }
                            >
                              {t(
                                RAG_SOURCES[item.rag_status]?.name ||
                                  'rag.failed',
                              )}
                            </StyledTag>
                          </Tooltip>
                        )}

                      {item.type === 2 && (
                        <>
                          {permissions?.answerable &&
                            ANSWERABLE_PERMISSIONS_MAP[
                              permissions.answerable
                            ] && (
                              <StyledTag
                                color={
                                  ANSWERABLE_PERMISSIONS_MAP[
                                    permissions.answerable
                                  ].color
                                }
                              >
                                {t(
                                  ANSWERABLE_PERMISSIONS_MAP[
                                    permissions.answerable
                                  ].label,
                                )}
                              </StyledTag>
                            )}
                          {permissions?.visitable &&
                            VISITABLE_PERMISSIONS_MAP[
                              permissions.visitable
                            ] && (
                              <StyledTag
                                color={
                                  VISITABLE_PERMISSIONS_MAP[
                                    permissions.visitable
                                  ].color
                                }
                              >
                                {t(
                                  VISITABLE_PERMISSIONS_MAP[
                                    permissions.visitable
                                  ].label,
                                )}
                              </StyledTag>
                            )}
                          {permissions?.visible &&
                            VISIBLE_PERMISSIONS_MAP[permissions.visible] && (
                              <StyledTag
                                color={
                                  VISIBLE_PERMISSIONS_MAP[permissions.visible]
                                    .color
                                }
                              >
                                {t(
                                  VISIBLE_PERMISSIONS_MAP[permissions.visible]
                                    .label,
                                )}
                              </StyledTag>
                            )}
                        </>
                      )}
                    </Stack>
                    <Box
                      sx={{
                        fontSize: 12,
                        fontFamily: 'monospace',
                        color: 'text.disabled',
                        width: 60,
                        textAlign: 'right',
                      }}
                    >
                      {dayjs(item.updated_at).fromNow()}
                    </Box>
                    <Box onClick={e => e.stopPropagation()}>
                      <TreeMenu menu={menuList} />
                    </Box>
                  </Stack>
                </>
              )}
            </Stack>
          </TreeItemWrapper>
        </Box>
      </Stack>
    </Box>
  );
});

export default TreeItem;
