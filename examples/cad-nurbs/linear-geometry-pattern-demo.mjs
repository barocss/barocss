import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node linear-geometry-pattern-demo.mjs --source <output-directory>'); assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]); mkdirSync(output, {recursive: true});
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const esbuild = require('esbuild'), entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundled = await esbuild.build({absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node',
  format: 'esm', write: false, target: 'es2022', metafile: true});
assert.equal(bundled.outputFiles.length, 1);
const sourceInputs = Object.keys(bundled.metafile.inputs).map(path => resolve(repo, path));
const cadInputs = sourceInputs.filter(path => path.includes('/packages/barocss-cad/'));
for (const file of ['index.ts', 'linear-geometry-pattern.ts', 'affine-geometry-transform.ts']) assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src', file)));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const {buildLinearGeometryPattern: build, validateLinearGeometryPattern: validate, LinearGeometryPatternError, LinearGeometryPatternDiagnosticCode,
  AffineGeometryTransformError, validateAffineGeometryTransform, evaluateCurve, evaluateCurveD1, evaluateSurface, evaluateSurfaceD1,
  curveDomain, surfaceDomain, compileCadModel} = api;
for (const operation of [build, validate, LinearGeometryPatternError]) assert.equal(typeof operation, 'function');
assert.deepEqual(Object.keys(LinearGeometryPatternDiagnosticCode).sort(),
  ['INPUT', 'IDENTITY', 'BUDGET', 'NATIVE', 'REPRESENTABILITY', 'BINDING', 'OWNED'].sort());
const accepted = [], summaries = [], failures = [], retainedFiles = new Map();
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
function state(action) {
  try { return {status: 'evaluated', value: action()}; }
  catch (error) { return {status: 'native-refused', reason: error.message.slice(0, 1024), nativeErrorName: error.name}; }
}
function samples(knots, domain) {
  const breaks = [];
  for (const knot of knots) if (knot >= domain[0] && knot <= domain[1] && !breaks.some(value => value === knot)) breaks.push(knot);
  const values = [...breaks], gaps = [];
  for (let i = 0; i < breaks.length - 1; i++) {
    const midpoint = breaks[i] + (breaks[i + 1] - breaks[i]) / 2;
    if (midpoint > breaks[i] && midpoint < breaks[i + 1]) values.push(midpoint);
    else gaps.push({domain: [breaks[i], breaks[i + 1]], attemptedParameter: midpoint});
  }
  return {values: values.sort((a, b) => a - b), gaps};
}
function translated(point, translation) { return point.map((value, axis) => translation[axis] === 0 ? value : value + translation[axis]); }
function inputSource(name, geometry) {
  const list = values => '[' + values.map(decimal).join(',') + ']', poles = points => '[' + points.map(list).join(',') + ']';
  const model = {name: geometry.id + '_input', version: 0, lengthUnit: 'mm', objects: [geometry]};
  const body = geometry.kind === 'curve' ? '@curve #' + geometry.id + ' { type:nurbs; degree:' + geometry.degree + '; knots:' + list(geometry.knots) +
    '; control-points:' + poles(geometry.controlPoints) + '; weights:' + list(geometry.weights) + '; }' :
    '@surface #' + geometry.id + ' { type:nurbs; degree-u:' + geometry.degreeU + '; degree-v:' + geometry.degreeV + '; knots-u:' + list(geometry.knotsU) +
    '; knots-v:' + list(geometry.knotsV) + '; control-points:[' + geometry.controlPoints.map(poles).join(',') + ']; weights:[' + geometry.weights.map(list).join(',') + ']; }';
  return sourceFile(name + '.original-seed', '@model ' + model.name + ' { version:0; length-unit:mm; ' + body + ' }\n', model).model.objects[0];
}
const quarter = inputSource('quarter', {kind: 'curve', id: 'quarter_seed', degree: 2, knots: [-3, -3, -3, 7, 7, 7],
  controlPoints: [[2, -0, -0], [2, 2, -0], [0, 2, -0]], weights: [1, Math.SQRT1_2, 1]});
const plane = inputSource('plane', {kind: 'surface', id: 'plane_seed', degreeU: 1, degreeV: 1, knotsU: [-3, -3, 7, 7], knotsV: [2, 2, 5, 5],
  controlPoints: [[[1, 2, 3], [2, 5, 4]], [[4, 1, 5], [5, 4, 6]]], weights: [[1, 1], [1, 1]]});
