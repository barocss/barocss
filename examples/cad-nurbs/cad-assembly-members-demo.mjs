import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 4,
  'Usage: node cad-assembly-members-demo.mjs --source <output-directory> --assembly-file <authored-assembly-file>');
assert.equal(args[0], '--source');
assert.equal(args[2], '--assembly-file');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const output = resolve(args[1]);
const assemblyInputFile = resolve(args[3]);
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
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/cad-assembly.ts')));
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/cad-assembly-members.ts')));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' +
  Buffer.from(built.outputFiles[0].text).toString('base64'));
const {
  transactCadAssemblyMembers: transact, validateCadAssemblyMemberTransaction: validateTransaction,
  parseCadAssembly: parse, serializeCadAssembly: serialize, validateCadAssemblyResult: validateAssembly,
  queryCadAssemblyInstancePoint: queryPoint, validateCadAssemblyInstancePoint: validatePoint,
  queryCadDocumentPoint, compileCadModel, CadAssemblyError, CadAssemblyDiagnosticCode,
} = api;
for (const operation of [transact, validateTransaction, parse, serialize, validateAssembly, queryPoint, validatePoint]) {
  assert.equal(typeof operation, 'function');
}

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

const accepted = [], acceptedWrappers = [];
function saveAssembly(name, result) {
  const before = structuredClone(result);
  const file = resolve(output, name + '.cad-assembly.json');
  writeFileSync(file, serialize(result.assembly));
  retainedFiles.set(file, readFileSync(file));
  const cold = parse(readFileSync(file, 'utf8'));
  checkOwnership([result], cold);
  assert.deepEqual(cold, result);
  assert.deepEqual(validateAssembly(cold), result.report);
  assert.deepEqual(result, before);
  const saved = {file, result};
  accepted.push({saved, before});
  return saved;
}

function transaction(name, previous, input) {
  const before = structuredClone(previous.result), inputBefore = structuredClone(input);
  const wrapper = transact(previous.result, input);
  checkOwnership([previous.result, input], wrapper);
  assert.deepEqual(Object.keys(wrapper).sort(), ['assemblyId', 'previousRevision', 'transaction', 'result', 'report'].sort());
  assert.equal(wrapper.assemblyId, previous.result.assembly.assemblyId);
  assert.equal(wrapper.previousRevision, previous.result.assembly.revision);
  assert.deepEqual(wrapper.transaction, input);
  const candidate = structuredClone(before.assembly);
  candidate.revision = input.revision;
  candidate.instances = candidate.instances.filter(instance => !input.removeInstanceIds.includes(instance.id));
  for (const edit of input.reparentInstances) candidate.instances.find(instance => instance.id === edit.instanceId).parentId = edit.parentId;
  candidate.instances.push(...structuredClone(input.addInstances));
  assert.deepEqual(wrapper.result.assembly, candidate);
  assert.deepEqual(wrapper.result.documents, previous.result.documents);
  const added = input.addInstances.map(instance => instance.id), removed = input.removeInstanceIds;
  const reparented = input.reparentInstances.map(edit => edit.instanceId);
  const changed = input.reparentInstances.filter(edit =>
    previous.result.assembly.instances.find(instance => instance.id === edit.instanceId).parentId !== edit.parentId).map(edit => edit.instanceId);
  const survivors = before.assembly.instances.filter(instance => !removed.includes(instance.id)).map(instance => instance.id);
  const report = wrapper.report;
  assert.equal(report.schema, 'barocss-cad-assembly-member-transaction');
  assert.equal(report.version, 0);
  assert.equal(report.assemblyId, wrapper.assemblyId);
  assert.equal(report.previousRevision, wrapper.previousRevision);
  assert.equal(report.revision, input.revision);
  assert.equal(report.priorInstanceCount, before.assembly.instances.length);
  assert.equal(report.finalInstanceCount, candidate.instances.length);
  assert.equal(report.addedInstanceCount, added.length);
  assert.equal(report.removedInstanceCount, removed.length);
  assert.equal(report.reparentRequestedCount, reparented.length);
  assert.equal(report.changedParentCount, changed.length);
  assert.equal(report.survivorCount, survivors.length);
  assert.equal(report.operationCount, added.length + removed.length + reparented.length);
  assert.deepEqual(report.addedInstanceIds, added);
  assert.deepEqual(report.removedInstanceIds, removed);
  assert.deepEqual(report.reparentRequestedInstanceIds, reparented);
  assert.deepEqual(report.changedParentInstanceIds, changed);
  assert.deepEqual(report.survivingInstanceIds, survivors);
  assert.deepEqual(report.finalInstanceIds, candidate.instances.map(instance => instance.id));
  assert.equal(report.noOp, added.length === 0 && removed.length === 0 && changed.length === 0);
  assert.equal(report.quality.partsSourceBitsPreserved, true);
  assert.equal(report.quality.survivingReferenceBitsPreserved, true);
  assert.equal(report.quality.survivingPlacementBitsPreserved, true);
  assert.equal(report.quality.rendererCapacityCertified, false);
  assert.equal(report.limits.maximumFinalInstances, 32);
  assert.deepEqual(validateTransaction(previous.result, wrapper), report);
  const saved = saveAssembly(name, wrapper.result), owned = ownedFile(name + '.member-transaction', wrapper);
  const coldPrevious = parse(readFileSync(previous.file, 'utf8'));
  assert.deepEqual(validateTransaction(coldPrevious, owned.reopened), report);
  assert.deepEqual(transact(coldPrevious, input), wrapper);
  assert.deepEqual(previous.result, before);
  assert.deepEqual(input, inputBefore);
  acceptedWrappers.push({wrapper, before: structuredClone(wrapper)});
  summaries.push({name, previousRevision: wrapper.previousRevision, revision: input.revision,
    priorCount: before.assembly.instances.length, finalCount: candidate.instances.length,
    added, removed, reparented, changed, noOp: report.noOp,
    previousAssemblyFile: previous.file, assemblyFile: saved.file, transactionFile: owned.file});
  return {...saved, wrapper, transactionFile: owned.file};
}

