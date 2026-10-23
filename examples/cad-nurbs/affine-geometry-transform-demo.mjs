import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node affine-geometry-transform-demo.mjs --source <output-directory>'); assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]); mkdirSync(output, {recursive: true});
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const esbuild = require('esbuild'), entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundled = await esbuild.build({absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node',
  format: 'esm', write: false, target: 'es2022', metafile: true});
assert.equal(bundled.outputFiles.length, 1);
const sourceInputs = Object.keys(bundled.metafile.inputs).map(path => resolve(repo, path));
const cadInputs = sourceInputs.filter(path => path.includes('/packages/barocss-cad/'));
for (const file of ['index.ts', 'affine-geometry-transform.ts']) assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src', file)));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const {transformNativeGeometryAffine: transform, validateAffineGeometryTransform: validate, AffineGeometryTransformError, AffineGeometryTransformDiagnosticCode,
  evaluateCurve, evaluateCurveD1, evaluateSurface, evaluateSurfaceD1, curveDomain, surfaceDomain, compileCadModel} = api;
for (const operation of [transform, validate, AffineGeometryTransformError]) assert.equal(typeof operation, 'function');
assert.deepEqual(Object.keys(AffineGeometryTransformDiagnosticCode).sort(),
  ['INPUT', 'IDENTITY', 'MATRIX', 'BUDGET', 'NATIVE', 'REPRESENTABILITY', 'BINDING', 'OWNED'].sort());
