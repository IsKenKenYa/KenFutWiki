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
import { useTranslation } from 'react-i18next';
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
    const { t, i18n } = useTranslation();
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

    // 供应商显示名：中文界面取 cn，其它语言取品牌名 label；
    // 自定义供应商（枚举外 key）取用户填写的 provider_name，再回退到 base_url 域名。
    const providerName = (model: any) => {
      const conf = ModelProvider[model?.provider as keyof typeof ModelProvider];
      const zhName = i18n.language?.startsWith('zh') ? conf?.cn : conf?.label;
      if (zhName) return zhName;
      if (model?.provider_name) return model.provider_name;
      try {
        const host = model?.base_url
          ? new URL(
              /^https?:\/\//i.test(model.base_url)
                ? model.base_url
                : `https://${model.base_url}`,
            ).hostname
          : '';
        if (host) return host;
      } catch {
        // base_url 非法时继续走兜底文案
      }
      return t('model.other');
    };

    // 模型展示名：优先用户填写的 show_name，否则回退模型 ID
    const modelDisplayName = (model: any) => model?.show_name || model?.model;

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
          console.error('Failed to check model config:', err);
        }
      };
      migrateLegacyAutoMode();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 处理关闭弹窗
    const handleCloseModal = () => {
      if (hasConfigChanged) {
        Modal.confirm({
          title: t('common.tip'),
          content: t('model.unsavedConfirm'),
          onOk: () => {
            onCloseModal();
          },
          okText: t('common.confirm'),
          cancelText: t('common.cancel'),
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
            title: t('model.confirmTitle'),
            content: t('model.relearnConfirm'),
            onOk: async () => {
              await performSave();
            },
            okText: t('common.confirm'),
            cancelText: t('common.cancel'),
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
        message.success(t('model.applied'));
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
              {t('system.tabModel')}
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
                <Box sx={{ color: 'warning.main', fontWeight: 'bold' }}>
                  {t('model.vectorHint')}
                </Box>
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
              {t('model.apply')}
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
                        {providerName(modelData.chat)}
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
                        {modelDisplayName(modelData.chat)}
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
                        {t('model.chatTitle')}
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
                      {t('model.chatTitle')}
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
                    {t('model.largeModel')}
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
                    {t('model.required')}
                  </Box>
                </Stack>
                <Box sx={{ fontSize: 12, color: 'text.tertiary', mt: 1 }}>
                  {t('model.usageChat')}
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
                    {t('model.statusOk')}
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
                      {t('model.requiredConfig')}
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
                          {t('model.notConfigured')}
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
                {modelData.chat ? t('model.edit') : t('model.configure')}
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
                        {providerName(modelData.embedding)}
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
                        {modelDisplayName(modelData.embedding)}
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
                        {t('model.embeddingTitle')}
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
                      {t('model.embeddingTitle')}
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
                    {t('model.smallModel')}
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
                    {t('model.required')}
                  </Box>
                </Stack>
                <Box sx={{ fontSize: 12, color: 'text.tertiary', mt: 1 }}>
                  {t('model.usageEmbedding')}
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
                    {t('model.statusOk')}
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
                      {t('model.requiredConfig')}
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
                          {t('model.notConfigured')}
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
                {modelData.embedding ? t('model.edit') : t('model.configure')}
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
                        {providerName(modelData.rerank)}
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
                        {modelDisplayName(modelData.rerank)}
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
                        {t('model.rerankTitle')}
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
                      {t('model.rerankTitle')}
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
                    {t('model.smallModel')}
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
                    {t('model.required')}
                  </Box>
                </Stack>
                <Box sx={{ fontSize: 12, color: 'text.tertiary', mt: 1 }}>
                  {t('model.usageRerank')}
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
                    {t('model.statusOk')}
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
                      {t('model.requiredConfig')}
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
                          {t('model.notConfigured')}
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
                {modelData.rerank ? t('model.edit') : t('model.configure')}
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
                        {providerName(modelData.analysis)}
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
                        {modelDisplayName(modelData.analysis)}
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
                        {t('model.analysisTitle')}
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
                      {t('model.analysisTitle')}
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
                    {t('model.smallModel')}
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
                    {t('model.required')}
                  </Box>
                </Stack>
                <Box sx={{ fontSize: 12, color: 'text.tertiary', mt: 1 }}>
                  {t('model.usageAnalysis')}
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
                    {t('model.statusOk')}
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
                      {t('model.requiredConfig')}
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
                          {t('model.notConfigured')}
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
                {modelData.analysis ? t('model.edit') : t('model.configure')}
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
                        {providerName(modelData['analysis-vl'])}
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
                        {modelDisplayName(modelData['analysis-vl'])}
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
                        {t('model.analysisVlTitle')}
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
                      {t('model.analysisVlTitle')}
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
                    {t('model.visionModel')}
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
                    {t('model.optional')}
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
                          message.success(t('common.saveSuccess'));
                          getModelList();
                        });
                      }}
                    />
                  )}
                </Stack>
                <Box sx={{ fontSize: 12, color: 'text.tertiary', mt: 1 }}>
                  {t('model.usageAnalysisVl')}
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
                    {t('model.statusOk')}
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
                    {t('model.optionalModel')}
                  </Box>
                )}
              </Box>
              <Button
                size='small'
                variant='outlined'
                loading={openingAdd === 'analysis-vl'}
                onClick={() => handleOpenAdd('analysis-vl')}
              >
                {modelData['analysis-vl']
                  ? t('model.edit')
                  : t('model.configure')}
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
