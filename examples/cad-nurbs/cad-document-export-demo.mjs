import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {basename, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.filter(arg => arg === '--source').length, 1,
  'Usage: node cad-document-export-demo.mjs --source [output-directory]');
const destinations = args.filter(arg => arg !== '--source');
assert.ok(destinations.length <= 1);
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const output = resolve(destinations[0] ?? '/tmp/barocss-cad-document-export-prototype');
mkdirSync(output, {recursive: true});
const sourceFixture = '/Users/user/.barocss-ai/v3/evidence-712-cad/demo-output/original.asset_0.source0.css';
const documentFixture = '/Users/user/.barocss-ai/v3/evidence-712-cad/demo-output/original.cad-document.json';
const sourceFixtureBytes = readFileSync(sourceFixture), documentFixtureBytes = readFileSync(documentFixture);
const originalSource = sourceFixtureBytes.toString('utf8');
assert.deepEqual(Buffer.from(originalSource, 'utf8'), sourceFixtureBytes);

// Current source is bundled in memory. The declared compiled consumer is separate.
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
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/cad-document-export.ts')));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' +
  Buffer.from(built.outputFiles[0].text).toString('base64'));
const {
  getCadDocumentExportCapabilities: getCapabilities, inspectCadDocumentExport: inspect,
  exportCadDocument: exportDocument, validateCadDocumentExport: validate,
  CadDocumentExportError, CadDocumentExportDiagnosticCode,
  createCadDocument, parseCadDocument, serializeCadDocument, validateCadDocumentResult,
  createCadGeometryReference, resolveCadGeometryReference, evaluateCurve, evaluateSurface,
  curveDomain, surfaceDomain, compileCadModel,
} = api;
for (const operation of [getCapabilities, inspect, exportDocument, validate, CadDocumentExportError]) {
  assert.equal(typeof operation, 'function');
}
assert.deepEqual(Object.keys(CadDocumentExportDiagnosticCode).sort(),
  ['INPUT', 'TARGET', 'REFERENCE', 'IDENTITY', 'BUDGET', 'NATIVE', 'BINDING', 'OWNED'].sort());

const summaries = [], failures = [];
const frame = 'authored-xyz-no-axis-conversion';
const hash = value => createHash('sha256').update(value).digest('hex');

// Original Models and sidecar domains contain -0; retain raw tokens on file reopen.
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

function rawFile(name, value) {
  const file = resolve(output, name);
  writeFileSync(file, nativeJSON(value) + '\n');
  const reopened = JSON.parse(readFileSync(file, 'utf8'));
  assert.deepEqual(reopened, value);
  return {file, reopened, sha256: hash(readFileSync(file))};
}

function nativeModel(source) {
  const compiled = compileCadModel(source, {sourceVersion: 0});
  assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
  return compiled.model;
}

function nativeZeroCount(geometry) {
  const values = geometry.kind === 'curve'
    ? [...geometry.knots, ...geometry.weights, ...geometry.controlPoints.flat()]
    : [...geometry.knotsU, ...geometry.knotsV, ...geometry.weights.flat(), ...geometry.controlPoints.flat(2)];
  return values.filter(value => Object.is(value, -0)).length;
}

function documentFile(name, wire) {
  const file = resolve(output, name + '.cad-document.json');
  writeFileSync(file, serializeCadDocument(wire));
  const bytes = readFileSync(file), document = parseCadDocument(bytes.toString('utf8'));
  assert.deepEqual(document.document, wire);
  assert.deepEqual(validateCadDocumentResult(document), document.report);
  for (const asset of document.compiledAssets) assert.deepEqual(asset.model, nativeModel(asset.source));
  return {file, bytes, document};
}

function optionsFor(document) {
  const selections = [['body_surface', 'shared01_surface'], ['body_second_curve', 'shared01_curve_b'],
    ['body_curve', 'shared01_curve_a']].map(([bodyId, outputId]) =>
    ({reference: createCadGeometryReference(document, {bodyId}).reference, outputId}));
  return {target: 'iges-5.3-ascii', exportModelId: 'selected_native_export', selections};
}

