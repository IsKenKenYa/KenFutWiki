import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  SIDEBAR_GUTTER,
  SIDEBAR_OFFSET,
  SIDEBAR_WIDTH,
} from '../src/constant/layout.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const en = JSON.parse(read('src/locales/en.json'));
const zh = JSON.parse(read('src/locales/zh.json'));

// 14px 字号下保守的字宽估算：大写字母比小写宽，中文按 14px 计。
const estimateTextWidth = text =>
  [...text].reduce((width, char) => {
    if (/[\u4e00-\u9fff]/.test(char)) return width + 14;
    if (/[A-Z]/.test(char)) return width + 9;
    if (/[a-z]/.test(char)) return width + 7.5;
    return width + 4;
  }, 0);

// 导航按钮：左右内边距各 16px + 图标 14px + 图标右间距 8px + 4px 余量。
const NAV_CHROME_WIDTH = 16 * 2 + 14 + 8 + 4;
// 底部工具按钮：左右内边距各 12px + 图标 14px + 图标间距 3px + 8px 余量。
const FOOTER_CHROME_WIDTH = 12 * 2 + 14 + 3 + 8;

const labelWidth = resources => {
  const labels = Object.values(resources.layout.nav);
  return Math.max(...labels.map(estimateTextWidth));
};

test('侧边栏宽度能容纳当前所有语言的导航文案', () => {
  const required = Math.max(labelWidth(en), labelWidth(zh)) + NAV_CHROME_WIDTH;
  assert.ok(
    SIDEBAR_WIDTH >= required,
    `侧边栏宽度 ${SIDEBAR_WIDTH}px 不足以容纳最长导航文案（至少 ${Math.ceil(required)}px）`,
  );
});

test('侧边栏宽度能容纳底部工具按钮文案', () => {
  const labels = [en.layout.helpDocs, en.layout.onlineSupport, 'GitHub'];
  const required =
    Math.max(...labels.map(estimateTextWidth)) + FOOTER_CHROME_WIDTH;
  assert.ok(
    SIDEBAR_WIDTH >= required,
    `侧边栏宽度 ${SIDEBAR_WIDTH}px 不足以容纳底部按钮（至少 ${Math.ceil(required)}px）`,
  );
});

test('侧边栏偏移量由宽度与外边距推导', () => {
  assert.equal(SIDEBAR_OFFSET, SIDEBAR_WIDTH + SIDEBAR_GUTTER);
  assert.ok(SIDEBAR_OFFSET > SIDEBAR_WIDTH);
});

test('侧边栏与内容区使用共享布局常量', () => {
  const sidebar = read('src/components/Sidebar/index.tsx');
  const header = read('src/components/Header/index.tsx');
  const layout = read('src/layouts/index.tsx');
  assert.match(sidebar, /width:\s*SIDEBAR_WIDTH/);
  assert.match(header, /pl:\s*`\$\{SIDEBAR_OFFSET\}px`/);
  assert.match(layout, /ml:\s*`\$\{SIDEBAR_OFFSET\}px`/);
  assert.doesNotMatch(`${sidebar}${header}${layout}`, /\b138\b|\b170px\b/);
});
