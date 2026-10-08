import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args = process.argv.slice(2);
assert.equal(args.filter(arg => arg === '--source').length, 1,
  'Usage: node cad-document-bounds-demo.mjs --source <output-directory> --loft-source <source0-file>');
assert.equal(args.filter(arg => arg === '--loft-source').length, 1);
const loftIndex = args.indexOf('--loft-source');
assert.ok(loftIndex + 1 < args.length && !args[loftIndex + 1].startsWith('--'));
const loftSourceFile = resolve(args[loftIndex + 1]);
const destinations = args.filter((arg, index) => arg !== '--source' && index !== loftIndex && index !== loftIndex + 1);
assert.equal(destinations.length, 1);
const output = resolve(destinations[0]);
mkdirSync(output, {recursive: true});
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const loftSourceBytes = readFileSync(loftSourceFile), loftSource = loftSourceBytes.toString('utf8');
assert.deepEqual(Buffer.from(loftSource, 'utf8'), loftSourceBytes);
const hash = value => createHash('sha256').update(value).digest('hex');

// Current source only; the public compiled consumer is separate below.
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
assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src/cad-document-bounds.ts')));
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/')));
assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' +
  Buffer.from(built.outputFiles[0].text).toString('base64'));
const {
  queryCadDocumentBounds: query, validateCadDocumentBounds: validate,
  CadDocumentBoundsError, CadDocumentBoundsDiagnosticCode,
  compileCadModel, createCadDocument, serializeCadDocument, parseCadDocument, validateCadDocumentResult,
  createCadGeometryReference, resolveCadGeometryReference, evaluateCurve, evaluateSurface, curveDomain, surfaceDomain,
  editCurveControlPolygon, buildThreeSectionLoftSurface,
} = api;
for (const operation of [query, validate, CadDocumentBoundsError]) assert.equal(typeof operation, 'function');
assert.deepEqual(Object.keys(CadDocumentBoundsDiagnosticCode).sort(),
  ['INPUT', 'REFERENCE', 'STALE', 'NATIVE', 'BINDING', 'OWNED'].sort());

const summaries = [], failures = [];
const frame = 'authored-xyz-no-axis-conversion';

// Preserve native coefficient/domain/bounds/witness -0 on every owned-file reopen.
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

function compileSource(source) {
  const compiled = compileCadModel(source, {sourceVersion: 0});
  assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
  return compiled.model;
}

function documentFile(name, wire) {
  const file = resolve(output, name + '.cad-document.json');
  writeFileSync(file, serializeCadDocument(wire));
  const bytes = readFileSync(file), document = parseCadDocument(bytes.toString('utf8'));
  assert.deepEqual(document.document, wire);
  assert.deepEqual(validateCadDocumentResult(document), document.report);
  for (const asset of document.compiledAssets) assert.deepEqual(asset.model, compileSource(asset.source));
  return {file, bytes, document};
}

function wireDocument(documentId, revision, assetId, source, bodies) {
  return {schema: 'barocss-cad-document', version: 1, profile: 'direct-geometry', documentId, revision,
    units: {length: 'mm', angle: 'rad'}, nativeFrame: frame,
    assets: [{id: assetId, revision, role: 'authored-native-source', sourceVersion: 0, sourceFrame: frame, source}],
    bodies, features: [], parameters: [], constraints: [], placements: [], derivedCaches: []};
}

function checkOwnership(document, reference, result) {
  const caller = new WeakSet();
  const collect = value => {
    if (value && typeof value === 'object' && !caller.has(value)) {
      caller.add(value);
      for (const child of Object.values(value)) collect(child);
    }
  };
  collect(document);
  collect(reference);
  const seen = new WeakSet();
  const visit = value => {
    if (value && typeof value === 'object') {
      assert.ok(!caller.has(value), 'Bounds aliases caller data');
      assert.ok(!seen.has(value), 'Repeated nested object occurrence in bounds result');
      seen.add(value);
      for (const child of Object.values(value)) visit(child);
    }
  };
  visit(result);
}

function poleRecords(geometry) {
  return geometry.kind === 'curve' ? geometry.controlPoints.map((pointMM, poleIndex) =>
    ({pointMM, poleIndex, uIndex: null, vIndex: null})) : geometry.controlPoints.flatMap((row, uIndex) =>
    row.map((pointMM, vIndex) => ({pointMM, poleIndex: null, uIndex, vIndex})));
}

