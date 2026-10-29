import { getImagePath } from '../../utils/getImagePath.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  contentHref,
  hasNavigation,
  localHref,
  resolveTarget,
  withSearchParams,
} from './links.ts';

test('canonical content links preserve the configured deployment prefix exactly once', () => {
  assert.equal(localHref('/wiki', '/blog/update'), '/wiki/blog/update');
  assert.equal(localHref('/wiki', '/wiki/blog/update'), '/wiki/blog/update');
  assert.equal(
    contentHref({ canonical_url: '/blog/update' }, '/wiki'),
    '/wiki/blog/update',
  );
  assert.equal(
    contentHref({ id: 'stable-id' }, '/wiki'),
    '/wiki/node/stable-id',
  );
});

test('stable node targets survive article slug changes and encode the identity', () => {
  assert.equal(
    resolveTarget({ type: 'node', node_id: 'stable-id' }, '/wiki', []),
    '/wiki/node/stable-id',
  );
  assert.equal(
    resolveTarget({ type: 'node', node_id: 'id/part' }, '', []),
    '/node/id%2Fpart',
  );
});

test('canonical redirects preserve repeated and Chinese parameters under a deployment prefix', () => {
  const href = withSearchParams(localHref('/wiki', '/blog/current'), {
    source: '文章 & 推荐',
    tag: ['教程', '模型'],
    empty: '',
    absent: undefined,
  });
  const url = new URL(href, 'https://docs.example');
  assert.equal(url.pathname, '/wiki/blog/current');
  assert.equal(url.searchParams.get('source'), '文章 & 推荐');
  assert.deepEqual(url.searchParams.getAll('tag'), ['教程', '模型']);
  assert.equal(url.searchParams.get('empty'), '');
  assert.equal(url.searchParams.has('absent'), false);
});

test('canonical redirects retain existing query and hash while replacing matching query values', () => {
  const href = withSearchParams('/blog/current?existing=1&tag=old#details', {
    tag: ['first', 'second'],
    template: '中文',
  });
  const url = new URL(href, 'https://docs.example');
  assert.equal(url.searchParams.get('existing'), '1');
  assert.deepEqual(url.searchParams.getAll('tag'), ['first', 'second']);
  assert.equal(url.searchParams.get('template'), '中文');
  assert.equal(url.hash, '#details');
  assert.equal(withSearchParams('/blog/current', {}), '/blog/current');
});

test('registered product page targets preserve existing query/hash and encode parameters', () => {
  const pages = [
    {
      target: { type: 'product', product_id: 'demo', page_key: 'canvas' },
      url: 'https://product.example/canvas?existing=1#tools',
    },
  ];
  const result = resolveTarget(
    {
      type: 'product',
      product_id: 'demo',
      page_key: 'canvas',
      params: { template: '示例 & 测试', kf_click_id: 'forged' },
    },
    '/wiki',
    pages,
  );
  const url = new URL(result);
  assert.equal(url.searchParams.get('existing'), '1');
  assert.equal(url.searchParams.get('template'), '示例 & 测试');
  assert.equal(url.searchParams.has('kf_click_id'), false);
  assert.equal(url.hash, '#tools');
  assert.equal(
    resolveTarget(
      { type: 'product', product_id: 'other', page_key: 'canvas' },
      '',
      pages,
    ),
    '',
  );
});

test('CTA fallbacks use only the server-verified URL without appending stale target parameters', () => {
  const target = {
    type: 'product',
    product_id: 'demo',
    page_key: 'canvas',
    params: { removed: 'stale', template: 'untrusted' },
  };
  const href = resolveTarget(
    target,
    '/wiki',
    [],
    'https://product.example/canvas?template=approved#tools',
  );
  const url = new URL(href);
  assert.equal(url.searchParams.get('template'), 'approved');
  assert.equal(url.searchParams.has('removed'), false);
  assert.equal(url.hash, '#tools');
  assert.equal(resolveTarget(target, '/wiki', [], ''), '');
  assert.equal(
    resolveTarget(
      { type: 'node', node_id: 'stale', params: { removed: 'stale' } },
      '/wiki',
      [],
      '/wiki/blog/current?source=approved',
    ),
    '/wiki/blog/current?source=approved',
  );
});

test('an invalid verified CTA fallback never falls back to its raw target', () => {
  for (const href of [
    '',
    'javascript:alert(1)',
    'data:text/html,unsafe',
    '//outside.example',
    'https://user:secret@example.com',
  ]) {
    assert.equal(
      resolveTarget(
        { type: 'url', url: 'https://raw.example/canvas' },
        '',
        [],
        href,
      ),
      '',
    );
  }
});

test('unsafe and credential-bearing fallback URLs are never rendered as actions', () => {
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,unsafe',
    '//outside.example',
    'https://user:secret@example.com',
  ]) {
    assert.equal(resolveTarget({ type: 'url', url }, '', []), '');
  }
  assert.equal(localHref('/wiki', '//outside.example'), '/wiki/');
});

test('configured channel navigation is not duplicated and foreign blogs do not hide the local channel', () => {
  assert.equal(hasNavigation([{ url: '/blog' }], '/blog', '/wiki'), true);
  assert.equal(
    hasNavigation(
      [{ url: 'https://docs.example/wiki/blog' }],
      '/blog',
      '/wiki',
      'https://docs.example/wiki',
    ),
    true,
  );
  assert.equal(
    hasNavigation([{ url: 'https://outside.example/blog' }], '/blog', ''),
    false,
  );
  assert.equal(hasNavigation([{ url: '/blog?tag=API' }], '/blog', ''), false);
});

test('bundled Next assets keep their assetPrefix while uploaded images inherit the Wiki path', () => {
  assert.equal(
    getImagePath('/panda-wiki-app-assets/_next/static/media/logo.png', '/wiki'),
    '/panda-wiki-app-assets/_next/static/media/logo.png',
  );
  assert.equal(
    getImagePath('/_next/static/media/icon.png', '/wiki'),
    '/_next/static/media/icon.png',
  );
  assert.equal(
    getImagePath('/static-file/cover.png', '/wiki'),
    '/wiki/static-file/cover.png',
  );
  assert.equal(
    getImagePath('/wiki/static-file/cover.png', '/wiki'),
    '/wiki/static-file/cover.png',
  );
});
