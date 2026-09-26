// #320 embedded AI widget probe: does BaroCSS style a widget embedded in a non-Tailwind host page (no iframe)?
// Rerun (repo root, after pnpm --filter @barocss/kit build:library && pnpm --filter @barocss/browser build:library):
//   TWB_DIR=<dir of @tailwindcss/browser> PW_DIR=<dir containing node_modules/playwright-core> CHROME=<chromium> \
//     [PROBE_PORT=7020] node scripts/embed-probe/run.mjs
// Host = own CSS (Georgia/brown scheme, h1/p/button/a element styles, colliding .container/.hidden/.flex). After load,
// page.js embeds N widgets (the 6 opus #253 blocks, scripts/cms-probe/blocks) as: open shadow root on <ai-widget> |
// closed shadow root | plain <div>. Arms: ref (full Tailwind 4.1 build of the widget classes: <style> inside each shadow
// root, <link> in head for div) | baroDefault (baroStart(), documented default) | baroRoute (best TODAY: shadow ->
// new BrowserRuntime({ insertionPoint: <div> inside the shadow root, config.preflight:false }).observe(wrapper);
// div -> getRuntime({ config.preflight:false }).observe(container)) | baroRoot (#327: shadow -> new BrowserRuntime({ root: sr }); div -> document mode observing the container) | twb (@tailwindcss/browser; document-only, no
// shadow/root option in its source) | none (baseline for host damage).
// parity = widget elements equal to ref in the same mode; widgetDmg = elements differing from the widget rendered by the
// full build on a page with NO host CSS; hostDmg = host elements whose computed style differs from `none`;
// dyn = class `mt-[37px] bg-[#123456] text-[13px]` set later inside widget 0 gets styled; cost = injected CSS bytes
// (document + every shadow root; a sheet adopted by several roots counted once, #327) and insert->stable ms at N=1/5/20.
// SUMMARY (2026-09-26, 1 run, Chromium 1223, 138 widget els). parity = share of widget els identical to ref (strict, 37 props).
//   mode    arm         parity hostDmg dyn  bytes N=1/5/20     ms N=1/5/20   diff vs ref (els)
//   open    ref         1      0/9     ok   22K/109K/435K      1/1/3
//   open    baroDefault 0      8/9     no   24K flat           12/17/20      nothing styled (observer + <head> sheet stop at the shadow boundary)
//   open    baroRoute   0      0/9     ok   33K/166K/664K      47/209/743    utilities OK; font-family 138, border-style 126 (+sizes): no preflight
//   open    baroRouteP  0      8/9     ok   38K/190K/760K      36/141/742    preflight goes to document <head>: no effect in root, damages host
//   open    twb         0      8/9     no   4K flat            12/14/20      document-only, no shadow/root option
//   open    baroRoot    .819   0/9     ok   38K flat (1 shared) 49/41/65     #327 root option; rest = kit preflight vs TW (svg block, table border-color, rounded-full)
//   closed  (identical to open: the embedder holds the closed root, BrowserRuntime works the same)
//   div     ref         1      8/9     no*  22K                0/1/3         *host unlayered p{} beats layered utilities (mt/text 0px/17px)
//   div     baroDefault .536   8/9     ok   38K                56/58/81      unlayered rules win over host p{} -> differs from ref (height/color/margin)
//   div     baroRoute   0      1/9     ok   33K                46/49/79      preflight:false -> no border reset, host font inherited
//   div     twb         1      8/9     no*  22K                27/31/47      same as ref
// Widget damage vs a no-host-CSS render: every arm inherits host font-family (138/138) unless preflight sets it on :host;
// host color leaks into 57 els even for ref. Existing route: BrowserRuntime({ insertionPoint: HTMLElement inside the
// ShadowRoot }) + observe(wrapper inside the root). Gap: preflight is hard-wired to ownerDocument.head
// (style-partition-manager createNewCategoryPartition atDocumentStart) -> a root-scoped preflight (:host / root
// selectors, in the root's <style>/adoptedStyleSheets) plus sharing one sheet across N roots (bytes/time grow linearly).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const req = createRequire(path.join(ROOT, 'packages/barocss/package.json'));
const { compile } = req('tailwindcss');
const twDir = path.dirname(req.resolve('tailwindcss/package.json'));
const PORT = Number(process.env.PROBE_PORT || 7020);
const FILES = { baro: path.join(ROOT, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs'), twb: path.join(process.env.TWB_DIR || '', 'dist/index.global.js') };
const PROPS = ['display', 'position', 'margin-top', 'margin-bottom', 'margin-left', 'padding-top', 'padding-left', 'width', 'max-width', 'height', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-transform', 'color', 'background-color', 'background-image', 'border-top-width', 'border-top-style', 'border-top-color', 'border-left-width', 'border-top-left-radius', 'box-shadow', 'opacity', 'transform', 'gap', 'grid-template-columns', 'flex-direction', 'justify-content', 'align-items', 'text-align', 'text-decoration-line', 'list-style-type', 'visibility'];
const PAGE_JS = fs.readFileSync(path.join(HERE, 'page.js'), 'utf8');
const BLOCKS = ['hero', 'feature-grid', 'callout', 'comparison-table', 'testimonial', 'cta'];
const WIDGET = BLOCKS.map((b) => `<div data-block="${b}">${fs.readFileSync(path.join(ROOT, 'scripts/cms-probe/blocks', `opus-${b}.html`), 'utf8')}</div>`).join('\n');
const toks = (h) => [...h.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/).filter(Boolean));
async function build(tokens) {
  const c = await compile('@import "tailwindcss";', {
    base: twDir,
    loadStylesheet: async (id, base) => {
      const p = id === 'tailwindcss' ? path.join(twDir, 'index.css') : path.resolve(base, id);
      return { path: p, base: path.dirname(p), content: fs.readFileSync(p, 'utf8') };
    },
  });
  return c.build([...new Set(tokens)]);
}
const REF = await build([...toks(WIDGET), 'widget-root', 'mt-[37px]', 'bg-[#123456]', 'text-[13px]']);
const HOST_CSS = `body{font-family:Georgia,serif;color:#4a2f1b;background:#fbf6ee;margin:24px;line-height:1.7}
h1{font-size:40px;color:#7a1f1f;margin:0 0 12px;font-weight:600} p{margin:0 0 14px;font-size:17px}
button{background:#7a1f1f;color:#fff;border:0;border-radius:3px;padding:8px 18px;font:inherit}
a{color:#b5470b;text-decoration:underline dotted}
.container{max-width:640px;border:3px double #7a1f1f;padding:10px}
.hidden{opacity:.45;font-style:italic} .flex{font-weight:800;letter-spacing:.05em;color:#224}`;
const HOST = `<header data-host class="container"><h1 data-host>Host Gazette</h1><p data-host class="hidden">Muted host note</p>
<p data-host class="flex">Host "flex" label</p><p data-host>Body text with <a data-host href="#">a host link</a>.</p>
<button data-host>Host button</button><ul data-host><li data-host>item</li></ul></header><main id="widgets"></main>`;
const head = (arm, mode, hostCss) => `${hostCss ? `<style data-hostcss>${HOST_CSS}</style>` : '<style data-hostcss>body{margin:24px}</style>'}${arm === 'ref' && mode === 'div' ? '<link rel="stylesheet" href="/ref.css">' : ''}${arm === 'twb' ? '<script src="/twb.js"></script>' : ''}${arm.startsWith('baro') ? '<script src="/baro.js"></script>' : ''}`;
const page = (arm, mode, n, hostCss = true) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=1280">${head(arm, mode, hostCss)}
<style data-hostcss>*,*::before,*::after{animation:none!important;transition:none!important}</style>
<script>window.__PROBE=${JSON.stringify({ arm, mode, n, html: WIDGET, refCss: REF + '\n*,*::before,*::after{animation:none!important;transition:none!important}' }).replace(/</g, '\\u003c')};</script>
<script src="/page.js"></script></head><body>${HOST}${arm === 'baroDefault' ? '<script>BaroCSS.baroStart()</script>' : ''}</body></html>`;
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x'), s = u.searchParams;
  const send = (type, body) => { r.writeHead(200, { 'content-type': type }); r.end(body); };
  if (u.pathname === '/app') return send('text/html', page(s.get('arm'), s.get('mode'), +s.get('n'), s.get('host') !== '0'));
  if (u.pathname === '/ref.css') return send('text/css', REF);
  if (u.pathname === '/page.js') return send('text/javascript', PAGE_JS);
  if (u.pathname === '/baro.js') return send('text/javascript', fs.readFileSync(FILES.baro));
  if (u.pathname === '/twb.js') return send('text/javascript', fs.readFileSync(FILES.twb));
  r.writeHead(404); r.end();
});
await new Promise((ok) => srv.listen(PORT, '127.0.0.1', ok));
const { chromium } = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');
const browser = await chromium.launch({ executablePath: process.env.CHROME });
async function visit(q) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
  await p.goto(`http://127.0.0.1:${PORT}/app?${q}`);
  const r = await p.waitForFunction(() => window.__r, null, { timeout: 30000 }).then((x) => x.jsonValue()).catch(() => ({ error: 'no report' }));
  await p.close(); return { errs, ...r };
}
const MODES = ['open', 'closed', 'div'], ARMS = ['ref', 'baroDefault', 'baroRoute', 'baroRouteP', 'baroRoot', 'twb', 'none'], NS = [1, 5, 20];
const clean = await visit('arm=ref&mode=div&n=1&host=0');
const raw = {};
for (const mode of MODES) for (const arm of ARMS) for (const n of NS) raw[`${mode}/${arm}/${n}`] = await visit(`arm=${arm}&mode=${mode}&n=${n}`);
await browser.close(); srv.close();

function props(a, b) { const c = {}; a.forEach((row, i) => row.forEach((v, j) => { if (v !== b[i][j]) c[PROPS[j]] = (c[PROPS[j]] || 0) + 1; })); return Object.entries(c).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([k, v]) => k + ':' + v).join(' '); }
function diff(a, b) { if (!a || !b || a.length !== b.length) return null; let bad = 0; a.forEach((row, i) => { if (row.some((v, j) => v !== b[i][j])) bad++; }); return bad; }
const rows = [];
for (const mode of MODES) for (const arm of ARMS.filter((a) => a !== 'none')) {
  const r = raw[`${mode}/${arm}/1`], ref = raw[`${mode}/ref/1`], none = raw[`${mode}/none/1`], N = r.widgetSig?.length;
  rows.push({ mode, arm, parity: +(1 - diff(r.widgetSig, ref.widgetSig) / N).toFixed(3), widgetDmg: `${diff(r.widgetSig, clean.widgetSig)}/${N}`,
    hostDmg: `${diff(r.hostSig, none.hostSig)}/${r.hostSig.length}`, dyn: r.dyn.join(' '),
    bytes: NS.map((n) => raw[`${mode}/${arm}/${n}`].bytesAfter).join('/'), ms: NS.map((n) => Math.round(raw[`${mode}/${arm}/${n}`].insertToFinalMs)).join('/'),
    cleanTop: props(r.widgetSig, clean.widgetSig), top: arm === 'ref' ? '' : props(r.widgetSig, ref.widgetSig), errs: [...new Set(NS.flatMap((n) => raw[`${mode}/${arm}/${n}`].errs || []))].slice(0, 2) });
}
fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ question: '#320', rows, clean: { els: clean.widgetSig?.length } }, null, 1));
console.log('widget els', clean.widgetSig?.length, 'ref css bytes', REF.length, 'baro gz', 'n/a');
for (const x of rows) console.log(x.mode.padEnd(6), x.arm.padEnd(11), String(x.parity).padEnd(6), x.widgetDmg.padEnd(8), x.hostDmg.padEnd(5), x.dyn.padEnd(40), x.bytes.padEnd(22), x.ms, x.errs.join('|'));
for (const x of rows) console.log('  diff', x.mode, x.arm, 'vsRef:', x.top, '| vsClean:', x.cleanTop);
