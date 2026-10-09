import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 4,
  'Usage: node boolean-extrusion-feature-graph-demo.mjs --source <output-directory> --boolean-directory <saved-boolean-directory>');
assert.equal(args[0], '--source');
assert.equal(args[2], '--boolean-directory');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const output = resolve(args[1]);
const booleanDirectory = resolve(args[3]);
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
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/boolean-extrusion-feature-graph-serde.ts')));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' +
  Buffer.from(built.outputFiles[0].text).toString('base64'));
const {
  evaluateBooleanExtrusionFeatureGraph: evaluate, updateBooleanExtrusionFeatureGraph: update,
  serializeBooleanExtrusionFeatureGraph: serialize, parseBooleanExtrusionFeatureGraph: parse,
  validateBooleanExtrusionFeatureGraph: validate, BooleanExtrusionFeatureGraphError, BooleanExtrusionFeatureGraphDiagnosticCode,
  compileCadModel,
} = api;
for (const operation of [evaluate, update, serialize, parse, validate, BooleanExtrusionFeatureGraphError]) assert.equal(typeof operation, 'function');
assert.deepEqual(Object.keys(BooleanExtrusionFeatureGraphDiagnosticCode).sort(),
  ['INPUT', 'IDENTITY', 'PARAMETER', 'DEPENDENCY', 'REVISION', 'BUDGET', 'NATIVE', 'REPRESENTABILITY', 'JSON', 'OWNED'].sort());
