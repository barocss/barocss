import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node curve-interpolation-demo.mjs --source <output-directory>');
assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]);
mkdirSync(output, {recursive: true});
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const esbuild = require('esbuild'), entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundled = await esbuild.build({absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node',
  format: 'esm', write: false, target: 'es2022', metafile: true});
assert.equal(bundled.outputFiles.length, 1);
const sourceInputs = Object.keys(bundled.metafile.inputs).map(path => resolve(repo, path));
const cadInputs = sourceInputs.filter(path => path.includes('/packages/barocss-cad/'));
assert.ok(cadInputs.includes(entry)); assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/curve-interpolation.ts')));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const {buildInterpolatingCurve: build, validateInterpolatingCurve: validate, CurveInterpolationError, CurveInterpolationDiagnosticCode,
  evaluateCurve, evaluateCurveD1, curveDomain, compileCadModel, buildTranslationalSweepSurface, validateTranslationalSweepSurface,
  evaluateSurface, evaluateSurfaceD1} = api;
for (const operation of [build, validate, CurveInterpolationError]) assert.equal(typeof operation, 'function');
assert.deepEqual(Object.keys(CurveInterpolationDiagnosticCode).sort(),
  ['INPUT', 'IDENTITY', 'BUDGET', 'NATIVE', 'REPRESENTABILITY', 'CONDITIONING', 'BINDING', 'OWNED'].sort());
const accepted = [], summaries = [], failures = [], retainedFiles = new Map();
const difference = (a, b) => Math.hypot(...a.map((value, axis) => value - b[axis]));
const closePoint = (a, b) => assert.ok(difference(a, b) <= 1e-7);
const relative = (a, b) => difference(a, b) / Math.max(1, Math.hypot(...a), Math.hypot(...b));
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
function sourceFile(name, source, model) {
  const file = resolve(output, name + '.source0.css'); writeFileSync(file, source); retainedFiles.set(file, readFileSync(file));
  const cold = compileCadModel(readFileSync(file, 'utf8'), {sourceVersion: 0});
  assert.equal(cold.ok, true, JSON.stringify(cold.diagnostics)); assert.deepEqual(cold.model, model); return {file, model: cold.model};
}
function ownership(inputs, result) {
  const caller = new WeakSet(), seen = new WeakSet();
  const collect = value => { if (value && typeof value === 'object' && !caller.has(value)) {
    caller.add(value); for (const child of Object.values(value)) collect(child);
  }};
  inputs.forEach(collect);
  const visit = value => { if (value && typeof value === 'object') {
    assert.ok(!caller.has(value), 'Caller alias'); assert.ok(!seen.has(value), 'Repeated output occurrence');
    seen.add(value); for (const child of Object.values(value)) visit(child);
  }};
  visit(result);
}
function spanProbes(curve) {
  const domain = curveDomain(curve), breaks = [];
  for (const knot of curve.knots) if (knot >= domain[0] && knot <= domain[1] && !breaks.some(value => value === knot)) breaks.push(knot);
  return breaks.slice(0, -1).map((value, index) => value + (breaks[index + 1] - value) / 2);
}
const quadraticPoint = t => [t, (t + 1) ** 2 / 8, (t - 2) ** 2 / 16];
const quadraticD1 = t => [1, (t + 1) / 4, (t - 2) / 8];
const cubicPoint = t => [(t + 1) / 2, (t * t - 1) / 8, (t ** 3 - 2 * t) / 32];
const cubicD1 = t => [.5, t / 4, (3 * t * t - 2) / 32];
const maximumPoint = t => [t / 2, t * t / 32, t ** 3 / 256];
const maximumD1 = t => [.5, t / 16, 3 * t * t / 256];
const quadraticPoints = [-3, -1, 0, 2, 5].map(parameter => ({parameter, pointMM: quadraticPoint(parameter)}));
const cubicPoints = [-2, -1, 0, 1, 3, 5].map(parameter => ({parameter, pointMM: cubicPoint(parameter)}));
const maximumPoints = Array.from({length: 16}, (_, index) => index - 5).map(parameter => ({parameter, pointMM: maximumPoint(parameter)}));
const polylinePoints = [
  {parameter: -3, pointMM: [1, -0, 2]}, {parameter: -1, pointMM: [3, 1, 2]},
  {parameter: 2, pointMM: [4, 1, 0]}, {parameter: 7, pointMM: [5, 3, 1]},
];
function polylinePoint(parameter) {
  const index = Math.min(polylinePoints.length - 2, polylinePoints.findIndex((point, index) =>
    index + 1 < polylinePoints.length && parameter <= polylinePoints[index + 1].parameter));
  const a = polylinePoints[index], b = polylinePoints[index + 1], fraction = (parameter - a.parameter) / (b.parameter - a.parameter);
  return a.pointMM.map((value, axis) => value + fraction * (b.pointMM[axis] - value));
}
const coincidentPoints = [-0, 1, 3, 5].map(parameter => ({parameter, pointMM: [2, -0, 1]}));
ownedFile('source-api.metafile', bundled.metafile);
ownedFile('source-api.inputs', {entry, mode: 'in-memory-esbuild', write: false, sourceInputs, cadInputs, esbuildVersion: esbuild.version});

