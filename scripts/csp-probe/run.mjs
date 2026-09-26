// #347 strict-CSP probe: does the browser runtime style the #253 CMS blocks on a page without style-src 'unsafe-inline'?
// Rerun (repo root, after pnpm --filter @barocss/kit build:library && pnpm --filter @barocss/browser build:library):
//   TWB_DIR=<dir of @tailwindcss/browser> PW_DIR=<dir containing node_modules/playwright-core> CHROME=<chromium> \
//     [PROBE_PORT=7147] node scripts/csp-probe/run.mjs
// Every page is served with a Content-Security-Policy header (policy per arm, below); scripts carry the nonce.
// Document arms: site shell + build.css (<link>), then scripts/cms-probe/page.js inserts one model's 6 blocks and
// signs computed styles; parity = share of block elements whose signature equals the reference page's
// (ref = CSS built from the shell + block classes, served as a file, same CSP).
// Shadow arms: the blocks go into a shadow root; ref = the same CSS <link>ed inside the root; baro = #327 root option.
// Violations = securitypolicyviolation events (listener installed first) + console CSP messages.
// SUMMARY (2026-09-26, Chromium 1223, block-element parity opus/haiku, violations = events over both models):
//   document  ref (file)                               1.000/1.000   0
//   document  baro default, no CSP                     1.000/1.000   0
//   document  baro default (today), nonce policy       0.029/0.023   572 (style-src-elem: every runtime <style> blocked)
//   document  baro { nonce }                           1.000/1.000   0
//   document  baro { constructable: true }             1.000/1.000   0
//   document  baro { constructable }, style-src 'self' 1.000/1.000   0 (no nonce needed at all)
//   document  @tailwindcss/browser (nonce'd script)    0.029/0.023   12 (its <style> has no nonce option)
//   shadow    ref (<link> in the root)                 1.000/1.000   0
//   shadow    baro root (#327), no CSP / nonce / self  0.978/0.942   0 (constructable already; same as without CSP)
// insertRule into a nonce'd <style> is not governed by CSP; adoptedStyleSheets need no nonce.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { SHELL, SITE_CSS, BRAND, ACCENT, FONTS, SITE_THEME_CSS } from '../cms-probe/site.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const CMS = path.join(ROOT, 'scripts/cms-probe');
const req = createRequire(path.join(ROOT, 'packages/barocss/package.json'));
const { compile } = req('tailwindcss');
const twDir = path.dirname(req.resolve('tailwindcss/package.json'));
const PORT = Number(process.env.PROBE_PORT || 7147);
const N = 'r4nd0mN0nce347';
const POLICY = {
  none: null,
  nonce: `default-src 'self'; script-src 'self' 'nonce-${N}'; style-src 'self' 'nonce-${N}'`,
  self: `default-src 'self'; script-src 'self' 'nonce-${N}'; style-src 'self'`,
};
const MODELS = ['opus', 'haiku'], BLOCKS = ['hero', 'feature-grid', 'callout', 'comparison-table', 'testimonial', 'cta'];
const html = Object.fromEntries(MODELS.map((m) => [m, BLOCKS.map((b) => `<div data-block="${b}">${fs.readFileSync(path.join(CMS, 'blocks', `${m}-${b}.html`), 'utf8')}</div>`).join('\n')]));
const toks = (h) => [...h.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/).filter(Boolean));
async function build(tokens) {
  const c = await compile(`@import "tailwindcss";\n${SITE_CSS}`, {
    base: twDir,
    loadStylesheet: async (id, base) => {
      const p = id === 'tailwindcss' ? path.join(twDir, 'index.css') : path.resolve(base, id.replace(/^tailwindcss\//, ''));
      const file = fs.existsSync(p) ? p : path.join(twDir, id.replace(/^tailwindcss\//, ''));
      return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
    },
  });
  return c.build([...new Set(tokens)]);
}
const shellTokens = toks(SHELL).concat(['prose']);
const CSS = { build: await build(shellTokens) };
for (const m of MODELS) CSS['ref-' + m] = await build([...shellTokens, ...toks(html[m])]);
const FILES = { baro: path.join(ROOT, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs'), twb: path.join(process.env.TWB_DIR || '', 'dist/index.global.js') };

// arm: [policy, runtime] ; runtime: ref | baro(options) | twb
const THEME_EXT = { colors: { brand: BRAND, accent: ACCENT }, fontFamily: { display: FONTS.display.split(', '), sans: FONTS.sans.split(', ') } };
const baroOpts = (extra) => `{ skipExisting: true, ${extra} config: { cssVarPrefix: 'tw', theme: { extend: ${JSON.stringify(THEME_EXT)} } } }`;
const ARMS = {
  'ref': ['nonce', 'ref'],
  'baro default, no CSP': ['none', 'baro', ''],
  'baro default': ['nonce', 'baro', ''],
  'baro nonce': ['nonce', 'baro', `nonce: '${N}',`],
  'baro constructable': ['nonce', 'baro', 'constructable: true,'],
  'baro constructable, style-src self': ['self', 'baro', 'constructable: true,'],
  'twb': ['nonce', 'twb'],
};
const SHADOW_ARMS = {
  'ref': ['nonce', 'ref'],
  'baro root, no CSP': ['none', 'baro', ''],
  'baro root': ['nonce', 'baro', ''],
  'baro root + nonce': ['nonce', 'baro', `nonce: '${N}',`],
  'baro root, style-src self': ['self', 'baro', ''],
};
const S = `nonce="${N}"`;
const VIOL = `<script ${S}>window.__viol=[];document.addEventListener('securitypolicyviolation',function(e){window.__viol.push(e.violatedDirective+' '+(e.blockedURI||'')+' '+(e.sample||'').slice(0,40))});</script>`;
// Probe-own CSS is a file, so no arm's policy blocks it (a nonce'd <style> fails under style-src 'self').
const FREEZE = '<link rel="stylesheet" href="/freeze.css">';
CSS.freeze = '*,*::before,*::after{animation:none!important;transition:none!important}\n#host{display:block;width:1100px}';
function docPage(arm, m) {
  const [, rt, opt] = ARMS[arm];
  const headCss = rt === 'ref' ? `<link rel="stylesheet" href="/ref-${m}.css">` : '<link rel="stylesheet" href="/build.css">';
  const twbHead = rt === 'twb' ? `<style type="text/tailwindcss" ${S}>${SITE_THEME_CSS}</style><script ${S} src="/twb.js"></script>` : '';
  const boot = rt === 'baro' ? `<script ${S} src="/baro.js"></script><script ${S}>var rt = BaroCSS.getRuntime(${baroOpts(opt)}); rt.observe(document.body, { scan: true });</script>` : '';
  return `<!doctype html><html><head><meta charset="utf-8">${VIOL}${headCss}${twbHead}${FREEZE}
<script ${S}>window.__PROBE=${JSON.stringify({ arm, html: html[m] }).replace(/</g, '\\u003c')};</script><script ${S} src="/page.js"></script></head><body>${SHELL}${boot}</body></html>`;
}
// Shadow page: host in the body, blocks inserted into its root after load; sign computed styles of every block element.
const PROPS = ['display', 'margin-top', 'padding-top', 'padding-left', 'width', 'height', 'font-family', 'font-size', 'font-weight', 'line-height', 'color',
  'background-color', 'background-image', 'border-top-width', 'border-top-color', 'border-top-left-radius', 'box-shadow', 'gap', 'grid-template-columns',
  'flex-direction', 'justify-content', 'align-items', 'text-align'];
function shadowPage(arm, m) {
  const [, rt, opt] = SHADOW_ARMS[arm];
  const inner = rt === 'ref' ? `<link rel="stylesheet" href="/ref-${m}.css">` : '';
  const boot = rt === 'baro' ? `<script ${S} src="/baro.js"></script>` : '';
  return `<!doctype html><html><head><meta charset="utf-8">${VIOL}<link rel="stylesheet" href="/build.css">${FREEZE}${boot}</head><body><div id="host"></div>
<script ${S}>window.__H=${JSON.stringify(html[m]).replace(/</g, '\\u003c')};var host=document.getElementById('host');var sr=host.attachShadow({mode:'open'});sr.innerHTML=${JSON.stringify(inner)}+'<div id="blocks"></div>';
${rt === 'baro' ? `var rt=new BaroCSS.BrowserRuntime(Object.assign({root:sr},${baroOpts(opt).replace('skipExisting: true,', '')}));` : ''}
window.addEventListener('load',function(){setTimeout(function(){sr.getElementById('blocks').innerHTML=window.__H;setTimeout(function(){var P=${JSON.stringify(PROPS)};
window.__r={blockSig:[].map.call(sr.querySelectorAll('#blocks *'),function(e){var c=getComputedStyle(e);return P.map(function(p){return c.getPropertyValue(p)})}),adopted:sr.adoptedStyleSheets.length,styles:sr.querySelectorAll('style').length};},1200)},100)});</script></body></html>`;
}
const PAGE_JS = fs.readFileSync(path.join(CMS, 'page.js'), 'utf8');
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x');
  const send = (type, body, csp) => { r.writeHead(200, { 'content-type': type, ...(csp ? { 'content-security-policy': csp } : {}) }); r.end(body); };
  const arm = u.searchParams.get('arm'), m = u.searchParams.get('m');
  if (u.pathname === '/doc') return send('text/html', docPage(arm, m), POLICY[ARMS[arm][0]]);
  if (u.pathname === '/shadow') return send('text/html', shadowPage(arm, m), POLICY[SHADOW_ARMS[arm][0]]);
  const cm = u.pathname.match(/^\/([\w-]+)\.css$/); if (cm && CSS[cm[1]]) return send('text/css', CSS[cm[1]]);
  if (u.pathname === '/page.js') return send('text/javascript', PAGE_JS);
  if (u.pathname === '/baro.js') return send('text/javascript', fs.readFileSync(FILES.baro));
  if (u.pathname === '/twb.js') return send('text/javascript', fs.readFileSync(FILES.twb));
  r.writeHead(404); r.end();
});
await new Promise((ok) => srv.listen(PORT, '127.0.0.1', ok));
const { chromium } = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');
const browser = await chromium.launch({ executablePath: process.env.CHROME });
async function run(kind, arm, m) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
  const cons = [];
  p.on('console', (msg) => { if (/Content Security Policy/i.test(msg.text())) cons.push(msg.text().slice(0, 140)); });
  p.on('pageerror', (e) => cons.push('pageerror ' + String(e).slice(0, 120)));
  await p.goto(`http://127.0.0.1:${PORT}/${kind}?arm=${encodeURIComponent(arm)}&m=${m}`);
  const r = await p.waitForFunction(() => window.__r, null, { timeout: 20000 }).then((x) => x.jsonValue()).catch(() => ({ error: 'no report' }));
  const viol = await p.evaluate(() => window.__viol || []);
  await p.close();
  return { ...r, viol, cons };
}
const parity = (a, b) => (!a || !b || a.length !== b.length ? null : a.filter((row, i) => JSON.stringify(row) === JSON.stringify(b[i])).length / a.length);
const out = { document: {}, shadow: {} };
for (const [kind, arms] of [['doc', ARMS], ['shadow', SHADOW_ARMS]]) {
  for (const m of MODELS) {
    const ref = await run(kind, 'ref', m);
    for (const arm of Object.keys(arms)) {
      const r = arm === 'ref' ? ref : await run(kind, arm, m);
      const row = (out[kind === 'doc' ? 'document' : 'shadow'][arm] ||= { parity: [], violations: 0, samples: [] });
      row.parity.push(parity(r.blockSig, ref.blockSig));
      row.violations += r.viol.length;
      row.samples.push(...new Set([...r.viol, ...r.cons]));
      if (r.error) row.samples.push(r.error);
    }
  }
}
await browser.close(); srv.close();
for (const [kind, rows] of Object.entries(out)) for (const [arm, v] of Object.entries(rows)) {
  v.samples = [...new Set(v.samples)].slice(0, 3);
  console.log(kind.padEnd(8), arm.padEnd(36), 'parity', v.parity.map((x) => (x == null ? 'n/a' : x.toFixed(3))).join('/'), 'violations', v.violations, v.samples.join(' | ').slice(0, 160));
}
fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1));
