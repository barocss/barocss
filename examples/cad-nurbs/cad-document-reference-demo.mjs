import assert from 'node:assert/strict';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.filter(arg => arg === '--source').length, 1,
  'Usage: node cad-document-reference-demo.mjs --source [output-directory]');
const destinations = args.filter(arg => arg !== '--source');
assert.ok(destinations.length <= 1);
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const output = resolve(destinations[0] ?? '/tmp/barocss-cad-document-reference-prototype');
mkdirSync(output, {recursive: true});

// The source-only graph is separate from the compiled consumer at the end.
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
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/cad-document-reference.ts')));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' +
  Buffer.from(built.outputFiles[0].text).toString('base64'));
const {
  createCadGeometryReference: createReference, resolveCadGeometryReference: resolveReference,
  rebindCadGeometryReference: rebindReference, queryCadDocumentPoint: queryPoint,
  convertCadDocumentPoint: convertPoint, validateCadDocumentPoint: validatePoint,
  validateCadFrameConversion: validateConversion, CadReferenceError, CadReferenceDiagnosticCode,
  createCadDocument, serializeCadDocument, parseCadDocument, compileCadModel,
  evaluateCurve, evaluateSurface, curveDomain, surfaceDomain,
} = api;
for (const operation of [createReference, resolveReference, rebindReference, queryPoint,
  convertPoint, validatePoint, validateConversion, CadReferenceError]) assert.equal(typeof operation, 'function');
assert.deepEqual(Object.keys(CadReferenceDiagnosticCode).sort(),
  ['INPUT', 'VERSION', 'REFERENCE', 'STALE', 'QUERY', 'FRAME', 'REPRESENTABILITY', 'NATIVE', 'BINDING', 'OWNED'].sort());

const summaries = [], failures = [];
const frame = 'authored-xyz-no-axis-conversion';
const write = (name, value) => writeFileSync(resolve(output, name), JSON.stringify(value, null, 2) + '\n');
const referenceLimits = {maximumGeometryObjectsPerReference: 1, inputValues: 262144, inputDepth: 24,
  inputArrayElements: 4096, inputRecordFields: 64, snapshotValues: 262144, snapshotDepth: 32,
  arrayElements: 4096, recordFields: 64, sourceStringCharacters: 262144,
  authoredIdCharacters: 48, geometryIdCharacters: 128, maximumRevision: 2147483647};

// Raw -0 tokens retain source-derived geometry, query and mapped-point signs.
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
  const reopened = JSON.parse(readFileSync(file, 'utf8'));
  assert.deepEqual(reopened, value);
  return {file, reopened};
}

function nativeModel(source) {
  const compiled = compileCadModel(source, {sourceVersion: 0});
  assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
  return compiled.model;
}

function documentFile(name, wire, expectedModel) {
  const result = createCadDocument(wire);
  assert.deepEqual(result.document, wire);
  assert.deepEqual(result.compiledAssets[0].model, expectedModel);
  const sourceFile = resolve(output, name + '.source0.css');
  writeFileSync(sourceFile, wire.assets[0].source);
  assert.equal(readFileSync(sourceFile, 'utf8'), wire.assets[0].source);
  assert.deepEqual(nativeModel(readFileSync(sourceFile, 'utf8')), expectedModel);
  const file = resolve(output, name + '.cad-document.json');
  writeFileSync(file, serializeCadDocument(wire));
  const bytes = readFileSync(file);
  const cold = parseCadDocument(bytes.toString('utf8'));
  assert.deepEqual(cold, result);
  return {result, cold, file, bytes, sourceFile};
}

