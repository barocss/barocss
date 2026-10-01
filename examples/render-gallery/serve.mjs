import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadIndex, recordsFor, recordKey, readData, validateRecord, unsupported } from './store.mjs';
const repo = new URL('../../', import.meta.url);
const deps = createRequire(new URL('package.json', repo));
const peers = createRequire(new URL('../ai-ui/package.json', import.meta.url));
export async function createGallery({ root, port = 0 }) {
  const index = loadIndex(root), records = recordsFor(root, index), imageAssets = new Map();
  const captures = [];
  for (const ref of index.batches) {
    const batch = readData(path.join(root, 'captures', ref.id, 'batch.json'));
    for (const c of batch.captures) {
      const filename = `${recordKey(c)}-${c.viewport.width}.png`, url = `/images/${ref.id}/${filename}`;
      imageAssets.set(url, fs.readFileSync(path.join(root, 'captures', ref.id, filename)));
      captures.push({ ...c, batch: ref.id, url, sourceSha: batch.candidateSha });
    }
  }
  const renderer = new URL('packages/barocss-render/', repo);
  const manifest = JSON.parse(fs.readFileSync(new URL('package.json', renderer), 'utf8'));
  const resolvePeer = (name) => {
    try { return createRequire(import.meta.url).resolve(name); } catch { return peers.resolve(name); }
  };
  const esbuild = deps('esbuild');
  const bundle = await esbuild.build({ entryPoints: [fileURLToPath(new URL('browser.jsx', import.meta.url))], bundle: true, write: false,
    format: 'iife', platform: 'browser', jsx: 'automatic', plugins: [{ name: 'built-renderer-peers', setup(build) {
      build.onResolve({ filter: /^@barocss\/render$/ }, () => ({ path: fileURLToPath(new URL(manifest.exports['.'].import, renderer)) }));
      build.onResolve({ filter: /^(react|react-dom)(\/.*)?$/ }, (args) => ({ path: resolvePeer(args.path) }));
    } }] });
  const nonce = randomBytes(24).toString('base64');
  const html = Buffer.from(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="barocss-nonce" content="${nonce}"><title>BaroCSS renderer design gallery</title></head><body><div id="app"></div><script src="/runtime.js"></script><script src="/gallery.js"></script></body></html>`);
  const assets = new Map([['/', [html, 'text/html']], ['/gallery.js', [bundle.outputFiles[0].contents, 'text/javascript']],
    ['/runtime.js', [fs.readFileSync(new URL('packages/barocss-browser/dist/cdn/barocss.umd.cjs', repo)), 'text/javascript']],
    ...[...imageAssets].map(([url, bytes]) => [url, [bytes, 'image/png']])]);
  const csp = `default-src 'none'; script-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self' 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`;
  const apiIndex = { version: 1, samples: records.map((r) => ({ id: r.id, revision: r.revision, title: r.title, category: r.category,
    tags: r.tags, source: r.source, ...validateRecord(r), captures: captures.filter((c) => c.id === r.id && c.revision === r.revision) })), unsupported };
  const server = http.createServer((req, res) => {
    res.setHeader('content-security-policy', csp); res.setHeader('x-content-type-options', 'nosniff'); res.setHeader('cache-control', 'no-store');
    const json = (status, value) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); };
    if (req.headers.host !== `127.0.0.1:${server.address().port}` || req.method !== 'GET') return json(403, { error: 'Local read-only host required' });
    let url; try { url = new URL(req.url, `http://${req.headers.host}`); } catch { return json(400, { error: 'Invalid URL' }); }
    if (assets.has(url.pathname)) { const [body, type] = assets.get(url.pathname); res.writeHead(200, { 'content-type': type }); return res.end(body); }
    if (url.pathname === '/api/index') return json(200, apiIndex);
    const match = /^\/api\/sample\/([a-z][a-z0-9-]{0,47})\/([1-9][0-9]{0,5})$/.exec(url.pathname);
    if (match) {
      const sample = records.find((r) => r.id === match[1] && r.revision === Number(match[2]));
      if (!sample) return json(404, { error: 'Sample not found; previous usable preview retained' });
      const check = validateRecord(sample); if (!check.replayable) return json(422, { error: 'Claimed model provenance is unverified; no successful renderer preview' });
      return json(200, { ...sample, sourceLabel: check.sourceLabel, captures: captures.filter((c) => c.id === sample.id && c.revision === sample.revision) });
    }
    return json(404, { error: 'Fixed local asset not found' });
  });
  server.headersTimeout = 5000; server.requestTimeout = 5000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { server, url: `http://127.0.0.1:${server.address().port}`, async close() { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); } };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw new Error('Usage: node serve.mjs ABS_GALLERY_ROOT');
  const app = await createGallery({ root: process.argv[2], port: 5175 }); console.log(app.url);
  const stop = () => app.close().catch(() => {}); process.once('SIGINT', stop); process.once('SIGTERM', stop);
}