const accepted = [], summaries = [], failures = [], retainedFiles = new Map();
const difference = (a, b) => Math.hypot(...a.map((value, axis) => value - b[axis]));
const closePoint = (a, b) => assert.ok(difference(a, b) <= 1e-7);
const relative = (a, b) => difference(a, b) / Math.max(1, Math.hypot(...a), Math.hypot(...b));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
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
function applied(matrix, point, translation = true) {
  return [0, 1, 2].map(axis => {
    const offset = 4 * axis, row = matrix.slice(offset, offset + 3), t = translation ? matrix[offset + 3] : 0;
    if (row.every((value, column) => value === (column === axis ? 1 : 0)) && t === 0) return point[axis];
    return row.reduce((sum, value, column) => sum + value * point[column], 0) + t;
  });
}
function inputSource(name, geometry) {
  const list = values => '[' + values.map(decimal).join(',') + ']', poles = points => '[' + points.map(list).join(',') + ']';
  const model = {name: geometry.id + '_input', version: 0, lengthUnit: 'mm', objects: [geometry]};
  const body = geometry.kind === 'curve' ? '@curve #' + geometry.id + ' { type:nurbs; degree:' + geometry.degree + '; knots:' + list(geometry.knots) +
    '; control-points:' + poles(geometry.controlPoints) + '; weights:' + list(geometry.weights) + '; }' :
    '@surface #' + geometry.id + ' { type:nurbs; degree-u:' + geometry.degreeU + '; degree-v:' + geometry.degreeV + '; knots-u:' + list(geometry.knotsU) +
    '; knots-v:' + list(geometry.knotsV) + '; control-points:[' + geometry.controlPoints.map(poles).join(',') + ']; weights:[' + geometry.weights.map(list).join(',') + ']; }';
  return sourceFile(name + '.original', '@model ' + model.name + ' { version:0; length-unit:mm; ' + body + ' }\n', model).model.objects[0];
}
const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
const mirrorTranslate = [-1, 0, 0, 4, 0, 1, 0, 1, 0, 0, 1, 0];
const rotateTranslate = [0, -1, 0, 2, 1, 0, 0, -1, 0, 0, 1, 3];
const shearScale = [2, .5, 0, -1, 0, .5, 0, 2, 0, 0, 1.5, -3];
const reflection = [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
const maximumCurveMatrix = [.5, 0, 0, 1, 0, 2, 0, -2, 0, 0, 1, 3];
const maximumSurfaceMatrix = [1, .5, 0, 1, 0, 1, 0, -1, 0, 0, 2, 2];
const quarter = inputSource('rational_quarter', {kind: 'curve', id: 'quarter_original', degree: 2, knots: [-3, -3, -3, 7, 7, 7],
  controlPoints: [[2, -0, -0], [2, 2, -0], [0, 2, -0]], weights: [1, Math.SQRT1_2, 1]});
const cubic = inputSource('rational_cubic', {kind: 'curve', id: 'cubic_original', degree: 3, knots: [-2, -2, -2, -2, 6, 6, 6, 6],
  controlPoints: [[1, -0, 2], [2, 3, 0], [4, -1, 1], [6, 2, 3]], weights: [1, 2, 2, 1]});
const plane = inputSource('native_plane', {kind: 'surface', id: 'plane_original', degreeU: 1, degreeV: 1, knotsU: [-3, -3, 7, 7], knotsV: [2, 2, 5, 5],
  controlPoints: [[[1, 2, 3], [2, 5, 4]], [[4, 1, 5], [5, 4, 6]]], weights: [[1, 1], [1, 1]]});
const maximumCurve = inputSource('maximum_curve', {kind: 'curve', id: 'maximum_curve_original', degree: 1,
  knots: [-0, -0, ...Array.from({length: 62}, (_, i) => i + 1), 63, 63],
  controlPoints: Array.from({length: 64}, (_, i) => [i / 4, i % 2 / 4, i / 8]), weights: Array(64).fill(1)});
const maximumSurface = inputSource('maximum_surface', {kind: 'surface', id: 'maximum_surface_original', degreeU: 1, degreeV: 1,
  knotsU: [-0, -0, ...Array.from({length: 14}, (_, i) => i + 1), 15, 15],
  knotsV: [-3, -3, ...Array.from({length: 14}, (_, i) => i - 2), 12, 12],
  controlPoints: Array.from({length: 16}, (_, i) => Array.from({length: 16}, (_, j) => [i / 4, j / 4, (i + j) / 8])),
  weights: Array.from({length: 16}, () => Array(16).fill(1))});
ownedFile('source-api.metafile', bundled.metafile);
ownedFile('source-api.inputs', {entry, mode: 'in-memory-esbuild', write: false, sourceInputs, cadInputs, esbuildVersion: esbuild.version});

function check(name, original, matrix, expectedDeterminant) {
  const before = structuredClone({original, matrix}), isCurve = original.kind === 'curve';
  const domains = isCurve ? {curve: curveDomain(original), u: null, v: null} : {curve: null, ...surfaceDomain(original)};
  const curveSamples = isCurve ? samples(original.knots, domains.curve) : {values: [], gaps: []};
  const u = isCurve ? {values: [], gaps: []} : samples(original.knotsU, domains.u), v = isCurve ? {values: [], gaps: []} : samples(original.knotsV, domains.v);
  const count = isCurve ? curveSamples.values.length : u.values.length * v.values.length;
  const options = {geometryId: name + '_target', maximumObservations: count};
  const authored = ownedFile(name + '.authored-transform', {original, matrix, options});
  const result = transform(original, matrix, options); ownership([original, matrix, options], result); assert.deepEqual({original, matrix}, before);
  assert.deepEqual(Object.keys(result).sort(), ['original', 'matrix', 'options', 'geometry', 'source', 'sourceVersion', 'model', 'report'].sort());
  assert.deepEqual(result.original, original); assert.deepEqual(result.matrix, matrix); assert.deepEqual(result.options, options);
  const geometry = result.geometry, report = result.report;
  assert.equal(geometry.kind, original.kind); assert.equal(geometry.id, options.geometryId); assert.deepEqual(geometry.weights, original.weights);
  if (isCurve) { assert.equal(geometry.degree, original.degree); assert.deepEqual(geometry.knots, original.knots); assert.deepEqual(curveDomain(geometry), domains.curve); }
  else {
    assert.equal(geometry.degreeU, original.degreeU); assert.equal(geometry.degreeV, original.degreeV);
    assert.deepEqual(geometry.knotsU, original.knotsU); assert.deepEqual(geometry.knotsV, original.knotsV);
    assert.deepEqual(surfaceDomain(geometry), {u: domains.u, v: domains.v});
  }
  const mappings = [];
  if (isCurve) for (let i = 0; i < original.controlPoints.length; i++) mappings.push({index: [i], point: original.controlPoints[i], target: geometry.controlPoints[i]});
  else for (let i = 0; i < original.controlPoints.length; i++) for (let j = 0; j < original.controlPoints[i].length; j++)
    mappings.push({index: [i, j], point: original.controlPoints[i][j], target: geometry.controlPoints[i][j]});
  assert.equal(report.coefficientMappings.length, mappings.length);
  for (const [index, mapping] of report.coefficientMappings.entries()) {
    const own = mappings[index], expected = applied(matrix, own.point); assert.deepEqual(own.target, expected);
    assert.deepEqual(mapping.controlPoint, own.index); assert.deepEqual(mapping.originalPointMM, own.point); assert.deepEqual(mapping.targetPointMM, own.target);
    assert.equal(mapping.axes.length, 3);
    for (const [axis, axisMapping] of mapping.axes.entries()) {
      const offset = 4 * axis, row = matrix.slice(offset, offset + 4);
      const copy = row[3] === 0 && row.slice(0, 3).every((value, column) => value === (column === axis ? 1 : 0));
      assert.equal(axisMapping.axis, axis); assert.deepEqual(axisMapping.row, row);
      assert.deepEqual(axisMapping.terms, [row[0] * own.point[0], row[1] * own.point[1], row[2] * own.point[2], row[3]]);
      assert.ok(Object.is(axisMapping.value, own.target[axis])); assert.equal(axisMapping.policy, copy ? 'identity-axis-bit-copy' : 'guarded-affine-dot');
    }
  }
  assert.equal(report.schema, 'barocss-native-affine-geometry-transform'); assert.equal(report.version, 0);
  assert.equal(report.originalId, original.id); assert.equal(report.geometryId, geometry.id); assert.equal(report.kind, original.kind);
  assert.equal(report.lengthUnit, 'mm'); assert.equal(report.sourceFrame, 'authored-xyz-no-axis-conversion');
  assert.deepEqual(report.matrixRoles, {order: 'row-major-three-by-four-column-vector', linearUnit: 'dimensionless', translationUnit: 'mm'});
  assert.equal(report.determinant, expectedDeterminant); assert.equal(report.signedTripleTerms.length, 6);
  const triple = (a, b, c) => a * b * c;
  assert.deepEqual(report.signedTripleTerms, [triple(matrix[0], matrix[5], matrix[10]), triple(matrix[1], matrix[6], matrix[8]),
    triple(matrix[2], matrix[4], matrix[9]), -triple(matrix[2], matrix[5], matrix[8]),
    -triple(matrix[1], matrix[4], matrix[10]), -triple(matrix[0], matrix[6], matrix[9])]);
  assert.equal(report.signedTripleTerms.reduce((sum, value) => sum + value, 0), expectedDeterminant);
  assert.equal(report.absoluteTripleSum, report.signedTripleTerms.reduce((sum, value) => sum + Math.abs(value), 0));
  assert.equal(report.determinantThreshold, 128 * Number.EPSILON * report.absoluteTripleSum);
  assert.ok(Math.abs(report.determinant) > report.determinantThreshold); assert.equal(report.handedness, expectedDeterminant < 0 ? 'reversed' : 'preserved');
  assert.deepEqual(report.domains, domains); assert.deepEqual(report.samples, {curve: curveSamples.values, u: u.values, v: v.values});
  assert.deepEqual(report.unrepresentedMidpointIntervals, {curve: curveSamples.gaps, u: u.gaps, v: v.gaps});
  for (const field of ['observationCount', 'originalD0EvaluationCount', 'targetD0EvaluationCount', 'originalD1AttemptCount', 'targetD1AttemptCount']) assert.equal(report[field], count);
  assert.equal(report.observations.length, count);
  const evidence = []; let comparisons = 0, refusals = 0, maximumPoint = 0, maximumDerivative = 0, maximumCross = 0, crossCount = 0, crossDegenerateCount = 0;
  for (const [index, observation] of report.observations.entries()) {
    const a = isCurve ? curveSamples.values[index] : u.values[Math.floor(index / v.values.length)], b = isCurve ? null : v.values[index % v.values.length];
    assert.equal(observation.kind, original.kind);
    if (isCurve) assert.ok(Object.is(observation.parameter, a)); else { assert.ok(Object.is(observation.u, a)); assert.ok(Object.is(observation.v, b)); }
    const originalPoint = isCurve ? evaluateCurve(original, a) : evaluateSurface(original, a, b);
    const actualPoint = isCurve ? evaluateCurve(geometry, a) : evaluateSurface(geometry, a, b), expectedPoint = applied(matrix, originalPoint);
    assert.deepEqual(observation.originalPointMM, originalPoint); assert.deepEqual(observation.expectedPointMM, expectedPoint); assert.deepEqual(observation.actualPointMM, actualPoint);
    const residual = difference(expectedPoint, actualPoint); assert.equal(observation.differenceMM, residual); assert.ok(residual <= 1e-7); maximumPoint = Math.max(maximumPoint, residual);
    const originalD1 = state(() => isCurve ? evaluateCurveD1(original, a) : evaluateSurfaceD1(original, a, b));
    const targetD1 = state(() => isCurve ? evaluateCurveD1(geometry, a) : evaluateSurfaceD1(geometry, a, b));
    assert.deepEqual(observation.originalD1, originalD1); assert.deepEqual(observation.targetD1, targetD1); assert.equal(originalD1.status, targetD1.status);
    if (originalD1.status === 'evaluated') {
      comparisons++;
      if (isCurve) {
        const expected = applied(matrix, originalD1.value.derivative, false), error = relative(targetD1.value.derivative, expected);
        assert.deepEqual(observation.expectedDerivativeMM, expected); assert.equal(observation.relativeDerivativeDifference, error); assert.ok(error <= 1e-7);
        maximumDerivative = Math.max(maximumDerivative, error);
      } else {
        const expectedDu = applied(matrix, originalD1.value.du, false), expectedDv = applied(matrix, originalD1.value.dv, false);
        const errorDu = relative(targetD1.value.du, expectedDu), errorDv = relative(targetD1.value.dv, expectedDv);
        assert.deepEqual(observation.expectedDuMM, expectedDu); assert.deepEqual(observation.expectedDvMM, expectedDv);
        assert.equal(observation.relativeDuDifference, errorDu); assert.equal(observation.relativeDvDifference, errorDv);
        assert.ok(errorDu <= 1e-7); assert.ok(errorDv <= 1e-7); maximumDerivative = Math.max(maximumDerivative, errorDu, errorDv);
        const expectedCross = cross(expectedDu, expectedDv), actualCross = cross(targetD1.value.du, targetD1.value.dv), errorCross = relative(actualCross, expectedCross);
        assert.deepEqual(observation.expectedCrossMM2, expectedCross); assert.deepEqual(observation.actualCrossMM2, actualCross);
        assert.equal(observation.relativeCrossDifference, errorCross); assert.ok(errorCross <= 1e-7); maximumCross = Math.max(maximumCross, errorCross); crossCount++;
        const degenerate = Math.hypot(...expectedCross) === 0 || Math.hypot(...actualCross) === 0;
        assert.equal(observation.crossDegenerate, degenerate); if (degenerate) crossDegenerateCount++;
      }
    } else {
      refusals++;
      if (isCurve) { assert.equal(observation.expectedDerivativeMM, null); assert.equal(observation.relativeDerivativeDifference, null); }
      else for (const field of ['expectedDuMM', 'expectedDvMM', 'relativeDuDifference', 'relativeDvDifference', 'expectedCrossMM2', 'actualCrossMM2', 'relativeCrossDifference', 'crossDegenerate']) assert.equal(observation[field], null);
    }
    evidence.push({parameter: isCurve ? a : null, u: isCurve ? null : a, v: b, originalPointMM: originalPoint, expectedPointMM: expectedPoint,
      actualPointMM: actualPoint, originalD1, targetD1});
  }
  assert.equal(report.derivativeComparisonCount, comparisons); assert.equal(report.derivativeRefusalCount, refusals);
  assert.deepEqual(report.derivativeSourceRefusalCounts, {original: refusals, target: refusals}); assert.equal(report.maximumPointDifferenceMM, maximumPoint);
  assert.equal(report.maximumRelativeDerivativeDifference, comparisons ? maximumDerivative : null);
  assert.equal(report.maximumRelativeCrossDifference, crossCount ? maximumCross : null); assert.equal(report.degenerateCrossObservationCount, crossDegenerateCount);
  assert.equal(report.geometricValidity, 'not-certified'); assert.equal(report.topologyCertified, false); assert.equal(report.solid, false);
  assert.equal(report.quality.topologyOrientationCertified, false); assert.equal(report.quality.regularityCertified, false);
  assert.equal(report.quality.handednessMeaning, 'linear-map-parity-not-native-face-or-topology-orientation');
  assert.equal(result.sourceVersion, 0); assert.deepEqual(result.model.objects, [original, geometry]);
  const source = sourceFile(name, result.source, result.model); assert.deepEqual(source.model.objects[0], original);
  assert.deepEqual(validate(result), report);
  const owned = ownedFile(name + '.owned-affine-transform', result); assert.deepEqual(validate(owned.reopened), report);
  assert.deepEqual(transform(authored.reopened.original, authored.reopened.matrix, authored.reopened.options), result);
  ownedFile(name + '.independent-native-observations', evidence);
  accepted.push({result, before: structuredClone(result), original, matrix, inputBefore: before, options});
  summaries.push({name, kind: original.kind, originalId: original.id, geometryId: geometry.id, observationCount: count,
    determinant: report.determinant, handedness: report.handedness, derivativeComparisonCount: comparisons, derivativeRefusalCount: refusals,
    maximumPointDifferenceMM: maximumPoint, maximumRelativeDerivativeDifference: report.maximumRelativeDerivativeDifference,
    maximumRelativeCrossDifference: report.maximumRelativeCrossDifference, sourceFile: source.file, authoredFile: authored.file, resultFile: owned.file});
  return result;
}
const unchanged = check('identity_rational_curve', quarter, identity, 1);
assert.deepEqual({...unchanged.geometry, id: quarter.id}, quarter); assert.ok(Object.is(unchanged.geometry.controlPoints[0][1], -0));
assert.ok(Object.is(unchanged.geometry.controlPoints[0][2], -0));
const mirrored = check('mirror_translated_quarter', quarter, mirrorTranslate, -1);
const rotated = check('rotation90_translated_cubic', cubic, rotateTranslate, 1);
const sheared = check('sheared_scaled_plane', plane, shearScale, 1.5);
const reflected = check('reflected_plane_parity', plane, reflection, -1);
const originalPlaneD1 = evaluateSurfaceD1(plane, 2, 3.5), reflectedPlaneD1 = evaluateSurfaceD1(reflected.geometry, 2, 3.5);
const originalCross = cross(originalPlaneD1.du, originalPlaneD1.dv), reflectedCross = cross(reflectedPlaneD1.du, reflectedPlaneD1.dv);
assert.ok(relative(reflectedCross, [originalCross[0], -originalCross[1], -originalCross[2]]) <= 1e-7);
assert.deepEqual(reflected.geometry.knotsU, plane.knotsU); assert.deepEqual(reflected.geometry.knotsV, plane.knotsV);
ownedFile('surface-reflection-local-cross', {originalPlaneD1, reflectedPlaneD1, originalCross, reflectedCross, meaning: 'local-vector-parity-no-shell-orientation-certificate'});
const wide = check('maximum64_curve_c0', maximumCurve, maximumCurveMatrix, 1);
assert.equal(wide.report.observationCount, 127); assert.equal(wide.report.derivativeRefusalCount, 62); assert.equal(wide.report.derivativeComparisonCount, 65);
assert.ok(Object.is(curveDomain(wide.geometry)[0], -0));
const maximum = check('maximum16_by16_surface_c0', maximumSurface, maximumSurfaceMatrix, 2);
assert.equal(maximum.report.observationCount, 961); assert.equal(maximum.report.derivativeRefusalCount, 672); assert.equal(maximum.report.derivativeComparisonCount, 289);
assert.ok(Object.is(surfaceDomain(maximum.geometry).u[0], -0));

function intact() {
  for (const item of accepted) { assert.deepEqual(item.result, item.before); assert.deepEqual({original: item.original, matrix: item.matrix}, item.inputBefore); }
  for (const [file, bytes] of retainedFiles) assert.deepEqual(readFileSync(file), bytes, file);
}
function reject(name, action, code, causeCode = null) {
  assert.throws(action, error => {
    assert.ok(error instanceof AffineGeometryTransformError); assert.equal(error.name, 'AffineGeometryTransformError'); assert.equal(error.code, code);
    assert.ok(Object.values(AffineGeometryTransformDiagnosticCode).includes(error.code)); assert.ok(error.message.startsWith('Affine native geometry transform: '));
    if (causeCode) { assert.ok(error.cause instanceof AffineGeometryTransformError); assert.equal(error.cause.code, causeCode); }
    failures.push({name, code: error.code, message: error.message, actualCausePreserved: Object.hasOwn(error, 'cause'), causeCode: error.cause?.code ?? null});
    intact(); return true;
  });
}
const refusalOptions = {geometryId: 'refusal_target', maximumObservations: 961};
reject('singular_matrix', () => transform(quarter, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0], refusalOptions), 'MATRIX');
reject('cancellation_uncertain_determinant', () => transform(quarter, [1, 1, 0, 0, 1, 1 + Number.EPSILON, 0, 0, 0, 0, 1, 0], refusalOptions), 'MATRIX');
reject('wrong_matrix_length', () => transform(quarter, [...identity, 0, 0, 0, 1], refusalOptions), 'MATRIX');
const nonfinite = [...identity]; nonfinite[0] = Infinity;
reject('nonfinite_matrix', () => transform(quarter, nonfinite, refusalOptions), 'INPUT');
reject('linear_coefficient_bound', () => transform(quarter, [1001, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0], refusalOptions), 'MATRIX');
reject('unsupported_native_degree', () => transform({...quarter, degree: 6}, identity, refusalOptions), 'INPUT');
const invalidInput = structuredClone(quarter); invalidInput.controlPoints[1][0] = 10001;
reject('original_coordinate_bound', () => transform(invalidInput, identity, refusalOptions), 'INPUT');
reject('derived_coordinate_bound', () => transform(quarter, [1, 0, 0, 9999, 0, 1, 0, 0, 0, 0, 1, 0], refusalOptions), 'REPRESENTABILITY');
const lostShift = inputSource('lost_shift_valid_input', {kind: 'curve', id: 'lost_shift_original', degree: 1, knots: [0, 0, 1, 1],
  controlPoints: [[9999, 0, 0], [9999, 1, 0]], weights: [1, 1]});
