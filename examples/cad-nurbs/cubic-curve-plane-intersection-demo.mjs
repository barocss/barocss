import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.filter(arg => arg === '--source').length, 1,
  'Usage: node cubic-curve-plane-intersection-demo.mjs --source [output-directory]');
const destinations = args.filter(arg => arg !== '--source');
assert.ok(destinations.length <= 1);
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const output = resolve(destinations[0] ?? '/tmp/barocss-cubic-curve-plane-intersection-prototype');
mkdirSync(output, {recursive: true});

// Current source is bundled in memory; both compiled consumers are separate.
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
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/own-cubic-curve-plane-intersection.ts')));
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/own-cubic-bernstein-roots.ts')));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' +
  Buffer.from(built.outputFiles[0].text).toString('base64'));
const {
  intersectCubicBezierCurveWithAffinePlaneSurface: intersect,
  validateCubicBezierCurveAffinePlaneIntersection: validate,
  CubicCurveAffinePlaneIntersectionError, CubicCurveAffinePlaneIntersectionDiagnosticCode,
  intersectBezierCurveWithAffinePlaneSurface, validateBezierCurveAffinePlaneIntersection,
  evaluateCurve, evaluateCurveD1, evaluateSurface, curveDomain, surfaceDomain,
  compileCadModel, editCurveControlPolygon,
} = api;
for (const operation of [intersect, validate, CubicCurveAffinePlaneIntersectionError]) assert.equal(typeof operation, 'function');
assert.deepEqual(Object.keys(CubicCurveAffinePlaneIntersectionDiagnosticCode).sort(),
  ['INPUT', 'IDENTITY', 'REPRESENTABILITY', 'BUDGET', 'NATIVE', 'BINDING', 'OWNED'].sort());

const summaries = [], failures = [];
const write = (name, value) => writeFileSync(resolve(output, name), JSON.stringify(value, null, 2) + '\n');
const curve = (id, degree, knots, controlPoints, weights) =>
  ({kind: 'curve', id, degree, knots, controlPoints, weights});
const difference = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
const close = (a, b) => assert.ok(difference(a, b) <= 1e-7);
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const optionsFor = (name, count = 3) => ({evaluationId: name + '_eval',
  pointEventIds: Array.from({length: count}, (_, index) => name + '_event_' + index)});

function plane(id, origin, uAxis, vAxis, uDomain = [0, 1], vDomain = [0, 1]) {
  return {kind: 'surface', id, degreeU: 1, degreeV: 1,
    knotsU: [uDomain[0], uDomain[0], uDomain[1], uDomain[1]],
    knotsV: [vDomain[0], vDomain[0], vDomain[1], vDomain[1]],
    controlPoints: [[origin, origin.map((value, i) => value + vAxis[i])],
      [origin.map((value, i) => value + uAxis[i]), origin.map((value, i) => value + uAxis[i] + vAxis[i])]],
    weights: [[1, 1], [1, 1]]};
}

// Keep original coefficients and global endpoint parameter -0 on owned JSON reopen.
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

