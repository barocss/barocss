import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 4,
  'Usage: node boolean-extrusion-parameter-lifecycle-demo.mjs --source <output-directory> --graph-directory <saved-graph-directory>');
assert.equal(args[0], '--source');
assert.equal(args[2], '--graph-directory');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const output = resolve(args[1]);
const graphDirectory = resolve(args[3]);
mkdirSync(output, {recursive: true});

// Exact current source graph; compiled JS is a separate consumer at the end.
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
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/boolean-extrusion-parameter-lifecycle.ts')));
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/boolean-extrusion-feature-graph-serde.ts')));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' +
  Buffer.from(built.outputFiles[0].text).toString('base64'));
const {
  transactBooleanExtrusionFeatureGraphParameters: transact,
  evaluateBooleanExtrusionFeatureGraph: evaluate, serializeBooleanExtrusionFeatureGraph: serialize,
  parseBooleanExtrusionFeatureGraph: parse, validateBooleanExtrusionFeatureGraph: validate,
  BooleanExtrusionFeatureGraphError, BooleanExtrusionFeatureGraphDiagnosticCode, compileCadModel,
} = api;
for (const operation of [transact, evaluate, serialize, parse, validate]) assert.equal(typeof operation, 'function');

const summaries = [], failures = [], retainedFiles = new Map();
const difference = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));

// Preserve authored geometry and placement signs through every JSON round trip.
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

function ownedFile(name, value) {
  const file = resolve(output, name + '.json');
  writeFileSync(file, nativeJSON(value) + '\n');
  retainedFiles.set(file, readFileSync(file));
  const reopened = JSON.parse(readFileSync(file, 'utf8'));
  assert.deepEqual(reopened, value);
  return {file, reopened};
}

function sourceFile(name, source, expectedModel) {
  const file = resolve(output, name + '.source0.css');
  writeFileSync(file, source);
  retainedFiles.set(file, readFileSync(file));
  const compiled = compileCadModel(readFileSync(file, 'utf8'), {sourceVersion: 0});
  assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
  if (expectedModel) assert.deepEqual(compiled.model, expectedModel);
  return {file, source: readFileSync(file, 'utf8'), model: compiled.model};
}

