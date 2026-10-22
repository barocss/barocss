import test from 'node:test';
import assert from 'node:assert/strict';
import { blobRefs, blobStats, evictBlobs, getBlob, hasBlob, holdSweeps, pinBlobs, putBlob } from '../src/engine/blobs';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { WireReceiver, WireSender } from '../src/engine/wireDoc';

// PERF3 B13 (O135, the S0 O130 approved): blobs no root reaches are evicted; what a root reaches, a pin holds or was
// put since the last sweep is never dropped.
const mesh = (positions: string, indices: string) => ({ kind: 'mesh', name: 'm', unit: 'mm', representation: 'facets', blob: { positions, indices } });
let seed = 1;
async function arrays() { const k = seed++ + 0.25; return { p: await putBlob(new Float64Array([k, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1])), i: await putBlob(new Uint32Array([0, 1, 2, 0, 3, 1, 0, 2, 3, 1, k * 4 >>> 0, 2])) }; }
const withMesh = (doc: StudioDoc, p: string, i: string): StudioDoc => ({ ...doc, nodes: [...doc.nodes, { ...mesh(p, i), id: `n${doc.nodes.length + 100}` } as never] });
const proposalOf = (p: string, i: string) => ({ id: `P${seed++}`, title: 'a mesh', status: 'open' as const, by: { agent: 'test' }, at: '2026-10-22', base: 'x', ops: [{ tool: 'add_features', args: { features: [mesh(p, i)] } }], risk: { level: 'low' as const, features_touched: 1, references_broken: 0, hard_requirements_changed: [], approval: [] }, summary: '' });
/** Drains the grace generation: two sweeps over these roots. */
const sweep2 = (roots: StudioDoc[]) => { evictBlobs(roots); return evictBlobs(roots)!; };

test('a blob no root reaches: kept one sweep (put since the last), dropped the next with its bytes; one reached stays', async () => {
  sweep2([]);
  const a = await arrays(), b = await arrays(), doc = withMesh(emptyDoc(), b.p, b.i);
  const first = evictBlobs([doc])!;
  assert.ok(first.graced.includes(a.p) && hasBlob(a.p), 'graced once');
  const second = evictBlobs([doc])!;
  assert.deepEqual(new Set(second.dropped), new Set([a.p, a.i]));
  assert.equal(second.bytes, 12 * 8 + 12 * 4);
  assert.equal(blobStats.lastFreed, second.bytes);
  assert.ok(hasBlob(b.p) && hasBlob(b.i) && !hasBlob(a.p));
});

test('random sessions: after every sweep, every blob the document, undo, redo or an open proposal names is still there', async () => {
  for (let run = 0; run < 4; run++) {
    let rnd = 9301 * (run + 1); const next = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
    let doc = emptyDoc(); const undo: StudioDoc[] = [], redo: StudioDoc[] = [];
    let unpinRepair: (() => void) | null = null, repairHash: string | null = null;
    const step = (d: StudioDoc) => { undo.push(doc); if (undo.length > 50) undo.shift(); redo.length = 0; doc = d; };
    for (let k = 0; k < 120; k++) {
      const r = next();
      if (r < 0.25) { const { p, i } = await arrays(); step(withMesh(doc, p, i)); }
      else if (r < 0.35 && doc.nodes.length) step({ ...doc, nodes: doc.nodes.slice(0, -1) });
      else if (r < 0.45 && undo.length) { redo.push(doc); doc = undo.pop()!; }
      else if (r < 0.5 && redo.length) { undo.push(doc); doc = redo.pop()!; }
      else if (r < 0.6) { const { p, i } = await arrays(); step({ ...doc, proposals: [...(doc.proposals ?? []), proposalOf(p, i)] }); }
      else if (r < 0.66 && doc.proposals?.some(q => q.status === 'open')) {
        // (Accepted: its mesh into the nodes, the proposal decided.)
        const q = doc.proposals.find(x => x.status === 'open')!, m = (q.ops[0].args as { features: ReturnType<typeof mesh>[] }).features[0];
        step({ ...withMesh(doc, m.blob.positions, m.blob.indices), proposals: doc.proposals.map(x => x.id === q.id ? { ...x, status: 'accepted' as const } : x) });
      } else if (r < 0.72 && !unpinRepair) { const { p } = await arrays(); repairHash = p; unpinRepair = pinBlobs([p]); }
      else if (r < 0.76 && unpinRepair) { unpinRepair(); unpinRepair = null; repairHash = null; }
      else {
        const roots = [doc, ...undo, ...redo], s = evictBlobs(roots)!;
        const reach = new Set<string>(); for (const d of roots) blobRefs(d, reach);
        for (const h of reach) assert.ok(hasBlob(h), `run ${run} step ${k}: ${h.slice(0, 8)} reachable but gone`);
        if (repairHash) assert.ok(hasBlob(repairHash), 'a pinned repair stays');
        for (const h of s.dropped) assert.ok(!reach.has(h) && h !== repairHash);
        // (Every root still has all it names: it could be evaluated.)
        for (const d of roots) for (const h of blobRefs(d)) assert.ok(getBlob(h));
      }
    }
    unpinRepair?.();
  }
  assert.deepEqual(blobStats.evictedAsked, [], 'no dropped blob was asked for');
});

test('a holder the sweep does not see keeps its hash across one sweep, is reported, and asking for it after is an error logged', async () => {
  sweep2([]);
  const held = await arrays(); // (held by nothing the roots name: a missed holder)
  const s = evictBlobs([])!;
  assert.ok(s.graced.includes(held.p), 'reported as kept by grace');
  assert.ok(getBlob(held.p), 'still there after one sweep');
  const errors: unknown[] = [], was = console.error; console.error = (...a: unknown[]) => { errors.push(a.join(' ')); };
  try {
    evictBlobs([]);
    assert.equal(getBlob(held.p), undefined);
    assert.ok(blobStats.evictedAsked.includes(held.p));
    assert.match(String(errors[0]), /was evicted and is asked for again/);
  } finally { console.error = was; }
  blobStats.evictedAsked.length = 0;
});

test('no sweep while held (a chat turn, a pending repair, the recovery store mid-write)', async () => {
  sweep2([]);
  const a = await arrays(); evictBlobs([]);
  const release = holdSweeps();
  assert.equal(evictBlobs([]), null);
  assert.ok(hasBlob(a.p));
  release();
  assert.ok(evictBlobs([])!.dropped.includes(a.p));
});

test('the worker\'s wire in step: a dropped blob is forgotten as sent, the worker told; put back, it is sent again', async () => {
  sweep2([]);
  const P = new Float64Array([7.75, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]), I = new Uint32Array([0, 1, 2, 0, 3, 1, 0, 2, 3, 1, 3, 2]);
  const p = await putBlob(P.slice()), i = await putBlob(I.slice()), doc = withMesh(emptyDoc(), p, i), sender = new WireSender(), receiver = new WireReceiver();
  receiver.unpack(sender.pack(doc));
  sweep2([]); // (the document gone: its blobs dropped)
  assert.ok(!hasBlob(p));
  const w = sender.pack(emptyDoc());
  assert.deepEqual(new Set(w.dropped), new Set([p, i]));
  receiver.unpack(w);
  // Put back (the same arrays again): sent again, not suppressed.
  assert.equal(await putBlob(P.slice()), p); await putBlob(I.slice());
  const w2 = sender.pack(withMesh(emptyDoc(), p, i));
  assert.ok(w2.blobs?.some(([h]) => h === p), 'sent again');
  assert.equal(w2.dropped, undefined);
});
