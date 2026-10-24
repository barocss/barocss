// Controller lifecycle with a hook/Worker recorder. No React DOM, Model evaluation or browser run.
// Run: node --test --test-concurrency=1 packages/barocss-gpu/tests/cad-print-hook.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../../../', import.meta.url)), temporary = await mkdtemp(join(tmpdir(), 'cad-print-hook-'));
let usePrintLayers;
try {
  const outfile = join(temporary, 'hook.mjs');
  await build({ entryPoints: [resolve(root, 'apps/cad-studio/src/viewport/usePrintLayers.ts')], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
    alias: { '@barocss/cad-model': resolve(root, 'packages/barocss-cad-model/src'), '@barocss/cad': resolve(root, 'packages/barocss-cad/src') },
    plugins: [{ name: 'hook-recorder', setup(builder) {
      builder.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'recorder' }));
      builder.onLoad({ filter: /.*/, namespace: 'recorder' }, () => ({ contents: 'export const useRef=(...a)=>globalThis.__g23Hooks.useRef(...a),useState=(...a)=>globalThis.__g23Hooks.useState(...a),useMemo=(...a)=>globalThis.__g23Hooks.useMemo(...a),useEffect=(...a)=>globalThis.__g23Hooks.useEffect(...a);' }));
    } }],
  });
  ({ usePrintLayers } = await import(pathToFileURL(outfile).href));
} finally { await rm(temporary, { recursive: true, force: true }); }

function mesh() {
  return { positions: Float32Array.of(0, 0, 0, 2, 0, 0, 0, 2, 6), normals: new Float32Array(9), indices: Uint32Array.of(0, 1, 2), faceOfVertex: new Float32Array(3), faces: [], edges: [], edgeLines: new Float32Array(), edgeOfSegment: new Float32Array(), bounds: { min: [0, 0, 0], max: [2, 2, 6] } };
}
function output(job, { count = 30, summaryKey = 1, supportMesh = mesh() } = {}) {
  const mm = job.layerHeight ?? 0.2;
  return { request: job.request, display: {
    request: job.request, summaryKey,
    summary: { version: 'print-layers-v1', direction: job.direction ?? [0, 0, 1], directionSource: job.direction ? 'given' : 'default', modelToBed: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], layerMM: { mm, basis: job.layerHeight === undefined ? 'estimate' : 'set' }, limitDeg: { deg: job.overhangLimit ?? 45, basis: job.overhangLimit === undefined ? 'estimate' : 'set' }, count, heightMM: count * mm, supportColumns: [], supportVolumeMM3: 0, basis: 'display mesh' },
    layer: { k: job.layer, z: (job.layer + 0.5) * mm, contours: [], overhang: [], support: [] },
    supportMesh, topMM: (job.layer + 1) * mm, supports: true, printed: true,
  } };
}
function fixture() {
  const oldWorker = globalThis.Worker, oldHooks = globalThis.__g23Hooks, slots = [], effects = [], workers = [];
  let cursor = 0;
  const same = (a, b) => !!a && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  globalThis.__g23Hooks = {
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useMemo(make, deps) { const i = cursor++, old = slots[i]; if (!old || !same(old.deps, deps)) slots[i] = { deps, value: make() }; return slots[i].value; },
    useEffect(make, deps) { const i = cursor++, old = slots[i]; if (!old || !same(old.deps, deps)) effects.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: make() }; }); },
  };
  globalThis.Worker = class {
    messages = []; terminated = false;
    constructor() { workers.push(this); }
    postMessage(job) { this.messages.push(job); }
    terminate() { this.terminated = true; }
  };
  const args = { active: true, meshes: [mesh()], options: { layer: 0, supports: true, printed: true } };
  return {
    args, workers,
    render() { cursor = 0; return usePrintLayers(args.active, args.meshes, args.options); },
    flush() { for (const effect of effects.splice(0)) effect(); },
    cleanup() { for (const slot of slots) slot?.cleanup?.(); globalThis.Worker = oldWorker; globalThis.__g23Hooks = oldHooks; },
  };
}
function seed(f) {
  const initial = f.render(); assert.equal(initial.display, null); assert.equal(initial.count, undefined);
  f.flush(); const worker = f.workers[0], job = worker.messages.at(-1), reply = output(job);
  worker.onmessage({ data: reply }); const ready = f.render(); assert.equal(ready.stage, 'ready'); assert.equal(ready.count, 30); f.flush();
  return { worker, job, reply, ready };
}
const pendingCount = (state, count) => { assert.equal(state.stage, 'pending'); assert.equal(state.display, null, 'retained count must never retain stale drawing geometry'); assert.equal(state.count, count); };

