import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.filter(arg => arg === '--source').length, 1,
  'Usage: node curve-bezier-spans-demo.mjs --source [output-directory]');
const destinations = args.filter(arg => arg !== '--source');
assert.ok(destinations.length <= 1);
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const output = resolve(destinations[0] ?? '/tmp/barocss-curve-bezier-spans-prototype');
mkdirSync(output, {recursive: true});

// This in-memory source graph does not use the compiled consumer below.
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
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/curve-bezier-spans.ts')));
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/curve-wide-adaptive-sampling.ts')));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' +
  Buffer.from(built.outputFiles[0].text).toString('base64'));
const {
  extractCurveBezierSpans: extract, validateCurveBezierSpans: validate,
  CurveBezierSpanExtractionError, CurveBezierSpanExtractionDiagnosticCode,
  sampleCurveWideAdaptive, validateWideAdaptiveCurveSamples,
  refineCurveWide, joinCurves, buildXYArc, editCurveControlPolygon,
  evaluateCurve, evaluateCurveD1, curveDomain, validateCurve, compileCadModel,
} = api;
assert.equal(typeof extract, 'function');
assert.equal(typeof validate, 'function');
assert.equal(typeof CurveBezierSpanExtractionError, 'function');
assert.deepEqual(Object.keys(CurveBezierSpanExtractionDiagnosticCode).sort(),
  ['INPUT', 'IDENTITY', 'SPAN', 'REPRESENTABILITY', 'NATIVE', 'BINDING', 'OWNED'].sort());

const summaries = [], failures = [];
const write = (name, value) => writeFileSync(resolve(output, name), JSON.stringify(value, null, 2) + '\n');
const curve = (id, degree, knots, controlPoints, weights) =>
  ({kind: 'curve', id, degree, knots, controlPoints, weights});
const normDifference = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
const close = (a, b, tolerance = 1e-7) => assert.ok(normDifference(a, b) <= tolerance);

// Raw JSON number tokens retain -0 during result reopen.
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

function checkSpan(name, input, span, index) {
  const k = span.knotSpanIndex, p = input.degree;
  assert.equal(span.index, index);
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
  assert.equal(span.bezier.degree, p);
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
  return sourceFile(name + '.span_' + index, span.nativeSpanSource, span.nativeSpanModel);
}

function checkObservation(input, result, observation) {
  const span = result.spans[observation.spanIndex];
  assert.ok(span);
  assert.equal(observation.bezierCurveId, span.bezier.id);
  assert.deepEqual(observation.originalPointMM, evaluateCurve(input, observation.parameter));
  assert.deepEqual(observation.extractedPointMM, evaluateCurve(span.bezier, observation.parameter));
  close(observation.originalPointMM, observation.extractedPointMM);
  assert.equal(observation.extractionDifferenceMM,
    normDifference(observation.originalPointMM, observation.extractedPointMM));
  assert.deepEqual(observation.originalD1, d1(input, observation.parameter));
  assert.deepEqual(observation.extractedD1, d1(span.bezier, observation.parameter));
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
}

function checkEndpoints(input, result) {
  const parameters = [result.spans[0].domain[0], ...result.spans.map(span => span.domain[1])];
  assert.equal(result.endpoints.length, parameters.length);
  for (const [index, endpoint] of result.endpoints.entries()) {
    const parameter = parameters[index];
    assert.ok(Object.is(endpoint.parameter, parameter));
    assert.deepEqual(endpoint.originalPointMM, evaluateCurve(input, parameter));
    assert.deepEqual(endpoint.originalD1, d1(input, parameter));
    const adjacent = result.observations.filter(observation =>
      observation.location !== 'midpoint' && Object.is(observation.parameter, parameter));
    assert.deepEqual(endpoint.adjacentSpanIndices, adjacent.map(observation => observation.spanIndex));
    assert.deepEqual(endpoint.adjacentBezierCurveIds, adjacent.map(observation => observation.bezierCurveId));
    const multiplicity = input.knots.filter(knot => knot === parameter).length;
    assert.equal(endpoint.atOriginalKnot, multiplicity > 0);
    assert.equal(endpoint.originalMultiplicity, multiplicity);
    assert.equal(endpoint.originalD1Guarded, parameter > result.domain[0] &&
      parameter < result.domain[1] && multiplicity >= input.degree);
    assert.deepEqual(endpoint.localSides, adjacent.map(observation => ({
      spanIndex: observation.spanIndex, bezierCurveId: observation.bezierCurveId,
      side: observation.location, pointMM: observation.extractedPointMM,
      pointDifferenceMM: observation.extractionDifferenceMM, d1: observation.extractedD1,
      derivativeDifferenceMM: observation.derivativeDifferenceMM,
      relativeDerivativeDifference: observation.relativeDerivativeDifference,
    })));
    for (const local of endpoint.localSides) {
      const span = result.spans[local.spanIndex];
      assert.deepEqual(local.pointMM, evaluateCurve(span.bezier, parameter));
      assert.deepEqual(local.d1, d1(span.bezier, parameter));
      close(local.pointMM, endpoint.originalPointMM);
    }
  }
}

