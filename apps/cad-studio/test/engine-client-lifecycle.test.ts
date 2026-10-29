import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_REPAIR } from '@barocss/cad';
import { emptyDoc, rectanglePart, withNode } from '@barocss/cad-model/engine/doc';
import { evictBlobs, putBlob } from '@barocss/cad-model/engine/blobs';
import { WireSender } from '@barocss/cad-model/engine/wireDoc';
import { EngineClient } from '../src/engine/client';

type LifecycleClient = EngineClient & { dispose(): void; onFailure(listen: (error: { title: string }) => void): () => void };
class WorkerDouble {
  static made: WorkerDouble[] = [];
  static failConstructor = false;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: { message: string; preventDefault(): void }) => unknown) | null = null;
  onmessageerror: ((event: object) => unknown) | null = null;
  sent: Record<string, unknown>[] = [];
  terminated = 0;
  failPost = false;
  constructor() { if (WorkerDouble.failConstructor) throw new Error('Worker construction failed'); WorkerDouble.made.push(this); }
  postMessage(message: Record<string, unknown>) { if (this.failPost) throw new Error('Worker post failed'); this.sent.push(structuredClone(message)); }
  terminate() { this.terminated++; }
  reply(data: unknown) { this.onmessage?.({ data }); }
}
async function within<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('The request did not settle')), 300); })]); }
  finally { clearTimeout(timer); }
}
async function useClient(run: (client: LifecycleClient) => Promise<void> | void) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  WorkerDouble.made = []; WorkerDouble.failConstructor = false;
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: WorkerDouble });
  let client: LifecycleClient | undefined;
  try { client = new EngineClient() as LifecycleClient; await run(client); }
  finally {
    client?.dispose?.(); WorkerDouble.failConstructor = false;
    if (descriptor) Object.defineProperty(globalThis, 'Worker', descriptor); else Reflect.deleteProperty(globalThis, 'Worker');
  }
}
const doc = () => rectanglePart(1, 2, 3);
const positions = [0, 0, 0, 1, 0, 0, 0, 1, 0], indices = [0, 1, 2];

test('an unused client allocates neither a Worker nor an eviction subscription', async () => {
  const original = WireSender.prototype.forget; let calls = 0;
  WireSender.prototype.forget = function (hashes) { calls++; original.call(this, hashes); };
  try { await putBlob(new Float64Array([751.25, 2, 3])); await useClient(() => { assert.equal(WorkerDouble.made.length, 0); evictBlobs([]); evictBlobs([]); assert.equal(calls, 0); }); }
  finally { WireSender.prototype.forget = original; }
});

test('restart releases the old sender subscription and retains only the current sender', async () => {
  const originalPack = WireSender.prototype.pack, originalForget = WireSender.prototype.forget;
  const senders = new Set<WireSender>(), called = new Set<WireSender>();
  WireSender.prototype.pack = function (input) { senders.add(this); return originalPack.call(this, input); };
  WireSender.prototype.forget = function (hashes) { if (senders.has(this)) called.add(this); originalForget.call(this, hashes); };
  try {
    await useClient(async client => {
      const p = await putBlob(new Float64Array([743.25, 0, 0, 1, 0, 0, 0, 1, 0])), i = await putBlob(new Uint32Array(indices));
      const input = withNode(emptyDoc(), { kind: 'mesh', name: 'Mesh', unit: 'mm', representation: 'facets', blob: { positions: p, indices: i } });
      const first = client.part(input, 1); const old = WorkerDouble.made.at(-1)!;
      client.restart(); const result = await within(first); assert.equal(result.ok, false);
      const second = client.part(input, 2); evictBlobs([]); evictBlobs([]);
      assert.equal(old.terminated, 1); assert.equal(senders.size, 2); assert.equal(called.size, 1);
      client.restart(); assert.equal((await within(second)).ok, false);
    });
  } finally { WireSender.prototype.pack = originalPack; WireSender.prototype.forget = originalForget; }
});

test('final disposal settles all request families and does not revive the client', async () => {
  await useClient(async client => {
    const input = doc(); let progress = 0;
    const requests = [client.evaluate(input, 1), client.preview(input, 2), client.section(input, 3), client.mould(input, 4, false), client.part(input, 5),
      client.proposalDiff(input, input, 6, { revision: 'r', proposal: 'p' }), client.volumes(input), client.placed(input, input, { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] }, 7),
      client.stepMeshes('STEP'), client.diagnose(positions, indices), client.repair(positions, indices, DEFAULT_REPAIR, () => { progress++; }), client.step(input, 'Part'), client.drawing(input), client.stl(input, 'b0')];
    const worker = WorkerDouble.made.at(-1)!, late = worker.onmessage!, repair = worker.sent.find(message => message.type === 'repair')!;
    client.dispose(); client.dispose(); await within(Promise.all(requests));
    late({ data: { id: repair.id, progress: 'fill' } }); assert.equal(progress, 0); assert.equal(worker.terminated, 1);
    const before = WorkerDouble.made.length; client.restart(); const refused = await within(client.part(input, 8));
    assert.equal(refused.ok, false); assert.equal(WorkerDouble.made.length, before);
  });
});

