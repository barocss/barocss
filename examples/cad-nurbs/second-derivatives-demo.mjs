import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node second-derivatives-demo.mjs --source <output-directory>');
assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]);
mkdirSync(output, {recursive: true});
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const esbuild = require('esbuild'), entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundled = await esbuild.build({absWorkingDir: repo, entryPoints: [entry], bundle: true,
  platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true});
assert.equal(bundled.outputFiles.length, 1);
const sourceInputs = Object.keys(bundled.metafile.inputs).map(path => resolve(repo, path));
const cadInputs = sourceInputs.filter(path => path.includes('/packages/barocss-cad/'));
for (const leaf of ['index.ts', 'core/second-derivatives.ts', 'core/derivatives.ts', 'core/math.ts']) {
  assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
}
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const {evaluateCurveD2, evaluateSurfaceD2, NativeSecondDerivativeError, NativeSecondDerivativeDiagnosticCode,
  evaluateCurveD1, evaluateSurfaceD1, compileCadModel} = api;
for (const operation of [evaluateCurveD2, evaluateSurfaceD2, NativeSecondDerivativeError]) assert.equal(typeof operation, 'function');
assert.deepEqual(Object.keys(NativeSecondDerivativeDiagnosticCode).sort(), ['INPUT', 'CONTINUITY', 'ARITHMETIC', 'NATIVE'].sort());
for (const code of Object.keys(NativeSecondDerivativeDiagnosticCode)) assert.equal(NativeSecondDerivativeDiagnosticCode[code], code);
const retainedFiles = new Map(), accepted = [], cases = [], refusals = [];
const runtimeNames = ['evaluateCurveD2', 'evaluateSurfaceD2', 'NativeSecondDerivativeError', 'NativeSecondDerivativeDiagnosticCode'];
const typeNames = ['CurveD2Result', 'SurfaceD2Result'];

