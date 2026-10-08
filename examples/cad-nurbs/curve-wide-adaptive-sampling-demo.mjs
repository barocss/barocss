import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.filter(arg => arg === '--source').length, 1,
  'Usage: node curve-wide-adaptive-sampling-demo.mjs --source [output-directory]');
const destinations = args.filter(arg => arg !== '--source');
assert.ok(destinations.length <= 1);
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const output = resolve(destinations[0] ?? '/tmp/barocss-curve-wide-adaptive-sampling-prototype');
mkdirSync(output, {recursive: true});

// The source graph is distinct from the manifest-declared compiled consumer below.
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
const esbuild = require('esbuild');
const entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const built = await esbuild.build({
  absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node',
  format: 'esm', write: false, target: 'es2022', metafile: true,
});
assert.equal(built.outputFiles.length, 1);
const sourceInputs = Object.keys(built.metafile.inputs).map(path => resolve(repo, path));
const cadInputs = sourceInputs.filter(path => path.includes('/packages/barocss-cad/'));
assert.ok(cadInputs.includes(entry));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' +
  Buffer.from(built.outputFiles[0].text).toString('base64'));
const {
  sampleCurveWideAdaptive: sample, validateWideAdaptiveCurveSamples: validate,
  WideAdaptiveCurveSamplingError, WideAdaptiveCurveSamplingDiagnosticCode,
  sampleCurveAdaptive, validateAdaptiveCurveSamples, refineCurveWide, joinCurves,
  evaluateCurve, evaluateCurveD1, curveDomain, validateCurve, compileCadModel,
} = api;
assert.equal(typeof sample, 'function');
assert.equal(typeof validate, 'function');
assert.equal(typeof WideAdaptiveCurveSamplingError, 'function');
assert.deepEqual(Object.keys(WideAdaptiveCurveSamplingDiagnosticCode).sort(),
  ['INPUT', 'IDENTITY', 'SPAN', 'REPRESENTABILITY', 'BUDGET', 'NATIVE', 'BINDING', 'OWNED'].sort());

const summaries = [];
const failures = [];
const write = (name, value) => writeFileSync(resolve(output, name), JSON.stringify(value, null, 2) + '\n');
const curve = (id, degree, knots, controlPoints, weights) =>
  ({kind: 'curve', id, degree, knots, controlPoints, weights});
const normDifference = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
const close = (a, b, tolerance = 1e-7) => assert.ok(normDifference(a, b) <= tolerance);

// JSON.stringify loses -0. Keep its raw JSON number token for owned-result reopen.
function nativeJSON(value) {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value));
    return Object.is(value, -0) ? '-0' : JSON.stringify(value);
  }
  if (value === null || ['string', 'boolean'].includes(typeof value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) =>
    JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}';
}

function finiteChordDistance(point, start, end) {
  const chord = end.map((value, index) => value - start[index]);
  const length = Math.hypot(...chord);
  if (length === 0) return normDifference(point, start);
  const direction = chord.map(value => value / length);
  const projection = point.reduce((sum, value, index) =>
    sum + (value - start[index]) * direction[index], 0);
  const along = Math.max(0, Math.min(length, projection));
  return Math.hypot(...point.map((value, index) =>
    value - (start[index] + along * direction[index])));
}

function d1(input, parameter) {
  try {
    return {status: 'evaluated', value: evaluateCurveD1(input, parameter)};
  } catch (error) {
    return {status: 'native-refused', reason: error.message.slice(0, 1024)};
  }
}

function sourceFile(name, source, model) {
  const file = resolve(output, name + '.source0.css');
  writeFileSync(file, source);
  const reopened = compileCadModel(readFileSync(file, 'utf8'), {sourceVersion: 0});
  assert.equal(reopened.ok, true, JSON.stringify(reopened.diagnostics));
  assert.deepEqual(reopened.model, model);
  return file;
}