for (const event of ['error', 'messageerror'] as const) {
  test(`worker ${event} retires the transport without an automatic replacement`, async () => {
    await useClient(async client => {
      const pending = client.part(doc(), 1), worker = WorkerDouble.made.at(-1)!, before = WorkerDouble.made.length;
      if (event === 'error') worker.onerror?.({ message: 'Worker failed', preventDefault() {} }); else worker.onmessageerror?.({});
      assert.equal((await within(pending)).ok, false); assert.equal(worker.terminated, 1);
      assert.equal((await within(client.part(doc(), 2))).ok, false); assert.equal(WorkerDouble.made.length, before);
      client.restart(); const next = client.diagnose(positions, indices), replacement = WorkerDouble.made.at(-1)!;
      replacement.reply({ id: replacement.sent.at(-1)!.id, diagnosis: { closed: true } });
      assert.deepEqual(await within(next), { closed: true });
    });
  });
}

test('post failure is terminal and the next request cannot use a partially advanced sender', async () => {
  await useClient(async client => {
    const started = client.diagnose(positions, indices), worker = WorkerDouble.made.at(-1)!;
    worker.reply({ id: worker.sent.at(-1)!.id, diagnosis: { closed: true } }); await started;
    worker.failPost = true;
    assert.equal((await within(client.part(doc(), 1))).ok, false);
    assert.equal((await within(client.part(doc(), 2))).ok, false); assert.equal(WorkerDouble.made.length, 1); assert.equal(worker.terminated, 1);
  });
});

test('pack failure settles earlier requests and requires an explicit restart', async () => {
  await useClient(async client => {
    const first = client.diagnose(positions, indices), original = WireSender.prototype.pack;
    WireSender.prototype.pack = () => { throw new Error('Pack failed'); };
    try {
      assert.equal((await within(client.part(doc(), 1))).ok, false);
      assert.deepEqual(await within(first), { error: 'stopped' });
      assert.equal((await within(client.part(doc(), 2))).ok, false); assert.equal(WorkerDouble.made.length, 1);
    } finally { WireSender.prototype.pack = original; }
  });
});

test('Worker constructor failure settles the first request and remains failed until explicit restart', async () => {
  await useClient(async client => {
    WorkerDouble.failConstructor = true;
    assert.equal((await within(client.part(doc(), 1))).ok, false); assert.equal(WorkerDouble.made.length, 0);
    WorkerDouble.failConstructor = false;
    assert.equal((await within(client.part(doc(), 2))).ok, false); assert.equal(WorkerDouble.made.length, 0);
    client.restart(); const pending = client.diagnose(positions, indices), worker = WorkerDouble.made.at(-1)!;
    worker.reply({ id: worker.sent.at(-1)!.id, diagnosis: { closed: true } }); assert.deepEqual(await within(pending), { closed: true });
  });
});

test('a current diagnosis still reaches its caller', async () => {
  await useClient(async client => {
    const pending = client.diagnose(positions, indices), worker = WorkerDouble.made.at(-1)!;
    worker.reply({ id: worker.sent.at(-1)!.id, diagnosis: { closed: true } });
    assert.deepEqual(await within(pending), { closed: true });
  });
});

test('explicit restart preserves the existing repair Stop envelope', async () => {
  await useClient(async client => {
    let stages = 0;
    const pending = client.repair(positions, indices, DEFAULT_REPAIR, () => { stages++; }), worker = WorkerDouble.made.at(-1)!;
    worker.reply({ id: worker.sent.at(-1)!.id, progress: 'weld' }); assert.equal(stages, 1);
    client.restart(); assert.deepEqual(await within(pending), { error: 'stopped' });
  });
});


function retained(client: EngineClient) {
  return client as unknown as {
    pending: Map<number, unknown>; progress: Map<number, unknown>; slots: Map<number, unknown>; nativeSources: Map<number, unknown>;
    massSource: unknown; wire: WireSender | null; worker: unknown; massListeners: Set<unknown>; failureListeners: Set<unknown>;
  };
}
function emptyRequests(client: EngineClient) {
  const state = retained(client);
  for (const table of [state.pending, state.progress, state.slots, state.nativeSources]) assert.equal(table.size, 0);
}