const options = {maximumParameterResolutions: 8, maximumFeatureEvaluations: 4};

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
const nativeInputs = [], accepted = [];
const ids = {faceA: 'face_a_feature', faceB: 'face_b_feature', boolean: 'boolean_feature', extrusion: 'extrusion_feature'};
function authoredDocument(name, sourceFaces, operation) {
  const face = (id, outputSlotId, input) => ({id, kind: 'face-input', outputSlotId,
    plane: structuredClone(input.plane), loop: structuredClone(input.loop), options: structuredClone(input.options)});
  return {format: 'barocss-native-boolean-extrusion-feature-graph', version: 0, id: 'intent_' + name, revision: 0,
    lengthUnit: 'mm', sourceFrame: 'authored-xyz-no-axis-conversion', parameters: [
      {id: 'height', type: 'length', definition: {kind: 'offset', parameterId: 'base_height', offsetMM: 0}},
      {id: 'base_height', type: 'length', definition: {kind: 'literal', valueMM: 2}},
      {id: 'unused', type: 'length', definition: {kind: 'literal', valueMM: -0}},
    ], features: [
      {id: ids.extrusion, kind: 'normal-extrusion', outputSlotId: 'extrusion_slot', regionFeatureId: ids.boolean,
        distance: {kind: 'offset', parameterId: 'height', offsetMM: 0}, options: {evaluationId: 'intent_extrusion_native', resultIdPrefix: 'gext',
          maximumVertices: 128, maximumFaces: 80, maximumSourceChunks: 17, maximumBindingSamples: 1152}},
      face(ids.faceB, 'face_b_slot', sourceFaces.b),
      {id: ids.boolean, kind: 'coplanar-boolean', outputSlotId: 'boolean_slot', operandAFeatureId: ids.faceA, operandBFeatureId: ids.faceB,
        options: {operation, evaluationId: 'intent_boolean_native', resultIdPrefix: 'gbool', maximumPairTests: 64, maximumFragments: 64}},
      face(ids.faceA, 'face_a_slot', sourceFaces.a),
    ]};
}
function feature(result, id) { const row = result.features.find(row => row.featureId === id); assert.ok(row); return row; }
function nativeIds(value, result = new Set()) {
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
    if (typeof child === 'string' && (key === 'id' || key.endsWith('Id') || key === 'name')) result.add(child);
    else if (key.endsWith('Ids') && Array.isArray(child)) child.filter(item => typeof item === 'string').forEach(item => result.add(item));
    else nativeIds(child, result);
  }
  return result;
}
function check(name, document, expectedArea, expectedShells, expectedDistance, expectedResult) {
  const before = structuredClone(document), result = evaluate(document, options);
  if (expectedResult) assert.deepEqual(result, expectedResult);
  checkOwnership([document, options], result);
  assert.deepEqual(Object.keys(result).sort(), ['document', 'options', 'parameters', 'features', 'report'].sort());
  assert.deepEqual(result.document, document); assert.deepEqual(result.options, options);
  assert.deepEqual(result.features.map(row => row.featureId), [ids.faceB, ids.faceA, ids.boolean, ids.extrusion]);
  assert.deepEqual(result.features.map(row => row.order), [0, 1, 2, 3]);
  assert.deepEqual(result.parameters, [
    {id: 'base_height', type: 'length', valueMM: expectedDistance, dependencyIds: [], order: 0},
    {id: 'height', type: 'length', valueMM: expectedDistance, dependencyIds: ['base_height'], order: 1},
    {id: 'unused', type: 'length', valueMM: -0, dependencyIds: [], order: 2},
  ]);
  const a = feature(result, ids.faceA), b = feature(result, ids.faceB), region = feature(result, ids.boolean), extrusion = feature(result, ids.extrusion);
  for (const row of result.features) {
    const authored = document.features.find(node => node.id === row.featureId);
    assert.equal(row.outputSlotId, authored.outputSlotId); assert.equal(row.kind, authored.kind);
    assert.deepEqual(row.dependencyIds, row.kind === 'face-input' ? [] : row.kind === 'coplanar-boolean' ? [ids.faceA, ids.faceB] : [ids.boolean]);
  }
  for (const row of [a, b]) {
    const authored = document.features.find(node => node.id === row.featureId);
    assert.deepEqual(row.evaluation.plane, authored.plane); assert.deepEqual(row.evaluation.loop, authored.loop); assert.deepEqual(row.evaluation.options, authored.options);
  }
  assert.deepEqual(region.evaluation.faceA, a.evaluation); assert.deepEqual(region.evaluation.faceB, b.evaluation);
  assert.deepEqual(extrusion.evaluation.region, region.evaluation);
  assert.ok(Math.abs(region.evaluation.report.areaUV - expectedArea) <= 1e-7);
  assert.equal(extrusion.evaluation.shells.length, expectedShells); assert.equal(extrusion.evaluation.options.distanceMM, expectedDistance);
  const report = result.report;
  assert.equal(report.schema, 'barocss-native-boolean-extrusion-feature-graph-report'); assert.equal(report.version, 0);
  assert.equal(report.graphId, document.id); assert.equal(report.revision, document.revision);
  assert.deepEqual(report.authoredFeatureOrder, document.features.map(node => node.id));
  assert.deepEqual(report.featureOrder, result.features.map(row => row.featureId)); assert.deepEqual(report.parameterOrder, ['base_height', 'height', 'unused']);
  assert.equal(report.parameterResolutionCount, 3); assert.equal(report.distanceDefinitionEvaluationCount, 1);
  assert.equal(report.featureEvaluationCount, 4); assert.equal(report.nativeBuilderCallCount, 4);
  assert.deepEqual(report.nativeBuilderCalls, {faceInput: 2, coplanarBoolean: 1, normalExtrusion: 1});
  assert.deepEqual(report.distances, [{featureId: ids.extrusion, definition: document.features[0].distance, valueMM: expectedDistance, dependencyIds: ['height']}]);
  assert.equal(report.summary.empty, expectedShells === 0); assert.equal(report.summary.componentCount, expectedShells);
  assert.equal(report.summary.holeCount, region.evaluation.loops.filter(loop => loop.role === 'hole').length);
  assert.deepEqual(report.summary.extrusions.map(output => output.featureId), [ids.extrusion]);
  assert.deepEqual(report.summary.extrusions[0].shellIds, extrusion.evaluation.shells.map(shell => shell.id));
  assert.ok(Math.abs(report.summary.materialAreaUV - expectedArea) <= 1e-7); assert.equal(report.summary.extrusions[0].distanceMM, expectedDistance);
  assert.equal(report.quality.nativeOutputsAreAuthoredEditingAuthority, false); assert.equal(report.quality.globalHistoryCertified, false);
  assert.equal(report.quality.nativeReferenceScope, 'entities-defined-by-this-feature-not-transitive-operand-references');
  assert.equal(report.topologyCertified, false); assert.equal(report.solid, false);
  assert.equal(report.qualifiedBindings.length, 4);
  for (const binding of report.qualifiedBindings) {
    const row = feature(result, binding.featureId), actualIds = nativeIds(row.evaluation);
    assert.equal(binding.graphId, document.id); assert.equal(binding.revision, document.revision);
    assert.equal(binding.outputSlotId, row.outputSlotId); assert.equal(binding.kind, row.kind);
    const sourceBindings = row.kind === 'face-input'
      ? [{assetId: row.evaluation.model.name, sourceVersion: 0, objectIds: row.evaluation.model.objects.map(object => object.id)}]
      : row.evaluation.sources.map(source => ({assetId: source.id, sourceVersion: 0, objectIds: source.model.objects.map(object => object.id)}));
    assert.deepEqual(binding.sources, sourceBindings);
    assert.ok(binding.nativeReferences.length > 0);
    const qualified = new Set();
    for (const reference of binding.nativeReferences) {
      assert.deepEqual(reference, {graphId: document.id, revision: document.revision, featureId: row.featureId,
        outputSlotId: row.outputSlotId, nativeId: reference.nativeId});
      assert.ok(actualIds.has(reference.nativeId)); assert.ok(!qualified.has(reference.nativeId)); qualified.add(reference.nativeId);
    }
  }
  const repeatedOriginal = report.qualifiedBindings.flatMap(binding => binding.nativeReferences)
    .filter(reference => reference.nativeId === 'original_line_0');
  assert.deepEqual(repeatedOriginal.map(reference => reference.featureId), [ids.faceB, ids.faceA]);
  assert.notEqual(repeatedOriginal[0].outputSlotId, repeatedOriginal[1].outputSlotId);
  const sources = [];
  for (const row of result.features) {
    if (row.kind === 'face-input') sources.push({name: row.featureId, source: row.evaluation.source, sourceVersion: row.evaluation.sourceVersion, model: row.evaluation.model});
    else for (const [index, source] of row.evaluation.sources.entries()) sources.push({name: row.featureId + '.' + index, ...source});
  }
  const sourceFiles = sources.map(source => {
    assert.equal(source.sourceVersion, 0); assert.ok(source.model.objects.length <= 16);
    return sourceFile(name + '.' + source.name, source.source, source.model).file;
  });
  assert.deepEqual(validate(result), report);
  const wire = serialize(document, options), file = resolve(output, name + '.authored-graph.json');
  writeFileSync(file, wire); retainedFiles.set(file, readFileSync(file));
  const reopenedDocument = JSON.parse(readFileSync(file, 'utf8'));
  assert.deepEqual(reopenedDocument, document); assert.deepEqual(Object.keys(reopenedDocument).sort(), Object.keys(document).sort());
  assert.ok(Object.is(reopenedDocument.parameters.find(parameter => parameter.id === 'unused').definition.valueMM, -0));
  assert.ok(!Object.hasOwn(reopenedDocument, 'report') && !Object.hasOwn(reopenedDocument, 'options'));
  const cold = parse(readFileSync(file, 'utf8'), options);
  assert.deepEqual(cold, result); assert.deepEqual(validate(cold), report);
  const owned = ownedFile(name + '.owned-graph-result', result); assert.deepEqual(validate(owned.reopened), report);
  assert.deepEqual(document, before);
  accepted.push({result, before: structuredClone(result), file, ownedFile: owned.file});
  summaries.push({name, graphId: document.id, revision: document.revision, materialAreaUV: expectedArea,
    shellCount: expectedShells, distanceMM: expectedDistance, featureOrder: report.featureOrder, parameterOrder: report.parameterOrder,
    nativeBuilderCalls: report.nativeBuilderCalls, sourceFiles, authoredFile: file, ownedFile: owned.file});
  return result;
}
function edits(previous, values) { return {expectedRevision: previous.document.revision, revision: previous.document.revision + 1,
  parameterEdits: [], faceEdits: [], booleanEdits: [], distanceEdits: [], ...values}; }
