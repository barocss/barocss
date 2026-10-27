import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBezierCoonsSurface, evaluateCurve, evaluateSurface, evaluateSurfaceD1, validateSurface } from '../dist/index.js';

// Independent fixed Bernstein oracle: oracles-fixed.json, authored before production.
const EPS = 1e-9;
const vector = (actual, expected) => {
  assert.equal(actual.length, expected.length);
  expected.forEach((value, k) => assert.ok(Math.abs(actual[k] - value) <= EPS, `${actual} vs ${expected}`));
};
const curve = (id, degree, poles) => ({ kind: 'curve', id, degree,
  knots: [...Array(degree + 1).fill(0), ...Array(degree + 1).fill(1)],
  controlPoints: poles, weights: Array(degree + 1).fill(1) });
const bowed = () => ({
  bottom: curve('bottom', 2, [[0, 0, 0], [4, 0, 6], [8, 0, 0]]),
  top: curve('top', 2, [[0, 4, 0], [4, 4, 6], [8, 4, 0]]),
  left: curve('left', 2, [[0, 0, 0], [0, 2, 4], [0, 4, 0]]),
  right: curve('right', 2, [[8, 0, 0], [8, 2, 4], [8, 4, 0]]),
});
const net = [
  [[0, 0, 0], [0, 2, 4], [0, 4, 0]],
  [[4, 0, 6], [4, 2, 10], [4, 4, 6]],
  [[8, 0, 0], [8, 2, 4], [8, 4, 0]],
];
const build = boundaries => buildBezierCoonsSurface(boundaries, { surfaceId: 'patch' });

test('Bezier Coons: fixed bowed net, independent points, four boundaries and native D1', () => {
  const input = bowed(), before = structuredClone(input), result = build(input), s = result.surface;
  assert.equal(s.kind, 'surface'); assert.equal(s.id, 'patch');
  assert.equal(s.degreeU, 2); assert.equal(s.degreeV, 2);
  assert.deepEqual(s.knotsU, [0, 0, 0, 1, 1, 1]); assert.deepEqual(s.knotsV, [0, 0, 0, 1, 1, 1]);
  assert.deepEqual(s.controlPoints, net); assert.deepEqual(s.weights, [[1, 1, 1], [1, 1, 1], [1, 1, 1]]);
  validateSurface(s);
  vector(evaluateSurface(s, 0.5, 0.5), [4, 2, 5]);
  vector(evaluateSurface(s, 0.25, 0.75), [2, 3, 15 / 4]);
  const center = evaluateSurfaceD1(s, 0.5, 0.5);
  vector(center.point, [4, 2, 5]); vector(center.du, [8, 0, 0]); vector(center.dv, [0, 4, 0]);
  const offCenter = evaluateSurfaceD1(s, 0.25, 0.75);
  vector(offCenter.point, [2, 3, 15 / 4]); vector(offCenter.du, [8, 0, 6]); vector(offCenter.dv, [0, 4, -4]);
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    for (const [side, u, v, expected] of [
      ['bottom', t, 0, [8 * t, 0, 12 * t * (1 - t)]],
      ['top', t, 1, [8 * t, 4, 12 * t * (1 - t)]],
      ['left', 0, t, [0, 4 * t, 8 * t * (1 - t)]],
      ['right', 1, t, [8, 4 * t, 8 * t * (1 - t)]],
    ]) { vector(evaluateSurface(s, u, v), expected); vector(evaluateCurve(result.boundaries[side], t), expected); }
  }
  assert.deepEqual(s.controlPoints.map(row => row[0]), before.bottom.controlPoints);
  assert.deepEqual(s.controlPoints.map(row => row[2]), before.top.controlPoints);
  assert.deepEqual(s.controlPoints[0], before.left.controlPoints); assert.deepEqual(s.controlPoints[2], before.right.controlPoints);
  assert.deepEqual(result.boundaries, before);
  assert.deepEqual(result.report, { kind: 'bezier-coons-surface', lengthUnit: 'mm', degreeU: 2, degreeV: 2,
    boundaryIds: { bottom: 'bottom', top: 'top', left: 'left', right: 'right' },
    geometricValidity: 'not-certified', solid: false, topologyCertified: false });
  assert.equal(result.model.objects.length, 1); assert.deepEqual(result.model.objects[0], s);
  assert.equal(result.model.version, 0); assert.equal(result.model.lengthUnit, 'mm');
  assert.equal(typeof result.source, 'string'); assert.ok(result.source.length > 0);
  assert.deepEqual(input, before);
});

