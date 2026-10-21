import test from 'node:test';
import assert from 'node:assert/strict';
import { offsetShape } from '@barocss/cad-model/sketch/offset';

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
  const { arcOf } = await import('@barocss/cad-model/sketch/profile');
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

test('offset: arcs meeting their neighbours at corners — the moved pieces cut back or run on to meet', async () => {
  const { arcOf } = await import('@barocss/cad-model/sketch/profile');
  // A door arch, counter-clockwise: the top arc meets both sides at corners.
  const pts: [number, number][] = [[0, 0], [20, 0], [20, 10], [0, 10]], bulges = [0, 0, 0.3, 0];
  const top = arcOf(pts[2], pts[3], 0.3);
  for (const d of [1.5, -1.5]) {
    const r = offsetShape({ kind: 'polygon', points: pts, closed: true, bulges }, d);
    assert.ok('shape' in r && r.shape.kind === 'polygon', String(d));
    const q = r.shape.points, b = r.shape.bulges!;
    assert.deepEqual([q[0], q[1]], [[-d, -d], [20 + d, -d]]);
    assert.equal(q[2][0], 20 + d); assert.equal(q[3][0], -d);
    // The arc about the same centre, its radius moved by d, through the new corners.
    const a = arcOf(q[2], q[3], b[2]);
    const near = (x: number, y: number) => assert.ok(Math.abs(x - y) < 1e-5, `${x} ≠ ${y}`);
    near(a.center[0], top.center[0]); near(a.center[1], top.center[1]); near(a.radius, top.radius + d);
    assert.ok(b[2] > 0 && b[0] === 0 && b[1] === 0 && b[3] === 0);
  }
  // A lens of two arcs: circle meets circle at both corners.
  const lens = { kind: 'polygon' as const, points: [[0, 0], [20, 0]] as [number, number][], closed: true, bulges: [-0.4, -0.4] };
  const L0 = arcOf([0, 0], [20, 0], -0.4);
  const r = offsetShape(lens, 1);
  assert.ok('shape' in r && r.shape.kind === 'polygon');
  const q = r.shape.points, a = arcOf(q[0], q[1], r.shape.bulges![0]);
  assert.ok(Math.abs(a.radius - (L0.radius + 1)) < 1e-5);
  assert.ok(q[0][0] < 0 && q[1][0] > 20 && Math.abs(q[0][1]) < 1e-6, JSON.stringify(q));
  assert.ok('error' in offsetShape(lens, -4), 'the lens is about 3.4 mm thick at most on each side');
});
