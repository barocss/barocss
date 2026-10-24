// Small runner checks only: no app build, Vite server, browser, GPU or benchmark.
// Run: node --test packages/barocss-gpu/tests/browser-runner-contract.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';

const benchFile = new URL('../../../apps/cad-studio/test/bench-browser.mjs', import.meta.url);
const flowFile = new URL('../../../apps/cad-studio/test/browser-flow.mjs', import.meta.url);

// Execute the helpers from the real runner files, stopping before their resource startup.
function helpers(file, end, names, context = {}) {
  const source = readFileSync(file, 'utf8'), start = source.indexOf('// Pure runner contracts');
  const stop = source.indexOf(end, start);
  assert.ok(start >= 0 && stop > start, 'runner helpers are separate from browser startup');
  return runInNewContext(source.slice(start, stop) + `\n({ ${names.join(', ')} })`, context);
}
const { benchCaseNames, benchRowsPass, timestampSample, benchGpuTiming, benchCounters } = helpers(benchFile, 'const root =', ['benchCaseNames', 'benchRowsPass', 'timestampSample', 'benchGpuTiming', 'benchCounters']);
const { parseFlowDpr, flowDisplayMatches } = helpers(flowFile, 'const flowDpr =', ['parseFlowDpr', 'flowDisplayMatches']);
const all = [...benchCaseNames(412)], section = all.filter(name => /^section:/i.test(name));
const passing = names => names.map(name => ({ name, ok: true }));

test('unfiltered bench requires all 19 distinct named cases, including both ghost paths', () => {
  // (17, then G-R49's two rows: typing in the HUD and placing a shape.)
  assert.equal(all.length, 19); assert.equal(new Set(all).size, 19);
  assert.ok(all.includes('cloud: 412 workspace voxels, orbit 60'));
  assert.ok(all.includes('ghosted: 120 brackets, orbit 60 (sorted)'));
  assert.ok(all.includes('ghosted: 120 brackets, orbit 60 (order-independent)'));
  assert.equal(benchRowsPass(passing(all), all, null, true), true);
  assert.equal(benchRowsPass(passing(all.slice(1)), all, null, true), false);
  assert.equal(benchRowsPass(passing(all.slice(1)), all.slice(1), null, true), false);
  assert.equal(benchRowsPass(passing(all), [...all.slice(1), all[1]], null, true), false);
});

test('BENCH_ONLY=section expects exactly the selected GPU and CPU row names', () => {
  assert.deepEqual(section, ['section: 120 brackets, 60-step drag (GPU)', "section: the same, CPU clipMesh (WebGL2's)"]);
  assert.equal(benchRowsPass(passing(section), section, null, false), true);
  assert.equal(benchRowsPass(passing(section.slice(0, 1)), section, null, false), false);
  assert.equal(benchRowsPass(passing([section[0], 'section: wrong case']), section, null, false), false);
  assert.equal(benchRowsPass(passing([section[0], section[0]]), section, null, false), false);
  assert.equal(benchRowsPass(passing(all), section, null, false), false);
});

test('bench refuses zero matches, zero measurements, failed rows and missing pass flags', () => {
  assert.equal(benchRowsPass([], [], null, false), false);
  assert.equal(benchRowsPass([], section, null, false), false);
  assert.equal(benchRowsPass([{ name: section[0], ok: false }, { name: section[1], ok: true }], section, null, false), false);
  assert.equal(benchRowsPass([{ name: section[0] }, { name: section[1], ok: true }], section, null, false), false);
});

test('bench retains pick parity and supports filters matching a dynamic workspace row', () => {
  const names = all.filter(name => /^cloud: 412 workspace/.test(name));
  assert.equal(names.length, 1);
  assert.equal(benchRowsPass(passing(names), names, { differ: 0 }, false), true);
  assert.equal(benchRowsPass(passing(names), names, { differ: 1 }, false), false);
  assert.equal(benchRowsPass(passing(names), names, {}, false), false);
});

