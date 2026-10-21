import test from 'node:test';
import assert from 'node:assert/strict';
import { dragAlong, dragPlane, dragTurn, hitTest, layout, snapTo, type Projector, type TransformGizmo } from '../src/viewport/gizmo';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';

// A camera straight above, looking down −Z: screen x = world x, screen y = −world y (10 px per mm, origin at 500, 500).
const top: Projector = { project: (p: Vec3) => [500 + p[0] * 10, 500 - p[1] * 10], forward: [0, 0, -1], size: 10 };
// A camera in front, looking along +Y: screen x = world x, screen y = −world z.
const front: Projector = { project: (p: Vec3) => [500 + p[0] * 10, 500 - p[2] * 10], forward: [0, 1, 0], size: 10 };
// Above and in front of the origin, looking down at it: every axis shows.
const iso: Projector = { project: (p: Vec3) => [500 + (p[0] - p[1]) * 7, 500 + (p[0] + p[1]) * 4 - p[2] * 8], forward: [-0.6, -0.6, -0.5], size: 10 };

test('gizmo: arrows from a little out to their tips; an axis pointing at the camera is left out', () => {
  const L = layout({ origin: [0, 0, 0], move: [0, 1, 2] }, top);
  assert.deepEqual(L.arrows.map(a => [a.axis, a.from, a.to]), [[0, [520, 500], [600, 500]], [1, [500, 480], [500, 400]]]);
  assert.equal(layout({ origin: [0, 0, 0], move: [0, 1, 2] }, iso).arrows.length, 3);
});

test('gizmo: plane squares sit between their two arrows, arcs face the camera', () => {
  const g: TransformGizmo = { origin: [0, 0, 0], move: [0, 1, 2], turn: [0, 1, 2] };
  const L = layout(g, iso);
  assert.deepEqual(L.planes.map(q => q.axes), [[0, 1], [1, 2], [0, 2]]);
  assert.deepEqual(layout({ origin: [0, 0, 0], move: [0, 2] }, iso).planes.map(q => q.axes), [[0, 2]], 'a square only for two moving axes');
  // The XY square lies between the +X and +Y arrows.
  const xy = L.planes[0].points, c = xy.reduce((m, p) => [m[0] + p[0] / 4, m[1] + p[1] / 4], [0, 0]);
  assert.ok(Math.abs(c[0] - iso.project([3.8, 3.8, 0])[0]) < 1e-9 && Math.abs(c[1] - iso.project([3.8, 3.8, 0])[1]) < 1e-9, JSON.stringify(c));
  assert.equal(L.arcs.length, 3);
  // The Z arc is a quarter of radius 0.82 × size in the XY plane, on the +X +Y side.
  for (const p of L.arcs[2].points) {
    const x = ((p[0] - 500) / 7 + ((p[1] - 500) / 4)) / 2, y = ((p[1] - 500) / 4 - (p[0] - 500) / 7) / 2;
    assert.ok(Math.abs(Math.hypot(x, y) - 8.2) < 1e-9 && x > 0 && y > 0, JSON.stringify({ x, y }));
  }
});

test('gizmo: hits find the handle under the pointer; the centre is none', () => {
  const g: TransformGizmo = { origin: [0, 0, 0], move: [0, 1, 2], turn: [2] };
  assert.deepEqual(hitTest([590, 502], g, [], top), { kind: 'move', axis: 0 });
  assert.deepEqual(hitTest([502, 440], g, [], top), { kind: 'move', axis: 1 });
  assert.deepEqual(hitTest([538, 462], g, [], top), { kind: 'plane', axes: [0, 1] });
  const a = 0.5 * Math.PI / 2; // the middle of the Z arc (radius 82 px), on the +X +Y side
  assert.deepEqual(hitTest([500 + 82 * Math.cos(a), 500 - 82 * Math.sin(a)], g, [], top), { kind: 'turn', axis: 2 });
  assert.equal(hitTest([500, 500], g, [], top), null);
  assert.equal(hitTest([700, 700], g, [], top), null);
});

test('gizmo: drags in mm along an arrow, in two axes on a square; nothing along an axis at the camera', () => {
  assert.equal(dragAlong([600, 500], [650, 500], [0, 0, 0], [1, 0, 0], top), 5);
  assert.equal(dragAlong([500, 400], [500, 380], [0, 0, 0], [0, 1, 0], top), 2);
  assert.equal(dragAlong([500, 500], [520, 520], [0, 0, 0], [0, 0, 1], top), 0);
  assert.deepEqual(dragPlane([530, 470], [560, 450], [0, 0, 0], [0, 1], top), [3, 2]);
  assert.deepEqual(dragPlane([530, 470], [560, 450], [0, 0, 0], [0, 2], top), [0, 0], 'the XZ plane seen edge-on from above');
  assert.equal(snapTo(4.6, 1), 5); assert.equal(snapTo(-0.2, 1), 0); assert.equal(snapTo(44, 15), 45);
});

test('gizmo: sweeping round the centre turns right-handed about an axis seen from its tip', () => {
  // From above (+Z towards the camera), +X to +Y is a counter-clockwise quarter: +90° about Z.
  assert.ok(Math.abs(dragTurn([600, 500], [500, 400], [0, 0, 0], 2, top) - 90) < 1e-9);
  assert.ok(Math.abs(dragTurn([500, 400], [600, 500], [0, 0, 0], 2, top) + 90) < 1e-9);
  // From the front (looking along +Y, so −Y points at the camera): +X to +Z turns −90° about Y.
  assert.ok(Math.abs(dragTurn([600, 500], [500, 400], [0, 0, 0], 1, front) + 90) < 1e-9);
});