// Preserve signed zero in both authored and result JSON.
function nativeJSON(value) {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value);
  }
  if (value === null || ['string', 'boolean'].includes(typeof value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}';
}
function ownedFile(name, value) {
  const file = resolve(output, name + '.json');
  writeFileSync(file, nativeJSON(value) + '\n'); retainedFiles.set(file, readFileSync(file));
  const reopened = JSON.parse(readFileSync(file, 'utf8')); assert.deepEqual(reopened, value);
  return {file, reopened};
}
function sourceDecimal(value) {
  if (Object.is(value, -0)) return '-0';
  const text = String(value);
  if (!/[eE]/.test(text)) return text;
  const [mantissa, exponent] = text.toLowerCase().split('e'), negative = mantissa.startsWith('-');
  const unsigned = negative ? mantissa.slice(1) : mantissa;
  const parts = unsigned.split('.'), digits = parts.join(''), position = parts[0].length + Number(exponent);
  const decimal = position <= 0 ? '0.' + '0'.repeat(-position) + digits : position >= digits.length ?
    digits + '0'.repeat(position - digits.length) : digits.slice(0, position) + '.' + digits.slice(position);
  return (negative ? '-' : '') + decimal;
}
function sourceGeometry(name, geometry) {
  const list = values => '[' + values.map(sourceDecimal).join(',') + ']';
  const poles = values => '[' + values.map(list).join(',') + ']';
  const body = geometry.kind === 'curve' ? '@curve #' + geometry.id + ' { type:nurbs; degree:' + geometry.degree +
    '; knots:' + list(geometry.knots) + '; control-points:' + poles(geometry.controlPoints) + '; weights:' + list(geometry.weights) + '; }' :
    '@surface #' + geometry.id + ' { type:nurbs; degree-u:' + geometry.degreeU + '; degree-v:' + geometry.degreeV +
    '; knots-u:' + list(geometry.knotsU) + '; knots-v:' + list(geometry.knotsV) + '; control-points:[' + geometry.controlPoints.map(poles).join(',') +
    ']; weights:[' + geometry.weights.map(list).join(',') + ']; }';
  const model = {name: geometry.id + '_input', version: 0, lengthUnit: 'mm', objects: [geometry]};
  const file = resolve(output, name + '.original.source0.css');
  writeFileSync(file, '@model ' + model.name + ' { version:0; length-unit:mm; ' + body + ' }\n');
  retainedFiles.set(file, readFileSync(file));
  const cold = compileCadModel(readFileSync(file, 'utf8'), {sourceVersion: 0});
  assert.equal(cold.ok, true, JSON.stringify(cold.diagnostics)); assert.deepEqual(cold.model, model);
  return {file, geometry: cold.model.objects[0]};
}
function ownership(inputs, result) {
  const caller = new WeakSet(), seen = new WeakSet();
  const collect = value => {
    if (value && typeof value === 'object' && !caller.has(value)) {
      caller.add(value); for (const child of Object.values(value)) collect(child);
    }
  };
  inputs.forEach(collect);
  const visit = value => {
    if (value && typeof value === 'object') {
      assert.ok(!caller.has(value), 'Caller alias'); assert.ok(!seen.has(value), 'Repeated output occurrence');
      seen.add(value); for (const child of Object.values(value)) visit(child);
    }
  };
  visit(result);
}
function finiteResult(result, fields) {
  assert.deepEqual(Object.keys(result).sort(), [...fields].sort());
  for (const field of fields) {
    assert.equal(result[field].length, 3);
    for (const value of result[field]) assert.ok(Number.isFinite(value), field);
  }
}
function bitwisePoint(actual, expected) {
  assert.equal(actual.length, expected.length);
  for (let axis = 0; axis < actual.length; axis++) assert.ok(Object.is(actual[axis], expected[axis]), 'D1 field bit mismatch');
}
function closePoint(actual, expected, label) {
  const error = Math.hypot(...actual.map((value, axis) => value - expected[axis]));
  const tolerance = 1e-8 * Math.max(1, Math.hypot(...expected));
  assert.ok(error <= tolerance, label + ': ' + error + ' > ' + tolerance);
  return {absoluteError: error, tolerance};
}
function evaluate(geometry, query, target = api) {
  return geometry.kind === 'curve' ? target.evaluateCurveD2(geometry, query.parameter) : target.evaluateSurfaceD2(geometry, query.u, query.v);
}
function check(name, original, queries, reference = null) {
  const source = sourceGeometry(name, original), geometry = source.geometry;
  const before = structuredClone({geometry, queries});
  const authored = ownedFile(name + '.authored-queries', {sourceVersion: 0, sourceFile: source.file, geometry, queries});
  const observations = queries.map(query => {
    const result = evaluate(geometry, query), curve = geometry.kind === 'curve';
    const fields = curve ? ['point', 'derivative', 'secondDerivative'] : ['point', 'du', 'dv', 'duu', 'duv', 'dvv'];
    finiteResult(result, fields); ownership([geometry, queries], result);
    const d1 = curve ? evaluateCurveD1(geometry, query.parameter) : evaluateSurfaceD1(geometry, query.u, query.v);
    for (const field of Object.keys(d1)) bitwisePoint(result[field], d1[field]);
    const expected = reference ? reference(query) : null, errors = {};
    if (expected) for (const field of fields) errors[field] = closePoint(result[field], expected[field], name + '.' + field);
    return {query: structuredClone(query), result, actualUnchangedD1: d1, expected, errors};
  });
  ownership([geometry, queries], observations);
  assert.deepEqual({geometry, queries}, before);
  const saved = ownedFile(name + '.results', observations);
  // Reopen both the actual Source0 file and the authored-query JSON before recomputation.
  const cold = compileCadModel(readFileSync(authored.reopened.sourceFile, 'utf8'), {sourceVersion: authored.reopened.sourceVersion});
  assert.equal(cold.ok, true, JSON.stringify(cold.diagnostics)); assert.deepEqual(cold.model.objects[0], authored.reopened.geometry);
  const recomputed = authored.reopened.queries.map(query => evaluate(cold.model.objects[0], query));
  assert.deepEqual(recomputed, saved.reopened.map(row => row.result));
  const detached = evaluate(geometry, queries[0]);
  for (const point of Object.values(detached)) point[0] += 123;
  assert.deepEqual({geometry, queries}, before); assert.deepEqual(evaluate(geometry, queries[0]), observations[0].result);
  accepted.push({geometry, queries, before, observations, resultsBefore: structuredClone(observations)});
  cases.push({name, kind: geometry.kind, queryCount: queries.length, sourceFile: source.file,
    authoredFile: authored.file, resultFile: saved.file, analyticReference: Boolean(reference), coldRecompute: true, bitwiseD1: true});
  return {geometry, observations};
}
function intact() {
  for (const item of accepted) {
    assert.deepEqual({geometry: item.geometry, queries: item.queries}, item.before);
    assert.deepEqual(item.observations, item.resultsBefore);
  }
  for (const [file, bytes] of retainedFiles) assert.deepEqual(readFileSync(file), bytes, file);
}
function reject(name, action, code, nativeCause = false) {
  assert.throws(action, error => {
    assert.ok(error instanceof NativeSecondDerivativeError); assert.equal(error.name, 'NativeSecondDerivativeError');
    assert.equal(error.code, code); assert.ok(error.message.length <= 1024);
    if (nativeCause) assert.ok(error.cause instanceof Error, 'Actual native cause must be retained');
    refusals.push({name, code: error.code, message: error.message, causeName: error.cause?.name ?? null, causeMessage: error.cause?.message ?? null});
    intact(); return true;
  });
}
const clamped = (degree, a, b) => [...Array(degree + 1).fill(a), ...Array(degree + 1).fill(b)];
const curve = (id, degree, points, a = -3, b = 7, weights = Array(points.length).fill(1)) =>
  ({kind: 'curve', id, degree, knots: clamped(degree, a, b), controlPoints: points, weights});
