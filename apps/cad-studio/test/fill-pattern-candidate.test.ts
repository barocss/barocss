import test from 'node:test';
import assert from 'node:assert/strict';
import { part } from '@barocss/cad-model/api';
import { editFields } from '@barocss/cad-model/app/editFields';
import { prefixDoc, withNode, type ModelNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { profileOf } from '@barocss/cad-model/sketch/loops';
import { preparePatternNodeCandidate, curvePatternInputKey, insertedCurvePartProblem } from '../src/app/directCurveCandidate';
import { beginWork, createWorkOwnership, finishWork, invalidateWork, stopOwnedWork, workEditRefusal } from '../src/state/workOwnership';

function fixture() {
  const seed = part('Fill candidate').box({ w: 60, d: 40, h: 10 })
    .subtract(p => p.box({ w: 3, d: 5, h: 10, x: 7, y: 6 })).doc;
  const sketch = seed.nodes.length;
  const doc = withNode(seed, { kind: 'sketch', profile: 'polygon', points: [[4, 4], [52, 4], [52, 20], [28, 20], [28, 36], [4, 36]] });
  const parent = Object.values(seed.outputs)[0];
  const filled = withNode(doc, { kind: 'fill-feature-pattern', parent, region: { points: [[4, 4], [52, 4], [52, 20], [28, 20], [28, 36], [4, 36]] }, anchor: [8.5, 8.5], spacing: 12, count: 4, spacing2: 10, count2: 3 });
  return { doc: filled, index: filled.nodes.length - 1, sketch };
}

test('the actual feature editor draft stages its raw fill snapshot without accepting nodes, IDs or outputs', () => {
  const { doc, index } = fixture(), before = structuredClone(doc);
  const field = editFields(doc.nodes, index, doc.parameters).find(f => f.key === 'spacing2');
  assert.ok(field?.kind === 'number');
  const next = { ...doc, nodes: field.set(doc.nodes, 12) }, candidate = preparePatternNodeCandidate(doc, next, index);
  assert.ok(candidate); assert.equal(candidate.next, next);
  assert.equal(candidate.failureTitle, 'Fill cut pattern not changed');
  assert.deepEqual(candidate.input, prefixDoc(next, next.nodes.length));
  assert.deepEqual(candidate.input.nodes[index], next.nodes[index]);
  assert.equal(candidate.next.nextId, doc.nextId); assert.deepEqual(candidate.next.nodes.map(n => n.id), doc.nodes.map(n => n.id));
  assert.deepEqual(doc, before);
});

test('snapshot reselection copies the actual source sketch and later sketch edits keep the captured polygon', () => {
  const { doc, index, sketch } = fixture();
  const source = doc.nodes[sketch]; assert.ok(source.kind === 'sketch' && source.profile === 'polygon');
  const changedSource = { ...doc, nodes: doc.nodes.map((n, i) => i === sketch ? { ...source, points: [[4, 4], [52, 4], [52, 20], [16, 20], [16, 36], [4, 36]] } as ModelNode : n) };
  const field = editFields(changedSource.nodes, index, doc.parameters).find(f => f.key === 'region');
  assert.ok(field?.kind === 'choice'); assert.equal(field.label, 'Region snapshot'); assert.equal(field.get(changedSource.nodes), '');
  const draft = field.set(changedSource.nodes, String(sketch));
  const candidate = preparePatternNodeCandidate(doc, { ...changedSource, nodes: draft }, index);
  assert.ok(candidate);
  const fill = candidate.input.nodes[index]; assert.ok(fill.kind === 'fill-feature-pattern');
  assert.deepEqual(fill.region.points[3], [16, 20]);
  assert.notEqual(fill.region.points, (changedSource.nodes[sketch] as typeof source).points);
  const oldFill = doc.nodes[index]; assert.ok(oldFill.kind === 'fill-feature-pattern'); assert.deepEqual(oldFill.region.points[3], [28, 20]);
  (changedSource.nodes[sketch] as typeof source).points[3] = [12, 20];
  assert.deepEqual(fill.region.points[3], [16, 20]);
  assert.equal(curvePatternInputKey(doc), curvePatternInputKey(candidate.input), 'inline snapshots need no live direct geometry key');
  assert.equal(insertedCurvePartProblem(candidate.input), null, 'placed snapshots do not require a stripped live source');
});

test('a bad fill draft remains an unaccepted candidate and Stop, discard and Open cannot borrow accepted history', () => {
  const { doc, index } = fixture(), before = structuredClone(doc), undo = [{ doc, marker: null }], redo = [{ doc, marker: null }];
  const nodes = doc.nodes.map((n, i) => i === index ? { ...n, count: 65 } as ModelNode : n);
  const candidate = preparePatternNodeCandidate(doc, { ...doc, nodes }, index); assert.ok(candidate);
  const state = beginWork(createWorkOwnership<StudioDoc, StudioDoc>(), doc, candidate.input, true), token = state.run!.token;
  assert.equal(workEditRefusal(state, state.scope), 'pending');
  assert.equal(workEditRefusal(state, state.scope, token), null);
  assert.equal(stopOwnedWork(state, doc, candidate.input, undo.at(-1)).target, null);
  const discarded = finishWork(state, token); assert.equal(workEditRefusal(discarded, discarded.scope), null);
  const opened = invalidateWork(state); assert.equal(workEditRefusal(opened, state.scope, token), 'stale');
  const newer = beginWork(opened, doc, prefixDoc(doc, doc.nodes.length), false);
  assert.equal(finishWork(newer, token), newer, 'late completion cannot release an Open evaluation');
  assert.deepEqual(doc, before); assert.equal(undo.length, 1); assert.equal(redo.length, 1);
});

test('ordinary feature edits keep their current evaluation path', () => {
  const { doc } = fixture(), next = { ...doc, nodes: [...doc.nodes] };
  assert.equal(preparePatternNodeCandidate(doc, next, 0), null);
});

test('the same profile conversion as Finish sketch supplies an eligible concave line-loop snapshot with normal metadata', () => {
  const { doc, index, sketch } = fixture();
  const profile = profileOf([{ kind: 'polygon', closed: true, points: [[4, 4], [52, 4], [52, 20], [16, 20], [16, 36], [4, 36]], bulges: [0, 0, 0, 0, 0, 0], hv: { h: [0, 2, 4], v: [1, 3, 5] } }]);
  assert.ok(!('error' in profile)); assert.ok(profile.node.profile === 'loop');
  assert.equal(profile.node.segments.length, 6); assert.ok(profile.node.outline); assert.ok(profile.node.sideTags);
  const nodes = doc.nodes.map((n, i) => i === sketch ? { ...profile.node, id: n.id } : n);
  const field = editFields(nodes, index, doc.parameters).find(f => f.key === 'region'); assert.ok(field?.kind === 'choice');
  assert.ok(field.options.some(o => o.value === String(sketch)));
  const next = { ...doc, nodes: field.set(nodes, String(sketch)) }, candidate = preparePatternNodeCandidate(doc, next, index);
  assert.ok(candidate); const fill = candidate.input.nodes[index]; assert.ok(fill.kind === 'fill-feature-pattern');
  assert.deepEqual(fill.region.points, profile.node.segments.map(s => s.start));
  assert.deepEqual(Object.keys(fill.region), ['points']);
});
