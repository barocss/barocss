import test from 'node:test';
import assert from 'node:assert/strict';
import { trimAt, trimPreview } from '../src/sketch/trim';
import { profileOf } from '@barocss/cad-model/sketch/loops';
import { sampleOutline } from '@barocss/cad-model/sketch/profile';
import type { SketchShape } from '../src/viewport/Viewport';

const area = (pts: [number, number][]) => Math.abs(pts.reduce((t, p, i) => { const q = pts[(i + 1) % pts.length]; return t + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);

test('trim: a rectangle and a circle across its edge become one keyhole outline in two clicks', () => {
  const shapes: SketchShape[] = [{ kind: 'rectangle', a: [0, 0], b: [20, 10] }, { kind: 'circle', c: [20, 5], r: 4 }];
  assert.ok('error' in profileOf(shapes), 'overlapping shapes are refused before the trim');
  // The rectangle's edge inside the circle.
  const preview = trimPreview(shapes, [20, 5.2], 0.5);
  assert.deepEqual(preview, [[20, 1], [20, 9]]);
  const a = trimAt(shapes, [20.1, 5.2], 0.5);
  assert.ok('shapes' in a);
  const rect = a.shapes[0];
  assert.ok(rect.kind === 'polygon' && !rect.closed);
  assert.deepEqual(rect.points, [[20, 9], [20, 10], [0, 10], [0, 0], [20, 0], [20, 1]]);
  // Then the circle's arc inside the rectangle: what is left joins the rectangle's ends and closes it.
  const b = trimAt(a.shapes, [16.2, 5], 0.5);
  assert.ok('shapes' in b);
  assert.equal(b.shapes.length, 1);
  const k = b.shapes[0];
  assert.ok(k.kind === 'polygon' && k.closed, JSON.stringify(k));
  const ring = sampleOutline(k.points, k.bulges, true);
  assert.ok(Math.abs(area(ring) - (200 + Math.PI * 16 / 2)) < 0.2, String(area(ring)));
  assert.ok('node' in profileOf(b.shapes), 'one profile now');
});

test('trim: an open line is cut back to its crossings, or split in two; a lone circle goes', () => {
  // A line across a rectangle: clicked outside it, the end beyond the edge goes.
  const shapes: SketchShape[] = [{ kind: 'rectangle', a: [0, 0], b: [20, 10] }, { kind: 'polygon', points: [[-5, 5], [25, 5]], bulges: [0, 0], closed: false }];
  const a = trimAt(shapes, [-3, 5], 0.5);
  assert.ok('shapes' in a);
  const line = a.shapes.find(s => s.kind === 'polygon' && !s.closed);
  assert.ok(line && line.kind === 'polygon');
  assert.deepEqual(line.points, [[0, 5], [25, 5]]);
  // Clicked between the edges: the part inside goes, leaving two pieces.
  const b = trimAt(shapes, [10, 5], 0.5);
  assert.ok('shapes' in b);
  const pieces = b.shapes.filter(s => s.kind === 'polygon' && !s.closed);
  assert.deepEqual(pieces.map(s => s.kind === 'polygon' && s.points), [[[-5, 5], [0, 5]], [[20, 5], [25, 5]]]);
  // A circle crossing nothing: removed whole. Off every shape: refused.
  const c = trimAt([{ kind: 'circle', c: [0, 0], r: 3 }], [3, 0.1], 0.5);
  assert.ok('shapes' in c && c.shapes.length === 0);
  assert.ok('error' in trimAt(shapes, [50, 50], 0.5));
});

test('extend: a line runs on to the shape ahead of it; an arc round its circle; nothing ahead is refused', async () => {
  const { extendAt, extendPreview, splitAt } = await import('../src/sketch/trim');
  const { arcOf } = await import('@barocss/cad-model/sketch/profile');
  const rect: SketchShape = { kind: 'rectangle', a: [0, 0], b: [20, 10] };
  // A line from inside, stopping short of the right edge: its end runs on to x = 20.
  const line: SketchShape = { kind: 'polygon', points: [[5, 5], [15, 5]], bulges: [0, 0], closed: false };
  assert.deepEqual(extendPreview([rect, line], [14.8, 5.1], 0.5), [[15, 5], [20, 5]]);
  const a = extendAt([rect, line], [14.8, 5.1], 0.5);
  assert.ok('shapes' in a && a.shapes[1].kind === 'polygon');
  assert.deepEqual(a.shapes[1].points, [[5, 5], [20, 5]]);
  // Its start, the other way, to x = 0.
  const b = extendAt([rect, line], [5.2, 4.9], 0.5);
  assert.ok('shapes' in b && b.shapes[1].kind === 'polygon');
  assert.deepEqual(b.shapes[1].points, [[0, 5], [15, 5]]);
  // An arc about (10, 5), r 3, a quarter from (13, 5) to (10, 8): runs on to a line at y = 5 on the far side.
  const arc: SketchShape = { kind: 'polygon', points: [[13, 5], [10, 8]], bulges: [Math.tan(Math.PI / 8), 0], closed: false };
  const cut: SketchShape = { kind: 'polygon', points: [[0, 5], [8, 5]], bulges: [0, 0], closed: false };
  const c = extendAt([arc, cut], [10.1, 8], 0.5);
  assert.ok('shapes' in c && c.shapes[0].kind === 'polygon');
  assert.deepEqual(c.shapes[0].points[1], [7, 5]);
  const k = arcOf(c.shapes[0].points[0] as [number, number], c.shapes[0].points[1] as [number, number], c.shapes[0].bulges![0]);
  assert.ok(Math.abs(k.sweep - Math.PI) < 1e-6 && Math.abs(k.radius - 3) < 1e-6, 'a half circle now');
  assert.ok('error' in extendAt([line], [15, 5], 0.5), 'nothing ahead');
  // Split: a rectangle edge gets a point; a circle becomes two halves.
  const s = splitAt([rect], [20, 4], 0.5);
  assert.ok('shapes' in s && s.shapes[0].kind === 'polygon' && s.shapes[0].closed);
  assert.deepEqual(s.shapes[0].points, [[0, 0], [20, 0], [20, 4], [20, 10], [0, 10]]);
  const ci = splitAt([{ kind: 'circle', c: [0, 0], r: 5 }], [5, 0], 0.5);
  assert.ok('shapes' in ci && ci.shapes[0].kind === 'polygon');
  assert.deepEqual(ci.shapes[0].points, [[5, 0], [-5, 0]]);
  // An arc split in two keeps its circle.
  const sa = splitAt([arc], [10 + 3 * Math.cos(Math.PI / 4), 5 + 3 * Math.sin(Math.PI / 4)], 0.5);
  assert.ok('shapes' in sa && sa.shapes[0].kind === 'polygon');
  assert.equal(sa.shapes[0].points.length, 3);
  for (const i of [0, 1]) { const q = arcOf(sa.shapes[0].points[i] as [number, number], sa.shapes[0].points[i + 1] as [number, number], sa.shapes[0].bulges![i]); assert.ok(Math.abs(q.radius - 3) < 1e-5); }
});