function checkEvidence(input, result) {
  const evidence = result.report.rootEvidence, axes = result.report.planeAxes;
  const coefficients = input.controlPoints.map((point, index) =>
    dot(axes.unitNormal, point.map((value, axis) => value - axes.originMM[axis])) * input.weights[index]);
  assert.deepEqual(evidence.originalCoefficients, coefficients);
  assert.equal(evidence.maximumOriginalMagnitude, Math.max(...coefficients.map(Math.abs)));
  assert.equal(evidence.normalizationScale, evidence.maximumOriginalMagnitude === 0 ? 1 : evidence.maximumOriginalMagnitude);
  assert.deepEqual(evidence.normalizedCoefficients, coefficients.map(value => value / evidence.normalizationScale));
  assert.deepEqual(evidence.derivativeCoefficients, evidence.normalizedCoefficients.slice(0, 3)
    .map((value, index) => 3 * (evidence.normalizedCoefficients[index + 1] - value)));
  assert.deepEqual(evidence.derivativeEquation.bernstein, evidence.derivativeCoefficients);
  assert.ok(evidence.derivativeRoots.length <= 2);
  assert.ok(evidence.criticalBrackets.length <= 2);
  assert.ok(evidence.monotoneIntervals.length <= 3);
  assert.equal(evidence.scalarEvaluationCount, evidence.scalarEvaluations.length);
  assert.ok(evidence.scalarEvaluationCount <= 1024);
  assert.equal(evidence.roots.length, result.events.length);
  assert.ok(evidence.roots.length <= 3);
  assert.deepEqual(evidence.derivativeRootSteps, evidence.derivativeRoots.map(root => root.iterations));
  assert.deepEqual(evidence.cubicRootSteps, evidence.roots.map(root => root.iterations));
  assert.ok([...evidence.derivativeRootSteps, ...evidence.cubicRootSteps].every(steps => steps <= 64));
  const domain = curveDomain(input);
  assert.equal(evidence.parameterWidthTarget, Math.min(1e-12, 1e-12 / (domain[1] - domain[0])));
  assert.equal(evidence.coincident, coefficients.every(value => value === 0));
  assert.equal(evidence.arithmeticGuard, 64 * Number.EPSILON * Math.max(1, ...evidence.normalizedCoefficients.map(Math.abs)));
  if (evidence.coincident) {
    assert.equal(evidence.derivativeSearchStatus, 'not-required-coincident');
    assert.equal(evidence.controlHullExclusion, null);
  } else if (evidence.controlHullExclusion !== null) {
    assert.equal(evidence.derivativeSearchStatus, 'not-required-strict-cubic-sign-exclusion');
    const exclusion = evidence.controlHullExclusion;
    assert.equal(exclusion.policy, 'strict-normalized-cubic-bernstein-control-hull-beyond64-epsilon-guard');
    assert.equal(exclusion.arithmeticGuard, evidence.arithmeticGuard);
    assert.equal(exclusion.minimumMagnitude, Math.min(...evidence.normalizedCoefficients.map(Math.abs)));
    assert.ok(exclusion.minimumMagnitude > exclusion.arithmeticGuard);
    assert.ok(evidence.normalizedCoefficients.every(value => exclusion.sign === 'positive' ? value > 0 : value < 0));
    assert.equal(evidence.derivativeRoots.length, 0);
    assert.equal(evidence.roots.length, 0);
    assert.equal(evidence.scalarEvaluationCount, 0);
    assert.equal(evidence.criticalBrackets.length, 0);
    assert.equal(evidence.monotoneIntervals.length, 0);
  } else assert.equal(evidence.derivativeSearchStatus, 'executed');
  for (const evaluation of evidence.scalarEvaluations) {
    assert.ok(evaluation.parameter >= 0 && evaluation.parameter <= 1 && Number.isFinite(evaluation.value));
    assert.equal(evaluation.arithmeticGuard, evidence.arithmeticGuard);
  }
  for (const bracket of evidence.criticalBrackets) {
    const derivative = evidence.derivativeRoots[bracket.derivativeRootIndex];
    assert.deepEqual(bracket.bracket, derivative.bracket);
    assert.ok(bracket.bracket[0] <= bracket.center && bracket.center <= bracket.bracket[1]);
    assert.ok(Math.abs(bracket.centerValue) > bracket.totalMargin);
    assert.equal(Math.sign(bracket.centerValue), bracket.sign);
    assert.equal(Math.sign(bracket.leftValue), bracket.sign);
    assert.equal(Math.sign(bracket.rightValue), bracket.sign);
    const derivativeHullBound = Math.max(...evidence.derivativeCoefficients.map(Math.abs));
    assert.equal(bracket.lipschitzBound,
      derivativeHullBound + evidence.arithmeticGuard * Math.max(1, derivativeHullBound));
    assert.ok(bracket.lipschitzMargin >= 0 && bracket.arithmeticGuard > 0);
    assert.equal(bracket.totalMargin, bracket.lipschitzMargin + bracket.arithmeticGuard);
  }
  for (const interval of evidence.monotoneIntervals) {
    assert.ok(interval.domain[0] < interval.domain[1] && interval.domain[0] >= 0 && interval.domain[1] <= 1);
    assert.ok(['support-disjoint', 'endpoint-only', 'crossing'].includes(interval.status));
    assert.ok(interval.iterations <= 64 && interval.nearZeroQuarterSteps <= interval.iterations);
    if (interval.rootIndex !== null) assert.ok(interval.rootIndex >= 0 && interval.rootIndex < evidence.roots.length);
  }
}

