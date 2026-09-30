import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createSessionController } from './controller.mjs';
import { generateMockScreen } from './mock.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.env.REPO_DEPS_ROOT;
const jrRoot = process.env.JR_ROOT;

function bundleAssets() {
  if (!root || !jrRoot) throw new Error('Set REPO_DEPS_ROOT and JR_ROOT to approved local installations');
  const esbuild = createRequire(path.join(root, 'package.json'))('esbuild');
  const baroPath = path.join(root, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs');
  if (!fs.existsSync(baroPath)) throw new Error(`Missing built BaroCSS runtime: ${baroPath}`);
  return { esbuild, baro: fs.readFileSync(baroPath) };
}

const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BaroCSS UI loop</title><link rel="stylesheet" href="/base.css"></head><body><main class="min-h-screen bg-slate-100 p-4"><div id="app"></div></main><script src="/baro.js"></script><script src="/boot.js"></script><script src="/app.js"></script></body></html>`;
const baseCSS = '*{box-sizing:border-box}body{margin:0;font:16px system-ui,sans-serif}main{max-width:900px;margin:auto}button{cursor:pointer}button:disabled{cursor:wait}header{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}#status{min-height:24px;margin:8px 0}';
const bootJS = 'BaroCSS.baroStart({skipExisting:true,config:{cssVarPrefix:"tw",theme:{extend:BaroCSS.shadcnTheme}}});';

export async function createLoopServer({ generate = generateMockScreen, mode = 'authored-mock', liveInputs, port = 0 } = {}) {
  if (!['authored-mock', 'local-cli'].includes(mode)) throw new Error('Invalid generation mode');
  if (mode === 'local-cli' && (!liveInputs || typeof liveInputs.prompt !== 'string'
    || typeof liveInputs.name !== 'string')) throw new Error('Live inputs must be fixed at launch');
  const { esbuild, baro } = bundleAssets();
  const bundle = (await esbuild.build({ entryPoints: [path.join(here, 'browser.jsx')], bundle: true,
    write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
    nodePaths: [path.join(jrRoot, 'node_modules')],
    define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'error',
  })).outputFiles[0].contents;
  const controller = createSessionController({ generate });
  const token = randomBytes(32).toString('hex');
  const server = http.createServer(async (req, res) => {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const url = new URL(req.url, origin);
    const send = (status, type, body) => {
      res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'" });
      res.end(body);
    };
    const json = (status, value) => send(status, 'application/json; charset=utf-8', JSON.stringify(value));
    if (req.headers.host !== `127.0.0.1:${server.address().port}`) return json(403, { error: 'Invalid host' });
    if (req.method === 'GET') {
      if (url.pathname === '/') return send(200, 'text/html; charset=utf-8', page);
      if (url.pathname === '/base.css') return send(200, 'text/css', baseCSS);
      if (url.pathname === '/baro.js') return send(200, 'text/javascript', baro);
      if (url.pathname === '/boot.js') return send(200, 'text/javascript', bootJS);
      if (url.pathname === '/app.js') return send(200, 'text/javascript', bundle);
      if (url.pathname === '/api/session' && (!req.headers.origin || req.headers.origin === origin)) {
        return json(200, { token, mode });
      }
      if (url.pathname === '/api/state' && req.headers['x-session-token'] === token
        && (!req.headers.origin || req.headers.origin === origin)) return json(200, controller.snapshot());
      return json(404, { error: 'Not found' });
    }
    if (req.method !== 'POST' || !['/api/start', '/api/action', '/api/cancel', '/api/restart'].includes(url.pathname)) {
      return json(404, { error: 'Not found' });
    }
    if (req.headers.origin !== origin || req.headers['x-session-token'] !== token) {
      return json(403, { error: 'Invalid origin or session token' });
    }
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? '')) return json(415, { error: 'JSON required' });
    const chunks = [];
    let size = 0;
    try {
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 4096) return json(413, { error: 'Request too large' });
        chunks.push(chunk);
      }
      const raw = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size));
      const body = JSON.parse(raw);
      if (liveInputs && ((url.pathname === '/api/start' && body?.prompt !== liveInputs.prompt)
        || (url.pathname === '/api/action' && body?.input?.name !== liveInputs.name))) {
        return json(403, { error: 'Input is outside the approved live run' });
      }
      const result = url.pathname === '/api/start' ? controller.start(body)
        : url.pathname === '/api/action' ? controller.action(body)
          : body !== null && typeof body === 'object' && !Array.isArray(body) && !Object.keys(body).length
            ? url.pathname === '/api/cancel' ? controller.cancel() : controller.restart()
            : { ok: false, status: 400, error: 'Expected an empty object' };
      return json(result.status, result);
    } catch { return json(400, { error: 'Invalid JSON' }); }
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return { server, controller, url: `http://127.0.0.1:${server.address().port}` };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 0);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid PORT');
  const result = await createLoopServer({ port });
  console.log(`${result.url}/ (authored mock; no model call)`);
}