test('failure listeners receive one terminal event and can reenter without retained requests', async () => {
  await useClient(async client => {
    let heard = 0, refused: ReturnType<EngineClient['diagnose']> | undefined;
    const unsubscribe = client.onFailure(() => { heard++; emptyRequests(client); refused = client.diagnose(positions, indices); });
    client.onMasses(() => {});
    const pending = client.diagnose(positions, indices), worker = WorkerDouble.made.at(-1)!, oldFailure = worker.onerror!;
    oldFailure({ message: 'Worker failed', preventDefault() {} });
    assert.deepEqual(await within(pending), { error: 'stopped' }); assert.deepEqual(await within(refused!), { error: 'stopped' });
    assert.equal(heard, 1); emptyRequests(client);
    assert.equal(retained(client).wire, null); assert.equal(retained(client).worker, null); assert.equal(retained(client).massSource, null);
    await client.diagnose(positions, indices); assert.equal(heard, 1);
    assert.equal(client.restart(), true); assert.equal(retained(client).massListeners.size, 1);
    oldFailure({ message: 'Old failure', preventDefault() {} }); assert.equal(heard, 1);
    unsubscribe(); WorkerDouble.made.at(-1)!.onerror?.({ message: 'New failure', preventDefault() {} }); assert.equal(heard, 1);
    client.dispose(); client.onFailure(() => {}); client.onMasses(() => {});
    assert.equal(retained(client).failureListeners.size, 0); assert.equal(retained(client).massListeners.size, 0); emptyRequests(client);
  });
});

test('a failed explicit restart reports failure and cannot report success until acquisition works', async () => {
  await useClient(async client => {
    let heard = 0; client.onFailure(() => { heard++; });
    const first = client.diagnose(positions, indices), worker = WorkerDouble.made.at(-1)!;
    worker.reply({ id: worker.sent.at(-1)!.id, diagnosis: { closed: true } }); await first;
    WorkerDouble.failConstructor = true;
    assert.equal(client.restart(), false); assert.equal(heard, 1); assert.equal(worker.terminated, 1); emptyRequests(client);
    assert.deepEqual(await within(client.diagnose(positions, indices)), { error: 'stopped' }); assert.equal(heard, 1);
    WorkerDouble.failConstructor = false; assert.equal(client.restart(), true);
  });
});

test('a completed request releases its resolver, progress and source bookkeeping', async () => {
  await useClient(async client => {
    const pending = client.repair(positions, indices, DEFAULT_REPAIR, () => {}), worker = WorkerDouble.made.at(-1)!;
    worker.reply({ id: worker.sent.at(-1)!.id, error: 'bad mesh' });
    assert.deepEqual(await pending, { error: 'bad mesh' }); emptyRequests(client);
  });
});


for (const failure of ['handler', 'terminate'] as const) {
  test(`a synthetic ${failure} teardown failure releases requests and blocks an automatic replacement`, async () => {
    await useClient(async client => {
      let heard = 0; client.onFailure(() => { heard++; });
      const pending = client.part(doc(), 1), worker = WorkerDouble.made.at(-1)!, late = worker.onmessage!;
      if (failure === 'handler') Object.defineProperty(worker, 'onmessage', { configurable: true, get: () => late, set() { throw new Error('Handler cleanup failed'); } });
      else worker.terminate = () => { worker.terminated++; throw new Error('Termination failed'); };
      assert.equal(client.restart(), false);
      assert.equal((await within(pending)).ok, false); assert.equal(heard, 1); assert.equal(worker.terminated, 1); assert.equal(WorkerDouble.made.length, 1);
      emptyRequests(client); assert.equal(retained(client).wire, null); assert.equal(retained(client).worker, null);
      assert.deepEqual(await within(client.diagnose(positions, indices)), { error: 'stopped' });
    });
  });
}

test('final disposal still releases its tables when synthetic termination throws', async () => {
  await useClient(async client => {
    const pending = client.part(doc(), 1), worker = WorkerDouble.made.at(-1)!;
    client.onMasses(() => {}); client.onFailure(() => {});
    worker.terminate = () => { worker.terminated++; throw new Error('Termination failed'); };
    assert.doesNotThrow(() => client.dispose()); assert.equal((await within(pending)).ok, false); emptyRequests(client);
    assert.equal(retained(client).wire, null); assert.equal(retained(client).worker, null); assert.equal(retained(client).massListeners.size, 0); assert.equal(retained(client).failureListeners.size, 0);
    assert.equal(client.restart(), false); assert.equal(WorkerDouble.made.length, 1);
  });
});
