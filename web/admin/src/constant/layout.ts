/**
 * 侧边栏宽度（含 16px 内边距）。
 * 需要覆盖英文等较长语种的最长导航文案，避免国际化切换后被裁切。
 */
export const SIDEBAR_WIDTH = 208;

/** 侧边栏左右外边距合计。 */
export const SIDEBAR_GUTTER = 32;

/** 主内容区相对视口左侧的偏移量（侧边栏宽度 + 外边距）。 */
export const SIDEBAR_OFFSET = SIDEBAR_WIDTH + SIDEBAR_GUTTER;
