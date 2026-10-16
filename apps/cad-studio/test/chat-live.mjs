// Real end-to-end (not part of the test suite: it spends model usage): the studio in Chromium (WebGPU)
// → chat panel → chat server → claude CLI → the studio's tools. Start `pnpm chat` first, then
//   PW_DIR=… CHROME=… node test/chat-live.mjs . <out-dir> test/fixtures/chat-cat.png "이 캐릭터를 실사화해서 입체 피규어로 모델링해줘"
// It prints the transcript and the feature list and saves a screenshot.
import { createRequire } from 'node:module';
import { join } from 'node:path';
const [root, out, image, prompt] = process.argv.slice(2);
const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
const { createServer } = await import(createRequire(join(root, 'package.json')).resolve('vite'));
const server = await createServer({ root, configFile: join(root, 'vite.config.ts'), server: { port: 52033, strictPort: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('dialog', d => d.accept());
await page.goto(server.resolvedUrls.local[0]);
await page.waitForFunction(() => !/Computing/.test(document.querySelector('.corner-left')?.textContent ?? ''));
await page.click('[aria-label="New part"]');
await page.click('[aria-label="Chat"]');
await page.waitForFunction(() => !document.querySelector('[aria-label="Chat message"]')?.disabled, null, { timeout: 15000 });
await page.setInputFiles('[aria-label="Chat image file"]', image);
await page.waitForSelector('[aria-label="Attached images"] img');
await page.fill('[aria-label="Chat message"]', prompt);
const t0 = Date.now();
await page.click('.chat-input button:text-is("Send")');
await page.waitForFunction(() => !document.querySelector('.chat-msg.busy'), null, { timeout: 600000 });
await page.waitForTimeout(1000); await page.waitForFunction(() => !/Computing/.test(document.querySelector('.corner-left')?.textContent ?? ''), null, { timeout: 300000 });
await page.evaluate(() => document.activeElement?.blur());
await page.click('.views button:text-is("Iso")'); await page.waitForTimeout(800);
await page.screenshot({ path: join(out, process.env.SHOT ?? 'live-cat.png') });
const transcript = await page.locator('.chat-log').innerText();
const nodes = await page.evaluate(() => window.__studioDoc.nodes.map(n => n.kind + (n.kind === 'extrude' ? ` h${n.height}${n.from ? ' from ' + n.from : ''}` : '')));
const status = await page.locator('.corner-left').innerText();
console.log(JSON.stringify({ seconds: Math.round((Date.now() - t0) / 1000), nodes, status, transcript }, null, 1));
await browser.close(); await server.close();
