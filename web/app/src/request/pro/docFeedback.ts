import httpRequest, { ContentType } from './httpClient';

// 生成器对 multipart file 参数统一产出 image 字段名，与后端
// FormFile("screenshot") 读取的表单字段不一致，此处手动构造
// 与后端一致的字段名提交文档反馈
export interface SubmitDocumentFeedbackPayload {
  node_id?: string;
  content: string;
  correction_suggestion?: string;
  screenshot?: File;
}

export const submitDocumentFeedback = (
  payload: SubmitDocumentFeedbackPayload,
) => {
  const body: Record<string, string | File> = {
    node_id: payload.node_id || '',
    content: payload.content,
  };
  if (payload.correction_suggestion) {
    body.correction_suggestion = payload.correction_suggestion;
  }
  if (payload.screenshot) {
    body.screenshot = payload.screenshot;
  }
  return httpRequest<{ id: number }>({
    path: '/share/pro/v1/document/feedback',
    method: 'POST',
    body,
    type: ContentType.FormData,
    format: 'json',
  });
};