const surface = (id, degreeU, degreeV, points, weights = points.map(row => Array(row.length).fill(1))) =>
  ({kind: 'surface', id, degreeU, degreeV, knotsU: clamped(degreeU, -3, 7), knotsV: clamped(degreeV, 2, 5), controlPoints: points, weights});
const choose = (n, k) => {
  if (k < 0 || k > n) return 0;
  let value = 1; for (let i = 1; i <= k; i++) value = value * (n - i + 1) / i;
  return value;
};
// Closed monomial expressions, independent of the native B-spline derivative controls.
function polynomial(coefficients, parameter, order) {
  return coefficients.reduce((sum, coefficient, power) => {
    if (power < order) return sum;
    let factor = 1; for (let i = 0; i < order; i++) factor *= power - i;
    return sum + coefficient * factor * parameter ** (power - order);
  }, 0);
}
function polynomialReference(coefficients, parameter, a, b) {
  const t = (parameter - a) / (b - a);
  return {point: coefficients.map(c => polynomial(c, t, 0)),
    derivative: coefficients.map(c => polynomial(c, t, 1) / (b - a)),
    secondDerivative: coefficients.map(c => polynomial(c, t, 2) / (b - a) ** 2)};
}
function bernstein(degree, index, t, order) {
  const coefficients = Array(degree + 1).fill(0);
  for (let k = 0; k <= degree - index; k++) coefficients[index + k] = choose(degree, index) * choose(degree - index, k) * (-1) ** k;
  return polynomial(coefficients, t, order);
}
function rationalCurveReference(geometry, parameter) {
  const a = geometry.knots[geometry.degree], b = geometry.knots[geometry.controlPoints.length], t = (parameter - a) / (b - a);
  const sums = [0, 1, 2].map(order => [0, 1, 2, 3].map(axis => geometry.weights.reduce((sum, weight, i) =>
    sum + weight * (axis === 3 ? 1 : geometry.controlPoints[i][axis]) * bernstein(geometry.degree, i, t, order) / (b - a) ** order, 0)));
  const point = sums[0].slice(0, 3).map(value => value / sums[0][3]);
  const derivative = sums[1].slice(0, 3).map((value, axis) => (value - sums[1][3] * point[axis]) / sums[0][3]);
  const secondDerivative = sums[2].slice(0, 3).map((value, axis) =>
    (value - 2 * sums[1][3] * derivative[axis] - sums[2][3] * point[axis]) / sums[0][3]);
  return {point, derivative, secondDerivative};
}
function rationalSurfaceReference(geometry, query) {
  const su = (query.u + 3) / 10, sv = (query.v - 2) / 3;
  const sum = (ou, ov) => [0, 1, 2, 3].map(axis => geometry.controlPoints.reduce((total, row, i) => total + row.reduce((subtotal, point, j) =>
    subtotal + geometry.weights[i][j] * (axis === 3 ? 1 : point[axis]) * bernstein(geometry.degreeU, i, su, ou) *
    bernstein(geometry.degreeV, j, sv, ov) / 10 ** ou / 3 ** ov, 0), 0));
  const h = sum(0, 0), hu = sum(1, 0), hv = sum(0, 1), huu = sum(2, 0), huv = sum(1, 1), hvv = sum(0, 2);
  const point = h.slice(0, 3).map(value => value / h[3]);
  const du = hu.slice(0, 3).map((value, axis) => (value - hu[3] * point[axis]) / h[3]);
  const dv = hv.slice(0, 3).map((value, axis) => (value - hv[3] * point[axis]) / h[3]);
  const duu = huu.slice(0, 3).map((value, axis) => (value - 2 * hu[3] * du[axis] - huu[3] * point[axis]) / h[3]);
  const duv = huv.slice(0, 3).map((value, axis) => (value - hu[3] * dv[axis] - hv[3] * du[axis] - huv[3] * point[axis]) / h[3]);
  const dvv = hvv.slice(0, 3).map((value, axis) => (value - 2 * hv[3] * dv[axis] - hvv[3] * point[axis]) / h[3]);
  return {point, du, dv, duu, duv, dvv};
}
ownedFile('source-api.inputs', {entry, sourceInputs, cadInputs, sourceOnly: true, write: false, esbuildVersion: esbuild.version});
ownedFile('source-api.metafile', bundled.metafile);