function checkObservation(input, local, observation, start, end) {
  assert.deepEqual(observation.originalPointMM, evaluateCurve(input, observation.parameter));
  assert.deepEqual(observation.extractedPointMM, evaluateCurve(local, observation.parameter));
  close(observation.originalPointMM, observation.extractedPointMM);
  assert.equal(observation.extractionDifferenceMM,
    normDifference(observation.originalPointMM, observation.extractedPointMM));
  assert.deepEqual(observation.originalD1, d1(input, observation.parameter));
  assert.deepEqual(observation.extractedD1, d1(local, observation.parameter));
  if (observation.originalD1.status === 'evaluated' && observation.extractedD1.status === 'evaluated') {
    const original = observation.originalD1.value.derivative;
    const extracted = observation.extractedD1.value.derivative;
    close(original, extracted, 1e-7 * Math.max(1, Math.hypot(...original)));
    assert.equal(observation.derivativeDifferenceMM, normDifference(original, extracted));
    assert.equal(observation.relativeDerivativeDifference,
      observation.derivativeDifferenceMM / Math.max(1, Math.hypot(...original)));
  } else {
    assert.equal(observation.derivativeDifferenceMM, null);
    assert.equal(observation.relativeDerivativeDifference, null);
  }
  assert.ok(Math.abs(observation.outputChordDistanceMM -
    finiteChordDistance(observation.originalPointMM, start, end)) <= 1e-12);
}

function check(name, input, tolerance = .1) {
  const before = structuredClone(input);
  const options = {chordToleranceMM: tolerance, maxSegments: 512, maxDepth: 16, resultIdPrefix: name};
  const result = sample(input, options);
  assert.deepEqual(input, before);
  assert.deepEqual(result.curve, input);
  assert.deepEqual(result.options, options);
  assert.deepEqual(result.domain, curveDomain(input));
  assert.equal(result.sourceVersion, 0);
  assert.equal(result.model.name, name + '_model');
  assert.deepEqual(result.model.objects, [input]);
  assert.equal(result.parameters.length, result.pointsMM.length);
  assert.equal(result.parameters.length, result.samples.length);
  assert.equal(result.parameters.length, result.segments.length + 1);
  assert.ok(result.segments.length <= options.maxSegments);
  assert.ok(Object.is(result.parameters[0], result.domain[0]));
  assert.ok(Object.is(result.parameters.at(-1), result.domain[1]));

  for (const [index, parameter] of result.parameters.entries()) {
    if (index) assert.ok(parameter > result.parameters[index - 1]);
    // Exact equality includes signed zero. Local evaluation is not returned authority.
    assert.deepEqual(result.pointsMM[index], evaluateCurve(input, parameter));
    const point = result.samples[index];
    assert.equal(point.id, name + '_pt_' + index);
    assert.ok(Object.is(point.parameter, parameter));
    assert.deepEqual(point.pointMM, result.pointsMM[index]);
    const adjacent = result.segments.filter(segment =>
      segment.domain[0] === parameter || segment.domain[1] === parameter);
    assert.deepEqual(point.adjacentSegmentIds, adjacent.map(segment => segment.id));
    assert.deepEqual(point.originalSpanIndices, [...new Set(adjacent.map(segment => segment.originalSpanIndex))]);
    assert.equal(point.atOriginalKnot, input.knots.includes(parameter));
    assert.equal(point.originalD1Guarded, result.report.originalGuardedParameters.includes(parameter));
  }

  const spanSourceFiles = checkSpans(name, input, result);
  const observations = [];
  for (const [index, segment] of result.segments.entries()) {
    assert.equal(segment.id, name + '_seg_' + index);
    assert.deepEqual(segment.domain, [result.parameters[index], result.parameters[index + 1]]);
    assert.deepEqual(segment.originalSpanDomain, result.spans[segment.originalSpanIndex].domain);
    assert.ok(segment.depth <= options.maxDepth);
    assert.deepEqual(curveDomain(segment.bezier), segment.domain);
    assert.equal(segment.bezier.controlPoints.length, input.degree + 1);
    assert.equal(segment.bezier.knots.length, 2 * (input.degree + 1));
    validateCurve(segment.bezier);
    const start = result.pointsMM[index], end = result.pointsMM[index + 1];
    assert.deepEqual(segment.finiteChord.startMM, start);
    assert.deepEqual(segment.finiteChord.endMM, end);
    const hull = Math.max(...segment.bezier.controlPoints.map(point => finiteChordDistance(point, start, end)));
    assert.ok(Math.abs(hull - segment.controlPolygonBoundMM) <= 1e-12 * Math.max(1, hull));
    assert.equal(segment.arithmeticUncertaintyMM, 64 * Number.EPSILON * Math.max(1,
      normDifference(end, start), ...segment.bezier.controlPoints.flatMap(point => point.map(Math.abs)),
      ...start.map(Math.abs), ...end.map(Math.abs)));
    assert.ok(segment.controlPolygonBoundMM + segment.arithmeticUncertaintyMM <= tolerance);
    const midpoint = segment.domain[0] + (segment.domain[1] - segment.domain[0]) / 2;
    assert.deepEqual(segment.observations.map(observation => observation.parameter),
      [segment.domain[0], midpoint, segment.domain[1]]);
    for (const observation of segment.observations) {
      checkObservation(input, segment.bezier, observation, start, end);
      observations.push(observation);
    }
  }

  for (const [index, operation] of result.operations.entries()) {
    assert.equal(operation.index, index);
    assert.equal(operation.purpose, 'adaptive-subdivision');
    assert.notEqual(operation.inputCurveId, input.id);
    assert.ok(operation.parameter > operation.inputDomain[0] && operation.parameter < operation.inputDomain[1]);
    assert.equal(operation.lowerCurveId, name + '_split_' + index + '_lo');
    assert.equal(operation.upperCurveId, name + '_split_' + index + '_hi');
    assert.ok(operation.poleCounts.original <= input.degree + 1);
    assert.ok(operation.poleCounts.refined <= 2 * input.degree + 1);
    assert.ok(operation.nativeMaximumObservedDifferenceMM <= 1e-7);
  }
  assert.equal(result.operations.length, result.segments.length - result.spans.length);
  checkReport(input, result);
  validate(result);
  const originalSourceFile = sourceFile(name + '.original', result.source, result.model);
  const ownedResultFile = resolve(output, name + '.owned-result.json');
  writeFileSync(ownedResultFile, nativeJSON(result) + '\n');
  const reopened = JSON.parse(readFileSync(ownedResultFile, 'utf8'));
  assert.deepEqual(reopened, result);
  validate(reopened);
  write(name + '.observations.json', observations);
  summaries.push({name, originalPoles: input.controlPoints.length, originalKnots: input.knots.length,
    originalSpans: result.spans.length, segments: result.segments.length, points: result.samples.length,
    operations: result.operations.length, originalSourceFile, spanSourceFiles, ownedResultFile});
  return result;
}

