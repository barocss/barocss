import test from 'node:test';
import assert from 'node:assert/strict';
import { part, Location } from '@barocss/cad-model/api';
import { curvesSource } from '@barocss/cad-model/engine/curveSource';
import { directOps, importSource } from '@barocss/cad-model/engine/direct';
import { insertedCurvePartProblem, prepareDirectCurveCandidate } from '../src/app/directCurveCandidate';

function fixture() {
  const seed = part('Path candidate').box({ w: 60, d: 40, h: 10 })
    .subtract(p => p.box({ w: 4, d: 2, h: 10, x: 0, y: 8 }).moved(Location.at([8, 0, 0])));
  const doc = seed.doc;
  doc.direct = importSource({ sources: {}, objects: [] }, curvesSource('path', [{ degree: 1, knots: [0, 0, 1, 2, 2], points: [[0, 0, 0], [16, 0, 0], [16, 16, 0]], weights: [1, 1, 1] }]), 'Path');
  const id = doc.direct.objects[0].id;
  return { doc: part('Live path', doc).curveFeaturePattern({ path: { objectId: id }, spacing: 8, count: 5 }).doc, id };
}

test('a consumed baked path change is staged while accepted document and stable IDs remain intact', () => {
  const { doc, id } = fixture(), before = structuredClone(doc);
  const direct = directOps.move(doc.direct!, [id], [1, 2, 0]);
  const candidate = prepareDirectCurveCandidate(doc, direct);
  assert.ok(candidate); assert.equal(candidate.next.direct, direct); assert.deepEqual(candidate.input.direct, direct);
  assert.deepEqual(candidate.next.nodes, doc.nodes); assert.equal(candidate.next.nextId, doc.nextId);
  assert.equal(candidate.next.direct.objects[0].id, id); assert.deepEqual(doc, before);
});

test('unreferenced sources and display edits retain the direct fast path', () => {
  const { doc, id } = fixture();
  assert.equal(prepareDirectCurveCandidate(doc, directOps.rename(doc.direct!, id, 'Renamed')), null);
  const extra = { ...doc.direct!, sources: { ...doc.direct!.sources, unused: 'unused source' } };
  assert.equal(prepareDirectCurveCandidate(doc, extra), null);
  const hidden = { ...doc.direct!, objects: doc.direct!.objects.map(o => ({ ...o, hidden: true })) };
  assert.equal(prepareDirectCurveCandidate(doc, hidden), null);
});

test('missing and short consumed paths refuse before accepted input or IDs change', () => {
  const { doc } = fixture(), before = structuredClone(doc);
  assert.throws(() => prepareDirectCurveCandidate(doc, { ...doc.direct!, objects: [] }), /missing/);
  const direct = structuredClone(doc.direct!);
  direct.sources[direct.objects[0].source] = curvesSource('short', [{ degree: 1, knots: [0, 0, 1, 1], points: [[0, 0, 0], [8, 0, 0]], weights: [1, 1] }]);
  assert.throws(() => prepareDirectCurveCandidate(doc, direct), /exceeds/);
  assert.deepEqual(doc, before);
});

test('part insertion refuses live paths before the caller strips direct sources', () => {
  const { doc } = fixture(), before = structuredClone(doc);
  assert.match(insertedCurvePartProblem(doc)!, /base document/);
  const inline = structuredClone(doc), node = inline.nodes.at(-1)!;
  assert.ok(node.kind === 'curve-feature-pattern');
  node.path = { degree: 1, knots: [0, 0, 1, 2, 2], controlPoints: [[0, 0, 0], [16, 0, 0], [16, 16, 0]], weights: [1, 1, 1] };
  assert.equal(insertedCurvePartProblem(inline), null); assert.deepEqual(doc, before);
});
