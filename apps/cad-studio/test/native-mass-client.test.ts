import test from 'node:test';
import assert from 'node:assert/strict';
import { EngineClient } from '../src/engine/client';
import { rectanglePart } from '@barocss/cad-model/engine/doc';
import { deferMasses, evaluateDoc, evaluatePart, forgetSnapshots, massOfRef, type EvalResult } from '@barocss/cad-model/engine/evaluate';
import { MeshSender } from '@barocss/cad-model/engine/meshWire';
import { matchesNativeMassPatch, nativeMassEnvelope, nativeSIOfBody, type NativeMassSource } from '@barocss/cad-model/engine/nativeMassWire';

class WorkerDouble {
  static made: WorkerDouble[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  sent: { id: number; revision: number; nativeSource: NativeMassSource }[] = [];
  sender = new MeshSender();
  constructor() { WorkerDouble.made.push(this); }
  postMessage(data: WorkerDouble['sent'][number]): void { this.sent.push(structuredClone(data)); }
  terminate(): void { /* A held old callback may still be delivered by this test. */ }
  reply(result: EvalResult, index = this.sent.length - 1, alter?: (data: Record<string, unknown>) => void): void {
    const req = this.sent[index], slot = req.nativeSource.slot;
    const packed = this.sender.pack(slot, result), nativeMass = result.ok ? result.bodies.map(b => nativeMassEnvelope(req.nativeSource, b)) : [];
    const data = structuredClone({ id: req.id, result: packed.result, nativeMass }); alter?.(data);
    this.onmessage?.({ data });
  }
  masses(result: Extract<EvalResult, { ok: true }>, index: number): void {
    const req = this.sent[index];
    const masses = result.bodies.filter(b => b.massRef !== undefined).map(b => {
      const fields = massOfRef(b.massRef!)!;
      return { ref: b.massRef!, fields, nativeMass: nativeMassEnvelope(req.nativeSource, fields, b.massRef!) };
    });
    this.onmessage?.({ data: structuredClone({ masses }) });
  }
}
function setup() { Object.defineProperty(globalThis, 'Worker', { value: WorkerDouble, configurable: true }); const client = new EngineClient(); client.restart(); return { client, worker: WorkerDouble.made.at(-1)! }; }
const eager = (revision: number) => evaluatePart(rectanglePart(10 + revision, 20, 5), revision);
function deferred(revision: number) {
  forgetSnapshots(); deferMasses(true);
  try { const r = evaluateDoc(rectanglePart(10 + revision, 20, 5), revision); assert.ok(r.ok && r.bodies[0].massRef !== undefined); return r; }
  finally { deferMasses(false); }
}

test('client attaches eager part provenance after actual structuredClone and mesh unpack; missing or mismatched envelope stays untracked', async () => {
  const { client, worker } = setup(), doc = rectanglePart(11, 20, 5);
  const promise = client.part(doc, 1); worker.reply(eager(1)); const r = await promise; assert.ok(r.ok);
  assert.ok(nativeSIOfBody(r.bodies[0]).ok);
  for (const alter of [(d: Record<string, unknown>) => { delete d.nativeMass; }, (d: Record<string, unknown>) => { (d.nativeMass as { revision: number }[])[0].revision++; }]) {
    const asked = client.part(doc, 2); worker.reply(eager(2), worker.sent.length - 1, alter); const result = await asked; assert.ok(result.ok);
    assert.equal(nativeSIOfBody(result.bodies[0]).ok, false);
  }
});

test('client rejects old evaluation masses, accepts the exact current body, and rejects a terminated worker after restart', async () => {
  const { client, worker } = setup(), doc = rectanglePart(11, 20, 5), heard: Parameters<Parameters<EngineClient['onMasses']>[0]>[0][] = [];
  client.onMasses(m => heard.push(m));
  const old = deferred(1), p1 = client.evaluate(doc, 1); worker.reply(old, 0); const r1 = await p1; assert.ok(r1?.ok);
  const current = deferred(2), p2 = client.evaluate(doc, 2);
  worker.masses(old, 0); assert.equal(heard.length, 0, 'old fields themselves are rejected, not only their native attachment');
  worker.reply(current, 1); const r2 = await p2; assert.ok(r2?.ok);
  worker.masses(current, 1); assert.equal(heard.length, 1);
  assert.ok(matchesNativeMassPatch(r2.bodies[0], heard[0][0].fields));
  assert.equal(matchesNativeMassPatch(r1.bodies[0], heard[0][0].fields), false);
  client.restart(); worker.masses(current, 1); assert.equal(heard.length, 1);
  const replacement = WorkerDouble.made.at(-1)!, p3 = client.evaluate(doc, 3), next = deferred(3);
  replacement.reply(next, 0); const r3 = await p3; assert.ok(r3?.ok);
  worker.masses(current, 1); assert.equal(heard.length, 1);
  replacement.masses(next, 0); assert.equal(heard.length, 2);
  assert.ok(matchesNativeMassPatch(r3.bodies[0], heard[1][0].fields));
});

test('stale evaluation replies still advance mesh slots but cannot replace or acquire current provenance', async () => {
  const { client, worker } = setup(), doc = rectanglePart(11, 20, 5), result = eager(1);
  const p1 = client.evaluate(doc, 1), p2 = client.evaluate(doc, 2);
  worker.reply(result, 0); assert.equal(await p1, null);
  // Reuse the same mesh in the second reply: the receiver must have processed the first slot.
  worker.reply({ ...result, revision: 2 }, 1); const accepted = await p2; assert.ok(accepted?.ok);
  assert.ok(nativeSIOfBody(accepted.bodies[0]).ok);
});

test('client keeps public seconds through real mesh clones, refusals, lost meshes and restart cancellation', async () => {
  const { client, worker } = setup(), doc = rectanglePart(11, 20, 5), result = eager(1);
  const asked = client.part(doc, 1); worker.reply(result);
  const received = await asked;
  assert.equal(received.wallTime, result.wallTime); assert.equal('ms' in received, false);

  const invalid = rectanglePart(11, 20, 5), extrude = invalid.nodes.find(n => n.kind === 'extrude');
  assert.ok(extrude?.kind === 'extrude'); extrude.sketch = 999;
  const refusal = evaluatePart(invalid, 2); assert.equal(refusal.ok, false);
  const refused = client.part(invalid, 2); worker.reply(refusal);
  assert.deepEqual(await refused, refusal);

  // A sender that remembers an unreceived mesh produces a real missing-token refusal at the client.
  const lost = client.part(doc, 3), unreceived = eager(3);
  worker.sender.pack(worker.sent.at(-1)!.nativeSource.slot, unreceived);
  worker.reply(unreceived);
  const missing = await lost;
  assert.equal(missing.ok, false); assert.equal(missing.wallTime, 0); assert.equal('ms' in missing, false);
  if (!missing.ok) assert.equal(missing.error.title, 'Evaluation lost');

  const pending = client.part(doc, 4); client.restart();
  const cancelled = await pending;
  assert.equal(cancelled.ok, false); assert.equal(cancelled.wallTime, 0); assert.equal('ms' in cancelled, false);
  if (!cancelled.ok) assert.equal(cancelled.error.title, 'Stopped');
});
