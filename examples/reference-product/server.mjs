import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { KenFutClient } from '../../sdk/kenfut/client.mjs';

const port = Number(process.env.PORT || 4180);
const client = new KenFutClient({
  baseURL: process.env.KENFUT_BASE_URL || 'http://127.0.0.1:8000',
  token: process.env.KENFUT_PRODUCT_TOKEN || '',
});
const sessions = new Map();
const pendingEvents = new Map();

async function deliver(event) {
  pendingEvents.set(event.event_id, event);
  try {
    await client.sendEvent(event);
    pendingEvents.delete(event.event_id);
  } catch (error) {
    console.error(`Conversion delivery pending (${error.status || 'network'}); credential is not logged.`);
  }
}

const server = createServer(async (req, res) => {
  const address = new URL(req.url, `http://127.0.0.1:${port}`);
  const cookie = req.headers.cookie?.match(/(?:^|;\s*)reference_session=([^;]+)/)?.[1];
  const id = cookie && sessions.has(cookie) ? cookie : randomUUID();
  const session = sessions.get(id) || {};
  const clickId = address.searchParams.get('kf_click_id');
  if (clickId && /^[\da-f-]{36}$/i.test(clickId) && !session.subjectId) session.clickId = clickId;
  sessions.set(id, session);
  res.setHeader('Set-Cookie', `reference_session=${id}; HttpOnly; SameSite=Lax; Path=/`);
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'POST' && address.pathname === '/register' && !session.subjectId) {
    session.subjectId = randomUUID();
    session.registration = client.createEvent('registered', session.subjectId, session.clickId);
    await deliver(session.registration);
  } else if (req.method === 'POST' && address.pathname === '/generate' && session.subjectId && !session.generated) {
    // This local deterministic result stands in for a successful business task; no paid model is called.
    session.generated = `Reference result ${randomUUID()}`;
    session.generation = client.createEvent('first_generation_success', session.subjectId, session.clickId);
    await deliver(session.generation);
  } else if (req.method === 'POST' && address.pathname === '/retry') {
    for (const event of [...pendingEvents.values()]) await deliver(event);
  } else if (req.method === 'GET' && address.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  } else if (address.pathname !== '/') {
    res.writeHead(303, { Location: '/' }); res.end(); return;
  }

  if (req.method === 'POST') {
    res.writeHead(303, { Location: '/' }); res.end(); return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>KenFutWiki 参考产品</title>
  <style>body{font:18px system-ui;max-width:720px;margin:70px auto;padding:24px;color:#17243b}button{padding:12px 24px;margin:10px 0;cursor:pointer}small{color:#68758a}</style>
  <h1>通用参考产品</h1><p>本示例验证落地、注册及首次成功任务回传。</p>
  <p>归因标识：${session.clickId ? '已接收' : '未携带（将记录为未归因）'}</p>
  <form method="post" action="/register"><button ${session.subjectId ? 'disabled' : ''}>${session.subjectId ? '已注册' : '创建参考账号'}</button></form>
  <form method="post" action="/generate"><button ${!session.subjectId || session.generated ? 'disabled' : ''}>${session.generated ? '已完成首次任务' : '完成一次参考任务'}</button></form>
  <p>${session.generated || ''}</p><form method="post" action="/retry"><button>重试待回传事件</button></form>
  <small>内存状态仅供本地协议验收；生产接入应在业务事务及持久任务队列中保存事件。</small></html>`);
});
server.listen(port, '127.0.0.1', () => console.log(`Reference product: http://127.0.0.1:${port}`));
