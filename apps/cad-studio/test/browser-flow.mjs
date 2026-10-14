// End-to-end flow in a real Chromium: starts the Vite dev server, drives the studio like a user,
// asserts on visible state and writes a screenshot per step.
//   PW_DIR=/path/to/node_modules/playwright [CHROME=/path/to/chrome] node test/browser-flow.mjs [out-dir]
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve(import.meta.dirname, '..');
if (!process.env.PW_DIR) { console.error('Set PW_DIR to a Playwright package directory.'); process.exit(2); }
const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
const { createServer } = await import('vite');
const out = resolve(process.argv[2] ?? join(tmpdir(), 'cad-studio-flow'));
mkdirSync(out, { recursive: true });

const server = await createServer({ root, configFile: join(root, 'vite.config.ts'), server: { port: 52031, strictPort: false }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

const results = [];
let step = 0;
async function check(name, fn) {
  step++;
  try { await fn(); results.push({ step, name, ok: true }); }
  catch (e) { results.push({ step, name, ok: false, error: String(e.message ?? e).split('\n')[0] }); }
  await page.screenshot({ path: join(out, `${String(step).padStart(2, '0')}-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`) });
}
const outliner = () => page.locator('.outliner').innerText();
const history = () => page.locator('.history').innerText().catch(() => '');
const idle = () => page.waitForFunction(() => !/Computing/.test(document.querySelector('.corner-left')?.textContent ?? ''), null, { timeout: 30000 });
const hudReady = async () => { await page.waitForTimeout(250); return page.waitForFunction(() => /preview|refused/.test(document.querySelector('.hud .status')?.textContent ?? ''), null, { timeout: 15000 }); };
const field = (label) => page.locator('.hud .field', { has: page.locator(`span:text-is("${label}")`) }).locator('input, select');
const press = (k) => page.keyboard.press(k);
const canvasCenter = async () => { const b = await page.locator('canvas').boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };

try {
  await page.goto(url);
  await check('starter plate loads', async () => { await idle(); assert.match(await outliner(), /Hole Ø8/); });

  await check('new part and box', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter'); await idle();
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''));
    assert.match(await history(), /Extrude 16/);
  });

  await check('second box and union', async () => {
    await press('b'); await hudReady(); await field('At X').fill('16'); await field('At Y').fill('16'); await hudReady();
    await page.waitForTimeout(400); await press('Enter'); await page.waitForFunction(() => /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''));
    const rows = page.locator('.outliner .ol'); await rows.nth(0).click(); await rows.nth(1).click({ modifiers: ['Shift'] });
    await press('u'); await page.waitForFunction(() => /Union/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    assert.match(await outliner(), /1 body/);
  });

  await check('undo and redo', async () => {
    await press('Meta+z'); await page.waitForFunction(() => /2 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
    await press('Meta+Shift+z'); await page.waitForFunction(() => /Union/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
  });

  await check('hole on a supported plate', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady();
    await field('Width X').fill('64'); await field('Depth Y').fill('32'); await field('Height Z').fill('8'); await hudReady(); await page.waitForTimeout(400); await press('Enter');
    await page.waitForFunction(() => /Extrude 8/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
    await page.click('.views button:text-is("Top")'); await page.waitForTimeout(300);
    const [cx, cy] = await canvasCenter(); await page.mouse.move(cx, cy); await page.mouse.click(cx, cy);
    await page.waitForFunction(() => /SELECTION · FACE/.test(document.querySelector('.props')?.textContent ?? ''));
    await press('h'); await hudReady(); await field('Diameter').fill('8'); await field('Centre X').fill('32'); await field('Centre Y').fill('16');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 15000 }); await press('Enter');
    await page.waitForFunction(() => /Hole Ø8/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
  });

  await check('unsupported size explains itself', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady();
    await field('Width X').fill('100'); await field('Depth Y').fill('60'); await field('Height Z').fill('5'); await hudReady(); await page.waitForTimeout(400); await press('Enter');
    await page.waitForFunction(() => /Extrude 5/.test(document.querySelector('.history')?.textContent ?? ''), null, { timeout: 15000 });
    await page.click('.views button:text-is("Top")'); await page.waitForTimeout(300);
    const [cx, cy] = await canvasCenter(); await page.mouse.move(cx, cy); await page.mouse.click(cx, cy);
    await press('h'); await hudReady(); await field('Diameter').fill('6'); await field('Centre X').fill('6'); await field('Centre Y').fill('6');
    await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'refused', null, { timeout: 15000 });
    assert.match(await page.locator('.hud-error').innerText(), /size isn’t supported/);
    await press('Escape');
  });

  await check('pattern from the context menu', async () => {
    await page.click('[aria-label="New part"]'); await press('b'); await hudReady(); await press('Enter');
    await page.waitForFunction(() => /1 body/.test(document.querySelector('.outliner')?.textContent ?? ''));
    await page.locator('.outliner .ol').first().click();
    const [cx, cy] = await canvasCenter(); await page.mouse.click(cx, cy + 300, { button: 'right' });
    await page.locator('.ctx-item', { hasText: 'Linear pattern' }).click(); await hudReady(); await page.waitForTimeout(400); await press('Enter');
    await page.waitForFunction(() => /3 bodies/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 15000 });
  });

  await check('command palette and light theme', async () => {
    await press('Escape'); await press(' '); await page.locator('.palette input').fill('fillet');
    assert.match(await page.locator('.palette-list').innerText(), /isn’t available in the kernel yet/);
    await press('Escape'); await page.click('[aria-label="Toggle light or dark theme"]');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
  });
} finally {
  await browser.close(); await server.close();
}

const failed = results.filter(r => !r.ok);
for (const r of results) console.log(`${r.ok ? 'ok' : 'FAIL'} ${r.step} ${r.name}${r.ok ? '' : ' — ' + r.error}`);
if (errors.length) console.log('page errors:', errors.slice(0, 5));
console.log(`screenshots: ${out}`);
process.exit(failed.length || errors.length ? 1 : 0);
