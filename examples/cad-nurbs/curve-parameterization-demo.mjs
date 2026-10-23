import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node curve-parameterization-demo.mjs --source <output-directory>');
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
assert.ok(cadInputs.includes(entry)); assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/nurbs/curves/curve-parameterization.ts')));
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/nurbs/curves/curve-interpolation.ts')));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const {buildParameterizedInterpolatingCurve: build, validateParameterizedInterpolatingCurve: validate,
  CurveParameterizationError, CurveParameterizationDiagnosticCode, CurveInterpolationError,
  validateInterpolatingCurve, evaluateCurve, evaluateCurveD1, curveDomain, compileCadModel} = api;
for (const operation of [build, validate, CurveParameterizationError]) assert.equal(typeof operation, 'function');
assert.deepEqual(Object.keys(CurveParameterizationDiagnosticCode).sort(),
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
const commonPoints = [[0, -0, 0], [.5, 1, 0], [3, 1, 2], [4, -1, 1], [8, 2, 0]];
const maximumPoints = Array.from({length: 16}, (_, i) => [i / 2, i * i / 128, i ** 3 / 4096]);
const coincidentPoints = Array.from({length: 4}, () => [2, -0, 1]);
const collinearPoints = [0, 1, 4, 10].map(x => [x, -0, 0]);
ownedFile('source-api.metafile', bundled.metafile);
ownedFile('source-api.inputs', {entry, mode: 'in-memory-esbuild', write: false, sourceInputs, cadInputs, esbuildVersion: esbuild.version});

function check(name, points, method, domain, degree, curveId, pointWitness, derivativeWitness) {
  const before = structuredClone(points), count = points.length;
  const options = {curveId, degree, method, domain: [...domain], maximumMetricEvaluations: count - 1,
    maximumBasisEvaluations: count * count, maximumEliminationSteps: count * (count - 1) / 2};
  const authored = ownedFile(name + '.authored-points', {points, options});
  const result = build(points, options); ownership([points, options], result); assert.deepEqual(points, before);
  assert.deepEqual(Object.keys(result).sort(), ['points', 'options', 'interpolation', 'report'].sort());
  assert.deepEqual(result.points, points); assert.deepEqual(result.options, options);
  const segments = [], cumulative = [0];
  for (let index = 0; index < count - 1; index++) {
    const deltaMM = points[index + 1].map((value, axis) => value - points[index][axis]);
    const distanceMM = Math.hypot(...deltaMM);
    const increment = method === 'uniform' ? 1 : method === 'chord-length' ? distanceMM : Math.sqrt(distanceMM);
    cumulative.push(cumulative[index] + increment);
    segments.push({index, fromPointIndex: index, toPointIndex: index + 1, deltaMM, distanceMM, increment, cumulative: cumulative[index + 1]});
  }
  const total = cumulative[count - 1], fractions = cumulative.map((value, index) => index === 0 ? 0 : index === count - 1 ? 1 : value / total);
  const parameters = fractions.map((fraction, index) => index === 0 ? domain[0] : index === count - 1 ? domain[1] : domain[0] + (domain[1] - domain[0]) * fraction);
  const report = result.report, child = result.interpolation, curve = child.curve;
  assert.equal(report.schema, 'barocss-native-curve-parameterization'); assert.equal(report.version, 0);
  assert.equal(report.curveId, curveId); assert.equal(report.degree, degree); assert.equal(report.lengthUnit, 'mm');
  assert.equal(report.sourceFrame, 'authored-xyz-no-axis-conversion'); assert.equal(report.method, method); assert.equal(report.pointCount, count);
  assert.deepEqual(report.requestedDomain, domain); assert.equal(report.distanceUnit, 'mm');
  assert.equal(report.incrementUnit, method === 'uniform' ? 'dimensionless' : method === 'chord-length' ? 'mm' : 'sqrt-mm');
  assert.deepEqual(report.segments, segments); assert.deepEqual(report.cumulativeIncrements, cumulative);
  assert.equal(report.totalIncrement, total); assert.deepEqual(report.fractions, fractions); assert.deepEqual(report.generatedParameters, parameters);
  assert.ok(Object.is(report.generatedParameters[0], domain[0])); assert.ok(Object.is(report.generatedParameters[count - 1], domain[1]));
  for (let index = 1; index < count; index++) assert.ok(parameters[index] > parameters[index - 1]);
  assert.deepEqual(child.points, parameters.map((parameter, index) => ({parameter, pointMM: points[index]})));
  assert.deepEqual(child.options, {curveId, degree, maximumBasisEvaluations: options.maximumBasisEvaluations,
    maximumEliminationSteps: options.maximumEliminationSteps});
  assert.equal(curve.id, curveId); assert.equal(curve.degree, degree); assert.deepEqual(curveDomain(curve), domain);
  assert.deepEqual(curve.weights, Array(count).fill(1)); assert.deepEqual(child.report.parameters, parameters);
  assert.equal(report.metricEvaluationCount, count - 1); assert.equal(report.childConstructionCount, 1);
  assert.equal(report.basisEvaluationCount, child.report.basisEvaluationCount); assert.equal(report.basisEvaluationCount, count * count);
  assert.equal(report.eliminationStepCount, child.report.eliminationStepCount); assert.equal(report.eliminationStepCount, count * (count - 1) / 2);
  assert.equal(report.pointEvaluationCount, child.report.pointEvaluationCount); assert.equal(report.pointEvaluationCount, count);
  assert.equal(report.maximumPointDifferenceMM, child.report.maximumPointDifferenceMM);
  assert.deepEqual(validateInterpolatingCurve(child), child.report);
  const probes = [];
  for (const [index, parameter] of parameters.entries()) {
    const nativePoint = evaluateCurve(curve, parameter); closePoint(nativePoint, points[index]);
    probes.push({parameter, kind: 'generated-through-point', expectedPointMM: points[index], actualPointMM: nativePoint});
  }
  for (const parameter of spanProbes(curve)) {
    const nativePoint = evaluateCurve(curve, parameter), nativeD1 = evaluateCurveD1(curve, parameter);
    if (pointWitness) closePoint(nativePoint, pointWitness(parameter));
    if (derivativeWitness) assert.ok(relative(nativeD1.derivative, derivativeWitness(parameter)) <= 1e-7);
    probes.push({parameter, kind: 'native-span-midpoint', actualPointMM: nativePoint, nativeD1});
  }
  assert.equal(report.geometricValidity, 'not-certified'); assert.equal(report.topologyCertified, false); assert.equal(report.solid, false);
  assert.equal(report.quality.metricMeaning, 'authored-consecutive-xyz-polyline-chords-not-native-curve-arc-length');
  assert.equal(report.quality.arcLengthCertified, false); assert.equal(report.quality.regularityCertified, false);
  assert.equal(report.quality.interpolationAuthority, 'one-actual-public-native-curve-interpolation');
  assert.equal(report.limits.maximumMetricEvaluations, 15); assert.equal(report.limits.maximumBasisEvaluations, 256);
  assert.equal(report.limits.maximumEliminationSteps, 120);
  assert.equal(child.sourceVersion, 0); assert.deepEqual(child.model.objects, [curve]);
  const source = sourceFile(name, child.source, child.model); assert.deepEqual(source.model.objects[0], curve);
  assert.deepEqual(validate(result), report);
  const owned = ownedFile(name + '.owned-parameterized-curve', result); assert.deepEqual(validate(owned.reopened), report);
  assert.deepEqual(build(authored.reopened.points, authored.reopened.options), result);
  const observations = ownedFile(name + '.native-probes', probes);
  accepted.push({result, before: structuredClone(result), points, inputBefore: before, options});
  summaries.push({name, method, curveId, degree, pointCount: count, domain, parameters, fractions, totalIncrement: total,
    metricEvaluationCount: report.metricEvaluationCount, basisEvaluationCount: report.basisEvaluationCount,
    eliminationStepCount: report.eliminationStepCount, maximumPointDifferenceMM: report.maximumPointDifferenceMM,
    sourceFile: source.file, authoredFile: authored.file, resultFile: owned.file, nativeProbeFile: observations.file});
  return result;
}
const uniform = check('same_points_uniform', commonPoints, 'uniform', [-3, 7], 3, 'uniform_curve');
const chord = check('same_points_chord', commonPoints, 'chord-length', [-3, 7], 3, 'chord_curve');
const centripetal = check('same_points_centripetal', commonPoints, 'centripetal', [-3, 7], 3, 'centripetal_curve');
const variants = [uniform, chord, centripetal], variantEvidence = [];
for (let a = 0; a < variants.length; a++) for (let b = a + 1; b < variants.length; b++) {
  assert.notDeepEqual(variants[a].report.generatedParameters, variants[b].report.generatedParameters);
  const observations = [-1.5, .25, 2, 5.5].map(parameter => {
    const pointA = evaluateCurve(variants[a].interpolation.curve, parameter), pointB = evaluateCurve(variants[b].interpolation.curve, parameter);
    return {parameter, pointA, pointB, differenceMM: difference(pointA, pointB)};
  });
  assert.ok(observations.some(observation => observation.differenceMM > .01));
  variantEvidence.push({methodA: variants[a].report.method, methodB: variants[b].report.method, observations});
}
ownedFile('same_points_native_variant-evidence', variantEvidence);
const originalBefore = structuredClone(chord), editedPoints = structuredClone(commonPoints); editedPoints[2][2] += .5;
const edited = check('numeric_point_edit_chord', editedPoints, 'chord-length', [-3, 7], 3, chord.interpolation.curve.id);
assert.notDeepEqual(edited.report.generatedParameters, chord.report.generatedParameters);
assert.ok(difference(evaluateCurve(edited.interpolation.curve, 2), evaluateCurve(chord.interpolation.curve, 2)) > .01);
assert.deepEqual(chord, originalBefore);
const maximum = check('maximum_16_centripetal', maximumPoints, 'centripetal', [-2, 13], 3, 'maximum_curve');
assert.equal(maximum.report.metricEvaluationCount, 15); assert.equal(maximum.report.basisEvaluationCount, 256);
assert.equal(maximum.report.eliminationStepCount, 120);
const coincident = check('uniform_coincident_xyz', coincidentPoints, 'uniform', [-0, 5], 3, 'coincident_curve', () => [2, -0, 1], () => [0, 0, 0]);
assert.ok(Object.is(coincident.report.generatedParameters[0], -0)); assert.ok(Object.is(curveDomain(coincident.interpolation.curve)[0], -0));
const collinear = check('chord_uneven_collinear', collinearPoints, 'chord-length', [-3, 7], 3, 'collinear_curve', parameter => [parameter + 3, 0, 0], () => [1, 0, 0]);
assert.deepEqual(collinear.report.generatedParameters, [-3, -2, 1, 7]);

function intact() {
  for (const item of accepted) { assert.deepEqual(item.result, item.before); assert.deepEqual(item.points, item.inputBefore); }
  assert.deepEqual(chord, originalBefore);
  for (const [file, bytes] of retainedFiles) assert.deepEqual(readFileSync(file), bytes, file);
}
function reject(name, action, code, childCause = false) {
  assert.throws(action, error => {
    assert.ok(error instanceof CurveParameterizationError); assert.equal(error.name, 'CurveParameterizationError'); assert.equal(error.code, code);
    assert.ok(Object.values(CurveParameterizationDiagnosticCode).includes(error.code)); assert.ok(error.message.startsWith('Curve parameterization: '));
    if (childCause) { assert.ok(error.cause instanceof CurveInterpolationError); assert.equal(error.cause.code, code); }
    failures.push({name, code: error.code, message: error.message, actualCausePreserved: Object.hasOwn(error, 'cause'),
      childCauseName: error.cause?.name ?? null});
    intact(); return true;
  });
}
const refusalOptions = {curveId: 'refusal_curve', degree: 3, method: 'chord-length', domain: [-3, 7],
  maximumMetricEvaluations: 15, maximumBasisEvaluations: 256, maximumEliminationSteps: 120};
reject('unknown_method', () => build(commonPoints, {...refusalOptions, method: 'automatic'}), 'INPUT');
reject('reversed_domain', () => build(commonPoints, {...refusalOptions, domain: [7, -3]}), 'INPUT');
reject('unsupported_degree', () => build(commonPoints, {...refusalOptions, degree: 4}), 'INPUT');
reject('too_few_points', () => build([commonPoints[0]], refusalOptions), 'INPUT');
const nonfinite = structuredClone(commonPoints); nonfinite[2][0] = Infinity;
reject('nonfinite_point', () => build(nonfinite, refusalOptions), 'INPUT');
reject('metric_budget', () => build(commonPoints, {...refusalOptions, maximumMetricEvaluations: 3}), 'BUDGET');
reject('basis_budget', () => build(commonPoints, {...refusalOptions, maximumBasisEvaluations: 24}), 'BUDGET');
reject('elimination_budget', () => build(commonPoints, {...refusalOptions, maximumEliminationSteps: 9}), 'BUDGET');
const repeated = structuredClone(commonPoints); repeated[1] = [...repeated[0]];
reject('zero_chord', () => build(repeated, refusalOptions), 'INPUT');
reject('zero_centripetal_chord', () => build(repeated, {...refusalOptions, method: 'centripetal'}), 'INPUT');
let getterCalls = 0;
const getter = {...refusalOptions};
Object.defineProperty(getter, 'method', {enumerable: true, get() { getterCalls++; return 'chord-length'; }});
reject('input_getter', () => build(commonPoints, getter), 'INPUT'); assert.equal(getterCalls, 0);
const ownedGetter = structuredClone(chord);
Object.defineProperty(ownedGetter.report, 'segments', {enumerable: true, get() { getterCalls++; return chord.report.segments; }});
reject('owned_getter', () => validate(ownedGetter), 'OWNED'); assert.equal(getterCalls, 0);
const lostContribution = [[0, 0, 0], [10000, 0, 0], [10000, 1e-14, 0], [10000, 1, 0]];
reject('lost_late_cumulative_chord', () => build(lostContribution, refusalOptions), 'REPRESENTABILITY');
reject('lost_adjacent_domain_mapping', () => build(collinearPoints,
  {...refusalOptions, method: 'uniform', domain: [1, 1 + Number.EPSILON]}), 'REPRESENTABILITY');
const uncertainPoints = [0, 1e-8, 2e-8, 1].map(x => [x, 0, 0]);
reject('actual_child_conditioning', () => build(uncertainPoints, {...refusalOptions, domain: [0, 1]}), 'CONDITIONING', true);
const oscillating = [10000, -10000, 10000, -10000, 10000].map(x => [x, 0, 0]);
reject('actual_child_pole_bound', () => build(oscillating, {...refusalOptions, method: 'uniform', degree: 2, domain: [0, 4]}), 'REPRESENTABILITY', true);
for (const [name, alter] of [
  ['method', result => result.options.method = 'uniform'],
  ['domain', result => result.options.domain[0] -= .1],
  ['distance', result => result.report.segments[0].distanceMM += .1],
  ['increment', result => result.report.segments[0].increment += .1],
  ['fractions', result => result.report.fractions[1] += .01],
  ['parameters', result => result.report.generatedParameters[1] += .01],
  ['child_source', result => result.interpolation.source += ' '],
  ['child_pole', result => result.interpolation.curve.controlPoints[1][0] += .1],
  ['child_solver', result => result.interpolation.report.solver.pivots[1].threshold += 1],
  ['counter', result => result.report.metricEvaluationCount++],
]) {
  const altered = structuredClone(chord); alter(altered); reject('owned_' + name + '_tamper', () => validate(altered), 'OWNED');
}
assert.deepEqual(validate(chord), chord.report); intact();

const packageRoot = resolve(repo, 'packages/barocss-cad'), manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const runtimeNames = ['buildParameterizedInterpolatingCurve', 'validateParameterizedInterpolatingCurve', 'CurveParameterizationError', 'CurveParameterizationDiagnosticCode'];
const typeNames = ['CurveParameterizationMethod', 'CurveParameterizationOptions', 'CurveParameterizationReport', 'CurveParameterizationResult'];
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.CurveParameterizationDiagnosticCode, CurveParameterizationDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./curve-parameterization.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/nurbs/curves/curve-parameterization.d.ts'), leafDeclaration = readFileSync(leafDeclarationPath, 'utf8');
for (const name of [...runtimeNames, ...typeNames]) assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(leafDeclaration), name);
const cold = JSON.parse(readFileSync(summaries.find(row => row.name === 'same_points_chord').authoredFile, 'utf8'));
const compiled = publicAPI.buildParameterizedInterpolatingCurve(cold.points, cold.options);
assert.deepEqual(compiled, chord); assert.deepEqual(publicAPI.validateParameterizedInterpolatingCurve(compiled), chord.report);
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 8,
  declarationCheck: 'actual declaration export text; no separate TypeScript invocation'};
ownedFile('compiled-consumer', compiledConsumer);
const summary = {sourceMode: true, cadSourceInputCount: cadInputs.length, summaries, failures, compiledConsumer,
  caseCount: summaries.length, refusalCount: failures.length, nativeVariantEvidence: variantEvidence,
  scope: 'Explicit uniform, authored-chord and centripetal parameter selection; one actual native polynomial Curve interpolation per result.',
  metricMeaning: 'authored-polyline-chords', arcLengthCertified: false, bestFitCertified: false, regularityCertified: false, solidCertified: false};
ownedFile('summary', summary); intact();
console.log(JSON.stringify(summary));