function check(name, saved, bodyId) {
  const document = saved.document, before = structuredClone(document);
  const reference = createCadGeometryReference(document, {bodyId}).reference;
  const result = query(document, reference);
  checkOwnership(document, reference, result);
  assert.deepEqual(Object.keys(result).sort(), ['reference', 'geometry', 'source', 'boundsMM', 'extentMM', 'boxCenterMM', 'extrema', 'report'].sort());
  const resolved = resolveCadGeometryReference(document, reference);
  assert.deepEqual(result.reference, reference);
  assert.deepEqual(result.geometry, resolved.geometry);
  assert.equal(result.source, resolved.source);
  const poles = poleRecords(resolved.geometry);
  const min = [0, 1, 2].map(axis => Math.min(...poles.map(pole => pole.pointMM[axis])));
  const max = [0, 1, 2].map(axis => Math.max(...poles.map(pole => pole.pointMM[axis])));
  assert.deepEqual(result.boundsMM, {min, max});
  assert.deepEqual(result.extentMM, min.map((value, axis) => max[axis] - value));
  assert.deepEqual(result.boxCenterMM, min.map((value, axis) => value + result.extentMM[axis] / 2));
  const extrema = [];
  for (const axis of [0, 1, 2]) for (const side of ['min', 'max']) {
    const valueMM = side === 'min' ? min[axis] : max[axis];
    const witness = poles.find(pole => Object.is(pole.pointMM[axis], valueMM));
    assert.ok(witness);
    extrema.push({axis, side, valueMM, ...witness});
  }
  assert.deepEqual(result.extrema, extrema);
  assert.equal(result.extrema.length, 6);
  for (const witness of result.extrema) {
    const sourcePoint = result.geometry.kind === 'curve' ? result.geometry.controlPoints[witness.poleIndex]
      : result.geometry.controlPoints[witness.uIndex][witness.vIndex];
    assert.deepEqual(witness.pointMM, sourcePoint);
    assert.ok(Object.is(witness.valueMM, sourcePoint[witness.axis]));
  }
  const report = result.report;
  assert.equal(report.schema, 'barocss-cad-document-bounds');
  assert.equal(report.version, 0);
  assert.deepEqual(report.reference, reference);
  assert.equal(report.lengthUnit, 'mm');
  assert.equal(report.sourceFrame, frame);
  assert.equal(report.geometryAuthority, 'original-native-control-hull');
  assert.equal(report.geometryKind, resolved.geometry.kind);
  assert.equal(report.selectedGeometryCount, 1);
  assert.equal(report.controlPoleCount, poles.length);
  assert.deepEqual(report.domains, resolved.geometry.kind === 'curve'
    ? {curve: curveDomain(resolved.geometry), surface: null} : {curve: null, surface: surfaceDomain(resolved.geometry)});
  assert.deepEqual(report.quality, {boundsSemantics: 'conservative-control-hull-not-tight-geometry-extrema',
    containment: 'positive-rational-convex-hull-in-exact-arithmetic',
    witnessSemantics: 'first-object-is-coefficient-in-curve-or-row-major-order',
    zeroTies: 'negative-zero-min-positive-zero-max-when-both-present', derivedCentre: 'box-centre-not-centre-of-mass',
    globalBinary64ContainmentCertified: false, manufacturingToleranceCertified: false, topologyNamingCertified: false,
    ownership: 'copied-cpu-data-gc-no-renderer-resources'});
  assert.equal(report.geometricValidity, 'not-certified');
  assert.equal(report.topologyCertified, false);
  assert.equal(report.solid, false);
  assert.deepEqual(report.limits, {maximumCurvePoles: 64, maximumSurfaceAxisPoles: 16, maximumSurfacePoles: 256,
    maximumDegree: 5, ownedValues: 262144, ownedDepth: 32, arrayElements: 4096, recordFields: 64, sourceStringCharacters: 262144});
  assert.deepEqual(validate(document, result), report);
  const stored = ownedFile(name + '.owned-bounds', result);
  const coldDocument = parseCadDocument(readFileSync(saved.file, 'utf8'));
  assert.deepEqual(validate(coldDocument, stored.reopened), report);
  assert.deepEqual(query(coldDocument, stored.reopened.reference), result);
  assert.deepEqual(document, before);
  summaries.push({name, bodyId, geometryId: reference.geometryId, geometryKind: reference.geometryKind,
    documentRevision: reference.documentRevision, assetRevision: reference.assetRevision,
    poles: poles.length, boundsMM: result.boundsMM, extrema: result.extrema, resultFile: stored.file, documentFile: saved.file});
  return result;
}

