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
//   PW_DIR=/path/to/node_modules/playwright [CHROME=/path/to/chrome] [BENCH_ONLY=pattern] node test/bench-browser.mjs
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

// Pure runner contracts, also checked without starting Vite or a browser.
function benchCaseNames(voxels) {
  return [
    'hover: 60 moves across the plate',
    'select: a face clicked from idle',
    'select: cleared (Escape) from idle',
    'HUD: 4 keystrokes into the box width',
    'placing: 30 pointer moves before the click',
    'orbit: 60-step drag',
    'orbit: 60 steps, body outlined',
    'pose: a joint of the 2R arm played',
    'motion: the 2R arm\'s motion played',
    `cloud: ${voxels} workspace voxels, orbit 60`,
    'cloud: 100 000 voxels, orbit 60',
    'explode: 120 brackets, 60-step drag',
    'pattern: 120 turned brackets opened',
    'hover: 60 moves across 120 brackets',
    'pick: a bracket clicked from idle',
    'ghosted: 120 brackets, orbit 60 (sorted)',
    'ghosted: 120 brackets, orbit 60 (order-independent)',
    'section: 120 brackets, 60-step drag (GPU)',
    "section: the same, CPU clipMesh (WebGL2's)",
    'underlay: 40 000 points, 100 texts, orbit 60',
  ];
}

function benchRowsPass(rows, expectedNames, picks, fullRun) {
  const names = rows.map(r => r.name);
  return expectedNames.length > 0 && (!fullRun || expectedNames.length === 20) &&
    new Set(expectedNames).size === expectedNames.length &&
    names.length === expectedNames.length && new Set(names).size === names.length &&
    expectedNames.every(name => names.includes(name)) && rows.every(r => r.ok === true) &&
    (!picks || picks.differ === 0);
}

function timestampSample(values, used, passes) {
  if (!Number.isInteger(used) || used < 2 || used > 32 || used % 2 || used !== passes * 2 || values.length !== used) {
    return { valid: false, reason: 'missing-or-unused-query-slots' };
  }
  let ns = 0n;
  for (let i = 0; i < used; i += 2) {
    const start = values[i], end = values[i + 1];
    // Validate each pass's own pair. Different passes can have overlapping timestamp intervals.
    if (typeof start !== 'bigint' || typeof end !== 'bigint' || start < 0n || end < start || end > 0xffffffffffffffffn) {
      return { valid: false, reason: 'invalid-or-reversed-timestamp-pair', pair: i / 2 };
    }
    if (start === 0n && end === 0n) return { valid: false, reason: 'unused-or-unavailable-timestamp', pair: i / 2 };
    ns += end - start;
    if (ns > BigInt(Number.MAX_SAFE_INTEGER)) return { valid: false, reason: 'timestamp-duration-not-exactly-representable' };
  }
  return { valid: true, ms: Number(ns) / 1e6 };
}

function benchGpuTiming(b) {
  const counts = ['submits', 'gpuExpected', 'gpuCompleted', 'gpuQueries', 'gpuReadQueries'];
  const valid = counts.every(k => Number.isSafeInteger(b[k]) && b[k] > 0) &&
    b.gpuExpected >= b.submits && b.gpuCompleted === b.gpuExpected && b.gpuReadQueries === b.gpuQueries &&
    Array.isArray(b.timingErrors) && b.timingErrors.length === 0 && Number.isFinite(b.gpuMS) && b.gpuMS >= 0 &&
    (b.unstamped ?? 0) <= Math.max(1, 0.05 * b.submits) && b.submits > (b.unstamped ?? 0);
  return { valid, msPerSubmit: valid ? b.gpuMS / (b.submits - (b.unstamped ?? 0)) : null, unstamped: b.unstamped ?? 0, expectedBuffers: b.gpuExpected,
    completedBuffers: b.gpuCompleted, resolvedQueries: b.gpuQueries, readQueries: b.gpuReadQueries,
    errors: b.timingErrors ?? ['missing-timing-state'] };
}

function benchCounters() {
  return { submits: 0, frames: 0, frameMS: 0, gpuMS: 0, queueMS: 0, perFrame: {}, t: -1, batch: 0, sameStamp: 0, bytes: 0, buffers: 0, made: {}, wrote: {},
    gpuExpected: 0, gpuCompleted: 0, gpuQueries: 0, gpuReadQueries: 0, unstamped: 0, timingErrors: [], queryBatches: [], passMS: {} };
}

