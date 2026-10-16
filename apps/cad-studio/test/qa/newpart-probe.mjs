// QA probe: "New part" pressed while a sketch is open — does the old sketch (and its shapes) carry over?
//   PW_DIR=… [CHROME=…] node test/qa/newpart-probe.mjs
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
const { createServer } = await import('vite');
const server = await createServer({ root, configFile: join(root, 'vite.config.ts'), server: { port: 52046, strictPort: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto(server.resolvedUrls.local[0]); await page.waitForTimeout(2000);
const press = k => page.keyboard.press(k);
const cc = async () => { const b = await page.locator('canvas').boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
const clickAt = async (x, y) => { await page.mouse.move(x - 4, y); await page.mouse.move(x, y); await page.mouse.click(x, y); };
await page.click('[aria-label="New part"]'); await page.waitForTimeout(500);
await press('s'); await press('r'); const [cx, cy] = await cc(); await clickAt(cx - 60, cy - 40); await clickAt(cx + 60, cy + 40);
const before = await page.evaluate(() => window.__studioDoc.nodes.length);
await page.click('[aria-label="New part"]'); await page.waitForTimeout(500);
const stillSketching = await page.locator('.sk-panel').count();
const fileName = await page.inputValue('.doc-tab input');
await page.click('.topbar button.finish').catch(() => {}); await page.waitForTimeout(600);
const hud = await page.locator('.hud').count(); if (hud) { await page.waitForTimeout(500); await press('Enter'); await page.waitForTimeout(1500); }
const d = await page.evaluate(() => window.__studioDoc);
console.log(JSON.stringify({ nodesBeforeNewPart: before, stillSketchingAfterNewPart: !!stillSketching, fileName, afterFinish: d.nodes.map(n => n.kind + (n.profile ? ':' + n.profile : '')), errors }));
await browser.close(); await server.close();