const wideCurve = inputSource('maximum_curve', {kind: 'curve', id: 'wide_seed', degree: 1,
  knots: [-0, -0, ...Array.from({length: 62}, (_, i) => i + 1), 63, 63],
  controlPoints: Array.from({length: 64}, (_, i) => [i / 4, i % 2 / 4, i / 8]), weights: Array(64).fill(1)});
const wideSurface = inputSource('maximum_surface', {kind: 'surface', id: 'wide_surface_seed', degreeU: 1, degreeV: 1,
  knotsU: [-0, -0, ...Array.from({length: 14}, (_, i) => i + 1), 15, 15],
  knotsV: [-3, -3, ...Array.from({length: 14}, (_, i) => i - 2), 12, 12],
  controlPoints: Array.from({length: 16}, (_, i) => Array.from({length: 16}, (_, j) => [i / 4, j / 4, (i + j) / 8])),
  weights: Array.from({length: 16}, () => Array(16).fill(1))});
ownedFile('source-api.metafile', bundled.metafile);
ownedFile('source-api.inputs', {entry, mode: 'in-memory-esbuild', write: false, sourceInputs, cadInputs, esbuildVersion: esbuild.version});

function check(name, original, count, spacingMM, patternId, idPrefix) {
  const before = structuredClone({original, spacingMM}), isCurve = original.kind === 'curve';
  const domains = isCurve ? {curve: curveDomain(original), u: null, v: null} : {curve: null, ...surfaceDomain(original)};
  const cs = isCurve ? samples(original.knots, domains.curve) : {values: [], gaps: []};
  const us = isCurve ? {values: [], gaps: []} : samples(original.knotsU, domains.u), vs = isCurve ? {values: [], gaps: []} : samples(original.knotsV, domains.v);
  const observationsPerCopy = isCurve ? cs.values.length : us.values.length * vs.values.length;
  const options = {patternId, idPrefix, count, spacingMM: [...spacingMM], maximumCopyObservations: (count - 1) * observationsPerCopy};
  const authored = ownedFile(name + '.authored-pattern', {original, options});
  const result = build(original, options); ownership([original, options], result); assert.deepEqual({original, spacingMM}, before);
  assert.deepEqual(Object.keys(result).sort(), ['original', 'options', 'instances', 'source', 'sourceVersion', 'model', 'report'].sort());
  assert.deepEqual(result.original, original); assert.deepEqual(result.options, options); assert.equal(result.instances.length, count);
  const report = result.report;
  assert.equal(report.schema, 'barocss-native-linear-geometry-pattern'); assert.equal(report.version, 0);
  assert.equal(report.originalId, original.id); assert.equal(report.patternId, patternId); assert.equal(report.kind, original.kind);
  assert.equal(report.lengthUnit, 'mm'); assert.equal(report.sourceFrame, 'authored-xyz-no-axis-conversion');
  assert.equal(report.count, count); assert.deepEqual(report.spacingMM, spacingMM);
  assert.deepEqual(report.activeGeometryIds, [original.id, ...Array.from({length: count - 1}, (_, index) => idPrefix + '_' + (index + 1))]);
  assert.equal(report.plannedCopyCount, count - 1); assert.equal(report.plannedCopyObservations, (count - 1) * observationsPerCopy);
  assert.equal(report.observationsPerCopy, observationsPerCopy); assert.equal(report.childConstructionCount, count - 1);
  assert.deepEqual(report.domains, domains); assert.deepEqual(report.samples, {curve: cs.values, u: us.values, v: vs.values});
  assert.deepEqual(report.unrepresentedMidpointIntervals, {curve: cs.gaps, u: us.gaps, v: vs.gaps});
  const evidence = [], children = [];
  for (const [index, instance] of result.instances.entries()) {
    assert.deepEqual(Object.keys(instance).sort(), ['index', 'geometryId', 'translationMM', 'geometry', 'evaluation'].sort());
    assert.equal(instance.index, index); assert.equal(instance.geometryId, report.activeGeometryIds[index]); assert.equal(instance.geometry.id, instance.geometryId);
    const translation = index === 0 ? [0, 0, 0] : spacingMM.map(value => index * value);
    assert.deepEqual(instance.translationMM, translation); assert.equal(instance.geometry.kind, original.kind);
    assert.deepEqual(instance.geometry.weights, original.weights);
    if (isCurve) { assert.equal(instance.geometry.degree, original.degree); assert.deepEqual(instance.geometry.knots, original.knots); assert.deepEqual(curveDomain(instance.geometry), domains.curve); }
    else {
      assert.equal(instance.geometry.degreeU, original.degreeU); assert.equal(instance.geometry.degreeV, original.degreeV);
      assert.deepEqual(instance.geometry.knotsU, original.knotsU); assert.deepEqual(instance.geometry.knotsV, original.knotsV);
      assert.deepEqual(surfaceDomain(instance.geometry), {u: domains.u, v: domains.v});
    }
    const expectedCPP = isCurve ? original.controlPoints.map(point => translated(point, translation)) :
      original.controlPoints.map(row => row.map(point => translated(point, translation)));
    assert.deepEqual(instance.geometry.controlPoints, expectedCPP);
    if (index === 0) {
      assert.deepEqual(instance.geometry, original); assert.equal(instance.evaluation, null);
      assert.deepEqual(report.members[index], {index, geometryId: original.id, translationMM: [0, 0, 0],
        observationCount: 0, derivativeComparisonCount: 0, derivativeRefusalCount: 0, handedness: null}); continue;
    }
    const child = instance.evaluation; assert.ok(child); children.push(child);
    assert.deepEqual(child.original, original); assert.deepEqual(child.geometry, instance.geometry);
    assert.deepEqual(child.options, {geometryId: instance.geometryId, maximumObservations: observationsPerCopy});
    assert.deepEqual(child.matrix, [1, 0, 0, translation[0], 0, 1, 0, translation[1], 0, 0, 1, translation[2]]);
    assert.equal(child.report.observationCount, observationsPerCopy); assert.equal(child.report.determinant, 1); assert.equal(child.report.handedness, 'preserved');
    assert.deepEqual(child.model.objects, [original, instance.geometry]); assert.deepEqual(validateAffineGeometryTransform(child), child.report);
    sourceFile(name + '.actual-copy_' + index, child.source, child.model);
    assert.deepEqual(report.members[index], {index, geometryId: instance.geometryId, translationMM: translation,
      observationCount: child.report.observationCount, derivativeComparisonCount: child.report.derivativeComparisonCount,
      derivativeRefusalCount: child.report.derivativeRefusalCount, handedness: 'preserved'});
    for (const [sampleIndex, observation] of child.report.observations.entries()) {
      const a = isCurve ? cs.values[sampleIndex] : us.values[Math.floor(sampleIndex / vs.values.length)], b = isCurve ? null : vs.values[sampleIndex % vs.values.length];
      const source = isCurve ? evaluateCurve(original, a) : evaluateSurface(original, a, b);
      const target = isCurve ? evaluateCurve(instance.geometry, a) : evaluateSurface(instance.geometry, a, b);
      const expected = translated(source, translation); closePoint(target, expected);
      assert.deepEqual(observation.originalPointMM, source); assert.deepEqual(observation.expectedPointMM, expected); assert.deepEqual(observation.actualPointMM, target);
      const originalD1 = state(() => isCurve ? evaluateCurveD1(original, a) : evaluateSurfaceD1(original, a, b));
      const targetD1 = state(() => isCurve ? evaluateCurveD1(instance.geometry, a) : evaluateSurfaceD1(instance.geometry, a, b));
      assert.deepEqual(observation.originalD1, originalD1); assert.deepEqual(observation.targetD1, targetD1); assert.equal(originalD1.status, targetD1.status);
      if (originalD1.status === 'evaluated') {
        if (isCurve) assert.ok(relative(targetD1.value.derivative, originalD1.value.derivative) <= 1e-7);
        else { assert.ok(relative(targetD1.value.du, originalD1.value.du) <= 1e-7); assert.ok(relative(targetD1.value.dv, originalD1.value.dv) <= 1e-7); }
      }
      evidence.push({index, parameter: isCurve ? a : null, u: isCurve ? null : a, v: b, originalPointMM: source, expectedPointMM: expected,
        actualPointMM: target, originalD1, targetD1});
    }
  }
  for (const field of ['copyObservationCount', 'originalD0EvaluationCount', 'targetD0EvaluationCount', 'originalD1AttemptCount', 'targetD1AttemptCount']) {
    const childField = field === 'copyObservationCount' ? 'observationCount' : field;
    assert.equal(report[field], children.reduce((sum, child) => sum + child.report[childField], 0)); assert.equal(report[field], (count - 1) * observationsPerCopy);
  }
  for (const field of ['derivativeComparisonCount', 'derivativeRefusalCount']) assert.equal(report[field], children.reduce((sum, child) => sum + child.report[field], 0));
  assert.deepEqual(report.derivativeSourceRefusalCounts, {original: children.reduce((sum, child) => sum + child.report.derivativeSourceRefusalCounts.original, 0),
    target: children.reduce((sum, child) => sum + child.report.derivativeSourceRefusalCounts.target, 0)});
  assert.equal(report.maximumPointDifferenceMM, Math.max(0, ...children.map(child => child.report.maximumPointDifferenceMM)));
  for (const field of ['maximumRelativeDerivativeDifference', 'maximumRelativeCrossDifference']) {
    const values = children.map(child => child.report[field]).filter(value => value !== null);
    assert.equal(report[field], values.length ? Math.max(...values) : null);
  }
  assert.equal(report.sourceModelObjectCount, count); assert.deepEqual(result.model.objects, result.instances.map(instance => instance.geometry));
  assert.equal(result.sourceVersion, 0); assert.equal(result.model.name, patternId);
  assert.equal(report.geometricValidity, 'not-certified'); assert.equal(report.topologyCertified, false); assert.equal(report.solid, false);
  assert.equal(report.quality.translationPolicy, 'index-times-authored-raw-xyz-spacing-no-chained-copies');
  assert.equal(report.quality.seedPolicy, 'actual-original-with-null-evaluation-no-phantom-copy-work'); assert.equal(report.quality.assembly, false); assert.equal(report.quality.booleanUnion, false);
  const source = sourceFile(name, result.source, result.model); assert.deepEqual(source.model.objects, result.instances.map(instance => instance.geometry));
  assert.deepEqual(validate(result), report);
  const owned = ownedFile(name + '.owned-linear-pattern', result); assert.deepEqual(validate(owned.reopened), report);
  assert.deepEqual(build(authored.reopened.original, authored.reopened.options), result);
  ownedFile(name + '.independent-native-observations', evidence);
  accepted.push({result, before: structuredClone(result), original, spacingMM, inputBefore: before, options});
  summaries.push({name, originalId: original.id, patternId, activeGeometryIds: report.activeGeometryIds, count, spacingMM, observationsPerCopy,
    childConstructionCount: report.childConstructionCount, copyObservationCount: report.copyObservationCount,
    derivativeComparisonCount: report.derivativeComparisonCount, derivativeRefusalCount: report.derivativeRefusalCount,
    sourceFile: source.file, authoredFile: authored.file, resultFile: owned.file});
  return result;
}
const seedOnly = check('seed_only_rational_curve', quarter, 1, [0, -0, 0], 'seed_only_pattern', 'unused_seed_prefix');
assert.equal(seedOnly.report.childConstructionCount, 0); assert.equal(seedOnly.report.copyObservationCount, 0);
assert.equal(seedOnly.options.maximumCopyObservations, 0); assert.equal(seedOnly.model.objects.length, 1);
const quarterPattern = check('five_quarter_x_copies', quarter, 5, [2, 0, 0], 'quarter_pattern', 'quarter_copy');
const surfacePattern = check('three_surface_diagonal_copies', plane, 3, [1, -.5, 2], 'surface_pattern', 'surface_copy');
const priorBefore = structuredClone(quarterPattern);
const edited = check('spacing_edit_same_roles', quarter, 5, [3, 0, 0], quarterPattern.options.patternId, quarterPattern.options.idPrefix);
assert.deepEqual(edited.report.activeGeometryIds, quarterPattern.report.activeGeometryIds); assert.deepEqual(edited.instances[0].geometry, quarterPattern.instances[0].geometry);
assert.ok(difference(evaluateCurve(edited.instances[4].geometry, 2), evaluateCurve(quarterPattern.instances[4].geometry, 2)) > 3);
assert.deepEqual(quarterPattern, priorBefore);
const wide = check('maximum64_curve_five_instances', wideCurve, 5, [.5, 0, 0], 'wide_curve_pattern', 'wide_curve_copy');
assert.equal(wide.report.copyObservationCount, 508); assert.equal(wide.report.derivativeRefusalCount, 248); assert.equal(wide.report.derivativeComparisonCount, 260);
assert.ok(Object.is(curveDomain(wide.instances[4].geometry)[0], -0));
const maximum = check('maximum16_by16_surface_five_instances', wideSurface, 5, [.5, -.25, 1], 'wide_surface_pattern', 'wide_surface_copy');
assert.equal(maximum.report.copyObservationCount, 3844); assert.equal(maximum.report.derivativeRefusalCount, 2688); assert.equal(maximum.report.derivativeComparisonCount, 1156);
assert.ok(Object.is(surfaceDomain(maximum.instances[4].geometry).u[0], -0));

