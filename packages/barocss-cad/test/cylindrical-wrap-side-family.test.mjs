import test from 'node:test';
import assert from 'node:assert/strict';
import { brepFromPrismatic, prismaticFromProfile } from '../dist/index.js';
import { buildCylindricalWrapAssembly } from '../dist/features/cylindrical-wrap-assembly.js';
import { certifyCylindricalWrapChartComponent, chartComponentContext } from '../dist/features/cylindrical-wrap-chart-component.js';
import { certifyCylindricalWrapSideFamily } from '../dist/features/cylindrical-wrap-side-family.js';
import { isCylindricalWrapChartError } from '../dist/features/cylindrical-wrap-chart.js';

function rectangle(prefix, x0, z0, x1, z1, clockwise = false, flip = false, x = 8) {
  const vertices = clockwise ? [[x0, z0], [x0, z1], [x1, z1], [x1, z0]] : [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], curves = [], uses = [];
  for (let i = 0; i < 4; i++) {
    const a = vertices[i], b = vertices[(i + 1) % 4], poles = [];
    for (let j = 0; j < 4; j++) poles.push([x, a[0] + (b[0] - a[0]) * j / 3, a[1] + (b[1] - a[1]) * j / 3]);
    poles[0] = [x, ...a]; poles[3] = [x, ...b];
    const curve = { kind: 'curve', id: `${prefix}_${i}`, degree: 3, knots: [0, 0, 0, 0, 1, 1, 1, 1], controlPoints: poles, weights: [0.5, 0.75, 1, 0.625] };
    const reversed = flip && i % 2 === 1;
    if (reversed) { curve.controlPoints.reverse(); curve.weights.reverse(); }
    curves.push(curve); uses.push({ curve: curve.id, sense: reversed ? 'reversed' : 'forward' });
  }
  return { curves, ring: { uses, interiorHint: [x, (x0 + x1) / 2, (z0 + z1) / 2] } };
}
function inputWithHole() {
  const outer = rectangle('outer', 1, -3, 7, 5, false, true), hole = rectangle('hole', 2, -1, 3, 2, true, true);
  return { curves: [...outer.curves, ...hole.curves], outer: outer.ring, holes: [hole.ring] };
}
function simple(x = 8) { const outer = rectangle('edge', 1, 0, 7, 8, false, false, x); return { curves: outer.curves, outer: outer.ring, holes: [] }; }
function piece(base) {
  const original = structuredClone(base), outer = { ...structuredClone(base), id: `${base.id}_outer` };
  for (const p of outer.controlPoints) { p[0] *= 2; p[1] *= 2; }
  const controlPoints = [], weights = [];
  for (let i = 0; i < 4; i++) { controlPoints.push([[...original.controlPoints[i]], [...outer.controlPoints[i]]]); weights.push([base.weights[i], base.weights[i]]); }
  return { base: original, outer, side: { kind: 'surface', id: `${base.id}_side`, degreeU: 3, degreeV: 1, knotsU: [...base.knots], knotsV: [0, 0, 1, 1], controlPoints, weights } };
}
function pieces(input) { return input.curves.map(piece); }
function refused(action, codes = ['INPUT', 'SUPPORT', 'BUDGET', 'UNRESOLVED']) { assert.throws(action, error => isCylindricalWrapChartError(error) && codes.includes(error.code)); }
function receipt(result, component, n) {
  assert.equal(result.original.length, n); assert.equal(result.bindings.length, n);
  assert.deepEqual(result.componentCounts, component.counts); assert.notEqual(result.componentCounts, component.counts);
  assert.ok(result.counts.totalOperations > component.counts.totalOperations && result.counts.totalOperations <= 200000);
  assert.ok(result.counts.work > component.counts.work); assert.equal(result.counts.curves, n); assert.equal(result.limits.curves, 32);
  assert.equal(result.meaning.exactCoefficientBinding, true); assert.equal(result.meaning.sideFamilyEmbeddingCertified, true); assert.equal(result.meaning.regularSidesCertified, true);
  assert.equal(result.meaning.nonadjacentSidesDisjoint, true); assert.equal(result.meaning.adjacentSidesShareOnlyPrescribedRadialEdge, true);
  for (const key of ['sourceCarrierCertified', 'originalNativeUVBindingCertified', 'retainedFaceClosureCertified', 'topologyCertified', 'physicalBrepCertified', 'solidQualified', 'representedVolumeCertified', 'globalNativeEvaluatorErrorCertified', 'generalTextSupported', 'combinedConstructionBudgetCertified']) assert.equal(result.meaning[key], false);
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.original) && Object.isFrozen(result.original[0].side.controlPoints[0][0]) && Object.isFrozen(result.counts.rational));
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
}
function r(n, d = 1n) { return { n, d }; }
function add(a, b) { return r(a.n * b.d + b.n * a.d, a.d * b.d); }
function mul(a, b) { return r(a.n * b.n, a.d * b.d); }
function equal(a, b) { assert.equal(a.n * b.d, b.n * a.d); }
function represented(value) {
  if (value === 0) return r(0n);
  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value);
  const bits = view.getBigUint64(0), exponent = Number(bits >> 52n & 2047n), significand = (exponent ? 1n << 52n : 0n) + (bits & 0xfffffffffffffn), power = (exponent || 1) - 1075, signed = bits >> 63n ? -significand : significand;
  return power >= 0 ? r(signed << BigInt(power)) : r(signed, 1n << BigInt(-power));
}
function coefficientOracle(input) {
  // Complete homogeneous tensor coefficients, not sampled approval or a regenerated carrier.
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    const weight = represented(input.base.weights[i]), storedWeight = represented(input.side.weights[i][j]); equal(storedWeight, weight);
    for (let axis = 0; axis < 3; axis++) {
      const expected = mul(mul(represented(input.base.controlPoints[i][axis]), weight), r(BigInt(axis < 2 ? j + 1 : 1)));
      equal(mul(represented(input.side.controlPoints[i][j][axis]), storedWeight), expected);
    }
  }
}
function evaluate(values, t) {
  let row = values; const other = r(t.d - t.n, t.d);
  while (row.length > 1) { const next = []; for (let i = 0; i + 1 < row.length; i++) next.push(add(mul(row[i], other), mul(row[i + 1], t))); row = next; }
  return row[0];
}
function closedFormOracle(input, t, radial) {
  // Independent exact evaluation also checks which native axis is radial; the certificate uses coefficients only.
  for (let axis = 0; axis < 3; axis++) {
    const a = [], w = [], rows = [], denominators = [];
    for (let i = 0; i < 4; i++) {
      const weight = represented(input.base.weights[i]); a.push(mul(represented(input.base.controlPoints[i][axis]), weight)); w.push(weight);
      const points = [], weights = [];
      for (let j = 0; j < 2; j++) { const value = represented(input.side.weights[i][j]); points.push(mul(represented(input.side.controlPoints[i][j][axis]), value)); weights.push(value); }
      rows.push(evaluate(points, radial)); denominators.push(evaluate(weights, radial));
    }
    const baseNumerator = evaluate(a, t), baseDenominator = evaluate(w, t), sideNumerator = evaluate(rows, t), sideDenominator = evaluate(denominators, t);
    const scale = axis < 2 ? add(r(1n), radial) : r(1n);
    equal(mul(sideNumerator, baseDenominator), mul(mul(baseNumerator, scale), sideDenominator));
  }
}

