import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.filter(arg => arg === '--source').length, 1,
  'Usage: node cad-assembly-demo.mjs --source [output-directory]');
const destinations = args.filter(arg => arg !== '--source');
assert.ok(destinations.length <= 1);
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const output = resolve(destinations[0] ?? '/tmp/barocss-cad-assembly-prototype');
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
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/document/cad-assembly.ts')));
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/document/cad-assembly-instance-point.ts')));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' +
  Buffer.from(built.outputFiles[0].text).toString('base64'));
const {
  evaluateCadAssembly: evaluate, serializeCadAssembly: serialize, parseCadAssembly: parse,
  updateCadAssembly: update, validateCadAssemblyResult: validate,
  queryCadAssemblyInstancePoint: queryPoint, validateCadAssemblyInstancePoint: validatePoint,
  CadAssemblyError, CadAssemblyDiagnosticCode,
  compileCadModel, createCadDocument, serializeCadDocument, parseCadDocument, validateCadDocumentResult,
  createCadGeometryReference, resolveCadGeometryReference, queryCadDocumentPoint, CadDocumentError,
} = api;
for (const operation of [evaluate, serialize, parse, update, validate, queryPoint, validatePoint, CadAssemblyError]) {
  assert.equal(typeof operation, 'function');
}
assert.deepEqual(Object.keys(CadAssemblyDiagnosticCode).sort(),
  ['INPUT', 'VERSION', 'IDENTITY', 'REFERENCE', 'STALE', 'HIERARCHY', 'REVISION', 'PLACEMENT',
    'REPRESENTABILITY', 'BUDGET', 'JSON', 'OWNED', 'QUERY', 'NATIVE'].sort());

const summaries = [], failures = [], retainedFiles = new Map();
const sourceFrame = 'authored-xyz-no-axis-conversion';
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

function documentFile(name, wire) {
  const file = resolve(output, name + '.cad-document.json');
  const created = createCadDocument(wire);
  writeFileSync(file, serializeCadDocument(wire));
  const bytes = readFileSync(file), document = parseCadDocument(bytes.toString('utf8'));
  retainedFiles.set(file, bytes);
  assert.deepEqual(document, created);
  assert.deepEqual(document.document, wire);
  assert.deepEqual(validateCadDocumentResult(document), document.report);
  return {file, bytes, document};
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
      assert.ok(!caller.has(value), 'Assembly result aliases caller data');
      assert.ok(!seen.has(value), 'Repeated nested output object occurrence');
      seen.add(value);
      for (const child of Object.values(value)) visit(child);
    }
  };
  visit(result);
}

