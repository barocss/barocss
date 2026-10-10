import http from 'node:http';
import fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createCompiledResponse } from '@barocss/render-stream/fetch';
import { encodeRecord } from '@barocss/render-stream/protocol';

const contract = { textBindings: ['/name'], actions: ['save'] };
const appJs = fileURLToPath(new URL('./.build/app.js', import.meta.url));
const noStore = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };

export function* authoredRecords(identity, { dark = false } = {}) {
  let seq = 0;
  const record = (type, fields = {}) => ({ version: 1, ...identity, seq: ++seq, type, ...fields });
  const node = (id, type, props, children = [], on) => record('node', { id,
    node: { type, props: { id, ...props }, children, ...(on ? { on } : {}) } });
  yield record('root', { id: 'root' });
  yield node('root', 'Layout', { columns: 'single', gap: 'fractional' }, ['card']);
  yield node('card', 'Card', { padding: 'spacious', tone: dark ? 'dark' : 'light' }, ['title']);
  yield node('title', 'Text', { text: 'Prepared application' });
  yield record('checkpoint');
  yield node('card', 'Card', { padding: 'spacious', tone: dark ? 'dark' : 'light' }, ['title', 'name', 'save']);
  yield node('name', 'Input', { label: 'Name', value: { $bindState: '/name' } });
  yield node('save', 'Button', { label: 'Save' }, [], { press: { action: 'save' } });
  yield record('checkpoint');
  yield record('commit');
}

export async function createHost() {
  const token = randomBytes(24).toString('hex');
  const runs = [], saves = [], gates = new Map();
  let revision = 0, accepted = null;
  const server = http.createServer(async (req, res) => {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const send = (status, type, body) => { res.writeHead(status, { ...noStore, 'content-type': type }); res.end(body); };
    const json = (status, value) => send(status, 'application/json', JSON.stringify(value));
    if (req.method === 'GET' && req.url === '/') return send(200, 'text/html; charset=utf-8',
      '<!doctype html><html><head><meta charset="utf-8"><title>Render stream package</title></head><body><main><h1>Application</h1><p id="phase">idle</p><div id="view"></div><p id="saved"></p></main><script src="/app.js"></script></body></html>');
    if (req.method === 'GET' && req.url === '/app.js') return send(200, 'text/javascript', await fs.readFile(appJs));
    if (req.method === 'GET' && req.url === '/session') return json(200, { token, contract });
    if (req.method !== 'POST' || !req.url?.startsWith('/stream') && req.url !== '/save') return json(404, { error: 'Not found' });
    if (req.headers.origin !== origin || req.headers['x-session-token'] !== token) return json(403, { error: 'Invalid session' });
    if (req.url === '/save') {
      let body;
      try { body = JSON.parse(await readBody(req)); } catch { return json(400, { error: 'Invalid body' }); }
      if (!accepted || accepted.used || body.streamId !== accepted.streamId || body.revision !== accepted.revision
        || typeof body.name !== 'string' || !body.name || body.name.length > 80) return json(409, { error: 'Save unavailable' });
      accepted.used = true; saves.push({ ...body }); return json(200, { saved: body.name });
    }
    const url = new URL(req.url, origin);
    if (url.pathname !== '/stream' || !['ok', 'cancel', 'invalid-tail'].includes(url.searchParams.get('case')))
      return json(400, { error: 'Invalid case' });
    const kind = url.searchParams.get('case');
    const identity = { streamId: `authored-${++revision}`, revision };
    const run = { ...identity, kind, sourceRecords: 0, sourceComplete: false, accepted: false, aborted: false };
    runs.push(run);
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    gates.set(identity.streamId, release);
    const abort = new AbortController();
    res.on('close', () => { if (!res.writableFinished) abort.abort(); });
    const response = createCompiledResponse({ identity, contract, signal: abort.signal,
      source: async function* (signal) {
        for (const record of authoredRecords(identity, { dark: kind !== 'ok' })) {
          if (signal.aborted) return;
          run.sourceRecords++;
          yield encodeRecord(record);
          if (record.seq === 5) await Promise.race([gate, aborted(signal)]);
        }
        if (kind === 'invalid-tail') yield new TextEncoder().encode('bad-tail\n');
      },
      acceptFinal(_record, signal) {
        if (signal.aborted || revision !== identity.revision) return false;
        run.sourceComplete = true; run.accepted = true;
        accepted = { ...identity, used: false };
      },
    });
    res.writeHead(200, { ...noStore, ...Object.fromEntries(response.headers) });
    try {
      for await (const chunk of response.body) {
        if (!res.write(chunk)) await new Promise((resolve) => res.once('drain', resolve));
      }
      res.end();
    } catch { res.destroy(); }
    finally { run.aborted = abort.signal.aborted; gates.delete(identity.streamId); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, runs, saves, release(id) { gates.get(id)?.(); },
    async close() { for (const release of gates.values()) release(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); } };
}

async function readBody(req) {
  let text = '';
  for await (const chunk of req) { text += chunk; if (text.length > 4096) throw new Error('Body limit'); }
  return text;
}
function aborted(signal) {
  return new Promise((resolve) => { if (signal.aborted) resolve(); else signal.addEventListener('abort', resolve, { once: true }); });
}
