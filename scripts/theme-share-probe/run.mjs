// #219 app-theme sharing probe. Rerun (from the repo root, after
//   pnpm --filter @barocss/kit build:library && pnpm --filter @barocss/browser build:library):
//   TWB_DIR=<dir of @tailwindcss/browser> PW_DIR=<dir containing node_modules/playwright-core> CHROME=<chromium binary> \
//     [PROBE_PORT=5819] node scripts/theme-share-probe/run.mjs
// A Tailwind-4 "built" shadcn app (app.css tokens) gets themed classes at runtime on elements the build never saw.
// Per class we read the resolved value (colors normalised to rgba via canvas) and classify each arm as
// app (= reference build), default (styled, but not the app's value), miss (= build-only, unstyled).
// Writes scripts/theme-share-probe/result.json (gitignored).
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
const PORT = Number(process.env.PROBE_PORT || 5819);
const APP_CSS = fs.readFileSync(path.join(HERE, 'app.css'), 'utf8');
const THEME_BLOCK = APP_CSS.match(/@theme inline \{[\s\S]*?\n\}/)[0];

// [class, property read]. ring cases read box-shadow (ring-2 is runtime-only too), outline through outline-style:solid.
const CASES = [
  ['bg-background', 'background-color'], ['text-foreground', 'color'], ['bg-primary', 'background-color'],
  ['bg-primary/90', 'background-color'], ['text-primary-foreground', 'color'], ['bg-secondary', 'background-color'],
  ['text-secondary-foreground', 'color'], ['bg-muted', 'background-color'], ['bg-muted/50', 'background-color'],
  ['text-muted-foreground', 'color'], ['bg-accent', 'background-color'], ['text-accent-foreground', 'color'],
  ['bg-card', 'background-color'], ['text-card-foreground', 'color'], ['bg-popover', 'background-color'],
  ['text-popover-foreground', 'color'], ['bg-destructive', 'background-color'], ['text-destructive', 'color'],
  ['border-border', 'border-top-color'], ['border-input', 'border-top-color'], ['border-destructive', 'border-top-color'],
  ['ring-2 ring-ring', 'ring'], ['ring-2 ring-ring/50', 'ring'], ['outline-ring/50', 'outline-color'],
  ['rounded-sm', 'border-top-left-radius'], ['rounded-md', 'border-top-left-radius'], ['rounded-lg', 'border-top-left-radius'],
  ['rounded-xl', 'border-top-left-radius'],
];
const CLASSES = CASES.flatMap((c) => c[0].split(' '));

