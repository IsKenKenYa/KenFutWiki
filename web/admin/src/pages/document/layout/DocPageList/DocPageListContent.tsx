import { ITreeItem } from '@/api';
import Card from '@/components/Card';
import Cascader from '@/components/Cascader';
import DragTree, { type DragTreeHandle } from '@/components/Drag/DragTree';
import {
  TreeMenuItem,
  TreeMenuOptions,
} from '@/components/Drag/DragTree/TreeMenu';
import EmptyState from '@/components/EmptyState';
import Loading from '@/components/Loading';
import AddDocBtn from '@/pages/document/component/AddDocBtn';
import RecycleBinDialog from '@/pages/document/layout/DocPageList/RecycleBinDialog';
import { addOpacityToColor } from '@/utils';
import {
  Box,
  Button,
  Checkbox,
  IconButton,
  Stack,
  useTheme,
} from '@mui/material';
import { useState } from 'react';
import { IconGengduo } from '@panda-wiki/icons';
import { Trans, useTranslation } from 'react-i18next';

export interface DocPageListContentProps {
  data: ITreeItem[];
  list: { id?: string }[];
  search?: string;
  loading?: boolean;
  selected: string[];
  supportSelect: boolean;
  menu: (opra: TreeMenuOptions) => TreeMenuItem[];
  updateLocalData: (newData: ITreeItem[]) => void;
  onSelectChange: (value: string[]) => void;
  onBatchOpen: () => void;
  onMoreSummaryOpen: () => void;
  onMoveOpen: () => void;
  onDeleteOpen: () => void;
  onPropertiesOpen: () => void;
  onBatchClose: () => void;
  setOpraData: (data: { id?: string }[]) => void;
  dragTreeRef: React.RefObject<DragTreeHandle | null>;
  refresh: () => void;
  createLocal: (node: {
    id: string;
    name: string;
    type: 1 | 2;
    emoji?: string;
    parentId?: string | null;
    content_type?: string;
  }) => void;
  scrollTo: (id: string) => void;
  registerTreeDragHandlers?: (
    handlers: import('@/utils/drag').TreeDragHandlers | null,
  ) => void;
}

