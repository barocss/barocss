// Actual Model print worker contracts; no browser. Authored source only until the G23 execution lease.
// node --test --test-concurrency=1 packages/barocss-gpu/tests/cad-print-worker.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../../../', import.meta.url));
async function workerFixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'cad-print-worker-'));
  await build({ entryPoints: [resolve(root, 'apps/cad-studio/src/viewport/print.worker.ts')], outfile: join(dir, 'worker.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
    alias: { '@barocss/cad-model': resolve(root, 'packages/barocss-cad-model/src'), '@barocss/cad': resolve(root, 'packages/barocss-cad/src') } });
  await writeFile(join(dir, 'adapter.mjs'), `import {parentPort} from 'node:worker_threads';
globalThis.self={postMessage:v=>parentPort.postMessage(v)};
await import('./worker.mjs');
parentPort.on('message',data=>{for(const job of data.batch??[data]) self.onmessage({data:job});});
parentPort.postMessage({ready:true});`);
  const worker = new Worker(join(dir, 'adapter.mjs'));
  t.after(async () => { await worker.terminate(); await rm(dir, { recursive: true, force: true }); });
  const [ready] = await once(worker, 'message'); assert.deepEqual(ready, { ready: true });
  return { worker, async send(job) { const result = once(worker, 'message'); worker.postMessage(job); return (await result)[0]; } };
}
const mesh = () => ({
  positions: Float32Array.from([0, 0, 0, 2, 0, 0, 2, 2, 0, 0, 2, 0, 0, 0, 2, 2, 0, 2, 2, 2, 2, 0, 2, 2]),
  normals: new Float32Array(24), indices: Uint32Array.from([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]),
  faces: [], edges: [], faceOfVertex: new Float32Array(8), edgeLines: new Float32Array(), edgeOfSegment: new Float32Array(), bounds: { min: [0, 0, 0], max: [2, 2, 2] },
});
const job = (extra = {}) => ({ request: 1, sourceKey: 1, meshes: [mesh()], layer: 0, ...extra });

test('actual Model summary is reused across lazy layers; absent height/direction retain estimate/default', { timeout: 30000 }, async t => {
  const f = await workerFixture(t), a = await f.send(job()), b = await f.send(job({ request: 2, layer: 5 }));
  assert.equal(a.display.summary.version, 'print-layers-v1'); assert.equal(a.display.summary.count, 10);
  assert.equal(a.display.summary.directionSource, 'default'); assert.deepEqual(a.display.summary.layerMM, { mm: 0.2, basis: 'estimate' });
  assert.equal(a.display.summaryKey, b.display.summaryKey); assert.equal(b.display.layer.k, 5); assert.ok(Math.abs(b.display.layer.z - 1.1) < 1e-9);
  assert.ok(Math.abs(b.display.topMM - 1.2) < 1e-9); assert.ok(b.display.layer.contours.length > 0);
  assert.deepEqual(a.display.supportMesh, b.display.supportMesh);
  const c = await f.send(job({ request: 3, layer: 999 })); assert.equal(c.display.layer.k, 9); assert.equal(c.display.topMM, 2);
});

test('source/direction changes produce a new actual summary and rigid bed transform', { timeout: 30000 }, async t => {
  const f = await workerFixture(t), a = await f.send(job()), b = await f.send(job({ request: 2, sourceKey: 2, direction: [1, 0, 0], layerMM: 0.5 }));
  assert.notEqual(a.display.summaryKey, b.display.summaryKey); assert.equal(b.display.summary.count, 4);
  assert.equal(b.display.summary.directionSource, 'given'); assert.deepEqual(b.display.summary.layerMM, { mm: 0.5, basis: 'set' });
  const m = b.display.summary.modelToBed; assert.deepEqual([m[2], m[6], m[10]], [1, 0, 0]);
  assert.equal(b.display.layer.k, 0); assert.ok(Math.abs(b.display.layer.z - 0.25) < 1e-9);
});

test('superseded queued requests cannot publish an old layer; invalid inputs yield only explicit errors', { timeout: 30000 }, async t => {
  const f = await workerFixture(t), seen = []; f.worker.on('message', value => seen.push(value));
  const next = once(f.worker, 'message'); f.worker.postMessage({ batch: [job({ request: 10 }), job({ request: 11, layer: 3 })] });
  const [reply] = await next; assert.equal(reply.request, 11); assert.equal(reply.display.layer.k, 3);
  for (const bad of [{ direction: [0, 0, 0] }, { layerMM: 0 }, { layer: -1 }, { meshes: [] }]) {
    const reply = await f.send(job({ request: 12 + seen.length, ...bad })); assert.equal(typeof reply.error, 'string'); assert.equal('display' in reply, false);
  }
  assert.equal(seen.some(value => value.request === 10), false);
});
