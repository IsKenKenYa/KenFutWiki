export type ConversionEvent = {
  event_id: string;
  event_type: 'registered' | 'first_generation_success';
  subject_id: string;
  occurred_at: string;
  click_id?: string;
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
  first_generations: number;
  registered_visitors: number;
  first_generation_visitors: number;
  unattributed_registrations: number;
  unattributed_first_generations: number;
  items: Array<{
    node_id: string;
    views: number;
    clicks: number;
    registrations: number;
    first_generations: number;
  }>;
};

/** Server-only credential; do not bundle this client in a browser. */
export class KenFutClient {
  constructor(options: { baseURL: string; token: string; fetch?: typeof globalThis.fetch });
  request<T = unknown>(path: string, options?: { method?: string; body?: unknown }): Promise<T>;
  createEvent(type: ConversionEvent['event_type'], subjectId: string, clickId?: string, occurredAt?: Date): ConversionEvent;
  sendEvent(event: ConversionEvent, options?: { attempts?: number }): Promise<{ accepted: boolean }>;
  funnel(params?: { from?: string; to?: string; node_id?: string; cta_id?: string }): Promise<Funnel>;
}
