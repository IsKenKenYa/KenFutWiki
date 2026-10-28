export type LinkTarget = {
  type: 'node' | 'site' | 'product' | 'url';
  node_id?: string;
  page?: 'home' | 'docs' | 'blog';
  product_id?: string;
  page_key?: string;
  url?: string;
  params?: Record<string, string>;
};

export type CTA = {
  id: string;
  label: string;
  target: LinkTarget;
  style: 'primary' | 'secondary';
  new_tab: boolean;
};

export type ContentMetadata = {
  node_id: string;
  channel: 'docs' | 'article' | 'both';
  slug: string;
  cover_url: string;
  author_name: string;
  author_avatar: string;
  display_date: string;
  category: string;
  tags: string[];
  featured: boolean;
  featured_order: number;
  related_node_ids: string[];
  ctas: CTA[];
};

export type ProductPage = {
  key: string;
  name: string;
  path: string;
  parameters: string[];
};

export type Product = {
  id: string;
  name: string;
  origin: string;
  enabled: boolean;
  pages: ProductPage[];
};

export type Credential = {
  id: string;
  scopes: string[];
  created_at?: string;
  revoked_at?: string;
};

export type PageOption = {
  id: string;
  title: string;
  url: string;
  type: 'node' | 'site' | 'product';
  target: LinkTarget;
};

export type Capabilities = {
  content: boolean;
  comment_audit: boolean;
  custom_prompts: boolean;
  custom_branding: boolean;
  node_stats: boolean;
  admin_permissions: boolean;
  limits: { max_kb: number; max_node: number; max_admin: number };
  stat_days: number[];
};

export type Prompt = {
  content: string;
  summary_content: string;
  enable_preset: boolean;
  enable_preset_auto_language: boolean;
  enable_preset_general_info: boolean;
  enable_preset_reference: boolean;
};

export type Funnel = {
  conversion_connected: boolean;
  registration_connected: boolean;
  generation_connected: boolean;
  views: number;
  viewers: number;
  clicks: number;
  clickers: number;
  registrations: number;
  registered_visitors: number;
  first_generations: number;
  first_generation_visitors: number;
  unattributed_registrations: number;
  unattributed_first_generations: number;
  items?: Array<Record<string, string | number | boolean>>;
};