function assemblyFile(name, wire, expected) {
  const before = structuredClone(wire), result = evaluate(wire);
  if (expected) assert.deepEqual(result, expected);
  assert.deepEqual(wire, before);
  checkOwnership([wire], result);
  const file = resolve(output, name + '.cad-assembly.json');
  writeFileSync(file, serialize(wire));
  const bytes = readFileSync(file), cold = parse(bytes.toString('utf8'));
  retainedFiles.set(file, bytes);
  assert.deepEqual(cold, result);
  assert.deepEqual(validate(cold), result.report);
  const owned = ownedFile(name + '.evaluated', result);
  assert.deepEqual(validate(owned.reopened), result.report);
  assert.deepEqual(result.assembly, wire);
  assert.deepEqual(Object.keys(result).sort(), ['assembly', 'documents', 'instances', 'report'].sort());
  assert.deepEqual(result.documents.map(document => document.document), wire.parts);
  for (const [index, document] of result.documents.entries()) {
    assert.deepEqual(document, createCadDocument(wire.parts[index]));
  }
  assert.deepEqual(result.instances.map(instance => instance.instanceId), wire.instances.map(instance => instance.id));
  for (const [index, instance] of result.instances.entries()) {
    const original = wire.instances[index];
    assert.deepEqual(Object.keys(instance).sort(),
      ['instanceId', 'parentId', 'reference', 'placement', 'ancestors', 'depth', 'localMatrix', 'worldMatrix'].sort());
    assert.equal(instance.parentId, original.parentId);
    assert.deepEqual(instance.reference, original.reference);
    assert.deepEqual(instance.placement, original.placement);
    const ancestors = [];
    let parentId = original.parentId;
    while (parentId !== null) {
      ancestors.unshift(parentId);
      parentId = wire.instances.find(candidate => candidate.id === parentId).parentId;
    }
    assert.deepEqual(instance.ancestors, ancestors);
    assert.equal(instance.depth, ancestors.length + 1);
    for (const matrix of [instance.localMatrix, instance.worldMatrix]) {
      assert.equal(matrix.length, 16);
      assert.ok(matrix.every(Number.isFinite));
      assert.deepEqual(matrix.slice(12), [0, 0, 0, 1]);
    }
    const document = result.documents.find(document => document.document.documentId === instance.reference.documentId);
    const resolved = resolveCadGeometryReference(document, instance.reference);
    assert.equal(resolved.source, document.document.assets.find(asset => asset.id === instance.reference.assetId).source);
  }
  assert.equal(result.report.schema, 'barocss-cad-assembly-report');
  assert.equal(result.report.version, 0);
  assert.equal(result.report.assemblyId, wire.assemblyId);
  assert.equal(result.report.revision, wire.revision);
  assert.deepEqual(result.report.conventions, {matrixLayout: 'row-major', pointConvention: 'column-vector',
    rotationOrder: 'Rz*Ry*Rx', composition: 'parent-world-times-local', ancestorOrder: 'root-to-parent',
    rootDepth: 1, partSourceFrame: sourceFrame, worldFrame: 'assembly-space-xyz'});
  assert.equal(result.report.quality.geometryNotBakedRenamedOrResampled, true);
  assert.equal(result.report.quality.globalBinary64ErrorCertified, false);
  assert.equal(result.report.documentCount, wire.parts.length);
  assert.equal(result.report.instanceCount, wire.instances.length);
  assert.equal(result.report.rootInstanceCount, wire.instances.filter(instance => instance.parentId === null).length);
  assert.equal(result.report.maximumDepth, Math.max(0, ...result.instances.map(instance => instance.depth)));
  const groups = new Map();
  for (const instance of wire.instances) {
    const key = nativeJSON(instance.reference);
    if (!groups.has(key)) groups.set(key, {reference: instance.reference, instanceIds: [], instanceCount: 0});
    const group = groups.get(key);
    group.instanceIds.push(instance.id); group.instanceCount++;
  }
  assert.deepEqual(result.report.sharedPartGroups, [...groups.values()]);
  assert.equal(result.report.uniquePartReferenceCount, groups.size);
  assert.equal(result.report.sharedReferenceCount, [...groups.values()].filter(group => group.instanceCount > 1).length);
  return {file, bytes, result, ownedFile: owned.file};
}

