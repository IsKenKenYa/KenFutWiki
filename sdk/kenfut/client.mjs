/** Server-side KenFutWiki integration client. Never bundle the credential in a browser. */
import { randomUUID } from 'node:crypto';

export class KenFutClient {
  constructor({ baseURL, token, fetch: transport = fetch }) {
    this.baseURL = baseURL.replace(/\/$/, '');
    this.token = token;
    this.transport = transport;
  }

  async request(path, { method = 'GET', body } = {}) {
    const response = await this.transport(`${this.baseURL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      const error = new Error(result.message || `KenFutWiki HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return result.data;
  }

  createEvent(eventType, subjectId, clickId, occurredAt = new Date()) {
    return {
      event_id: randomUUID(),
      event_type: eventType,
      subject_id: subjectId,
      occurred_at: occurredAt.toISOString(),
      ...(clickId ? { click_id: clickId } : {}),
    };
  }

  async sendEvent(event, { attempts = 3 } = {}) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        return await this.request('/integration/kenfut/v1/events', { method: 'POST', body: event });
      } catch (error) {
        if ((error.status && error.status < 500 && error.status !== 429) || attempt === attempts - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 250 * 2 ** attempt));
      }
    }
    throw new Error('At least one delivery attempt is required');
  }

  funnel(params = {}) {
    return this.request(`/integration/kenfut/v1/funnel?${new URLSearchParams(params)}`);
  }
}
