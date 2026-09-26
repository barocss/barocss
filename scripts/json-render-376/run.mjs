// #376 harness: json-render vs A2UI vs BaroCSS companion (HTML + utilities) vs a throwaway BaroCSS-native sketch.
// Rerun (repo root, after `pnpm build:library` and the scratch installs described in NOTES.md):
//   PW_DIR=<dir containing node_modules/playwright-core> CHROME=<chromium> [PROBE_PORT=7400] node scripts/json-render-376/run.mjs
// Inputs: outputs/*.txt (frozen model outputs from gen.mjs), refs.mjs (human references). Writes result.json.
// Rendering: official renderers (@json-render/react Renderer, @a2ui/react A2uiSurface) bundled with esbuild; one CSS
// for everything: Tailwind 4 compile() over every class token seen + theme.css (+ A2UI's own CSS mapped to the theme).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { HERE, ROOT, SCR, bundle, REQS, FORMATS, MODELS } from './lib.mjs';
import { REFS } from './refs.mjs';
import { validate, partialJSON, checkToken } from './native.mjs';

const req = createRequire(path.join(ROOT, 'packages/barocss/package.json'));
const { compile } = req('tailwindcss');
const twDir = path.dirname(req.resolve('tailwindcss/package.json'));
const PORT = Number(process.env.PROBE_PORT || 7400), CPORT = PORT + 1;
const X = `http://localhost:${CPORT}`;

await bundle('app-jr.jsx', 'jr', path.join(SCR, 'jr.js'));
await bundle('app-a2.jsx', 'a2', path.join(SCR, 'a2.js'));
const A2CSS = fs.readFileSync(path.join(SCR, 'a2/node_modules/@a2ui/react/v0_9/index.css'), 'utf8');
// A competent integrator maps A2UI's CSS variables onto the host theme (the only styling hook A2UI offers).
const A2MAP = `:root{--a2ui-color-primary:var(--primary);--a2ui-color-on-primary:var(--primary-foreground);--a2ui-color-primary-hover:var(--primary);--a2ui-color-secondary:var(--secondary);--a2ui-color-on-secondary:var(--secondary-foreground);--a2ui-color-secondary-hover:var(--accent);--a2ui-color-surface:var(--card);--a2ui-color-on-surface:var(--card-foreground);--a2ui-color-background:var(--background);--a2ui-color-on-background:var(--foreground);--a2ui-color-border:var(--border);--a2ui-color-border-hover:var(--ring);--a2ui-color-input:var(--background);--a2ui-color-on-input:var(--foreground);--a2ui-border-radius:var(--radius);--a2ui-card-border-radius:calc(var(--radius) + 4px);--a2ui-button-border-radius:calc(var(--radius) - 2px);--a2ui-textfield-border-radius:calc(var(--radius) - 2px)}`;