for (let degree = 1; degree <= 5; degree++) {
  const coefficients = [Array.from({length: degree + 1}, (_, k) => k === 0 ? 1 : (k % 2 ? 2 : -1)),
    [...Array(degree).fill(0), 3], Array.from({length: degree + 1}, (_, k) => k === 0 ? -2 : k + 1)];
  const points = Array.from({length: degree + 1}, (_, i) => coefficients.map(c =>
    c.slice(0, i + 1).reduce((sum, value, k) => sum + value * choose(i, k) / choose(degree, k), 0)));
  check('polynomial_bezier_degree' + degree, curve('polynomial_' + degree, degree, points),
    [-3, -1, 2, 6, 7].map(parameter => ({parameter})), query => polynomialReference(coefficients, query.parameter, -3, 7));
}
const quarter = curve('quarter_circle', 2, [[2, 0, 0], [2, 2, 0], [0, 2, 0]], -3, 7, [1, Math.SQRT1_2, 1]);
// Explicit quarter-circle numerator and denominator polynomials on the nonunit domain.
function quarterReference(query) {
  const t = (query.parameter + 3) / 10, q = Math.SQRT1_2;
  const a = [[2, 4 * (q - 1), 2 - 4 * q], [0, 4 * q, 2 - 4 * q], [0]], w = [1, 2 * (q - 1), 2 * (1 - q)];
  const W = polynomial(w, t, 0), W1 = polynomial(w, t, 1) / 10, W2 = polynomial(w, t, 2) / 100;
  const point = a.map(c => polynomial(c, t, 0) / W);
  const derivative = a.map((c, i) => (polynomial(c, t, 1) / 10 - W1 * point[i]) / W);
  const secondDerivative = a.map((c, i) => (polynomial(c, t, 2) / 100 - 2 * W1 * derivative[i] - W2 * point[i]) / W);
  return {point, derivative, secondDerivative};
}
check('rational_quarter_nonunit_domain', quarter, [-3, -.5, 2, 4.5, 7].map(parameter => ({parameter})), quarterReference);
const unequal = curve('unequal_linear', 1, [[1, -2, 3], [5, 4, -1]], -3, 7, [1, 3]);
const unequalResult = check('rational_degree1_nonzero_d2', unequal, [-3, 0, 2, 7].map(parameter => ({parameter})),
  query => rationalCurveReference(unequal, query.parameter));
assert.ok(Math.hypot(...unequalResult.observations[1].result.secondDerivative) > .01);
const tensorPoints = Array.from({length: 3}, (_, i) => Array.from({length: 3}, (_, j) =>
  [i === 2 ? 1 : 0, j === 2 ? 1 : 0, i * j / 4]));
