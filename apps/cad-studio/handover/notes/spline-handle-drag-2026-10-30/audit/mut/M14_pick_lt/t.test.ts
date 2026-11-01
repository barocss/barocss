// D353: dragging a spline's handles and fit points — geometry, hit precedence, dragged definitions and the rebuild contract.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draggedSpline, splineHandleGeometry, splineHandleHit, HANDLE_LENGTH } from './splineHandles';
import { respline, splineEditError, splineShape, type SplineDef } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/sketch/spline';

// Plane (u, v) to the screen: x = 2u, y = -2v (a scaled, flipped view).
const P = (u: number, v: number) => [2 * u, -2 * v] as const;
const def: SplineDef = { fit: [[0, 0], [20, 10], [40, 0]], closed: false, handles: [0, 90, null] };

test('geometry: handle ends sit 30 px each way along the tangent', () => {
  const g = splineHandleGeometry(def, P);
  assert.ok(g[0].c[0] === 0 && g[0].c[1] === 0); // (=== also holds for -0)
  assert.ok(Math.abs(g[0].fwd[0] - HANDLE_LENGTH) < 1e-9 && Math.abs(g[0].fwd[1]) < 1e-9 && Math.abs(g[0].back[0] + HANDLE_LENGTH) < 1e-9);
  // Handle at 90 degrees points up the plane = up the screen (negative y).
  assert.ok(Math.abs(g[1].fwd[0] - 40) < 1e-9 && Math.abs(g[1].fwd[1] - (-20 - 30)) < 1e-9);
  assert.equal(g.length, 3);
});

test('hit: 8 px radius, handle ends before fit points, nearest wins', () => {
  assert.deepEqual(splineHandleHit(def, P, 30 + 7.9, 0), { kind: 'handle', i: 0, sign: 1 });
  assert.equal(splineHandleHit(def, P, 30 + 8.5, 0), null);
  assert.deepEqual(splineHandleHit(def, P, -30, 3), { kind: 'handle', i: 0, sign: -1 });
  assert.deepEqual(splineHandleHit(def, P, 40 + 5, -20), { kind: 'fit', i: 1 });
  assert.equal(splineHandleHit(def, P, 500, 500), null);
  // A fit point under a neighbour's handle end: the handle end wins.
  const near: SplineDef = { fit: [[0, 0], [15, 0]], closed: false, handles: [0, 0] };
  assert.deepEqual(splineHandleHit(near, P, 30, 0), { kind: 'handle', i: 0, sign: 1 });
  assert.deepEqual(splineHandleHit(near, P, 30, 0.5), { kind: 'handle', i: 0, sign: 1 });
});

test('draggedSpline: handle angles, rounding, Shift fine, normalisation', () => {
  const f = draggedSpline(def, { kind: 'handle', i: 0, sign: 1 }, [10, 10.4]);
  assert.equal(f.handles![0], 46); // atan2(10.4, 10) = 46.1 deg
  assert.equal(draggedSpline(def, { kind: 'handle', i: 0, sign: 1 }, [10, 10.4], { fine: true }).handles![0], 46.1);
  assert.equal(draggedSpline(def, { kind: 'handle', i: 0, sign: -1 }, [-10, 0]).handles![0], 0); // back end left = forward 0
  assert.equal(draggedSpline(def, { kind: 'handle', i: 0, sign: -1 }, [10, 0]).handles![0], 180);
  assert.equal(draggedSpline(def, { kind: 'handle', i: 0, sign: 1 }, [-10, -1e-12]).handles![0], 180); // -180 normalises to 180
  assert.equal(draggedSpline(def, { kind: 'handle', i: 0, sign: 1 }, [0, -10]).handles![0], -90);
  assert.deepEqual(f.handles!.slice(1), [90, null]);
  assert.deepEqual(f.fit, def.fit); assert.notEqual(f.fit, def.fit);
  assert.deepEqual(draggedSpline(def, { kind: 'handle', i: 0, sign: 1 }, [0, 0]).handles, [0, 90, null]);
  // Automatic handles stay null on the other points, and a def without handles gets a full array.
  const bare = draggedSpline({ fit: def.fit, closed: false }, { kind: 'handle', i: 2, sign: 1 }, [40, 10]);
  assert.deepEqual(bare.handles, [null, null, 90]);
});

test('draggedSpline: fit points snap to the grid, Shift to 0.01 mm', () => {
  assert.deepEqual(draggedSpline(def, { kind: 'fit', i: 1 }, [21.4, 9.6]).fit[1], [21, 10]);
  assert.deepEqual(draggedSpline(def, { kind: 'fit', i: 1 }, [21.456, 9.604], { fine: true }).fit[1], [21.46, 9.6]);
  assert.deepEqual(draggedSpline(def, { kind: 'fit', i: 1 }, [21.4, 9.6], { step: 5 }).fit[1], [20, 10]);
  assert.deepEqual(draggedSpline(def, { kind: 'fit', i: 1 }, [21.4, 9.6]).fit[0], [0, 0]);
});

test('dragged definitions rebuild with ids and point count kept; an unbuildable target is an error', () => {
  const start = { ...splineShape(def), ids: ['a', 'b', 'c', 'd', 'e', 'f'].slice(0, splineShape(def).points.length) } as ReturnType<typeof splineShape>;
  const moved = draggedSpline(def, { kind: 'fit', i: 1 }, [25, 12]);
  assert.equal(splineEditError(moved), null);
  const out = respline(start, moved);
  assert.deepEqual(out.ids, start.ids); assert.equal(out.points.length, start.points.length);
  const turned = draggedSpline(def, { kind: 'handle', i: 1, sign: 1 }, [20, 40]);
  assert.equal(splineEditError(turned), null);
  assert.equal(respline(start, turned).points.length, start.points.length);
  // Onto its neighbour: coincident fit points; and far outside the kernel's range.
  assert.notEqual(splineEditError(draggedSpline(def, { kind: 'fit', i: 1 }, [0, 0])), null);
  assert.notEqual(splineEditError(draggedSpline(def, { kind: 'fit', i: 1 }, [50000, 0])), null);
});

// The Viewport's pointer wiring (hit on down, live preview without emit, one emit on up, Escape restore) needs a canvas and camera:
// covered by the browser driver, not here.