function intact() {
  for (const item of accepted) { assert.deepEqual(item.result, item.before); assert.deepEqual({original: item.original, spacingMM: item.spacingMM}, item.inputBefore); }
  assert.deepEqual(quarterPattern, priorBefore);
  for (const [file, bytes] of retainedFiles) assert.deepEqual(readFileSync(file), bytes, file);
}
function reject(name, action, code, instanceIndex = null, childCode = null) {
  assert.throws(action, error => {
    assert.ok(error instanceof LinearGeometryPatternError); assert.equal(error.name, 'LinearGeometryPatternError'); assert.equal(error.code, code);
    assert.ok(Object.values(LinearGeometryPatternDiagnosticCode).includes(error.code)); assert.ok(error.message.startsWith('Native linear geometry pattern: '));
    assert.equal(error.instanceIndex, instanceIndex);
    if (childCode) { assert.ok(error.cause instanceof AffineGeometryTransformError); assert.equal(error.cause.code, childCode); }
    failures.push({name, code: error.code, instanceIndex: error.instanceIndex, message: error.message,
      actualCausePreserved: Object.hasOwn(error, 'cause'), childCauseCode: error.cause?.code ?? null});
    intact(); return true;
  });
}
const refusalOptions = {patternId: 'refusal_pattern', idPrefix: 'refusal_copy', count: 5, spacingMM: [2, 0, 0], maximumCopyObservations: 3844};
reject('zero_count', () => build(quarter, {...refusalOptions, count: 0}), 'INPUT');
reject('six_instances', () => build(quarter, {...refusalOptions, count: 6}), 'INPUT');
reject('seed_pattern_identity_collision', () => build(quarter, {...refusalOptions, patternId: quarter.id}), 'IDENTITY');
reject('generated_role_identity_collision', () => build(quarter, {...refusalOptions, patternId: 'refusal_copy_1'}), 'IDENTITY');
reject('prefix_bound', () => build(quarter, {...refusalOptions, idPrefix: 'x'.repeat(33)}), 'IDENTITY');
reject('zero_multi_spacing', () => build(quarter, {...refusalOptions, spacingMM: [0, 0, 0]}), 'INPUT');
reject('nonfinite_spacing', () => build(quarter, {...refusalOptions, spacingMM: [Infinity, 0, 0]}), 'INPUT');
reject('incomplete_copy_observation_budget', () => build(quarter, {...refusalOptions, maximumCopyObservations: 11}), 'BUDGET');
reject('last_precomputed_translation_bound', () => build(quarter, {...refusalOptions, spacingMM: [3000, 0, 0]}), 'REPRESENTABILITY', 4);
let getterCalls = 0;
const getter = {...refusalOptions};
Object.defineProperty(getter, 'count', {enumerable: true, get() { getterCalls++; return 5; }});
reject('input_getter', () => build(quarter, getter), 'INPUT'); assert.equal(getterCalls, 0);
const ownedGetter = structuredClone(quarterPattern);
Object.defineProperty(ownedGetter, 'instances', {enumerable: true, get() { getterCalls++; return quarterPattern.instances; }});
reject('owned_getter', () => validate(ownedGetter), 'OWNED'); assert.equal(getterCalls, 0);

