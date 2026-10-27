import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.filter(arg => arg === '--source').length, 1,
  'Usage: node curve-wide-control-polygon-demo.mjs --source [output-directory]');
const destinations = args.filter(arg => arg !== '--source');
assert.ok(destinations.length <= 1);
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const output = resolve(destinations[0] ?? '/tmp/barocss-wide-curve-control-polygon-prototype');
mkdirSync(output, {recursive: true});
const inputFile = '/Users/user/.barocss-ai/v3/evidence-686-cad/demo-output/wide_64.refined.source0.css';
const inputBytes = readFileSync(inputFile), inputSource = inputBytes.toString('utf8');
assert.deepEqual(Buffer.from(inputSource, 'utf8'), inputBytes);
const copiedInputFile = resolve(output, 'original64.input.source0.css');
assert.notEqual(copiedInputFile, inputFile);
writeFileSync(copiedInputFile, inputBytes);
assert.deepEqual(readFileSync(copiedInputFile), inputBytes);

// Current source only; manifest-declared compiled consumers are separate below.
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
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/nurbs/source-wide/curve-wide-control-polygon.ts')));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' +
  Buffer.from(built.outputFiles[0].text).toString('base64'));
const {
  editCurveControlPolygonWide: edit, validateWideCurveControlPolygonEdit: validate,
  WideCurveControlPolygonEditError, WideCurveControlPolygonEditDiagnosticCode,
  editCurveControlPolygon, evaluateCurve, evaluateCurveD1, curveDomain, compileCadModel,
} = api;
for (const operation of [edit, validate, WideCurveControlPolygonEditError]) assert.equal(typeof operation, 'function');
assert.deepEqual(Object.keys(WideCurveControlPolygonEditDiagnosticCode).sort(),
  ['INPUT', 'IDENTITY', 'BUDGET', 'NATIVE', 'BINDING', 'OWNED'].sort());

const summaries = [], failures = [];
const fields = ['xMM', 'yMM', 'zMM', 'weight'];
const write = (name, value) => writeFileSync(resolve(output, name), JSON.stringify(value, null, 2) + '\n');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const difference = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));

// Keep authored negative zero in all original/candidate/provenance/observation data.
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
  try { return {kind: 'evaluated', result: evaluateCurveD1(input, parameter)}; }
  catch (error) {
    assert.equal(error.message, 'First derivative is not defined at an exact C0 interior knot');
    return {kind: 'refused', message: error.message};
  }
}

function coefficient(input, index, field) {
  return field === 'weight' ? input.weights[index] : input.controlPoints[index][fields.indexOf(field)];
}

