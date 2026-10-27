import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.filter(arg => arg === '--source').length, 1,
  'Usage: node cad-document-compatibility-demo.mjs --source [output-directory]');
const destinations = args.filter(arg => arg !== '--source');
assert.ok(destinations.length <= 1);
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const output = resolve(destinations[0] ?? '/tmp/barocss-cad-document-compatibility-prototype');
mkdirSync(output, {recursive: true});

// Use the real Source0 file from #712. An override must contain the same frozen fixture.
const fixtureFile = resolve(process.env.CAD_DOCUMENT_SOURCE0_FIXTURE ??
  '/Users/user/.barocss-ai/v3/evidence-712-cad/demo-output/original.asset_0.source0.css');
assert.ok(existsSync(fixtureFile), 'Set CAD_DOCUMENT_SOURCE0_FIXTURE to the real #712 Source0 fixture');
const fixtureBytes = readFileSync(fixtureFile);
const fixtureSource = fixtureBytes.toString('utf8');
assert.deepEqual(Buffer.from(fixtureSource, 'utf8'), fixtureBytes);
const sourceInputFile = resolve(output, 'older-native-source0.css');
assert.notEqual(sourceInputFile, fixtureFile);
writeFileSync(sourceInputFile, fixtureBytes);
const sourceInputBytes = readFileSync(sourceInputFile);
assert.deepEqual(sourceInputBytes, fixtureBytes);

// Keep the source-only graph separate from the manifest-declared compiled consumer.
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
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/document/cad-document-compatibility.ts')));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' +
  Buffer.from(built.outputFiles[0].text).toString('base64'));
const {
  inspectCadDocumentCompatibility: inspect, migrateCadDocument: migrate,
  validateCadDocumentMigration: validate, CadDocumentCompatibilityError,
  CadDocumentCompatibilityDiagnosticCode, compileCadModel, parseCadDocument,
  serializeCadDocument, validateCadDocumentResult, curveDomain, surfaceDomain,
} = api;
for (const operation of [inspect, migrate, validate, CadDocumentCompatibilityError]) {
  assert.equal(typeof operation, 'function');
}
assert.deepEqual(Object.keys(CadDocumentCompatibilityDiagnosticCode).sort(),
  ['INPUT', 'FORMAT', 'VERSION', 'PROFILE', 'IDENTITY', 'REFERENCE', 'FRAME', 'SOURCE', 'BUDGET', 'OWNED'].sort());

const summaries = [], failures = [];
const frame = 'authored-xyz-no-axis-conversion';
const write = (name, value) => writeFileSync(resolve(output, name), JSON.stringify(value, null, 2) + '\n');

// The candidate's compiled Model contains numeric -0. Keep raw JSON tokens on reopen.
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

function nativeModel(source) {
  const compiled = compileCadModel(source, {sourceVersion: 0});
  assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
  return compiled.model;
}