function checkReport(input, result) {
  const report = result.report;
  assert.equal(report.family, 'own-native-positive-rational-curve-bezier-spans');
  assert.equal(report.dto.schema, 'barocss-native-curve-bezier-spans');
  assert.equal(report.dto.version, 0);
  assert.equal(report.dto.lengthUnit, 'mm');
  assert.equal(report.dto.frame, 'authored-xyz-no-axis-conversion');
  assert.equal(report.dto.representation, 'native-coefficient-spans-not-wire-or-fit');
  assert.equal(report.curveId, input.id);
  assert.equal(report.degree, input.degree);
  assert.deepEqual(report.domain, result.domain);
  assert.equal(report.originalPoleCount, input.controlPoints.length);
  assert.equal(report.originalKnotCount, input.knots.length);
  assert.equal(report.spanCount, result.spans.length);
  assert.equal(report.observationCount, result.observations.length);
  assert.equal(report.endpointCount, result.endpoints.length);
  assert.equal(report.geometryAuthority, 'original-curve-coefficients-and-original-source0');
  assert.equal(report.geometricValidity, 'not-certified');
  assert.equal(report.topologyCertified, false);
  assert.equal(report.solid, false);
  assert.equal(report.maximumExtractionDifferenceMM,
    Math.max(...result.observations.map(observation => observation.extractionDifferenceMM)));
  assert.equal(report.maximumRelativeDerivativeDifference,
    Math.max(0, ...result.observations.map(observation => observation.relativeDerivativeDifference ?? 0)));
  assert.equal(report.maximumPartitionResidual,
    Math.max(...result.spans.map(span => span.maximumPartitionResidual)));
  assert.deepEqual(report.originalGuardedParameters,
    result.endpoints.filter(endpoint => endpoint.originalD1Guarded).map(endpoint => endpoint.parameter));
  assert.deepEqual(report.inputProfile, {degreeRange: [1, 3], poleRange: [2, 64], maximumKnots: 70,
    weightRange: [1e-6, 1e6], coordinateAbsMM: 10000, maximumNonzeroSpans: 64, clamped: true, nonperiodic: true});
  assert.equal(report.budgetFailure, 'atomic-refusal-no-partial-result');
  assert.equal(report.quality.extraction, 'existing-local-cox-de-boor-to-bernstein-coefficients');
  assert.equal(report.quality.pointComparisonMM, 1e-7);
  assert.equal(report.quality.relativeD1Comparison, 1e-7);
  assert.equal(report.quality.partitionComparison, 64 * Number.EPSILON);
  assert.equal(report.quality.localObservationsOnly, true);
  assert.equal(report.quality.globalBinary64ErrorCertified, false);
  assert.equal(report.quality.manufacturingToleranceCertified, false);
  assert.equal(report.quality.derivativeSemantics, 'original-native-c0-guards-and-local-one-sided-d1-no-g1-g2-claim');
  assert.equal(report.quality.adjacencySemantics, 'native-parameter-and-point-observations-not-sewn-wire-topology');
  assert.equal(report.quality.ownership, 'copied-cpu-data-gc-no-renderer-resources');
  assert.deepEqual(report.limits, {maximumDegree: 3, maximumOriginalPoles: 64, maximumOriginalKnots: 70,
    maximumSpans: 64, maximumLocalBezierPoles: 4, maximumObservations: 192, maximumEndpoints: 65,
    maximumReservedRoleIds: 65, inputValues: 32768, inputDepth: 8, inputArrayElements: 128,
    inputRecordFields: 16, inputStringCharacters: 128, snapshotValues: 262144, snapshotDepth: 32,
    arrayElements: 4096, recordFields: 64, sourceStringCharacters: 262144,
    authoredIdCharacters: 48, resultIdPrefixCharacters: 20});
}

