import assert from 'node:assert/strict';
import { test } from 'node:test';
import { placeConstraintMarks } from '../src/ui/sketchConstraintMarkLayout';

const view = { width: 120, height: 100 };

test('keeps an unblocked mark and gives a nearby mark its own space', () => {
  const a = [40, 50] as const, b = [50, 50] as const;
  const placed = placeConstraintMarks([a, b], [], view);
  assert.equal(placed[0], a);
  assert.deepEqual(placed[1], [70, 50]);
  assert.deepEqual(placeConstraintMarks([a, b], [], view), placed);
});

test('protects the driving dimension and rejects placements outside the viewport', () => {
  const preferred = [108, 50] as const;
  const dimension = { x: 99, y: 40, width: 18, height: 22 };
  assert.deepEqual(placeConstraintMarks([preferred], [dimension], view), [[88, 50]]);
});

test('keeps unavailable placements and preserves both mark identities', () => {
  const a = [10, 8] as const, b = [10, 8] as const;
  const placed = placeConstraintMarks([a, b], [], { width: 20, height: 16 });
  assert.equal(placed[0], a);
  assert.equal(placed[1], b);
  const offscreen = [-50, -50] as const;
  assert.equal(placeConstraintMarks([offscreen], [], view)[0], offscreen);
});