function point(name, saved, instanceId, query, expectedLocal, expectedAssembly) {
  const original = structuredClone(saved.result);
  const instance = saved.result.instances.find(instance => instance.instanceId === instanceId);
  const input = {assemblyId: saved.result.assembly.assemblyId, assemblyRevision: saved.result.assembly.revision,
    instanceId, reference: structuredClone(instance.reference), query};
  const inputBefore = structuredClone(input), result = queryPoint(saved.result, input);
  checkOwnership([saved.result, input], result);
  assert.deepEqual(Object.keys(result).sort(), ['assemblyId', 'assemblyRevision', 'instanceId', 'reference', 'query',
    'originalLocalPointMM', 'assemblyPointMM', 'ancestors', 'localMatrix', 'worldMatrix', 'report'].sort());
  assert.equal(result.assemblyId, input.assemblyId);
  assert.equal(result.assemblyRevision, input.assemblyRevision);
  assert.equal(result.instanceId, instanceId);
  assert.deepEqual(result.reference, input.reference);
  assert.deepEqual(result.query, query);
  const document = saved.result.documents.find(document => document.document.documentId === input.reference.documentId);
  const nativePoint = queryCadDocumentPoint(document, input.reference, query);
  assert.deepEqual(result.originalLocalPointMM, nativePoint.pointMM);
  assert.ok(difference(result.originalLocalPointMM, expectedLocal) <= 1e-10);
  assert.ok(difference(result.assemblyPointMM, expectedAssembly) <= 1e-10);
  assert.deepEqual(result.ancestors, instance.ancestors);
  assert.deepEqual(result.localMatrix, instance.localMatrix);
  assert.deepEqual(result.worldMatrix, instance.worldMatrix);
  const mapped = [0, 1, 2].map(row => {
    const offset = row * 4, matrix = result.worldMatrix, p = result.originalLocalPointMM;
    return matrix[offset] * p[0] + matrix[offset + 1] * p[1] + matrix[offset + 2] * p[2] + matrix[offset + 3];
  });
  assert.ok(difference(result.assemblyPointMM, mapped) <= 1e-10);
  assert.equal(result.report.schema, 'barocss-cad-assembly-instance-point');
  assert.equal(result.report.version, 0);
  assert.deepEqual(result.report.nativePoint, nativePoint);
  assert.equal(result.report.originalLocalFrame, sourceFrame);
  assert.deepEqual(result.report.outputFrame,
    {kind: 'assembly-space-xyz', assemblyId: input.assemblyId, lengthUnit: 'mm'});
  assert.deepEqual(result.report.lineage, [...instance.ancestors, instanceId].map(id => {
    const selected = saved.result.instances.find(instance => instance.instanceId === id);
    const {instanceId, parentId, reference, placement, localMatrix, worldMatrix} = selected;
    return {instanceId, parentId, reference, placement, localMatrix, worldMatrix};
  }));
  assert.equal(result.report.quality.originalLocalQueriesRemainUnposed, true);
  assert.equal(result.report.quality.globalBinary64ErrorCertified, false);
  assert.deepEqual(validatePoint(saved.result, result), result.report);
  const stored = ownedFile(name + '.point', result), cold = parse(readFileSync(saved.file, 'utf8'));
  assert.deepEqual(validatePoint(cold, stored.reopened), result.report);
  assert.deepEqual(queryPoint(cold, input), result);
  assert.deepEqual(saved.result, original);
  assert.deepEqual(input, inputBefore);
  summaries.push({name, assemblyRevision: input.assemblyRevision, instanceId, originalLocalPointMM: result.originalLocalPointMM,
    assemblyPointMM: result.assemblyPointMM, ancestors: result.ancestors, resultFile: stored.file, assemblyFile: saved.file});
  return {input, result};
}

function applyEdit(previous, edits) {
  const before = structuredClone(previous), editsBefore = structuredClone(edits);
  const result = update(previous, edits);
  checkOwnership([previous, edits], result);
  assert.deepEqual(previous, before);
  assert.deepEqual(edits, editsBefore);
  const expected = structuredClone(before.assembly);
  expected.revision = edits.revision;
  for (const edit of edits.instanceEdits) {
    const instance = expected.instances.find(instance => instance.id === edit.instanceId);
    for (const field of ['parentId', 'translationMM', 'rotationDegreesXYZ']) {
      if (!Object.hasOwn(edit, field)) continue;
      if (field === 'parentId') instance.parentId = edit.parentId;
      else instance.placement[field] = structuredClone(edit[field]);
    }
  }
  assert.deepEqual(result.assembly, expected);
  return result;
}

ownedFile('source-api.metafile', built.metafile);
ownedFile('source-api.inputs', {entry, mode: 'in-memory-esbuild', write: false,
  cadInputs, allInputs: sourceInputs, esbuildVersion: esbuild.version});
