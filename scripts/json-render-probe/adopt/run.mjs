// #239 L3: can a fresh AI agent set up BaroCSS companion mode in a built shadcn app from the package docs alone?
// Rerun (repo root, after pnpm --filter @barocss/kit build:library && pnpm --filter @barocss/browser build:library):
//   node scripts/json-render-probe/adopt/run.mjs prepare <dir>        # starting app (no BaroCSS wired) + vendor/ + docs/
//   (cd <dir> && env -u CLAUDECODE claude -p "$(cat scripts/json-render-probe/adopt/task.txt)" --model <m> \
//      --permission-mode acceptEdits --setting-sources project --strict-mcp-config \
//      --disallowedTools Bash WebFetch WebSearch Task --max-budget-usd <b> --output-format json > <dir>.out.json)
//   PW_DIR=<dir containing node_modules/playwright-core> CHROME=<chromium> [PROBE_PORT=6031] \
//     node scripts/json-render-probe/adopt/run.mjs score <dir> [<dir>...]
//   (runs.sh does all of it for 3 runs x opus/haiku; writes adopt/result.json, gitignored.)
// App = ../shell.html + the #231 shadcn component classes and renderer (../e2e) + frozen model specs (../e2e/specs),
// built by Tailwind compile() for the shell/components only, so spec className tokens have no CSS.
// Score = #231 element parity of the agent-modified app vs the reference build that also saw the spec classes.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const E2E = path.join(HERE, '../e2e');
const ROOT = path.resolve(HERE, '../../..');
const req = createRequire(path.join(ROOT, 'packages/barocss/package.json'));
const { compile } = req('tailwindcss');
const twDir = path.dirname(req.resolve('tailwindcss/package.json'));
const SHELL = fs.readFileSync(path.join(HERE, '../shell.html'), 'utf8');
const APP_CSS = fs.readFileSync(path.join(E2E, 'app.css'), 'utf8');
const RUNSRC = fs.readFileSync(path.join(E2E, 'run.mjs'), 'utf8');
const PAGESRC = fs.readFileSync(path.join(E2E, 'page.js'), 'utf8');
const COMP = new Function('return ' + RUNSRC.match(/const COMP = (\{[\s\S]*?\n\});/)[1])();
const RENDER = PAGESRC.match(/(function h\([\s\S]*?)\n  function audit/)[1];
const SPECS = Object.fromEntries(fs.readdirSync(path.join(E2E, 'specs')).sort().map((f) => [f.replace('.json', ''), JSON.parse(fs.readFileSync(path.join(E2E, 'specs', f), 'utf8'))]));
const split = (s) => (s || '').split(/\s+/).filter(Boolean);
const shellTokens = [...SHELL.matchAll(/class="([^"]*)"/g)].flatMap((m) => split(m[1])).concat(Object.values(COMP).flatMap(split));
const specTok = (s) => Object.values(s.elements).flatMap((e) => (typeof e.props?.className === 'string' ? split(e.props.className) : []));
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

const APP_JS = `// Renders a json-render spec (from a model) with the shadcn catalog. Open index.html?spec=<name> (specs/<name>.json).
(function () {
  var C = ${JSON.stringify(COMP, null, 1)};
  ${RENDER}
  window.renderSpec = function (spec) { var out = document.getElementById('out'); out.innerHTML = ''; out.appendChild(render(spec, spec.root)); };
  addEventListener('load', function () {
    var name = new URLSearchParams(location.search).get('spec') || 'opus-dashboard';
    fetch('specs/' + name + '.json').then(function (r) { return r.json(); }).then(window.renderSpec);
  });
})();
`;
const INDEX = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=1280"><title>Acme</title>
<link rel="stylesheet" href="build.css">
<script src="app.js"></script>
</head><body>
${SHELL}</body></html>
`;
const MEASURE = `<script>(function(){var P=${JSON.stringify(['display', 'position', 'margin-top', 'margin-left', 'padding-top', 'padding-left', 'width', 'max-width', 'height', 'top', 'left', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-transform', 'color', 'background-color', 'border-top-width', 'border-top-style', 'border-top-color', 'border-top-left-radius', 'box-shadow', 'opacity', 'translate', 'gap', 'grid-template-columns', 'flex-direction', 'justify-content', 'align-items', 'backdrop-filter', 'outline-style', 'box-sizing', 'text-align', 'background-image', 'row-gap'])};
function sig(s){return [].map.call(document.querySelectorAll(s),function(e){var c=getComputedStyle(e);return P.map(function(p){return c.getPropertyValue(p)})})}
var t0=Date.now();(function w(){if(document.querySelector('[data-spec]'))return setTimeout(function(){window.__r={spec:sig('[data-spec]'),shell:sig('[data-shell]')}},1500);if(Date.now()-t0>8000)return window.__r={spec:[],shell:[]};setTimeout(w,50)})();})();</script>`;

const [mode, ...dirs] = process.argv.slice(2);
if (mode === 'prepare') {
  const d = path.resolve(dirs[0]);
  fs.mkdirSync(path.join(d, 'specs'), { recursive: true }); fs.mkdirSync(path.join(d, 'vendor'), { recursive: true }); fs.mkdirSync(path.join(d, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(d, 'index.html'), INDEX); fs.writeFileSync(path.join(d, 'app.js'), APP_JS);
  fs.writeFileSync(path.join(d, 'build.css'), await build(shellTokens));
  for (const [k, s] of Object.entries(SPECS)) fs.writeFileSync(path.join(d, 'specs', k + '.json'), JSON.stringify(s, null, 2));
  fs.copyFileSync(path.join(ROOT, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs'), path.join(d, 'vendor/barocss.umd.cjs'));
  fs.copyFileSync(path.join(ROOT, 'packages/barocss-browser/README.md'), path.join(d, 'docs/barocss-browser-README.md'));
  if (fs.existsSync(path.join(ROOT, 'packages/barocss/README.md'))) fs.copyFileSync(path.join(ROOT, 'packages/barocss/README.md'), path.join(d, 'docs/barocss-README.md'));
  console.log('prepared', d);
} else if (mode === 'score') {
  const PORT = Number(process.env.PROBE_PORT || 6031);
  const refCss = {}; for (const k of Object.keys(SPECS)) refCss[k] = await build([...shellTokens, ...specTok(SPECS[k])]);
  const roots = { ref: null, ...Object.fromEntries(dirs.map((d, i) => ['a' + i, path.resolve(d)])) };
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.cjs': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
  const srv = http.createServer((q, r) => {
    const u = new URL(q.url, 'http://x'), [, arm, ...rest] = u.pathname.split('/'), rel = rest.join('/') || 'index.html';
    const send = (t, b) => { r.writeHead(200, { 'content-type': t }); r.end(b); };
    if (arm === 'ref') { // pristine app, reference CSS
      if (rel === 'build.css') return send('text/css', refCss[u.searchParams.get('k')]);
      if (rel === 'index.html') return send('text/html', INDEX.replace('build.css', 'build.css?k=' + u.searchParams.get('spec')).replace('</body>', MEASURE + '</body>'));
      if (rel === 'app.js') return send('text/javascript', APP_JS);
      if (rel.startsWith('specs/')) return send('application/json', JSON.stringify(SPECS[path.basename(rel, '.json')]));
    } else if (roots[arm]) {
      const f = path.join(roots[arm], rel);
      if (f.startsWith(roots[arm]) && fs.existsSync(f) && fs.statSync(f).isFile()) {
        let b = fs.readFileSync(f); if (rel === 'index.html') b = String(b).replace(/<\/body>/i, MEASURE + '</body>');
        return send(TYPES[path.extname(f)] || 'application/octet-stream', b);
      }
    }
    r.writeHead(404); r.end();
  });
  await new Promise((ok) => srv.listen(PORT, '127.0.0.1', ok));
  const { chromium } = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');
  const browser = await chromium.launch({ executablePath: process.env.CHROME });
  const get = async (arm, k) => {
    const p = await browser.newPage({ viewport: { width: 1280, height: 1400 } }), errs = [];
    p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
    await p.goto(`http://127.0.0.1:${PORT}/${arm}/index.html?spec=${k}`);
    const r = await p.waitForFunction(() => window.__r, null, { timeout: 15000 }).then((x) => x.jsonValue()).catch(() => ({ spec: [], shell: [] }));
    await p.close(); return { ...r, errs };
  };
  function cmp(a, b) { if (!a || !b || !b.length || a.length !== b.length) return { elem: 0, prop: 0 }; let s = 0, n = 0, bad = 0; a.forEach((row, i) => { let ok = true; row.forEach((v, j) => { n++; if (v === b[i][j]) s++; else ok = false; }); if (!ok) bad++; }); return { prop: s / n, elem: 1 - bad / a.length }; }
  const ref = {}; for (const k of Object.keys(SPECS)) ref[k] = await get('ref', k);
  const out = [];
  for (const [i, d] of dirs.entries()) {
    const per = {}, errs = new Set();
    for (const k of Object.keys(SPECS)) { const r = await get('a' + i, k); r.errs.forEach((e) => errs.add(e)); per[k] = { ...cmp(r.spec, ref[k].spec), shell: cmp(r.shell, ref[k].shell).prop }; }
    const avg = (f) => +(Object.values(per).reduce((s, x) => s + x[f], 0) / Object.keys(per).length).toFixed(3);
    out.push({ dir: path.basename(d), elemParity: avg('elem'), propParity: avg('prop'), shellParity: avg('shell'), errs: [...errs].slice(0, 2), per });
    console.log(path.basename(d).padEnd(14), 'elem', avg('elem'), 'prop', avg('prop'), 'shell', avg('shell'), [...errs].slice(0, 1).join(''));
  }
  await browser.close(); srv.close();
  if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(out, null, 1));
} else console.log('usage: run.mjs prepare <dir> | score <dir>...');