function installBenchInstrumentation(timestampSample, benchCounters) {
  const w = window, batches = new WeakMap(), pending = new Set();
  // (A trace's callers: the first frames below the hook, without the dev server's origin and query.)
  w.__benchCallers = stack => (stack ?? '').split('\n').slice(2, 9).map(l => l.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\/(@fs\/)?/, '').replace(/\?[^:)]*/, '').replace(/^.*\/(packages|apps)\//, '$1/')).join(' < ');
  w.__bench = benchCounters(); w.__benchReset = () => { w.__bench = benchCounters(); };
  w.__benchDrain = async () => { while (pending.size) await Promise.all([...pending]); };
  const track = promise => { pending.add(promise); promise.finally(() => pending.delete(promise)); };
  if (w.GPUQueue) { const write = GPUQueue.prototype.writeBuffer; GPUQueue.prototype.writeBuffer = function (buffer, offset, data, dataOffset, size) {
    const n = size !== undefined ? size * (data.BYTES_PER_ELEMENT ?? 1) : data.byteLength - (dataOffset ?? 0) * (data.BYTES_PER_ELEMENT ?? 1);
    w.__bench.bytes += n;
    if (w.__benchTrace) { const k = `${buffer.label || '-'} @ ${w.__benchCallers(new Error().stack)}`; w.__bench.wrote[k] = (w.__bench.wrote[k] ?? 0) + n; }
    return write.apply(this, arguments);
  }; }
  const make = w.GPUDevice ? GPUDevice.prototype.createBuffer : null;
  // (BENCH_TRACE: each buffer made counted by its label and its callers, printed under its row — G8.)
  if (w.GPUDevice) GPUDevice.prototype.createBuffer = function (d) {
    w.__bench.buffers++;
    if (w.__benchTrace) { const k = `${d.label ?? '-'} @ ${w.__benchCallers(new Error().stack)}`; w.__bench.made[k] = (w.__bench.made[k] ?? 0) + 1; }
    return make.call(this, d);
  };
  if (w.GPUAdapter) { const rd = GPUAdapter.prototype.requestDevice; GPUAdapter.prototype.requestDevice = function (d = {}) {
    return rd.call(this, this.features.has('timestamp-query') ? { ...d, requiredFeatures: [...(d.requiredFeatures ?? []), 'timestamp-query'] } : d);
  }; }
  if (w.GPUDevice) {
    const ce = GPUDevice.prototype.createCommandEncoder;
    const instrument = (dev, enc) => {
      if (!dev.features.has('timestamp-query')) return enc;
      const pool = dev.__ts ??= [], qs = pool.pop() ?? dev.createQuerySet({ type: 'timestamp', count: 32 });
      let n = 0, passes = 0;
      const errors = [], labels = [], begin = enc.beginRenderPass.bind(enc), finish = enc.finish.bind(enc);
      enc.beginRenderPass = desc => {
        passes++;
        if (desc.timestampWrites || n + 2 > 32) { errors.push('render-pass-not-instrumented'); return begin(desc); }
        const first = n; n += 2; labels.push(desc.label ?? 'unlabelled');
        return begin({ ...desc, timestampWrites: { querySet: qs, beginningOfPassWriteIndex: first, endOfPassWriteIndex: first + 1 } });
      };
      enc.finish = fd => {
        let res = null, read = null;
        if (n) {
          res = make.call(dev, { size: 256, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
          read = make.call(dev, { size: 256, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
          enc.resolveQuerySet(qs, 0, n, res, 0); enc.copyBufferToBuffer(res, 0, read, 0, n * 8);
        } else pool.push(qs);
        const command = finish(fd);
        // Finished but unsubmitted encoders must not be mapped or have their query sets recycled by another submit.
        batches.set(command, { dev, qs, res, read, n, passes, errors, labels });
        return command;
      };
      return enc;
    };
    GPUDevice.prototype.createCommandEncoder = function (d) { return instrument(this, ce.call(this, d)); };
  }
  if (w.GPUQueue) { const submit = GPUQueue.prototype.submit; GPUQueue.prototype.submit = function (buffers) {
    const commands = Array.from(buffers), sample = w.__bench;
    sample.submits++; sample.perFrame[sample.batch] = (sample.perFrame[sample.batch] ?? 0) + 1;
    const t0 = performance.now(), r = submit.call(this, commands);
    if (!commands.length) sample.timingErrors.push({ reason: 'submit-without-timestamp-samples' });
    track(this.onSubmittedWorkDone().then(() => { sample.queueMS += performance.now() - t0; }, e => { sample.timingErrors.push({ reason: 'queue-completion-failed', message: String(e) }); }));
    sample.gpuExpected += commands.length;
    for (const command of commands) {
      const q = batches.get(command); batches.delete(command);
      if (!q?.read) { sample.gpuCompleted++; sample.timingErrors.push({ reason: 'timestamp-query-unavailable-or-no-render-sample' }); continue; }
      sample.gpuQueries += q.n;
      let mapped = false;
      track(q.read.mapAsync(GPUMapMode.READ).then(() => {
        mapped = true;
        const values = new BigUint64Array(q.read.getMappedRange(0, q.n * 8)), result = timestampSample(values, q.n, q.passes);
        sample.gpuReadQueries += values.length;
        sample.queryBatches.push({ used: q.n, resolved: q.n, read: values.length, passes: q.passes, valid: result.valid && q.errors.length === 0 });
        // (G8: a reversed pair — a pass's begin stamp left unwritten, seen on Chrome/Metal in a section frame's first pass —
        // leaves that submit unstamped: out of the GPU average, counted and allowed for 5 % of the submits.)
        if (result.reason === 'invalid-or-reversed-timestamp-pair' && !q.errors.length) sample.unstamped++;
        else if (!result.valid || q.errors.length) sample.timingErrors.push({ ...result, valid: false,
          reason: result.reason ?? 'render-pass-not-instrumented', encoderErrors: q.errors, values: Array.from(values, String) });
        else {
          sample.gpuMS += result.ms;
          // (G14: each stamped pass's time by its label — the viewer labels its passes — printed with BENCH_PASSES.)
          for (let i = 0; i < q.labels.length; i++) sample.passMS[q.labels[i]] = (sample.passMS[q.labels[i]] ?? 0) + Number(values[2 * i + 1] - values[2 * i]) / 1e6;
        }
      }).catch(e => { sample.timingErrors.push({ reason: 'timestamp-readback-failed', message: String(e) }); }).finally(() => {
        sample.gpuCompleted++;
        if (mapped) q.read.unmap();
        q.read.destroy(); q.res.destroy();
        if (mapped) (q.dev.__ts ??= []).push(q.qs); else q.qs.destroy();
      }));
    }
    return r;
  }; }
  const raf = w.requestAnimationFrame.bind(w), chan = new MessageChannel(); let ended = true;
  chan.port1.onmessage = () => { ended = true; };
  w.requestAnimationFrame = cb => raf(t => {
    if (ended || t !== w.__bench.t) { if (t === w.__bench.t) w.__bench.sameStamp++; w.__bench.batch++; ended = false; chan.port2.postMessage(0); }
    const sample = w.__bench, t0 = performance.now(); sample.t = t;
    try { cb(t); } finally { sample.frames++; sample.frameMS += performance.now() - t0; }
  });
}

const root = resolve(import.meta.dirname, '..');
if (!process.env.PW_DIR) { console.error('Set PW_DIR to a Playwright package directory.'); process.exit(2); }
const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
const { createServer } = await import('vite');
const server = await createServer({ root, configFile: join(root, 'vite.config.ts'), server: { port: 52041, strictPort: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: Number(process.env.DPR ?? 1) });
// Install these same checked functions in the page; each sample owns its asynchronous completions.
await page.addInitScript({ content: `window.__benchTrace = ${!!process.env.BENCH_TRACE}; (${installBenchInstrumentation})(${timestampSample}, ${benchCounters});` });
// (BENCH_TRACE: which of the App's hooks changed at each commit — a minimal DevTools hook, set before React loads; R1c.)
if (process.env.BENCH_TRACE) await page.addInitScript({ content: `(() => {
  const changes = window.__appHookChanges = {};
  const shape = v => v === null ? 'null' : Array.isArray(v) ? 'array' + v.length : typeof v === 'object' ? 'object:' + Object.keys(v).slice(0, 4).join(',') : typeof v + ':' + String(v).slice(0, 20);
  const findApp = f => { for (let n = f; n; n = n.child) { if (n.type && n.type.name === 'App') return n; const s = n.sibling && findApp(n.sibling); if (s) return s; } return null; };
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { supportsFiber: true, renderers: new Map(), inject() { return 1; }, onScheduleFiberRoot() {}, onCommitFiberUnmount() {}, checkDCE() {},
    onCommitFiberRoot(id, root) {
      const app = findApp(root.current); if (!app || !app.alternate) return;
      let a = app.memoizedState, b = app.alternate.memoizedState, i = 0;
      while (a && b) { if (a.queue && !Object.is(a.memoizedState, b.memoizedState)) { const k = i + ' ' + shape(a.memoizedState); changes[k] = (changes[k] ?? 0) + 1; } a = a.next; b = b.next; i++; }
    } };
})();` });
// The budgets (G4: one table): submits and their most in one frame, the animation frames' average CPU (a 2 ms floor), the
// main thread's task time and the GPU's time a submit (from it until the queue reports it done: wall time, so it holds
// the queue's wait too) a frame, the upload a frame and the buffers made. About twice what was measured alone (G4,
// 2026-10-21, at a load average of 8–11 — the owner ran it rather than wait for a quiet machine; the GPU's with a 4 ms
// floor, as the CPU's 2 ms; the earlier rows' submit and CPU budgets from PERF3 D18).
const BUDGET = {
  // (G13, 2026-10-22: every row re-measured, three runs alone at a load of 12–15 — the machine had no quieter window
  // with the other lanes running — the GPU's own time now from timestamps (no longer the queue's wait); about twice the
  // worst of the three, the GPU's with a 3 ms floor. The 100 000-voxel cloud was the one row the GPU's time led: 8.2 ms, G14.)
  hover: { submits: 34, avgFrameMS: 2, perFrame: 1, gpuMS: 3 },
  // (One frame each: a 4 ms floor — one run at a load of 33 drew it in 3.07 ms of GPU, 1.3 in the others.)
  select: { submits: 2, avgFrameMS: 2, perFrame: 1, gpuMS: 4 },
  clear: { submits: 2, avgFrameMS: 2, perFrame: 1, gpuMS: 4 },
  orbit: { submits: 64, avgFrameMS: 2, perFrame: 1, gpuMS: 3 },
  orbitOutlined: { submits: 64, avgFrameMS: 2, perFrame: 1, gpuMS: 5 },
  // (G15d.1: the Render workspace orbited — its look (shadows, occlusion off while moving), then with the post on: AgX, the
  // warm grade, contrast, saturation and a vignette. The post's cost: the second row's GPU time less the first's.)
  renderOrbit: { submits: 64, avgFrameMS: 2, perFrame: 1, gpuMS: 8 },
  renderOrbitPost: { submits: 64, avgFrameMS: 2, perFrame: 1, gpuMS: 8 },
  // (G15a: the same with the part knurled and lacquered — the finish's relief, four noise lookups a pixel, and the coat.)
  renderOrbitFinish: { submits: 64, avgFrameMS: 2, perFrame: 1, gpuMS: 8 },
  pose: { submits: 120, avgFrameMS: 2, perFrame: 1, taskMS: 22, kb: 7, buffers: 4, gpuMS: 3 },
  // (RS2: as a joint played, and the App rendered only as it starts and stops — never in a frame of it.)
  motion: { submits: 120, avgFrameMS: 2, perFrame: 1, taskMS: 22, kb: 7, buffers: 4, gpuMS: 3, app: 4 },
  cloud: { submits: 64, avgFrameMS: 2, perFrame: 1, taskMS: 6, kb: 5, buffers: 4, gpuMS: 3 },
  explode: { submits: 120, avgFrameMS: 2, perFrame: 1, taskMS: 30, kb: 128, buffers: 4, gpuMS: 4 },
  sectionGpu: { submits: 140, avgFrameMS: 2, perFrame: 1, taskMS: 33, kb: 5, buffers: 4, gpuMS: 6 },
  sectionCpu: { submits: 140, avgFrameMS: 2 },
  // (G7: the pre-G7 SVG path took 30 ms of task a frame here; G15: its 100 texts engine labels too, 8.1–8.7 → 2.5–3.0 ms.)
  underlay: { submits: 64, avgFrameMS: 2, perFrame: 1, taskMS: 6, kb: 5, buffers: 4, gpuMS: 4 },
  // (G8: SVG squares took 55 ms of task a frame here. G14: 8.2 → 4.0–4.7 ms of GPU, its shader without discard and its
  // quads half a pixel smaller; the budget about twice.)
  cloud100k: { submits: 64, avgFrameMS: 2, perFrame: 1, taskMS: 6, kb: 5, buffers: 4, gpuMS: 10 },
  // (G9: the pointer's picks over 120 brackets — a frame only when the hovered thing changes; the task is the App's.)
  // (G8: the brackets are not highlighted under the pointer, so nothing is drawn — `drawless`: 0 frames is right, the task is judged.)
  hoverMany: { submits: 64, avgFrameMS: 2, perFrame: 1, taskMS: 140, drawless: true },
  pickMany: { submits: 4, avgFrameMS: 2, perFrame: 1, taskMS: 90, gpuMS: 5 },
  // (G10: a patterned assembly opened.)
  pattern: { submits: 8, avgFrameMS: 2, perFrame: 1 },
  // (G11: the 120 brackets see-through, orbited.)
  ghost: { submits: 64, avgFrameMS: 2, perFrame: 1, gpuMS: 8 },
  // (R1d: a command's values typed into the HUD and a shape placed by the pointer — the App's renders, `app`, one for each
  // evaluated result, so never more than a keystroke's or a move's. Before R1d, loaded: 10 for the 4 keystrokes (5 results)
  // and 76 for the 30 moves (29 results); after, 1 (1 result) and 16 (16 results).)
  hudTyping: { submits: 60, avgFrameMS: 2, app: 4 },
  placing: { submits: 60, avgFrameMS: 2, app: 30 },
};
const os = await import('node:os'), loadAtStart = os.loadavg()[0];
const rows = [];
let picks = null;
let voxels = 0;
// (The main thread's task time, from the DevTools protocol: everything that ran, not only animation-frame callbacks.)
const cdp = await page.context().newCDPSession(page); await cdp.send('Performance.enable');
const taskTime = async () => (await cdp.send('Performance.getMetrics')).metrics.find(m => m.name === 'TaskDuration').value * 1000;
// (BENCH_ONLY: a pattern — only the rows whose names match it are measured; the others' setup still runs, G19.)
const only = process.env.BENCH_ONLY ? new RegExp(process.env.BENCH_ONLY, 'i') : null, trace = !!process.env.BENCH_TRACE;
const measure = async (name, budget, act) => {
  if (only && !only.test(name)) return;
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__benchDrain());
  await page.evaluate(() => window.__benchReset());
  const renders0 = trace ? await page.evaluate(() => ({ ...(window.__studioRenders ?? {}) })) : null;
  const ms0 = trace ? await page.evaluate(() => ({ ...(window.__studioRenderMs ?? {}) })) : null;
  if (trace) await page.evaluate(() => { const c = window.__appHookChanges ?? {}; for (const k in c) delete c[k]; });
  if (trace) await cdp.send('Profiler.enable').then(() => cdp.send('Profiler.setSamplingInterval', { interval: 200 })).then(() => cdp.send('Profiler.start'));
  const app0 = await page.evaluate(() => window.__studioRenders?.App ?? 0);
  const task0 = await taskTime(), t0 = Date.now(); await act(); await page.waitForTimeout(400);
  // (BENCH_TRACE: the main thread's self time by function over the row, from a CPU profile.)
  if (trace) {
    const { profile } = await cdp.send('Profiler.stop'), self = new Map(), dt = new Map();
    for (let i = 0; i < profile.samples.length; i++) dt.set(profile.samples[i], (dt.get(profile.samples[i]) ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000);
    for (const n of profile.nodes) { const f = n.callFrame, k = `${f.functionName || '(anon)'} ${f.url.replace(/^.*\/(packages|apps|node_modules)\//, '$1/').replace(/\?.*$/, '')}:${f.lineNumber + 1}`; if (dt.get(n.id)) self.set(k, (self.get(k) ?? 0) + dt.get(n.id)); }
    for (const [k, ms] of [...self].filter(([k]) => !/^\((idle|program|garbage collector)\)/.test(k)).sort((x, y) => y[1] - x[1]).slice(0, 12)) console.log(`  [${name}] self ${ms.toFixed(1)} ms ${k}`);
    // (And the callers of the heaviest: each sample's stack, two frames up.)
    const parent = new Map(), byId = new Map(profile.nodes.map(n => [n.id, n]));
    for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
    const label = n => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.replace(/^.*\/(packages|apps|src|node_modules)\//, '$1/').replace(/\?.*$/, '')}:${n.callFrame.lineNumber + 1}`;
    const up = new Map();
    for (const n of profile.nodes) { const ms = dt.get(n.id); if (!ms || ms < 1) continue; const chain = []; let id = parent.get(n.id); while (id !== undefined && chain.length < 4) { chain.push(label(byId.get(id))); id = parent.get(id); } const k = label(n) + ' < ' + chain.join(' < '); up.set(k, (up.get(k) ?? 0) + ms); }
    for (const [k, ms] of [...up].sort((x, y) => y[1] - x[1]).slice(0, 4)) console.log(`  [${name}] stack ${ms.toFixed(1)} ms ${k}`);
    // (Who schedules React's updates: each dispatchSetState sample's callers, six frames up — R1.)
    const setters = new Map();
    for (const n of profile.nodes) {
      if (!/^dispatch(SetState|ReducerAction)/.test(n.callFrame.functionName)) continue;
      const chain = []; let id = parent.get(n.id);
      while (id !== undefined && chain.length < 6) { const f = byId.get(id).callFrame; if (!/react-dom|react_jsx/.test(f.url)) chain.push(label(byId.get(id))); id = parent.get(id); }
      const k = chain.slice(0, 3).join(' < '); setters.set(k, (setters.get(k) ?? 0) + (n.hitCount || 1));
    }
    for (const [k, hits] of [...setters].sort((x, y) => y[1] - x[1]).slice(0, 6)) console.log(`  [${name}] setter ${hits} × ${k}`);
  }
  await page.evaluate(() => window.__benchDrain());
  const b = await page.evaluate(() => window.__bench), wall = Date.now() - t0, task = await taskTime() - task0;
  const app = await page.evaluate(() => window.__studioRenders?.App ?? 0) - app0;
  if (trace) {
    const renders1 = await page.evaluate(() => ({ ...(window.__studioRenders ?? {}) }));
    console.log(`  [${name}] renders ${JSON.stringify(Object.fromEntries(Object.keys(renders1).map(k => [k, renders1[k] - (renders0[k] ?? 0)])))}`);
    const ms1 = await page.evaluate(() => ({ ...(window.__studioRenderMs ?? {}) }));
    console.log(`  [${name}] render ms ${JSON.stringify(Object.fromEntries(Object.keys(ms1).map(k => [k, +(ms1[k] - (ms0[k] ?? 0)).toFixed(1)])))}`);
    const hooks = await page.evaluate(() => { const c = window.__appHookChanges ?? {}, e = Object.entries(c); for (const k in c) delete c[k]; return e; });
    console.log(`  [${name}] app hooks changed ${JSON.stringify(hooks.sort((x, y) => y[1] - x[1]).slice(0, 8))}`);
    console.log(`  [${name}] dirty ${JSON.stringify(Object.entries(b.dirty ?? {}).sort((x, y) => y[1] - x[1]).slice(0, 8))}`);
    for (const [k, n] of Object.entries(b.touched ?? {}).sort((x, y) => y[1] - x[1]).slice(0, 4)) console.log(`  [${name}] touched ${n} × ${k}`);
    console.log(`  [${name}] calls ${JSON.stringify(await page.evaluate(() => { const c = globalThis.__cnt; globalThis.__cnt = {}; return c; }))}`);
    for (const [k, n] of Object.entries(b.made).sort((x, y) => y[1] - x[1]).slice(0, 6)) console.log(`  [${name}] made ${n} × ${k}`);
    for (const [k, n] of Object.entries(b.wrote).sort((x, y) => y[1] - x[1]).slice(0, 6)) console.log(`  [${name}] wrote ${(n / 1024).toFixed(1)} KiB to ${k}`);
  }
  const avg = b.frames ? b.frameMS / b.frames : 0, most = Math.max(0, ...Object.values(b.perFrame)), drawn = Math.max(1, Object.keys(b.perFrame).length);
  const timing = benchGpuTiming(b), taskPerFrame = task / drawn, kbPerFrame = b.bytes / 1024 / drawn, gpu = timing.msPerSubmit;
  const drawless = !!budget.drawless && b.submits === 0;
  // (BENCH_PASSES: the GPU time a stamped submit spends in each of the viewer's passes, most first — G14.)
  if (process.env.BENCH_PASSES && timing.valid) console.log(`  [${name}] passes ms a submit ${Object.entries(b.passMS).sort((x, y) => y[1] - x[1]).map(([k, ms]) => `${k} ${(ms / (b.submits - (b.unstamped ?? 0))).toFixed(2)}`).join(', ')}`);
  const validMetrics = [b.submits, b.frames, avg, most, taskPerFrame, kbPerFrame, b.buffers, b.queueMS, wall].every(v => Number.isFinite(v) && v >= 0) && (drawless || (b.submits > 0 && b.frames > 0));
  rows.push({ name, submits: b.submits, frames: b.frames, most, avgFrameMS: +avg.toFixed(2), taskMS: +taskPerFrame.toFixed(2), kb: +kbPerFrame.toFixed(1), buffers: b.buffers, gpuMS: timing.valid ? +gpu.toFixed(2) : null, queueMS: +(b.submits ? b.queueMS / b.submits : 0).toFixed(2), timed: timing.valid, timing, queryBatches: b.queryBatches, sameStamp: b.sameStamp, wallMS: wall, app, taskTotalMS: +task.toFixed(1), uploadTotalKiB: +(b.bytes / 1024).toFixed(0),
    ok: validMetrics && (timing.valid || drawless) && b.submits <= budget.submits && avg <= budget.avgFrameMS && most <= (budget.perFrame ?? Infinity) && taskPerFrame <= (budget.taskMS ?? Infinity) && kbPerFrame <= (budget.kb ?? Infinity) && b.buffers <= (budget.buffers ?? Infinity) && (drawless || gpu <= (budget.gpuMS ?? Infinity)) && app <= (budget.app ?? Infinity), budget });
};
try {
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => !/Computing/.test(document.querySelector('.corner-left')?.textContent ?? '') && /Hole Ø8/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 });
  // (BENCH_TRACE: the meshes dirty when a frame writes its object blocks, by name or topology and what was set on them.)
  if (trace) await page.evaluate(() => {
    const v = window.__studioViewer, proto = Object.getPrototypeOf(v), write = proto.writeUniforms;
    proto.writeUniforms = function (...args) {
      const d = window.__bench.dirty ??= {};
      for (const m of this.meshes) if (m.dirty) { const k = m.name ?? m.geometry.topology; d[k] = (d[k] ?? 0) + 1; }
      return write.apply(this, args);
    };
    const mp = Object.getPrototypeOf(v.meshList[0]), touch = mp.touch;
    mp.touch = function () {
      if (!this.dirty) { const t = window.__bench.touched ??= {}, k = `${this.name ?? this.geometry.topology} @ ${window.__benchCallers(new Error().stack)}`; t[k] = (t[k] ?? 0) + 1; }
      return touch.call(this);
    };
  });
  const box = await page.locator('canvas.vp-canvas').boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  // 60 pointer moves across the plate (faces, edges, the hole): a submit only when what is hovered changes.
  await measure('hover: 60 moves across the plate', BUDGET.hover, async () => {
    for (let i = 0; i < 60; i++) { await page.mouse.move(cx - 300 + 10 * i, cy - 40 + (i % 7) * 12); await page.waitForTimeout(16); }
  });
  // A click on a face from idle (the selection changes): one frame drawn, once.
  await measure('select: a face clicked from idle', BUDGET.select, async () => { await page.mouse.click(cx + 40, cy + 30); });
  await measure('select: cleared (Escape) from idle', BUDGET.clear, async () => { await page.keyboard.press('Escape'); });
  // (R1d: the Box command's width typed, as a person types — its first field focused and selected as the HUD opens — then
  // the shape placed by the pointer: 30 moves over the plate before a click. Each command cancelled after.)
  await page.mouse.move(cx, cy); await page.keyboard.press('b'); await page.waitForSelector('.hud input[type=number]', { timeout: 10000 }); await page.waitForTimeout(600);
  await measure('HUD: 4 keystrokes into the box width', BUDGET.hudTyping, async () => { await page.keyboard.type('3640', { delay: 60 }); await page.waitForTimeout(800); });
  await page.keyboard.press('Escape'); await page.waitForTimeout(300); await page.keyboard.press('Escape');
  await page.mouse.move(cx, cy); await page.keyboard.press('b'); await page.waitForSelector('.hud', { timeout: 10000 }); await page.waitForTimeout(400);
  await measure('placing: 30 pointer moves before the click', BUDGET.placing, async () => {
    for (let i = 0; i < 30; i++) { await page.mouse.move(cx - 150 + 10 * i, cy - 20 + (i % 5) * 8); await page.waitForTimeout(16); }
    await page.waitForTimeout(400);
  });
  await page.keyboard.press('Escape'); await page.waitForTimeout(300); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
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
  // ---- G15d.1: the Render workspace orbited, without and with the post ------------------------------------------------
  const orbit60 = async () => {
    await page.mouse.move(cx, cy); await page.mouse.down({ button: 'left' });
    for (let i = 0; i < 60; i++) { await page.mouse.move(cx + 4 * i, cy + (i % 5)); await page.waitForTimeout(16); }
    await page.mouse.up({ button: 'left' });
  };
  await page.keyboard.press('Escape');
  await page.click('.mode button:text-is("Render")'); await page.waitForSelector('[aria-label="Render"]'); await page.waitForTimeout(800);
  await measure('render: orbit 60', BUDGET.renderOrbit, orbit60);
  await page.click('.render-panel [role="tab"]:text-is("Scene")');
  await page.selectOption('.render-panel [aria-label="Tone mapping"]', 'agx');
  await page.selectOption('.render-panel [aria-label="Colour grade"]', 'warm');
  await page.evaluate(() => { for (const [l, x] of [['Contrast', 1.2], ['Saturation', 1.2], ['Vignette', 0.6]]) { const el = document.querySelector(`.render-panel [aria-label="${l}"]`); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(x)); el.dispatchEvent(new Event('input', { bubbles: true })); } });
  await page.waitForTimeout(800);
  await measure('render: orbit 60, post on (AgX, warm grade, vignette)', BUDGET.renderOrbitPost, orbit60);
  await page.click('.render-panel [role="tab"]:text-is("Appearance")');
  await page.selectOption('[aria-label="Appearance preset"]', 'look-knurled-steel');
  await page.evaluate(() => { const el = document.querySelector('.render-panel [aria-label="Clear coat"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '0.6'); el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(800);
  await measure('render: orbit 60, post on, knurled and lacquered (G15a)', BUDGET.renderOrbitFinish, orbit60);
  await page.click('.mode button:text-is("Model")'); await page.waitForTimeout(500);
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
  // RS2: the motion from home to the first joint at 1.5 rad played for 1.5 s (a pose shown, then Play, then Pause).
  await page.click('[aria-label="Joints home"]').catch(() => {});
  await page.evaluate(() => { const el = document.querySelector('[aria-label="Joint base~a value"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '1.5'); el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForSelector('[aria-label="Play motion"]:not([disabled])', { timeout: 20000 });
  await measure('motion: the 2R arm\'s motion played', BUDGET.motion, async () => {
    await page.click('[aria-label="Play motion"]'); await page.waitForTimeout(1500); await page.click('[aria-label="Pause motion"]').catch(() => {});
  });
  // G4: the arm's workspace map shown (RM9b: 20 000 poses, its voxels drawn as an overlay), orbited 60 steps.
  await page.click('[aria-label="Joints home"]').catch(() => {});
  await page.click('[aria-label="Map workspace"]'); await page.waitForSelector('[aria-label="Workspace summary"]', { timeout: 60000 }); await page.waitForTimeout(500);
  voxels = Number((await page.locator('[aria-label="Workspace summary"]').innerText()).match(/(\d+) voxels/)?.[1] ?? 0);
  {
    const vb = await page.locator('canvas.vp-canvas').boundingBox(), vx = vb.x + vb.width / 2, vy = vb.y + vb.height / 2;
    await measure(`cloud: ${voxels} workspace voxels, orbit 60`, BUDGET.cloud, async () => {
      await page.mouse.move(vx, vy); await page.mouse.down({ button: 'left' });
      for (let i = 0; i < 60; i++) { await page.mouse.move(vx + 4 * i, vy + (i % 5)); await page.waitForTimeout(16); }
      await page.mouse.up({ button: 'left' });
    });
  }
  // G8: a synthetic map of 100 000 voxels around the arm (DEV __studioSetCloud), orbited 60 steps: SVG squares projected
  // every frame before, engine points now.
  {
    const box = await page.evaluate(() => { const b = window.__studioInstanceBounds(); const min = [0, 1, 2].map(k => Math.min(...b.map(x => x.min[k]))), max = [0, 1, 2].map(k => Math.max(...b.map(x => x.max[k]))); return { min, max }; });
    await page.evaluate(({ min, max }) => window.__studioSetCloud(100000, min, max), box);
    // (Engine points, or the SVG's band paths before G8 and on WebGL2.)
    await page.waitForFunction(() => window.__studioOverlayLines?.().cloud === 100000 || document.querySelectorAll('[aria-label="Workspace map"] path').length > 0, null, { timeout: 60000 }); await page.waitForTimeout(500);
    const vb = await page.locator('canvas.vp-canvas').boundingBox(), vx = vb.x + vb.width / 2, vy = vb.y + vb.height / 2;
    await measure('cloud: 100 000 voxels, orbit 60', BUDGET.cloud100k, async () => {
      await page.mouse.move(vx, vy); await page.mouse.down({ button: 'left' });
      for (let i = 0; i < 60; i++) { await page.mouse.move(vx + 4 * i, vy + (i % 5)); await page.waitForTimeout(16); }
      await page.mouse.up({ button: 'left' });
    });
    await page.evaluate(() => window.__studioSetCloud(0));
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
  // G10: 120 copies of the bracket turned about Z in 3° steps, opened: what is uploaded and made, and the viewer's
  // geometry bytes (each geometry once) — one tessellation shared by the copies, or each its own.
  {
    const turned = { ...many, instances: many.instances.map((i, k) => ({ ...i, id: `t${k}`, rotation: [0, 0, 3 * k], part: undefined })) };
    await measure('pattern: 120 turned brackets opened', BUDGET.pattern, async () => {
      await open('pattern.bcad', turned, () => window.__studioInstanceBounds?.().length === 120 && window.__studioInstanceBounds().every(b => b.id.startsWith('t')));
    });
    // (Not measured under BENCH_ONLY: no row to add it to.)
    if (rows.at(-1)?.name.startsWith('pattern:')) rows[rows.length - 1].geometry = await page.evaluate(() => {
      const v = window.__studioViewer; if (!v) return null;
      const gs = new Set(v.meshList.filter(m => m.name?.startsWith('inst:')).map(m => m.geometry));
      let bytes = 0; for (const g of gs) { const d = g.data; bytes += d.positions.byteLength + d.normals.byteLength + d.colors.byteLength + (d.uvs?.byteLength ?? 0) + (d.indices?.byteLength ?? 0); }
      return { geometries: gs.size, meshes: v.meshList.filter(m => m.name?.startsWith('inst:')).length, kib: +(bytes / 1024).toFixed(0), heapMiB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null };
    });
    await open('brackets.bcad', many, () => window.__studioInstanceBounds?.().length === 120 && window.__studioInstanceBounds().every(b => b.id.startsWith('i')));
  }
  // G9: the pointer across the 120 brackets (each move picks faces, edges and instances) and a bracket clicked from idle;
  // then the viewer's own picks over 500 pointers on this scene (DEV __studioViewer): the linear walk (`accelerate` off,
  // the picks as before G9) against the scene trees — timed, and the same answers.
  {
    const ab = await page.locator('canvas.vp-canvas').boundingBox(), ax = ab.x + ab.width / 2, ay = ab.y + ab.height / 2;
    await measure('hover: 60 moves across 120 brackets', BUDGET.hoverMany, async () => {
      for (let i = 0; i < 60; i++) { await page.mouse.move(ax - 300 + 10 * i, ay - 40 + (i % 7) * 12); await page.waitForTimeout(16); }
    });
    // (BENCH_TRACE: what the hover's path is over — the viewer's ray at each of its points, by mesh name.)
    if (trace) console.log('  [hover path] ' + JSON.stringify(await page.evaluate(([ax, ay, bx, by]) => {
      const v = window.__studioViewer, out = {};
      for (let i = 0; i < 60; i++) { const h = v.raycast(ax - 300 + 10 * i - bx, ay - 40 + (i % 7) * 12 - by), k = h ? `${h.mesh.name ?? h.mesh.geometry.topology}${h.instance !== undefined ? '#' : ''}` : 'none'; out[k] = (out[k] ?? 0) + 1; }
      return out;
    }, [ax, ay, ab.x, ab.y])));
    await measure('pick: a bracket clicked from idle', BUDGET.pickMany, async () => { await page.mouse.click(ax + 13, ay + 7); });
    await page.keyboard.press('Escape');
    picks = await page.evaluate(() => {
      const v = window.__studioViewer; if (!v || !('accelerate' in v)) return null;
      const c = v.canvas, W = c.clientWidth, H = c.clientHeight; let seed = 5; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const at = Array.from({ length: 500 }, () => [rand() * W, rand() * H]);
      const key = h => h ? [h.mesh.id, h.instance ?? null, h.triangle ?? null, h.segment ?? null, ...h.point.map(x => Math.round(x * 1e9))].join(',') : '';
      const run = () => { const t0 = performance.now(), ray = at.map(([x, y]) => key(v.raycast(x, y))), t1 = performance.now(), line = at.map(([x, y]) => key(v.pickLine(x, y, 6))), t2 = performance.now(); return { ray, line, rayMs: t1 - t0, lineMs: t2 - t1 }; };
      v.accelerate = false; run(); const lin = run(); v.accelerate = true; run(); const acc = run();
      let differ = 0, hits = 0; for (let i = 0; i < at.length; i++) { if (lin.ray[i] !== acc.ray[i]) differ++; if (lin.line[i] !== acc.line[i]) differ++; if (lin.ray[i]) hits++; }
      return { pointers: at.length, hits, differ, linear: { ray: lin.rayMs, line: lin.lineMs }, trees: { ray: acc.rayMs, line: acc.lineMs } };
    });
    // G11: the brackets ghosted (their surfaces 0.35 opaque, through the DEV viewer), orbited 60 steps — sorted far to near
    // as before, then through the order-independent pass.
    const ghosted = await page.evaluate(() => { const v = window.__studioViewer; if (!v || !('orderIndependent' in v)) return false; for (const m of v.meshList) if (m.name?.startsWith('inst:') && m.geometry.topology === 'triangles') m.material = { opacity: 0.35 }; return true; });
    if (ghosted) for (const oit of [false, true]) {
      await page.evaluate(o => { window.__studioViewer.orderIndependent = o; }, oit);
      await measure(`ghosted: 120 brackets, orbit 60 (${oit ? 'order-independent' : 'sorted'})`, BUDGET.ghost, async () => {
        await page.mouse.move(ax, ay); await page.mouse.down({ button: 'left' });
        for (let i = 0; i < 60; i++) { await page.mouse.move(ax + 4 * i, ay + (i % 5)); await page.waitForTimeout(16); }
        await page.mouse.up({ button: 'left' });
      });
    }
    await page.evaluate(() => { const v = window.__studioViewer; if (!v) return; v.orderIndependent = true; for (const m of v.meshList) if (m.name?.startsWith('inst:') && m.geometry.topology === 'triangles') m.material = { opacity: 1 }; });
  }
  // G2: the section plane dragged 60 steps across the 120 brackets — cut by the GPU's clip plane, then (the same build) by
  // clipMesh on the CPU as WebGL2 does; the exact section held back in both (only the drag's own cost).
  // (As a drag sets it: a new plane each animation frame, y from 20 to 160 — R1c (3c): through the handle's own path, each
  // step shown and the last, released, committed.)
  const dragSection = () => page.evaluate(() => new Promise(done => { let i = 0; const step = () => { ++i; window.__studioDragSection({ axis: 'y', at: 20 + 140 * i / 60, keep: 'positive' }, i >= 60); if (i < 60) requestAnimationFrame(step); else done(); }; requestAnimationFrame(step); }));
  await page.click('[aria-label="Section view"]'); await page.waitForFunction(() => window.__studioSection?.().clip !== undefined, null, { timeout: 10000 });
  for (const [name, cpu, budget] of [['section: 120 brackets, 60-step drag (GPU)', false, BUDGET.sectionGpu], ['section: the same, CPU clipMesh (WebGL2\'s)', true, BUDGET.sectionCpu]]) {
    await page.evaluate(c => window.__studioSectionDebug({ hold: true, cpu: c }), cpu); await page.waitForTimeout(800);
    await measure(name, budget, dragSection);
  }
  await page.evaluate(() => window.__studioSectionDebug({ hold: false, cpu: false }));
  // G7: a large DXF underlay (2 000 polylines of 20 points, 100 texts) over a small plate, orbited 60 steps: its lines
  // were an SVG path projected every frame; they are an engine line mesh now.
  await page.click('[aria-label="Section view"]').catch(() => {});
  const polylines = Array.from({ length: 2000 }, (_, k) => Array.from({ length: 20 }, (_, i) => [(k % 50) * 8 + i * 0.35, Math.floor(k / 50) * 8 + Math.sin(i + k) * 2]));
  const texts = Array.from({ length: 100 }, (_, k) => ({ at: [(k % 10) * 40, Math.floor(k / 10) * 32], text: `NOTE ${k}`, height: 3, angle: 0 }));
  const drawing = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, { kind: 'extrude', sketch: 0, height: 5 }], outputs: { b1: { node: 1, side: 'solid' } },
    underlays: [{ id: 'U1', name: 'big', polylines, texts, counts: { LWPOLYLINE: 2000, TEXT: 100 } }] };
  await open('underlay.bcad', drawing, () => window.__studioDoc?.underlays?.length === 1 && !!document.querySelector('[aria-label="Underlay drawing U1"]'));
  {
    const ub = await page.locator('canvas.vp-canvas').boundingBox(), ux = ub.x + ub.width / 2, uy = ub.y + ub.height / 2;
    await measure('underlay: 40 000 points, 100 texts, orbit 60', BUDGET.underlay, async () => {
      await page.mouse.move(ux, uy); await page.mouse.down({ button: 'left' });
      for (let i = 0; i < 60; i++) { await page.mouse.move(ux + 4 * i, uy + (i % 5)); await page.waitForTimeout(16); }
      await page.mouse.up({ button: 'left' });
    });
  }
} finally { await browser.close(); await server.close(); }
// (The machine's load average: a budget is not set from numbers measured under load.)
console.log(`load average ${loadAtStart.toFixed(1)} at the start, ${os.loadavg()[0].toFixed(1)} at the end${Math.max(loadAtStart, os.loadavg()[0]) > 4 ? ' — LOADED: compare, do not set budgets from this run' : ''}`);
for (const r of rows) console.log(`${r.ok ? 'ok  ' : 'SLOW'} ${r.name.padEnd(36)} submits ${String(r.submits).padStart(3)} (≤ ${r.budget.submits}, ${r.most} in one frame)  frames ${String(r.frames).padStart(3)}  avg frame ${String(r.avgFrameMS).padStart(5)} ms (≤ ${r.budget.avgFrameMS})  task ${String(r.taskMS).padStart(6)} ms/frame${r.budget.taskMS ? ` (≤ ${r.budget.taskMS})` : ''}  upload ${String(r.kb).padStart(7)} KiB/frame${r.budget.kb ? ` (≤ ${r.budget.kb})` : ''}  buffers ${String(r.buffers).padStart(5)}${r.budget.buffers !== undefined ? ` (≤ ${r.budget.buffers})` : ''}  GPU ${r.timed ? String(r.gpuMS).padStart(5) + ' ms/submit' : 'UNAVAILABLE (invalid or missing timestamps)'}${r.budget.gpuMS ? ` (≤ ${r.budget.gpuMS})` : ''}${r.timing.unstamped ? ` (${r.timing.unstamped} unstamped)` : ''}  queue ${r.queueMS} ms${r.sameStamp ? ` (${r.sameStamp} frames stamped as the last)` : ''}  wall ${r.wallMS} ms  task total ${r.taskTotalMS} ms${r.geometry ? `  uploaded ${r.uploadTotalKiB} KiB; ${r.geometry.meshes} meshes on ${r.geometry.geometries} geometries, ${r.geometry.kib} KiB; heap ${r.geometry.heapMiB} MiB` : ''}  App ${r.app}${Number.isFinite(r.budget.app) ? ` (≤ ${r.budget.app})` : ''}`);
if (picks) console.log(`picks over 120 brackets, ${picks.pointers} pointers (${picks.hits} on a bracket), ${picks.differ} answers different: raycast ${picks.linear.ray.toFixed(1)} → ${picks.trees.ray.toFixed(1)} ms, pickLine ${picks.linear.line.toFixed(1)} → ${picks.trees.line.toFixed(1)} ms (linear walk → scene trees)`);
console.log(`bench results: ${JSON.stringify(rows)}`);
const expectedNames = benchCaseNames(voxels).filter(name => !only || only.test(name));
console.log(`bench cases: ${JSON.stringify({ expected: expectedNames, actual: rows.map(r => r.name) })}`);
process.exit(benchRowsPass(rows, expectedNames, picks, !only) ? 0 : 1);