test('actual weighted side coefficients transfer a mixed-sense outer and hole component with owned serializable receipts', () => {
  const input = inputWithHole(), component = certifyCylindricalWrapChartComponent(input), actual = pieces(input).reverse(), before = structuredClone(actual), prefix = structuredClone(component.counts);
  const result = certifyCylindricalWrapSideFamily(component, actual); receipt(result, component, 8);
  assert.deepEqual(actual, before); assert.deepEqual(result.original, before); assert.deepEqual(component.counts, prefix);
  assert.deepEqual(result.bindings.map(binding => binding.base), input.curves.map(curve => curve.id));
  for (const side of result.original) { coefficientOracle(side); closedFormOracle(side, r(1n, 3n), r(2n, 5n)); }
  assert.notEqual(result.original[0].base, actual[0].base); assert.notEqual(result.original[0].side.controlPoints[0][0], actual[0].side.controlPoints[0][0]);
  actual[0].base.controlPoints[0][0] = 123; assert.deepEqual(result.original, before);
  assert.throws(() => { result.original[0].outer.weights[0] = 1; }, TypeError);
});

test('exact original field bits domain weights factor sign and side row order are binding requirements', () => {
  const input = simple(), component = certifyCylindricalWrapChartComponent(input), actual = pieces(input);
  const mutations = [
    value => { value[0].base.knots[0] = -0; },
    value => { value[0].base.controlPoints[0][2] = -0; },
    value => { value[0].base.weights[0] = 0.5000000000000001; },
    value => { value[0].base.controlPoints.reverse(); value[0].base.weights.reverse(); },
    value => { value[0].outer.degree = 2; },
    value => { value[0].outer.knots = [2, 2, 2, 2, 3, 3, 3, 3]; },
    value => { value[0].outer.weights[0] = 0.5000000000000001; },
    value => { value[0].outer.controlPoints[0][0] *= 1.5; },
    value => { value[0].outer.controlPoints[0][0] *= -1; },
    value => { value[0].outer.controlPoints[0][2] = -0; },
    value => { value[0].side.degreeV = 2; },
    value => { value[0].side.knotsU[0] = -0; },
    value => { value[0].side.knotsV[0] = -0; },
    value => { value[0].side.knotsV = [0, 0, 2, 2]; },
    value => { value[0].side.controlPoints[0].reverse(); },
    value => { value[0].side.weights[0][1] *= 0.5; },
    value => { value[0].side.controlPoints[1][1][2] += 1; },
  ];
  for (const mutate of mutations) { const changed = structuredClone(actual); mutate(changed); const before = structuredClone(changed); refused(() => certifyCylindricalWrapSideFamily(component, changed), ['SUPPORT']); assert.deepEqual(changed, before); }
});

