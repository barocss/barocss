import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node local-curvature-demo.mjs --source <output-directory>'); assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]); mkdirSync(output, {recursive: true});
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const esbuild = require('esbuild'), entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundled = await esbuild.build({absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node',
  format: 'esm', target: 'es2022', write: false, metafile: true});
assert.equal(bundled.outputFiles.length, 1);
const sourceInputs = Object.keys(bundled.metafile.inputs).map(path => resolve(repo, path));
const cadInputs = sourceInputs.filter(path => path.includes('/packages/barocss-cad/'));
for (const leaf of ['index.ts', 'local-curvature.ts', 'second-derivatives.ts', 'derivatives.ts', 'math.ts']) {
  assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
}
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const {evaluateCurveCurvature, evaluateSurfaceCurvature, NativeCurvatureError, NativeCurvatureDiagnosticCode,
  evaluateCurveD2, evaluateSurfaceD2, NativeSecondDerivativeError, compileCadModel} = api;
const runtimeNames = ['evaluateCurveCurvature', 'evaluateSurfaceCurvature', 'NativeCurvatureError', 'NativeCurvatureDiagnosticCode'];
const typeNames = ['CurveCurvatureResult', 'SurfaceCurvatureResult'];
for (const name of runtimeNames) assert.equal(typeof api[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(Object.keys(NativeCurvatureDiagnosticCode).sort(), ['DERIVATIVE', 'REGULARITY', 'ARITHMETIC'].sort());
for (const code of Object.keys(NativeCurvatureDiagnosticCode)) assert.equal(NativeCurvatureDiagnosticCode[code], code);
const retainedFiles = new Map(), accepted = [], cases = [], refusals = [];

function nativeJSON(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || ['string', 'boolean'].includes(typeof value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}';
}
function ownedFile(name, value) {
  const file = resolve(output, name + '.json'); writeFileSync(file, nativeJSON(value) + '\n'); retainedFiles.set(file, readFileSync(file));
  const reopened = JSON.parse(readFileSync(file, 'utf8')); assert.deepEqual(reopened, value); return {file, reopened};
}
function sourceDecimal(value) {
  if (Object.is(value, -0)) return '-0';
  const text = String(value); if (!/[eE]/.test(text)) return text;
  const [mantissa, exponent] = text.toLowerCase().split('e'), negative = mantissa.startsWith('-');
  const parts = (negative ? mantissa.slice(1) : mantissa).split('.'), digits = parts.join(''), position = parts[0].length + Number(exponent);
  const decimal = position <= 0 ? '0.' + '0'.repeat(-position) + digits : position >= digits.length ?
    digits + '0'.repeat(position - digits.length) : digits.slice(0, position) + '.' + digits.slice(position);
  return (negative ? '-' : '') + decimal;
}
function sourceGeometry(name, geometry) {
  const list = values => '[' + values.map(sourceDecimal).join(',') + ']', poles = values => '[' + values.map(list).join(',') + ']';
  const body = geometry.kind === 'curve' ? '@curve #' + geometry.id + ' { type:nurbs; degree:' + geometry.degree + '; knots:' + list(geometry.knots) +
    '; control-points:' + poles(geometry.controlPoints) + '; weights:' + list(geometry.weights) + '; }' :
    '@surface #' + geometry.id + ' { type:nurbs; degree-u:' + geometry.degreeU + '; degree-v:' + geometry.degreeV + '; knots-u:' + list(geometry.knotsU) +
    '; knots-v:' + list(geometry.knotsV) + '; control-points:[' + geometry.controlPoints.map(poles).join(',') + ']; weights:[' + geometry.weights.map(list).join(',') + ']; }';
  const model = {name: geometry.id + '_input', version: 0, lengthUnit: 'mm', objects: [geometry]};
  const file = resolve(output, name + '.original.source0.css');
  writeFileSync(file, '@model ' + model.name + ' { version:0; length-unit:mm; ' + body + ' }\n'); retainedFiles.set(file, readFileSync(file));
  const cold = compileCadModel(readFileSync(file, 'utf8'), {sourceVersion: 0});
  assert.equal(cold.ok, true, JSON.stringify(cold.diagnostics)); assert.deepEqual(cold.model, model); return {file, geometry: cold.model.objects[0]};
}
function ownership(inputs, result) {
  const caller = new WeakSet(), seen = new WeakSet();
  const collect = value => { if (value && typeof value === 'object' && !caller.has(value)) {
    caller.add(value); for (const child of Object.values(value)) collect(child);
  }};
  inputs.forEach(collect);
  const visit = value => { if (value && typeof value === 'object') {
    assert.ok(!caller.has(value), 'Caller alias'); assert.ok(!seen.has(value), 'Repeated result occurrence');
    seen.add(value); for (const child of Object.values(value)) visit(child);
  }};
  visit(result);
}
function bits(actual, expected) {
  if (typeof expected === 'number') { assert.ok(Object.is(actual, expected), 'Embedded D2 bit mismatch'); return; }
  assert.deepEqual(Object.keys(actual), Object.keys(expected));
  for (const key of Object.keys(expected)) bits(actual[key], expected[key]);
}
function finiteTree(value) {
  if (typeof value === 'number') assert.ok(Number.isFinite(value));
  else if (value && typeof value === 'object') for (const child of Object.values(value)) finiteTree(child);
}
function close(actual, expected, label) {
  const vector = Array.isArray(expected), error = vector ? Math.hypot(...actual.map((value, axis) => value - expected[axis])) : Math.abs(actual - expected);
  const norm = vector ? Math.hypot(...expected) : Math.abs(expected), tolerance = 1e-7 * Math.max(1, norm);
  assert.ok(error <= tolerance, label + ': ' + error + ' > ' + tolerance); return {absoluteError: error, tolerance};
}
function evaluate(geometry, query, target = api) {
  return geometry.kind === 'curve' ? target.evaluateCurveCurvature(geometry, query.parameter) : target.evaluateSurfaceCurvature(geometry, query.u, query.v);
}
function d2(geometry, query) {
  return geometry.kind === 'curve' ? evaluateCurveD2(geometry, query.parameter) : evaluateSurfaceD2(geometry, query.u, query.v);
}
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function inspect(result, geometry) {
  finiteTree(result); ownership([geometry], result);
  const curve = geometry.kind === 'curve';
  assert.deepEqual(Object.keys(result).sort(), (curve ? ['derivatives', 'speedMM', 'unitTangent', 'curvaturePerMM', 'curvatureVectorPerMM', 'radiusMM'] :
    ['derivatives', 'unitNormal', 'normalizedMetric', 'normalizedSecondFormPerMM', 'meanCurvaturePerMM', 'gaussianCurvaturePerMM2', 'principalCurvaturesPerMM', 'umbilicDiscriminant']).sort());
  if (curve) {
    assert.ok(result.speedMM > 0); assert.ok(result.curvaturePerMM >= 0); close(Math.hypot(...result.unitTangent), 1, 'unit tangent');
    close(result.curvaturePerMM, Math.hypot(...result.curvatureVectorPerMM), 'curvature vector norm');
    if (result.curvaturePerMM === 0) assert.equal(result.radiusMM, null);
    else { assert.ok(result.radiusMM > 0); close(result.radiusMM * result.curvaturePerMM, 1, 'reciprocal radius'); }
  } else {
    close(Math.hypot(...result.unitNormal), 1, 'unit normal');
    assert.deepEqual(Object.keys(result.normalizedMetric).sort(), ['cosineUV', 'determinant', 'tangentNormsMM'].sort());
    assert.deepEqual(Object.keys(result.normalizedSecondFormPerMM).sort(), ['uu', 'uv', 'vv'].sort());
    assert.deepEqual(Object.keys(result.umbilicDiscriminant).sort(), ['scalePerMM', 'rawScaled', 'roundoffBoundScaled', 'clampedToZero'].sort());
    const {cosineUV: rho, determinant, tangentNormsMM: norms} = result.normalizedMetric;
    assert.equal(norms.length, 2); assert.ok(norms.every(value => value > 0));
    close(norms, [Math.hypot(...result.derivatives.du), Math.hypot(...result.derivatives.dv)], 'actual native tangent norms');
    const tu = result.derivatives.du.map(value => value / norms[0]), tv = result.derivatives.dv.map(value => value / norms[1]);
    close(rho, dot(tu, tv), 'actual normalized tangent metric');
    const nativeCross = cross(tu, tv), crossNorm = Math.hypot(...nativeCross);
    close(result.unitNormal, nativeCross.map(value => value / crossNorm), 'authored U/V normal orientation');
    close(dot(result.unitNormal, tu), 0, 'normal perpendicular to U'); close(dot(result.unitNormal, tv), 0, 'normal perpendicular to V');
    close(determinant, 1 - rho * rho, 'normalized metric'); assert.ok(determinant > 512 * Number.EPSILON * (1 + Math.abs(rho * rho)));
    const secondForm = result.normalizedSecondFormPerMM;
    close(secondForm.uu, dot(result.unitNormal, result.derivatives.duu) / norms[0] / norms[0], 'normalized II uu in 1/mm');
    close(secondForm.uv, dot(result.unitNormal, result.derivatives.duv) / norms[0] / norms[1], 'normalized II uv in 1/mm');
    close(secondForm.vv, dot(result.unitNormal, result.derivatives.dvv) / norms[1] / norms[1], 'normalized II vv in 1/mm');
    const principals = result.principalCurvaturesPerMM; assert.equal(principals.length, 2); assert.ok(principals[0] <= principals[1]);
    close((principals[0] + principals[1]) / 2, result.meanCurvaturePerMM, 'principal mean');
    close(principals[0] * principals[1], result.gaussianCurvaturePerMM2, 'principal product');
    const disclosure = result.umbilicDiscriminant; assert.equal(typeof disclosure.clampedToZero, 'boolean');
    if (disclosure.clampedToZero) { assert.ok(disclosure.rawScaled < 0); assert.ok(-disclosure.rawScaled <= disclosure.roundoffBoundScaled); }
    else assert.ok(disclosure.rawScaled >= 0);
    if (disclosure.scalePerMM === 0) assert.deepEqual(disclosure, {scalePerMM: 0, rawScaled: 0, roundoffBoundScaled: 0, clampedToZero: false});
    else {
      assert.equal(disclosure.scalePerMM, Math.max(Math.abs(secondForm.uu), Math.abs(secondForm.uv), Math.abs(secondForm.vv)));
      const e = secondForm.uu / disclosure.scalePerMM, f = secondForm.uv / disclosure.scalePerMM, g = secondForm.vv / disclosure.scalePerMM;
      const h = (e - 2 * rho * f + g) / (2 * determinant), k = (e * g - f * f) / determinant;
      close(disclosure.rawScaled, h * h - k, 'disclosed scaled discriminant');
      const bound = 512 * Number.EPSILON * (Math.abs(h * h) + Math.abs(k));
      assert.ok(Math.abs(disclosure.roundoffBoundScaled - bound) <= 16 * Number.EPSILON * Math.max(Number.MIN_VALUE, bound));
    }
  }
}
function check(name, original, queries, reference) {
  const source = sourceGeometry(name, original), geometry = source.geometry, before = structuredClone({geometry, queries});
  const authored = ownedFile(name + '.authored-queries', {sourceVersion: 0, sourceFile: source.file, geometry, queries});
  const observations = queries.map(query => {
    const result = evaluate(geometry, query), actualD2 = d2(geometry, query); inspect(result, geometry); bits(result.derivatives, actualD2);
    const expected = reference(query), errors = {};
    for (const [field, value] of Object.entries(expected)) {
      if (value === null) assert.equal(result[field], null);
      else errors[field] = close(result[field], value, name + '.' + field);
    }
    return {query: structuredClone(query), result, actualUnchangedD2: actualD2, expected, errors};
  });
  ownership([geometry, queries], observations); assert.deepEqual({geometry, queries}, before);
  const saved = ownedFile(name + '.results', observations), cold = compileCadModel(readFileSync(authored.reopened.sourceFile, 'utf8'), {sourceVersion: 0});
  assert.equal(cold.ok, true, JSON.stringify(cold.diagnostics)); assert.deepEqual(cold.model.objects[0], authored.reopened.geometry);
  assert.deepEqual(authored.reopened.queries.map(query => evaluate(cold.model.objects[0], query)), saved.reopened.map(row => row.result));
  const detached = evaluate(geometry, queries[0]);
  const mutate = value => { if (Array.isArray(value)) value[0] = 123; else if (value && typeof value === 'object') for (const child of Object.values(value)) mutate(child); };
  mutate(detached); assert.deepEqual({geometry, queries}, before); assert.deepEqual(evaluate(geometry, queries[0]), observations[0].result);
  accepted.push({geometry, queries, before, observations, resultsBefore: structuredClone(observations)});
  cases.push({name, kind: geometry.kind, queryCount: queries.length, sourceFile: source.file, authoredFile: authored.file,
    resultFile: saved.file, bitwiseEmbeddedD2: true, coldRecompute: true, independentAnalyticReference: true});
  return observations;
}
function intact() {
  for (const item of accepted) { assert.deepEqual({geometry: item.geometry, queries: item.queries}, item.before); assert.deepEqual(item.observations, item.resultsBefore); }
  for (const [file, bytes] of retainedFiles) assert.deepEqual(readFileSync(file), bytes, file);
}
function reject(name, geometry, query, code, derivativeCode = null, actualCause = null) {
  assert.throws(() => evaluate(geometry, query), error => {
    assert.ok(error instanceof NativeCurvatureError); assert.equal(error.name, 'NativeCurvatureError'); assert.equal(error.code, code); assert.ok(error.message.length <= 1024);
    if (derivativeCode) {
      assert.ok(error.cause instanceof NativeSecondDerivativeError); assert.equal(error.cause.code, derivativeCode);
      if (actualCause) { assert.equal(error.cause.message, actualCause.message); assert.equal(error.cause.cause?.message, actualCause.cause?.message); }
    }
    refusals.push({name, code, message: error.message, derivativeCode: error.cause?.code ?? null, causeMessage: error.cause?.message ?? null,
      nativeCauseMessage: error.cause?.cause?.message ?? null}); intact(); return true;
  });
}
function derivativeReject(name, geometry, query, code) {
  let cause; try { d2(geometry, query); } catch (error) { cause = error; }
  assert.ok(cause instanceof NativeSecondDerivativeError); assert.equal(cause.code, code);
  reject(name, geometry, query, 'DERIVATIVE', code, cause);
}
const clamped = (degree, a, b) => [...Array(degree + 1).fill(a), ...Array(degree + 1).fill(b)];
const curve = (id, degree, points, a = -3, b = 7, weights = Array(points.length).fill(1)) =>
  ({kind: 'curve', id, degree, knots: clamped(degree, a, b), controlPoints: points, weights});
const surface = (id, degreeU, degreeV, points, weights = points.map(row => Array(row.length).fill(1))) =>
  ({kind: 'surface', id, degreeU, degreeV, knotsU: clamped(degreeU, -3, 7), knotsV: clamped(degreeV, 2, 5), controlPoints: points, weights});
const arc = [[1, 0], [1, 1], [0, 1]], arcWeights = [1, Math.SQRT1_2, 1];
// Explicit rational quarter-circle coordinate and first derivative polynomials.
function arcAt(t) {
  const q = Math.SQRT1_2, W = 1 + 2 * (q - 1) * t + 2 * (1 - q) * t * t;
  const W1 = 2 * (q - 1) + 4 * (1 - q) * t;
  const A = [1 + 2 * (q - 1) * t + (1 - 2 * q) * t * t, 2 * q * t + (1 - 2 * q) * t * t];
  const A1 = [2 * (q - 1) + 2 * (1 - 2 * q) * t, 2 * q + 2 * (1 - 2 * q) * t];
  const point = A.map(value => value / W), derivative = A1.map((value, i) => (value - W1 * point[i]) / W);
  return {point, derivative};
}
function circleReference(query, a, b) {
  const value = arcAt((query.parameter - a) / (b - a)), derivative = [...value.derivative.map(x => 2 * x / (b - a)), 0];
  const speedMM = Math.hypot(...derivative);
  return {speedMM, unitTangent: derivative.map(x => x / speedMM), curvaturePerMM: .5,
    curvatureVectorPerMM: [-value.point[0] / 2, -value.point[1] / 2, 0], radiusMM: 2};
}
ownedFile('source-api.inputs', {entry, sourceInputs, cadInputs, sourceOnly: true, write: false, esbuildVersion: esbuild.version});
ownedFile('source-api.metafile', bundled.metafile);
const straight = curve('straight', 1, [[0, 0, 0], [3, 4, 0]]);
check('straight_zero_curvature', straight, [-3, 2, 7].map(parameter => ({parameter})), () =>
  ({speedMM: .5, unitTangent: [.6, .8, 0], curvaturePerMM: 0, curvatureVectorPerMM: [0, 0, 0], radiusMM: null}));
const circle = curve('circle_r2', 2, arc.map(point => [2 * point[0], 2 * point[1], 0]), -3, 7, [...arcWeights]);
const circleObservations = check('rational_circle_r2', circle, [-3, -.5, 2, 4.5, 7].map(parameter => ({parameter})), query => circleReference(query, -3, 7));
const reparameterized = {...circle, id: 'circle_new_domain', knots: clamped(2, 2, 5)};
const newCircleObservations = check('circle_changed_knot_domain', reparameterized, [2, 2.75, 3.5, 4.25, 5].map(parameter => ({parameter})), query => circleReference(query, 2, 5));
for (let i = 0; i < circleObservations.length; i++) {
  close(newCircleObservations[i].result.curvaturePerMM, circleObservations[i].result.curvaturePerMM, 'parameter invariant curvature');
  close(newCircleObservations[i].result.curvatureVectorPerMM, circleObservations[i].result.curvatureVectorPerMM, 'parameter invariant vector');
  close(newCircleObservations[i].result.speedMM / circleObservations[i].result.speedMM, 10 / 3, 'original knot-unit speed');
}
const parabola = curve('parabola', 2, [[0, 0, 0], [.5, 0, 0], [1, 1, 0]]);
check('quadratic_parabola', parabola, [-3, -1, 2, 7].map(parameter => ({parameter})), ({parameter}) => {
  const t = (parameter + 3) / 10, q = 1 + 4 * t * t, curvature = 2 / q ** 1.5;
  return {speedMM: Math.sqrt(q) / 10, unitTangent: [1 / Math.sqrt(q), 2 * t / Math.sqrt(q), 0], curvaturePerMM: curvature,
    curvatureVectorPerMM: [-4 * t / (q * q), 2 / (q * q), 0], radiusMM: 1 / curvature};
});
const plane = surface('plane', 1, 1, [[[0, 0, 0], [0, 3, 0]], [[10, 0, 0], [10, 3, 0]]]);
const surfaceQueries = [{u: -3, v: 2}, {u: -1, v: 2.75}, {u: 2, v: 3.5}, {u: 7, v: 4.25}];
check('plane_zero_curvature', plane, surfaceQueries, () =>
  ({unitNormal: [0, 0, 1], meanCurvaturePerMM: 0, gaussianCurvaturePerMM2: 0, principalCurvaturesPerMM: [0, 0]}));
const saddle = surface('saddle', 1, 1, [[[0, 0, 0], [0, 1, 0]], [[1, 0, 0], [1, 1, 1]]]);
check('saddle_negative_gaussian', saddle, surfaceQueries, ({u, v}) => {
  const s = (u + 3) / 10, t = (v - 2) / 3, q = 1 + s * s + t * t;
  const H = -s * t / q ** 1.5, K = -1 / (q * q), discriminant = Math.sqrt(H * H - K);
  return {unitNormal: [-t / Math.sqrt(q), -s / Math.sqrt(q), 1 / Math.sqrt(q)], meanCurvaturePerMM: H,
    gaussianCurvaturePerMM2: K, principalCurvaturesPerMM: [H - discriminant, H + discriminant]};
});
const cylinder = surface('cylinder_r2', 2, 1, arc.map(point => [[2 * point[0], 2 * point[1], 0], [2 * point[0], 2 * point[1], 3]]),
  arcWeights.map(weight => [weight, weight]));
const cylinderObservations = check('rational_cylinder_r2', cylinder, surfaceQueries, ({u}) => {
  const p = arcAt((u + 3) / 10).point;
  return {unitNormal: [p[0], p[1], 0], meanCurvaturePerMM: -.25, gaussianCurvaturePerMM2: 0, principalCurvaturesPerMM: [-.5, 0]};
});
function sphere(radius, id) {
  return surface(id, 2, 2, arc.map(u => arc.map(v => [radius * u[0] * v[0], radius * u[1] * v[0], radius * v[1]])),
    arcWeights.map(wu => arcWeights.map(wv => wu * wv)));
}
const sphereR2 = sphere(2, 'sphere_r2');
const sphereObservations = check('rational_sphere_r2_away_pole', sphereR2, surfaceQueries, ({u, v}) => {
  const a = arcAt((u + 3) / 10).point, b = arcAt((v - 2) / 3).point;
  return {unitNormal: [a[0] * b[0], a[1] * b[0], b[1]], meanCurvaturePerMM: -.5,
    gaussianCurvaturePerMM2: .25, principalCurvaturesPerMM: [-.5, -.5]};
});
function reverseU(geometry, id) {
  return {...geometry, id, controlPoints: geometry.controlPoints.toReversed().map(row => row.map(point => [...point])),
    weights: geometry.weights.toReversed().map(row => [...row])};
}
for (const [name, original, originalObservations, sphereCase] of [
  ['cylinder', cylinder, cylinderObservations, false], ['sphere', sphereR2, sphereObservations, true],
]) {
  const reversed = reverseU(original, 'reversed_' + name), queries = surfaceQueries.map(({u, v}) => ({u: 4 - u, v}));
  const observations = check('reversed_u_' + name, reversed, queries, ({u, v}) => {
    const a = arcAt((7 - u) / 10).point, b = sphereCase ? arcAt((v - 2) / 3).point : [1, 0];
    return {unitNormal: [-a[0] * b[0], -a[1] * b[0], sphereCase ? -b[1] : 0], meanCurvaturePerMM: sphereCase ? .5 : .25,
      gaussianCurvaturePerMM2: sphereCase ? .25 : 0, principalCurvaturesPerMM: sphereCase ? [.5, .5] : [0, .5]};
  });
  for (let i = 0; i < observations.length; i++) {
    const a = originalObservations[i].result, b = observations[i].result;
    close(b.unitNormal, a.unitNormal.map(x => -x), 'reversed native normal');
    close(b.meanCurvaturePerMM, -a.meanCurvaturePerMM, 'reversed mean sign');
    close(b.gaussianCurvaturePerMM2, a.gaussianCurvaturePerMM2, 'orientation invariant Gaussian');
    close(b.principalCurvaturesPerMM, [-a.principalCurvaturesPerMM[1], -a.principalCurvaturesPerMM[0]], 'sorted reversed principals');
  }
}

const c0 = {kind: 'curve', id: 'c0', degree: 2, knots: [0, 0, 0, 1, 1, 2, 2, 2],
  controlPoints: [[0, 0, 0], [1, 0, 0], [2, 1, 0], [3, 1, 0], [4, 0, 0]], weights: [1, 1, 1, 1, 1]};
const c1 = {kind: 'curve', id: 'c1', degree: 2, knots: [0, 0, 0, 1, 2, 2, 2],
  controlPoints: [[0, 0, 0], [1, 0, 0], [2, 1, 0], [3, 0, 0]], weights: [1, 1, 1, 1]};
derivativeReject('actual_d2_curve_c0', c0, {parameter: 1}, 'CONTINUITY');
derivativeReject('actual_d2_curve_c1', c1, {parameter: 1}, 'CONTINUITY');
const c1Surface = surface('c1_surface', 2, 1, c1.controlPoints.map(p => [[...p], [p[0], p[1], 1]]));
c1Surface.knotsU = [...c1.knots];
derivativeReject('actual_d2_surface_c1_u', c1Surface, {u: 1, v: 3.5}, 'CONTINUITY');
derivativeReject('actual_d2_invalid_query', circle, {parameter: Infinity}, 'INPUT');
derivativeReject('actual_d2_input_bounds', {...circle, controlPoints: [[10001, 0, 0], ...circle.controlPoints.slice(1)]}, {parameter: 2}, 'INPUT');
derivativeReject('actual_d2_invalid_native', {...circle, weights: [1, 0, 1]}, {parameter: 2}, 'NATIVE');
let getterCalls = 0;
const getter = {...circle}; Object.defineProperty(getter, 'degree', {enumerable: true, get() { getterCalls++; return 2; }});
derivativeReject('actual_d2_getter', getter, {parameter: 2}, 'INPUT');
const nestedGetter = structuredClone(sphereR2); Object.defineProperty(nestedGetter.controlPoints[0][0], '0', {enumerable: true, get() { getterCalls++; return 2; }});
derivativeReject('actual_d2_surface_nested_getter', nestedGetter, {u: 2, v: 3.5}, 'INPUT'); assert.equal(getterCalls, 0);

function regularityReject(name, geometry, query) {
  const before = structuredClone(geometry), derivatives = d2(geometry, query); finiteTree(derivatives);
  ownedFile(name + '.actual-valid-d2', {geometry, query, derivatives});
  reject(name, geometry, query, 'REGULARITY'); assert.deepEqual(geometry, before);
}
regularityReject('constant_curve_zero_tangent', curve('constant', 2, [[1, 2, 3], [1, 2, 3], [1, 2, 3]]), {parameter: 2});
regularityReject('stationary_curve_endpoint', curve('stationary', 2, [[0, 0, 0], [0, 0, 0], [1, 1, 0]], 0, 1), {parameter: 0});
regularityReject('surface_zero_tangent', surface('zero_u', 1, 1, [[[0, 0, 0], [0, 1, 0]], [[0, 0, 0], [0, 1, 0]]]), {u: 2, v: 3.5});
regularityReject('sphere_pole_zero_tangent', sphereR2, {u: 2, v: 5});
regularityReject('surface_collinear_tangents', surface('collinear', 1, 1, [[[0, 0, 0], [1, 0, 0]], [[1, 0, 0], [2, 0, 0]]]), {u: 2, v: 3.5});
regularityReject('surface_nearly_parallel_metric', surface('nearly_parallel', 1, 1,
  [[[0, 0, 0], [1, 1e-8, 0]], [[1, 0, 0], [2, 1e-8, 0]]]), {u: 2, v: 3.5});
const tinyParabola = curve('tiny_parabola', 2, [[0, 0, 0], [1e-310, 0, 0], [2e-310, 1e-310, 0]], 0, 1);
const hugeRadius = curve('huge_radius', 2, [[0, 0, 0], [.5, 0, 0], [1, 1e-320, 0]], 0, 1);
const underflowCurvature = curve('underflow_curvature', 2, [[0, 0, 0], [5000, 0, 0], [10000, 1e-320, 0]], 0, 1);
const tinySphere = sphere(1e-160, 'tiny_sphere');
for (const [name, geometry, query] of [
  ['finite_d2_curve_curvature_overflow', tinyParabola, {parameter: 0}],
  ['finite_d2_radius_overflow', hugeRadius, {parameter: 0}],
  ['finite_d2_nonzero_curvature_underflow', underflowCurvature, {parameter: 0}],
  ['finite_d2_gaussian_overflow', tinySphere, {u: 2, v: 3.5}],
]) {
  const source = sourceGeometry(name, geometry), before = structuredClone(source.geometry), derivatives = d2(source.geometry, query); finiteTree(derivatives);
  const authored = ownedFile(name + '.authored-refusal', {sourceFile: source.file, geometry: source.geometry, query, derivatives});
  reject(name, source.geometry, query, 'ARITHMETIC'); assert.deepEqual(source.geometry, before);
  const cold = compileCadModel(readFileSync(authored.reopened.sourceFile, 'utf8'), {sourceVersion: 0}); assert.equal(cold.ok, true, JSON.stringify(cold.diagnostics));
  bits(d2(cold.model.objects[0], authored.reopened.query), authored.reopened.derivatives);
}
let replacement = accepted[0].observations[0].result;
const previous = replacement, previousBytes = nativeJSON(previous);
assert.throws(() => { replacement = evaluateCurveCurvature(tinyParabola, 0); }, error => error instanceof NativeCurvatureError && error.code === 'ARITHMETIC');
assert.strictEqual(replacement, previous); assert.equal(nativeJSON(replacement), previousBytes); intact();
ownedFile('atomic-retention', {replacementUnchanged: replacement === previous, previous, getterCalls});

const packageRoot = resolve(repo, 'packages/barocss-cad'), manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')), declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath)); const publicAPI = await import(pathToFileURL(runtimePath).href);
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.NativeCurvatureDiagnosticCode, NativeCurvatureDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./local-curvature.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/local-curvature.d.ts'), leafDeclaration = readFileSync(leafDeclarationPath, 'utf8');
for (const name of [...runtimeNames, ...typeNames]) assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(leafDeclaration), name);
for (const item of cases) {
  const authored = JSON.parse(readFileSync(item.authoredFile, 'utf8')), saved = JSON.parse(readFileSync(item.resultFile, 'utf8'));
  const cold = publicAPI.compileCadModel(readFileSync(authored.sourceFile, 'utf8'), {sourceVersion: 0});
  assert.equal(cold.ok, true, JSON.stringify(cold.diagnostics)); assert.deepEqual(cold.model.objects[0], authored.geometry);
  assert.deepEqual(authored.queries.map(query => evaluate(cold.model.objects[0], query, publicAPI)), saved.map(row => row.result));
}
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 6, caseCount: cases.length,
  declarationCheck: 'actual built declarations and API consumption; no separate TypeScript invocation'};
ownedFile('compiled-consumer', compiledConsumer); intact();
const summary = {sourceMode: true, cadSourceInputCount: cadInputs.length, cases, refusals, compiledConsumer, caseCount: cases.length,
  queryCount: cases.reduce((sum, row) => sum + row.queryCount, 0), refusalCount: refusals.length, getterCalls,
  units: {speed: 'mm per original native knot parameter', curvature: '1/mm', radius: 'mm', mean: '1/mm', gaussian: '1/mm^2', principal: '1/mm'},
  signConvention: 'II = authored U/V unit normal dot original second partial; outward sphere mean and principals are negative',
  tolerance: 'absolute difference <= 1e-7 * max(1, abs(expected) or expected vector norm)',
  independentReferences: ['straight line', 'explicit radius2 rational circle polynomials', 'quadratic parabola', 'plane', 'graph z=x*y saddle', 'rational tensor cylinder', 'rational tensor sphere'],
  embeddedD2Bits: true, retainedInputsResultsFiles: true, coldSourceAndJSONRecompute: true,
  scope: 'Local differential geometry at the admitted query. Global shape quality, torsion, G2, face or Solid orientation and target acceptance remain separate.'};
ownedFile('summary', summary); intact(); console.log(JSON.stringify(summary));
