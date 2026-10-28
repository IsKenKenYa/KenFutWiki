import assert from 'node:assert/strict';
import test from 'node:test';
import {
  expandMarkdownLink,
  markdownPageLink,
} from '../src/features/kenfut/markdownLink.ts';

test('光标位于已有中文链接时替换整段，保留相邻正文', () => {
  const value = '前言 [教程](/node/old) 结尾';
  const selection = expandMarkdownLink(
    { start: { row: 0, column: 6 }, end: { row: 0, column: 6 }, text: '' },
    value,
  );
  assert.equal(
    value.slice(0, selection.start.column) +
      markdownPageLink(selection.text, '新标题', '/node/new') +
      value.slice(selection.end.column),
    '前言 [教程](/node/new) 结尾',
  );
});
test('普通光标与选区保持原位置', () => {
  const cursor = {
    start: { row: 0, column: 0 },
    end: { row: 0, column: 0 },
    text: '',
  };
  assert.deepEqual(expandMarkdownLink(cursor, '正文 [标题](/node/id)'), cursor);
  assert.equal(
    markdownPageLink('', '产品教程', '/node/id'),
    '[产品教程](/node/id)',
  );
  assert.equal(
    markdownPageLink('选择的文字', '页面标题', '/node/id'),
    '[选择的文字](/node/id)',
  );
});
test('转义链接文字括号与目标地址括号', () => {
  assert.equal(
    markdownPageLink('甲[乙]', '', 'https://example.test/a(b)'),
    '[甲\\[乙\\]](https://example.test/a%28b%29)',
  );
});
test('编辑已转义标题时不重复转义', () => {
  const source = '[甲\\[乙\\]](/node/old)';
  const selection = expandMarkdownLink(
    { start: { row: 0, column: 4 }, end: { row: 0, column: 4 }, text: '' },
    source,
  );
  assert.equal(selection.text, source);
  assert.equal(
    markdownPageLink(selection.text, '忽略', '/node/new'),
    '[甲\\[乙\\]](/node/new)',
  );
});
test('跨行选区不误识别成单行链接', () => {
  const selection = {
    start: { row: 0, column: 0 },
    end: { row: 1, column: 2 },
    text: '跨行\n文本',
  };
  assert.equal(expandMarkdownLink(selection, '[链接](/node/id)'), selection);
});
