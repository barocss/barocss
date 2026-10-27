import test from 'node:test';
import assert from 'node:assert/strict';
import { arcOf, solveOutline, type P2 } from '../src/sketch/profile';
import { checkEdit, type Polygon } from '../src/sketch/rules';
import { settleShape } from '../src/sketch/settle';

// Existing CAD solver acceptance units: mm for linear residuals, radians for angles.
const LINEAR = 1e-7, ANGULAR = 1e-9;
const distance = (a: P2, b: P2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const linear = (actual: number, expected: number) => {
  assert.ok(Number.isFinite(actual));
  assert.ok(Math.abs(actual - expected) <= LINEAR, `${actual} vs ${expected} mm`);
};
const angle = (a: P2, b: P2) => Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]);
const angular = (actual: number, expected: number) => {
  assert.ok(Number.isFinite(actual));
  const residual = Math.atan2(Math.sin(actual - expected), Math.cos(actual - expected));
  assert.ok(Math.abs(residual) <= ANGULAR, `${actual} vs ${expected} rad`);
};
const vector = (from: P2, to: P2): P2 => [to[0] - from[0], to[1] - from[1]];

test('accepted outline coordinates retain the driving noninteger length and off-grid anchor', () => {
  const anchor: P2 = [0.123456789, -0.987654321], width = 10.0000004, height = 7.7654321;
  const points: P2[] = [anchor, [anchor[0] + width, anchor[1]],
    [anchor[0] + width, anchor[1] + height], [anchor[0], anchor[1] + height]];
  const before = structuredClone(points);
  const result = solveOutline(points, { lengths: { 0: width, 1: height } });
  assert.ok(result.ok, !result.ok ? result.reason : '');
  linear(distance(result.points[0], anchor), 0);
  linear(distance(result.points[0], result.points[1]), width);
  linear(distance(result.points[1], result.points[2]), height);
  linear(result.points[0][1], result.points[1][1]);
  linear(result.points[1][0], result.points[2][0]);
  linear(result.points[2][1], result.points[3][1]);
  linear(result.points[3][0], result.points[0][0]);
  assert.deepEqual(points, before, 'solving must not edit the input outline');
});

test('a successful edit adopts off-grid circle centres without changing circle radii or driving values', () => {
  const anchor: P2 = [0.123456789, 0.234567891], centre: P2 = [3.987654321, 4.876543219];
  const dx = centre[0] - anchor[0], dy = centre[1] - anchor[1], radius = 1.23456789;
  const candidate: Polygon = {
    kind: 'polygon', closed: true,
    points: [anchor, [20.1234567, anchor[1]], [20.1234567, 15.7654321], [anchor[0], 15.7654321]],
    circles: [{ c: centre, r: radius }],
    rules: [{ kind: 'cdx', a: 0, circle: 0, value: dx }, { kind: 'cdy', a: 0, circle: 0, value: dy }],
  };
  const before = structuredClone(candidate);
  const edited = checkEdit(candidate, null);
  assert.ok(edited.ok, !edited.ok ? edited.reason : '');
  const circle = edited.shape.circles?.[0];
  assert.ok(circle);
  linear(distance(edited.shape.points[0], anchor), 0);
  linear(circle.c[0] - edited.shape.points[0][0], dx);
  linear(circle.c[1] - edited.shape.points[0][1], dy);
  linear(distance(circle.c, centre), 0);
  assert.equal(circle.r, radius);
  assert.deepEqual(edited.shape.rules, candidate.rules);
  assert.deepEqual(circle.c, edited.report.circles[0], 'the adopted circle is the reported solution');
  assert.deepEqual(candidate, before);
});