test('Bezier Coons: planar boundaries support different U and V degrees without degree elevation', () => {
  for (const [p, q] of [[1, 1], [3, 1], [1, 3]]) {
    const xs = p === 1 ? [0, 8] : [0, 8 / 3, 16 / 3, 8];
    const ys = q === 1 ? [0, 4] : [0, 4 / 3, 8 / 3, 4];
    const input = {
      bottom: curve('bottom', p, xs.map(x => [x, 0, 0])), top: curve('top', p, xs.map(x => [x, 4, 0])),
      left: curve('left', q, ys.map(y => [0, y, 0])), right: curve('right', q, ys.map(y => [8, y, 0])),
    };
    const result = build(input), s = result.surface;
    assert.equal(s.degreeU, p); assert.equal(s.degreeV, q);
    assert.equal(s.controlPoints.length, p + 1); assert.ok(s.controlPoints.every(row => row.length === q + 1));
    vector(evaluateSurface(s, 0.25, 0.75), [2, 3, 0]);
    const d = evaluateSurfaceD1(s, 0.25, 0.75); vector(d.du, [8, 0, 0]); vector(d.dv, [0, 4, 0]);
    assert.deepEqual(s.controlPoints.map(row => row[0]), input.bottom.controlPoints);
    assert.deepEqual(s.controlPoints.map(row => row[q]), input.top.controlPoints);
    assert.deepEqual(s.controlPoints[0], input.left.controlPoints); assert.deepEqual(s.controlPoints[p], input.right.controlPoints);
  }
});

test('Bezier Coons: accepted inputs and returned snapshots are isolated across calls and caller edits', () => {
  const input = bowed(), options = { surfaceId: 'patch' }, inputBefore = structuredClone(input), optionsBefore = structuredClone(options);
  const accepted = buildBezierCoonsSurface(input, options), acceptedBefore = structuredClone(accepted);
  const separate = build(input);
  input.bottom.controlPoints[1][2] = 7; input.left.weights[1] = 2; options.surfaceId = 'changed';
  assert.deepEqual(accepted, acceptedBefore);
  separate.boundaries.top.controlPoints[1][2] = 9; separate.surface.controlPoints[1][1][2] = 99;
  assert.deepEqual(accepted, acceptedBefore);
  const fresh = build(structuredClone(inputBefore));
  assert.deepEqual(fresh, acceptedBefore);
  const callerAfterEdit = structuredClone(input);
  accepted.boundaries.bottom.controlPoints[1][2] = -9;
  accepted.surface.controlPoints[1][1][2] = -99;
  assert.deepEqual(input, callerAfterEdit);
  assert.deepEqual(inputBefore, bowed()); assert.deepEqual(optionsBefore, { surfaceId: 'patch' });
  assert.deepEqual(fresh, acceptedBefore);
});

test('Bezier Coons: malformed and unsupported boundaries refuse without mutating the request or prior accepted result', () => {
  const accepted = build(bowed()), acceptedBefore = structuredClone(accepted);
  const invalid = [];
  const add = edit => { const input = bowed(); edit(input); invalid.push(input); };
  add(b => { b.bottom.weights[1] = 0.5; });
  add(b => { b.bottom.degree = 0; }); add(b => { b.bottom.degree = 4; });
  add(b => { b.top = curve('top', 1, [[0, 4, 0], [8, 4, 0]]); });
  add(b => { b.right = curve('right', 1, [[8, 0, 0], [8, 4, 0]]); });
  add(b => { b.bottom.knots = [0, 0, 0, 2, 2, 2]; });
  add(b => { b.bottom = { ...b.bottom, knots: [0, 0, 0, 0.5, 1, 1, 1], controlPoints: [[0, 0, 0], [2, 0, 3], [6, 0, 3], [8, 0, 0]], weights: [1, 1, 1, 1] }; });
  add(b => { b.bottom.controlPoints[0][0] = 1; });
  add(b => { b.bottom.controlPoints[1][2] = NaN; });
  add(b => { b.bottom.controlPoints[1][2] = 10001; });
  add(b => { b.bottom.controlPoints.pop(); });
  add(b => { b.bottom.weights = [1, 1]; });
  add(b => { b.bottom.controlPoints[1] = [4, 0]; });
  // Boundary poles are within range but their resulting interior control pole is outside ±10000 mm.
  add(b => { b.bottom.controlPoints[1][2] = 6000; b.top.controlPoints[1][2] = 6000; b.left.controlPoints[1][2] = 6000; b.right.controlPoints[1][2] = 6000; });
  invalid.push(null, {}, { ...bowed(), extra: true });
  for (const input of invalid) {
    const before = structuredClone(input);
    assert.throws(() => build(input), error => error instanceof Error && !(error instanceof TypeError) && error.message.startsWith('Bezier Coons surface:'));
    assert.deepEqual(input, before); assert.deepEqual(accepted, acceptedBefore);
  }
  for (const options of [null, {}, { surfaceId: '' }, { surfaceId: 'patch', extra: true }]) {
    const before = structuredClone(options), input = bowed(), inputBefore = structuredClone(input);
    assert.throws(() => buildBezierCoonsSurface(input, options), error => error instanceof Error && !(error instanceof TypeError) && error.message.startsWith('Bezier Coons surface:'));
    assert.deepEqual(options, before); assert.deepEqual(input, inputBefore); assert.deepEqual(accepted, acceptedBefore);
  }
});