function check(name, input, surface, options = optionsFor(name)) {
  const before = [structuredClone(input), structuredClone(surface), structuredClone(options)];
  const result = intersect(input, surface, options);
  assert.deepEqual([input, surface, options], before);
  assert.deepEqual(Object.keys(result).sort(),
    ['kind', 'curve', 'plane', 'options', 'source', 'sourceVersion', 'model', 'events', 'report'].sort());
  assert.deepEqual(result.curve, input);
  assert.deepEqual(result.plane, surface);
  assert.deepEqual(result.options, options);
  assert.equal(result.sourceVersion, 0);
  assert.equal(result.model.name, options.evaluationId);
  assert.deepEqual(result.model.objects, [input, surface]);
  const originalSourceFile = sourceFile(name, result.source, result.model);
  const report = result.report, axes = report.planeAxes;
  assert.equal(report.family, 'own-cubic-bezier-curve-affine-plane-surface');
  assert.deepEqual(report.dto, {schema: 'barocss-native-cubic-curve-plane-intersection', version: 0,
    lengthUnit: 'mm', frame: 'raw-authored-xyz-no-axis-conversion',
    representation: 'original-cubic-curve-plane-events-not-sewn-topology'});
  assert.equal(report.curveId, input.id);
  assert.equal(report.planeId, surface.id);
  assert.equal(report.evaluationId, options.evaluationId);
  assert.equal(report.kind, result.kind);
  assert.equal(report.curveDegree, 3);
  assert.deepEqual(report.curveDomain, curveDomain(input));
  assert.deepEqual(axes.domains, surfaceDomain(surface));
  assert.equal(report.supportEventCount, result.events.length);
  assert.equal(report.finiteEventCount, result.events.filter(event => event.finiteDomainAdmitted).length);
  assert.equal(report.outsideEventCount, result.events.filter(event => !event.finiteDomainAdmitted).length);
  assert.equal(report.numericPolicy.parameterWidthTarget, 1e-12);
  assert.equal(report.numericPolicy.maximumRootSteps, 64);
  assert.equal(report.numericPolicy.pointBindingComparisonMM, 1e-7);
  assert.equal(report.numericPolicy.exactParameterDedupOnly, true);
  assert.equal(report.numericPolicy.uvBoundaryPolicy, 'original-estimate-and-bracket-domain-agreement-no-clamp');
  assert.equal(report.numericPolicy.normalizedParameterWidthTarget, report.rootEvidence.parameterWidthTarget);
  assert.equal(report.numericPolicy.maximumScalarEvaluations, 1024);
  assert.equal(report.numericPolicy.criticalBracketPolicy, 'derivative-control-hull-lipschitz-plus64-epsilon-exclusion');
  assert.equal(report.numericPolicy.nearZeroMidpointPolicy, 'represented-quarter-points-with-safely-opposite-ordered-signs-or-refusal');
  assert.equal(report.numericPolicy.gramPolicy, '64-epsilon-scaled-determinant-refusal');
  assert.equal(report.authority, 'original-cubic-homogeneous-coefficients-and-original-native-geometry');
  assert.equal(report.geometricValidity, 'not-certified');
  assert.equal(report.topologyCertified, false);
  assert.equal(report.solid, false);
  assert.deepEqual(report.inputProfile, {curveDegree: 3, originalCurvePoles: 4, originalCurveKnots: 8, originalNonzeroSpans: 1,
    planeDegree: [1, 1], planeControlGrid: [2, 2], planeEqualWeights: true, coordinateAbsMM: 10000,
    weightRange: [1e-6, 1e6], positive: true, clamped: true, nonperiodic: true});
  assert.deepEqual(report.quality, {scalarScaleDerivedOnly: true, originalGeometryBitsPreserved: true,
    derivativeSolver: 'actual-existing-quadratic-bernstein-root-solver', simpleCrossingsOnlyInInterior: true,
    interiorTangentOrStationaryAmbiguity: 'atomic-refusal', localNumericalEvidenceOnly: true,
    globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false, coincidenceClippingCertified: false,
    ownership: 'copied-cpu-data-gc-no-renderer-resources'});
  assert.equal(report.budgetFailure, 'atomic-refusal-no-partial-result');
  assert.deepEqual(report.limits, {maximumEvents: 3, maximumDerivativeRoots: 2, maximumMonotoneIntervals: 3,
    maximumCriticalBrackets: 2, maximumRootSteps: 64, maximumScalarEvaluations: 1024,
    inputValues: 4096, inputDepth: 8, inputArrayElements: 64, inputRecordFields: 16, inputStringCharacters: 128,
    snapshotValues: 262144, snapshotDepth: 32, arrayElements: 4096, recordFields: 64,
    sourceStringCharacters: 262144, authoredIdCharacters: 48});
  checkEvidence(input, result);
  for (const [index, event] of result.events.entries()) {
    const root = report.rootEvidence.roots[index];
    assert.equal(event.eventId, options.pointEventIds[index]);
    assert.equal(event.normalizedParameter, root.t);
    assert.deepEqual(event.normalizedBracket, root.bracket);
    assert.equal(event.iterations, root.iterations);
    assert.ok(event.bracket[0] <= event.parameter && event.parameter <= event.bracket[1]);
    assert.ok(event.bracket[1] - event.bracket[0] <= 1e-12);
    assert.equal(event.rootTouch, false);
    assert.equal(event.kind, root.t === 0 || root.t === 1 ? 'endpoint' : 'crossing');
    assert.deepEqual(event.pointMM, evaluateCurve(input, event.parameter));
    assert.deepEqual(event.curveD1, d1(input, event.parameter));
    assert.equal(event.semantics, 'original-curve-point-at-numerical-root-not-projected-or-sewn');
    assert.equal(event.residualMM, Math.abs(dot(axes.unitNormal,
      event.pointMM.map((value, axis) => value - axes.originMM[axis]))));
    assert.ok(event.residualMM <= 1e-7);
    if (event.finiteDomainAdmitted) {
      assert.equal(event.classification, 'finite-domain-admitted');
      assert.deepEqual(event.planePointMM, evaluateSurface(surface, event.planeUV[0], event.planeUV[1]));
      close(event.pointMM, event.planePointMM);
    } else {
      assert.equal(event.classification, 'outside-domain');
      assert.equal(event.planePointMM, null);
    }
    for (const side of event.sideObservations) {
      const point = evaluateCurve(input, side.parameter);
      assert.equal(side.signedDistanceMM, dot(axes.unitNormal,
        point.map((value, axis) => value - axes.originMM[axis])));
    }
    if (index) {
      assert.ok(result.events[index - 1].parameter < event.parameter);
      assert.ok(result.events[index - 1].bracket[1] < event.bracket[0]);
    }
  }
  assert.deepEqual(validate(result), report);
  const resultFile = resolve(output, name + '.owned-native-result.json');
  writeFileSync(resultFile, nativeJSON(result) + '\n');
  const reopened = JSON.parse(readFileSync(resultFile, 'utf8'));
  assert.deepEqual(reopened, result);
  assert.deepEqual(validate(reopened), report);
  summaries.push({name, kind: result.kind, originalDomain: curveDomain(input), events: result.events.length,
    finiteEvents: report.finiteEventCount, scalarEvaluations: report.rootEvidence.scalarEvaluationCount,
    derivativeRoots: report.rootEvidence.derivativeRoots.length, originalSourceFile, resultFile});
  return result;
}

