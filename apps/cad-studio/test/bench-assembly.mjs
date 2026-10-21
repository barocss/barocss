// A large assembly in a real Chromium: N copies of a holed bracket placed in a grid (one part definition),
// opened as a file. Measures the time until every copy shows, the draw calls and buffers of a frame, and
// the CPU per frame while orbiting, and (G4) the GPU's time a submit; each against a budget (about twice what was measured
// alone, G4, 2026-10-21, at a load average of 8: shown in 289 ms, 242 draw calls, 0.46 ms CPU — the 2 ms floor —, 3.0 ms
// GPU, 739 buffers; for COPIES=120, the default — other counts print without one). Opt-in:
//   PW_DIR=/path/to/node_modules/playwright [CHROME=...] [COPIES=120] node test/bench-assembly.mjs
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..'), N = Number(process.env.COPIES ?? 120);
// (The budgets for 120 copies: shown, draw calls a frame, CPU a frame and GPU a submit while orbiting, buffers made.)
const BUDGET = { shownMS: 600, draws: 500, cpuMS: 2, gpuMS: 6, buffers: 1500 };
const os = await import('node:os'), loadAtStart = os.loadavg()[0];
if (!process.env.PW_DIR) { console.error('Set PW_DIR to a Playwright package directory.'); process.exit(2); }
const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
const { createServer } = await import('vite');
const server = await createServer({ root, configFile: join(root, 'vite.config.ts'), server: { port: 52061, strictPort: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => {
  const w = window; w.__bench = { draws: 0, submits: 0, frames: 0, frameMS: 0, buffers: 0, gpuMS: 0 };
  if (w.GPURenderPassEncoder) for (const k of ['draw', 'drawIndexed']) { const f = GPURenderPassEncoder.prototype[k]; GPURenderPassEncoder.prototype[k] = function (...a) { w.__bench.draws++; return f.apply(this, a); }; }
  // (GPU time: from each submit until the queue reports that work done.)
  if (w.GPUQueue) { const s = GPUQueue.prototype.submit; GPUQueue.prototype.submit = function (...a) { w.__bench.submits++; const t0 = performance.now(), r = s.apply(this, a); this.onSubmittedWorkDone().then(() => { w.__bench.gpuMS += performance.now() - t0; }); return r; }; }
  if (w.GPUDevice) { const c = GPUDevice.prototype.createBuffer; GPUDevice.prototype.createBuffer = function (d) { w.__bench.buffers++; return c.call(this, d); }; }
  const raf = w.requestAnimationFrame.bind(w);
  w.requestAnimationFrame = cb => raf(t => { const t0 = performance.now(); try { cb(t); } finally { w.__bench.frames++; w.__bench.frameMS += performance.now() - t0; } });
});
// The part: a 30 × 12 × 6 bracket with two holes.
const bracket = { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: {}, nodes: [
  { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 12] }, { kind: 'extrude', sketch: 0, height: 6 },
  { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [6, 6], radius: 2 }, { kind: 'hole', parent: { node: 2, side: 'solid' }, center: [24, 6], radius: 2 }],
  outputs: { b1: { node: 3, side: 'solid' } } };
const side = Math.ceil(Math.sqrt(N));
const doc = { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: {}, nodes: [], outputs: {},
  instances: Array.from({ length: N }, (_, k) => ({ id: `i${k}`, name: `bracket ${k}`, doc: bracket, position: [40 * (k % side), 20 * Math.floor(k / side), 0], rotation: [0, 0, 0], part: { id: 'bracket', rev: 'A' } })) };
try {
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => !/Computing/.test(document.querySelector('.corner-left')?.textContent ?? ''), null, { timeout: 30000 });
  const t0 = Date.now();
  await page.setInputFiles('input[aria-label="Model file"]', { name: 'assembly.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await page.waitForFunction(n => (window.__studioDoc?.instances ?? []).length === n, N, { timeout: 30000 });
  // Every copy shown: the GPU buffers stop growing (each copy's meshes upload theirs) for three seconds.
  const box = await page.locator('canvas.vp-canvas').boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  let last = -1, changed = Date.now();
  for (let k = 0; k < 3000 && Date.now() - changed < 3000; k++) {
    await page.mouse.move(cx + (k % 2), cy); await page.waitForTimeout(100);
    const n = await page.evaluate(() => window.__bench.buffers);
    if (n !== last) { last = n; changed = Date.now(); }
  }
  const shownMS = changed - t0;
  await page.evaluate(() => Object.assign(window.__bench, { draws: 0, submits: 0, frames: 0, frameMS: 0, gpuMS: 0 }));
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let i = 0; i < 40; i++) { await page.mouse.move(cx + 4 * i, cy + (i % 5)); await page.waitForTimeout(16); }
  await page.mouse.up(); await page.waitForTimeout(300);
  const b = await page.evaluate(() => window.__bench);
  const row = { shownMS, draws: b.draws / Math.max(1, b.submits), cpuMS: b.frameMS / Math.max(1, b.frames), gpuMS: b.gpuMS / Math.max(1, b.submits), buffers: b.buffers };
  console.log(`${N} copies: shown in ${shownMS} ms; orbit ${b.frames} frames, ${row.draws.toFixed(0)} draw calls per frame, ${row.cpuMS.toFixed(2)} ms CPU per frame, ${row.gpuMS.toFixed(2)} ms GPU per submit; ${b.buffers} GPU buffers made since load`);
  const load = Math.max(loadAtStart, os.loadavg()[0]);
  console.log(`load average ${loadAtStart.toFixed(1)} at the start, ${os.loadavg()[0].toFixed(1)} at the end${load > 4 ? ' — LOADED: compare, do not set budgets from this run' : ''}`);
  if (N === 120) {
    const over = Object.entries(BUDGET).filter(([k, v]) => row[k] > v);
    console.log(over.length ? `SLOW ${over.map(([k, v]) => `${k} ${+row[k].toFixed(2)} > ${v}`).join(', ')}` : `ok (budgets ${JSON.stringify(BUDGET)})`);
    process.exitCode = over.length ? 1 : 0;
  }
} finally { await browser.close(); await server.close(); }
