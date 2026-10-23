import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.filter(arg => arg === '--source').length, 1,
  'Usage: node curve-wide-reversal-demo.mjs --source [output-directory]');
const destinations = args.filter(arg => arg !== '--source');
assert.ok(destinations.length <= 1);
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const output = resolve(destinations[0] ?? '/tmp/barocss-wide-curve-reversal-prototype');
mkdirSync(output, {recursive: true});
const inputFile = '/Users/user/.barocss-ai/v3/evidence-686-cad/demo-output/wide_64.refined.source0.css';
const editedInputFile = '/Users/user/.barocss-ai/v3/evidence-804-cad/demo-output/coordinate_and_weight.candidate.source0.css';
const old31InputFile = '/Users/user/.barocss-ai/v3/evidence-686-cad/demo-output/wide_64.original.source0.css';
const inputBytes = readFileSync(inputFile), editedInputBytes = readFileSync(editedInputFile), old31InputBytes = readFileSync(old31InputFile);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

// Bundle current source only. The parent witness and compiled API are separate.
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
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/nurbs/source-wide/curve-wide-reversal.ts')));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' +
  Buffer.from(built.outputFiles[0].text).toString('base64'));
const {
  reverseCurveWide: reverse, validateWideReversedCurveResult: validate,
  WideCurveReversalError, WideCurveReversalDiagnosticCode,
  reverseCurve, validateReversedCurveResult, evaluateCurve, evaluateCurveD1, curveDomain, compileCadModel,
} = api;
for (const operation of [reverse, validate, WideCurveReversalError]) assert.equal(typeof operation, 'function');
assert.deepEqual(Object.keys(WideCurveReversalDiagnosticCode).sort(),
  ['INPUT', 'IDENTITY', 'DOMAIN', 'REPRESENTABILITY', 'BUDGET', 'NATIVE', 'BINDING', 'OWNED'].sort());

const summaries = [], failures = [];
const write = (name, value) => writeFileSync(resolve(output, name), JSON.stringify(value, null, 2) + '\n');
const difference = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
const close = (a, b, tolerance = 1e-7) => assert.ok(difference(a, b) <= tolerance);

// Retain every copied coefficient, source-domain and parameter -0 bit on reopen.
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

function d1(input, parameter) {
  try { return {status: 'evaluated', value: evaluateCurveD1(input, parameter)}; }
  catch (error) { return {status: 'native-refused', reason: error.message.slice(0, 1024)}; }
}