function checkReferenceReport(report, document, reference, operation) {
  assert.equal(report.schema, 'barocss-cad-reference-report');
  assert.equal(report.version, 0);
  assert.equal(report.documentVersion, 1);
  assert.equal(report.referenceVersion, 0);
  assert.equal(report.operation, operation);
  assert.equal(report.documentId, document.document.documentId);
  assert.equal(report.documentRevision, document.document.revision);
  assert.equal(report.bodyId, reference.bodyId);
  assert.equal(report.assetId, reference.assetId);
  assert.equal(report.assetRevision, reference.assetRevision);
  assert.equal(report.geometryId, reference.geometryId);
  assert.equal(report.geometryKind, reference.geometryKind);
  assert.equal(report.sourceVersion, 0);
  assert.equal(report.sourceFrame, frame);
  assert.equal(report.lengthUnit, 'mm');
  if (operation !== 'rebind') {
    assert.equal(report.previousDocumentRevision, null);
    assert.equal(report.previousAssetRevision, null);
  }
  assert.equal(report.geometryAuthority, 'actual-authored-source0-model');
  assert.equal(report.geometricValidity, 'not-certified');
  assert.equal(report.topologyCertified, false);
  assert.equal(report.solid, false);
  assert.deepEqual(report.quality, {bindingSemantics: 'exact-document-and-asset-revisions',
    rebindSemantics: 'unchanged-complete-native-coefficients-only',
    querySemantics: 'original-native-closed-parameter-domain', topologyNamingCertified: false,
    manufacturingToleranceCertified: false, globalBinary64ErrorCertified: false,
    ownership: 'copied-cpu-data-gc-no-renderer-resources'});
  assert.deepEqual(report.limits, referenceLimits);
}

function checkReference(name, document, bodyId, expectedGeometry) {
  const body = document.result.document.bodies.find(body => body.id === bodyId);
  const asset = document.result.document.assets.find(asset => asset.id === body.assetId);
  const created = createReference(document.result, {bodyId});
  assert.deepEqual(Object.keys(created).sort(), ['reference', 'geometry', 'source', 'report'].sort());
  const expectedReference = {schema: 'barocss-cad-geometry-reference', version: 0,
    documentId: document.result.document.documentId, documentRevision: document.result.document.revision,
    bodyId, assetId: asset.id, assetRevision: asset.revision, geometryId: body.geometryId,
    geometryKind: expectedGeometry.kind, sourceVersion: 0, sourceFrame: frame, lengthUnit: 'mm'};
  assert.deepEqual(created.reference, expectedReference);
  assert.deepEqual(created.geometry, expectedGeometry);
  assert.equal(created.source, asset.source);
  checkReferenceReport(created.report, document.result, created.reference, 'create');
  const resolved = resolveReference(document.result, created.reference);
  assert.deepEqual(Object.keys(resolved).sort(), ['reference', 'geometry', 'source', 'report'].sort());
  assert.deepEqual(resolved.reference, expectedReference);
  assert.deepEqual(resolved.geometry, expectedGeometry);
  assert.equal(resolved.source, asset.source);
  checkReferenceReport(resolved.report, document.result, resolved.reference, 'resolve');
  const stored = ownedFile(name + '.reference-result', resolved);
  assert.deepEqual(resolveReference(document.cold, stored.reopened.reference), stored.reopened);
  summaries.push({name, role: 'actual-native-geometry-reference', file: stored.file,
    bodyId, assetId: asset.id, geometryId: body.geometryId, geometryKind: expectedGeometry.kind});
  return resolved;
}

function checkPoint(name, document, reference, query, geometry) {
  const result = queryPoint(document.result, reference, query);
  assert.deepEqual(Object.keys(result).sort(), ['reference', 'query', 'pointMM', 'report'].sort());
  assert.deepEqual(result.reference, reference);
  assert.deepEqual(result.query, query);
  const expected = query.kind === 'curve' ? evaluateCurve(geometry, query.parameter)
    : evaluateSurface(geometry, query.u, query.v);
  assert.deepEqual(result.pointMM, expected);
  checkReferenceReport(result.report, document.result, reference, 'point-query');
  assert.deepEqual(validatePoint(document.result, result), result.report);
  const stored = ownedFile(name + '.point-result', result);
  assert.deepEqual(validatePoint(document.cold, stored.reopened), result.report);
  assert.deepEqual(queryPoint(document.cold, stored.reopened.reference, stored.reopened.query), stored.reopened);
  summaries.push({name, role: 'actual-native-point-query', file: stored.file, query, pointMM: result.pointMM});
  return result;
}