function checkReport(report, input, operation) {
  const canonical = input.format === 'canonical-document-v1';
  assert.equal(report.schema, 'barocss-cad-document-compatibility-report');
  assert.equal(report.version, 0);
  assert.equal(report.operation, operation);
  assert.equal(report.supported, true);
  assert.deepEqual(report.input, {format: input.format, fileVersion: canonical ? 1 : null, sourceVersion: 0,
    profile: canonical ? 'direct-geometry' : 'native-geometry',
    role: canonical ? 'authored-canonical-document' : 'authored-native-source',
    bytes: Buffer.byteLength(input.text, 'utf8'), codeUnits: input.text.length});
  assert.deepEqual(report.target, {format: 'canonical-document-v1', fileVersion: 1, sourceVersion: 0,
    profile: 'direct-geometry', role: 'authored-document-candidate'});
  assert.equal(report.lengthUnit, 'mm');
  assert.equal(report.angleUnit, 'rad');
  assert.equal(report.sourceFrame, frame);
  assert.equal(report.sourceAssetCount, 1);
  assert.equal(report.nativeObjectCount, 2);
  assert.deepEqual(report.preserved, canonical
    ? ['original-input-file-text', 'all-authored-document-fields-and-identities', 'exact-source0-text',
      'native-geometry-ids-order-coefficients-knots-weights-and-signed-zero', 'authored-frame-and-units']
    : ['original-input-file-text', 'exact-source0-text',
      'native-geometry-ids-order-coefficients-knots-weights-and-signed-zero', 'authored-frame-and-mm']);
  assert.deepEqual(report.transformed, operation === 'inspect' ? [] : operation === 'identity'
    ? ['canonical-document-wire-formatting-only']
    : ['new-explicit-document-asset-body-metadata', 'canonical-document-wire-serialization']);
  assert.deepEqual(report.unsupported, ['feature-graphs', 'parameters', 'constraints', 'placements',
    'derived-caches', 'brep-topology', 'editor-project-or-scene-conversion', 'native-source1-or-source2-conversion']);
  assert.deepEqual(report.compatibilityMatrix.map(entry => entry.format).sort(),
    ['canonical-document-v1', 'native-source0', 'editor-project-v1', 'editor-scene-v1',
      'native-feature-document', 'native-source1', 'native-source2'].sort());
  for (const entry of report.compatibilityMatrix) {
    const supported = ['canonical-document-v1', 'native-source0'].includes(entry.format);
    assert.equal(entry.support, supported ? 'supported' : 'unsupported-retain-own-reader');
    assert.equal(entry.targetFormat, supported ? 'canonical-document-v1' : null);
    assert.equal(entry.targetFileVersion, supported ? 1 : null);
    assert.equal(entry.targetProfile, supported ? 'direct-geometry' : null);
    assert.ok(typeof entry.reason === 'string' && entry.reason.length > 0);
    if (supported) {
      assert.equal(entry.inputFileVersion, entry.format === 'canonical-document-v1' ? 1 : null);
      assert.equal(entry.inputSourceVersion, 0);
      assert.equal(entry.inputProfile, entry.format === 'canonical-document-v1' ? 'direct-geometry' : 'native-geometry');
      assert.equal(entry.operation, entry.format === 'canonical-document-v1' ? 'identity' : 'source0-wrap');
    } else assert.equal(entry.operation, null);
  }
  assert.equal(report.geometryAuthority, 'original-authored-source-text');
  assert.equal(report.geometricValidity, 'not-certified');
  assert.equal(report.topologyCertified, false);
  assert.equal(report.solid, false);
  assert.deepEqual(report.quality, {originalInputTextRetained: true, sourceTextPreserved: true,
    nativeGeometryBitsPreserved: true, nativeGeometryIdsUnchanged: true, frameUnitsUnchanged: true,
    canonicalReader: 'actual-strict-document-v1-codec', nativeCompiler: 'actual-source0-compiler',
    candidateReplacement: 'caller-owned-not-applied', olderReadersAdopted: false,
    manufacturingToleranceCertified: false, globalBinary64ErrorCertified: false,
    ownership: 'copied-cpu-data-gc-no-renderer-resources'});
  assert.equal(report.budgetFailure, 'atomic-refusal-original-input-and-prior-candidate-retained');
  assert.deepEqual(report.limits, {maximumSourceBytes: 262144, maximumSourceCodeUnits: 262144,
    maximumFileBytes: 2097152, maximumFileCodeUnits: 2097152, maximumAssets: 4, maximumBodies: 16,
    inputValues: 524288, inputDepth: 32, inputArrayElements: 4096, inputRecordFields: 64,
    snapshotValues: 524288, snapshotDepth: 32, arrayElements: 4096, recordFields: 64,
    stringCharacters: 2097152, authoredIdCharacters: 48, geometryIdCharacters: 128,
    nameBytes: 128, maximumRevision: 2147483647});
}

