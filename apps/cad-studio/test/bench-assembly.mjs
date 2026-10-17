// A large assembly in a real Chromium: N copies of a holed bracket placed in a grid (one part definition),
// opened as a file. Measures the time until every copy shows, the draw calls and buffers of a frame, and
// the CPU per frame while orbiting. Opt-in:
//   PW_DIR=/path/to/node_modules/playwright [CHROME=...] [COPIES=120] node test/bench-assembly.mjs
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..'), N = Number(process.env.COPIES ?? 120);
if (!process.env.PW_DIR) { console.error('Set PW_DIR to a Playwright package directory.'); process.exit(2); }
const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
const { createServer } = await import('vite');
const server = await createServer({ root, configFile: join(root, 'vite.config.ts'), server: { port: 52061, strictPort: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => {
  const w = window; w.__bench = { draws: 0, submits: 0, frames: 0, frameMS: 0, buffers: 0 };
  if (w.GPURenderPassEncoder) for (const k of ['draw', 'drawIndexed']) { const f = GPURenderPassEncoder.prototype[k]; GPURenderPassEncoder.prototype[k] = function (...a) { w.__bench.draws++; return f.apply(this, a); }; }
  if (w.GPUQueue) { const s = GPUQueue.prototype.submit; GPUQueue.prototype.submit = function (...a) { w.__bench.submits++; return s.apply(this, a); }; }
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
  await page.evaluate(() => Object.assign(window.__bench, { draws: 0, submits: 0, frames: 0, frameMS: 0 }));
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let i = 0; i < 40; i++) { await page.mouse.move(cx + 4 * i, cy + (i % 5)); await page.waitForTimeout(16); }
  await page.mouse.up(); await page.waitForTimeout(300);
  const b = await page.evaluate(() => window.__bench);
  console.log(`${N} copies: shown in ${shownMS} ms; orbit ${b.frames} frames, ${(b.draws / Math.max(1, b.submits)).toFixed(0)} draw calls per frame, ${(b.frameMS / Math.max(1, b.frames)).toFixed(2)} ms CPU per frame; ${b.buffers} GPU buffers made since load`);
} finally { await browser.close(); await server.close(); }
