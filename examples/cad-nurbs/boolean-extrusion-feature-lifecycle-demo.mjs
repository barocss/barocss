import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 4,
  'Usage: node boolean-extrusion-feature-lifecycle-demo.mjs --source <output-directory> --parameter-directory <saved-parameter-directory>');
assert.equal(args[0], '--source');
assert.equal(args[2], '--parameter-directory');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const output = resolve(args[1]);
const parameterDirectory = resolve(args[3]);
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
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/features/boolean-extrusion-feature-lifecycle.ts')));
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/features/boolean-extrusion-feature-graph-serde.ts')));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' +
  Buffer.from(built.outputFiles[0].text).toString('base64'));
const {
  transactBooleanExtrusionFeatureGraphFeatures: transact,
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
const accepted = [], inputProvenance = [];
function readAuthentic(file) {
  const bytes = readFileSync(file); retainedFiles.set(file, bytes);
  inputProvenance.push({file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')});
  return bytes.toString('utf8');
}
const authoredText = readAuthentic(resolve(parameterDirectory, 'revision1_replace_height.authored-graph.json'));
const originalOwned = JSON.parse(readAuthentic(resolve(parameterDirectory, 'revision1_replace_height.owned-graph-result.json')));
assert.deepEqual(validate(originalOwned), originalOwned.report);
const original = parse(authoredText, originalOwned.options); assert.deepEqual(original, originalOwned);
assert.equal(original.document.revision, 1);
const options = original.options;
const node = (result, id) => { const feature = result.document.features.find(feature => feature.id === id); assert.ok(feature); return feature; };
const byKind = (result, kind) => { const feature = result.document.features.find(feature => feature.kind === kind); assert.ok(feature); return feature; };
const native = (result, kind) => result.features.find(feature => feature.kind === kind).evaluation;
function sources(result) {
  return result.features.flatMap(row => row.kind === 'face-input'
    ? [{label: row.featureId, source: row.evaluation.source, model: row.evaluation.model}]
    : row.evaluation.sources.map((source, index) => ({label: row.featureId + '.' + index, source: source.source, model: source.model})));
}
const metadata = JSON.parse(readAuthentic(resolve(parameterDirectory, 'summary.json'))).summaries.find(summary => summary.name === 'revision1_replace_height');
assert.ok(metadata); assert.equal(metadata.sourceFiles.length, sources(original).length);
for (const [index, file] of metadata.sourceFiles.entries()) {
  const text = readAuthentic(file), expected = sources(original).find(source => source.source === text);
  assert.ok(expected); sourceFile('authentic_original_' + index, text, expected.model);
}
function readyOrder(document) {
  const done = new Set(), order = [];
  while (order.length < document.features.length) {
    const next = document.features.find(feature => !done.has(feature.id) && (feature.kind === 'face-input' ? []
      : feature.kind === 'coplanar-boolean' ? [feature.operandAFeatureId, feature.operandBFeatureId] : [feature.regionFeatureId]).every(id => done.has(id)));
    assert.ok(next); done.add(next.id); order.push(next.id);
  }
  return order;
}
function save(name, result, revision, areaUV, height) {
  assert.equal(result.document.revision, revision); assert.deepEqual(result.options, options);
  assert.deepEqual(result.document.parameters, original.document.parameters);
  assert.deepEqual(result.parameters, original.parameters);
  assert.deepEqual(result.report.featureOrder, readyOrder(result.document));
  assert.deepEqual(result.features.map(feature => feature.featureId), result.report.featureOrder);
  assert.deepEqual(result.report.authoredFeatureOrder, result.document.features.map(feature => feature.id));
  assert.equal(result.report.nativeBuilderCallCount, 4); assert.deepEqual(result.report.nativeBuilderCalls, {faceInput: 2, coplanarBoolean: 1, normalExtrusion: 1});
  const region = native(result, 'coplanar-boolean'), extrusion = native(result, 'normal-extrusion');
  assert.ok(Math.abs(region.report.areaUV - areaUV) <= 1e-7); assert.equal(extrusion.options.distanceMM, height); assert.equal(extrusion.shells.length, 1);
  assert.deepEqual(extrusion.region, region);
  for (const vertex of extrusion.vertices.filter(vertex => vertex.layer === 'top')) {
    assert.deepEqual(vertex.pointMM, vertex.originalPointMM.map((value, axis) => value + extrusion.normal[axis] * height));
  }
  const faceRows = result.features.filter(feature => feature.kind === 'face-input');
  assert.equal(faceRows.length, 2); assert.equal(faceRows[0].evaluation.loop.edges[0].id, faceRows[1].evaluation.loop.edges[0].id);
  const refs = result.report.qualifiedBindings.flatMap(binding => binding.nativeReferences).filter(reference => reference.nativeId === 'original_line_0');
  assert.equal(refs.length, 2); assert.notEqual(refs[0].featureId, refs[1].featureId); assert.notEqual(refs[0].outputSlotId, refs[1].outputSlotId);
  assert.ok(refs.every(reference => reference.graphId === result.document.id && reference.revision === revision));
  for (const binding of result.report.qualifiedBindings) {
    const row = result.features.find(row => row.featureId === binding.featureId); assert.ok(row); assert.equal(binding.outputSlotId, row.outputSlotId);
    assert.equal(binding.graphId, result.document.id); assert.equal(binding.revision, revision);
  }
  const sourceFiles = sources(result).map(source => {
    assert.ok(source.model.objects.length <= 16); return sourceFile(name + '.' + source.label, source.source, source.model).file;
  });
  assert.deepEqual(validate(result), result.report);
  const file = resolve(output, name + '.authored-graph.json'); writeFileSync(file, serialize(result.document, result.options)); retainedFiles.set(file, readFileSync(file));
  const authored = JSON.parse(readFileSync(file, 'utf8')); assert.deepEqual(authored, result.document);
  assert.ok(Object.is(authored.parameters.find(parameter => parameter.id === 'unused').definition.valueMM, -0));
  assert.ok(!Object.hasOwn(authored, 'report') && !Object.hasOwn(authored, 'options'));
  const cold = parse(readFileSync(file, 'utf8'), result.options); assert.deepEqual(cold, result);
  const owned = ownedFile(name + '.owned-graph-result', result); assert.deepEqual(validate(owned.reopened), result.report);
  accepted.push({result, before: structuredClone(result), file, ownedFile: owned.file});
  summaries.push({name, revision, areaUV, height, authoredOrder: result.document.features.map(feature => feature.id),
    featureOrder: result.report.featureOrder, sourceFiles, authoredFile: file, ownedFile: owned.file});
  return result;
}
const upsert = feature => ({kind: 'upsert', feature});
const remove = featureId => ({kind: 'remove', featureId});
const request = (previous, featureOperations) => ({expectedRevision: previous.document.revision, revision: previous.document.revision + 1, featureOperations});
function transition(name, previous, operations, revision, area, height) {
  const transaction = request(previous, operations), before = structuredClone(previous), txBefore = structuredClone(transaction);
  const result = transact(previous, transaction); checkOwnership([previous, transaction], result);
  assert.deepEqual(previous, before); assert.deepEqual(transaction, txBefore);
  const expected = structuredClone(previous.document); expected.revision = transaction.revision;
  for (const operation of transaction.featureOperations) {
    if (operation.kind === 'remove') expected.features = expected.features.filter(feature => feature.id !== operation.featureId);
    else {
      const index = expected.features.findIndex(feature => feature.id === operation.feature.id);
      if (index === -1) expected.features.push(structuredClone(operation.feature)); else expected.features[index] = structuredClone(operation.feature);
    }
  }
  assert.deepEqual(result.document, expected);
  return save(name, result, revision, area, height);
}
function cloneAs(feature, id, outputSlotId) { return {...structuredClone(feature), id, outputSlotId}; }
ownedFile('source-api.metafile', built.metafile);
ownedFile('source-api.inputs', {entry, mode: 'in-memory-esbuild', write: false, cadInputs, allInputs: sourceInputs, esbuildVersion: esbuild.version});
ownedFile('authentic-inputs', inputProvenance);
save('revision1_authentic', original, 1, 24, 3);
const originalBool = byKind(original, 'coplanar-boolean'), originalExt = byKind(original, 'normal-extrusion');
const originalA = node(original, originalBool.operandAFeatureId), originalB = node(original, originalBool.operandBFeatureId);
const replacementA = cloneAs(originalA, 'face_a_replacement', 'face_a_replacement_slot');
const repairedBool = {...structuredClone(originalBool), operandAFeatureId: replacementA.id};
const revision2 = transition('revision2_replace_face_a', original, [upsert(replacementA), upsert(repairedBool), remove(originalA.id)], 2, 24, 3);
assert.deepEqual(native(revision2, 'coplanar-boolean'), native(original, 'coplanar-boolean'));
assert.deepEqual(native(revision2, 'normal-extrusion'), native(original, 'normal-extrusion'));
const replacementBool = cloneAs(byKind(revision2, 'coplanar-boolean'), 'boolean_replacement', 'boolean_replacement_slot');
replacementBool.options = {...replacementBool.options, operation: 'intersection', evaluationId: 'replacement_boolean_native', resultIdPrefix: 'rb'};
const repairedExt = {...structuredClone(byKind(revision2, 'normal-extrusion')), regionFeatureId: replacementBool.id};
const revision3 = transition('revision3_replace_boolean', revision2, [upsert(replacementBool), upsert(repairedExt), remove(originalBool.id)], 3, 4, 3);
const replacementExt = cloneAs(byKind(revision3, 'normal-extrusion'), 'extrusion_replacement', 'extrusion_replacement_slot');
replacementExt.options = {...replacementExt.options, evaluationId: 'replacement_extrusion_native', resultIdPrefix: 'rx'};
replacementExt.distance = {kind: 'literal', valueMM: 4};
const revision4 = transition('revision4_replace_extrusion', revision3, [upsert(replacementExt), remove(originalExt.id)], 4, 4, 4);
assert.notDeepEqual(native(revision4, 'normal-extrusion').vertices.map(vertex => vertex.pointMM), native(revision3, 'normal-extrusion').vertices.map(vertex => vertex.pointMM));
const currentBool = byKind(revision4, 'coplanar-boolean'), currentA = node(revision4, currentBool.operandAFeatureId), currentB = node(revision4, currentBool.operandBFeatureId);
const cornerA = cloneAs(currentA, 'corner_face_a', 'corner_face_a_slot'), cornerB = cloneAs(currentB, 'corner_face_b', 'corner_face_b_slot');
let changedEndpoints = 0;
for (const line of cornerA.loop.edges) for (let endpoint = 0; endpoint < 2; endpoint++) {
  if (difference(line.controlPoints[endpoint], [.5, -3, .5]) === 0) { line.controlPoints[endpoint] = [1, -3, 1]; changedEndpoints++; }
}
assert.equal(changedEndpoints, 2);
const cornerBool = {...structuredClone(currentBool), operandAFeatureId: cornerA.id, operandBFeatureId: cornerB.id};
const revision5 = transition('revision5_replace_both_inputs', revision4,
  [upsert(cornerA), upsert(cornerB), upsert(cornerBool), remove(currentA.id), remove(currentB.id)], 5, 4.75, 4);
const chainBool = cloneAs(byKind(revision5, 'coplanar-boolean'), 'complete_boolean', 'complete_boolean_slot');
const chainA = cloneAs(node(revision5, chainBool.operandAFeatureId), 'complete_face_a', 'complete_face_a_slot');
const chainB = cloneAs(node(revision5, chainBool.operandBFeatureId), 'complete_face_b', 'complete_face_b_slot');
chainBool.operandAFeatureId = chainA.id; chainBool.operandBFeatureId = chainB.id;
const chainExt = cloneAs(byKind(revision5, 'normal-extrusion'), 'complete_extrusion', 'complete_extrusion_slot'); chainExt.regionFeatureId = chainBool.id;
const transaction6 = request(revision5, [upsert(chainExt), upsert(chainB), upsert(chainBool), upsert(chainA), ...revision5.document.features.map(feature => remove(feature.id))]);
assert.equal(transaction6.featureOperations.length, 8);
const revision6 = transition('revision6_replace_complete_chain', revision5, transaction6.featureOperations, 6, 4.75, 4);
assert.deepEqual(revision6.document.features.map(feature => feature.id), [chainExt.id, chainB.id, chainBool.id, chainA.id]);
assert.deepEqual(revision6.report.featureOrder, [chainB.id, chainA.id, chainBool.id, chainExt.id]);
assert.deepEqual(native(revision6, 'coplanar-boolean'), native(revision5, 'coplanar-boolean'));
assert.deepEqual(native(revision6, 'normal-extrusion'), native(revision5, 'normal-extrusion'));
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
function rejected(name, previous, operations, code) {
  const transaction = request(previous, operations), before = structuredClone(previous), txBefore = structuredClone(transaction);
  reject(name, () => transact(previous, transaction), code);
  assert.deepEqual(previous, before); assert.deepEqual(transaction, txBefore);
}
const freshA = (id, slot) => cloneAs(originalA, id, slot);
rejected('missing_starting_remove', original, [remove('missing_feature')], 'DEPENDENCY');
rejected('duplicate_target', original, [upsert(originalBool), upsert(originalBool)], 'INPUT');
rejected('remove_recreate_target', original, [remove(originalA.id), upsert(originalA)], 'INPUT');
rejected('new_feature_cannot_be_removed', original, [upsert(freshA('temporary_face', 'temporary_slot')), remove('temporary_face')], 'INPUT');
rejected('new_logical_id_collision', original, [upsert(freshA(original.document.id, 'logical_collision_slot'))], 'IDENTITY');
rejected('new_native_id_collision', original, [upsert(freshA('original_line_0', 'native_collision_slot'))], 'IDENTITY');
rejected('new_source_id_collision', original, [upsert(freshA(original.report.qualifiedBindings.find(binding => binding.kind === 'face-input').sources[0].assetId, 'source_collision_slot'))], 'IDENTITY');
rejected('new_slot_collides_with_starting_slot', original, [upsert(freshA('slot_collision_face', originalA.outputSlotId))], 'IDENTITY');
rejected('new_id_equals_own_slot', original, [upsert(freshA('self_slot', 'self_slot'))], 'IDENTITY');
rejected('two_new_slots_collide', original, [upsert(freshA('new_a', 'shared_new_slot')), upsert(freshA('new_b', 'shared_new_slot'))], 'IDENTITY');
const changedKind = {...structuredClone(originalBool), id: originalA.id, outputSlotId: originalA.outputSlotId};
rejected('existing_kind_change', original, [upsert(changedKind)], 'IDENTITY');
rejected('existing_slot_change', original, [upsert({...structuredClone(originalA), outputSlotId: 'changed_slot'})], 'IDENTITY');
const changedNativeOptions = structuredClone(originalA); changedNativeOptions.options.orientation = 'reverse';
rejected('existing_native_options_change', original, [upsert(changedNativeOptions)], 'IDENTITY');
const changedCurveId = structuredClone(originalA); changedCurveId.loop.edges[0].id = 'replacement_curve_id';
rejected('existing_native_curve_id_change', original, [upsert(changedCurveId)], 'IDENTITY');
const disconnectedA = freshA('disconnected_face', 'disconnected_face_slot');
rejected('replacement_requires_explicit_dependency_repair', original, [upsert(disconnectedA), remove(originalA.id)], 'DEPENDENCY');
rejected('wrong_kind_region_reference', original, [upsert({...structuredClone(originalExt), regionFeatureId: originalA.id})], 'DEPENDENCY');
rejected('boolean_extrusion_cycle', original, [upsert({...structuredClone(originalBool), operandAFeatureId: originalExt.id})], 'DEPENDENCY');
const foreignKind = structuredClone(originalA); foreignKind.kind = 'mesh-feature';
rejected('foreign_feature_type', original, [upsert(foreignKind)], 'INPUT');
rejected('final_three_rejected', original, [remove(originalA.id)], 'INPUT');
rejected('final_five_rejected', original, [upsert(freshA('fifth_face', 'fifth_slot'))], 'INPUT');
rejected('working_nine_rejected', original, Array.from({length: 5}, (_, index) => upsert(freshA('work_' + index, 'work_slot_' + index))), 'BUDGET');
rejected('more_than_eight_operations', original, Array.from({length: 9}, (_, index) => upsert(freshA('op_' + index, 'op_slot_' + index))), 'BUDGET');
reject('stale_expected_revision', () => transact(revision2, {...request(revision2, [upsert(byKind(revision2, 'coplanar-boolean'))]), expectedRevision: 1}), 'REVISION');
reject('skipped_revision', () => transact(original, {...request(original, [upsert(originalBool)]), revision: 3}), 'REVISION');
const lowBool = cloneAs(originalBool, 'low_budget_boolean', 'low_budget_slot'); lowBool.options.maximumPairTests = 15;
rejected('actual_new_native_boolean_budget', original, [upsert(lowBool), upsert({...structuredClone(originalExt), regionFeatureId: lowBool.id}), remove(originalBool.id)], 'NATIVE');
const malformedNative = structuredClone(originalA); malformedNative.loop.edges[1].controlPoints[1][0] += .125;
rejected('actual_native_plane_line_refusal', original, [upsert(malformedNative)], 'NATIVE');
let getterCalls = 0;
const getter = request(original, [upsert(originalBool)]);
Object.defineProperty(getter, 'featureOperations', {enumerable: true, get() { getterCalls++; return []; }});
reject('transaction_getter', () => transact(original, getter), 'INPUT'); assert.equal(getterCalls, 0);
const ownedGetter = structuredClone(original);
Object.defineProperty(ownedGetter, 'features', {enumerable: true, get() { getterCalls++; return original.features; }});
reject('prior_owned_getter', () => transact(ownedGetter, request(original, [upsert(originalBool)])), 'OWNED'); assert.equal(getterCalls, 0);
for (const [name, alter] of [
  ['source', result => result.features.find(feature => feature.kind === 'face-input').evaluation.source += ' '],
  ['native_geometry', result => result.features.find(feature => feature.kind === 'normal-extrusion').evaluation.faces[0].surface.controlPoints[0][0][0] += .1],
  ['qualified_owner', result => result.report.qualifiedBindings[0].nativeReferences[0].featureId = 'foreign_owner'],
]) {
  const changed = structuredClone(revision2); alter(changed);
  reject('owned_' + name + '_tamper', () => validate(changed), 'OWNED');
}
assert.deepEqual(validate(original), original.report); intact();

const packageRoot = resolve(repo, 'packages/barocss-cad');
const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')), declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const runtimeName = 'transactBooleanExtrusionFeatureGraphFeatures';
const typeNames = ['BooleanExtrusionFeatureOperation', 'BooleanExtrusionFeatureTransaction'];
assert.equal(typeof publicAPI[runtimeName], 'function');
assert.deepEqual(publicAPI.BooleanExtrusionFeatureGraphDiagnosticCode, BooleanExtrusionFeatureGraphDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./boolean-extrusion-feature-lifecycle.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/features/boolean-extrusion-feature-lifecycle.d.ts'), declaration = readFileSync(leafDeclarationPath, 'utf8');
for (const name of [runtimeName, ...typeNames]) assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(declaration), name);
const compiledOriginal = publicAPI.parseBooleanExtrusionFeatureGraph(authoredText, original.options); assert.deepEqual(compiledOriginal, original);
const compiled = publicAPI[runtimeName](compiledOriginal, request(compiledOriginal, [upsert(replacementA), upsert(repairedBool), remove(originalA.id)]));
assert.deepEqual(compiled, revision2); assert.deepEqual(publicAPI.validateBooleanExtrusionFeatureGraph(compiled), compiled.report);
assert.equal(publicAPI.serializeBooleanExtrusionFeatureGraph(compiled.document, compiled.options), readFileSync(accepted.find(snapshot => snapshot.result.document.revision === 2).file, 'utf8'));
assert.equal(typeof publicAPI.transactBooleanExtrusionFeatureGraphParameters, 'function');
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeNames: [runtimeName], typeNames, publicNameCount: 3,
  existingAPIs: ['parseBooleanExtrusionFeatureGraph', 'serializeBooleanExtrusionFeatureGraph', 'validateBooleanExtrusionFeatureGraph', 'transactBooleanExtrusionFeatureGraphParameters'],
  declarationCheck: 'actual declaration export text; no separate TypeScript invocation'};
ownedFile('compiled-consumer', compiledConsumer);
ownedFile('summary', {sourceMode: true, cadSourceInputCount: cadInputs.length, inputProvenance, summaries, failures, compiledConsumer,
  snapshotCount: summaries.length, refusalCount: failures.length,
  workingWitness: {startingFeatures: 4, createdBeforeRemovals: 4, operationCount: transaction6.featureOperations.length, maximumWorkingFeatures: 8, finalFeatures: 4},
  scope: 'Authentic native graph0 with explicit feature replacement/removal and same-candidate dependency repair. Existing identities/slots/options and original input Curve IDs remain stable. New logical feature/slot identities are fresh while qualified native input names remain unchanged. Final exact four-node typed graph and the original parameter/native builders/serde remain authority. No cascade, output editing, generic node mixing, reorder/suppression/history, mesh, renderer, solid or old campaign.'});
intact();
console.log(JSON.stringify({sourceMode: true, cadSourceInputCount: cadInputs.length, inputProvenance, summaries, failures, compiledConsumer}));