write('source-api.metafile.json', built.metafile);
write('source-api.inputs.json', {entry, mode: 'in-memory-esbuild', write: false,
  cadInputs, allInputs: sourceInputs, esbuildVersion: esbuild.version});

const original = curve('weighted_cubic', 3, [-3, -3, -3, -3, 7, 7, 7, 7],
  [[-2, -0, -.125], [-.5, 1, .25], [.5, 1, -.25], [2, -0, .125]], [1, 2, 2, 1]);
const horizontal = plane('moderate_skew_plane', [-3, -3, 0], [6, 0, 0], [1, 6, 0], [-2, 5], [3, 7]);
const three = check('three_crossings', original, horizontal);
assert.equal(three.kind, 'isolated');
assert.equal(three.events.length, 3);
assert.equal(three.report.finiteEventCount, 3);
assert.deepEqual(three.report.rootEvidence.originalCoefficients, [-.125, .5, -.5, .125]);
assert.deepEqual(three.curve.weights, [1, 2, 2, 1]);
const knownRoots = [(1 - 3 / Math.sqrt(13)) / 2, .5, (1 + 3 / Math.sqrt(13)) / 2];
const knownObservations = three.events.map((event, index) => {
  assert.ok(Math.abs(event.normalizedParameter - knownRoots[index]) <= 2e-12);
  assert.ok(Math.abs(event.parameter - (-3 + 10 * knownRoots[index])) <= 2e-11);
  return {knownNormalizedRoot: knownRoots[index], estimatedNormalizedRoot: event.normalizedParameter,
    originalParameter: event.parameter, normalizedBracket: event.normalizedBracket,
    originalPointMM: event.pointMM, originalPlaneUV: event.planeUV};
});
write('known-separated-root-observations.json', knownObservations);
const threeBefore = structuredClone(three), originalBefore = structuredClone(original);
const originalFile = resolve(output, 'three_crossings.source0.css'), originalBytes = readFileSync(originalFile);

