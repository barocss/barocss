import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node circular-geometry-pattern-demo.mjs --source <output-directory>'); assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]); mkdirSync(output, {recursive: true});
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const esbuild = require('esbuild'), entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundled = await esbuild.build({absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node',
  format: 'esm', write: false, target: 'es2022', metafile: true});
assert.equal(bundled.outputFiles.length, 1);
const sourceInputs = Object.keys(bundled.metafile.inputs).map(path => resolve(repo, path));
const cadInputs = sourceInputs.filter(path => path.includes('/packages/barocss-cad/'));
for (const file of ['index.ts', 'features/circular-geometry-pattern.ts', 'features/affine-geometry-transform.ts']) assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src', file)));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const {buildCircularGeometryPattern: build, validateCircularGeometryPattern: validate, CircularGeometryPatternError, CircularGeometryPatternDiagnosticCode,
  AffineGeometryTransformError, validateAffineGeometryTransform, evaluateCurve, evaluateCurveD1, evaluateSurface, evaluateSurfaceD1,
  curveDomain, surfaceDomain, compileCadModel} = api;
for (const operation of [build, validate, CircularGeometryPatternError]) assert.equal(typeof operation, 'function');
assert.deepEqual(Object.keys(CircularGeometryPatternDiagnosticCode).sort(),
  ['INPUT', 'IDENTITY', 'BUDGET', 'NATIVE', 'REPRESENTABILITY', 'BINDING', 'OWNED'].sort());
const accepted = [], summaries = [], failures = [], retainedFiles = new Map();
const difference = (a, b) => Math.hypot(...a.map((value, axis) => value - b[axis]));
const closePoint = (a, b) => assert.ok(difference(a, b) <= 1e-7);
const relative = (a, b) => difference(a, b) / Math.max(1, Math.hypot(...a), Math.hypot(...b));
const dot = (a, b) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
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
// Independent vector formula, without constructing a second rotation matrix.
function rotatedVector(vector, axis, angleDegrees) {
  const theta = angleDegrees * Math.PI / 180, cosine = Math.cos(theta), sine = Math.sin(theta), axisCross = cross(axis, vector), projection = dot(axis, vector);
  return vector.map((value, i) => value * cosine + axisCross[i] * sine + axis[i] * projection * (1 - cosine));
}
function rotatedPoint(point, origin, axis, angleDegrees) {
  const q = point.map((value, i) => value - origin[i]), r = rotatedVector(q, axis, angleDegrees); return r.map((value, i) => value + origin[i]);
}
function linearMatrixVector(matrix, vector) { return [0, 1, 2].map(row => dot(matrix.slice(4 * row, 4 * row + 3), vector)); }
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

