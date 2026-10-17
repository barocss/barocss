import test from 'node:test';
import assert from 'node:assert/strict';
import { offsetShape } from '../src/sketch/offset';

test('offset: rectangles, circles, slots and straight outlines grow or shrink; too far is refused', () => {
  assert.deepEqual(offsetShape({ kind: 'rectangle', a: [0, 0], b: [20, 10] }, 2), { shape: { kind: 'rectangle', a: [-2, -2], b: [22, 12] } });
  assert.deepEqual(offsetShape({ kind: 'circle', c: [0, 0], r: 5 }, -2), { shape: { kind: 'circle', c: [0, 0], r: 3 } });
  assert.ok('error' in offsetShape({ kind: 'rectangle', a: [0, 0], b: [20, 10] }, -5));
  // An L outline (clockwise or not), 1 mm in: every edge moved in by 1.
  const L = { kind: 'polygon' as const, points: [[0, 0], [20, 0], [20, 5], [5, 5], [5, 15], [0, 15]] as [number, number][], closed: true };
  const r = offsetShape(L, -1);
  assert.ok('shape' in r && r.shape.kind === 'polygon');
  assert.deepEqual(r.shape.points, [[1, 1], [19, 1], [19, 4], [4, 4], [4, 14], [1, 14]]);
  const cw = offsetShape({ ...L, points: [...L.points].reverse() }, -1);
  assert.ok('shape' in cw && cw.shape.kind === 'polygon' && cw.shape.points.some(p => p[0] === 19 && p[1] === 4));
  assert.ok('error' in offsetShape(L, -3), 'the 5 mm leg would turn round');
});
