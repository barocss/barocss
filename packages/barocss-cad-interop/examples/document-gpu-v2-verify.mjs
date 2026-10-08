import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { validateCadDocumentResult, validateWideAdaptiveCurveSamples } from '@barocss/cad';
import { loadBaroCadDocument, parseBaroCadDocument,
  prepareBaroCadDocumentPrimitiveNativeRefsV2 } from '@barocss/cad-interop/document';
import { document, fixtureText, source } from './document-gpu-v2-fixture.mjs';

const file = readFileSync(new URL('document-gpu-v2.cad-document.json', import.meta.url), 'utf8');
assert.equal(file, fixtureText);
const parsed = parseBaroCadDocument(file);
validateCadDocumentResult(parsed);
assert.equal(parsed.document.documentId, document.documentId);
assert.equal(parsed.document.revision, 5);
assert.deepEqual(parsed.document.assets.map(asset => asset.revision), [2, 7]);
assert.ok(parsed.document.assets.every(asset => asset.source === source));
assert.ok(Object.is(parsed.compiledAssets[0].model.objects[0].controlPoints[0][1], -0));

const server = createServer((request, response) => {
  if (request.url !== '/document') { response.writeHead(404).end(); return; }
  const bytes = Buffer.from(file);
  response.writeHead(200, { 'content-type': 'application/json', 'content-length': bytes.length });
  response.end(bytes);
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
let loaded;
try {
  loaded = await loadBaroCadDocument(`http://127.0.0.1:${server.address().port}/document`);
} finally {
  server.closeAllConnections(); server.close(); await once(server, 'close');
}
assert.deepEqual(loaded, parsed);
const native = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
  curveDisplay: { version: 1, chordToleranceMM: 0.02, maxSegments: 512, maxDepth: 16 } };
const options = { native, basis: 'authored-xyz-matches-rhyup',
  bodyIds: ['body_1_surface', 'body_0_curve', 'body_1_curve', 'body_0_surface'] };
const before = structuredClone(loaded);
assert.throws(() => prepareBaroCadDocumentPrimitiveNativeRefsV2(loaded, { native,
  basis: 'authored-xyz-matches-rhyup' }), /explicit bodyIds/);
const projected = prepareBaroCadDocumentPrimitiveNativeRefsV2(loaded, options);
assert.deepEqual(projected.map(entry => entry.binding.bodyId),
  ['body_0_curve', 'body_0_surface', 'body_1_curve', 'body_1_surface']);
assert.deepEqual(projected.map(entry => entry.kind), ['curve', 'surface', 'curve', 'surface']);
assert.deepEqual(projected.map(entry => entry.ref.modelId), ['asset.a', 'asset.a', 'asset_b', 'asset_b']);
assert.deepEqual(projected.map(entry => entry.ref.geometryId),
  ['guide_path_native', 'support_patch_native', 'guide_path_native', 'support_patch_native']);
assert.deepEqual(projected.map(entry => entry.binding.assetRevision), [2, 2, 7, 7]);
assert.ok(projected.every(entry => entry.binding.documentRevision === 5 &&
  entry.binding.nativeFrame === 'authored-xyz-no-axis-conversion' &&
  entry.binding.sourceFrame === 'authored-xyz-no-axis-conversion' &&
  entry.ref.geometryId === (entry.kind === 'curve' ? entry.sample.curve.id : entry.packet.surfaceId)));
for (const entry of projected.filter(entry => entry.kind === 'curve')) {
  assert.equal(entry.sampleVersion, 1);
  validateWideAdaptiveCurveSamples(entry.sample);
  assert.deepEqual(entry.sample.curve, parsed.compiledAssets[0].model.objects[0]);
  assert.deepEqual(entry.sample.domain, [-3, 7]);
}
assert.deepEqual(loaded, before);
projected[0].sample.curve.controlPoints[0][0] = 999;
projected[1].packet.positions[0] = 999;
assert.deepEqual(loaded, before);
const accepted = prepareBaroCadDocumentPrimitiveNativeRefsV2(loaded, options);
const acceptedBefore = structuredClone(accepted);
const refuse = changed => assert.throws(() => prepareBaroCadDocumentPrimitiveNativeRefsV2(loaded, changed));
refuse({ ...options, bodyIds: ['missing_body'] });
refuse({ ...options, bodyIds: ['body_0_curve', 'body_0_curve'] });
refuse({ ...options, bodyIds: ['body_0_curve', 'body_0_surface', 'body_1_curve', 'body_1_surface', 'body_1_skip'] });
refuse({ ...options, basis: 'authored-xyz-no-axis-conversion' });
refuse({ ...options, native: { ...native, curveDisplay: undefined } });
const getterOptions = { ...options };
let reads = 0;
Object.defineProperty(getterOptions, 'bodyIds', { enumerable: true, get() { reads++; return options.bodyIds; } });
refuse(getterOptions);
assert.equal(reads, 0);
const forged = structuredClone(loaded);
forged.bodyBindings[0].assetId = 'asset_b';
assert.throws(() => prepareBaroCadDocumentPrimitiveNativeRefsV2(forged, options));
const wrongProfile = structuredClone(loaded);
wrongProfile.document.profile = 'other';
assert.throws(() => prepareBaroCadDocumentPrimitiveNativeRefsV2(wrongProfile, options));
const tooManyNative = structuredClone(document);
tooManyNative.assets[0].source = source.replace(/\n}\n$/, `
  @curve #extra_one { type:nurbs; degree:1; knots:[0,0,1,1];
    control-points:[[0,0,0],[1,0,0]]; weights:[1,1]; }
  @curve #extra_two { type:nurbs; degree:1; knots:[0,0,1,1];
    control-points:[[0,1,0],[1,1,0]]; weights:[1,1]; }
}
`);
const tooManyResult = parseBaroCadDocument(JSON.stringify(tooManyNative));
assert.throws(() => prepareBaroCadDocumentPrimitiveNativeRefsV2(tooManyResult,
  { ...options, bodyIds: ['body_0_curve'] }), /1\.\.4 total native objects/);
assert.throws(() => prepareBaroCadDocumentPrimitiveNativeRefsV2(new Proxy(loaded, {}), options));
const getterResult = structuredClone(loaded);
let sourceGetterReads = 0;
Object.defineProperty(getterResult.document.assets[0], 'source', { enumerable: true,
  get() { sourceGetterReads++; return source; } });
assert.throws(() => prepareBaroCadDocumentPrimitiveNativeRefsV2(getterResult, options));
assert.equal(sourceGetterReads, 0);
assert.deepEqual(loaded, before);
assert.deepEqual(accepted, acceptedBefore);

console.log(JSON.stringify({ fileBytes: Buffer.byteLength(file), documentId: loaded.document.documentId,
  revision: loaded.document.revision, assetRevisions: loaded.document.assets.map(asset => asset.revision),
  assets: loaded.document.assets.length, bodies: loaded.document.bodies.length,
  selected: accepted.length, refs: accepted.map(entry => entry.ref),
  points: accepted.filter(entry => entry.kind === 'curve').map(entry => entry.sample.pointsMM.length),
  originalSourceRetained: true, refusalRetainsAccepted: true }));
