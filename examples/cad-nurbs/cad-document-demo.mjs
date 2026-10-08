import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.filter(arg => arg === '--source').length, 1,
  'Usage: node cad-document-demo.mjs --source [output-directory]');
const destinations = args.filter(arg => arg !== '--source');
assert.ok(destinations.length <= 1);
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const output = resolve(destinations[0] ?? '/tmp/barocss-cad-document-prototype');
mkdirSync(output, {recursive: true});

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
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/cad-document.ts')));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' +
  Buffer.from(built.outputFiles[0].text).toString('base64'));
const {
  createCadDocument: create, serializeCadDocument: serialize,
  parseCadDocument: parse, validateCadDocumentResult: validate,
  CadDocumentError, CadDocumentDiagnosticCode, compileCadModel, curveDomain, surfaceDomain,
} = api;
for (const operation of [create, serialize, parse, validate, CadDocumentError]) {
  assert.equal(typeof operation, 'function');
}
assert.deepEqual(Object.keys(CadDocumentDiagnosticCode).sort(),
  ['INPUT', 'VERSION', 'PROFILE', 'IDENTITY', 'REFERENCE', 'SOURCE', 'FRAME', 'BUDGET', 'JSON', 'OWNED'].sort());

const summaries = [], failures = [];
const write = (name, value) => writeFileSync(resolve(output, name), JSON.stringify(value, null, 2) + '\n');
const authoredKeys = ['schema', 'version', 'profile', 'documentId', 'revision', 'units', 'nativeFrame',
  'assets', 'bodies', 'features', 'parameters', 'constraints', 'placements', 'derivedCaches'];
const frame = 'authored-xyz-no-axis-conversion';

// Parsed Models contain numeric -0. Emit raw JSON tokens to retain those bits.
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

function checkReport(document, result) {
  const report = result.report;
  assert.equal(report.schema, 'barocss-cad-document-report');
  assert.equal(report.version, 0);
  assert.equal(report.fileVersion, 1);
  assert.equal(report.profile, 'direct-geometry');
  assert.equal(report.sourceVersion, 0);
  assert.deepEqual(report.units, document.units);
  assert.equal(report.nativeFrame, frame);
  assert.equal(report.documentId, document.documentId);
  assert.equal(report.revision, document.revision);
  assert.equal(report.assetCount, document.assets.length);
  assert.equal(report.bodyCount, document.bodies.length);
  assert.equal(report.nativeObjectCount,
    result.compiledAssets.reduce((sum, asset) => sum + asset.model.objects.length, 0));
  assert.equal(report.aggregateSourceBytes,
    document.assets.reduce((sum, asset) => sum + Buffer.byteLength(asset.source, 'utf8'), 0));
  assert.equal(report.geometryAuthority, 'authored-native-source-text');
  assert.equal(report.geometricValidity, 'not-certified');
  assert.equal(report.topologyCertified, false);
  assert.equal(report.solid, false);
  assert.deepEqual(report.supportedDomains, ['document-identity-revision',
    'authored-native-source0-assets', 'qualified-direct-geometry-object-bodies']);
  assert.deepEqual(report.unsupportedDomains,
    ['feature-graphs', 'parameters', 'constraints', 'placements', 'derived-caches', 'brep-topology']);
  assert.deepEqual(report.quality, {sourceTextPreserved: true, sourceNumericBitsRemainInText: true,
    nativeModels: 'actual-source0-compiler-derived-only', referenceSemantics: 'geometry-id-qualified-by-asset-id',
    bodySemantics: 'native-object-reference-not-solid-certificate', frameSemantics: frame,
    globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false,
    ownership: 'copied-cpu-data-gc-no-renderer-resources'});
  assert.deepEqual(report.limits, {maximumAssets: 4, maximumBodies: 16, maximumRevision: 2147483647,
    maximumSourceBytes: 262144, maximumSourceCodeUnits: 262144, maximumAggregateSourceBytes: 1048576,
    maximumFileBytes: 2097152, maximumFileCodeUnits: 2097152,
    inputValues: 65536, inputDepth: 12, inputArrayElements: 64, inputRecordFields: 16,
    snapshotValues: 262144, snapshotDepth: 24, arrayElements: 4096, recordFields: 64,
    sourceStringCharacters: 262144, authoredIdCharacters: 48, geometryIdCharacters: 128, nameBytes: 128});
}

