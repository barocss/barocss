import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.filter(arg => arg === '--source').length, 1,
  'Usage: node curve-wide-cubic-plane-intersection-demo.mjs --source [output-directory]');
const destinations = args.filter(arg => arg !== '--source');
assert.ok(destinations.length <= 1);
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const output = resolve(destinations[0] ?? '/tmp/barocss-wide-cubic-curve-plane-intersection-prototype');
mkdirSync(output, {recursive: true});
const inputFile = '/Users/user/.barocss-ai/v3/evidence-686-cad/demo-output/wide_64.refined.source0.css';
const weightedInputFile = '/Users/user/.barocss-ai/v3/evidence-781-cad/demo-output/three_crossings.source0.css';
const inputBytes = readFileSync(inputFile), weightedInputBytes = readFileSync(weightedInputFile);
const inputSource = inputBytes.toString('utf8');
assert.deepEqual(Buffer.from(inputSource, 'utf8'), inputBytes);
const copiedInputFile = resolve(output, 'original64.input.source0.css');
assert.notEqual(copiedInputFile, inputFile);
writeFileSync(copiedInputFile, inputBytes);
assert.deepEqual(readFileSync(copiedInputFile), inputBytes);

// Source-only in-memory graph; compiled consumers are loaded separately below.
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
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/nurbs/source-wide/curve-wide-cubic-plane-intersection.ts')));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' +
  Buffer.from(built.outputFiles[0].text).toString('base64'));
const {
  intersectCubicCurveWideWithAffinePlaneSurface: intersect,
  validateWideCubicCurveAffinePlaneIntersection: validate,
  WideCubicCurveAffinePlaneIntersectionError, WideCubicCurveAffinePlaneIntersectionDiagnosticCode,
  validateCurveBezierSpans, validateCubicBezierCurveAffinePlaneIntersection,
  intersectCurveWithAffinePlaneSurface, validateCurveAffinePlaneIntersection,
  evaluateCurve, evaluateCurveD1, evaluateSurface, curveDomain, surfaceDomain, compileCadModel,
} = api;
for (const operation of [intersect, validate, WideCubicCurveAffinePlaneIntersectionError]) assert.equal(typeof operation, 'function');
assert.deepEqual(Object.keys(WideCubicCurveAffinePlaneIntersectionDiagnosticCode).sort(),
  ['INPUT', 'IDENTITY', 'SPAN', 'REPRESENTABILITY', 'BUDGET', 'NATIVE', 'BINDING', 'OWNED'].sort());

const summaries = [], failures = [];
const write = (name, value) => writeFileSync(resolve(output, name), JSON.stringify(value, null, 2) + '\n');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const difference = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
const close = (a, b, tolerance = 1e-7) => assert.ok(difference(a, b) <= tolerance);
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const optionsFor = (name, count = 192) => ({evaluationId: name + '_eval', resultIdPrefix: name,
  pointEventIds: Array.from({length: count}, (_, index) => name + '_event_' + index)});

function plane(id, origin, uAxis, vAxis, uDomain = [0, 1], vDomain = [0, 1]) {
  return {kind: 'surface', id, degreeU: 1, degreeV: 1,
    knotsU: [uDomain[0], uDomain[0], uDomain[1], uDomain[1]],
    knotsV: [vDomain[0], vDomain[0], vDomain[1], vDomain[1]],
    controlPoints: [[origin, origin.map((value, i) => value + vAxis[i])],
      [origin.map((value, i) => value + uAxis[i]), origin.map((value, i) => value + uAxis[i] + vAxis[i])]],
    weights: [[1, 1], [1, 1]]};
}

// Retain original knot/pole -0 and all owned evidence on JSON reopen.
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
  try { return {status: 'evaluated', value: evaluateCurveD1(input, parameter)}; }
  catch (error) { return {status: 'native-refused', reason: error.message.slice(0, 1024)}; }
}

function compileSource(source) {
  const compiled = compileCadModel(source, {sourceVersion: 0});
  assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
  return compiled.model;
}

