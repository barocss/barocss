import http from 'node:http';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { createCompiler } from './compiler.mjs';
import { createJsonlDecoder } from './protocol.mjs';

const deps = createRequire(new URL('../../package.json', import.meta.url));
const { build } = deps('esbuild');
const encoder = new TextEncoder();
export const contract = Object.freeze({ textBindings: Object.freeze(['/name']), actions: Object.freeze(['save']) });
export function* authoredRecords(identity, { tone = 'light', broken = false } = {}) {
  let seq = 0;
  const record = (type, fields = {}) => ({ version: 1, ...identity, seq: ++seq, type, ...fields });
  const node = (id, type, props, children = [], on) => record('node', { id, node: {
    type, props: { id, ...props }, children, ...(on ? { on } : {}),
  } });
  // Construct later records only when the consumer advances this source iterator.
  yield record('root', { id: 'root' });
  yield node('root', 'Layout', { columns: 'single', gap: 'fractional' }, ['card']);
  yield node('card', 'Card', { padding: 'spacious', tone }, ['title']);
  yield node('title', 'Text', { text: '서버에서 준비한 신청 화면' });
  yield record('checkpoint');
  yield node('card', 'Card', { padding: 'spacious', tone }, ['title', 'name', 'save']);
  yield node('name', 'Input', { label: '이름', value: { $bindState: '/name' } });
  yield node('save', 'Button', { label: '저장' }, [], { press: { action: broken ? 'undeclared' : 'save' } });
  yield record('checkpoint'); yield record('commit');
}
export async function createResearchServer({ port = 0, checkpointGate = async () => {}, finalGate = async () => {},
  compiledResponse = null } = {}) {
  const bundle = (await build({ entryPoints: [fileURLToPath(new URL('browser.jsx', import.meta.url))],
    bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', logLevel: 'error',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'installed-peers', setup(plugin) {
      plugin.onResolve({ filter: /^react(?:-dom)?(?:\/.*)?$/ }, (args) => ({ path: deps.resolve(args.path) }));
    } }],
  })).outputFiles[0].contents;
  const nonce = randomBytes(24).toString('base64'), token = randomBytes(24).toString('hex');
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="nonce" content="${nonce}"><title>Server compiled view research</title><link rel="stylesheet" href="/base.css"></head><body><div id="app"></div><script src="/app.js"></script></body></html>`;
  const records = [], saves = [], active = new Set();
  let revision = 0, accepted = null;
  const server = http.createServer(async (req, res) => {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
      'content-security-policy': `default-src 'none'; script-src 'self'; style-src 'self' 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'` };
    const send = (status, type, body) => { res.writeHead(status, { ...headers, 'content-type': type }); res.end(body); };
    const json = (status, value) => send(status, 'application/json', JSON.stringify(value));
    if (req.headers.host !== new URL(origin).host || (req.headers.origin && req.headers.origin !== origin)
      || req.headers['sec-fetch-site'] === 'cross-site') return json(403, { error: 'Invalid origin' });
    if (req.method === 'GET' && req.url === '/') return send(200, 'text/html; charset=utf-8', html);
    if (req.method === 'GET' && req.url === '/app.js') return send(200, 'text/javascript', bundle);
    if (req.method === 'GET' && req.url === '/base.css') return send(200, 'text/css', 'body{font:16px system-ui;margin:2rem}*{box-sizing:border-box}label{display:block}input,button{font:inherit}header{display:flex;gap:1rem;margin-bottom:1rem}');
    if (req.method === 'GET' && req.url === '/session') return json(200, { token, contract });
    if (req.method !== 'POST' || !['/stream', '/action'].includes(req.url)) return json(404, { error: 'Not found' });
    const value = req.headers['x-session-token'];
    const receivedToken = typeof value === 'string' ? Buffer.from(value) : null;
    const expectedToken = Buffer.from(token);
    if (req.headers.origin !== origin || !receivedToken || receivedToken.length !== expectedToken.length
      || !timingSafeEqual(receivedToken, expectedToken)) return json(403, { error: 'Invalid session' });
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? '')) return json(415, { error: 'JSON required' });
    let body;
    try {
      let size = 0; const chunks = [];
      for await (const chunk of req) { size += chunk.length; if (size > 4096) return json(413, { error: 'Body too large' }); chunks.push(chunk); }
      body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
    } catch { return json(400, { error: 'Invalid body' }); }
    if (req.url === '/action') {
      if (!body || Object.keys(body).sort().join(',') !== 'name,revision,streamId'
        || !accepted || accepted.used || body.streamId !== accepted.streamId || body.revision !== accepted.revision
        || typeof body.name !== 'string' || body.name.length < 1 || body.name.length > 80) return json(409, { error: 'Action unavailable' });
      accepted.used = true; saves.push({ ...body }); return json(200, { saved: body.name });
    }
    if (!body || Object.keys(body).sort().join(',') !== 'broken,mode,tone'
      || !['stream', 'complete'].includes(body.mode) || !['light', 'dark'].includes(body.tone)
      || typeof body.broken !== 'boolean') return json(400, { error: 'Invalid fixture' });
    const identity = { streamId: randomUUID(), revision: ++revision };
    const abort = new AbortController(); active.add(abort); res.on('close', () => abort.abort());
    const observation = { ...identity, mode: body.mode, sourceComplete: false, sourceRecords: 0,
      snapshots: 0, bytes: 0, cancelled: false, failed: false };
    records.push(observation);
    res.writeHead(200, { ...headers, 'content-type': 'application/x-ndjson', 'x-stream-id': identity.streamId, 'x-revision': String(identity.revision) });
    res.flushHeaders();
    let outputSeq = 0, final;
    const emit = async (candidate, phase) => {
      const record = { version: 1, ...identity, seq: ++outputSeq, type: 'snapshot', sourceSeq: candidate.sourceSeq,
        phase, spec: candidate.spec, css: candidate.css };
      const bytes = encoder.encode(JSON.stringify(record) + '\n');
      observation.snapshots++; observation.bytes += bytes.length;
      if (!res.write(bytes)) await Promise.race([once(res, 'drain'), once(res, 'close')]);
    };
    try {
      if (compiledResponse) {
        const response = compiledResponse({ identity, contract, signal: abort.signal, includePreview: body.mode === 'stream',
          source: async function* (signal) {
            for (const record of authoredRecords(identity, body)) {
              if (signal.aborted) throw new Error('Cancelled');
              observation.sourceRecords++; yield encoder.encode(JSON.stringify(record) + '\n');
              if (record.seq === 5) await checkpointGate({ identity, mode: body.mode, signal });
            }
            await finalGate({ identity, mode: body.mode, signal });
          },
          acceptFinal() {
            if (abort.signal.aborted || identity.revision !== revision) throw new Error('Stale source');
            accepted = { ...identity, used: false }; observation.sourceComplete = true;
          },
        });
        if (!(response instanceof Response) || !response.body || response.status !== 200
          || response.headers.get('x-stream-id') !== identity.streamId
          || response.headers.get('x-revision') !== String(identity.revision)) throw new Error('Invalid Fetch response');
        const observer = createJsonlDecoder({ identity, kind: 'output', onRecord() { observation.snapshots++; } });
        for await (const bytes of response.body) {
          observer.push(bytes); observation.bytes += bytes.length;
          if (!res.write(bytes)) await Promise.race([once(res, 'drain'), once(res, 'close')]);
        }
        observer.finish(); res.end(); return;
      }
      const compiler = createCompiler({ identity, contract });
      const pending = [];
      const decoder = createJsonlDecoder({ identity, kind: 'input', onRecord(record) {
        const candidate = compiler.accept(record);
        if (candidate?.final) final = candidate;
        else if (candidate) pending.push(candidate);
      } });
      for (const record of authoredRecords(identity, body)) {
        if (abort.signal.aborted) throw new Error('Cancelled');
        observation.sourceRecords++;
        decoder.push(encoder.encode(JSON.stringify(record) + '\n'));
        while (pending.length) {
          const candidate = pending.shift();
          if (body.mode === 'stream') await emit(candidate, 'preview');
          if (record.seq === 5) await checkpointGate({ identity, mode: body.mode, signal: abort.signal });
        }
      }
      await finalGate({ identity, mode: body.mode, signal: abort.signal });
      if (abort.signal.aborted) throw new Error('Cancelled');
      decoder.finish(); compiler.finish(); observation.sourceComplete = true;
      // Newer requests supersede this run's authority even if an older connection finishes later.
      if (identity.revision !== revision) throw new Error('Stale source');
      accepted = { ...identity, used: false }; await emit(final, 'committed'); res.end();
    } catch {
      observation.cancelled = abort.signal.aborted; observation.failed = !observation.cancelled;
      res.end(); // EOF without a committed snapshot is a failed stream, never a fallback candidate.
    } finally { active.delete(abort); }
  });
  server.requestTimeout = 5000; server.headersTimeout = 5000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { url: `http://127.0.0.1:${server.address().port}`, records, saves, bundleBytes: bundle.length,
    async close() { for (const abort of active) abort.abort(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); } };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = await createResearchServer({ port: 5176 });
  console.log(`${app.url} — authored server compilation; no model`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); process.exit(0); });
}