test('same-summary pending layer retains count30 before effects and after request, while its drawing stays null', () => {
  const f = fixture();
  try {
    const { worker, job, ready } = seed(f);
    f.args.options = { ...f.args.options, layer: 1 };
    pendingCount(f.render(), 30); f.flush(); pendingCount(f.render(), 30);
    const next = worker.messages.at(-1); assert.ok(next.request > job.request); assert.equal(next.layer, 1); assert.equal(next.sourceKey, job.sourceKey);
    worker.onmessage({ data: output(next) }); const current = f.render();
    assert.equal(current.stage, 'ready'); assert.equal(current.count, 30); assert.equal(current.display.layer.k, 1);
    assert.notEqual(current.display.layer, ready.display.layer);
  } finally { f.cleanup(); }
});

test('mesh source, build direction, explicit layer height and overhang limit invalidate count on the first render', () => {
  for (const [label, change] of [
    ['source', f => { f.args.meshes = [mesh()]; }],
    ['direction', f => { f.args.options = { ...f.args.options, direction: [1, 0, 0] }; }],
    ['height', f => { f.args.options = { ...f.args.options, layerHeight: 0.4 }; }],
    ['limit', f => { f.args.options = { ...f.args.options, overhangLimit: 35 }; }],
  ]) {
    const f = fixture();
    try {
      const { worker, job } = seed(f), oldHandler = worker.onmessage; change(f);
      pendingCount(f.render(), undefined); f.flush(); pendingCount(f.render(), undefined);
      const next = worker.messages.at(-1); assert.ok(next.request > job.request, label);
      oldHandler({ data: output(job) }); pendingCount(f.render(), undefined);
      worker.onmessage({ data: output(next, { count: 12, summaryKey: 2 }) });
      const current = f.render(); assert.equal(current.count, 12, label); assert.equal(current.display.summary.count, 12, label);
      if (label === 'source') assert.ok(next.sourceKey > job.sourceKey);
    } finally { f.cleanup(); }
  }
});

test('rapid layer requests keep the range but only the latest reply may replace the active drawing/count', () => {
  const f = fixture();
  try {
    const { worker } = seed(f);
    f.args.options = { ...f.args.options, layer: 1 }; pendingCount(f.render(), 30); f.flush();
    const second = worker.messages.at(-1), secondHandler = worker.onmessage;
    f.args.options = { ...f.args.options, layer: 2 }; pendingCount(f.render(), 30); f.flush();
    const third = worker.messages.at(-1); assert.ok(third.request > second.request);
    secondHandler({ data: output(second, { count: 999 }) }); pendingCount(f.render(), 30);
    worker.onmessage({ data: output(second, { count: 998 }) }); pendingCount(f.render(), 30);
    worker.onmessage({ data: output(third) }); const accepted = f.render(); assert.equal(accepted.display.layer.k, 2); assert.equal(accepted.count, 30);
    secondHandler({ data: output(second, { count: 997 }) }); const afterOld = f.render(); assert.equal(afterOld.display.layer.k, 2); assert.equal(afterOld.count, 30);
  } finally { f.cleanup(); }
});

test('disable clears count and drawing immediately, terminates worker, and re-enable cannot accept old-worker output', () => {
  const f = fixture();
  try {
    const { worker: old, job, reply } = seed(f), oldHandler = old.onmessage;
    f.args.active = false; pendingCount(f.render(), undefined); f.flush(); assert.equal(old.terminated, true);
    oldHandler({ data: reply }); pendingCount(f.render(), undefined);
    f.args.active = true; pendingCount(f.render(), undefined); f.flush(); pendingCount(f.render(), undefined);
    const current = f.workers[1], next = current.messages.at(-1); assert.ok(next.request > job.request);
    oldHandler({ data: reply }); pendingCount(f.render(), undefined);
    current.onmessage({ data: output(next, { count: 8 }) }); assert.equal(f.render().count, 8);
  } finally { f.cleanup(); }
});

test('supports/printed toggles send no worker request; lazy same-summary replies retain the one support resource', () => {
  const f = fixture();
  try {
    const { worker, ready } = seed(f), support = ready.display.supportMesh, summary = ready.display.summary;
    const requests = worker.messages.length;
    f.args.options = { ...f.args.options, supports: false, printed: false };
    let current = f.render(); f.flush(); assert.equal(worker.messages.length, requests);
    assert.equal(current.display.supports, false); assert.equal(current.display.printed, false); assert.equal(current.count, 30);
    assert.equal(current.display.supportMesh, support); assert.equal(current.display.summary, summary);
    f.args.options = { ...f.args.options, layer: 1 }; pendingCount(f.render(), 30); f.flush();
    const job = worker.messages.at(-1), clone = output(job, { summaryKey: 1 }); assert.notEqual(clone.display.supportMesh, support);
    worker.onmessage({ data: clone }); current = f.render();
    assert.equal(current.display.layer.k, 1); assert.equal(current.display.supportMesh, support); assert.equal(current.display.summary, summary);
    const afterLayer = worker.messages.length;
    f.args.options = { ...f.args.options, supports: true, printed: true }; current = f.render(); f.flush();
    assert.equal(worker.messages.length, afterLayer, 'presentation-only controls cannot request summary/support regeneration');
    assert.equal(current.display.supportMesh, support); assert.equal(current.display.supports, true); assert.equal(current.display.printed, true);
  } finally { f.cleanup(); }
});
