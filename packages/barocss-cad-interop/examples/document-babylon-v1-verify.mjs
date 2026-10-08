import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { LinesMesh } from '@babylonjs/core/Meshes/linesMesh.js';
import { loadBaroCadDocument, prepareBaroCadDocumentPrimitiveNativeRefsV2 } from '@barocss/cad-interop/document';
import { BaroCADBabylonLoader } from '@barocss/cad-interop/babylon';
import { createBaroCadDocumentBabylonDisplay } from '@barocss/cad-interop/babylon-document';
import { fixtureText, source } from './document-gpu-v2-fixture.mjs';

const file = readFileSync(new URL('document-gpu-v2.cad-document.json', import.meta.url), 'utf8');
assert.equal(file, fixtureText);
const server = createServer((request, response) => {
  if (request.url !== '/document') { response.writeHead(404).end(); return; }
  const bytes = Buffer.from(file);
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
const projected = prepareBaroCadDocumentPrimitiveNativeRefsV2(cad, options);
const engine = new NullEngine();
const scene = new Scene(engine);
scene.useRightHandedSystem = true;
const callerMesh = new Mesh('caller-owned', scene);
const display = createBaroCadDocumentBabylonDisplay(scene, cad, options);
assert.deepEqual(display.bindings.map(binding => binding.bodyId),
  ['body_0_curve', 'body_0_surface', 'body_1_curve', 'body_1_surface']);
assert.deepEqual(display.bindings.map(binding => binding.assetId),
  ['asset-a', 'asset-a', 'asset_b', 'asset_b']);
assert.deepEqual(display.bindings.map(binding => binding.ref.modelId),
  ['asset.a', 'asset.a', 'asset_b', 'asset_b']);
assert.deepEqual(display.bindings.map(binding => binding.assetRevision), [2, 2, 7, 7]);
assert.equal(display.assetNodes.length, 2);
assert.ok(display.assetNodes.every(node => node.parent === display.root));
assert.deepEqual(display.bindings.map(binding => binding.mesh instanceof LinesMesh ? 'curve' :
  binding.mesh instanceof Mesh ? 'surface' : 'other'),
['curve', 'surface', 'curve', 'surface']);
assert.ok(display.bindings.every(binding => binding.documentId === 'document_gpu_v2' &&
  binding.documentRevision === 5 && binding.nativeFrame === 'authored-xyz-no-axis-conversion' &&
  binding.sourceFrame === 'authored-xyz-no-axis-conversion' &&
  binding.mesh.parent === binding.assetNode && binding.mesh.isEnabled() &&
  (binding.mesh.metadata.barocss.curveId ?? binding.mesh.metadata.barocss.surfaceId) === binding.geometryId));
const skipped = scene.meshes.filter(mesh => mesh.name.endsWith(':skip_path_native'));
assert.equal(skipped.length, 2);
assert.ok(skipped.every(mesh => !mesh.isEnabled()));
for (const binding of display.bindings) {
  const entry = projected.find(value => value.binding.bodyId === binding.bodyId);
  const original = entry.kind === 'curve' ? entry.sample.pointsMM.flat() : entry.packet.positions;
  const expected = Float32Array.from(original, value => Math.fround(value * native.unitsPerMillimeter));
  const actual = binding.mesh.getVerticesData('position');
  assert.equal(actual.length, expected.length);
  assert.ok(actual.every((value, index) => value === expected[index]));
}
assert.ok(Object.is(cad.compiledAssets[0].model.objects[0].controlPoints[0][1], -0));
assert.ok(cad.document.assets.every(asset => asset.source === source));
assert.deepEqual(cad, before);

const refuse = candidate => assert.throws(() => createBaroCadDocumentBabylonDisplay(scene, cad, candidate));
refuse({ ...options, bodyIds: ['missing_body'] });
refuse({ ...options, bodyIds: ['body_0_curve', 'body_0_curve'] });
refuse({ ...options, bodyIds: [...options.bodyIds, 'body_0_skip'] });
refuse({ ...options, basis: 'authored-xyz-no-axis-conversion' });
refuse({ ...options, native: { ...native, curveDisplay: undefined } });
const forged = structuredClone(cad); forged.bodyBindings[0].assetId = 'asset_b';
assert.throws(() => createBaroCadDocumentBabylonDisplay(scene, forged, options));
const profile = structuredClone(cad); profile.document.profile = 'other';
assert.throws(() => createBaroCadDocumentBabylonDisplay(scene, profile, options));
const getter = structuredClone(cad);
let getterReads = 0;
Object.defineProperty(getter.document.assets[0], 'source', { enumerable: true,
  get() { getterReads++; return source; } });
assert.throws(() => createBaroCadDocumentBabylonDisplay(scene, getter, options));
assert.equal(getterReads, 0);
scene.useRightHandedSystem = false;
assert.throws(() => createBaroCadDocumentBabylonDisplay(scene, cad, options), /right-handed/);
scene.useRightHandedSystem = true;
const originalParse = BaroCADBabylonLoader.prototype.parse;
let stagedCalls = 0;
const stagedMeshes = [];
try {
  BaroCADBabylonLoader.prototype.parse = function (text) {
    const staged = originalParse.call(this, text);
    stagedCalls++;
    stagedMeshes.push(...staged.meshes);
    if (stagedCalls === 2) staged.model.name = 'forged_second_model';
    return staged;
  };
  assert.throws(() => createBaroCadDocumentBabylonDisplay(scene, cad, options), /differs/);
} finally { BaroCADBabylonLoader.prototype.parse = originalParse; }
assert.equal(stagedCalls, 2);
assert.equal(stagedMeshes.length, 6);
assert.ok(stagedMeshes.every(mesh => mesh.isDisposed() && !scene.meshes.includes(mesh)));
assert.ok(display.bindings.every(binding => !binding.mesh.isDisposed() && scene.meshes.includes(binding.mesh)));
assert.deepEqual(cad, before);

const ownedMeshes = [...display.bindings.map(binding => binding.mesh), ...skipped];
display.dispose(); display.dispose();
assert.ok(ownedMeshes.every(mesh => mesh.isDisposed() && !scene.meshes.includes(mesh)));
assert.ok(display.assetNodes.every(node => node.isDisposed()));
assert.ok(display.root.isDisposed());
assert.ok(!callerMesh.isDisposed() && scene.meshes.includes(callerMesh));
assert.ok(!scene.isDisposed && engine.scenes.includes(scene));
assert.deepEqual(cad, before);
console.log(JSON.stringify({ fileBytes: Buffer.byteLength(file), documentId: cad.document.documentId,
  selected: display.bindings.map(binding => binding.bodyId), assetNodes: display.assetNodes.length,
  curves: 2, surfaces: 2, unselectedDisabled: skipped.length,
  stagedMeshesDisposed: stagedMeshes.length, ownedMeshesDisposed: ownedMeshes.length,
  callerMeshRetained: true, originalSourceRetained: true, refusalRetainsAccepted: true }));
scene.dispose(); engine.dispose();