function check(name, input) {
  const before = structuredClone(input), options = {curveId: name};
  const result = reverse(input, options), domain = curveDomain(input), [a, b] = domain;
  const map = parameter => parameter === a ? b : parameter === b ? a : a + (b - parameter);
  assert.deepEqual(input, before);
  assert.deepEqual(Object.keys(result).sort(), ['original', 'options', 'curve', 'source', 'sourceVersion', 'model',
    'originalSource', 'originalModel', 'provenance', 'report'].sort());
  assert.deepEqual(result.original, input);
  assert.deepEqual(result.options, options);
  assert.equal(result.curve.id, name);
  assert.equal(result.curve.kind, input.kind);
  assert.equal(result.curve.degree, input.degree);
  assert.equal(result.curve.controlPoints.length, input.controlPoints.length);
  assert.deepEqual(curveDomain(result.curve), domain);
  for (let reversedIndex = 0; reversedIndex < input.controlPoints.length; reversedIndex++) {
    const originalIndex = input.controlPoints.length - 1 - reversedIndex;
    for (let axis = 0; axis < 3; axis++) {
      assert.ok(Object.is(result.curve.controlPoints[reversedIndex][axis], input.controlPoints[originalIndex][axis]));
    }
    assert.ok(Object.is(result.curve.weights[reversedIndex], input.weights[originalIndex]));
  }
  assert.equal(result.curve.knots.length, input.knots.length);
  for (let index = 0; index < input.knots.length; index++) {
    const originalKnot = input.knots[input.knots.length - 1 - index];
    const expected = index <= input.degree ? a : index >= input.controlPoints.length ? b : map(originalKnot);
    assert.ok(Object.is(result.curve.knots[index], expected));
  }
  const provenance = result.provenance;
  assert.equal(provenance.originalCurveId, input.id);
  assert.equal(provenance.reversedCurveId, name);
  assert.deepEqual(provenance.domain, domain);
  assert.deepEqual(provenance.decreasingParameterMap, {formula: 'u=a+(b-v)', orientation: -1, d1Factor: -1,
    endpointAssignments: {reversedStart: {reversed: a, original: b}, reversedEnd: {reversed: b, original: a}}});
  for (const field of ['controlPointMappings', 'weightMappings']) {
    assert.deepEqual(provenance[field], Array.from({length: input.controlPoints.length}, (_, reversedIndex) =>
      ({originalIndex: input.controlPoints.length - 1 - reversedIndex, reversedIndex, origin: 'original-bit-copy'})));
  }
  assert.equal(provenance.knotMappings.length, input.knots.length);
  for (const mapping of provenance.knotMappings) {
    assert.equal(mapping.originalIndex, input.knots.length - 1 - mapping.reversedIndex);
    assert.ok(Object.is(mapping.originalValue, input.knots[mapping.originalIndex]));
    assert.ok(Object.is(mapping.reversedValue, result.curve.knots[mapping.reversedIndex]));
    assert.equal(mapping.origin, mapping.originalValue === b ? 'copied-domain-min'
      : mapping.originalValue === a ? 'copied-domain-max' : 'generated-reflection');
  }
  const report = result.report;
  assert.equal(report.family, 'own-native-wide-positive-rational-curve-reversal');
  assert.deepEqual(report.dto, {schema: 'barocss-native-wide-reversed-curve', version: 0, lengthUnit: 'mm',
    frame: 'authored-xyz-no-axis-conversion', representation: 'native-curve-not-wire-topology'});
  assert.equal(report.originalCurveId, input.id);
  assert.equal(report.curveId, name);
  assert.equal(report.degree, input.degree);
  assert.equal(report.poleCount, input.controlPoints.length);
  assert.equal(report.knotCount, input.knots.length);
  assert.deepEqual(report.domain, domain);
  assert.equal(report.observationCount, report.observations.length);
  assert.equal(report.guardCount, report.guards.length);
  assert.ok(report.observations.length <= 256 && report.guards.length <= 64);
  assert.equal(report.geometricValidity, 'not-certified');
  assert.equal(report.topologyCertified, false);
  assert.equal(report.solid, false);
  assert.deepEqual(report.inputProfile, {degreeRange: [1, 3], poleRange: [2, 64], maximumKnots: 70, coordinateAbsMM: 10000,
    weightRange: [1e-6, 1e6], positive: true, clamped: true, nonperiodic: true});
  assert.deepEqual(report.quality, {pointComparisonMM: 1e-7, relativeD1Comparison: 1e-7, localObservationsOnly: true,
    globalShapeErrorCertified: false, globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false,
    controlAndWeightBitsPreserved: true, generatedInteriorKnotBitsCertified: false, doubleReversalBitsCertified: false,
    derivativeSemantics: 'native-c0-guards-unchanged-no-g1-g2-claim',
    nativeGuardStates: 'original-knot-mapped-original-parameter-and-reversed-knot-observed-separately',
    arithmetic: '64-epsilon-nonzero-cancellation-and-order-refusal',
    sourceText: 'regenerated-from-supplied-native-curve-not-original-file-formatting',
    ownership: 'copied-cpu-data-gc-no-renderer-resources'});
  assert.equal(report.budgetFailure, 'atomic-refusal-no-partial-result');
  assert.deepEqual(report.limits, {maximumDegree: 3, maximumPoles: 64, nativeMathPoles: 64, nativeSourceKnots: 70,
    maximumObservations: 256, maximumGuards: 64, inputValues: 32768, inputDepth: 8, inputArrayElements: 128,
    inputRecordFields: 16, inputStringCharacters: 128, snapshotValues: 524288, snapshotDepth: 32,
    arrayElements: 4096, recordFields: 64, sourceStringCharacters: 262144, authoredIdCharacters: 48});
  for (const observation of report.observations) {
    assert.ok(Object.is(observation.originalParameter, map(observation.reversedParameter)));
    assert.deepEqual(observation.originalPointMM, evaluateCurve(input, observation.originalParameter));
    assert.deepEqual(observation.reversedPointMM, evaluateCurve(result.curve, observation.reversedParameter));
    assert.equal(observation.pointDifferenceMM, difference(observation.originalPointMM, observation.reversedPointMM));
    close(observation.originalPointMM, observation.reversedPointMM);
    assert.deepEqual(observation.originalD1, d1(input, observation.originalParameter));
    assert.deepEqual(observation.reversedD1, d1(result.curve, observation.reversedParameter));
    const expected = observation.originalD1.status === 'evaluated'
      ? observation.originalD1.value.derivative.map(value => -value) : null;
    assert.deepEqual(observation.expectedDerivativeMM, expected);
    if (expected !== null && observation.reversedD1.status === 'evaluated') {
      assert.equal(observation.derivativeDifferenceMM, difference(expected, observation.reversedD1.value.derivative));
      close(expected, observation.reversedD1.value.derivative, 1e-7 * Math.max(1, Math.hypot(...expected)));
    } else assert.equal(observation.derivativeDifferenceMM, null);
  }
  assert.equal(report.maximumPointDifferenceMM, Math.max(...report.observations.map(observation => observation.pointDifferenceMM)));
  assert.equal(report.maximumRelativeDerivativeDifference, Math.max(0, ...report.observations.map(observation =>
    observation.derivativeDifferenceMM === null || observation.expectedDerivativeMM === null ? 0
      : observation.derivativeDifferenceMM / Math.max(1, Math.hypot(...observation.expectedDerivativeMM)))));
  const guarded = [];
  for (const knot of input.knots) if (knot > a && knot < b && !guarded.includes(knot)
    && input.knots.filter(value => value === knot).length >= input.degree) guarded.push(knot);
  assert.deepEqual(report.guards.map(guard => guard.originalParameter), guarded);
  for (const guard of report.guards) {
    assert.ok(Object.is(guard.reversedParameter, map(guard.originalParameter)));
    assert.deepEqual(guard.originalAtOriginalKnot, d1(input, guard.originalParameter));
    assert.deepEqual(guard.originalAtMappedParameter, d1(input, map(guard.reversedParameter)));
    assert.deepEqual(guard.reversedAtReversedKnot, d1(result.curve, guard.reversedParameter));
    assert.equal(guard.originalAtOriginalKnot.status, 'native-refused');
    assert.equal(guard.reversedAtReversedKnot.status, 'native-refused');
  }
  assert.equal(result.sourceVersion, 0);
  assert.equal(result.originalModel.name, 'curve_reverse_original');
  assert.equal(result.model.name, name);
  assert.deepEqual(result.originalModel.objects, [input]);
  assert.deepEqual(result.model.objects, [result.curve]);
  const originalSourceFile = sourceFile(name + '.original_regenerated', result.originalSource, result.originalModel);
  const reversedSourceFile = sourceFile(name + '.reversed', result.source, result.model);
  assert.deepEqual(validate(result), report);
  const ownedFile = resolve(output, name + '.owned-native-result.json');
  writeFileSync(ownedFile, nativeJSON(result) + '\n');
  const reopened = JSON.parse(readFileSync(ownedFile, 'utf8'));
  assert.deepEqual(reopened, result);
  assert.deepEqual(validate(reopened), report);
  assert.deepEqual(readFileSync(inputFile), inputBytes);
  assert.deepEqual(readFileSync(editedInputFile), editedInputBytes);
  summaries.push({name, originalId: input.id, originalPoles: input.controlPoints.length, originalKnots: input.knots.length,
    domain, observations: report.observationCount, guards: report.guardCount,
    maximumPointDifferenceMM: report.maximumPointDifferenceMM,
    maximumRelativeDerivativeDifference: report.maximumRelativeDerivativeDifference,
    originalSourceFile, reversedSourceFile, ownedFile});
  return result;
}

