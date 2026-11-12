import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProfileLoop, checkBrep } from '@barocss/cad';
import { emptyDoc, withNode } from '../src/engine/doc';
import { partBreps } from '../src/engine/evaluate';
import { fixedTriangleLengthSeed } from '../src/sketch/fixedTriangleLength';
import { profileOf } from '../src/sketch/loops';
import { solveOutline, type P2 } from '../src/sketch/profile';
import { commitDimension, commitInlineDimension, constraintsOf, isVerifiedFixedTriangleEdit, type Polygon } from '../src/sketch/rules';
import { settleShape } from '../src/sketch/settle';

const old = 131.95;
const target = 124.05;
const original = (): Polygon => ({
  kind: 'polygon', closed: true,
  points: [[0, 0], [4, 0], [130.35031249999975, 20.484104353190723]],
  lengths: { 1: 128, 2: old }, hv: { h: [], v: [] }, rules: [{ kind: 'fix', point: 1, at: [4, 0] }],
  ids: ['e1', 'e2', 'e3'],
});
const winding = ([a, b, c]: P2[]) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const near = (actual: number, expected: number, limit = 1e-7) =>
  assert.ok(Math.abs(actual - expected) <= limit, `${actual} vs ${expected} (±${limit})`);
const separation = (a: P2, b: P2) => Math.hypot(b[0] - a[0], b[1] - a[1]);

test('one inline edit recovers the D857 CCW branch while the ordinary one-shot retains its refusal', () => {
  const s = original(), untouched = structuredClone(s);
  const direct = commitDimension(s, 'len2', target);
  assert.ok(!direct.ok);
  assert.match(direct.reason, /Bounded local solve/);
  const edit = commitInlineDimension(s, 'len2', target);
  assert.ok(edit.ok);
  assert.equal(edit.report.recoveredFixedTriangle, true);
  assert.equal(edit.report.rank, 6);
  assert.equal(edit.report.rows, 6);
  assert.equal(edit.report.dof, 0);
  assert.deepEqual(edit.shape.points.slice(0, 2), s.points.slice(0, 2));
  assert.deepEqual(edit.shape.lengths, { 1: 128, 2: target });
  assert.deepEqual(edit.shape.rules, s.rules);
  assert.deepEqual(edit.shape.ids, s.ids);
  assert.deepEqual(s, untouched);
  const [a, b, c] = edit.shape.points;
  near(separation(a, c), target);
  near(separation(b, c), 128);
  near(c[0], -122.4496875);
  near(c[1], 19.861433260274737);
  assert.ok(winding(edit.shape.points) > 0);

  const profile = profileOf([edit.shape]);
  assert.ok('node' in profile);
  const doc = withNode(withNode(emptyDoc(), profile.node), { kind: 'extrude', sketch: 0, height: 6 });
  const [part] = partBreps(doc);
  assert.equal(checkBrep(part.brep, { strict: true }).valid, true);
  assert.deepEqual(part.brep.faces.map(face => face.name).sort(), ['n1.bottom', 'n1.side[e1]', 'n1.side[e2]', 'n1.side[e3]', 'n1.top']);
});

test('the verified edit keeps off-grid fixed vertices and belongs to exactly its source and shape', () => {
  const s = original();
  const shift = ([x, y]: P2): P2 => [x + 5e-8, y - 5e-8];
  s.points = s.points.map(shift);
  s.rules = [{ kind: 'fix', point: 1, at: shift([4, 0]) }];
  const edit = commitInlineDimension(s, 'len2', target);
  assert.ok(edit.ok && edit.report.recoveredFixedTriangle);
  assert.deepEqual(edit.shape.points.slice(0, 2), s.points.slice(0, 2));
  assert.equal(isVerifiedFixedTriangleEdit(edit.shape, s), true);
  assert.equal(isVerifiedFixedTriangleEdit(edit.shape, { ...s }), false);
  assert.equal(isVerifiedFixedTriangleEdit({ ...edit.shape }, s), false);
  const applied = settleShape(edit.shape, s);
  assert.equal(applied.error, null);
  assert.equal(applied.shape, edit.shape);
});

test('translated and rotated seed preserves both fixed points and upper relative orientation', () => {
  const s = original(), angle = 37 * Math.PI / 180;
  const rotate = ([x, y]: P2): P2 => [21 + x * Math.cos(angle) - y * Math.sin(angle), -9 + x * Math.sin(angle) + y * Math.cos(angle)];
  s.points = s.points.map(rotate);
  s.rules = [{ kind: 'fix', point: 1, at: rotate([4, 0]) }];
  const seed = fixedTriangleLengthSeed(s, target);
  assert.ok(seed);
  assert.deepEqual(seed.slice(0, 2), s.points.slice(0, 2));
  near(separation(seed[0], seed[2]), target);
  near(separation(seed[1], seed[2]), 128);
  assert.ok(winding(seed) > 0);
  assert.equal(buildProfileLoop(seed.map(start => ({ kind: 'line', start }))).reversed, false);
});