function sourceFile(name, source, model) {
  const file = resolve(output, name + '.source0.css');
  writeFileSync(file, source);
  assert.deepEqual(compileSource(readFileSync(file, 'utf8')), model);
  return file;
}

function checkEvent(input, surface, result, event) {
  assert.ok(result.options.pointEventIds.includes(event.eventId));
  assert.deepEqual(event.pointMM, evaluateCurve(input, event.parameter));
  assert.deepEqual(event.originalCurveD1, d1(input, event.parameter));
  assert.ok(event.residualMM <= 1e-7);
  const axes = result.report.planeAxes;
  assert.equal(event.residualMM, Math.abs(dot(axes.unitNormal,
    event.pointMM.map((value, index) => value - axes.originMM[index]))));
  if (event.finiteDomainAdmitted) {
    assert.equal(event.classification, 'finite-domain-admitted');
    assert.deepEqual(event.planePointMM, evaluateSurface(surface, event.planeUV[0], event.planeUV[1]));
    close(event.pointMM, event.planePointMM);
  } else {
    assert.equal(event.classification, 'outside-domain');
    assert.equal(event.planePointMM, null);
  }
  assert.ok(event.contributions.length >= 1);
  for (const contribution of event.contributions) {
    const span = result.spans[contribution.spanIndex];
    assert.equal(contribution.spanId, span.spanId);
    assert.deepEqual(contribution.event, span.intersection.events.find(child => child.parameter === event.parameter));
    assert.deepEqual(contribution.childPointMM, evaluateCurve(span.curve, event.parameter));
    assert.deepEqual(contribution.originalPointMM, event.pointMM);
    assert.equal(contribution.pointDifferenceMM, difference(contribution.childPointMM, event.pointMM));
    assert.deepEqual(contribution.childCurveD1, d1(span.curve, event.parameter));
    assert.deepEqual(contribution.originalCurveD1, event.originalCurveD1);
    assert.ok(contribution.event.bracket[0] <= event.parameter && event.parameter <= contribution.event.bracket[1]);
    assert.ok(contribution.event.bracket[1] - contribution.event.bracket[0] <= 1e-12);
    assert.ok(contribution.event.iterations <= 64);
    if (contribution.originalCurveD1.status === 'evaluated' && contribution.childCurveD1.status === 'evaluated') {
      assert.equal(contribution.derivativeComparison.status, 'compared');
      assert.equal(contribution.derivativeComparison.maximumAbsoluteDifference,
        Math.max(...contribution.originalCurveD1.value.derivative.map((value, i) =>
          Math.abs(value - contribution.childCurveD1.value.derivative[i]))));
    } else assert.equal(contribution.derivativeComparison.status, 'unavailable');
  }
  for (const side of event.sideObservations) {
    const span = result.spans[side.spanIndex];
    assert.equal(side.spanId, span.spanId);
    assert.ok(side.parameter > span.domain[0] && side.parameter < span.domain[1]);
    assert.ok(side.side === 'lower' ? side.parameter < event.parameter : side.parameter > event.parameter);
    assert.deepEqual(side.pointMM, evaluateCurve(input, side.parameter));
    assert.deepEqual(side.childPointMM, evaluateCurve(span.curve, side.parameter));
    assert.equal(side.pointDifferenceMM, difference(side.pointMM, side.childPointMM));
    assert.deepEqual(side.originalCurveD1, d1(input, side.parameter));
    assert.deepEqual(side.childCurveD1, d1(span.curve, side.parameter));
    assert.equal(side.signedDistanceMM, dot(axes.unitNormal,
      side.pointMM.map((value, i) => value - axes.originMM[i])));
  }
}