function check(name, document, expectedModels) {
  const before = structuredClone(document);
  const result = create(document);
  assert.deepEqual(document, before);
  assert.deepEqual(result.document, document);
  assert.deepEqual(Object.keys(result).sort(), ['document', 'compiledAssets', 'bodyBindings', 'report'].sort());
  assert.deepEqual(Object.keys(result.document), authoredKeys);
  for (const field of ['features', 'parameters', 'constraints', 'placements', 'derivedCaches']) {
    assert.deepEqual(result.document[field], []);
  }
  assert.equal(result.compiledAssets.length, document.assets.length);
  const sourceFiles = [];
  for (const [index, asset] of result.compiledAssets.entries()) {
    const authored = document.assets[index];
    assert.deepEqual(Object.keys(asset).sort(), ['assetId', 'sourceVersion', 'source', 'model'].sort());
    assert.equal(asset.assetId, authored.id);
    assert.equal(asset.sourceVersion, 0);
    assert.equal(asset.source, authored.source);
    assert.deepEqual(asset.model, expectedModels[index]);
    const sourceFile = resolve(output, name + '.asset_' + index + '.source0.css');
    writeFileSync(sourceFile, authored.source);
    const reopenedSource = readFileSync(sourceFile, 'utf8');
    assert.equal(reopenedSource, authored.source);
    assert.deepEqual(readFileSync(sourceFile), Buffer.from(authored.source, 'utf8'));
    assert.deepEqual(nativeModel(reopenedSource), expectedModels[index]);
    sourceFiles.push(sourceFile);
  }
  const expectedBindings = document.bodies.map(body => {
    const asset = result.compiledAssets.find(asset => asset.assetId === body.assetId);
    const object = asset.model.objects.find(object => object.id === body.geometryId);
    assert.ok(object);
    return {bodyId: body.id, assetId: body.assetId, geometryId: body.geometryId, geometryKind: object.kind};
  });
  assert.deepEqual(result.bodyBindings, expectedBindings);
  checkReport(document, result);
  validate(result);

  const serialized = serialize(document);
  assert.equal(typeof serialized, 'string');
  assert.equal(serialized, JSON.stringify(result.document, null, 2) + '\n');
  const authoredJSON = JSON.parse(serialized);
  assert.deepEqual(Object.keys(authoredJSON), authoredKeys);
  assert.deepEqual(authoredJSON, document);
  assert.ok(!Object.hasOwn(authoredJSON, 'compiledAssets'));
  assert.ok(!Object.hasOwn(authoredJSON, 'bodyBindings'));
  assert.ok(!Object.hasOwn(authoredJSON, 'report'));
  const file = resolve(output, name + '.cad-document.json');
  writeFileSync(file, serialized);
  const freshBytes = readFileSync(file);
  assert.deepEqual(freshBytes, Buffer.from(serialized, 'utf8'));
  const reopened = parse(freshBytes.toString('utf8'));
  assert.deepEqual(reopened, result);
  validate(reopened);
  assert.equal(serialize(reopened.document), serialized);
  for (const [index, asset] of reopened.compiledAssets.entries()) {
    assert.equal(asset.source, document.assets[index].source);
    assert.deepEqual(asset.model, nativeModel(asset.source));
    assert.deepEqual(asset.model, expectedModels[index]);
  }
  const resultFile = resolve(output, name + '.owned-result.json');
  writeFileSync(resultFile, nativeJSON(result) + '\n');
  const reopenedResult = JSON.parse(readFileSync(resultFile, 'utf8'));
  assert.deepEqual(reopenedResult, result);
  validate(reopenedResult);
  assert.deepEqual(document, before);
  summaries.push({name, documentId: document.documentId, revision: document.revision,
    assets: document.assets.length, bodies: document.bodies.length,
    nativeObjects: result.report.nativeObjectCount, file, resultFile, sourceFiles});
  return {result, file, bytes: freshBytes, serialized};
}