function check(name, original, count, origin, direction, step, patternId, idPrefix) {
  const before = structuredClone({original, origin, direction}), isCurve = original.kind === 'curve';
  const domains = isCurve ? {curve: curveDomain(original), u: null, v: null} : {curve: null, ...surfaceDomain(original)};
  const cs = isCurve ? samples(original.knots, domains.curve) : {values: [], gaps: []};
  const us = isCurve ? {values: [], gaps: []} : samples(original.knotsU, domains.u), vs = isCurve ? {values: [], gaps: []} : samples(original.knotsV, domains.v);
  const perCopy = isCurve ? cs.values.length : us.values.length * vs.values.length, norm = Math.hypot(...direction), axis = direction.map(value => value / norm);
  const options = {patternId, idPrefix, count, axisOriginMM: [...origin], axisDirection: [...direction], angleStepDegrees: step, maximumCopyObservations: (count - 1) * perCopy};
  const authored = ownedFile(name + '.authored-pattern', {original, options});
  const result = build(original, options); ownership([original, options], result); assert.deepEqual({original, origin, direction}, before);
  assert.deepEqual(Object.keys(result).sort(), ['original', 'options', 'instances', 'source', 'sourceVersion', 'model', 'report'].sort());
  assert.deepEqual(result.original, original); assert.deepEqual(result.options, options); assert.equal(result.instances.length, count);
  const report = result.report;
  assert.equal(report.schema, 'barocss-native-circular-geometry-pattern'); assert.equal(report.version, 0); assert.equal(report.originalId, original.id);
  assert.equal(report.patternId, patternId); assert.equal(report.kind, original.kind); assert.equal(report.lengthUnit, 'mm');
  assert.equal(report.sourceFrame, 'authored-xyz-no-axis-conversion'); assert.equal(report.count, count); assert.equal(report.angleStepDegrees, step);
  assert.deepEqual(report.axisOriginMM, origin); assert.deepEqual(report.axisDirection, direction); assert.equal(report.axisNorm, norm); assert.deepEqual(report.normalizedAxis, axis);
  assert.equal(report.normalizationResidual, Math.abs(Math.hypot(...axis) - 1)); assert.ok(report.normalizationResidual <= 512 * Number.EPSILON);
  assert.deepEqual(report.activeGeometryIds, [original.id, ...Array.from({length: count - 1}, (_, i) => idPrefix + '_' + (i + 1))]);
  assert.deepEqual(report.anglesDegrees, Array.from({length: count}, (_, i) => i === 0 ? 0 : i * step));
  assert.equal(report.rotations.length, count - 1); assert.equal(report.plannedCopyCount, count - 1); assert.equal(report.childConstructionCount, count - 1);
  assert.equal(report.observationsPerCopy, perCopy); assert.equal(report.plannedCopyObservations, (count - 1) * perCopy);
  assert.deepEqual(report.domains, domains); assert.deepEqual(report.samples, {curve: cs.values, u: us.values, v: vs.values});
  assert.deepEqual(report.unrepresentedMidpointIntervals, {curve: cs.gaps, u: us.gaps, v: vs.gaps});
  const children = [], evidence = [];
  for (const [index, instance] of result.instances.entries()) {
    assert.deepEqual(Object.keys(instance).sort(), ['index', 'geometryId', 'angleDegrees', 'matrix', 'geometry', 'evaluation'].sort());
    assert.equal(instance.index, index); assert.equal(instance.geometryId, report.activeGeometryIds[index]); assert.equal(instance.geometry.id, instance.geometryId);
    assert.equal(instance.angleDegrees, report.anglesDegrees[index]); assert.deepEqual(instance.matrix, report.matrices[index]);
    assert.equal(instance.geometry.kind, original.kind); assert.deepEqual(instance.geometry.weights, original.weights);
    if (isCurve) { assert.equal(instance.geometry.degree, original.degree); assert.deepEqual(instance.geometry.knots, original.knots); assert.deepEqual(curveDomain(instance.geometry), domains.curve); }
    else { assert.equal(instance.geometry.degreeU, original.degreeU); assert.equal(instance.geometry.degreeV, original.degreeV);
      assert.deepEqual(instance.geometry.knotsU, original.knotsU); assert.deepEqual(instance.geometry.knotsV, original.knotsV); assert.deepEqual(surfaceDomain(instance.geometry), {u: domains.u, v: domains.v}); }
    if (index === 0) {
      assert.deepEqual(instance.geometry, original); assert.deepEqual(instance.matrix, identity); assert.equal(instance.evaluation, null);
      assert.deepEqual(report.members[0], {index: 0, geometryId: original.id, angleDegrees: 0, observationCount: 0, derivativeComparisonCount: 0, derivativeRefusalCount: 0, handedness: null}); continue;
    }
    const child = instance.evaluation, rotation = report.rotations[index - 1], angle = index * step, matrix = instance.matrix;
    assert.ok(child); children.push(child); assert.equal(rotation.index, index); assert.equal(rotation.angleDegrees, angle); assert.deepEqual(rotation.matrix, matrix);
    assert.equal(rotation.radians, angle * Math.PI / 180);
    assert.ok(Math.abs(rotation.sine - Math.sin(rotation.radians)) <= 1e-15); assert.ok(Math.abs(rotation.cosine - Math.cos(rotation.radians)) <= 1e-15);
    const quarter = angle / 90, exact = Number.isInteger(quarter) && angle === quarter * 90;
    assert.equal(rotation.trigonometry, exact ? 'exact-integral-quarter-turn-table' : 'native-sin-cos-stable-half-angle');
    const halfSine = Math.sin(rotation.radians / 2);
    assert.equal(rotation.oneMinusCosine, exact ? 1 - rotation.cosine : 2 * (halfSine * halfSine));
    const columns = [0, 1, 2].map(col => [matrix[col], matrix[4 + col], matrix[8 + col]]);
    const orthogonality = Math.max(...columns.flatMap((a, i) => columns.map((b, j) => Math.abs(dot(a, b) - (i === j ? 1 : 0)))));
    const determinant = dot(columns[0], cross(columns[1], columns[2]));
    assert.ok(Math.abs(rotation.orthogonalityResidual - orthogonality) <= 16 * Number.EPSILON);
    assert.ok(Math.abs(rotation.determinant - determinant) <= 16 * Number.EPSILON);
    assert.ok(Math.abs(rotation.determinantResidual - Math.abs(determinant - 1)) <= 16 * Number.EPSILON);
    const axisResidual = difference(linearMatrixVector(matrix, axis), axis), rc = linearMatrixVector(matrix, origin), t = [matrix[3], matrix[7], matrix[11]];
    const anchorResidual = difference(rc.map((value, i) => value + t[i]), origin) / Math.max(1, Math.hypot(...origin), Math.hypot(...rc), Math.hypot(...t));
    assert.ok(Math.abs(rotation.axisResidual - axisResidual) <= 16 * Number.EPSILON); assert.ok(Math.abs(rotation.anchorResidual - anchorResidual) <= 16 * Number.EPSILON);
    for (const field of ['orthogonalityResidual', 'determinantResidual', 'axisResidual', 'anchorResidual']) assert.ok(rotation[field] <= 512 * Number.EPSILON);
    assert.ok(difference(linearMatrixVector(matrix, [1, 2, -3]), rotatedVector([1, 2, -3], axis, angle)) <= 1e-12);
    const sourceCPP = isCurve ? original.controlPoints : original.controlPoints.flat(), targetCPP = isCurve ? instance.geometry.controlPoints : instance.geometry.controlPoints.flat();
    for (const [i, point] of sourceCPP.entries()) closePoint(targetCPP[i], rotatedPoint(point, origin, axis, angle));
    assert.deepEqual(child.original, original); assert.deepEqual(child.geometry, instance.geometry); assert.deepEqual(child.matrix, matrix);
    assert.deepEqual(child.options, {geometryId: instance.geometryId, maximumObservations: perCopy});
    assert.equal(child.report.handedness, 'preserved'); assert.deepEqual(validateAffineGeometryTransform(child), child.report);
    sourceFile(name + '.actual-copy_' + index, child.source, child.model);
    assert.deepEqual(report.members[index], {index, geometryId: instance.geometryId, angleDegrees: angle, observationCount: child.report.observationCount,
      derivativeComparisonCount: child.report.derivativeComparisonCount, derivativeRefusalCount: child.report.derivativeRefusalCount, handedness: 'preserved'});
    for (const [sampleIndex, observation] of child.report.observations.entries()) {
      const a = isCurve ? cs.values[sampleIndex] : us.values[Math.floor(sampleIndex / vs.values.length)], b = isCurve ? null : vs.values[sampleIndex % vs.values.length];
      const source = isCurve ? evaluateCurve(original, a) : evaluateSurface(original, a, b);
      const actual = isCurve ? evaluateCurve(instance.geometry, a) : evaluateSurface(instance.geometry, a, b), expected = rotatedPoint(source, origin, axis, angle);
      closePoint(actual, expected); assert.deepEqual(observation.originalPointMM, source); assert.deepEqual(observation.actualPointMM, actual);
      const originalD1 = state(() => isCurve ? evaluateCurveD1(original, a) : evaluateSurfaceD1(original, a, b));
      const targetD1 = state(() => isCurve ? evaluateCurveD1(instance.geometry, a) : evaluateSurfaceD1(instance.geometry, a, b));
      assert.deepEqual(observation.originalD1, originalD1); assert.deepEqual(observation.targetD1, targetD1); assert.equal(originalD1.status, targetD1.status);
      if (originalD1.status === 'evaluated') {
        if (isCurve) assert.ok(relative(targetD1.value.derivative, rotatedVector(originalD1.value.derivative, axis, angle)) <= 1e-7);
        else { assert.ok(relative(targetD1.value.du, rotatedVector(originalD1.value.du, axis, angle)) <= 1e-7);
          assert.ok(relative(targetD1.value.dv, rotatedVector(originalD1.value.dv, axis, angle)) <= 1e-7); }
      }
      evidence.push({index, angleDegrees: angle, parameter: isCurve ? a : null, u: isCurve ? null : a, v: b,
        originalPointMM: source, vectorRodriguesPointMM: expected, actualPointMM: actual, originalD1, targetD1});
    }
  }
  for (const field of ['copyObservationCount', 'originalD0EvaluationCount', 'targetD0EvaluationCount', 'originalD1AttemptCount', 'targetD1AttemptCount']) {
    assert.equal(report[field], children.reduce((sum, child) => sum + child.report[field === 'copyObservationCount' ? 'observationCount' : field], 0));
    assert.equal(report[field], (count - 1) * perCopy);
  }
  for (const field of ['derivativeComparisonCount', 'derivativeRefusalCount']) assert.equal(report[field], children.reduce((sum, child) => sum + child.report[field], 0));
  assert.deepEqual(report.derivativeSourceRefusalCounts, {original: children.reduce((sum, child) => sum + child.report.derivativeSourceRefusalCounts.original, 0),
    target: children.reduce((sum, child) => sum + child.report.derivativeSourceRefusalCounts.target, 0)});
  assert.equal(report.maximumPointDifferenceMM, Math.max(0, ...children.map(child => child.report.maximumPointDifferenceMM)));
  for (const field of ['maximumRelativeDerivativeDifference', 'maximumRelativeCrossDifference']) {
    const values = children.map(child => child.report[field]).filter(value => value !== null); assert.equal(report[field], values.length ? Math.max(...values) : null);
  }
  assert.equal(report.sourceModelObjectCount, count); assert.equal(result.sourceVersion, 0); assert.equal(result.model.name, patternId);
  assert.deepEqual(result.model.objects, result.instances.map(instance => instance.geometry));
  assert.equal(report.geometricValidity, 'not-certified'); assert.equal(report.topologyCertified, false); assert.equal(report.solid, false);
  assert.equal(report.quality.globalMetricPreservationCertified, false); assert.equal(report.quality.assembly, false);
  assert.equal(report.limits.rotationResidualThreshold, 512 * Number.EPSILON);
  const source = sourceFile(name, result.source, result.model); assert.deepEqual(source.model.objects[0], original); assert.deepEqual(validate(result), report);
  const owned = ownedFile(name + '.owned-circular-pattern', result); assert.deepEqual(validate(owned.reopened), report);
  assert.deepEqual(build(authored.reopened.original, authored.reopened.options), result); ownedFile(name + '.independent-vector-observations', evidence);
  accepted.push({result, before: structuredClone(result), original, origin, direction, inputBefore: before, options});
  summaries.push({name, patternId, kind: original.kind, count, angleStepDegrees: step, axisOriginMM: origin, axisDirection: direction,
    activeGeometryIds: report.activeGeometryIds, copyObservationCount: report.copyObservationCount, childConstructionCount: report.childConstructionCount,
    derivativeComparisonCount: report.derivativeComparisonCount, derivativeRefusalCount: report.derivativeRefusalCount,
    sourceFile: source.file, authoredFile: authored.file, resultFile: owned.file}); return result;
}
const seed = check('seed_only', quarter, 1, [1, -2, 3], [0, -0, 2], 0, 'seed_pattern', 'unused_copy');
assert.equal(seed.report.childConstructionCount, 0); assert.equal(seed.report.copyObservationCount, 0); assert.equal(seed.options.maximumCopyObservations, 0);
const positive = check('offset_positive90', quarter, 4, [1, -2, 3], [0, 0, 2], 90, 'positive_pattern', 'positive_copy');
const negative = check('offset_negative90', quarter, 3, [1, -2, 3], [0, 0, 2], -90, 'negative_pattern', 'negative_copy');
const tilted = check('tilted_nonunit_axis', plane, 3, [1, -2, 3], [1, 2, 3], 37, 'tilted_pattern', 'tilted_copy');
const positiveBefore = structuredClone(positive);
const edited = check('angle_edit_same_roles', quarter, 4, [1, -2, 3], [0, 0, 2], 37, positive.options.patternId, positive.options.idPrefix);
assert.deepEqual(edited.report.activeGeometryIds, positive.report.activeGeometryIds); assert.deepEqual(edited.instances[0].geometry, positive.instances[0].geometry);
assert.ok(difference(evaluateCurve(edited.instances[1].geometry, 2), evaluateCurve(positive.instances[1].geometry, 2)) > .1); assert.deepEqual(positive, positiveBefore);
const wide = check('maximum64_curve_five_instances', wideCurve, 5, [0, 0, 0], [0, 0, 1], 45, 'wide_curve_pattern', 'wide_curve_copy');
assert.equal(wide.report.copyObservationCount, 508); assert.equal(wide.report.derivativeRefusalCount, 248); assert.equal(wide.report.derivativeComparisonCount, 260);
const maximum = check('maximum16_by16_surface_five_instances', wideSurface, 5, [0, 0, 0], [0, 0, 1], 45, 'wide_surface_pattern', 'wide_surface_copy');
assert.equal(maximum.report.copyObservationCount, 3844); assert.equal(maximum.report.derivativeRefusalCount, 2688); assert.equal(maximum.report.derivativeComparisonCount, 1156);

