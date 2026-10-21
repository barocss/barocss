// Interaction costs in a real Chromium, each against a budget (about twice what was measured when the
// budget was set, PERF3 D18, 2026-10-18, Apple M-series, WebGPU; frame CPU has a 2 ms floor, and a count
// that is one per step, the orbit's, a few submits over it): GPU submits and frame CPU time while the pointer
// hovers across the starter plate, and while the camera orbits; then (G1, 2026-10-21) an assembly posed and
// exploded frame by frame: a robot joint played, and 120 placed brackets exploded 0 → 2 over 60 frames. Their
// rows add the main thread's whole task time per frame (React's render and effects run outside the animation
// frame's callback), the bytes written to GPU buffers per frame and the GPU buffers made. Measured at G1 (2026-10-21):
// the joint 9.8 ms task and 3.1 KiB a frame, the explode 13.3 ms and 62 KiB (each moved mesh's object block), no buffers
// made in either; before G1 (meshes moved on copies and re-uploaded) 10.3 ms, 36 KiB, 1 116 buffers and 22.3 ms, 2.0 MiB,
// 35 280 buffers, with 49 of the explode's 60 steps drawn. G2 (2026-10-21): the section plane dragged across them, 15.6 ms
// task, 2.3 KiB and no buffers a frame on the GPU's clip plane; the CPU's clipMesh (WebGL2's path, unbudgeted, for the
// comparison) 19.3 ms, 190 KiB and 45 buffers a frame. Opt-in (needs a browser):
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
  const w = window; w.__bench = { submits: 0, frames: 0, frameMS: 0, gpuMS: 0, perFrame: {}, t: -1, bytes: 0, buffers: 0 };
  // (G1: what goes up to the GPU — the bytes of every buffer write, and the buffers made.)
  if (w.GPUQueue) { const write = GPUQueue.prototype.writeBuffer; GPUQueue.prototype.writeBuffer = function (buffer, offset, data, dataOffset, size) { w.__bench.bytes += size !== undefined ? size * (data.BYTES_PER_ELEMENT ?? 1) : data.byteLength - (dataOffset ?? 0) * (data.BYTES_PER_ELEMENT ?? 1); return write.apply(this, arguments); }; }
  if (w.GPUDevice) { const make = GPUDevice.prototype.createBuffer; GPUDevice.prototype.createBuffer = function (d) { w.__bench.buffers++; return make.call(this, d); }; }
  // (GPU time: from each submit until the queue reports that work done.)
  if (w.GPUQueue) { const submit = GPUQueue.prototype.submit; GPUQueue.prototype.submit = function (...a) { w.__bench.submits++; w.__bench.perFrame[w.__bench.t] = (w.__bench.perFrame[w.__bench.t] ?? 0) + 1; const t0 = performance.now(), r = submit.apply(this, a); this.onSubmittedWorkDone().then(() => { w.__bench.gpuMS += performance.now() - t0; }); return r; }; }
  const raf = w.requestAnimationFrame.bind(w);
  w.requestAnimationFrame = cb => raf(t => { const t0 = performance.now(); w.__bench.t = t; try { cb(t); } finally { w.__bench.frames++; w.__bench.frameMS += performance.now() - t0; } });
});
// The budgets (G4: one table): submits and their most in one frame, the animation frames' average CPU (a 2 ms floor), the
// main thread's task time and the GPU's time a submit (from it until the queue reports it done: wall time, so it holds
// the queue's wait too) a frame, the upload a frame and the buffers made. About twice what was measured alone (G4,
// 2026-10-21, at a load average of 8–11 — the owner ran it rather than wait for a quiet machine; the GPU's with a 4 ms
// floor, as the CPU's 2 ms; the earlier rows' submit and CPU budgets from PERF3 D18).
const BUDGET = {
  hover: { submits: 34, avgFrameMS: 2, perFrame: 1, gpuMS: 4 },
  select: { submits: 2, avgFrameMS: 2, perFrame: 1, gpuMS: 24 },
  clear: { submits: 2, avgFrameMS: 2, perFrame: 1, gpuMS: 4 },
  orbit: { submits: 64, avgFrameMS: 2, perFrame: 1, gpuMS: 4 },
  orbitOutlined: { submits: 64, avgFrameMS: 2, perFrame: 1, gpuMS: 6 },
  pose: { submits: 120, avgFrameMS: 2, perFrame: 1, taskMS: 20, kb: 8, buffers: 4, gpuMS: 32 },
  cloud: { submits: 64, avgFrameMS: 2, perFrame: 1, taskMS: 8, kb: 6, buffers: 4, gpuMS: 6 },
  explode: { submits: 120, avgFrameMS: 2, perFrame: 1, taskMS: 28, kb: 128, buffers: 4, gpuMS: 44 },
  sectionGpu: { submits: 140, avgFrameMS: 2, perFrame: 1, taskMS: 30, kb: 8, buffers: 4, gpuMS: 44 },
  sectionCpu: { submits: 140, avgFrameMS: 2 },
};
const os = await import('node:os'), loadAtStart = os.loadavg()[0];
const rows = [];
// (The main thread's task time, from the DevTools protocol: everything that ran, not only animation-frame callbacks.)
const cdp = await page.context().newCDPSession(page); await cdp.send('Performance.enable');
const taskTime = async () => (await cdp.send('Performance.getMetrics')).metrics.find(m => m.name === 'TaskDuration').value * 1000;
const measure = async (name, budget, act) => {
  await page.waitForTimeout(500);
  await page.evaluate(() => { Object.assign(window.__bench, { submits: 0, frames: 0, frameMS: 0, gpuMS: 0, perFrame: {}, bytes: 0, buffers: 0 }); });
  const task0 = await taskTime(), t0 = Date.now(); await act(); await page.waitForTimeout(400);
  const b = await page.evaluate(() => window.__bench), wall = Date.now() - t0, task = await taskTime() - task0;
  const avg = b.frames ? b.frameMS / b.frames : 0, most = Math.max(0, ...Object.values(b.perFrame)), drawn = Math.max(1, Object.keys(b.perFrame).length);
  const taskPerFrame = task / drawn, kbPerFrame = b.bytes / 1024 / drawn;
  rows.push({ name, submits: b.submits, frames: b.frames, most, avgFrameMS: +avg.toFixed(2), taskMS: +taskPerFrame.toFixed(2), kb: +kbPerFrame.toFixed(1), buffers: b.buffers, gpuMS: +(b.submits ? b.gpuMS / b.submits : 0).toFixed(2), wallMS: wall,
    ok: b.submits <= budget.submits && avg <= budget.avgFrameMS && most <= (budget.perFrame ?? Infinity) && taskPerFrame <= (budget.taskMS ?? Infinity) && kbPerFrame <= (budget.kb ?? Infinity) && b.buffers <= (budget.buffers ?? Infinity) && (b.submits ? b.gpuMS / b.submits : 0) <= (budget.gpuMS ?? Infinity), budget });
};
try {
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => !/Computing/.test(document.querySelector('.corner-left')?.textContent ?? '') && /Hole Ø8/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 });
  const box = await page.locator('canvas.vp-canvas').boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  // 60 pointer moves across the plate (faces, edges, the hole): a submit only when what is hovered changes.
  await measure('hover: 60 moves across the plate', BUDGET.hover, async () => {
    for (let i = 0; i < 60; i++) { await page.mouse.move(cx - 300 + 10 * i, cy - 40 + (i % 7) * 12); await page.waitForTimeout(16); }
  });
  // A click on a face from idle (the selection changes): one frame drawn, once.
  await measure('select: a face clicked from idle', BUDGET.select, async () => { await page.mouse.click(cx + 40, cy + 30); });
  await measure('select: cleared (Escape) from idle', BUDGET.clear, async () => { await page.keyboard.press('Escape'); });
  // An orbit drag of 60 steps: one frame each.
  await measure('orbit: 60-step drag', BUDGET.orbit, async () => {
    await page.mouse.move(cx, cy); await page.mouse.down({ button: 'left' });
    for (let i = 0; i < 60; i++) { await page.mouse.move(cx + 4 * i, cy + (i % 5)); await page.waitForTimeout(16); }
    await page.mouse.up({ button: 'left' });
  });
  // (PERF3 C14: the same orbit with the plate picked whole — its selection outline drawn every frame.)
  await page.locator('.outliner .ol-row', { hasText: 'Extrude 8' }).first().click(); await page.waitForTimeout(300);
  await measure('orbit: 60 steps, body outlined', BUDGET.orbitOutlined, async () => {
    await page.mouse.move(cx, cy); await page.mouse.down({ button: 'left' });
    for (let i = 0; i < 60; i++) { await page.mouse.move(cx + 4 * i, cy + (i % 5)); await page.waitForTimeout(16); }
    await page.mouse.up({ button: 'left' });
  });
  // ---- G1: posed and exploded assemblies -------------------------------------------------------------------------
  const fs = await import('node:fs'), os = await import('node:os');
  const tmp = fs.mkdtempSync(join(os.tmpdir(), 'cad-bench-')), open = async (name, doc, ready) => {
    fs.writeFileSync(join(tmp, name), JSON.stringify(doc));
    await page.setInputFiles('input[aria-label="Model file"]', join(tmp, name));
    await page.waitForFunction(ready, null, { timeout: 60000 }); await page.waitForTimeout(1500);
  };
  // The 2R arm (conformance rm/chain-2r): its first joint played (a sine through its range, 4 s a period) for 1.5 s.
  const arm = JSON.parse(fs.readFileSync(join(root, '../../packages/barocss-cad/conformance/rm/chain-2r/case.json'), 'utf8')).input.document;
  await open('chain-2r.bcad', arm, () => window.__studioDoc?.instances?.length === 2 && window.__studioInstanceBounds?.().length === 2 && !!document.querySelector('[aria-label="Play joint base~a"]'));
  await measure('pose: a joint of the 2R arm played', BUDGET.pose, async () => {
    await page.click('[aria-label="Play joint base~a"]'); await page.waitForTimeout(1500); await page.click('[aria-label="Play joint base~a"]');
  });
  // G4: the arm's workspace map shown (RM9b: 20 000 poses, its voxels drawn as an overlay), orbited 60 steps.
  await page.click('[aria-label="Joints home"]').catch(() => {});
  await page.click('[aria-label="Map workspace"]'); await page.waitForSelector('[aria-label="Workspace summary"]', { timeout: 60000 }); await page.waitForTimeout(500);
  const voxels = Number((await page.locator('[aria-label="Workspace summary"]').innerText()).match(/(\d+) voxels/)?.[1] ?? 0);
  {
    const vb = await page.locator('canvas.vp-canvas').boundingBox(), vx = vb.x + vb.width / 2, vy = vb.y + vb.height / 2;
    await measure(`cloud: ${voxels} workspace voxels, orbit 60`, BUDGET.cloud, async () => {
      await page.mouse.move(vx, vy); await page.mouse.down({ button: 'left' });
      for (let i = 0; i < 60; i++) { await page.mouse.move(vx + 4 * i, vy + (i % 5)); await page.waitForTimeout(16); }
      await page.mouse.up({ button: 'left' });
    });
  }
  await page.click('[aria-label="Hide workspace"]');
  // 120 holed brackets (bench-assembly's), exploded from 0 to 2 one step an animation frame, 60 steps: an explode drag.
  const bracket = { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: {}, nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 12] }, { kind: 'extrude', sketch: 0, height: 6 },
    { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [6, 6], radius: 2 }, { kind: 'hole', parent: { node: 2, side: 'solid' }, center: [24, 6], radius: 2 }],
    outputs: { b1: { node: 3, side: 'solid' } } };
  const N = 120, side = Math.ceil(Math.sqrt(N));
  const many = { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: {}, nodes: [], outputs: {},
    instances: Array.from({ length: N }, (_, k) => ({ id: `i${k}`, name: `bracket ${k}`, doc: bracket, position: [40 * (k % side), 20 * Math.floor(k / side), 0], rotation: [0, 0, 0], part: { id: 'bracket', rev: 'A' } })) };
  await open('brackets.bcad', many, () => window.__studioInstanceBounds?.().length === 120);
  await measure('explode: 120 brackets, 60-step drag', BUDGET.explode, async () => {
    await page.evaluate(() => new Promise(done => { let i = 0; const step = () => { window.__studioSetExplode(2 * ++i / 60); if (i < 60) requestAnimationFrame(step); else done(); }; requestAnimationFrame(step); }));
  });
  await page.evaluate(() => window.__studioSetExplode(0));
  // G2: the section plane dragged 60 steps across the 120 brackets — cut by the GPU's clip plane, then (the same build) by
  // clipMesh on the CPU as WebGL2 does; the exact section held back in both (only the drag's own cost).
  // (As a drag sets it: a new plane each animation frame, y from 20 to 160.)
  const dragSection = () => page.evaluate(() => new Promise(done => { let i = 0; const step = () => { window.__studioSetSection({ axis: 'y', at: 20 + 140 * ++i / 60, keep: 'positive' }); if (i < 60) requestAnimationFrame(step); else done(); }; requestAnimationFrame(step); }));
  await page.click('[aria-label="Section view"]'); await page.waitForFunction(() => window.__studioSection?.().clip !== undefined, null, { timeout: 10000 });
  for (const [name, cpu, budget] of [['section: 120 brackets, 60-step drag (GPU)', false, BUDGET.sectionGpu], ['section: the same, CPU clipMesh (WebGL2\'s)', true, BUDGET.sectionCpu]]) {
    await page.evaluate(c => window.__studioSectionDebug({ hold: true, cpu: c }), cpu); await page.waitForTimeout(800);
    await measure(name, budget, dragSection);
  }
  await page.evaluate(() => window.__studioSectionDebug({ hold: false, cpu: false }));
} finally { await browser.close(); await server.close(); }
// (The machine's load average: a budget is not set from numbers measured under load.)
console.log(`load average ${loadAtStart.toFixed(1)} at the start, ${os.loadavg()[0].toFixed(1)} at the end${Math.max(loadAtStart, os.loadavg()[0]) > 4 ? ' — LOADED: compare, do not set budgets from this run' : ''}`);
for (const r of rows) console.log(`${r.ok ? 'ok  ' : 'SLOW'} ${r.name.padEnd(36)} submits ${String(r.submits).padStart(3)} (≤ ${r.budget.submits}, ${r.most} in one frame)  frames ${String(r.frames).padStart(3)}  avg frame ${String(r.avgFrameMS).padStart(5)} ms (≤ ${r.budget.avgFrameMS})  task ${String(r.taskMS).padStart(6)} ms/frame${r.budget.taskMS ? ` (≤ ${r.budget.taskMS})` : ''}  upload ${String(r.kb).padStart(7)} KiB/frame${r.budget.kb ? ` (≤ ${r.budget.kb})` : ''}  buffers ${String(r.buffers).padStart(5)}${r.budget.buffers !== undefined ? ` (≤ ${r.budget.buffers})` : ''}  GPU ${String(r.gpuMS).padStart(5)} ms/submit${r.budget.gpuMS ? ` (≤ ${r.budget.gpuMS})` : ''}  wall ${r.wallMS} ms`);
process.exit(rows.length === 10 && rows.every(r => r.ok) ? 0 : 1);
