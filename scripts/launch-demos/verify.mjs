// #379: headless check of the launch demos. The @barocss/browser 0.10.1 CDN URL is routed to the workspace build
// (packages/barocss-browser/dist/cdn, version 0.10.1); other external requests are aborted (no network).
// Rerun: PW_DIR=<dir containing node_modules/playwright-core> CHROME=<chromium> [PORT=7451] [SHOTS=<dir>] node scripts/launch-demos/verify.mjs
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const PORT = Number(process.env.PORT || 7451);
const { chromium } = createRequire(path.join(process.env.PW_DIR, 'x.js'))('playwright-core');
const BARO = fs.readFileSync(path.join(ROOT, 'packages/barocss-browser/dist/cdn/barocss.umd.cjs'));
const srv = spawn(process.execPath, [path.join(HERE, 'serve.mjs'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 500));
const browser = await chromium.launch({ executablePath: process.env.CHROME });
const B = `http://localhost:${PORT}/demos/`;
const results = [];
async function run(name, url, check) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [], csp = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); if (/Content Security Policy/.test(m.text())) csp.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('response', (r) => { if (r.status() >= 400) errors.push('HTTP ' + r.status() + ' ' + r.url()); });
  await page.route(/^https?:\/\/(?!localhost)/, (r) => (r.request().url().includes('@barocss/browser@0.10.1')
    ? r.fulfill({ body: BARO, contentType: 'text/javascript' }) : r.abort()));
  await page.goto(url);
  const out = await check(page);
  if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, name + '.png'), fullPage: false });
  results.push({ name, ...out, consoleErrors: errors.length, cspConsole: csp.length, firstError: errors[0] });
  await page.close();
}
const styledHero = (p) => p.evaluate(() => { const h = document.querySelector('[data-block="hero"] > *'); return !!h && getComputedStyle(h).backgroundImage !== 'none'; });
for (const rt of ['baro', 'none']) await run('cms-' + rt, B + 'cms/?rt=' + rt, async (p) => { await p.waitForFunction(() => window.__demo, null, { timeout: 10000 }); return p.evaluate(() => window.__demo); });
for (const rt of ['baro', 'none']) await run('widget-' + rt, B + 'widget/?rt=' + rt, async (p) => {
  await p.waitForFunction(() => window.__demo && window.__demo.done, null, { timeout: 10000 }); await p.waitForTimeout(300);
  return p.evaluate(() => { const sr = document.querySelector('chat-widget').shadowRoot, h = sr.querySelector('.bg-indigo-600');
    return { ...window.__demo, headerBg: getComputedStyle(h).backgroundColor, rootSheets: sr.adoptedStyleSheets.length + sr.querySelectorAll('style').length, docStyles: document.querySelectorAll('style').length + document.adoptedStyleSheets.length }; });
});
for (const arm of ['with', 'without']) await run('ssr-' + arm, B + `ssr/${arm}.html?delay=1500`, async (p) => {
  await p.waitForLoadState('load');
  const firstPaint = await styledHero(p);
  await p.waitForFunction(() => window.__demoHydrated, null, { timeout: 10000 }); await p.waitForTimeout(300);
  return { styledBeforeRuntime: firstPaint, styledAfterRuntime: await styledHero(p) };
});
await browser.close(); srv.kill();
for (const r of results) console.log(JSON.stringify(r));
