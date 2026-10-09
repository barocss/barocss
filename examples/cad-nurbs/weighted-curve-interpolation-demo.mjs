import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 4, 'Usage: node weighted-curve-interpolation-demo.mjs --source <output-directory> --polynomial-directory <saved943-directory>');
assert.equal(args[0], '--source'); assert.equal(args[2], '--polynomial-directory');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]), polynomialDirectory = resolve(args[3]);
mkdirSync(output, {recursive: true});
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const esbuild = require('esbuild'), entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundled = await esbuild.build({absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node',
  format: 'esm', write: false, target: 'es2022', metafile: true});
assert.equal(bundled.outputFiles.length, 1);
const sourceInputs = Object.keys(bundled.metafile.inputs).map(path => resolve(repo, path));
const cadInputs = sourceInputs.filter(path => path.includes('/packages/barocss-cad/'));
for (const file of ['index.ts', 'curve-interpolation.ts', 'curve-interpolation-kernel-internal.ts', 'weighted-curve-interpolation.ts'])
  assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src', file)));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const {buildWeightedInterpolatingCurve: build, validateWeightedInterpolatingCurve: validate,
  WeightedCurveInterpolationError, WeightedCurveInterpolationDiagnosticCode, CurveInterpolationError,
  buildInterpolatingCurve, validateInterpolatingCurve, buildParameterizedInterpolatingCurve,
  evaluateCurve, evaluateCurveD1, curveDomain, compileCadModel} = api;
for (const operation of [build, validate, WeightedCurveInterpolationError]) assert.equal(typeof operation, 'function');
assert.deepEqual(Object.keys(WeightedCurveInterpolationDiagnosticCode).sort(),
  ['INPUT', 'IDENTITY', 'BUDGET', 'NATIVE', 'REPRESENTABILITY', 'CONDITIONING', 'BINDING', 'OWNED'].sort());