const tensor = surface('biquadratic', 2, 2, tensorPoints);
const surfaceQueries = [{u: -3, v: 2}, {u: -1, v: 2.75}, {u: 2, v: 3.5}, {u: 7, v: 5}];
check('polynomial_biquadratic', tensor, surfaceQueries, ({u, v}) => {
  const s = (u + 3) / 10, t = (v - 2) / 3;
  return {point: [s * s, t * t, s * t], du: [2 * s / 10, 0, t / 10], dv: [0, 2 * t / 3, s / 3],
    duu: [2 / 100, 0, 0], duv: [0, 0, 1 / 30], dvv: [0, 2 / 9, 0]};
});
const saddle = surface('bilinear_saddle', 1, 1, [[[0, 0, 0], [0, 1, 0]], [[1, 0, 0], [1, 1, 1]]]);
check('bilinear_nonzero_mixed', saddle, surfaceQueries, ({u, v}) => {
  const s = (u + 3) / 10, t = (v - 2) / 3;
  return {point: [s, t, s * t], du: [.1, 0, t / 10], dv: [0, 1 / 3, s / 3],
    duu: [0, 0, 0], duv: [0, 0, 1 / 30], dvv: [0, 0, 0]};
});
const rationalTensor = surface('rational_tensor', 2, 2,
  Array.from({length: 3}, (_, i) => Array.from({length: 3}, (_, j) => [i - j / 2, i * j + j, i * i - j * j])),
  [[1, 2, 1.5], [3, .75, 2], [1.25, 4, 1]]);
check('rational_tensor_closed_bernstein', rationalTensor, surfaceQueries, query => rationalSurfaceReference(rationalTensor, query));
const constant = curve('constant_curve', 5, Array.from({length: 6}, () => [3, -2, 1]));
check('constant_curve_zero_tangent', constant, [{parameter: -3}, {parameter: 2}, {parameter: 7}], () =>
  ({point: [3, -2, 1], derivative: [0, 0, 0], secondDerivative: [0, 0, 0]}));
const stationary = curve('stationary_endpoint', 2, [[0, 0, 0], [0, 0, 0], [1, 2, 0]], 0, 1);
check('zero_tangent_nonzero_second', stationary, [{parameter: 0}], () =>
  ({point: [0, 0, 0], derivative: [0, 0, 0], secondDerivative: [2, 4, 0]}));
const constantSurface = surface('constant_surface', 2, 2, Array.from({length: 3}, () => Array.from({length: 3}, () => [1, 2, 3])));
check('constant_surface_zero_partials', constantSurface, surfaceQueries, () =>
  ({point: [1, 2, 3], du: [0, 0, 0], dv: [0, 0, 0], duu: [0, 0, 0], duv: [0, 0, 0], dvv: [0, 0, 0]}));
const wide = {kind: 'curve', id: 'maximum64', degree: 1, knots: [0, 0, ...Array.from({length: 62}, (_, i) => i + 1), 63, 63],
  controlPoints: Array.from({length: 64}, (_, i) => [i, i / 4, -i / 2]), weights: Array(64).fill(1)};
check('maximum64_curve', wide, [0, .5, 31.5, 62.5, 63].map(parameter => ({parameter})), ({parameter}) =>
  ({point: [parameter, parameter / 4, -parameter / 2], derivative: [1, .25, -.5], secondDerivative: [0, 0, 0]}));
const wideSurface = {kind: 'surface', id: 'maximum16x16', degreeU: 1, degreeV: 1,
  knotsU: [0, 0, ...Array.from({length: 14}, (_, i) => i + 1), 15, 15],
  knotsV: [-3, -3, ...Array.from({length: 14}, (_, i) => i - 2), 12, 12],
  controlPoints: Array.from({length: 16}, (_, i) => Array.from({length: 16}, (_, j) => [i, j, i * j])),
  weights: Array.from({length: 16}, () => Array(16).fill(1))};
check('maximum16x16_surface', wideSurface, [{u: 0, v: -3}, {u: .5, v: -2.5}, {u: 7.5, v: 4.5}, {u: 15, v: 12}], ({u, v}) =>
  ({point: [u, v + 3, u * (v + 3)], du: [1, 0, v + 3], dv: [0, 1, u], duu: [0, 0, 0], duv: [0, 0, 1], dvv: [0, 0, 0]}));