write('source-api.metafile.json', built.metafile);
write('source-api.inputs.json', {entry, mode: 'in-memory-esbuild', write: false,
  cadInputs, allInputs: sourceInputs, esbuildVersion: esbuild.version});
const originalModel = compileSource(inputBytes.toString('utf8'));
assert.equal(originalModel.objects.length, 1);
const original = originalModel.objects[0];
assert.equal(original.degree, 3);
assert.equal(original.controlPoints.length, 64);
assert.equal(original.knots.length, 68);
let spanCount = 0;
for (let k = original.degree; k < original.controlPoints.length; k++) if (original.knots[k] < original.knots[k + 1]) spanCount++;
assert.equal(spanCount, 37);
const originalBefore = structuredClone(original);
const reversed = check('wide64_reversed', original), reversedBefore = structuredClone(reversed);
assert.ok(Object.is(curveDomain(reversed.curve)[0], -0));
assert.equal(reversed.report.observationCount, 149);
const acceptedSourceFile = resolve(output, 'wide64_reversed.reversed.source0.css');
const acceptedSourceBytes = readFileSync(acceptedSourceFile);
assert.notEqual(reversed.originalSource, inputBytes.toString('utf8'));

// The actual804 same-ID coordinate/weight edit remains a separate native input.
const editedModel = compileSource(editedInputBytes.toString('utf8')), edited = editedModel.objects[0];
assert.equal(edited.id, original.id);
assert.equal(edited.controlPoints.length, 64);
assert.equal(edited.knots.length, 68);
assert.equal(edited.weights[63], 1.5);
assert.notDeepEqual(edited, original);
const editedBefore = structuredClone(edited);
const editedReversed = check('edited64_reversed', edited);
assert.equal(editedReversed.curve.weights[0], 1.5);
assert.deepEqual(reversed, reversedBefore);
assert.deepEqual(original, originalBefore);
assert.deepEqual(readFileSync(acceptedSourceFile), acceptedSourceBytes);

