import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node assembly-part-replacement-demo.mjs --source <output-directory>'); assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]); mkdirSync(output, {recursive: true});
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json')), esbuild = require('esbuild');
const entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundle = await esbuild.build({absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true});
assert.equal(bundle.outputFiles.length, 1);
const sourceInputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path)), cadInputs = sourceInputs.filter(path => path.includes('/packages/barocss-cad/'));
for (const leaf of ['index.ts', 'document/cad-assembly-part-replacement.ts', 'document/cad-assembly.ts', 'cad-document.ts', 'document/cad-document-reference.ts']) assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const {replaceCadAssemblyPart: replace, validateCadAssemblyPartReplacement: validate, CadAssemblyError,
  createCadDocument, serializeCadDocument, parseCadDocument, createCadGeometryReference, resolveCadGeometryReference,
  rebindCadGeometryReference, CadReferenceError, evaluateCadAssembly, serializeCadAssembly, parseCadAssembly,
  validateCadAssemblyResult, queryCadAssemblyInstancePoint, validateCadAssemblyInstancePoint, queryCadDocumentPoint,
  editCurveControlPolygon, compileCadModel} = api;
const runtimeNames = ['replaceCadAssemblyPart', 'validateCadAssemblyPartReplacement'];
const typeNames = ['CadAssemblyPartReplacement', 'CadAssemblyPartReplacementReport', 'CadAssemblyPartReplacementResult'];
for (const name of runtimeNames) assert.equal(typeof api[name], 'function');
const retainedFiles = new Map(), accepted = [], savedAssemblies = [], cases = [], failures = [], pointReceipts = [];
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
function sourceFile(name, source, expectedModel = null) {
  const file = resolve(output, name + '.source0.css'); writeFileSync(file, source); retainedFiles.set(file, readFileSync(file));
  const cold = compileCadModel(readFileSync(file, 'utf8'), {sourceVersion: 0}); assert.equal(cold.ok, true, JSON.stringify(cold.diagnostics));
  if (expectedModel) assert.deepEqual(cold.model, expectedModel); return {file, model: cold.model};
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
  if (typeof expected === 'number') { assert.ok(Object.is(actual, expected), 'Preserved native/source/pose/reference bits changed'); return; }
  assert.deepEqual(actual, expected); if (expected && typeof expected === 'object') for (const key of Object.keys(expected)) bits(actual[key], expected[key]);
}
const close = (actual, expected) => assert.ok(Math.hypot(...actual.map((value, i) => value - expected[i])) <= 1e-7);
const frame = 'authored-xyz-no-axis-conversion';
const sourceA = '@model source_a { version:0; length-unit:mm; @curve #shared_curve { type:nurbs; degree:1; knots:[-3,-3,7,7]; control-points:[[0,-0,-0],[2,-0,-0]]; weights:[1,1]; } ' +
  '@surface #source_surface { type:nurbs; degree-u:1; degree-v:1; knots-u:[-0,0,1,1]; knots-v:[-0,0,1,1]; control-points:[[[0,0,-0],[0,3,-0]],[[2,0,-0],[2,3,-0]]]; weights:[[1,1],[1,1]]; } }\n';
const sourceB = '@model source_b { version:0; length-unit:mm; @curve #shared_curve { type:nurbs; degree:1; knots:[-3,-3,7,7]; control-points:[[0,10,-0],[2,10,-0]]; weights:[1,1]; } }\n';
const nativeA = sourceFile('original.asset_a', sourceA), nativeB = sourceFile('original.asset_b', sourceB);
const documentWire = (documentId, sources, bodies) => ({schema: 'barocss-cad-document', version: 1, profile: 'direct-geometry', documentId, revision: 1,
  units: {length: 'mm', angle: 'rad'}, nativeFrame: frame, assets: sources.map(([id, source]) => ({id, revision: 1, role: 'authored-native-source', sourceVersion: 0, sourceFrame: frame, source})),
  bodies: bodies.map(([id, assetId, geometryId]) => ({id, name: id, kind: 'direct-geometry-object', assetId, geometryId})),
  features: [], parameters: [], constraints: [], placements: [], derivedCaches: []});
const target = createCadDocument(documentWire('target_doc', [['asset_a', sourceA], ['asset_b', sourceB]],
  [['curve_a_body', 'asset_a', 'shared_curve'], ['surface_body', 'asset_a', 'source_surface'], ['curve_b_body', 'asset_b', 'shared_curve']]));