function checkSpans(name, input, result) {
  const files = [];
  const observations = [];
  const knotSpanIndices = [];
  for (let index = input.degree; index < input.controlPoints.length; index++) {
    if (input.knots[index] < input.knots[index + 1]) knotSpanIndices.push(index);
  }
  assert.deepEqual(result.spans.map(span => span.knotSpanIndex), knotSpanIndices);
  for (const [index, span] of result.spans.entries()) {
    assert.equal(span.index, index);
    const k = span.knotSpanIndex, p = input.degree;
    assert.deepEqual(span.domain, [input.knots[k], input.knots[k + 1]]);
    assert.deepEqual(span.activePoleIndices, Array.from({length: p + 1}, (_, i) => k - p + i));
    assert.deepEqual(span.activeKnotIndices, Array.from({length: 2 * p + 2}, (_, i) => k - p + i));
    assert.deepEqual(span.originalActiveControlPoints, span.activePoleIndices.map(i => input.controlPoints[i]));
    assert.deepEqual(span.originalActiveWeights, span.activePoleIndices.map(i => input.weights[i]));
    assert.equal(span.levels.length, p + 1);
    for (const [degree, level] of span.levels.entries()) {
      assert.equal(level.degree, degree);
      assert.deepEqual(level.basisIndices, Array.from({length: degree + 1}, (_, i) => k - degree + i));
      assert.equal(level.coefficientMatrix.length, degree + 1);
      assert.ok(level.coefficientMatrix.every(row => row.length === degree + 1 &&
        row.every(value => Number.isFinite(value) && value >= 0)));
      const sums = Array.from({length: degree + 1}, (_, column) =>
        level.coefficientMatrix.reduce((sum, row) => sum + row[column], 0));
      assert.deepEqual(level.columnSums, sums);
      assert.equal(level.maximumPartitionResidual, Math.max(...sums.map(value => Math.abs(value - 1))));
      assert.ok(level.maximumPartitionResidual <= 64 * Number.EPSILON);
    }
    assert.deepEqual(span.coefficientMatrix, span.levels[p].coefficientMatrix);
    assert.deepEqual(span.columnSums, span.levels[p].columnSums);
    assert.deepEqual(span.rowSums, span.coefficientMatrix.map(row => row.reduce((sum, value) => sum + value, 0)));
    assert.equal(span.maximumPartitionResidual, Math.max(...span.levels.map(level => level.maximumPartitionResidual)));
    assert.equal(span.sourceVersion, 0);
    assert.equal(span.bezier.id, name + '_span_' + index);
    assert.equal(span.nativeSpanModel.name, span.bezier.id);
    assert.deepEqual(span.nativeSpanModel.objects, [span.bezier]);
    assert.deepEqual(curveDomain(span.bezier), span.domain);
    assert.equal(span.bezier.controlPoints.length, p + 1);
    assert.equal(span.bezier.knots.length, 2 * (p + 1));
    assert.equal(span.controlOrigins.length, p + 1);
    for (const [column, origin] of span.controlOrigins.entries()) {
      const coefficients = span.coefficientMatrix.map(row => row[column]);
      assert.equal(origin.bezierPoleIndex, column);
      assert.deepEqual(origin.coefficients, coefficients);
      assert.ok(origin.homogeneous.every(Number.isFinite));
      assert.ok(origin.homogeneous[3] > 0);
      const copyIndex = coefficients.findIndex((value, i) => value === 1 &&
        coefficients.every((other, j) => j === i || other === 0));
      if (copyIndex >= 0) {
        assert.equal(origin.origin, 'original-copy');
        assert.equal(origin.originalPoleIndex, span.activePoleIndices[copyIndex]);
        assert.deepEqual(span.bezier.controlPoints[column], input.controlPoints[origin.originalPoleIndex]);
        assert.ok(Object.is(span.bezier.weights[column], input.weights[origin.originalPoleIndex]));
      } else {
        assert.equal(origin.origin, 'generated-arithmetic');
        assert.equal(origin.originalPoleIndex, null);
        assert.deepEqual(span.bezier.controlPoints[column], origin.homogeneous.slice(0, 3)
          .map(value => value / origin.homogeneous[3]));
        assert.equal(span.bezier.weights[column], origin.homogeneous[3]);
      }
    }
    validateCurve(span.bezier);
    files.push(sourceFile(name + '.span_' + index, span.nativeSpanSource, span.nativeSpanModel));
    const midpoint = span.domain[0] + (span.domain[1] - span.domain[0]) / 2;
    for (const parameter of [span.domain[0], midpoint, span.domain[1]]) {
      const originalPointMM = evaluateCurve(input, parameter);
      const extractedPointMM = evaluateCurve(span.bezier, parameter);
      const originalD1 = d1(input, parameter), extractedD1 = d1(span.bezier, parameter);
      close(originalPointMM, extractedPointMM);
      if (originalD1.status === 'evaluated' && extractedD1.status === 'evaluated') {
        close(originalD1.value.derivative, extractedD1.value.derivative,
          1e-7 * Math.max(1, Math.hypot(...originalD1.value.derivative)));
      }
      observations.push({spanIndex: index, parameter, originalPointMM, extractedPointMM, originalD1, extractedD1});
    }
  }
  write(name + '.span-observations.json', observations);
  return files;
}