function checkReport(document, options, result, capabilities) {
  const report = result.report;
  assert.equal(report.schema, 'barocss-cad-document-export-report');
  assert.equal(report.version, 0);
  assert.equal(report.documentVersion, 1);
  assert.equal(report.sourceVersion, 0);
  assert.equal(report.documentId, document.document.documentId);
  assert.equal(report.documentRevision, document.document.revision);
  assert.equal(report.documentProfile, 'direct-geometry');
  assert.equal(report.target, options.target);
  assert.equal(report.format, 'IGES 5.3 ASCII');
  assert.equal(report.outputRole, 'native-geometry-exchange');
  assert.equal(report.profile, '126-128');
  assert.equal(report.exportModelId, options.exportModelId);
  assert.equal(report.lengthUnit, 'mm');
  assert.equal(report.frame, 'raw-authored-xyz-no-axis-conversion');
  assert.equal(report.sourceFrame, frame);
  assert.equal(report.modelScale, 1);
  assert.equal(report.selectedObjectCount, options.selections.length);
  assert.equal(report.outputBytes, Buffer.byteLength(result.iges, 'ascii'));
  assert.deepEqual(report.selectedReferences, options.selections.map(selection => selection.reference));
  for (const [index, mapping] of report.mappings.entries()) {
    const selection = options.selections[index], writer = result.writerReport.objects[index];
    const geometry = resolveCadGeometryReference(document, selection.reference).geometry;
    const domains = geometry.kind === 'curve' ? {u: curveDomain(geometry), v: null} : surfaceDomain(geometry);
    assert.equal(mapping.selectionIndex, index);
    assert.deepEqual(mapping.reference, selection.reference);
    assert.equal(mapping.outputId, selection.outputId);
    assert.equal(mapping.geometryKind, geometry.kind);
    assert.equal(mapping.entity, geometry.kind === 'curve' ? 126 : 128);
    assert.equal(mapping.directoryPointer, 2 * index + 1);
    assert.equal(mapping.directoryPointer, writer.directoryPointer);
    assert.equal(mapping.parameterPointer, writer.parameterPointer);
    assert.equal(mapping.parameterRecords, writer.parameterRecords);
    assert.deepEqual(mapping.domainU, domains.u);
    assert.deepEqual(mapping.domainV, domains.v);
    assert.equal(mapping.directoryLabel, selection.outputId.slice(0, 8));
    assert.equal(mapping.labelTruncated, true);
    assert.deepEqual(mapping.labelCollisionOutputIds, options.selections.filter((_, other) => other !== index)
      .map(selection => selection.outputId));
    assert.equal(mapping.signedZeroOccurrences, nativeZeroCount(geometry));
    assert.equal(mapping.signedZeroParameterOccurrences, nativeZeroCount(geometry)
      + [...domains.u, ...(domains.v ?? [])].filter(value => Object.is(value, -0)).length);
  }
  assert.deepEqual(report.signedZeroNormalization, {policy: 'negative-zero-to-positive-zero-in-iges-numeric-fields',
    nativeOccurrences: 10, parameterOccurrences: 11, originalNativeBitsPreserved: true});
  assert.deepEqual(report.directoryLabels, {maximumCharacters: 8, truncatedCount: 3,
    collisions: [{directoryLabel: 'shared01', outputIds: options.selections.map(selection => selection.outputId)}],
    fullIdentity: 'qualified-reference-and-explicit-output-id-sidecar-required'});
  assert.deepEqual(report.unselectedBodyIds, ['body_second_surface']);
  assert.deepEqual(report.preserved, ['selected-nonzero-native-coefficients',
    'native-knot-order-curve-pole-order-surface-grid-indices-and-parameter-domains', 'raw-authored-xyz-and-mm', 'caller-selection-order']);
  assert.deepEqual(report.omitted, ['original-document-id-and-revision', 'original-body-ids-and-names',
    'original-asset-ids-and-revisions', 'original-native-source-text-and-source-dialect',
    'original-authored-frame-label-and-angle-unit-declaration', 'full-qualified-native-geometry-identities', 'unselected-bodies-and-objects']);
  assert.deepEqual(report.unsupported, ['feature-graphs', 'parameters', 'constraints', 'placements',
    'derived-caches', 'topology', 'solid-models', 'authoring-history']);
  assert.deepEqual(report.capabilities, capabilities);
  assert.equal(report.geometryAuthority, 'original-authored-native-source-text');
  assert.equal(report.geometricValidity, 'not-certified');
  assert.equal(report.topologyCertified, false);
  assert.equal(report.solid, false);
  assert.deepEqual(report.quality, {nativeSourceIncluded: false, nonzeroBinary64CoefficientsPreserved: true,
    nativeCoefficientOrderAndDomainsPreserved: true, surfaceSerializationOrder: 'iges-u-fastest-v-outer-native-grid-indices-preserved',
    axisConversion: 'none', unitConversion: 'none', meshing: 'none', approximation: 'none',
    outputIdAssignment: 'explicit-derived-copy-only', globalBinary64ErrorCertified: false,
    manufacturingToleranceCertified: false, originalDocumentRetained: true, ownership: 'copied-cpu-data-gc-no-renderer-resources'});
  assert.equal(report.budgetFailure, 'atomic-refusal-original-document-and-prior-output-retained');
  assert.deepEqual(report.limits, {maximumSelections: 16, maximumOutputBytes: 2097152, recordColumns: 80, recordTerminator: 'LF',
    documentValues: 524288, documentDepth: 32, documentArrayElements: 4096, documentRecordFields: 64, documentStringCharacters: 2097152,
    optionValues: 32768, optionDepth: 12, optionArrayElements: 64, optionRecordFields: 16, optionStringCharacters: 128,
    snapshotValues: 2097152, snapshotDepth: 40, arrayElements: 4096, recordFields: 64, stringCharacters: 2097152,
    sourceStringCharacters: 262144, nativeGeometryIdCharacters: 128, outputIdCharacters: 48});
}

