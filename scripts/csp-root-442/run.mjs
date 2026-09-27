// #442 strict-CSP regression test: Shadow DOM root mode under style-src 'self' (no 'unsafe-inline').
// Rerun (repo root, after pnpm --filter @barocss/kit build:library && pnpm --filter @barocss/browser build:library):
//   PW_DIR=<dir containing node_modules/playwright-core> CHROME=<chromium> [PROBE_PORT=8851] [BARO_FILE=<umd build>] \
//     node scripts/csp-root-442/run.mjs
// Arms: root (no nonce), root + nonce, root + constructable. Pass = 0 CSP violations AND gradient, shadow, ring and
// translate render (computed background-image / box-shadow / translate are not none). Exits 1 on any failure.
// Fails on 0.11.1 (root without nonce: the #384 document @property <style> is blocked); passes after #442.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = Number(process.env.PROBE_PORT || 8851);
const N = 'n0nce442';
const POLICY = `default-src 'self'; script-src 'self' 'nonce-${N}'; style-src 'self'`;
const BARO = fs.readFileSync(process.env.BARO_FILE || path.join(ROOT, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs'), 'utf8');
const ARMS = { 'root': '{}', 'root + nonce': `{ nonce: '${N}' }`, 'root + constructable': '{ constructable: true }' };
const S = `nonce="${N}"`;
const page = (opt) => `<!doctype html><html><head><meta charset="utf-8">
<script ${S}>window.__viol=[];document.addEventListener('securitypolicyviolation',function(e){window.__viol.push(e.violatedDirective+' '+(e.sample||'').slice(0,40))});</script>
<script ${S} src="/baro.js"></script></head><body><div id="host"></div><script ${S}>
var sr=document.getElementById('host').attachShadow({mode:'open'});
sr.innerHTML='<div id="g" class="bg-gradient-to-r from-red-500 to-blue-500 h-4"></div><div id="s" class="shadow-lg">s</div><div id="r" class="ring-2 ring-blue-500">r</div><div id="t" class="translate-x-2">t</div>';
new BaroCSS.BrowserRuntime(Object.assign({root:sr},${opt}));
setTimeout(function(){var c=function(id){return getComputedStyle(sr.getElementById(id))};
window.__r={gradient:c('g').backgroundImage,shadow:c('s').boxShadow,ring:c('r').boxShadow,translate:c('t').translate+'|'+c('t').transform,
headStyles:document.head.querySelectorAll('style').length,docAdopted:document.adoptedStyleSheets.length};},800);
</script></body></html>`;
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x');
  if (u.pathname === '/baro.js') { r.writeHead(200, { 'content-type': 'text/javascript' }); return r.end(BARO); }
  const opt = ARMS[u.searchParams.get('arm')];
  if (u.pathname === '/p' && opt) { r.writeHead(200, { 'content-type': 'text/html', 'content-security-policy': POLICY }); return r.end(page(opt)); }
  r.writeHead(404); r.end();
});
await new Promise((ok) => srv.listen(PORT, '127.0.0.1', ok));
const pw = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');
const browser = await pw.chromium.launch({ executablePath: process.env.CHROME });
let ok = true;
for (const arm of Object.keys(ARMS)) {
  const p = await browser.newPage();
  const cons = [];
  p.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) cons.push(m.text().slice(0, 100)); });
  await p.goto(`http://127.0.0.1:${PORT}/p?arm=${encodeURIComponent(arm)}`);
  const r = await p.waitForFunction(() => window.__r, null, { timeout: 10000 }).then((x) => x.jsonValue());
  const viol = await p.evaluate(() => window.__viol);
  await p.close();
  const render = { gradient: r.gradient !== 'none', shadow: r.shadow !== 'none', ring: r.ring !== 'none', translate: !/^(none|0px)?\|none$/.test(r.translate) };
  const pass = viol.length === 0 && cons.length === 0 && Object.values(render).every(Boolean);
  ok &&= pass;
  console.log(pass ? 'PASS' : 'FAIL', arm.padEnd(22), 'violations', viol.length, JSON.stringify(render), 'headStyles', r.headStyles, 'docAdopted', r.docAdopted, viol.slice(0, 1).join(''));
}
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
