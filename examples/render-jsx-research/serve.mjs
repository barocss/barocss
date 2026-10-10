import http from 'node:http';
import fs from 'node:fs/promises';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compileUi } from './compiler.mjs';

const encoder = new TextEncoder();
const validState = (value) => value && Object.keys(value).sort().join(',') === 'count,name'
  && Number.isInteger(value.count) && value.count >= 0 && value.count <= 1000 && typeof value.name === 'string' && value.name.length <= 80;
export async function createJsxServer({ port = 0, sourceGate = async () => {} } = {}) {
  const shell = await fs.readFile(new URL('shell.mjs', import.meta.url));
  const source = await fs.readFile(new URL('app.jsx', import.meta.url), 'utf8');
  const nonce = randomBytes(24).toString('base64'), token = randomBytes(24).toString('hex');
  const bundles = new Map(), records = [], saves = [], assetRequests = [], active = new Set();
  let revision = 0, accepted = null;
  const html = '<!doctype html><html lang="ko"><meta charset="utf-8"><title>Compiled JSX research</title><link rel="stylesheet" href="/base.css"><h1>서버 JSX 컴파일 실험</h1><p>고정 JSX와 초기 상태로 만든 연구 화면입니다.</p><nav><button id="start">화면 생성</button><button id="different">다른 모듈</button><button id="invalid">잘못된 JSX</button><button id="cancel">취소</button></nav><p id="phase">idle</p><p id="error" role="alert"></p><div id="current"></div><div id="retained" hidden></div><p id="saved"></p><script src="/shell.mjs" type="module"></script></html>';
  const server = http.createServer(async (req, res) => {
    const origin = `http://127.0.0.1:${server.address().port}`, url = new URL(req.url, origin);
    const baseHeaders = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
    const policy = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
    const send = (status, type, body, csp = policy) => { res.writeHead(status, { ...baseHeaders, 'content-type': type, 'content-security-policy': csp }); res.end(body); };
    const json = (status, value) => send(status, 'application/json', JSON.stringify(value));
    const publicBundle = req.method === 'GET' && /^\/bundle\/[a-f0-9]{64}\.js$/.test(url.pathname);
    if (req.headers.host !== new URL(origin).host || (req.headers['sec-fetch-site'] === 'cross-site' && !publicBundle)) return json(403, { error: 'Invalid host' });
    if (req.method === 'GET' && url.pathname === '/') return send(200, 'text/html; charset=utf-8', html);
    if (req.method === 'GET' && url.pathname === '/shell.mjs') return send(200, 'text/javascript', shell);
    if (req.method === 'GET' && url.pathname === '/base.css') return send(200, 'text/css', 'body{font:16px system-ui;margin:2rem}nav{display:flex;gap:1rem}button{font:inherit}iframe{width:100%;height:420px;border:1px solid #cbd5e1}');
    const resource = url.pathname.match(/^\/(bundle|frame)\/([a-f0-9]{64})\.(js|html)$/);
    if (req.method === 'GET' && resource) {
      const item = bundles.get(resource[2]); if (!item) return json(404, { error: 'Unknown bundle' });
      assetRequests.push({ path: url.pathname, site: req.headers['sec-fetch-site'] ?? null, origin: req.headers.origin ?? null });
      if (resource[1] === 'bundle' && resource[3] === 'js') return send(200, 'text/javascript', item.bundle);
      const instanceId = url.searchParams.get('instanceId');
      if (resource[1] !== 'frame' || resource[3] !== 'html' || !/^[a-zA-Z0-9_-]{1,64}$/.test(instanceId ?? '')) return json(400, { error: 'Invalid frame identity' });
      const framePolicy = `default-src 'none'; script-src 'self'; style-src 'nonce-${nonce}'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'`;
      return send(200, 'text/html; charset=utf-8', `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="host-origin" content="${origin}"><meta name="instance-id" content="${instanceId}"><meta name="bundle-digest" content="${item.bundleDigest}"><style nonce="${nonce}">body{font:16px system-ui;margin:16px}*{box-sizing:border-box}${item.css}</style><div id="app"></div><script src="/bundle/${item.bundleDigest}.js"></script></html>`, framePolicy);
    }
    if (req.method === 'GET' && url.pathname === '/session' && (!req.headers.origin || req.headers.origin === origin)) return json(200, { token });
    if (req.method !== 'POST' || !['/stream', '/save'].includes(url.pathname)) return json(404, { error: 'Unknown route' });
    const received = typeof req.headers['x-session-token'] === 'string' ? Buffer.from(req.headers['x-session-token']) : null;
    const expected = Buffer.from(token);
    if (req.headers.origin !== origin || !received || received.length !== expected.length || !timingSafeEqual(received, expected)) return json(403, { error: 'Invalid session' });
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? '')) return json(415, { error: 'JSON required' });
    let body;
    try {
      let bytes = 0; const chunks = [];
      for await (const chunk of req) { bytes += chunk.length; if (bytes > 4096) return json(413, { error: 'Request limit' }); chunks.push(chunk); }
      body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
    } catch { return json(400, { error: 'Invalid JSON' }); }
    if (url.pathname === '/save') {
      if (!body || Object.keys(body).sort().join(',') !== 'bundleDigest,count,name,revision,streamId' || !validState({ count: body.count, name: body.name })
        || !accepted || accepted.used || body.streamId !== accepted.streamId || body.revision !== accepted.revision || body.bundleDigest !== accepted.bundleDigest)
        return json(409, { error: 'Save unavailable' });
      accepted.used = true; saves.push(body); return json(200, { saved: { count: body.count, name: body.name } });
    }
    if (!body || Object.keys(body).join(',') !== 'variant' || !['counter', 'different', 'invalid'].includes(body.variant)) return json(400, { error: 'Unknown fixture' });
    if (records.length >= 8) return json(429, { error: 'Source run limit' });
    const identity = { streamId: randomUUID(), revision: ++revision }, abort = new AbortController(); active.add(abort);
    res.on('close', () => abort.abort());
    const observation = { ...identity, variant: body.variant, sourceComplete: false, moduleRecords: 0, wireBytes: 0, failed: false, cancelled: false };
    records.push(observation);
    res.writeHead(200, { ...baseHeaders, 'content-type': 'application/x-ndjson', 'content-security-policy': policy }); res.flushHeaders();
    const emit = (record) => { const bytes = encoder.encode(JSON.stringify(record) + '\n'); observation.wireBytes += bytes.length; res.write(bytes); };
    try {
      const text = body.variant === 'different' ? source.replace('const unitPrice = 1800;', 'const unitPrice = 2200;') : body.variant === 'invalid' ? 'export default function Broken(' : source;
      const compiled = await compileUi(text, { moduleId: 'counter' });
      if (abort.signal.aborted || identity.revision !== revision) throw new Error('Stale compile');
      bundles.set(compiled.bundleDigest, compiled); observation.compiled = {
        sourceDigest: compiled.sourceDigest, bundleDigest: compiled.bundleDigest, bundleBytes: compiled.bundle.length,
        cssBytes: encoder.encode(compiled.css).length, versions: compiled.versions,
      };
      emit({ version: 1, ...identity, seq: 1, type: 'module', phase: 'preview', moduleId: compiled.moduleId,
        sourceDigest: compiled.sourceDigest, bundleDigest: compiled.bundleDigest,
        frameUrl: `/frame/${compiled.bundleDigest}.html`, initialState: { count: 2, name: '민지' } });
      observation.moduleRecords = 1;
      await sourceGate({ identity, variant: body.variant, signal: abort.signal });
      if (abort.signal.aborted || identity.revision !== revision) throw new Error('Stale source');
      observation.sourceComplete = true; accepted = { ...identity, bundleDigest: compiled.bundleDigest, used: false };
      emit({ version: 1, ...identity, seq: 2, type: 'commit', bundleDigest: compiled.bundleDigest }); res.end();
    } catch (error) { observation.cancelled = abort.signal.aborted; observation.failed = !observation.cancelled; observation.failure = error.message; res.end(); }
    finally { active.delete(abort); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { url: `http://127.0.0.1:${server.address().port}`, records, saves, bundles, assetRequests,
    async close() { for (const abort of active) abort.abort(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); } };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = await createJsxServer({ port: 5177 }); console.log(`${app.url} — authored JSX, no model`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); process.exit(0); });
}
