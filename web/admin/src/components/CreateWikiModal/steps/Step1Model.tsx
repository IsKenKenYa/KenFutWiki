import React, {
  useState,
  useImperativeHandle,
  Ref,
  useEffect,
  useRef,
} from 'react';
import { Box } from '@mui/material';
import { useAppSelector, useAppDispatch } from '@/store';
import { setModelList } from '@/store/slices/config';
import { getApiV1ModelList } from '@/request/Model';
import { GithubComChaitinPandaWikiDomainModelListItem } from '@/request/types';
import ModelConfig, {
  ModelConfigRef,
} from '@/components/System/component/ModelConfig';

interface Step1ModelProps {
  ref: Ref<{ onSubmit: () => Promise<void> }>;
}

const Step1Model: React.FC<Step1ModelProps> = ({ ref }) => {
  const { modelList } = useAppSelector(state => state.config);
  const dispatch = useAppDispatch();

  const modelConfigRef = useRef<ModelConfigRef>(null);

  const [chatModelData, setChatModelData] =
    useState<GithubComChaitinPandaWikiDomainModelListItem | null>(null);
  const [embeddingModelData, setEmbeddingModelData] =
    useState<GithubComChaitinPandaWikiDomainModelListItem | null>(null);
  const [rerankModelData, setRerankModelData] =
    useState<GithubComChaitinPandaWikiDomainModelListItem | null>(null);
  const [analysisModelData, setAnalysisModelData] =
    useState<GithubComChaitinPandaWikiDomainModelListItem | null>(null);
  const [analysisVLModelData, setAnalysisVLModelData] =
    useState<GithubComChaitinPandaWikiDomainModelListItem | null>(null);

  const getModelList = () => {
    return getApiV1ModelList().then(res => {
      dispatch(
        setModelList(res as GithubComChaitinPandaWikiDomainModelListItem[]),
      );
      return res;
    });
  };

  const handleModelList = (
    list: GithubComChaitinPandaWikiDomainModelListItem[],
  ) => {
    const chat = list.find(it => it.type === 'chat') || null;
    const embedding = list.find(it => it.type === 'embedding') || null;
    const rerank = list.find(it => it.type === 'rerank') || null;
    const analysis = list.find(it => it.type === 'analysis') || null;
    const analysisVL = list.find(it => it.type === 'analysis-vl') || null;
    setChatModelData(chat);
    setEmbeddingModelData(embedding);
    setRerankModelData(rerank);
    setAnalysisModelData(analysis);
    setAnalysisVLModelData(analysisVL);
  };

  useEffect(() => {
    if (modelList) {
      handleModelList(modelList);
    }
  }, [modelList]);

  const onSubmit = async () => {
    await modelConfigRef.current?.onSubmit?.();
    // 检查必选模型是否配置齐全
    const list =
      (await getModelList()) as GithubComChaitinPandaWikiDomainModelListItem[];
    const has = (type: string) => list.some(it => it.type === type);
    if (
      !has('chat') ||
      !has('embedding') ||
      !has('rerank') ||
      !has('analysis')
    ) {
      return Promise.reject(new Error('请先完成必选模型的配置'));
    }
    return Promise.resolve();
  };

  useImperativeHandle(ref, () => ({
    onSubmit,
  }));

  return (
    <Box>
      <ModelConfig
        ref={modelConfigRef}
        onCloseModal={() => {}}
        chatModelData={chatModelData}
        embeddingModelData={embeddingModelData}
        rerankModelData={rerankModelData}
        analysisModelData={analysisModelData}
        analysisVLModelData={analysisVLModelData}
        getModelList={getModelList}
        hideDocumentationHint={true}
        showSaveBtn={false}
      />
    </Box>
  );
};

export default Step1Model;
