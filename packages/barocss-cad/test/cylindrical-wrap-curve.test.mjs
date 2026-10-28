import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCurve, evaluateSurface, curveDomain, splitSurfaceAtParameter } from '../dist/index.js';
import { segmentCurve, extrudedSurface } from '../dist/features/extruded-profile-solid.js';
import { composeCylindricalWrapCurve, isCylindricalWrapCurveError } from '../dist/features/cylindrical-wrap-curve.js';

const options = { curveId: 'world', pcurveId: 'uv' };
function cylinder() {
  const w = Math.SQRT1_2;
  return { kind: 'surface', id: 'quarter', degreeU: 2, degreeV: 1, knotsU: [0, 0, 0, 1, 1, 1], knotsV: [0, 0, 1, 1],
    controlPoints: [[[10, 0, 0], [10, 0, 30]], [[10, 10, 0], [10, 10, 30]], [[0, 10, 0], [0, 10, 30]]],
    weights: [[1, 1], [w, w], [1, 1]] };
}
function trigQuarter() {
  const center = [1.25, -2.75], radius = 7.3, startAngle = 0.37, sweep = Math.PI / 2;
  const start = [center[0] + radius * Math.cos(startAngle), center[1] + radius * Math.sin(startAngle)];
  const end = [center[0] + radius * Math.cos(startAngle + sweep), center[1] + radius * Math.sin(startAngle + sweep)];
  // The current native arc producer creates the actual stored coefficients. Never replace them with cardinal poles.
  const curve = segmentCurve({ kind: 'arc', start, end, center, radius, startAngle, sweep, length: radius * sweep }, -3, 'source_arc');
  return extrudedSurface(curve, -3, 14, 'native_quarter');
}
function closePoint(a, b, tolerance = 1e-11) {
  assert.equal(a.length, 3); assert.equal(b.length, 3);
  assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) <= tolerance, `${a} vs ${b}`);
}
function refused(action, code) {
  assert.throws(action, error => isCylindricalWrapCurveError(error) && (code === undefined || error.code === code));
}
function positive(value) { return BigInt(value.numerator) > 0n && BigInt(value.denominator) > 0n; }
function certificate(result) {
  const proof = result.proof;
  assert.equal(proof.authority, 'stored-homogeneous-bernstein-coefficients');
  assert.equal(proof.composedDegree, 3); assert.equal(proof.residualDegree, 6);
  assert.equal(proof.exactStoredModelBound, true); assert.equal(proof.globalEvaluatorErrorCertified, false);
  assert.equal(proof.topologyCertified, false);
  assert.ok(positive(proof.exactDenominatorLower)); assert.ok(positive(proof.storedDenominatorLower));
  assert.equal(proof.crossResiduals.length, 3);
  for (const axis of proof.crossResiduals) assert.equal(axis.length, 7);
  assert.ok(Number.isFinite(proof.worldError.upper) && proof.worldError.upper >= 0 && proof.worldError.upper <= proof.errorBudget);
  assert.ok(proof.errorBudget <= 1e-7); assert.ok(proof.counts.operations <= proof.maxOperations);
  assert.ok(proof.counts.operations <= 200000); assert.ok(proof.counts.gcdSteps <= 200000); assert.ok(proof.counts.maximumObservedBits <= 8192);
}
function explicitOracle(surface, u, v) {
  // Independent direct tensor-product rational evaluation, not the cubic composition or certificate implementation.
  const bu = [(1 - u) ** 2, 2 * u * (1 - u), u ** 2], bv = [1 - v, v], numerator = [0, 0, 0];
  let denominator = 0;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    const factor = bu[i] * bv[j] * surface.weights[i][j]; denominator += factor;
    for (let axis = 0; axis < 3; axis++) numerator[axis] += factor * surface.controlPoints[i][j][axis];
  }
  return numerator.map(value => value / denominator);
}

