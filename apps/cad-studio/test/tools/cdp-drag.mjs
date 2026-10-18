// PERF3 C15 (D82): a feature handle dragged 60 steps (the starter plate's hole's centre puck): main-thread script, task,
// layout and style time from CDP Performance.getMetrics, and a CPU profile (<out>/<TAG>.cpuprofile). Opt-in:
//   VITE_URL=$(node --input-type=module -e "console.log(import.meta.resolve('vite'))") PW_DIR=/path/to/node_modules/playwright \
//   [CHROME=...] [PROD=<build dir>] [NOMIN=1] [TAG=name] node test/tools/cdp-drag.mjs "$PWD" <out-dir>
// PROD builds the studio (vite build) and drags in its preview, as people run it; NOMIN=1 keeps function names.
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
const root = process.argv[2], out = process.argv[3];
const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
const vite = await import(process.env.VITE_URL);
let server;
if (process.env.PROD) {
  // (A production build, as people run it: no development React.)
  await vite.build({ root, configFile: join(root, 'vite.config.ts'), logLevel: 'error', build: { outDir: process.env.PROD, minify: !process.env.NOMIN } });
  server = await vite.preview({ root, configFile: join(root, 'vite.config.ts'), preview: { port: 52065, strictPort: false }, build: { outDir: process.env.PROD }, logLevel: 'error' });
} else { server = await vite.createServer({ root, configFile: join(root, 'vite.config.ts'), server: { port: 52064, strictPort: false }, logLevel: 'error' }); await server.listen(); }
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
try {
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => !/Computing/.test(document.querySelector('.corner-left')?.textContent ?? '') && /Hole Ø8/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 });
  await page.locator('.history button, .history [role=button], .history *', { hasText: 'Hole Ø8' }).last().click();
  await page.waitForSelector('[data-handle]', { timeout: 5000 });
  const handles = await page.evaluate(() => [...document.querySelectorAll('[data-handle]')].map(e => e.getAttribute('data-handle')));
  const key = handles.find(h => /radius|diameter|r$|d$/i.test(h ?? '')) ?? handles[0];
  const svg = await page.locator('.vp-overlay').boundingBox();
  const c = await page.evaluate(k => { const e = document.querySelector(`[data-handle="${k}"]`); const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, key);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  await page.mouse.move(c[0], c[1]); await page.mouse.down();
  const m0 = await cdp.send('Performance.getMetrics'); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
  const t0 = Date.now();
  for (let i = 1; i <= 60; i++) { await page.mouse.move(c[0] + i * 2, c[1] - i * 1); await page.waitForTimeout(16); }
  const { profile } = await cdp.send('Profiler.stop'); const m1 = await cdp.send('Performance.getMetrics'); const wall = Date.now() - t0;
  await page.mouse.up();
  const get = (m, n) => m.metrics.find(x => x.name === n)?.value ?? 0;
  writeFileSync(join(out, `${process.env.TAG ?? 'drag'}.cpuprofile`), JSON.stringify(profile));
  console.log(JSON.stringify({ handle: key, handles, wallMS: wall, scriptMS: Math.round((get(m1, 'ScriptDuration') - get(m0, 'ScriptDuration')) * 1000), taskMS: Math.round((get(m1, 'TaskDuration') - get(m0, 'TaskDuration')) * 1000), layoutMS: Math.round((get(m1, 'LayoutDuration') - get(m0, 'LayoutDuration')) * 1000), styleMS: Math.round((get(m1, 'RecalcStyleDuration') - get(m0, 'RecalcStyleDuration')) * 1000) }));
} finally { await browser.close(); await (server.close ? server.close() : server.httpServer.close()); }