const sourceA = `@model source_a { version:0; length-unit:mm;
 @curve #shared_curve { type:nurbs; degree:1; knots:[-3,-3,7,7]; control-points:[[0,-0,-0],[2,-0,-0]]; weights:[1,1]; }
 @surface #source_surface { type:nurbs; degree-u:1; degree-v:1; knots-u:[-0,0,1,1]; knots-v:[-0,0,1,1]; control-points:[[[0,0,-0],[0,3,-0]],[[2,0,-0],[2,3,-0]]]; weights:[[1,1],[1,1]]; }
}\n`;
const sourceB = `@model source_b { version:0; length-unit:mm;
 @curve #shared_curve { type:nurbs; degree:1; knots:[-3,-3,7,7]; control-points:[[0,10,-0],[2,10,-0]]; weights:[1,1]; }
}\n`;
const nativeA = sourceFile('source_a', sourceA), nativeB = sourceFile('source_b', sourceB);
const partWire = {schema: 'barocss-cad-document', version: 1, profile: 'direct-geometry', documentId: 'part_doc', revision: 1,
  units: {length: 'mm', angle: 'rad'}, nativeFrame: sourceFrame,
  assets: [['asset_a', nativeA.source], ['asset_b', nativeB.source]].map(([id, source]) =>
    ({id, revision: 1, role: 'authored-native-source', sourceVersion: 0, sourceFrame, source})),
  bodies: [['curve_a_body', 'asset_a', 'shared_curve'], ['surface_body', 'asset_a', 'source_surface'],
    ['curve_b_body', 'asset_b', 'shared_curve']].map(([id, assetId, geometryId]) =>
    ({id, name: id, kind: 'direct-geometry-object', assetId, geometryId})),
  features: [], parameters: [], constraints: [], placements: [], derivedCaches: []};
const part = documentFile('original_part', partWire);
const reference = bodyId => createCadGeometryReference(part.document, {bodyId}).reference;
const curveA = reference('curve_a_body'), curveB = reference('curve_b_body'), surface = reference('surface_body');
assert.equal(curveA.geometryId, curveB.geometryId);
assert.notEqual(curveA.assetId, curveB.assetId);
const placement = (translationMM = [-0, -0, -0], rotationDegreesXYZ = [-0, -0, -0]) => ({translationMM, rotationDegreesXYZ});
const wire = {schema: 'barocss-cad-assembly', version: 0, assemblyId: 'native_assembly', revision: 0,
  lengthUnit: 'mm', rotationUnit: 'deg', frame: 'assembly-space-xyz', parts: [partWire], instances: [
    {id: 'child', parentId: 'parent', reference: curveA, placement: placement([3, -0, -0])},
    {id: 'surface_grandchild', parentId: 'child', reference: surface, placement: placement()},
    {id: 'parent', parentId: null, reference: surface, placement: placement([10, -0, -0], [-0, -0, 90])},
    {id: 'shared_root', parentId: null, reference: curveA, placement: placement([-5, -0, -0])},
    {id: 'asset_b_instance', parentId: null, reference: curveB, placement: placement()},
    {id: 'xyz_order_root', parentId: null, reference: surface, placement: placement([-0, -0, -0], [90, 90, 90])},
  ]};
const original = assemblyFile('revision0', wire), originalBefore = structuredClone(original.result);
const childPoint = point('child_revision0', original, 'child', {kind: 'curve', parameter: 2}, [1, 0, 0], [10, 4, 0]);
const grandchildPoint = point('grandchild_revision0', original, 'surface_grandchild', {kind: 'surface', u: .5, v: .5},
  [1, 1.5, 0], [8.5, 4, 0]);
const sharedPoint = point('shared_root_revision0', original, 'shared_root', {kind: 'curve', parameter: 2}, [1, 0, 0], [-4, 0, 0]);
const distinctPoint = point('asset_b_revision0', original, 'asset_b_instance', {kind: 'curve', parameter: 2}, [1, 10, 0], [1, 10, 0]);
// Rx: [1,0,1.5], then Ry: [1.5,0,-1], then Rz: [0,1.5,-1].
point('xyz_rotation_order', original, 'xyz_order_root', {kind: 'surface', u: .5, v: .5},
  [1, 1.5, 0], [0, 1.5, -1]);