write('source-api.metafile.json', built.metafile);
write('source-api.inputs.json', {entry, mode: 'in-memory-esbuild', write: false,
  cadInputs, allInputs: sourceInputs, esbuildVersion: esbuild.version});

// Two caller-authored native objects. Source text carries numeric signs and domains.
const source = `@model authored_part {
  version: 0;
  length-unit: mm;
  @curve #guide_path_native {
    type: nurbs;
    degree: 2;
    knots: [-3,-3,-3,1,1,7,7,7];
    control-points: [[-2,-0,-0],[0,3,1],[3,0,2],[5,-2,4],[6,1,5]];
    weights: [1,2,0.75,1.5,1];
  }
  @surface #support_patch_native {
    type: nurbs;
    degree-u: 1;
    degree-v: 1;
    knots-u: [-2,-2,5,5];
    knots-v: [-0,-0,3,3];
    control-points: [[[-0,-0,-0],[0,3,1]],[[4,-0,2],[4,3,3]]];
    weights: [[1,1.25],[0.75,1.5]];
  }
}
`;
const expectedModel = {name: 'authored_part', version: 0, lengthUnit: 'mm', objects: [
  {kind: 'curve', id: 'guide_path_native', degree: 2, knots: [-3, -3, -3, 1, 1, 7, 7, 7],
    controlPoints: [[-2, -0, -0], [0, 3, 1], [3, 0, 2], [5, -2, 4], [6, 1, 5]],
    weights: [1, 2, .75, 1.5, 1]},
  {kind: 'surface', id: 'support_patch_native', degreeU: 1, degreeV: 1,
    knotsU: [-2, -2, 5, 5], knotsV: [-0, -0, 3, 3],
    controlPoints: [[[-0, -0, -0], [0, 3, 1]], [[4, -0, 2], [4, 3, 3]]],
    weights: [[1, 1.25], [.75, 1.5]]},
]};
assert.deepEqual(nativeModel(source), expectedModel);
assert.deepEqual(curveDomain(expectedModel.objects[0]), [-3, 7]);
assert.deepEqual(surfaceDomain(expectedModel.objects[1]), {u: [-2, 5], v: [-0, 3]});
const document = {
  schema: 'barocss-cad-document', version: 1, profile: 'direct-geometry', documentId: 'part_native',
  revision: 0, units: {length: 'mm', angle: 'rad'}, nativeFrame: frame,
  assets: [{id: 'asset_native', revision: 0, role: 'authored-native-source', sourceVersion: 0,
    sourceFrame: frame, source}],
  bodies: [
    {id: 'body_curve', name: 'Guide curve', kind: 'direct-geometry-object', assetId: 'asset_native', geometryId: 'guide_path_native'},
    {id: 'body_surface', name: 'Support patch', kind: 'direct-geometry-object', assetId: 'asset_native', geometryId: 'support_patch_native'},
  ],
  features: [], parameters: [], constraints: [], placements: [], derivedCaches: [],
};
const documentBefore = structuredClone(document);
const original = check('original', document, [expectedModel]);
const originalBefore = structuredClone(original.result);

// Geometry IDs are qualified by their asset. An unreferenced object stays in source.
const qualified = structuredClone(document);
qualified.documentId = 'part_qualified';
qualified.assets.push({...structuredClone(document.assets[0]), id: 'asset_second', revision: 7});
qualified.bodies.push({id: 'body_second_curve', name: 'Second asset guide', kind: 'direct-geometry-object',
  assetId: 'asset_second', geometryId: 'guide_path_native'});
