// Controller lifecycle with a small hook/Worker recorder. No React DOM, worker evaluation or browser run.
// node --test --test-concurrency=1 packages/barocss-gpu/tests/cad-clearance-hook.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../../../', import.meta.url)), temporary = await mkdtemp(join(tmpdir(), 'cad-clearance-hook-'));
let api;
try {
  const outfile = join(temporary, 'hook.mjs');
  await build({ stdin: { contents: 'export {useClearanceAnalysis} from "./apps/cad-studio/src/viewport/useClearanceAnalysis.ts"; export {putKnownBlob} from "./packages/barocss-cad-model/src/engine/blobs.ts";', resolveDir: root }, outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
    alias: { '@barocss/cad-model': resolve(root, 'packages/barocss-cad-model/src'), '@barocss/cad': resolve(root, 'packages/barocss-cad/src') },
    // (The studio's modules read Vite's import.meta.env; bundled here without Vite, a production stand-in.)
    define: { 'import.meta.env.DEV': 'false' },
    plugins: [{ name: 'hook-recorder', setup(builder) {
      builder.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'recorder' }));
      builder.onLoad({ filter: /.*/, namespace: 'recorder' }, () => ({ contents: 'export const useRef=(...a)=>globalThis.__g22Hooks.useRef(...a),useState=(...a)=>globalThis.__g22Hooks.useState(...a),useMemo=(...a)=>globalThis.__g22Hooks.useMemo(...a),useEffect=(...a)=>globalThis.__g22Hooks.useEffect(...a);' }));
    } }],
  });
  api = await import(pathToFileURL(outfile).href);
} finally { await rm(temporary, { recursive: true, force: true }); }

function fixture() {
  const oldWorker = globalThis.Worker, oldHooks = globalThis.__g22Hooks, slots = [], effects = [], workers = [];
  let cursor = 0;
  const same = (a, b) => !!a && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  globalThis.__g22Hooks = {
    useRef(value) { const index = cursor++; return slots[index] ??= { current: value }; },
    useState(value) { const index = cursor++; if (!(index in slots)) slots[index] = value; return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }]; },
    useMemo(make, deps) { const index = cursor++, old = slots[index]; if (!old || !same(old.deps, deps)) slots[index] = { deps, value: make() }; return slots[index].value; },
    useEffect(make, deps) { const index = cursor++, old = slots[index]; if (!old || !same(old.deps, deps)) effects.push(() => { old?.cleanup?.(); slots[index] = { deps, cleanup: make() }; }); },
  };
  globalThis.Worker = class {
    messages = []; terminated = false;
    constructor() { workers.push(this); }
    postMessage(...args) { this.messages.push(args); }
    terminate() { this.terminated = true; }
  };
  const args = { active: true, doc: { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: {}, nodes: [], outputs: {} }, near: 1, motions: [], keys: [], instances: ['part'] };
  return {
    args, workers,
    render() { cursor = 0; return api.useClearanceAnalysis(args.active, args.doc, args.near, args.motions, args.keys, args.instances); },
    flush() { for (const effect of effects.splice(0)) effect(); },
    cleanup() { for (const slot of slots) slot?.cleanup?.(); globalThis.Worker = oldWorker; globalThis.__g22Hooks = oldHooks; },
  };
}
const output = (request, extra = {}) => ({ version: 'clearance-map-v1', request, revision: 'pose-' + request, near: 1, stage: 'ready', pairs: [], overlays: [{ id: 'old-surface' }], ...extra });

test('pose/source change hides old output before effects; wrong version and old request cannot refill it', () => {
  const f = fixture();
  try {
    assert.equal(f.render(), null); f.flush(); const w = f.workers[0], first = w.messages[0][0];
    w.onmessage({ data: output(first.request) }); assert.equal(f.render().stage, 'ready');
    f.args.motions = [['part', new Float64Array(16)]];
    assert.equal(f.render(), null, 'old geometry must be excluded in the very first changed-pose render'); f.flush();
    const second = w.messages.at(-1)[0]; assert.ok(second.request > first.request);
    w.onmessage({ data: output(first.request) }); assert.equal(f.render().stage, 'evaluating');
    w.onmessage({ data: output(second.request, { version: 'other-version' }) }); assert.equal(f.render().stage, 'evaluating');
    w.onmessage({ data: output(second.request) }); assert.equal(f.render().request, second.request);
    f.args.doc = { ...f.args.doc }; assert.equal(f.render(), null); f.flush();
    assert.ok(w.messages.at(-1)[0].documentKey > first.documentKey);
  } finally { f.cleanup(); }
});