function checkReport(input, surface, result) {
  const report = result.report;
  assert.equal(report.family, 'own-wide-cubic-curve-affine-plane-surface');
  assert.deepEqual(report.dto, {schema: 'barocss-native-wide-cubic-curve-plane-intersection', version: 0,
    lengthUnit: 'mm', frame: 'raw-authored-xyz-no-axis-conversion',
    representation: 'original-wide-cubic-curve-plane-events-not-sewn-topology'});
  assert.equal(report.kind, result.kind);
  assert.equal(report.evaluationId, result.options.evaluationId);
  assert.equal(report.curveId, input.id);
  assert.equal(report.planeId, surface.id);
  assert.equal(report.curveDegree, 3);
  assert.deepEqual(report.curveDomain, curveDomain(input));
  assert.deepEqual(report.planeAxes.domains, surfaceDomain(surface));
  assert.equal(report.spanCount, result.spans.length);
  assert.equal(report.primitiveCallCount, result.spans.length);
  assert.ok(report.primitiveCallCount <= 64);
  assert.equal(report.cubicScalarEvaluationCount, result.spans.reduce((sum, span) =>
    sum + span.intersection.report.rootEvidence.scalarEvaluationCount, 0));
  assert.ok(report.cubicScalarEvaluationCount <= 65536);
  const counts = {executed: 0, notRequiredCoincident: 0, notRequiredStrictCubicSignExclusion: 0};
  for (const span of result.spans) {
    const status = span.intersection.report.rootEvidence.derivativeSearchStatus;
    if (status === 'executed') counts.executed++;
    else if (status === 'not-required-coincident') counts.notRequiredCoincident++;
    else { assert.equal(status, 'not-required-strict-cubic-sign-exclusion'); counts.notRequiredStrictCubicSignExclusion++; }
  }
  assert.deepEqual(report.derivativeSearchCounts, counts);
  assert.deepEqual(report.strictSignExcludedSpanIds, result.spans.filter(span =>
    span.intersection.report.rootEvidence.controlHullExclusion !== null).map(span => span.spanId));
  assert.equal(report.contributionCount, result.events.reduce((sum, event) => sum + event.contributions.length, 0));
  assert.ok(report.contributionCount <= 192);
  assert.equal(report.supportEventCount, result.events.length);
  assert.equal(report.finiteEventCount, result.events.filter(event => event.finiteDomainAdmitted).length);
  assert.equal(report.outsideEventCount, result.events.filter(event => !event.finiteDomainAdmitted).length);
  assert.deepEqual(report.supportDisjointSpanIds, result.spans.filter(span =>
    span.intersection.kind === 'support-disjoint').map(span => span.spanId));
  assert.deepEqual(report.coincidentSpans, result.spans.filter(span => span.intersection.report.coincident.support)
    .map(span => ({spanId: span.spanId, domain: span.domain,
      finiteContainment: span.intersection.report.coincident.finiteContainment === 'control-hull-contained'
        ? 'control-hull-contained' : 'finite-containment-not-proven'})));
  const domain = curveDomain(input);
  assert.deepEqual(report.originalGuardedParameters, [...new Set(input.knots)].filter(parameter =>
    parameter > domain[0] && parameter < domain[1] && input.knots.filter(knot => knot === parameter).length >= 3));
  assert.ok(report.privateIdAllocationAttempts >= 4 * result.spans.length && report.privateIdAllocationAttempts <= 1024);
  assert.equal(report.authority, 'original-complete-cubic-curve-coefficients');
  assert.equal(report.geometricValidity, 'not-certified');
  assert.equal(report.topologyCertified, false);
  assert.equal(report.solid, false);
  assert.deepEqual(report.inputProfile, {curveDegree: 3, poleRange: [4, 64], maximumKnots: 70, maximumNonzeroSpans: 64,
    weightRange: [1e-6, 1e6], coordinateAbsMM: 10000, clamped: true, nonperiodic: true,
    planeDegree: [1, 1], planeControlGrid: [2, 2], planeEqualWeights: true, planeAffine: true});
  assert.deepEqual(report.numericPolicy, {parameterWidthTarget: 1e-12, maximumRootSteps: 64,
    pointBindingComparisonMM: 1e-7, exactParameterDedupOnly: true,
    sideSampling: 'represented-midpoint-between-event-and-nearest-span-root-or-boundary',
    uvBoundaryPolicy: 'original-estimate-and-bracket-domain-agreement-no-clamp'});
  assert.deepEqual(report.quality, {extraction: 'actual-public-native-bezier-span-extraction',
    primitive: 'actual-public-cubic-bezier-curve-plane-intersection', assembly: 'shared-whole-original-curve-event-uv-bracket-assembly',
    localUncertainty: 'atomic-refusal', derivativeSearchEvidence: 'per-span-executed-or-explicitly-not-required',
    globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false, coincidenceClippingCertified: false,
    ownership: 'copied-cpu-data-gc-no-renderer-resources'});
  assert.equal(report.budgetFailure, 'atomic-refusal-no-partial-result');
  assert.deepEqual(report.limits, {maximumOriginalPoles: 64, maximumOriginalKnots: 70, maximumSpans: 64,
    maximumLocalBezierPoles: 4, maximumContributions: 192, maximumEvents: 192, maximumPrimitiveCalls: 64,
    maximumScalarEvaluations: 65536, maximumEventsPerPrimitive: 3, maximumDerivativeRootsPerPrimitive: 2,
    maximumRootSteps: 64, maximumScalarEvaluationsPerPrimitive: 1024, maximumPrivateIdAllocationAttempts: 1024,
    privateRolesPerSpan: 4, reservedExtractionRoleIds: 65, inputValues: 32768, inputDepth: 8, inputArrayElements: 256,
    inputRecordFields: 16, inputStringCharacters: 128, snapshotValues: 4194304, snapshotDepth: 48,
    arrayElements: 4096, recordFields: 64, sourceStringCharacters: 262144, authoredIdCharacters: 48, resultIdPrefixCharacters: 20});
}

