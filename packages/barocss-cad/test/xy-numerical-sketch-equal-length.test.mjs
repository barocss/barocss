import test from 'node:test';
import assert from 'node:assert/strict';
import { solveXYNumericalSketch, solveXYNumericalSketchPoints } from '../dist/index.js';

const doc = (points, segments, constraints, branchGuards = []) => ({
  format: 'barocss-xy-numerical-sketch', version: 0, profile: 'bounded-length-angle-v0', id: 'sk', lengthUnit: 'mm', angleUnit: 'rad',
  points: Object.entries(points).map(([id, position]) => ({ id, position })),
  segments: segments.map(([id, startPointId, endPointId]) => ({ id, startPointId, endPointId })), constraints, branchGuards,
});
const at = (result, id) => result.solution.points.find(p => p.id === id).position;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

test('equal-length keeps an arc end on its circle and leaves one rotational DOF', () => {
  const r = solveXYNumericalSketch(doc({ C: [0, 0], A: [10, 0], B: [0, 12] }, [['ra', 'C', 'A'], ['rb', 'C', 'B']], [
    { id: 'fc', kind: 'fixed', pointId: 'C', target: [0, 0] }, { id: 'fa', kind: 'fixed', pointId: 'A', target: [10, 0] },
    { id: 'eq', kind: 'equal-length', segmentA: 'ra', segmentB: 'rb' }]));
  assert.ok(r.ok, JSON.stringify(r.diagnostics));
  assert.ok(Math.abs(dist(at(r, 'C'), at(r, 'B')) - 10) < 1e-7);
  assert.equal(r.report.localDegreesOfFreedom, 1);
  assert.equal(r.report.residuals.find(x => x.constraintId === 'eq').component, 'equal-length');
});

test('a slot as lines, centres and radii: tangency by ±90° angles, one radius lock, fully defined', () => {
  // Outline P0→P1 (line), P1→P2 (arc about C1), P2→P3 (line), P3→P0 (arc about C0); seeds are rough.
  const r = solveXYNumericalSketch(doc(
    { P0: [0, -6], P1: [40, -5], P2: [41, 7], P3: [1, 6], C0: [0, 0.5], C1: [40, 0.5] },
    [['s0', 'P0', 'P1'], ['s2', 'P2', 'P3'], ['a1', 'C1', 'P1'], ['b1', 'C1', 'P2'], ['a3', 'C0', 'P3'], ['b3', 'C0', 'P0']],
    [{ id: 'anchor', kind: 'fixed', pointId: 'P0', target: [0, -6] }, { id: 'h0', kind: 'horizontal', segmentId: 's0' },
      { id: 'l0', kind: 'length', segmentId: 's0', lengthMM: 40 },
      { id: 'e1', kind: 'equal-length', segmentA: 'a1', segmentB: 'b1' }, { id: 'e3', kind: 'equal-length', segmentA: 'a3', segmentB: 'b3' },
      { id: 'r1', kind: 'length', segmentId: 'a1', lengthMM: 6 }, { id: 'r3', kind: 'equal-length', segmentA: 'a3', segmentB: 'a1' },
      { id: 't1', kind: 'signed-angle', segmentA: 's0', segmentB: 'a1', angleRad: -Math.PI / 2 },
      { id: 't2', kind: 'signed-angle', segmentA: 's2', segmentB: 'b1', angleRad: -Math.PI / 2 },
      { id: 't3', kind: 'signed-angle', segmentA: 's2', segmentB: 'a3', angleRad: -Math.PI / 2 },
      { id: 't0', kind: 'signed-angle', segmentA: 's0', segmentB: 'b3', angleRad: -Math.PI / 2 }]));
  // A semicircle's centre lies on its chord, so an oriented-triplet guard (strictly > 0) cannot hold there.
  assert.ok(r.ok, JSON.stringify(r.diagnostics));
  const near = (p, q) => assert.ok(dist(p, q) < 1e-6, `${p} vs ${q}`);
  near(at(r, 'P1'), [40, -6]); near(at(r, 'P2'), [40, 6]); near(at(r, 'P3'), [0, 6]); near(at(r, 'C1'), [40, 0]); near(at(r, 'C0'), [0, 0]);
  assert.equal(r.report.localDegreesOfFreedom, 0);
});

