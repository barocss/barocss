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
// (G13, 2026-10-22: re-measured, three runs alone at a load of 15–16 — shown in 303–360 ms, 242 draws a frame, 0.42 ms CPU
// and 1.57 ms GPU (timestamps) at most, 24 buffers since load now that the copies share one geometry (G10); about twice.)
const BUDGET = { shownMS: 720, draws: 500, cpuMS: 2, gpuMS: 4, buffers: 60 };
const os = await import('node:os'), loadAtStart = os.loadavg()[0];
if (!process.env.PW_DIR) { console.error('Set PW_DIR to a Playwright package directory.'); process.exit(2); }
const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
const { createServer } = await import('vite');
const server = await createServer({ root, configFile: join(root, 'vite.config.ts'), server: { port: 52061, strictPort: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => {
  const w = window; w.__bench = { draws: 0, submits: 0, frames: 0, frameMS: 0, buffers: 0, gpuMS: 0, queueMS: 0, timed: false };
  if (w.GPURenderPassEncoder) for (const k of ['draw', 'drawIndexed']) { const f = GPURenderPassEncoder.prototype[k]; GPURenderPassEncoder.prototype[k] = function (...a) { w.__bench.draws++; return f.apply(this, a); }; }
  // (G13: the GPU's own time from render-pass timestamps when the adapter has them — before, the wall time from a submit
  // until the queue reported it done, which waits on the main thread too; that is kept as `queueMS`.)
  const make = w.GPUDevice ? GPUDevice.prototype.createBuffer : null, pending = [];
  if (w.GPUDevice) GPUDevice.prototype.createBuffer = function (d) { w.__bench.buffers++; return make.call(this, d); };
  if (w.GPUAdapter) { const rd = GPUAdapter.prototype.requestDevice; GPUAdapter.prototype.requestDevice = function (d = {}) { return rd.call(this, this.features.has('timestamp-query') ? { ...d, requiredFeatures: [...(d.requiredFeatures ?? []), 'timestamp-query'] } : d); }; }
  if (w.GPUDevice) {
    const ce = GPUDevice.prototype.createCommandEncoder;
    GPUDevice.prototype.createCommandEncoder = function (d) {
      const enc = ce.call(this, d), dev = this;
      if (!dev.features.has('timestamp-query')) return enc;
      const pool = dev.__ts ??= [], qs = pool.pop() ?? dev.createQuerySet({ type: 'timestamp', count: 32 });
      let n = 0;
      const begin = enc.beginRenderPass.bind(enc), finish = enc.finish.bind(enc);
      enc.beginRenderPass = desc => { if (desc.timestampWrites || n + 2 > 32) return begin(desc); const p = begin({ ...desc, timestampWrites: { querySet: qs, beginningOfPassWriteIndex: n, endOfPassWriteIndex: n + 1 } }); n += 2; return p; };
      enc.finish = fd => {
        if (n) { const res = make.call(dev, { size: 256, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC }), read = make.call(dev, { size: 256, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }); enc.resolveQuerySet(qs, 0, n, res, 0); enc.copyBufferToBuffer(res, 0, read, 0, n * 8); pending.push({ dev, qs, res, read, n }); } else pool.push(qs);
        return finish(fd);
      };
      return enc;
    };
  }
  if (w.GPUQueue) { const s = GPUQueue.prototype.submit; GPUQueue.prototype.submit = function (...a) {
    w.__bench.submits++; const t0 = performance.now(), r = s.apply(this, a), mine = pending.splice(0);
    this.onSubmittedWorkDone().then(() => { w.__bench.queueMS += performance.now() - t0; });
    for (const q of mine) q.read.mapAsync(GPUMapMode.READ).then(() => { const t = new BigInt64Array(q.read.getMappedRange(0, q.n * 8)); let ns = 0; for (let i = 0; i + 1 < q.n; i += 2) ns += Number(t[i + 1] - t[i]); w.__bench.gpuMS += ns / 1e6; w.__bench.timed = true; q.read.unmap(); q.read.destroy(); q.res.destroy(); (q.dev.__ts ??= []).push(q.qs); }, () => {});
    return r;
  }; }
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
  await page.evaluate(() => Object.assign(window.__bench, { draws: 0, submits: 0, frames: 0, frameMS: 0, gpuMS: 0, queueMS: 0 }));
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let i = 0; i < 40; i++) { await page.mouse.move(cx + 4 * i, cy + (i % 5)); await page.waitForTimeout(16); }
  await page.mouse.up(); await page.waitForTimeout(300);
  const b = await page.evaluate(() => window.__bench);
  const row = { shownMS, draws: b.draws / Math.max(1, b.submits), cpuMS: b.frameMS / Math.max(1, b.frames), gpuMS: (b.timed ? b.gpuMS : b.queueMS) / Math.max(1, b.submits), buffers: b.buffers };
  console.log(`${N} copies: shown in ${shownMS} ms; orbit ${b.frames} frames, ${row.draws.toFixed(0)} draw calls per frame, ${row.cpuMS.toFixed(2)} ms CPU per frame, ${row.gpuMS.toFixed(2)} ms GPU per submit${b.timed ? '' : ' (queue: no timestamps)'} (queue ${(b.queueMS / Math.max(1, b.submits)).toFixed(2)} ms); ${b.buffers} GPU buffers made since load`);
  const load = Math.max(loadAtStart, os.loadavg()[0]);
  console.log(`load average ${loadAtStart.toFixed(1)} at the start, ${os.loadavg()[0].toFixed(1)} at the end${load > 4 ? ' — LOADED: compare, do not set budgets from this run' : ''}`);
  if (N === 120) {
    const over = Object.entries(BUDGET).filter(([k, v]) => row[k] > v);
    console.log(over.length ? `SLOW ${over.map(([k, v]) => `${k} ${+row[k].toFixed(2)} > ${v}`).join(', ')}` : `ok (budgets ${JSON.stringify(BUDGET)})`);
    process.exitCode = over.length ? 1 : 0;
  }
} finally { await browser.close(); await server.close(); }
