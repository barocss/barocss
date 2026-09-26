// #255 custom SITE theme in companion mode (L3 blocks: real model output frozen in theme-blocks/, see theme-generate.sh).
// Rerun (repo root, after pnpm --filter @barocss/kit build:library && pnpm --filter @barocss/browser build:library):
//   TWB_DIR=<dir of @tailwindcss/browser> PW_DIR=<dir containing node_modules/playwright-core> CHROME=<chromium> \
//     [PROBE_PORT=6355] node scripts/cms-probe/theme-run.mjs
// Site = theme-site.mjs (the #253 site with its own tokens: brand-50..900, accent, font-display, spacing gutter, radius card).
// Variants: '@theme' (only vars used by the build are emitted) | '@theme inline' (no vars) | '@theme static' (all vars emitted).
// Arms: ref (build that also compiled the block classes) | build | twb (build + @tailwindcss/browser, site theme in text/tailwindcss) |
//   baro0 (#242 recipe, no site theme) | baroVar (theme.extend -> var(--color-brand-600) ...) | baroLit (theme.extend with literal values).
// Metrics: tok = share of the blocks' theme-token classes (known to the ref build) whose isolated computed style equals the ref;
//   elem = block element parity vs ref; dmg = shell/prose elements differing from ref after insertion + from build before insertion, ignoring width/height reflow (summed over both models, 66 = 33 shell els x 2).
// SUMMARY (2026-09-26, table in theme-summary.md; theme-result.json gitignored): smallest route = theme.extend with LITERAL
//   values (26/31 tokens, 0 damage, every variant); var() refs create cyclic :root vars (36 shell els damaged under @theme/static);
//   named spacing (p-gutter ...) unsupported by every BaroCSS route.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { SHELL, SITE_BASE_CSS, THEME_CSS, BRAND, ACCENT, FONT_DISPLAY, GUTTER, RADIUS_CARD } from './theme-site.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const req = createRequire(path.join(ROOT, 'packages/barocss/package.json'));
const { compile } = req('tailwindcss');
const twDir = path.dirname(req.resolve('tailwindcss/package.json'));
const PORT = Number(process.env.PROBE_PORT || 6355);
const VARIANTS = { theme: '', inline: 'inline', static: 'static' };
const ARMS = ['ref', 'build', 'twb', 'baro0', 'baroVar', 'baroLit'];
const FILES = { baro: path.join(ROOT, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs'), twb: path.join(process.env.TWB_DIR || '', 'dist/index.global.js') };
const PAGE_JS = fs.readFileSync(path.join(HERE, 'page.js'), 'utf8');
const MODELS = ['opus', 'haiku'], BLOCKS = ['hero', 'feature-grid', 'callout', 'comparison-table', 'testimonial', 'cta'];
const html = Object.fromEntries(MODELS.map((m) => [m, BLOCKS.map((b) => `<div data-block="${b}">${fs.readFileSync(path.join(HERE, 'theme-blocks', `${m}-${b}.html`), 'utf8')}</div>`).join('\n')]));
const split = (s) => (s || '').split(/\s+/).filter(Boolean);
const toks = (h) => [...h.matchAll(/class="([^"]*)"/g)].flatMap((m) => split(m[1]));
const shellTokens = toks(SHELL).concat(['prose']);
const blockTok = Object.fromEntries(MODELS.map((m) => [m, [...new Set(toks(html[m]))]]));
const allBlockTokens = [...new Set(MODELS.flatMap((m) => blockTok[m]))];
const IS_THEME = (t) => /-(brand-\d+(\/\d+)?|accent(\/\d+)?|display|gutter|card)$/.test(t.split(':').pop());

async function build(mode, tokens) {
  const c = await compile(`@import "tailwindcss";\n${THEME_CSS(mode)}\n${SITE_BASE_CSS}`, {
    base: twDir,
    loadStylesheet: async (id, base) => {
      const p = id === 'tailwindcss' ? path.join(twDir, 'index.css') : path.resolve(base, id.replace(/^tailwindcss\//, ''));
      const file = fs.existsSync(p) ? p : path.join(twDir, id.replace(/^tailwindcss\//, ''));
      return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
    },
  });
  return c.build([...new Set(tokens)]);
}
const CSS = {};
for (const [v, mode] of Object.entries(VARIANTS)) {
  CSS[v + '-build'] = await build(mode, shellTokens);
  CSS[v + '-all'] = await build(mode, [...shellTokens, ...allBlockTokens]);
  for (const m of MODELS) CSS[`${v}-ref-${m}`] = await build(mode, [...shellTokens, ...blockTok[m]]);
}
const emptyLen = (await build('', [])).length, known = new Set();
for (const t of allBlockTokens) if ((await build('', [t])).length > emptyLen) known.add(t);
const themeToks = allBlockTokens.filter((t) => IS_THEME(t) && known.has(t));

const px = (n) => n; // values stay as authored
const EXT = {
  baroVar: { colors: { brand: Object.fromEntries(Object.keys(BRAND).map((k) => [k, `var(--color-brand-${k})`])), accent: 'var(--color-accent)' },
    fontFamily: { display: ['var(--font-display)'] }, spacing: { gutter: 'var(--spacing-gutter)' }, borderRadius: { card: 'var(--radius-card)' } },
  baroLit: { colors: { brand: BRAND, accent: ACCENT }, fontFamily: { display: FONT_DISPLAY.split(', ') }, spacing: { gutter: px(GUTTER) }, borderRadius: { card: RADIUS_CARD } },
};
const boot = (arm) => {
  const cfg = { cssVarPrefix: 'tw' }; if (EXT[arm]) cfg.theme = { extend: EXT[arm] };
  return `<script src="/baro.js"></script><script>var rt = BaroCSS.getRuntime({ skipExisting: true, config: ${JSON.stringify(cfg)} });
rt.observe(document.body, { scan: true });</script>`;
};
const head = (v, arm, cssName) => arm === 'twb'
  ? `<link rel="stylesheet" href="/${v}-build.css"><style type="text/tailwindcss">${THEME_CSS(VARIANTS[v])}</style><script src="/twb.js"></script>`
  : `<link rel="stylesheet" href="/${cssName}.css">`;
const tail = (arm) => (arm.startsWith('baro') ? boot(arm) : '');
const page = (v, arm, m) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=1280">${head(v, arm, arm === 'ref' ? `${v}-ref-${m}` : `${v}-build`)}<style>*,*::before,*::after{animation:none!important;transition:none!important}</style>
<script>window.__PROBE=${JSON.stringify({ arm, html: html[m] }).replace(/</g, '\\u003c')};</script><script src="/page.js"></script></head><body>${SHELL}${tail(arm)}</body></html>`;
const ISO_P = ['margin-top', 'margin-bottom', 'padding-top', 'padding-left', 'gap', 'font-family', 'color', 'background-color', 'background-image',
  'border-top-color', 'border-left-color', 'border-top-left-radius', 'box-shadow', 'outline-color', 'text-decoration-color', 'fill', 'width', 'height', 'row-gap'];
const isoPage = (v, arm) => `<!doctype html><html><head><meta charset="utf-8">${head(v, arm, arm === 'ref' ? `${v}-all` : `${v}-build`)}</head><body><div style="width:900px">
${themeToks.map((t, i) => `<div data-iso="${i}" class="${t.replace(/"/g, '&quot;')}"><p>a</p></div>`).join('\n')}</div>${tail(arm)}
<script>setTimeout(function(){var P=${JSON.stringify(ISO_P)};window.__iso=[].map.call(document.querySelectorAll('[data-iso]'),function(e){var c=getComputedStyle(e);return P.map(function(p){return c.getPropertyValue(p)})});},800);</script></body></html>`;
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x'), s = u.searchParams;
  const send = (type, body) => { r.writeHead(200, { 'content-type': type }); r.end(body); };
  if (u.pathname === '/app') return send('text/html', page(s.get('v'), s.get('arm'), s.get('m')));
  if (u.pathname === '/iso') return send('text/html', isoPage(s.get('v'), s.get('arm')));
  const cm = u.pathname.match(/^\/([\w-]+)\.css$/); if (cm && CSS[cm[1]]) return send('text/css', CSS[cm[1]]);
  if (u.pathname === '/page.js') return send('text/javascript', PAGE_JS);
  if (u.pathname === '/baro.js') return send('text/javascript', fs.readFileSync(FILES.baro));
  if (u.pathname === '/twb.js') return send('text/javascript', fs.readFileSync(FILES.twb));
  r.writeHead(404); r.end();
});
await new Promise((ok) => srv.listen(PORT, '127.0.0.1', ok));
const { chromium } = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');
const browser = await chromium.launch({ executablePath: process.env.CHROME });
const get = async (url, key) => {
  const p = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
  await p.goto(url);
  const r = await p.waitForFunction((k) => window[k], key, { timeout: 20000 }).then((x) => x.jsonValue()).catch(() => null);
  await p.close(); return r;
};
const raw = {}, iso = {};
for (const v of Object.keys(VARIANTS)) for (const arm of ARMS) {
  iso[v + arm] = await get(`http://127.0.0.1:${PORT}/iso?v=${v}&arm=${arm}`, '__iso');
  for (const m of MODELS) raw[v + arm + m] = await get(`http://127.0.0.1:${PORT}/app?v=${v}&arm=${arm}&m=${m}`, '__r');
}
await browser.close(); srv.close();

const cmp = (a, b, skip = []) => { const bad = []; a.forEach((row, i) => { if (row.some((x, j) => !skip.includes(j) && x !== b[i][j])) bad.push(i); }); return bad; };
const rows = [], fails = {};
for (const v of Object.keys(VARIANTS)) for (const arm of ARMS) {
  const ib = cmp(iso[v + arm], iso[v + 'ref']);
  const tok = 1 - ib.length / themeToks.length;
  if (arm.startsWith('baro') || arm === 'twb') fails[v + ' ' + arm] = ib.map((i) => themeToks[i]).slice(0, 12);
  let els = 0, bad = 0, dmg = 0;
  for (const m of MODELS) {
    const r = raw[v + arm + m], ref = raw[v + 'ref' + m], bld = raw[v + 'build' + m];
    els += ref.blockSig.length; bad += cmp(r.blockSig, ref.blockSig).length; const sk = [r.props.indexOf("width"), r.props.indexOf("height")]; dmg += cmp(r.shellSig, ref.shellSig, sk).length + cmp(r.shellSigBefore, bld.shellSigBefore, sk).length;
  }
  rows.push({ v, arm, tok: +tok.toFixed(3), elem: +(1 - bad / els).toFixed(3), dmg, shellEls: raw[v + 'build' + 'opus'].shellSig.length * 2 });
}
const out = { question: '#255', blockTokens: allBlockTokens.length, known: known.size, themeTokens: themeToks.length, themeToks, rows, fails };
fs.writeFileSync(path.join(HERE, 'theme-result.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ blockTokens: allBlockTokens.length, known: known.size, themeTokens: themeToks.length, blockEls: MODELS.map((m) => raw['themeref' + m].blockSig.length) }));
for (const r of rows) console.log(r.v.padEnd(7), r.arm.padEnd(8), 'tok', r.tok.toFixed(3), 'elem', r.elem.toFixed(3), 'dmg', r.dmg + '/' + r.shellEls);
for (const [k, f] of Object.entries(fails)) if (f.length) console.log('fail', k, f.join(' '));
