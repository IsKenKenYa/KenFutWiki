import ErrorJSON from '@/assets/json/error.json';
import Card from '@/components/Card';
import { ModelProvider } from '@/constant/enums';
import {
  postApiV1ModelSwitchMode,
  putApiV1Model,
  getApiV1ModelModeSetting,
} from '@/request/Model';
import { GithubComChaitinPandaWikiDomainModelListItem } from '@/request/types';
import { addOpacityToColor } from '@/utils';
import { message, Modal } from '@ctzhian/ui';
import { Box, Button, Stack, Switch, useTheme } from '@mui/material';
import LottieIcon from '../../LottieIcon';
import {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react';
import ModelFormModal from '@/components/ModelFormModal';

export interface ModelConfigRef {
  handleClose: () => void;
  onSubmit: () => Promise<void>;
}

interface ModelConfigProps {
  onCloseModal: () => void;
  chatModelData: GithubComChaitinPandaWikiDomainModelListItem | null;
  embeddingModelData: GithubComChaitinPandaWikiDomainModelListItem | null;
  rerankModelData: GithubComChaitinPandaWikiDomainModelListItem | null;
  analysisModelData: GithubComChaitinPandaWikiDomainModelListItem | null;
  analysisVLModelData: GithubComChaitinPandaWikiDomainModelListItem | null;
  getModelList: () => void;
  autoSwitchToAutoMode?: boolean;
  hideDocumentationHint?: boolean;
  showSaveBtn?: boolean;
}

const ModelConfig = forwardRef<ModelConfigRef, ModelConfigProps>(
  (props, ref) => {
    const theme = useTheme();
    const {
      onCloseModal,
      chatModelData,
      embeddingModelData,
      rerankModelData,
      analysisModelData,
      analysisVLModelData,
      getModelList,
      hideDocumentationHint = false,
      showSaveBtn = true,
    } = props;

    const [isSaving, setIsSaving] = useState(false);
    const [hasConfigChanged, setHasConfigChanged] = useState(false);

    const [modelData, setModelData] = useState<Record<string, any>>({
      chat: chatModelData,
      embedding: embeddingModelData,
      rerank: rerankModelData,
      analysis: analysisModelData,
      'analysis-vl': analysisVLModelData,
    });

    const cacheModelData = useRef<Record<string, any>>({});

    const [addOpen, setAddOpen] = useState(false);
    const [addType, setAddType] = useState<
      'chat' | 'embedding' | 'rerank' | 'analysis' | 'analysis-vl'
    >('chat');
    const [openingAdd, setOpeningAdd] = useState<
      'chat' | 'embedding' | 'rerank' | 'analysis' | 'analysis-vl' | null
    >(null);

    const handleOpenAdd = async (
      type: 'chat' | 'embedding' | 'rerank' | 'analysis' | 'analysis-vl',
    ) => {
      try {
        setOpeningAdd(type);
        // 预加载 modal 代码分块，避免首次打开白屏
        await import('@/components/ModelFormModal');
        setAddType(type);
        setAddOpen(true);
      } finally {
        setOpeningAdd(null);
      }
    };

    // 组件挂载时,历史自动模式（百智云）一次性迁移回手动模式
    useEffect(() => {
      const migrateLegacyAutoMode = async () => {
        try {
          const setting = await getApiV1ModelModeSetting();
          if (setting?.mode === 'auto') {
            await postApiV1ModelSwitchMode({ mode: 'manual' });
            await getModelList();
          }
        } catch (err) {
          console.error('检查模型配置失败:', err);
        }
      };
      migrateLegacyAutoMode();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 处理关闭弹窗
    const handleCloseModal = () => {
      if (hasConfigChanged) {
        Modal.confirm({
          title: '提示',
          content: '有未应用的设置，是否确认关闭？',
          onOk: () => {
            onCloseModal();
          },
          okText: '确认',
          cancelText: '取消',
        });
      } else {
        onCloseModal();
      }
    };

    // 暴露方法给父组件
    useImperativeHandle(ref, () => ({
      onSubmit: handleSave,
      handleClose: handleCloseModal,
    }));

    useEffect(() => {
      setModelData({
        chat: chatModelData,
        embedding: embeddingModelData,
        rerank: rerankModelData,
        analysis: analysisModelData,
        'analysis-vl': analysisVLModelData,
      });
    }, [
      chatModelData,
      embeddingModelData,
      rerankModelData,
      analysisModelData,
      analysisVLModelData,
    ]);

    const handleSave = async () => {
      if (!showSaveBtn) {
        return await performSave();
      }

      if (hasConfigChanged) {
        // 修改向量模型需要确认（会触发重新学习）
        if (cacheModelData.current['embedding']) {
          Modal.confirm({
            title: '确认操作',
            content: '此操作会触发重新学习，请确认是否继续？',
            onOk: async () => {
              await performSave();
            },
            okText: '确认',
            cancelText: '取消',
          });
        } else {
          await performSave();
        }
      }
    };

    const performSave = async () => {
      setIsSaving(true);
      try {
        await postApiV1ModelSwitchMode({ mode: 'manual' });
        setHasConfigChanged(false);
        message.success('配置已应用');
        cacheModelData.current = {};
        await getModelList(); // 刷新模型列表
      } finally {
        setIsSaving(false);
      }
    };

    const IconModel = modelData.chat
      ? ModelProvider[modelData.chat.provider as keyof typeof ModelProvider]
          .icon
      : null;

    const IconEmbeddingModel = modelData.embedding
      ? ModelProvider[
          modelData.embedding.provider as keyof typeof ModelProvider
        ].icon
      : null;

    const IconRerankModel = modelData.rerank
      ? ModelProvider[modelData.rerank.provider as keyof typeof ModelProvider]
          .icon
      : null;

    const IconAnalysisModel = modelData.analysis
      ? ModelProvider[modelData.analysis.provider as keyof typeof ModelProvider]
          .icon
      : null;

    const IconAnalysisVLModel = modelData['analysis-vl']
      ? ModelProvider[
          modelData['analysis-vl'].provider as keyof typeof ModelProvider
        ].icon
      : null;

    return (
      <Stack gap={0}>
        <Box
          sx={{
            pl: 2,
            display: 'flex',
            alignItems: 'flex-start',
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                fontSize: 14,
                fontWeight: 'bold',
                color: 'text.primary',
                mb: '16px',
              }}
            >
              <Box
                sx={{
                  width: 4,
                  height: 10,
                  bgcolor: 'primary.main',
                  borderRadius: '30%',
                  mr: 1,
                }}
              />
              模型配置
            </Box>
            {showSaveBtn && (
              <Box
                sx={{
                  fontSize: 12,
                  color: 'text.tertiary',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                <Box
                  component='span'
                  sx={{
                    color: 'warning.main',
                    fontWeight: 'bold',
                  }}
                >
                  提示：
                </Box>
                修改向量模型会触发重新学习
              </Box>
            )}
          </Box>
          {hasConfigChanged && showSaveBtn && (
            <Button
              variant='contained'
              size='small'
              loading={isSaving}
              onClick={handleSave}
              sx={{ mt: 3 }}
            >
              应用
            </Button>
          )}
        </Box>
        <>
          {/* Chat */}
          <Card
            sx={{
              flex: 1,
              p: 2,
              overflow: 'hidden',
              overflowY: 'auto',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack
              direction={'row'}
              alignItems={'center'}
              justifyContent={'space-between'}
            >
              <Box>
                <Stack
                  direction={'row'}
                  alignItems={'center'}
                  gap={1}
                  sx={{ width: 500 }}
                >
                  {modelData.chat ? (
                    <>
                      {IconModel && <IconModel sx={{ fontSize: 18 }} />}
                      <Box
                        sx={{
                          fontSize: 14,
                          lineHeight: '20px',
                          color: 'text.tertiary',
                        }}
                      >
                        {ModelProvider[
                          modelData.chat.provider as keyof typeof ModelProvider
                        ].cn ||
                          ModelProvider[
                            modelData.chat
                              .provider as keyof typeof ModelProvider
                          ].label ||
                          '其他'}
                        &nbsp;&nbsp;/
                      </Box>
                      <Box
                        sx={{
                          fontSize: 14,
                          lineHeight: '20px',
                          fontFamily: 'Gbold',
                          ml: -0.5,
                        }}
                      >
                        {modelData.chat.model}
                      </Box>
                      <Box
                        sx={{
                          fontSize: 12,
                          px: 1,
                          lineHeight: '20px',
                          borderRadius: '10px',
                          bgcolor: addOpacityToColor(
                            theme.palette.primary.main,
                            0.1,
                          ),
                          color: 'primary.main',
                        }}
                      >
                        智能对话模型
                      </Box>
                    </>
                  ) : (
                    <Box
                      sx={{
                        fontSize: 14,
                        lineHeight: '20px',
                        fontFamily: 'Gbold',
                        ml: -0.5,
                      }}
                    >
                      智能对话模型
                    </Box>
                  )}
                  <Box
                    sx={{
                      fontSize: 12,
                      px: 1,
                      lineHeight: '20px',
                      borderRadius: '10px',
                      bgcolor: addOpacityToColor(
                        theme.palette.primary.main,
                        0.1,
                      ),
                      color: 'primary.main',
                    }}
                  >
                    大模型
                  </Box>
                  <Box
                    sx={{
                      fontSize: 12,
                      px: 1,
                      lineHeight: '20px',
                      borderRadius: '10px',
                      bgcolor: addOpacityToColor(
                        theme.palette.primary.main,
                        0.1,
                      ),
                      color: 'primary.main',
                    }}
                  >
                    必选
                  </Box>
                </Stack>
                <Box sx={{ fontSize: 12, color: 'text.tertiary', mt: 1 }}>
                  在
                  <Box component='span' sx={{ fontWeight: 'bold' }}>
                    {' '}
                    智能问答{' '}
                  </Box>
                  和
                  <Box component='span' sx={{ fontWeight: 'bold' }}>
                    {' '}
                    摘要生成{' '}
                  </Box>
                  过程中使用。
                </Box>
              </Box>
              <Box sx={{ flexGrow: 1, flexSelf: 'flex-start' }}>
                {modelData.chat ? (
                  <Box
                    sx={{
                      display: 'inline-block',
                      fontSize: 12,
                      px: 1,
                      lineHeight: '20px',
                      borderRadius: '10px',
                      bgcolor: addOpacityToColor(
                        theme.palette.success.main,
                        0.1,
                      ),
                      color: 'success.main',
                    }}
                  >
                    状态正常
                  </Box>
                ) : (
                  <Stack direction={'row'} alignItems={'center'} gap={1}>
                    <Box
                      sx={{
                        fontSize: 12,
                        px: 1,
                        lineHeight: '20px',
                        borderRadius: '10px',
                        bgcolor: addOpacityToColor(
                          theme.palette.error.main,
                          0.1,
                        ),
                        color: 'error.main',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      必填配置
                    </Box>
                    {!hideDocumentationHint && (
                      <>
                        <Stack
                          alignItems={'center'}
                          justifyContent={'center'}
                          sx={{ width: 22, height: 22, cursor: 'pointer' }}
                        >
                          <LottieIcon
                            id='warning'
                            src={ErrorJSON}
                            style={{ width: 20, height: 20 }}
                          />
                        </Stack>
                        <Box sx={{ color: 'error.main', fontSize: 12 }}>
                          未配置无法使用
                        </Box>
                      </>
                    )}
                  </Stack>
                )}
              </Box>
              <Button
                size='small'
                variant='outlined'
                loading={openingAdd === 'chat'}
                onClick={() => handleOpenAdd('chat')}
              >
                {modelData.chat ? '修改' : '配置'}
              </Button>
            </Stack>
          </Card>

          {/* Embedding */}
          <Card
            sx={{
              flex: 1,
              p: 2,
              overflow: 'hidden',
              overflowY: 'auto',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack
              direction={'row'}
              alignItems={'center'}
              justifyContent={'space-between'}
            >
              <Box>
                <Stack
                  direction={'row'}
                  alignItems={'center'}
                  gap={1}
                  sx={{ width: 500 }}
                >
                  {modelData.embedding ? (
                    <>
                      {IconEmbeddingModel && (
                        <IconEmbeddingModel sx={{ fontSize: 18 }} />
                      )}

                      <Box
                        sx={{
                          fontSize: 14,
                          lineHeight: '20px',
                          color: 'text.tertiary',
                        }}
                      >
                        {ModelProvider[
                          modelData.embedding
                            .provider as keyof typeof ModelProvider
                        ].cn ||
                          ModelProvider[
                            modelData.embedding
                              .provider as keyof typeof ModelProvider
                          ].label ||
                          '其他'}
                        &nbsp;&nbsp;/
                      </Box>
                      <Box
                        sx={{
                          fontSize: 14,
                          lineHeight: '20px',
                          fontFamily: 'Gbold',
                          ml: -0.5,
                        }}
                      >
                        {modelData.embedding.model}
                      </Box>
                      <Box
                        sx={{
                          fontSize: 12,
                          px: 1,
                          lineHeight: '20px',
                          borderRadius: '10px',
                          bgcolor: addOpacityToColor(
                            theme.palette.primary.main,
                            0.1,
                          ),
                          color: 'primary.main',
                        }}
                      >
                        向量模型
                      </Box>
                    </>
                  ) : (
                    <Box
                      sx={{
                        fontSize: 14,
                        lineHeight: '20px',
                        fontFamily: 'Gbold',
                        ml: -0.5,
                      }}
                    >
                      向量模型
                    </Box>
                  )}
                  <Box
                    sx={{
                      fontSize: 12,
                      px: 1,
                      lineHeight: '20px',
                      borderRadius: '10px',
                      bgcolor: addOpacityToColor(
                        theme.palette.primary.main,
                        0.1,
                      ),
                      color: 'primary.main',
                    }}
                  >
                    小模型
                  </Box>
                  <Box
                    sx={{
                      fontSize: 12,
                      px: 1,
                      lineHeight: '20px',
                      borderRadius: '10px',
                      bgcolor: addOpacityToColor(
                        theme.palette.primary.main,
                        0.1,
                      ),
                      color: 'primary.main',
                    }}
                  >
                    必选
                  </Box>
                </Stack>
                <Box sx={{ fontSize: 12, color: 'text.tertiary', mt: 1 }}>
                  在
                  <Box component='span' sx={{ fontWeight: 'bold' }}>
                    {' '}
                    内容发布{' '}
                  </Box>
                  和
                  <Box component='span' sx={{ fontWeight: 'bold' }}>
                    {' '}
                    智能问答{' '}
                  </Box>
                  和
                  <Box component='span' sx={{ fontWeight: 'bold' }}>
                    {' '}
                    智能搜索{' '}
                  </Box>
                  过程中使用。
                </Box>
              </Box>
              <Box sx={{ flexGrow: 1, flexSelf: 'flex-start' }}>
                {modelData.embedding ? (
                  <Box
                    sx={{
                      display: 'inline-block',
                      fontSize: 12,
                      px: 1,
                      lineHeight: '20px',
                      borderRadius: '10px',
                      bgcolor: addOpacityToColor(
                        theme.palette.success.main,
                        0.1,
                      ),
                      color: 'success.main',
                    }}
                  >
                    状态正常
                  </Box>
                ) : (
                  <Stack direction={'row'} alignItems={'center'} gap={1}>
                    <Box
                      sx={{
                        fontSize: 12,
                        px: 1,
                        lineHeight: '20px',
                        borderRadius: '10px',
                        bgcolor: addOpacityToColor(
                          theme.palette.error.main,
                          0.1,
                        ),
                        color: 'error.main',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      必填配置
                    </Box>
                    {!hideDocumentationHint && (
                      <>
                        <Stack
                          alignItems={'center'}
                          justifyContent={'center'}
                          sx={{ width: 22, height: 22, cursor: 'pointer' }}
                        >
                          <LottieIcon
                            id='warning'
                            src={ErrorJSON}
                            style={{ width: 20, height: 20 }}
                          />
                        </Stack>
                        <Box sx={{ color: 'error.main', fontSize: 12 }}>
                          未配置无法使用
                        </Box>
                      </>
                    )}
                  </Stack>
                )}
              </Box>
              <Button
                size='small'
                variant='outlined'
                loading={openingAdd === 'embedding'}
                onClick={() => handleOpenAdd('embedding')}
              >
                {modelData.embedding ? '修改' : '配置'}
              </Button>
            </Stack>
          </Card>

          {/* Rerank */}
          <Card
            sx={{
              flex: 1,
              p: 2,
              overflow: 'hidden',
              overflowY: 'auto',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack
              direction={'row'}
              alignItems={'center'}
              justifyContent={'space-between'}
            >
              <Box>
                <Stack
                  direction={'row'}
                  alignItems={'center'}
                  gap={1}
                  sx={{ width: 500 }}
                >
                  {modelData.rerank ? (
                    <>
                      {IconRerankModel && (
                        <IconRerankModel sx={{ fontSize: 18 }} />
                      )}

                      <Box
                        sx={{
                          fontSize: 14,
                          lineHeight: '20px',
                          color: 'text.tertiary',
                        }}
                      >
                        {ModelProvider[
                          modelData.rerank
                            .provider as keyof typeof ModelProvider
                        ].cn ||
                          ModelProvider[
                            modelData.rerank
                              .provider as keyof typeof ModelProvider
                          ].label ||
                          '其他'}
                        &nbsp;&nbsp;/
                      </Box>
                      <Box
                        sx={{
                          fontSize: 14,
                          lineHeight: '20px',
                          fontFamily: 'Gbold',
                          ml: -0.5,
                        }}
                      >
                        {modelData.rerank.model}
                      </Box>
                      <Box
                        sx={{
                          fontSize: 12,
                          px: 1,
                          lineHeight: '20px',
                          borderRadius: '10px',
                          bgcolor: addOpacityToColor(
                            theme.palette.primary.main,
                            0.1,
                          ),
                          color: 'primary.main',
                        }}
                      >
                        重排序模型
                      </Box>
                    </>
                  ) : (
                    <Box
                      sx={{
                        fontSize: 14,
                        lineHeight: '20px',
                        fontFamily: 'Gbold',
                        ml: -0.5,
                      }}
                    >
                      重排序模型
                    </Box>
                  )}
                  <Box
                    sx={{
                      fontSize: 12,
                      px: 1,
                      lineHeight: '20px',
                      borderRadius: '10px',
                      bgcolor: addOpacityToColor(
                        theme.palette.primary.main,
                        0.1,
                      ),
                      color: 'primary.main',
                    }}
                  >
                    小模型
                  </Box>
                  <Box
                    sx={{
                      fontSize: 12,
                      px: 1,
                      lineHeight: '20px',
                      borderRadius: '10px',
                      bgcolor: addOpacityToColor(
                        theme.palette.primary.main,
                        0.1,
                      ),
                      color: 'primary.main',
                    }}
                  >
                    必选
                  </Box>
                </Stack>
                <Box sx={{ fontSize: 12, color: 'text.tertiary', mt: 1 }}>
                  在
                  <Box component='span' sx={{ fontWeight: 'bold' }}>
                    {' '}
                    智能问答{' '}
                  </Box>
                  和
                  <Box component='span' sx={{ fontWeight: 'bold' }}>
                    {' '}
                    智能搜索{' '}
                  </Box>
                  过程中使用。
                </Box>
              </Box>
              <Box sx={{ flexGrow: 1, flexSelf: 'flex-start' }}>
                {modelData.rerank ? (
                  <Box
                    sx={{
                      display: 'inline-block',
                      fontSize: 12,
                      px: 1,
                      lineHeight: '20px',
                      borderRadius: '10px',
                      bgcolor: addOpacityToColor(
                        theme.palette.success.main,
                        0.1,
                      ),
                      color: 'success.main',
                    }}
                  >
                    状态正常
                  </Box>
                ) : (
                  <Stack direction={'row'} alignItems={'center'} gap={1}>
                    <Box
                      sx={{
                        fontSize: 12,
                        px: 1,
                        lineHeight: '20px',
                        borderRadius: '10px',
                        bgcolor: addOpacityToColor(
                          theme.palette.error.main,
                          0.1,
                        ),
                        color: 'error.main',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      必填配置
                    </Box>
                    {!hideDocumentationHint && (
                      <>
                        <Stack
                          alignItems={'center'}
                          justifyContent={'center'}
                          sx={{ width: 22, height: 22, cursor: 'pointer' }}
                        >
                          <LottieIcon
                            id='warning'
                            src={ErrorJSON}
                            style={{ width: 20, height: 20 }}
                          />
                        </Stack>
                        <Box sx={{ color: 'error.main', fontSize: 12 }}>
                          未配置无法使用
                        </Box>
                      </>
                    )}
                  </Stack>
                )}
              </Box>
              <Button
                size='small'
                variant='outlined'
                loading={openingAdd === 'rerank'}
                onClick={() => handleOpenAdd('rerank')}
              >
                {modelData.rerank ? '修改' : '配置'}
              </Button>
            </Stack>
          </Card>

          {/* Analysis */}
          <Card
            sx={{
              flex: 1,
              p: 2,
              overflow: 'hidden',
              overflowY: 'auto',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack
              direction={'row'}
              alignItems={'center'}
              justifyContent={'space-between'}
            >
              <Box>
                <Stack
                  direction={'row'}
                  alignItems={'center'}
                  gap={1}
                  sx={{ width: 500 }}
                >
                  {modelData.analysis ? (
                    <>
                      {IconAnalysisModel && (
                        <IconAnalysisModel sx={{ fontSize: 18 }} />
                      )}

                      <Box
                        sx={{
                          fontSize: 14,
                          lineHeight: '20px',
                          color: 'text.tertiary',
                        }}
                      >
                        {ModelProvider[
                          modelData.analysis
                            .provider as keyof typeof ModelProvider
                        ].cn ||
                          ModelProvider[
                            modelData.analysis
                              .provider as keyof typeof ModelProvider
                          ].label ||
                          '其他'}
                        &nbsp;&nbsp;/
                      </Box>
                      <Box
                        sx={{
                          fontSize: 14,
                          lineHeight: '20px',
                          fontFamily: 'Gbold',
                          ml: -0.5,
                        }}
                      >
                        {modelData.analysis.model}
                      </Box>
                      <Box
                        sx={{
                          fontSize: 12,
                          px: 1,
                          lineHeight: '20px',
                          borderRadius: '10px',
                          bgcolor: addOpacityToColor(
                            theme.palette.primary.main,
                            0.1,
                          ),
                          color: 'primary.main',
                        }}
                      >
                        文档分析模型
                      </Box>
                    </>
                  ) : (
                    <Box
                      sx={{
                        fontSize: 14,
                        lineHeight: '20px',
                        fontFamily: 'Gbold',
                        ml: -0.5,
                      }}
                    >
                      文档分析模型
                    </Box>
                  )}
                  <Box
                    sx={{
                      fontSize: 12,
                      px: 1,
                      lineHeight: '20px',
                      borderRadius: '10px',
                      bgcolor: addOpacityToColor(
                        theme.palette.primary.main,
                        0.1,
                      ),
                      color: 'primary.main',
                    }}
                  >
                    小模型
                  </Box>
                  <Box
                    sx={{
                      fontSize: 12,
                      px: 1,
                      lineHeight: '20px',
                      borderRadius: '10px',
                      bgcolor: addOpacityToColor(
                        theme.palette.primary.main,
                        0.1,
                      ),
                      color: 'primary.main',
                    }}
                  >
                    必选
                  </Box>
                </Stack>
                <Box sx={{ fontSize: 12, color: 'text.tertiary', mt: 1 }}>
                  在
                  <Box component='span' sx={{ fontWeight: 'bold' }}>
                    {' '}
                    内容发布{' '}
                  </Box>
                  和
                  <Box component='span' sx={{ fontWeight: 'bold' }}>
                    {' '}
                    智能问答{' '}
                  </Box>
                  过程中使用。
                </Box>
              </Box>
              <Box sx={{ flexGrow: 1, flexSelf: 'flex-start' }}>
                {modelData.analysis ? (
                  <Box
                    sx={{
                      display: 'inline-block',
                      fontSize: 12,
                      px: 1,
                      lineHeight: '20px',
                      borderRadius: '10px',
                      bgcolor: addOpacityToColor(
                        theme.palette.success.main,
                        0.1,
                      ),
                      color: 'success.main',
                    }}
                  >
                    状态正常
                  </Box>
                ) : (
                  <Stack direction={'row'} alignItems={'center'} gap={1}>
                    <Box
                      sx={{
                        fontSize: 12,
                        px: 1,
                        lineHeight: '20px',
                        borderRadius: '10px',
                        bgcolor: addOpacityToColor(
                          theme.palette.error.main,
                          0.1,
                        ),
                        color: 'error.main',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      必填配置
                    </Box>
                    {!hideDocumentationHint && (
                      <>
                        <Stack
                          alignItems={'center'}
                          justifyContent={'center'}
                          sx={{ width: 22, height: 22, cursor: 'pointer' }}
                        >
                          <LottieIcon
                            id='warning'
                            src={ErrorJSON}
                            style={{ width: 20, height: 20 }}
                          />
                        </Stack>
                        <Box sx={{ color: 'error.main', fontSize: 12 }}>
                          未配置无法使用
                        </Box>
                      </>
                    )}
                  </Stack>
                )}
              </Box>
              <Button
                size='small'
                variant='outlined'
                loading={openingAdd === 'analysis'}
                onClick={() => handleOpenAdd('analysis')}
              >
                {modelData.analysis ? '修改' : '配置'}
              </Button>
            </Stack>
          </Card>

          {/* Analysis-VL */}
          <Card
            sx={{
              flex: 1,
              p: 2,
              overflow: 'hidden',
              overflowY: 'auto',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack
              direction={'row'}
              alignItems={'center'}
              justifyContent={'space-between'}
            >
              <Box>
                <Stack
                  direction={'row'}
                  alignItems={'center'}
                  gap={1}
                  sx={{ width: 500 }}
                >
                  {modelData['analysis-vl'] ? (
                    <>
                      {IconAnalysisVLModel && (
                        <IconAnalysisVLModel sx={{ fontSize: 18 }} />
                      )}
                      <Box
                        sx={{
                          fontSize: 14,
                          lineHeight: '20px',
                          color: 'text.tertiary',
                        }}
                      >
                        {ModelProvider[
                          modelData['analysis-vl']
                            .provider as keyof typeof ModelProvider
                        ].cn ||
                          ModelProvider[
                            modelData['analysis-vl']
                              .provider as keyof typeof ModelProvider
                          ].label ||
                          '其他'}
                        &nbsp;&nbsp;/
                      </Box>
                      <Box
                        sx={{
                          fontSize: 14,
                          lineHeight: '20px',
                          fontFamily: 'Gbold',
                          ml: -0.5,
                        }}
                      >
                        {modelData['analysis-vl'].model}
                      </Box>
                      <Box
                        sx={{
                          fontSize: 12,
                          px: 1,
                          lineHeight: '20px',
                          borderRadius: '10px',
                          bgcolor: addOpacityToColor(
                            theme.palette.primary.main,
                            0.1,
                          ),
                          color: 'primary.main',
                        }}
                      >
                        图像分析模型
                      </Box>
                    </>
                  ) : (
                    <Box
                      sx={{
                        fontSize: 14,
                        lineHeight: '20px',
                        fontFamily: 'Gbold',
                        ml: -0.5,
                      }}
                    >
                      图像分析模型
                    </Box>
                  )}
                  <Box
                    sx={{
                      fontSize: 12,
                      px: 1,
                      lineHeight: '20px',
                      borderRadius: '10px',
                      bgcolor: addOpacityToColor(
                        theme.palette.primary.main,
                        0.1,
                      ),
                      color: 'primary.main',
                    }}
                  >
                    视觉模型
                  </Box>
                  <Box
                    sx={{
                      fontSize: 12,
                      px: 1,
                      lineHeight: '20px',
                      borderRadius: '10px',
                      bgcolor: theme.palette.divider,
                      color: 'text.tertiary',
                    }}
                  >
                    可选
                  </Box>
                  {modelData['analysis-vl'] && modelData['analysis-vl'].id && (
                    <Switch
                      size='small'
                      checked={modelData['analysis-vl'].is_active}
                      onChange={() => {
                        putApiV1Model({
                          ...modelData['analysis-vl'],
                          is_active: !modelData['analysis-vl'].is_active,
                        }).then(() => {
                          message.success('修改成功');
                          getModelList();
                        });
                      }}
                    />
                  )}
                </Stack>
                <Box sx={{ fontSize: 12, color: 'text.tertiary', mt: 1 }}>
                  在
                  <Box component='span' sx={{ fontWeight: 'bold' }}>
                    {' '}
                    内容发布{' '}
                  </Box>
                  和
                  <Box component='span' sx={{ fontWeight: 'bold' }}>
                    {' '}
                    智能问答{' '}
                  </Box>
                  过程中使用，启用后图像分析能力可用，可选配置。
                </Box>
              </Box>
              <Box sx={{ flexGrow: 1, flexSelf: 'flex-start' }}>
                {modelData['analysis-vl'] ? (
                  <Box
                    sx={{
                      display: 'inline-block',
                      fontSize: 12,
                      px: 1,
                      lineHeight: '20px',
                      borderRadius: '10px',
                      bgcolor: addOpacityToColor(
                        theme.palette.success.main,
                        0.1,
                      ),
                      color: 'success.main',
                    }}
                  >
                    状态正常
                  </Box>
                ) : (
                  <Box
                    sx={{
                      display: 'inline-block',
                      fontSize: 12,
                      px: 1,
                      lineHeight: '20px',
                      borderRadius: '10px',
                      bgcolor: theme.palette.divider,
                      color: 'text.tertiary',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    可选模型
                  </Box>
                )}
              </Box>
              <Button
                size='small'
                variant='outlined'
                loading={openingAdd === 'analysis-vl'}
                onClick={() => handleOpenAdd('analysis-vl')}
              >
                {modelData['analysis-vl'] ? '修改' : '配置'}
              </Button>
            </Stack>
          </Card>
        </>
        {addOpen && (
          <ModelFormModal
            open={addOpen}
            model_type={addType}
            data={
              addType && addType in modelData
                ? modelData[addType as keyof typeof modelData]
                : null
            }
            onClose={() => {
              setAddOpen(false);
            }}
            refresh={async () => {
              setAddOpen(false);
              await getModelList();
            }}
          />
        )}
      </Stack>
    );
  },
);

export default ModelConfig;