function check(name, input, surface, options = optionsFor(name)) {
  const before = [structuredClone(input), structuredClone(surface), structuredClone(options)];
  const result = intersect(input, surface, options);
  assert.deepEqual([input, surface, options], before);
  assert.deepEqual(Object.keys(result).sort(), ['kind', 'curve', 'plane', 'options', 'source', 'sourceVersion', 'model',
    'extraction', 'spans', 'events', 'report'].sort());
  assert.deepEqual(result.curve, input);
  assert.deepEqual(result.plane, surface);
  assert.deepEqual(result.options, options);
  assert.equal(result.sourceVersion, 0);
  assert.equal(result.model.name, options.evaluationId);
  assert.deepEqual(result.model.objects, [input, surface]);
  const originalSourceFile = sourceFile(name + '.original', result.source, result.model);
  assert.deepEqual(result.extraction.curve, input);
  assert.deepEqual(validateCurveBezierSpans(result.extraction), result.extraction.report);
  sourceFile(name + '.extraction_original', result.extraction.source, result.extraction.model);
  assert.equal(result.spans.length, result.extraction.spans.length);
  assert.ok(result.spans.length <= 64 && result.events.length <= 192);
  const derivedSourceFiles = [], observations = [];
  for (const [index, span] of result.spans.entries()) {
    const extracted = result.extraction.spans[index], evidence = span.intersection.report.rootEvidence;
    assert.equal(span.spanIndex, index);
    assert.equal(span.spanId, options.resultIdPrefix + '_span_' + index);
    assert.deepEqual(span.curve, extracted.bezier);
    assert.deepEqual(span.domain, extracted.domain);
    assert.deepEqual(curveDomain(span.curve), span.domain);
    assert.equal(span.curve.degree, 3);
    assert.equal(span.curve.controlPoints.length, 4);
    assert.deepEqual(span.intersection.curve, span.curve);
    assert.deepEqual(span.intersection.plane, surface);
    assert.deepEqual(validateCubicBezierCurveAffinePlaneIntersection(span.intersection), span.intersection.report);
    assert.equal(span.sourceVersion, 0);
    assert.ok(evidence.scalarEvaluationCount <= 1024 && evidence.derivativeRoots.length <= 2 && evidence.roots.length <= 3);
    assert.ok([...evidence.derivativeRootSteps, ...evidence.cubicRootSteps].every(steps => steps <= 64));
    derivedSourceFiles.push(sourceFile(name + '.analytic_span_' + index, extracted.nativeSpanSource, extracted.nativeSpanModel));
    derivedSourceFiles.push(sourceFile(name + '.cubic_span_' + index, span.source, span.model));
    for (const parameter of [span.domain[0], span.domain[0] + (span.domain[1] - span.domain[0]) / 2, span.domain[1]]) {
      const originalPointMM = evaluateCurve(input, parameter), localPointMM = evaluateCurve(span.curve, parameter);
      close(originalPointMM, localPointMM);
      const originalD1 = d1(input, parameter), localD1 = d1(span.curve, parameter);
      if (originalD1.status === 'evaluated' && localD1.status === 'evaluated') {
        close(originalD1.value.derivative, localD1.value.derivative,
          1e-7 * Math.max(1, Math.hypot(...originalD1.value.derivative)));
      }
      observations.push({spanIndex: index, parameter, originalPointMM, localPointMM, originalD1, localD1,
        derivativeSearchStatus: evidence.derivativeSearchStatus});
    }
  }
  for (const event of result.events) checkEvent(input, surface, result, event);
  checkReport(input, surface, result);
  assert.deepEqual(validate(result), result.report);
  const resultFile = resolve(output, name + '.owned-native-result.json');
  writeFileSync(resultFile, nativeJSON(result) + '\n');
  const reopened = JSON.parse(readFileSync(resultFile, 'utf8'));
  assert.deepEqual(reopened, result);
  assert.deepEqual(validate(reopened), result.report);
  assert.deepEqual(validateCurveBezierSpans(reopened.extraction), result.extraction.report);
  for (const span of reopened.spans) validateCubicBezierCurveAffinePlaneIntersection(span.intersection);
  write(name + '.native-observations.json', observations);
  summaries.push({name, kind: result.kind, originalPoles: input.controlPoints.length, originalKnots: input.knots.length,
    spans: result.spans.length, primitives: result.report.primitiveCallCount, scalarEvaluations: result.report.cubicScalarEvaluationCount,
    events: result.events.length, contributions: result.report.contributionCount, finiteEvents: result.report.finiteEventCount,
    derivativeSearchCounts: result.report.derivativeSearchCounts, originalSourceFile, derivedSourceFiles, resultFile});
  return result;
}