function checkReport(input, result) {
  const report = result.report;
  assert.equal(report.dto.schema, 'barocss-native-curve-samples');
  assert.equal(report.dto.version, 1);
  assert.equal(report.dto.lengthUnit, 'mm');
  assert.equal(report.dto.frame, 'authored-xyz-no-axis-conversion');
  assert.equal(report.dto.representation, 'sampled-display-points-not-native-edges-or-fit');
  assert.deepEqual(report.dto.capacity, {maximumOriginalPoles: 64, maximumOriginalKnots: 70,
    maximumSegments: 4096, maximumPoints: 4097});
  assert.equal(report.family, 'own-wide-adaptive-native-rational-curve-display-samples');
  assert.equal(report.curveId, input.id);
  assert.equal(report.degree, input.degree);
  assert.equal(report.originalSpanCount, result.spans.length);
  assert.equal(report.segmentCount, result.segments.length);
  assert.equal(report.pointCount, result.samples.length);
  assert.equal(report.operationCount, result.operations.length);
  assert.deepEqual(report.originalGuardedParameters, [...new Set(input.knots)]
    .filter(parameter => parameter > result.domain[0] && parameter < result.domain[1] &&
      input.knots.filter(knot => knot === parameter).length >= input.degree));
  assert.equal(report.maximumDepthUsed, Math.max(...result.segments.map(segment => segment.depth)));
  assert.equal(report.geometryAuthority, 'original-evaluateCurve-and-original-source0');
  assert.equal(report.geometricValidity, 'not-certified');
  assert.equal(report.topologyCertified, false);
  assert.equal(report.solid, false);
  assert.equal(report.budgetFailure, 'atomic-refusal-no-partial-result');
  assert.equal(report.quality.criterion, 'finite-segment-control-hull-estimate-plus-arithmetic-margin');
  assert.equal(report.quality.globalBinary64ErrorCertified, false);
  assert.equal(report.quality.manufacturingToleranceCertified, false);
  assert.equal(report.quality.localObservationsOnly, true);
  assert.equal(report.quality.extraction, 'local-cox-de-boor-to-bernstein-coefficients');
  assert.equal(report.quality.derivativeSemantics, 'original-native-c0-guards-and-local-one-sided-d1-no-g1-g2-claim');
  assert.equal(report.quality.ownership, 'copied-cpu-data-gc-no-renderer-resources');
  assert.equal(report.quality.identity, 'display-provenance-roles-not-native-edges-or-fit');
  assert.deepEqual(report.inputProfile.poleRange, [2, 64]);
  assert.equal(report.inputProfile.maximumKnots, 70);
  assert.equal(report.limits.maximumOriginalPoles, 64);
  assert.equal(report.limits.maximumOriginalKnots, 70);
  assert.equal(report.limits.maximumOriginalSpans, 64);
  assert.equal(report.limits.maximumSegments, 4096);
  assert.equal(report.limits.maximumPoints, 4097);
  assert.equal(report.limits.maximumOperations, 4095);
  assert.equal(report.limits.maximumReservedRoleIds, 32768);
  assert.equal(report.limits.maximumTemporaryPoles, 7);
  assert.equal(report.limits.maximumLocalBezierPoles, 4);
  assert.equal(report.limits.inputValues, 32768);
  assert.equal(report.limits.inputDepth, 8);
  assert.equal(report.limits.inputArrayElements, 128);
  assert.equal(report.limits.inputRecordFields, 16);
  assert.equal(report.limits.inputStringCharacters, 128);
  assert.equal(report.limits.snapshotValues, 2097152);
  assert.equal(report.limits.snapshotDepth, 32);
  assert.equal(report.limits.arrayElements, 8192);
  assert.equal(report.limits.recordFields, 64);
  assert.equal(report.limits.sourceStringCharacters, 262144);
  assert.equal(report.maximumPartitionResidual, Math.max(...result.spans.map(span => span.maximumPartitionResidual)));
  for (const [reportField, segmentField] of [
    ['maximumControlPolygonBoundMM', 'controlPolygonBoundMM'],
    ['maximumArithmeticUncertaintyMM', 'arithmeticUncertaintyMM'],
    ['maximumExtractionDifferenceMM', 'maximumExtractionDifferenceMM'],
    ['maximumObservedOutputChordDistanceMM', 'maximumObservedOutputChordDistanceMM'],
    ['maximumRelativeDerivativeDifference', 'maximumRelativeDerivativeDifference'],
  ]) assert.equal(report[reportField], Math.max(...result.segments.map(segment => segment[segmentField])));
}

