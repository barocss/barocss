import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createAppServer } from './serve.mjs';
import { requestScreen, REQUEST_CONTRACT } from './scenario.mjs';
const body = { screenRequest: '한국어 이름과 주제 폼을 만들어 주세요', input: { draft: { name: '민지', topic: '커피' } } };
const reply = (request) => ({ sessionId: request.sessionId, revision: request.revision, requestId: request.requestId,
  specJson: JSON.stringify(requestScreen(request.target, request.input)) });
async function setup(generate) {
  const app = await createAppServer({ generate, mode: 'injected-test' });
  const { token } = await (await fetch(`${app.url}/api/session`)).json();
  const headers = { origin: app.url, 'content-type': 'application/json', 'x-session-token': token };
  const post = (path, value, extra = {}) => fetch(`${app.url}${path}`, { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(value) });
  return { ...app, post, headers };
}
test('bounded user request and contract retain unchanged lineage through resumed generation', async () => {
  const calls = [];
  const app = await setup((request) => { calls.push(request); return reply(request); });
  try {
    assert.equal((await app.post('/api/start', body)).status, 202); await app.session.settled();
    let state = app.session.snapshot();
    const changed = { draft: { name: 'Alice', topic: '차' } };
    assert.equal((await app.post('/api/input', { sessionId: state.sessionId, revision: state.revision, input: changed })).status, 200);
    assert.equal((await app.post('/api/action', { sessionId: state.sessionId, revision: state.revision, action: 'review' })).status, 202);
    await app.session.settled(); state = app.session.snapshot();
    assert.equal(calls.length, 2);
    assert(calls.every((call) => call.screenRequest === body.screenRequest));
    assert.deepEqual(calls[1].input, changed);
    assert.deepEqual(calls[1].contract, REQUEST_CONTRACT);
    assert.equal(calls[1].sessionId, calls[0].sessionId); assert.equal(calls[1].revision, 1);
    assert.notEqual(calls[0].requestId, calls[1].requestId);
    assert.equal(state.screenRequest, body.screenRequest);
    await app.post('/api/restart', {}); assert.equal(app.session.snapshot().screenRequest, null);
  } finally { await app.close(); }
});
test('invalid body, request text, host, origin, token and command options dispatch zero generations', async () => {
  let calls = 0;
  const app = await setup((request) => { calls++; return reply(request); });
  try {
    for (const value of [{ input: body.input }, { ...body, screenRequest: '' }, { ...body, screenRequest: 'x'.repeat(301) },
      { ...body, screenRequest: {} }, { ...body, executable: '/bin/other' }, { ...body, model: 'other' }, { ...body, path: 'other' }])
      assert.equal((await app.post('/api/start', value)).status, 400);
    for (const extra of [{ origin: 'https://other.example' }, { host: 'localhost:1' }, { 'x-session-token': 'wrong' },
      { 'x-session-token': 'é'.repeat(64) }, { 'sec-fetch-site': 'cross-site' }])
      assert.equal(await new Promise((resolve, reject) => {
        const req = http.request(`${app.url}/api/start`, { method: 'POST', headers: { ...app.headers, ...extra } }, (res) => {
          res.resume(); res.on('end', () => resolve(res.statusCode));
        });
        req.on('error', reject); req.end(JSON.stringify(body));
      }), 403, JSON.stringify(extra));
    assert.equal((await app.post('/api/start', body, { 'content-type': 'text/plain' })).status, 415);
    assert.equal((await app.post('/api/start', { ...body, padding: 'x'.repeat(5000) })).status, 413);
    assert.equal((await fetch(`${app.url}/api/start`, { method: 'POST', headers: app.headers, body: '{' })).status, 400);
    assert.equal((await app.post('/api/cancel', { command: 'other' })).status, 400);
    assert.equal((await app.post('/api/action', { action: 'pay', sessionId: 'other', revision: 0 })).status, 409);
    assert.equal(calls, 0);
    const csp = (await fetch(app.url)).headers.get('content-security-policy');
    assert(!csp.includes('unsafe-inline')); assert.match(csp, /style-src 'self' 'nonce-/);
    assert.equal((await fetch(`${app.url}/../../package.json`)).status, 403);
  } finally { await app.close(); }
  await assert.rejects(createAppServer({ mode: 'codex-cli' }), /Live dispatch is not enabled/);
});
test('split UTF-8 request bytes are decoded only after bounded body assembly', async () => {
  const calls = [];
  const app = await setup((request) => { calls.push(request); return reply(request); });
  try {
    const bytes = Buffer.from(JSON.stringify(body)), split = bytes.indexOf(Buffer.from('한')) + 1;
    const status = await new Promise((resolve, reject) => {
      const req = http.request(`${app.url}/api/start`, { method: 'POST', headers: app.headers }, (res) => {
        res.resume(); res.on('end', () => resolve(res.statusCode));
      });
      req.on('error', reject); req.write(bytes.subarray(0, split)); req.end(bytes.subarray(split));
    });
    assert.equal(status, 202); await app.session.settled();
    assert.equal(calls[0].screenRequest, body.screenRequest);
    assert.deepEqual(calls[0].input, body.input);
  } finally { await app.close(); }
});