const qualifiedResult = check('qualified', qualified, [expectedModel, expectedModel]);
assert.deepEqual(qualifiedResult.result.bodyBindings.filter(binding => binding.geometryId === 'guide_path_native')
  .map(binding => binding.assetId), ['asset_native', 'asset_second']);
assert.equal(qualifiedResult.result.compiledAssets[1].model.objects.length, 2);

// Edit authored source without changing document, body, asset or native object IDs.
const edited = structuredClone(document);
edited.revision = 1;
edited.assets[0].revision = 1;
edited.assets[0].source = source.replace('[0,3,1]', '[0,3,2]');
const editedModel = structuredClone(expectedModel);
editedModel.objects[0].controlPoints[1][2] = 2;
const editedResult = check('edited', edited, [editedModel]);
assert.deepEqual(editedResult.result.bodyBindings, original.result.bodyBindings);
assert.equal(editedResult.result.document.documentId, original.result.document.documentId);
assert.deepEqual(editedResult.result.compiledAssets[0].model.objects.map(object => object.id),
  original.result.compiledAssets[0].model.objects.map(object => object.id));
assert.notDeepEqual(editedResult.result.compiledAssets[0].model, original.result.compiledAssets[0].model);
assert.deepEqual(original.result, originalBefore);
assert.deepEqual(readFileSync(original.file), original.bytes);
assert.deepEqual(document, documentBefore);

function changed(change) {
  const candidate = structuredClone(document);
  change(candidate);
  return candidate;
}

function reject(name, action, code) {
  assert.throws(action, error => {
    assert.ok(error instanceof CadDocumentError);
    assert.equal(error.name, 'CadDocumentError');
    assert.ok(error.message.startsWith('CAD document: '));
    assert.equal(error.code, code);
    if (name === 'malformed_source') {
      assert.ok(Object.hasOwn(error, 'cause'));
      assert.equal(error.cause.ok, false);
      assert.ok(Array.isArray(error.cause.diagnostics) && error.cause.diagnostics.length > 0);
      write('malformed-source.diagnostics.json', error.cause.diagnostics);
    }
    failures.push({name, code: error.code, message: error.message,
      actualCausePreserved: Object.hasOwn(error, 'cause')});
    assert.deepEqual(original.result, originalBefore);
    assert.deepEqual(document, documentBefore);
    assert.deepEqual(readFileSync(original.file), original.bytes);
    return true;
  });
}

reject('duplicate_asset', () => create(changed(candidate =>
  candidate.assets.push(structuredClone(candidate.assets[0])))), 'IDENTITY');
reject('duplicate_body', () => create(changed(candidate =>
  candidate.bodies[1].id = candidate.bodies[0].id)), 'IDENTITY');
reject('duplicate_qualified_ownership', () => create(changed(candidate =>
  candidate.bodies[1].geometryId = candidate.bodies[0].geometryId)), 'REFERENCE');
reject('missing_geometry', () => create(changed(candidate =>
  candidate.bodies[0].geometryId = 'missing_geometry')), 'REFERENCE');
reject('missing_asset', () => create(changed(candidate =>
  candidate.bodies[0].assetId = 'missing_asset')), 'REFERENCE');
reject('preview_source_role', () => create(changed(candidate =>
  candidate.assets[0].role = 'preview-mesh')), 'PROFILE');
reject('derived_cache_promotion', () => create(changed(candidate =>
  candidate.derivedCaches.push({assetId: 'asset_native', source}))), 'PROFILE');
reject('nonempty_feature', () => create(changed(candidate =>
  candidate.features.push({id: 'feature_one', kind: 'extrude'}))), 'PROFILE');
reject('future_version', () => create(changed(candidate => candidate.version = 2)), 'VERSION');
reject('signed_zero_revision', () => create(changed(candidate => candidate.revision = -0)), 'IDENTITY');
reject('unsupported_frame', () => create(changed(candidate => candidate.nativeFrame = 'right-handed-z-up')), 'FRAME');
let getterCalls = 0;
const getter = structuredClone(document);
Object.defineProperty(getter.assets[0], 'source', {
  enumerable: true, get() { getterCalls++; return source; },
});
reject('input_getter', () => create(getter), 'INPUT');
assert.equal(getterCalls, 0);
reject('malformed_source', () => create(changed(candidate =>
  candidate.assets[0].source = '@model broken { version:0; length-unit:mm; @curve #broken {} }')), 'SOURCE');