write('source-api.metafile.json', built.metafile);
write('source-api.inputs.json', {entry, mode: 'in-memory-esbuild', write: false,
  cadInputs, allInputs: sourceInputs, esbuildVersion: esbuild.version});
const coldModel = compileSource(readFileSync(copiedInputFile, 'utf8'));
assert.equal(coldModel.objects.length, 1);
const original = coldModel.objects[0];
assert.equal(original.kind, 'curve');
assert.equal(original.degree, 3);
assert.equal(original.controlPoints.length, 64);
assert.equal(original.knots.length, 68);
let actualSpanCount = 0;
for (let k = original.degree; k < original.controlPoints.length; k++) if (original.knots[k] < original.knots[k + 1]) actualSpanCount++;
assert.equal(actualSpanCount, 37);
const originalBefore = structuredClone(original);
const knownParameter = 1.25, knownPoint = evaluateCurve(original, knownParameter);
const crossingPlane = plane('original_cross_plane', [knownPoint[0], -1, -1], [0, 2, 0], [0, .5, 6], [-2, 5], [3, 7]);
const crossing = check('original_cross', original, crossingPlane);
assert.equal(crossing.kind, 'isolated');
assert.equal(crossing.events.length, 1);
assert.equal(crossing.spans.length, 37);
assert.ok(Math.abs(crossing.events[0].parameter - knownParameter) <= 2e-11);
close(crossing.events[0].pointMM, knownPoint);
assert.ok(crossing.report.derivativeSearchCounts.notRequiredStrictCubicSignExclusion > 0);
const crossingBefore = structuredClone(crossing);
const originalOutputFile = resolve(output, 'original_cross.original.source0.css');
const originalOutputBytes = readFileSync(originalOutputFile);
write('actual-source64.json', {inputFile, copiedInputFile, inputSha256: hash(inputBytes), sourceVersion: 0,
  poles: original.controlPoints.length, knots: original.knots.length, spans: actualSpanCount, knownParameter, knownPoint});

