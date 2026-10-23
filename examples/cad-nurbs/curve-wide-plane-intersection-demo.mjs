import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.filter(arg => arg === '--source').length, 1,
  'Usage: node curve-wide-plane-intersection-demo.mjs --source [output-directory]');
const destinations = args.filter(arg => arg !== '--source');
assert.ok(destinations.length <= 1);
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const output = resolve(destinations[0] ?? '/tmp/barocss-curve-wide-plane-intersection-prototype');
mkdirSync(output, {recursive: true});

// This graph uses current source only. Compiled consumers are loaded separately below.
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
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/nurbs/source-wide/curve-wide-plane-intersection.ts')));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' +
  Buffer.from(built.outputFiles[0].text).toString('base64'));
const {
  intersectCurveWideWithAffinePlaneSurface: intersect,
  validateWideCurveAffinePlaneIntersection: validate,
  WideCurveAffinePlaneIntersectionError, WideCurveAffinePlaneIntersectionDiagnosticCode,
  validateCurveBezierSpans, validateBezierCurveAffinePlaneIntersection,
  intersectCurveWithAffinePlaneSurface, validateCurveAffinePlaneIntersection,
  buildXYArc, joinCurves, refineCurveWide, editCurveControlPolygon,
  evaluateCurve, evaluateCurveD1, evaluateSurface, curveDomain, surfaceDomain, compileCadModel,
} = api;
assert.equal(typeof intersect, 'function');
assert.equal(typeof validate, 'function');
assert.equal(typeof WideCurveAffinePlaneIntersectionError, 'function');
assert.deepEqual(Object.keys(WideCurveAffinePlaneIntersectionDiagnosticCode).sort(),
  ['INPUT', 'IDENTITY', 'SPAN', 'REPRESENTABILITY', 'BUDGET', 'NATIVE', 'BINDING', 'OWNED'].sort());

const summaries = [], failures = [];
const write = (name, value) => writeFileSync(resolve(output, name), JSON.stringify(value, null, 2) + '\n');
const curve = (id, degree, knots, controlPoints, weights) =>
  ({kind: 'curve', id, degree, knots, controlPoints, weights});
const difference = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
const close = (a, b, tolerance = 1e-7) => assert.ok(difference(a, b) <= tolerance);
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const optionsFor = (name, count = 128) => ({evaluationId: name + '_eval', resultIdPrefix: name,
  pointEventIds: Array.from({length: count}, (_, index) => name + '_event_' + index)});

function plane(id, origin, uAxis, vAxis, uDomain = [0, 1], vDomain = [0, 1]) {
  return {kind: 'surface', id, degreeU: 1, degreeV: 1,
    knotsU: [uDomain[0], uDomain[0], uDomain[1], uDomain[1]],
    knotsV: [vDomain[0], vDomain[0], vDomain[1], vDomain[1]],
    controlPoints: [[origin, origin.map((value, i) => value + vAxis[i])],
      [origin.map((value, i) => value + uAxis[i]), origin.map((value, i) => value + uAxis[i] + vAxis[i])]],
    weights: [[1, 1], [1, 1]]};
}

// Preserve numeric -0 in the original and every owned native result.
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

function sourceFile(name, source, model) {
  const file = resolve(output, name + '.source0.css');
  writeFileSync(file, source);
  const compiled = compileCadModel(readFileSync(file, 'utf8'), {sourceVersion: 0});
  assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
  assert.deepEqual(compiled.model, model);
  return file;
}