test('R10/H30 cylinder-intent quarter has independent vertical, horizontal and diagonal midpoint regressions', () => {
  const source = cylinder(), w = Math.SQRT1_2, middle = (2.5 + 5 * w) / (0.5 + 0.5 * w);
  for (const [line, expected] of [
    [{ start: [0, 0], end: [0, 1] }, [[10, 0, 0], [10, 0, 15], [10, 0, 30]]],
    [{ start: [0, 0.25], end: [1, 0.25] }, [[10, 0, 7.5], [middle, middle, 7.5], [0, 10, 7.5]]],
    [{ start: [0, 0], end: [1, 1] }, [[10, 0, 0], [middle, middle, 15], [0, 10, 30]]],
  ]) {
    const before = structuredClone(source), result = composeCylindricalWrapCurve(source, line, options); certificate(result);
    assert.equal(result.curve.degree, 3); assert.equal(result.curve.controlPoints.length, 4);
    assert.equal(result.pcurve.degree, 1); assert.equal(result.pcurve.controlPoints.length, 2);
    assert.deepEqual(curveDomain(result.curve), [0, 1]); assert.deepEqual(curveDomain(result.pcurve), [0, 1]);
    for (const [index, t] of [0, 0.5, 1].entries()) closePoint(evaluateCurve(result.curve, t), expected[index]);
    assert.deepEqual(source, before);
  }
});

test('actual arbitrary trigonometric producer poles remain the composition authority', () => {
  const source = trigQuarter(), line = { start: [0.13, 0.21], end: [0.84, 0.76] }, before = structuredClone({ source, line });
  const result = composeCylindricalWrapCurve(source, line, options); certificate(result);
  assert.deepEqual(result.original, source);
  assert.notEqual(result.original, source); assert.notEqual(result.original.controlPoints[0][0], source.controlPoints[0][0]);
  for (const t of [0, 0.125, 0.5, 0.875, 1]) {
    const u = line.start[0] * (1 - t) + line.end[0] * t, v = line.start[1] * (1 - t) + line.end[1] * t;
    closePoint(evaluateCurve(result.curve, t), explicitOracle(source, u, v));
    closePoint(evaluateCurve(result.curve, t), evaluateSurface(source, u, v));
    closePoint(evaluateCurve(result.pcurve, t), [u, v, 0]);
  }
  assert.deepEqual({ source, line }, before);
  // Regression samples permit evaluator roundoff. Only the exact coefficient proof controls admission.
});

test('reversed UV direction reverses both curves once and keeps the canonical shared parameter domain', () => {
  const source = trigQuarter(), start = [0.1, 0.2], end = [0.9, 0.8];
  const forward = composeCylindricalWrapCurve(source, { start, end }, options);
  const reversed = composeCylindricalWrapCurve(source, { start: end, end: start }, options); certificate(reversed);
  assert.deepEqual(reversed.curve.weights, [...forward.curve.weights].reverse());
  assert.deepEqual(reversed.curve.controlPoints, [...forward.curve.controlPoints].reverse());
  assert.deepEqual(reversed.pcurve.controlPoints, [[...end, 0], [...start, 0]]);
  for (const t of [0, 0.25, 0.5, 1]) closePoint(evaluateCurve(reversed.curve, t), evaluateCurve(forward.curve, 1 - t));
});

test('positive nonuniform weights in both source directions retain a whole-interval residual certificate', () => {
  const source = cylinder(); source.weights = [[0.75, 1.25], [0.6, 0.9], [1.5, 0.8]];
  const line = { start: [0.17, 0.22], end: [0.83, 0.91] }, result = composeCylindricalWrapCurve(source, line, options); certificate(result);
  for (const t of [0, 0.5, 1]) closePoint(evaluateCurve(result.curve, t), explicitOracle(source, line.start[0] * (1 - t) + line.end[0] * t, line.start[1] * (1 - t) + line.end[1] * t));
  assert.ok(result.curve.weights.every(weight => weight > 0));
});