const continuityCurve = (id, degree, multiplicity) => {
  const knots = [...Array(degree + 1).fill(0), ...Array(multiplicity).fill(1), ...Array(degree + 1).fill(2)];
  const count = knots.length - degree - 1;
  return {kind: 'curve', id, degree, knots, controlPoints: Array.from({length: count}, (_, i) => [i, i * i, 1]), weights: Array(count).fill(1)};
};
const c0 = continuityCurve('curve_c0', 2, 2), c1 = continuityCurve('curve_c1', 2, 1), c2 = continuityCurve('curve_c2', 3, 1);
check('c0_elsewhere_and_endpoints', c0, [0, .5, 1.5, 2].map(parameter => ({parameter})));
check('c1_elsewhere_and_endpoints', c1, [0, .5, 1.5, 2].map(parameter => ({parameter})));
check('c2_exact_knot', c2, [{parameter: 1}]);
const unrelatedOverflow = {kind: 'curve', id: 'inactive_tiny_span', degree: 2,
  knots: [0, 0, 0, 1e-160, 1e-160, 2, 2, 2],
  controlPoints: [[0, 0, 0], [1, 0, 0], [0, 0, 0], [2, 0, 0], [4, 0, 0]], weights: [1, 1, 1, 1, 1]};
// The first span has an overflowing D2. This local query uses only the second span.
check('unrelated_second_overflow_inactive_support', unrelatedOverflow, [{parameter: 1}, {parameter: 2}], ({parameter}) =>
  ({point: [2 * parameter, 0, 0], derivative: [2, 0, 0], secondDerivative: [0, 0, 0]}));
reject('exact_curve_c0', () => evaluateCurveD2(c0, 1), 'CONTINUITY');
const c1D1 = evaluateCurveD1(c1, 1); finiteResult(c1D1, ['point', 'derivative']);
ownedFile('exact-c1.actual-d1-success', {geometry: c1, parameter: 1, d1: c1D1});
reject('exact_curve_c1_actual_d1_success', () => evaluateCurveD2(c1, 1), 'CONTINUITY');
// Coefficient cancellation does not change the conservative knot admission rule.
const cancelledC1 = {...c1, id: 'cancelled_c1', controlPoints: c1.controlPoints.map(() => [2, 3, 4])};
reject('exact_c1_constant_coefficients', () => evaluateCurveD2(cancelledC1, 1), 'CONTINUITY');
function continuitySurface(axis, base) {
  const n = base.controlPoints.length, points = axis === 'u' ? Array.from({length: n}, (_, i) => [[i, 0, i * i], [i, 1, i * i]]) :
    Array.from({length: 2}, (_, i) => Array.from({length: n}, (_, j) => [i, j, j * j]));
  return {kind: 'surface', id: 'surface_' + axis + '_' + base.id, degreeU: axis === 'u' ? base.degree : 1,
    degreeV: axis === 'v' ? base.degree : 1, knotsU: axis === 'u' ? [...base.knots] : [0, 0, 2, 2],
    knotsV: axis === 'v' ? [...base.knots] : [0, 0, 2, 2], controlPoints: points, weights: points.map(row => Array(row.length).fill(1))};
}
for (const axis of ['u', 'v']) for (const base of [c0, c1]) {
  const geometry = continuitySurface(axis, base), name = geometry.id;
  check(name + '_away', geometry, [{u: .5, v: .5}, {u: 0, v: 0}, {u: 2, v: 2}]);
  if (base === c1) finiteResult(evaluateSurfaceD1(geometry, 1, 1), ['point', 'du', 'dv']);
  reject(name + '_exact', () => evaluateSurfaceD2(geometry, 1, 1), 'CONTINUITY');
}