reject('lost_nonzero_translation', () => transform(lostShift, [1, 0, 0, 1e-14, 0, 1, 0, 0, 0, 0, 1, 0], refusalOptions), 'REPRESENTABILITY');
reject('target_identity_collision', () => transform(quarter, identity, {...refusalOptions, geometryId: quarter.id}), 'IDENTITY');
reject('observation_budget', () => transform(maximumSurface, maximumSurfaceMatrix, {...refusalOptions, maximumObservations: 960}), 'BUDGET');
let getterCalls = 0;
const getter = {...refusalOptions};
Object.defineProperty(getter, 'maximumObservations', {enumerable: true, get() { getterCalls++; return 961; }});
reject('input_getter', () => transform(quarter, identity, getter), 'INPUT'); assert.equal(getterCalls, 0);
const ownedGetter = structuredClone(unchanged);
Object.defineProperty(ownedGetter.report, 'observations', {enumerable: true, get() { getterCalls++; return unchanged.report.observations; }});
reject('owned_getter', () => validate(ownedGetter), 'OWNED'); assert.equal(getterCalls, 0);
const singularOwned = structuredClone(unchanged); singularOwned.matrix[0] = 0;
reject('owned_singular_matrix_preserves_cause', () => validate(singularOwned), 'OWNED', 'MATRIX');
for (const [name, alter] of [
  ['source', result => result.source += ' '],
  ['matrix', result => result.matrix[3] += .1],
  ['coefficient', result => result.geometry.controlPoints[0][0] += .1],
  ['weights', result => result.geometry.weights[1] += .1],
  ['knots', result => result.geometry.knots[1] += .1],
  ['native_derivative', result => result.report.observations[0].targetD1.value.derivative[0] += .1],
  ['handedness', result => result.report.handedness = 'reversed'],
  ['counter', result => result.report.originalD1AttemptCount++],
]) {
  const altered = structuredClone(unchanged); alter(altered); reject('owned_' + name + '_tamper', () => validate(altered), 'OWNED');
}
assert.deepEqual(validate(unchanged), unchanged.report); intact();