test('identifier membership uniqueness shapes and all actual coordinate ranges refuse rather than rebind geometry', () => {
  const input = simple(), component = certifyCylindricalWrapChartComponent(input), actual = pieces(input);
  for (const mutate of [value => { value.pop(); }, value => { value[1] = structuredClone(value[0]); }, value => { value[0].base.id = 'foreign'; }, value => { value[0].outer.id = value[1].outer.id; }, value => { value[0].outer.id = value[0].base.id; }, value => { value[0].side.id = value[0].outer.id; }, value => { value[0].side.id = 'x'.repeat(65); }, value => { value[0].outer.id = 'bad.id'; }, value => { value[0].side.extra = true; }, value => { value[0].side.controlPoints[0].pop(); }]) {
    const changed = structuredClone(actual); mutate(changed); refused(() => certifyCylindricalWrapSideFamily(component, changed), ['INPUT']);
  }
  const high = simple(6000), highComponent = certifyCylindricalWrapChartComponent(high);
  refused(() => certifyCylindricalWrapSideFamily(highComponent, pieces(high)), ['SUPPORT']);
  for (const field of ['base', 'outer', 'side']) {
    const changed = structuredClone(actual);
    if (field === 'side') changed[0].side.controlPoints[0][0][0] = 10001; else changed[0][field].controlPoints[0][0] = 10001;
    refused(() => certifyCylindricalWrapSideFamily(component, changed), ['SUPPORT']);
  }
});

test('component authority is checked before purported receipt or piece getters and copied receipts have no capability', () => {
  const input = simple(), component = certifyCylindricalWrapChartComponent(input), actual = pieces(input); let called = 0;
  const forged = {}; Object.defineProperty(forged, 'original', { enumerable: true, get() { called++; return component.original; } });
  const getterPieces = []; Object.defineProperty(getterPieces, '0', { enumerable: true, get() { called++; return actual[0]; } });
  refused(() => certifyCylindricalWrapSideFamily(forged, getterPieces), ['INPUT']); assert.equal(called, 0);
  refused(() => certifyCylindricalWrapSideFamily(Object.freeze({ ...component }), actual), ['INPUT']);
  refused(() => certifyCylindricalWrapSideFamily(structuredClone(component), actual), ['INPUT']);
  const getter = structuredClone(actual); Object.defineProperty(getter[0], 'outer', { enumerable: true, get() { called++; return actual[0].outer; } });
  refused(() => certifyCylindricalWrapSideFamily(component, getter), ['INPUT']); assert.equal(called, 0);
  const typed = structuredClone(actual); typed[0].outer.weights = new Float64Array(typed[0].outer.weights); refused(() => certifyCylindricalWrapSideFamily(component, typed), ['INPUT']);
  const foreign = simple(); foreign.curves[0].id = 'another'; foreign.outer.uses[0].curve = 'another';
  refused(() => certifyCylindricalWrapSideFamily(certifyCylindricalWrapChartComponent(foreign), actual), ['INPUT']);
});

