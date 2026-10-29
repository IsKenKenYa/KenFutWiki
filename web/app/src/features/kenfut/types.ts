export type ContentChannel = 'docs' | 'article' | 'both';

export type LinkTarget = {
  type: 'node' | 'site' | 'product' | 'url';
  node_id?: string;
  page?: 'home' | 'docs' | 'blog';
  product_id?: string;
  page_key?: string;
  url?: string;
  params?: Record<string, string>;
};

export type ContentCTA = {
  id: string;
  label: string;
  target: LinkTarget;
  style: 'primary' | 'secondary';
  new_tab: boolean;
  resolved_url?: string;
};

export type PublishedContent = {
  id: string;
  node_id: string;
  kb_id: string;
  node_release_id: string;
  channel: ContentChannel;
  slug: string;
  title: string;
  summary: string;
  content?: string;
  content_type: string;
  cover_url: string;
  author_name: string;
  author_avatar: string;
  display_date: string;
  created_at: string;
  updated_at: string;
  category: string;
  tags: string[];
  featured: boolean;
  featured_order: number;
  related_node_ids: string[];
  ctas: ContentCTA[];
  url: string;
  canonical_url: string;
  pv: number;
  related?: PublishedContent[];
};

export type ContentList = {
  items: PublishedContent[];
  total: number;
  page: number;
  page_size: number;
  release_id?: string;
};

export type PageTarget = {
  id: string;
  title: string;
  url: string;
  type: 'node' | 'site' | 'product';
  target: LinkTarget;
};

export type ContentQuery = {
  q?: string;
  channel?: 'all' | 'docs' | 'article';
  category?: string;
  tag?: string;
  featured?: boolean;
  page?: number;
  page_size?: number;
};
