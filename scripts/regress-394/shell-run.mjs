// #231 end-to-end companion run with real model-generated json-render specs (frozen in specs/, see generate.sh).
// Rerun (repo root, after pnpm --filter @barocss/kit build:library && pnpm --filter @barocss/browser build:library):
//   TWB_DIR=<dir of @tailwindcss/browser> PW_DIR=<dir containing node_modules/playwright-core> CHROME=<chromium> \
//     [PROBE_PORT=5931] [SHOTS=1] node scripts/json-render-probe/e2e/run.mjs [runs=3]
// App = ../shell.html + shadcn component base classes (COMP) + app.css, built by Tailwind compile(). Per spec, arms:
//   ref   build that also knew the spec classes      build  build only
//   twb   build + @tailwindcss/browser
//   baro  build + BaroCSS companion: baroStart({ skipExisting, cssVarPrefix 'tw', shadcnTheme }) + preloadJsonRenderClasses
// Then an isolation pass (one element per spec token, ref vs baro) classifies every baro miss.
// Writes e2e/result.json (gitignored) and prints a summary.
import http from 'node:http';
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../json-render-probe/e2e');
const ROOT = path.resolve(HERE, '../../..');
const req = createRequire(process.env.TW_FROM || path.join(ROOT, 'packages/barocss/package.json')); // #394: TW_FROM swaps the reference Tailwind
const { compile } = req('tailwindcss');
const twDir = path.dirname(req.resolve('tailwindcss/package.json'));
const PORT = Number(process.env.PROBE_PORT || 5931);
const RUNS = Number(process.argv[2] || 3);
const ARMS = ['ref', 'build', 'twb', 'baro'];
const FILES = { baro: path.join(process.env.BARO_ROOT, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs'), twb: path.join(process.env.TWB_DIR || '', 'dist/index.global.js') };
const SHELL = fs.readFileSync(path.join(HERE, '../shell.html'), 'utf8');
const APP_CSS = fs.readFileSync(path.join(HERE, 'app.css'), 'utf8');
const PAGE_JS = fs.readFileSync(path.join(HERE, 'page.js'), 'utf8');
const SPECS = Object.fromEntries(fs.readdirSync(path.join(HERE, 'specs')).sort().map((f) => [f.replace('.json', ''), JSON.parse(fs.readFileSync(path.join(HERE, 'specs', f), 'utf8'))]));
// shadcn new-york component classes (what the app's components/ui ship; part of the build).
const COMP = {
  Card: 'bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm',
  Stack: 'flex flex-col gap-4', Grid: 'grid gap-4',
  'Text.h1': 'scroll-m-20 text-4xl font-extrabold tracking-tight', 'Text.h2': 'scroll-m-20 text-3xl font-semibold tracking-tight',
  'Text.h3': 'scroll-m-20 text-2xl font-semibold tracking-tight', 'Text.muted': 'text-sm text-muted-foreground', 'Text.body': 'leading-7',
  Button: 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all outline-none',
  'Button.default': 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90', 'Button.outline': 'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground',
  'Button.secondary': 'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80', 'Button.ghost': 'hover:bg-accent hover:text-accent-foreground',
  'Button.destructive': 'bg-destructive text-white shadow-xs hover:bg-destructive/90',
  'Button.size.default': 'h-9 px-4 py-2', 'Button.size.sm': 'h-8 rounded-md gap-1.5 px-3', 'Button.size.lg': 'h-10 rounded-md px-6',
  Badge: 'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 gap-1 overflow-hidden',
  'Badge.default': 'border-transparent bg-primary text-primary-foreground', 'Badge.secondary': 'border-transparent bg-secondary text-secondary-foreground',
  'Badge.outline': 'text-foreground', 'Badge.destructive': 'border-transparent bg-destructive text-white',
  Field: 'grid gap-2', Label: 'flex items-center gap-2 text-sm leading-none font-medium select-none',
  Input: 'h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none md:text-sm',
  SwitchRow: 'flex items-center gap-2', Switch: 'inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs',
  'Switch.on': 'bg-primary', 'Switch.off': 'bg-input', Thumb: 'bg-background pointer-events-none block size-4 rounded-full ring-0 transition-transform',
  'Thumb.on': 'translate-x-[calc(100%-2px)]', 'Thumb.off': 'translate-x-0',
  Separator: 'bg-border shrink-0 h-px w-full', Progress: 'bg-primary/20 relative h-2 w-full overflow-hidden rounded-full', Indicator: 'bg-primary h-full w-full flex-1 transition-all',
  TableWrap: 'relative w-full overflow-x-auto', Table: 'w-full caption-bottom text-sm', THead: '[&_tr]:border-b', TBody: '[&_tr:last-child]:border-0',
  Tr: 'hover:bg-muted/50 border-b transition-colors', Th: 'text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap', Td: 'p-2 align-middle whitespace-nowrap',
};
const root = (t) => t.replace(/^(-?[a-z]+)(-[xytrblse])?-.*$/, '$1');
const split = (s) => (s || '').split(/\s+/).filter(Boolean);
const shellTokens = [...SHELL.matchAll(/class="([^"]*)"/g)].flatMap((m) => split(m[1])).concat(Object.values(COMP).flatMap(split));
const specTok = (s) => Object.values(s.elements).flatMap((e) => (typeof e.props?.className === 'string' ? split(e.props.className) : []));
const allSpecTokens = [...new Set(Object.values(SPECS).flatMap(specTok))];
async function build(tokens) {
  const c = await compile(`@import "tailwindcss";\n${APP_CSS}`, {
    base: twDir,
    loadStylesheet: async (id, base) => {
      const p = id === 'tailwindcss' ? path.join(twDir, 'index.css') : path.resolve(base, id.replace(/^tailwindcss\//, ''));
      const file = fs.existsSync(p) ? p : path.join(twDir, id.replace(/^tailwindcss\//, ''));
      return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
    },
  });
  return c.build([...new Set(tokens)]);
}
const CSS = { build: await build(shellTokens), all: await build([...shellTokens, ...allSpecTokens]) };
for (const k of Object.keys(SPECS)) CSS['ref-' + k] = await build([...shellTokens, ...specTok(SPECS[k])]);
// Tailwind-known = a rule for the token alone in an otherwise empty build.
const emptyLen = (await build([])).length, known = new Set();
for (const t of allSpecTokens) if ((await build([t])).length > emptyLen) known.add(t);

const BARO_BOOT = `<script src="/baro.js"></script><script>BaroCSS.baroStart({ skipExisting: true, config: { cssVarPrefix: 'tw', theme: { extend: BaroCSS.shadcnTheme } } });</script>`;
const head = (arm, k) => ({
  ref: `<link rel="stylesheet" href="/ref-${k}.css">`, build: '<link rel="stylesheet" href="/build.css">',
  twb: '<link rel="stylesheet" href="/build.css"><script src="/twb.js"></script>',
  baro: '<link rel="stylesheet" href="/build.css">' + BARO_BOOT,
  isoref: '<link rel="stylesheet" href="/all.css">', isobaro: '<link rel="stylesheet" href="/build.css">' + BARO_BOOT,
})[arm];
const page = (arm, k) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=1280">${head(arm, k)}
<script>window.__PROBE=${JSON.stringify({ arm, spec: SPECS[k], comp: COMP })};</script><script src="/page.js"></script></head><body>${SHELL}</body></html>`;
// Isolation page: one wrapper per token (with two children so space-*/divide-* show), measured after 800ms.
const isoPage = (arm) => `<!doctype html><html><head><meta charset="utf-8">${head(arm)}</head><body><div style="width:900px">
${allSpecTokens.map((t, i) => `<div data-iso="${i}" class="${t.replace(/"/g, '&quot;')}"><p>a</p><p>b</p></div>`).join('\n')}</div>
<script>setTimeout(function(){var P=${JSON.stringify(['display', 'margin-top', 'margin-left', 'padding-top', 'padding-left', 'width', 'max-width', 'height', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color', 'background-color', 'border-top-width', 'border-top-style', 'border-top-color', 'border-top-left-radius', 'box-shadow', 'opacity', 'gap', 'grid-template-columns', 'flex-direction', 'justify-content', 'align-items', 'text-align', 'background-image', 'row-gap', 'transform', 'translate', 'text-transform'])};
window.__iso=[].map.call(document.querySelectorAll('[data-iso]'),function(e){return [e].concat([].slice.call(e.children)).map(function(n){var c=getComputedStyle(n);return P.map(function(p){return c.getPropertyValue(p)})})});window.__isoProps=P;},${800});</script></body></html>`;
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x');
  const send = (type, body) => { r.writeHead(200, { 'content-type': type }); r.end(body); };
  if (u.pathname === '/app') return send('text/html', page(u.searchParams.get('arm'), u.searchParams.get('spec')));
  if (u.pathname === '/iso') return send('text/html', isoPage(u.searchParams.get('arm')));
  const cm = u.pathname.match(/^\/([\w-]+)\.css$/); if (cm && CSS[cm[1]]) return send('text/css', CSS[cm[1]]);
  if (u.pathname === '/page.js') return send('text/javascript', PAGE_JS);
  if (u.pathname === '/baro.js') return send('text/javascript', fs.readFileSync(FILES.baro));
  if (u.pathname === '/twb.js') return send('text/javascript', fs.readFileSync(FILES.twb));
  r.writeHead(404); r.end();
});
await new Promise((ok) => srv.listen(PORT, '127.0.0.1', ok));
const { chromium } = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');
const browser = await chromium.launch({ executablePath: process.env.CHROME });
const raw = [];

for (const k of Object.keys(SPECS)) for (const arm of ARMS) for (let i = 0; i < RUNS; i++) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
  await p.goto(`http://127.0.0.1:${PORT}/app?arm=${arm}&spec=${k}`);
  const r = await p.waitForFunction(() => window.__r, null, { timeout: 15000 }).then((x) => x.jsonValue()).catch(() => ({ error: 'no report' }));
  if (process.env.SHOTS && i === 0) await p.locator('#out').screenshot({ path: path.join(HERE, 'shots-tmp', `${k}.${arm}.jpg`), type: 'jpeg', quality: 60 }).catch(() => {});
  raw.push({ spec: k, arm, i, errs, ...r });
  await p.close();
}
const iso = {};
for (const arm of ['isoref', 'isobaro']) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await p.goto(`http://127.0.0.1:${PORT}/iso?arm=${arm}`);
  iso[arm] = await p.waitForFunction(() => window.__iso && { v: window.__iso, props: window.__isoProps }, null, { timeout: 15000 }).then((x) => x.jsonValue());
  await p.close();
}
await browser.close(); srv.close();

// Token classification from the isolation pass.
const THEME = /(^|-)(background|foreground|card|popover|primary|secondary|muted|accent|destructive|border|input|ring)(\/|$|-foreground)|rounded(-[trblse]{1,2})?-(sm|md|lg|xl)$/;
const tokInfo = {};
allSpecTokens.forEach((t, i) => {
  const a = iso.isobaro.v[i], b = iso.isoref.v[i], diffs = [];
  a.forEach((row, n) => row.forEach((v, j) => { if (v !== b[n][j]) diffs.push(`${n ? 'child.' : ''}${iso.isoref.props[j]}: ${v} != ${b[n][j]}`); }));
  tokInfo[t] = { known: known.has(t), inBuild: CSS.build.includes('.' + t.replace(/[^\w-]/g, (c) => '\\' + c) + ' ') || CSS.build.includes('.' + t.replace(/[^\w-]/g, (c) => '\\' + c) + ' {'), isoOk: diffs.length === 0, diffs: diffs.slice(0, 3) };
});
const cause = (t) => { const x = tokInfo[t]; if (!x.known) return 'invented/non-Tailwind'; if (x.isoOk) return null; return THEME.test(t) ? 'theme token' : 'parity family'; };
const med = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
function cmp(a, b) { if (!a || !b || a.length !== b.length) return null; let s = 0, n = 0; const bad = []; a.forEach((row, i) => { let ok = true; row.forEach((v, j) => { n++; if (v === b[i][j]) s++; else ok = false; }); if (!ok) bad.push(i); }); return { prop: s / n, elem: 1 - bad.length / a.length, bad }; }
const gz = (f) => zlib.gzipSync(fs.readFileSync(f)).length;
const scriptBytes = { twb: gz(FILES.twb), baro: gz(FILES.baro), ref: 0, build: 0 };
const per = [], misses = [];
for (const k of Object.keys(SPECS)) {
  const ref = raw.find((r) => r.spec === k && r.arm === 'ref' && r.i === 0), bld = raw.find((r) => r.spec === k && r.arm === 'build' && r.i === 0);
  for (const arm of ARMS) {
    const rs = raw.filter((r) => r.spec === k && r.arm === arm && !r.error);
    const sp = rs.map((r) => cmp(r.specSig, ref.specSig)), sh = rs.map((r) => cmp(r.shellSig, ref.shellSig)), shb = rs.map((r) => cmp(r.shellSigBefore, bld.shellSigBefore));
    per.push({ spec: k, model: k.split('-')[0], arm, elemParity: med(sp.map((x) => x?.elem)), propParity: med(sp.map((x) => x?.prop)),
      shellParity: med(sh.map((x) => x?.prop)), shellBeforeParity: med(shb.map((x) => x?.prop)), injectedBytes: med(rs.map((r) => r.audit.injectedBytes)),
      scriptGz: scriptBytes[arm], mountToFinalMs: med(rs.map((r) => r.mountToFinalMs)), errs: [...new Set(rs.flatMap((r) => r.errs))].slice(0, 2) });
    if (arm === 'baro' && rs[0]) for (const i of sp[0].bad) {
      const [id, cls] = rs[0].specEls[i], el = SPECS[k].elements[id];
      const own = typeof el?.props?.className === 'string' ? split(el.props.className) : [];
      const props = rs[0].props.filter((_, j) => rs[0].specSig[i][j] !== ref.specSig[i][j]);
      let causes = [...new Set(own.map(cause).filter(Boolean))];
      if (!causes.length) {
        // Own tokens that set the same utility root as the component's shipped base classes: the build orders them by
        // Tailwind's sort, the runtime sheet comes later, so the spec token wins under BaroCSS (cascade-order conflict).
        const base = Object.entries(COMP).filter(([c]) => c === el?.type || c.startsWith(el?.type + '.')).flatMap(([, v]) => split(v)).map(root);
        const clash = own.filter((t) => !tokInfo[t].inBuild && base.includes(root(t)));
        const parent = Object.entries(SPECS[k].elements).find(([, e]) => (e.children || []).includes(id));
        const pBad = parent && typeof parent[1].props?.className === 'string' ? split(parent[1].props.className).filter((t) => cause(t)) : [];
        if (clash.length) { causes = ['composite: base-class conflict (cascade order)']; own.splice(0, own.length, ...clash); }
        else if (pBad.length) { causes = ['parity family (via parent ' + pBad.join(' ') + ')']; }
        else causes = ['composite: layout knock-on'];
      }
      misses.push({ spec: k, id, type: el?.type, props, causes, tokens: own.filter((t) => cause(t) || causes[0].startsWith('composite: base')), cls: own.join(' ') });
    }
  }
}
const agg = (rows) => Object.fromEntries(ARMS.map((a) => { const r = rows.filter((x) => x.arm === a), avg = (f) => +(r.reduce((s, x) => s + (x[f] ?? 0), 0) / r.length).toFixed(4);
  return [a, { elemParity: avg('elemParity'), propParity: avg('propParity'), shellParity: avg('shellParity'), shellBeforeParity: avg('shellBeforeParity'), injectedBytes: Math.round(avg('injectedBytes')), scriptGz: scriptBytes[a], mountToFinalMs: +avg('mountToFinalMs').toFixed(1) }]; }));
const summary = { all: agg(per), opus: agg(per.filter((x) => x.model === 'opus')), haiku: agg(per.filter((x) => x.model === 'haiku')) };
const byCause = {};
for (const m of misses) for (const c of m.causes) (byCause[c] ||= []).push(`${m.spec}/${m.id} [${m.tokens.join(' ') || m.cls}] ${m.props.join(',')}`);
const badTokens = Object.fromEntries(Object.entries(tokInfo).filter(([t]) => cause(t)).map(([t, x]) => [t, { cause: cause(t), inBuild: x.inBuild, diffs: x.diffs }]));
// #394: shell diffs (baro final vs ref), element index in document order of [data-shell] *, prop, baro, ref
const shellDiffs = {};
for (const k of Object.keys(SPECS)) { const ref = raw.find((r) => r.spec === k && r.arm === 'ref' && r.i === 0);
  for (const r of raw.filter((x) => x.spec === k && x.arm === 'baro')) { if (!r.shellSig || !ref?.shellSig) continue;
    r.shellSig.forEach((row, i) => row.forEach((v, j) => { if (v !== ref.shellSig[i][j]) { const key = `${i}|${r.props[j]}|${v}|${ref.shellSig[i][j]}`; shellDiffs[key] = (shellDiffs[key] || 0) + 1; } })); } }
console.log('shellDiffs', JSON.stringify(shellDiffs));
fs.writeFileSync(process.env.OUT, JSON.stringify({ question: '#231', specTokens: allSpecTokens.length, knownTokens: known.size, summary, shellDiffs, per, misses, byCause, badTokens }, null, 1));
console.log(JSON.stringify({ specTokens: allSpecTokens.length, known: known.size }));
for (const [g, s] of Object.entries(summary)) for (const [a, v] of Object.entries(s)) console.log(g.padEnd(6), a.padEnd(6), JSON.stringify(v));
for (const r of per.filter((x) => x.arm !== 'ref')) console.log(r.spec.padEnd(16), r.arm.padEnd(6), r.elemParity?.toFixed(3), r.propParity?.toFixed(4), 'shell', r.shellParity?.toFixed(4), r.errs.join('|'));
console.log('baro misses by cause:', JSON.stringify(Object.fromEntries(Object.entries(byCause).map(([c, l]) => [c, l.length]))));
console.log('bad tokens:', JSON.stringify(badTokens).slice(0, 2500));
