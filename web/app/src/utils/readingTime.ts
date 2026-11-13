// 预计阅读时长：中文约 400 字/分钟，拉丁文约 200 词/分钟，混合按两部分之和取整
export const estimateReadingMinutes = (text: string): number => {
  if (!text) return 0;
  const cjkChars = (
    text.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []
  ).length;
  const latinWords = text
    .replace(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, ' ')
    .split(/\s+/)
    // 只统计含字母或数字的 token，纯标点不算词
    .filter(token => /[\p{L}\p{N}]/u.test(token)).length;
  if (!cjkChars && !latinWords) return 0;
  return Math.max(1, Math.ceil(cjkChars / 400 + latinWords / 200));
};