test('endpoint table values are copied exactly and included in the actual stored residual', () => {
  const source = cylinder(), join = [0.4, 0.35], first = composeCylindricalWrapCurve(source, { start: [0, 0], end: join }, options);
  const shared = [...first.curve.controlPoints[3]], tableBefore = structuredClone(shared);
  const second = composeCylindricalWrapCurve(source, { start: join, end: [0.8, 0.6] }, { ...options, endpoints: [shared, null] });
  certificate(second); assert.deepEqual(second.curve.controlPoints[0], shared); assert.notEqual(second.curve.controlPoints[0], shared);
  assert.deepEqual(second.proof.endpointOrigins, ['table', 'nearest']); assert.deepEqual(shared, tableBefore);
  const moved = [...first.curve.controlPoints[0]]; moved[0] += 1e-12;
  const adjusted = composeCylindricalWrapCurve(source, { start: [0, 0], end: join }, { ...options, endpoints: [moved, null] });
  certificate(adjusted); assert.deepEqual(adjusted.curve.controlPoints[0], moved); assert.ok(adjusted.proof.worldError.upper > 0);
  refused(() => composeCylindricalWrapCurve(source, { start: [0, 0], end: join }, { ...options, endpoints: [[10.01, 0, 0], null] }), 'BINDING');
  refused(() => composeCylindricalWrapCurve(source, { start: [0, 0], end: join }, { ...options, endpoints: [moved, null], errorBudget: 1e-14 }), 'BINDING');
});

test('same source weights and UV produce identical stored weights for radial ruled-side consumers', () => {
  const inner = trigQuarter(), outer = structuredClone(inner), line = { start: [0.2, 0.1], end: [0.7, 0.8] };
  outer.id = 'outer';
  for (const row of outer.controlPoints) for (const p of row) { p[0] *= 1.1; p[1] *= 1.1; }
  const a = composeCylindricalWrapCurve(inner, line, options), b = composeCylindricalWrapCurve(outer, line, options);
  assert.deepEqual(a.curve.knots, b.curve.knots); assert.deepEqual(a.curve.weights, b.curve.weights);
  for (let i = 0; i < 4; i++) assert.equal(Object.is(a.curve.weights[i], b.curve.weights[i]), true);
  // Matching weights/basis is a necessary adapter condition, not a proof of axis/thickness or B-rep topology.
});

test('source, line and options remain unchanged and outputs own their coordinate arrays', () => {
  const source = trigQuarter(), line = { start: [0.2, 0.3], end: [0.8, 0.7] }, given = { ...options }, before = structuredClone({ source, line, given });
  const result = composeCylindricalWrapCurve(source, line, given);
  result.original.controlPoints[0][0][0] = 123; result.curve.controlPoints[0][0] = 456; result.pcurve.controlPoints[0][0] = 0.9;
  assert.deepEqual({ source, line, given }, before);
});

test('malformed source shapes, degree/domain/weights and nonfinite data refuse without partial output', () => {
  const line = { start: [0, 0], end: [1, 1] };
  for (const mutate of [
    source => { source.degreeU = 3; }, source => { source.degreeV = 2; }, source => { source.knotsU = [0, 0, 0, 2, 1, 2]; },
    source => { source.weights[1][0] = 0; }, source => { source.weights[1][0] = -1; }, source => { source.weights[1][0] = Infinity; },
    source => { source.controlPoints[1][0][0] = NaN; }, source => { source.controlPoints[1][0][0] = 10001; },
    source => { source.controlPoints[1].pop(); }, source => { source.extra = true; },
  ]) {
    const source = cylinder(); mutate(source); const before = structuredClone(source);
    refused(() => composeCylindricalWrapCurve(source, line, options), 'INPUT'); assert.deepEqual(source, before);
  }
  const getter = cylinder(); Object.defineProperty(getter, 'weights', { enumerable: true, get() { throw new Error('must not invoke'); } });
  refused(() => composeCylindricalWrapCurve(getter, line, options), 'INPUT');
  const trap = new Proxy({}, { getPrototypeOf() { throw new Error('untrusted error prototype'); } });
  const hostile = new Proxy(cylinder(), { getPrototypeOf() { throw trap; } });
  refused(() => composeCylindricalWrapCurve(hostile, line, options), 'INPUT');
  assert.equal(isCylindricalWrapCurveError(trap), false);
});