test('equal-length refusals and the 16-segment budget', () => {
  const pts = Object.fromEntries(Array.from({ length: 16 }, (_, i) => ['p' + i, [Math.cos(i / 8 * Math.PI) * 20, Math.sin(i / 8 * Math.PI) * 20]]));
  const ring = n => Array.from({ length: n }, (_, i) => ['s' + i, 'p' + i, 'p' + ((i + 1) % 16)]);
  assert.equal(solveXYNumericalSketch(doc(pts, ring(16), [])).ok, true);
  const tooMany = doc(pts, [...ring(16), ['extra', 'p0', 'p8']], []);
  assert.equal(solveXYNumericalSketch(tooMany).diagnostics[0].code, 'LIMIT');
  const same = doc(pts, ring(3), [{ id: 'e', kind: 'equal-length', segmentA: 's0', segmentB: 's0' }]);
  assert.equal(solveXYNumericalSketch(same).diagnostics[0].code, 'REFERENCE');
  const extra = doc(pts, ring(3), [{ id: 'e', kind: 'equal-length', segmentA: 's0', segmentB: 's1', lengthMM: 3 }]);
  assert.equal(solveXYNumericalSketch(extra).ok, false);
});

test('equal-length analytic Jacobian matches central finite differences', async () => {
  const { evaluate } = await import('../dist/xy-numerical-sketch-solver-internal.js');
  const d = doc({ A: [1, 2], B: [7, -3], C: [-4, 5], D: [2.5, 9] }, [['ab', 'A', 'B'], ['cd', 'C', 'D']], [{ id: 'e', kind: 'equal-length', segmentA: 'ab', segmentB: 'cd' }]);
  const x = d.points.flatMap(p => p.position), e = evaluate(d, x), h = 1e-6;
  for (let j = 0; j < x.length; j++) {
    const plus = [...x], minus = [...x]; plus[j] += h; minus[j] -= h;
    const fd = (evaluate(d, plus).residuals[0].residual - evaluate(d, minus).residuals[0].residual) / (2 * h);
    assert.ok(Math.abs(fd - e.jacobian[0][j]) < 1e-8, `column ${j}: ${fd} vs ${e.jacobian[0][j]}`);
  }
});

test('the -v1 profile admits larger sketches with the same solver; v0 keeps its limits', () => {
  const N = 40, pts = Object.fromEntries(Array.from({ length: N }, (_, i) => ['p' + i, [Math.cos(i / N * 2 * Math.PI) * 30, Math.sin(i / N * 2 * Math.PI) * 30]]));
  const ring = Array.from({ length: N }, (_, i) => ['s' + i, 'p' + i, 'p' + ((i + 1) % N)]);
  const eq = Array.from({ length: N - 1 }, (_, i) => ({ id: 'e' + i, kind: 'equal-length', segmentA: 's0', segmentB: 's' + (i + 1) }));
  const big = { ...doc(pts, ring, eq), profile: 'bounded-length-angle-v1' };
  const r = solveXYNumericalSketchPoints(big);
  assert.equal(r.ok, true, JSON.stringify(r.diagnostics));
  assert.equal(r.report.limits.points, 64);
  assert.ok(r.solution.points.length === N && !('model' in r.solution), 'points only, no native model');
  // The native model construction keeps its own bound (16 geometry declarations).
  assert.equal(solveXYNumericalSketch(big).diagnostics[0].code, 'COMPILATION');
  assert.equal(solveXYNumericalSketchPoints({ ...big, profile: 'bounded-length-angle-v0' }).diagnostics[0].code, 'LIMIT');
});