const sharedParameter = 2.5, sharedPoint = evaluateCurve(original, sharedParameter);
assert.equal(sharedPoint[0], 3.5);
assert.ok(original.weights.every(weight => weight === 1));
const sharedPlane = plane('shared_knot_plane', [3.5, -1, -1], [0, 2, 0], [0, .5, 6]);
const shared = check('shared_knot', original, sharedPlane);
assert.equal(shared.events.length, 1);
const sharedEvent = shared.events[0];
assert.equal(sharedEvent.parameter, sharedParameter);
assert.equal(sharedEvent.kind, 'knot-event');
assert.equal(sharedEvent.contributions.length, 2);
assert.equal(sharedEvent.originalCurveD1.status, 'native-refused');
assert.ok(sharedEvent.contributions.every(contribution => contribution.childCurveD1.status === 'evaluated'));
assert.equal(sharedEvent.sideObservations.length, 2);

const outsidePlane = plane('outside_plane', [knownPoint[0], 1, 1], [0, .25, 0], [0, .125, .25]);
const outside = check('outside_rectangle', original, outsidePlane);
assert.equal(outside.kind, 'finite-disjoint');
assert.equal(outside.events.length, 1);
assert.equal(outside.report.finiteEventCount, 0);

const weightedModel = compileSource(weightedInputBytes.toString('utf8'));
const weighted = weightedModel.objects.find(object => object.kind === 'curve');
const weightedPlane = weightedModel.objects.find(object => object.kind === 'surface');
assert.ok(weighted && weightedPlane);
assert.equal(weighted.controlPoints.length, 4);
assert.deepEqual(weighted.weights, [1, 2, 2, 1]);
const weightedResult = check('weighted_three', weighted, weightedPlane);
assert.equal(weightedResult.events.length, 3);
assert.equal(weightedResult.spans.length, 1);
assert.deepEqual(weightedResult.spans[0].intersection.report.rootEvidence.originalCoefficients, [-.125, .5, -.5, .125]);
const expectedRoots = [(1 - 3 / Math.sqrt(13)) / 2, .5, (1 + 3 / Math.sqrt(13)) / 2];
for (const [index, event] of weightedResult.events.entries()) {
  assert.ok(Math.abs(event.parameter - (-3 + 10 * expectedRoots[index])) <= 2e-11);
}

// Edit one actual source pole in a separate file. Keep every authored ID and other coefficient.
const editedPole = structuredClone(original.controlPoints[5]);
editedPole[1] += .125;
const oldToken = nativeJSON(original.controlPoints[5]), newToken = nativeJSON(editedPole);
assert.equal(inputSource.indexOf(oldToken), inputSource.lastIndexOf(oldToken));
assert.ok(inputSource.includes(oldToken));
const editedSource = inputSource.replace(oldToken, newToken);
assert.notEqual(editedSource, inputSource);
const editedInputFile = resolve(output, 'same_id_edit.input.source0.css');
writeFileSync(editedInputFile, editedSource);
const editedModel = compileSource(readFileSync(editedInputFile, 'utf8')), editedCurve = editedModel.objects[0];
assert.equal(editedCurve.id, original.id);
assert.deepEqual(editedCurve.knots, original.knots);
assert.deepEqual(editedCurve.weights, original.weights);
const expectedEdited = structuredClone(original);
expectedEdited.controlPoints[5] = editedPole;
assert.deepEqual(editedCurve, expectedEdited);
const edited = check('same_id_edit', editedCurve, crossingPlane);
assert.equal(edited.events.length, 1);
assert.notDeepEqual(edited.events[0].pointMM, crossing.events[0].pointMM);
assert.deepEqual(original, originalBefore);
assert.deepEqual(crossing, crossingBefore);
assert.deepEqual(readFileSync(inputFile), inputBytes);
assert.deepEqual(readFileSync(copiedInputFile), inputBytes);
assert.deepEqual(readFileSync(originalOutputFile), originalOutputBytes);