function checkEvent(input, surface, result, event) {
  assert.ok(result.options.pointEventIds.includes(event.eventId));
  assert.deepEqual(event.pointMM, evaluateCurve(input, event.parameter));
  assert.deepEqual(event.originalCurveD1, d1(input, event.parameter));
  assert.ok(event.contributions.length >= 1);
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
  for (const contribution of event.contributions) {
    const span = result.spans[contribution.spanIndex];
    assert.equal(contribution.spanId, span.spanId);
    assert.deepEqual(contribution.event, span.intersection.events.find(child => child.parameter === event.parameter));
    assert.deepEqual(contribution.childPointMM, evaluateCurve(span.curve, event.parameter));
    assert.deepEqual(contribution.originalPointMM, event.pointMM);
    assert.equal(contribution.pointDifferenceMM, difference(contribution.childPointMM, event.pointMM));
    assert.deepEqual(contribution.childCurveD1, d1(span.curve, event.parameter));
    assert.deepEqual(contribution.originalCurveD1, event.originalCurveD1);
    const child = contribution.event;
    assert.ok(child.bracket[0] <= child.parameter && child.parameter <= child.bracket[1]);
    assert.ok(child.bracket[1] - child.bracket[0] <= 1e-12);
    assert.ok(child.iterations <= 64);
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
      side.pointMM.map((value, index) => value - axes.originMM[index])));
  }
}

function checkReport(input, surface, result) {
  const report = result.report;
  assert.equal(report.family, 'own-wide-multispan-curve-affine-plane-surface');
  assert.deepEqual(report.dto, {schema: 'barocss-native-wide-curve-plane-intersection', version: 0,
    lengthUnit: 'mm', frame: 'authored-xyz-no-axis-conversion', representation: 'native-curve-plane-events-not-sewn-topology'});
  assert.equal(report.kind, result.kind);
  assert.equal(report.evaluationId, result.options.evaluationId);
  assert.equal(report.curveId, input.id);
  assert.equal(report.planeId, surface.id);
  assert.deepEqual(report.curveDomain, curveDomain(input));
  assert.equal(report.curveDegree, input.degree);
  assert.equal(report.spanCount, result.spans.length);
  assert.equal(report.contributionCount, result.events.reduce((sum, event) => sum + event.contributions.length, 0));
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
    parameter > domain[0] && parameter < domain[1] && input.knots.filter(knot => knot === parameter).length >= input.degree));
  assert.ok(report.privateIdAllocationAttempts >= 3 * result.spans.length && report.privateIdAllocationAttempts <= 512);
  assert.equal(report.authority, 'original-complete-curve-coefficients');
  assert.equal(report.geometricValidity, 'not-certified');
  assert.equal(report.topologyCertified, false);
  assert.equal(report.solid, false);
  assert.deepEqual(report.inputProfile, {degreeRange: [1, 2], poleRange: [2, 64], maximumKnots: 70,
    maximumNonzeroSpans: 64, weightRange: [1e-6, 1e6], coordinateAbsMM: 10000, clamped: true, nonperiodic: true,
    planeDegree: [1, 1], planeControlGrid: [2, 2], planeEqualWeights: true, planeAffine: true});
  assert.deepEqual(report.numericPolicy, {parameterWidthTarget: 1e-12, maximumRootSteps: 64,
    pointBindingComparisonMM: 1e-7, exactParameterDedupOnly: true,
    sideSampling: 'represented-midpoint-between-event-and-nearest-span-root-or-boundary',
    uvBoundaryPolicy: 'original-estimate-and-bracket-domain-agreement-no-clamp'});
  assert.deepEqual(report.quality, {extraction: 'actual-public-native-bezier-span-extraction',
    primitive: 'actual-public-bezier-curve-affine-plane-intersection', assembly: 'shared-whole-original-curve-event-uv-bracket-assembly',
    globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false, coincidenceClippingCertified: false,
    ownership: 'copied-cpu-data-gc-no-renderer-resources'});
  assert.equal(report.budgetFailure, 'atomic-refusal-no-partial-result');
  assert.deepEqual(report.limits, {maximumOriginalPoles: 64, maximumOriginalKnots: 70, maximumSpans: 64,
    maximumLocalBezierPoles: 3, maximumContributions: 128, maximumEvents: 128, maximumRootSteps: 64,
    maximumPrivateIdAllocationAttempts: 512, reservedExtractionRoleIds: 65, inputValues: 32768, inputDepth: 8,
    inputArrayElements: 128, inputRecordFields: 16, inputStringCharacters: 128,
    snapshotValues: 1048576, snapshotDepth: 40, arrayElements: 4096, recordFields: 64,
    sourceStringCharacters: 262144, authoredIdCharacters: 48, resultIdPrefixCharacters: 20});
}

