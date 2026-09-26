// #266 SSR FOUC probe: do server-rendered pages with runtime (CMS) classes flash unstyled before the client runtime
// starts, and does @barocss/server at request time close that gap?
// Rerun (repo root, after build:library of packages/barocss, barocss-browser, barocss-server):
//   PW_DIR=<dir containing node_modules/playwright-core> CHROME=<chromium> [PROBE_PORT=6526] node scripts/ssr-probe/run.mjs [runs=3]
// Plain node:http SSR: each request renders #253's frozen CMS blocks (scripts/cms-probe/blocks) INTO the #253 shell HTML
// (no client insertion). Build CSS = Tailwind 4.1.13 compile() over shell classes only (same as #253 "build").
// Arms: build | client-end (build + #242 companion recipe, script at end of body) | client-head (same, <script defer> in head)
//       | server (build + #268 generateCssForHtml(html, { skip: buildCss }) inlined as ssrStyleTag()) | both (server + client-end)
//       | tw-compile (Tailwind 4 compile().build() over the response classes at request time, inlined). Reference = a Tailwind
// build that also compiled the block classes and the later addition. probe.js inserts a later block at load+1s (new classes
// plus sm:grid-cols-5 / sm:px-7 against the server's lg:grid-cols-3 / lg:px-8) to check combined order after hydration.
// Throttling via CDP: CPU 4x, network "Fast 3G" (562.5ms RTT, 1.44 Mbps down); all responses gzip'd.
// Writes result.json (gitignored) and prints the summary table. DUPKEYS=1 prints the duplicate rule keys.
// SUMMARY #268 (2026-09-26, 3 runs, median, opus / haiku; match = share of block els equal to the reference, 15 props;
// hydrated = last frame before the addition; dupRules = class rules repeated across inline sheets (server + client)):
//   arm          match@FCP  hydrated  afterAdd    dupRules  htmlB          server ms warm (cold)
//   build        .19/.23    .19/.23   .19/.23     0         19382/16945    0.004
//   client-end   .19/.23    1/1       1/1         0         19967/17530    0
//   server       1/1        1/1       .986/.978   0         34009/29918    0.18/0.11 (19.8/16.2)
//   both         1/1        1/1       1/1         0         34594/30503    0.18/0.11 (19.8/16.2)
//   tw-compile   1/1        1/1       .986/.978   0         55251/52814    0.08/0.05 (4.6/2.6; warm build() is cumulative)
// Server sheet vs build: 14595/12941 B; re-emitted build classes/vars/@property/@layer = 0/0/0/0 (tw-compile: 26/20/17/1,
// 22/17/16/1). Before #268 "both" ended at .985 (client sheet appended after the server sheet broke sm/lg order).
import http from 'node:http';
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { SHELL, SITE_CSS, BRAND, ACCENT, FONTS } from '../cms-probe/site.mjs';