const small = {kind: 'curve', id: 'weighted_nonunit', degree: 2, knots: [-3, -3, -3, 1, 1, 7, 7, 7],
  controlPoints: [[-2, -0, -0], [0, 3, 1], [3, 0, 2], [5, -2, 4], [6, 1, 5]], weights: [1, 2, .75, 1.5, 1]};
const smallResult = check('nonunit_reversed', small);
const exactZero = smallResult.report.observations.find(observation => observation.reversedParameter === 4);
assert.ok(exactZero);
assert.ok(Object.is(exactZero.originalParameter, 0));
assert.equal(smallResult.report.guards[0].originalParameter, 1);
assert.equal(smallResult.report.guards[0].reversedParameter, 3);

function reject(name, action, code) {
  assert.throws(action, error => {
    assert.ok(error instanceof WideCurveReversalError);
    assert.equal(error.name, 'WideCurveReversalError');
    assert.ok(error.message.startsWith('Wide Curve reversal: '));
    assert.equal(error.code, code);
    failures.push({name, code: error.code, message: error.message, actualCausePreserved: Object.hasOwn(error, 'cause')});
    assert.deepEqual(original, originalBefore);
    assert.deepEqual(edited, editedBefore);
    assert.deepEqual(reversed, reversedBefore);
    assert.deepEqual(readFileSync(inputFile), inputBytes);
    assert.deepEqual(readFileSync(editedInputFile), editedInputBytes);
    assert.deepEqual(readFileSync(acceptedSourceFile), acceptedSourceBytes);
    return true;
  });
}

const overCapacity = {kind: 'curve', id: 'over_capacity', degree: 1,
  knots: [0, 0, ...Array.from({length: 63}, (_, index) => index + 1), 64, 64],
  controlPoints: Array.from({length: 65}, (_, index) => [index, 0, 0]), weights: Array(65).fill(1)};
reject('65_pole_capacity', () => reverse(overCapacity, {curveId: 'bad_capacity'}), 'INPUT');
reject('same_derived_id', () => reverse(original, {curveId: original.id}), 'IDENTITY');
let getterCalls = 0;
const getter = {};
Object.defineProperty(getter, 'curveId', {
  enumerable: true, get() { getterCalls++; return 'getter_curve'; },
});
reject('option_getter', () => reverse(original, getter), 'INPUT');
assert.equal(getterCalls, 0);
const unsafe = {kind: 'curve', id: 'unsafe_reflection', degree: 1, knots: [0, 0, Number.MIN_VALUE, 1, 1],
  controlPoints: [[0, 0, 0], [1, 2, 3], [2, 3, 4]], weights: [1, 1, 1]};
reject('reflection_collapse', () => reverse(unsafe, {curveId: 'unsafe_reversed'}), 'REPRESENTABILITY');
for (const [name, alter] of [
  ['coefficient', result => result.curve.controlPoints[0][0] += .1],
  ['mapping', result => result.provenance.controlPointMappings[0].originalIndex--],
  ['source', result => result.source += ' '],
  ['guard', result => result.report.guards[0].reversedParameter += .01],
]) {
  const changed = structuredClone(reversed);
  alter(changed);
  reject('owned_' + name + '_tamper', () => validate(changed), 'OWNED');
}
assert.deepEqual(validate(reversed), reversed.report);

// ONE old31 witness: bundle only the exact archived parent source entry in memory.
const parentCommit = '2a8070914a3ba55100e915613ffd81714543ae29';
const parentSourceRoot = '/Users/user/.barocss-ai/v3/evidence-839-cad/immutable-parent-source';
const parentEntry = resolve(parentSourceRoot, 'packages/barocss-cad/src/nurbs/curves/curve-reversal.ts');
assert.ok(existsSync(parentEntry));
const parentBuilt = await esbuild.build({absWorkingDir: parentSourceRoot, entryPoints: [parentEntry],
  bundle: true, platform: 'node', format: 'esm', write: false, target: 'es2022', metafile: true});