function sampleContainment(name, result, queries) {
  let maximumOutsideMM = 0;
  const observations = queries.map(query => {
    const pointMM = result.geometry.kind === 'curve' ? evaluateCurve(result.geometry, query.parameter)
      : evaluateSurface(result.geometry, query.u, query.v);
    const outsideMM = Math.max(0, ...pointMM.flatMap((value, axis) =>
      [result.boundsMM.min[axis] - value, value - result.boundsMM.max[axis]]));
    assert.ok(outsideMM <= 1e-7);
    maximumOutsideMM = Math.max(maximumOutsideMM, outsideMM);
    return {...query, pointMM, outsideMM};
  });
  ownedFile(name + '.local-containment', {toleranceMM: 1e-7, observations, maximumOutsideMM,
    scope: 'These native samples only; no global floating containment or tight-extrema certificate'});
  return {observations, maximumOutsideMM};
}

ownedFile('source-api.metafile', built.metafile);
ownedFile('source-api.inputs', {entry, mode: 'in-memory-esbuild', write: false,
  cadInputs, allInputs: sourceInputs, esbuildVersion: esbuild.version});
const originalModel = compileSource(loftSource);
assert.equal(originalModel.objects.length, 4);
const sections = originalModel.objects.filter(object => object.kind === 'curve');
const surface = originalModel.objects.find(object => object.kind === 'surface');
assert.equal(sections.length, 3);
assert.ok(surface);
assert.deepEqual(sections[1].weights, [1.5, 1.75, 1.25]);
const bodies = [
  {id: 'middle_section_body', name: 'Weighted middle section', kind: 'direct-geometry-object', assetId: 'loft_bounds_asset', geometryId: sections[1].id},
  {id: 'loft_surface_body', name: 'Three-section loft', kind: 'direct-geometry-object', assetId: 'loft_bounds_asset', geometryId: surface.id},
];
const wire = wireDocument('loft_bounds_doc', 1, 'loft_bounds_asset', loftSource, bodies);
const revision1 = documentFile('revision1', wire), documentBefore = structuredClone(revision1.document);
const curveBounds = check('revision1_middle', revision1, 'middle_section_body');
const surfaceBounds = check('revision1_surface', revision1, 'loft_surface_body');
const curveBefore = structuredClone(curveBounds), surfaceBefore = structuredClone(surfaceBounds);
const [low, high] = curveDomain(curveBounds.geometry);
const curveSamples = sampleContainment('revision1_middle', curveBounds, Array.from({length: 17}, (_, index) =>
  ({parameter: index === 0 ? low : index === 16 ? high : low + (high - low) * index / 16})));
const sampledMaximumY = Math.max(...curveSamples.observations.map(sample => sample.pointMM[1]));
assert.equal(curveBounds.boundsMM.max[1], 4);
assert.ok(curveBounds.boundsMM.max[1] - sampledMaximumY > .5);
ownedFile('control-hull-wider-than-samples', {sampleCount: 17, controlMaximumY: curveBounds.boundsMM.max[1], sampledMaximumY,
  differenceMM: curveBounds.boundsMM.max[1] - sampledMaximumY, scope: 'Sampled geometry comparison, not exact geometric extrema'});
const [uLow, uHigh] = surfaceDomain(surfaceBounds.geometry).u;
const surfaceSamples = sampleContainment('revision1_surface', surfaceBounds, [uLow, (uLow + uHigh) / 2, uHigh]
  .flatMap(u => [0, .5, 1].map(v => ({u, v}))));

