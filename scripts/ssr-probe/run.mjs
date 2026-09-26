// #266 SSR FOUC probe: do server-rendered pages with runtime (CMS) classes flash unstyled before the client runtime
// starts, and does @barocss/server at request time close that gap?
// Rerun (repo root, after build:library of packages/barocss, barocss-browser, barocss-server):
//   PW_DIR=<dir containing node_modules/playwright-core> CHROME=<chromium> [PROBE_PORT=6526] node scripts/ssr-probe/run.mjs [runs=3]
// Plain node:http SSR: each request renders #253's frozen CMS blocks (scripts/cms-probe/blocks) INTO the #253 shell HTML
// (no client insertion). Build CSS = Tailwind 4.1.13 compile() over shell classes only (same as #253 "build").
// Arms: build | client-end (build + #242 companion recipe, script at end of body) | client-head (same, <script defer> in head)
//       | server (build + ServerRuntime CSS for this response's classes, minus classes the build CSS defines, inlined in head)
//       | both (server + client-end). Reference signature = page with a Tailwind build that also compiled the block classes.
// Throttling via CDP: CPU 4x, network "Fast 3G" (562.5ms RTT, 1.44 Mbps down); all responses gzip'd.
// Writes result.json (gitignored) and prints the summary table.
// SUMMARY (2026-09-26, 3 runs, median, opus / haiku; match = share of block els equal to a full Tailwind build, 15 props;
// unstyled = FCP -> first frame at final match; bytes decoded, served gzip; build CSS 15653B everywhere; LCP == FCP, shell text):
//   arm          match@FCP  final      unstyledMs  CLS          htmlB          jsB     server ms warm (cold)
//   build        .19/.23    .19/.23    never       0/0          17960/15523    0       0.003
//   client-end   .19/.23    1/1        324/275     .006/.040    18545/16108    212281  0
//   client-head  .19/.23    1/1        315/266     .006/.040    18036/15599    212817  0
//   server       .80/.81    .80/.81    ~7 (stays)  0/0          36093/29519    0       10.5/7.1 (28.7/22.2)
//   server-fixed 1/1        1/1        ~9 (<1 frame) 0/0        32483/27509    0       10.5/7.1
//   both         .80/.81    .985/1     343/282     .005/.002    36678/30104    212281  10.5/7.1
// Dups vs build: 25/21 block classes already in build; unfiltered server output repeats all; app-side filter (cssClasses()
// over build CSS) -> 0. @barocss/server has no skip option. As-is output repeats :root{--color-*} per class (40/28 blocks).
// server stops at .80: generateCss defines only --color-* vars; --radius/--text/--container/--shadow-* undefined when the
// build did not use them. server-fixed (app-side, private context.themeToCssVars()) defines referenced vars once, drops
// repeated root blocks, sorts min-width media -> 1.000. "both" opus .985: client sheet appended after server re-breaks sm/lg order.
import http from 'node:http';
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { SHELL, SITE_CSS, BRAND, ACCENT, FONTS } from '../cms-probe/site.mjs';
import { cssClasses } from '../json-render-probe/pregen.mjs';

