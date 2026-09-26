// #283 CSS-side Tailwind 4 config vs companion mode. Rerun (repo root, after kit+browser build:library):
//   PW_DIR=<dir with node_modules/playwright-core> CHROME=<chromium> [PROBE_PORT=6883] node scripts/css-config-probe/run.mjs
// Per customisation: build = compile(app CSS + customisation) over shell tokens; ref = same + the runtime classes;
// baro = build + #242 recipe (baroStart({skipExisting, config:{cssVarPrefix:'tw', theme:{extend:shadcnTheme}}})) with the
// classes added at runtime. Extra arms try existing config options. Cell = computed value; OK = equals ref.
// SUMMARY (observed 2026-09-26, tailwindcss 4.1.13, 6 customisations):
//  1 shadcn `@custom-variant dark (&:is(.dark *))`: recipe (darkMode default 'media') MISMATCHES both ways (html.dark + OS light
//    -> no dark styles; OS dark w/o .dark -> dark styles applied). darkMode:'class' alone emits `.dark` ON THE SAME element
//    (still misses under html.dark). Existing route that matches both: config darkMode:'class', darkModeSelector:'.dark &'
//    (or '&:is(.dark *)'). Route = docs/recipe (+ arguably fix darkMode:'class' default to the ancestor form).
//  2 `@utility content-auto` / `@utility tab-*`: runtime miss (incl. hover:). No public API in the UMD to register
//    utilities (registry staticUtility/functionalUtility not exported) -> BaroCSS gap (or read @utility from build CSS: not
//    possible, the build only emits used utilities).
//  3 `@custom-variant theme-midnight`: runtime miss; no public variant registration -> same gap as 2.
//  4 `prefix(tw)`: tw:bg-red-500 unstyled; bare bg-red-500 IS generated (build would not). config.prefix exists in context
//    types but is not used for parsing -> gap: prefix support.
//  5 `important`: runtime-only classes style fine, but a runtime class that conflicts with an important build class on the
//    same element loses (p-2 p-8 -> 8px, ref 32px). Route: config/important flag for runtime output (parser has
//    `important?`) or document that important builds need `!` classes.
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
const PORT = Number(process.env.PROBE_PORT || 6883);
const load = async (id) => {
  const p = id === 'tailwindcss' ? path.join(twDir, 'index.css') : path.join(twDir, id.replace(/^tailwindcss\//, ''));
  return { path: p, base: path.dirname(p), content: fs.readFileSync(p, 'utf8') };
};
const build = async (css, tokens) => (await compile(css, { base: twDir, loadStylesheet: load })).build(tokens);
const SHELL = ['flex', 'p-4'];
const REC = (extra = '') => `{skipExisting:true,config:{cssVarPrefix:'tw',theme:{extend:BaroCSS.shadcnTheme}${extra}}}`;
const DARK = '@import "tailwindcss";\n@custom-variant dark (&:is(.dark *));';

// rows: [classes, property, 'hover'?]
const CASES = {
  dark_class_os_light: { css: DARK, html: 'class="dark"', scheme: 'light',
    rows: [['dark:bg-red-500', 'background-color'], ['dark:text-blue-500', 'color']],
    arms: { recipe: REC(), darkModeClass: REC(",darkMode:'class'"), darkSelDesc: REC(",darkMode:'class',darkModeSelector:'.dark &'"), darkSelIs: REC(",darkMode:'class',darkModeSelector:'&:is(.dark *)'") } },
  dark_noclass_os_dark: { css: DARK, html: '', scheme: 'dark',
    rows: [['dark:bg-red-500', 'background-color'], ['dark:text-blue-500', 'color']],
    arms: { recipe: REC(), darkModeClass: REC(",darkMode:'class'"), darkSelDesc: REC(",darkMode:'class',darkModeSelector:'.dark &'"), darkSelIs: REC(",darkMode:'class',darkModeSelector:'&:is(.dark *)'") } },
  utility: { css: '@import "tailwindcss";\n@utility content-auto { content-visibility: auto; }\n@utility tab-* { tab-size: --value(integer); }', html: '', scheme: 'light',
    rows: [['content-auto', 'content-visibility'], ['tab-8', 'tab-size'], ['hover:content-auto', 'content-visibility', 'hover']],
    arms: { recipe: REC() } },
  custom_variant: { css: '@import "tailwindcss";\n@custom-variant theme-midnight (&:where([data-theme=midnight] *));', html: 'data-theme="midnight"', scheme: 'light',
    rows: [['theme-midnight:bg-black', 'background-color']], arms: { recipe: REC() } },
  prefix_tw: { css: '@import "tailwindcss" prefix(tw);', html: '', scheme: 'light', shell: ['tw:flex', 'tw:p-4'],
    rows: [['tw:bg-red-500', 'background-color'], ['bg-red-500', 'background-color']],
    arms: { recipe: REC(), prefixCfg: REC(",prefix:'tw'") } },
  // build classes bg-white / p-2 exist (important); runtime adds a conflicting class on the same element.
  important: { css: '@import "tailwindcss" important;', html: '', scheme: 'light', shell: ['flex', 'p-4', 'bg-white', 'p-2'],
    rows: [['bg-white bg-red-500', 'background-color'], ['p-2 p-8', 'padding-top'], ['bg-blue-500', 'background-color']],
    arms: { recipe: REC() } },
};

const PAGE_JS = (rows) => `const R=${JSON.stringify(rows)};
setTimeout(()=>{const els=R.map(([c])=>{const d=document.createElement('div');d.className=c;d.textContent='x';document.getElementById('out').appendChild(d);return d;});
setTimeout(()=>{window.__r=R.map(([c,p],i)=>getComputedStyle(els[i]).getPropertyValue(p));},800);},300);`;
const page = (c, arm) => {
  const head = arm === 'ref' ? '<link rel="stylesheet" href="/ref.css">' : arm === 'build' ? '<link rel="stylesheet" href="/build.css">'
    : `<link rel="stylesheet" href="/build.css"><script src="/baro.js"></script><script>BaroCSS.baroStart(${c.arms[arm]});</script>`;
  return `<!doctype html><html ${c.html}><head><meta charset="utf-8">${head}</head><body><div id="out"></div><script>${PAGE_JS(c.rows)}</script></body></html>`;
};
let cur = null; const CSS = {};
const BARO = fs.readFileSync(path.join(ROOT, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs'));
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x'); const send = (t, b) => { r.writeHead(200, { 'content-type': t }); r.end(b); };
  if (u.pathname === '/app') return send('text/html', page(cur, u.searchParams.get('arm')));
  if (u.pathname === '/baro.js') return send('text/javascript', BARO);
  const m = u.pathname.match(/^\/(\w+)\.css$/); if (m && CSS[m[1]] != null) return send('text/css', CSS[m[1]]);
  r.writeHead(404); r.end();
});
await new Promise((ok) => srv.listen(PORT, '127.0.0.1', ok));
const { chromium } = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');
const browser = await chromium.launch({ executablePath: process.env.CHROME });
const out = {};
for (const [name, c] of Object.entries(CASES)) {
  cur = c; const shell = c.shell || SHELL;
  CSS.build = await build(c.css, shell);
  CSS.ref = await build(c.css, [...shell, ...c.rows.flatMap((r) => r[0].split(' '))]);
  const res = {};
  for (const arm of ['ref', 'build', ...Object.keys(c.arms)]) {
    const ctx = await browser.newContext({ colorScheme: c.scheme }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
    await p.goto(`http://127.0.0.1:${PORT}/app?arm=${arm}`);
    await p.waitForFunction(() => window.__r, null, { timeout: 15000 }).catch(() => {});
    let vals = await p.evaluate(() => window.__r);
    const hov = c.rows.findIndex((r) => r[2] === 'hover');
    if (hov >= 0 && vals) {
      await p.hover(`#out > div:nth-child(${hov + 1})`); await p.waitForTimeout(300);
      vals = [...vals];
      vals[hov] = await p.evaluate(([i, prop]) => getComputedStyle(document.querySelectorAll('#out>div')[i]).getPropertyValue(prop), [hov, c.rows[hov][1]]);
    }
    res[arm] = { vals, errs }; await ctx.close();
  }
  out[name] = res;
  console.log(`## ${name}`);
  c.rows.forEach((r, i) => console.log([r[0], `ref=${res.ref.vals?.[i]}`, `build=${res.build.vals?.[i]}`,
    ...Object.keys(c.arms).map((a) => `${a}=${res[a].vals?.[i]}${res[a].vals?.[i] === res.ref.vals?.[i] ? ' OK' : ' X'}`)].join(' | ')));
  for (const a of Object.keys(res)) if (res[a].errs.length) console.log(' err', a, res[a].errs[0]);
}
await browser.close(); srv.close();
fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 2));
