import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CadDocumentError, curveDomain, serializeCadDocument, surfaceDomain, validateCadDocumentResult,
} from '@barocss/cad';
import { loadBaroCadDocument, parseBaroCadDocument } from '@barocss/cad-interop/document';
import { parseBaroCadSource } from '@barocss/cad-interop/native';

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
const frame = 'authored-xyz-no-axis-conversion';
const document = {
  schema: 'barocss-cad-document', version: 1, profile: 'direct-geometry',
  documentId: 'part_native', revision: 0,
  units: { length: 'mm', angle: 'rad' }, nativeFrame: frame,
  assets: [{ id: 'asset_native', revision: 0, role: 'authored-native-source',
    sourceVersion: 0, sourceFrame: frame, source }],
  bodies: [
    { id: 'body_curve', name: 'Guide curve', kind: 'direct-geometry-object',
      assetId: 'asset_native', geometryId: 'guide_path_native' },
    { id: 'body_surface', name: 'Support patch', kind: 'direct-geometry-object',
      assetId: 'asset_native', geometryId: 'support_patch_native' },
  ],
  features: [], parameters: [], constraints: [], placements: [], derivedCaches: [],
};
const qualified = structuredClone(document);
qualified.documentId = 'part_qualified';
qualified.assets.push({ ...structuredClone(document.assets[0]), id: 'asset_second', revision: 7 });
qualified.bodies.push({ id: 'body_second_curve', name: 'Second asset guide',
  kind: 'direct-geometry-object', assetId: 'asset_second', geometryId: 'guide_path_native' });
const edited = structuredClone(document);
edited.revision = 1;
edited.assets[0].revision = 1;
edited.assets[0].source = source.replace('[0,3,1]', '[0,3,2]');

const output = mkdtempSync(join(tmpdir(), 'barocad-document-loader-'));
const files = Object.fromEntries([['original', document], ['qualified', qualified], ['edited', edited]]
  .map(([name, value]) => {
    const path = join(output, `${name}.cad-document.json`);
    writeFileSync(path, serializeCadDocument(value));
    return [name, path];
  }));
const originalText = readFileSync(files.original, 'utf8');
const original = parseBaroCadDocument(originalText);
const originalBefore = structuredClone(original);
validateCadDocumentResult(original);
assert.equal(original.document.assets[0].source, source);
assert.equal(original.compiledAssets[0].source, source);
assert.deepEqual(original.bodyBindings.map(binding => binding.geometryKind), ['curve', 'surface']);
const originalModel = original.compiledAssets[0].model;
assert.equal(originalModel.name, 'authored_part');
assert.equal(originalModel.objects[0].id, 'guide_path_native');
assert.equal(originalModel.objects[1].id, 'support_patch_native');
assert.deepEqual(curveDomain(originalModel.objects[0]), [-3, 7]);
assert.deepEqual(surfaceDomain(originalModel.objects[1]), { u: [-2, 5], v: [-0, 3] });
assert.ok(Object.is(originalModel.objects[0].controlPoints[0][1], -0));
assert.ok(Object.is(originalModel.objects[1].controlPoints[0][0][0], -0));
assert.throws(() => parseBaroCadSource(originalText, {
  sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
}));

const qualifiedText = readFileSync(files.qualified, 'utf8');
const qualifiedResult = parseBaroCadDocument(qualifiedText);
validateCadDocumentResult(qualifiedResult);
assert.deepEqual(qualifiedResult.bodyBindings.filter(binding => binding.geometryId === 'guide_path_native')
  .map(binding => binding.assetId), ['asset_native', 'asset_second']);
assert.deepEqual(qualifiedResult.compiledAssets.map(asset => asset.model.objects[0].id),
  ['guide_path_native', 'guide_path_native']);
const editedResult = parseBaroCadDocument(readFileSync(files.edited, 'utf8'));
validateCadDocumentResult(editedResult);
assert.equal(editedResult.document.documentId, original.document.documentId);
assert.equal(editedResult.document.revision, 1);
assert.deepEqual(editedResult.bodyBindings, original.bodyBindings);
assert.equal(editedResult.compiledAssets[0].model.objects[0].controlPoints[1][2], 2);
assert.equal(original.compiledAssets[0].model.objects[0].controlPoints[1][2], 1);
assert.deepEqual(original, originalBefore);

const independent = parseBaroCadDocument(originalText);
independent.document.assets[0].source = 'caller-edited-copy';
assert.equal(original.document.assets[0].source, source);
const invalidReference = structuredClone(document);
invalidReference.bodies[0].geometryId = 'missing_geometry';
assert.throws(() => parseBaroCadDocument(JSON.stringify(invalidReference)),
  error => error instanceof CadDocumentError && error.code === 'REFERENCE');
const unsupportedFeature = structuredClone(document);
unsupportedFeature.features.push({ id: 'not_supported' });
assert.throws(() => parseBaroCadDocument(JSON.stringify(unsupportedFeature)),
  error => error instanceof CadDocumentError && error.code === 'PROFILE');
assert.deepEqual(original, originalBefore);

const server = createServer((request, response) => {
  if (request.url === '/oversize') {
    response.writeHead(200, { 'content-length': 2097153 });
    response.end();
    return;
  }
  if (request.url === '/oversize-stream') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(Buffer.alloc(2097153, 32));
    return;
  }
  if (request.url === '/invalid-utf8') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(Buffer.from([0xc3, 0x28]));
    return;
  }
  const file = request.url === '/original' ? files.original : request.url === '/qualified' ? files.qualified : undefined;
  if (!file) { response.writeHead(404).end(); return; }
  const bytes = readFileSync(file);
  response.writeHead(200, { 'content-type': 'application/json', 'content-length': bytes.byteLength });
  response.end(bytes);
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
let loadedBytes = 0;
try {
  const base = `http://127.0.0.1:${server.address().port}`;
  const loaded = await loadBaroCadDocument(`${base}/original`, {
    onProgress(progress) { loadedBytes = progress.loadedBytes; },
  });
  assert.deepEqual(loaded, original);
  assert.equal(loadedBytes, Buffer.byteLength(originalText));
  assert.deepEqual(await loadBaroCadDocument(`${base}/qualified`), qualifiedResult);
  await assert.rejects(loadBaroCadDocument(`${base}/oversize`), /2097152 bytes/);
  await assert.rejects(loadBaroCadDocument(`${base}/oversize-stream`), /2097152 bytes/);
  await assert.rejects(loadBaroCadDocument(`${base}/invalid-utf8`), TypeError);
  await assert.rejects(loadBaroCadDocument('file:///tmp/document.json'), /HTTP\(S\)/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(loadBaroCadDocument(`${base}/original`, { signal: controller.signal }),
    error => error.name === 'AbortError' && error.code === 'ABORT_ERR');
  await assert.rejects(loadBaroCadDocument(`${base}/original`, { onProgress: () => false }),
    error => error.name === 'AbortError' && error.code === 'ABORT_ERR');
  assert.deepEqual(original, originalBefore);
} finally {
  server.closeAllConnections();
  server.close();
  await once(server, 'close');
}

console.log(JSON.stringify({
  output, fileBytes: Buffer.byteLength(originalText), loadedBytes,
  documentId: original.document.documentId, originalRevision: original.document.revision,
  editedRevision: editedResult.document.revision, assets: qualifiedResult.compiledAssets.length,
  bodies: qualifiedResult.bodyBindings.length, repeatedGeometryIdQualified: true,
  originalSignedZero: true, originalResultRetained: true, oldSourceReaderRefused: true,
  malformedAndUnsupportedRefused: true, oversizedAndAbortRefused: true,
}));
