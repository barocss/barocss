import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node surface-interpolation-demo.mjs --source <output-directory>');
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
assert.ok(cadInputs.includes(entry)); assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/nurbs/surfaces/surface-interpolation.ts')));
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/nurbs/curves/curve-interpolation.ts')));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const {buildInterpolatingSurface: build, validateInterpolatingSurface: validate, SurfaceInterpolationError, SurfaceInterpolationDiagnosticCode,
  CurveInterpolationError, validateInterpolatingCurve, evaluateSurface, evaluateSurfaceD1, evaluateCurve, evaluateCurveD1,
  surfaceDomain, curveDomain, compileCadModel, extractSurfaceIsoCurve} = api;
for (const operation of [build, validate, SurfaceInterpolationError]) assert.equal(typeof operation, 'function');
assert.deepEqual(Object.keys(SurfaceInterpolationDiagnosticCode).sort(),
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
function spanProbes(knots, domain) {
  const breaks = [];
  for (const knot of knots) if (knot >= domain[0] && knot <= domain[1] && !breaks.some(value => value === knot)) breaks.push(knot);
  return breaks.slice(0, -1).map((value, index) => value + (breaks[index + 1] - value) / 2);
}
const grid = (u, v, point) => u.map(a => v.map(b => point(a, b)));
const bilinearPoint = (u, v) => [(u + 3) / 5, v - 2, (u + 3) * (v - 2) / 10];
const bilinearD1 = (u, v) => ({du: [.2, 0, (v - 2) / 10], dv: [0, 1, (u + 3) / 10]});
const quadraticPoint = (u, v) => [u, v, (u + 1) ** 2 / 16 + (u - 2) * v / 32];
const quadraticD1 = (u, v) => ({du: [1, 0, (u + 1) / 8 + v / 32], dv: [0, 1, (u - 2) / 32]});
const bicubicPoint = (u, v) => [u + v / 4, (u * u - 1) / 8 + v / 2,
  (u ** 3 - 2 * u) / 64 + (v ** 3 - v) / 128 + u * v / 16 + u * u * v * v / 256];
const bicubicD1 = (u, v) => ({du: [1, u / 4, (3 * u * u - 2) / 64 + v / 16 + u * v * v / 128],
  dv: [.25, .5, (3 * v * v - 1) / 128 + u / 16 + u * u * v / 128]});
const maximumPoint = (u, v) => [u / 4, v / 4, (u * u + v * v) / 128 + u * v / 256];
const maximumD1 = (u, v) => ({du: [.25, 0, u / 64 + v / 256], dv: [0, .25, v / 64 + u / 256]});
const bilinearU = [-3, 7], bilinearV = [2, 5], bilinearGrid = grid(bilinearU, bilinearV, bilinearPoint);
bilinearGrid[0][0] = [-0, -0, -0];
const quadraticU = [-3, -1, 0, 2, 5], quadraticV = [2, 4, 7];
const quadraticGrid = grid(quadraticU, quadraticV, quadraticPoint);
const bicubicU = [-2, -1, 0, 2, 5], bicubicV = [1, 2, 4, 6], bicubicGrid = grid(bicubicU, bicubicV, bicubicPoint);
const maximumU = Array.from({length: 16}, (_, index) => index - 5), maximumV = Array.from({length: 16}, (_, index) => index - 2);
const maximumGrid = grid(maximumU, maximumV, maximumPoint);
const coincidentU = [-0, 1, 3, 5], coincidentV = [2, 3, 7, 8], coincidentGrid = grid(coincidentU, coincidentV, () => [2, -0, 1]);
ownedFile('source-api.metafile', bundled.metafile);
ownedFile('source-api.inputs', {entry, mode: 'in-memory-esbuild', write: false, sourceInputs, cadInputs, esbuildVersion: esbuild.version});

function check(name, parametersU, parametersV, points, degreeU, degreeV, surfaceId, pointWitness, derivativeWitness) {
  const before = structuredClone({parametersU, parametersV, points}), n = parametersU.length, m = parametersV.length;
  const planned = {basisEvaluations: n * m * (n + m), eliminationSteps: n * m * (n + m - 2) / 2,
    surfaceEvaluations: n * m, curveConstructions: n + m, nestedCurvePointEvaluations: 2 * n * m};
  const options = {surfaceId, degreeU, degreeV, maximumBasisEvaluations: planned.basisEvaluations,
    maximumEliminationSteps: planned.eliminationSteps, maximumSurfaceEvaluations: planned.surfaceEvaluations};
  const authored = ownedFile(name + '.authored-grid', {parametersU, parametersV, points, options});
  const result = build(parametersU, parametersV, points, options); ownership([parametersU, parametersV, points, options], result);
  assert.deepEqual({parametersU, parametersV, points}, before);
  assert.deepEqual(Object.keys(result).sort(), ['parametersU', 'parametersV', 'points', 'options', 'surface', 'source', 'sourceVersion', 'model', 'report'].sort());
  assert.deepEqual(result.parametersU, parametersU); assert.deepEqual(result.parametersV, parametersV); assert.deepEqual(result.points, points);
  assert.deepEqual(result.options, options);
  const surface = result.surface, domains = {u: [parametersU[0], parametersU[n - 1]], v: [parametersV[0], parametersV[m - 1]]};
  assert.equal(surface.id, surfaceId); assert.equal(surface.degreeU, degreeU); assert.equal(surface.degreeV, degreeV);
  assert.deepEqual(surfaceDomain(surface), domains); assert.equal(surface.controlPoints.length, n);
  assert.ok(surface.controlPoints.every(row => row.length === m)); assert.deepEqual(surface.weights, Array.from({length: n}, () => Array(m).fill(1)));
  for (const [i, j] of [[0, 0], [0, m - 1], [n - 1, 0], [n - 1, m - 1]]) assert.deepEqual(surface.controlPoints[i][j], points[i][j]);
  const report = result.report;
  assert.equal(report.schema, 'barocss-native-surface-interpolation'); assert.equal(report.version, 0);
  assert.equal(report.surfaceId, surfaceId); assert.equal(report.lengthUnit, 'mm'); assert.equal(report.sourceFrame, 'authored-xyz-no-axis-conversion');
  assert.equal(report.degreeU, degreeU); assert.equal(report.degreeV, degreeV);
  assert.deepEqual(report.pointGrid, [n, m]); assert.deepEqual(report.controlPointGrid, [n, m]);
  assert.deepEqual(report.parametersU, parametersU); assert.deepEqual(report.parametersV, parametersV); assert.deepEqual(report.domains, domains);
  assert.deepEqual(report.knotsU, surface.knotsU); assert.deepEqual(report.knotsV, surface.knotsV);
  assert.deepEqual(report.axisRoles, {u: 'original-u-grid-parameter', v: 'original-v-grid-parameter'});
  assert.deepEqual(report.plannedCounts, planned); assert.equal(report.phaseU.length, m); assert.equal(report.phaseV.length, n);
  const phases = [...report.phaseU, ...report.phaseV], ids = phases.map(phase => phase.curveId);
  assert.equal(new Set([surface.id, ...ids]).size, n + m + 1);
  for (const phase of phases) {
    const child = phase.evaluation, axisParameters = phase.axis === 'u' ? parametersU : parametersV;
    const degree = phase.axis === 'u' ? degreeU : degreeV, count = axisParameters.length;
    assert.equal(phase.curveId, child.curve.id); assert.equal(child.curve.degree, degree);
    assert.deepEqual(child.curve.weights, Array(count).fill(1)); assert.deepEqual(child.report.parameters, axisParameters);
    assert.deepEqual(child.options, {curveId: phase.curveId, degree, maximumBasisEvaluations: count * count,
      maximumEliminationSteps: count * (count - 1) / 2});
    assert.deepEqual(validateInterpolatingCurve(child), child.report);
    assert.deepEqual(child.model.objects, [child.curve]); assert.equal(child.sourceVersion, 0);
    if (phase.index === 0) sourceFile(name + '.phase_' + phase.axis + '_0', child.source, child.model);
  }
  for (const [j, phase] of report.phaseU.entries()) {
    assert.equal(phase.axis, 'u'); assert.equal(phase.role, 'fixed-v-column'); assert.equal(phase.index, j);
    assert.deepEqual(phase.evaluation.points, parametersU.map((parameter, i) => ({parameter, pointMM: points[i][j]})));
    assert.deepEqual(phase.evaluation.curve.knots, surface.knotsU);
  }
  for (const [i, phase] of report.phaseV.entries()) {
    assert.equal(phase.axis, 'v'); assert.equal(phase.role, 'solved-u-pole-row'); assert.equal(phase.index, i);
    assert.deepEqual(phase.evaluation.points, parametersV.map((parameter, j) => ({parameter,
      pointMM: report.phaseU[j].evaluation.curve.controlPoints[i]})));
    assert.deepEqual(phase.evaluation.curve.knots, surface.knotsV); assert.deepEqual(phase.evaluation.curve.controlPoints, surface.controlPoints[i]);
  }
  assert.equal(report.curveConstructionCount, phases.length);
  assert.equal(report.basisEvaluationCount, phases.reduce((sum, phase) => sum + phase.evaluation.report.basisEvaluationCount, 0));
  assert.equal(report.eliminationStepCount, phases.reduce((sum, phase) => sum + phase.evaluation.report.eliminationStepCount, 0));
  assert.equal(report.nestedCurvePointEvaluationCount, phases.reduce((sum, phase) => sum + phase.evaluation.report.pointEvaluationCount, 0));
  assert.equal(report.basisEvaluationCount, planned.basisEvaluations); assert.equal(report.eliminationStepCount, planned.eliminationSteps);
  assert.equal(report.nestedCurvePointEvaluationCount, planned.nestedCurvePointEvaluations);
  assert.equal(report.surfaceEvaluationCount, n * m); assert.equal(report.observations.length, n * m);
  let maximumResidualMM = 0;
  for (const [index, observation] of report.observations.entries()) {
    const i = Math.floor(index / m), j = index % m;
    assert.deepEqual(observation.inputIndex, [i, j]); assert.ok(Object.is(observation.u, parametersU[i])); assert.ok(Object.is(observation.v, parametersV[j]));
    assert.deepEqual(observation.inputPointMM, points[i][j]);
    const actual = evaluateSurface(surface, parametersU[i], parametersV[j]), residual = difference(actual, points[i][j]);
    assert.deepEqual(observation.actualPointMM, actual); assert.equal(observation.differenceMM, residual); assert.ok(residual <= 1e-7);
    maximumResidualMM = Math.max(maximumResidualMM, residual);
  }
  assert.equal(report.maximumPointDifferenceMM, maximumResidualMM); assert.equal(report.cornerBitsPreserved, true);
  const probes = [];
  if (pointWitness) for (const u of spanProbes(surface.knotsU, domains.u)) for (const v of spanProbes(surface.knotsV, domains.v)) {
    const actual = evaluateSurface(surface, u, v), expected = pointWitness(u, v); closePoint(actual, expected);
    const d1 = evaluateSurfaceD1(surface, u, v), expectedD1 = derivativeWitness(u, v);
    assert.ok(relative(d1.du, expectedD1.du) <= 1e-7); assert.ok(relative(d1.dv, expectedD1.dv) <= 1e-7);
    probes.push({u, v, expectedPointMM: expected, actualPointMM: actual, expectedD1, actualD1: d1, differenceMM: difference(actual, expected)});
  }
  assert.equal(report.geometricValidity, 'not-certified'); assert.equal(report.topologyCertified, false); assert.equal(report.solid, false);
  assert.equal(report.quality.authority, 'actual-public-native-curve-interpolation-in-u-then-v');
  assert.equal(report.quality.regularityCertified, false); assert.equal(report.quality.noBasisFactorCacheClaimed, true);
  assert.equal(report.quality.source, 'single-native-surface-model-intermediate-curve-sources-retained-as-nested-proofs');
  assert.equal(result.sourceVersion, 0); assert.deepEqual(result.model.objects, [surface]);
  const source = sourceFile(name, result.source, result.model);
  assert.deepEqual(surfaceDomain(source.model.objects[0]), domains); assert.deepEqual(validate(result), report);
  const owned = ownedFile(name + '.owned-surface', result); assert.deepEqual(validate(owned.reopened), report);
  assert.deepEqual(build(authored.reopened.parametersU, authored.reopened.parametersV, authored.reopened.points, authored.reopened.options), result);
  const observations = ownedFile(name + '.independent-observations', probes);
  accepted.push({result, before: structuredClone(result), parametersU, parametersV, points, inputBefore: before, options});
  summaries.push({name, surfaceId, degrees: [degreeU, degreeV], pointGrid: [n, m], domains,
    basisEvaluationCount: report.basisEvaluationCount, eliminationStepCount: report.eliminationStepCount,
    directSurfaceEvaluationCount: report.surfaceEvaluationCount, curveConstructionCount: report.curveConstructionCount,
    nestedCurvePointEvaluationCount: report.nestedCurvePointEvaluationCount, maximumResidualMM, analyticProbeCount: probes.length,
    sourceFile: source.file, authoredFile: authored.file, resultFile: owned.file, independentObservationFile: observations.file});
  return result;
}
const bilinear = check('bilinear_nonunit', bilinearU, bilinearV, bilinearGrid, 1, 1, 'bilinear_surface', bilinearPoint, bilinearD1);
assert.ok(Object.is(bilinear.surface.controlPoints[0][0][2], -0));
const quadratic = check('quadratic_linear_rectangular', quadraticU, quadraticV, quadraticGrid, 2, 1, 'quadratic_surface', quadraticPoint, quadraticD1);
assert.throws(() => evaluateSurfaceD1(quadratic.surface, 0, 4), /C0 interior knot/);
const bicubic = check('known_bicubic_nonunit', bicubicU, bicubicV, bicubicGrid, 3, 3, 'bicubic_surface', bicubicPoint, bicubicD1);
const originalBefore = structuredClone(bicubic), editedGrid = structuredClone(bicubicGrid); editedGrid[2][1][2] += .5;
const edited = check('numeric_point_edit', bicubicU, bicubicV, editedGrid, 3, 3, bicubic.surface.id);
assert.deepEqual(edited.surface.knotsU, bicubic.surface.knotsU); assert.deepEqual(edited.surface.knotsV, bicubic.surface.knotsV);
assert.ok(difference(evaluateSurface(edited.surface, 0, 2), evaluateSurface(bicubic.surface, 0, 2)) > .4);
assert.deepEqual(bicubic, originalBefore);
const maximum = check('maximum_16_by_16', maximumU, maximumV, maximumGrid, 3, 3, 'maximum_surface', maximumPoint, maximumD1);
assert.equal(maximum.report.basisEvaluationCount, 8192); assert.equal(maximum.report.eliminationStepCount, 3840);
assert.equal(maximum.report.surfaceEvaluationCount, 256); assert.equal(maximum.report.curveConstructionCount, 32);
const coincident = check('coincident_xyz_grid', coincidentU, coincidentV, coincidentGrid, 3, 3, 'coincident_surface', () => [2, -0, 1],
  () => ({du: [0, 0, 0], dv: [0, 0, 0]}));
assert.ok(Object.is(surfaceDomain(coincident.surface).u[0], -0));

const iso = extractSurfaceIsoCurve(bicubic.surface, {fixedAxis: 'v', parameter: 3.5, curveId: 'interpolation_iso'});
assert.deepEqual(iso.original, bicubic.surface); assert.equal(iso.curve.degree, 3);
assert.deepEqual(iso.curve.knots, bicubic.surface.knotsU); assert.deepEqual(curveDomain(iso.curve), surfaceDomain(bicubic.surface).u);
for (const u of [...bicubicU, ...spanProbes(bicubic.surface.knotsU, surfaceDomain(bicubic.surface).u)]) {
  closePoint(evaluateCurve(iso.curve, u), evaluateSurface(bicubic.surface, u, 3.5));
  closePoint(evaluateCurve(iso.curve, u), bicubicPoint(u, 3.5));
  assert.ok(relative(evaluateCurveD1(iso.curve, u).derivative, bicubicD1(u, 3.5).du) <= 1e-7);
}
sourceFile('selected_original_v_isocurve', iso.source, iso.model); ownedFile('selected_original_v_isocurve.owned', iso);

function intact() {
  for (const item of accepted) {
    assert.deepEqual(item.result, item.before);
    assert.deepEqual({parametersU: item.parametersU, parametersV: item.parametersV, points: item.points}, item.inputBefore);
  }
  assert.deepEqual(bicubic, originalBefore);
  for (const [file, bytes] of retainedFiles) assert.deepEqual(readFileSync(file), bytes, file);
}
function reject(name, action, code, context = null) {
  assert.throws(action, error => {
    assert.ok(error instanceof SurfaceInterpolationError); assert.equal(error.name, 'SurfaceInterpolationError'); assert.equal(error.code, code);
    assert.ok(Object.values(SurfaceInterpolationDiagnosticCode).includes(error.code)); assert.ok(error.message.startsWith('Surface interpolation: '));
    assert.equal(error.axis, context?.axis ?? null); assert.equal(error.index, context?.index ?? null);
    if (context?.childCause) { assert.ok(error.cause instanceof CurveInterpolationError); assert.equal(error.cause.code, code); }
    failures.push({name, code: error.code, axis: error.axis, index: error.index, message: error.message,
      actualCausePreserved: Object.hasOwn(error, 'cause'), childCauseName: error.cause?.name ?? null});
    intact(); return true;
  });
}
const refusalOptions = {surfaceId: 'refusal_surface', degreeU: 3, degreeV: 3,
  maximumBasisEvaluations: 8192, maximumEliminationSteps: 3840, maximumSurfaceEvaluations: 256};
const wrongDimensions = structuredClone(bicubicGrid); wrongDimensions[1].pop();
reject('nonrectangular_dimensions', () => build(bicubicU, bicubicV, wrongDimensions, refusalOptions), 'INPUT');
const unorderedU = [...bicubicU]; unorderedU[2] = -2;
reject('unordered_u_parameters', () => build(unorderedU, bicubicV, bicubicGrid, refusalOptions), 'INPUT', {axis: 'u', index: 2});
const duplicateV = [...bicubicV]; duplicateV[2] = duplicateV[1];
reject('duplicate_v_parameter', () => build(bicubicU, duplicateV, bicubicGrid, refusalOptions), 'INPUT', {axis: 'v', index: 2});
reject('unsupported_degree', () => build(bicubicU, bicubicV, bicubicGrid, {...refusalOptions, degreeV: 4}), 'INPUT', {axis: 'v', index: null});
reject('invalid_identity', () => build(bicubicU, bicubicV, bicubicGrid, {...refusalOptions, surfaceId: ''}), 'IDENTITY');
const nonfinite = structuredClone(bicubicGrid); nonfinite[1][1][2] = Infinity;
reject('nonfinite_grid_point', () => build(bicubicU, bicubicV, nonfinite, refusalOptions), 'INPUT');
reject('basis_budget', () => build(bicubicU, bicubicV, bicubicGrid, {...refusalOptions, maximumBasisEvaluations: 179}), 'BUDGET');
reject('elimination_budget', () => build(bicubicU, bicubicV, bicubicGrid, {...refusalOptions, maximumEliminationSteps: 69}), 'BUDGET');
reject('surface_observation_budget', () => build(bicubicU, bicubicV, bicubicGrid, {...refusalOptions, maximumSurfaceEvaluations: 19}), 'BUDGET');
let getterCalls = 0;
const getter = {...refusalOptions};
Object.defineProperty(getter, 'maximumSurfaceEvaluations', {enumerable: true, get() { getterCalls++; return 256; }});
reject('input_getter', () => build(bicubicU, bicubicV, bicubicGrid, getter), 'INPUT'); assert.equal(getterCalls, 0);
const ownedGetter = structuredClone(bicubic);
Object.defineProperty(ownedGetter.report, 'phaseU', {enumerable: true, get() { getterCalls++; return bicubic.report.phaseU; }});
reject('owned_getter', () => validate(ownedGetter), 'OWNED'); assert.equal(getterCalls, 0);
const closeParameters = [0, 1e-8, 2e-8, 1], simpleParameters = [2, 5];
reject('delegated_u_pivot_guard', () => build(closeParameters, simpleParameters, grid(closeParameters, simpleParameters, (u, v) => [u, v, 0]),
  {...refusalOptions, degreeU: 3, degreeV: 1}), 'CONDITIONING', {axis: 'u', index: 0, childCause: true});
reject('delegated_v_pivot_guard', () => build(simpleParameters, closeParameters, grid(simpleParameters, closeParameters, (u, v) => [u, v, 0]),
  {...refusalOptions, degreeU: 1, degreeV: 3}), 'CONDITIONING', {axis: 'v', index: 0, childCause: true});
const oscillatingU = [0, 1, 2, 3, 4];
reject('delegated_generated_pole_bound', () => build(oscillatingU, simpleParameters,
  grid(oscillatingU, simpleParameters, (u, v) => [u % 2 ? -10000 : 10000, v, 0]),
  {...refusalOptions, degreeU: 2, degreeV: 1}), 'REPRESENTABILITY', {axis: 'u', index: 0, childCause: true});
for (const [name, alter] of [
  ['source', result => result.source += ' '],
  ['pole', result => result.surface.controlPoints[0][1][0] += .1],
  ['parameters', result => result.parametersU[0] -= .1],
  ['child_solver', result => result.report.phaseU[0].evaluation.report.solver.pivots[0].threshold += 1],
  ['child_source', result => result.report.phaseV[0].evaluation.source += ' '],
  ['knots', result => result.surface.knotsU[1] += .1],
  ['phase_identity', result => result.report.phaseU[0].curveId = 'unrelated_work_curve'],
  ['observation', result => result.report.observations[0].actualPointMM[0] += .1],
  ['aggregate_count', result => result.report.basisEvaluationCount++],
  ['frame', result => result.report.sourceFrame = 'y-up'],
]) {
  const altered = structuredClone(bicubic); alter(altered); reject('owned_' + name + '_tamper', () => validate(altered), 'OWNED');
}
assert.deepEqual(validate(bicubic), bicubic.report); intact();

const packageRoot = resolve(repo, 'packages/barocss-cad'), manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const runtimeNames = ['buildInterpolatingSurface', 'validateInterpolatingSurface', 'SurfaceInterpolationError', 'SurfaceInterpolationDiagnosticCode'];
const typeNames = ['SurfaceInterpolationOptions', 'SurfaceInterpolationObservation', 'SurfaceInterpolationReport', 'SurfaceInterpolationResult'];
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.SurfaceInterpolationDiagnosticCode, SurfaceInterpolationDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./surface-interpolation.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/nurbs/surfaces/surface-interpolation.d.ts'), leafDeclaration = readFileSync(leafDeclarationPath, 'utf8');
for (const name of [...runtimeNames, ...typeNames]) assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(leafDeclaration), name);
const cold = JSON.parse(readFileSync(summaries.find(row => row.name === 'known_bicubic_nonunit').authoredFile, 'utf8'));
const compiled = publicAPI.buildInterpolatingSurface(cold.parametersU, cold.parametersV, cold.points, cold.options);
assert.deepEqual(compiled, bicubic); assert.deepEqual(publicAPI.validateInterpolatingSurface(compiled), bicubic.report);
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 8,
  declarationCheck: 'actual declaration export text; no separate TypeScript invocation'};
ownedFile('compiled-consumer', compiledConsumer);
const summary = {sourceMode: true, cadSourceInputCount: cadInputs.length, summaries, failures, compiledConsumer,
  caseCount: summaries.length, refusalCount: failures.length, isoSourceFile: resolve(output, 'selected_original_v_isocurve.source0.css'),
  scope: 'Explicit original-parameter tensor-product interpolation via actual native Curve constructors in U then V, local analytic Surface D0/D1 and native isoCurve consumer.',
  geometricValidity: 'not-certified', regularityCertified: false, leastSquaresFit: false, solidCertified: false};
ownedFile('summary', summary); intact();
console.log(JSON.stringify(summary));
