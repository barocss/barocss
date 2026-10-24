import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, rebuildFromScratch } from '../src/engine/evaluate';
import { featureLabel, rectanglePart, starterDoc, type PartInstance, type StudioDoc } from '../src/engine/doc';
import { featureId } from '../src/engine/ids';
import { BASE, type Mate } from '../src/assembly/mates';
import { REBUILD_LIMITS, rebuildReport, type RebuildFeature } from '../src/team/rebuild';
import { revisionOf } from '../src/util/revision';

// O10 step B: the rebuild report reads the main evaluation's profile (D228) — what was built again and what reused,
// each feature's own time and kernel calls — and the mates that cannot be met, with the document's revision.

const inst = (id: string, doc: StudioDoc, position: [number, number, number] = [0, 0, 0]): PartInstance => ({ id, name: id, doc, position, rotation: [0, 0, 0] });

test('O10: every feature built on a first evaluation; an edit to the hole builds the hole again and reuses the rest', () => {
  const doc = starterDoc(), first = evaluateDoc(doc, 7);
  const r = rebuildReport(doc, first);
  assert.ok(r, 'the main evaluation is profiled');
  assert.equal(r.revision, revisionOf(doc)); assert.equal(r.evaluation, 7); assert.equal(r.limits, REBUILD_LIMITS);
  for (const [i, n] of doc.nodes.entries()) {
    const f: RebuildFeature | undefined = r.features.find(x => x.id === featureId(doc.nodes, i));
    assert.ok(f, `node ${i} has its entry`);
    assert.deepEqual([f.node, f.label], [i, featureLabel(n, i, doc.nodes)]);
  }
  for (const f of r.features) {
    assert.ok(Number.isFinite(f.wallTime) && f.wallTime >= 0, f.id);
    assert.deepEqual(Object.keys(f.calls).sort(), ['booleans', 'finishes', 'planarBooleans', 'shells', 'sweeps', 'tessellations']);
  }
  const holeAt = doc.nodes.findIndex(n => n.kind === 'hole'), hole = featureId(doc.nodes, holeAt), body = featureId(doc.nodes, doc.nodes.findIndex(n => n.kind === 'extrude'));
  assert.ok(holeAt > 0);
  // (The same document again: nothing built, everything reused.)
  const again = rebuildReport(doc, evaluateDoc(doc, 8))!;
  assert.deepEqual([r.built, r.reused], [r.features.filter(f => f.state === 'built').length, 0]);
  assert.equal(r.features.find(f => f.node === 0)?.state, 'input', 'the sketch has no body of its own');
  assert.deepEqual([again.built, again.slowest, again.reused], [0, null, again.features.filter(f => f.state === 'reused').length]);
  assert.ok(again.reused >= 2);
  // (The hole's radius edited: the hole built again, the plate under it reused.)
  const edited: StudioDoc = { ...doc, nodes: doc.nodes.map((n, i) => i === holeAt ? { ...n, radius: 3 } as typeof n : n) };
  const e = rebuildReport(edited, evaluateDoc(edited, 9))!;
  assert.equal(e.features.find(f => f.id === hole)?.state, 'built');
  assert.equal(e.features.find(f => f.id === body)?.state, 'reused');
  assert.equal(e.built, e.features.filter(f => f.state === 'built').length);
  assert.equal(e.features.find(f => f.id === e.slowest)?.state, 'built');
  assert.notEqual(e.revision, r.revision);
  assert.equal(e.features.find(f => f.id === hole)!.calls.booleans >= 1, true, 'the hole cut is a Boolean');
});

test('O10: a failed evaluation has no rebuild report', () => {
  assert.equal(rebuildReport(starterDoc(), { ok: false, revision: 1, error: { title: 'x', detail: 'x' } as never, ms: 0 }), null);
});

test('O10: mates in a loop are listed with the parts they join; a mate that can be met is not', () => {
  const a = inst('a', rectanglePart(20, 20, 4), [0, 0, 30]), b = inst('b', rectanglePart(10, 10, 4), [0, 0, 60]), c = inst('c', rectanglePart(10, 10, 4), [50, 0, 0]);
  const mates: Mate[] = [
    { id: 'm1', kind: 'coincident', a: { part: 'a', face: 'n1.top' }, b: { part: 'b', face: 'n1.bottom' } },
    { id: 'm3', kind: 'coincident', a: { part: 'b', face: 'n1.top' }, b: { part: 'a', face: 'n1.bottom' } },
    { id: 'm4', kind: 'coincident', a: { part: BASE, face: 'n1.top' }, b: { part: 'c', face: 'n1.bottom' } },
  ];
  const doc: StudioDoc = { ...starterDoc(), instances: [a, b, c], mates };
  const r = rebuildReport(doc, evaluateDoc(doc, 1))!;
  assert.deepEqual(r.mates.map(p => p.mate).sort(), ['m1', 'm3']);
  assert.ok(r.mates.every(p => /closes a loop/.test(p.reason)));
  assert.deepEqual(r.loops, [{ parts: ['a', 'b'], mates: ['m1', 'm3'] }]);
  // (The loop broken: no problem, no loop.)
  const fixed = rebuildReport({ ...doc, mates: [mates[0], mates[2]] }, evaluateDoc(doc, 2))!;
  assert.deepEqual([fixed.mates, fixed.loops], [[], []]);
});

test('O10: from scratch — every body feature built even right after a warm evaluation, and the main cache left as it was', () => {
  const doc = starterDoc();
  evaluateDoc(doc, 1);
  const cold = rebuildReport(doc, rebuildFromScratch(doc, 2), { basis: 'from scratch' })!;
  assert.equal(cold.basis, 'from scratch');
  assert.equal(cold.reused, 0);
  assert.deepEqual(cold.features.filter(f => f.state !== 'input').map(f => f.state), cold.features.filter(f => f.state !== 'input').map(() => 'built'));
  assert.ok(cold.built >= 2 && cold.evaluationTime >= cold.builtTime - 1e-12);
  // (The main evaluation still reuses what it built: the cold build did not replace its snapshot.)
  const warm = rebuildReport(doc, evaluateDoc(doc, 3))!;
  assert.deepEqual([warm.basis, warm.built, warm.reused], ['last evaluation', 0, cold.built]);
});