test('disable terminates the worker; re-enable cannot flash a prior display or accept old worker output', () => {
  const f = fixture();
  try {
    f.render(); f.flush(); const old = f.workers[0], first = old.messages[0][0];
    old.onmessage({ data: output(first.request) }); assert.equal(f.render().stage, 'ready');
    f.args.active = false; assert.equal(f.render(), null); f.flush(); assert.equal(old.terminated, true);
    f.args.active = true; assert.equal(f.render(), null); f.flush();
    const current = f.workers[1], job = current.messages[0][0];
    old.onmessage({ data: output(first.request) }); assert.equal(f.render().stage, 'evaluating');
    current.onmessage({ data: output(job.request) }); assert.equal(f.render().request, job.request);
  } finally { f.cleanup(); }
});

test('blob arrays copy once per document and resend to a fresh worker without detaching editor data', () => {
  const f = fixture(), positions = Float32Array.of(0, 0, 0, 1, 0, 0, 0, 1, 0), indices = Uint32Array.of(0, 1, 2);
  api.putKnownBlob('g22-positions', positions); api.putKnownBlob('g22-indices', indices);
  f.args.doc = { ...f.args.doc, nodes: [{ kind: 'mesh', blob: { positions: 'g22-positions', indices: 'g22-indices' } }] };
  try {
    f.render(); f.flush(); const w = f.workers[0], first = w.messages[0];
    assert.equal(first.length, 1, 'no transfer list may detach the main-thread store');
    assert.deepEqual(first[0].blobs, [['g22-positions', positions], ['g22-indices', indices]]);
    f.args.motions = []; f.render(); f.flush(); assert.equal(w.messages.at(-1)[0].blobs, undefined);
    f.args.active = false; f.render(); f.flush(); f.args.active = true; f.render(); f.flush();
    assert.equal(f.workers[1].messages[0][0].blobs.length, 2); assert.equal(positions.byteLength, 36); assert.equal(indices.byteLength, 12);
  } finally { f.cleanup(); }
});

test('a missing mesh array produces an explicit empty error display rather than an incomplete numeric result', () => {
  const f = fixture(); f.args.doc = { ...f.args.doc, nodes: [{ kind: 'mesh', blob: { positions: 'g22-not-loaded', indices: 'g22-not-loaded-indices' } }] };
  try { f.render(); f.flush(); const result = f.render(); assert.equal(result.stage, 'error'); assert.match(result.error, /mesh data is not loaded/); assert.deepEqual(result.overlays, []); assert.equal(f.workers[0].messages.length, 0); }
  finally { f.cleanup(); }
});

test('unloaded hidden and draft mesh arrays do not block a visible geometry request', () => {
  const f = fixture(), meshDoc = () => ({ ...f.args.doc, nodes: [{ kind: 'mesh', blob: { positions: 'not-needed-positions', indices: 'not-needed-indices' } }] });
  f.args.doc = { ...f.args.doc, instances: [{ id: 'hidden', hidden: true, doc: meshDoc() }], pendingParts: { draft: { doc: meshDoc() } }, proposals: [{ status: 'open', ops: [{ args: { kind: 'mesh', blob: { positions: 'not-needed-positions', indices: 'not-needed-indices' } } }] }] };
  try { f.render(); f.flush(); assert.equal(f.render().stage, 'evaluating'); assert.equal(f.workers[0].messages.length, 1); assert.deepEqual(f.workers[0].messages[0][0].blobs, []); }
  finally { f.cleanup(); }
});