assert.deepEqual(childPoint.result.reference, sharedPoint.result.reference);
assert.notDeepEqual(childPoint.result.originalLocalPointMM, distinctPoint.result.originalLocalPointMM);
const edit1 = {expectedRevision: 0, revision: 1, instanceEdits: [{instanceId: 'parent', translationMM: [20, -0, -0]}]};
const revision1Result = applyEdit(original.result, edit1);
const revision1 = assemblyFile('revision1', revision1Result.assembly, revision1Result);
point('child_revision1', revision1, 'child', {kind: 'curve', parameter: 2}, [1, 0, 0], [20, 4, 0]);
const edit2 = {expectedRevision: 1, revision: 2, instanceEdits: [{instanceId: 'child', parentId: 'shared_root'}]};
const revision2Result = applyEdit(revision1.result, edit2);
const revision2 = assemblyFile('revision2', revision2Result.assembly, revision2Result);
const reparentedPoint = point('child_revision2', revision2, 'child', {kind: 'curve', parameter: 2}, [1, 0, 0], [-1, 0, 0]);
point('grandchild_revision2', revision2, 'surface_grandchild', {kind: 'surface', u: .5, v: .5}, [1, 1.5, 0], [-1, 1.5, 0]);
const edit3 = {expectedRevision: 2, revision: 3, instanceEdits: [{instanceId: 'child', translationMM: [3, -0, -0]}]};
const revision3Result = applyEdit(revision2.result, edit3);
const revision3 = assemblyFile('revision3_noop', revision3Result.assembly, revision3Result);
assert.deepEqual({...revision3.result.assembly, revision: 2}, revision2.result.assembly);
for (const saved of [original, revision1, revision2, revision3]) {
  assert.deepEqual(saved.result.assembly.parts, wire.parts);
  assert.deepEqual(saved.result.instances.map(instance => instance.reference), wire.instances.map(instance => instance.reference));
}
assert.deepEqual(original.result, originalBefore);
const accepted = [original, revision1, revision2, revision3].map(saved => ({saved, before: structuredClone(saved.result)}));
function intact() {
  for (const {saved, before} of accepted) assert.deepEqual(saved.result, before);
  for (const [file, bytes] of retainedFiles) assert.deepEqual(readFileSync(file), bytes);
}
function reject(name, action, code) {
  assert.throws(action, error => {
    assert.ok(error instanceof CadAssemblyError);
    assert.equal(error.name, 'CadAssemblyError');
    assert.equal(error.code, code);
    assert.ok(Object.values(CadAssemblyDiagnosticCode).includes(error.code));
    assert.ok(error.message.startsWith('CAD assembly: '));
    failures.push({name, code: error.code, message: error.message,
      actualCausePreserved: Object.hasOwn(error, 'cause')});
    intact();
    return true;
  });
}
function rejectedWire(name, alter, code) {
  const candidate = structuredClone(wire);
  alter(candidate);
  const before = structuredClone(candidate);
  reject(name, () => evaluate(candidate), code);
  assert.deepEqual(candidate, before);
}
rejectedWire('genuine_cycle', candidate => candidate.instances.find(instance => instance.id === 'parent').parentId = 'child', 'HIERARCHY');
rejectedWire('self_parent', candidate => candidate.instances[0].parentId = 'child', 'HIERARCHY');
rejectedWire('missing_parent', candidate => candidate.instances[0].parentId = 'missing_parent', 'HIERARCHY');
rejectedWire('delete_referenced_parent', candidate => candidate.instances = candidate.instances.filter(instance => instance.id !== 'parent'), 'HIERARCHY');
rejectedWire('duplicate_instance_id', candidate => candidate.instances[1].id = 'child', 'IDENTITY');
rejectedWire('foreign_part_reference', candidate => candidate.instances[0].reference.documentId = 'foreign_document', 'REFERENCE');
rejectedWire('stale_part_source_revision', candidate => {
  candidate.parts[0].revision = 2;
  candidate.parts[0].assets[0].revision = 2;
  candidate.parts[0].assets[0].source = sourceA.replace('[2,-0,-0]', '[4,-0,-0]');
}, 'STALE');
rejectedWire('seventeen_deep_hierarchy', candidate => {
  candidate.instances = Array.from({length: 17}, (_, index) => ({id: 'deep_' + index,
    parentId: index === 0 ? null : 'deep_' + (index - 1), reference: structuredClone(curveA), placement: placement()}));
}, 'HIERARCHY');
rejectedWire('unsafe_translation', candidate => candidate.instances[0].placement.translationMM[0] = 1e10, 'PLACEMENT');
rejectedWire('nonzero_degree_radian_underflow', candidate => candidate.instances[0].placement.rotationDegreesXYZ[0] = Number.MIN_VALUE, 'REPRESENTABILITY');
reject('stale_point_input', () => queryPoint(revision3.result, reparentedPoint.input), 'STALE');
reject('stale_owned_point', () => validatePoint(revision1.result, childPoint.result), 'STALE');
reject('wrong_selected_part_token', () => queryPoint(original.result, {...childPoint.input, reference: curveB}), 'STALE');
reject('stale_update_expected_revision', () => update(original.result,
  {...edit1, expectedRevision: 1}), 'STALE');
