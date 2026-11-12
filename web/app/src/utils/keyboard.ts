// 判定是否为全站搜索快捷键（Cmd/Ctrl+K），与主流文档站一致
export const isSearchShortcut = (event: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
}) => event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey);