test('UV extrapolation, degenerate endpoints, unknown options and increased policy/work limits refuse', () => {
  const source = cylinder(), line = { start: [0, 0], end: [1, 1] };
  for (const invalid of [{ start: [-0.1, 0], end: [1, 1] }, { start: [0, 0], end: [1.1, 1] }, { start: [0, NaN], end: [1, 1] }]) refused(() => composeCylindricalWrapCurve(source, invalid, options), 'INPUT');
  refused(() => composeCylindricalWrapCurve(source, { start: [0.4, 0.5], end: [0.4, 0.5] }, options), 'GEOMETRY');
  for (const extra of [{ errorBudget: 1e-6 }, { errorBudget: 0 }, { maxOperations: 200001 }, { maxOperations: 0 }, { unsupported: true }, { curveId: 'uv' }]) refused(() => composeCylindricalWrapCurve(source, line, { ...options, ...extra }), 'INPUT');
  refused(() => composeCylindricalWrapCurve(source, line, { ...options, maxOperations: 1 }), 'BUDGET');
  const flat = cylinder(); for (const row of flat.controlPoints) for (let j = 0; j < row.length; j++) row[j] = [1, 2, 3];
  refused(() => composeCylindricalWrapCurve(flat, line, options), 'GEOMETRY');
});

test('subnormal input stays inside the same fixed rational work/bit context or refuses typed', () => {
  const source = cylinder(); source.controlPoints[0][0][0] = Number.MIN_VALUE;
  const before = structuredClone(source), line = { start: [Number.MIN_VALUE, 0], end: [0.9, 1] };
  try { certificate(composeCylindricalWrapCurve(source, line, options)); }
  catch (error) { assert.ok(isCylindricalWrapCurveError(error)); assert.ok(error.code === 'BUDGET' || error.code === 'BINDING'); }
  assert.deepEqual(source, before);
});

test('actual half-to-quarter direct copy retains its native U[0,.5] coefficients and original UV pcurve', () => {
  const center = [1.25, -2.75], radius = 7.3, startAngle = 0.37, sweep = Math.PI;
  const start = [center[0] + radius * Math.cos(startAngle), center[1] + radius * Math.sin(startAngle)];
  const end = [center[0] + radius * Math.cos(startAngle + sweep), center[1] + radius * Math.sin(startAngle + sweep)];
  const arc = segmentCurve({ kind: 'arc', start, end, center, radius, startAngle, sweep, length: radius * sweep }, -3, 'half_arc');
  const half = extrudedSurface(arc, -3, 14, 'native_half'), before = structuredClone(half);
  assert.deepEqual(half.knotsU, [0, 0, 0, 0.5, 0.5, 1, 1, 1]);
  const split = splitSurfaceAtParameter(half, { axis: 'u', parameter: 0.5, lowerSurfaceId: 'native_lower', upperSurfaceId: 'native_upper' });
  assert.equal(split.provenance.refinement.kind, 'direct-copy'); assert.equal(split.report.requiredInsertions, 0);
  const quarter = split.lower, quarterBefore = structuredClone(quarter);
  assert.deepEqual(quarter.knotsU, [0, 0, 0, 0.5, 0.5, 0.5]);
  assert.deepEqual(quarter.controlPoints, half.controlPoints.slice(0, 3)); assert.deepEqual(quarter.weights, half.weights.slice(0, 3));
  const a = [0.05, 0.15], b = [0.45, 0.8];
  const forward = composeCylindricalWrapCurve(quarter, { start: a, end: b }, options);
  const reverse = composeCylindricalWrapCurve(quarter, { start: b, end: a }, options);
  for (const result of [forward, reverse]) { certificate(result); assert.deepEqual(result.original, quarterBefore); }
  assert.deepEqual(forward.pcurve.controlPoints, [[...a, 0], [...b, 0]]);
  assert.deepEqual(reverse.pcurve.controlPoints, [[...b, 0], [...a, 0]]);
  assert.deepEqual(reverse.curve.controlPoints, [...forward.curve.controlPoints].reverse());
  assert.deepEqual(reverse.curve.weights, [...forward.curve.weights].reverse());
  for (const t of [0, 0.25, 0.5, 1]) {
    const u = a[0] * (1 - t) + b[0] * t, v = a[1] * (1 - t) + b[1] * t;
    closePoint(evaluateCurve(forward.curve, t), evaluateSurface(quarter, u, v));
    closePoint(evaluateCurve(forward.curve, t), explicitOracle(quarter, u / 0.5, v));
  }
  assert.deepEqual(quarter, quarterBefore); assert.deepEqual(half, before);
});

