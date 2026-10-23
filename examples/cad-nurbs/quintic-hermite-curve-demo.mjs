import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node quintic-hermite-curve-demo.mjs --source <output-directory>'); assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]); mkdirSync(output, {recursive: true});
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json')), esbuild = require('esbuild');
const entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundle = await esbuild.build({absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true});
assert.equal(bundle.outputFiles.length, 1);
const sourceInputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path)), cadInputs = sourceInputs.filter(path => path.includes('/packages/barocss-cad/'));
for (const leaf of ['index.ts', 'nurbs/curves/quintic-hermite-curve.ts', 'core/second-derivatives.ts', 'core/derivatives.ts', 'nurbs/curves/curve-source.ts']) assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const {buildQuinticHermiteCurve: build, validateQuinticHermiteCurve: validate, QuinticHermiteError, QuinticHermiteDiagnosticCode,
  evaluateCurve, evaluateCurveD1, evaluateCurveD2, curveDomain, compileCadModel} = api;
const runtimeNames = ['buildQuinticHermiteCurve', 'validateQuinticHermiteCurve', 'QuinticHermiteError', 'QuinticHermiteDiagnosticCode'];
const typeNames = ['QuinticHermiteEndpoint', 'QuinticHermiteOptions', 'QuinticHermiteReport', 'QuinticHermiteResult'];
for (const name of runtimeNames) assert.equal(typeof api[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(Object.keys(QuinticHermiteDiagnosticCode).sort(), ['INPUT', 'IDENTITY', 'BUDGET', 'REPRESENTABILITY', 'NATIVE', 'BINDING', 'OWNED'].sort());
const retainedFiles = new Map(), accepted = [], cases = [], failures = [];
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
function ownership(inputs, result) {
  const caller = new WeakSet(), seen = new WeakSet();
  const collect = value => { if (value && typeof value === 'object' && !caller.has(value)) { caller.add(value); for (const child of Object.values(value)) collect(child); }};
  inputs.forEach(collect);
  const visit = value => { if (value && typeof value === 'object') {
    assert.ok(!caller.has(value), 'Caller alias'); assert.ok(!seen.has(value), 'Repeated result occurrence'); seen.add(value); for (const child of Object.values(value)) visit(child);
  }}; visit(result);
}
function bits(actual, expected) {
  if (typeof expected === 'number') { assert.ok(Object.is(actual, expected), 'Native/source/request bits changed'); return; }
  assert.deepEqual(actual, expected); if (expected && typeof expected === 'object') for (const key of Object.keys(expected)) bits(actual[key], expected[key]);
}
function close(actual, expected, label, tolerance = 1e-7, relative = false) {
  const distance = Math.hypot(...actual.map((value, i) => value - expected[i]));
  assert.ok(distance <= tolerance * (relative ? Math.max(1, Math.hypot(...expected)) : 1), label + ': ' + distance); return distance;
}
function polynomial(coefficients, t, order) {
  return coefficients.reduce((sum, coefficient, power) => {
    if (power < order) return sum; let factor = 1; for (let k = 0; k < order; k++) factor *= power - k;
    return sum + coefficient * factor * t ** (power - order);
  }, 0);
}
function reference(coefficients, domain, translation = [0, 0, 0]) {
  return parameter => { const span = domain[1] - domain[0], t = (parameter - domain[0]) / span;
    return {point: coefficients.map((c, i) => polynomial(c, t, 0) + translation[i]), derivative: coefficients.map(c => polynomial(c, t, 1) / span),
      secondDerivative: coefficients.map(c => polynomial(c, t, 2) / span / span)};
  };
}
const endpoint = (parameter, pointMM, derivativeMMPerParameter, secondDerivativeMMPerParameterSquared) =>
  ({parameter, pointMM, derivativeMMPerParameter, secondDerivativeMMPerParameterSquared});
const primaryCoefficients = [[0, 1], [0, 0, 1], [0, 0, 0, -1, 0, 1]];
const primaryPoles = [[0, 0, 0], [.2, 0, 0], [.4, .1, 0], [.6, .3, -.1], [.8, .6, -.4], [1, 1, 0]];
const primaryEndpoints = [endpoint(-3, [0, 0, 0], [.1, 0, 0], [0, .02, 0]), endpoint(7, [1, 1, 0], [.1, .2, .2], [0, .02, .14])];
const options = curveId => ({curveId, maximumEndpointEvaluations: 2});
function check(name, endpoints, oracle, expectedPoles = null, fractions = [0, .2, .5, .8, 1]) {
  const settings = options(name), before = structuredClone({endpoints, settings}), request = jsonFile(name + '.authored-request', {endpoints, options: settings});
  const result = build(endpoints, settings); ownership([endpoints, settings], result); bits({endpoints, settings}, before);
  assert.deepEqual(Object.keys(result).sort(), ['endpoints', 'options', 'curve', 'source', 'sourceVersion', 'model', 'report'].sort());
  bits(result.endpoints, endpoints); assert.deepEqual(result.options, settings); assert.equal(result.sourceVersion, 0);
  const curve = result.curve, domain = endpoints.map(item => item.parameter), span = domain[1] - domain[0];
  assert.equal(curve.id, name); assert.equal(curve.degree, 5); assert.equal(curve.controlPoints.length, 6); assert.deepEqual(curve.weights, Array(6).fill(1));
  bits(curve.knots, [...Array(6).fill(domain[0]), ...Array(6).fill(domain[1])]); bits(curveDomain(curve), domain);
  bits(curve.controlPoints[0], endpoints[0].pointMM); bits(curve.controlPoints[5], endpoints[1].pointMM);
  assert.deepEqual(result.model.objects, [curve]); const file = sourceFile(name, result.source, result.model);
  const cold = compileCadModel(readFileSync(file, 'utf8'), {sourceVersion: 0}); assert.equal(cold.ok, true); bits(cold.model.objects[0], curve);
  if (expectedPoles) for (let i = 0; i < 6; i++) close(curve.controlPoints[i], expectedPoles[i], 'independent Bernstein pole ' + i, 1e-12);
  const report = result.report; assert.equal(report.schema, 'barocss-quintic-hermite-curve'); assert.equal(report.version, 0); assert.equal(report.curveId, name);
  assert.equal(report.parameterFrame, 'original-native-knot-units'); assert.equal(report.numericPolicy.firstOffset, '(h*T)/5');
  assert.equal(report.numericPolicy.secondOffset, '((h*Asecond)*h)/20'); assert.equal(report.numericPolicy.separateSpanSquaredRequired, false);
  assert.equal(report.numericPolicy.interiorZeroSigns, 'disclosed-ieee-translation-arithmetic'); assert.equal(report.quality.geometricValidity, 'not-certified');
  for (const field of ['topologyCertified', 'solid', 'regularityCertified', 'scalarCurvatureConstraintsSolved', 'g2Certified', 'periodicSupported',
    'multiSegmentContinuitySolved', 'globalShapeErrorCertified', 'globalBinary64ErrorCertified', 'manufacturingToleranceCertified']) assert.equal(report.quality[field], false);
  bits(report.domain, domain); assert.equal(report.span, span); assert.equal(report.lengthUnit, 'mm'); assert.equal(report.sourceModelName, result.model.name);
  assert.equal(report.sourceAdoptionCount, 1); assert.equal(report.endpointEvaluationCount, 2); assert.equal(report.observations.length, 2);
  const d = endpoints.map(item => item.derivativeMMPerParameter.map(value => (span * value) / 5));
  const s = endpoints.map(item => item.secondDerivativeMMPerParameterSquared.map(value => ((span * value) * span) / 20));
  bits(report.firstDerivativeOffsetsMM, d); bits(report.secondDerivativeOffsetsMM, s); assert.equal(report.poleDerivation.length, 6);
  for (const derivation of report.poleDerivation) {
    assert.equal(derivation.endpointIndex, derivation.poleIndex <= 2 ? 0 : 1); bits(derivation.basePointMM, endpoints[derivation.endpointIndex].pointMM);
    let calculated = [...derivation.basePointMM]; for (const step of derivation.translationStepsMM) calculated = calculated.map((value, i) => value + step[i]);
    bits(calculated, derivation.pointMM); bits(derivation.pointMM, curve.controlPoints[derivation.poleIndex]);
  }
  for (const [i, observation] of report.observations.entries()) {
    const authored = endpoints[i], actual = evaluateCurveD2(curve, authored.parameter); assert.equal(observation.endpointIndex, i); bits(observation.parameter, authored.parameter);
    bits(observation.authored, authored); bits(observation.actual, actual); bits(actual.point, evaluateCurveD1(curve, authored.parameter).point);
    bits(actual.derivative, evaluateCurveD1(curve, authored.parameter).derivative);
    assert.ok(observation.pointDifferenceMM <= 1e-7 && observation.derivativeRelativeDifference <= 1e-7 && observation.secondDerivativeRelativeDifference <= 1e-7);
    for (let axis = 0; axis < 3; axis++) {
      if (authored.derivativeMMPerParameter[axis] !== 0) assert.notEqual(actual.derivative[axis], 0);
      if (authored.secondDerivativeMMPerParameterSquared[axis] !== 0) assert.notEqual(actual.secondDerivative[axis], 0);
    }
  }
  const observations = fractions.map(fraction => {
    const parameter = fraction === 0 ? domain[0] : fraction === 1 ? domain[1] : domain[0] + span * fraction, expected = oracle(parameter);
    const point = evaluateCurve(curve, parameter), d1 = evaluateCurveD1(curve, parameter), d2 = evaluateCurveD2(curve, parameter);
    close(point, expected.point, 'independent polynomial D0'); close(d1.derivative, expected.derivative, 'independent original-domain D1', 1e-7, true);
    close(d2.secondDerivative, expected.secondDerivative, 'independent original-domain D2', 1e-7, true); bits(d2.point, d1.point); bits(d2.derivative, d1.derivative);
    return {fraction, parameter, expected, point, d1, d2};
  });
  jsonFile(name + '.independent-polynomial-observations', observations); assert.deepEqual(validate(result), report); const saved = jsonFile(name + '.owned-hermite', result);
  assert.deepEqual(build(request.reopened.endpoints, request.reopened.options), saved.reopened); assert.deepEqual(validate(saved.reopened), report);
  accepted.push({endpoints, settings, before, result, beforeResult: structuredClone(result)});
  cases.push({name, domain, sourceFile: file, requestFile: request.file, resultFile: saved.file, observationCount: observations.length}); return result;
}
jsonFile('source-api.inputs', {entry, sourceInputs, cadInputs, sourceOnly: true, write: false, esbuildVersion: esbuild.version}); jsonFile('source-api.metafile', bundle.metafile);
const primary = check('primary_quintic', primaryEndpoints, reference(primaryCoefficients, [-3, 7]), primaryPoles);
const editedEndpoints = structuredClone(primaryEndpoints); editedEndpoints[0].derivativeMMPerParameter[0] = .15; editedEndpoints[1].secondDerivativeMMPerParameterSquared[2] = .1;
const editedCoefficients = [[0, 1.5, 0, -3, 4, -1.5], [0, 0, 1], [0, 0, 0, -3, 4, -1]];
const edited = check('endpoint_jet_edit', editedEndpoints, reference(editedCoefficients, [-3, 7]));
assert.ok(Math.hypot(...evaluateCurve(edited.curve, 2).map((value, i) => value - evaluateCurve(primary.curve, 2)[i])) > .01);
check('straight', [endpoint(-3, [-2, 3, 1], [.5, -.5, .5], [0, 0, 0]), endpoint(7, [3, -2, 6], [.5, -.5, .5], [0, 0, 0])],
  reference([[-2, 5], [3, -5], [1, 5]], [-3, 7]), Array.from({length: 6}, (_, i) => [-2 + i, 3 - i, 1 + i]));
check('stationary_start', [endpoint(-3, [0, 0, 0], [0, 0, 0], [.02, 0, 0]), endpoint(7, [1, 0, 0], [.2, 0, 0], [.02, 0, 0])],
  reference([[0, 0, 1], [0], [0]], [-3, 7]));
check('constant', [endpoint(-3, [2, -3, 4], [0, 0, 0], [0, 0, 0]), endpoint(7, [2, -3, 4], [0, 0, 0], [0, 0, 0])],
  reference([[2], [-3], [4]], [-3, 7]), Array.from({length: 6}, () => [2, -3, 4]));
check('equal_positions_different_tangents', [endpoint(-3, [0, 0, 0], [.1, 0, 0], [-.02, 0, 0]), endpoint(7, [0, 0, 0], [-.1, 0, 0], [-.02, 0, 0])],
  reference([[0, 1, -1], [0], [0]], [-3, 7]));
const translatedEndpoints = primaryEndpoints.map(item => ({...structuredClone(item), pointMM: item.pointMM.map((value, i) => value + [-5, 2, -3][i])}));
check('negative_translated', translatedEndpoints, reference(primaryCoefficients, [-3, 7], [-5, 2, -3]), primaryPoles.map(point => point.map((value, i) => value + [-5, 2, -3][i])));
const rescaledEndpoints = [endpoint(2, [0, 0, 0], [1 / 3, 0, 0], [0, 2 / 9, 0]), endpoint(5, [1, 1, 0], [1 / 3, 2 / 3, 2 / 3], [0, 2 / 9, 14 / 9])];
const rescaled = check('rescaled_domain', rescaledEndpoints, reference(primaryCoefficients, [2, 5]), primaryPoles);
for (const fraction of [.2, .5, .8]) {
  const before = evaluateCurveD2(primary.curve, -3 + 10 * fraction), after = evaluateCurveD2(rescaled.curve, 2 + 3 * fraction);
  close(after.point, before.point, 'same shape changed domain'); close(after.derivative, before.derivative.map(value => value * 10 / 3), 'original-unit D1 scale', 1e-7, true);
  close(after.secondDerivative, before.secondDerivative.map(value => value * 100 / 9), 'original-unit D2 scale', 1e-7, true);
}
const signedEndpoints = [endpoint(-0, [-0, 0, -0], [-0, 0, -0], [-0, 0, -0]), endpoint(1, [-0, 0, -0], [-0, 0, -0], [-0, 0, -0])];
const signed = check('signed_zero', signedEndpoints, reference([[0], [0], [0]], [0, 1]));
assert.ok(Object.is(signed.curve.controlPoints[0][0], -0) && Object.is(signed.curve.controlPoints[5][0], -0)); assert.ok(signed.source.includes('-0'));
function intact() {
  for (const row of accepted) { bits({endpoints: row.endpoints, settings: row.settings}, row.before); bits(row.result, row.beforeResult); }
  for (const [file, bytes] of retainedFiles) assert.deepEqual(readFileSync(file), bytes, file);
}
const h = 2 ** -538, subnormalEndpoints = [endpoint(0, [0, 0, 0], [0, 0, 0], [10000, 0, 0]), endpoint(h, [1250 * Number.MIN_VALUE, 0, 0], [10000 * h, 0, 0], [10000, 0, 0])];
assert.equal(h * h, 0); let subnormalReceipt;
try {
  const result = check('representable_scaled_subnormal', subnormalEndpoints,
    parameter => ({point: [(5000 * parameter) * parameter, 0, 0], derivative: [10000 * parameter, 0, 0], secondDerivative: [10000, 0, 0]}), null, [0, .5, 1]);
  bits(result.curve.controlPoints, [0, 0, 125, 375, 750, 1250].map(value => [value * Number.MIN_VALUE, 0, 0]));
  subnormalReceipt = {status: 'accepted-by-actual-native-D2', span: h, separatelyComputedSpanSquared: h * h, generatedPoles: result.curve.controlPoints};
} catch (error) {
  assert.ok(error instanceof QuinticHermiteError, 'Subnormal control must fail through a real public diagnostic');
  assert.ok(['NATIVE', 'BINDING'].includes(error.code), 'Representable scaled offset cannot be refused solely because h squared underflows');
  if (error.code === 'NATIVE') assert.ok(error.cause instanceof Error);
  subnormalReceipt = {status: 'actual-native-refusal', code: error.code, message: error.message, causeName: error.cause?.name ?? null, causeMessage: error.cause?.message ?? null}; intact();
}
jsonFile('subnormal.actual-native-receipt', subnormalReceipt);
function reject(name, action, code) {
  assert.throws(action, error => { assert.ok(error instanceof QuinticHermiteError); assert.equal(error.code, code); assert.ok(error.message.length <= 1024);
    failures.push({name, code: error.code, message: error.message, causeName: error.cause?.name ?? null}); intact(); return true; });
}
const invalid = alter => { const endpoints = structuredClone(primaryEndpoints); alter(endpoints); return endpoints; };
reject('endpoint_budget', () => build(primaryEndpoints, {...options('budget'), maximumEndpointEvaluations: 1}), 'BUDGET');
reject('budget_range', () => build(primaryEndpoints, {...options('budget_range'), maximumEndpointEvaluations: 3}), 'BUDGET');
reject('invalid_id', () => build(primaryEndpoints, options('invalid id')), 'IDENTITY');
reject('reversed_domain', () => build(invalid(endpoints => { endpoints[1].parameter = -4; }), options('domain')), 'REPRESENTABILITY');
reject('zero_span', () => build(invalid(endpoints => { endpoints[1].parameter = -3; }), options('span')), 'REPRESENTABILITY');
reject('nonfinite_input', () => build(invalid(endpoints => { endpoints[0].derivativeMMPerParameter[0] = Infinity; }), options('nonfinite')), 'INPUT');
reject('input_component_bound', () => build(invalid(endpoints => { endpoints[0].secondDerivativeMMPerParameterSquared[0] = 10001; }), options('bound')), 'INPUT');
reject('genuine_first_offset_underflow', () => build([endpoint(0, [0, 0, 0], [Number.MIN_VALUE, 0, 0], [0, 0, 0]), endpoint(1, [1, 0, 0], [0, 0, 0], [0, 0, 0])], options('underflow_d')), 'REPRESENTABILITY');
reject('genuine_second_offset_underflow', () => build([endpoint(0, [0, 0, 0], [0, 0, 0], [Number.MIN_VALUE, 0, 0]), endpoint(1, [1, 0, 0], [0, 0, 0], [0, 0, 0])], options('underflow_s')), 'REPRESENTABILITY');
reject('lost_nonzero_offset', () => build([endpoint(0, [10000, 0, 0], [1e-12, 0, 0], [0, 0, 0]), endpoint(1, [10000, 0, 0], [0, 0, 0], [0, 0, 0])], options('lost')), 'REPRESENTABILITY');
reject('generated_pole_cap', () => build([endpoint(0, [10000, 0, 0], [.5, 0, 0], [0, 0, 0]), endpoint(10, [10000, 0, 0], [0, 0, 0], [0, 0, 0])], options('pole_cap')), 'REPRESENTABILITY');
let getterCalls = 0;
const getter = structuredClone(primaryEndpoints); Object.defineProperty(getter[0], 'pointMM', {enumerable: true, get() { getterCalls++; return [0, 0, 0]; }});
reject('endpoint_getter', () => build(getter, options('getter')), 'INPUT');
const optionsGetter = options('options_getter'); Object.defineProperty(optionsGetter, 'maximumEndpointEvaluations', {enumerable: true, get() { getterCalls++; return 2; }});
reject('options_getter', () => build(primaryEndpoints, optionsGetter), 'INPUT'); assert.equal(getterCalls, 0);
reject('unknown_endpoint_field', () => build([{...primaryEndpoints[0], cached: true}, primaryEndpoints[1]], options('unknown')), 'INPUT');
const cyclic = structuredClone(primaryEndpoints); cyclic[0].pointMM = cyclic;
reject('cyclic_data', () => build(cyclic, options('cycle')), 'INPUT');
for (const [name, alter] of [
  ['endpoint', result => { result.endpoints[0].derivativeMMPerParameter[0] += .1; }], ['pole', result => { result.curve.controlPoints[1][0] += .1; }],
  ['source', result => { result.source = result.source.replace('degree:5', 'degree:4'); }], ['offset', result => { result.report.firstDerivativeOffsetsMM[0][0] += .1; }],
  ['observation', result => { result.report.observations[0].actual.secondDerivative[1] += .1; }], ['counter', result => { result.report.endpointEvaluationCount++; }],
]) { const changed = structuredClone(primary); alter(changed); reject('owned_' + name, () => validate(changed), 'OWNED'); }
let replacement = primary; const previous = replacement;
reject('atomic_prior_curve', () => { replacement = build(primaryEndpoints, {...options('atomic'), maximumEndpointEvaluations: 1}); }, 'BUDGET');
assert.strictEqual(replacement, previous); jsonFile('atomic-retention', {priorCurveUnchanged: replacement === previous, getterCalls});
const packageRoot = resolve(repo, 'packages/barocss-cad'), manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.publishConfig?.exports?.['.'] ?? manifest.exports['.'], runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath)); const publicAPI = await import(pathToFileURL(runtimePath).href);
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function'); assert.deepEqual(publicAPI.QuinticHermiteDiagnosticCode, QuinticHermiteDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./nurbs/curves/quintic-hermite-curve.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/nurbs/curves/quintic-hermite-curve.d.ts'), declaration = readFileSync(leafDeclarationPath, 'utf8');
for (const name of [...runtimeNames, ...typeNames]) assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(declaration), name);
for (const row of cases) {
  const request = JSON.parse(readFileSync(row.requestFile, 'utf8')), stored = JSON.parse(readFileSync(row.resultFile, 'utf8'));
  const cold = publicAPI.compileCadModel(readFileSync(row.sourceFile, 'utf8'), {sourceVersion: 0}); assert.equal(cold.ok, true); bits(cold.model, stored.model);
  assert.deepEqual(publicAPI.buildQuinticHermiteCurve(request.endpoints, request.options), stored); assert.deepEqual(publicAPI.validateQuinticHermiteCurve(stored), stored.report);
}
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 8,
  exportSelection: manifest.publishConfig?.exports?.['.'] ? 'publishConfig.exports root' : 'exports root'};
jsonFile('compiled-consumer', compiledConsumer); intact();
const summary = {sourceMode: true, cadSourceInputCount: cadInputs.length, cases, failures, compiledConsumer, subnormalReceipt, caseCount: cases.length,
  refusalCount: failures.length, getterCalls, independentReference: 'closed tau polynomial and exact mathematical quintic Bernstein poles in original endpoint domain',
  scope: 'Native quintic endpoint point/D1/D2 construction and actual local derivative observations; no curvature, regularity, G2 or entire-curve accuracy certificate.'};
jsonFile('summary', summary); intact(); console.log(JSON.stringify(summary));