// workspace @barocss/kit exports src/*.ts; point the server dist at the kit dist (what a published install resolves).
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) { return s === '@barocss/kit' ? n(${JSON.stringify(new URL('../../packages/barocss/dist/index.js', import.meta.url).href)}, c) : n(s, c); }`));
const { ServerRuntime, ssrStyleTag, parseCssDefinitions } = await import('../../packages/barocss-server/dist/index.es.js');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const req = createRequire(path.join(ROOT, 'packages/barocss/package.json'));
const { compile } = req('tailwindcss');
const twDir = path.dirname(req.resolve('tailwindcss/package.json'));
const PORT = Number(process.env.PROBE_PORT || 6526);
const RUNS = Number(process.argv[2] || 3);
const ARMS = ['build', 'client-end', 'client-head', 'server', 'both', 'tw-compile'];
const BARO_JS = fs.readFileSync(path.join(ROOT, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs'));
const MODELS = ['opus', 'haiku'], BLOCKS = ['hero', 'feature-grid', 'callout', 'comparison-table', 'testimonial', 'cta'];
const blocksDir = path.join(ROOT, 'scripts/cms-probe/blocks');
// "CMS data": block HTML per model, read once like a DB row cache; the render step composes it per request.
const DATA = Object.fromEntries(MODELS.map((m) => [m, BLOCKS.map((b) => ({ type: b, html: fs.readFileSync(path.join(blocksDir, `${m}-${b}.html`), 'utf8') }))]));
const split = (s) => (s || '').split(/\s+/).filter(Boolean);
const toks = (h) => [...h.matchAll(/class="([^"]*)"/g)].flatMap((m) => split(m[1]));
const shellTokens = toks(SHELL).concat(['prose']);
// #268 later client addition (inserted by probe.js at load+1s, after hydration): new classes, plus sm: rules for the same
// properties as the server's lg:grid-cols-3 / lg:px-8 (a client sm: rule landing after them breaks the lg override).
const ADD_HTML = '<div data-block="later" class="grid gap-4 sm:grid-cols-5 lg:grid-cols-3 p-3 sm:p-5 bg-emerald-100 rounded-2xl"><p class="text-lg md:text-3xl font-semibold text-emerald-900">Later</p><p class="px-4 sm:px-7 lg:px-8">added</p></div>';
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
for (const m of MODELS) CSS['ref-' + m] = await build([...shellTokens, ...toks(DATA[m].map((b) => b.html).join('\n')), ...toks(ADD_HTML)]);

const THEME_EXT = { colors: { brand: BRAND, accent: ACCENT }, fontFamily: { display: FONTS.display.split(', '), sans: FONTS.sans.split(', ') } };
const BARO_CONFIG = { cssVarPrefix: 'tw', theme: { extend: THEME_EXT } };
const BOOT = `var rt = BaroCSS.getRuntime({ skipExisting: true, config: ${JSON.stringify(BARO_CONFIG)} }); rt.observe(document.body, { scan: true });`;
let sharedRt = new ServerRuntime(BARO_CONFIG);

// #268 server companion: generateCssForHtml over the response HTML, skip = the build CSS (classes, theme vars, @property).
function serverCss(bodyHtml, { rt = sharedRt } = {}) { return rt.generateCssForHtml(bodyHtml, { skip: CSS.build }); }
// tw-compile: Tailwind 4 compile() at request time over this response's classes (warm = one compiler reused, whose build()
// is cumulative across requests; cold = compile() per request). Full output: its own theme/@property/@layer/preflight.
let twCompiler = null;
async function twCompiler0() { return compile(`@import "tailwindcss";\n${SITE_CSS}`, { base: twDir, loadStylesheet: async (id, base) => {
  const p = id === 'tailwindcss' ? path.join(twDir, 'index.css') : path.resolve(base, id.replace(/^tailwindcss\//, ''));
  const file = fs.existsSync(p) ? p : path.join(twDir, id.replace(/^tailwindcss\//, ''));
  return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') }; } }); }
async function twCss(bodyHtml, cold = false) { const c = cold ? await twCompiler0() : (twCompiler ??= await twCompiler0()); return c.build([...new Set(toks(bodyHtml))]); }
const PROBE = fs.readFileSync(path.join(HERE, 'probe.js'), 'utf8');
async function render(arm, m, opts = {}) {
  const blocks = DATA[m].map((b) => `<div data-block="${b.type}">${b.html}</div>`).join('\n');
  const body = SHELL.replace('<div id="blocks"></div>', `<div id="blocks">${blocks}</div>`);
  const srvCss = arm === 'server' || arm === 'both' ? ssrStyleTag(serverCss(blocks, opts))
    : arm === 'tw-compile' ? ssrStyleTag(await twCss(blocks, opts.cold)) : '';
  const headJs = arm === 'client-head' ? '<script defer src="/baro.js"></script><script defer src="/boot.js"></script>' : '';
  const tailJs = arm === 'client-end' || arm === 'both' ? `<script src="/baro.js"></script><script>${BOOT}</script>` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=1280"><script>window.__ADD=${JSON.stringify(ADD_HTML)};${PROBE}</script>
<link rel="stylesheet" href="/${arm === 'ref' ? 'ref-' + m : 'build'}.css">${srvCss}${headJs}<style>*,*::before,*::after{animation:none!important;transition:none!important}</style>
</head><body>${body}${tailJs}</body></html>`;
}