test('timestamp queries require exact used/read/pass counts and ordered nonempty pairs', () => {
  assert.equal(timestampSample([100n, 1100n, 1200n, 3200n], 4, 2).ms, 0.003);
  assert.equal(timestampSample([100n, 200n, 150n, 250n], 4, 2).ms, 0.0002, 'overlapping passes keep their own nonnegative durations');
  assert.equal(timestampSample([100n, 100n], 2, 1).valid, true, 'positive equal timestamps can quantize to zero elapsed');
  for (const [values, used, passes] of [
    [[], 0, 0], [[100n, 200n], 4, 2], [[100n, 200n, 0n, 0n], 4, 2],
    [[0n, 0n], 2, 1], [[200n, 100n], 2, 1], [[100n, 200n, 250n, 150n], 4, 2],
    [[100n, 200n], 2, 2], [[100n, 200n], 3, 1], [[-1n, 100n], 2, 1],
    [[0n, 0x10000000000000000n], 2, 1], [[1n, BigInt(Number.MAX_SAFE_INTEGER) + 2n], 2, 1],
    [[NaN, 200n], 2, 1], [[100n, Infinity], 2, 1],
  ]) assert.equal(timestampSample(values, used, passes).valid, false, String(values));
});

test('GPU timing refuses negative/non-finite totals, missing queries and partial readbacks', () => {
  const good = { ...benchCounters(), submits: 1, gpuExpected: 2, gpuCompleted: 2, gpuQueries: 6, gpuReadQueries: 6, gpuMS: 2 };
  assert.equal(benchGpuTiming(good).msPerSubmit, 2, 'multiple command buffers in one submit are summed');
  for (const change of [
    { gpuMS: -102469825250.47 }, { gpuMS: NaN }, { gpuMS: Infinity }, { gpuMS: -Infinity },
    { submits: 0 }, { gpuExpected: 0 }, { gpuCompleted: 1 }, { gpuQueries: 0 }, { gpuReadQueries: 4 },
    { timingErrors: [{ reason: 'timestamp-query-unavailable' }] }, { gpuCompleted: undefined },
  ]) {
    const result = benchGpuTiming({ ...good, ...change });
    assert.equal(result.valid, false); assert.equal(result.msPerSubmit, null, JSON.stringify(change));
  }
});

test('query readback follows the submitted command buffer and stays with its measurement window', async () => {
  const made = [];
  class Buffer {
    constructor(d) { this.data = new ArrayBuffer(d.size); this.mapCalls = 0; made.push(this); }
    mapAsync() { assert.equal(this.submitted, true); this.mapCalls++; return new Promise((ok, no) => { this.release = ok; this.reject = no; }); }
    getMappedRange(offset, size) { return this.data.slice(offset, offset + size); }
    unmap() { this.unmapped = true; }
    destroy() { this.destroyed = true; }
  }
  class Encoder {
    beginRenderPass() { return { end() {} }; }
    resolveQuerySet(qs, first, n, res) { this.resolved = { qs, first, n, res }; }
    copyBufferToBuffer(_res, _a, read, _b, size) { this.read = read; this.copySize = size; }
    finish() { return { encoder: this }; }
  }
  class Queue {
    writeBuffer() {}
    onSubmittedWorkDone() { return Promise.resolve(); }
    submit(commands) {
      for (const { encoder: e } of commands) if (e.read) {
        e.read.submitted = true;
        new BigUint64Array(e.read.data).set(e.values ?? Array.from({ length: e.resolved.n }, (_, i) => BigInt(100 + i * 100)));
      }
    }
  }
  class Device {
    constructor() { this.features = new Set(['timestamp-query']); this.queue = new Queue(); this.queries = []; }
    createBuffer(d) { return new Buffer(d); }
    createCommandEncoder() { return new Encoder(); }
    createQuerySet(d) { const q = { count: d.count, destroy() { this.destroyed = true; } }; this.queries.push(q); return q; }
  }
  const window = { GPUDevice: Device, GPUQueue: Queue, requestAnimationFrame() {} };
  const context = { window, GPUDevice: Device, GPUQueue: Queue, GPUBufferUsage: { QUERY_RESOLVE: 1, COPY_SRC: 2, MAP_READ: 4, COPY_DST: 8 }, GPUMapMode: { READ: 1 },
    performance: { now: () => 1 }, MessageChannel: class { port1 = {}; port2 = { postMessage() {} }; } };
  const contract = helpers(benchFile, 'const root =', ['installBenchInstrumentation', 'timestampSample', 'benchCounters', 'benchGpuTiming'], context);
  contract.installBenchInstrumentation(contract.timestampSample, contract.benchCounters);
  const d = new Device();
  const encode = () => { const e = d.createCommandEncoder(); e.beginRenderPass({}).end(); return e.finish(); };
  const a = encode(), b = encode();
  assert.equal(d.queries.length, 2); assert.equal(d.__ts.length, 0);
  assert.equal(a.encoder.resolved.first, 0); assert.equal(a.encoder.resolved.n, 2); assert.equal(a.encoder.copySize, 16);
  d.queue.submit([a]); const sample = window.__bench;
  assert.equal(a.encoder.read.mapCalls, 1); assert.equal(b.encoder.read.mapCalls, 0, 'finished but unsubmitted work is not read');
  assert.equal(d.__ts.length, 0, 'query set is not recycled before readback');
  window.__benchReset(); a.encoder.read.release(); await window.__benchDrain();
  assert.equal(sample.gpuCompleted, 1); assert.equal(window.__bench.gpuCompleted, 0, 'late result cannot enter the next window');
  assert.equal(a.encoder.read.destroyed, true); assert.equal(a.encoder.resolved.res.destroyed, true); assert.equal(d.__ts.length, 1);
  assert.equal(contract.benchGpuTiming(sample).valid, true);
  d.queue.submit([b]); b.encoder.read.release(); await window.__benchDrain();
  assert.equal(contract.benchGpuTiming(window.__bench).valid, true);
  d.queue.submit([]); await window.__benchDrain();
  assert.equal(contract.benchGpuTiming(window.__bench).valid, false, 'an empty submit cannot dilute the per-submit average');
  window.__benchReset();
  const bad = encode(); bad.encoder.values = [200n, 100n]; d.queue.submit([bad]); bad.encoder.read.release(); await window.__benchDrain();
  assert.equal(contract.benchGpuTiming(window.__bench).valid, false);
  assert.equal(window.__bench.gpuMS, 0, 'invalid delta is not added or converted to its absolute value');
  // (G8: a reversed pair — a begin stamp left unwritten — leaves that submit unstamped, counted, not a timing error.)
  assert.equal(window.__bench.unstamped, 1); assert.equal(window.__bench.timingErrors.length, 0);
  window.__benchReset();
  const lost = encode(); d.queue.submit([lost]); lost.encoder.read.reject(new Error('map failed')); await window.__benchDrain();
  assert.equal(contract.benchGpuTiming(window.__bench).valid, false);
  assert.ok(d.queries.some(q => q.destroyed), 'a failed readback does not recycle its query set');
  assert.ok(made.filter(b => b.mapCalls).every(b => b.destroyed));
});

