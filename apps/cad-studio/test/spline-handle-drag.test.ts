// D353: dragging a spline's handles and fit points — geometry, hit precedence, dragged definitions and the rebuild contract.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draggedSpline, sameSplineDef, splineDragStarted, splineHandleGeometry, splineHandleHit, HANDLE_LENGTH, HANDLE_PICK, SPLINE_DRAG_START } from '../src/viewport/splineHandles';
import { respline, splineEditError, splineShape, type SplineDef } from '@barocss/cad-model/sketch/spline';

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

test('hit: nearest wins among handle ends and among fit points', () => {
  // Ends at x = 30 (fit 0 forward) and 32 (fit 1 back): the nearer one wins whichever comes first.
  const ends: SplineDef = { fit: [[0, 0], [31, 0]], closed: false, handles: [0, 0] };
  assert.deepEqual(splineHandleHit(ends, P, 31.5, 0), { kind: 'handle', i: 1, sign: -1 });
  assert.deepEqual(splineHandleHit(ends, P, 30.5, 0), { kind: 'handle', i: 0, sign: 1 });
  // Fit points 6 px apart, no handle end near: the nearer centre wins.
  const fits: SplineDef = { fit: [[0, 0], [3, 0]], closed: false, handles: [0, 0] };
  assert.deepEqual(splineHandleHit(fits, P, 4.5, 0), { kind: 'fit', i: 1 });
  assert.deepEqual(splineHandleHit(fits, P, 1.5, 0), { kind: 'fit', i: 0 });
});

test('hit: the pick radius is inclusive at exactly 8 px', () => {
  assert.equal(HANDLE_PICK, 8);
  assert.deepEqual(splineHandleHit(def, P, 30 + 8, 0), { kind: 'handle', i: 0, sign: 1 });
  assert.deepEqual(splineHandleHit(def, P, 0, 8), { kind: 'fit', i: 0 });
  assert.equal(splineHandleHit(def, P, 30 + 8 + 1e-6, 0), null);
});

test('geometry: a handle that projects to zero length stays finite at its fit point', () => {
  // A degenerate view: every plane point lands on one screen point, so no handle has a screen direction.
  const flat = () => [5, 5] as const;
  const g = splineHandleGeometry({ fit: [[0, 0], [20, 0]], closed: false, handles: [90, 0] }, flat);
  for (const k of g) { assert.ok([...k.c, ...k.fwd, ...k.back].every(Number.isFinite)); assert.deepEqual(k.fwd, [5, 5]); assert.deepEqual(k.back, [5, 5]); }
});

test('draggedSpline: a handle dragged onto its own fit point leaves the definition unchanged', () => {
  const out = draggedSpline(def, { kind: 'handle', i: 1, sign: 1 }, [20, 10]);
  assert.ok(sameSplineDef(out, def));
});

test('drag start threshold: more than 3 px, any direction', () => {
  assert.equal(SPLINE_DRAG_START, 3);
  assert.equal(splineDragStarted(0, 0), false);
  assert.equal(splineDragStarted(3, 0), false);
  assert.equal(splineDragStarted(2, 2), false); // 2.83 px
  assert.equal(splineDragStarted(0, -3.01), true);
  assert.equal(splineDragStarted(3, 3), true);
});

test('sameSplineDef: fit, closed and handles; missing handle equals null', () => {
  const a: SplineDef = { fit: [[0, 0], [10, 0], [10, 10]], closed: true, handles: [null, 45, null] };
  assert.ok(sameSplineDef(a, { ...a, fit: a.fit.map(f => [...f] as [number, number]), handles: [...a.handles!] }));
  assert.ok(sameSplineDef({ fit: a.fit, closed: true }, { fit: a.fit, closed: true, handles: [null, null, null] }));
  assert.ok(!sameSplineDef(a, { ...a, closed: false }));
  assert.ok(!sameSplineDef(a, { ...a, handles: [null, 46, null] }));
  assert.ok(!sameSplineDef(a, { ...a, handles: [null, null, null] }));
  assert.ok(!sameSplineDef(a, { ...a, fit: [[0, 0], [10, 0.001], [10, 10]] }));
  assert.ok(!sameSplineDef(a, { ...a, fit: a.fit.slice(0, 2), handles: [null, 45] }));
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

// The Viewport's pointer wiring (arm on down, activate past 3 px, live preview without emit, one emit on up, cancel paths) needs a canvas and camera:
// covered by the browser driver, not here.
