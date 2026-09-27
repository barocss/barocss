// #448: compare both discovery orders and later DOM insertion in one installed Chromium.
// PW_DIR=<playwright-core project> CHROME=<Chromium executable> node scripts/dark-order-448/run.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const deps = createRequire(path.join(root, 'packages/barocss/package.json'));
const { compile } = deps('tailwindcss');
assert.equal(deps('tailwindcss/package.json').version, '4.3.3');
const { chromium } = createRequire(path.join(process.env.PW_DIR, 'node_modules/'))('playwright-core');
const umd = fs.readFileSync(path.join(root, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs'));
const theme = fs.readFileSync(path.join(path.dirname(deps.resolve('tailwindcss/package.json')), 'theme.css'), 'utf8');
const css = (await compile(`${theme}\n@custom-variant dark (&:where(.dark, .dark *));\n@tailwind utilities;`))
  .build(['text-slate-900', 'dark:text-white']);
const cases = [
  { id: 'static-base-first', first: 'text-slate-900', second: 'dark:text-white', dynamic: false },
  { id: 'static-dark-first', first: 'dark:text-white', second: 'text-slate-900', dynamic: false },
  { id: 'dynamic-base-first', first: 'text-slate-900', second: 'dark:text-white', dynamic: true },
  { id: 'dynamic-dark-first', first: 'dark:text-white', second: 'text-slate-900', dynamic: true },
];
const config = { preflight: false, darkMode: 'class', darkModeSelector: '&:where(.dark,.dark *)' };
const html = (c, mode) => `<!doctype html><html><head><style>*{box-sizing:border-box}body{margin:0;background:#fff;font:20px Arial}#probe{display:block;width:320px;height:80px;padding:20px}</style>${mode === 'tailwind' ? `<style>${css}</style>` : '<script src="/baro.js"></script>'}</head><body><p id="probe" class="${c.first}${c.dynamic ? '' : ` ${c.second}`}">Dark text parity</p>${mode === 'baro' ? `<script>window.runtime=new BaroCSS.BrowserRuntime({config:${JSON.stringify(config)},gc:false});window.runtime.observe(document.body,{scan:true})</script>` : ''}</body></html>`;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/baro.js') { res.setHeader('content-type', 'text/javascript'); res.end(umd); return; }
  const c = cases.find(x => x.id === url.searchParams.get('case'));
  const mode = url.searchParams.get('mode');
  if (!c || !['baro', 'tailwind'].includes(mode)) { res.statusCode = 404; res.end('Not found'); return; }
  res.setHeader('content-type', 'text/html'); res.end(html(c, mode));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ executablePath: process.env.CHROME });
const failures = [];
const rows = [];
const base = `http://127.0.0.1:${server.address().port}`;
try {
  for (const c of cases) {
    const pages = {};
    for (const mode of ['tailwind', 'baro']) {
      const page = await browser.newPage({ viewport: { width: 360, height: 120 }, deviceScaleFactor: 1, colorScheme: 'light' });
      page.on('pageerror', e => failures.push(`${c.id}/${mode}: ${e.message}`));
      await page.goto(`${base}/?case=${c.id}&mode=${mode}`, { waitUntil: 'load' });
      pages[mode] = page;
    }
    if (c.dynamic) for (const page of Object.values(pages)) {
      await page.evaluate(second => document.querySelector('#probe').classList.add(second), c.second);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    }
    for (const dark of [false, true]) {
      const measured = {};
      for (const [mode, page] of Object.entries(pages)) {
        await page.evaluate(value => document.documentElement.classList.toggle('dark', value), dark);
        measured[mode] = { color: await page.locator('#probe').evaluate(el => getComputedStyle(el).color),
          png: await page.locator('#probe').screenshot() };
      }
      const row = { case: c.id, dark, referenceColor: measured.tailwind.color, baroColor: measured.baro.color,
        samePixels: measured.tailwind.png.equals(measured.baro.png) };
      rows.push(row);
      assert.equal(row.baroColor, row.referenceColor, `${c.id}: computed color (dark=${dark})`);
      assert.equal(row.samePixels, true, `${c.id}: rendered pixels (dark=${dark})`);
    }
    await Promise.all(Object.values(pages).map(page => page.close()));
  }
  assert.deepEqual(failures, []);
  assert.equal(new Set(rows.filter(x => x.dark).map(x => x.referenceColor)).size, 1);
  assert.equal(new Set(rows.filter(x => !x.dark).map(x => x.referenceColor)).size, 1);
  assert.notEqual(rows[0].referenceColor, rows[1].referenceColor);
  const output = { tailwind: deps('tailwindcss/package.json').version, chromium: await browser.version(),
    bundleSha256: createHash('sha256').update(umd).digest('hex'), cases: rows, failures };
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(output, null, 2) + '\n');
  console.log(`${rows.length} light/dark/order/dynamic comparisons: computed colors and rendered pixels match`);
} finally {
  await browser.close(); server.close();
}