const pointSummaries = [];
function point(name, saved, instanceId, query, expectedLocal, expectedAssembly) {
  const instance = saved.result.instances.find(instance => instance.instanceId === instanceId);
  const input = {assemblyId: saved.result.assembly.assemblyId, assemblyRevision: saved.result.assembly.revision,
    instanceId, reference: structuredClone(instance.reference), query};
  const before = structuredClone(saved.result), inputBefore = structuredClone(input);
  const result = queryPoint(saved.result, input);
  checkOwnership([saved.result, input], result);
  const document = saved.result.documents.find(document => document.document.documentId === input.reference.documentId);
  const native = queryCadDocumentPoint(document, input.reference, query);
  assert.deepEqual(result.originalLocalPointMM, native.pointMM);
  assert.deepEqual(result.report.nativePoint, native);
  assert.ok(difference(result.originalLocalPointMM, expectedLocal) <= 1e-7);
  assert.ok(difference(result.assemblyPointMM, expectedAssembly) <= 1e-7);
  assert.equal(result.report.originalLocalFrame, sourceFrame);
  assert.deepEqual(result.report.outputFrame,
    {kind: 'assembly-space-xyz', assemblyId: input.assemblyId, lengthUnit: 'mm'});
  assert.deepEqual(result.ancestors, instance.ancestors);
  assert.deepEqual(validatePoint(saved.result, result), result.report);
  const stored = ownedFile(name + '.point', result), cold = parse(readFileSync(saved.file, 'utf8'));
  assert.deepEqual(validatePoint(cold, stored.reopened), result.report);
  assert.deepEqual(queryPoint(cold, input), result);
  assert.deepEqual(saved.result, before);
  assert.deepEqual(input, inputBefore);
  pointSummaries.push({name, revision: input.assemblyRevision, instanceId,
    originalLocalPointMM: result.originalLocalPointMM, assemblyPointMM: result.assemblyPointMM, pointFile: stored.file});
  return {input, result};
}

ownedFile('source-api.metafile', built.metafile);
ownedFile('source-api.inputs', {entry, mode: 'in-memory-esbuild', write: false,
  cadInputs, allInputs: sourceInputs, esbuildVersion: esbuild.version});