test('final arc points and bulge preserve the noninteger radius and tangent angles', () => {
  const anchor: P2 = [0.123456789, 0.234567891], width = 40.0000004, radius = 10.0000004;
  const x = anchor[0] + width, top = anchor[1] + 2 * radius;
  const points: P2[] = [anchor, [x, anchor[1]], [x, top], [anchor[0], top]];
  const constraints = { lengths: { 0: width }, radii: { 1: radius }, tangents: [1, 2] };
  const bulges = [0, 1, 0, 0], before = structuredClone({ points, constraints, bulges });
  const result = solveOutline(points, constraints, bulges);
  assert.ok(result.ok, !result.ok ? result.reason : '');
  const arc = arcOf(result.points[1], result.points[2], result.bulges[1]);
  linear(distance(result.points[0], anchor), 0);
  linear(distance(result.points[0], result.points[1]), width);
  linear(arc.radius, radius);
  linear(distance(arc.center, result.points[2]), radius);
  linear(distance(arc.center, [x, anchor[1] + radius]), 0);
  angular(arc.sweep, Math.PI);
  angular(angle(vector(result.points[0], result.points[1]), vector(arc.center, result.points[1])), -Math.PI / 2);
  angular(angle(vector(result.points[2], result.points[3]), vector(arc.center, result.points[2])), -Math.PI / 2);
  assert.ok(result.bulges[1] > 0, 'the arc keeps its original turning direction');
  assert.deepEqual({ points, constraints, bulges }, before);
});

test('final oblique edges retain an explicit angular constraint at the existing angular tolerance', () => {
  const origin: P2 = [0.123456789, 0.234567891], heading = 0.234567891, turn = 1.234567891;
  const p1: P2 = [origin[0] + 1.23456789 * Math.cos(heading), origin[1] + 1.23456789 * Math.sin(heading)];
  const p2: P2 = [p1[0] + 2.34567891 * Math.cos(heading + turn), p1[1] + 2.34567891 * Math.sin(heading + turn)];
  const points: P2[] = [origin, p1, p2];
  const result = solveOutline(points, {
    hv: { h: [], v: [] },
    rules: [{ kind: 'fix', point: 1, at: p1 }, { kind: 'fix', point: 2, at: p2 },
      { kind: 'angle', a: 0, b: 1, value: (Math.PI - turn) * 180 / Math.PI }],
  });
  assert.ok(result.ok, !result.ok ? result.reason : '');
  linear(distance(result.points[0], origin), 0);
  linear(distance(result.points[1], p1), 0);
  linear(distance(result.points[2], p2), 0);
  angular(angle(vector(result.points[1], result.points[0]), vector(result.points[1], result.points[2])), turn - Math.PI);
});

test('ordinary valid geometry stays accepted and an existing impossible arc edit preserves the previous shape', t => {
  const previous: Polygon = {
    kind: 'polygon', closed: true, points: [[0, 0], [40, 0], [40, 20], [0, 20]],
    bulges: [0, 1, 0, 0], lengths: { 0: 40 }, radii: { 1: 10 }, tangents: [1, 2],
  };
  const accepted = checkEdit(previous, null);
  assert.ok(accepted.ok, !accepted.ok ? accepted.reason : '');
  assert.deepEqual(accepted.shape.points, previous.points);
  const before = structuredClone(accepted.shape);
  // Existing engine.test.ts failure case: a 20 mm chord cannot use radius 3 mm.
  const failed = settleShape({ ...accepted.shape, lengths: { 0: 40, 3: 20 }, radii: { 1: 3 } }, accepted.shape);
  assert.ok(failed.error);
  t.diagnostic(failed.error);
  assert.equal(failed.error, 'XY numerical sketch: Bounded local solve did not meet fixed residual tolerances; this is not an inconsistency proof');
  assert.doesNotMatch(failed.error, /These constraints conflict with each other or with the H\/V edges/);
  assert.equal(failed.shape, accepted.shape);
  assert.deepEqual(accepted.shape, before);
});

// The first actual five-case run exposed the solver's NONCONVERGENCE message on this existing arc input.
// The message originates at solver-internal.ts:97; no fabricated failure or mock substitutes for it.