function checkConversion(name, document, point, options) {
  const result = convertPoint(document.result, point, options);
  assert.deepEqual(Object.keys(result).sort(), ['sourcePoint', 'options', 'convertedPoint', 'report'].sort());
  assert.deepEqual(result.sourcePoint, point);
  assert.deepEqual(result.options, options);
  const [x, y, z] = point.pointMM;
  const mapped = options.axisMap === 'identity' ? [x, y, z] : [x, z, -y];
  const scale = options.targetLengthUnit === 'mm' ? 1 : .001;
  assert.deepEqual(result.convertedPoint, mapped.map(value => value * scale));
  const report = result.report;
  assert.equal(report.schema, 'barocss-cad-frame-conversion-report');
  assert.equal(report.version, 0);
  assert.equal(report.documentVersion, 1);
  assert.equal(report.referenceVersion, 0);
  assert.equal(report.sourceVersion, 0);
  assert.deepEqual(report.inputFrame, {id: frame, basis: 'xyz', handedness: 'right-handed', lengthUnit: 'mm'});
  assert.deepEqual(report.outputFrame, {id: options.targetFrameId,
    basis: options.axisMap === 'identity' ? 'xyz' : 'x-z-minus-y',
    handedness: 'right-handed', lengthUnit: options.targetLengthUnit});
  assert.equal(report.axisMap, options.axisMap);
  assert.equal(report.scale, scale);
  assert.deepEqual(report.basisRows, options.axisMap === 'identity'
    ? [[1, 0, 0], [0, 1, 0], [0, 0, 1]] : [[1, 0, 0], [0, 0, 1], [0, -1, 0]]);
  assert.equal(report.transformOrder, 'axis-map-then-mm-scale');
  assert.equal(report.role, 'derived-display-frame-mapping-not-native-source-edit');
  assert.equal(report.nativeSourcePreserved, true);
  assert.equal(report.nativeFrameUpCertified, false);
  assert.equal(report.geometricValidity, 'not-certified');
  assert.equal(report.topologyCertified, false);
  assert.equal(report.solid, false);
  assert.deepEqual(report.quality, {mappingSemantics: 'explicit-known-axis-map-and-unit-scale',
    manufacturingToleranceCertified: false, globalBinary64ErrorCertified: false,
    ownership: 'copied-cpu-data-gc-no-renderer-resources'});
  assert.deepEqual(report.limits, referenceLimits);
  assert.deepEqual(validateConversion(document.result, result), report);
  const stored = ownedFile(name + '.conversion-result', result);
  assert.deepEqual(validateConversion(document.cold, stored.reopened), report);
  assert.deepEqual(convertPoint(document.cold, stored.reopened.sourcePoint, stored.reopened.options), stored.reopened);
  summaries.push({name, role: report.role, file: stored.file, options, convertedPoint: result.convertedPoint});
  return result;
}

write('source-api.metafile.json', built.metafile);
write('source-api.inputs.json', {entry, mode: 'in-memory-esbuild', write: false,
  cadInputs, allInputs: sourceInputs, esbuildVersion: esbuild.version});

// Reuse a real #712 authored source0 Curve and Surface. Keep their original IDs.
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
const [originalCurve, originalSurface] = expectedModel.objects;
assert.deepEqual(curveDomain(originalCurve), [-3, 7]);
assert.deepEqual(surfaceDomain(originalSurface), {u: [-2, 5], v: [-0, 3]});
const wire = {schema: 'barocss-cad-document', version: 1, profile: 'direct-geometry', documentId: 'part_native',
  revision: 0, units: {length: 'mm', angle: 'rad'}, nativeFrame: frame,
  assets: [{id: 'asset_native', revision: 0, role: 'authored-native-source', sourceVersion: 0,
    sourceFrame: frame, source}],
  bodies: [
    {id: 'body_curve', name: 'Guide curve', kind: 'direct-geometry-object', assetId: 'asset_native', geometryId: 'guide_path_native'},
    {id: 'body_surface', name: 'Support patch', kind: 'direct-geometry-object', assetId: 'asset_native', geometryId: 'support_patch_native'},
  ], features: [], parameters: [], constraints: [], placements: [], derivedCaches: []};