function check(name, document, options, capabilities) {
  const before = structuredClone(document), optionsBefore = structuredClone(options);
  const file = resolve(output, name + '.iges');
  const previousFile = existsSync(file) ? readFileSync(file) : null;
  const inspection = inspect(document, options);
  if (previousFile) assert.deepEqual(readFileSync(file), previousFile);
  else assert.equal(existsSync(file), false);
  const result = exportDocument(document, options);
  assert.deepEqual(Object.keys(result).sort(), ['document', 'options', 'iges', 'writerReport', 'report'].sort());
  assert.deepEqual(result.document, document);
  assert.deepEqual(result.options, options);
  assert.deepEqual(result.report, inspection);
  checkReport(document, options, result, capabilities);
  assert.deepEqual(validate(result), result.report);
  assert.ok(/^[\x20-\x7e\n]+$/.test(result.iges));
  assert.ok(result.iges.endsWith('\n'));
  assert.ok(result.iges.trimEnd().split('\n').every(line => line.length === 80));
  writeFileSync(file, result.iges, 'ascii');
  const bytes = readFileSync(file);
  assert.equal(bytes.toString('ascii'), result.iges);
  assert.deepEqual(bytes, Buffer.from(result.iges, 'ascii'));
  const sidecar = rawFile(name + '.report.json', result.report);
  assert.deepEqual(sidecar.reopened, inspection);
  const owned = rawFile(name + '.owned-result.json', result);
  assert.deepEqual(validate(owned.reopened), result.report);
  assert.deepEqual(exportDocument(owned.reopened.document, owned.reopened.options), result);
  assert.deepEqual(document, before);
  assert.deepEqual(options, optionsBefore);
  summaries.push({name, file, igesSha256: hash(bytes), sidecarFile: sidecar.file, sidecarSha256: sidecar.sha256,
    ownedResultFile: owned.file, ownedResultSha256: owned.sha256, documentRevision: document.document.revision,
    outputIds: options.selections.map(selection => selection.outputId), entities: result.writerReport.objects.map(object => object.entity),
    signedZeroNormalization: result.report.signedZeroNormalization});
  return {result, file, bytes, igesSha256: hash(bytes)};
}

