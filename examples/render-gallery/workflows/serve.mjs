import http from 'node:http';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DATA, validateData } from './data.mjs';
import { loadIndex, recordsFor, digest } from '../store.mjs';
import { PRESET } from './preset.mjs';
const repo = new URL('../../../', import.meta.url);
const require = createRequire(new URL('package.json', repo));
export const BASELINE_ROOT = '/Users/user/.barocss-ai/v3/render-gallery-496-67f76a62';
export async function createWorkflowHost({ port = 0, baselineRoot = BASELINE_ROOT } = {}) {
  validateData(DATA);
  const index = loadIndex(baselineRoot), specimens = recordsFor(baselineRoot, index);
  const rendererRoot = new URL('packages/barocss-render/', repo), manifest = JSON.parse(fs.readFileSync(new URL('package.json', rendererRoot)));
  const rendererPath = fileURLToPath(new URL(manifest.exports['.'].import, rendererRoot));
  const bundle = await require('esbuild').build({ entryPoints: [fileURLToPath(new URL('browser.jsx', import.meta.url))], bundle: true, write: false,
    format: 'iife', platform: 'browser', jsx: 'automatic', plugins: [{ name: 'installed-built-renderer', setup(build) {
      build.onResolve({ filter: /^@barocss\/render$/ }, () => ({ path: rendererPath }));
      build.onResolve({ filter: /^(react|react-dom)(\/.*)?$/ }, (args) => ({ path: createRequire(import.meta.url).resolve(args.path) }));
    } }] });
  const runtime = fs.readFileSync(new URL('packages/barocss-browser/dist/cdn/barocss.umd.cjs', repo));
  const context = { version: 1, fixtureDigest: digest(DATA), presetDigest: digest(PRESET), rendererVersion: manifest.version,
    build: { renderer: digest(fs.readFileSync(rendererPath)), runtime: digest(runtime), bundle: digest(Buffer.from(bundle.outputFiles[0].contents)) },
    baselineDigest: digest(index), baselineSamples: index.samples.length };
  const nonce = randomBytes(24).toString('base64');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="barocss-nonce" content="${nonce}"><title>Fieldwork · authored workflow gallery</title></head><body><div id="app"></div><script src="/runtime.js"></script><script src="/workflow.js"></script></body></html>`;
  const assets = new Map([['/', [html, 'text/html']], ['/workflow.js', [bundle.outputFiles[0].contents, 'text/javascript']],
    ['/runtime.js', [runtime, 'text/javascript']], ['/api/context', [JSON.stringify(context), 'application/json']],
    ['/api/specimens', [JSON.stringify(specimens), 'application/json']]]);
  const server = http.createServer((req, res) => {
    res.setHeader('content-security-policy', `default-src 'none'; script-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self' 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`);
    res.setHeader('x-content-type-options', 'nosniff'); res.setHeader('cache-control', 'no-store');
    if (req.method !== 'GET' || req.headers.host !== `127.0.0.1:${server.address().port}`) { res.writeHead(403); return res.end('Loopback read-only host required'); }
    let pathname; try { pathname = new URL(req.url, `http://${req.headers.host}`).pathname; } catch { res.writeHead(400); return res.end('Invalid URL'); }
    const asset = assets.get(pathname); if (!asset) { res.writeHead(404); return res.end('Fixed asset not found'); }
    res.writeHead(200, { 'content-type': asset[1] }); res.end(asset[0]);
  });
  server.requestTimeout = 5000; server.headersTimeout = 5000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { url: `http://127.0.0.1:${server.address().port}`, context, async close() { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); } };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 3) throw new Error('Usage: node serve.mjs [ABS_ORIGINAL_GALLERY_ROOT]');
  const app = await createWorkflowHost({ port: 5176, baselineRoot: process.argv[2] ?? BASELINE_ROOT }); console.log(app.url);
  const stop = () => app.close().catch(() => {}); process.once('SIGINT', stop); process.once('SIGTERM', stop);
}
