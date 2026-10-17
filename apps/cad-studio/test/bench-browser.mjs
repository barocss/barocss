// Interaction costs in a real Chromium, each against a budget (a few times what was measured when the
// budget was set, 2026-10-17, Apple M-series, WebGPU): GPU submits and frame CPU time while the pointer
// hovers across the starter plate, and while the camera orbits. Opt-in (needs a browser):
//   PW_DIR=/path/to/node_modules/playwright [CHROME=/path/to/chrome] node test/bench-browser.mjs
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
if (!process.env.PW_DIR) { console.error('Set PW_DIR to a Playwright package directory.'); process.exit(2); }
const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
const { createServer } = await import('vite');
const server = await createServer({ root, configFile: join(root, 'vite.config.ts'), server: { port: 52041, strictPort: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
// Counted from the page's start: queue submits, and the CPU time of each animation-frame callback.
await page.addInitScript(() => {
  const w = window; w.__bench = { submits: 0, frames: 0, frameMS: 0 };
  if (w.GPUQueue) { const submit = GPUQueue.prototype.submit; GPUQueue.prototype.submit = function (...a) { w.__bench.submits++; return submit.apply(this, a); }; }
  const raf = w.requestAnimationFrame.bind(w);
  w.requestAnimationFrame = cb => raf(t => { const t0 = performance.now(); try { cb(t); } finally { w.__bench.frames++; w.__bench.frameMS += performance.now() - t0; } });
});
const rows = [];
const measure = async (name, budget, act) => {
  await page.waitForTimeout(500);
  await page.evaluate(() => { window.__bench.submits = 0; window.__bench.frames = 0; window.__bench.frameMS = 0; });
  const t0 = Date.now(); await act(); await page.waitForTimeout(400);
  const b = await page.evaluate(() => window.__bench), wall = Date.now() - t0;
  const avg = b.frames ? b.frameMS / b.frames : 0;
  rows.push({ name, submits: b.submits, frames: b.frames, avgFrameMS: +avg.toFixed(2), wallMS: wall, ok: b.submits <= budget.submits && avg <= budget.avgFrameMS, budget });
};
try {
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => !/Computing/.test(document.querySelector('.corner-left')?.textContent ?? '') && /Hole Ø8/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 });
  const box = await page.locator('canvas.vp-canvas').boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  // 60 pointer moves across the plate (faces, edges, the hole): a submit only when what is hovered changes.
  await measure('hover: 60 moves across the plate', { submits: 60, avgFrameMS: 8 }, async () => {
    for (let i = 0; i < 60; i++) { await page.mouse.move(cx - 300 + 10 * i, cy - 40 + (i % 7) * 12); await page.waitForTimeout(16); }
  });
  // An orbit drag of 60 steps: one frame each.
  await measure('orbit: 60-step drag', { submits: 90, avgFrameMS: 12 }, async () => {
    await page.mouse.move(cx, cy); await page.mouse.down({ button: 'left' });
    for (let i = 0; i < 60; i++) { await page.mouse.move(cx + 4 * i, cy + (i % 5)); await page.waitForTimeout(16); }
    await page.mouse.up({ button: 'left' });
  });
} finally { await browser.close(); await server.close(); }
for (const r of rows) console.log(`${r.ok ? 'ok  ' : 'SLOW'} ${r.name.padEnd(34)} submits ${String(r.submits).padStart(3)} (≤ ${r.budget.submits})  frames ${String(r.frames).padStart(3)}  avg frame ${String(r.avgFrameMS).padStart(5)} ms (≤ ${r.budget.avgFrameMS})  wall ${r.wallMS} ms`);
process.exit(rows.length === 2 && rows.every(r => r.ok) ? 0 : 1);
