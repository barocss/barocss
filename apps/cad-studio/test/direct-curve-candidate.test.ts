import test from 'node:test';
import assert from 'node:assert/strict';
import { part, Location } from '@barocss/cad-model/api';
import { curvesSource } from '@barocss/cad-model/engine/curveSource';
import { directOps, importSource } from '@barocss/cad-model/engine/direct';
import { prefixDoc } from '@barocss/cad-model/engine/doc';
import { eligibleCurvePatternPaths } from '@barocss/cad-model/engine/curveFeaturePattern';
import { curvePatternInputKey, directCommandDocument, insertedCurvePartProblem, prepareDirectCurveCandidate } from '../src/app/directCurveCandidate';

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

test('a new direct path reaches command choices without changing the displayed model input', () => {
  const { doc, id } = fixture(), shown = { ...doc, nodes: doc.nodes.slice(0, -1) };
  const before = { ...shown, direct: undefined }, evaluated = prefixDoc(before, before.nodes.length);
  const commandDoc = directCommandDocument(evaluated, shown);
  assert.deepEqual(eligibleCurvePatternPaths(evaluated), []);
  assert.deepEqual(eligibleCurvePatternPaths(commandDoc), [{ value: id, label: shown.direct!.objects[0].name }]);
  assert.equal(commandDoc.direct, shown.direct); assert.equal(commandDoc.nodes, evaluated.nodes); assert.equal(commandDoc.outputs, evaluated.outputs);
  assert.equal(curvePatternInputKey(before), curvePatternInputKey(shown));
  assert.equal(directCommandDocument(commandDoc, shown), commandDoc, 'unchanged direct sources keep the command document identity');
});

test('consumed geometry invalidates the displayed input while direct display and unrelated edits retain it', () => {
  const { doc, id } = fixture(), before = curvePatternInputKey(doc);
  const candidate = prepareDirectCurveCandidate(doc, directOps.move(doc.direct!, [id], [1, 2, 0]));
  assert.ok(candidate); assert.notEqual(curvePatternInputKey(candidate.next), before);
  assert.equal(curvePatternInputKey(candidate.next), curvePatternInputKey(candidate.input), 'the accepted input and its candidate use the same geometry key');
  const unchanged = [
    directOps.rename(doc.direct!, id, 'Renamed'),
    { ...doc.direct!, objects: doc.direct!.objects.map(object => ({ ...object, hidden: true })) },
    importSource(doc.direct!, curvesSource('unused', [{ degree: 1, knots: [0, 0, 1, 1], points: [[0, 0, 0], [4, 0, 0]], weights: [1, 1] }]), 'Unused'),
  ];
  for (const direct of unchanged) assert.equal(curvePatternInputKey({ ...doc, direct }), before);
  const renamed = { ...doc, direct: unchanged[0] };
  assert.equal(eligibleCurvePatternPaths(directCommandDocument(doc, renamed))[0].label, 'Renamed');
});

test('consumers outside the displayed history and suppressed consumers do not invalidate its input', () => {
  const { doc, id } = fixture(), moved = { ...doc, direct: directOps.move(doc.direct!, [id], [1, 2, 0]) };
  const marker = doc.nodes.length - 1;
  assert.equal(curvePatternInputKey(doc, marker), curvePatternInputKey(moved, marker));
  const nodes = doc.nodes.map(node => node.kind === 'curve-feature-pattern' ? { ...node, suppressed: true as const } : node);
  assert.equal(curvePatternInputKey({ ...doc, nodes }), curvePatternInputKey({ ...moved, nodes }));
  assert.throws(() => curvePatternInputKey({ ...doc, direct: { ...doc.direct!, objects: [] } }), /missing/);
});