test('nonunit and translated source domains normalize exactly without rewriting knots or pcurve UV', () => {
  const source = cylinder(); source.knotsU = [-2, -2, -2, 3, 3, 3]; source.knotsV = [4, 4, 9, 9];
  const line = { start: [-1, 5], end: [2, 8] }, before = structuredClone(source), result = composeCylindricalWrapCurve(source, line, options);
  certificate(result); assert.deepEqual(result.original, before); assert.deepEqual(source, before);
  assert.deepEqual(result.pcurve.controlPoints, [[-1, 5, 0], [2, 8, 0]]);
  for (const t of [0, 0.5, 1]) {
    const u = -1 * (1 - t) + 2 * t, v = 5 * (1 - t) + 8 * t;
    closePoint(evaluateCurve(result.curve, t), evaluateSurface(source, u, v));
    closePoint(evaluateCurve(result.curve, t), explicitOracle(source, (u + 2) / 5, (v - 4) / 5));
  }
  const thirds = cylinder(); thirds.knotsU = [0, 0, 0, 3, 3, 3];
  const exactThirds = composeCylindricalWrapCurve(thirds, { start: [1, 0.2], end: [2, 0.8] }, options);
  certificate(exactThirds); assert.deepEqual(exactThirds.original.knotsU, thirds.knotsU);
  assert.deepEqual(exactThirds.pcurve.controlPoints, [[1, 0.2, 0], [2, 0.8, 0]]);
  closePoint(evaluateCurve(exactThirds.curve, 0), explicitOracle(thirds, 1 / 3, 0.2));
  // The exact difference of these stored endpoints need not itself be binary64. No exactFloat(span) gate is used.
  const decimal = cylinder(); decimal.knotsU = [0.1, 0.1, 0.1, 1, 1, 1];
  const decimalLine = { start: [0.2, 0.3], end: [0.8, 0.9] }, decimalResult = composeCylindricalWrapCurve(decimal, decimalLine, options);
  certificate(decimalResult); assert.deepEqual(decimalResult.original.knotsU, decimal.knotsU);
  assert.deepEqual(decimalResult.pcurve.controlPoints, [[0.2, 0.3, 0], [0.8, 0.9, 0]]);
  closePoint(evaluateCurve(decimalResult.curve, 0), evaluateSurface(decimal, 0.2, 0.3));
});

test('malformed native domains, extrapolation, zero/nonfinite/overflow spans and pcurve range refuse', () => {
  for (const [knotsU, knotsV, line] of [
    [[0, 0, 0, 0, 0, 0], [0, 0, 1, 1], { start: [0, 0], end: [0, 1] }],
    [[1, 1, 1, 0, 0, 0], [0, 0, 1, 1], { start: [0, 0], end: [1, 1] }],
    [[0, 0, 0, 1, 1, 1], [2, 2, 2, 2], { start: [0, 2], end: [1, 2] }],
    [[0, 0, 0, Infinity, Infinity, Infinity], [0, 0, 1, 1], { start: [0, 0], end: [1, 1] }],
    [[-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE], [0, 0, 1, 1], { start: [0, 0], end: [1, 1] }],
    [[0, 0, 0, 1, 1, 1], [-Number.MAX_VALUE, -Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE], { start: [0, 0], end: [1, 1] }],
    [[0, 0, 0, 0.5, 0.5, 0.5], [0, 0, 1, 1], { start: [0.1, 0], end: [0.6, 1] }],
    [[-2, -2, -2, 3, 3, 3], [4, 4, 9, 9], { start: [-2.1, 5], end: [2, 8] }],
    [[0, 0, 0, 1, 1, 1], [4, 4, 9, 9], { start: [0, 3.9], end: [1, 9] }],
    [[2000000, 2000000, 2000000, 2000001, 2000001, 2000001], [0, 0, 1, 1], { start: [2000000, 0], end: [2000001, 1] }],
  ]) {
    const source = cylinder(); source.knotsU = knotsU; source.knotsV = knotsV; const before = structuredClone(source);
    refused(() => composeCylindricalWrapCurve(source, line, options), 'INPUT'); assert.deepEqual(source, before);
  }
});
