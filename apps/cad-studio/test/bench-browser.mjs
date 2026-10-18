// Interaction costs in a real Chromium, each against a budget (about twice what was measured when the
// budget was set, PERF3 D18, 2026-10-18, Apple M-series, WebGPU; frame CPU has a 2 ms floor, and a count
// that is one per step, the orbit's, a few submits over it): GPU submits and frame CPU time while the pointer
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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: Number(process.env.DPR ?? 1) });
// Counted from the page's start: queue submits, and the CPU time of each animation-frame callback.
await page.addInitScript(() => {
  // (`perFrame`: submits by the animation frame's timestamp — every callback of one frame shares it — so two draws in
  // one frame, the viewer's and the viewport's, show as 2; PERF3 A2.)
  const w = window; w.__bench = { submits: 0, frames: 0, frameMS: 0, gpuMS: 0, perFrame: {}, t: -1 };
  // (GPU time: from each submit until the queue reports that work done.)
  if (w.GPUQueue) { const submit = GPUQueue.prototype.submit; GPUQueue.prototype.submit = function (...a) { w.__bench.submits++; w.__bench.perFrame[w.__bench.t] = (w.__bench.perFrame[w.__bench.t] ?? 0) + 1; const t0 = performance.now(), r = submit.apply(this, a); this.onSubmittedWorkDone().then(() => { w.__bench.gpuMS += performance.now() - t0; }); return r; }; }
  const raf = w.requestAnimationFrame.bind(w);
  w.requestAnimationFrame = cb => raf(t => { const t0 = performance.now(); w.__bench.t = t; try { cb(t); } finally { w.__bench.frames++; w.__bench.frameMS += performance.now() - t0; } });
});
const rows = [];
const measure = async (name, budget, act) => {
  await page.waitForTimeout(500);
  await page.evaluate(() => { window.__bench.submits = 0; window.__bench.frames = 0; window.__bench.frameMS = 0; window.__bench.gpuMS = 0; window.__bench.perFrame = {}; });
  const t0 = Date.now(); await act(); await page.waitForTimeout(400);
  const b = await page.evaluate(() => window.__bench), wall = Date.now() - t0;
  const avg = b.frames ? b.frameMS / b.frames : 0, most = Math.max(0, ...Object.values(b.perFrame));
  rows.push({ name, submits: b.submits, frames: b.frames, most, avgFrameMS: +avg.toFixed(2), gpuMS: +(b.submits ? b.gpuMS / b.submits : 0).toFixed(2), wallMS: wall, ok: b.submits <= budget.submits && avg <= budget.avgFrameMS && most <= (budget.perFrame ?? Infinity), budget });
};
try {
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => !/Computing/.test(document.querySelector('.corner-left')?.textContent ?? '') && /Hole Ø8/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 });
  const box = await page.locator('canvas.vp-canvas').boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  // 60 pointer moves across the plate (faces, edges, the hole): a submit only when what is hovered changes.
  await measure('hover: 60 moves across the plate', { submits: 34, avgFrameMS: 2, perFrame: 1 }, async () => {
    for (let i = 0; i < 60; i++) { await page.mouse.move(cx - 300 + 10 * i, cy - 40 + (i % 7) * 12); await page.waitForTimeout(16); }
  });
  // A click on a face from idle (the selection changes): one frame drawn, once.
  await measure('select: a face clicked from idle', { submits: 2, avgFrameMS: 2, perFrame: 1 }, async () => { await page.mouse.click(cx + 40, cy + 30); });
  await measure('select: cleared (Escape) from idle', { submits: 2, avgFrameMS: 2, perFrame: 1 }, async () => { await page.keyboard.press('Escape'); });
  // An orbit drag of 60 steps: one frame each.
  await measure('orbit: 60-step drag', { submits: 64, avgFrameMS: 2, perFrame: 1 }, async () => {
    await page.mouse.move(cx, cy); await page.mouse.down({ button: 'left' });
    for (let i = 0; i < 60; i++) { await page.mouse.move(cx + 4 * i, cy + (i % 5)); await page.waitForTimeout(16); }
    await page.mouse.up({ button: 'left' });
  });
  // (PERF3 C14: the same orbit with the plate picked whole — its selection outline drawn every frame.)
  await page.locator('.outliner .ol-row', { hasText: 'Extrude 8' }).first().click(); await page.waitForTimeout(300);
  await measure('orbit: 60 steps, body outlined', { submits: 64, avgFrameMS: 2, perFrame: 1 }, async () => {
    await page.mouse.move(cx, cy); await page.mouse.down({ button: 'left' });
    for (let i = 0; i < 60; i++) { await page.mouse.move(cx + 4 * i, cy + (i % 5)); await page.waitForTimeout(16); }
    await page.mouse.up({ button: 'left' });
  });
} finally { await browser.close(); await server.close(); }
for (const r of rows) console.log(`${r.ok ? 'ok  ' : 'SLOW'} ${r.name.padEnd(34)} submits ${String(r.submits).padStart(3)} (≤ ${r.budget.submits}, ${r.most} in one frame)  frames ${String(r.frames).padStart(3)}  avg frame ${String(r.avgFrameMS).padStart(5)} ms (≤ ${r.budget.avgFrameMS})  GPU ${String(r.gpuMS).padStart(5)} ms/submit  wall ${r.wallMS} ms`);
process.exit(rows.length === 5 && rows.every(r => r.ok) ? 0 : 1);