reject('nonfinite_parameter', () => evaluateCurveD2(quarter, NaN), 'INPUT');
reject('parameter_outside_domain', () => evaluateCurveD2(quarter, 8), 'INPUT');
reject('parameter_bound', () => evaluateCurveD2(quarter, 10001), 'INPUT');
reject('surface_nonfinite_v', () => evaluateSurfaceD2(tensor, 2, Infinity), 'INPUT');
reject('surface_outside_u', () => evaluateSurfaceD2(tensor, -4, 3), 'INPUT');
reject('weight_nonfinite', () => evaluateCurveD2({...quarter, weights: [1, NaN, 1]}, 2), 'INPUT');
reject('coordinate_bound', () => evaluateCurveD2({...quarter, controlPoints: [[1000001, 0, 0], ...quarter.controlPoints.slice(1)]}, 2), 'INPUT');
reject('coordinate_nonfinite', () => evaluateCurveD2({...quarter, controlPoints: [[Infinity, 0, 0], ...quarter.controlPoints.slice(1)]}, 2), 'INPUT');
reject('knot_bound', () => evaluateCurveD2({...quarter, knots: [-10001, -10001, -10001, 7, 7, 7]}, 2), 'INPUT');
reject('knot_nonfinite', () => evaluateCurveD2({...quarter, knots: [-3, -3, -3, Infinity, Infinity, Infinity]}, 2), 'INPUT');
reject('degree_six', () => evaluateCurveD2(curve('degree6', 6, Array.from({length: 7}, (_, i) => [i, 0, 0])), 2), 'INPUT');
reject('curve65_poles', () => evaluateCurveD2({...wide, controlPoints: [...wide.controlPoints, [64, 16, -32]], weights: Array(65).fill(1)}, .5), 'INPUT');
reject('surface17_rows', () => evaluateSurfaceD2({...wideSurface, controlPoints: [...wideSurface.controlPoints, wideSurface.controlPoints[0]],
  weights: [...wideSurface.weights, wideSurface.weights[0]]}, .5, .5), 'INPUT');
reject('surface17_columns', () => evaluateSurfaceD2({...wideSurface, controlPoints: wideSurface.controlPoints.map(row => [...row, row[0]]),
  weights: wideSurface.weights.map(row => [...row, 1])}, .5, .5), 'INPUT');
reject('native_invalid_id', () => evaluateCurveD2({...quarter, id: 'invalid id'}, 2), 'NATIVE', true);
reject('native_knot_order', () => evaluateCurveD2({...quarter, knots: [-3, -3, -3, 7, 6, 7]}, 2), 'NATIVE', true);
reject('native_knot_count', () => evaluateCurveD2({...quarter, knots: [...quarter.knots, 7]}, 2), 'NATIVE', true);
reject('native_weight_zero', () => evaluateCurveD2({...quarter, weights: [1, 0, 1]}, 2), 'NATIVE', true);
reject('native_weight_lower_bound', () => evaluateCurveD2({...quarter, weights: [1, 1e-7, 1]}, 2), 'NATIVE', true);
reject('native_weight_upper_bound', () => evaluateCurveD2({...quarter, weights: [1, 1e7, 1]}, 2), 'NATIVE', true);
reject('extra_field', () => evaluateCurveD2({...quarter, label: 'extra'}, 2), 'INPUT');
reject('array_bound', () => evaluateCurveD2({...quarter, knots: Array(129).fill(0)}, 2), 'INPUT');
reject('string_bound', () => evaluateCurveD2({...quarter, id: 'a'.repeat(129)}, 2), 'INPUT');
reject('field_bound', () => evaluateCurveD2(Object.assign({}, quarter, Object.fromEntries(Array.from({length: 17}, (_, i) => ['extra' + i, i]))), 2), 'INPUT');
reject('prototype', () => evaluateCurveD2(Object.assign(Object.create({hidden: true}), quarter), 2), 'INPUT');
const cycle = {...quarter}; cycle.controlPoints = [cycle];
reject('cyclic_input', () => evaluateCurveD2(cycle, 2), 'INPUT');
let getterCalls = 0;
const getter = {...quarter}; Object.defineProperty(getter, 'degree', {enumerable: true, get() { getterCalls++; return 2; }});
reject('top_level_getter', () => evaluateCurveD2(getter, 2), 'INPUT');
const nestedGetter = structuredClone(quarter); Object.defineProperty(nestedGetter.controlPoints[0], '0', {enumerable: true, get() { getterCalls++; return 2; }});
reject('nested_coordinate_getter', () => evaluateCurveD2(nestedGetter, 2), 'INPUT'); assert.equal(getterCalls, 0);
const symbol = {...quarter, [Symbol('hidden')]: 1};
reject('symbol_field', () => evaluateCurveD2(symbol, 2), 'INPUT');
const depth = {...quarter}; let nested = [0]; for (let i = 0; i < 9; i++) nested = [nested]; depth.controlPoints = nested;
reject('depth_bound', () => evaluateCurveD2(depth, 2), 'INPUT');
const values = {...quarter, controlPoints: Array.from({length: 128}, () => Array.from({length: 128}, () => [0, 0, 0]))};
reject('total_value_bound', () => evaluateCurveD2(values, 2), 'INPUT');
const arithmetic = curve('second_overflow', 2, [[0, 0, 0], [1, 0, 0], [0, 0, 0]], 0, 1e-160);
const arithmeticD1 = evaluateCurveD1(arithmetic, 5e-161); finiteResult(arithmeticD1, ['point', 'derivative']);
ownedFile('second-overflow.actual-finite-d1', {geometry: arithmetic, parameter: 5e-161, d1: arithmeticD1});
let replacement = accepted[0].observations[0].result;
const previous = replacement, previousBytes = nativeJSON(previous);
reject('finite_d1_second_derivative_overflow', () => { replacement = evaluateCurveD2(arithmetic, 5e-161); }, 'ARITHMETIC');
assert.strictEqual(replacement, previous); assert.equal(nativeJSON(replacement), previousBytes);
const underflow = curve('homogeneous_underflow', 1, [[Number.MIN_VALUE, 0, 0], [1, 0, 0]], 0, 1, [1e-6, 1e-6]);
const underflowD1 = evaluateCurveD1(underflow, 0); finiteResult(underflowD1, ['point', 'derivative']);
ownedFile('product-underflow.actual-finite-d1', {geometry: underflow, parameter: 0, d1: underflowD1});
reject('nonzero_homogeneous_product_underflow', () => evaluateCurveD2(underflow, 0), 'ARITHMETIC');
const nativeFailure = curve('native_d1_overflow', 1, [[0, 0, 0], [1, 0, 0]], 0, Number.MIN_VALUE);
let nativeD1Cause;
try { evaluateCurveD1(nativeFailure, 0); } catch (error) { nativeD1Cause = error; }
assert.ok(nativeD1Cause instanceof Error);
reject('actual_native_d1_failure_cause', () => evaluateCurveD2(nativeFailure, 0), 'NATIVE', true);
assert.equal(refusals.at(-1).causeMessage, nativeD1Cause.message);
ownedFile('arithmetic.atomic-retention', {replacementUnchanged: replacement === previous, previous, nativeFailure, nativeD1Cause: nativeD1Cause.message});