function check(name, points, degree, curveId, pointWitness, derivativeWitness) {
  const before = structuredClone(points), count = points.length;
  const options = {curveId, degree, maximumBasisEvaluations: count * count, maximumEliminationSteps: count * (count - 1) / 2};
  const authored = ownedFile(name + '.authored-points', {points, options});
  const result = build(points, options); ownership([points, options], result); assert.deepEqual(points, before);
  assert.deepEqual(Object.keys(result).sort(), ['points', 'options', 'curve', 'source', 'sourceVersion', 'model', 'report'].sort());
  assert.deepEqual(result.points, points); assert.deepEqual(result.options, options);
  const curve = result.curve, domain = [points[0].parameter, points[count - 1].parameter];
  assert.equal(curve.id, curveId); assert.equal(curve.degree, degree); assert.equal(curve.controlPoints.length, count);
  assert.deepEqual(curve.weights, Array(count).fill(1)); assert.deepEqual(curveDomain(curve), domain);
  assert.deepEqual(curve.controlPoints[0], points[0].pointMM); assert.deepEqual(curve.controlPoints[count - 1], points[count - 1].pointMM);
  const expectedKnots = Array(degree + 1).fill(domain[0]);
  for (let j = 1; j <= count - degree - 1; j++) {
    const origin = points[j].parameter;
    expectedKnots.push(origin + points.slice(j, j + degree).reduce((sum, point) => sum + (point.parameter - origin), 0) / degree);
  }
  expectedKnots.push(...Array(degree + 1).fill(domain[1])); assert.deepEqual(curve.knots, expectedKnots);
  let maximumResidualMM = 0;
  const probes = [];
  for (const point of points) {
    const actual = evaluateCurve(curve, point.parameter), residualMM = difference(actual, point.pointMM);
    assert.ok(residualMM <= 1e-7); maximumResidualMM = Math.max(maximumResidualMM, residualMM);
    probes.push({parameter: point.parameter, kind: 'authored-through-point', expectedPointMM: point.pointMM, actualPointMM: actual, residualMM});
  }
  if (pointWitness) for (const parameter of spanProbes(curve)) {
    const actual = evaluateCurve(curve, parameter), expected = pointWitness(parameter); closePoint(actual, expected);
    if (derivativeWitness) assert.ok(relative(evaluateCurveD1(curve, parameter).derivative, derivativeWitness(parameter)) <= 1e-7);
    probes.push({parameter, kind: 'independent-native-span-midpoint', expectedPointMM: expected, actualPointMM: actual,
      residualMM: difference(actual, expected)});
  }
  if (derivativeWitness) for (const point of points)
    assert.ok(relative(evaluateCurveD1(curve, point.parameter).derivative, derivativeWitness(point.parameter)) <= 1e-7);
  const report = result.report;
  assert.equal(report.schema, 'barocss-native-curve-interpolation'); assert.equal(report.version, 0);
  assert.equal(report.curveId, curveId); assert.equal(report.degree, degree); assert.equal(report.lengthUnit, 'mm');
  assert.equal(report.sourceFrame, 'authored-xyz-no-axis-conversion'); assert.equal(report.pointCount, count);
  assert.deepEqual(report.parameters, points.map(point => point.parameter)); assert.deepEqual(report.domain, domain);
  assert.deepEqual(report.knots, curve.knots); assert.deepEqual(report.solvedPoles, curve.controlPoints);
  assert.equal(report.knotConstruction.method, 'original-parameter-clamped-averaging');
  assert.equal(report.knotConstruction.endpointCopies, degree + 1);
  assert.equal(report.knotConstruction.averages.length, count - degree - 1);
  for (const [index, average] of report.knotConstruction.averages.entries()) {
    const j = index + 1, origin = points[j].parameter;
    const indices = Array.from({length: degree}, (_, offset) => j + offset);
    const offsetSum = indices.reduce((sum, pointIndex) => sum + (points[pointIndex].parameter - origin), 0);
    assert.equal(average.knotIndex, degree + j); assert.deepEqual(average.parameterIndices, indices);
    assert.ok(Object.is(average.origin, origin)); assert.equal(average.offsetSum, offsetSum);
    assert.ok(Object.is(average.mean, expectedKnots[degree + j]));
  }
  assert.equal(report.basisEvaluationCount, count * count); assert.equal(report.basisEvaluations.length, count * count);
  assert.equal(report.basisCurveIds.length, count); assert.equal(new Set(report.basisCurveIds).size, count);
  assert.ok(report.basisCurveIds.every(id => id !== curve.id)); assert.equal(report.basisMatrix.length, count);
  assert.deepEqual(report.pointRHS, points.map(point => point.pointMM));
  for (const [index, observation] of report.basisEvaluations.entries()) {
    const row = Math.floor(index / count), column = index % count;
    assert.equal(observation.row, row); assert.equal(observation.column, column);
    assert.ok(Object.is(observation.parameter, points[row].parameter)); assert.equal(observation.basisCurveId, report.basisCurveIds[column]);
    const basisCurve = {kind: 'curve', id: observation.basisCurveId, degree, knots: [...curve.knots], weights: Array(count).fill(1),
      controlPoints: Array.from({length: count}, (_, pole) => [pole === column ? 1 : 0, 0, 0])};
    const nativePoint = evaluateCurve(basisCurve, points[row].parameter);
    assert.deepEqual(observation.nativePointMM, nativePoint); assert.ok(Object.is(observation.coefficient, nativePoint[0]));
    assert.ok(Object.is(report.basisMatrix[row][column], nativePoint[0]));
  }
  assert.deepEqual(report.basisMatrix[0], Array.from({length: count}, (_, index) => index === 0 ? 1 : 0));
  assert.deepEqual(report.basisMatrix[count - 1], Array.from({length: count}, (_, index) => index === count - 1 ? 1 : 0));
  for (const [row, coefficients] of report.basisMatrix.entries()) {
    assert.equal(coefficients.length, count); assert.ok(coefficients.every(value => value >= 0 && value <= 1));
    assert.ok(Math.abs(coefficients.reduce((sum, value) => sum + value, 0) - 1) <= 1e-12);
    const reconstructed = [0, 1, 2].map(axis => coefficients.reduce((sum, value, column) => sum + value * curve.controlPoints[column][axis], 0));
    closePoint(reconstructed, points[row].pointMM);
  }
  const solver = report.solver;
  assert.equal(solver.method, 'deterministic-scaled-partial-pivot-xyz');
  assert.deepEqual(solver.originalRowScales, report.basisMatrix.map(row => Math.max(...row.map(Math.abs))));
  assert.equal(solver.pivots.length, count); assert.equal(solver.eliminations.length, count * (count - 1) / 2);
  assert.equal(report.eliminationStepCount, solver.eliminations.length);
  assert.deepEqual([...solver.rowOrder].sort((a, b) => a - b), Array.from({length: count}, (_, index) => index));
  for (const [column, pivot] of solver.pivots.entries()) {
    assert.equal(pivot.column, column); assert.ok(pivot.selectedCurrentRow >= column && pivot.selectedCurrentRow < count);
    assert.equal(pivot.pivotRowOriginalIndex, pivot.rowOrder[column]);
    assert.equal(pivot.rowScale, solver.originalRowScales[pivot.pivotRowOriginalIndex]);
    assert.equal(pivot.threshold, 128 * Number.EPSILON * pivot.rowScale); assert.ok(pivot.pivotMagnitude > pivot.threshold);
    assert.equal(pivot.score, pivot.pivotMagnitude / pivot.rowScale);
    assert.deepEqual(pivot.swappedCurrentRows, pivot.selectedCurrentRow === column ? null : [column, pivot.selectedCurrentRow]);
  }
  assert.deepEqual(solver.rowOrder, solver.pivots[count - 1].rowOrder);
  let eliminationIndex = 0;
  for (let column = 0; column < count; column++) for (let row = column + 1; row < count; row++) {
    const elimination = solver.eliminations[eliminationIndex++]; assert.equal(elimination.column, column); assert.equal(elimination.row, row);
    assert.equal(elimination.rowOriginalIndex, solver.pivots[column].rowOrder[row]);
    assert.equal(elimination.pivotRowOriginalIndex, solver.pivots[column].pivotRowOriginalIndex); assert.ok(Number.isFinite(elimination.factor));
  }
  assert.equal(solver.upperTriangularMatrix.length, count); assert.equal(solver.transformedRHS.length, count);
  assert.equal(solver.solvedPolesBeforeEndpointCopy.length, count);
  for (const [row, coefficients] of solver.upperTriangularMatrix.entries()) {
    assert.ok(coefficients.slice(0, row).every(value => value === 0));
    const reconstructed = [0, 1, 2].map(axis => coefficients.reduce((sum, value, column) => sum + value * solver.solvedPolesBeforeEndpointCopy[column][axis], 0));
    closePoint(reconstructed, solver.transformedRHS[row]);
  }
  assert.equal(solver.endpointRowsVerified, true); assert.equal(solver.endpointBitsCopied, true);
  assert.equal(report.pointEvaluationCount, count); assert.equal(report.observations.length, count);
  for (const [index, observation] of report.observations.entries()) {
    assert.ok(Object.is(observation.parameter, points[index].parameter)); assert.deepEqual(observation.inputPointMM, points[index].pointMM);
    const nativePoint = evaluateCurve(curve, observation.parameter); assert.deepEqual(observation.actualPointMM, nativePoint);
    assert.equal(observation.differenceMM, difference(nativePoint, points[index].pointMM));
  }
  assert.equal(report.maximumPointDifferenceMM, maximumResidualMM);
  assert.equal(report.geometricValidity, 'not-certified'); assert.equal(report.topologyCertified, false); assert.equal(report.solid, false);
  assert.equal(report.quality.localInterpolationAccuracyOnly, true); assert.equal(report.quality.regularityCertified, false);
  assert.equal(report.quality.leastSquaresFit, false); assert.equal(report.quality.weights, 'polynomial-all-one-no-rational-weight-solving');
  assert.equal(report.limits.maximumPoints, 16); assert.equal(report.limits.maximumBasisEvaluations, 256);
  assert.equal(report.limits.maximumEliminationSteps, 120); assert.equal(report.limits.pivotRelativeThreshold, 128 * Number.EPSILON);
  assert.equal(result.sourceVersion, 0); assert.equal(result.model.objects.length, 1); assert.deepEqual(result.model.objects[0], curve);
  const source = sourceFile(name, result.source, result.model);
  assert.deepEqual(curveDomain(source.model.objects[0]), domain);
  assert.deepEqual(validate(result), result.report);
  const owned = ownedFile(name + '.owned-curve', result); assert.deepEqual(validate(owned.reopened), result.report);
  assert.deepEqual(build(authored.reopened.points, authored.reopened.options), result);
  const observations = ownedFile(name + '.independent-observations', probes);
  accepted.push({result, before: structuredClone(result), points, inputBefore: before, options});
  summaries.push({name, curveId, degree, pointCount: count, domain, maximumResidualMM,
    analyticSpanProbeCount: probes.filter(probe => probe.kind === 'independent-native-span-midpoint').length,
    sourceFile: source.file, authoredFile: authored.file, resultFile: owned.file, independentObservationFile: observations.file});
  return result;
}
const polyline = check('degree1_nonunit_polyline', polylinePoints, 1, 'polyline_curve', polylinePoint);
assert.ok(Object.is(polyline.points[0].pointMM[1], -0)); assert.ok(Object.is(polyline.curve.controlPoints[0][1], -0));
const quadratic = check('known_quadratic', quadraticPoints, 2, 'quadratic_curve', quadraticPoint, quadraticD1);
const cubic = check('known_cubic_nonunit', cubicPoints, 3, 'cubic_curve', cubicPoint, cubicD1);
const originalBefore = structuredClone(quadratic), editedPoints = structuredClone(quadraticPoints);
editedPoints[2].pointMM[2] += .25;
const edited = check('numeric_point_edit', editedPoints, 2, quadratic.curve.id);
assert.deepEqual(edited.curve.knots, quadratic.curve.knots); assert.equal(edited.curve.id, quadratic.curve.id);
assert.ok(difference(evaluateCurve(edited.curve, 0), evaluateCurve(quadratic.curve, 0)) > .2);
assert.deepEqual(quadratic, originalBefore);
const maximum = check('maximum_16_points', maximumPoints, 3, 'maximum_curve', maximumPoint, maximumD1);
assert.equal(maximum.curve.controlPoints.length, 16);
const coincident = check('coincident_xyz_distinct_parameters', coincidentPoints, 3, 'coincident_curve', () => [2, -0, 1], () => [0, 0, 0]);
assert.ok(Object.is(curveDomain(coincident.curve)[0], -0));