const unrelated = createCadDocument(documentWire('unrelated_doc', [['asset_b', sourceB]], [['curve_b_body', 'asset_b', 'shared_curve']]));
function saveDocument(name, document) {
  const file = resolve(output, name + '.cad-document.json'); writeFileSync(file, serializeCadDocument(document.document)); retainedFiles.set(file, readFileSync(file));
  assert.deepEqual(parseCadDocument(readFileSync(file, 'utf8')), document); return file;
}
saveDocument('original.target', target); saveDocument('original.unrelated', unrelated);
const ref = (document, bodyId) => createCadGeometryReference(document, {bodyId}).reference;
const curveRef = ref(target, 'curve_a_body'), surfaceRef = ref(target, 'surface_body'), otherAssetRef = ref(target, 'curve_b_body'), unrelatedRef = ref(unrelated, 'curve_b_body');
assert.equal(curveRef.geometryId, otherAssetRef.geometryId); assert.equal(curveRef.geometryId, unrelatedRef.geometryId);
assert.notEqual(curveRef.assetId, otherAssetRef.assetId); assert.notEqual(curveRef.documentId, unrelatedRef.documentId);
const placement = (translationMM = [0, -0, 0]) => ({translationMM, rotationDegreesXYZ: [0, -0, 0]});
const member = (id, reference, translationMM, parentId = null) => ({id, parentId, reference: structuredClone(reference), placement: placement(translationMM)});
const wire = {schema: 'barocss-cad-assembly', version: 0, assemblyId: 'replacement_assembly', revision: 0, lengthUnit: 'mm', rotationUnit: 'deg', frame: 'assembly-space-xyz',
  parts: [target.document, unrelated.document], instances: [member('shared_a', curveRef), member('shared_b', curveRef, [10, 0, 0], 'shared_a'),
    member('unchanged_surface', surfaceRef), member('unchanged_other_asset', otherAssetRef), member('unrelated_instance', unrelatedRef, [0, 0, 5])]};
