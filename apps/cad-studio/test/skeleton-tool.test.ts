// G17: the 3D sketch tool's own logic — placing on a plane and along an axis, the drag solved live with the dragged
// point as its target, the constraints a selection offers, removing with the constraints renumbered.
import test from 'node:test';
import assert from 'node:assert/strict';
import { constraintMarks, dragSolve, diagnoseDraft, nearestSnap, offers, onAxisLine, onGrid, onPlane, removeFromDraft, type SkeletonDraft } from '../src/skeleton/skeletonTool';
import type { V3 } from '@barocss/cad-model/frames/sketch3d';

const close = (a: readonly number[], b: readonly number[], tol = 1e-6) => a.every((v, k) => Math.abs(v - b[k]) < tol);

test('G17 a ray on the work plane through a point, and on an axis line through one', () => {
  const down: V3 = [0, 0, -1];
  assert.deepEqual(onPlane([3, 4, 10], down, 'xy', [0, 0, 2]), [3, 4, 2]);
  assert.equal(onPlane([3, 4, 10], [1, 0, 0], 'xy', [0, 0, 0]), null, 'along the plane');
  // A ray down at x = 5 against the X axis through (0, 2, 0): (5, 2, 0).
  assert.ok(close(onAxisLine([5, 7, 10], down, [0, 2, 0], 'x')!, [5, 2, 0]));
  // A ray towards −Y through (1, 50, 3) against the Z axis through (1, 0, 0): (1, 0, 3).
  assert.ok(close(onAxisLine([1, 50, 3], [0, -1, 0], [1, 0, 0], 'z')!, [1, 0, 3]));
  assert.deepEqual(onGrid([1.26, 3.74, 2.2], 0.5, 'xy'), [1.5, 3.5, 2.2], 'its plane coordinate kept');
});

test('G17 snaps: the sketch\'s own point first, a body corner else, none past the reach', () => {
  const project = (p: V3) => [p[0], p[1]];
  assert.deepEqual(nearestSnap(10, 10, project, [[12, 11, 0]], [[10, 10, 0]]), { kind: 'point', index: 0, at: [12, 11, 0] });
  assert.deepEqual(nearestSnap(10, 10, project, [[40, 40, 0]], [[11, 10, 5]]), { kind: 'vertex', at: [11, 10, 5] });
  assert.equal(nearestSnap(10, 10, project, [[40, 40, 0]], [[30, 10, 0]]), null);
});

// A 2-segment chain: point 0 fixed at the origin, segment 0 of length 10 along X.
const chain: SkeletonDraft = {
  points: [[0, 0, 0], [10, 0, 0], [10, 5, 0]], segments: [[0, 1], [1, 2]],
  constraints: [{ kind: 'fixed', point: 0, at: [0, 0, 0] }, { kind: 'length', segment: 0, value: 10 }, { kind: 'along', segment: 0, axis: 'x' }],
};

test('G17 a drag solved live: a free end reaches the pointer, the rest as little moved as the constraints let it', () => {
  const r = dragSolve(chain, 2, [13, 8, 2], {});
  assert.ok(!('error' in r));
  assert.equal(r.reached, true);
  assert.ok(close(r.points[2], [13, 8, 2]), `under the pointer ${JSON.stringify(r.points[2])}`);
  assert.ok(close(r.points[1], [10, 0, 0]) && close(r.points[0], [0, 0, 0]), 'the constrained segment kept');
  assert.equal(r.solve.status, 'under');
  // The constrained end dragged off its line: held by the constraints (along X from a fixed point at length 10), not reached.
  const held = dragSolve(chain, 1, [8, 6, 0], {});
  assert.ok(!('error' in held));
  assert.equal(held.reached, false);
  assert.ok(close(held.points[1], [10, 0, 0], 1e-5), `kept where the constraints hold it ${JSON.stringify(held.points[1])}`);
  // A fixed point does not move.
  const fixed = dragSolve(chain, 0, [5, 5, 5], {});
  assert.ok(!('error' in fixed) && close(fixed.points[0], [0, 0, 0]) && !fixed.reached);
});

test('G17 a free segment dragged by its end: the end at the pointer, its length kept by the other end moving', () => {
  const d: SkeletonDraft = { points: [[0, 0, 0], [10, 0, 0]], segments: [[0, 1]], constraints: [{ kind: 'length', segment: 0, value: 10 }] };
  const r = dragSolve(d, 1, [0, 20, 0], {});
  assert.ok(!('error' in r) && r.reached);
  assert.ok(close(r.points[1], [0, 20, 0]));
  assert.ok(Math.abs(Math.hypot(...r.points[0].map((v, k) => v - r.points[1][k])) - 10) < 1e-6, 'the length kept');
});

test('G17 the diagnosis on the draft: well with the six rigid motions taken, a conflict named', () => {
  const tri: SkeletonDraft = {
    points: [[0, 0, 0], [10, 0, 0], [0, 10, 0]], segments: [[0, 1], [0, 2]],
    constraints: [{ kind: 'fixed', point: 0, at: [0, 0, 0] }, { kind: 'length', segment: 0, value: 10 }, { kind: 'along', segment: 0, axis: 'x' }, { kind: 'length', segment: 1, value: 10 }, { kind: 'along', segment: 1, axis: 'y' }],
  };
  const r = diagnoseDraft(tri, {});
  assert.ok(!('error' in r)); assert.equal(r.solve.status, 'well'); assert.equal(r.solve.dof, 0);
  const bad = diagnoseDraft({ ...tri, constraints: [...tri.constraints, { kind: 'parallel', a: 0, b: 1 }] }, {});
  assert.ok(!('error' in bad)); assert.equal(bad.solve.status, 'conflict');
  const unbound = diagnoseDraft({ ...tri, constraints: [{ kind: 'length', segment: 0, value: { parameter: 'W' } }] }, {});
  assert.ok('error' in unbound && /W/.test(unbound.error));
  assert.equal(constraintMarks(tri, p => [p[0], p[1]]).length, 5, 'a mark each');
});

test('G17 offers by selection, and removing renumbers the constraints left', () => {
  assert.deepEqual(offers(chain, { points: [], segments: [1], constraints: [] }, 'xy').map(o => o.label), ['Length', 'Along X', 'Along Y', 'Along Z']);
  assert.deepEqual(offers(chain, { points: [], segments: [0, 1], constraints: [] }, 'xy').map(o => o.label), ['Parallel', 'Perpendicular', 'Angle']);
  assert.deepEqual(offers(chain, { points: [0, 2], segments: [], constraints: [] }, 'xy').map(o => o.label), ['Coincident', 'Distance']);
  assert.equal((offers(chain, { points: [], segments: [1], constraints: [] }, 'xy')[0].constraint as { value: number }).value, 5);
  // Point 0 gone: its segment 0 with it, and the constraints on either (fixed, length, along); segment 1 renumbered 0.
  const left = removeFromDraft({ ...chain, constraints: [...chain.constraints, { kind: 'length', segment: 1, value: 5 }] }, { points: [0], segments: [], constraints: [] });
  assert.deepEqual(left.points, [[10, 0, 0], [10, 5, 0]]);
  assert.deepEqual(left.segments, [[0, 1]]);
  assert.deepEqual(left.constraints, [{ kind: 'length', segment: 0, value: 5 }]);
});