function applyEdit(previous, edit) {
  const before = structuredClone(previous), editBefore = structuredClone(edit), result = update(previous, edit);
  checkOwnership([previous, edit], result); assert.deepEqual(previous, before); assert.deepEqual(edit, editBefore);
  assert.deepEqual(result.options, previous.options);
  return result;
}

ownedFile('source-api.metafile', built.metafile);
ownedFile('source-api.inputs', {entry, mode: 'in-memory-esbuild', write: false,
  cadInputs, allInputs: sourceInputs, esbuildVersion: esbuild.version});
const inputProvenance = [], outputs = new Map();
for (const [name, operation, area, shells] of [['cross_union', 'union', 24, 1], ['containment_hole', 'difference', 32, 1],
  ['strip_two_components', 'difference', 18, 2], ['reverse_containment_empty', 'difference', 0, 0]]) {
  const file = resolve(booleanDirectory, name + '.owned-region.json'), bytes = readFileSync(file);
  retainedFiles.set(file, bytes);
  const saved = JSON.parse(bytes.toString('utf8'));
  const input = {a: {plane: structuredClone(saved.faceA.plane), loop: structuredClone(saved.faceA.loop), options: structuredClone(saved.faceA.options)},
    b: {plane: structuredClone(saved.faceB.plane), loop: structuredClone(saved.faceB.loop), options: structuredClone(saved.faceB.options)}};
  nativeInputs.push({input, before: structuredClone(input)});
  inputProvenance.push({name, file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
    extractedAuthority: 'only-original-face-plane-loop-options'});
  outputs.set(name, check(name, authoredDocument(name, input, operation), area, shells, 2));
}
ownedFile('authentic-inputs', inputProvenance);
const original = outputs.get('cross_union');
const heightResult = applyEdit(original, edits(original, {parameterEdits: [{parameterId: 'base_height', definition: {kind: 'literal', valueMM: 3}}]}));
const height = check('union_height_edit', heightResult.document, 24, 1, 3, heightResult);
assert.deepEqual(feature(height, ids.boolean).evaluation, feature(original, ids.boolean).evaluation);
assert.notDeepEqual(feature(height, ids.extrusion).evaluation.vertices.map(vertex => vertex.pointMM), feature(original, ids.extrusion).evaluation.vertices.map(vertex => vertex.pointMM));
const operationResult = applyEdit(height, edits(height, {booleanEdits: [{featureId: ids.boolean, operation: 'intersection'}]}));
const intersection = check('operation_intersection_edit', operationResult.document, 4, 1, 3, operationResult);
const oldFace = intersection.document.features.find(node => node.id === ids.faceA), loop = structuredClone(oldFace.loop);
let endpointEdits = 0;
for (const line of loop.edges) for (let endpoint = 0; endpoint < 2; endpoint++) {
  if (difference(line.controlPoints[endpoint], [.5, -3, .5]) === 0) { line.controlPoints[endpoint] = [1, -3, 1]; endpointEdits++; }
}
assert.equal(endpointEdits, 2);
const cornerResult = applyEdit(intersection, edits(intersection, {faceEdits: [{featureId: ids.faceA, plane: oldFace.plane, loop}]}));
const corner = check('authored_corner_edit', cornerResult.document, 4.75, 1, 3, cornerResult);
assert.deepEqual(corner.document.features.map(node => [node.id, node.outputSlotId, node.kind]), original.document.features.map(node => [node.id, node.outputSlotId, node.kind]));
assert.deepEqual(corner.document.features.map(node => node.options), original.document.features.map(node =>
  node.kind === 'coplanar-boolean' ? {...node.options, operation: 'intersection'} : node.options));