function check(name, input) {
  const before = structuredClone(input), options = {resultIdPrefix: name};
  const result = extract(input, options);
  assert.deepEqual(Object.keys(result).sort(), ['curve', 'options', 'source', 'sourceVersion', 'model',
    'domain', 'spans', 'observations', 'endpoints', 'report'].sort());
  assert.deepEqual(input, before);
  assert.deepEqual(result.curve, input);
  assert.deepEqual(result.options, options);
  assert.deepEqual(result.domain, curveDomain(input));
  assert.equal(result.sourceVersion, 0);
  assert.equal(result.model.name, name + '_model');
  assert.deepEqual(result.model.objects, [input]);
  assert.ok(Object.is(result.spans[0].domain[0], result.domain[0]));
  assert.ok(Object.is(result.spans.at(-1).domain[1], result.domain[1]));
  const knotSpanIndices = [];
  for (let k = input.degree; k < input.controlPoints.length; k++) {
    if (input.knots[k] < input.knots[k + 1]) knotSpanIndices.push(k);
  }
  assert.deepEqual(result.spans.map(span => span.knotSpanIndex), knotSpanIndices);
  const spanSourceFiles = result.spans.map((span, index) => {
    if (index) assert.ok(Object.is(result.spans[index - 1].domain[1], span.domain[0]));
    return checkSpan(name, input, span, index);
  });
  assert.equal(result.observations.length, result.spans.length * 3);
  assert.ok(result.observations.length <= 192);
  for (const span of result.spans) {
    const observations = result.observations.filter(observation => observation.spanIndex === span.index);
    assert.deepEqual(observations.map(observation => observation.parameter),
      [span.domain[0], span.domain[0] + (span.domain[1] - span.domain[0]) / 2, span.domain[1]]);
    assert.deepEqual(observations.map(observation => observation.location), ['start', 'midpoint', 'end']);
  }
  for (const observation of result.observations) checkObservation(input, result, observation);
  checkEndpoints(input, result);
  checkReport(input, result);
  validate(result);
  const originalSourceFile = sourceFile(name + '.original', result.source, result.model);
  const ownedResultFile = resolve(output, name + '.owned-result.json');
  writeFileSync(ownedResultFile, nativeJSON(result) + '\n');
  const reopened = JSON.parse(readFileSync(ownedResultFile, 'utf8'));
  assert.deepEqual(reopened, result);
  validate(reopened);
  summaries.push({name, originalPoles: input.controlPoints.length, originalKnots: input.knots.length,
    spans: result.spans.length, observations: result.observations.length, endpoints: result.endpoints.length,
    originalSourceFile, spanSourceFiles, ownedResultFile});
  return result;
}

write('source-api.metafile.json', built.metafile);
write('source-api.inputs.json', {entry, mode: 'in-memory-esbuild', write: false,
  cadInputs, allInputs: sourceInputs, esbuildVersion: esbuild.version});

// Use the actual #667 join and eleven count-three #686 refinements from #696.
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
const wide = check('wide', refined.curve);
assert.equal(wide.spans.length, 37);
const wideBefore = structuredClone(wide);
assert.deepEqual(joined, joinedBefore);
assert.deepEqual(refined, refinedBefore);

const weighted = curve('weighted_C0', 2, [-3, -3, -3, 1, 1, 7, 7, 7],
  [[-2, -0, -0], [0, 3, 1], [3, 0, 2], [5, -2, 4], [6, 1, 5]], [1, 2, .75, 1.5, 1]);