const wireBefore = structuredClone(wire);
const original = documentFile('original', wire, expectedModel);
const originalBefore = structuredClone(original.result);
const curveReference = checkReference('curve', original, 'body_curve', originalCurve);
const surfaceReference = checkReference('surface', original, 'body_surface', originalSurface);
const curvePoint = checkPoint('curve', original, curveReference.reference,
  {kind: 'curve', parameter: -1}, originalCurve);
const surfacePoint = checkPoint('surface', original, surfaceReference.reference,
  {kind: 'surface', u: 1, v: 1.5}, originalSurface);
const endpointPoint = checkPoint('surface_endpoint', original, surfaceReference.reference,
  {kind: 'surface', u: -2, v: -0}, originalSurface);
const identityOptions = {targetFrameId: 'inspection_mm', axisMap: 'identity', targetLengthUnit: 'mm'};
const axisOptions = {targetFrameId: 'inspection_m', axisMap: 'x-z-minus-y', targetLengthUnit: 'm'};
const identity = checkConversion('identity_mm', original, curvePoint, identityOptions);
const mapped = checkConversion('axis_m', original, surfacePoint, axisOptions);
const signedMapping = checkConversion('axis_m_signed_zero', original, endpointPoint, axisOptions);
assert.ok(Object.is(signedMapping.convertedPoint[2], -0));
const curvePointBefore = structuredClone(curvePoint), mappedBefore = structuredClone(mapped);
const curveReferenceBefore = structuredClone(curveReference), surfaceReferenceBefore = structuredClone(surfaceReference);
assert.deepEqual(original.result, originalBefore);
assert.deepEqual(wire, wireBefore);

// Revision1 changes the other object and source whitespace. The selected Curve stays exact.
const revisedWire = structuredClone(wire);
revisedWire.revision = 1;
revisedWire.assets[0].revision = 1;
revisedWire.assets[0].source = source.replace('[4,3,3]', '[4,3,3.5]') + '\n';
const revisedModel = structuredClone(expectedModel);
revisedModel.objects[1].controlPoints[1][1][2] = 3.5;
const current = documentFile('current', revisedWire, revisedModel);
assert.deepEqual(current.result.compiledAssets[0].model.objects[0], originalCurve);
assert.notDeepEqual(current.result.compiledAssets[0].model.objects[1], originalSurface);
const rebound = rebindReference(original.result, current.result, curveReference.reference);
assert.deepEqual(Object.keys(rebound).sort(), ['previousReference', 'reference', 'report'].sort());
assert.deepEqual(rebound.previousReference, curveReference.reference);
assert.deepEqual(rebound.reference, {...curveReference.reference, documentRevision: 1, assetRevision: 1});
checkReferenceReport(rebound.report, current.result, rebound.reference, 'rebind');
assert.equal(rebound.report.previousDocumentRevision, 0);
assert.equal(rebound.report.previousAssetRevision, 0);
const storedRebind = ownedFile('curve.rebind-result', rebound);
assert.deepEqual(rebindReference(original.cold, current.cold, storedRebind.reopened.previousReference), storedRebind.reopened);
summaries.push({name: 'curve_rebind', role: 'explicit-unchanged-native-geometry-rebind', file: storedRebind.file,
  previousDocumentRevision: rebound.previousReference.documentRevision,
  documentRevision: rebound.reference.documentRevision, previousAssetRevision: rebound.previousReference.assetRevision,
  assetRevision: rebound.reference.assetRevision, geometryId: rebound.reference.geometryId});
const currentResolved = resolveReference(current.cold, rebound.reference);
assert.deepEqual(currentResolved.geometry, originalCurve);
assert.equal(currentResolved.source, revisedWire.assets[0].source);
const reboundPoint = checkPoint('curve_rebound', current, rebound.reference, curvePoint.query, originalCurve);
assert.deepEqual(reboundPoint.pointMM, curvePoint.pointMM);
const currentBefore = structuredClone(current.result);
assert.deepEqual(original.result, originalBefore);
assert.deepEqual(readFileSync(original.file), original.bytes);