const originalRef = original.report.qualifiedBindings.find(binding => binding.featureId === ids.extrusion).nativeReferences[0];
const currentRef = corner.report.qualifiedBindings.find(binding => binding.featureId === ids.extrusion).nativeReferences.find(reference => reference.nativeId === originalRef.nativeId);
assert.ok(currentRef); assert.equal(originalRef.graphId, currentRef.graphId); assert.notEqual(originalRef.revision, currentRef.revision);
assert.equal(corner.report.quality.priorRevisionReferences, 'stale-after-declared-revision-advance-even-if-native-id-repeats');
function intact() {
  for (const {input, before} of nativeInputs) assert.deepEqual(input, before);
  for (const {result, before} of accepted) assert.deepEqual(result, before);
  for (const [file, bytes] of retainedFiles) assert.deepEqual(readFileSync(file), bytes);
}
function reject(name, action, code, context = {}) {
  assert.throws(action, error => {
    assert.ok(error instanceof BooleanExtrusionFeatureGraphError); assert.equal(error.name, 'BooleanExtrusionFeatureGraphError');
    assert.equal(error.code, code); assert.ok(Object.values(BooleanExtrusionFeatureGraphDiagnosticCode).includes(error.code));
    assert.ok(error.message.startsWith('Boolean Extrusion Feature Graph: '));
    assert.equal(typeof error.path, 'string'); assert.ok(error.path.length > 0 && error.path.length <= 256);
    assert.ok(error.featureId === null || typeof error.featureId === 'string'); assert.ok(error.parameterId === null || typeof error.parameterId === 'string');
    if (Object.hasOwn(context, 'featureId')) assert.equal(error.featureId, context.featureId);
    if (Object.hasOwn(context, 'parameterId')) assert.equal(error.parameterId, context.parameterId);
    failures.push({name, code: error.code, path: error.path, featureId: error.featureId, parameterId: error.parameterId,
      message: error.message, actualCausePreserved: Object.hasOwn(error, 'cause')});
    intact(); return true;
  });
}
function rejectedDocument(name, alter, code, context) {
  const candidate = structuredClone(original.document); alter(candidate);
  const before = structuredClone(candidate);
  reject(name, () => evaluate(candidate, options), code, context); assert.deepEqual(candidate, before);
}
rejectedDocument('unused_out_of_range_parameter', doc => doc.parameters[2].definition.valueMM = 10001, 'PARAMETER', {parameterId: 'unused'});
rejectedDocument('unused_missing_parameter_reference', doc => doc.parameters[2].definition = {kind: 'offset', parameterId: 'missing_parameter', offsetMM: 0}, 'PARAMETER');
rejectedDocument('parameter_self_reference', doc => doc.parameters[0].definition.parameterId = 'height', 'PARAMETER', {parameterId: 'height'});
rejectedDocument('parameter_cycle', doc => doc.parameters[1].definition = {kind: 'offset', parameterId: 'height', offsetMM: 0}, 'PARAMETER');
rejectedDocument('parameter_type', doc => doc.parameters[2].type = 'angle', 'PARAMETER', {parameterId: 'unused'});
rejectedDocument('lost_nonzero_parameter_offset', doc => doc.parameters[0].definition.offsetMM = Number.MIN_VALUE, 'REPRESENTABILITY', {parameterId: 'height'});
rejectedDocument('missing_distance_reference', doc => doc.features[0].distance.parameterId = 'missing_parameter', 'PARAMETER', {featureId: ids.extrusion, parameterId: 'missing_parameter'});
rejectedDocument('lost_nonzero_distance_offset', doc => doc.features[0].distance.offsetMM = Number.MIN_VALUE, 'REPRESENTABILITY', {featureId: ids.extrusion, parameterId: 'height'});
rejectedDocument('missing_feature_reference', doc => doc.features[2].operandAFeatureId = 'missing_feature', 'DEPENDENCY', {featureId: ids.boolean});
rejectedDocument('feature_self_reference', doc => doc.features[2].operandAFeatureId = ids.boolean, 'DEPENDENCY', {featureId: ids.boolean});
rejectedDocument('boolean_extrusion_cycle', doc => doc.features[2].operandAFeatureId = ids.extrusion, 'DEPENDENCY');
rejectedDocument('foreign_kind_region_reference', doc => doc.features[0].regionFeatureId = ids.faceA, 'DEPENDENCY', {featureId: ids.extrusion});
rejectedDocument('logical_native_id_collision', doc => doc.parameters[2].id = doc.features[3].plane.id, 'IDENTITY');
rejectedDocument('actual_nonaffine_native_plane', doc => doc.features[3].plane.controlPoints[1][1][2] += .125, 'NATIVE', {featureId: ids.faceA});
reject('parameter_resolution_budget', () => evaluate(original.document, {...options, maximumParameterResolutions: 2}), 'BUDGET');
reject('feature_evaluation_budget', () => evaluate(original.document, {...options, maximumFeatureEvaluations: 3}), 'BUDGET');
reject('stale_edit_revision', () => update(height, {...edits(height, {booleanEdits: [{featureId: ids.boolean, operation: 'intersection'}]}), expectedRevision: 0}), 'REVISION');
reject('skipped_edit_revision', () => update(original, {...edits(original, {booleanEdits: [{featureId: ids.boolean, operation: 'intersection'}]}), revision: 2}), 'REVISION');
reject('empty_edit', () => update(original, edits(original, {})), 'INPUT');
const changedIds = structuredClone(oldFace.loop); changedIds.edges[0].id = 'replacement_curve_id';
reject('face_edit_changes_original_curve_id', () => update(intersection,
  edits(intersection, {faceEdits: [{featureId: ids.faceA, plane: oldFace.plane, loop: changedIds}]})), 'IDENTITY', {featureId: ids.faceA});