const small = plane('small_skew_plane', [-.25, -.25, 0], [.5, 0, 0], [.125, .5, 0]);
const outside = check('outside_rectangle', original, small);
assert.equal(outside.kind, 'finite-disjoint');
assert.equal(outside.events.length, 3);
assert.equal(outside.report.finiteEventCount, 0);

// Strict positive control coefficients prove no support root despite a stationary derivative.
const positiveHeights = [.875, 1.125, .875, 1.125];
const positiveHull = {...structuredClone(original), id: 'positive_hull_cubic', weights: [1, 1, 1, 1],
  controlPoints: original.controlPoints.map((point, index) => [point[0], point[1], positiveHeights[index]])};
const disjoint = check('positive_hull', positiveHull, horizontal);
assert.equal(disjoint.kind, 'support-disjoint');
assert.equal(disjoint.events.length, 0);
assert.equal(disjoint.report.rootEvidence.derivativeSearchStatus, 'not-required-strict-cubic-sign-exclusion');
assert.equal(disjoint.report.rootEvidence.controlHullExclusion.sign, 'positive');

const endpointCurve = curve('global_endpoints', 3, [-0, -0, -0, -0, 2, 2, 2, 2],
  [[-1, -0, -0], [0, 1, .25], [1, 1, .25], [-1, -0, -0]], [1, 1, 1, 1]);
const endpoints = check('global_endpoints', endpointCurve, horizontal);
assert.equal(endpoints.events.length, 2);
assert.ok(Object.is(endpoints.events[0].parameter, -0));
assert.equal(endpoints.events[1].parameter, 2);
assert.notEqual(endpoints.events[0].eventId, endpoints.events[1].eventId);
close(endpoints.events[0].pointMM, endpoints.events[1].pointMM);

