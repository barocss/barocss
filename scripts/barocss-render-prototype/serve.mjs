import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { validateSpec } from '../../packages/barocss-render/src/contract.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoDeps = process.env.REPO_DEPS_ROOT;
const jrRoot = process.env.JR_ROOT;
if (!repoDeps || !jrRoot) throw new Error('Set REPO_DEPS_ROOT and JR_ROOT to existing local installations');
const fromRepo = createRequire(path.join(repoDeps, 'package.json'));
const esbuild = fromRepo('esbuild');
const baroPath = path.join(repoDeps, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs');
if (!fs.existsSync(baroPath)) throw new Error(`Missing built BaroCSS browser runtime: ${baroPath}`);
const bundle = (await esbuild.build({ entryPoints: [path.join(here, 'browser-app.jsx')],
  bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
  nodePaths: [path.join(jrRoot, 'node_modules')],
  define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'error',
})).outputFiles[0].contents;
const baro = fs.readFileSync(baroPath);
const dashboardJS = fs.readFileSync(path.join(here, 'dashboard.js'));
const bootJS = `BaroCSS.baroStart({skipExisting:true,config:{cssVarPrefix:'tw',theme:{extend:BaroCSS.shadcnTheme}}});`;

function armPage() {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Renderer arm</title><link rel="stylesheet" href="/base.css"></head><body><main class="min-h-screen bg-slate-100 p-4"><div id="out"></div></main><script src="/baro.js"></script><script src="/boot.js"></script><script src="/app.js"></script></body></html>`;
}
function dashboardPage() {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BaroCSS renderer comparison</title><link rel="stylesheet" href="/base.css"></head><body><header><h1>Authored screen comparison</h1><p>Both arms use the same validated JSON, components, and local actions.</p><button id="edit">Apply authored edit</button> <button id="reset">Reset JSON</button> <button id="apply">Apply JSON</button> <button id="capture" hidden>Load saved CLI JSON</button><pre id="errors" role="status"></pre><textarea id="spec" aria-label="Screen JSON" spellcheck="false"></textarea></header><div class="comparison"><section><h2>Private @barocss/render prototype</h2><iframe id="prototype" title="Prototype screen" src="/arm?arm=prototype"></iframe></section><section><h2>Official json-render + BaroCSS</h2><iframe id="official" title="Official screen" src="/arm?arm=json-render"></iframe></section></div><script src="/dashboard.js"></script></body></html>`;
}
const baseCSS = `*{box-sizing:border-box}body{margin:0;font:16px system-ui,sans-serif}header{padding:16px}button{cursor:pointer}textarea{display:block;width:100%;height:180px;margin-top:12px;font:12px monospace}.comparison{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:12px}.comparison iframe{width:100%;height:430px;border:1px solid #999}@media(max-width:800px){.comparison{grid-template-columns:1fr}}`;

export async function createComparisonServer({ port = 0, capturePath } = {}) {
  let capture;
  if (capturePath) {
    const raw = JSON.parse(fs.readFileSync(capturePath, 'utf8'));
    if (raw.cannotExpress === true) throw new Error('Captured output declares the screen cannot be expressed');
    const candidate = typeof raw.specJson === 'string' ? JSON.parse(raw.specJson) : raw;
    const checked = validateSpec(candidate);
    if (!checked.ok) throw new Error(`Captured JSON does not fit this prototype: ${checked.errors[0].path}: ${checked.errors[0].message}`);
    capture = candidate;
  }
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const send = (type, body, status = 200) => {
      res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store',
        'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-src 'self'; connect-src 'self'; img-src 'self' data:" });
      res.end(body);
    };
    if (req.headers.host !== `127.0.0.1:${server.address().port}`) return send('text/plain', 'Invalid host', 403);
    if (req.method !== 'GET') return send('text/plain', 'Method not allowed', 405);
    if (url.pathname === '/') return send('text/html; charset=utf-8', dashboardPage());
    if (url.pathname === '/arm' && ['prototype', 'json-render'].includes(url.searchParams.get('arm'))) return send('text/html; charset=utf-8', armPage());
    if (url.pathname === '/base.css') return send('text/css', baseCSS);
    if (url.pathname === '/app.js') return send('text/javascript', bundle);
    if (url.pathname === '/baro.js') return send('text/javascript', baro);
    if (url.pathname === '/boot.js') return send('text/javascript', bootJS);
    if (url.pathname === '/dashboard.js') return send('text/javascript', dashboardJS);
    if (url.pathname === '/capture.json' && capture) return send('application/json', JSON.stringify(capture));
    return send('text/plain', 'Not found', 404);
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}`, hasCapture: Boolean(capture) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const captureIndex = process.argv.indexOf('--capture');
  if (captureIndex >= 0 && !process.argv[captureIndex + 1]) throw new Error('--capture requires a local JSON path');
  const port = Number(process.env.PORT ?? 0);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid PORT');
  const result = await createComparisonServer({ port, capturePath: captureIndex >= 0 ? process.argv[captureIndex + 1] : undefined });
  console.log(`${result.url}/`);
}