const weightedBefore = structuredClone(weighted);
const multi = check('weighted', weighted);
assert.equal(multi.spans.length, 2);
assert.equal(d1(weighted, 1).status, 'native-refused');
const atC0 = multi.observations.filter(observation => observation.parameter === 1);
assert.equal(atC0.length, 2);
for (const observation of atC0) {
  assert.equal(observation.originalD1.status, 'native-refused');
  assert.equal(observation.extractedD1.status, 'evaluated');
}

const nativeQuarter = buildXYArc({kind: 'quarter-arc', id: 'quarter', center: [0, 0], radius: 4, quadrant: 0});
const nativeQuarterBefore = structuredClone(nativeQuarter);
const quarter = structuredClone(nativeQuarter.curve);
// Author -0 for zero coefficients. The rational quarter coefficients stay native.
quarter.knots = quarter.knots.map(value => value === 0 ? -0 : value);
quarter.controlPoints = quarter.controlPoints.map(point => point.map(value => value === 0 ? -0 : value));
const quarterBefore = structuredClone(quarter);
const copied = check('quarter', quarter);
assert.equal(copied.spans.length, 1);
assert.deepEqual(copied.spans[0].bezier.controlPoints, quarter.controlPoints);
assert.deepEqual(copied.spans[0].bezier.weights, quarter.weights);
assert.ok(copied.spans[0].controlOrigins.every(origin => origin.origin === 'original-copy'));
const copiedBefore = structuredClone(copied);
const edited = editCurveControlPolygon(quarter, {poleEdits: [{index: 1, zMM: 1, weight: .8}]});
assert.equal(edited.curve.id, quarter.id);
const editedBefore = structuredClone(edited);
const editedSpans = check('edited', edited.curve);
assert.notDeepEqual(editedSpans.spans[0].bezier.controlPoints, copied.spans[0].bezier.controlPoints);
assert.deepEqual(copied, copiedBefore);
assert.deepEqual(edited, editedBefore);
assert.deepEqual(nativeQuarter, nativeQuarterBefore);
assert.deepEqual(quarter, quarterBefore);
assert.deepEqual(weighted, weightedBefore);

// One small #696 witness checks the internal export's existing public behavior.
const compatibility = sampleCurveWideAdaptive(quarter,
  {chordToleranceMM: .1, maxSegments: 128, maxDepth: 16, resultIdPrefix: 'compat'});
validateWideAdaptiveCurveSamples(compatibility);
assert.equal(compatibility.report.dto.version, 1);
assert.equal(compatibility.spans.length, 1);
assert.deepEqual(compatibility.spans[0].coefficientMatrix, copied.spans[0].coefficientMatrix);
assert.deepEqual(compatibility.spans[0].bezier.controlPoints, quarter.controlPoints);
for (const [index, parameter] of compatibility.parameters.entries()) {
  assert.deepEqual(compatibility.pointsMM[index], evaluateCurve(quarter, parameter));
}
writeFileSync(resolve(output, 'compatibility.696-owned-result.json'), nativeJSON(compatibility) + '\n');
assert.deepEqual(quarter, quarterBefore);

function reject(name, action, code) {
  assert.throws(action, error => {
    assert.ok(error instanceof CurveBezierSpanExtractionError);
    assert.equal(error.name, 'CurveBezierSpanExtractionError');
    assert.ok(error.message.startsWith('Curve Bezier span extraction: '));
    assert.equal(error.code, code);
    if (name === 'nonpositive_weight') {
      assert.ok(error.cause instanceof Error);
      assert.ok(error.cause.message.includes('Weights must be'));
    }
    failures.push({name, code: error.code, message: error.message});
    assert.deepEqual(wide, wideBefore);
    assert.deepEqual(copied, copiedBefore);
    assert.deepEqual(joined, joinedBefore);
    assert.deepEqual(refined, refinedBefore);
    assert.deepEqual(weighted, weightedBefore);
    assert.deepEqual(edited, editedBefore);
    assert.deepEqual(quarter, quarterBefore);
    return true;
  });
}

const badProfile = structuredClone(weighted);
badProfile.weights[1] = 0;
reject('nonpositive_weight', () => extract(badProfile, {resultIdPrefix: 'guard'}), 'INPUT');
const overCapacity = curve('over_capacity', 1,
  [0, 0, ...Array.from({length: 63}, (_, index) => index + 1), 64, 64],
  Array.from({length: 65}, (_, index) => [index, 0, 0]), Array(65).fill(1));