rawFile('source-api.metafile.json', built.metafile);
rawFile('source-api.inputs.json', {entry, mode: 'in-memory-esbuild', write: false,
  cadInputs, allInputs: sourceInputs, esbuildVersion: esbuild.version});
const capabilities = getCapabilities();
assert.deepEqual(capabilities.map(capability => capability.target), ['iges-5.3-ascii', 'glb-derived-display', 'step']);
assert.deepEqual(capabilities.map(capability => capability.status),
  ['supported-canonical-document-writer', 'external-derived-bridge-only', 'unsupported']);
assert.deepEqual(capabilities[0].writerApis, ['exportIGES']);
assert.equal(capabilities[0].canonicalDocumentWriter, true);
assert.equal(capabilities[0].outputLengthUnit, 'mm');
assert.equal(capabilities[0].approximate, false);
assert.equal(capabilities[1].ownerModule, '@barocss/cad-interop');
assert.equal(capabilities[1].canonicalDocumentWriter, false);
assert.equal(capabilities[1].outputLengthUnit, 'm');
assert.equal(capabilities[1].approximate, true);
assert.equal(capabilities[2].canonicalDocumentWriter, false);
rawFile('capabilities.json', capabilities);

const original = parseCadDocument(documentFixtureBytes.toString('utf8'));
assert.equal(original.document.assets[0].source, originalSource);
assert.deepEqual(original.compiledAssets[0].model, nativeModel(originalSource));
const wire = structuredClone(original.document);
wire.assets.push({...structuredClone(wire.assets[0]), id: 'asset_second'});
wire.bodies.push(
  {id: 'body_second_curve', name: 'Second asset guide', kind: 'direct-geometry-object', assetId: 'asset_second', geometryId: 'guide_path_native'},
  {id: 'body_second_surface', name: 'Unselected second patch', kind: 'direct-geometry-object', assetId: 'asset_second', geometryId: 'support_patch_native'});
const current = documentFile('current', wire), currentBefore = structuredClone(current.document);
const options = optionsFor(current.document);
assert.deepEqual(options.selections.map(selection => selection.reference.bodyId), ['body_surface', 'body_second_curve', 'body_curve']);
assert.equal(options.selections[1].reference.geometryId, options.selections[2].reference.geometryId);
assert.notEqual(options.selections[1].reference.assetId, options.selections[2].reference.assetId);
const selected = check('selected', current.document, options, capabilities);
const selectedBefore = structuredClone(selected.result);

// Advance declared revisions for a same-ID coefficient edit; retain prior files and bytes.
const editedWire = structuredClone(wire);
editedWire.revision = 1;
editedWire.assets[0].revision = 1;
editedWire.assets[0].source = originalSource.replace('[0,3,1]', '[0,3,2]');
const edited = documentFile('edited', editedWire), editedBefore = structuredClone(edited.document);
assert.deepEqual(edited.document.compiledAssets[0].model.objects.map(object => object.id),
  current.document.compiledAssets[0].model.objects.map(object => object.id));
const editedExport = check('edited', edited.document, optionsFor(edited.document), capabilities);
assert.notEqual(editedExport.result.iges, selected.result.iges);
assert.deepEqual(current.document, currentBefore);
assert.deepEqual(selected.result, selectedBefore);
assert.deepEqual(readFileSync(current.file), current.bytes);
assert.deepEqual(readFileSync(selected.file), selected.bytes);