function check(name, input, request) {
  const before = structuredClone(input), requestBefore = structuredClone(request);
  const result = edit(input, request);
  assert.deepEqual(input, before);
  assert.deepEqual(request, requestBefore);
  assert.deepEqual(Object.keys(result).sort(), ['original', 'edits', 'curve', 'source', 'sourceVersion', 'model',
    'originalSource', 'originalModel', 'provenance', 'report'].sort());
  assert.deepEqual(result.original, input);
  assert.deepEqual(result.edits, request);
  assert.equal(result.curve.id, input.id);
  assert.equal(result.curve.kind, input.kind);
  assert.equal(result.curve.degree, input.degree);
  assert.deepEqual(result.curve.knots, input.knots);
  assert.deepEqual(curveDomain(result.curve), curveDomain(input));
  assert.equal(result.curve.controlPoints.length, input.controlPoints.length);
  assert.equal(result.curve.weights.length, input.weights.length);
  const requested = new Map(request.poleEdits.map(patch => [patch.index, patch]));
  // Check every scalar with Object.is, including all unrequested signed-zero bits.
  for (let index = 0; index < input.controlPoints.length; index++) {
    const patch = requested.get(index);
    for (const field of fields) {
      const expected = patch && Object.hasOwn(patch, field) ? patch[field] : coefficient(input, index, field);
      assert.ok(Object.is(coefficient(result.curve, index, field), expected), `${name}: pole${index}/${field}`);
    }
  }
  const expectedProvenance = request.poleEdits.map(patch => {
    const requestedFields = fields.filter(field => Object.hasOwn(patch, field));
    return {index: patch.index, requestedFields,
      changedFields: requestedFields.filter(field => !Object.is(patch[field], coefficient(input, patch.index, field))),
      before: {pointMM: input.controlPoints[patch.index], weight: input.weights[patch.index]},
      after: {pointMM: result.curve.controlPoints[patch.index], weight: result.curve.weights[patch.index]}};
  });
  assert.deepEqual(result.provenance, expectedProvenance);
  const report = result.report;
  assert.equal(report.kind, 'wide-curve-control-polygon-edit');
  assert.deepEqual(report.dto, {schema: 'barocss-native-wide-curve-control-polygon-edit', version: 0,
    lengthUnit: 'mm', frame: 'authored-xyz-no-axis-conversion', representation: 'native-curve-coefficient-edit-not-topology-or-fit'});
  const requestedFieldCount = expectedProvenance.reduce((sum, patch) => sum + patch.requestedFields.length, 0);
  const changedFieldCount = expectedProvenance.reduce((sum, patch) => sum + patch.changedFields.length, 0);
  const changedPoleCount = expectedProvenance.filter(patch => patch.changedFields.length > 0).length;
  assert.equal(report.curveId, input.id);
  assert.equal(report.lengthUnit, 'mm');
  assert.deepEqual(report.domain, curveDomain(input));
  assert.equal(report.degree, input.degree);
  assert.equal(report.controlPointCount, input.controlPoints.length);
  assert.equal(report.requestedPoleCount, request.poleEdits.length);
  assert.equal(report.requestedFieldCount, requestedFieldCount);
  assert.equal(report.changedPoleCount, changedPoleCount);
  assert.equal(report.changedFieldCount, changedFieldCount);
  assert.equal(report.untouchedPoleCount, input.controlPoints.length - changedPoleCount);
  assert.equal(report.untouchedFieldCount, input.controlPoints.length * 4 - changedFieldCount);
  assert.equal(report.unrequestedPoleCount, input.controlPoints.length - request.poleEdits.length);
  assert.equal(report.unrequestedFieldCount, input.controlPoints.length * 4 - requestedFieldCount);
  assert.equal(report.noOp, changedFieldCount === 0);
  assert.equal(report.derivativeSemantics, 'native-c0-guards-unchanged-other-arithmetic-refuses');
  assert.equal(report.authority, 'direct-original-and-edited-curve-coefficients');
  assert.equal(report.geometricValidity, 'not-certified');
  assert.equal(report.topologyCertified, false);
  assert.equal(report.solid, false);
  assert.deepEqual(report.inputProfile, {degreeRange: [1, 3], poleRange: [2, 64], maximumKnots: 70, maximumNonzeroSpans: 64,
    coordinateAbsMM: 10000, weightRange: [1e-6, 1e6], positive: true, clamped: true, nonperiodic: true});
  assert.deepEqual(report.quality, {editSemantics: 'absolute-requested-cartesian-and-weight-replacements',
    unrequestedCoefficientBitsPreserved: true, idDegreeKnotDomainAndControlOrderPreserved: true,
    parameterization: 'original-degree-and-knot-domain-retained', sourceText: 'regenerated-from-supplied-native-curve-not-original-file-formatting',
    pointAndDerivativeEffects: 'actual-native-before-and-after-observations', globalShapeErrorCertified: false,
    globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false, g1g2Certified: false,
    ownership: 'copied-cpu-data-gc-no-renderer-resources'});
  assert.equal(report.budgetFailure, 'atomic-refusal-no-partial-result');
  assert.deepEqual(report.limits, {maximumPoles: 64, maximumKnots: 70, maximumDegree: 3, maximumEdits: 64, maximumSpans: 64,
    maximumObservations: 129, maximumDerivativeObservations: 129, authoredIdCharacters: 48,
    inputValues: 32768, inputDepth: 8, inputArrayElements: 128, inputRecordFields: 16, inputStringCharacters: 128,
    snapshotValues: 524288, snapshotDepth: 32, arrayElements: 4096, recordFields: 64, sourceStringCharacters: 262144});
  const domain = curveDomain(input), breaks = [];
  for (const knot of input.knots) if (knot >= domain[0] && knot <= domain[1] && !breaks.some(value => value === knot)) breaks.push(knot);
  const parameters = [...breaks], skipped = [];
  for (let index = 0; index < breaks.length - 1; index++) {
    const low = breaks[index], high = breaks[index + 1], midpoint = low + (high - low) / 2;
    if (midpoint > low && midpoint < high) parameters.push(midpoint);
    else skipped.push({domain: [low, high], attemptedParameter: midpoint, reason: 'no-represented-interior-midpoint'});
  }
  parameters.sort((a, b) => a - b);
  assert.equal(report.originalSpanCount, breaks.length - 1);
  assert.equal(report.observations.length, parameters.length);
  assert.equal(report.derivativeObservations.length, parameters.length);
  assert.ok(parameters.length <= 129);
  assert.deepEqual(report.unrepresentedMidpointIntervals, skipped);
  for (const [index, observation] of report.observations.entries()) {
    assert.ok(Object.is(observation.parameter, parameters[index]));
    assert.deepEqual(observation.beforePointMM, evaluateCurve(input, observation.parameter));
    assert.deepEqual(observation.afterPointMM, evaluateCurve(result.curve, observation.parameter));
    assert.equal(observation.observedChangeMM, difference(observation.afterPointMM, observation.beforePointMM));
    const derivative = report.derivativeObservations[index];
    assert.ok(Object.is(derivative.parameter, observation.parameter));
    assert.deepEqual(derivative.before, d1(input, derivative.parameter));
    assert.deepEqual(derivative.after, d1(result.curve, derivative.parameter));
  }
  assert.equal(report.maximumObservedChangeMM, Math.max(...report.observations.map(observation => observation.observedChangeMM)));
  const guarded = breaks.filter(parameter => parameter > domain[0] && parameter < domain[1]
    && input.knots.filter(knot => knot === parameter).length >= input.degree);
  assert.deepEqual(report.guardedKnots, guarded);
  for (const parameter of guarded) {
    const observation = report.derivativeObservations.find(observation => observation.parameter === parameter);
    assert.equal(observation.before.kind, 'refused');
    assert.equal(observation.after.kind, 'refused');
  }
  assert.equal(result.sourceVersion, 0);
  assert.equal(result.originalModel.name, 'profile');
  assert.equal(result.model.name, 'profile');
  assert.deepEqual(result.originalModel.objects, [input]);
  assert.deepEqual(result.model.objects, [result.curve]);
  // These canonical sources are regenerated from native data, not copied caller text.
  assert.notEqual(result.originalSource, inputSource);
  const originalSourceFile = sourceFile(name + '.original_regenerated', result.originalSource, result.originalModel);
  const candidateSourceFile = sourceFile(name + '.candidate', result.source, result.model);
  assert.deepEqual(validate(result), report);
  const ownedFile = resolve(output, name + '.owned-native-result.json');
  writeFileSync(ownedFile, nativeJSON(result) + '\n');
  const reopened = JSON.parse(readFileSync(ownedFile, 'utf8'));
  assert.deepEqual(reopened, result);
  assert.deepEqual(validate(reopened), report);
  assert.deepEqual(edit(reopened.original, reopened.edits), reopened);
  assert.deepEqual(readFileSync(inputFile), inputBytes);
  assert.deepEqual(readFileSync(copiedInputFile), inputBytes);
  summaries.push({name, originalPoles: input.controlPoints.length, requestedPoles: report.requestedPoleCount,
    requestedFields: requestedFieldCount, changedPoles: changedPoleCount, changedFields: changedFieldCount,
    noOp: report.noOp, observations: report.observations.length, guardedKnots: report.guardedKnots,
    maximumObservedChangeMM: report.maximumObservedChangeMM, originalSourceFile, candidateSourceFile, ownedFile});
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
let spanCount = 0;
for (let k = original.degree; k < original.controlPoints.length; k++) if (original.knots[k] < original.knots[k + 1]) spanCount++;
assert.equal(spanCount, 37);
const originalBefore = structuredClone(original);
const primaryEdits = {poleEdits: [{index: 5, yMM: original.controlPoints[5][1] + .125}, {index: 63, weight: 1.5}]};
const primary = check('coordinate_and_weight', original, primaryEdits);
assert.equal(primary.curve.weights[63], 1.5);
assert.equal(primary.report.changedPoleCount, 2);
assert.equal(primary.report.changedFieldCount, 2);
assert.ok(primary.report.maximumObservedChangeMM > 0);
const primaryBefore = structuredClone(primary);
const primaryFile = resolve(output, 'coordinate_and_weight.candidate.source0.css');
const primaryBytes = readFileSync(primaryFile);
write('actual-source64.json', {inputFile, copiedInputFile, inputSha256: hash(inputBytes), sourceVersion: 0,
  callerModelName: coldModel.name, regeneratedModelName: primary.originalModel.name,
  poles: original.controlPoints.length, knots: original.knots.length, spans: spanCount});

const noOp = check('noop_explicit_minus_zero', original,
  {poleEdits: [{index: 0, xMM: -0, yMM: -0, zMM: -0, weight: 1}]});
assert.deepEqual(noOp.curve, original);
assert.equal(noOp.report.noOp, true);
assert.equal(noOp.report.maximumObservedChangeMM, 0);
assert.ok(Object.is(original.controlPoints[63][1], 0));
const minusZero = check('explicit_minus_zero_change', original, {poleEdits: [{index: 63, yMM: -0}]});
assert.ok(Object.is(minusZero.curve.controlPoints[63][1], -0));
assert.equal(minusZero.report.changedFieldCount, 1);
assert.equal(minusZero.report.noOp, false);

const allEdits = {poleEdits: Array.from({length: 64}, (_, offset) => {
  const index = 63 - offset;
  return {index, yMM: original.controlPoints[index][1] + .0625};
})};
const full = check('all64_requested', original, allEdits);
assert.equal(full.report.requestedPoleCount, 64);
assert.equal(full.report.changedPoleCount, 64);
assert.equal(full.report.changedFieldCount, 64);
assert.equal(full.report.unrequestedPoleCount, 0);
assert.equal(full.report.unrequestedFieldCount, 192);
assert.deepEqual(original, originalBefore);
assert.deepEqual(primary, primaryBefore);
assert.deepEqual(readFileSync(primaryFile), primaryBytes);

function reject(name, action, code) {
  assert.throws(action, error => {
    assert.ok(error instanceof WideCurveControlPolygonEditError);
    assert.equal(error.name, 'WideCurveControlPolygonEditError');
    assert.ok(error.message.startsWith('Wide Curve control-polygon edit: '));
    assert.equal(error.code, code);
    failures.push({name, code: error.code, message: error.message, actualCausePreserved: Object.hasOwn(error, 'cause')});
    assert.deepEqual(original, originalBefore);
    assert.deepEqual(primary, primaryBefore);
    assert.deepEqual(readFileSync(inputFile), inputBytes);
    assert.deepEqual(readFileSync(copiedInputFile), inputBytes);
    assert.deepEqual(readFileSync(primaryFile), primaryBytes);
    return true;
  });
}

reject('duplicate_indices', () => edit(original, {poleEdits: [{index: 5, yMM: .5}, {index: 5, weight: 2}]}), 'INPUT');
reject('coordinate_bound', () => edit(original, {poleEdits: [{index: 63, zMM: 10001}]}), 'INPUT');
reject('weight_bound', () => edit(original, {poleEdits: [{index: 63, weight: 1e-7}]}), 'INPUT');
const overCapacity = {kind: 'curve', id: 'over_capacity', degree: 1,
  knots: [0, 0, ...Array.from({length: 63}, (_, index) => index + 1), 64, 64],
  controlPoints: Array.from({length: 65}, (_, index) => [index, 0, 0]), weights: Array(65).fill(1)};
reject('65_pole_capacity', () => edit(overCapacity, {poleEdits: [{index: 0, yMM: 1}]}), 'INPUT');
reject('65_edit_capacity', () => edit(original, {poleEdits: Array.from({length: 65}, (_, index) => ({index, yMM: 0}))}), 'BUDGET');
let getterCalls = 0;
const getter = {};
Object.defineProperty(getter, 'poleEdits', {
  enumerable: true, get() { getterCalls++; return primaryEdits.poleEdits; },
});
reject('input_getter', () => edit(original, getter), 'INPUT');
assert.equal(getterCalls, 0);
for (const [name, alter] of [
  ['native', result => result.curve.controlPoints[5][1] += .1],
  ['source', result => result.source += ' '],
  ['provenance', result => result.provenance[0].changedFields.push('weight')],
  ['observation', result => result.report.observations[0].afterPointMM[1] += .1],
]) {
  const changed = structuredClone(primary);
  alter(changed);
  reject('owned_' + name + '_tamper', () => validate(changed), 'OWNED');
}
assert.deepEqual(validate(primary), primary.report);

// One exact complete old16 result protects only the extracted patch/provenance block.
const immutableParentRuntimePath = '/Users/user/.codex/worktrees/issue-793-cad/barocss/packages/barocss-cad/dist/index.js';
assert.ok(existsSync(immutableParentRuntimePath));
const parentAPI = await import(pathToFileURL(immutableParentRuntimePath).href);
const oldCurve = {kind: 'curve', id: 'old16_curve', degree: 1,
  knots: [0, 0, ...Array.from({length: 14}, (_, index) => index + 1), 15, 15],
  controlPoints: Array.from({length: 16}, (_, index) =>
    [index === 0 ? -0 : index * .25, index === 0 ? -0 : index * .125, index === 0 ? -0 : index * .5]),
  weights: Array.from({length: 16}, (_, index) => 1 + index * .03125)};
const oldEdits = {poleEdits: [{index: 0, xMM: -0, yMM: -0, zMM: -0, weight: 1},
  {index: 15, yMM: oldCurve.controlPoints[15][1] + .125, weight: 1.25}]};
const immutableWitness = parentAPI.editCurveControlPolygon(oldCurve, oldEdits);
const currentWitness = editCurveControlPolygon(oldCurve, oldEdits);
assert.deepEqual(currentWitness, immutableWitness);
writeFileSync(resolve(output, 'old16.exact-complete-result.json'), nativeJSON(currentWitness) + '\n');
write('old16.witness.json', {immutableParentRuntimePath, comparison: 'one exact complete old16 edit result',
  originalPoles: oldCurve.controlPoints.length, requestedPoles: oldEdits.poleEdits.length,
  changedFields: currentWitness.report.changedFieldCount});

// Current public compiled JS and all six names use the actual manifest entries.
const packageRoot = resolve(repo, 'packages/barocss-cad');
const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath));
assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const runtimeExports = ['editCurveControlPolygonWide', 'validateWideCurveControlPolygonEdit',
  'WideCurveControlPolygonEditError', 'WideCurveControlPolygonEditDiagnosticCode'];