reject('65_pole_capacity', () => extract(overCapacity, {resultIdPrefix: 'guard'}), 'INPUT');
reject('reserved_role', () => extract({...weighted, id: 'guard_span_63'}, {resultIdPrefix: 'guard'}), 'IDENTITY');
let getterCalls = 0;
const getter = {};
Object.defineProperty(getter, 'resultIdPrefix', {
  enumerable: true, get() { getterCalls++; return 'guard'; },
});
reject('input_getter', () => extract(weighted, getter), 'INPUT');
assert.equal(getterCalls, 0);
const unsafeMidpoint = curve('unsafe_midpoint', 1,
  [1, 1, 1 + Number.EPSILON, 1 + Number.EPSILON], [[0, 0, 0], [1, 0, 0]], [1, 1]);
reject('unrepresented_midpoint', () => extract(unsafeMidpoint, {resultIdPrefix: 'guard'}), 'REPRESENTABILITY');
const tamperedMatrix = structuredClone(wide);
tamperedMatrix.spans[0].coefficientMatrix[0][0] += .1;
reject('owned_matrix_tamper', () => validate(tamperedMatrix), 'OWNED');
const tamperedSource = structuredClone(wide);
tamperedSource.spans[0].nativeSpanSource += ' ';
reject('owned_span_source_tamper', () => validate(tamperedSource), 'OWNED');
const ownedGetter = structuredClone(wide);
Object.defineProperty(ownedGetter, 'endpoints', {
  enumerable: true, get() { getterCalls++; return wide.endpoints; },
});
reject('owned_getter', () => validate(ownedGetter), 'OWNED');
assert.equal(getterCalls, 0);
validate(wide);
validate(copied);

// The built package is loaded separately through its actual manifest entries.
const packageRoot = resolve(repo, 'packages/barocss-cad');
const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import);
const declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath));
assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const runtimeExports = ['extractCurveBezierSpans', 'validateCurveBezierSpans',
  'CurveBezierSpanExtractionError', 'CurveBezierSpanExtractionDiagnosticCode'];
for (const name of runtimeExports) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.CurveBezierSpanExtractionDiagnosticCode, CurveBezierSpanExtractionDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./curve-bezier-spans.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/curve-bezier-spans.d.ts');
const leafDeclaration = readFileSync(leafDeclarationPath, 'utf8');
const declarationExports = ['extractCurveBezierSpans', 'validateCurveBezierSpans',
  'CurveBezierSpanExtractionError', 'CurveBezierSpanExtractionDiagnosticCode',
  'CurveBezierSpanExtractionOptions', 'CurveBezierSpan', 'CurveBezierSpanD1State',
  'CurveBezierSpanObservation', 'CurveBezierSpanEndpoint',
  'CurveBezierSpanExtractionReport', 'CurveBezierSpanExtractionResult'];
for (const name of declarationExports) {
  assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(leafDeclaration), name);
}
assert.ok(leafDeclaration.includes('export type CurveBezierSpanExtractionDiagnosticCode'));
const compiledWide = publicAPI.extractCurveBezierSpans(refined.curve, wide.options);
publicAPI.validateCurveBezierSpans(compiledWide);
assert.deepEqual(compiledWide, wide);
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeExports,
  declarationExports, originalPoles: compiledWide.curve.controlPoints.length,
  spans: compiledWide.spans.length, dtoVersion: compiledWide.report.dto.version,
  declarationCheck: 'actual exported declaration text; no separate TypeScript invocation'};
write('compiled-consumer.json', compiledConsumer);
write('summary.json', {sourceMode: true, cadSourceInputCount: cadInputs.length, summaries, failures,
  compiledConsumer, small696CompatibilityWitness: true,
  scope: 'Original native Curve coefficients, source0 and parameter bits remain authority. Analytic coefficient spans retain native point/D1 observations and endpoint adjacency. Coincident endpoints do not certify a sewn wire, topology, G1/G2, global binary64 error, manufacturing tolerance, solid, fit, renderer or reader adoption.'});
console.log(JSON.stringify({sourceMode: true, cadSourceInputCount: cadInputs.length,
  summaries, failures, compiledConsumer}));