// Copies1 and2 stay within the exact native coordinate bound. Only copy3 fails.
const lateSeed = inputSource('late_failure_seed', {kind: 'curve', id: 'late_seed', degree: 1, knots: [-3, -3, 7, 7],
  controlPoints: [[9997, 0, 0], [9998, 1, 0]], weights: [1, 1]});
const lateSeedBefore = structuredClone(lateSeed);
assert.equal(Math.max(...lateSeed.controlPoints.map(point => point[0])) + 1, 9999);
assert.equal(Math.max(...lateSeed.controlPoints.map(point => point[0])) + 2, 10000);
assert.equal(Math.max(...lateSeed.controlPoints.map(point => point[0])) + 3, 10001);
const lateOptions = {patternId: 'late_failure_pattern', idPrefix: 'late_copy', count: 4, spacingMM: [1, 0, 0], maximumCopyObservations: 9};
ownedFile('late_failure.authored-pattern', {original: lateSeed, options: lateOptions});
let replacement = quarterPattern;
reject('actual_last_copy_failure', () => { replacement = build(lateSeed, lateOptions); }, 'REPRESENTABILITY', 3, 'REPRESENTABILITY');
assert.strictEqual(replacement, quarterPattern); assert.deepEqual(replacement, priorBefore); assert.deepEqual(lateSeed, lateSeedBefore);
ownedFile('late_failure.atomic-retention', {failingInstanceIndex: failures.at(-1).instanceIndex, actualChildCauseCode: failures.at(-1).childCauseCode,
  previousReplacementUnchanged: replacement === quarterPattern, originalSeedUnchanged: true});