// workspace @barocss/kit exports src/*.ts; point the server dist at the kit dist (what a published install resolves).
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) { return s === '@barocss/kit' ? n(${JSON.stringify(new URL('../../packages/barocss/dist/index.js', import.meta.url).href)}, c) : n(s, c); }`));
const { ServerRuntime } = await import('../../packages/barocss-server/dist/index.es.js');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const req = createRequire(path.join(ROOT, 'packages/barocss/package.json'));
const { compile } = req('tailwindcss');
const twDir = path.dirname(req.resolve('tailwindcss/package.json'));
const PORT = Number(process.env.PROBE_PORT || 6526);
const RUNS = Number(process.argv[2] || 3);
const ARMS = ['build', 'client-end', 'client-head', 'server', 'server-fixed', 'both'];
const BARO_JS = fs.readFileSync(path.join(ROOT, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs'));
const MODELS = ['opus', 'haiku'], BLOCKS = ['hero', 'feature-grid', 'callout', 'comparison-table', 'testimonial', 'cta'];
const blocksDir = path.join(ROOT, 'scripts/cms-probe/blocks');
// "CMS data": block HTML per model, read once like a DB row cache; the render step composes it per request.
const DATA = Object.fromEntries(MODELS.map((m) => [m, BLOCKS.map((b) => ({ type: b, html: fs.readFileSync(path.join(blocksDir, `${m}-${b}.html`), 'utf8') }))]));
const split = (s) => (s || '').split(/\s+/).filter(Boolean);
const toks = (h) => [...h.matchAll(/class="([^"]*)"/g)].flatMap((m) => split(m[1]));
const shellTokens = toks(SHELL).concat(['prose']);
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
const CSS = { build: await build(shellTokens) };
for (const m of MODELS) CSS['ref-' + m] = await build([...shellTokens, ...toks(DATA[m].map((b) => b.html).join('\n'))]);
const BUILD_CLASSES = cssClasses(CSS.build); // dedupe source: class names the shipped build CSS defines (app-side parse)

const THEME_EXT = { colors: { brand: BRAND, accent: ACCENT }, fontFamily: { display: FONTS.display.split(', '), sans: FONTS.sans.split(', ') } };
const BARO_CONFIG = { cssVarPrefix: 'tw', theme: { extend: THEME_EXT } };
const BOOT = `var rt = BaroCSS.getRuntime({ skipExisting: true, config: ${JSON.stringify(BARO_CONFIG)} }); rt.observe(document.body, { scan: true });`;
let sharedRt = new ServerRuntime(BARO_CONFIG);

// Server companion: CSS for this response's classes. dedupe=true skips classes the build CSS already defines.
function serverCss(bodyHtml, { dedupe = true, rt = sharedRt } = {}) {
  const classes = [...new Set(toks(bodyHtml))].filter((c) => !dedupe || !BUILD_CLASSES.has(c));
  return rt.generateCssForClasses(classes).map((x) => x.css).filter(Boolean).join('\n');
}
// server-fixed = app-side workaround for the two server gaps found: (1) generateCss defines only --color-* vars, so
// --radius-*/--text-*/--container-*/--shadow-* used by the output are undefined when the build did not emit them;
// (2) per-class output repeats :root/@property blocks and keeps first-seen order (sm/lg media not sorted).
// Reads the private ServerRuntime.context.themeToCssVars() — the missing public API.
function serverCssFixed(bodyHtml, rt = sharedRt) {
  const classes = [...new Set(toks(bodyHtml))].filter((c) => !BUILD_CLASSES.has(c));
  const chunks = new Set(), media = [];
  for (const c of classes) for (const ch of rt.generateCss(c).split(/\n(?=[@.:])/)) {
    if (/^:root,:host/.test(ch)) continue;
    const mm = ch.match(/^@media \(min-width: ([\d.]+)rem\)/); if (mm) media.push([+mm[1], ch]); else chunks.add(ch);
  }
  const body = [...chunks, ...[...new Set(media.map((x) => x[1]))].map((ch) => media.find((x) => x[1] === ch)).sort((a, b) => a[0] - b[0]).map((x) => x[1])].join('\n');
  const defs = new Map(); for (const m of rt.context.themeToCssVars().matchAll(/^\s*(--[\w-]+):\s*(.+);$/gm)) defs.set(m[1], m[2]);
  const refs = (t) => [...t.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]);
  const pending = refs(body), used = new Map();
  while (pending.length) { const n = pending.pop(); if (used.has(n) || !defs.has(n)) continue; used.set(n, defs.get(n)); pending.push(...refs(defs.get(n))); }
  return `:root,:host{${[...used].map(([k, v]) => `${k}:${v};`).join('')}}\n${body}`;
}
const PROBE = fs.readFileSync(path.join(HERE, 'probe.js'), 'utf8');
function render(arm, m, opts = {}) {
  const blocks = DATA[m].map((b) => `<div data-block="${b.type}">${b.html}</div>`).join('\n');
  const body = SHELL.replace('<div id="blocks"></div>', `<div id="blocks">${blocks}</div>`);
  const srvCss = arm === 'server' || arm === 'both' ? `<style data-baro-ssr>${serverCss(blocks, opts)}</style>`
    : arm === 'server-fixed' ? `<style data-baro-ssr>${serverCssFixed(blocks, opts.rt)}</style>` : '';
  const headJs = arm === 'client-head' ? '<script defer src="/baro.js"></script><script defer src="/boot.js"></script>' : '';
  const tailJs = arm === 'client-end' || arm === 'both' ? `<script src="/baro.js"></script><script>${BOOT}</script>` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=1280"><script>${PROBE}</script>
<link rel="stylesheet" href="/${arm === 'ref' ? 'ref-' + m : 'build'}.css">${srvCss}${headJs}<style>*,*::before,*::after{animation:none!important;transition:none!important}</style>
</head><body>${body}${tailJs}</body></html>`;
}