let getterCalls = 0;
const getter = structuredClone(original.document);
Object.defineProperty(getter.parameters[2].definition, 'valueMM', {enumerable: true, get() { getterCalls++; return -0; }});
reject('authored_getter', () => evaluate(getter, options), 'INPUT'); assert.equal(getterCalls, 0);
const ownedGetter = structuredClone(original);
Object.defineProperty(ownedGetter, 'features', {enumerable: true, get() { getterCalls++; return original.features; }});
reject('owned_getter', () => validate(ownedGetter), 'OWNED'); assert.equal(getterCalls, 0);
rejectedDocument('future_version', doc => doc.version = 1, 'INPUT');
rejectedDocument('foreign_source_frame', doc => doc.sourceFrame = 'y-up', 'INPUT');
const duplicateJSON = nativeJSON(original.document).replace('"revision":0', '"revision":0,"rev\\u0069sion":0');
assert.notEqual(duplicateJSON, nativeJSON(original.document));
reject('duplicate_decoded_json_key', () => parse(duplicateJSON, options), 'JSON');
for (const [name, alter] of [
  ['native_source', result => feature(result, ids.faceA).evaluation.source += ' '],
  ['extrusion_geometry', result => feature(result, ids.extrusion).evaluation.faces[0].surface.controlPoints[0][0][0] += .25],
  ['resolved_parameter', result => result.parameters[0].valueMM += .1],
  ['qualified_revision', result => result.report.qualifiedBindings[0].nativeReferences[0].revision++],
  ['builder_work', result => result.report.nativeBuilderCallCount++],
]) {
  const changed = structuredClone(original); alter(changed);
  reject('owned_' + name + '_tamper', () => validate(changed), 'OWNED');
}
assert.deepEqual(validate(original), original.report); intact();