function reject(name, action, code) {
  assert.throws(action, error => {
    assert.ok(error instanceof WideCubicCurveAffinePlaneIntersectionError);
    assert.equal(error.name, 'WideCubicCurveAffinePlaneIntersectionError');
    assert.ok(error.message.startsWith('Wide cubic Curve-plane intersection: '));
    assert.equal(error.code, code);
    failures.push({name, code: error.code, message: error.message, actualCausePreserved: Object.hasOwn(error, 'cause')});
    assert.deepEqual(original, originalBefore);
    assert.deepEqual(crossing, crossingBefore);
    assert.deepEqual(readFileSync(inputFile), inputBytes);
    assert.deepEqual(readFileSync(copiedInputFile), inputBytes);
    assert.deepEqual(readFileSync(weightedInputFile), weightedInputBytes);
    assert.deepEqual(readFileSync(originalOutputFile), originalOutputBytes);
    return true;
  });
}

const quadratic = {kind: 'curve', id: 'unsupported_quadratic', degree: 2, knots: [0, 0, 0, 1, 1, 1],
  controlPoints: [[-1, 0, 1], [0, 1, -1], [1, 0, 1]], weights: [1, 1, 1]};
reject('degree2_profile', () => intersect(quadratic, weightedPlane, optionsFor('guard')), 'INPUT');
reject('event_capacity', () => intersect(weighted, weightedPlane, optionsFor('guard', 2)), 'BUDGET');
reject('all65_extraction_roles_reserved', () => intersect({...weighted, id: 'guard_span_63'},
  weightedPlane, optionsFor('guard')), 'IDENTITY');
let getterCalls = 0;
const getter = structuredClone(original);
Object.defineProperty(getter, 'weights', {
  enumerable: true, get() { getterCalls++; return original.weights; },
});
reject('input_getter', () => intersect(getter, crossingPlane, optionsFor('guard')), 'INPUT');
assert.equal(getterCalls, 0);
for (const [name, alter] of [
  ['native', result => result.curve.controlPoints[0][1] += .125],
  ['span', result => result.spans[0].curve.controlPoints[1][1] += .125],
  ['uv', result => result.events[0].planeUV[0] += .01],
  ['source', result => result.source += ' '],
  ['scalar', result => result.spans[0].intersection.report.rootEvidence.normalizedCoefficients[0] += .01],
]) {
  const changed = structuredClone(crossing);
  alter(changed);
  reject('owned_' + name + '_tamper', () => validate(changed), 'OWNED');
}
assert.deepEqual(validate(crossing), crossing.report);

// One complete old #640 witness protects the internal structural type change.
const immutableParentRuntimePath = '/Users/user/.codex/worktrees/issue-781-cad/barocss/packages/barocss-cad/dist/index.js';
assert.ok(existsSync(immutableParentRuntimePath));
const parentAPI = await import(pathToFileURL(immutableParentRuntimePath).href);
const oldCurve = {kind: 'curve', id: 'old640_curve', degree: 2, knots: [2, 2, 2, 3, 5, 7, 7, 7],
  controlPoints: [[-2, -0, 1], [-1, 1, -2], [1, 0, 1], [2, -1, -1], [3, 0, 2]], weights: [1, .75, 2, 1.5, 1]};
const oldPlane = plane('old640_plane', [-4, -8, 0], [12, 0, 0], [2, 12, 0]);
const oldOptions = {evaluationId: 'old640_eval', derivedSpanIds: ['old640_span_0', 'old640_span_1', 'old640_span_2'],
  pointEventIds: Array.from({length: 16}, (_, index) => 'old640_event_' + index)};