const DocPageListContent = ({
  data,
  list,
  search = '',
  loading = false,
  selected,
  supportSelect,
  menu,
  updateLocalData,
  onSelectChange,
  onBatchOpen,
  onMoreSummaryOpen,
  onMoveOpen,
  onDeleteOpen,
  onPropertiesOpen,
  onBatchClose,
  setOpraData,
  dragTreeRef,
  refresh,
  createLocal,
  scrollTo,
  registerTreeDragHandlers,
}: DocPageListContentProps) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [recycleBinOpen, setRecycleBinOpen] = useState(false);
  const showEmpty = list.length === 0;

  return (
    <Card sx={{ flex: 1 }}>
      <Stack
        direction={'row'}
        alignItems={'center'}
        justifyContent={'space-between'}
        sx={{ p: 2, lineHeight: '35px', minHeight: 35 }}
      >
        {/* 左侧：默认显示文档数量，点击批量操作后显示勾选栏 */}
        {supportSelect ? (
          <Stack
            direction={'row'}
            alignItems={'center'}
            sx={{ flex: 1, gap: 1 }}
          >
            <Checkbox
              sx={{
                color: 'text.disabled',
                width: '35px',
                height: '35px',
              }}
              checked={selected.length === list.length}
              indeterminate={
                selected.length > 0 && selected.length < list.length
              }
              onChange={e => {
                e.stopPropagation();
                if (selected.length === list.length) {
                  onSelectChange([]);
                  setOpraData([]);
                } else {
                  onSelectChange(list.map(item => item.id!).filter(Boolean));
                  setOpraData(list);
                }
              }}
            />
            {selected.length > 0 ? (
              <>
                <Box sx={{ fontSize: 13, color: 'text.secondary' }}>
                  {t('doc.selectedCount', { count: selected.length })}
                </Box>
                <Stack direction={'row'} alignItems={'center'} gap={1}>
                  {selected.length > 1 && (
                    <Button
                      size='small'
                      color='primary'
                      sx={{ minWidth: 0, p: 0, lineHeight: 1 }}
                      onClick={onMoreSummaryOpen}
                    >
                      {t('doc.summary.generate')}
                    </Button>
                  )}
                  <Button
                    size='small'
                    color='primary'
                    sx={{ minWidth: 0, p: 0, lineHeight: 1 }}
                    onClick={onMoveOpen}
                  >
                    {t('doc.batchMove')}
                  </Button>
                  <Button
                    size='small'
                    color='primary'
                    sx={{ minWidth: 0, p: 0, lineHeight: 1 }}
                    onClick={onDeleteOpen}
                  >
                    {t('doc.batchDelete')}
                  </Button>
                  <Button
                    size='small'
                    color='primary'
                    sx={{ minWidth: 0, p: 0, lineHeight: 1 }}
                    onClick={onPropertiesOpen}
                  >
                    {t('doc.batchPermissions')}
                  </Button>
                </Stack>
              </>
            ) : (
              <Box sx={{ fontSize: 13, color: 'text.secondary' }}>
                {t('doc.selectAll')}
              </Box>
            )}
            <Button
              size='small'
              sx={{
                color: 'text.secondary',
                minWidth: 0,
                p: 0,
                lineHeight: 1,
              }}
              onClick={onBatchClose}
            >
              {t('common.cancel')}
            </Button>
          </Stack>
        ) : (
          <Box sx={{ fontSize: 14, color: 'text.tertiary' }}>
            <Trans
              i18nKey='doc.totalDocs'
              values={{ total: list.length }}
              components={{
                num: (
                  <Box
                    component='span'
                    sx={{ fontWeight: 600, color: 'text.primary' }}
                  />
                ),
              }}
            />
          </Box>
        )}
        {/* 右侧：多功能按钮（添加文档 + 批量操作） */}
        <Stack direction={'row'} alignItems={'center'} gap={2}>
          <Button
            size='small'
            sx={{ color: 'text.secondary', minWidth: 0, p: 0, lineHeight: 1 }}
            onClick={() => setRecycleBinOpen(true)}
          >
            {t('doc.recycleBin.entry')}
          </Button>
          <AddDocBtn
            refresh={refresh}
            createLocal={createLocal}
            scrollTo={scrollTo}
            disabled={!!search}
          />
          <Cascader
            list={[
              {
                key: 'batch',
                label: (
                  <Stack
                    direction={'row'}
                    alignItems={'center'}
                    gap={1}
                    sx={{
                      fontSize: 14,
                      px: 2,
                      lineHeight: '40px',
                      height: 40,
                      width: 180,
                      borderRadius: '5px',
                      cursor: 'pointer',
                      ':hover': {
                        bgcolor: addOpacityToColor(
                          theme.palette.primary.main,
                          0.1,
                        ),
                      },
                    }}
                    onClick={onBatchOpen}
                  >
                    {t('doc.batchActions')}
                  </Stack>
                ),
              },
            ]}
            context={
              <Box>
                <IconButton size='small'>
                  <IconGengduo sx={{ fontSize: '16px' }} />
                </IconButton>
              </Box>
            }
          />
        </Stack>
      </Stack>
      <Stack
        sx={{
          height: 'calc(100vh - 183px - 48px)',
          overflow: 'hidden',
          overflowY: 'auto',
          p: 2,
          pt: 0,
        }}
      >
        {loading ? (
          <Loading sx={{ flex: 1, justifyContent: 'center' }} />
        ) : showEmpty ? (
          <EmptyState
            text={search ? t('doc.noSearchResults') : t('common.noData')}
            sx={{
              flex: 1,
              justifyContent: 'center',
            }}
          />
        ) : (
          <DragTree
            ref={dragTreeRef}
            data={data}
            menu={menu}
            updateData={updateLocalData}
            refresh={refresh}
            selected={selected}
            onSelectChange={onSelectChange}
            supportSelect={supportSelect}
            selectionModel='parent-controls-child'
            virtualized={true}
            registerDragHandlers={registerTreeDragHandlers}
          />
        )}
      </Stack>
      <RecycleBinDialog
        open={recycleBinOpen}
        onClose={() => setRecycleBinOpen(false)}
        refresh={refresh}
      />
    </Card>
  );
};

export default DocPageListContent;
