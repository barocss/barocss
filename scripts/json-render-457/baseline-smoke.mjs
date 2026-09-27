// Baseline fairness gate, not a primary edit-case measurement.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { ARMS, HOST_CSS, INVENTORIES, VIEWPORTS } from './baseline.mjs';
import { CASES, initialState, specFor } from './cases.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const jrRoot = process.env.JR_ROOT;
const pwDir = process.env.PW_DIR;
const chrome = process.env.CHROME;
if (!jrRoot || !pwDir || !chrome || !fs.existsSync(chrome)) throw new Error('Set JR_ROOT, PW_DIR and CHROME');
const sha = (value) => createHash('sha256').update(value).digest('hex');
const frozen = JSON.parse(fs.readFileSync(path.join(here, 'baseline.json'), 'utf8'));
const fromRepo = createRequire(path.join(root, 'packages/barocss/package.json'));
const fromPW = createRequire(path.join(pwDir, 'package.json'));
const { compile } = fromRepo('tailwindcss');
const esbuild = fromRepo('esbuild');
const { chromium } = fromPW('playwright-core');
const themeCSS = fs.readFileSync(path.join(root, 'scripts/json-render-probe/e2e/app.css'), 'utf8');
const twDir = path.dirname(fromRepo.resolve('tailwindcss/package.json'));
async function buildCSS(tokens) {
  const compiler = await compile(`@import "tailwindcss";\n${themeCSS}`, {
    base: twDir,
    loadStylesheet: async (id, base) => {
      const name = id.replace(/^tailwindcss\//, '');
      const candidate = id === 'tailwindcss' ? path.join(twDir, 'index.css') : path.resolve(base, name);
      const file = fs.existsSync(candidate) ? candidate : path.join(twDir, name);
      return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
    },
  });
  return compiler.build([...new Set(tokens)].sort()) + '\n' + HOST_CSS;
}
const css = {};
for (const arm of ARMS) {
  css[arm] = await buildCSS(INVENTORIES[arm]);
  if (sha(css[arm]) !== frozen.inventory[arm].cssSha256) throw new Error(`${arm} CSS drift from frozen baseline`);
}
const app = await esbuild.build({
  entryPoints: [path.join(here, 'browser-app.jsx')], bundle: true, write: false,
  platform: 'browser', format: 'iife', jsx: 'automatic',
  nodePaths: [path.join(jrRoot, 'node_modules')], define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'error',
});
const appJS = app.outputFiles[0].contents;
const baroJS = fs.readFileSync(path.join(root, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs'));
if (sha(baroJS) !== frozen.baroBundleSha256) throw new Error('BaroCSS bundle drift from frozen baseline');
const shell = (arm) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/${arm}"></head><body><div id="host">Host app sentinel</div><main id="out"></main>${arm === 'utility' ? '<script src="/baro.js"></script><script>BaroCSS.baroStart({skipExisting:true,config:{cssVarPrefix:"tw",theme:{extend:BaroCSS.shadcnTheme}}});</script>' : ''}<script src="/app.js"></script></body></html>`;
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const send = (type, body) => { res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body); };
  if (u.pathname === '/') { const arm = u.searchParams.get('arm'); if (ARMS.includes(arm)) return send('text/html', shell(arm)); }
  if (u.pathname === '/app.js') return send('text/javascript', appJS);
  if (u.pathname === '/baro.js') return send('text/javascript', baroJS);
  const match = u.pathname.match(/^\/css\/(preset|variable|utility|build)$/);
  if (match) return send('text/css', css[match[1]]);
  res.writeHead(404); res.end();
});
await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
const baseURL = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const rows = [];
const evidence = path.join(here, 'evidence');
fs.mkdirSync(evidence, { recursive: true });
try {
  for (const viewportName of Object.keys(VIEWPORTS)) for (const arm of ARMS) {
    const page = await browser.newPage({ viewport: VIEWPORTS[viewportName], reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => { if (!request.url().startsWith(baseURL)) errors.push(`external request: ${request.url()}`); });
    try {
      await page.goto(`${baseURL}/?arm=${arm}`, { waitUntil: 'load' });
      const spec = specFor(CASES[0], arm, false);
      const rendered = await page.evaluate(({ arm, state, spec }) => window.REPLAY.mount(arm, state, spec), { arm, state: initialState('settings'), spec });
      const computed = await page.evaluate(() => {
        const layout = getComputedStyle(document.querySelector('[data-node-id="layout"]'));
        const button = getComputedStyle(document.querySelector('[data-node-id="save"]'));
        const host = getComputedStyle(document.getElementById('host'));
        return { padding: layout.paddingTop, gap: layout.columnGap, radius: layout.borderTopLeftRadius,
          columns: layout.gridTemplateColumns.trim().split(/\s+/).length,
          layoutBackground: layout.backgroundColor, layoutColor: layout.color, buttonBackground: button.backgroundColor,
          host: [host.color, host.backgroundColor, host.fontSize, host.position, host.zIndex] };
      });
      const screenshot = `baseline-${viewportName}-${arm}.png`;
      await page.screenshot({ path: path.join(evidence, screenshot) });
      rows.push({ viewport: viewportName, arm, schemaValid: rendered.ok, errors: [...rendered.errors, ...errors], computed, screenshot });
    } finally { await page.close(); }
  }
} finally { await browser.close(); await new Promise((resolve) => srv.close(resolve)); }
const reference = Object.fromEntries(Object.keys(VIEWPORTS).map((name) => [name, rows.find((row) => row.viewport === name && row.arm === 'preset').computed]));
for (const row of rows) {
  const expected = reference[row.viewport];
  if (!row.schemaValid || row.errors.length || JSON.stringify(row.computed) !== JSON.stringify(expected)) {
    throw new Error(`baseline mismatch ${row.viewport}/${row.arm}: ${JSON.stringify({ row, expected })}`);
  }
}
const report = { kind: 'baseline-smoke', baselineSha256: sha(fs.readFileSync(path.join(here, 'baseline.json'))), rows };
fs.writeFileSync(path.join(evidence, 'baseline-smoke.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`Baseline smoke: ${rows.length} initial cells, exact computed equality across arms at both viewports`);