const immutableWitness = parentAPI.intersectCurveWithAffinePlaneSurface(oldCurve, oldPlane, oldOptions);
const currentWitness = intersectCurveWithAffinePlaneSurface(oldCurve, oldPlane, oldOptions);
assert.deepEqual(currentWitness, immutableWitness);
assert.deepEqual(validateCurveAffinePlaneIntersection(currentWitness), currentWitness.report);
writeFileSync(resolve(output, 'old640.exact-complete-result.json'), nativeJSON(currentWitness) + '\n');
write('old640.witness.json', {immutableParentRuntimePath, comparison: 'one exact complete old #640 result',
  spans: currentWitness.spans.length, events: currentWitness.events.length});

// Actual manifest-declared compiled JS and all eight public names are separate.
const packageRoot = resolve(repo, 'packages/barocss-cad');
const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath));
assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const runtimeExports = ['intersectCubicCurveWideWithAffinePlaneSurface', 'validateWideCubicCurveAffinePlaneIntersection',
  'WideCubicCurveAffinePlaneIntersectionError', 'WideCubicCurveAffinePlaneIntersectionDiagnosticCode'];
for (const name of runtimeExports) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.WideCubicCurveAffinePlaneIntersectionDiagnosticCode, WideCubicCurveAffinePlaneIntersectionDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./nurbs/source-wide/curve-wide-cubic-plane-intersection.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/nurbs/source-wide/curve-wide-cubic-plane-intersection.d.ts');
const leafDeclaration = readFileSync(leafDeclarationPath, 'utf8');
const declarationExports = [...runtimeExports, 'WideCubicCurveAffinePlaneIntersectionOptions', 'WideCubicCurveAffinePlaneSpan',
  'WideCubicCurveAffinePlaneIntersectionReport', 'WideCubicCurveAffinePlaneIntersectionResult'];
for (const name of declarationExports) {
  assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(leafDeclaration), name);
}
assert.ok(leafDeclaration.includes('export type WideCubicCurveAffinePlaneIntersectionDiagnosticCode'));
const compiledOriginal = publicAPI.compileCadModel(readFileSync(inputFile, 'utf8'), {sourceVersion: 0});
assert.equal(compiledOriginal.ok, true);
const compiled = publicAPI.intersectCubicCurveWideWithAffinePlaneSurface(compiledOriginal.model.objects[0], crossingPlane, crossing.options);
assert.deepEqual(compiled, crossing);
assert.deepEqual(publicAPI.validateWideCubicCurveAffinePlaneIntersection(compiled), crossing.report);
publicAPI.validateCurveBezierSpans(compiled.extraction);
for (const span of compiled.spans) publicAPI.validateCubicBezierCurveAffinePlaneIntersection(span.intersection);
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeExports, declarationExports,
  originalPoles: compiled.curve.controlPoints.length, originalKnots: compiled.curve.knots.length,
  spans: compiled.spans.length, events: compiled.events.length,
  declarationCheck: 'actual exported declaration text; no separate TypeScript invocation'};
write('compiled-consumer.json', compiledConsumer);
write('summary.json', {sourceMode: true, cadSourceInputCount: cadInputs.length, inputFile, copiedInputFile,
  inputSha256: hash(inputBytes), weightedInputFile, weightedInputSha256: hash(weightedInputBytes), editedInputFile,
  summaries, failures, compiledConsumer, immutableParentRuntimePath, exactOld640CompleteResultMatch: true,
  scope: 'Actual saved64-pole native cubic source, actual analytic spans and bounded cubic primitives through the same wide entry. Full-original parameter/point/UV binding, exact shared-knot consolidation and separate C0/local D1 states retain scalar work evidence and atomic refusal. No global refinement, fitted geometry, projection, sewn topology, global binary64/manufacturing certificate, parent or reader campaign, renderer or Loader adoption.'});
console.log(JSON.stringify({sourceMode: true, cadSourceInputCount: cadInputs.length,
  inputFile, summaries, failures, compiledConsumer, immutableParentRuntimePath}));
