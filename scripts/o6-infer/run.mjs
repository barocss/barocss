// #375 O6 spike: config inferred from the page's built CSS vs the hand-written recipe vs no config.
// Rerun (repo root, after pnpm --filter @barocss/kit build:library && pnpm --filter @barocss/browser build:library):
//   PW_DIR=<dir with node_modules/playwright-core> CHROME=<chromium> [PROBE_PORT=7330] \
//   [ASTRO=/private/tmp/claude-501/cms289] node scripts/o6-infer/run.mjs
// Parity (same method as #255 `tok` / #283 cells): per class an isolated <div class="…"> is added at runtime; its computed
// signature (PROPS) must equal the reference build that compiled the class. Denominator = every runtime class (a
// negative case such as dark-off counts OK when it stays unstyled like ref). Apps:
//   a182 json-render (#182 specs, shadcn @theme inline tokens) · a219 shadcn full token set (#219) · a255t/a255i site theme
//   under @theme / @theme inline (#255 frozen model blocks, theme-token classes only) · a283 the 6 #283 CSS-side customisations
//   · a289 AstroPaper (#289 starter dist vs ref dist, block-element parity like score.mjs, unthrottled, hydrated snapshot).
// Arms: none = baroStart({skipExisting:true}) · recipe = the hand config those probes/docs settled on · inferred =
//   baroStart({skipExisting:true, config: o6InferConfig().config}) computed in-page before start (infer.js).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const S = path.join(ROOT, 'scripts');
const req = createRequire(path.join(ROOT, 'packages/barocss/package.json'));
const { compile } = req('tailwindcss');
const twDir = path.dirname(req.resolve('tailwindcss/package.json'));
const PORT = Number(process.env.PROBE_PORT || 7330);
const ASTRO = process.env.ASTRO || '/private/tmp/claude-501/cms289';
const load = async (id, base) => {
  const p = id === 'tailwindcss' ? path.join(twDir, 'index.css') : path.resolve(base || twDir, id.replace(/^tailwindcss\//, ''));
  const f = fs.existsSync(p) ? p : path.join(twDir, id.replace(/^tailwindcss\//, ''));
  return { path: f, base: path.dirname(f), content: fs.readFileSync(f, 'utf8') };
};
const build = async (css, tokens) => (await compile(css, { base: twDir, loadStylesheet: load })).build(tokens);
const split = (s) => (s || '').split(/\s+/).filter(Boolean);
const toks = (h) => [...h.matchAll(/class(?:Name)?"?\s*[:=]\s*"([^"]*)"/g)].flatMap((m) => split(m[1]));
const uniq = (a) => [...new Set(a)];
const PROPS = ['display', 'margin-top', 'margin-left', 'padding-top', 'padding-left', 'max-width', 'font-family', 'font-size', 'font-weight',
  'line-height', 'letter-spacing', 'color', 'background-color', 'background-image', 'border-top-width', 'border-top-color', 'border-top-left-radius',
  'box-shadow', 'opacity', 'gap', 'grid-template-columns', 'text-align', 'text-decoration-line', 'content-visibility', 'tab-size', 'outline-color',
  'outline-style', 'text-transform', 'flex-direction', 'justify-content', 'align-items'];

// ---- fixtures ------------------------------------------------------------------------------------------------------
const REC242 = (extra = '') => `{cssVarPrefix:'tw',theme:{extend:BaroCSS.shadcnTheme}${extra}}`;
const APPS = {};
{ // #182
  const appCss = fs.readFileSync(path.join(S, 'json-render-probe/app.css'), 'utf8');
  const shell = toks(fs.readFileSync(path.join(S, 'json-render-probe/shell.html'), 'utf8'));
  const specs = fs.readFileSync(path.join(S, 'json-render-probe/specs.json'), 'utf8');
  const cls = uniq([...specs.matchAll(/"className":\s*"([^"]*)"/g)].flatMap((m) => split(m[1]))).filter((c) => !shell.includes(c));
  APPS.a182 = { css: `@import "tailwindcss";\n${appCss}`, shell, classes: cls, recipe: `{}` }; // #182/#210 recipe: skipExisting only
}
{ // #219
  const appCss = fs.readFileSync(path.join(S, 'theme-share-probe/app.css'), 'utf8');
  const src = fs.readFileSync(path.join(S, 'theme-share-probe/run.mjs'), 'utf8');
  const cls = uniq([...src.slice(src.indexOf('const CASES'), src.indexOf('const CLASSES')).matchAll(/\['([^']+)',/g)].map((m) => m[1]));
  APPS.a219 = { css: `@import "tailwindcss";\n${appCss}`, shell: ['flex', 'p-4'], classes: cls, recipe: REC242() };
}
{ // #255
  const site = await import(path.join(S, 'cms-probe/theme-site.mjs'));
  const blocks = fs.readdirSync(path.join(S, 'cms-probe/theme-blocks')).filter((f) => f.endsWith('.html')).map((f) => fs.readFileSync(path.join(S, 'cms-probe/theme-blocks', f), 'utf8')).join('\n');
  const shell = toks(site.SHELL).concat(['prose']);
  const IS_THEME = (t) => /-(brand-\d+(\/\d+)?|accent(\/\d+)?|display|gutter|card)$/.test(t.split(':').pop());
  const cls = uniq(toks(blocks)).filter(IS_THEME).filter((c) => !shell.includes(c));
  const px = (r) => `${parseFloat(r) * 16}px`;
  const lit = JSON.stringify({ colors: { brand: site.BRAND, accent: site.ACCENT }, fontFamily: { display: site.FONT_DISPLAY.split(', ') }, spacing: { gutter: px(site.GUTTER) }, borderRadius: { card: site.RADIUS_CARD } });
  for (const [k, mode] of [['a255t', ''], ['a255i', 'inline']])
    APPS[k] = { css: `@import "tailwindcss";\n${site.THEME_CSS(mode)}\n${site.SITE_BASE_CSS}`, shell, classes: cls, recipe: `{cssVarPrefix:'tw',theme:{extend:${lit}}}` };
}
{ // #283: one sub-app per customisation, same recipe arms as css-config-probe
  const DARK = '@import "tailwindcss";\n@custom-variant dark (&:is(.dark *));';
  const C = {
    dark_class_os_light: { css: DARK, html: 'class="dark"', scheme: 'light', classes: ['dark:bg-red-500', 'dark:text-blue-500'], extra: ",darkMode:'class',darkModeSelector:'.dark &'" },
    dark_noclass_os_dark: { css: DARK, html: '', scheme: 'dark', classes: ['dark:bg-red-500', 'dark:text-blue-500'], extra: ",darkMode:'class',darkModeSelector:'.dark &'" },
    // build shell uses dark: once (a real shadcn app does), otherwise no dark selector is observable
    dark_shellused_os_light: { css: DARK, html: 'class="dark"', scheme: 'light', shell: ['flex', 'p-4', 'dark:bg-black'], classes: ['dark:bg-red-500', 'dark:text-blue-500'], extra: ",darkMode:'class',darkModeSelector:'.dark &'" },
    utility: { css: '@import "tailwindcss";\n@utility content-auto { content-visibility: auto; }\n@utility tab-* { tab-size: --value(integer); }', classes: ['content-auto', 'tab-8'], extra: ",utilities:{'content-auto':{'content-visibility':'auto'}}" },
    utility_shellused: { css: '@import "tailwindcss";\n@utility content-auto { content-visibility: auto; }', shell: ['flex', 'p-4', 'content-auto'], classes: ['md:content-auto', 'hover:content-auto', 'content-auto'], extra: ",utilities:{'content-auto':{'content-visibility':'auto'}}" },
    custom_variant: { css: '@import "tailwindcss";\n@custom-variant theme-midnight (&:where([data-theme=midnight] *));', html: 'data-theme="midnight"', classes: ['theme-midnight:bg-black'], extra: '' },
    prefix_tw: { css: '@import "tailwindcss" prefix(tw);', shell: ['tw:flex', 'tw:p-4'], classes: ['tw:bg-red-500', 'tw:-mt-2', 'tw:p-[3px]!'], extra: ",prefix:'tw'" },
    important: { css: '@import "tailwindcss" important;', shell: ['flex', 'p-4', 'bg-white', 'p-2'], classes: ['bg-blue-500', 'text-lg'], extra: '' },
  };
  for (const [k, c] of Object.entries(C)) APPS[`a283_${k}`] = { css: c.css, html: c.html || '', scheme: c.scheme || 'light', shell: c.shell || ['flex', 'p-4'], classes: c.classes, recipe: REC242(c.extra) };
}

// ---- server ---------------------------------------------------------------------------------------------------------
const BARO = fs.readFileSync(path.join(ROOT, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs'));
const INFER = fs.readFileSync(path.join(HERE, 'infer.js'));
const ARMS = ['ref', 'none', 'recipe', 'inferred'];
const armHead = (arm, recipe) => {
  const base = '<script src="/baro.js"></script><script src="/infer.js"></script>';
  if (arm === 'none') return `${base}<script>BaroCSS.baroStart({skipExisting:true});</script>`;
  if (arm === 'recipe') return `${base}<script>BaroCSS.baroStart({skipExisting:true,config:${recipe}});</script>`;
  if (arm === 'inferred') return `${base}<script>window.__inf=o6InferConfig();BaroCSS.baroStart({skipExisting:true,config:window.__inf.config});</script>`;
  return '';
};
const PAGE_JS = (classes) => `const C=${JSON.stringify(classes)},P=${JSON.stringify(PROPS)};
const sig=(e)=>{const c=getComputedStyle(e);return P.map(p=>c.getPropertyValue(p)).join('|')};
setTimeout(()=>{const o=document.getElementById('out');const blank=document.createElement('div');blank.textContent='x';o.appendChild(blank);
const els=C.map(c=>{const d=document.createElement('div');d.className=c;d.textContent='x';o.appendChild(d);return d;});
setTimeout(()=>{window.__r={blank:sig(blank),vals:els.map(sig)};},800);},300);`;
let cur = null; const CSS = {};
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x'); const send = (t, b) => { r.writeHead(200, { 'content-type': t }); r.end(b); };
  if (u.pathname === '/baro.js') return send('text/javascript', BARO);
  if (u.pathname === '/infer.js') return send('text/javascript', INFER);
  if (u.pathname === '/app') {
    const arm = u.searchParams.get('arm');
    return send('text/html', `<!doctype html><html ${cur.html || ''}><head><meta charset="utf-8"><link rel="stylesheet" href="/${arm === 'ref' ? 'ref' : 'build'}.css">${armHead(arm, cur.recipe)}</head><body><div id="out"></div><script>${PAGE_JS(cur.classes)}</script></body></html>`);
  }
  const m = u.pathname.match(/^\/(\w+)\.css$/); if (m && CSS[m[1]] != null) return send('text/css', CSS[m[1]]);
  // a289: /astro/<arm>/... serves the starter dist (or ref dist) with the arm's head injected into HTML.
  const a = u.pathname.match(/^\/astro\/(\w+)(\/.*)$/);
  if (a) {
    const dir = path.join(ASTRO, a[1] === 'ref' ? 'ref' : 'starter', 'dist');
    let f = path.join(dir, decodeURIComponent(a[2])); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
    const ext = path.extname(f);
    if (ext === '.html') {
      let h = fs.readFileSync(f, 'utf8').replace(/(href|src)="\//g, `$1="/astro/${a[1]}/`);
      if (a[1] !== 'ref') h = h.replace('</head>', `${armHead(a[1], ASTRO_RECIPE)}</head>`);
      return send('text/html', h);
    }
    const T = { '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
    r.writeHead(200, { 'content-type': T[ext] || 'application/octet-stream' }); return fs.createReadStream(f).pipe(r);
  }
  r.writeHead(404); r.end();
});
// docs/guide/integration/astro.md recipe, with AstroPaper's full light token set as literals
const ASTRO_RECIPE = `{cssVarPrefix:'tw',darkMode:'class',darkModeSelector:'[data-theme=dark] &',theme:{extend:{colors:{background:'#fdfdfd',foreground:'#282728',accent:'#006cac','accent-foreground':'#ffffff',muted:'#e6e6e6','muted-foreground':'#6b7280',border:'#ece9e9'}}},utilities:{'max-w-app':{'max-width':'48rem'}}}`;

await new Promise((ok) => srv.listen(PORT, '127.0.0.1', ok));
const { chromium } = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');
const browser = await chromium.launch({ executablePath: process.env.CHROME });
const result = { tailwind: req('tailwindcss/package.json').version, apps: {} };
for (const [name, app] of Object.entries(APPS)) {
  cur = app;
  CSS.build = await build(app.css, app.shell);
  CSS.ref = await build(app.css, [...app.shell, ...app.classes.flatMap(split)]);
  const res = {};
  for (const arm of ARMS) {
    const ctx = await browser.newContext({ colorScheme: app.scheme || 'light' }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
    await p.goto(`http://127.0.0.1:${PORT}/app?arm=${arm}`);
    await p.waitForFunction(() => window.__r, null, { timeout: 15000 }).catch(() => {});
    res[arm] = { ...(await p.evaluate(() => window.__r)), inf: await p.evaluate(() => window.__inf || null), errs };
    await ctx.close();
  }
  const live = app.classes.map((_c, i) => i); // every class; a negative case (dark off) counts OK when it stays unstyled like ref
  const row = { n: live.length };
  for (const arm of ['none', 'recipe', 'inferred']) {
    const miss = live.filter((i) => res[arm].vals?.[i] !== res.ref.vals[i]).map((i) => app.classes[i]);
    row[arm] = live.length - miss.length; row[`${arm}Miss`] = miss.slice(0, 8);
    if (res[arm].errs.length) row[`${arm}Err`] = res[arm].errs[0];
  }
  row.inferredConfig = res.inferred.inf?.config; row.report = res.inferred.inf?.report;
  result.apps[name] = row;
  console.log(`${name.padEnd(28)} n=${row.n} none=${row.none} recipe=${row.recipe} inferred=${row.inferred} miss(inf)=${row.inferredMiss.join(' ')}`);
}
// ---- a289 AstroPaper ------------------------------------------------------------------------------------------------
if (fs.existsSync(path.join(ASTRO, 'starter/dist')) && fs.existsSync(path.join(ASTRO, 'ref/dist'))) {
  const PAGES = ['opus-hero', 'opus-feature-grid', 'opus-comparison-table', 'haiku-callout', 'haiku-testimonial', 'haiku-cta'].map((s) => `/posts/cms/${s}/`);
  const snap = async (arm, pg, scheme = 'light') => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme }); const p = await ctx.newPage();
    await p.goto(`http://127.0.0.1:${PORT}/astro/${arm}${pg}`, { waitUntil: 'load' }); await p.waitForTimeout(1200);
    const r = await p.evaluate((P) => {
      const sig = (e) => { const c = getComputedStyle(e); return P.map((q) => c.getPropertyValue(q)).join('|'); };
      const all = [...document.body.querySelectorAll('[data-block] *')].filter((e) => !/^(SCRIPT|STYLE|TEMPLATE)$/.test(e.tagName));
      return { block: all.map(sig), inf: window.__inf || null };
    }, PROPS);
    await ctx.close(); return r;
  };
  const row = { n: 0, none: 0, recipe: 0, inferred: 0 };
  for (const pg of PAGES) {
    const ref = await snap('ref', pg);
    row.n += ref.block.length;
    for (const arm of ['none', 'recipe', 'inferred']) {
      const c = await snap(arm, pg); row[arm] += c.block.filter((s, i) => s === ref.block[i]).length;
      if (arm === 'inferred' && !row.inferredConfig) { row.inferredConfig = c.inf?.config; row.report = c.inf?.report; }
    }
  }
  result.apps.a289_astropaper = row;
  console.log(`a289_astropaper (block els)  n=${row.n} none=${row.none} recipe=${row.recipe} inferred=${row.inferred}`);
} else console.log('a289 skipped: AstroPaper starter/ref dist not found at', ASTRO);
await browser.close(); srv.close();
fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1));