reject('update_skipped_revision', () => update(original.result, {...edit1, revision: 2}), 'REVISION');
let getterCalls = 0;
const getterWire = structuredClone(wire);
Object.defineProperty(getterWire.instances[0].placement, 'translationMM', {
  enumerable: true, get() { getterCalls++; return [3, 0, 0]; },
});
reject('wire_getter', () => evaluate(getterWire), 'INPUT');
assert.equal(getterCalls, 0);
const getterPoint = structuredClone(childPoint.input);
Object.defineProperty(getterPoint.query, 'parameter', {
  enumerable: true, get() { getterCalls++; return 2; },
});
reject('point_getter', () => queryPoint(original.result, getterPoint), 'INPUT');
assert.equal(getterCalls, 0);
const duplicateKeyText = nativeJSON(wire).replace('"revision":0', '"revision":0,"rev\\u0069sion":0');
assert.notEqual(duplicateKeyText, nativeJSON(wire));
reject('duplicate_decoded_json_key', () => parse(duplicateKeyText), 'JSON');
const alteredWorld = structuredClone(original.result);
alteredWorld.instances[0].worldMatrix[3] += 1;
reject('owned_world_matrix_tamper', () => validate(alteredWorld), 'OWNED');
for (const [name, alter] of [
  ['posed_point', result => result.assemblyPointMM[0] += .25],
  ['original_native_point', result => result.report.nativePoint.pointMM[0] += .25],
  ['lineage', result => result.report.lineage[0].worldMatrix[3] += .25],
]) {
  const changed = structuredClone(childPoint.result);
  alter(changed);
  reject('owned_' + name + '_tamper', () => validatePoint(original.result, changed), 'OWNED');
}

// Canonical document1 retains its separate direct-geometry admission rules.
for (const [name, alter, code] of [
  ['canonical_placements_unsupported', candidate => candidate.placements.push(placement()), 'PROFILE'],
  ['canonical_duplicate_body_owner', candidate => candidate.bodies.push({...candidate.bodies[0], id: 'duplicate_owner'}), 'REFERENCE'],
]) {
  const candidate = structuredClone(partWire);
  alter(candidate);
  assert.throws(() => createCadDocument(candidate), error => {
    assert.ok(error instanceof CadDocumentError);
    assert.equal(error.code, code);
    failures.push({name, code: error.code, message: error.message, boundary: 'original-canonical-document1'});
    intact();
    return true;
  });
}
assert.deepEqual(validate(original.result), original.result.report);
assert.deepEqual(validatePoint(original.result, childPoint.result), childPoint.result.report);

// Separate current package consumer: seven core runtime exports, two point exports, eleven types.
const packageRoot = resolve(repo, 'packages/barocss-cad');
const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const coreRuntime = ['evaluateCadAssembly', 'serializeCadAssembly', 'parseCadAssembly', 'updateCadAssembly',
  'validateCadAssemblyResult', 'CadAssemblyError', 'CadAssemblyDiagnosticCode'];
