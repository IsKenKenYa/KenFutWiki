import test from 'node:test';
import assert from 'node:assert/strict';

import { isSearchShortcut } from './keyboard.ts';

test('Cmd/Ctrl+K 触发搜索快捷键', () => {
  assert.equal(
    isSearchShortcut({ key: 'k', metaKey: true, ctrlKey: false }),
    true,
  );
  assert.equal(
    isSearchShortcut({ key: 'k', metaKey: false, ctrlKey: true }),
    true,
  );
  assert.equal(
    isSearchShortcut({ key: 'K', metaKey: true, ctrlKey: true }),
    true,
  );
});

test('无修饰键或其他按键不触发', () => {
  assert.equal(
    isSearchShortcut({ key: 'k', metaKey: false, ctrlKey: false }),
    false,
  );
  assert.equal(
    isSearchShortcut({ key: 'a', metaKey: true, ctrlKey: false }),
    false,
  );
  assert.equal(
    isSearchShortcut({ key: 'Escape', metaKey: false, ctrlKey: false }),
    false,
  );
});