function check(name, input, surface, options = optionsFor(name)) {
  const before = [structuredClone(input), structuredClone(surface), structuredClone(options)];
  const result = intersect(input, surface, options);
  assert.deepEqual([input, surface, options], before);
  assert.deepEqual(Object.keys(result).sort(), ['kind', 'curve', 'plane', 'options', 'source', 'sourceVersion',
    'model', 'extraction', 'spans', 'events', 'report'].sort());
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
  assert.ok(result.spans.length <= 64 && result.events.length <= 128);
  const observations = [], derivedSourceFiles = [];
  for (const [index, span] of result.spans.entries()) {
    const extracted = result.extraction.spans[index];
    assert.equal(span.spanIndex, index);
    assert.equal(span.spanId, options.resultIdPrefix + '_span_' + index);
    assert.deepEqual(span.curve, extracted.bezier);
    assert.deepEqual(span.domain, extracted.domain);
    assert.deepEqual(curveDomain(span.curve), span.domain);
    assert.equal(span.curve.controlPoints.length, input.degree + 1);
    assert.ok(span.curve.controlPoints.length <= 3);
    assert.deepEqual(span.intersection.curve, span.curve);
    assert.deepEqual(span.intersection.plane, surface);
    assert.deepEqual(validateBezierCurveAffinePlaneIntersection(span.intersection), span.intersection.report);
    assert.equal(span.sourceVersion, 0);
    derivedSourceFiles.push(sourceFile(name + '.analytic_span_' + index, extracted.nativeSpanSource, extracted.nativeSpanModel));
    derivedSourceFiles.push(sourceFile(name + '.intersection_span_' + index, span.source, span.model));
    for (const parameter of [span.domain[0], span.domain[0] + (span.domain[1] - span.domain[0]) / 2, span.domain[1]]) {
      const originalPointMM = evaluateCurve(input, parameter), localPointMM = evaluateCurve(span.curve, parameter);
      close(originalPointMM, localPointMM);
      const originalD1 = d1(input, parameter), localD1 = d1(span.curve, parameter);
      if (originalD1.status === 'evaluated' && localD1.status === 'evaluated') {
        close(originalD1.value.derivative, localD1.value.derivative,
          1e-7 * Math.max(1, Math.hypot(...originalD1.value.derivative)));
      }
      observations.push({spanIndex: index, parameter, originalPointMM, localPointMM, originalD1, localD1});
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
  for (const span of reopened.spans) validateBezierCurveAffinePlaneIntersection(span.intersection);
  write(name + '.native-observations.json', observations);
  summaries.push({name, originalPoles: input.controlPoints.length, originalKnots: input.knots.length,
    kind: result.kind, spans: result.spans.length, events: result.events.length,
    contributions: result.report.contributionCount, finiteEvents: result.report.finiteEventCount,
    originalSourceFile, derivedSourceFiles, resultFile});
  return result;
}

write('source-api.metafile.json', built.metafile);
write('source-api.inputs.json', {entry, mode: 'in-memory-esbuild', write: false,
  cadInputs, allInputs: sourceInputs, esbuildVersion: esbuild.version});

// Two actual native circle Curves join to17 poles; fourteen native insertions produce31.
const left = buildXYArc({kind: 'circle', id: 'circle_left', center: [2, -3], radius: 4});
const right = buildXYArc({kind: 'circle', id: 'circle_right', center: [2, -3], radius: 4});
const parentsBefore = [structuredClone(left), structuredClone(right)];
const joined = joinCurves(left.curve, right.curve, {curveId: 'joined_arc_17'});
assert.equal(joined.curve.controlPoints.length, 17);
const requests = [.25, .5, .75, 1.25, 1.5, 1.75, 2.5, 4.25, 4.5, 4.75, 5.25, 5.5, 5.75, 6.5]
  .map(parameter => ({parameter, count: 1}));
const refined = refineCurveWide(joined.curve,
  {curveId: 'joined_arc_31', insertions: requests, resultIdPrefix: 'wide_construct'});
assert.equal(refined.curve.degree, 2);
assert.equal(refined.curve.controlPoints.length, 31);
assert.equal(refined.curve.knots.length, 34);
assert.deepEqual(curveDomain(refined.curve), [0, 8]);
assert.deepEqual([left, right], parentsBefore);
const refinedBefore = structuredClone(refined);
sourceFile('construction.joined17', joined.source, joined.model);
sourceFile('construction.refined31', refined.source, refined.model);

const tilted = plane('tilted_skew_plane', [-0, -12, 3], [0, 18, 0], [6, 2, -6], [-2, 5], [3, 7]);
const horizontal = plane('horizontal_plane', [-4, -8, 0], [12, 0, 0], [2, 12, 0]);
const wide = check('wide_tilt', refined.curve, tilted);
assert.equal(wide.spans.length, 22);
assert.equal(wide.events.length, 4);
assert.equal(wide.kind, 'isolated');
assert.equal(wide.report.finiteEventCount, 4);
assert.deepEqual(wide.report.planeAxes.domains, surfaceDomain(tilted));
const wideBefore = structuredClone(wide);
const originalFile = resolve(output, 'wide_tilt.original.source0.css');
const originalBytes = readFileSync(originalFile);

const knotPlane = plane('knot_plane', [-3, -3, -3], [10, 0, 0], [0, 0, 6]);
const seam = check('wide_seam', refined.curve, knotPlane);
assert.equal(seam.events.length, 5);
const start = seam.events.find(event => event.parameter === 0), end = seam.events.find(event => event.parameter === 8);
assert.ok(start && end);
assert.notEqual(start.eventId, end.eventId);
close(start.pointMM, end.pointMM);
for (const parameter of [2, 4, 6]) {
  const event = seam.events.find(event => event.parameter === parameter);
  assert.ok(event);
  assert.equal(event.kind, 'knot-event');
  assert.equal(event.contributions.length, 2);
  assert.equal(event.originalCurveD1.status, 'native-refused');
  assert.ok(event.contributions.every(contribution => contribution.childCurveD1.status === 'evaluated'));
  assert.equal(event.sideObservations.length, 2);
}

const smallPlane = plane('small_tilted_plane', [2.5, -3.5, .5], [0, 1, 0], [1, .25, -1]);
const outside = check('wide_outside', refined.curve, smallPlane);
assert.equal(outside.events.length, 4);
assert.equal(outside.kind, 'finite-disjoint');
assert.equal(outside.report.finiteEventCount, 0);

const weighted = curve('weighted_multispan', 2, [2, 2, 2, 3, 5, 7, 7, 7],
  [[-2, -0, 1], [-1, 1, -2], [1, 0, 1], [2, -1, -1], [3, 0, 2]], [1, .75, 2, 1.5, 1]);
const weightedBefore = structuredClone(weighted);
const weightedResult = check('weighted', weighted, horizontal);
assert.ok(weightedResult.events.length > 0);
const edit = editCurveControlPolygon(weighted, {poleEdits: [{index: 2, zMM: .75}]});
assert.equal(edit.curve.id, weighted.id);
const editBefore = structuredClone(edit);
check('weighted_edit', edit.curve, horizontal);
assert.deepEqual(weighted, weightedBefore);
assert.deepEqual(edit, editBefore);
assert.deepEqual(wide, wideBefore);
assert.deepEqual(refined, refinedBefore);

const coincident = curve('mixed_coincident', 1, [-2, -2, 0, 2, 4, 4],
  [[-1, 0, 0], [1, 0, 0], [20, 0, 0], [21, 0, 1]], [1, 2, .75, 1]);
const support = check('mixed_support', coincident, horizontal);
assert.equal(support.kind, 'mixed');
assert.deepEqual(support.report.coincidentSpans.map(span => span.finiteContainment),
  ['control-hull-contained', 'finite-containment-not-proven']);

function reject(name, action, code) {
  assert.throws(action, error => {
    assert.ok(error instanceof WideCurveAffinePlaneIntersectionError);
    assert.equal(error.name, 'WideCurveAffinePlaneIntersectionError');
    assert.ok(error.message.startsWith('Wide Curve-plane intersection: '));
    assert.equal(error.code, code);
    if (name === 'ambiguous_tangent') {
      assert.ok(error.cause instanceof Error);
      assert.ok(error.cause.message.includes('unresolved interior tangent/discriminant ambiguity'));
    }
    failures.push({name, code: error.code, message: error.message, actualCausePreserved: Object.hasOwn(error, 'cause')});
    assert.deepEqual(wide, wideBefore);
    assert.deepEqual(weighted, weightedBefore);
    assert.deepEqual(refined, refinedBefore);
    assert.deepEqual(edit, editBefore);
    assert.deepEqual(readFileSync(originalFile), originalBytes);
    return true;
  });
}

const ambiguous = curve('ambiguous_curve', 2, [0, 0, 0, 1, 1, 1],
  [[-1, 0, .25], [0, 1, -.25], [1, 0, .25]], [1, 1, 1]);
reject('ambiguous_tangent', () => intersect(ambiguous, horizontal, optionsFor('ambiguous')), 'REPRESENTABILITY');
const cubic = curve('unsupported_cubic', 3, [0, 0, 0, 0, 1, 1, 1, 1],
  [[0, 0, 1], [1, 0, -1], [2, 0, 1], [3, 0, -1]], [1, 1, 1, 1]);
reject('degree3_profile', () => intersect(cubic, horizontal, optionsFor('guard')), 'INPUT');
const overCapacity = curve('over_capacity', 1,
  [0, 0, ...Array.from({length: 63}, (_, index) => index + 1), 64, 64],
  Array.from({length: 65}, (_, index) => [index, 0, 1]), Array(65).fill(1));
reject('65_pole_capacity', () => intersect(overCapacity, horizontal, optionsFor('guard')), 'INPUT');
reject('consolidated_event_budget', () => intersect(refined.curve, tilted, optionsFor('guard', 1)), 'BUDGET');
reject('all65_extraction_roles_reserved', () => intersect({...weighted, id: 'guard_span_63'},
  horizontal, optionsFor('guard')), 'IDENTITY');
let getterCalls = 0;
const getter = structuredClone(weighted);
Object.defineProperty(getter, 'weights', {
  enumerable: true, get() { getterCalls++; return weighted.weights; },
});
reject('input_getter', () => intersect(getter, horizontal, optionsFor('guard')), 'INPUT');
assert.equal(getterCalls, 0);
const nativeTamper = structuredClone(wide);
nativeTamper.curve.controlPoints[0][0] += .1;
reject('owned_native_curve_tamper', () => validate(nativeTamper), 'OWNED');
const spanTamper = structuredClone(wide);
spanTamper.spans[0].curve.controlPoints[1][0] += .1;
reject('owned_span_tamper', () => validate(spanTamper), 'OWNED');
const sourceTamper = structuredClone(wide);
sourceTamper.source += ' ';
reject('owned_source_tamper', () => validate(sourceTamper), 'OWNED');
const uvTamper = structuredClone(wide);
uvTamper.events[0].planeUV[0] += .01;
reject('owned_uv_tamper', () => validate(uvTamper), 'OWNED');
assert.deepEqual(validate(wide), wide.report);

// One exact complete old #640 witness protects the shared assembly factor.
const immutableParentRuntimePath = '/Users/user/.codex/worktrees/issue-714-cad/barocss/packages/barocss-cad/dist/index.js';
assert.ok(existsSync(immutableParentRuntimePath));
const parentAPI = await import(pathToFileURL(immutableParentRuntimePath).href);
const legacyOptions = {evaluationId: 'old640_witness', derivedSpanIds: ['old640_span_0', 'old640_span_1', 'old640_span_2'],
  pointEventIds: Array.from({length: 16}, (_, index) => 'old640_event_' + index)};
const immutableWitness = parentAPI.intersectCurveWithAffinePlaneSurface(weighted, horizontal, legacyOptions);
const currentWitness = intersectCurveWithAffinePlaneSurface(weighted, horizontal, legacyOptions);
assert.deepEqual(currentWitness, immutableWitness);
assert.deepEqual(validateCurveAffinePlaneIntersection(currentWitness), currentWitness.report);
writeFileSync(resolve(output, 'old640.exact-complete-result.json'), nativeJSON(currentWitness) + '\n');
write('old640.witness.json', {immutableParentRuntimePath, comparison: 'one exact complete original #640 result',
  curveId: weighted.id, spanCount: currentWitness.spans.length, eventCount: currentWitness.events.length});

// Public compiled JS and declarations are separate from the source-only graph.
const packageRoot = resolve(repo, 'packages/barocss-cad');
const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import);
const declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath));
assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const runtimeExports = ['intersectCurveWideWithAffinePlaneSurface', 'validateWideCurveAffinePlaneIntersection',
  'WideCurveAffinePlaneIntersectionError', 'WideCurveAffinePlaneIntersectionDiagnosticCode'];