for (const name of runtimeExports) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.WideCurveControlPolygonEditDiagnosticCode, WideCurveControlPolygonEditDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./nurbs/source-wide/curve-wide-control-polygon.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/nurbs/source-wide/curve-wide-control-polygon.d.ts');
const leafDeclaration = readFileSync(leafDeclarationPath, 'utf8');
const declarationExports = [...runtimeExports, 'WideCurveControlPolygonEditReport', 'WideCurveControlPolygonEditResult'];
for (const name of declarationExports) {
  assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(leafDeclaration), name);
}
assert.ok(leafDeclaration.includes('export type WideCurveControlPolygonEditDiagnosticCode'));
const compiledSource = publicAPI.compileCadModel(readFileSync(inputFile, 'utf8'), {sourceVersion: 0});
assert.equal(compiledSource.ok, true);
const compiled = publicAPI.editCurveControlPolygonWide(compiledSource.model.objects[0], primaryEdits);
assert.deepEqual(compiled, primary);
assert.deepEqual(publicAPI.validateWideCurveControlPolygonEdit(compiled), primary.report);
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeExports, declarationExports,
  originalPoles: compiled.original.controlPoints.length, requestedPoles: compiled.report.requestedPoleCount,
  changedFields: compiled.report.changedFieldCount,
  declarationCheck: 'actual exported declaration text; no separate TypeScript invocation'};
write('compiled-consumer.json', compiledConsumer);
write('summary.json', {sourceMode: true, cadSourceInputCount: cadInputs.length, inputFile, copiedInputFile,
  inputSha256: hash(inputBytes), summaries, failures, compiledConsumer, immutableParentRuntimePath,
  exactOld16CompleteResultMatch: true,
  scope: 'Actual64-pole native Cartesian/weight authoring with unchanged IDs/degree/knots/domain and every unrequested bit. Regenerated original/candidate source0 is distinct from separately retained caller file bytes. No-op, explicit signed zero and64 requests retain native point/D1/C0 observations and atomic refusals. No fit, normalization, continuity/global shape/topology/solid/manufacturing certificate, parent/reader campaign or renderer adoption.'});
console.log(JSON.stringify({sourceMode: true, cadSourceInputCount: cadInputs.length,
  inputFile, summaries, failures, compiledConsumer, immutableParentRuntimePath}));