function reject(name, action, code) {
  assert.throws(action, error => {
    assert.ok(error instanceof CadReferenceError);
    assert.equal(error.name, 'CadReferenceError');
    assert.ok(error.message.startsWith('CAD document reference: '));
    assert.equal(error.code, code);
    failures.push({name, code: error.code, message: error.message});
    assert.deepEqual(original.result, originalBefore);
    assert.deepEqual(current.result, currentBefore);
    assert.deepEqual(curvePoint, curvePointBefore);
    assert.deepEqual(mapped, mappedBefore);
    assert.deepEqual(curveReference, curveReferenceBefore);
    assert.deepEqual(surfaceReference, surfaceReferenceBefore);
    assert.deepEqual(readFileSync(original.file), original.bytes);
    assert.deepEqual(readFileSync(current.file), current.bytes);
    assert.deepEqual(wire, wireBefore);
    return true;
  });
}

reject('old_reference_strictly_stale', () => resolveReference(current.result, curveReference.reference), 'STALE');
reject('selected_surface_same_id_changed', () =>
  rebindReference(original.result, current.result, surfaceReference.reference), 'STALE');
reject('foreign_document', () => resolveReference(original.result,
  {...curveReference.reference, documentId: 'foreign_document'}), 'REFERENCE');
reject('missing_body', () => createReference(original.result, {bodyId: 'missing_body'}), 'REFERENCE');
reject('missing_geometry', () => resolveReference(original.result,
  {...curveReference.reference, geometryId: 'missing_geometry'}), 'REFERENCE');
reject('geometry_kind_mismatch', () => resolveReference(original.result,
  {...curveReference.reference, geometryKind: 'surface'}), 'REFERENCE');
reject('source_frame_mismatch', () => resolveReference(original.result,
  {...curveReference.reference, sourceFrame: 'right-handed-z-up'}), 'FRAME');
reject('query_kind_mismatch', () => queryPoint(original.result, curveReference.reference,
  {kind: 'surface', u: 1, v: 1}), 'QUERY');
reject('outside_original_domain', () => queryPoint(original.result, curveReference.reference,
  {kind: 'curve', parameter: 8}), 'QUERY');
reject('undeclared_axis_mapping', () => convertPoint(original.result, curvePoint,
  {...identityOptions, axisMap: 'automatic-up'}), 'FRAME');
let getterCalls = 0;
const getter = {kind: 'curve'};
Object.defineProperty(getter, 'parameter', {
  enumerable: true, get() { getterCalls++; return -1; },
});
reject('query_getter', () => queryPoint(original.result, curveReference.reference, getter), 'INPUT');
assert.equal(getterCalls, 0);
const pointTamper = structuredClone(curvePoint);
pointTamper.pointMM[0] += .1;
reject('owned_point_tamper', () => validatePoint(original.result, pointTamper), 'OWNED');
const conversionTamper = structuredClone(mapped);
conversionTamper.convertedPoint[0] += .1;
reject('owned_conversion_tamper', () => validateConversion(original.result, conversionTamper), 'OWNED');
const ownedGetter = structuredClone(mapped);
Object.defineProperty(ownedGetter, 'convertedPoint', {
  enumerable: true, get() { getterCalls++; return mapped.convertedPoint; },
});
reject('owned_conversion_getter', () => validateConversion(original.result, ownedGetter), 'OWNED');
assert.equal(getterCalls, 0);
validatePoint(original.result, curvePoint);
validateConversion(original.result, mapped);

// The public JS and type checks use actual manifest paths, outside the source graph.
const packageRoot = resolve(repo, 'packages/barocss-cad');
const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import);
const declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath));
assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const runtimeExports = ['createCadGeometryReference', 'resolveCadGeometryReference', 'rebindCadGeometryReference',
  'queryCadDocumentPoint', 'convertCadDocumentPoint', 'validateCadDocumentPoint', 'validateCadFrameConversion',
  'CadReferenceError', 'CadReferenceDiagnosticCode'];
