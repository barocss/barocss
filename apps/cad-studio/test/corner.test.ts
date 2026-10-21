import test from 'node:test';
import assert from 'node:assert/strict';
import { roundCorner } from '@barocss/cad-model/sketch/corner';
import { arcOf } from '@barocss/cad-model/sketch/profile';

test('rounding a corner: an arc tangent to both edges, ends cut back, constraints renumbered', () => {
  const sq = { kind: 'polygon' as const, points: [[0, 0], [20, 0], [20, 10], [0, 10]] as [number, number][], closed: true, bulges: [0, 0, 0, 0], lengths: { 0: 20, 1: 10, 2: 20 }, hv: { h: [0, 2], v: [1, 3] } };
  const r = roundCorner(sq, 1, 3);
  assert.ok('shape' in r);
  assert.deepEqual(r.shape.points, [[0, 0], [17, 0], [20, 3], [20, 10], [0, 10]]);
  const arc = arcOf(r.shape.points[1], r.shape.points[2], r.shape.bulges![1]);
  assert.deepEqual([Math.round(arc.center[0] * 1e6) / 1e6, Math.round(arc.center[1] * 1e6) / 1e6, Math.round(arc.radius * 1e6) / 1e6], [17, 3, 3]);
  assert.deepEqual([r.shape.lengths, r.shape.radii, r.shape.tangents, r.shape.hv], [{ 3: 20 }, { 1: 3 }, [1, 2], { h: [0, 3], v: [2, 4] }]);
  assert.ok('error' in roundCorner(sq, 1, 11), 'R11 does not fit the 10 mm edge');
  assert.ok('error' in roundCorner(r.shape, 2, 1), 'next to the arc');
});