function checkOwnership(inputs, result) {
  const caller = new WeakSet();
  const collect = value => {
    if (value && typeof value === 'object' && !caller.has(value)) {
      caller.add(value);
      for (const child of Object.values(value)) collect(child);
    }
  };
  for (const input of inputs) collect(input);
  const seen = new WeakSet();
  const visit = value => {
    if (value && typeof value === 'object') {
      assert.ok(!caller.has(value), 'Graph result aliases caller data');
      assert.ok(!seen.has(value), 'Repeated nested output object occurrence');
      seen.add(value);
      for (const child of Object.values(value)) visit(child);
    }
  };
  visit(result);
}
const accepted = [];
const authoredInputFile = resolve(graphDirectory, 'cross_union.authored-graph.json');
const ownedInputFile = resolve(graphDirectory, 'cross_union.owned-graph-result.json');
const inputProvenance = [];
function readAuthentic(file) {
  const bytes = readFileSync(file); retainedFiles.set(file, bytes);
  inputProvenance.push({file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')});
  return bytes.toString('utf8');
}
const authoredText = readAuthentic(authoredInputFile), ownedInputText = readAuthentic(ownedInputFile);
const originalOwned = JSON.parse(ownedInputText);
assert.deepEqual(validate(originalOwned), originalOwned.report);
const original = parse(authoredText, originalOwned.options);
assert.deepEqual(original, originalOwned); assert.equal(original.document.revision, 0);
assert.deepEqual(original.document.parameters.map(parameter => parameter.id), ['height', 'base_height', 'unused']);
const extrusionId = original.document.features.find(feature => feature.kind === 'normal-extrusion').id;
const boolRow = original.features.find(feature => feature.kind === 'coplanar-boolean');
const originalExtrusion = original.features.find(feature => feature.kind === 'normal-extrusion').evaluation;
const options = original.options;
function sources(result) {
  return result.features.flatMap(row => row.kind === 'face-input'
    ? [{label: row.featureId, source: row.evaluation.source, model: row.evaluation.model}]
    : row.evaluation.sources.map((source, index) => ({label: row.featureId + '.' + index, source: source.source, model: source.model})));
}
const metadataText = readAuthentic(resolve(graphDirectory, 'summary.json'));
const metadata = JSON.parse(metadataText).summaries.find(summary => summary.name === 'cross_union' && summary.revision === 0);
assert.ok(metadata);
const originalSources = sources(original);
assert.equal(metadata.sourceFiles.length, originalSources.length);
for (const [index, file] of metadata.sourceFiles.entries()) {
  const source = readAuthentic(file), expected = originalSources.find(expected => expected.source === source);
  assert.ok(expected, 'Metadata Source0 file must resolve an actual original native result');
  sourceFile('authentic_original_source_' + index, source, expected.model);
}

function save(name, result, revision, distanceMM, parameterIds, resolutionOrder) {
  assert.equal(result.document.revision, revision);
  assert.deepEqual(result.document.parameters.map(parameter => parameter.id), parameterIds);
  assert.deepEqual(result.parameters.map(parameter => parameter.id), resolutionOrder);
  assert.deepEqual(result.report.parameterOrder, resolutionOrder);
  assert.equal(result.report.parameterResolutionCount, parameterIds.length);
  assert.equal(result.report.nativeBuilderCallCount, 4);
  assert.deepEqual(result.report.nativeBuilderCalls, {faceInput: 2, coplanarBoolean: 1, normalExtrusion: 1});
  assert.deepEqual(result.options, options);
  assert.deepEqual(result.document.features.map(feature => [feature.id, feature.kind, feature.outputSlotId]),
    original.document.features.map(feature => [feature.id, feature.kind, feature.outputSlotId]));
  for (const row of result.features) if (row.kind !== 'normal-extrusion') {
    assert.deepEqual(row, original.features.find(original => original.featureId === row.featureId));
  }
  assert.deepEqual(result.document.features.map(feature => feature.options), original.document.features.map(feature => feature.options));
  const extrusion = result.features.find(feature => feature.kind === 'normal-extrusion').evaluation;
  assert.deepEqual(extrusion.region, boolRow.evaluation); assert.equal(extrusion.options.distanceMM, distanceMM);
  assert.equal(extrusion.shells.length, 1); assert.equal(extrusion.region.report.areaUV, 24);
  const expectedTop = extrusion.vertices.filter(vertex => vertex.layer === 'top').map(vertex =>
    vertex.originalPointMM.map((value, axis) => value + extrusion.normal[axis] * distanceMM));
  assert.deepEqual(extrusion.vertices.filter(vertex => vertex.layer === 'top').map(vertex => vertex.pointMM), expectedTop);
  assert.deepEqual(extrusion.vertices.filter(vertex => vertex.layer === 'bottom').map(vertex => vertex.pointMM),
    originalExtrusion.vertices.filter(vertex => vertex.layer === 'bottom').map(vertex => vertex.pointMM));
  if (distanceMM !== 2) assert.notDeepEqual(extrusion.vertices.filter(vertex => vertex.layer === 'top').map(vertex => vertex.pointMM),
    originalExtrusion.vertices.filter(vertex => vertex.layer === 'top').map(vertex => vertex.pointMM));
  const sourceFiles = sources(result).map(source => sourceFile(name + '.' + source.label, source.source, source.model).file);
  assert.deepEqual(validate(result), result.report);
  const file = resolve(output, name + '.authored-graph.json');
  writeFileSync(file, serialize(result.document, result.options)); retainedFiles.set(file, readFileSync(file));
  const authored = JSON.parse(readFileSync(file, 'utf8')); assert.deepEqual(authored, result.document);
  assert.ok(!Object.hasOwn(authored, 'report') && !Object.hasOwn(authored, 'options'));
  const cold = parse(readFileSync(file, 'utf8'), result.options); assert.deepEqual(cold, result);
  const owned = ownedFile(name + '.owned-graph-result', result); assert.deepEqual(validate(owned.reopened), result.report);
  accepted.push({result, before: structuredClone(result), file, ownedFile: owned.file});
  summaries.push({name, revision, distanceMM, parameterIds, resolutionOrder, parameterResolutionCount: parameterIds.length,
    nativeBuilderCalls: result.report.nativeBuilderCalls, sourceFiles, authoredFile: file, ownedFile: owned.file});
  return result;
}
function request(previous, parameterOperations, distanceEdits = []) {
  return {expectedRevision: previous.document.revision, revision: previous.document.revision + 1, parameterOperations, distanceEdits};
}
const upsert = (id, definition) => ({kind: 'upsert', parameter: {id, type: 'length', definition}});
const literal = (id, valueMM) => upsert(id, {kind: 'literal', valueMM});
const remove = parameterId => ({kind: 'remove', parameterId});
const distance = definition => ({featureId: extrusionId, definition});
function transition(name, previous, transaction, revision, height, table, order) {
  const before = structuredClone(previous), inputBefore = structuredClone(transaction), result = transact(previous, transaction);
  checkOwnership([previous, transaction], result); assert.deepEqual(previous, before); assert.deepEqual(transaction, inputBefore);
  const expected = structuredClone(previous.document); expected.revision = transaction.revision;
  for (const operation of transaction.parameterOperations) {
    if (operation.kind === 'remove') expected.parameters = expected.parameters.filter(parameter => parameter.id !== operation.parameterId);
    else {
      const index = expected.parameters.findIndex(parameter => parameter.id === operation.parameter.id);
      if (index === -1) expected.parameters.push(structuredClone(operation.parameter));
      else expected.parameters[index] = structuredClone(operation.parameter);
    }
  }
  for (const edit of transaction.distanceEdits) expected.features.find(feature => feature.id === edit.featureId).distance = structuredClone(edit.definition);
  assert.deepEqual(result.document, expected);
  return save(name, result, revision, height, table, order);
}
ownedFile('source-api.metafile', built.metafile);
ownedFile('source-api.inputs', {entry, mode: 'in-memory-esbuild', write: false,
  cadInputs, allInputs: sourceInputs, esbuildVersion: esbuild.version});
ownedFile('authentic-inputs', inputProvenance);
save('revision0_authentic', original, 0, 2, ['height', 'base_height', 'unused'], ['base_height', 'height', 'unused']);
const transaction1 = request(original, [literal('design_height', 3), remove('height'), remove('base_height')],
  [distance({kind: 'offset', parameterId: 'design_height', offsetMM: 0})]);
const revision1 = transition('revision1_replace_height', original, transaction1, 1, 3, ['unused', 'design_height'], ['unused', 'design_height']);
const revision2 = transition('revision2_create_dependency', revision1,
  request(revision1, [upsert('design_height', {kind: 'offset', parameterId: 'new_base', offsetMM: 1}), literal('new_base', 3)]),
  2, 4, ['unused', 'design_height', 'new_base'], ['unused', 'new_base', 'design_height']);
const revision3 = transition('revision3_repair_removed_dependency', revision2,
  request(revision2, [remove('new_base'), literal('design_height', 5)]), 3, 5, ['unused', 'design_height'], ['unused', 'design_height']);
const revision4 = transition('revision4_literal_without_parameters', revision3,
  request(revision3, [remove('unused'), remove('design_height')], [distance({kind: 'literal', valueMM: 2})]), 4, 2, [], []);
const revision5 = transition('revision5_eight_unused', revision4,
  request(revision4, Array.from({length: 8}, (_, index) => literal('p' + index, index === 0 ? -0 : index))),
  5, 2, Array.from({length: 8}, (_, index) => 'p' + index), Array.from({length: 8}, (_, index) => 'p' + index));
const revision6 = transition('revision6_transient_nine_final_eight', revision5,
  request(revision5, [literal('p_new', 8), remove('p0')]), 6, 2, ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p_new'],
  ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p_new']);
assert.ok(Object.is(revision1.document.parameters.find(parameter => parameter.id === 'unused').definition.valueMM, -0));
assert.ok(Object.is(revision5.document.parameters[0].definition.valueMM, -0));
function intact() {
  for (const {result, before} of accepted) assert.deepEqual(result, before);
  for (const [file, bytes] of retainedFiles) assert.deepEqual(readFileSync(file), bytes);
}
function reject(name, action, code) {
  assert.throws(action, error => {
    assert.ok(error instanceof BooleanExtrusionFeatureGraphError); assert.equal(error.name, 'BooleanExtrusionFeatureGraphError');
    assert.equal(error.code, code); assert.ok(Object.values(BooleanExtrusionFeatureGraphDiagnosticCode).includes(error.code));
    assert.equal(typeof error.path, 'string'); assert.ok(error.path.length <= 256);
    failures.push({name, code: error.code, path: error.path, featureId: error.featureId, parameterId: error.parameterId,
      message: error.message, actualCausePreserved: Object.hasOwn(error, 'cause')});
    intact(); return true;
  });
}
function rejected(name, previous, transaction, code) {
  const before = structuredClone(previous), txBefore = structuredClone(transaction);
  reject(name, () => transact(previous, transaction), code);
  assert.deepEqual(previous, before); assert.deepEqual(transaction, txBefore);
}
rejected('unknown_starting_remove', original, request(original, [remove('missing_parameter')]), 'PARAMETER');
rejected('duplicate_target', original, request(original, [literal('unused', 1), literal('unused', 2)]), 'INPUT');
rejected('removed_id_not_recycled_in_transaction', original, request(original, [remove('height'), literal('height', 3)]), 'INPUT');
rejected('new_parameter_cannot_be_removed', original, request(original, [literal('temporary', 1), remove('temporary')]), 'INPUT');
rejected('logical_id_collision', original, request(original, [literal(original.document.id, 1)]), 'IDENTITY');
rejected('native_id_collision', original, request(original, [literal('original_line_0', 1)]), 'IDENTITY');
rejected('native_source_asset_collision', original, request(original,
  [literal(original.report.qualifiedBindings.find(binding => binding.kind === 'face-input').sources[0].assetId, 1)]), 'IDENTITY');
rejected('dangling_dependent_after_remove', original, request(original, [remove('base_height')]), 'PARAMETER');
rejected('dangling_distance_after_remove', revision1, request(revision1, [remove('design_height')]), 'PARAMETER');
rejected('cyclic_parameters', original, request(original,
  [upsert('height', {kind: 'offset', parameterId: 'base_height', offsetMM: 0}), upsert('base_height', {kind: 'offset', parameterId: 'height', offsetMM: 0})]), 'PARAMETER');
const badType = literal('new_angle', 1); badType.parameter.type = 'angle';
rejected('parameter_type', original, request(original, [badType]), 'PARAMETER');
rejected('unsafe_unused_length', original, request(original, [literal('new_length', 10001)]), 'PARAMETER');
rejected('disappearing_offset', original, request(original, [upsert('height', {kind: 'offset', parameterId: 'base_height', offsetMM: Number.MIN_VALUE})]), 'REPRESENTABILITY');
rejected('foreign_distance_edit_target', original, request(original, [literal('unused', -0)],
  [{featureId: original.document.features.find(feature => feature.kind === 'face-input').id, definition: {kind: 'literal', valueMM: 2}}]), 'DEPENDENCY');
rejected('stale_expected_revision', revision1, {...request(revision1, [literal('unused', -0)]), expectedRevision: 0}, 'REVISION');
rejected('skipped_revision', original, {...request(original, [literal('unused', -0)]), revision: 2}, 'REVISION');
rejected('too_many_operations', original, request(original, Array.from({length: 17}, (_, index) => literal('op_' + index, index))), 'BUDGET');
rejected('working_table_seventeen', revision5, request(revision5, Array.from({length: 9}, (_, index) => literal('work_' + index, index))), 'BUDGET');
rejected('final_nine_rejected', revision5, request(revision5, [literal('p_new', 8)]), 'BUDGET');
const lowerBudget = parse(authoredText, {...original.options, maximumParameterResolutions: 3});
rejected('lower_final_resolution_budget', lowerBudget, request(lowerBudget, [literal('new_unused', 1)]), 'BUDGET');
let getterCalls = 0;
const getter = request(original, [literal('new_unused', 1)]);
Object.defineProperty(getter, 'parameterOperations', {enumerable: true, get() { getterCalls++; return []; }});
reject('transaction_getter', () => transact(original, getter), 'INPUT'); assert.equal(getterCalls, 0);
const ownedGetter = structuredClone(original);
Object.defineProperty(ownedGetter, 'features', {enumerable: true, get() { getterCalls++; return original.features; }});
reject('prior_owned_getter', () => transact(ownedGetter, request(original, [literal('unused', -0)])), 'OWNED'); assert.equal(getterCalls, 0);
for (const [name, alter] of [
  ['source', result => result.features.find(feature => feature.kind === 'face-input').evaluation.source += ' '],
  ['parameter_value', result => result.parameters[0].valueMM += .1],
  ['native_geometry', result => result.features.find(feature => feature.kind === 'normal-extrusion').evaluation.faces[0].surface.controlPoints[0][0][0] += .1],
]) {
  const changed = structuredClone(revision1); alter(changed);
  reject('owned_' + name + '_tamper', () => validate(changed), 'OWNED');
}
assert.deepEqual(validate(original), original.report); intact();

const packageRoot = resolve(repo, 'packages/barocss-cad');
const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')), declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const runtimeName = 'transactBooleanExtrusionFeatureGraphParameters';
const typeNames = ['BooleanExtrusionParameterOperation', 'BooleanExtrusionParameterTransaction'];
assert.equal(typeof publicAPI[runtimeName], 'function');
assert.deepEqual(publicAPI.BooleanExtrusionFeatureGraphDiagnosticCode, BooleanExtrusionFeatureGraphDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./boolean-extrusion-parameter-lifecycle.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/boolean-extrusion-parameter-lifecycle.d.ts'), declaration = readFileSync(leafDeclarationPath, 'utf8');
for (const name of [runtimeName, ...typeNames]) assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(declaration), name);
const compiledOriginal = publicAPI.parseBooleanExtrusionFeatureGraph(authoredText, original.options);
assert.deepEqual(compiledOriginal, original);
const compiled = publicAPI[runtimeName](compiledOriginal, transaction1);
assert.deepEqual(compiled, revision1); assert.deepEqual(publicAPI.validateBooleanExtrusionFeatureGraph(compiled), compiled.report);
assert.equal(publicAPI.serializeBooleanExtrusionFeatureGraph(compiled.document, compiled.options),
  readFileSync(accepted.find(snapshot => snapshot.result.document.revision === 1).file, 'utf8'));
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeNames: [runtimeName], typeNames, publicNameCount: 3,
  existingGraphAPI: ['parseBooleanExtrusionFeatureGraph', 'serializeBooleanExtrusionFeatureGraph', 'validateBooleanExtrusionFeatureGraph'],
  declarationCheck: 'actual declaration export text; no separate TypeScript invocation'};
ownedFile('compiled-consumer', compiledConsumer);
ownedFile('summary', {sourceMode: true, cadSourceInputCount: cadInputs.length, inputProvenance, summaries, failures, compiledConsumer,
  snapshotCount: summaries.length, refusalCount: failures.length,
  stagingWitness: {startingParameters: 8, appendedBeforeRemoval: 'p_new', workingParameters: 9, finalParameters: 8, acceptedRevision: revision6.document.revision},
  scope: 'Authentic graph0 intent with explicit parameter create/upsert/remove and same-candidate distance rebinding. Starting identities stay reserved; dependent removal requires explicit repair. The original resolver handles every final parameter and each actual native chain still uses four builders. Working nine/final eight differs from refused final nine. Original native input, Boolean, node/options/source IDs and prior files remain intact. No hidden replacement height, cascade, selective recomputation, mesh, renderer, history/tombstone, solid, or old campaign.'});
intact();
console.log(JSON.stringify({sourceMode: true, cadSourceInputCount: cadInputs.length, inputProvenance, summaries, failures, compiledConsumer}));
