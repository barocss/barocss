import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { validateCoplanarFaceBooleanMesh } from '@barocss/cad';
import { exportBaroCadBooleanDisplayGlb } from '@barocss/cad-interop/boolean-mesh-glb';
import { baroCadSourceToGLB } from '@barocss/cad-interop/native';

const outputFlag = process.argv.indexOf('--output');
if (outputFlag < 0 || !process.argv[outputFlag + 1]) {
  throw new Error('Usage: node boolean-mesh-glb-verify.mjs --output /absolute/directory');
}
const output = process.argv[outputFlag + 1];
mkdirSync(output, { recursive: true });
const fixtures = [
  ['containment_hole', 142480, 'd9b7622837d58ef65171ef77b7a723702a25e40f102450b41ac8062bd26e8515', 1, 8],
  ['strip_two_components', 213903, '6ec8ddcdea3f95f570f00d40e926d832407cd7a547c7c1a2a501c5304fa002ad', 2, 4],
  ['reverse_containment_empty', 41292, '44e3ccd0787eed7a01d05b157783d3fa61b02b3f8f0ea00814c1fd4b97405ad8', 0, 0],
];
const options = { unitsPerMillimeter: 0.001, basis: 'authored-xyz-matches-rhyup' };
const accepted = new Map();
const observations = [];
let checkedPositions = 0, checkedNormals = 0, checkedUV = 0;
for (const [name, size, sha256, components, triangles] of fixtures) {
  const bytes = readFileSync(new URL(`./boolean-mesh-three-data/${name}.owned-mesh.json`, import.meta.url));
  assert.equal(bytes.length, size);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), sha256);
  const native = JSON.parse(bytes.toString('utf8'));
  assert.deepEqual(validateCoplanarFaceBooleanMesh(native), native.report);
  const before = structuredClone(native);
  const exported = exportBaroCadBooleanDisplayGlb(native, options);
  const glb = exported.glb;
  const report = exported.report;
  assert.equal(report.schema, 'barocad-boolean-mesh-display-glb-report');
  assert.equal(report.componentCount, components);
  assert.equal(report.triangleCount, triangles);
  assert.equal(report.outputBytes, glb.byteLength);
  assert.ok(glb.byteLength <= 1048576);
  assert.deepEqual(report.sourceAssetIds, native.mesh.binding.sourceAssetIds);
  assert.deepEqual(report.operands, { a: native.mesh.binding.a, b: native.mesh.binding.b });
  const view = new DataView(glb);
  assert.equal(view.getUint32(0, true), 0x46546c67);
  assert.equal(view.getUint32(4, true), 2);
  assert.equal(view.getUint32(8, true), glb.byteLength);
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(glb, 20, jsonLength)));
  const binOffset = 20 + jsonLength + 8;
  assert.equal(json.asset.extras.barocss.format, 'barocad-boolean-mesh-display-glb');
  assert.equal(json.asset.extras.barocss.outputRole, 'derived-display-mesh');
  assert.equal(json.nodes.length, components);
  assert.equal(json.meshes.length, components);
  assert.equal(json.scenes[0].nodes.length, components);
  const readFloat = accessorId => {
    const accessor = json.accessors[accessorId];
    const bufferView = json.bufferViews[accessor.bufferView];
    assert.equal(accessor.componentType, 5126);
    const length = accessor.count * (accessor.type === 'VEC3' ? 3 : 2);
    return Array.from({ length }, (_, index) =>
      view.getFloat32(binOffset + bufferView.byteOffset + index * 4, true));
  };
  const readIndices = accessorId => {
    const accessor = json.accessors[accessorId];
    const bufferView = json.bufferViews[accessor.bufferView];
    assert.equal(accessor.componentType, 5123);
    return Array.from({ length: accessor.count }, (_, index) =>
      view.getUint16(binOffset + bufferView.byteOffset + index * 2, true));
  };
  for (const mapping of report.mappings) {
    const node = json.nodes[mapping.gltfNodeIndex];
    assert.equal(node.name, mapping.derivedNodeName);
    assert.equal(node.extras.barocss.componentId, mapping.componentId);
    assert.equal(node.extras.barocss.meshId, native.mesh.id);
    assert.equal(node.extras.barocss.evaluationId, native.mesh.binding.evaluationId);
    assert.equal(node.extras.barocss.supportId, native.mesh.binding.supportId);
    assert.deepEqual(node.extras.barocss.operands, report.operands);
    assert.deepEqual(node.extras.barocss.sourceAssetIds, report.sourceAssetIds);
    assert.equal(node.extras.barocss.parameterMeaning, 'dimensionless-native-cad-uv-not-texture-uv');
    assert.deepEqual(node.extras.barocss.boundaryPaths.map(path => path.fragmentId), mapping.boundaryPathIds);
    assert.deepEqual(node.extras.barocss.internalEdges.map(edge => edge.id), mapping.internalEdgeIds);
    assert.deepEqual(node.extras.barocss.bridges.map(bridge => bridge.id), mapping.bridgeIds);
    const component = native.triangulation.components.find(value => value.componentId === mapping.componentId);
    assert.deepEqual(mapping.holeLoopIds, component.holeLoopIds);
    assert.deepEqual(mapping.triangleIds, component.triangleIds);
    assert.deepEqual(mapping.vertexIndices, component.vertexIndices);
    const primitive = json.meshes[node.mesh].primitives[0];
    assert.equal(primitive.mode, 4);
    assert.equal(primitive.attributes.TEXCOORD_0, undefined);
    assert.ok(Number.isInteger(primitive.attributes._CAD_UV));
    const positions = readFloat(primitive.attributes.POSITION);
    const normals = readFloat(primitive.attributes.NORMAL);
    const uv = readFloat(primitive.attributes._CAD_UV);
    assert.equal(positions.length, native.mesh.positionsMM.length);
    assert.equal(normals.length, native.mesh.normals.length);
    assert.equal(uv.length, native.mesh.parametersUV.length);
    for (let index = 0; index < positions.length; index++) {
      assert.ok(Object.is(positions[index], Math.fround(native.mesh.positionsMM[index] * 0.001)));
      assert.ok(Object.is(normals[index], Math.fround(native.mesh.normals[index])));
      checkedPositions++; checkedNormals++;
    }
    for (let index = 0; index < uv.length; index++) {
      assert.ok(Object.is(uv[index], Math.fround(native.mesh.parametersUV[index])));
      checkedUV++;
    }
    const expectedIndices = component.triangleIds.flatMap(id =>
      native.triangulation.triangles.find(triangle => triangle.id === id).vertexIndices);
    assert.deepEqual(readIndices(primitive.indices), expectedIndices);
  }
  assert.deepEqual(native, before);
  const filename = `${name}.display.glb`;
  writeFileSync(`${output}/${filename}`, Buffer.from(glb));
  accepted.set(name, { native, glb, report, filename });
  observations.push({ name, glbBytes: glb.byteLength,
    glbSha256: createHash('sha256').update(Buffer.from(glb)).digest('hex'),
    components, triangles, boundaryPaths: native.report.boundaryCount });
}