const inputBytes = readFileSync(assemblyInputFile);
const inputSHA256 = createHash('sha256').update(inputBytes).digest('hex');
const baselineResult = parse(inputBytes.toString('utf8'));
assert.equal(baselineResult.assembly.revision, 0);
assert.equal(baselineResult.instances.length, 6);
const authenticCopy = resolve(output, 'authentic_revision0.cad-assembly.json');
writeFileSync(authenticCopy, inputBytes);
retainedFiles.set(authenticCopy, readFileSync(authenticCopy));
assert.deepEqual(parse(readFileSync(authenticCopy, 'utf8')), baselineResult);
assert.deepEqual(validateAssembly(baselineResult), baselineResult.report);
const baseline = {file: authenticCopy, result: baselineResult};
accepted.push({saved: baseline, before: structuredClone(baselineResult)});
const baselineOwned = ownedFile('authentic_revision0.evaluated', baselineResult);
assert.deepEqual(validateAssembly(baselineOwned.reopened), baselineResult.report);
const sources = [];
for (const document of baselineResult.documents) for (const asset of document.document.assets) {
  const compiled = document.compiledAssets.find(compiled => compiled.assetId === asset.id);
  sources.push(sourceFile(document.document.documentId + '.' + asset.id, asset.source, compiled.model));
}
const sourceProvenance = {assemblyInputFile, inputSHA256, inputBytes: inputBytes.length,
  copiedFile: authenticCopy, assemblyId: baselineResult.assembly.assemblyId,
  instanceIds: baselineResult.assembly.instances.map(instance => instance.id), sourceFiles: sources.map(saved => saved.file)};
ownedFile('authentic-input', sourceProvenance);
const find = id => baselineResult.assembly.instances.find(instance => instance.id === id);
for (const id of ['child', 'parent', 'shared_root', 'surface_grandchild', 'asset_b_instance']) assert.ok(find(id));
const curveA = find('child').reference, curveB = find('asset_b_instance').reference;
assert.equal(curveA.geometryId, curveB.geometryId);
assert.notEqual(curveA.assetId, curveB.assetId);
const placement = (translationMM = [-0, -0, -0]) => ({translationMM, rotationDegreesXYZ: [-0, -0, -0]});
const member = (id, parentId = null, reference = curveA, translationMM) =>
  ({id, parentId, reference: structuredClone(reference), placement: placement(translationMM)});
const request = (previous, operations) => ({expectedRevision: previous.result.assembly.revision,
  revision: previous.result.assembly.revision + 1, addInstances: [], removeInstanceIds: [], reparentInstances: [], ...operations});
const addRequest = request(baseline, {addInstances: [member('new_shared_child', 'parent', curveA, [4, -0, -0]),
  member('new_asset_b_root', null, curveB)]});
const added = transaction('revision1_added', baseline, addRequest);
assert.equal(added.result.instances.length, 8);
point('new_shared_child', added, 'new_shared_child', {kind: 'curve', parameter: 2}, [1, 0, 0], [10, 5, 0]);
point('new_asset_b_root', added, 'new_asset_b_root', {kind: 'curve', parameter: 2}, [1, 10, 0], [1, 10, 0]);
const removedLeaf = transaction('revision2_removed_leaf', added,
  request(added, {removeInstanceIds: ['new_shared_child']}));
assert.equal(removedLeaf.result.instances.length, 7);
assert.deepEqual(removedLeaf.result.instances, added.result.instances.filter(instance => instance.instanceId !== 'new_shared_child'));
const reparented = transaction('revision3_parent_removed_child_reparented', removedLeaf,
  request(removedLeaf, {removeInstanceIds: ['parent'], reparentInstances: [{instanceId: 'child', parentId: 'shared_root'}]}));
point('reparented_child', reparented, 'child', {kind: 'curve', parameter: 2}, [1, 0, 0], [-1, 0, 0]);
const oldPoint = point('reparented_grandchild', reparented, 'surface_grandchild', {kind: 'surface', u: .5, v: .5},
  [1, 1.5, 0], [-1, 1.5, 0]);
const noop = transaction('revision4_explicit_noop', reparented,
  request(reparented, {reparentInstances: [{instanceId: 'child', parentId: 'shared_root'}]}));
assert.equal(noop.wrapper.report.noOp, true);
assert.deepEqual(noop.result.instances, reparented.result.instances);
const empty = transaction('revision5_explicitly_empty', noop,
  request(noop, {removeInstanceIds: noop.result.assembly.instances.map(instance => instance.id)}));
