// #253 CMS content companion (L3 blocks: real model output frozen in blocks/, see generate.sh).
// Rerun (repo root, after pnpm --filter @barocss/kit build:library && pnpm --filter @barocss/browser build:library):
//   TWB_DIR=<dir of @tailwindcss/browser> PW_DIR=<dir containing node_modules/playwright-core> CHROME=<chromium> \
//     [PROBE_PORT=6253] node scripts/cms-probe/run.mjs [runs=3]
// Site = site.mjs shell + site CSS (@theme brand/accent/fonts, base styles, hand-written .prose), built by Tailwind 4.1.13
// compile() over the shell classes only. After load, page.js inserts one model's 6 blocks into the article (innerHTML).
// Arms: ref (build that also compiled the block classes) | build | safelist (build + #218 "families" common scales) |
//       twb (build + @tailwindcss/browser, site @theme in a text/tailwindcss style) |
//       baro (build + README companion recipe: getRuntime({ skipExisting, cssVarPrefix 'tw', theme.extend = site theme }) + observe)
// Writes result.json (gitignored) and prints the summary.
// SUMMARY (2026-09-26, 3 runs, median; 223 block els / 211 tokens, all Tailwind-known, 0 site-theme tokens used;
// typography plugin absent -> hand-written .prose in site.mjs; animations/transitions frozen in every arm):
//   arm       blockElem blockProp shell/prose damage        injected  cssGz  scriptGz insert->final
//   build     0.026     0.909     0                         0         3.6K   0        9.5ms
//   safelist  0.695     0.988     0                         0         144K   0        0.3ms
//   twb       1.000     1.000     2 els pre-insert (0.997)  25.4K     3.6K   68.7K    17.6ms
//   baro      0.938     0.998     0 (1.000)                 32.5K     3.6K   41.4K    29.8ms   (opus 0.876, haiku 1.000)
// baro misses: 17 els, opus feature-grid: 1 cascade conflict (`px-4 sm:px-6 lg:px-8`: runtime sheet has .lg:px-8 before
// .sm:px-6, insertion order not breakpoint order, 24px vs 32px) + 16 knock-on children; 0 unknown class, 0 theme token.
import http from 'node:http';
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { SHELL, SITE_CSS, SITE_THEME_CSS, BRAND, ACCENT, FONTS } from './site.mjs';
import { inlineCss, cssClasses } from '../json-render-probe/pregen.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const req = createRequire(path.join(ROOT, 'packages/barocss/package.json'));
const { compile } = req('tailwindcss');
const twDir = path.dirname(req.resolve('tailwindcss/package.json'));
const PORT = Number(process.env.PROBE_PORT || 6253);
const RUNS = Number(process.argv[2] || 3);
const ARMS = ['ref', 'build', 'safelist', 'twb', 'baro'];
const FILES = { baro: path.join(ROOT, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs'), twb: path.join(process.env.TWB_DIR || '', 'dist/index.global.js') };
const PAGE_JS = fs.readFileSync(path.join(HERE, 'page.js'), 'utf8');
const MODELS = ['opus', 'haiku'], BLOCKS = ['hero', 'feature-grid', 'callout', 'comparison-table', 'testimonial', 'cta'];
const html = Object.fromEntries(MODELS.map((m) => [m, BLOCKS.map((b) => `<div data-block="${b}">${fs.readFileSync(path.join(HERE, 'blocks', `${m}-${b}.html`), 'utf8')}</div>`).join('\n')]));
const split = (s) => (s || '').split(/\s+/).filter(Boolean);
const toks = (h) => [...h.matchAll(/class="([^"]*)"/g)].flatMap((m) => split(m[1]));
const shellTokens = toks(SHELL).concat(['prose']);
const blockTok = Object.fromEntries(MODELS.map((m) => [m, [...new Set(toks(html[m]))]]));
const allBlockTokens = [...new Set(MODELS.flatMap((m) => blockTok[m]))];
async function build(tokens, extra = '') {
  const c = await compile(`@import "tailwindcss";\n${SITE_CSS}\n${extra}`, {
    base: twDir,
    loadStylesheet: async (id, base) => {
      const p = id === 'tailwindcss' ? path.join(twDir, 'index.css') : path.resolve(base, id.replace(/^tailwindcss\//, ''));
      const file = fs.existsSync(p) ? p : path.join(twDir, id.replace(/^tailwindcss\//, ''));
      return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
    },
  });
  return c.build([...new Set(tokens)]);
}
const CSS = { build: await build(shellTokens), safelist: await build(shellTokens, inlineCss('families')), all: await build([...shellTokens, ...allBlockTokens]) };
for (const m of MODELS) CSS['ref-' + m] = await build([...shellTokens, ...blockTok[m]]);
const emptyLen = (await build([])).length, known = new Set();
for (const t of allBlockTokens) if ((await build([t])).length > emptyLen) known.add(t);
const slClasses = cssClasses(CSS.safelist), inSafelist = new Set(allBlockTokens.filter((t) => slClasses.has(t)));

const THEME_EXT = { colors: { brand: BRAND, accent: ACCENT }, fontFamily: { display: FONTS.display.split(', '), sans: FONTS.sans.split(', ') } };
const BARO_BOOT = `<script src="/baro.js"></script><script>var rt = BaroCSS.getRuntime({ skipExisting: true, config: { cssVarPrefix: 'tw', theme: { extend: ${JSON.stringify(THEME_EXT)} } } });
rt.observe(document.body, { scan: true });</script>`;
const head = (arm, m) => ({
  ref: `<link rel="stylesheet" href="/ref-${m}.css">`, build: '<link rel="stylesheet" href="/build.css">',
  safelist: '<link rel="stylesheet" href="/safelist.css">',
  twb: `<link rel="stylesheet" href="/build.css"><style type="text/tailwindcss">${SITE_THEME_CSS}</style><script src="/twb.js"></script>`,
  baro: '<link rel="stylesheet" href="/build.css">', isoref: '<link rel="stylesheet" href="/all.css">', isobaro: '<link rel="stylesheet" href="/build.css">',
})[arm];
const tail = (arm) => (arm === 'baro' || arm === 'isobaro' ? BARO_BOOT : '');
const page = (arm, m) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=1280">${head(arm, m)}<style>*,*::before,*::after{animation:none!important;transition:none!important}</style>
<script>window.__PROBE=${JSON.stringify({ arm, html: html[m] }).replace(/</g, '\\u003c')};</script><script src="/page.js"></script></head><body>${SHELL}${tail(arm)}</body></html>`;
const ISO_P = ['display', 'margin-top', 'padding-top', 'padding-left', 'width', 'height', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color',
  'background-color', 'background-image', 'border-top-width', 'border-top-style', 'border-top-color', 'border-top-left-radius', 'box-shadow', 'opacity', 'gap',
  'grid-template-columns', 'flex-direction', 'justify-content', 'align-items', 'text-align', 'transform', 'translate', 'filter', 'backdrop-filter', 'position', 'text-decoration-line'];
const isoPage = (arm) => `<!doctype html><html><head><meta charset="utf-8">${head(arm)}</head><body><div style="width:900px">
${allBlockTokens.map((t, i) => `<div data-iso="${i}" class="${t.replace(/"/g, '&quot;')}"><p>a</p><p>b</p></div>`).join('\n')}</div>${tail(arm)}
<script>setTimeout(function(){var P=${JSON.stringify(ISO_P)};window.__iso=[].map.call(document.querySelectorAll('[data-iso]'),function(e){return [e].concat([].slice.call(e.children)).map(function(n){var c=getComputedStyle(n);return P.map(function(p){return c.getPropertyValue(p)})})});},800);</script></body></html>`;
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x');
  const send = (type, body) => { r.writeHead(200, { 'content-type': type }); r.end(body); };
  if (u.pathname === '/app') return send('text/html', page(u.searchParams.get('arm'), u.searchParams.get('m')));
  if (u.pathname === '/iso') return send('text/html', isoPage(u.searchParams.get('arm')));
  const cm = u.pathname.match(/^\/([\w-]+)\.css$/); if (cm && CSS[cm[1]]) return send('text/css', CSS[cm[1]]);
  if (u.pathname === '/page.js') return send('text/javascript', PAGE_JS);
  if (u.pathname === '/baro.js') return send('text/javascript', fs.readFileSync(FILES.baro));
  if (u.pathname === '/twb.js') return send('text/javascript', fs.readFileSync(FILES.twb));
  r.writeHead(404); r.end();
});
await new Promise((ok) => srv.listen(PORT, '127.0.0.1', ok));
if (process.env.HOLD) await new Promise(() => {}); // debug: keep the server up
const { chromium } = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');
const browser = await chromium.launch({ executablePath: process.env.CHROME });
const raw = [];
for (const m of MODELS) for (const arm of ARMS) for (let i = 0; i < RUNS; i++) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
  await p.goto(`http://127.0.0.1:${PORT}/app?arm=${arm}&m=${m}`);
  const r = await p.waitForFunction(() => window.__r, null, { timeout: 20000 }).then((x) => x.jsonValue()).catch(() => ({ error: 'no report' }));
  raw.push({ m, arm, i, errs, ...r });
  await p.close();
}
const iso = {};
for (const arm of ['isoref', 'isobaro']) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await p.goto(`http://127.0.0.1:${PORT}/iso?arm=${arm}`);
  iso[arm] = await p.waitForFunction(() => window.__iso, null, { timeout: 20000 }).then((x) => x.jsonValue());
  await p.close();
}
await browser.close(); srv.close();

const THEME = /(^|:|-)(brand|accent-(400|500|600)|font-display|font-sans)(-|\/|$)/;
const tokInfo = {};
allBlockTokens.forEach((t, i) => {
  const a = iso.isobaro[i], b = iso.isoref[i], diffs = [];
  a.forEach((row, n) => row.forEach((v, j) => { if (v !== b[n][j]) diffs.push(`${n ? 'child.' : ''}${ISO_P[j]}: ${v} != ${b[n][j]}`); }));
  tokInfo[t] = { known: known.has(t), isoOk: diffs.length === 0, diffs: diffs.slice(0, 3) };
});
const tokCause = (t) => { const x = tokInfo[t]; if (!x.known) return null; if (x.isoOk) return null; return THEME.test(t) ? 'theme token' : 'unknown class (runtime lacks/mis-renders it)'; };
const med = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
function cmp(a, b) { if (!a || !b || a.length !== b.length) return null; let s = 0, n = 0; const bad = []; a.forEach((row, i) => { let ok = true; row.forEach((v, j) => { n++; if (v === b[i][j]) s++; else ok = false; }); if (!ok) bad.push(i); }); return { prop: s / n, elem: 1 - bad.length / a.length, bad }; }
const gz = (f) => zlib.gzipSync(fs.readFileSync(f)).length;
const scriptGz = { twb: gz(FILES.twb), baro: gz(FILES.baro), ref: 0, build: 0, safelist: 0 };
const cssGz = Object.fromEntries(Object.entries(CSS).map(([k, v]) => [k, zlib.gzipSync(v).length]));
const per = [], misses = [];
for (const m of MODELS) {
  const ref = raw.find((r) => r.m === m && r.arm === 'ref' && r.i === 0), bld = raw.find((r) => r.m === m && r.arm === 'build' && r.i === 0);
  for (const arm of ARMS) {
    const rs = raw.filter((r) => r.m === m && r.arm === arm && !r.error);
    const bp = rs.map((r) => cmp(r.blockSig, ref.blockSig)), sd = rs.map((r) => cmp(r.shellSig, bld.shellSig)), sr = rs.map((r) => cmp(r.shellSig, ref.shellSig)), sb = rs.map((r) => cmp(r.shellSigBefore, bld.shellSigBefore));
    per.push({ m, arm, n: rs.length, blockElem: med(bp.map((x) => x?.elem)), blockProp: med(bp.map((x) => x?.prop)), shellAfter: med(sd.map((x) => x?.prop)), shellVsRef: med(sr.map((x) => x?.prop)),
      shellBefore: med(sb.map((x) => x?.prop)), shellBadEls: med(sr.map((x) => x?.bad.length)), injectedBytes: med(rs.map((r) => r.injectedBytes)),
      cssGz: arm === 'ref' ? cssGz['ref-' + m] : arm === 'safelist' ? cssGz.safelist : cssGz.build, scriptGz: scriptGz[arm],
      insertToFinalMs: med(rs.map((r) => r.insertToFinalMs)), errs: [...new Set(rs.flatMap((r) => r.errs))].slice(0, 2) });
    if (arm === 'baro' || arm === 'safelist') for (const i of bp[0]?.bad || []) {
      const [tag, cls, blk, pi] = rs[0].blockEls[i], own = split(cls);
      const props = rs[0].props.filter((_, j) => rs[0].blockSig[i][j] !== ref.blockSig[i][j]);
      let cause;
      if (arm === 'safelist') cause = own.some((t) => known.has(t) && !inSafelist.has(t)) ? 'not in safelist' : 'other';
      else {
        const c = [...new Set(own.map(tokCause).filter(Boolean))];
        if (c.length) cause = c[0];
        else if (own.some((t) => !known.has(t)) && !own.some((t) => known.has(t))) cause = 'unknown class (not Tailwind)';
        else {
          // Ancestor with a bad token -> knock-on; else a token that renders right alone but loses on the page = cascade conflict.
          let anc = false; for (let j = pi; j >= 0; j = rs[0].blockEls[j][3]) if (bp[0].bad.includes(j)) { anc = true; break; }
          const bps = own.filter((t) => /^(sm|md|lg|xl|2xl):/.test(t)).map((t) => t.replace(/^\w+:/, "").replace(/-[^-]+$/, ""));
          cause = anc ? 'other (knock-on from a missed ancestor)' : bps.length > new Set(bps).size ? 'cascade conflict (breakpoint order)' : 'cascade conflict';
        }
      }
      misses.push({ arm, m, blk, tag, cause, props, tokens: own.filter((t) => tokCause(t)).join(' ') || cls.slice(0, 120) });
    }
  }
}
const agg = (rows) => Object.fromEntries(ARMS.map((a) => { const r = rows.filter((x) => x.arm === a), avg = (f) => +(r.reduce((s, x) => s + (x[f] ?? 0), 0) / r.length).toFixed(4);
  return [a, { blockElem: avg('blockElem'), blockProp: avg('blockProp'), shellAfter: avg('shellAfter'), shellVsRef: avg('shellVsRef'), shellBefore: avg('shellBefore'), shellBadEls: avg('shellBadEls'), injectedBytes: Math.round(avg('injectedBytes')), cssGz: Math.round(avg('cssGz')), scriptGz: scriptGz[a], insertToFinalMs: +avg('insertToFinalMs').toFixed(1) }]; }));
const summary = { all: agg(per), opus: agg(per.filter((x) => x.m === 'opus')), haiku: agg(per.filter((x) => x.m === 'haiku')) };
const byCause = {};
for (const x of misses) ((byCause[x.arm] ||= {})[x.cause] ||= []).push(`${x.m}/${x.blk} <${x.tag}> [${x.tokens}] ${x.props.join(',')}`);
const badTokens = Object.fromEntries(Object.entries(tokInfo).filter(([t]) => tokCause(t)).map(([t, x]) => [t, { cause: tokCause(t), diffs: x.diffs }]));
const blockEls = Object.fromEntries(MODELS.map((m) => [m, raw.find((r) => r.m === m && r.arm === 'ref')?.blockSig?.length]));
fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ question: '#253', blockTokens: allBlockTokens.length, known: known.size, inSafelist: inSafelist.size, blockEls, summary, per, misses, byCause, badTokens }, null, 1));
console.log(JSON.stringify({ blockTokens: allBlockTokens.length, known: known.size, inSafelist: inSafelist.size, themeTokensUsed: allBlockTokens.filter((t) => THEME.test(t)).length, blockEls, cssGz }));
for (const [a, v] of Object.entries(summary.all)) console.log('all   ', a.padEnd(8), JSON.stringify(v));
for (const r of per.filter((x) => x.arm !== 'ref')) console.log(r.m.padEnd(6), r.arm.padEnd(8), r.blockElem?.toFixed(3), r.blockProp?.toFixed(4), 'shellVsRef', r.shellVsRef?.toFixed(4), 'vsBuild', r.shellAfter?.toFixed(4), r.errs.join('|'));
for (const [a, c] of Object.entries(byCause)) console.log(a, 'misses by cause:', JSON.stringify(Object.fromEntries(Object.entries(c).map(([k, l]) => [k, l.length]))));
console.log('bad tokens:', JSON.stringify(badTokens).slice(0, 1500));
