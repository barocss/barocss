import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyDoc } from '@barocss/cad-model/engine/doc';
import { xyPlane } from '@barocss/cad-model/sketch/plane';
import type { SketchShape, SketchState } from '@barocss/cad-model/sketch/types';
import { createDraftHistory, draftHistoryState, outlineHistoryState, restoreDraftHistory } from '../src/sketch/draftHistory';

const outline = (width: number): Extract<SketchShape, { kind: 'polygon' }> => ({
  kind: 'polygon', closed: true, points: [[0, 0], [width, 0], [width, 20], [0, 20]], ids: ['e1', 'e2', 'e3', 'e4'],
});
const trim = (x: number): SketchShape => ({ kind: 'polygon', closed: false, points: [[x, 0], [40, 0], [40, 20]], ids: ['e2', 'e3'] });

function cutDrafts() {
  const doc = emptyDoc(), plane = xyPlane();
  const original: SketchState = { tool: 'trim', shape: null, done: [outline(40)], plane, editNode: 0 };
  const cut: SketchState = { ...original, done: [trim(30)] };
  return { doc, original, cut };
}

test('click Trim restores the complete draft and its original ownership references', () => {
  const { doc, original, cut } = cutDrafts(), history = createDraftHistory();
  const linked: SketchState = { ...original, association: {
    kind: 'planar-face-outline-inset', version: 1, source: { node: 0, side: 'solid' }, sourceFeature: 'n0', face: 'n0.top', insetMM: 2,
  } };
  const detached = { ...cut, associationDetached: true };
  history.push(draftHistoryState(doc, linked), draftHistoryState(doc, detached));
  const before = history.undo(draftHistoryState(doc, detached));
  assert.ok(before);
  const restored = restoreDraftHistory({ ...detached, hideConstruction: true }, before);
  assert.equal(restored.done, linked.done);
  assert.equal(restored.association, linked.association);
  assert.equal(restored.associationDetached, undefined);
  assert.equal(restored.hideConstruction, true);
  const after = history.redo(draftHistoryState(doc, restored));
  assert.ok(after);
  const repeated = restoreDraftHistory(restored, after);
  assert.equal(repeated.done, cut.done);
  assert.equal(repeated.association, undefined);
  assert.equal(repeated.associationDetached, true);
});

test('draft steps refuse a new document, plane, feature editor or geometry owner', () => {
  const { doc, original, cut } = cutDrafts();
  const wrong = [
    draftHistoryState({ ...doc }, cut), draftHistoryState(doc, { ...cut, plane: xyPlane() }),
    draftHistoryState(doc, { ...cut, editNode: 1 }), draftHistoryState(doc, { ...cut, done: [...cut.done!] }),
  ];
  for (const current of wrong) {
    const history = createDraftHistory();
    history.push(draftHistoryState(doc, original), draftHistoryState(doc, cut));
    assert.deepEqual(history.available(current), { undo: false, redo: false });
    assert.equal(history.undo(current), null);
    assert.equal(history.redo(draftHistoryState(doc, original)), null);
  }
});

test('outline edits and draft edits share a stack, and a no-op preserves Redo', () => {
  const { doc, original, cut } = cutDrafts(), history = createDraftHistory();
  const first = outline(40), second = outline(44);
  const dimensioned: SketchState = { ...original, shape: second };
  history.push(outlineHistoryState(first), outlineHistoryState(second));
  history.push(draftHistoryState(doc, dimensioned), draftHistoryState(doc, cut));

  const beforeCut = history.undo(draftHistoryState(doc, cut));
  assert.ok(beforeCut);
  assert.equal(beforeCut.shape, second);
  const beforeDimension = history.undo(draftHistoryState(doc, dimensioned));
  assert.ok(beforeDimension);
  assert.equal(beforeDimension.shape, first);
  const firstState = { ...original, shape: first };
  history.push(draftHistoryState(doc, firstState), draftHistoryState(doc, { ...firstState }));
  assert.deepEqual(history.available(draftHistoryState(doc, firstState)), { undo: false, redo: true });
  const redoDimension = history.redo(draftHistoryState(doc, firstState));
  assert.ok(redoDimension);
  assert.equal(redoDimension.shape, second);
  const redoCut = history.redo(draftHistoryState(doc, dimensioned));
  assert.ok(redoCut);
  assert.equal(restoreDraftHistory(dimensioned, redoCut).done, cut.done);
});

