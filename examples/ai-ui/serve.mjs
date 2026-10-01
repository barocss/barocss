import http from 'node:http';
import { readFileSync } from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createRequestSession } from './session.mjs';
import { requestScreen } from './scenario.mjs';

const repo = new URL('../../', import.meta.url);
const deps = createRequire(new URL('package.json', repo));
const { build } = deps('esbuild');
const fixture = (request) => ({ sessionId: request.sessionId, revision: request.revision,
  requestId: request.requestId, specJson: JSON.stringify(requestScreen(request.target, request.input)) });
const sameToken = (candidate, expected) => typeof candidate === 'string' && Buffer.byteLength(candidate) === Buffer.byteLength(expected)
  && timingSafeEqual(Buffer.from(candidate), Buffer.from(expected));
const empty = (body) => body && typeof body === 'object' && !Array.isArray(body) && Object.keys(body).length === 0;

export async function createAppServer({ generate = fixture, mode = 'authored-fixtures', port = 0 } = {}) {
  if (!['authored-fixtures', 'injected-test'].includes(mode)) throw new Error('Live dispatch is not enabled');
  const peers = process.env.REACT_ROOT ? createRequire(`${process.env.REACT_ROOT}/package.json`) : createRequire(import.meta.url);
  const renderer = new URL('packages/barocss-render/', repo);
  const renderManifest = JSON.parse(readFileSync(new URL('package.json', renderer), 'utf8'));
  const bundle = (await build({ entryPoints: [fileURLToPath(new URL('browser.jsx', import.meta.url))],
    bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', logLevel: 'error',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'built-package-root', setup(plugin) {
      plugin.onResolve({ filter: /^@barocss\/render$/ }, () => ({ path: fileURLToPath(new URL(renderManifest.exports['.'].import, renderer)) }));
      plugin.onResolve({ filter: /^react(?:-dom)?(?:\/.*)?$/ }, (args) => ({ path: peers.resolve(args.path) }));
    } }],
  })).outputFiles[0].contents;
  const baro = readFileSync(new URL('packages/barocss-browser/dist/cdn/barocss.umd.cjs', repo));
  const token = randomBytes(32).toString('hex'), nonce = randomBytes(24).toString('base64');
  const session = createRequestSession({ generate });
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="barocss-nonce" content="${nonce}"><title>BaroCSS request UI</title><link rel="stylesheet" href="/base.css"></head><body><div id="app"></div><script src="/baro.js"></script><script src="/app.js"></script></body></html>`;
  const assets = new Map([
    ['/', ['text/html; charset=utf-8', html]], ['/app.js', ['text/javascript', bundle]],
    ['/baro.js', ['text/javascript', baro]],
    ['/base.css', ['text/css', 'body{margin:0;font:16px system-ui}*{box-sizing:border-box}main{max-width:900px;margin:auto}input,textarea,button{font:inherit}label{display:block}input,textarea{max-width:100%}button{cursor:pointer}header{display:flex;gap:8px;flex-wrap:wrap}']],
  ]);
  const server = http.createServer(async (req, res) => {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const send = (status, type, body) => {
      res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
        'content-security-policy': `default-src 'none'; script-src 'self'; style-src 'self' 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'` });
      res.end(body);
    };
    const json = (status, value) => send(status, 'application/json; charset=utf-8', JSON.stringify(value));
    if (req.headers.host !== new URL(origin).host || (req.headers.origin && req.headers.origin !== origin)
      || req.headers['sec-fetch-site'] === 'cross-site') return json(403, { error: 'Invalid host or origin' });
    let path;
    try { const url = new URL(req.url, origin); if (url.origin !== origin || url.search) throw new Error(); path = url.pathname; }
    catch { return json(400, { error: 'Invalid URL' }); }
    if (req.method === 'GET' && assets.has(path)) { const [type, body] = assets.get(path); return send(200, type, body); }
    if (req.method === 'GET' && path === '/api/session') return json(200, { token, mode, contract: session.contract });
    if (!sameToken(req.headers['x-session-token'], token)) return json(403, { error: 'Invalid token' });
    if (req.method === 'GET' && path === '/api/state') return json(200, session.snapshot());
    if (req.method !== 'POST' || !['/api/start', '/api/input', '/api/action', '/api/cancel', '/api/restart'].includes(path)) return json(404, { error: 'Not found' });
    if (req.headers.origin !== origin) return json(403, { error: 'Origin required' });
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? '')) return json(415, { error: 'JSON required' });
    try {
      let size = 0; const chunks = [];
      for await (const chunk of req) { size += chunk.length; if (size > 4096) return json(413, { error: 'Body too large' }); chunks.push(chunk); }
      const body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
      let result;
      if (path === '/api/start') {
        if (!Object.hasOwn(body ?? {}, 'screenRequest')) return json(400, { error: 'Screen request required' });
        result = session.start(body);
      } else if (path === '/api/input') result = session.updateInput(body);
      else if (path === '/api/action') result = session.action(body);
      else if (!empty(body)) result = { status: 400, error: 'Expected empty control body' };
      else result = path === '/api/cancel' ? session.cancel() : session.restart();
      return json(result.status, result);
    } catch { return json(400, { error: 'Invalid request body' }); }
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { server, session, url: `http://127.0.0.1:${server.address().port}`, mode,
    async close() { session.restart(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); } };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = await createAppServer({ port: 5174 });
  console.log(`${app.url} — ${app.mode}`);
  const stop = async () => { await app.close(); process.exit(0); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
}