// ---- server render time (in-process, median of 50) ----
const med = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
async function timeRender(arm, m, opts, n = 50) { const t = []; for (let i = 0; i < n; i++) { const t0 = performance.now(); await render(arm, m, opts); t.push(performance.now() - t0); } return med(t); }
const serverMs = {};
for (const m of MODELS) {
  serverMs[m] = { build: await timeRender('build', m), serverWarm: await timeRender('server', m), twWarm: await timeRender('tw-compile', m, {}, 20) };
  serverMs[m].serverCold = await timeRender('server', m, { get rt() { return new ServerRuntime(BARO_CONFIG); } });
  serverMs[m].twCold = await timeRender('tw-compile', m, { cold: true }, 10);
}
// ---- server sheet vs build: duplicate classes and re-emitted build definitions ----
const BUILD_DEFS = parseCssDefinitions(CSS.build);
const dups = {};
for (const m of MODELS) {
  const blocks = DATA[m].map((b) => b.html).join('\n'), cls = [...new Set(toks(blocks))];
  const reemit = (css) => { const d = parseCssDefinitions(css);
    return { classes: [...d.classes].filter((c) => BUILD_DEFS.classes.has(c)).length, vars: [...d.vars].filter((v) => BUILD_DEFS.vars.has(v)).length,
      props: [...d.properties].filter((v) => BUILD_DEFS.properties.has(v)).length, layer: d.layerStatement ? 1 : 0 }; };
  const s1 = serverCss(blocks), tw = await twCss(blocks, true);
  dups[m] = { classes: cls.length, overlapBuild: cls.filter((c) => BUILD_DEFS.classes.has(c)).length, bytesServer: s1.length, bytesTw: tw.length,
    serverReemit: reemit(s1), twReemit: reemit(tw), emptyClasses: cls.filter((c) => !BUILD_DEFS.classes.has(c) && !sharedRt.generateCss(c)).length };
}

const gzCache = new Map();
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x');
  const send = (type, body) => { const g = zlib.gzipSync(body); r.writeHead(200, { 'content-type': type, 'content-encoding': 'gzip' }); r.end(g); };
  if (u.pathname === '/app') return render(u.searchParams.get('arm'), u.searchParams.get('m')).then((h) => send('text/html', h));
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
const raw = [], refSig = {}, refPre = {};
for (const m of MODELS) { const r = await visit('ref', m, false); refSig[m] = r.final; refPre[m] = [...r.frames].reverse().find((f) => f.t < r.addT).sig; }
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
    const pre = [...r.frames].reverse().find((f) => f.t < r.addT); // last frame before the later client addition
    return { fcp: r.fcp, matchAtFcp: match(fp.sig, refPre[m]), hydrated: pre ? match(pre.sig, refPre[m]) : null, finalMatch: fm, dupRules: r.dupRules, unstyledMs: styled ? Math.max(0, styled.t - r.fcp) : null, cls: r.cls, lcp: r.lcp,
      htmlB: r.byType.document || 0, cssB: r.byType.stylesheet || 0, jsB: r.byType.script || 0, runtimeBytes: r.runtimeBytes };
  });
  const k = (f) => med(runs.map(f));
  const r0 = raw.find((r) => r.m === m && r.arm === arm); if (process.env.DUPKEYS) console.log(m, arm, 'dup rule keys', JSON.stringify(r0.dupKeys)); if (arm.startsWith('server') || arm === 'both' || arm === 'tw-compile') console.log(m, arm, 'final diffs by prop', JSON.stringify(diffProps(r0.final, refSig[m])));
  rows.push({ m, arm, fcp: k((x) => x.fcp), matchAtFcp: k((x) => x.matchAtFcp), hydrated: k((x) => x.hydrated), finalMatch: k((x) => x.finalMatch), dupRules: k((x) => x.dupRules), unstyledMs: k((x) => x.unstyledMs),
    cls: k((x) => x.cls), lcp: k((x) => x.lcp), htmlB: k((x) => x.htmlB), cssB: k((x) => x.cssB), jsB: k((x) => x.jsB), runtimeBytes: k((x) => x.runtimeBytes) });
}
fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ rows, serverMs, dups, raw: raw.map(({ frames, final, ...x }) => x) }, null, 1));
const f = (v, d = 0) => (v == null ? '-' : Number(v).toFixed(d));
console.log('model arm          FCP    match@FCP hydrated afterAdd dupRules unstyledMs  CLS     LCP    htmlB cssB  jsB   runtimeCssB');
for (const r of rows) console.log(`${r.m.padEnd(5)} ${r.arm.padEnd(12)} ${f(r.fcp).padStart(5)}  ${f(r.matchAtFcp, 3)}     ${f(r.hydrated, 3)}    ${f(r.finalMatch, 3)}    ${f(r.dupRules)}        ${f(r.unstyledMs).padStart(6)}      ${f(r.cls, 4)}  ${f(r.lcp).padStart(5)}  ${f(r.htmlB).padStart(6)} ${f(r.cssB).padStart(5)} ${f(r.jsB).padStart(6)} ${f(r.runtimeBytes)}`);
console.log('serverMs', JSON.stringify(serverMs, (k, v) => (typeof v === 'number' ? +v.toFixed(3) : v)));
console.log('dups', JSON.stringify(dups));