const zeroNumerator = {...structuredClone(original), id: 'coincident_cubic',
  controlPoints: original.controlPoints.map(point => [point[0], point[1], -0])};
const coincident = check('coincident_support', zeroNumerator, horizontal);
assert.equal(coincident.kind, 'coincident-support');
assert.equal(coincident.events.length, 0);
assert.equal(coincident.report.rootEvidence.coincident, true);
assert.equal(coincident.report.coincident.support, true);
assert.equal(coincident.report.coincident.finiteContainment, 'control-hull-contained');

const edit = editCurveControlPolygon(original, {poleEdits: [{index: 1, yMM: 1.125}]});
assert.equal(edit.curve.id, original.id);
const editBefore = structuredClone(edit);
const edited = check('same_id_edit', edit.curve, horizontal);
assert.equal(edited.events.length, 3);
assert.notDeepEqual(edited.events.map(event => event.pointMM), three.events.map(event => event.pointMM));
assert.deepEqual(original, originalBefore);
assert.deepEqual(three, threeBefore);
assert.deepEqual(edit, editBefore);
assert.deepEqual(readFileSync(originalFile), originalBytes);

function reject(name, action, code) {
  assert.throws(action, error => {
    assert.ok(error instanceof CubicCurveAffinePlaneIntersectionError);
    assert.equal(error.name, 'CubicCurveAffinePlaneIntersectionError');
    assert.ok(error.message.startsWith('Cubic Curve-plane intersection: '));
    assert.equal(error.code, code);
    if (name === 'triple_root' || name === 'interior_tangent') assert.ok(Object.hasOwn(error, 'cause'));
    failures.push({name, code: error.code, message: error.message, actualCausePreserved: Object.hasOwn(error, 'cause')});
    assert.deepEqual(original, originalBefore);
    assert.deepEqual(three, threeBefore);
    assert.deepEqual(edit, editBefore);
    assert.deepEqual(readFileSync(originalFile), originalBytes);
    return true;
  });
}

const equalWeightHeights = (id, heights) => ({...structuredClone(original), id, weights: [1, 1, 1, 1],
  controlPoints: original.controlPoints.map((point, index) => [point[0], point[1], heights[index]])});
reject('triple_root', () => intersect(equalWeightHeights('triple_root_cubic', [-.125, .125, -.125, .125]),
  horizontal, optionsFor('triple')), 'REPRESENTABILITY');
reject('interior_tangent', () => intersect(equalWeightHeights('tangent_cubic', [.0625, .0625, -.1875, .3125]),
  horizontal, optionsFor('tangent')), 'REPRESENTABILITY');
const quadratic = curve('unsupported_quadratic', 2, [0, 0, 0, 1, 1, 1],
  [[-1, 0, 1], [0, 1, -1], [1, 0, 1]], [1, 1, 1]);
reject('unsupported_degree2', () => intersect(quadratic, horizontal, optionsFor('guard')), 'INPUT');
reject('explicit_event_capacity', () => intersect(original, horizontal, optionsFor('guard', 2)), 'BUDGET');
let getterCalls = 0;
const getter = structuredClone(original);
Object.defineProperty(getter, 'weights', {
  enumerable: true, get() { getterCalls++; return original.weights; },
});
reject('input_getter', () => intersect(getter, horizontal, optionsFor('guard')), 'INPUT');
assert.equal(getterCalls, 0);
for (const [name, alter] of [
  ['equation', result => result.report.rootEvidence.normalizedCoefficients[0] += .01],
  ['root', result => result.events[0].normalizedBracket[0] += .01],
  ['uv', result => result.events[0].planeUV[0] += .01],
  ['source', result => result.source += ' '],
]) {
  const changed = structuredClone(three);
  alter(changed);
  reject('owned_' + name + '_tamper', () => validate(changed), 'OWNED');
}
assert.deepEqual(validate(three), three.report);