function reject(name, action, code) {
  assert.throws(action, error => {
    assert.ok(error instanceof CadDocumentExportError);
    assert.equal(error.name, 'CadDocumentExportError');
    assert.ok(error.message.startsWith('CAD document export: '));
    assert.equal(error.code, code);
    if (name === 'stale_reference') assert.equal(error.cause.code, 'STALE');
    failures.push({name, code: error.code, message: error.message, actualCausePreserved: Object.hasOwn(error, 'cause')});
    assert.deepEqual(current.document, currentBefore);
    assert.deepEqual(edited.document, editedBefore);
    assert.deepEqual(selected.result, selectedBefore);
    assert.deepEqual(readFileSync(current.file), current.bytes);
    assert.deepEqual(readFileSync(selected.file), selected.bytes);
    assert.deepEqual(readFileSync(sourceFixture), sourceFixtureBytes);
    assert.deepEqual(readFileSync(documentFixture), documentFixtureBytes);
    return true;
  });
}

reject('unsupported_step_target', () => inspect(current.document, {...options, target: 'step'}), 'TARGET');
reject('stale_reference', () => exportDocument(edited.document, options), 'REFERENCE');
const foreign = structuredClone(options);
foreign.selections[0].reference.documentId = 'foreign_part';
reject('foreign_reference', () => exportDocument(current.document, foreign), 'REFERENCE');
const duplicateBody = structuredClone(options);
duplicateBody.selections[1].reference = structuredClone(duplicateBody.selections[0].reference);
reject('duplicate_body_selection', () => exportDocument(current.document, duplicateBody), 'REFERENCE');
const duplicateOutput = structuredClone(options);
duplicateOutput.selections[1].outputId = duplicateOutput.selections[0].outputId;
reject('duplicate_full_output_id', () => exportDocument(current.document, duplicateOutput), 'IDENTITY');
let getterCalls = 0;
const getter = structuredClone(options);
Object.defineProperty(getter, 'selections', {
  enumerable: true, get() { getterCalls++; return options.selections; },
});
reject('option_getter', () => inspect(current.document, getter), 'INPUT');
assert.equal(getterCalls, 0);
for (const [name, alter] of [
  ['byte', result => result.iges = 'X' + result.iges.slice(1)],
  ['report', result => result.report.signedZeroNormalization.nativeOccurrences++],
  ['mapping', result => result.report.mappings[0].outputId = 'forged_output'],
  ['reference', result => result.options.selections[0].reference.assetRevision++],
  ['native', result => result.document.compiledAssets[0].model.objects[0].controlPoints[1][2] += .1],
]) {
  const changed = structuredClone(selected.result);
  alter(changed);
  reject('owned_' + name + '_tamper', () => validate(changed), 'OWNED');
}
assert.deepEqual(validate(selected.result), selected.result.report);

// One existing independent reader reads only this new saved selected.iges file.
const readerEntities = selected.result.report.mappings.map(mapping => {
  const native = resolveCadGeometryReference(current.document, mapping.reference).geometry;
  const samples = native.kind === 'curve' ? [-3, -1, 1, 4, 7].map(parameter =>
    ({parameter, pointMM: evaluateCurve(native, parameter)})) : [[-2, -0], [1, 1.5], [5, 3]].map(([u, v]) =>
    ({u, v, pointMM: evaluateSurface(native, u, v)}));
  return {mapping, native, samples};
});
const readerManifest = rawFile('reader-manifest.json', {igesFile: basename(selected.file), igesSha256: selected.igesSha256,
  sourceSha256: hash(sourceFixtureBytes), documentSha256: hash(current.bytes), entities: readerEntities});
const readerPath = resolve(repo, 'examples/cad-nurbs/cad-document-export-readback.py');
const pythonPath = process.env.BAROCSS_CAD_PYTHON ?? '/Users/user/.barocss-ai/v3/verify-cad-ocp-8.0.1.1.0/bin/python';
assert.ok(existsSync(pythonPath));
const readerReportFile = resolve(output, 'reader-report.json');
const readerRun = spawnSync(pythonPath, [readerPath, readerManifest.file, readerReportFile],
  {encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 120000});