// ---- server render time (in-process, median of 50) ----
const med = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
function timeRender(arm, m, opts) { const t = []; for (let i = 0; i < 50; i++) { const t0 = performance.now(); render(arm, m, opts); t.push(performance.now() - t0); } return med(t); }
const serverMs = {};
for (const m of MODELS) {
  serverMs[m] = { build: timeRender('build', m), serverWarm: timeRender('server', m), fixedWarm: timeRender('server-fixed', m) };
  serverMs[m].serverCold = timeRender('server', m, { get rt() { return new ServerRuntime(BARO_CONFIG); } });
}
// ---- duplicates vs build ----
const dups = {};
for (const m of MODELS) {
  const blocks = DATA[m].map((b) => b.html).join('\n'), cls = [...new Set(toks(blocks))];
  const noDedupe = serverCss(blocks, { dedupe: false }), withDedupe = serverCss(blocks);
  const inBuild = (css) => [...cssClasses(css)].filter((c) => BUILD_CLASSES.has(c)).length;
  const rootBlocks = (css) => (css.match(/:root,:host \{/g) || []).length;
  dups[m] = { classes: cls.length, overlapBuild: cls.filter((c) => BUILD_CLASSES.has(c)).length, dupSelNoDedupe: inBuild(noDedupe), dupSelDedupe: inBuild(withDedupe),
    rootVarBlocks: rootBlocks(withDedupe), bytesFixed: serverCssFixed(blocks).length, dupSelFixed: inBuild(serverCssFixed(blocks)), bytesNoDedupe: noDedupe.length, bytesDedupe: withDedupe.length, emptyClasses: cls.filter((c) => !BUILD_CLASSES.has(c) && !sharedRt.generateCss(c)).length };
}

const gzCache = new Map();
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x');
  const send = (type, body) => { const g = zlib.gzipSync(body); r.writeHead(200, { 'content-type': type, 'content-encoding': 'gzip' }); r.end(g); };
  if (u.pathname === '/app') return send('text/html', render(u.searchParams.get('arm'), u.searchParams.get('m')));
  const cm = u.pathname.match(/^\/([\w-]+)\.css$/); if (cm && CSS[cm[1]]) return send('text/css', CSS[cm[1]]);
  if (u.pathname === '/baro.js') return send('text/javascript', BARO_JS);
  if (u.pathname === '/boot.js') return send('text/javascript', BOOT);
  r.writeHead(404); r.end();
});
await new Promise((ok) => srv.listen(PORT, '127.0.0.1', ok));
const { chromium } = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');
const browser = await chromium.launch({ executablePath: process.env.CHROME });
async function visit(arm, m, throttle) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  if (throttle) {
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 562.5, downloadThroughput: (1.44 * 1024 * 1024) / 8, uploadThroughput: (675 * 1024) / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  let bytes = 0; const byType = {};
  p.on('response', async (res) => { try { const h = await res.headerValue('content-length'); const b = (await res.body()).length; const t = res.request().resourceType(); byType[t] = (byType[t] || 0) + b; bytes += b; } catch {} });
  await p.goto(`http://127.0.0.1:${PORT}/app?arm=${arm}&m=${m}`, { waitUntil: 'load', timeout: 60000 });
  const r = await p.waitForFunction(() => window.__r, null, { timeout: 60000, polling: 200 }).then((x) => x.jsonValue());
  await ctx.close();
  return { ...r, byType };
}
const raw = [], refSig = {};
for (const m of MODELS) refSig[m] = (await visit('ref', m, false)).final;
for (const m of MODELS) for (const arm of ARMS) for (let i = 0; i < RUNS; i++) raw.push({ m, arm, i, ...(await visit(arm, m, true)) });
await browser.close(); srv.close();