test('one continuation ledger includes the original component and honors exact late operation and work budgets', () => {
  const input = simple(), actual = pieces(input), component = certifyCylindricalWrapChartComponent(input), prefix = structuredClone(component.counts);
  const result = certifyCylindricalWrapSideFamily(component, actual), maximum = result.counts.totalOperations;
  assert.deepEqual(result.startedCounts, prefix); assert.deepEqual(component.counts, prefix);
  const second = certifyCylindricalWrapSideFamily(component, actual); assert.deepEqual(second.startedCounts, result.counts); assert.ok(second.counts.totalOperations > result.counts.totalOperations); assert.deepEqual(result.componentCounts, prefix);
  const tight = certifyCylindricalWrapChartComponent(input, { maxOperations: maximum }); assert.equal(certifyCylindricalWrapSideFamily(tight, actual).counts.totalOperations, maximum);
  const late = certifyCylindricalWrapChartComponent(input, { maxOperations: maximum - 1 }), before = structuredClone(actual);
  refused(() => certifyCylindricalWrapSideFamily(late, actual), ['BUDGET']); assert.deepEqual(actual, before); assert.deepEqual(late.counts, prefix);
  const exhausted = certifyCylindricalWrapChartComponent(input, { maxOperations: prefix.totalOperations }); refused(() => certifyCylindricalWrapSideFamily(exhausted, actual), ['BUDGET']);
  const work = certifyCylindricalWrapChartComponent(input), ctx = chartComponentContext(work); ctx.charge(1048576 - ctx.counts().work);
  refused(() => certifyCylindricalWrapSideFamily(work, actual), ['BUDGET']);
});

test('actual D298 native assembly sides bind to their authentic component without claiming the original carrier or full construction budget', () => {
  const solid = prismaticFromProfile({ outer: [{ kind: 'arc', start: [10, 0], center: [0, 0], direction: 'ccw' }], height: 30, tag: 'post' });
  const part = { solid: { kind: 'upright', solid }, brep: brepFromPrismatic(solid, { id: 'post' }) }, before = structuredClone(part);
  const assembled = buildCylindricalWrapAssembly(part, [{ outer: [[1 / 16, 1 / 4], [5 / 16, 1 / 4], [5 / 16, 3 / 4], [1 / 16, 3 / 4]], holes: [] }], { id: 'wrap', height: 10 });
  const edges = new Map(); for (const edge of assembled.brep.edges) edges.set(edge.id, edge);
  const faces = new Map(); for (const face of assembled.brep.faces) faces.set(face.id, face);
  const actual = [], curves = [], uses = [];
  for (const entry of assembled.proof.pieces) {
    const base = edges.get(entry.baseEdge).curve; curves.push(base); uses.push({ curve: base.id, sense: 'forward' });
    actual.push({ base, outer: edges.get(entry.outerEdge).curve, side: faces.get(entry.sideFace).surface });
  }
  const component = certifyCylindricalWrapChartComponent({ curves, outer: { uses, interiorHint: [8, 4, 15] }, holes: [] });
  const oldGeometry = structuredClone(actual), result = certifyCylindricalWrapSideFamily(component, actual); receipt(result, component, 4);
  for (const side of result.original) coefficientOracle(side);
  assert.deepEqual(actual, oldGeometry); assert.deepEqual(part, before); assert.deepEqual(result.bindings.map(binding => binding.base), curves.map(curve => curve.id));
  assert.equal(result.meaning.combinedConstructionBudgetCertified, false);
});