test('ordinary successes, invalid values and unrelated dimensions retain exact edit results', () => {
  const s = original();
  const ordinary = commitDimension(s, 'len2', 131.9);
  assert.ok(ordinary.ok);
  assert.deepEqual(commitInlineDimension(s, 'len2', 131.9), ordinary);
  for (const value of [NaN, Infinity, 0.0005, old, 132.05]) {
    assert.deepEqual(commitInlineDimension(s, 'len2', value), commitDimension(s, 'len2', value));
  }
  assert.deepEqual(commitInlineDimension(s, 'len1', 127.95), commitDimension(s, 'len1', 127.95));
});

test('admission rejects unsupported recipes, malformed source and degenerate or impossible targets', () => {
  const s = original();
  for (const value of [124, 124 + 5e-8, 132 - 5e-8, 132, 132.05, old, NaN, Infinity]) {
    assert.equal(fixedTriangleLengthSeed(s, value), null, String(value));
  }
  const excluded: [string, Polygon][] = [
    ['open', { ...s, closed: false }],
    ['construction', { ...s, construction: true }],
    ['implicit horizontal', { ...s, hv: undefined }],
    ['horizontal', { ...s, hv: { h: [0], v: [] } }],
    ['extra length', { ...s, lengths: { 0: 4, ...s.lengths } }],
    ['missing length', { ...s, lengths: { 1: 128 } }],
    ['wrong fixed point', { ...s, rules: [{ kind: 'fix', point: 2, at: s.points[2] }] }],
    ['extra relation', { ...s, rules: [...s.rules!, { kind: 'fix', point: 2, at: s.points[2] }] }],
    ['unsolved length', { ...s, lengths: { 1: 127, 2: old } }],
    ['drifted fixed point', { ...s, points: [[0, 0], [4 + 5e-8, 0], s.points[2]] }],
    ['unsolved fixed point', { ...s, rules: [{ kind: 'fix', point: 1, at: [4.01, 0] }] }],
    ['arc', { ...s, bulges: [0, 0.2, 0] }],
    ['invalid bulge', { ...s, bulges: [0, NaN, 0] }],
    ['malformed bulge array', { ...s, bulges: [0] }],
    ['attached circle', { ...s, circles: [{ c: [40, 3], r: 1 }] }],
    ['mirrored', { ...s, points: s.points.map(([x, y]) => [x, -y]) }],
    ['out of range', { ...s, points: s.points.map(([x, y]) => [x + 10000, y]), rules: [{ kind: 'fix', point: 1, at: [10004, 0] }] }],
  ];
  for (const [label, shape] of excluded) assert.equal(fixedTriangleLengthSeed(shape, target), null, label);
});

test('only typed native nonconvergence without proven conflict requests a seed', () => {
  const s = original();
  let attempts = 0;
  const recover = () => { attempts++; return fixedTriangleLengthSeed(s, target); };
  const success = solveOutline(s.points, constraintsOf({ ...s, lengths: { 1: 128, 2: 131.9 } }), s.bulges, recover);
  assert.ok(success.ok);
  assert.equal(attempts, 0);
  const contradiction = solveOutline([[0, 0], [30, 0], [30, 20], [0, 20]], {
    hv: { h: [0, 2], v: [1, 3] }, lengths: { 0: 30, 2: 40 },
  }, undefined, recover);
  assert.ok(!contradiction.ok && contradiction.conflict);
  assert.equal(attempts, 0);
  const outside = solveOutline([[0, 0], [4, 0], [10001, 12]], constraintsOf(s), s.bulges, recover);
  assert.ok(!outside.ok);
  assert.equal(attempts, 0);
  const native = solveOutline(s.points, constraintsOf({ ...s, lengths: { 1: 128, 2: target } }), s.bulges, recover);
  assert.ok(native.ok && native.recoveredFixedTriangle);
  assert.equal(attempts, 1);
});

test('recovery rejects a seed that would iterate or select the opposite branch', () => {
  const s = original();
  const c = constraintsOf({ ...s, lengths: { 1: 128, 2: target } });
  const originalResult = solveOutline(s.points, c);
  assert.ok(!originalResult.ok);
  const seed = fixedTriangleLengthSeed(s, target);
  assert.ok(seed);
  const [a, b, p] = seed;
  assert.deepEqual(solveOutline(s.points, c, undefined, () => [a, b, [p[0] + 0.01, p[1]]]), originalResult);
  assert.deepEqual(solveOutline(s.points, c, undefined, () => [a, b, [p[0], -p[1]]]), originalResult);
});