assert.equal(parentBuilt.outputFiles.length, 1);
const parentSourceInputs = Object.keys(parentBuilt.metafile.inputs).map(path => resolve(parentSourceRoot, path));
assert.ok(parentSourceInputs.includes(parentEntry));
assert.ok(parentSourceInputs.every(path => path.startsWith(parentSourceRoot + '/')));
assert.ok(!parentSourceInputs.some(path => path.includes('/dist/')));
const parentAPI = await import('data:text/javascript;base64,' +
  Buffer.from(parentBuilt.outputFiles[0].text).toString('base64'));
const old31Model = compileSource(old31InputBytes.toString('utf8')), old31 = old31Model.objects[0];
assert.equal(old31.controlPoints.length, 31);
const oldOptions = {curveId: 'old31_reversed'};
const parentWitness = parentAPI.reverseCurve(old31, oldOptions), currentWitness = reverseCurve(old31, oldOptions);
assert.deepEqual(currentWitness, parentWitness);
assert.deepEqual(validateReversedCurveResult(currentWitness), currentWitness.report);
writeFileSync(resolve(output, 'old31.exact-complete-result.json'), nativeJSON(currentWitness) + '\n');
write('old31.parent-source.metafile.json', parentBuilt.metafile);
write('old31.witness.json', {parentCommit, parentEntry, parentEntrySha256: hash(readFileSync(parentEntry)),
  parentSourceInputs, mode: 'one-in-memory-parent-source-entry-bundle-no-parent-build',
  old31InputFile, old31InputSha256: hash(old31InputBytes), comparison: 'one exact complete old31 result',
  originalPoles: old31.controlPoints.length, observations: currentWitness.report.observations.length});
assert.deepEqual(readFileSync(old31InputFile), old31InputBytes);

// Actual current public compiled JS and all six declarations use manifest entries.
const packageRoot = resolve(repo, 'packages/barocss-cad');
const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath));
assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const runtimeExports = ['reverseCurveWide', 'validateWideReversedCurveResult', 'WideCurveReversalError', 'WideCurveReversalDiagnosticCode'];
for (const name of runtimeExports) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.WideCurveReversalDiagnosticCode, WideCurveReversalDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./curve-wide-reversal.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/nurbs/source-wide/curve-wide-reversal.d.ts');
const leafDeclaration = readFileSync(leafDeclarationPath, 'utf8');
const declarationExports = [...runtimeExports, 'WideReversedCurveReport', 'WideReversedCurveResult'];
for (const name of declarationExports) {
  assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(leafDeclaration), name);
}
assert.ok(leafDeclaration.includes('export type WideCurveReversalDiagnosticCode'));
const compiledOriginal = publicAPI.compileCadModel(inputBytes.toString('utf8'), {sourceVersion: 0});
assert.equal(compiledOriginal.ok, true);
const compiled = publicAPI.reverseCurveWide(compiledOriginal.model.objects[0], reversed.options);
assert.deepEqual(compiled, reversed);
assert.deepEqual(publicAPI.validateWideReversedCurveResult(compiled), reversed.report);
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeExports, declarationExports,
  originalPoles: compiled.original.controlPoints.length, reversedPoles: compiled.curve.controlPoints.length,
  observations: compiled.report.observationCount, guards: compiled.report.guardCount,
  declarationCheck: 'actual exported declaration text; no separate TypeScript invocation'};
write('compiled-consumer.json', compiledConsumer);
write('summary.json', {sourceMode: true, cadSourceInputCount: cadInputs.length, inputFile, inputSha256: hash(inputBytes),
  editedInputFile, editedInputSha256: hash(editedInputBytes), summaries, failures, compiledConsumer,
  parentCommit, parentEntry, exactOld31CompleteResultMatch: true,
  scope: 'Actual64-pole original and edited native sources with bit-copy control/weight reversal and guarded reflected knots. Native original/mapped points, negative D1 and C0 states are distinct local evidence. Regenerated source does not recover caller formatting. One archived-source old31 witness only; no double-reversal knot-bit, global shape/G1/G2/topology/solid/manufacturing certificate, parent build or reader campaign.'});
console.log(JSON.stringify({sourceMode: true, cadSourceInputCount: cadInputs.length,
  summaries, failures, compiledConsumer, parentCommit, parentEntry}));
