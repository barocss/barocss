import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 4,
  'Usage: node boolean-extrusion-fanout-demo.mjs --source <output-directory> --graph-directory <saved-graph-directory>');
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
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/boolean-extrusion-feature-graph.ts')));
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/boolean-extrusion-parameter-lifecycle.ts')));
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/boolean-extrusion-feature-graph-serde.ts')));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' +
  Buffer.from(built.outputFiles[0].text).toString('base64'));
const {
  evaluateBooleanExtrusionFeatureGraph: evaluate, updateBooleanExtrusionFeatureGraph: update,
  serializeBooleanExtrusionFeatureGraph: serialize, parseBooleanExtrusionFeatureGraph: parse, validateBooleanExtrusionFeatureGraph: validate,
  transactBooleanExtrusionFeatureGraphParameters: parameterTransaction, transactBooleanExtrusionFeatureGraphFeatures: featureTransaction,
  BooleanExtrusionFeatureGraphError, BooleanExtrusionFeatureGraphDiagnosticCode, compileCadModel, evaluateSurfaceD1,
} = api;
for (const operation of [evaluate, update, serialize, parse, validate, parameterTransaction, featureTransaction]) assert.equal(typeof operation, 'function');

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
const unionText = readAuthentic(resolve(graphDirectory, 'cross_union.authored-graph.json'));
const emptyText = readAuthentic(resolve(graphDirectory, 'reverse_containment_empty.authored-graph.json'));
const oldCacheText = readAuthentic(resolve(graphDirectory, 'cross_union.owned-graph-result.json'));
const metadataText = readAuthentic(resolve(graphDirectory, 'summary.json'));
const singleOptions = {maximumParameterResolutions: 8, maximumFeatureEvaluations: 4};
const single = parse(unionText, singleOptions), emptySingle = parse(emptyText, singleOptions);
const nativeRows = result => result.features.filter(feature => feature.kind === 'normal-extrusion');
const regionRow = result => result.features.find(feature => feature.kind === 'coplanar-boolean');
function sourceRecords(result) {
  return result.features.flatMap(row => row.kind === 'face-input'
    ? [{label: row.featureId, source: row.evaluation.source, model: row.evaluation.model}]
    : row.evaluation.sources.map((source, index) => ({label: row.featureId + '.' + index, source: source.source, model: source.model})));
}
for (const [name, current] of [['cross_union', single], ['reverse_containment_empty', emptySingle]]) {
  const metadata = JSON.parse(metadataText).summaries.find(summary => summary.name === name && summary.revision === 0);
  assert.ok(metadata); assert.equal(metadata.sourceFiles.length, sourceRecords(current).length);
  for (const [index, file] of metadata.sourceFiles.entries()) {
    const source = readAuthentic(file), expected = sourceRecords(current).find(expected => expected.source === source);
    assert.ok(expected); sourceFile(name + '.authentic_source_' + index, source, expected.model);
  }
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
function save(name, result, expectedHeights, empty = false) {
  assert.deepEqual(validate(result), result.report);
  assert.deepEqual(result.features.map(row => row.featureId), readyOrder(result.document));
  assert.deepEqual(result.report.featureOrder, result.features.map(row => row.featureId));
  assert.deepEqual(result.report.authoredFeatureOrder, result.document.features.map(node => node.id));
  assert.deepEqual(result.report.parameterOrder, result.parameters.map(parameter => parameter.id));
  assert.equal(result.report.parameterResolutionCount, result.document.parameters.length);
  const leaves = nativeRows(result), report = result.report, region = regionRow(result).evaluation;
  assert.equal(leaves.length, expectedHeights.length);
  assert.equal(report.distanceDefinitionEvaluationCount, leaves.length);
  assert.equal(report.featureEvaluationCount, 3 + leaves.length); assert.equal(report.nativeBuilderCallCount, 3 + leaves.length);
  assert.deepEqual(report.nativeBuilderCalls, {faceInput: 2, coplanarBoolean: 1, normalExtrusion: leaves.length});
  assert.ok(!Object.hasOwn(report, 'distance'));
  assert.deepEqual(Object.keys(report.summary).sort(), ['booleanFeatureId', 'empty', 'componentCount', 'holeCount', 'materialAreaUV', 'extrusions'].sort());
  assert.equal(report.summary.empty, empty); assert.equal(report.summary.componentCount, empty ? 0 : 1);
  assert.equal(report.summary.materialAreaUV, empty ? 0 : 24);
  const nativeRoleIds = new Set();
  for (const [index, row] of leaves.entries()) {
    const authored = result.document.features.find(node => node.id === row.featureId), extrusion = row.evaluation;
    assert.deepEqual(row.dependencyIds, [regionRow(result).featureId]); assert.deepEqual(extrusion.region, region);
    assert.equal(extrusion.options.distanceMM, expectedHeights[index]);
    assert.deepEqual(extrusion.options, {...authored.options, distanceMM: expectedHeights[index]});
    assert.deepEqual(report.distances[index], {featureId: row.featureId, definition: authored.distance,
      valueMM: expectedHeights[index], dependencyIds: authored.distance.kind === 'offset' ? [authored.distance.parameterId] : []});
    assert.deepEqual(report.summary.extrusions[index], {featureId: row.featureId, outputSlotId: row.outputSlotId,
      empty, shellIds: extrusion.shells.map(shell => shell.id), distanceMM: expectedHeights[index]});
    const binding = report.qualifiedBindings.find(binding => binding.featureId === row.featureId);
    assert.ok(binding);
    for (const reference of binding.nativeReferences) {
      assert.equal(reference.featureId, row.featureId); assert.equal(reference.outputSlotId, row.outputSlotId);
      assert.equal(reference.graphId, result.document.id); assert.equal(reference.revision, result.document.revision);
      assert.ok(!nativeRoleIds.has(reference.nativeId), 'Sibling outputs share a defined native role'); nativeRoleIds.add(reference.nativeId);
    }
    if (empty) {
      assert.deepEqual([extrusion.vertices, extrusion.edges, extrusion.faces, extrusion.shells, extrusion.sources], [[], [], [], [], []]);
      assert.equal(extrusion.normal, null); assert.equal(extrusion.translationMM, null);
    } else {
      assert.equal(extrusion.shells.length, 1);
      assert.deepEqual(extrusion.translationMM, extrusion.normal.map(value => value * expectedHeights[index]));
      for (const vertex of extrusion.vertices.filter(vertex => vertex.layer === 'top')) {
        assert.deepEqual(vertex.pointMM, vertex.originalPointMM.map((value, axis) => value + extrusion.normal[axis] * expectedHeights[index]));
      }
      for (const cap of extrusion.faces.filter(face => face.kind === 'top-cap')) {
        const witness = cap.normalObservation;
        const d1 = evaluateSurfaceD1(cap.surface, witness.u, witness.v);
        assert.deepEqual(witness.surfaceD1, d1);
        assert.ok(witness.normalDot > 0 && witness.normalDifference <= 1e-7);
      }
    }
    for (const face of extrusion.faces) {
      const asset = extrusion.sources.find(source => source.id === face.source.assetId);
      assert.ok(asset); assert.deepEqual(asset.model.objects[face.source.objectIndex], face.surface);
    }
    for (const edge of extrusion.edges) {
      const asset = extrusion.sources.find(source => source.id === edge.source.assetId);
      assert.ok(asset); assert.deepEqual(asset.model.objects[edge.source.objectIndex], edge.curve);
    }
  }
  assert.equal(report.distances.length, leaves.length); assert.equal(report.summary.extrusions.length, leaves.length);
  assert.equal(report.limits.maximumFeatures, 7); assert.equal(report.limits.maximumExtrusions, 4);
  assert.equal(report.solid, false); assert.equal(report.topologyCertified, false);
  const sourceFiles = sourceRecords(result).map(source => {
    assert.ok(source.model.objects.length <= 16); return sourceFile(name + '.' + source.label, source.source, source.model).file;
  });
  const file = resolve(output, name + '.authored-graph.json'); writeFileSync(file, serialize(result.document, result.options)); retainedFiles.set(file, readFileSync(file));
  const authored = JSON.parse(readFileSync(file, 'utf8')); assert.deepEqual(authored, result.document);
  assert.ok(Object.is(authored.parameters.find(parameter => parameter.id === 'unused').definition.valueMM, -0));
  assert.ok(!Object.hasOwn(authored, 'report') && !Object.hasOwn(authored, 'options'));
  assert.deepEqual(parse(readFileSync(file, 'utf8'), result.options), result);
  const owned = ownedFile(name + '.owned-graph-result', result); assert.deepEqual(validate(owned.reopened), report);
  accepted.push({result, before: structuredClone(result), file, ownedFile: owned.file});
  summaries.push({name, graphId: result.document.id, revision: result.document.revision, featureCount: result.document.features.length,
    heights: expectedHeights, empty, distanceOrder: report.distances.map(entry => entry.featureId),
    nativeBuilderCalls: report.nativeBuilderCalls, sourceFiles, authoredFile: file, ownedFile: owned.file});
  return result;
}
function evaluateOwned(document, options) {
  const before = structuredClone(document), result = evaluate(document, options); checkOwnership([document, options], result);
  assert.deepEqual(document, before); return result;
}
function callOwned(operation, previous, input) {
  const before = structuredClone(previous), inputBefore = structuredClone(input), result = operation(previous, input);
  checkOwnership([previous, input], result); assert.deepEqual(previous, before); assert.deepEqual(input, inputBefore); return result;
}
const leafIds = ['leaf_low', 'leaf_middle', 'leaf_high'];
function leaf(template, index, regionFeatureId) {
  return {...structuredClone(template), id: leafIds[index], outputSlotId: 'leaf_slot_' + index, regionFeatureId,
    distance: {kind: 'offset', parameterId: 'height', offsetMM: index},
    options: {...template.options, evaluationId: 'fanout_leaf_' + index + '_eval', resultIdPrefix: 'f' + index}};
}
function fanoutDocument(single) {
  const document = structuredClone(single.document), bool = document.features.find(node => node.kind === 'coplanar-boolean');
  const a = document.features.find(node => node.id === bool.operandAFeatureId), b = document.features.find(node => node.id === bool.operandBFeatureId);
  const template = document.features.find(node => node.kind === 'normal-extrusion');
  const leaves = [0, 1, 2].map(index => leaf(template, index, bool.id));
  document.features = [leaves[0], b, leaves[1], bool, leaves[2], a]; return document;
}
ownedFile('source-api.metafile', built.metafile);
ownedFile('source-api.inputs', {entry, mode: 'in-memory-esbuild', write: false, cadInputs, allInputs: sourceInputs, esbuildVersion: esbuild.version});
ownedFile('authentic-inputs', inputProvenance);
save('authentic_single_current_arrays', single, [2]);
const threeOptions = {maximumParameterResolutions: 8, maximumFeatureEvaluations: 6};
const threeDocument = fanoutDocument(single);
const three = save('three_shared_region_leaves', evaluateOwned(threeDocument, threeOptions), [2, 3, 4]);
const baseEdit = {expectedRevision: three.document.revision, revision: three.document.revision + 1,
  parameterEdits: [{parameterId: 'base_height', definition: {kind: 'literal', valueMM: 3}}], faceEdits: [], booleanEdits: [], distanceEdits: []};
const raised = save('shared_height_parameter_edit', callOwned(update, three, baseEdit), [3, 4, 5]);
assert.deepEqual(regionRow(raised).evaluation, regionRow(three).evaluation);
const repair = {expectedRevision: raised.document.revision, revision: raised.document.revision + 1, parameterOperations: [
  {kind: 'upsert', parameter: {id: 'new_base_height', type: 'length', definition: {kind: 'literal', valueMM: 4}}},
  {kind: 'upsert', parameter: {id: 'height', type: 'length', definition: {kind: 'offset', parameterId: 'new_base_height', offsetMM: 0}}},
  {kind: 'remove', parameterId: 'base_height'},
], distanceEdits: leafIds.map((featureId, offsetMM) => ({featureId, definition: {kind: 'offset', parameterId: 'new_base_height', offsetMM}}))};
const repaired = save('atomic_all_leaf_parameter_repair', callOwned(parameterTransaction, raised, repair), [4, 5, 6]);
assert.deepEqual(repaired.report.parameterOrder, ['unused', 'new_base_height', 'height']);
const repairedFile = accepted.find(snapshot => snapshot.result === repaired).file;
const sevenOptions = {maximumParameterResolutions: 8, maximumFeatureEvaluations: 7};
const prepared = parse(readFileSync(repairedFile, 'utf8'), sevenOptions);
assert.deepEqual(prepared.document, repaired.document); assert.deepEqual(prepared.features, repaired.features);
ownedFile('explicit_feature_budget7_preparation', {authoredFile: repairedFile, options: sevenOptions, prepared});
const fourth = {...structuredClone(repaired.document.features.find(node => node.kind === 'normal-extrusion')),
  id: 'leaf_fourth', outputSlotId: 'leaf_slot_3', distance: {kind: 'literal', valueMM: 7},
  options: {...repaired.document.features.find(node => node.kind === 'normal-extrusion').options, evaluationId: 'fanout_leaf_3_eval', resultIdPrefix: 'f3'}};
const addFourth = {expectedRevision: prepared.document.revision, revision: prepared.document.revision + 1, featureOperations: [{kind: 'upsert', feature: fourth}]};
const four = save('fourth_literal_extrusion_leaf', callOwned(featureTransaction, prepared, addFourth), [4, 5, 6, 7]);
assert.equal(four.document.features.length, 7);
const emptyThree = save('three_genuine_empty_leaves', evaluateOwned(fanoutDocument(emptySingle), threeOptions), [2, 3, 4], true);
function intact() {
  for (const {result, before} of accepted) assert.deepEqual(result, before);
  for (const [file, bytes] of retainedFiles) assert.deepEqual(readFileSync(file), bytes);
}
function reject(name, action, code, featureId) {
  assert.throws(action, error => {
    assert.ok(error instanceof BooleanExtrusionFeatureGraphError); assert.equal(error.name, 'BooleanExtrusionFeatureGraphError');
    assert.equal(error.code, code); assert.ok(Object.values(BooleanExtrusionFeatureGraphDiagnosticCode).includes(error.code));
    assert.equal(typeof error.path, 'string'); assert.ok(error.path.length <= 256);
    if (featureId !== undefined) assert.equal(error.featureId, featureId);
    failures.push({name, code: error.code, path: error.path, featureId: error.featureId, parameterId: error.parameterId,
      message: error.message, causeCode: error.cause?.code ?? null, actualCausePreserved: Object.hasOwn(error, 'cause')});
    intact(); return true;
  });
}
function rejectedDocument(name, alter, code, featureId) {
  const candidate = structuredClone(three.document); alter(candidate); const before = structuredClone(candidate);
  reject(name, () => evaluate(candidate, threeOptions), code, featureId); assert.deepEqual(candidate, before);
}
const authoredLeaf = (document, index) => document.features.find(node => node.id === leafIds[index]);
rejectedDocument('sibling_evaluation_id_collision', doc => authoredLeaf(doc, 2).options.evaluationId = authoredLeaf(doc, 0).options.evaluationId, 'IDENTITY', leafIds[2]);
rejectedDocument('sibling_prefix_collision', doc => authoredLeaf(doc, 2).options.resultIdPrefix = authoredLeaf(doc, 0).options.resultIdPrefix, 'IDENTITY', leafIds[2]);
rejectedDocument('sibling_unused_role_concatenation_collision', doc => authoredLeaf(doc, 2).options.evaluationId = authoredLeaf(doc, 0).options.resultIdPrefix + '_f_w_63', 'IDENTITY', leafIds[2]);
rejectedDocument('leaf_missing_distance_parameter', doc => authoredLeaf(doc, 2).distance.parameterId = 'missing_parameter', 'PARAMETER', leafIds[2]);
rejectedDocument('leaf_zero_distance', doc => authoredLeaf(doc, 2).distance = {kind: 'literal', valueMM: 0}, 'PARAMETER', leafIds[2]);
rejectedDocument('leaf_negative_distance', doc => authoredLeaf(doc, 2).distance = {kind: 'literal', valueMM: -2}, 'PARAMETER', leafIds[2]);
rejectedDocument('leaf_disappearing_nonzero_offset', doc => authoredLeaf(doc, 2).distance.offsetMM = Number.MIN_VALUE, 'REPRESENTABILITY', leafIds[2]);
rejectedDocument('last_leaf_native_failure_atomic', doc => authoredLeaf(doc, 2).options.maximumBindingSamples = 0, 'NATIVE', leafIds[2]);
rejectedDocument('wrong_kind_leaf_region', doc => authoredLeaf(doc, 2).regionFeatureId = doc.features.find(node => node.kind === 'face-input').id, 'DEPENDENCY', leafIds[2]);
rejectedDocument('boolean_leaf_cycle', doc => doc.features.find(node => node.kind === 'coplanar-boolean').operandAFeatureId = leafIds[2], 'DEPENDENCY');
reject('budget_four_does_not_admit_six_nodes', () => evaluate(three.document, singleOptions), 'BUDGET');
const eightNodes = structuredClone(four.document);
const fifth = {...structuredClone(fourth), id: 'leaf_fifth', outputSlotId: 'leaf_slot_4', options: {...fourth.options, evaluationId: 'leaf_fifth_eval', resultIdPrefix: 'f4'}};
eightNodes.features.push(fifth);
reject('eighth_node_not_in_current_profile', () => evaluate(eightNodes, sevenOptions), 'INPUT');
const duplicateRepair = structuredClone(repair); duplicateRepair.distanceEdits[2] = structuredClone(duplicateRepair.distanceEdits[1]);
reject('duplicate_three_leaf_distance_repair', () => parameterTransaction(raised, duplicateRepair), 'INPUT', leafIds[1]);
reject('dangling_parameter_removal_without_repairs', () => parameterTransaction(raised,
  {expectedRevision: raised.document.revision, revision: raised.document.revision + 1, parameterOperations: [{kind: 'remove', parameterId: 'base_height'}], distanceEdits: []}), 'PARAMETER');
reject('immutable_budget_six_rejects_fourth_leaf', () => featureTransaction(repaired,
  {expectedRevision: repaired.document.revision, revision: repaired.document.revision + 1, featureOperations: [{kind: 'upsert', feature: fourth}]}), 'BUDGET');
let getterCalls = 0;
const getter = structuredClone(three.document);
Object.defineProperty(authoredLeaf(getter, 2).distance, 'offsetMM', {enumerable: true, get() { getterCalls++; return 2; }});
reject('authored_leaf_getter', () => evaluate(getter, threeOptions), 'INPUT'); assert.equal(getterCalls, 0);
const ownedGetter = structuredClone(three);
Object.defineProperty(ownedGetter, 'features', {enumerable: true, get() { getterCalls++; return three.features; }});
reject('owned_getter', () => validate(ownedGetter), 'OWNED'); assert.equal(getterCalls, 0);
// This obsolete cache is a negative control only; current authored parsing supplied every accepted state.
reject('old_singular_report_cache', () => validate(JSON.parse(oldCacheText)), 'OWNED');
for (const [name, alter] of [
  ['distance_array', result => result.report.distances[2].valueMM += .5],
  ['summary_leaf', result => result.report.summary.extrusions[2].shellIds = []],
  ['leaf_source', result => nativeRows(result)[2].evaluation.sources[0].source += ' '],
  ['leaf_geometry', result => nativeRows(result)[2].evaluation.faces[0].surface.controlPoints[0][0][0] += .1],
  ['builder_count', result => result.report.nativeBuilderCalls.normalExtrusion++],
]) {
  const changed = structuredClone(three); alter(changed); reject('owned_' + name + '_tamper', () => validate(changed), 'OWNED');
}
assert.deepEqual(validate(three), three.report); intact();

const packageRoot = resolve(repo, 'packages/barocss-cad');
const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')), declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const coreRuntime = ['evaluateBooleanExtrusionFeatureGraph', 'updateBooleanExtrusionFeatureGraph', 'validateBooleanExtrusionFeatureGraph',
  'BooleanExtrusionFeatureGraphError', 'BooleanExtrusionFeatureGraphDiagnosticCode'];