function intact() {
  for (const item of accepted) { assert.deepEqual(item.result, item.before); assert.deepEqual({original: item.original, origin: item.origin, direction: item.direction}, item.inputBefore); }
  assert.deepEqual(positive, positiveBefore); for (const [file, bytes] of retainedFiles) assert.deepEqual(readFileSync(file), bytes, file);
}
function reject(name, action, code, instanceIndex = null, childCode = null) {
  assert.throws(action, error => {
    assert.ok(error instanceof CircularGeometryPatternError); assert.equal(error.name, 'CircularGeometryPatternError'); assert.equal(error.code, code);
    assert.ok(error.message.startsWith('Native circular geometry pattern: ')); assert.equal(error.instanceIndex, instanceIndex);
    if (childCode) { assert.ok(error.cause instanceof AffineGeometryTransformError); assert.equal(error.cause.code, childCode); }
    failures.push({name, code: error.code, instanceIndex: error.instanceIndex, message: error.message, actualCausePreserved: Object.hasOwn(error, 'cause'), childCauseCode: error.cause?.code ?? null});
    intact(); return true;
  });
}
const refusalOptions = {patternId: 'refusal_pattern', idPrefix: 'refusal_copy', count: 4, axisOriginMM: [0, 0, 0], axisDirection: [0, 0, 1], angleStepDegrees: 90, maximumCopyObservations: 3844};
reject('zero_count', () => build(quarter, {...refusalOptions, count: 0}), 'INPUT');
reject('six_instances', () => build(quarter, {...refusalOptions, count: 6}), 'INPUT');
reject('active_role_collision', () => build(quarter, {...refusalOptions, patternId: 'refusal_copy_1'}), 'IDENTITY');
reject('prefix_bound', () => build(quarter, {...refusalOptions, idPrefix: 'x'.repeat(33)}), 'IDENTITY');
reject('zero_axis', () => build(quarter, {...refusalOptions, axisDirection: [0, 0, 0]}), 'INPUT');
reject('axis_norm_below_bound', () => build(quarter, {...refusalOptions, axisDirection: [0, 0, 1e-7]}), 'INPUT');
reject('unsafe_normalized_axis_component', () => build(quarter, {...refusalOptions, axisDirection: [1e-14, 0, 1]}), 'REPRESENTABILITY');
reject('axis_origin_bound', () => build(quarter, {...refusalOptions, axisOriginMM: [10001, 0, 0]}), 'INPUT');
reject('duplicate_closing_turn', () => build(quarter, {...refusalOptions, count: 5}), 'INPUT');
reject('zero_multi_angle', () => build(quarter, {...refusalOptions, angleStepDegrees: 0}), 'INPUT');
reject('tiny_multi_angle', () => build(quarter, {...refusalOptions, angleStepDegrees: 1e-7}), 'INPUT');
reject('nonfinite_axis', () => build(quarter, {...refusalOptions, axisDirection: [Infinity, 0, 1]}), 'INPUT');
reject('complete_copy_budget', () => build(wideSurface, {...refusalOptions, count: 5, angleStepDegrees: 45, maximumCopyObservations: 3843}), 'BUDGET');
reject('precomputed_translation_bound', () => build(quarter, {...refusalOptions, axisOriginMM: [10000, 10000, 0]}), 'REPRESENTABILITY', 1);
let getterCalls = 0;
const getter = {...refusalOptions}; Object.defineProperty(getter, 'angleStepDegrees', {enumerable: true, get() { getterCalls++; return 90; }});
reject('input_getter', () => build(quarter, getter), 'INPUT'); assert.equal(getterCalls, 0);
const ownedGetter = structuredClone(positive); Object.defineProperty(ownedGetter.report, 'rotations', {enumerable: true, get() { getterCalls++; return positive.report.rotations; }});
reject('owned_getter', () => validate(ownedGetter), 'OWNED'); assert.equal(getterCalls, 0);
const lateSeed = inputSource('late_failure_seed', {kind: 'curve', id: 'late_seed', degree: 1, knots: [-3, -3, 7, 7],
  controlPoints: [[9900, 1500, 0], [9901, 1501, 0]], weights: [1, 1]});
