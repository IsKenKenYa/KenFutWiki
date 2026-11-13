import test from 'node:test';
import assert from 'node:assert/strict';

import { estimateReadingMinutes } from './readingTime.ts';

test('中文按 400 字/分钟估算并向上取整', () => {
  // 800 个汉字 → 2 分钟
  const text = '文'.repeat(800);
  assert.equal(estimateReadingMinutes(text), 2);
  // 401 个汉字 → 2 分钟
  assert.equal(estimateReadingMinutes('文'.repeat(401)), 2);
  // 300 个汉字 → 1 分钟
  assert.equal(estimateReadingMinutes('文'.repeat(300)), 1);
});

test('拉丁文按 200 词/分钟估算', () => {
  const text = Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ');
  assert.equal(estimateReadingMinutes(text), 1);
});

test('混合文本两部分求和', () => {
  // 400 个汉字（1 分钟）+ 200 个拉丁词（1 分钟）→ 2 分钟
  const text =
    '文'.repeat(400) +
    ' ' +
    Array.from({ length: 200 }, (_, i) => `w${i}`).join(' ');
  assert.equal(estimateReadingMinutes(text), 2);
});

test('空文本与纯符号返回 0', () => {
  assert.equal(estimateReadingMinutes(''), 0);
  assert.equal(estimateReadingMinutes('   '), 0);
  assert.equal(estimateReadingMinutes('！？。、'), 0);
});