function check(name, input, options, expectedDocument, expectedModel) {
  const inputBefore = structuredClone(input), optionsBefore = structuredClone(options);
  const inspection = inspect(input);
  checkReport(inspection, input, 'inspect');
  write(name + '.inspection.json', inspection);
  const result = migrate(input, options);
  assert.deepEqual(Object.keys(result).sort(),
    ['input', 'options', 'candidate', 'serializedCandidate', 'report', 'mappings'].sort());
  assert.deepEqual(result.input, input);
  assert.deepEqual(result.options, options);
  assert.equal(result.input.text, inputBefore.text);
  assert.deepEqual(result.candidate.document, expectedDocument);
  assert.deepEqual(result.candidate.compiledAssets[0].model, expectedModel);
  assert.equal(result.candidate.document.schema, 'barocss-cad-document');
  assert.equal(result.candidate.document.version, 1);
  assert.equal(result.candidate.document.profile, 'direct-geometry');
  assert.deepEqual(result.candidate.document.units, {length: 'mm', angle: 'rad'});
  assert.equal(result.candidate.document.nativeFrame, frame);
  assert.equal(result.candidate.document.assets[0].sourceVersion, 0);
  assert.equal(result.candidate.document.assets[0].role, 'authored-native-source');
  assert.equal(result.candidate.document.assets[0].sourceFrame, frame);
  assert.equal(result.candidate.document.assets[0].source, fixtureSource);
  assert.equal(result.candidate.compiledAssets[0].source, fixtureSource);
  for (const field of ['features', 'parameters', 'constraints', 'placements', 'derivedCaches']) {
    assert.deepEqual(result.candidate.document[field], []);
  }
  assert.deepEqual(result.mappings, expectedDocument.bodies.map(body => ({bodyId: body.id,
    assetId: body.assetId, inputGeometryId: body.geometryId, outputGeometryId: body.geometryId,
    geometryKind: expectedModel.objects.find(object => object.id === body.geometryId).kind})));
  checkReport(result.report, input, options.mode);
  assert.deepEqual(validate(result), result.report);
  validateCadDocumentResult(result.candidate);
  assert.equal(result.serializedCandidate, serializeCadDocument(result.candidate.document));

  const candidateFile = resolve(output, name + '.candidate.cad-document.json');
  writeFileSync(candidateFile, result.serializedCandidate);
  const candidateBytes = readFileSync(candidateFile);
  assert.deepEqual(candidateBytes, Buffer.from(result.serializedCandidate, 'utf8'));
  const coldCandidate = parseCadDocument(candidateBytes.toString('utf8'));
  assert.deepEqual(coldCandidate, result.candidate);
  validateCadDocumentResult(coldCandidate);
  assert.deepEqual(nativeModel(coldCandidate.document.assets[0].source), expectedModel);
  assert.deepEqual(coldCandidate.compiledAssets[0].model.objects.map(object => object.id),
    expectedModel.objects.map(object => object.id));
  assert.equal(coldCandidate.document.assets[0].source, fixtureSource);
  const migrationFile = resolve(output, name + '.owned-migration.json');
  writeFileSync(migrationFile, nativeJSON(result) + '\n');
  const reopened = JSON.parse(readFileSync(migrationFile, 'utf8'));
  assert.deepEqual(reopened, result);
  assert.deepEqual(validate(reopened), result.report);
  assert.deepEqual(migrate(reopened.input, reopened.options), reopened);
  assert.deepEqual(input, inputBefore);
  assert.deepEqual(options, optionsBefore);
  assert.deepEqual(readFileSync(fixtureFile), fixtureBytes);
  assert.deepEqual(readFileSync(sourceInputFile), sourceInputBytes);
  summaries.push({name, format: input.format, mode: options.mode,
    candidateFile, migrationFile, originalSourceIds: expectedModel.objects.map(object => object.id),
    originalInputTextRetained: true, nativeObjects: coldCandidate.compiledAssets[0].model.objects.length});
  return {result, candidateFile, candidateBytes, migrationFile};
}

write('source-api.metafile.json', built.metafile);
write('source-api.inputs.json', {entry, mode: 'in-memory-esbuild', write: false,
  cadInputs, allInputs: sourceInputs, esbuildVersion: esbuild.version});