const coreTypes = ['CadAssemblyMatrix', 'CadAssemblyPlacement', 'CadAssemblyInstance', 'CadAssemblyV0',
  'CadAssemblyEvaluatedInstance', 'CadAssemblyEdits', 'CadAssemblyReport', 'CadAssemblyResult'];
const pointRuntime = ['queryCadAssemblyInstancePoint', 'validateCadAssemblyInstancePoint'];
const pointTypes = ['CadAssemblyInstancePointQuery', 'CadAssemblyInstancePointReport', 'CadAssemblyInstancePointResult'];
const declarations = [];
for (const [leaf, names] of [['cad-assembly', [...coreRuntime, ...coreTypes]],
  ['cad-assembly-instance-point', [...pointRuntime, ...pointTypes]]]) {
  assert.ok(readFileSync(declarationPath, 'utf8').includes('./' + leaf + '.js'));
  const file = resolve(packageRoot, 'dist', leaf + '.d.ts'), text = readFileSync(file, 'utf8');
  for (const name of names) assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(text), name);
  declarations.push({file, names});
}
for (const name of [...coreRuntime, ...pointRuntime]) {
  assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
}
assert.deepEqual(publicAPI.CadAssemblyDiagnosticCode, CadAssemblyDiagnosticCode);
const internalNames = ['snapshotCadAssemblyData', 'sameCadAssemblyData', 'rebuildCadAssemblyResult',
  'applyCadAssemblyMatrixPoint', 'parseCadDocumentOwnJson', 'cadDocumentOwnUtf8Bytes'];
for (const name of internalNames) {
  assert.ok(!Object.hasOwn(api, name)); assert.ok(!Object.hasOwn(publicAPI, name));
  assert.ok(!new RegExp('\\b' + name + '\\b').test(readFileSync(declarationPath, 'utf8')));
}
const compiled = publicAPI.parseCadAssembly(readFileSync(original.file, 'utf8'));
assert.deepEqual(compiled, original.result);
assert.deepEqual(publicAPI.validateCadAssemblyResult(compiled), compiled.report);
const compiledPoint = publicAPI.queryCadAssemblyInstancePoint(compiled, childPoint.input);
assert.deepEqual(compiledPoint, childPoint.result);
assert.deepEqual(publicAPI.validateCadAssemblyInstancePoint(compiled, compiledPoint), compiledPoint.report);
assert.deepEqual(publicAPI.updateCadAssembly(compiled, edit1), revision1.result);
assert.equal(publicAPI.serializeCadAssembly(wire), readFileSync(original.file, 'utf8'));
const compiledConsumer = {runtimePath, declarationPath, runtimeNames: [...coreRuntime, ...pointRuntime], declarations,
  publicNameCount: coreRuntime.length + coreTypes.length + pointRuntime.length + pointTypes.length,
  internalNamesExcluded: internalNames, declarationCheck: 'actual declaration export text; no separate TypeScript invocation'};
assert.equal(compiledConsumer.publicNameCount, 20);
ownedFile('compiled-consumer', compiledConsumer);
ownedFile('summary', {sourceMode: true, cadSourceInputCount: cadInputs.length, summaries, failures, compiledConsumer,
  sourceFiles: [nativeA.file, nativeB.file], partDocumentFile: part.file,
  assemblyFiles: accepted.map(({saved}) => saved.file), caseCount: summaries.length, refusalCount: failures.length,
  scope: 'Original canonical Source0 geometry with explicit native Assembly0 rigid hierarchy. Qualified part references stay unchanged. Points use original native parameters before row-major parent-world times local transforms. No geometry baking, Euler-angle addition, silent cascade, automatic source rebind, mate constraint, renderer adoption, BRep, topology, solid, or global binary64 certificate.'});
console.log(JSON.stringify({sourceMode: true, cadSourceInputCount: cadInputs.length, summaries, failures, compiledConsumer}));