const packageRoot = resolve(repo, 'packages/barocss-cad');
const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')), declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.NativeSecondDerivativeDiagnosticCode, NativeSecondDerivativeDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./core/second-derivatives.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/core/second-derivatives.d.ts'), leafDeclaration = readFileSync(leafDeclarationPath, 'utf8');
for (const name of [...runtimeNames, ...typeNames]) {
  assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(leafDeclaration), name);
}
for (const item of cases) {
  const authored = JSON.parse(readFileSync(item.authoredFile, 'utf8')), saved = JSON.parse(readFileSync(item.resultFile, 'utf8'));
  const cold = publicAPI.compileCadModel(readFileSync(authored.sourceFile, 'utf8'), {sourceVersion: authored.sourceVersion});
  assert.equal(cold.ok, true, JSON.stringify(cold.diagnostics)); assert.deepEqual(cold.model.objects[0], authored.geometry);
  assert.deepEqual(authored.queries.map(query => evaluate(cold.model.objects[0], query, publicAPI)), saved.map(row => row.result));
}
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 6,
  caseCount: cases.length, declarationCheck: 'actual declaration exports and built API consumption; no separate TypeScript invocation'};
ownedFile('compiled-consumer', compiledConsumer); intact();
const summary = {sourceMode: true, cadSourceInputCount: cadInputs.length, cases, refusals, compiledConsumer,
  caseCount: cases.length, queryCount: cases.reduce((sum, row) => sum + row.queryCount, 0), refusalCount: refusals.length,
  units: 'mm per original native knot parameter; second partials use the original parameter products',
  tolerance: 'vector absolute difference <= 1e-8 * max(1, expected vector norm)',
  independentReferences: ['closed polynomial monomials', 'explicit rational quarter-circle polynomials', 'closed Bernstein polynomials and quotient expressions',
    'biquadratic and bilinear coordinate polynomials', 'maximum-size piecewise linear coordinates'],
  inputOwnership: true, retainedFiles: true, exactD1Bits: true, coldSourceAndJSONRecompute: true,
  curvatureCertified: false, regularityCertified: false, globalQualityCertified: false, topologyCertified: false};
ownedFile('summary', summary); intact(); console.log(JSON.stringify(summary));
