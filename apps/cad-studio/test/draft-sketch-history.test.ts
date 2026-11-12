import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyDoc } from '@barocss/cad-model/engine/doc';
import { xyPlane } from '@barocss/cad-model/sketch/plane';
import type { SketchShape, SketchState } from '@barocss/cad-model/sketch/types';
import { createDraftHistory, draftHistoryState, outlineHistoryState, restoreDraftHistory } from '../src/sketch/draftHistory';

const outline = (width: number): SketchShape => ({
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