assert.equal(empty.result.instances.length, 0);
assert.equal(empty.result.report.maximumDepth, 0);
assert.deepEqual(empty.result.assembly.parts, baselineResult.assembly.parts);
const subtree = transaction('explicit_subtree_removed_branch', baseline,
  request(baseline, {removeInstanceIds: ['parent', 'child', 'surface_grandchild']}));
assert.deepEqual(subtree.result.assembly.instances.map(instance => instance.id),
  baselineResult.assembly.instances.filter(instance => !['parent', 'child', 'surface_grandchild'].includes(instance.id)).map(instance => instance.id));
const capacityRequest = request(baseline, {addInstances: Array.from({length: 26}, (_, index) =>
  member('capacity_' + index, null, curveA, [index, -0, -0]))});
const full = transaction('thirty_two_members', baseline, capacityRequest);
assert.equal(full.result.instances.length, 32);
point('capacity_last_native_point', full, 'capacity_25', {kind: 'curve', parameter: 2}, [1, 0, 0], [26, 0, 0]);
function intact() {
  assert.deepEqual(readFileSync(assemblyInputFile), inputBytes);
  for (const {saved, before} of accepted) assert.deepEqual(saved.result, before);
  for (const {wrapper, before} of acceptedWrappers) assert.deepEqual(wrapper, before);
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
function rejectedTransaction(name, input, code, previous = baseline) {
  const before = structuredClone(input);
  reject(name, () => transact(previous.result, input), code);
  assert.deepEqual(input, before);
}
rejectedTransaction('parent_removal_requires_explicit_child_action',
  request(removedLeaf, {removeInstanceIds: ['parent']}), 'HIERARCHY', removedLeaf);
rejectedTransaction('stale_expected_revision', {...request(baseline, {removeInstanceIds: ['child']}), expectedRevision: 1}, 'STALE');
rejectedTransaction('skipped_revision', {...request(baseline, {removeInstanceIds: ['child']}), revision: 2}, 'REVISION');
rejectedTransaction('empty_transaction', request(baseline, {}), 'INPUT');
rejectedTransaction('duplicate_add_id', request(baseline, {addInstances: [member('duplicate_new'), member('duplicate_new')]}), 'IDENTITY');
rejectedTransaction('existing_add_id', request(baseline, {addInstances: [member('child')]}), 'IDENTITY');
rejectedTransaction('removed_id_cannot_be_recycled', request(baseline,
  {removeInstanceIds: ['asset_b_instance'], addInstances: [member('asset_b_instance', null, curveB)]}), 'IDENTITY');
rejectedTransaction('unknown_remove', request(baseline, {removeInstanceIds: ['unknown_instance']}), 'REFERENCE');
rejectedTransaction('duplicate_remove', request(baseline, {removeInstanceIds: ['asset_b_instance', 'asset_b_instance']}), 'IDENTITY');
rejectedTransaction('removed_member_reparent_conflict', request(baseline,
  {removeInstanceIds: ['child'], reparentInstances: [{instanceId: 'child', parentId: null}]}), 'INPUT');
rejectedTransaction('nonexisting_reparent', request(baseline,
  {reparentInstances: [{instanceId: 'unknown_instance', parentId: null}]}), 'REFERENCE');
const foreign = member('foreign_added'); foreign.reference.documentId = 'foreign_part';
rejectedTransaction('foreign_added_reference', request(baseline, {addInstances: [foreign]}), 'REFERENCE');
const stale = member('stale_added'); stale.reference.documentRevision++;
rejectedTransaction('stale_added_reference', request(baseline, {addInstances: [stale]}), 'STALE');
rejectedTransaction('genuine_final_graph_cycle', request(baseline,
  {reparentInstances: [{instanceId: 'child', parentId: 'surface_grandchild'}]}), 'HIERARCHY');
rejectedTransaction('missing_added_parent', request(baseline, {addInstances: [member('missing_parent_child', 'unknown_parent')]}), 'HIERARCHY');
rejectedTransaction('unsafe_added_placement', request(baseline,
  {addInstances: [member('unsafe_translation', null, curveA, [1e10, 0, 0])]}), 'PLACEMENT');
rejectedTransaction('thirty_third_member', request(full, {addInstances: [member('thirty_third')]}), 'BUDGET', full);
let getterCalls = 0;
const getter = request(baseline, {});
Object.defineProperty(getter, 'addInstances', {enumerable: true,
  get() { getterCalls++; return [member('getter_member')]; }});
reject('transaction_getter', () => transact(baseline.result, getter), 'INPUT');
assert.equal(getterCalls, 0);
for (const [name, alter] of [
  ['transaction', wrapper => wrapper.transaction.addInstances[0].placement.translationMM[0] += .25],
  ['report', wrapper => wrapper.report.finalInstanceCount++],
  ['source', wrapper => wrapper.result.assembly.parts[0].assets[0].source += ' '],
  ['world', wrapper => wrapper.result.instances[0].worldMatrix[3] += .25],
]) {
  const changed = structuredClone(added.wrapper);
  alter(changed);
  reject('owned_' + name + '_tamper', () => validateTransaction(baseline.result, changed), 'OWNED');
}
reject('old_point_token_after_noop_revision', () => queryPoint(noop.result, oldPoint.input), 'STALE');
reject('removed_member_at_current_revision', () => queryPoint(empty.result,
  {...oldPoint.input, assemblyRevision: empty.result.assembly.revision}), 'QUERY');
assert.deepEqual(validateTransaction(baseline.result, added.wrapper), added.wrapper.report);
intact();

// Separate built package consumer; the membership API adds exactly five public names.
const packageRoot = resolve(repo, 'packages/barocss-cad');
const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const runtimeNames = ['transactCadAssemblyMembers', 'validateCadAssemblyMemberTransaction'];
const typeNames = ['CadAssemblyMemberTransaction', 'CadAssemblyMemberReport', 'CadAssemblyMemberResult'];
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], 'function');
assert.deepEqual(publicAPI.CadAssemblyDiagnosticCode, CadAssemblyDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./cad-assembly-members.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/cad-assembly-members.d.ts');
const declaration = readFileSync(leafDeclarationPath, 'utf8');
for (const name of [...runtimeNames, ...typeNames]) {
  assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(declaration), name);
}
const compiledPrevious = publicAPI.parseCadAssembly(readFileSync(baseline.file, 'utf8'));
const compiled = publicAPI.transactCadAssemblyMembers(compiledPrevious, addRequest);
assert.deepEqual(compiled, added.wrapper);
assert.deepEqual(publicAPI.validateCadAssemblyMemberTransaction(compiledPrevious, compiled), compiled.report);
const compiledPoint = publicAPI.queryCadAssemblyInstancePoint(compiled.result,
  {assemblyId: compiled.assemblyId, assemblyRevision: compiled.result.assembly.revision,
    instanceId: 'new_shared_child', reference: curveA, query: {kind: 'curve', parameter: 2}});