const rail = {kind: 'curve', id: 'interpolation_rail', degree: 1, knots: [-1, -1, 4, 4],
  controlPoints: [[5, 2, 3], [8, 4, 5]], weights: [2, 1]};
const railBefore = structuredClone(rail), sweep = buildTranslationalSweepSurface(quadratic.curve, rail,
  {surfaceId: 'interpolation_sweep', maximumObservations: 961});
const sweepBefore = structuredClone(sweep); ownership([quadratic.curve, rail], sweep);
assert.deepEqual(sweep.profile, quadratic.curve); assert.deepEqual(sweep.rail, rail);
assert.deepEqual(sweep.surface.knotsU, quadratic.curve.knots); assert.deepEqual(sweep.surface.knotsV, rail.knots);
const anchor = evaluateCurve(rail, -1), sweepEvidence = [];
for (const u of [curveDomain(quadratic.curve)[0], ...spanProbes(quadratic.curve), curveDomain(quadratic.curve)[1]]) for (const v of [-1, 1.5, 4]) {
  const profilePoint = evaluateCurve(quadratic.curve, u), railPoint = evaluateCurve(rail, v);
  const expected = profilePoint.map((value, axis) => value + (railPoint[axis] - anchor[axis]));
  const actual = evaluateSurface(sweep.surface, u, v); closePoint(actual, expected);
  const d1 = evaluateSurfaceD1(sweep.surface, u, v);
  assert.ok(relative(d1.du, evaluateCurveD1(quadratic.curve, u).derivative) <= 1e-7);
  assert.ok(relative(d1.dv, evaluateCurveD1(rail, v).derivative) <= 1e-7);
  assert.ok(relative(d1.du, quadraticD1(u)) <= 1e-7);
  sweepEvidence.push({u, v, expectedPointMM: expected, actualPointMM: actual, surfaceD1: d1});
}
assert.equal(sweep.model.objects.length, 3); assert.deepEqual(sweep.model.objects, [quadratic.curve, rail, sweep.surface]);
sourceFile('interpolated_curve_native_sweep', sweep.source, sweep.model);
const sweepOwned = ownedFile('interpolated_curve_native_sweep.owned', sweep);
assert.deepEqual(validateTranslationalSweepSurface(sweepOwned.reopened), sweep.report);
ownedFile('interpolated_curve_native_sweep.independent-observations', sweepEvidence);
assert.deepEqual(rail, railBefore); assert.deepEqual(quadratic, originalBefore);

