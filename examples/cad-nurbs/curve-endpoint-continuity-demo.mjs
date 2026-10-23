import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node curve-endpoint-continuity-demo.mjs --source <output-directory>'); assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]); mkdirSync(output, {recursive: true});
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json')), esbuild = require('esbuild');
const entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundle = await esbuild.build({absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true});
assert.equal(bundle.outputFiles.length, 1);
const sourceInputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path)), cadInputs = sourceInputs.filter(path => path.includes('/packages/barocss-cad/'));
for (const leaf of ['index.ts', 'curve-endpoint-continuity.ts', 'local-curvature.ts', 'second-derivatives.ts']) assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const {inspectCurveEndpointContinuity: inspect, validateCurveEndpointContinuity: validate, CurveEndpointContinuityError, CurveEndpointContinuityDiagnosticCode,
  evaluateCurveCurvature, NativeCurvatureError, evaluateCurveD1, evaluateCurveD2, curveDomain, compileCadModel,
  reverseCurve, joinCurves, buildQuinticHermiteCurve} = api;
const runtimeNames = ['inspectCurveEndpointContinuity', 'validateCurveEndpointContinuity', 'CurveEndpointContinuityError', 'CurveEndpointContinuityDiagnosticCode'];
const typeNames = ['CurveEndpointContinuityInput', 'CurveEndpointContinuityOptions', 'CurveEndpointContinuityReport', 'CurveEndpointContinuityResult'];
for (const name of runtimeNames) assert.equal(typeof api[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(Object.keys(CurveEndpointContinuityDiagnosticCode).sort(), ['INPUT', 'IDENTITY', 'BUDGET', 'SOURCE', 'BINDING', 'NATIVE', 'REGULARITY', 'ARITHMETIC', 'OWNED'].sort());
const retainedFiles = new Map(), inputsBefore = [], accepted = [], cases = [], failures = [];
function nativeJSON(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || ['string', 'boolean'].includes(typeof value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}';
}
function jsonFile(name, value) {
  const file = resolve(output, name + '.json'); writeFileSync(file, nativeJSON(value) + '\n'); retainedFiles.set(file, readFileSync(file));
  const reopened = JSON.parse(readFileSync(file, 'utf8')); assert.deepEqual(reopened, value); return {file, reopened};
}
function sourceFile(name, source, model) {
  const file = resolve(output, name + '.source0.css'); writeFileSync(file, source); retainedFiles.set(file, readFileSync(file));
  const cold = compileCadModel(readFileSync(file, 'utf8'), {sourceVersion: 0}); assert.equal(cold.ok, true, JSON.stringify(cold.diagnostics)); assert.deepEqual(cold.model, model); return file;
}
function decimal(value) {
  if (Object.is(value, -0)) return '-0'; const text = String(value); if (!/[eE]/.test(text)) return text;
  const [mantissa, exponent] = text.toLowerCase().split('e'), negative = mantissa.startsWith('-'), parts = (negative ? mantissa.slice(1) : mantissa).split('.');
  const digits = parts.join(''), position = parts[0].length + Number(exponent);
  return (negative ? '-' : '') + (position <= 0 ? '0.' + '0'.repeat(-position) + digits : position >= digits.length ? digits + '0'.repeat(position - digits.length) : digits.slice(0, position) + '.' + digits.slice(position));
}
function input(sourceId, curve, endpoint, suppliedSource = null, suppliedModel = null) {
  const list = values => '[' + values.map(decimal).join(',') + ']';
  const model = suppliedModel ?? {name: sourceId + '_model', version: 0, lengthUnit: 'mm', objects: [curve]};
  const source = suppliedSource ?? '@model ' + model.name + ' { version:0; length-unit:mm; @curve #' + curve.id + ' { type:nurbs; degree:' + curve.degree + '; knots:' + list(curve.knots) +
    '; control-points:[' + curve.controlPoints.map(list).join(',') + ']; weights:' + list(curve.weights) + '; } }\n';
  sourceFile(sourceId, source, model); const result = {sourceId, source, curve, endpoint}; inputsBefore.push({input: result, before: structuredClone(result)}); return result;
}
function ownership(inputs, result) {
  const caller = new WeakSet(), seen = new WeakSet();
  const collect = value => { if (value && typeof value === 'object' && !caller.has(value)) { caller.add(value); for (const child of Object.values(value)) collect(child); }};
  inputs.forEach(collect);
  const visit = value => { if (value && typeof value === 'object') {
    assert.ok(!caller.has(value), 'Caller alias'); assert.ok(!seen.has(value), 'Repeated result occurrence'); seen.add(value); for (const child of Object.values(value)) visit(child);
  }}; visit(result);
}
function bits(actual, expected) {
  if (typeof expected === 'number') { assert.ok(Object.is(actual, expected), 'Actual source/native/traversal bits changed'); return; }
  assert.deepEqual(actual, expected); if (expected && typeof expected === 'object') for (const key of Object.keys(expected)) bits(actual[key], expected[key]);
}
const norm = vector => Math.hypot(...vector), gap = (a, b) => norm(a.map((value, i) => value - b[i]));
const relative = (a, b) => gap(a, b) / Math.max(1, norm(a), norm(b));
const close = (a, b) => assert.ok(gap(a, b) <= 1e-7 * Math.max(1, norm(b)));
const clamped = (degree, a, b) => [...Array(degree + 1).fill(a), ...Array(degree + 1).fill(b)];
const curve = (id, points, a, b, weights = Array(points.length).fill(1)) => ({kind: 'curve', id, degree: points.length - 1, knots: clamped(points.length - 1, a, b), controlPoints: points, weights});
const leftCurve = curve('left_curve', [[-1, 1, 0], [-.5, 0, 0], [0, 0, 0]], -1, 0);
const rightCurve = curve('right_curve', [[0, 0, 0], [.5, 0, 0], [1, 1, 0]], 0, 1);
const left = input('left_source', leftCurve, 'end'), right = input('right_source', rightCurve, 'start');
const flags = (c0, c1, c2, g1, g2) => ({c0, c1, c2, g1, g2});
function check(name, first, second, expectedFlags, expectedNative = null) {
  const options = {evaluationId: name + '_evaluation', maximumCurvatureEvaluations: 2}, before = structuredClone({first, second, options});
  const request = jsonFile(name + '.authored-request', {first, second, options}), result = inspect(first, second, options); ownership([first, second, options], result); bits({first, second, options}, before);
  assert.deepEqual(Object.keys(result).sort(), ['first', 'second', 'options', 'models', 'native', 'analysis', 'report'].sort()); bits(result.first, first); bits(result.second, second); assert.deepEqual(result.options, options);
  const report = result.report; assert.equal(report.schema, 'barocss-curve-endpoint-continuity'); assert.equal(report.version, 0); assert.equal(report.evaluationId, options.evaluationId);
  assert.equal(report.lengthUnit, 'mm'); assert.equal(report.curvatureUnit, '1/mm'); assert.equal(report.derivativeUnits, 'original-native-parameter-units');
  assert.equal(report.sourceFrame, 'authored-xyz-no-axis-conversion'); assert.equal(report.sourceCompilationCount, 2); assert.equal(report.curvatureEvaluationCount, 2);
  assert.equal(report.numericPolicy.evenOrder, 'second-derivative-and-curvature-vector-unchanged'); assert.equal(report.numericPolicy.g1Dot, 'strictly-positive-no-clamp');
  assert.equal(report.quality.originalSourcesAndGeometryBitsPreserved, true); assert.equal(report.quality.localObservedEndpointConditionsOnly, true);
  for (const field of ['formalJoinedCurveContinuityUpgraded', 'weldedGeometryCreated', 'topologyCertified', 'solid', 'globalG2Certified',
    'supportRegularityCertified', 'manufacturingToleranceCertified', 'globalBinary64ErrorCertified']) assert.equal(report.quality[field], false);
  const originals = [first, second], factors = [first.endpoint === 'end' ? 1 : -1, second.endpoint === 'start' ? 1 : -1];
  for (let i = 0; i < 2; i++) {
    const original = originals[i], domain = curveDomain(original.curve), parameter = domain[original.endpoint === 'start' ? 0 : 1], native = result.native[i];
    assert.equal(result.models[i].objects.length, 1); bits(result.models[i].objects[0], original.curve);
    bits(native, evaluateCurveCurvature(original.curve, parameter)); bits(native.derivatives, evaluateCurveD2(original.curve, parameter));
    if (expectedNative?.[i]) for (const [key, expected] of Object.entries(expectedNative[i])) close(native.derivatives[key], expected);
    const reference = i === 0 ? report.firstReference : report.secondReference;
    bits(reference, {sourceId: original.sourceId, modelName: result.models[i].name, curveId: original.curve.id, endpoint: original.endpoint,
      parameter, domain, traversal: i === 0 ? 'incoming' : 'outgoing', derivativeFactor: factors[i]});
  }
  const [a, b] = result.native, analysis = result.analysis, d0 = a.derivatives.derivative.map(value => value * factors[0]), d1 = b.derivatives.derivative.map(value => value * factors[1]);
  const t0 = a.unitTangent.map(value => value * factors[0]), t1 = b.unitTangent.map(value => value * factors[1]);
  assert.deepEqual(Object.keys(analysis).sort(), ['pointDifferenceMM', 'firstDerivativeRelativeDifference', 'secondDerivativeRelativeDifference', 'unitTangentDifference', 'unitTangentDot',
    'curvatureVectorRelativeDifference', 'c0', 'c1', 'c2', 'g1', 'g2', 'incomingDerivativeMMPerParameter', 'outgoingDerivativeMMPerParameter', 'incomingUnitTangent', 'outgoingUnitTangent'].sort());
  bits(analysis.incomingDerivativeMMPerParameter, d0); bits(analysis.outgoingDerivativeMMPerParameter, d1); bits(analysis.incomingUnitTangent, t0); bits(analysis.outgoingUnitTangent, t1);
  assert.equal(analysis.pointDifferenceMM, gap(a.derivatives.point, b.derivatives.point)); assert.equal(analysis.firstDerivativeRelativeDifference, relative(d0, d1));
  assert.equal(analysis.secondDerivativeRelativeDifference, relative(a.derivatives.secondDerivative, b.derivatives.secondDerivative));
  assert.equal(analysis.unitTangentDifference, gap(t0, t1)); assert.equal(analysis.unitTangentDot, t0.reduce((sum, value, i) => sum + value * t1[i], 0));
  assert.equal(analysis.curvatureVectorRelativeDifference, relative(a.curvatureVectorPerMM, b.curvatureVectorPerMM));
  for (const [key, expected] of Object.entries(expectedFlags)) assert.equal(analysis[key], expected, name + '.' + key);
  assert.equal(analysis.c1, analysis.c0 && analysis.firstDerivativeRelativeDifference <= 1e-7); assert.equal(analysis.c2, analysis.c1 && analysis.secondDerivativeRelativeDifference <= 1e-7);
  assert.equal(analysis.g1, analysis.c0 && analysis.unitTangentDifference <= 1e-7 && analysis.unitTangentDot > 0); assert.equal(analysis.g2, analysis.g1 && analysis.curvatureVectorRelativeDifference <= 1e-7);
  assert.deepEqual(validate(result), report); const saved = jsonFile(name + '.owned-continuity', result);
  for (const original of [request.reopened.first, request.reopened.second]) { const cold = compileCadModel(original.source, {sourceVersion: 0}); assert.equal(cold.ok, true); bits(cold.model.objects[0], original.curve); }
  assert.deepEqual(inspect(request.reopened.first, request.reopened.second, request.reopened.options), saved.reopened); assert.deepEqual(validate(saved.reopened), report);
  accepted.push({first, second, options, before, result, beforeResult: structuredClone(result)});
  cases.push({name, flags: expectedFlags, firstEndpoint: first.endpoint, secondEndpoint: second.endpoint, requestFile: request.file, resultFile: saved.file}); return result;
}
jsonFile('source-api.inputs', {entry, sourceInputs, cadInputs, sourceOnly: true, write: false, esbuildVersion: esbuild.version}); jsonFile('source-api.metafile', bundle.metafile);
const c2 = check('quadratic_c2', left, right, flags(true, true, true, true, true),
  [{point: [0, 0, 0], derivative: [1, 0, 0], secondDerivative: [0, 2, 0]}, {point: [0, 0, 0], derivative: [1, 0, 0], secondDerivative: [0, 2, 0]}]);
const slower = input('slower_source', {...rightCurve, id: 'slower_curve', knots: clamped(2, 0, 2)}, 'start');
const g2 = check('g2_unequal_speed', left, slower, flags(true, false, false, true, true),
  [{derivative: [1, 0, 0], secondDerivative: [0, 2, 0]}, {derivative: [.5, 0, 0], secondDerivative: [0, .5, 0]}]);
close(g2.native[0].curvatureVectorPerMM, [0, 2, 0]); close(g2.native[1].curvatureVectorPerMM, [0, 2, 0]);
check('c1_curvature_jump', left, input('jump_source', curve('jump_curve', [[0, 0, 0], [.5, 0, 0], [1, 2, 0]], 0, 1), 'start'), flags(true, true, false, true, false));
check('corner_c0_only', left, input('corner_source', curve('corner_curve', [[0, 0, 0], [0, .5, 0], [0, 1, 0]], 0, 1), 'start'), flags(true, false, false, false, false));
check('point_gap', left, input('gap_source', {...rightCurve, id: 'gap_curve', controlPoints: rightCurve.controlPoints.map(point => point.map((value, i) => value + (i === 1 ? .125 : 0)))}, 'start'), flags(false, false, false, false, false));
const reversedLeft = reverseCurve(leftCurve, {curveId: 'reversed_left'}), reversedRight = reverseCurve(rightCurve, {curveId: 'reversed_right'});
for (const [name, reversal] of [['first', reversedLeft], ['second', reversedRight]]) { jsonFile('actual672.' + name, reversal); sourceFile('actual672.' + name, reversal.source, reversal.model); }
check('reversed_start_end', input('reversed_first_source', reversedLeft.curve, 'start', reversedLeft.source, reversedLeft.model),
  input('reversed_second_source', reversedRight.curve, 'end', reversedRight.source, reversedRight.model), flags(true, true, true, true, true));
check('qualified_duplicate_curve_id', left, input('duplicate_local_source', {...rightCurve, id: leftCurve.id}, 'start'), flags(true, true, true, true, true));
const rationalLineLeft = curve('rational_line_left', [[-1, 0, 0], [0, 0, 0]], -1, 0, [1, 2]), rationalLineRight = curve('rational_line_right', [[0, 0, 0], [1, 0, 0]], 0, 1, [3, 1]);
const straight = check('regular_rational_straight', input('rational_left_source', rationalLineLeft, 'end'), input('rational_right_source', rationalLineRight, 'start'), flags(true, false, false, true, true),
  [{derivative: [.5, 0, 0], secondDerivative: [-.5, 0, 0]}, {derivative: [1 / 3, 0, 0], secondDerivative: [4 / 9, 0, 0]}]);
assert.equal(straight.native[0].curvaturePerMM, 0); assert.equal(straight.native[1].curvaturePerMM, 0); assert.equal(straight.native[0].radiusMM, null); assert.equal(straight.native[1].radiusMM, null);
const arcLeft = curve('arc_left', [[2, 0, 0], [2, 2, 0], [0, 2, 0]], -3, 7, [1, Math.SQRT1_2, 1]);
const arcRight = curve('arc_right', [[0, 2, 0], [-2, 2, 0], [-2, 0, 0]], 7, 17, [1, Math.SQRT1_2, 1]);
const arcs = check('regular_rational_quarter_arcs', input('arc_left_source', arcLeft, 'end'), input('arc_right_source', arcRight, 'start'), flags(true, true, false, true, true));
for (const native of arcs.native) { close(native.curvatureVectorPerMM, [0, -.5, 0]); assert.ok(Math.abs(native.curvaturePerMM - .5) <= 1e-7); assert.ok(Math.abs(native.radiusMM - 2) <= 1e-7); }
const hermiteEndpoint = (parameter, pointMM, derivativeMMPerParameter, secondDerivativeMMPerParameterSquared) => ({parameter, pointMM, derivativeMMPerParameter, secondDerivativeMMPerParameterSquared});
const quinticLeft = buildQuinticHermiteCurve([hermiteEndpoint(-1, [-1, 1, 0], [1, -2, 0], [0, 2, 0]), hermiteEndpoint(0, [0, 0, 0], [1, 0, 0], [0, 2, 0])], {curveId: 'quintic_left', maximumEndpointEvaluations: 2});
const quinticRight = buildQuinticHermiteCurve([hermiteEndpoint(0, [0, 0, 0], [1, 0, 0], [0, 2, 0]), hermiteEndpoint(1, [1, 1, 0], [1, 2, 0], [0, 2, 0])], {curveId: 'quintic_right', maximumEndpointEvaluations: 2});
for (const [name, value] of [['left', quinticLeft], ['right', quinticRight]]) jsonFile('actual1026.' + name, value);
check('actual_quintic_source_endpoints', input('quintic_left_source', quinticLeft.curve, 'end', quinticLeft.source, quinticLeft.model),
  input('quintic_right_source', quinticRight.curve, 'start', quinticRight.source, quinticRight.model), flags(true, true, true, true, true));
const wide = {kind: 'curve', id: 'wide_endpoint', degree: 1, knots: [0, 0, ...Array.from({length: 62}, (_, i) => i + 1), 63, 63], controlPoints: Array.from({length: 64}, (_, i) => [i - 63, 0, 0]), weights: Array(64).fill(1)};
check('maximum64_regular_endpoint', input('wide_source', wide, 'end'), input('wide_follow_source', curve('wide_follow', [[0, 0, 0], [1, 0, 0]], 0, 1), 'start'), flags(true, true, true, true, true));
const joined = joinCurves(leftCurve, rightCurve, {curveId: 'actual_formal_c0_join'}); jsonFile('actual667.join', joined); sourceFile('actual667.join', joined.source, joined.model);
assert.equal(joined.report.joinParameter, 0); assert.equal(joined.report.joinMultiplicity, 2); assert.equal(joined.report.nativeJoinD1.status, 'native-refused');
let joinedD1Error, joinedD2Error;
try { evaluateCurveD1(joined.curve, 0); } catch (error) { joinedD1Error = error; }
try { evaluateCurveD2(joined.curve, 0); } catch (error) { joinedD2Error = error; }
assert.ok(joinedD1Error instanceof Error); assert.ok(joinedD2Error instanceof api.NativeSecondDerivativeError); assert.equal(joinedD2Error.code, 'CONTINUITY');
jsonFile('actual667.native-guards-retained', {originalEndpointC2Inspection: c2.analysis.c2, formalMultiplicity: joined.report.joinMultiplicity, d1Message: joinedD1Error.message, d2Code: joinedD2Error.code, d2Message: joinedD2Error.message});
function intact() {
  for (const row of inputsBefore) bits(row.input, row.before);
  for (const row of accepted) { bits({first: row.first, second: row.second, options: row.options}, row.before); bits(row.result, row.beforeResult); }
  for (const [file, bytes] of retainedFiles) assert.deepEqual(readFileSync(file), bytes, file);
}
function reject(name, action, code, childCode = null) {
  assert.throws(action, error => { assert.ok(error instanceof CurveEndpointContinuityError); assert.equal(error.code, code); assert.ok(error.message.length <= 1024);
    if (childCode) { assert.ok(error.cause instanceof NativeCurvatureError); assert.equal(error.cause.code, childCode); }
    if (code === 'SOURCE') assert.ok(error.cause?.ok === false && Array.isArray(error.cause.diagnostics));
    failures.push({name, code: error.code, message: error.message, causeName: error.cause?.name ?? null, causeCode: error.cause?.code ?? null,
      actualCompileDiagnostics: error.cause?.ok === false ? error.cause.diagnostics.map(d => ({code: d.code ?? null, message: d.message ?? null})) : null}); intact(); return true;
  });
}
const refusalOptions = {evaluationId: 'refusal_evaluation', maximumCurvatureEvaluations: 2};
reject('budget_before_native_work', () => inspect(left, right, {...refusalOptions, maximumCurvatureEvaluations: 1}), 'BUDGET');
reject('duplicate_source_id', () => inspect(left, {...right, sourceId: left.sourceId}, refusalOptions), 'IDENTITY');
reject('invalid_evaluation_id', () => inspect(left, right, {...refusalOptions, evaluationId: 'invalid id'}), 'IDENTITY');
reject('source_compiler_failure', () => inspect(left, {...right, source: right.source.replace('degree:2', 'degree:1')}, refusalOptions), 'SOURCE');
const changedBits = right.source.replace('[0,0,0]', '[-0,0,0]'); assert.notEqual(changedBits, right.source);
reject('source_coordinate_bits_mismatch', () => inspect(left, {...right, source: changedBits}, refusalOptions), 'BINDING');
const singularCurve = curve('singular', [[0, 0, 0], [0, 0, 0], [0, 0, 0]], 0, 1), singular = input('singular_source', singularCurve, 'start');
assert.deepEqual(evaluateCurveD2(singularCurve, 0), {point: [0, 0, 0], derivative: [0, 0, 0], secondDerivative: [0, 0, 0]});
reject('actual_native_singular_endpoint', () => inspect(left, singular, refusalOptions), 'REGULARITY', 'REGULARITY');
const unsafeCurve = curve('unsafe_curvature', [[0, 0, 0], [.5, 0, 0], [1, 1e-320, 0]], 0, 1), unsafe = input('unsafe_source', unsafeCurve, 'start');
assert.ok(evaluateCurveD2(unsafeCurve, 0).secondDerivative[1] !== 0);
reject('actual_native_curvature_arithmetic', () => inspect(left, unsafe, refusalOptions), 'NATIVE', 'ARITHMETIC');
reject('unknown_input_field', () => inspect({...left, hint: 'unsupported'}, right, refusalOptions), 'INPUT');
reject('invalid_endpoint_selector', () => inspect({...left, endpoint: 'near'}, right, refusalOptions), 'INPUT');
reject('curve_degree_profile', () => inspect({...left, curve: {...left.curve, degree: 6}}, right, refusalOptions), 'INPUT');
reject('curve_coordinate_profile', () => inspect({...left, curve: {...left.curve, controlPoints: [[10001, 1, 0], ...left.curve.controlPoints.slice(1)]}}, right, refusalOptions), 'INPUT');
let getterCalls = 0;
const getter = {...left}; Object.defineProperty(getter, 'source', {enumerable: true, get() { getterCalls++; return left.source; }});
reject('source_getter', () => inspect(getter, right, refusalOptions), 'INPUT');
const nestedGetter = structuredClone(right); Object.defineProperty(nestedGetter.curve.weights, '0', {enumerable: true, get() { getterCalls++; return 1; }});
reject('native_data_getter', () => inspect(left, nestedGetter, refusalOptions), 'INPUT'); assert.equal(getterCalls, 0);
for (const [name, alter] of [
  ['source', result => { result.second.source = result.second.source.replace('[0,0,0]', '[-0,0,0]'); }], ['native', result => { result.native[0].derivatives.secondDerivative[1] += .1; }],
  ['analysis', result => { result.analysis.c2 = false; }], ['counter', result => { result.report.curvatureEvaluationCount++; }],
  ['parameter', result => { result.report.secondReference.parameter += .1; }], ['model', result => { result.models[0].objects[0].weights[0] += .1; }],
]) { const changed = structuredClone(c2); alter(changed); reject('owned_' + name, () => validate(changed), 'OWNED'); }
let replacement = c2; const previous = replacement;
reject('atomic_prior_inspection', () => { replacement = inspect(left, singular, refusalOptions); }, 'REGULARITY', 'REGULARITY');
assert.strictEqual(replacement, previous); jsonFile('atomic-retention', {priorInspectionUnchanged: replacement === previous, getterCalls});
const packageRoot = resolve(repo, 'packages/barocss-cad'), manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.publishConfig?.exports?.['.'] ?? manifest.exports['.'], runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath)); const publicAPI = await import(pathToFileURL(runtimePath).href);
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function'); assert.deepEqual(publicAPI.CurveEndpointContinuityDiagnosticCode, CurveEndpointContinuityDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./curve-endpoint-continuity.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/nurbs/curves/curve-endpoint-continuity.d.ts'), declaration = readFileSync(leafDeclarationPath, 'utf8');
for (const name of [...runtimeNames, ...typeNames]) assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(declaration), name);
for (const row of cases) {
  const request = JSON.parse(readFileSync(row.requestFile, 'utf8')), stored = JSON.parse(readFileSync(row.resultFile, 'utf8'));
  for (const original of [request.first, request.second]) { const cold = publicAPI.compileCadModel(original.source, {sourceVersion: 0}); assert.equal(cold.ok, true); bits(cold.model.objects[0], original.curve); }
  assert.deepEqual(publicAPI.inspectCurveEndpointContinuity(request.first, request.second, request.options), stored); assert.deepEqual(publicAPI.validateCurveEndpointContinuity(stored), stored.report);
}
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 8,
  exportSelection: manifest.publishConfig?.exports?.['.'] ? 'publishConfig.exports root' : 'exports root'};
jsonFile('compiled-consumer', compiledConsumer); intact();
const summary = {sourceMode: true, cadSourceInputCount: cadInputs.length, cases, failures, compiledConsumer, caseCount: cases.length, refusalCount: failures.length, getterCalls,
  actual667FormalC0Retained: true, scope: 'Observed regular one-sided source-qualified endpoint C0/C1/C2/G1/G2 conditions in original native units; no welded Curve, formal join upgrade, global G2, Surface, topology or Solid certificate.'};
jsonFile('summary', summary); intact(); console.log(JSON.stringify(summary));