function saveAssembly(name, result) {
  const file = resolve(output, name + '.cad-assembly.json'); writeFileSync(file, serializeCadAssembly(result.assembly)); retainedFiles.set(file, readFileSync(file));
  assert.deepEqual(parseCadAssembly(readFileSync(file, 'utf8')), result); assert.deepEqual(validateCadAssemblyResult(result), result.report);
  savedAssemblies.push({result, before: structuredClone(result), file}); return file;
}
const baseline = evaluateCadAssembly(wire), baselineFile = saveAssembly('original', baseline);
const originalCurve = target.compiledAssets.find(asset => asset.assetId === 'asset_a').model.objects.find(object => object.id === 'shared_curve');
const edit = editCurveControlPolygon(originalCurve, {poleEdits: [{index: 1, xMM: 4}]});
jsonFile('actual-native-control-edit', edit); sourceFile('actual-native-control-edit', edit.source, edit.model);
const replacementDocument = structuredClone(target.document); replacementDocument.revision = 2;
replacementDocument.assets[0].revision = 2;
replacementDocument.assets[0].source = sourceA.replace(nativeJSON(originalCurve.controlPoints[1]), nativeJSON(edit.curve.controlPoints[1]));
assert.notEqual(replacementDocument.assets[0].source, sourceA); assert.equal(replacementDocument.assets[1].source, sourceB);
const editedModel = structuredClone(nativeA.model); editedModel.objects[0] = structuredClone(edit.curve);
sourceFile('edited.complete-asset_a', replacementDocument.assets[0].source, editedModel);
assert.deepEqual(editedModel.objects[1], nativeA.model.objects[1]);
const replacement = createCadDocument(replacementDocument); saveDocument('edited.target', replacement);
function transactionFor(previous, replacementDocument, reverseOrder = true) {
  const document = createCadDocument(replacementDocument), byBody = new Map();
  const repairs = previous.assembly.instances.filter(instance => instance.reference.documentId === replacementDocument.documentId).map(instance => {
    if (!byBody.has(instance.reference.bodyId)) byBody.set(instance.reference.bodyId, ref(document, instance.reference.bodyId));
    return {instanceId: instance.id, previousReference: structuredClone(instance.reference), reference: structuredClone(byBody.get(instance.reference.bodyId))};
  });
  return {expectedRevision: previous.assembly.revision, revision: previous.assembly.revision + 1, documentId: replacementDocument.documentId,
    expectedDocumentRevision: previous.assembly.parts.find(part => part.documentId === replacementDocument.documentId).revision,
    replacementDocument, referenceRepairs: reverseOrder ? repairs.toReversed() : repairs};
}
function point(name, assembly, instanceId, query, expectedLocal, expectedWorld) {
  const instance = assembly.instances.find(row => row.instanceId === instanceId), input = {assemblyId: assembly.assembly.assemblyId, assemblyRevision: assembly.assembly.revision,
    instanceId, reference: instance.reference, query};
  const result = queryCadAssemblyInstancePoint(assembly, input); ownership([assembly, input], result);
  const document = assembly.documents.find(document => document.document.documentId === instance.reference.documentId);
  bits(result.originalLocalPointMM, queryCadDocumentPoint(document, instance.reference, query).pointMM);
  close(result.originalLocalPointMM, expectedLocal); close(result.assemblyPointMM, expectedWorld); assert.deepEqual(validateCadAssemblyInstancePoint(assembly, result), result.report);
  jsonFile(name + '.actual-point', result); pointReceipts.push({name, instanceId, assemblyRevision: input.assemblyRevision, originalLocalPointMM: result.originalLocalPointMM, assemblyPointMM: result.assemblyPointMM});
  return {input, result};
}
const originalPoint = point('before.shared_a', baseline, 'shared_a', {kind: 'curve', parameter: 2}, [1, 0, 0], [1, 0, 0]);
point('before.shared_b', baseline, 'shared_b', {kind: 'curve', parameter: 2}, [1, 0, 0], [11, 0, 0]);
function check(name, previous, transaction) {
  const before = structuredClone({previous, transaction}), request = jsonFile(name + '.authored-request', {previous, transaction});
  const owned = replace(previous, transaction); ownership([previous, transaction], owned); assert.deepEqual({previous, transaction}, before);
  assert.deepEqual(Object.keys(owned).sort(), ['previous', 'transaction', 'result', 'report'].sort()); bits(owned.previous, previous); bits(owned.transaction, transaction);
  const candidate = owned.result, report = owned.report, oldWire = previous.assembly, newWire = candidate.assembly;
  const partIndex = oldWire.parts.findIndex(part => part.documentId === transaction.documentId), oldPart = oldWire.parts[partIndex];
  const affected = oldWire.instances.filter(instance => instance.reference.documentId === transaction.documentId), unaffected = oldWire.instances.filter(instance => instance.reference.documentId !== transaction.documentId);
  assert.equal(newWire.assemblyId, oldWire.assemblyId); assert.equal(newWire.revision, transaction.revision); assert.equal(newWire.parts.length, oldWire.parts.length); assert.equal(newWire.instances.length, oldWire.instances.length);
  assert.deepEqual(newWire.parts[partIndex], transaction.replacementDocument);
  for (let i = 0; i < oldWire.parts.length; i++) if (i !== partIndex) bits(newWire.parts[i], oldWire.parts[i]);
  const repairById = new Map(transaction.referenceRepairs.map(repair => [repair.instanceId, repair]));
  for (const [i, instance] of newWire.instances.entries()) {
    const old = oldWire.instances[i], oldEvaluated = previous.instances[i], evaluated = candidate.instances[i];
    assert.equal(instance.id, old.id); assert.equal(instance.parentId, old.parentId); bits(instance.placement, old.placement);
    bits(evaluated.localMatrix, oldEvaluated.localMatrix); bits(evaluated.worldMatrix, oldEvaluated.worldMatrix); bits(evaluated.ancestors, oldEvaluated.ancestors);
    if (repairById.has(instance.id)) { const repair = repairById.get(instance.id); bits(repair.previousReference, old.reference); bits(instance.reference, repair.reference); }
    else bits(instance.reference, old.reference);
  }
  assert.equal(report.schema, 'barocss-cad-assembly-part-replacement'); assert.equal(report.version, 0);
  assert.equal(report.assemblyId, oldWire.assemblyId); assert.equal(report.documentId, transaction.documentId); assert.equal(report.partIndex, partIndex);
  assert.equal(report.previousAssemblyRevision, oldWire.revision); assert.equal(report.assemblyRevision, newWire.revision);
  assert.equal(report.previousDocumentRevision, oldPart.revision); assert.equal(report.documentRevision, transaction.replacementDocument.revision);
  const changedAssetIds = oldPart.assets.filter((asset, i) => asset.source !== transaction.replacementDocument.assets[i].source).map(asset => asset.id);
  assert.deepEqual(report.changedAssetIds, changedAssetIds); assert.equal(report.changedAssetCount, changedAssetIds.length);
  assert.deepEqual(report.repairedInstanceIds, affected.map(instance => instance.id)); assert.deepEqual(report.repairInputInstanceIds, transaction.referenceRepairs.map(repair => repair.instanceId));
  assert.deepEqual(report.unaffectedInstanceIds, unaffected.map(instance => instance.id)); assert.deepEqual(report.unchangedPartIds, oldWire.parts.filter((_, i) => i !== partIndex).map(part => part.documentId));
  assert.equal(report.instanceCount, oldWire.instances.length); assert.equal(report.repairCount, affected.length);
  assert.equal(report.lengthUnit, 'mm'); assert.equal(report.rotationUnit, 'deg'); assert.equal(report.frame, 'assembly-space-xyz'); assert.equal(report.sourceFrame, frame);
  assert.ok(Object.values(report.preservation).every(value => value === true));
  for (const flag of ['changedGeometryRebindClaimed', 'sourceHashCertified', 'hiddenHistoryOrRefresh', 'topologyCertified', 'solid', 'rendererCertified', 'globalBinary64ErrorCertified']) assert.equal(report.quality[flag], false);
  bits(candidate.report.sharedPartGroups.map(group => group.instanceIds), previous.report.sharedPartGroups.map(group => group.instanceIds));
  assert.deepEqual(report.callCounts, {priorAssemblyRebuild: 1, replacementDocumentCreation: 1,
    referenceCreation: new Set(affected.map(instance => instance.reference.bodyId)).size, previousReferenceResolution: affected.length, replacementReferenceResolution: affected.length, candidateAssemblyEvaluation: 1});
  for (const [i, provenance] of report.assetProvenance.entries()) {
    const oldAsset = oldPart.assets[i], newAsset = transaction.replacementDocument.assets[i];
    assert.equal(provenance.assetId, oldAsset.id); assert.equal(provenance.sourceChanged, oldAsset.source !== newAsset.source);
    assert.equal(provenance.previousRevision, oldAsset.revision); assert.equal(provenance.revision, newAsset.revision);
    assert.equal(provenance.previousSource, oldAsset.source); assert.equal(provenance.source, newAsset.source);
    assert.equal(provenance.nativeModelChanged, nativeJSON(previous.documents[partIndex].compiledAssets[i].model) !== nativeJSON(candidate.documents[partIndex].compiledAssets[i].model));
    sourceFile(name + '.asset_' + i, newAsset.source, candidate.documents[partIndex].compiledAssets[i].model);
  }
  for (const provenance of report.referenceProvenance) {
    const repair = repairById.get(provenance.instanceId); assert.ok(repair); bits(provenance.previousReference, repair.previousReference); bits(provenance.reference, repair.reference);
    const oldDocument = previous.documents[partIndex], newDocument = candidate.documents[partIndex];
    const beforeGeometry = resolveCadGeometryReference(oldDocument, repair.previousReference).geometry, afterGeometry = resolveCadGeometryReference(newDocument, repair.reference).geometry;
    assert.equal(provenance.nativeGeometryChanged, nativeJSON(beforeGeometry) !== nativeJSON(afterGeometry));
  }
  assert.deepEqual(validate(owned), report); const saved = jsonFile(name + '.owned-replacement', owned), assemblyFile = saveAssembly(name + '.complete', candidate);
  const coldPrevious = parseCadAssembly(serializeCadAssembly(request.reopened.previous.assembly));
  assert.deepEqual(replace(coldPrevious, request.reopened.transaction), saved.reopened); assert.deepEqual(validate(saved.reopened), report);
  assert.deepEqual(parseCadAssembly(readFileSync(assemblyFile, 'utf8')), saved.reopened.result);
  accepted.push({previous, transaction, before, owned, beforeOwned: structuredClone(owned)});
  cases.push({name, changedAssetIds, repairCount: affected.length, instanceCount: oldWire.instances.length, callCounts: report.callCounts,
    requestFile: request.file, resultFile: saved.file, assemblyFile}); return owned;
}
jsonFile('source-api.inputs', {entry, sourceInputs, cadInputs, sourceOnly: true, write: false, esbuildVersion: esbuild.version}); jsonFile('source-api.metafile', bundle.metafile);
const editTransaction = transactionFor(baseline, replacementDocument), edited = check('geometry_edit', baseline, editTransaction);
assert.equal(edited.report.repairCount, 4); assert.equal(edited.report.callCounts.referenceCreation, 3);
point('after.shared_a', edited.result, 'shared_a', {kind: 'curve', parameter: 2}, [2, 0, 0], [2, 0, 0]);
point('after.shared_b', edited.result, 'shared_b', {kind: 'curve', parameter: 2}, [2, 0, 0], [12, 0, 0]);
point('after.unchanged_surface', edited.result, 'unchanged_surface', {kind: 'surface', u: .5, v: .5}, [1, 1.5, 0], [1, 1.5, 0]);
point('after.unchanged_other_asset', edited.result, 'unchanged_other_asset', {kind: 'curve', parameter: 2}, [1, 10, 0], [1, 10, 0]);
point('after.unrelated_part', edited.result, 'unrelated_instance', {kind: 'curve', parameter: 2}, [1, 10, 0], [1, 10, 5]);
const sameAssetRebind = rebindCadGeometryReference(target, replacement, surfaceRef), sameDocOtherRebind = rebindCadGeometryReference(target, replacement, otherAssetRef);
bits(sameAssetRebind.reference, edited.result.assembly.instances.find(instance => instance.id === 'unchanged_surface').reference);
bits(sameDocOtherRebind.reference, edited.result.assembly.instances.find(instance => instance.id === 'unchanged_other_asset').reference);
jsonFile('actual-713-unchanged-rebinds', [sameAssetRebind, sameDocOtherRebind]);
let changedRebindError; try { rebindCadGeometryReference(target, replacement, curveRef); } catch (error) { changedRebindError = error; }
assert.ok(changedRebindError instanceof CadReferenceError); assert.equal(changedRebindError.code, 'STALE');
jsonFile('actual-713-changed-rebind-refusal', {code: changedRebindError.code, message: changedRebindError.message});
const whitespaceDocument = structuredClone(replacementDocument); whitespaceDocument.revision = 3; whitespaceDocument.assets[0].revision = 3; whitespaceDocument.assets[0].source += ' ';
const whitespace = check('whitespace_edit', edited.result, transactionFor(edited.result, whitespaceDocument));
assert.ok(whitespace.report.assetProvenance.every(asset => !asset.nativeModelChanged)); assert.ok(whitespace.report.referenceProvenance.every(reference => !reference.nativeGeometryChanged));
point('whitespace.shared_b', whitespace.result, 'shared_b', {kind: 'curve', parameter: 2}, [2, 0, 0], [12, 0, 0]);
const uninstancedWire = {...structuredClone(wire), assemblyId: 'uninstanced_target', instances: [structuredClone(wire.instances[4])]}, uninstanced = evaluateCadAssembly(uninstancedWire);
saveAssembly('uninstanced.before', uninstanced); const noRepairs = check('uninstanced_edit', uninstanced, transactionFor(uninstanced, replacementDocument));
assert.equal(noRepairs.report.repairCount, 0); assert.equal(noRepairs.report.callCounts.referenceCreation, 0);
point('uninstanced.unrelated', noRepairs.result, 'unrelated_instance', {kind: 'curve', parameter: 2}, [1, 10, 0], [1, 10, 5]);
const maximumWire = {...structuredClone(wire), assemblyId: 'maximum_affected', instances: Array.from({length: 32}, (_, i) => member('affected_' + i, curveRef, [i, 0, 0]))}, maximum = evaluateCadAssembly(maximumWire);
saveAssembly('maximum.before', maximum); const maximumResult = check('maximum32_edit', maximum, transactionFor(maximum, replacementDocument));
assert.equal(maximumResult.report.repairCount, 32); assert.equal(maximumResult.report.callCounts.referenceCreation, 1);
point('maximum.last', maximumResult.result, 'affected_31', {kind: 'curve', parameter: 2}, [2, 0, 0], [33, 0, 0]);
function intact() {
  for (const row of savedAssemblies) assert.deepEqual(row.result, row.before);
  for (const row of accepted) { assert.deepEqual({previous: row.previous, transaction: row.transaction}, row.before); assert.deepEqual(row.owned, row.beforeOwned); }
  for (const [file, bytes] of retainedFiles) assert.deepEqual(readFileSync(file), bytes, file);
}
function reject(name, action, code) {
  assert.throws(action, error => { assert.ok(error instanceof CadAssemblyError); assert.equal(error.code, code); assert.ok(error.message.length <= 1024);
    failures.push({name, code: error.code, message: error.message, causeName: error.cause?.name ?? null, causeCode: error.cause?.code ?? null}); intact(); return true; });
}
const changedTransaction = (alter) => { const value = structuredClone(editTransaction); alter(value); return value; };
reject('stale_assembly_revision', () => replace(baseline, changedTransaction(value => { value.expectedRevision = 1; })), 'STALE');
reject('skipped_assembly_revision', () => replace(baseline, changedTransaction(value => { value.revision = 2; })), 'REVISION');
reject('stale_document_revision', () => replace(baseline, changedTransaction(value => { value.expectedDocumentRevision = 0; })), 'STALE');
reject('skipped_document_revision', () => replace(baseline, changedTransaction(value => { value.replacementDocument.revision = 3; })), 'REVISION');
reject('changed_asset_without_increment', () => replace(baseline, changedTransaction(value => { value.replacementDocument.assets[0].revision = 1; })), 'REVISION');
reject('unchanged_asset_increment', () => replace(baseline, changedTransaction(value => { value.replacementDocument.assets[1].revision = 2; })), 'REVISION');
reject('no_source_change', () => replace(baseline, changedTransaction(value => { value.replacementDocument = {...structuredClone(target.document), revision: 2}; })), 'INPUT');
reject('missing_shared_repair', () => replace(baseline, changedTransaction(value => { value.referenceRepairs = value.referenceRepairs.filter(repair => repair.instanceId !== 'shared_a'); })), 'REFERENCE');
reject('missing_unchanged_asset_repair', () => replace(baseline, changedTransaction(value => { value.referenceRepairs = value.referenceRepairs.filter(repair => repair.instanceId !== 'unchanged_other_asset'); })), 'REFERENCE');
reject('duplicate_repair', () => replace(baseline, changedTransaction(value => { value.referenceRepairs.push(structuredClone(value.referenceRepairs[0])); })), 'IDENTITY');
reject('foreign_unaffected_repair', () => replace(baseline, changedTransaction(value => { value.referenceRepairs.push({instanceId: 'unrelated_instance', previousReference: unrelatedRef, reference: unrelatedRef}); })), 'REFERENCE');
reject('stale_previous_reference', () => replace(baseline, changedTransaction(value => { value.referenceRepairs[0].previousReference.assetRevision++; })), 'STALE');
reject('old_valid_reference_different_binding', () => replace(baseline, changedTransaction(value => { value.referenceRepairs[0].previousReference = structuredClone(curveRef); })), 'REFERENCE');
reject('new_qualified_body_retarget', () => replace(baseline, changedTransaction(value => { value.referenceRepairs.find(repair => repair.instanceId === 'shared_a').reference = ref(replacement, 'surface_body'); })), 'REFERENCE');
reject('old_reference_still_stale', () => replace(baseline, changedTransaction(value => { value.referenceRepairs[0].reference = value.referenceRepairs[0].previousReference; })), 'STALE');
reject('body_binding_retarget', () => replace(baseline, changedTransaction(value => { value.replacementDocument.bodies[0].geometryId = 'source_surface'; })), 'REFERENCE');
reject('invalid_source', () => replace(baseline, changedTransaction(value => { value.replacementDocument.assets[0].source += '@broken'; })), 'NATIVE');
reject('unsupported_source_frame', () => replace(baseline, changedTransaction(value => { value.replacementDocument.nativeFrame = 'unapproved-frame'; })), 'INPUT');
reject('unsupported_document_features', () => replace(baseline, changedTransaction(value => { value.replacementDocument.features = [{id: 'unsupported_feature'}]; })), 'INPUT');
reject('revision_negative_zero', () => replace(baseline, changedTransaction(value => { value.expectedRevision = -0; })), 'REVISION');
reject('too_many_repairs', () => replace(baseline, changedTransaction(value => { value.referenceRepairs = Array.from({length: 33}, () => structuredClone(value.referenceRepairs[0])); })), 'BUDGET');
let getterCalls = 0;
const getter = structuredClone(editTransaction); Object.defineProperty(getter, 'replacementDocument', {enumerable: true, get() { getterCalls++; return replacementDocument; }});
reject('transaction_getter', () => replace(baseline, getter), 'INPUT');
const sourceGetter = structuredClone(editTransaction); Object.defineProperty(sourceGetter.replacementDocument.assets[0], 'source', {enumerable: true, get() { getterCalls++; return sourceA; }});
reject('replacement_source_getter', () => replace(baseline, sourceGetter), 'INPUT'); assert.equal(getterCalls, 0);
reject('stale_old_point_query', () => queryCadAssemblyInstancePoint(edited.result, originalPoint.input), 'STALE');
for (const [name, alter] of [
  ['repair', result => { result.transaction.referenceRepairs[0].reference.assetRevision++; }], ['report', result => { result.report.changedAssetCount++; }],
  ['world', result => { result.result.instances[0].worldMatrix[3] += .25; }], ['source', result => {
    const original = result.transaction.replacementDocument.assets[0].source;
    result.transaction.replacementDocument.assets[0].source = original.replace('[4,-0,-0]', '[5,-0,-0]'); assert.notEqual(result.transaction.replacementDocument.assets[0].source, original);
  }],
]) { const changed = structuredClone(edited); alter(changed); reject('owned_' + name, () => validate(changed), 'OWNED'); }
let acceptedReplacement = edited.result; const previousAccepted = acceptedReplacement;
reject('atomic_prior_assembly', () => { acceptedReplacement = replace(baseline, changedTransaction(value => { value.referenceRepairs.pop(); })); }, 'REFERENCE');
assert.strictEqual(acceptedReplacement, previousAccepted); jsonFile('atomic-retention', {previousAssemblyUnchanged: acceptedReplacement === previousAccepted, getterCalls});
const packageRoot = resolve(repo, 'packages/barocss-cad'), manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.publishConfig?.exports?.['.'] ?? manifest.exports['.'], runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath)); assert.ok(existsSync(declarationPath)); const publicAPI = await import(pathToFileURL(runtimePath).href);
for (const name of runtimeNames) assert.equal(typeof publicAPI[name], 'function'); assert.equal(typeof publicAPI.CadAssemblyError, 'function');
assert.deepEqual(publicAPI.CadAssemblyDiagnosticCode, api.CadAssemblyDiagnosticCode); assert.ok(readFileSync(declarationPath, 'utf8').includes('./document/cad-assembly-part-replacement.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/document/cad-assembly-part-replacement.d.ts'), declaration = readFileSync(leafDeclarationPath, 'utf8');
for (const name of [...runtimeNames, ...typeNames]) assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(declaration), name);
for (const row of cases) {
  const request = JSON.parse(readFileSync(row.requestFile, 'utf8')), stored = JSON.parse(readFileSync(row.resultFile, 'utf8'));
  const coldPrevious = publicAPI.parseCadAssembly(publicAPI.serializeCadAssembly(request.previous.assembly));
  const result = publicAPI.replaceCadAssemblyPart(coldPrevious, request.transaction); assert.deepEqual(result, stored); assert.deepEqual(publicAPI.validateCadAssemblyPartReplacement(stored), stored.report);
  assert.deepEqual(publicAPI.parseCadAssembly(readFileSync(row.assemblyFile, 'utf8')), stored.result);
}
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeNames, typeNames, publicNameCount: 5,
  existingErrorNamesCheckedSeparately: ['CadAssemblyError', 'CadAssemblyDiagnosticCode'], exportSelection: manifest.publishConfig?.exports?.['.'] ? 'publishConfig.exports root' : 'exports root'};
jsonFile('compiled-consumer', compiledConsumer); intact();
const summary = {sourceMode: true, cadSourceInputCount: cadInputs.length, cases, failures, pointReceipts, compiledConsumer, caseCount: cases.length,
  refusalCount: failures.length, getterCalls, originalAssemblyFile: baselineFile, changed713RebindRemainsStale: true,
  scope: 'Explicit embedded part source/revision replacement and complete qualified reference repairs; unchanged sources, identities, hierarchy, poses and matrices retained. No hidden hash/history, external refresh, geometry baking, renderer, mates or Solid certificate.'};
jsonFile('summary', summary); intact(); console.log(JSON.stringify(summary));