const lateBefore = structuredClone(lateSeed), lateOptions = {...refusalOptions, patternId: 'late_failure_pattern', idPrefix: 'late_copy', angleStepDegrees: 28, maximumCopyObservations: 9};
const boundWitness = [1, 2, 3].map(index => ({index, points: lateSeed.controlPoints.map(point => rotatedPoint(point, [0, 0, 0], [0, 0, 1], index * 28))}));
for (const row of boundWitness.slice(0, 2)) assert.ok(row.points.every(point => point.every(value => Math.abs(value) <= 10000)));
assert.ok(boundWitness[2].points.some(point => point[1] > 10000)); ownedFile('late_failure.vector-bound-witness', boundWitness);
ownedFile('late_failure.authored-pattern', {original: lateSeed, options: lateOptions}); let replacement = positive;
reject('actual_last_native_copy_failure', () => { replacement = build(lateSeed, lateOptions); }, 'REPRESENTABILITY', 3, 'REPRESENTABILITY');
assert.strictEqual(replacement, positive); assert.deepEqual(replacement, positiveBefore); assert.deepEqual(lateSeed, lateBefore);
ownedFile('late_failure.atomic-retention', {failingInstanceIndex: failures.at(-1).instanceIndex, childCauseCode: failures.at(-1).childCauseCode, previousReplacementUnchanged: replacement === positive});
for (const [name, alter] of [
  ['source', result => result.source += ' '], ['copy_coefficient', result => result.instances[1].geometry.controlPoints[0][0] += .1],
  ['axis', result => result.report.normalizedAxis[0] += .1], ['matrix', result => result.instances[1].matrix[0] += .1],
  ['angle', result => result.instances[1].angleDegrees += 1], ['rotation_residual', result => result.report.rotations[0].orthogonalityResidual += .1],
  ['child_source', result => result.instances[1].evaluation.source += ' '], ['count', result => result.report.copyObservationCount++],
]) { const altered = structuredClone(positive); alter(altered); reject('owned_' + name + '_tamper', () => validate(altered), 'OWNED'); }
assert.deepEqual(validate(positive), positive.report); intact();
const packageRoot = resolve(repo, 'packages/barocss-cad'), manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')), declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath)); const publicAPI = await import(pathToFileURL(runtimePath).href);
const runtimeNames = ['buildCircularGeometryPattern', 'validateCircularGeometryPattern', 'CircularGeometryPatternError', 'CircularGeometryPatternDiagnosticCode'];
const typeNames = ['CircularGeometryPatternOptions', 'CircularGeometryPatternInstance', 'CircularGeometryPatternReport', 'CircularGeometryPatternResult'];
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.CircularGeometryPatternDiagnosticCode, CircularGeometryPatternDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./features/circular-geometry-pattern.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/features/circular-geometry-pattern.d.ts'), leafDeclaration = readFileSync(leafDeclarationPath, 'utf8');
for (const name of [...runtimeNames, ...typeNames]) assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(leafDeclaration), name);
const cold = JSON.parse(readFileSync(summaries.find(row => row.name === 'offset_positive90').authoredFile, 'utf8'));
const compiled = publicAPI.buildCircularGeometryPattern(cold.original, cold.options); assert.deepEqual(compiled, positive);
assert.deepEqual(publicAPI.validateCircularGeometryPattern(compiled), positive.report);
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 8, declarationCheck: 'actual declaration exports; no separate TypeScript invocation'};
ownedFile('compiled-consumer', compiledConsumer);
const summary = {sourceMode: true, cadSourceInputCount: cadInputs.length, summaries, failures, compiledConsumer, caseCount: summaries.length, refusalCount: failures.length,
  independentReference: 'vector Rodrigues point and direction formula', lateFailureInstanceIndex: 3,
  scope: 'Atomic original-seed native axis-angle copies with actual affine proofs, local SO3/anchor evidence, preserved native bases and all-member Source0.',
  assembly: false, booleanUnion: false, globalMetricPreservationCertified: false, topologyCertified: false, solidCertified: false};
ownedFile('summary', summary); intact(); console.log(JSON.stringify(summary));