test('FLOW_DPR defaults to 1 and accepts decimal pixel ratios in the viewport range', () => {
  assert.equal(parseFlowDpr(), 1);
  for (const [input, want] of [['1', 1], ['2', 2], ['3', 3], ['1.25', 1.25], [' 2.0 ', 2]]) assert.equal(parseFlowDpr(input), want);
});

test('FLOW_DPR refuses blank, non-finite, non-decimal and out-of-range inputs', () => {
  for (const input of ['', ' ', '0', '0.5', '3.1', '-2', 'NaN', 'Infinity', '0x2', '2e0', '2px']) {
    assert.throws(() => parseFlowDpr(input), /FLOW_DPR must be a decimal number from 1 to 3/, input);
  }
});

test('invalid FLOW_DPR exits the actual CLI before Playwright or Vite startup', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(flowFile)], {
    env: { ...process.env, FLOW_DPR: '0', PW_DIR: '' }, encoding: 'utf8', timeout: 5000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /RangeError: FLOW_DPR/);
  assert.doesNotMatch(result.stderr, /Set PW_DIR|Cannot find|ERR_MODULE_NOT_FOUND/);
  assert.equal(result.stdout, '');
});

test('display evidence requires actual DPR and matching canvas backing dimensions', () => {
  const display = { devicePixelRatio: 2, cssWidth: 701, cssHeight: 601, backingWidth: 1402, backingHeight: 1202 };
  assert.equal(flowDisplayMatches(display, 2), true);
  assert.equal(flowDisplayMatches({ ...display, devicePixelRatio: 1 }, 2), false);
  assert.equal(flowDisplayMatches({ ...display, backingWidth: 701 }, 2), false);
  assert.equal(flowDisplayMatches({ ...display, backingHeight: 601 }, 2), false);
  assert.equal(flowDisplayMatches({ ...display, cssWidth: 0 }, 2), false);
  assert.equal(flowDisplayMatches({ ...display, devicePixelRatio: NaN }, 2), false);
  assert.equal(flowDisplayMatches({ devicePixelRatio: 1, cssWidth: 701, cssHeight: 601, backingWidth: 701, backingHeight: 601 }, 1), true);
  assert.equal(flowDisplayMatches({ devicePixelRatio: 1.25, cssWidth: 701, cssHeight: 601, backingWidth: 876, backingHeight: 751 }, 1.25), true);
});