assert.ok(difference(compiledPoint.assemblyPointMM, [10, 5, 0]) <= 1e-7);
assert.deepEqual(publicAPI.validateCadAssemblyInstancePoint(compiled.result, compiledPoint), compiledPoint.report);
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 5,
  declarationCheck: 'actual declaration export text; no separate TypeScript invocation'};
ownedFile('compiled-consumer', compiledConsumer);
ownedFile('summary', {sourceMode: true, cadSourceInputCount: cadInputs.length, sourceProvenance,
  summaries, pointSummaries, failures, compiledConsumer,
  transactionCount: summaries.length, nativePointCount: pointSummaries.length, refusalCount: failures.length,
  scope: 'Authentic saved Assembly0 and unchanged canonical Source0 parts. Explicit member add/remove/reparent transactions only; survivor bits and order retained, additions appended. Whole candidate hierarchy validated atomically. Explicit subtree and all-member removal are caller lists. Native point queries remain exact revision bound. Native 32-member admission is independent of renderer capacity. No silent cascade, ID recycling, part/source rewrite, geometry baking, source hash certificate, old demo replay, renderer adoption, topology, solid, or global numeric certificate.'});
intact();
console.log(JSON.stringify({sourceMode: true, cadSourceInputCount: cadInputs.length,
  sourceProvenance, summaries, pointSummaries, failures, compiledConsumer}));