for (const [name, alter] of [
  ['source', result => result.source += ' '],
  ['seed_geometry', result => result.instances[0].geometry.controlPoints[0][0] += .1],
  ['copy_geometry', result => result.instances[2].geometry.controlPoints[0][0] += .1],
  ['translation', result => result.instances[2].translationMM[0] += .1],
  ['member_identity', result => result.instances[2].geometryId = 'unrelated_member'],
  ['child_original', result => result.instances[2].evaluation.original.controlPoints[0][0] += .1],
  ['child_work', result => result.instances[2].evaluation.report.originalD1AttemptCount++],
  ['aggregate_count', result => result.report.copyObservationCount++],
  ['schema', result => result.report.schema = 'unrelated-pattern'],
]) {
  const altered = structuredClone(quarterPattern); alter(altered); reject('owned_' + name + '_tamper', () => validate(altered), 'OWNED');
}
assert.deepEqual(validate(quarterPattern), quarterPattern.report); intact();

const packageRoot = resolve(repo, 'packages/barocss-cad'), manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const runtimeNames = ['buildLinearGeometryPattern', 'validateLinearGeometryPattern', 'LinearGeometryPatternError', 'LinearGeometryPatternDiagnosticCode'];
const typeNames = ['LinearGeometryPatternOptions', 'LinearGeometryPatternInstance', 'LinearGeometryPatternReport', 'LinearGeometryPatternResult'];
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.LinearGeometryPatternDiagnosticCode, LinearGeometryPatternDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./linear-geometry-pattern.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/linear-geometry-pattern.d.ts'), leafDeclaration = readFileSync(leafDeclarationPath, 'utf8');
for (const name of [...runtimeNames, ...typeNames]) assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(leafDeclaration), name);
const cold = JSON.parse(readFileSync(summaries.find(row => row.name === 'five_quarter_x_copies').authoredFile, 'utf8'));
const compiled = publicAPI.buildLinearGeometryPattern(cold.original, cold.options);
assert.deepEqual(compiled, quarterPattern); assert.deepEqual(publicAPI.validateLinearGeometryPattern(compiled), quarterPattern.report);
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 8,
  declarationCheck: 'actual declaration export text; no separate TypeScript invocation'};
ownedFile('compiled-consumer', compiledConsumer);
const summary = {sourceMode: true, cadSourceInputCount: cadInputs.length, summaries, failures, compiledConsumer,
  caseCount: summaries.length, refusalCount: failures.length, lateFailureInstanceIndex: 3,
  scope: 'Actual native affine copies from the original seed, per-member source and point/D1 proofs, atomic recipe results and all-member native Source0.',
  assembly: false, booleanUnion: false, circularPattern: false, topologyCertified: false, solidCertified: false};
ownedFile('summary', summary); intact();
console.log(JSON.stringify(summary));
