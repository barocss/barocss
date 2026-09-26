// #379: serve the launch demos locally (one command): node scripts/launch-demos/serve.mjs [--local] [port=7450]
// --local rewrites the @barocss/browser 0.10.1 CDN URL to the workspace build (packages/barocss-browser/dist/cdn), for
// offline runs; without it the pages load the published package from cdn.jsdelivr.net.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIR = path.join(ROOT, 'apps/barocss-docs/docs/public/demos');
const LOCAL = process.argv.includes('--local');
const PORT = Number(process.argv.find((a) => /^\d+$/.test(a)) || 7450);
const CDN = 'https://cdn.jsdelivr.net/npm/@barocss/browser@0.10.1/dist/cdn/barocss.umd.cjs';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.cjs': 'text/javascript', '.css': 'text/css' };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let f = u.pathname === '/__local/barocss.umd.cjs' ? path.join(ROOT, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs')
    : path.join(DIR, decodeURIComponent(u.pathname).replace(/^\/demos/, ''));
  if (!f.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404).end('not found'); return; }
  let body = fs.readFileSync(f);
  if (LOCAL && f.startsWith(DIR) && /\.js$/.test(f)) body = body.toString().replaceAll(CDN, '/__local/barocss.umd.cjs');
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }).end(body);
}).listen(PORT, () => console.log(`demos: http://localhost:${PORT}/demos/ ${LOCAL ? '(local build)' : '(CDN 0.10.1)'}`));