for (const name of runtimeExports) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.WideCurveAffinePlaneIntersectionDiagnosticCode, WideCurveAffinePlaneIntersectionDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./nurbs/source-wide/curve-wide-plane-intersection.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/nurbs/source-wide/curve-wide-plane-intersection.d.ts');
const leafDeclaration = readFileSync(leafDeclarationPath, 'utf8');
const declarationExports = [...runtimeExports, 'WideCurveAffinePlaneIntersectionOptions',
  'WideCurveAffinePlaneIntersectionReport', 'WideCurveAffinePlaneIntersectionResult'];
for (const name of declarationExports) {
  assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(leafDeclaration), name);
}
assert.ok(leafDeclaration.includes('export type WideCurveAffinePlaneIntersectionDiagnosticCode'));
const compiledWide = publicAPI.intersectCurveWideWithAffinePlaneSurface(refined.curve, tilted, wide.options);
assert.deepEqual(compiledWide, wide);
assert.deepEqual(publicAPI.validateWideCurveAffinePlaneIntersection(compiledWide), wide.report);
publicAPI.validateCurveBezierSpans(compiledWide.extraction);
for (const span of compiledWide.spans) publicAPI.validateBezierCurveAffinePlaneIntersection(span.intersection);
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeExports, declarationExports,
  originalPoles: compiledWide.curve.controlPoints.length, spans: compiledWide.spans.length,
  events: compiledWide.events.length, dtoVersion: compiledWide.report.dto.version,
  declarationCheck: 'actual exported declaration text; no separate TypeScript invocation'};
write('compiled-consumer.json', compiledConsumer);
write('summary.json', {sourceMode: true, cadSourceInputCount: cadInputs.length, summaries, failures,
  compiledConsumer, immutableParentRuntimePath, exactOld640CompleteResultMatch: true,
  scope: 'Actual native degree1/2 analytic spans and inherited Bezier Plane roots. Original Curve/Plane coefficients, parameter bits and source0 stay authoritative. Equal original parameters consolidate; distinct seam parameters remain distinct. Coincident intervals carry control-hull containment or unproved finite containment. No clipping, sewn topology, solid, manufacturing, mesh, fit, document migration, renderer or reader adoption.'});
console.log(JSON.stringify({sourceMode: true, cadSourceInputCount: cadInputs.length,
  summaries, failures, compiledConsumer, immutableParentRuntimePath}));
