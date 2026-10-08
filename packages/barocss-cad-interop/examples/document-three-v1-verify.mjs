import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { Group, Line, Mesh, Scene } from 'three';
import { loadBaroCadDocument } from '@barocss/cad-interop/document';
import { createBaroCadDocumentThreeDisplay } from '@barocss/cad-interop/three-document';
import { BaroCADLoader } from '@barocss/cad-interop/three';
import { fixtureText, source } from './document-gpu-v2-fixture.mjs';

const text = readFileSync(new URL('document-gpu-v2.cad-document.json', import.meta.url), 'utf8');
assert.equal(text, fixtureText);
const server = createServer((request, response) => {
  if (request.url !== '/document') { response.writeHead(404).end(); return; }
  const bytes = Buffer.from(text);
  response.writeHead(200, { 'content-type': 'application/json', 'content-length': bytes.length });
  response.end(bytes);
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
let cad;
try { cad = await loadBaroCadDocument(`http://127.0.0.1:${server.address().port}/document`); }
finally { server.closeAllConnections(); server.close(); await once(server, 'close'); }
const before = structuredClone(cad);
const native = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
  curveDisplay: { version: 1, chordToleranceMM: 0.02, maxSegments: 512, maxDepth: 16 } };
const options = { native, basis: 'authored-xyz-matches-rhyup',
  bodyIds: ['body_1_surface', 'body_0_curve', 'body_1_curve', 'body_0_surface'] };
const display = createBaroCadDocumentThreeDisplay(cad, options);
assert.deepEqual(display.bindings.map(binding => binding.bodyId),
  ['body_0_curve', 'body_0_surface', 'body_1_curve', 'body_1_surface']);
assert.deepEqual(display.bindings.map(binding => binding.assetId),
  ['asset-a', 'asset-a', 'asset_b', 'asset_b']);
assert.deepEqual(display.bindings.map(binding => binding.ref.modelId),
  ['asset.a', 'asset.a', 'asset_b', 'asset_b']);
assert.deepEqual(display.bindings.map(binding => binding.assetRevision), [2, 2, 7, 7]);
assert.equal(display.root.children.length, 2);
assert.deepEqual(display.root.children.map(group => group.children.length), [2, 2]);
assert.ok(display.root.children.every(group => group.name === 'authored_part' &&
  !group.children.some(child => child.name === 'skip_path_native')));
assert.ok(display.bindings.every(binding => binding.documentId === 'document_gpu_v2' &&
  binding.documentRevision === 5 && binding.nativeFrame === 'authored-xyz-no-axis-conversion' &&
  binding.sourceFrame === 'authored-xyz-no-axis-conversion' &&
  binding.object.name === binding.geometryId && binding.object.parent === binding.assetGroup));
assert.deepEqual(display.bindings.map(binding => binding.object instanceof Line ? 'curve' :
  binding.object instanceof Mesh ? 'surface' : 'other'),
['curve', 'surface', 'curve', 'surface']);
for (const binding of display.bindings) {
  const sourceObject = cad.compiledAssets.find(asset => asset.assetId === binding.assetId)
    .model.objects.find(object => object.id === binding.geometryId);
  assert.equal(sourceObject.kind, binding.geometryKind);
  const attr = binding.object.geometry.getAttribute('position');
  assert.ok(attr.count > 1);
  const origin = binding.geometryKind === 'curve' ? sourceObject.controlPoints[0] :
    sourceObject.controlPoints[0][0];
  if (binding.geometryKind === 'surface') {
    assert.ok(Array.from(attr.array.slice(0, 3))
      .every((value, axis) => value === Math.fround(origin[axis] * 0.001)));
  }
}
assert.ok(Object.is(cad.compiledAssets[0].model.objects[0].controlPoints[0][1], -0));
assert.ok(cad.document.assets.every(asset => asset.source === source));
assert.deepEqual(cad, before);

const scene = new Scene();
const marker = new Group(); marker.name = 'caller-marker';
scene.add(marker, display.root);
const refuse = candidate => assert.throws(() => createBaroCadDocumentThreeDisplay(cad, candidate));
refuse({ ...options, bodyIds: ['missing_body'] });
refuse({ ...options, bodyIds: ['body_0_curve', 'body_0_curve'] });
refuse({ ...options, bodyIds: ['body_0_curve', 'body_0_surface', 'body_1_curve', 'body_1_surface', 'body_0_skip'] });
refuse({ ...options, basis: 'authored-xyz-no-axis-conversion' });
const forged = structuredClone(cad); forged.bodyBindings[0].assetId = 'asset_b';
assert.throws(() => createBaroCadDocumentThreeDisplay(forged, options));
const profile = structuredClone(cad); profile.document.profile = 'other';
assert.throws(() => createBaroCadDocumentThreeDisplay(profile, options));
const getter = structuredClone(cad);
let getterReads = 0;
Object.defineProperty(getter.document.assets[0], 'source', { enumerable: true,
  get() { getterReads++; return source; } });
assert.throws(() => createBaroCadDocumentThreeDisplay(getter, options));
assert.equal(getterReads, 0);
const originalParse = BaroCADLoader.prototype.parse;
let stagedCalls = 0, stagedGeometriesDisposed = 0, stagedMaterialsDisposed = 0;
try {
  BaroCADLoader.prototype.parse = function (text) {
    const staged = originalParse.call(this, text);
    stagedCalls++;
    for (const child of staged.group.children) {
      child.geometry.addEventListener('dispose', () => stagedGeometriesDisposed++);
      child.material.addEventListener('dispose', () => stagedMaterialsDisposed++);
    }
    if (stagedCalls === 2) staged.model.name = 'forged_second_model';
    return staged;
  };
  assert.throws(() => createBaroCadDocumentThreeDisplay(cad, options), /differs/);
} finally { BaroCADLoader.prototype.parse = originalParse; }
assert.equal(stagedCalls, 2);
assert.equal(stagedGeometriesDisposed, 6);
assert.equal(stagedMaterialsDisposed, 6);
assert.equal(display.root.parent, scene);
assert.equal(display.bindings.length, 4);
assert.deepEqual(cad, before);

let geometriesDisposed = 0, materialsDisposed = 0;
for (const binding of display.bindings) {
  binding.object.geometry.addEventListener('dispose', () => geometriesDisposed++);
  binding.object.material.addEventListener('dispose', () => materialsDisposed++);
}
display.dispose(); display.dispose();
assert.equal(geometriesDisposed, 4);
assert.equal(materialsDisposed, 4);
assert.deepEqual(scene.children, [marker]);
assert.deepEqual(cad, before);
console.log(JSON.stringify({ fileBytes: Buffer.byteLength(text), documentId: cad.document.documentId,
  selected: display.bindings.map(binding => binding.bodyId), assetGroups: 2,
  curves: 2, surfaces: 2, unselectedVisible: false, geometriesDisposed, materialsDisposed,
  stagedGeometriesDisposed, stagedMaterialsDisposed,
  callerMarkerRetained: true, originalSourceRetained: true, refusalRetainsAccepted: true }));
