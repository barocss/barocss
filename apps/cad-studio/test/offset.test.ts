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

test('offset: a rounded rectangle (tangent arcs) moves out piece by piece; its arcs about their centres', async () => {
  const { arcOf } = await import('../src/sketch/profile');
  const t = Math.tan(Math.PI / 8); // a quarter arc's bulge
  // 20 × 10 with R2 corners, counter-clockwise.
  const pts: [number, number][] = [[2, 0], [18, 0], [20, 2], [20, 8], [18, 10], [2, 10], [0, 8], [0, 2]];
  const bulges = [0, t, 0, t, 0, t, 0, t];
  const r = offsetShape({ kind: 'polygon', points: pts, closed: true, bulges }, 1);
  assert.ok('shape' in r && r.shape.kind === 'polygon');
  assert.deepEqual(r.shape.points, [[2, -1], [18, -1], [21, 2], [21, 8], [18, 11], [2, 11], [-1, 8], [-1, 2]]);
  const a = arcOf(r.shape.points[1], r.shape.points[2], r.shape.bulges![1]);
  assert.deepEqual([Math.round(a.center[0] * 1e6) / 1e6, Math.round(a.center[1] * 1e6) / 1e6, Math.round(a.radius * 1e6) / 1e6], [18, 2, 3]);
  assert.ok('error' in offsetShape({ kind: 'polygon', points: pts, closed: true, bulges }, -2.5), 'past the R2 corners');
});
