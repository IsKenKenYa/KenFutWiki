import test from 'node:test';
import assert from 'node:assert/strict';
import { KenFutClient } from './client.mjs';

test('server delivery retries preserve event identity and credential scope', async () => {
  const requests = [];
  const client = new KenFutClient({ baseURL: 'https://wiki.example.test/', token: 'reference-server-only', fetch: async (url, request) => {
    requests.push({ url, ...request });
    return new Response(JSON.stringify(requests.length === 1 ? { success: false } : { success: true, data: { accepted: true } }), { status: requests.length === 1 ? 503 : 200 });
  } });
  const event = client.createEvent('registered', 'opaque-subject', 'reference-click');
  assert.deepEqual(await client.sendEvent(event), { accepted: true });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].body, requests[1].body);
  assert.equal(requests[0].headers.Authorization, 'Bearer reference-server-only');
  assert.equal(requests[0].url, 'https://wiki.example.test/integration/kenfut/v1/events');
});

test('invalid credentials and conflicting events are not retried', async () => {
  for (const status of [401, 403, 409]) {
    let calls = 0;
    const client = new KenFutClient({ baseURL: 'https://wiki.example.test', token: 'invalid', fetch: async () => {
      calls++;
      return new Response(JSON.stringify({ success: false, message: 'rejected' }), { status });
    } });
    await assert.rejects(client.sendEvent(client.createEvent('first_generation_success', 'opaque-subject')), error => error.status === status);
    assert.equal(calls, 1);
  }
});

test('opt-in isolated reference API accepts durable retries and returns product metrics', {
  skip: !process.env.KENFUT_REFERENCE_URL || !process.env.KENFUT_REFERENCE_TOKEN,
}, async () => {
  const client = new KenFutClient({ baseURL: process.env.KENFUT_REFERENCE_URL, token: process.env.KENFUT_REFERENCE_TOKEN });
  const before = await client.funnel();
  const subject = `reference-${crypto.randomUUID()}`;
  const registration = client.createEvent('registered', subject);
  await client.sendEvent(registration);
  await client.sendEvent(registration);
  await client.sendEvent(client.createEvent('first_generation_success', subject));
  const after = await client.funnel();
  assert.equal(after.unattributed_registrations, before.unattributed_registrations + 1);
  assert.equal(after.unattributed_first_generations, before.unattributed_first_generations + 1);
  assert.equal(after.registrations, before.registrations);
  assert.equal(after.first_generations, before.first_generations);
});