const accepted = [], targets = [], summaries = [], failures = [], provenance = [], retainedFiles = new Map();
const difference = (a, b) => Math.hypot(...a.map((value, axis) => value - b[axis]));
const closePoint = (a, b) => assert.ok(difference(a, b) <= 1e-7);
const relative = (a, b) => difference(a, b) / Math.max(1, Math.hypot(...a), Math.hypot(...b));
const decimal = value => Object.is(value, -0) ? '-0' : String(value);
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
function retainInput(name, file) {
  const bytes = readFileSync(file); retainedFiles.set(file, bytes);
  provenance.push({name, file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')}); return bytes;
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
function nativeTarget(name, curve) {
  const model = {name: curve.id + '_model', version: 0, lengthUnit: 'mm', objects: [curve]};
  const list = values => '[' + values.map(decimal).join(',') + ']';
  const source = '@model ' + model.name + ' { version:0; length-unit:mm; @curve #' + curve.id +
    ' { type:nurbs; degree:' + curve.degree + '; knots:' + list(curve.knots) + '; control-points:[' + curve.controlPoints.map(list).join(',') +
    ']; weights:' + list(curve.weights) + '; } }\n';
  const stored = sourceFile(name + '.original-target', source, model), native = stored.model.objects[0];
  const owned = ownedFile(name + '.original-target', native);
  targets.push({curve: native, before: structuredClone(native)}); return {curve: native, sourceFile: stored.file, resultFile: owned.file};
}
const quarterTarget = nativeTarget('quarter', {kind: 'curve', id: 'quarter_target', degree: 2, knots: [-3, -3, -3, 7, 7, 7],
  controlPoints: [[2, -0, 0], [2, 2, 0], [0, 2, 0]], weights: [1, Math.SQRT1_2, 1]});
const cubicTarget = nativeTarget('cubic', {kind: 'curve', id: 'cubic_target', degree: 3, knots: [-2, -2, -2, -2, 5, 5, 5, 5],
  controlPoints: [[1, -0, 2], [2, 3, 0], [4, -1, 1], [6, 2, 3]], weights: [1, 2, 3, 1.5]});
const maximumParameters = Array.from({length: 16}, (_, index) => index - 5);
const maximumTarget = nativeTarget('maximum', {kind: 'curve', id: 'maximum_target', degree: 3,
  knots: [-5, -5, -5, -5, ...Array.from({length: 12}, (_, index) => index - 3), 10, 10, 10, 10],
  controlPoints: Array.from({length: 16}, (_, i) => [i / 2, i * i / 128, i ** 3 / 4096]),
  weights: Array.from({length: 16}, (_, index) => 1 + index / 64)});
const throughPoints = (target, parameters) => parameters.map(parameter => ({parameter, pointMM: evaluateCurve(target.curve, parameter)}));
const quarterPoints = throughPoints(quarterTarget, [-3, 2, 7]), cubicPoints = throughPoints(cubicTarget, [-2, -.5, 2, 5]);
ownedFile('source-api.metafile', bundled.metafile);
ownedFile('source-api.inputs', {entry, mode: 'in-memory-esbuild', write: false, sourceInputs, cadInputs, esbuildVersion: esbuild.version});

function check(name, points, weights, degree, curveId, target = null, extraProbes = []) {
  const before = structuredClone({points, weights}), count = points.length;
  const options = {curveId, degree, maximumBasisEvaluations: count * count, maximumEliminationSteps: count * (count - 1) / 2};
  const authored = ownedFile(name + '.authored-points-weights', {points, weights, options});
  const result = build(points, weights, options); ownership([points, weights, options], result);
  assert.deepEqual({points, weights}, before);
  assert.deepEqual(Object.keys(result).sort(), ['points', 'weights', 'options', 'curve', 'source', 'sourceVersion', 'model', 'report'].sort());
  assert.deepEqual(result.points, points); assert.deepEqual(result.weights, weights); assert.deepEqual(result.options, options);
  const curve = result.curve, report = result.report, domain = [points[0].parameter, points[count - 1].parameter];
  assert.equal(curve.id, curveId); assert.equal(curve.degree, degree); assert.equal(curve.controlPoints.length, count);
  assert.deepEqual(curve.weights, weights); assert.deepEqual(curveDomain(curve), domain);
  assert.deepEqual(curve.controlPoints[0], points[0].pointMM); assert.deepEqual(curve.controlPoints[count - 1], points[count - 1].pointMM);
  assert.equal(report.schema, 'barocss-native-weighted-curve-interpolation'); assert.equal(report.version, 0);
  assert.equal(report.curveId, curveId); assert.equal(report.degree, degree); assert.equal(report.lengthUnit, 'mm');
  assert.equal(report.sourceFrame, 'authored-xyz-no-axis-conversion'); assert.equal(report.pointCount, count);
  assert.deepEqual(report.weights, weights); assert.deepEqual(report.parameters, points.map(point => point.parameter));
  assert.deepEqual(report.domain, domain); assert.deepEqual(report.knots, curve.knots); assert.deepEqual(report.solvedPoles, curve.controlPoints);
  assert.deepEqual(report.pointRHS, points.map(point => point.pointMM));
  assert.equal(report.basisEvaluationCount, count * count); assert.equal(report.basisEvaluations.length, count * count);
  assert.equal(report.eliminationStepCount, count * (count - 1) / 2); assert.equal(report.pointEvaluationCount, count);
  for (const [index, observation] of report.basisEvaluations.entries()) {
    const row = Math.floor(index / count), column = index % count;
    assert.equal(observation.row, row); assert.equal(observation.column, column);
    assert.ok(Object.is(observation.parameter, points[row].parameter));
    const nativeUnitCurve = {kind: 'curve', id: observation.basisCurveId, degree, knots: [...curve.knots], weights: [...weights],
      controlPoints: Array.from({length: count}, (_, pole) => [pole === column ? 1 : 0, 0, 0])};
    const nativePoint = evaluateCurve(nativeUnitCurve, observation.parameter);
    assert.deepEqual(observation.nativePointMM, nativePoint); assert.ok(Object.is(observation.coefficient, nativePoint[0]));
    assert.ok(Object.is(report.basisMatrix[row][column], nativePoint[0]));
  }
  for (const [row, coefficients] of report.basisMatrix.entries()) {
    const reconstructed = [0, 1, 2].map(axis => coefficients.reduce((sum, coefficient, column) => sum + coefficient * curve.controlPoints[column][axis], 0));
    closePoint(reconstructed, points[row].pointMM);
  }
  assert.equal(report.solver.pivots.length, count); assert.equal(report.solver.eliminations.length, report.eliminationStepCount);
  for (const pivot of report.solver.pivots) {
    assert.equal(pivot.threshold, 128 * Number.EPSILON * pivot.rowScale); assert.ok(pivot.pivotMagnitude > pivot.threshold);
  }
  assert.equal(report.solver.endpointRowsVerified, true); assert.equal(report.solver.endpointBitsCopied, true);
  const probes = [];
  let maximumResidualMM = 0;
  for (const point of points) {
    const actual = evaluateCurve(curve, point.parameter), residualMM = difference(actual, point.pointMM); assert.ok(residualMM <= 1e-7);
    maximumResidualMM = Math.max(maximumResidualMM, residualMM);
    probes.push({parameter: point.parameter, kind: 'authored-through-point', actualPointMM: actual, inputPointMM: point.pointMM, residualMM});
  }
  assert.equal(report.maximumPointDifferenceMM, maximumResidualMM);
  for (const parameter of [...points.map(point => point.parameter), ...spanProbes(curve), ...extraProbes]) {
    const actualPointMM = evaluateCurve(curve, parameter), actualD1 = evaluateCurveD1(curve, parameter);
    if (target) {
      const expectedPointMM = evaluateCurve(target.curve, parameter), expectedD1 = evaluateCurveD1(target.curve, parameter);
      closePoint(actualPointMM, expectedPointMM); assert.ok(relative(actualD1.derivative, expectedD1.derivative) <= 1e-7);
      probes.push({parameter, kind: 'original-native-target', expectedPointMM, actualPointMM, expectedD1, actualD1});
    } else probes.push({parameter, kind: 'native-curve-probe', actualPointMM, actualD1});
  }
  if (target) assert.deepEqual(curve.knots, target.curve.knots);
  assert.equal(report.quality.weights, 'supplied-positive-fixed-weights-no-weight-fitting');
  assert.equal(report.quality.providedWeightBitsPreserved, true); assert.equal(report.quality.weightOptimization, false);
  assert.equal(report.quality.commonWeightScalingGlobalInvarianceCertified, false);
  assert.equal(report.quality.regularityCertified, false); assert.equal(report.geometricValidity, 'not-certified');
  assert.equal(report.topologyCertified, false); assert.equal(report.solid, false); assert.deepEqual(report.limits.weightRange, [1e-6, 1e6]);
  assert.equal(result.sourceVersion, 0); assert.deepEqual(result.model.objects, [curve]);
  const source = sourceFile(name, result.source, result.model); assert.deepEqual(source.model.objects[0], curve);
  assert.deepEqual(validate(result), report);
  const owned = ownedFile(name + '.owned-weighted-curve', result); assert.deepEqual(validate(owned.reopened), report);
  assert.deepEqual(build(authored.reopened.points, authored.reopened.weights, authored.reopened.options), result);
  const observations = ownedFile(name + '.native-probes', probes);
  accepted.push({result, before: structuredClone(result), points, weights, inputBefore: before, options});
  summaries.push({name, curveId, degree, pointCount: count, weights, domain, basisEvaluationCount: report.basisEvaluationCount,
    eliminationStepCount: report.eliminationStepCount, maximumResidualMM, targetSourceFile: target?.sourceFile ?? null,
    sourceFile: source.file, authoredFile: authored.file, resultFile: owned.file, nativeProbeFile: observations.file});
  return result;
}
const quarter = check('rational_quadratic_quarter', quarterPoints, quarterTarget.curve.weights, 2, 'quarter_curve', quarterTarget, [-1.75, .5, 3.25, 5.5]);
const radiusEvidence = [-3, -1.75, .5, 2, 3.25, 5.5, 7].map(parameter => {
  const point = evaluateCurve(quarter.curve, parameter), radiusMM = Math.hypot(point[0], point[1]);
  assert.ok(Math.abs(radiusMM - 2) <= 1e-7); assert.ok(Math.abs(point[2]) <= 1e-7); return {parameter, pointMM: point, radiusMM};
});
ownedFile('quarter.local-radius-evidence', radiusEvidence);
const cubic = check('rational_cubic_target', cubicPoints, cubicTarget.curve.weights, 3, 'cubic_curve', cubicTarget);
const quarterBefore = structuredClone(quarter);
const changed = check('same_points_changed_fixed_weights', quarterPoints, [1, 1, 1], 2, quarter.curve.id);
assert.notEqual(changed.source, quarter.source);
assert.ok(difference(evaluateCurve(changed.curve, -.5), evaluateCurve(quarter.curve, -.5)) > .01);
assert.deepEqual(quarter, quarterBefore);

const polynomialFile = resolve(polynomialDirectory, 'known_quadratic.owned-curve.json');
const polynomialBytes = retainInput('authentic943_known_quadratic_owned', polynomialFile);
const polynomial = JSON.parse(polynomialBytes.toString('utf8')), polynomialBefore = structuredClone(polynomial);
const originalSourceFile = resolve(polynomialDirectory, 'known_quadratic.source0.css');
const originalSourceBytes = retainInput('authentic943_known_quadratic_source', originalSourceFile);
assert.equal(originalSourceBytes.toString('utf8'), polynomial.source);
const coldPolynomial = compileCadModel(originalSourceBytes.toString('utf8'), {sourceVersion: 0});
assert.equal(coldPolynomial.ok, true, JSON.stringify(coldPolynomial.diagnostics)); assert.deepEqual(coldPolynomial.model, polynomial.model);
assert.deepEqual(buildInterpolatingCurve(polynomial.points, polynomial.options), polynomial);
assert.deepEqual(validateInterpolatingCurve(polynomial), polynomial.report);
const allOne = check('all_one_authentic_polynomial', polynomial.points, Array(polynomial.points.length).fill(1), polynomial.options.degree, polynomial.options.curveId);
assert.deepEqual(allOne.curve, polynomial.curve); assert.deepEqual(allOne.model, polynomial.model); assert.equal(allOne.source, polynomial.source);
for (const [field, value] of Object.entries(polynomial.report)) {
  if (!['schema', 'quality', 'limits'].includes(field)) assert.deepEqual(allOne.report[field], value, field);
}
for (const [field, value] of Object.entries(polynomial.report.quality)) if (field !== 'weights') assert.deepEqual(allOne.report.quality[field], value, field);
for (const [field, value] of Object.entries(polynomial.report.limits)) assert.deepEqual(allOne.report.limits[field], value, field);
assert.deepEqual(polynomial, polynomialBefore);

const scaledWeights = quarterTarget.curve.weights.map(weight => 2 * weight);
const scaled = check('common_weight_scale_two', quarterPoints, scaledWeights, 2, quarter.curve.id, quarterTarget, [-1.75, .5, 3.25, 5.5]);
assert.deepEqual(scaled.curve.weights, scaledWeights);
for (const parameter of [-3, -1.75, .5, 2, 3.25, 5.5, 7]) {
  closePoint(evaluateCurve(scaled.curve, parameter), evaluateCurve(quarter.curve, parameter));
  assert.ok(relative(evaluateCurveD1(scaled.curve, parameter).derivative, evaluateCurveD1(quarter.curve, parameter).derivative) <= 1e-7);
}
const maximum = check('maximum_16_positive_weights', throughPoints(maximumTarget, maximumParameters), maximumTarget.curve.weights, 3, 'maximum_curve', maximumTarget);
assert.equal(maximum.report.basisEvaluationCount, 256); assert.equal(maximum.report.eliminationStepCount, 120);
const constantPoints = [-0, 1, 3, 5].map(parameter => ({parameter, pointMM: [2, -0, 1]}));
const constant = check('coincident_xyz_fixed_weights', constantPoints, [1, 2, 3, 1], 3, 'coincident_curve');
assert.ok(Object.is(curveDomain(constant.curve)[0], -0));
for (const parameter of [0, 1, 2.5, 3, 5]) {
  closePoint(evaluateCurve(constant.curve, parameter), [2, 0, 1]); assert.ok(Math.hypot(...evaluateCurveD1(constant.curve, parameter).derivative) <= 1e-7);
}

const parameterizedFile = resolve('/Users/user/.barocss-ai/v3/evidence-curve-parameterization-cad/demo-output', 'same_points_chord.owned-parameterized-curve.json');
let currentComposition = {available: false};
if (existsSync(parameterizedFile)) {
  const bytes = retainInput('authentic947_current_owned', parameterizedFile), saved = JSON.parse(bytes.toString('utf8'));
  const sourcePath = resolve('/Users/user/.barocss-ai/v3/evidence-curve-parameterization-cad/demo-output', 'same_points_chord.source0.css');
  const sourceBytes = retainInput('authentic947_current_source', sourcePath); assert.equal(sourceBytes.toString('utf8'), saved.interpolation.source);
  const cold = compileCadModel(sourceBytes.toString('utf8'), {sourceVersion: 0});
  assert.equal(cold.ok, true, JSON.stringify(cold.diagnostics)); assert.deepEqual(cold.model, saved.interpolation.model);
  const current = buildParameterizedInterpolatingCurve(saved.points, saved.options); assert.deepEqual(current, saved);
  currentComposition = {available: true, file: parameterizedFile, sourceFile: sourcePath,
    exactCurrentOwnedMatch: true, nativeChildSourceMatch: current.interpolation.source === saved.interpolation.source};
}
ownedFile('authentic-input-provenance', provenance); ownedFile('current947_minimal-composition', currentComposition);

function intact() {
  for (const item of accepted) { assert.deepEqual(item.result, item.before); assert.deepEqual({points: item.points, weights: item.weights}, item.inputBefore); }
  for (const target of targets) assert.deepEqual(target.curve, target.before);
  assert.deepEqual(quarter, quarterBefore); assert.deepEqual(polynomial, polynomialBefore);
  for (const [file, bytes] of retainedFiles) assert.deepEqual(readFileSync(file), bytes, file);
}
function reject(name, action, code, sharedCause = false) {
  assert.throws(action, error => {
    assert.ok(error instanceof WeightedCurveInterpolationError); assert.equal(error.name, 'WeightedCurveInterpolationError'); assert.equal(error.code, code);
    assert.ok(Object.values(WeightedCurveInterpolationDiagnosticCode).includes(error.code)); assert.ok(error.message.startsWith('Weighted Curve interpolation: '));
    if (sharedCause) { assert.ok(error.cause instanceof CurveInterpolationError); assert.equal(error.cause.code, code); }
    failures.push({name, code: error.code, message: error.message, actualCausePreserved: Object.hasOwn(error, 'cause'),
      sharedCauseName: error.cause?.name ?? null});
    intact(); return true;
  });
}
const refusalOptions = {curveId: 'refusal_curve', degree: 2, maximumBasisEvaluations: 256, maximumEliminationSteps: 120};
reject('missing_mandatory_weights', () => build(quarterPoints, undefined, refusalOptions), 'INPUT');
reject('weight_count', () => build(quarterPoints, [1, 1], refusalOptions), 'INPUT');
reject('negative_weight', () => build(quarterPoints, [1, -1, 1], refusalOptions), 'INPUT');
reject('zero_weight', () => build(quarterPoints, [1, 0, 1], refusalOptions), 'INPUT');
reject('negative_zero_weight', () => build(quarterPoints, [1, -0, 1], refusalOptions), 'INPUT');
reject('nonfinite_weight', () => build(quarterPoints, [1, Infinity, 1], refusalOptions), 'INPUT');
reject('weight_below_bound', () => build(quarterPoints, [1, 1e-7, 1], refusalOptions), 'INPUT');
reject('weight_above_bound', () => build(quarterPoints, [1, 1e6 + 1, 1], refusalOptions), 'INPUT');
reject('basis_budget', () => build(quarterPoints, quarterTarget.curve.weights, {...refusalOptions, maximumBasisEvaluations: 8}), 'BUDGET');
reject('elimination_budget', () => build(quarterPoints, quarterTarget.curve.weights, {...refusalOptions, maximumEliminationSteps: 2}), 'BUDGET');
let getterCalls = 0;
const getterWeights = [1, Math.SQRT1_2, 1];
Object.defineProperty(getterWeights, '1', {enumerable: true, get() { getterCalls++; return Math.SQRT1_2; }});
reject('input_weight_getter', () => build(quarterPoints, getterWeights, refusalOptions), 'INPUT'); assert.equal(getterCalls, 0);
const ownedGetter = structuredClone(quarter);
Object.defineProperty(ownedGetter.report, 'weights', {enumerable: true, get() { getterCalls++; return quarter.report.weights; }});
reject('owned_getter', () => validate(ownedGetter), 'OWNED'); assert.equal(getterCalls, 0);
const uncertainPoints = [0, 1e-8, 2e-8, 1].map(parameter => ({parameter, pointMM: [parameter, 0, 0]}));
reject('actual_shared_conditioning', () => build(uncertainPoints, [1, 1, 1, 1], {...refusalOptions, degree: 3}), 'CONDITIONING', true);
const oscillatingPoints = [0, 1, 2, 3, 4].map(parameter => ({parameter, pointMM: [parameter % 2 ? -10000 : 10000, 0, 0]}));
reject('actual_shared_pole_bound', () => build(oscillatingPoints, [1, 1, 1, 1, 1], refusalOptions), 'REPRESENTABILITY', true);
for (const [name, alter] of [
  ['source', result => result.source += ' '],
  ['provided_weights', result => result.weights[1] += .1],
  ['curve_weights', result => result.curve.weights[1] += .1],
  ['coefficient', result => result.curve.controlPoints[1][0] += .1],
  ['basis_matrix', result => result.report.basisMatrix[1][1] += .1],
  ['pivot', result => result.report.solver.pivots[1].threshold += 1],
  ['counter', result => result.report.basisEvaluationCount++],
  ['weight_policy', result => result.report.quality.weights = 'polynomial-all-one-no-rational-weight-solving'],
]) {
  const altered = structuredClone(quarter); alter(altered); reject('owned_' + name + '_tamper', () => validate(altered), 'OWNED');
}
assert.deepEqual(validate(quarter), quarter.report); intact();

const packageRoot = resolve(repo, 'packages/barocss-cad'), manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const runtimeNames = ['buildWeightedInterpolatingCurve', 'validateWeightedInterpolatingCurve', 'WeightedCurveInterpolationError', 'WeightedCurveInterpolationDiagnosticCode'];
const typeNames = ['WeightedCurveInterpolationPoint', 'WeightedCurveInterpolationOptions', 'WeightedCurveInterpolationReport', 'WeightedCurveInterpolationResult'];
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.WeightedCurveInterpolationDiagnosticCode, WeightedCurveInterpolationDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./weighted-curve-interpolation.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/weighted-curve-interpolation.d.ts'), leafDeclaration = readFileSync(leafDeclarationPath, 'utf8');
for (const name of [...runtimeNames, ...typeNames]) assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(leafDeclaration), name);
const oldRuntimeNames = ['buildInterpolatingCurve', 'validateInterpolatingCurve', 'CurveInterpolationError', 'CurveInterpolationDiagnosticCode'];
const oldTypeNames = ['CurveInterpolationPoint', 'CurveInterpolationOptions', 'CurveInterpolationReport', 'CurveInterpolationResult'];
const oldDeclarationPath = resolve(packageRoot, 'dist/curve-interpolation.d.ts'), oldDeclaration = readFileSync(oldDeclarationPath, 'utf8');
for (const name of oldRuntimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
for (const name of [...oldRuntimeNames, ...oldTypeNames]) assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(oldDeclaration), name);
assert.deepEqual(publicAPI.buildInterpolatingCurve(polynomial.points, polynomial.options), polynomial);
const cold = JSON.parse(readFileSync(summaries.find(row => row.name === 'rational_quadratic_quarter').authoredFile, 'utf8'));
const compiled = publicAPI.buildWeightedInterpolatingCurve(cold.points, cold.weights, cold.options);
assert.deepEqual(compiled, quarter); assert.deepEqual(publicAPI.validateWeightedInterpolatingCurve(compiled), quarter.report);
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 8,
  oldDeclarationPath, oldRuntimeNames, oldTypeNames, oldDirectDeclarationsPreserved: true,
  declarationCheck: 'actual declaration export text; no separate TypeScript invocation'};
ownedFile('compiled-consumer', compiledConsumer);
const summary = {sourceMode: true, cadSourceInputCount: cadInputs.length, summaries, failures, provenance, currentComposition, compiledConsumer,
  caseCount: summaries.length, refusalCount: failures.length, localQuarterRadius: radiusEvidence,
  scope: 'Fixed positive supplied weights with the same actual native normalized-basis and linear-solve kernel; local target point/D1 reconstruction and authentic polynomial default preservation.',
  weightOptimization: false, commonWeightScalingGlobalInvarianceCertified: false, regularityCertified: false, solidCertified: false};
ownedFile('summary', summary); intact();
console.log(JSON.stringify(summary));