// One exact old #639 result protects shared geometry arithmetic after factoring.
const immutableParentRuntimePath = '/Users/user/.codex/worktrees/issue-715-cad/barocss/packages/barocss-cad/dist/index.js';
assert.ok(existsSync(immutableParentRuntimePath));
const parentAPI = await import(pathToFileURL(immutableParentRuntimePath).href);
const witnessCurve = curve('old639_curve', 2, [2, 2, 2, 5, 5, 5],
  [[-2, -0, 1], [0, 1, -2], [2, 0, 1]], [1, .75, 2]);
const witnessOptions = {evaluationId: 'old639_eval', pointEventIds: ['old639_a', 'old639_b']};
const immutableWitness = parentAPI.intersectBezierCurveWithAffinePlaneSurface(witnessCurve, horizontal, witnessOptions);
const currentWitness = intersectBezierCurveWithAffinePlaneSurface(witnessCurve, horizontal, witnessOptions);
assert.deepEqual(currentWitness, immutableWitness);
assert.deepEqual(validateBezierCurveAffinePlaneIntersection(currentWitness), currentWitness.report);
writeFileSync(resolve(output, 'old639.exact-complete-result.json'), nativeJSON(currentWitness) + '\n');
write('old639.witness.json', {immutableParentRuntimePath, comparison: 'one exact complete old #639 result',
  curveId: witnessCurve.id, events: currentWitness.events.length});

// Public compiled JS and all eight names use the actual manifest entries.
const packageRoot = resolve(repo, 'packages/barocss-cad');
const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath));
assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const runtimeExports = ['intersectCubicBezierCurveWithAffinePlaneSurface', 'validateCubicBezierCurveAffinePlaneIntersection',
  'CubicCurveAffinePlaneIntersectionError', 'CubicCurveAffinePlaneIntersectionDiagnosticCode'];
for (const name of runtimeExports) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.CubicCurveAffinePlaneIntersectionDiagnosticCode, CubicCurveAffinePlaneIntersectionDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./own-cubic-curve-plane-intersection.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/own-cubic-curve-plane-intersection.d.ts');
const leafDeclaration = readFileSync(leafDeclarationPath, 'utf8');
const declarationExports = [...runtimeExports, 'CubicCurveAffinePlaneIntersectionOptions',
  'CubicCurveAffinePlaneIntersectionReport', 'CubicCurveAffinePlaneIntersectionResult', 'CubicCurvePlaneRootEvidence'];
for (const name of declarationExports) {
  assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(leafDeclaration), name);
}
assert.ok(leafDeclaration.includes('export type CubicCurveAffinePlaneIntersectionDiagnosticCode'));
const compiled = publicAPI.intersectCubicBezierCurveWithAffinePlaneSurface(original, horizontal, three.options);
assert.deepEqual(compiled, three);
assert.deepEqual(publicAPI.validateCubicBezierCurveAffinePlaneIntersection(compiled), three.report);
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeExports, declarationExports,
  curveDegree: compiled.curve.degree, events: compiled.events.length,
  declarationCheck: 'actual exported declaration text; no separate TypeScript invocation'};
write('compiled-consumer.json', compiledConsumer);
write('summary.json', {sourceMode: true, cadSourceInputCount: cadInputs.length, summaries, failures,
  compiledConsumer, immutableParentRuntimePath, exactOld639CompleteResultMatch: true,
  scope: 'One original positive weighted cubic Bezier Curve and affine Plane. Derived scalar normalization, actual reused quadratic derivative roots and bounded cubic isolation retain explicit uncertainty refusals. Points, original parameter brackets and finite Plane UV use original native geometry. No original coefficient normalization, projection, topology, global binary64 or manufacturing certificate, wide cubic composition, reader campaign or renderer adoption.'});
console.log(JSON.stringify({sourceMode: true, cadSourceInputCount: cadInputs.length,
  summaries, failures, compiledConsumer, immutableParentRuntimePath}));