const match = (sig, ref) => { if (!sig || sig.length !== ref.length) return 0; let ok = 0; sig.forEach((s, i) => { if (s === ref[i]) ok++; }); return ok / ref.length; };
const PN = ['display', 'padding-top', 'padding-left', 'margin-top', 'font-size', 'font-weight', 'color', 'background-color',
  'border-top-width', 'border-top-left-radius', 'grid-template-columns', 'gap', 'max-width', 'text-align', 'box-shadow'];
const diffProps = (sig, ref) => { const c = {}; sig.forEach((s, i) => { const a = s.split('|'), b = ref[i].split('|'); a.forEach((v, j) => { if (v !== b[j]) c[PN[j]] = (c[PN[j]] || 0) + 1; }); }); return c; };
const rows = [];
for (const m of MODELS) for (const arm of ARMS) {
  const runs = raw.filter((r) => r.m === m && r.arm === arm).map((r) => {
    const fm = match(r.final, refSig[m]);
    const fp = r.frames.find((f) => f.t >= r.fcp) || r.frames[r.frames.length - 1]; // first frame painted at/after FCP
    const styled = r.frames.find((f) => f.t >= r.fcp && match(f.sig, refSig[m]) >= fm - 1e-9);
    return { fcp: r.fcp, matchAtFcp: match(fp.sig, refSig[m]), finalMatch: fm, unstyledMs: styled ? Math.max(0, styled.t - r.fcp) : null, cls: r.cls, lcp: r.lcp,
      htmlB: r.byType.document || 0, cssB: r.byType.stylesheet || 0, jsB: r.byType.script || 0, runtimeBytes: r.runtimeBytes };
  });
  const k = (f) => med(runs.map(f));
  const r0 = raw.find((r) => r.m === m && r.arm === arm); if (arm.startsWith('server') || arm === 'both') console.log(m, arm, 'final diffs by prop', JSON.stringify(diffProps(r0.final, refSig[m])));
  rows.push({ m, arm, fcp: k((x) => x.fcp), matchAtFcp: k((x) => x.matchAtFcp), finalMatch: k((x) => x.finalMatch), unstyledMs: k((x) => x.unstyledMs),
    cls: k((x) => x.cls), lcp: k((x) => x.lcp), htmlB: k((x) => x.htmlB), cssB: k((x) => x.cssB), jsB: k((x) => x.jsB), runtimeBytes: k((x) => x.runtimeBytes) });
}
fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ rows, serverMs, dups, raw: raw.map(({ frames, final, ...x }) => x) }, null, 1));
const f = (v, d = 0) => (v == null ? '-' : Number(v).toFixed(d));
console.log('model arm          FCP    match@FCP final  unstyledMs  CLS     LCP    htmlB cssB  jsB   runtimeCssB');
for (const r of rows) console.log(`${r.m.padEnd(5)} ${r.arm.padEnd(12)} ${f(r.fcp).padStart(5)}  ${f(r.matchAtFcp, 3)}     ${f(r.finalMatch, 3)}  ${f(r.unstyledMs).padStart(6)}      ${f(r.cls, 4)}  ${f(r.lcp).padStart(5)}  ${f(r.htmlB).padStart(6)} ${f(r.cssB).padStart(5)} ${f(r.jsB).padStart(6)} ${f(r.runtimeBytes)}`);
console.log('serverMs', JSON.stringify(serverMs, (k, v) => (typeof v === 'number' ? +v.toFixed(3) : v)));
console.log('dups', JSON.stringify(dups));
