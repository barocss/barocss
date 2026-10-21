import test from 'node:test';
import assert from 'node:assert/strict';
import { blobRefs, getBlob, hasBlob, putBlob } from '../src/engine/blobs';
import { emptyDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { WireSender } from '../src/engine/wireDoc';

// PERF3 B13 S0 (O130): blob eviction — what holds a blob, and what a safe rule must see. Probes: the store never lets
// a blob go today (a mesh feature deleted, its arrays still held); blobRefs misses a blob an open proposal's ops name
// (a rule over documents alone would drop what accepting the proposal needs); the worker wire's sender never sends a
// blob again once sent (evicted and put back, the worker would not get it without a forget).

const mesh = (positions: string, indices: string) => ({ kind: 'mesh', name: 'm', unit: 'mm', representation: 'facets', blob: { positions, indices } });
async function arrays(seed: number) { return { p: await putBlob(new Float64Array([seed, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1])), i: await putBlob(new Uint32Array([0, 1, 2, 0, 3, 1, 0, 2, 3, 1, 3, 2])) }; }

test('PERF3 B13 S0 P1: the store keeps every blob for the session — a mesh feature deleted, its arrays still held (nothing evicts)', async () => {
  const { p, i } = await arrays(101.5), doc = withNode(emptyDoc(), mesh(p, i) as never), gone: StudioDoc = { ...doc, nodes: [] };
  assert.equal(blobRefs(gone).size, 0); assert.ok(hasBlob(p) && hasBlob(i), 'still held');
});

test('PERF3 B13 S0 P2: blobRefs misses a blob named only in an open proposal\'s ops — a rule over documents alone would drop what accepting it needs', async () => {
  const { p, i } = await arrays(202.5);
  const doc: StudioDoc = { ...emptyDoc(), proposals: [{ id: 'P1', title: 'a mesh', status: 'open', by: { agent: 'test' }, at: '2026-10-22', base: 'x', ops: [{ tool: 'add_features', args: { features: [mesh(p, i)] } }], risk: { level: 'low', features_touched: 1, references_broken: 0, hard_requirements_changed: [], approval: [] }, summary: '' }] };
  assert.equal(blobRefs(doc).has(p), false, 'not seen by blobRefs');
  assert.ok(JSON.stringify(doc.proposals).includes(p), 'but named by the proposal');
});

test('PERF3 B13 S0 P3: the worker wire\'s sender sends a blob once — packed again after it is gone from the store and put back, it is not sent (the worker would need it: a forget is needed)', async () => {
  const { p, i } = await arrays(303.5), doc = withNode(emptyDoc(), mesh(p, i) as never), sender = new WireSender();
  assert.equal(sender.pack(doc).blobs?.length, 2, 'sent the first time');
  assert.equal(sender.pack(doc).blobs, undefined, 'not again');
  assert.ok(getBlob(p));
});
