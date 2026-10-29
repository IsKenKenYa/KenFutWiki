import type { LinkTarget, PageTarget, PublishedContent } from './types';

export type PageSearchParams = Record<string, string | string[] | undefined>;

export const hasNavigation = (
  buttons: { url?: string }[] | undefined,
  page: '/node' | '/blog',
  basePath: string,
  siteURL = '',
) =>
  (buttons || []).some(button => {
    if (!button.url) return false;
    try {
      const url = new URL(button.url, 'https://kenfut.invalid');
      if (
        /^https?:\/\//i.test(button.url) &&
        url.origin !== new URL(siteURL || '/', 'https://kenfut.invalid').origin
      )
        return false;
      const path = url.pathname.replace(/\/$/, '');
      return !url.search && (path === page || path === `${basePath}${page}`);
    } catch {
      return false;
    }
  });

export const localHref = (basePath: string, path: string) => {
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('//')) return `${basePath}/`;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (
    basePath &&
    (normalized === basePath || normalized.startsWith(`${basePath}/`))
  ) {
    return normalized;
  }
  return `${basePath}${normalized}` || '/';
};

export const withSearchParams = (href: string, params: PageSearchParams) => {
  const url = new URL(href, 'https://kenfut.invalid');
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined) return;
    url.searchParams.delete(key);
    for (const item of Array.isArray(value) ? value : [value]) {
      url.searchParams.append(key, item);
    }
  });
  return url.origin === 'https://kenfut.invalid'
    ? `${url.pathname}${url.search}${url.hash}`
    : url.toString();
};

export const contentHref = (content: PublishedContent, basePath: string) =>
  localHref(
    basePath,
    content.canonical_url ||
      content.url ||
      `/node/${content.node_id || content.id}`,
  );

export const resolveTarget = (
  target: LinkTarget,
  basePath: string,
  pages: PageTarget[],
  verifiedURL?: string,
) => {
  let href = '';
  if (verifiedURL !== undefined) {
    href = verifiedURL;
  } else if (target.type === 'node' && target.node_id) {
    href = localHref(basePath, `/node/${encodeURIComponent(target.node_id)}`);
  } else if (target.type === 'site') {
    href = localHref(
      basePath,
      target.page === 'blog' ? '/blog' : target.page === 'docs' ? '/node' : '/',
    );
  } else if (target.type === 'product') {
    href =
      pages.find(
        page =>
          page.target.type === 'product' &&
          page.target.product_id === target.product_id &&
          page.target.page_key === target.page_key,
      )?.url || '';
  } else if (target.type === 'url' && target.url) {
    href = target.url;
  }
  if (!href || href.startsWith('//')) return '';
  try {
    const url = new URL(href, 'https://kenfut.invalid');
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return '';
    if (verifiedURL === undefined) {
      Object.entries(target.params || {}).forEach(([key, value]) => {
        if (key !== 'kf_click_id') url.searchParams.set(key, value);
      });
    }
    return url.origin === 'https://kenfut.invalid'
      ? `${url.pathname}${url.search}${url.hash}`
      : url.toString();
  } catch {
    return '';
  }
};
