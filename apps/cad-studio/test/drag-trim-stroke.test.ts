import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyDoc } from '@barocss/cad-model/engine/doc';
import { xyPlane } from '@barocss/cad-model/sketch/plane';
import type { P2 } from '@barocss/cad-model/sketch/profile';
import type { SketchShape, SketchState } from '@barocss/cad-model/sketch/types';
import { DragTrimStroke, type DragTrimOwner } from '../src/viewport/dragTrimStroke';

const line = (a: P2, b: P2, ids: string[]): SketchShape => ({
  kind: 'polygon', points: [a, b], closed: false, ids, construction: true,
});
const owner = (): DragTrimOwner => {
  const sketch: SketchState = { tool: 'trim', shape: null, plane: xyPlane(),
    done: [line([0, -5], [0, 15], ['e1', 'e2']), line([-3, 0], [3, 0], ['e3', 'e4']), line([-3, 10], [3, 10], ['e5', 'e6'])] };
  return { doc: emptyDoc(), sketch, scope: {} };
};
const start = (stroke: DragTrimStroke, source: DragTrimOwner, pointer = 1) =>
  stroke.begin(source, pointer, 'frame', [0, 0], [-2, 5]);
const move = (stroke: DragTrimStroke, source: DragTrimOwner, pointer = 1) =>
  stroke.advance(pointer, source, 'frame', [100, 0], [2, 5]);
const release = (stroke: DragTrimStroke, source: DragTrimOwner, pointer = 1) =>
  stroke.release(pointer, source, 'frame', [100, 0], [2, 5]);

test('document ownership or an observed frame change retires the stroke permanently', () => {
  const source = owner();
  for (const current of [{ ...source, doc: { ...source.doc } }, { ...source, scope: {} }, source]) {
    const stroke = new DragTrimStroke();
    start(stroke, source);
    assert.equal(move(stroke, source), true);
    assert.deepEqual(stroke.preview(source, () => 'frame')?.intervals, [[[0, 0], [0, 10]]]);
    assert.equal(stroke.preview(current, () => current === source ? 'moved' : 'frame'), null);
    assert.equal(stroke.preview(source, () => 'frame'), null);
    assert.deepEqual(release(stroke, source), { kind: 'discard' });
  }
});

test('terminal capture loss accepts a different pointer and consumes a late release', () => {
  const source = owner(), stroke = new DragTrimStroke();
  start(stroke, source);
  assert.equal(move(stroke, source), true);
  assert.equal(stroke.terminate(1), true);
  assert.equal(stroke.interceptDown(2), false);
  start(stroke, source, 2);
  assert.deepEqual(release(stroke, source, 1), { kind: 'discard' });
  assert.equal(move(stroke, source, 2), true);
  const outcome = release(stroke, source, 2);
  assert.equal(outcome.kind, 'plan');
  if (outcome.kind !== 'plan' || 'error' in outcome.plan) assert.fail('The new pointer must produce its own plan.');
  assert.deepEqual(outcome.plan.intervals, [[[0, 0], [0, 10]]]);
});

test('an invalid press is swallowed and a valid short press stays an ordinary click', () => {
  const source = owner(), stroke = new DragTrimStroke();
  stroke.ignore(1);
  assert.deepEqual(release(stroke, source), { kind: 'discard' });
  assert.equal(stroke.interceptDown(1), false);
  start(stroke, source);
  assert.deepEqual(stroke.release(1, source, 'frame', [1, 0], [-1.99, 5]), { kind: 'click' });
});

test('a sparse move through the rail cancels even when both endpoints are clear', () => {
  const source = owner(), stroke = new DragTrimStroke();
  const rail = { left: 30, right: 50, top: -10, bottom: 10 };
  start(stroke, source);
  assert.equal(stroke.advance(1, source, 'frame', [100, 0], [2, 5], rail), true);
  assert.equal(stroke.preview(source, () => 'frame'), null);
  assert.deepEqual(release(stroke, source), { kind: 'discard' });
  start(stroke, source);
  assert.deepEqual(stroke.release(1, source, 'frame', [100, 0], [2, 5], rail), { kind: 'discard' });
  start(stroke, source);
  assert.equal(stroke.release(1, source, 'frame', [100, 0], [2, 5], { ...rail, top: 1 }).kind, 'plan');
});
