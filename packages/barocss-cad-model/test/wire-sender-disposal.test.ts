import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, withNode } from '../src/engine/doc';
import { evictBlobs, hasBlob, putBlob } from '../src/engine/blobs';
import { WireSender } from '../src/engine/wireDoc';

type DisposableSender = WireSender & { dispose(): void };
async function fixture(seed: number) {
  const positions = await putBlob(new Float64Array([seed, 0, 0, 1, 0, 0, 0, 1, 0]));
  const indices = await putBlob(new Uint32Array([0, 1, 2]));
  return { positions, indices, doc: withNode(emptyDoc(), { kind: 'mesh', name: 'Mesh', unit: 'mm', representation: 'facets', blob: { positions, indices } }) };
}

test('retiring a sender removes its real eviction callback while the live sender still receives it', async () => {
  const retired = new WireSender() as DisposableSender, live = new WireSender() as DisposableSender;
  const calls: WireSender[] = [], original = WireSender.prototype.forget;
  WireSender.prototype.forget = function (hashes) { if (this === retired || this === live) calls.push(this); original.call(this, hashes); };
  try {
    const { doc } = await fixture(731.25); retired.pack(doc); live.pack(doc);
    // The baseline has no dispose. Still exercise the actual leaked subscription rather than fail on a missing method.
    retired.dispose?.(); evictBlobs([]); evictBlobs([]);
    assert.equal(calls.filter(sender => sender === retired).length, 0);
    assert.equal(calls.filter(sender => sender === live).length, 1);
  } finally { WireSender.prototype.forget = original; retired.dispose?.(); live.dispose?.(); }
});

test('sender disposal is idempotent and terminal without clearing the shared blob store', async () => {
  const sender = new WireSender() as DisposableSender;
  const { positions, indices, doc } = await fixture(732.25); sender.pack(doc);
  sender.dispose(); sender.dispose();
  assert.equal(hasBlob(positions), true); assert.equal(hasBlob(indices), true);
  assert.throws(() => sender.pack(doc), /disposed|closed/i);
  const retained = sender as unknown as { ids: Map<unknown, unknown>; used: Map<unknown, unknown>; sentBlobs: Set<string>; dropped: string[]; unsubscribe: unknown };
  assert.equal(retained.ids.size, 0); assert.equal(retained.used.size, 0); assert.equal(retained.sentBlobs.size, 0); assert.deepEqual(retained.dropped, []); assert.equal(retained.unsubscribe, null);
});
