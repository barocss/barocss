import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import type { BeadSharedSeam } from '@barocss/cad';
import { table } from './helpers/shared-bead-scene';
import { WireSender } from '../src/engine/wireDoc';
import { MeshReceiver, type WireBody, type WireResult } from '../src/engine/meshWire';
import { evaluateDoc, placedMassFields, type BodyResult } from '../src/engine/evaluate';
import { placedDoc, type PartInstance } from '../src/engine/doc';
import { placementOf } from '../src/engine/placement';

// The unmodified production handler runs in a real Node worker with structured clone and buffer transfer.
// This adapter provides Web Worker's message surface only; it is not browser or UI evidence. (O18: the part's and the
// placed parts' replies come without their masses, which the worker posts after by mass ref; the test applies them as
// the studio does — placedMassFields by each body's massPlace — before it compares.)
test('production worker preserves owned metadata through wire, new meshes, meshRef, edits and placed requests', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'shared-bead-worker-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const { build } = createRequire(resolve(import.meta.dirname, '../../../package.json'))('esbuild') as typeof import('esbuild');
  const entry = resolve(import.meta.dirname, '../../../apps/cad-studio/src/engine/engine.worker.ts');
  await build({ entryPoints: [entry], outfile: join(dir, 'production.mjs'), bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'warning' });
  await writeFile(join(dir, 'adapter.mjs'), `import {parentPort} from 'node:worker_threads';
globalThis.self={postMessage:(v,transfer)=>parentPort.postMessage(v,transfer)};
await import('./production.mjs');
parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true});`);
  const worker = new Worker(join(dir, 'adapter.mjs')); t.after(() => worker.terminate());
  await once(worker, 'message');
  const send = new WireSender(), receive = new MeshReceiver(); let id = 0;
  type Fields = Pick<BodyResult, 'volume' | 'mass' | 'centroid' | 'inertia' | 'volumeBasis'>;
  const masses = new Map<number, Fields>(), replies: ((data: { id: number; result: WireResult }) => void)[] = [];
  worker.on('message', (data: { masses?: { ref: number; fields: Fields }[]; id: number; result: WireResult }) => {
    if (data.masses) for (const m of data.masses) masses.set(m.ref, m.fields); else replies.shift()?.(data);
  });
  const request = async (extra: Record<string, unknown>) => {
    const got = new Promise<{ id: number; result: WireResult }>(done => replies.push(done)); worker.postMessage({ id: ++id, revision: id, ...extra });
    const reply = await got;
    assert.equal(reply.id, id); assert.ok(reply.result.ok, JSON.stringify(reply.result));
    return reply.result;
  };
  /** The bodies with the masses the worker posted for them (waited for), placed by their massPlace. */
  const massed = async <B extends { massRef?: number; massPlace?: { m: number[]; t: number[] }[] }>(bodies: readonly B[]): Promise<B[]> => {
    for (let k = 0; bodies.some(b => b.massRef !== undefined && !masses.has(b.massRef)); k++) { assert.ok(k < 1500, 'the masses came'); await new Promise(r => setTimeout(r, 20)); }
    return bodies.map(b => b.massRef === undefined ? b : { ...b, ...placedMassFields(masses.get(b.massRef)!, b.massPlace ?? []) });
  };
  const doc = table(), direct = evaluateDoc(doc, 1); assert.ok(direct.ok);
  const first = await request({ type: 'evaluate', doc: send.pack(doc) });
  assert.ok(first.bodies.every(b => 'mesh' in b));
  const a = receive.unpack('evaluate', first); assert.ok(a.ok);
  const second = await request({ type: 'evaluate', doc: send.pack(doc) });
  assert.ok(second.bodies.every(b => 'meshRef' in b), 'unchanged production mesh cache is reused');
  const b = receive.unpack('evaluate', second); assert.ok(b.ok);
  const facts = (bodies: readonly Pick<BodyResult, 'key' | 'volume' | 'centroid' | 'inertia' | 'element'>[]) => bodies.filter(x => x.element?.kind === 'weld-bead').map(x => ({ key: x.key, volume: x.volume, centroid: x.centroid, inertia: x.inertia, element: x.element }));
  assert.deepEqual(facts(await massed(a.bodies)), facts(direct.bodies)); assert.deepEqual(facts(await massed(b.bodies)), facts(direct.bodies));
  const bad = { ...doc, frames: { ...doc.frames!, welds: doc.frames!.welds!.map((w, i) => i ? w : { ...w, size: 2 }) } };
  const refused = await request({ type: 'part', doc: send.pack(bad) });
  assert.equal(refused.bodies.filter(x => x.element?.kind === 'weld-bead').length, 6);
  const fixed = await request({ type: 'part', doc: send.pack(doc) });
  assert.equal(fixed.bodies.filter(x => x.element?.kind === 'weld-bead').length, 8);
  const inst: PartInstance = { id: 'p1', name: 'Table', doc, rotation: [0, 0, 30], position: [7, -11, 13] }, place = placementOf(inst);
  const placedReply = await request({ type: 'placed', doc: send.pack(placedDoc(inst)), base: send.pack(doc), place });
  assert.ok(placedReply.bodies.every(b => 'mesh' in b));
  const placed = { bodies: await massed(placedReply.bodies) };
  const again = await request({ type: 'placed', doc: send.pack(placedDoc(inst)), base: send.pack(doc), place });
  assert.deepEqual(facts(await massed(again.bodies)), facts(placed.bodies), 'a repeat does not transform metadata twice');
  for (const source of direct.bodies.filter(x => x.element?.kind === 'weld-bead')) {
    const out: WireBody | undefined = placed.bodies.find(x => x.key === source.key); assert.ok(out?.element?.kind === 'weld-bead');
    assert.equal(out.volume, source.volume); assert.equal(out.mass, source.mass);
    const move = (p: readonly number[]) => [0, 1, 2].map(i => place.t[i] + p.reduce((s, v, k) => s + place.m[i * 3 + k] * v, 0));
    const near = (a: readonly number[], z: readonly number[]) => a.forEach((v, i) => assert.ok(Math.abs(v - z[i]) < 1e-8, `${v} vs ${z[i]}`));
    near(out.centroid!, move(source.centroid!));
    assert.ok(source.element?.kind === 'weld-bead');
    const before: BeadSharedSeam = source.element.report.sharedSeams[0];
    const after: BeadSharedSeam = out.element.report.sharedSeams[0];
    assert.equal(out.element.report.nominalVolume, source.element.report.nominalVolume);
    assert.equal(after.id, before.id); assert.deepEqual(after.joints, before.joints); assert.deepEqual(after.ownedInterval, before.ownedInterval);
    after.path.forEach((p, i) => near(p, move(before.path[i])));
    const tensor = source.inertia!.map((_, i) => source.inertia!.map((__, j) => source.inertia!.reduce((sum, row, k) => sum + row.reduce((s, v, l) => s + place.m[3 * i + k] * v * place.m[3 * j + l], 0), 0)));
    out.inertia!.forEach((row, i) => near(row, tensor[i]));
  }
});