function intact() {
  for (const item of accepted) { assert.deepEqual(item.result, item.before); assert.deepEqual(item.points, item.inputBefore); }
  assert.deepEqual(quadratic, originalBefore); assert.deepEqual(rail, railBefore); assert.deepEqual(sweep, sweepBefore);
  for (const [file, bytes] of retainedFiles) assert.deepEqual(readFileSync(file), bytes, file);
}
function reject(name, action, code) {
  assert.throws(action, error => {
    assert.ok(error instanceof CurveInterpolationError); assert.equal(error.name, 'CurveInterpolationError'); assert.equal(error.code, code);
    assert.ok(Object.values(CurveInterpolationDiagnosticCode).includes(error.code));
    assert.ok(error.message.startsWith('Curve interpolation: '));
    failures.push({name, code: error.code, message: error.message, actualCausePreserved: Object.hasOwn(error, 'cause')});
    intact(); return true;
  });
}
const refusalOptions = {curveId: 'refusal_curve', degree: 2, maximumBasisEvaluations: 256, maximumEliminationSteps: 120};
reject('unsupported_degree', () => build(quadraticPoints, {...refusalOptions, degree: 4}), 'INPUT');
const decreasing = structuredClone(quadraticPoints); decreasing[2].parameter = -2;
reject('decreasing_parameters', () => build(decreasing, refusalOptions), 'INPUT');
const duplicate = structuredClone(quadraticPoints); duplicate[2].parameter = duplicate[1].parameter;
reject('duplicate_parameter', () => build(duplicate, refusalOptions), 'INPUT');
const nonfinite = structuredClone(quadraticPoints); nonfinite[2].pointMM[0] = Infinity;
reject('nonfinite_point', () => build(nonfinite, refusalOptions), 'INPUT');
reject('invalid_identity', () => build(quadraticPoints, {...refusalOptions, curveId: ''}), 'IDENTITY');
reject('basis_budget', () => build(quadraticPoints, {...refusalOptions, maximumBasisEvaluations: 24}), 'BUDGET');
reject('elimination_budget', () => build(quadraticPoints, {...refusalOptions, maximumEliminationSteps: 9}), 'BUDGET');
reject('budget_above_frozen_limit', () => build(quadraticPoints, {...refusalOptions, maximumBasisEvaluations: 257}), 'BUDGET');
let getterCalls = 0;
const getter = {...refusalOptions};
Object.defineProperty(getter, 'maximumBasisEvaluations', {enumerable: true, get() { getterCalls++; return 256; }});
reject('input_getter', () => build(quadraticPoints, getter), 'INPUT'); assert.equal(getterCalls, 0);
const ownedGetter = structuredClone(quadratic);
Object.defineProperty(ownedGetter.report, 'basisMatrix', {enumerable: true, get() { getterCalls++; return quadratic.report.basisMatrix; }});
reject('owned_getter', () => validate(ownedGetter), 'OWNED'); assert.equal(getterCalls, 0);
const illConditioned = [0, 1e-8, 2e-8, 1].map(parameter => ({parameter, pointMM: [parameter, 0, 0]}));
reject('uncertain_scaled_pivot', () => build(illConditioned, {...refusalOptions, degree: 3}), 'CONDITIONING');
const extremeOscillation = [0, 1, 2, 3, 4].map(parameter => ({parameter, pointMM: [parameter % 2 ? -10000 : 10000, 0, 0]}));
reject('derived_pole_coordinate_bound', () => build(extremeOscillation, refusalOptions), 'REPRESENTABILITY');
for (const [name, alter] of [
  ['source', result => result.source += ' '],
  ['basis_matrix', result => result.report.basisMatrix[1][1] += .1],
  ['parameter', result => result.points[0].parameter -= .1],
  ['knots', result => result.curve.knots[1] += .1],
  ['pole', result => result.curve.controlPoints[1][0] += .1],
  ['pivot', result => result.report.solver.pivots[1].threshold += 1],
  ['counter', result => result.report.eliminationStepCount++],
  ['quality', result => result.report.quality.regularityCertified = true],
]) {
  const altered = structuredClone(quadratic); alter(altered); reject('owned_' + name + '_tamper', () => validate(altered), 'OWNED');
}
assert.deepEqual(validate(quadratic), quadratic.report); intact();

