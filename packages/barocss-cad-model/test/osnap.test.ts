import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { rectanglePart, withNode } from '../src/engine/doc';
import { pointAlongSnap, modelSnaps, nearestSnap, shapeSnaps } from '../src/sketch/osnap';
import { planeOfFace } from '../src/sketch/plane';

test('sketch snaps: a rectangle’s corners, middles and centre; a drafting one only its first corner', () => {
  const r = shapeSnaps({ kind: 'rectangle', a: [0, 0], b: [10, 4] });
  assert.equal(r.length, 9);
  assert.deepEqual(r.filter(p => p.kind === 'centre').map(p => p.at), [[5, 2]]);
  assert.deepEqual(shapeSnaps({ kind: 'rectangle', a: [0, 0], b: [10, 4] }, true).map(p => p.at), [[0, 0]]);
  assert.deepEqual(shapeSnaps({ kind: 'circle', c: [1, 1], r: 2 }).map(p => p.kind), ['centre', 'quadrant', 'quadrant', 'quadrant', 'quadrant']);
});

test('model snaps on a face: its corners, edge middles and a hole’s centre; the nearest on screen wins', () => {
  const doc = withNode(rectanglePart(40, 20, 8), { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [12, 9], radius: 3 });
  const r = evaluateDoc(doc, 1); assert.ok(r.ok);
  const plane = planeOfFace([0, 0, 1], [20, 10, 8])!, pts = modelSnaps(r.bodies.map(b => b.mesh), plane);
  const has = (kind: string, at: number[]) => pts.some(p => p.kind === kind && Math.abs(p.at[0] - at[0]) < 1e-3 && Math.abs(p.at[1] - at[1]) < 1e-3);
  assert.ok(has('end', [40, 20]) && has('mid', [20, 0]) && has('centre', [12, 9]), JSON.stringify(pts));
  assert.ok(!pts.some(p => Math.abs(p.at[0] - 40) < 1e-6 && p.kind === 'end' && Math.abs(p.at[1]) > 21), 'only edges in the plane');
  const screen = (p: [number, number]): [number, number] => [p[0] * 10, p[1] * 10];
  assert.deepEqual(nearestSnap(pts, screen, [122, 92])?.at, [12, 9]);
  assert.equal(nearestSnap(pts, screen, [300, 150]), null);
});

test('two-point snaps preserve direction, extrapolation, and coordinate limits', () => {
  assert.deepEqual(pointAlongSnap([0, 0], [12, 0], 'ratio', 1 / 3), [4, 0]);
  assert.deepEqual(pointAlongSnap([0, 0], [12, 0], 'ratio', 1.5), [18, 0]);
  assert.deepEqual(pointAlongSnap([0, 0], [12, 0], 'ratio', -0.5), [-6, 0]);
  assert.deepEqual(pointAlongSnap([0, 0], [6, 8], 'distance', 5), [3, 4]);
  assert.deepEqual(pointAlongSnap([0, 0], [6, 8], 'distance', -5), [-3, -4]);
  assert.deepEqual(pointAlongSnap([6, 8], [0, 0], 'distance', 2.5), [4.5, 6]);
  assert.deepEqual(pointAlongSnap([0, 0], [10, 4], 'ratio', 0.25), [2.5, 1]);
  assert.equal(pointAlongSnap([1, 2], [1, 2], 'ratio', 0.5), null);
  assert.equal(pointAlongSnap([0, 0], [1e-9, 0], 'distance', 5), null);
  assert.equal(pointAlongSnap([0, 0], [6, 8], 'ratio', Infinity), null);
  assert.equal(pointAlongSnap([0, 0], [6, 8], 'ratio', Number.MAX_VALUE), null);
  assert.equal(pointAlongSnap([10000, 0], [9999, 0], 'distance', -1), null);
});