const packageRoot = resolve(repo, 'packages/barocss-cad'), manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const runtimeNames = ['transformNativeGeometryAffine', 'validateAffineGeometryTransform', 'AffineGeometryTransformError', 'AffineGeometryTransformDiagnosticCode'];
const typeNames = ['CadAffineMatrix3x4', 'AffineGeometryTransformOptions', 'AffineGeometryTransformObservation', 'AffineGeometryTransformReport', 'AffineGeometryTransformResult'];
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.AffineGeometryTransformDiagnosticCode, AffineGeometryTransformDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./affine-geometry-transform.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/features/affine-geometry-transform.d.ts'), leafDeclaration = readFileSync(leafDeclarationPath, 'utf8');
for (const name of [...runtimeNames, ...typeNames]) assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(leafDeclaration), name);
const cold = JSON.parse(readFileSync(summaries.find(row => row.name === 'identity_rational_curve').authoredFile, 'utf8'));
const compiled = publicAPI.transformNativeGeometryAffine(cold.original, cold.matrix, cold.options);
assert.deepEqual(compiled, unchanged); assert.deepEqual(publicAPI.validateAffineGeometryTransform(compiled), unchanged.report);
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 9,
  declarationCheck: 'actual declaration export text; no separate TypeScript invocation'};
ownedFile('compiled-consumer', compiledConsumer);
const summary = {sourceMode: true, cadSourceInputCount: cadInputs.length, summaries, failures, compiledConsumer,
  caseCount: summaries.length, refusalCount: failures.length,
  scope: 'Native control-coefficient affine copies with original parameter/basis/weight bits and actual native point/D1/cross observations.',
  topologyOrientationCertified: false, matrixInverseCertified: false, matrixConditionCertified: false, regularityCertified: false, solidCertified: false};
ownedFile('summary', summary); intact();
console.log(JSON.stringify(summary));