const serdeRuntime = ['serializeBooleanExtrusionFeatureGraph', 'parseBooleanExtrusionFeatureGraph'];
const coreTypes = ['BooleanExtrusionLengthDefinition', 'BooleanExtrusionLengthParameter', 'BooleanExtrusionFaceFeature', 'BooleanExtrusionBooleanFeature',
  'BooleanExtrusionExtrusionFeature', 'BooleanExtrusionFeatureGraphV0', 'BooleanExtrusionFeatureGraphOptions', 'BooleanExtrusionFeatureGraphEdits',
  'BooleanExtrusionFeatureGraphResolvedParameter', 'BooleanExtrusionFeatureGraphEvaluatedFeature', 'BooleanExtrusionFeatureGraphReport', 'BooleanExtrusionFeatureGraphResult'];
const lifecycleNames = ['transactBooleanExtrusionFeatureGraphParameters', 'transactBooleanExtrusionFeatureGraphFeatures'];
for (const name of [...coreRuntime, ...serdeRuntime, ...lifecycleNames]) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.BooleanExtrusionFeatureGraphDiagnosticCode, BooleanExtrusionFeatureGraphDiagnosticCode);
const declarations = [];
for (const [leaf, names] of [['boolean-extrusion-feature-graph', [...coreRuntime, ...coreTypes]], ['boolean-extrusion-feature-graph-serde', serdeRuntime],
  ['boolean-extrusion-parameter-lifecycle', ['transactBooleanExtrusionFeatureGraphParameters', 'BooleanExtrusionParameterOperation', 'BooleanExtrusionParameterTransaction']],
  ['boolean-extrusion-feature-lifecycle', ['transactBooleanExtrusionFeatureGraphFeatures', 'BooleanExtrusionFeatureOperation', 'BooleanExtrusionFeatureTransaction']]]) {
  assert.ok(readFileSync(declarationPath, 'utf8').includes('./' + leaf + '.js'));
  const file = resolve(packageRoot, 'dist', leaf + '.d.ts'), text = readFileSync(file, 'utf8');
  for (const name of names) assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(text), name);
  if (leaf === 'boolean-extrusion-feature-graph') {
    assert.ok(text.includes('distances: {') && text.includes('extrusions: {'));
    assert.ok(!/^\s*distance: \{/m.test(text));
  }
  declarations.push({file, names});
}
const compiledSingle = publicAPI.parseBooleanExtrusionFeatureGraph(unionText, singleOptions); assert.deepEqual(compiledSingle, single);
const compiledThree = publicAPI.evaluateBooleanExtrusionFeatureGraph(threeDocument, threeOptions); assert.deepEqual(compiledThree, three);
assert.deepEqual(publicAPI.validateBooleanExtrusionFeatureGraph(compiledThree), three.report);
const compiledRepaired = publicAPI.transactBooleanExtrusionFeatureGraphParameters(raised, repair); assert.deepEqual(compiledRepaired, repaired);
const compiledFour = publicAPI.transactBooleanExtrusionFeatureGraphFeatures(prepared, addFourth); assert.deepEqual(compiledFour, four);
const compiledConsumer = {runtimePath, declarationPath, declarations, originalPublicNameCount: 19, lifecyclePublicNames: lifecycleNames,
  reportContract: 'current-plural-distances-and-summary-extrusions-no-singular-aliases', declarationCheck: 'actual declaration export text; no separate TypeScript invocation'};
ownedFile('compiled-consumer', compiledConsumer);
ownedFile('summary', {sourceMode: true, cadSourceInputCount: cadInputs.length, inputProvenance, summaries, failures, compiledConsumer,
  stateCount: summaries.length, refusalCount: failures.length,
  featureBudgetPreparation: {startingBudget: 6, explicitlyParsedBudget: 7, acceptedStateCountIncrement: 0},
  scope: 'Current graph0 authored intent rebuilds shared native Faces/Boolean once per graph loop and evaluates each leaf distance independently. All sibling native role pools are disjoint, even unused roles. Plural report/cache contract, three-leaf parameter repair and explicit-budget fourth-leaf creation preserve source/native ownership and prior bytes. Empty leaves remain genuine empty native outputs. No legacy report adapter, mesh/renderer, spatial output union/assembly, selective recomputation, global history, solid or old producer campaign.'});
assert.equal(summaries.length, 6); intact();
console.log(JSON.stringify({sourceMode: true, cadSourceInputCount: cadInputs.length, inputProvenance, summaries, failures, compiledConsumer}));