globalThis.ProgressEvent ??= class ProgressEvent {
  constructor(type, init) { this.type = type; Object.assign(this, init); }
};
const server = createServer((request, response) => {
  const name = request.url?.slice(1).replace('.display.glb', '');
  const entry = accepted.get(name);
  if (!entry || request.url !== `/${entry.filename}`) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'content-type': 'model/gltf-binary',
    'content-length': entry.glb.byteLength }).end(Buffer.from(entry.glb));
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
try {
  for (const [name, , , count] of fixtures) {
    const { filename, report } = accepted.get(name);
    const loaded = await new GLTFLoader().loadAsync(`http://127.0.0.1:${server.address().port}/${filename}`);
    const meshes = [];
    loaded.scene.traverse(object => { if (object.isMesh) meshes.push(object); });
    assert.equal(meshes.length, count);
    assert.deepEqual(meshes.map(mesh => mesh.userData.barocss.componentId),
      report.mappings.map(mapping => mapping.componentId));
    assert.ok(meshes.every(mesh => mesh.geometry.getAttribute('uv') === undefined));
  }
} finally { server.closeAllConnections(); server.close(); await once(server, 'close'); }

const acceptedHole = accepted.get('containment_hole');
const acceptedBytes = Buffer.from(acceptedHole.glb);
let refused = 0;
const refuse = action => { assert.throws(action); refused++; };
const forged = structuredClone(acceptedHole.native); forged.mesh.positionsMM[0] += 1;
refuse(() => exportBaroCadBooleanDisplayGlb(forged, options));
refuse(() => exportBaroCadBooleanDisplayGlb(acceptedHole.native, { ...options, basis: 'unknown' }));
refuse(() => exportBaroCadBooleanDisplayGlb(acceptedHole.native, { ...options, unitsPerMillimeter: 0.01 }));
let getterCalls = 0;
const getter = { ...options };
Object.defineProperty(getter, 'basis', { enumerable: true, get() { getterCalls++; return options.basis; } });
refuse(() => exportBaroCadBooleanDisplayGlb(acceptedHole.native, getter));
assert.equal(getterCalls, 0);
assert.deepEqual(Buffer.from(acceptedHole.glb), acceptedBytes);
const oldSource = readFileSync(new URL('./two-surfaces.barocad', import.meta.url), 'utf8');
const oldGlb = baroCadSourceToGLB(oldSource, {
  sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
  curveDisplay: { chordToleranceMM: 0.1, maxSegments: 128, maxDepth: 16 },
}, { includeSourceText: false });
const oldGlbHash = createHash('sha256').update(Buffer.from(oldGlb)).digest('hex');
assert.equal(oldGlbHash, '61a4cd623dc6080a81c110835356d7b6841d7feac4383d0beb0b17ecbbe90604');
console.log(JSON.stringify({ fixtures: observations, checkedPositions, checkedNormals, checkedUV,
  importedComponents: fixtures.map(value => value[3]), refused,
  oldGlbHash, outputDirectory: output, originalInputUnchanged: true }));