const packageRoot = resolve(repo, 'packages/barocss-cad');
const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')), declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const coreRuntime = ['evaluateBooleanExtrusionFeatureGraph', 'updateBooleanExtrusionFeatureGraph', 'validateBooleanExtrusionFeatureGraph',
  'BooleanExtrusionFeatureGraphError', 'BooleanExtrusionFeatureGraphDiagnosticCode'];
const serdeRuntime = ['serializeBooleanExtrusionFeatureGraph', 'parseBooleanExtrusionFeatureGraph'];
const typeNames = ['BooleanExtrusionLengthDefinition', 'BooleanExtrusionLengthParameter', 'BooleanExtrusionFaceFeature',
  'BooleanExtrusionBooleanFeature', 'BooleanExtrusionExtrusionFeature', 'BooleanExtrusionFeatureGraphV0', 'BooleanExtrusionFeatureGraphOptions',
  'BooleanExtrusionFeatureGraphEdits', 'BooleanExtrusionFeatureGraphResolvedParameter', 'BooleanExtrusionFeatureGraphEvaluatedFeature',
  'BooleanExtrusionFeatureGraphReport', 'BooleanExtrusionFeatureGraphResult'];
for (const name of [...coreRuntime, ...serdeRuntime]) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.BooleanExtrusionFeatureGraphDiagnosticCode, BooleanExtrusionFeatureGraphDiagnosticCode);
const declarationFiles = [];
for (const [leaf, names] of [['boolean-extrusion-feature-graph', [...coreRuntime, ...typeNames]],
  ['boolean-extrusion-feature-graph-serde', serdeRuntime]]) {
  assert.ok(readFileSync(declarationPath, 'utf8').includes('./' + leaf + '.js'));
  const file = resolve(packageRoot, 'dist', leaf + '.d.ts'), text = readFileSync(file, 'utf8');
  for (const name of names) assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(text), name);
  declarationFiles.push({file, names});
}
const authoredFile = accepted.find(saved => saved.result.document.id === original.document.id && saved.result.document.revision === 0).file;
const compiled = publicAPI.parseBooleanExtrusionFeatureGraph(readFileSync(authoredFile, 'utf8'), options);
assert.deepEqual(compiled, original); assert.deepEqual(publicAPI.validateBooleanExtrusionFeatureGraph(compiled), original.report);
assert.equal(publicAPI.serializeBooleanExtrusionFeatureGraph(original.document, options), readFileSync(authoredFile, 'utf8'));
const compiledEdited = publicAPI.updateBooleanExtrusionFeatureGraph(compiled,
  edits(compiled, {parameterEdits: [{parameterId: 'base_height', definition: {kind: 'literal', valueMM: 3}}]}));
assert.deepEqual(compiledEdited, height);
const compiledConsumer = {runtimePath, declarationPath, declarationFiles, runtimeNames: [...coreRuntime, ...serdeRuntime], typeNames, publicNameCount: 19,
  declarationCheck: 'actual declaration export text; no separate TypeScript invocation'};
ownedFile('compiled-consumer', compiledConsumer);
ownedFile('summary', {sourceMode: true, cadSourceInputCount: cadInputs.length, inputProvenance, summaries, failures, compiledConsumer,
  caseCount: summaries.length, refusalCount: failures.length,
  scope: 'Authored current intent only: original native Face plane/loop/options, original typed length resolution, actual Face/Boolean/extrusion builders, deterministic first-authored-ready order, stable logical IDs and revision-qualified native provenance. Native results are copied derived output, never editing authority. Full updates and authored-only files retain source coefficients and negative zero. No mesh, selective recomputation, global registry/history, persistent topology, source rewrites, manufacturing, solid/sewing, or old producer campaign.'});
intact();
console.log(JSON.stringify({sourceMode: true, cadSourceInputCount: cadInputs.length, inputProvenance, summaries, failures, compiledConsumer}));