write('older-fixture.json', {fixtureFile, sourceInputFile, bytes: fixtureBytes.length, sourceVersion: 0,
  role: 'real-existing-authored-native-source0-file-from-712'});

const expectedModel = {name: 'authored_part', version: 0, lengthUnit: 'mm', objects: [
  {kind: 'curve', id: 'guide_path_native', degree: 2, knots: [-3, -3, -3, 1, 1, 7, 7, 7],
    controlPoints: [[-2, -0, -0], [0, 3, 1], [3, 0, 2], [5, -2, 4], [6, 1, 5]],
    weights: [1, 2, .75, 1.5, 1]},
  {kind: 'surface', id: 'support_patch_native', degreeU: 1, degreeV: 1,
    knotsU: [-2, -2, 5, 5], knotsV: [-0, -0, 3, 3],
    controlPoints: [[[-0, -0, -0], [0, 3, 1]], [[4, -0, 2], [4, 3, 3]]],
    weights: [[1, 1.25], [.75, 1.5]]},
]};
assert.deepEqual(nativeModel(readFileSync(sourceInputFile, 'utf8')), expectedModel);
assert.deepEqual(curveDomain(expectedModel.objects[0]), [-3, 7]);
assert.deepEqual(surfaceDomain(expectedModel.objects[1]), {u: [-2, 5], v: [-0, 3]});
const sourceInput = {format: 'native-source0', text: readFileSync(sourceInputFile, 'utf8')};
const wrapOptions = {mode: 'source0-wrap', documentId: 'wrapped_part', revision: 0,
  assetId: 'wrapped_asset', assetRevision: 0, sourceFrame: frame,
  bodies: [
    {id: 'wrapped_curve', name: 'Preserved source curve', geometryId: 'guide_path_native'},
    {id: 'wrapped_surface', name: 'Preserved source patch', geometryId: 'support_patch_native'},
  ]};
const expectedDocument = {schema: 'barocss-cad-document', version: 1, profile: 'direct-geometry',
  documentId: wrapOptions.documentId, revision: wrapOptions.revision, units: {length: 'mm', angle: 'rad'},
  nativeFrame: frame, assets: [{id: wrapOptions.assetId, revision: wrapOptions.assetRevision,
    role: 'authored-native-source', sourceVersion: 0, sourceFrame: frame, source: fixtureSource}],
  bodies: wrapOptions.bodies.map(body => ({id: body.id, name: body.name, kind: 'direct-geometry-object',
    assetId: wrapOptions.assetId, geometryId: body.geometryId})),
  features: [], parameters: [], constraints: [], placements: [], derivedCaches: []};
const wrapped = check('source0_wrap', sourceInput, wrapOptions, expectedDocument, expectedModel);
const wrappedBefore = structuredClone(wrapped.result);

// Current Doc1 identity preserves decoded values across wire formatting changes.
const canonicalInputFile = resolve(output, 'current.noncanonical.cad-document.json');
const reorderedWire = Object.fromEntries(Object.entries(wrapped.result.candidate.document).reverse());
const lexicalWireText = JSON.stringify(reorderedWire, null, 4)
  .replace('Preserved source curve', '\\u0050reserved source curve')
  .replace(/("revision": )0(?=,\n {4}"documentId")/, (_, prefix) => prefix + '0e0');
assert.ok(lexicalWireText.includes('\\u0050reserved source curve'));
assert.ok(lexicalWireText.includes('"revision": 0e0'));
const noncanonicalText = ' \n\t' + lexicalWireText + ' \n';
assert.notEqual(noncanonicalText, wrapped.result.serializedCandidate);
writeFileSync(canonicalInputFile, noncanonicalText);
const canonicalInputBytes = readFileSync(canonicalInputFile);
const canonicalInput = {format: 'canonical-document-v1', text: canonicalInputBytes.toString('utf8')};
const identityOptions = {mode: 'identity'};
const identity = check('canonical_identity', canonicalInput, identityOptions, expectedDocument, expectedModel);
assert.equal(identity.result.input.text, noncanonicalText);
assert.notEqual(identity.result.serializedCandidate, noncanonicalText);
assert.equal(identity.result.serializedCandidate, wrapped.result.serializedCandidate);
assert.deepEqual(identity.result.candidate, wrapped.result.candidate);
const identityBefore = structuredClone(identity.result);