for (const name of runtimeExports) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.CadReferenceDiagnosticCode, CadReferenceDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./cad-document-reference.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/cad-document-reference.d.ts');
const leafDeclaration = readFileSync(leafDeclarationPath, 'utf8');
const declarationExports = [...runtimeExports, 'CadGeometryReferenceInput', 'CadGeometryReferenceV0',
  'CadGeometryReferenceResult', 'CadGeometryRebindResult', 'CadDocumentPointQuery', 'CadDocumentPointResult',
  'CadFrameConversionOptions', 'CadFrameConversionResult', 'CadReferenceReport', 'CadFrameConversionReport'];
for (const name of declarationExports) {
  assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(leafDeclaration), name);
}
assert.ok(leafDeclaration.includes('export type CadReferenceDiagnosticCode'));
const compiledOriginal = publicAPI.parseCadDocument(readFileSync(original.file, 'utf8'));
const compiledCurrent = publicAPI.parseCadDocument(readFileSync(current.file, 'utf8'));
const compiledReference = publicAPI.createCadGeometryReference(compiledOriginal, {bodyId: 'body_curve'});
assert.deepEqual(compiledReference.reference, curveReference.reference);
assert.deepEqual(publicAPI.resolveCadGeometryReference(compiledOriginal, compiledReference.reference), curveReference);
const compiledPoint = publicAPI.queryCadDocumentPoint(compiledOriginal, compiledReference.reference, curvePoint.query);
assert.deepEqual(compiledPoint, curvePoint);
publicAPI.validateCadDocumentPoint(compiledOriginal, compiledPoint);
const compiledSurfaceReference = publicAPI.createCadGeometryReference(compiledOriginal, {bodyId: 'body_surface'});
assert.deepEqual(compiledSurfaceReference.reference, surfaceReference.reference);
const compiledSurfacePoint = publicAPI.queryCadDocumentPoint(compiledOriginal,
  compiledSurfaceReference.reference, surfacePoint.query);
assert.deepEqual(compiledSurfacePoint, surfacePoint);
publicAPI.validateCadDocumentPoint(compiledOriginal, compiledSurfacePoint);
const compiledMapped = publicAPI.convertCadDocumentPoint(compiledOriginal, compiledSurfacePoint, axisOptions);
assert.deepEqual(compiledMapped, mapped);
publicAPI.validateCadFrameConversion(compiledOriginal, compiledMapped);
assert.deepEqual(publicAPI.rebindCadGeometryReference(compiledOriginal, compiledCurrent, compiledReference.reference), rebound);
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeExports, declarationExports,
  documentRevisions: [compiledOriginal.document.revision, compiledCurrent.document.revision],
  geometryKinds: [curveReference.geometry.kind, surfaceReference.geometry.kind],
  referenceVersion: compiledReference.reference.version,
  declarationCheck: 'actual exported declaration text; no separate TypeScript invocation'};
write('compiled-consumer.json', compiledConsumer);
write('summary.json', {sourceMode: true, cadSourceInputCount: cadInputs.length, summaries, failures,
  compiledConsumer, documentFiles: [original.file, current.file], sourceFiles: [original.sourceFile, current.sourceFile],
  originalSourcesAndBitsRetained: true, explicitUnchangedGeometryRebind: true, changedSelectedGeometryRefused: true,
  originalFileAndAcceptedResultsRetained: true,
  scope: 'Qualified native Curve/Surface references and original-domain native point queries. Explicit known-axis mapping precedes mm scaling and remains derived. Exact unchanged geometry permits explicit revision rebind. No triangle, nearest-point, topology naming, D1, arbitrary frame graph, native source retag, editor, renderer or reader adoption.'});
console.log(JSON.stringify({sourceMode: true, cadSourceInputCount: cadInputs.length,
  summaries, failures, compiledConsumer}));