test('the same stored straight outline keeps Trim history when Select activates it', () => {
  const doc = emptyDoc(), plane = xyPlane(), main = outline(40), guide = trim(30);
  const before: SketchState = { tool: 'trim', plane, editNode: 0, mainIds: main.ids, shape: null, done: [guide, main] };
  const after: SketchState = { ...before, done: [main] };
  const selecting: SketchState = { ...after, tool: 'select', shape: main, done: [] };
  const history = createDraftHistory();
  history.push(draftHistoryState(doc, before), draftHistoryState(doc, after));
  assert.deepEqual(history.available(draftHistoryState(doc, selecting)), { undo: true, redo: false });
  const step = history.undo(draftHistoryState(doc, selecting));
  assert.ok(step);
  const restored = restoreDraftHistory(selecting, step);
  assert.equal(restored.tool, 'select');
  assert.equal(restored.shape, main);
  assert.deepEqual(restored.done, [guide]);

  const rehomed: SketchState = { ...restored, tool: 'trim', shape: null,
    done: [guide, { ...main, pending: false }] };
  const redo = history.redo(draftHistoryState(doc, rehomed));
  assert.ok(redo);
  assert.deepEqual(restoreDraftHistory(rehomed, redo).done, [main]);
});

test('outline Undo and Redo replace only the parked main polygon while Trim is active', () => {
  const { doc, original } = cutDrafts();
  const before = outline(40), after = outline(44), guide = trim(30);
  const parked: SketchState = { ...original, mainIds: after.ids, done: [guide, { ...after, pending: false }] };
  const history = createDraftHistory();
  history.push(outlineHistoryState(before), outlineHistoryState(after));
  const undo = history.undo(draftHistoryState(doc, parked));
  assert.ok(undo);
  const restored = restoreDraftHistory(parked, undo);
  assert.equal(restored.shape, null);
  assert.deepEqual(restored.done, [guide, before]);
  assert.equal(restored.done?.[0], guide);
  const redo = history.redo(draftHistoryState(doc, restored));
  assert.ok(redo);
  assert.deepEqual(restoreDraftHistory(restored, redo).done, [guide, after]);
});

test('D1096 outline history replays on a parked region with a unique owner and exact draft identity', () => {
  const doc = emptyDoc(), history = createDraftHistory(), active = outline(10);
  const ids = ['e5', 'e6', 'e7', 'e8'];
  const before = { ...outline(24), ids }, after = { ...outline(26), ids };
  const draft: SketchState = { tool: 'select', editNode: 0, shape: active, plane: xyPlane(), done: [after] };
  history.push(outlineHistoryState(before), outlineHistoryState(after));
  for (const done of [[{ ...after }], [after, { ...after }]]) {
    assert.equal(history.available(draftHistoryState(doc, { ...draft, done })).undo, false);
  }
  const undo = history.undo(draftHistoryState(doc, draft));
  assert.ok(undo);
  const restored = restoreDraftHistory(draft, undo);
  assert.equal(restored.shape, active);
  assert.equal(restored.done?.[0], before);
  const redo = history.redo(draftHistoryState(doc, restored));
  assert.ok(redo);
  assert.equal(restoreDraftHistory(restored, redo).done?.[0], after);
});

test('Trim replay refuses changed points, bulges, constraints, IDs or nonmain shape order', () => {
  const doc = emptyDoc(), plane = xyPlane(), main = { ...outline(40), bulges: [0, 0.25, 0, 0] }, first = trim(20), second = trim(30);
  assert.equal(main.kind, 'polygon');
  const before: SketchState = { tool: 'trim', plane, editNode: 0, mainIds: main.ids, shape: null, done: [main, first, second, trim(10)] };
  const after: SketchState = { ...before, done: [main, first, second] };
  const selecting: SketchState = { ...after, tool: 'select', shape: main, done: [first, second] };
  const replacements: SketchState[] = [
    { ...selecting, shape: { ...main, points: main.points.map(point => [...point]) } },
    { ...selecting, shape: { ...main, bulges: [0, 0.5, 0, 0] } },
    { ...selecting, shape: { ...main, lengths: { 0: 40 } } },
    { ...selecting, shape: { ...main, ids: ['e0', ...main.ids!.slice(1)] } },
    { ...selecting, done: [second, first] },
    { ...selecting, tool: 'rectangle' },
  ];
  for (const replacement of replacements) {
    const history = createDraftHistory();
    history.push(draftHistoryState(doc, before), draftHistoryState(doc, after));
    assert.deepEqual(history.available(draftHistoryState(doc, replacement)), { undo: false, redo: false });
  }
});

test('outline replay retains current edge picks only while the side identities and kinds match', () => {
  const before = outline(40), after = outline(42);
  const draft: SketchState = { tool: 'select', shape: after, plane: xyPlane(), picked: [{ kind: 'edge', i: 2 }, { kind: 'edge', i: 4 }] };
  assert.deepEqual(restoreDraftHistory(draft, outlineHistoryState(before)).picked, [{ kind: 'edge', i: 2 }]);
  for (const target of [
    { ...before, ids: undefined },
    { ...before, ids: ['e1', 'e2', 'e4', 'e3'] },
    { ...before, bulges: [0, 0, 0.2, 0] },
  ]) {
    assert.deepEqual(restoreDraftHistory(draft, outlineHistoryState(target)).picked, []);
  }
});
