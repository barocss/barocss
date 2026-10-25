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
import { MeshReceiver, type WireResult } from '../src/engine/meshWire';
import { evaluateDoc, placedMassFields, type BodyResult } from '../src/engine/evaluate';
import { placedDoc, type PartInstance } from '../src/engine/doc';
import { placementOf } from '../src/engine/placement';
import { receiveNativeMass, receiveNativeMassPatch, matchesNativeMassPatch, type NativeMassSource, type MassFields } from '../src/engine/nativeMassWire';
import type { WorkerRequest } from '../../../apps/cad-studio/src/engine/engine.worker';

// The unmodified production handler runs in a real Node worker with structured clone and buffer transfer.
// The adapter provides Web Worker's message surface only. This is not browser or UI evidence.
// Results and deferred patches pass the production native-source helpers before massPlace hydration.
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
  type NativeRequest = Extract<WorkerRequest, { type: 'evaluate' | 'part' | 'placed' }>;
  type RequestInput = { [K in NativeRequest['type']]: Omit<Extract<NativeRequest, { type: K }>, 'id' | 'revision' | 'nativeSource'> }[NativeRequest['type']];
  type Reply = { id: number; result: WireResult; nativeMass: unknown[] };
  type Patch = { ref: number; fields: MassFields; nativeMass: unknown };
  const startClient = async () => {
    const worker = new Worker(join(dir, 'adapter.mjs')); t.after(() => worker.terminate());
    await once(worker, 'message');
    const send = new WireSender(), receive = new MeshReceiver(); let id = 0;
    const epoch = 1, replies = new Map<number, (reply: Reply) => void>();
    const masses = new Map<number, MassFields>(), accepted: Patch[] = [];
    let currentSource: NativeMassSource | undefined;
    worker.on('message', (data: Reply | { masses: Patch[] }) => {
      if ('masses' in data) {
        for (const m of data.masses) if (currentSource && receiveNativeMassPatch(m.fields, m.ref, m.nativeMass, currentSource)) {
          masses.set(m.ref, m.fields); accepted.push(m);
        }
      } else { const done = replies.get(data.id); replies.delete(data.id); done?.(data); }
    });
    // Dispatch synchronously so the rapid control can post both requests before awaiting either reply.
    const request = (extra: RequestInput) => {
      const requestId = ++id;
      const slot = extra.type === 'part' ? `part:${extra.slot ?? 'part'}` : extra.type;
      const source = { epoch, requestId, revision: requestId, slot };
      if (extra.type === 'evaluate') { currentSource = source; masses.clear(); }
      const got = new Promise<Reply>(done => replies.set(requestId, done));
      worker.postMessage({ ...extra, id: requestId, revision: requestId, nativeSource: source } satisfies NativeRequest);
      return got.then(reply => {
        assert.equal(reply.id, requestId); assert.ok(reply.result.ok, JSON.stringify(reply.result));
        assert.equal(reply.result.revision, source.revision);
        const result = receive.unpack(slot, reply.result); assert.ok(result.ok);
        assert.equal(reply.nativeMass.length, result.bodies.length);
        const current = extra.type !== 'evaluate' || currentSource?.requestId === requestId;
        if (current) result.bodies.forEach((body, i) => assert.ok(receiveNativeMass(body, reply.nativeMass[i], source), 'current native result is accepted'));
        return { wire: reply.result, result, source, nativeMass: reply.nativeMass, current };
      });
    };
    /** Only an accepted current-source patch may hydrate a pending body, using its original placement. */
    const massed = async (bodies: readonly BodyResult[]): Promise<BodyResult[]> => {
      const ready = (body: BodyResult) => body.massRef === undefined || (masses.has(body.massRef) && matchesNativeMassPatch(body, masses.get(body.massRef)!));
      for (let k = 0; bodies.some(b => !ready(b)); k++) { assert.ok(k < 1500, 'the masses came'); await new Promise(r => setTimeout(r, 20)); }
      return bodies.map(b => b.massRef === undefined ? b : { ...b, ...placedMassFields(masses.get(b.massRef)!, b.massPlace ?? []) });
    };
    return { send, request, massed, accepted };
  };
  const { send, request, massed, accepted } = await startClient();
  const doc = table(), direct = evaluateDoc(doc, 1); assert.ok(direct.ok);
  const first = await request({ type: 'evaluate', doc: send.pack(doc) });
  assert.ok(first.wire.bodies.every(b => 'mesh' in b));
  const a = await massed(first.result.bodies);
  assert.ok(accepted.length > 0, 'the fresh evaluation delivers source-bound deferred masses');
  const second = await request({ type: 'evaluate', doc: send.pack(doc) });
  assert.ok(second.wire.bodies.every(b => 'meshRef' in b), 'unchanged production mesh cache is reused');
  const b = await massed(second.result.bodies);
  const facts = (bodies: readonly Pick<BodyResult, 'key' | 'volume' | 'centroid' | 'inertia' | 'element'>[]) => bodies.filter(x => x.element?.kind === 'weld-bead').map(x => ({ key: x.key, volume: x.volume, centroid: x.centroid, inertia: x.inertia, element: x.element }));
  assert.deepEqual(facts(a), facts(direct.bodies)); assert.deepEqual(facts(b), facts(direct.bodies));
  const bad = { ...doc, frames: { ...doc.frames!, welds: doc.frames!.welds!.map((w, i) => i ? w : { ...w, size: 2 }) } };
  const refused = await request({ type: 'part', doc: send.pack(bad) });
  assert.equal(refused.result.bodies.filter(x => x.element?.kind === 'weld-bead').length, 6);
  const fixed = await request({ type: 'part', doc: send.pack(doc) });
  assert.equal(fixed.result.bodies.filter(x => x.element?.kind === 'weld-bead').length, 8);
  const inst: PartInstance = { id: 'p1', name: 'Table', doc, rotation: [0, 0, 30], position: [7, -11, 13] }, place = placementOf(inst);
  const placedReply = await request({ type: 'placed', doc: send.pack(placedDoc(inst)), base: send.pack(doc), place });
  assert.ok(placedReply.wire.bodies.every(b => 'mesh' in b));
  const placed = { bodies: await massed(placedReply.result.bodies) };
  const again = await request({ type: 'placed', doc: send.pack(placedDoc(inst)), base: send.pack(doc), place });
  assert.deepEqual(facts(await massed(again.result.bodies)), facts(placed.bodies), 'a repeat does not transform metadata twice');
  for (const source of direct.bodies.filter(x => x.element?.kind === 'weld-bead')) {
    const out: BodyResult | undefined = placed.bodies.find(x => x.key === source.key); assert.ok(out?.element?.kind === 'weld-bead');
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
  // Reuse actual production envelopes to reject each stale source axis, without fabricating native success.
  const patch = accepted[0];
  for (const stale of [
    { ...first.source, epoch: first.source.epoch + 1 },
    { ...first.source, requestId: first.source.requestId + 1 },
    { ...first.source, revision: first.source.revision + 1 },
    { ...first.source, slot: 'part:part' },
  ]) {
    assert.equal(receiveNativeMass(first.result.bodies[0], first.nativeMass[0], stale), false);
    assert.equal(receiveNativeMassPatch(patch.fields, patch.ref, patch.nativeMass, stale), false);
  }
  // A fresh worker has independent caches. The rapid control waits only for the latest evaluation.
  const rapid = await startClient();
  const olderRequest = rapid.request({ type: 'evaluate', doc: rapid.send.pack(doc) });
  const latestRequest = rapid.request({ type: 'evaluate', doc: rapid.send.pack(doc) });
  const older = await olderRequest, latest = await latestRequest;
  assert.equal(older.current, false); assert.equal(latest.current, true);
  assert.ok(older.result.bodies.some(body => body.massRef !== undefined), 'fresh rapid evaluation is deferred');
  assert.deepEqual(facts(await rapid.massed(latest.result.bodies)), facts(direct.bodies));
  older.result.bodies.forEach((body, i) => assert.equal(receiveNativeMass(body, older.nativeMass[i], latest.source), false, 'old result cannot bind to the latest source'));
  for (const currentPatch of rapid.accepted) {
    assert.equal(receiveNativeMassPatch(currentPatch.fields, currentPatch.ref, currentPatch.nativeMass, older.source), false);
    older.result.bodies.forEach((body, i) => {
      if (body.massRef !== currentPatch.ref) return;
      const trackedOld = { ...body };
      assert.ok(receiveNativeMass(trackedOld, older.nativeMass[i], older.source));
      assert.equal(matchesNativeMassPatch(trackedOld, currentPatch.fields), false, 'a reused ref does not accept an old source');
    });
  }
});