write('source-api.metafile.json', built.metafile);
write('source-api.inputs.json', {entry, mode: 'in-memory-esbuild', write: false,
  cadInputs, allInputs: sourceInputs, esbuildVersion: esbuild.version});

// Actual #667 join, followed by the eleven count-three #686 requests: 31 -> 64 poles.
const knots = [-0, -0, -0, -0, ...Array.from({length: 12}, (_, index) => index + 1), 13, 13, 13, 13];
const left = curve('joined_left', 3, knots,
  Array.from({length: 16}, (_, index) => [index === 0 ? -0 : index,
    index === 0 ? -0 : (index % 3) * .25, index === 0 ? -0 : index * .125]), Array(16).fill(1));
const right = curve('joined_right', 3, knots,
  Array.from({length: 16}, (_, index) => [15 + index,
    index === 0 ? left.controlPoints.at(-1)[1] : (index % 3) * .25,
    left.controlPoints.at(-1)[2] + index * .125]), Array(16).fill(1));
const joined = joinCurves(left, right, {curveId: 'joined_31'});
assert.equal(joined.curve.controlPoints.length, 31);
const joinedBefore = structuredClone(joined);
const requests = Array.from({length: 11}, (_, index) => ({parameter: index + .5, count: 3}));
const refined = refineCurveWide(joined.curve,
  {curveId: 'wide_64', insertions: requests, resultIdPrefix: 'wide_refine'});
