import test from 'node:test';
import assert from 'node:assert/strict';
import { trimAt, trimPreview } from '../src/sketch/trim';
import { profileOf } from '../src/sketch/loops';
import { sampleOutline } from '../src/sketch/profile';
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