const packageRoot = resolve(repo, 'packages/barocss-cad'), manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const runtimeNames = ['buildInterpolatingCurve', 'validateInterpolatingCurve', 'CurveInterpolationError', 'CurveInterpolationDiagnosticCode'];
const typeNames = ['CurveInterpolationPoint', 'CurveInterpolationOptions', 'CurveInterpolationReport', 'CurveInterpolationResult'];
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.CurveInterpolationDiagnosticCode, CurveInterpolationDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./curve-interpolation.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/curve-interpolation.d.ts'), leafDeclaration = readFileSync(leafDeclarationPath, 'utf8');
for (const name of [...runtimeNames, ...typeNames]) assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(leafDeclaration), name);
const cold = JSON.parse(readFileSync(summaries.find(row => row.name === 'known_quadratic').authoredFile, 'utf8'));
const compiled = publicAPI.buildInterpolatingCurve(cold.points, cold.options);
assert.deepEqual(compiled, quadratic); assert.deepEqual(publicAPI.validateInterpolatingCurve(compiled), quadratic.report);
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 8,
  declarationCheck: 'actual declaration export text; no separate TypeScript invocation'};
ownedFile('compiled-consumer', compiledConsumer);
const summary = {sourceMode: true, cadSourceInputCount: cadInputs.length, summaries, failures, compiledConsumer,
  caseCount: summaries.length, refusalCount: failures.length, sweepObservationCount: sweepEvidence.length,
  sweepSourceFile: resolve(output, 'interpolated_curve_native_sweep.source0.css'),
  scope: 'Explicit original-parameter global polynomial interpolation, actual normalized native basis and bounded scaled-pivot solver; native translation-sweep consumer.',
  geometricValidity: 'not-certified', regularityCertified: false, leastSquaresFit: false, solidCertified: false};
ownedFile('summary', summary); intact();
console.log(JSON.stringify(summary));
