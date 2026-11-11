import test from 'node:test';
import assert from 'node:assert/strict';
import { sketchCutInputs, switchTool } from '../src/app/sketchControls';
import { xyPlane } from '@barocss/cad-model/sketch/plane';
import { extendAt, extendPreview, splitAt, splitPreview, trimAt, trimPreview } from '@barocss/cad-model/sketch/trim';
import type { SketchShape, SketchState } from '@barocss/cad-model/sketch/types';

const line = (a: [number, number], b: [number, number], ids: string[], construction = false): SketchShape =>
  ({ kind: 'polygon', points: [a, b], bulges: [0, 0], closed: false, ids, ...(construction ? { construction: true } : {}) });
const state = (done: SketchShape[], shape: SketchShape | null = null): SketchState =>
  ({ plane: xyPlane(), tool: 'select', shape, done, base: null, hideConstruction: true });

test('hidden construction is protected in the same ordered preview and edit inputs', () => {
  const hidden = line([0, 0], [1, 0], ['e1', 'e2'], true);
  const live = line([0, 3], [1, 3], ['e3', 'e4'], true);
  const boundary = line([2, -1], [2, 4], ['e5', 'e6'], true);
  const { shapes, protectedShapes } = sketchCutInputs(state([hidden, boundary], live));
  assert.deepEqual(shapes, [hidden, boundary, live]);
  assert.deepEqual(protectedShapes, new Set([hidden, boundary]));
  for (const [preview, edit] of [[trimPreview, trimAt], [extendPreview, extendAt], [splitPreview, splitAt]] as const) {
    assert.equal(preview(shapes, [0.75, 0], 0.1, protectedShapes), null);
    assert.ok('error' in edit(shapes, [0.75, 0], 0.1, protectedShapes));
    assert.ok(preview(shapes, [0.75, 3], 0.1, protectedShapes));
    assert.ok('shapes' in edit(shapes, [0.75, 3], 0.1, protectedShapes));
  }
});

test('visible cuts keep hidden boundaries, order, IDs and object identity', () => {
  const source = line([0, 0], [1, 0], ['e1', 'e2']);
  const hiddenA = line([3, -1], [3, 0], ['e8', 'e9'], true);
  const hiddenB = line([3, 0], [3, 1], ['e10', 'e11'], true);
  const { shapes, protectedShapes } = sketchCutInputs({ ...state([hiddenA, hiddenB], source), editNode: 0, mainIds: ['e1', 'e2'] });
  const preview = extendPreview(shapes, [0.75, 0], 0.1, protectedShapes);
  assert.deepEqual(preview, [[1, 0], [3, 0]]);
  const extended = extendAt(shapes, [0.75, 0], 0.1, protectedShapes);
  assert.ok('shapes' in extended && extended.shapes[0].kind === 'polygon');
  assert.deepEqual(extended.shapes[0].points, [[0, 0], [3, 0]]);
  assert.deepEqual(extended.shapes[0].ids, ['e1', 'e12']);
  assert.equal(extended.shapes[1], hiddenA);
  assert.equal(extended.shapes[2], hiddenB);

  const editable = line([0, 0], [5, 0], ['e1', 'e2']);
  const inputs = [editable, hiddenA, hiddenB];
  const cut = trimAt(inputs, [4, 0], 0.1, protectedShapes);
  assert.ok('shapes' in cut && cut.shapes[0].kind === 'polygon');
  assert.deepEqual(cut.shapes[0].points, [[0, 0], [3, 0]]);
  assert.equal(cut.shapes[1], hiddenA);
  assert.equal(cut.shapes[2], hiddenB);
  const split = splitAt(inputs, [2, 0], 0.1, protectedShapes);
  assert.ok('shapes' in split && split.shapes[0].kind === 'polygon');
  assert.deepEqual(split.shapes[0].points, [[0, 0], [2, 0], [5, 0]]);
  assert.deepEqual(split.shapes[0].ids, ['e1', 'e12', 'e2']);
  assert.equal(split.shapes[1], hiddenA);
  assert.equal(split.shapes[2], hiddenB);
  const switched = switchTool({ ...state([hiddenA, hiddenB], source), tool: 'polygon' }, 'extend');
  assert.equal(switched.done?.[0], hiddenA);
  assert.equal(switched.done?.[1], hiddenB);
});