// ---- load outputs + adversarial fixtures (generic shapes only)
const read = (f) => fs.readFileSync(path.join(HERE, 'outputs', f), 'utf8');
const ADV = {
  companion: `<div id="adv"><img src="/nope.png" onerror="window.__pwn=1"><a href="javascript:window.__pwn=2">x</a><style>#host-sentinel{color:rgb(255,0,0)!important}</style><div class="fixed inset-0 z-50 bg-background">overlay</div><div class="h-4 bg-[url(${X}/c-bg)]"></div><img src="${X}/c-img"><p class="[body_&]:hidden">t</p></div>`,
  'json-render': [
    { op: 'add', path: '/root', value: 'r' },
    { op: 'add', path: '/elements/r', value: { type: 'Stack', props: { className: 'fixed inset-0 z-50 bg-background' }, children: ['t', 'u', 's'] } },
    { op: 'add', path: '/elements/t', value: { type: 'Text', props: { text: '<img src=x onerror="window.__pwn=1">', className: `h-4 bg-[url(${X}/jr-bg)]` } } },
    { op: 'add', path: '/elements/u', value: { type: 'Script', props: { src: `${X}/jr-script` } } },
    { op: 'add', path: '/elements/s', value: { type: 'Button', props: { label: 'x', className: '[body_&]:hidden' } } },
  ].map((o) => JSON.stringify(o)).join('\n'),
  a2ui: [
    { version: 'v0.9', createSurface: { surfaceId: 'main', catalogId: 'x' } },
    { version: 'v0.9', updateComponents: { surfaceId: 'main', components: [
      { id: 'root', component: 'Column', children: ['i', 't', 'm', 'u'] }, { id: 'i', component: 'Image', url: `${X}/a2-img` },
      { id: 't', component: 'Text', text: '<img src=x onerror="window.__pwn=1">' }, { id: 'm', component: 'Text', text: '[x](javascript:window.__pwn=2)' },
      { id: 'u', component: 'Script', src: `${X}/a2-script` }] } },
  ].map((o) => JSON.stringify(o)).join('\n'),
  native: JSON.stringify({ el: 'div', class: 'fixed inset-0 z-50 bg-background', children: [
    { el: 'img', attrs: { src: `${X}/n-img`, onerror: 'window.__pwn=1' } }, { el: 'a', attrs: { href: 'javascript:window.__pwn=2' }, text: 'x' },
    { el: 'script', text: 'window.__pwn=3' }, { el: 'div', class: `h-4 bg-[url(${X}/n-bg)]` }, { el: 'p', class: '[body_&]:hidden', text: 't' }] }),
};
const split = (s) => (s || '').split(/\s+/).filter(Boolean);
function classTokens(fmt, text) {
  if (fmt === 'companion' || fmt === 'ref') return [...text.matchAll(/class(?:Name)?="([^"]*)"/g)].flatMap((m) => split(m[1]));
  if (fmt === 'json-render') return [...text.matchAll(/"className"\s*:\s*"((?:[^"\\]|\\.)*)"/g)].flatMap((m) => split(m[1]));
  if (fmt === 'native') return [...text.matchAll(/"class"\s*:\s*"((?:[^"\\]|\\.)*)"/g)].flatMap((m) => split(m[1]));
  return [];
}
const UNSAFE = /<script|\son\w+\s*=|javascript:|<style|<iframe|\bfixed\b|url\(|https?:\/\//i;
const items = [];
for (const f of FORMATS) for (const m of MODELS) for (const k of Object.keys(REQS)) items.push({ f, m, k, text: read(`${f}--${m}--${k}.txt`) });
const candidates = new Set();
for (const t of Object.values(REFS)) classTokens('ref', t).forEach((x) => candidates.add(x));
for (const it of items) classTokens(it.f, it.text).forEach((x) => candidates.add(x));
for (const f of Object.keys(ADV)) classTokens(f, ADV[f]).forEach((x) => candidates.add(x));
for (const file of ['app-jr.jsx', 'page.js']) (fs.readFileSync(path.join(HERE, file), 'utf8').match(/[\w:/.[\]()%-]+/g) || []).forEach((x) => candidates.add(x));
const c = await compile(`@import "tailwindcss";\n${fs.readFileSync(path.join(HERE, 'theme.css'), 'utf8')}`, {
  base: twDir,
  loadStylesheet: async (id, base) => {
    const p = id === 'tailwindcss' ? path.join(twDir, 'index.css') : path.resolve(base, id.replace(/^tailwindcss\//, ''));
    const file = fs.existsSync(p) ? p : path.join(twDir, id.replace(/^tailwindcss\//, ''));
    return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
  },
});
const CSS = c.build([...candidates]) + '\n' + A2CSS + '\n' + A2MAP;

// ---- server + counting endpoint
const hits = [];
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style><script src="/jr.js"></script><script src="/a2.js"></script><script src="/page.js"></script></head>
<body class="p-6"><header class="mb-4 flex items-center gap-4 border-b border-border pb-2"><span id="host-sentinel" class="text-foreground text-sm">Host app</span></header><main id="mount" class="max-w-5xl"></main></body></html>`;
const srv = http.createServer((q, r) => {
  const u = q.url.split('?')[0];
  if (u === '/') { r.setHeader('content-type', 'text/html'); return r.end(html); }
  const f = { '/jr.js': path.join(SCR, 'jr.js'), '/a2.js': path.join(SCR, 'a2.js'), '/page.js': path.join(HERE, 'page.js') }[u];
  if (f) { r.setHeader('content-type', 'text/javascript'); return r.end(fs.readFileSync(f)); }
  r.statusCode = 404; r.end();
}).listen(PORT, '127.0.0.1');
const csrv = http.createServer((q, r) => { hits.push(q.url); r.statusCode = 204; r.end(); }).listen(CPORT, 'localhost');
const pw = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');
const browser = await pw.chromium.launch({ executablePath: process.env.CHROME });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
async function RUN(arg) {
  await page.goto(`http://127.0.0.1:${PORT}/`);
  const r = await page.evaluate((a) => window.RUN(a), arg);
  if (arg.wait) { await page.waitForTimeout(arg.wait); Object.assign(r.safety, await page.evaluate(() => window.SAFETY())); }
  return r;
}

// ---- references
const refs = {};
for (const [k, t] of Object.entries(REFS)) { const r = await RUN({ fmt: 'ref', req: k, text: t }); refs[k] = { structural: r.structural.score, visual: r.visual.score, items: { ...r.structural.items, ...r.visual.items } }; }

// ---- model outputs
const rows = [];
function prep(it, text) {
  if (it.f !== 'native') return { text };
  const j = partialJSON(text); if (!j) return { text, tree: null };
  const v = validate(j); return { text, tree: v.node, st: v.st };
}
for (const it of items) {
  const p = prep(it, it.text);
  const r = await RUN({ fmt: it.f, req: it.k, ...p });
  const toks = classTokens(it.f, it.text); const cls = toks.map(checkToken);
  const offTheme = cls.filter((x) => x === 'off-theme' || x === 'arbitrary').length;
  const inlineStyle = (it.text.match(/style=\\?"/g) || []).length + (it.f === 'a2ui' ? (it.text.match(/"(style|className|color|theme)"\s*:/g) || []).length : 0);
  // streaming: render prefixes (25/50/75% of chars) with the format's own incremental path
  const stream = [];
  for (const q of [0.25, 0.5, 0.75]) {
    const pre = it.text.slice(0, Math.floor(it.text.length * q)); const pp = prep(it, pre);
    const s = await RUN({ fmt: it.f, ...pp, measureIt: false });
    stream.push(r.visText ? Math.min(1, (s.visText || 0) / r.visText) : 0);
  }
  rows.push({ fmt: it.f, model: it.m, req: it.k, ok: !!r.ok && r.visText > 0, error: r.error || r.validateError || null,
    structural: r.structural?.score ?? 0, visual: r.visual?.score ?? 0, items: { ...(r.structural?.items || {}), ...(r.visual?.items || {}) },
    tokens: toks.length, offTheme, unresolved: cls.filter((x) => x === 'unresolved').length, inlineStyle, nativeDropped: p.st || null,
    unsafeInOutput: UNSAFE.test(it.text.replace(/https?:\/\/(www\.w3\.org\/2000\/svg|a2ui\.org\/specification\/[\w/.]+)/g, '')), textSample: r.textSample, stream, streamFirstQuarter: stream[0] > 0, visText: r.visText });
  process.stdout.write('.');
}
console.log();
// ---- adversarial
const adv = {};
for (const f of FORMATS) {
  const h0 = hits.length; const it = { f };
  const r = await RUN({ fmt: f, ...prep(it, ADV[f]), measureIt: false, wait: 400 });
  adv[f] = { scriptOrHandlerRan: r.safety.pwn, overlayCoversHost: r.safety.overlay, hostStyleChanged: r.safety.hostStyle, crossOriginRequests: hits.slice(h0), error: r.error || null };
}
await browser.close(); srv.close(); csrv.close();

// ---- aggregate
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const r2 = (x) => Math.round(x * 100) / 100;
const summary = {};
for (const f of FORMATS) for (const m of [...MODELS, 'all']) {
  const R = rows.filter((x) => x.fmt === f && (m === 'all' || x.model === m));
  const tok = R.reduce((a, x) => a + x.tokens, 0);
  summary[`${f}/${m}`] = {
    structural: r2(mean(R.map((x) => x.structural))), visual: r2(mean(R.map((x) => x.visual))),
    expressible: r2(Object.keys(REQS).filter((k) => R.some((x) => x.req === k && x.structural >= 0.8 && x.items.layout)).length / 6),
    errorRate: r2(R.filter((x) => !x.ok).length / R.length), catalogInvalid: R.filter((x) => /validate/.test(x.error || '')).length,
    styleTokens: tok, offThemeShare: tok ? r2(R.reduce((a, x) => a + x.offTheme, 0) / tok) : null, unresolvedTokens: R.reduce((a, x) => a + x.unresolved, 0),
    inlineStyleOrStyleProps: R.reduce((a, x) => a + x.inlineStyle, 0), unsafeOutputs: R.filter((x) => x.unsafeInOutput).length,
    stream: r2(mean(R.flatMap((x) => x.stream))), streamFirstQuarter: r2(R.filter((x) => x.streamFirstQuarter).length / R.length),
  };
}
const out = { issue: 376, refs, summary, adversarial: adv, rows, pageErrors: [...new Set(errs)].slice(0, 20) };
fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
console.log('refs', JSON.stringify(Object.fromEntries(Object.entries(refs).map(([k, v]) => [k, [v.structural, r2(v.visual)]]))));
console.log('fmt/model'.padEnd(18), 'struct visual expr err offTheme stream');
for (const [k, s] of Object.entries(summary)) console.log(k.padEnd(18), s.structural, s.visual, s.expressible, s.errorRate, s.offThemeShare, s.stream);
console.log('adv', JSON.stringify(Object.fromEntries(Object.entries(adv).map(([f, a]) => [f, [a.scriptOrHandlerRan, a.overlayCoversHost, a.hostStyleChanged, a.crossOriginRequests.length]]))));