// Short current consumer rebuild: same native IDs, explicit revision2, no prior replacement.
const middleEdit = editCurveControlPolygon(sections[1], {poleEdits: [{index: 1, zMM: sections[1].controlPoints[1][2] + .25}]});
const rebuilt = buildThreeSectionLoftSurface(sections[0], middleEdit.curve, sections[2], {surfaceId: surface.id});
assert.deepEqual(rebuilt.model.objects.map(object => object.id), originalModel.objects.map(object => object.id));
const editedSourceFile = resolve(output, 'revision2.loft.source0.css');
writeFileSync(editedSourceFile, rebuilt.source);
assert.deepEqual(compileSource(readFileSync(editedSourceFile, 'utf8')), rebuilt.model);
const editedWire = structuredClone(wire);
editedWire.revision = 2;
editedWire.assets[0].revision = 2;
editedWire.assets[0].source = rebuilt.source;
const revision2 = documentFile('revision2', editedWire), revision2Before = structuredClone(revision2.document);
const newCurveBounds = check('revision2_middle', revision2, 'middle_section_body');
const newSurfaceBounds = check('revision2_surface', revision2, 'loft_surface_body');
assert.ok(newCurveBounds.boundsMM.max[2] > curveBounds.boundsMM.max[2]);
assert.ok(newSurfaceBounds.boundsMM.max[2] > surfaceBounds.boundsMM.max[2]);
assert.deepEqual(revision1.document, documentBefore);
assert.deepEqual(curveBounds, curveBefore);
assert.deepEqual(surfaceBounds, surfaceBefore);
assert.deepEqual(readFileSync(revision1.file), revision1.bytes);
assert.deepEqual(readFileSync(loftSourceFile), loftSourceBytes);

// One degenerate source Curve makes both signs of zero visible in ordered witnesses.
const zeroSource = '@model zero_signs { version:0; length-unit:mm; @curve #zero_curve { type:nurbs; degree:1; knots:[-0,-0,1,2,2]; control-points:[[0,-0,0],[-0,0,-0],[0,0,0]]; weights:[1,2,1]; } }\n';
const zeroSourceFile = resolve(output, 'signed_zero.source0.css');
writeFileSync(zeroSourceFile, zeroSource);
const zeroBody = {id: 'zero_body', name: 'Degenerate mixed-zero curve', kind: 'direct-geometry-object', assetId: 'zero_asset', geometryId: 'zero_curve'};
const zeroDocument = documentFile('signed_zero', wireDocument('zero_document', 1, 'zero_asset', zeroSource, [zeroBody]));
const zeroBounds = check('signed_zero', zeroDocument, 'zero_body');
assert.ok(zeroBounds.boundsMM.min.every(value => Object.is(value, -0)));
assert.ok(zeroBounds.boundsMM.max.every(value => Object.is(value, 0)));
assert.deepEqual(zeroBounds.extrema.map(witness => witness.poleIndex), [1, 0, 0, 1, 1, 0]);
assert.deepEqual(zeroBounds.extentMM, [0, 0, 0]);

function reject(name, action, code) {
  assert.throws(action, error => {
    assert.ok(error instanceof CadDocumentBoundsError);
    assert.equal(error.name, 'CadDocumentBoundsError');
    assert.ok(error.message.startsWith('CAD document bounds: '));
    assert.equal(error.code, code);
    failures.push({name, code: error.code, message: error.message, actualCausePreserved: Object.hasOwn(error, 'cause')});
    assert.deepEqual(revision1.document, documentBefore);
    assert.deepEqual(revision2.document, revision2Before);
    assert.deepEqual(curveBounds, curveBefore);
    assert.deepEqual(surfaceBounds, surfaceBefore);
    assert.deepEqual(readFileSync(revision1.file), revision1.bytes);
    assert.deepEqual(readFileSync(revision2.file), revision2.bytes);
    assert.deepEqual(readFileSync(loftSourceFile), loftSourceBytes);
    return true;
  });
}