function canonicalChanged(change) {
  const candidate = structuredClone(expectedDocument);
  change(candidate);
  return {format: 'canonical-document-v1', text: JSON.stringify(candidate)};
}

function optionChanged(change) {
  const candidate = structuredClone(wrapOptions);
  change(candidate);
  return candidate;
}

function reject(name, action, code) {
  assert.throws(action, error => {
    assert.ok(error instanceof CadDocumentCompatibilityError);
    assert.equal(error.name, 'CadDocumentCompatibilityError');
    assert.ok(error.message.startsWith('CAD document compatibility: '));
    assert.equal(error.code, code);
    if (name === 'duplicate_json_keys') {
      assert.ok(Object.hasOwn(error, 'cause'));
      assert.equal(error.cause.code, 'JSON');
    }
    failures.push({name, code: error.code, message: error.message,
      actualCausePreserved: Object.hasOwn(error, 'cause')});
    assert.deepEqual(wrapped.result, wrappedBefore);
    assert.deepEqual(identity.result, identityBefore);
    assert.deepEqual(readFileSync(fixtureFile), fixtureBytes);
    assert.deepEqual(readFileSync(sourceInputFile), sourceInputBytes);
    assert.deepEqual(readFileSync(canonicalInputFile), canonicalInputBytes);
    assert.deepEqual(readFileSync(wrapped.candidateFile), wrapped.candidateBytes);
    assert.deepEqual(readFileSync(identity.candidateFile), identity.candidateBytes);
    return true;
  });
}

reject('future_canonical_version', () => inspect(canonicalChanged(document => document.version = 2)), 'VERSION');
reject('unsupported_canonical_profile', () => inspect(canonicalChanged(document => document.profile = 'feature-graph')), 'PROFILE');
reject('nonempty_feature_loss_refused', () => migrate(canonicalChanged(document =>
  document.features.push({id: 'feature_one', kind: 'extrude'})), identityOptions), 'PROFILE');
reject('editor_format_keeps_own_reader', () => inspect({format: 'editor-project-v1', text: '{}'}), 'FORMAT');
reject('source1_format_keeps_own_reader', () => inspect({format: 'native-source1', text: fixtureSource}), 'FORMAT');
const duplicateJSON = canonicalInput.text.replace('"schema":',
  '"schema":"barocss-cad-document","schema":');
assert.notEqual(duplicateJSON, canonicalInput.text);
reject('duplicate_json_keys', () => inspect({format: 'canonical-document-v1', text: duplicateJSON}), 'INPUT');
reject('duplicate_body_ids', () => migrate(sourceInput, optionChanged(options =>
  options.bodies[1].id = options.bodies[0].id)), 'IDENTITY');
reject('missing_native_reference', () => migrate(sourceInput, optionChanged(options =>
  options.bodies[0].geometryId = 'missing_geometry')), 'REFERENCE');
reject('unsupported_source_frame', () => migrate(sourceInput,
  {...wrapOptions, sourceFrame: 'right-handed-z-up'}), 'FRAME');