const duplicateJSON = original.serialized.replace('"schema":',
  '"schema":"barocss-cad-document","schema":');
assert.notEqual(duplicateJSON, original.serialized);
reject('duplicate_json_keys', () => parse(duplicateJSON), 'JSON');
const modelTamper = structuredClone(original.result);
modelTamper.compiledAssets[0].model.objects[0].controlPoints[1][2] += .1;
reject('owned_model_tamper', () => validate(modelTamper), 'OWNED');
const bindingTamper = structuredClone(original.result);
bindingTamper.bodyBindings[0].geometryKind = 'surface';
reject('owned_binding_tamper', () => validate(bindingTamper), 'OWNED');
const ownedGetter = structuredClone(original.result);
Object.defineProperty(ownedGetter, 'compiledAssets', {
  enumerable: true, get() { getterCalls++; return original.result.compiledAssets; },
});
reject('owned_getter', () => validate(ownedGetter), 'OWNED');
assert.equal(getterCalls, 0);
validate(original.result);
assert.deepEqual(readFileSync(original.file), original.bytes);

// Read the actual public manifest and declarations after the separate library build.
const packageRoot = resolve(repo, 'packages/barocss-cad');
const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import);
const declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath));
assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const runtimeExports = ['createCadDocument', 'serializeCadDocument', 'parseCadDocument',
  'validateCadDocumentResult', 'CadDocumentError', 'CadDocumentDiagnosticCode'];
for (const name of runtimeExports) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.CadDocumentDiagnosticCode, CadDocumentDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./cad-document.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/cad-document.d.ts');
const leafDeclaration = readFileSync(leafDeclarationPath, 'utf8');
const declarationExports = [...runtimeExports, 'CadDocumentUnits', 'CadDocumentSourceAsset', 'CadDocumentBody',
  'CadDocumentV1', 'CadDocumentCompiledAsset', 'CadDocumentBodyBinding', 'CadDocumentReport', 'CadDocumentResult'];
for (const name of declarationExports) {
  assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(leafDeclaration), name);
}
assert.ok(leafDeclaration.includes('export type CadDocumentDiagnosticCode'));
const compiled = publicAPI.createCadDocument(document);
publicAPI.validateCadDocumentResult(compiled);
assert.deepEqual(compiled, original.result);
const compiledSerialized = publicAPI.serializeCadDocument(document);
assert.equal(compiledSerialized, original.serialized);
const compiledReopened = publicAPI.parseCadDocument(readFileSync(original.file, 'utf8'));
assert.deepEqual(compiledReopened, original.result);
publicAPI.validateCadDocumentResult(compiledReopened);
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeExports,
  declarationExports, assets: compiled.compiledAssets.length, bodies: compiled.bodyBindings.length,
  fileVersion: compiled.document.version,
  declarationCheck: 'actual exported declaration text; no separate TypeScript invocation'};
write('compiled-consumer.json', compiledConsumer);
write('summary.json', {sourceMode: true, cadSourceInputCount: cadInputs.length, summaries, failures,
  compiledConsumer, sourceTextAndNativeBitsRetained: true, qualifiedGeometryIdsObserved: true,
  previousFileAndResultRetained: true,
  scope: 'Direct authored native source0 geometry only. Parsed Models and bindings are derived from source text. Empty feature, parameter, constraint, placement and cache collections do not establish those domains. No frame conversion, editor reader migration, display buffer authority, manufacturing, topology, solid, renderer or reader adoption.'});
console.log(JSON.stringify({sourceMode: true, cadSourceInputCount: cadInputs.length,
  summaries, failures, compiledConsumer}));