async function build(tokens) {
  const c = await compile(`@import "tailwindcss";\n${APP_CSS}`, {
    base: twDir,
    loadStylesheet: async (id, base) => {
      const p = id === 'tailwindcss' ? path.join(twDir, 'index.css') : path.resolve(base, id.replace(/^tailwindcss\//, ''));
      const file = fs.existsSync(p) ? p : path.join(twDir, id.replace(/^tailwindcss\//, ''));
      return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
    },
  });
  return c.build(tokens);
}
const SHELL_TOKENS = ['flex', 'p-4', 'text-sm'];
const CSS = { build: await build(SHELL_TOKENS), ref: await build([...SHELL_TOKENS, ...CLASSES]) };

// Config route candidates for BaroCSS (documented: theme.extend via baroStart({config}) / BrowserRuntime({config})).
const names = ['background', 'foreground', 'card', 'card-foreground', 'popover', 'popover-foreground', 'primary', 'primary-foreground',
  'secondary', 'secondary-foreground', 'muted', 'muted-foreground', 'accent', 'accent-foreground', 'destructive', 'border', 'input', 'ring'];
const varCfg = { theme: { extend: {
  colors: Object.fromEntries(names.map((n) => [n, `var(--color-${n})`])),
  borderRadius: { sm: 'var(--radius-sm)', md: 'var(--radius-md)', lg: 'var(--radius-lg)', xl: 'var(--radius-xl)' },
} } };
// The raw shadcn vars (`:root { --primary }`) exist on the page; `@theme inline` does NOT emit --color-* / --radius-*.
const rawCfg = { theme: { extend: {
  colors: Object.fromEntries(names.map((n) => [n, `var(--${n})`])),
  borderRadius: { sm: 'calc(var(--radius) - 4px)', md: 'calc(var(--radius) - 2px)', lg: 'var(--radius)', xl: 'calc(var(--radius) + 4px)' },
} } };
const litVals = Object.fromEntries([...APP_CSS.matchAll(/--([\w-]+):\s*(oklch\([^)]*\)|[\d.]+rem)/g)].map((m) => [m[1], m[2]]));
const litCfg = { theme: { extend: {
  colors: Object.fromEntries(names.map((n) => [n, litVals[n]])),
  borderRadius: { sm: 'calc(0.625rem - 4px)', md: 'calc(0.625rem - 2px)', lg: '0.625rem', xl: 'calc(0.625rem + 4px)' },
} } };
// "Read the page": derive the config from the built CSS's custom properties at runtime (user-land, no BaroCSS change).
const readPage = `(()=>{const s=getComputedStyle(document.documentElement),c={},r={};
for(const n of ${JSON.stringify(names)}){if(s.getPropertyValue('--color-'+n))c[n]='var(--color-'+n+')';}
for(const k of ['sm','md','lg','xl']){if(s.getPropertyValue('--radius-'+k))r[k]='var(--radius-'+k+')';}
return {theme:{extend:{colors:c,borderRadius:r}}};})()`;

const baro = (cfg) => `<link rel="stylesheet" href="/build.css"><script src="/baro.js"></script><script>BaroCSS.baroStart(${cfg ? `{config:${cfg}}` : ''});</script>`;
const HEAD = {
  ref: '<link rel="stylesheet" href="/ref.css">',
  build: '<link rel="stylesheet" href="/build.css">',
  baro: baro(),
  baroVarCfg: baro(JSON.stringify(varCfg)),
  baroRawVarCfg: baro(JSON.stringify(rawCfg)),
  baroLitCfg: baro(JSON.stringify(litCfg)),
  baroReadPage: baro(readPage),
  twb: '<link rel="stylesheet" href="/build.css"><script src="/twb.js"></script>',
  twbTheme: `<link rel="stylesheet" href="/build.css"><style type="text/tailwindcss">${THEME_BLOCK}</style><script src="/twb.js"></script>`,
};
const ARMS = Object.keys(HEAD);
const PAGE_JS = `
const CASES=${JSON.stringify(CASES)};
const cv=document.createElement('canvas');cv.width=cv.height=1;const cx=cv.getContext('2d',{willReadFrequently:true});
const rgba=(s)=>{const m=s&&s.match(/(rgba?|oklch|oklab|lab|lch|color)\\([^)]*\\)/);if(!m)return s||'';cx.clearRect(0,0,1,1);cx.fillStyle='#000';cx.fillStyle=m[0];cx.fillRect(0,0,1,1);return Array.from(cx.getImageData(0,0,1,1).data).join(',');};
setTimeout(()=>{const box=document.getElementById('out');
  const els=CASES.map(([c,p])=>{const d=document.createElement('div');d.className=c;d.textContent=c;
    if(p==='outline-color')d.style.outlineStyle='solid';
    if(p==='border-top-color'){d.style.borderStyle='solid';d.style.borderWidth='1px';}box.appendChild(d);return d;});
  setTimeout(()=>{window.__r=CASES.map(([c,p],i)=>{const s=getComputedStyle(els[i]);
    const v=p==='ring'?(s.boxShadow.split(/,(?![^(]*\\))/).find((x)=>/ 2px$/.test(x.trim()))||'none'):s.getPropertyValue(p);return [c,/color|ring/.test(p)?rgba(v):v,v];});},800);},300);`;
const page = (arm) => `<!doctype html><html><head><meta charset="utf-8">${HEAD[arm]}</head><body class="flex p-4 text-sm"><div id="out"></div><script>${PAGE_JS}</script></body></html>`;
const FILES = { baro: path.join(ROOT, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs'), twb: path.join(process.env.TWB_DIR || '', 'dist/index.global.js') };
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x');
  const send = (t, b) => { r.writeHead(200, { 'content-type': t }); r.end(b); };
  if (u.pathname === '/app') return send('text/html', page(u.searchParams.get('arm')));
  const cm = u.pathname.match(/^\/(\w+)\.css$/); if (cm && CSS[cm[1]]) return send('text/css', CSS[cm[1]]);
  if (u.pathname === '/baro.js' || u.pathname === '/twb.js') return send('text/javascript', fs.readFileSync(FILES[u.pathname.slice(1, -3)]));
  r.writeHead(404); r.end();
});
await new Promise((ok) => srv.listen(PORT, '127.0.0.1', ok));
const { chromium } = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');
const browser = await chromium.launch({ executablePath: process.env.CHROME });
const res = {};
for (const arm of ARMS) {
  const p = await browser.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160))); p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 160)));
  await p.goto(`http://127.0.0.1:${PORT}/app?arm=${arm}`);
  res[arm] = { errs, rows: await p.waitForFunction(() => window.__r, null, { timeout: 15000 }).then((h) => h.jsonValue()).catch(() => null) };
  await p.close();
}
await browser.close(); srv.close();
const table = CASES.map(([c], i) => {
  const ref = res.ref.rows[i][1], bld = res.build.rows[i][1];
  const row = { class: c, build: res.ref.rows[i][2], buildNorm: ref };
  for (const arm of ARMS.slice(2)) { const v = res[arm].rows?.[i]?.[1]; row[arm] = v === ref ? 'app' : v === bld ? 'miss' : `default(${res[arm].rows?.[i]?.[2]})`; }
  return row;
});
const score = Object.fromEntries(ARMS.slice(2).map((a) => [a, table.filter((r) => r[a] === 'app').length + '/' + table.length]));
fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ question: '#219', score, table, errors: Object.fromEntries(ARMS.map((a) => [a, res[a].errs])) }, null, 2));
console.log(JSON.stringify(score));
for (const r of table) console.log([r.class, r.build, ...ARMS.slice(2).map((a) => r[a])].join(' | '));
for (const a of ARMS) if (res[a].errs.length) console.log(a, res[a].errs.slice(0, 3));