let getterCalls = 0;
const getter = {format: 'native-source0'};
Object.defineProperty(getter, 'text', {
  enumerable: true, get() { getterCalls++; return fixtureSource; },
});
reject('input_getter', () => inspect(getter), 'INPUT');
assert.equal(getterCalls, 0);
const modelTamper = structuredClone(wrapped.result);
modelTamper.candidate.compiledAssets[0].model.objects[0].controlPoints[1][2] += .1;
reject('owned_candidate_model_tamper', () => validate(modelTamper), 'OWNED');
const serializedTamper = structuredClone(wrapped.result);
serializedTamper.serializedCandidate += ' ';
reject('owned_serialized_candidate_tamper', () => validate(serializedTamper), 'OWNED');
const ownedGetter = structuredClone(wrapped.result);
Object.defineProperty(ownedGetter, 'candidate', {
  enumerable: true, get() { getterCalls++; return wrapped.result.candidate; },
});
reject('owned_getter', () => validate(ownedGetter), 'OWNED');
assert.equal(getterCalls, 0);
validate(wrapped.result);
validate(identity.result);

// Inspect, migrate and validate through actual public JS and declaration entries.
const packageRoot = resolve(repo, 'packages/barocss-cad');
const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import);
const declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath));
assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const runtimeExports = ['inspectCadDocumentCompatibility', 'migrateCadDocument', 'validateCadDocumentMigration',
  'CadDocumentCompatibilityError', 'CadDocumentCompatibilityDiagnosticCode'];
for (const name of runtimeExports) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.CadDocumentCompatibilityDiagnosticCode, CadDocumentCompatibilityDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./document/cad-document-compatibility.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/document/cad-document-compatibility.d.ts');
const leafDeclaration = readFileSync(leafDeclarationPath, 'utf8');
const declarationExports = [...runtimeExports, 'CadDocumentCompatibilityInput', 'CadDocumentMigrationOptions',
  'CadDocumentCompatibilityEntry', 'CadDocumentCompatibilityReport', 'CadDocumentMigrationMapping', 'CadDocumentMigrationResult'];
for (const name of declarationExports) {
  assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(leafDeclaration), name);
}
assert.ok(leafDeclaration.includes('export type CadDocumentCompatibilityDiagnosticCode'));
assert.deepEqual(publicAPI.inspectCadDocumentCompatibility(sourceInput), inspect(sourceInput));
assert.deepEqual(publicAPI.inspectCadDocumentCompatibility(canonicalInput), inspect(canonicalInput));
const compiledWrapped = publicAPI.migrateCadDocument(sourceInput, wrapOptions);
const compiledIdentity = publicAPI.migrateCadDocument(canonicalInput, identityOptions);
assert.deepEqual(compiledWrapped, wrapped.result);
assert.deepEqual(compiledIdentity, identity.result);
publicAPI.validateCadDocumentMigration(compiledWrapped);
publicAPI.validateCadDocumentMigration(compiledIdentity);
const compiledColdCandidate = publicAPI.parseCadDocument(readFileSync(wrapped.candidateFile, 'utf8'));
assert.deepEqual(compiledColdCandidate, compiledWrapped.candidate);
publicAPI.validateCadDocumentResult(compiledColdCandidate);
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeExports, declarationExports,
  inputFormats: [sourceInput.format, canonicalInput.format], candidateFileVersion: compiledWrapped.candidate.document.version,
  sourceVersion: compiledWrapped.candidate.document.assets[0].sourceVersion,
  declarationCheck: 'actual exported declaration text; no separate TypeScript invocation'};
write('compiled-consumer.json', compiledConsumer);
write('summary.json', {sourceMode: true, cadSourceInputCount: cadInputs.length, fixtureFile, sourceInputFile,
  canonicalInputFile, summaries, failures, compiledConsumer,
  originalFileTextAndNativeBitsRetained: true, actualColdCandidateReader: true, previousCandidatesRetained: true,
  scope: 'Explicit native-source0 wrapping and canonical-document-v1 identity candidates only. Input text, authored source and native IDs/order/sign bits remain intact. Canonical wire formatting is declared separately. No in-place migration, source1/2 or editor reader adoption, feature loss conversion, physical frame change, manufacturing or topology certificate.'});
console.log(JSON.stringify({sourceMode: true, cadSourceInputCount: cadInputs.length,
  fixtureFile, sourceInputFile, canonicalInputFile, summaries, failures, compiledConsumer}));