assert.equal(refined.curve.controlPoints.length, 64);
assert.equal(refined.curve.knots.length, 68);
const refinedBefore = structuredClone(refined);
writeFileSync(resolve(output, 'construction.owned-result.json'), nativeJSON(refined) + '\n');
sourceFile('construction.wide', refined.source, refined.model);
const wide = check('wide', refined.curve);
assert.equal(wide.spans.length, 37);
const wideBefore = structuredClone(wide);
const tighter = check('wide_tighter', refined.curve, .05);
assert.ok(tighter.segments.length >= wide.segments.length);
const sampledJoin = check('joined', joined.curve);
assert.equal(sampledJoin.spans.length, 26);
assert.deepEqual(refined, refinedBefore);
assert.deepEqual(joined, joinedBefore);

const weighted = curve('weighted_C0', 2, [-3, -3, -3, 1, 1, 7, 7, 7],
  [[-2, -0, -0], [0, 3, 1], [3, 0, 2], [5, -2, 4], [6, 1, 5]], [1, 2, .75, 1.5, 1]);
const weightedBefore = structuredClone(weighted);
const multi = check('weighted', weighted);
assert.equal(multi.spans.length, 2);
assert.equal(multi.parameters.filter(parameter => parameter === 1).length, 1);
assert.equal(d1(weighted, 1).status, 'native-refused');
const atC0 = multi.segments.flatMap(segment => segment.observations.filter(observation => observation.parameter === 1));
assert.equal(atC0.length, 2);
for (const observation of atC0) {
  assert.equal(observation.originalD1.status, 'native-refused');
  assert.equal(observation.extractedD1.status, 'evaluated');
}
assert.deepEqual(weighted, weightedBefore);
assert.deepEqual(wide, wideBefore);

// One real v0/16 witness. Its validator does not silently adopt the new v1 DTO.
const line = curve('legacy_line', 1, [2, 2, 5, 5], [[-0, -0, -0], [4, 0, 0]], [1, 1]);
const legacyOptions = {chordToleranceMM: .1, maxSegments: 8, maxDepth: 4, resultIdPrefix: 'legacy'};
const legacy = sampleCurveAdaptive(line, legacyOptions);
validateAdaptiveCurveSamples(legacy);
assert.equal(legacy.report.dto.version, 0);
assert.equal(legacy.report.inputProfile.poleRange[1], 16);
writeFileSync(resolve(output, 'legacy.v0-owned-result.json'), nativeJSON(legacy) + '\n');
const newLine = sample(line, {...legacyOptions, resultIdPrefix: 'new_line'});
validate(newLine);
assert.equal(newLine.report.dto.version, 1);
assert.deepEqual(newLine.pointsMM, legacy.pointsMM);
assert.throws(() => validateAdaptiveCurveSamples(newLine), Error);
failures.push({name: 'v0_validator_refuses_v1', actualOldAPI: true});
assert.throws(() => sampleCurveAdaptive(refined.curve, legacyOptions), Error);
failures.push({name: 'v0_sampler_refuses_64_poles', actualOldAPI: true});

function reject(name, action, code) {
  assert.throws(action, error => {
    assert.ok(error instanceof WideAdaptiveCurveSamplingError);
    assert.equal(error.name, 'WideAdaptiveCurveSamplingError');
    assert.ok(error.message.startsWith('Wide adaptive Curve sampling: '));
    assert.equal(error.code, code);
    failures.push({name, code: error.code, message: error.message});
    assert.deepEqual(wide, wideBefore);
    assert.deepEqual(refined, refinedBefore);
    assert.deepEqual(joined, joinedBefore);
    assert.deepEqual(weighted, weightedBefore);
    return true;
  });
}