reject('stale_query_reference', () => query(revision2.document, curveBounds.reference), 'STALE');
reject('stale_owned_bounds', () => validate(revision2.document, curveBounds), 'STALE');
reject('missing_body', () => query(revision1.document, {...curveBounds.reference, bodyId: 'missing_body'}), 'REFERENCE');
const docTamper = structuredClone(revision1.document);
docTamper.document.assets[0].source += ' ';
reject('document_source_tamper', () => query(docTamper, curveBounds.reference), 'REFERENCE');
let getterCalls = 0;
const ownGetter = structuredClone(curveBounds);
Object.defineProperty(ownGetter, 'geometry', {
  enumerable: true, get() { getterCalls++; return curveBounds.geometry; },
});
reject('owned_getter', () => validate(revision1.document, ownGetter), 'OWNED');
assert.equal(getterCalls, 0);
for (const [name, alter] of [
  ['coefficient', result => result.geometry.controlPoints[1][2] += .25],
  ['bounds', result => result.boundsMM.max[1] += .25],
  ['witness', result => result.extrema[0].poleIndex = 99],
  ['source', result => result.source += ' '],
  ['report', result => result.report.controlPoleCount++],
]) {
  const changed = structuredClone(curveBounds);
  alter(changed);
  reject('owned_' + name + '_tamper', () => validate(revision1.document, changed), 'OWNED');
}
assert.deepEqual(validate(revision1.document, curveBounds), curveBounds.report);

// Current public compiled JS and six declaration names use actual manifest paths.
const packageRoot = resolve(repo, 'packages/barocss-cad');
const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const declared = manifest.exports['.'];
const runtimePath = resolve(packageRoot, declared.import), declarationPath = resolve(packageRoot, declared.types);
assert.ok(existsSync(runtimePath));
assert.ok(existsSync(declarationPath));
const publicAPI = await import(pathToFileURL(runtimePath).href);
const runtimeExports = ['queryCadDocumentBounds', 'validateCadDocumentBounds', 'CadDocumentBoundsError', 'CadDocumentBoundsDiagnosticCode'];
for (const name of runtimeExports) assert.equal(typeof publicAPI[name], name.endsWith('Code') ? 'object' : 'function');
assert.deepEqual(publicAPI.CadDocumentBoundsDiagnosticCode, CadDocumentBoundsDiagnosticCode);
assert.ok(readFileSync(declarationPath, 'utf8').includes('./cad-document-bounds.js'));
const leafDeclarationPath = resolve(packageRoot, 'dist/cad-document-bounds.d.ts');
const leafDeclaration = readFileSync(leafDeclarationPath, 'utf8');
const declarationExports = [...runtimeExports, 'CadDocumentBoundsReport', 'CadDocumentBoundsResult'];
for (const name of declarationExports) {
  assert.ok(new RegExp('export (?:declare )?(?:function|class|const|interface|type) ' + name + '\\b').test(leafDeclaration), name);
}
assert.ok(leafDeclaration.includes('export type CadDocumentBoundsDiagnosticCode'));
const compiledDocument = publicAPI.parseCadDocument(readFileSync(revision1.file, 'utf8'));
const compiledBounds = publicAPI.queryCadDocumentBounds(compiledDocument, surfaceBounds.reference);
assert.deepEqual(compiledBounds, surfaceBounds);
assert.deepEqual(publicAPI.validateCadDocumentBounds(compiledDocument, compiledBounds), surfaceBounds.report);
const compiledConsumer = {runtimePath, declarationPath, leafDeclarationPath, runtimeExports, declarationExports,
  selectedGeometryCount: compiledBounds.report.selectedGeometryCount, poles: compiledBounds.report.controlPoleCount,
  declarationCheck: 'actual exported declaration text; no separate TypeScript invocation'};
ownedFile('compiled-consumer', compiledConsumer);
ownedFile('summary', {sourceMode: true, cadSourceInputCount: cadInputs.length, loftSourceFile, loftSourceSha256: hash(loftSourceBytes),
  editedSourceFile, zeroSourceFile, summaries, failures, compiledConsumer,
  localSampleCounts: {curve: curveSamples.observations.length, surface: surfaceSamples.observations.length},
  maximumLocalOutsideMM: Math.max(curveSamples.maximumOutsideMM, surfaceSamples.maximumOutsideMM),
  scope: 'One actual source-backed qualified native control-pole box at exact revisions. Source coefficient witnesses and signed-zero ties are exact; positive-rational hull containment is conservative in exact arithmetic. Native sample checks use1e-7mm local tolerance. No tight geometry extrema, global floating containment, display pose, BRep/assembly, mass, volume, area, inertia, topology or manufacturing certificate.'});
console.log(JSON.stringify({sourceMode: true, cadSourceInputCount: cadInputs.length,
  loftSourceFile, summaries, failures, compiledConsumer}));
