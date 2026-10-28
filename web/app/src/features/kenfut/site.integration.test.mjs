import assert from 'node:assert/strict';
import test from 'node:test';

// Run against the explicit, disposable PostgreSQL browser harness and Next server.
// These are HTTP/SSR checks, not browser hydration or production dependency acceptance.
const site = process.env.KENFUT_SITE_TEST_URL?.replace(/\/$/, '');
const options = { skip: !site };
const docsId = '11111111-1111-4111-8111-111111111111';
const bothId = '22222222-2222-4222-8222-222222222222';
const articleId = '33333333-3333-4333-8333-333333333333';

async function query(path) {
  const response = await fetch(`${site}${path}`);
  assert.equal(response.status, 200);
  const envelope = await response.json();
  assert.equal(envelope.success, true);
  return envelope.data;
}

test(
  'real published keyword search respects channels and deduplicates shared content',
  options,
  async () => {
    const all = await query(
      '/share/kenfut/v1/contents?channel=all&q=%E6%A8%A1%E5%9E%8B',
    );
    const docs = await query(
      '/share/kenfut/v1/contents?channel=docs&q=%E6%A8%A1%E5%9E%8B',
    );
    const articles = await query(
      '/share/kenfut/v1/contents?channel=article&q=%E6%A8%A1%E5%9E%8B',
    );
    assert.deepEqual(
      new Set(all.items.map(item => item.id)),
      new Set([docsId, bothId, articleId]),
    );
    assert.equal(all.items.length, 3);
    assert.deepEqual(
      new Set(docs.items.map(item => item.id)),
      new Set([docsId, bothId]),
    );
    assert.deepEqual(
      new Set(articles.items.map(item => item.id)),
      new Set([bothId, articleId]),
    );
  },
);

test(
  'article SSR carries canonical, article metadata and the source/license entry',
  options,
  async () => {
    const response = await fetch(`${site}/blog/model-guide`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /rel="canonical"[^>]*href="[^"]*\/blog\/model-guide"/);
    assert.match(html, /"@type":"Article"/);
    assert.match(html, /AGPL-3.0/);
    assert.match(html, /本版本对应源码/);
  },
);

test(
  'article-only legacy ID redirects to the readable canonical URL',
  options,
  async () => {
    const response = await fetch(`${site}/node/${articleId}`, {
      redirect: 'manual',
    });
    assert.equal(response.status, 308);
    assert.equal(
      response.headers.get('location'),
      `${site}/blog/release-notes`,
    );
  },
);

test(
  'both entry points publish the same canonical without redirecting the document view',
  options,
  async () => {
    const response = await fetch(`${site}/node/${bothId}`, {
      redirect: 'manual',
    });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /rel="canonical"[^>]*href="[^"]*\/blog\/model-guide"/);
  },
);

test(
  'the logo uses the bundled asset prefix and is actually served under a Wiki subpath',
  options,
  async () => {
    const response = await fetch(`${site}/blog/model-guide`);
    assert.equal(response.status, 200);
    const html = await response.text();
    const asset = html.match(
      /<img[^>]+src="([^"]*\/_next\/static\/media\/logo[^"]+)"/,
    );
    assert.ok(
      asset,
      'the configured fixture should render the bundled fallback logo',
    );
    assert.ok(asset[1].startsWith('/panda-wiki-app-assets/'));
    const image = await fetch(new URL(asset[1], site));
    assert.equal(image.status, 200);
    assert.match(image.headers.get('content-type'), /^image\//);
    assert.ok((await image.arrayBuffer()).byteLength > 0);
  },
);
