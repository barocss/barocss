import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadBaroCadDocument, prepareBaroCadDocumentPrimitiveNativeRefsV2 } from '@barocss/cad-interop/document';
import { exportBaroCadDocumentDisplayGlb } from '@barocss/cad-interop/document-glb';
import { baroCadSourceToGLB } from '@barocss/cad-interop/native';
import { fixtureText, source } from './document-gpu-v2-fixture.mjs';

globalThis.ProgressEvent ??= class ProgressEvent {
  constructor(type, init) { this.type = type; Object.assign(this, init); }
};
const file = readFileSync(new URL('document-gpu-v2.cad-document.json', import.meta.url), 'utf8');
assert.equal(file, fixtureText);
let glb;
const server = createServer((request, response) => {
  if (request.url === '/document') {
    const bytes = Buffer.from(file);
    response.writeHead(200, { 'content-type': 'application/json', 'content-length': bytes.length }).end(bytes);
  } else if (request.url === '/display.glb' && glb) {
    response.writeHead(200, { 'content-type': 'model/gltf-binary', 'content-length': glb.byteLength })
      .end(Buffer.from(glb));
  } else response.writeHead(404).end();
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const baseURL = `http://127.0.0.1:${server.address().port}`;
try {
  const cad = await loadBaroCadDocument(`${baseURL}/document`);
  const before = structuredClone(cad);
  const native = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
    curveDisplay: { version: 1, chordToleranceMM: 0.02, maxSegments: 512, maxDepth: 16 } };
  const options = { native, basis: 'authored-xyz-matches-rhyup',
    bodyIds: ['body_1_surface', 'body_0_curve', 'body_1_curve', 'body_0_surface'] };
  const projection = prepareBaroCadDocumentPrimitiveNativeRefsV2(cad, options);
  const exported = exportBaroCadDocumentDisplayGlb(cad, options);
  glb = exported.glb;
  const report = exported.report;
  assert.equal(report.schema, 'barocad-document-display-glb-report');
  assert.equal(report.version, 1);
  assert.equal(report.documentId, 'document_gpu_v2');
  assert.equal(report.documentRevision, 5);
  assert.equal(report.sourceRole, 'original-authored-native-source-text');
  assert.equal(report.outputRole, 'derived-display-mesh');
  assert.deepEqual(report.mappings.map(value => value.bodyId),
    ['body_0_curve', 'body_0_surface', 'body_1_curve', 'body_1_surface']);
  assert.deepEqual(report.mappings.map(value => value.gltfNodeIndex), [2, 0, 3, 1]);
  assert.deepEqual(report.mappings.map(value => value.primitiveMode), [3, 4, 3, 4]);
  assert.deepEqual(report.mappings.map(value => value.assetRevision), [2, 2, 7, 7]);
  assert.deepEqual(report.mappings.filter(value => value.geometryKind === 'curve')
    .map(value => [value.curveSampleVersion, value.curveDomain]), [[1, [-3, 7]], [1, [-3, 7]]]);
  assert.deepEqual(report.unselectedBodyIds, ['body_0_skip', 'body_1_skip']);
  assert.ok(report.preserved.length && report.approximated.length && report.omitted.length && report.unsupported.length);
  assert.ok(report.omitted.includes('original-native-source-text'));
  assert.equal(report.outputBytes, glb.byteLength);
  assert.ok(glb.byteLength < report.maximumOutputBytes);
  const view = new DataView(glb);
  assert.equal(view.getUint32(0, true), 0x46546c67);
  assert.equal(view.getUint32(4, true), 2);
  assert.equal(view.getUint32(8, true), glb.byteLength);
  const jsonLength = view.getUint32(12, true);
  const jsonText = new TextDecoder().decode(new Uint8Array(glb, 20, jsonLength));
  const json = JSON.parse(jsonText);
  assert.equal(json.asset.extras.barocss.format, 'barocad-document-display-glb');
  assert.equal(json.asset.extras.barocss.source, undefined);
  assert.ok(!jsonText.includes(source));
  assert.equal(json.nodes.length, 4);
  assert.equal(new Set(json.nodes.map(node => node.name)).size, 4);
  for (const mapping of report.mappings) {
    const node = json.nodes[mapping.gltfNodeIndex];
    assert.equal(node.name, mapping.derivedNodeName);
    assert.equal(node.extras.barocss.bodyId, mapping.bodyId);
    assert.equal(node.extras.barocss.sourceGeometryId, mapping.sourceGeometryId);
    assert.equal(node.extras.barocss.assetId, mapping.assetId);
    assert.deepEqual(node.extras.barocss.ref, mapping.ref);
    const primitive = json.meshes[node.mesh].primitives[0];
    assert.equal(primitive.mode, mapping.primitiveMode);
    assert.equal(primitive.attributes.TEXCOORD_0, undefined);
    const entry = projection.find(value => value.binding.bodyId === mapping.bodyId);
    const expected = Float32Array.from(entry.kind === 'curve' ? entry.sample.pointsMM.flat() : entry.packet.positions,
      value => Math.fround(value * 0.001));
    const accessor = json.accessors[primitive.attributes.POSITION];
    const bufferView = json.bufferViews[accessor.bufferView];
    const binaryOffset = 20 + jsonLength + 8;
    assert.equal(accessor.count * 3, expected.length);
    for (let index = 0; index < expected.length; index++) {
      assert.equal(view.getFloat32(binaryOffset + bufferView.byteOffset + index * 4, true), expected[index]);
    }
    if (entry.kind === 'curve') {
      assert.deepEqual(node.extras.barocss.nativeDomain, [-3, 7]);
      assert.deepEqual(node.extras.barocss.parameters, entry.sample.parameters);
      assert.equal(primitive.attributes.NORMAL, undefined);
    } else assert.ok(Number.isInteger(primitive.attributes._CAD_UV));
  }
  const imported = await new GLTFLoader().loadAsync(`${baseURL}/display.glb`);
  const objects = [];
  imported.scene.traverse(object => { if (object.isLine || object.isMesh) objects.push(object); });
  assert.equal(objects.length, 4);
  assert.deepEqual(objects.map(object => object.userData.barocss.bodyId).sort(),
    report.mappings.map(mapping => mapping.bodyId).sort());
  assert.equal(objects.filter(object => object.isLine).length, 2);
  assert.equal(objects.filter(object => object.isMesh).length, 2);
  const originalBytes = Buffer.from(glb);
  const refuse = candidate => assert.throws(() => exportBaroCadDocumentDisplayGlb(cad, candidate));
  refuse({ ...options, bodyIds: ['missing_body'] });
  refuse({ ...options, bodyIds: ['body_0_curve', 'body_0_curve'] });
  refuse({ ...options, bodyIds: [...options.bodyIds, 'body_0_skip'] });
  refuse({ ...options, basis: 'authored-xyz-no-axis-conversion' });
  refuse({ ...options, native: { ...native, unitsPerMillimeter: 1 } });
  refuse({ ...options, native: { ...native, curveDisplay: undefined } });
  const forged = structuredClone(cad); forged.bodyBindings[0].assetId = 'asset_b';
  assert.throws(() => exportBaroCadDocumentDisplayGlb(forged, options));
  const profile = structuredClone(cad); profile.document.profile = 'other';
  assert.throws(() => exportBaroCadDocumentDisplayGlb(profile, options));
  const getter = structuredClone(cad);
  let getterReads = 0;
  Object.defineProperty(getter.document.assets[0], 'source', { enumerable: true,
    get() { getterReads++; return source; } });
  assert.throws(() => exportBaroCadDocumentDisplayGlb(getter, options));
  assert.equal(getterReads, 0);
  assert.deepEqual(Buffer.from(glb), originalBytes);
  assert.deepEqual(cad, before);
  assert.ok(Object.is(cad.compiledAssets[0].model.objects[0].controlPoints[0][1], -0));
  assert.ok(cad.document.assets.every(asset => asset.source === source));
  const oldSource = readFileSync(new URL('two-surfaces.barocad', import.meta.url), 'utf8');
  const oldGlb = baroCadSourceToGLB(oldSource, { ...native,
    curveDisplay: { chordToleranceMM: 0.1, maxSegments: 128, maxDepth: 16 } },
  { includeSourceText: false });
  const oldHash = createHash('sha256').update(Buffer.from(oldGlb)).digest('hex');
  assert.equal(oldHash, '61a4cd623dc6080a81c110835356d7b6841d7feac4383d0beb0b17ecbbe90604');
  console.log(JSON.stringify({ documentBytes: Buffer.byteLength(file), glbBytes: glb.byteLength,
    mappings: report.mappings.map(value => [value.bodyId, value.gltfNodeIndex, value.primitiveMode]),
    importedLines: 2, importedSurfaces: 2, unselectedOmitted: report.unselectedBodyIds.length,
    originalSignedZero: true, originalSourceRetained: true, atomicRefusal: true, oldGlbHash: oldHash }));
} finally {
  server.closeAllConnections(); server.close(); await once(server, 'close');
}