writeFileSync(resolve(output, 'reader.stdout.log'), readerRun.stdout ?? '');
writeFileSync(resolve(output, 'reader.stderr.log'), readerRun.stderr ?? '');
assert.ifError(readerRun.error);
assert.equal(readerRun.status, 0, readerRun.stderr || readerRun.stdout);
const readerReport = JSON.parse(readFileSync(readerReportFile, 'utf8'));
assert.equal(readerReport.igesSha256, selected.igesSha256);
assert.equal(readerReport.manifestSha256, readerManifest.sha256);
assert.equal(readerReport.entities.length, 3);
assert.ok(readerReport.maximumLocalPointDeviationMM <= 1e-7);
assert.deepEqual(readerReport.entities.map(entity => entity.outputId), options.selections.map(selection => selection.outputId));
assert.deepEqual(readFileSync(selected.file), selected.bytes);

// Actual public compiled JS and all declaration exports use the manifest paths.
const packageRoot = resolve(repo, 'packages/barocss-cad');
const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath));
assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const runtimeExports = ['getCadDocumentExportCapabilities', 'inspectCadDocumentExport', 'exportCadDocument',
  'validateCadDocumentExport', 'CadDocumentExportError', 'CadDocumentExportDiagnosticCode'];
for (const name of runtimeExports) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.CadDocumentExportDiagnosticCode, CadDocumentExportDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./cad-document-export.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/cad-document-export.d.ts');
const leafDeclaration = readFileSync(leafDeclarationPath, 'utf8');
const declarationExports = [...runtimeExports, 'CadDocumentExportCapability', 'CadDocumentExportSelection',
  'CadDocumentExportOptions', 'CadDocumentExportMapping', 'CadDocumentExportReport', 'CadDocumentExportResult'];
for (const name of declarationExports) {
  assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(leafDeclaration), name);
}
assert.ok(leafDeclaration.includes('export type CadDocumentExportDiagnosticCode'));
const compiledDocument = publicAPI.parseCadDocument(readFileSync(current.file, 'utf8'));
assert.deepEqual(publicAPI.getCadDocumentExportCapabilities(), capabilities);
assert.deepEqual(publicAPI.inspectCadDocumentExport(compiledDocument, options), selected.result.report);
const compiledExport = publicAPI.exportCadDocument(compiledDocument, options);
assert.deepEqual(compiledExport, selected.result);
assert.equal(compiledExport.iges, readFileSync(selected.file, 'ascii'));
assert.deepEqual(publicAPI.validateCadDocumentExport(compiledExport), selected.result.report);
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeExports, declarationExports,
  selectedEntities: compiledExport.report.selectedObjectCount, outputBytes: compiledExport.report.outputBytes,
  declarationCheck: 'actual exported declaration text; no separate TypeScript invocation'};
rawFile('compiled-consumer.json', compiledConsumer);
rawFile('summary.json', {sourceMode: true, cadSourceInputCount: cadInputs.length, sourceFixture, documentFixture,
  sourceFixtureSha256: hash(sourceFixtureBytes), documentFixtureSha256: hash(documentFixtureBytes), summaries, failures,
  compiledConsumer, pythonPath, readerPath, readerReportFile, readerReportSha256: hash(readFileSync(readerReportFile)),
  readerVersions: readerReport.reader, maximumLocalPointDeviationMM: readerReport.maximumLocalPointDeviationMM,
  scope: 'Current qualified native Curve126/Surface128 selections through the existing IGES writer. Original document/source retain signed-zero bits; IGES normalizes signed zero and loses full identities and authoring metadata. Explicit sidecar mapping preserves qualification and selection order. One independent reader consumes this new saved file only, with bounded D0 positions and separate raw128 accessor discrepancy. No STEP/GLB document writer, source retag, meshing, reader parity, topology, solid or manufacturing certificate.'});
console.log(JSON.stringify({sourceMode: true, cadSourceInputCount: cadInputs.length, summaries, failures,
  compiledConsumer, pythonPath, readerReportFile, maximumLocalPointDeviationMM: readerReport.maximumLocalPointDeviationMM}));