const refusalOptions = {chordToleranceMM: .1, maxSegments: 512, maxDepth: 16, resultIdPrefix: 'guard'};
reject('max_segments', () => sample(weighted, {...refusalOptions, maxSegments: 2}), 'BUDGET');
reject('initial_span_budget', () => sample(refined.curve, {...refusalOptions, maxSegments: 1}), 'BUDGET');
reject('max_depth', () => sample(weighted, {...refusalOptions, maxDepth: 0}), 'BUDGET');
reject('zero_tolerance', () => sample(weighted, {...refusalOptions, chordToleranceMM: 0}), 'INPUT');
let getterCalls = 0;
const getter = {...refusalOptions};
Object.defineProperty(getter, 'chordToleranceMM', {
  enumerable: true, get() { getterCalls++; return .1; },
});
reject('input_getter', () => sample(weighted, getter), 'INPUT');
assert.equal(getterCalls, 0);
const tamperedPoint = structuredClone(wide);
tamperedPoint.pointsMM[1][0] += .1;
reject('owned_point_tamper', () => validate(tamperedPoint), 'OWNED');
const tamperedSource = structuredClone(wide);
tamperedSource.source += ' ';
reject('owned_source_tamper', () => validate(tamperedSource), 'OWNED');
const tamperedMatrix = structuredClone(wide);
tamperedMatrix.spans[0].coefficientMatrix[0][0] += .1;
reject('owned_analytic_matrix_tamper', () => validate(tamperedMatrix), 'OWNED');
const ownedGetter = structuredClone(wide);
Object.defineProperty(ownedGetter, 'pointsMM', {
  enumerable: true, get() { getterCalls++; return wide.pointsMM; },
});
reject('owned_getter', () => validate(ownedGetter), 'OWNED');
assert.equal(getterCalls, 0);
const unsafeMidpoint = curve('unsafe_midpoint', 1,
  [1, 1, 1 + Number.EPSILON, 1 + Number.EPSILON], [[0, 0, 0], [1, 0, 0]], [1, 1]);
reject('unrepresented_midpoint', () => sample(unsafeMidpoint, refusalOptions), 'REPRESENTABILITY');
validate(wide);

// Read the actual manifest entries only after the separate library build.
const packageRoot = resolve(repo, 'packages/barocss-cad');
const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import);
const declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath));
assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const runtimeExports = ['sampleCurveWideAdaptive', 'validateWideAdaptiveCurveSamples',
  'WideAdaptiveCurveSamplingError', 'WideAdaptiveCurveSamplingDiagnosticCode'];
for (const name of runtimeExports) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.WideAdaptiveCurveSamplingDiagnosticCode, WideAdaptiveCurveSamplingDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./curve-wide-adaptive-sampling.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/curve-wide-adaptive-sampling.d.ts');
const leafDeclaration = readFileSync(leafDeclarationPath, 'utf8');
const declarationExports = ['sampleCurveWideAdaptive', 'validateWideAdaptiveCurveSamples',
  'WideAdaptiveCurveSamplingError', 'WideAdaptiveCurveSamplingDiagnosticCode',
  'WideAdaptiveCurveSamplingOptions', 'WideAdaptiveCurveSample', 'WideAdaptiveCurveD1State',
  'WideAdaptiveCurveExtractionLevel', 'WideAdaptiveCurveSpan', 'WideAdaptiveCurveObservation',
  'WideAdaptiveCurveSegment', 'WideAdaptiveCurveSplitOperation',
  'WideAdaptiveCurveSamplingReport', 'WideAdaptiveCurveSamplingResult'];
for (const name of declarationExports) {
  assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(leafDeclaration), name);
}
assert.ok(leafDeclaration.includes('export type WideAdaptiveCurveSamplingDiagnosticCode'));
const compiledWide = publicAPI.sampleCurveWideAdaptive(refined.curve, wide.options);
publicAPI.validateWideAdaptiveCurveSamples(compiledWide);
assert.deepEqual(compiledWide, wide);
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeExports,
  declarationExports, originalPoles: compiledWide.curve.controlPoints.length,
  segments: compiledWide.segments.length, dtoVersion: compiledWide.report.dto.version,
  declarationCheck: 'actual exported declaration text; no separate TypeScript invocation'};
write('compiled-consumer.json', compiledConsumer);
write('summary.json', {sourceMode: true, cadSourceInputCount: cadInputs.length, summaries, failures,
  compiledConsumer, legacyV0Witness: true, legacyValidatorV1Refusal: true,
  scope: 'Original native points and source0 remain authority. Local analytic span curves and native midpoint splits supply finite-chord hull estimates and separate point/D1 observations. No global binary64, manufacturing, G1/G2, native-edge, fit, topology, solid, renderer or reader certificate.'});
console.log(JSON.stringify({sourceMode: true, cadSourceInputCount: cadInputs.length,
  summaries, failures, compiledConsumer}));
