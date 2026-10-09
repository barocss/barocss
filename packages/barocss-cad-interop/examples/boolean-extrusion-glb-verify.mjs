import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { validateCoplanarFaceBooleanExtrusionMesh } from '@barocss/cad';
import { exportBaroCadBooleanExtrusionDisplayGlb } from '@barocss/cad-interop/boolean-extrusion-glb';
import { baroCadSourceToGLB } from '@barocss/cad-interop/native';

const sourceFlag = process.argv.indexOf('--source'), outputFlag = process.argv.indexOf('--output');
if (sourceFlag < 0 || outputFlag < 0 || !process.argv[sourceFlag + 1] || !process.argv[outputFlag + 1]) {
  throw new Error('Usage: node boolean-extrusion-glb-verify.mjs --source <saved #896 dir> --output <output dir>');
}
const source = process.argv[sourceFlag + 1], output = process.argv[outputFlag + 1];
mkdirSync(output, { recursive: true });
const fixtures = [
  ['containment_hole', 583468, '8726a4dd003781b7e00a29153fb731ed9f173af8ccf2b0c8920f6152a8aec566', 1, 10, 24, 32],
  ['strip_two_components', 743890, '455050aab11187da1ac21db40f7654f1eb9b7372ee70f2c0d9b530699239a735', 2, 12, 24, 24],
  ['reverse_containment_empty', 84994, '560ac9eff0c24a4a788d5785375e66d0dbf3a2465b8ce447d595ab3428216ea9', 0, 0, 0, 0],
  ['cross_union', 639571, '982a8a2efd0a7ade34d52c4910b9bc0734f7e235fd77c66de48887a17a17557b', 1, 10, 24, 28],
  ['cross_union_distance_edit', 641081, '1c14945aefed0d0a653083dd464e0530cd4583c7d62ffbe974ee6fcebfd29742', 1, 10, 24, 28],
];
const options = { unitsPerMillimeter: 0.001, basis: 'authored-xyz-matches-rhyup' };
const accepted = new Map(), observations = [];
let checkedPositions = 0, checkedNormals = 0, checkedUV = 0, checkedCurvePoints = 0;
for (const [name, size, sha256, shellCount, faceCount, edgeCount, triangleCount] of fixtures) {
  const bytes = readFileSync(join(source, `${name}.owned-extrusion-mesh.json`));
  assert.equal(bytes.length, size, name);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), sha256, name);
  const native = JSON.parse(bytes);
  assert.deepEqual(validateCoplanarFaceBooleanExtrusionMesh(native), native.report);
  const before = structuredClone(native);
  const { glb, report } = exportBaroCadBooleanExtrusionDisplayGlb(native, options);
  assert.equal(report.schema, 'barocad-boolean-extrusion-display-glb-report');
  assert.equal(report.shellCount, shellCount);
  assert.equal(report.faceCount, faceCount);
  assert.equal(report.trueEdgeCount, edgeCount);
  assert.equal(report.triangleCount, triangleCount);
  assert.equal(report.outputBytes, glb.byteLength);
  assert.ok(glb.byteLength <= 1048576);
  const view = new DataView(glb);
  assert.equal(view.getUint32(0, true), 0x46546c67);
  assert.equal(view.getUint32(4, true), 2);
  assert.equal(view.getUint32(8, true), glb.byteLength);
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(glb, 20, jsonLength)));
  const binOffset = 20 + jsonLength + 8;
  assert.equal(json.asset.extras.barocss.format, 'barocad-boolean-extrusion-display-glb');
  assert.equal(json.asset.extras.barocss.outputRole, 'derived-display-shells-and-true-curve-samples');
  assert.equal(json.nodes.length, shellCount + edgeCount);
  assert.equal(json.meshes.length, shellCount + edgeCount);
  assert.equal(json.scenes[0].nodes.length, shellCount + edgeCount);
  const readFloat = accessorId => {
    const accessor = json.accessors[accessorId], bufferView = json.bufferViews[accessor.bufferView];
    assert.equal(accessor.componentType, 5126);
    const length = accessor.count * (accessor.type === 'VEC3' ? 3 : 2);
    return Array.from({ length }, (_, index) =>
      view.getFloat32(binOffset + bufferView.byteOffset + index * 4, true));
  };
  const readIndices = accessorId => {
    const accessor = json.accessors[accessorId], bufferView = json.bufferViews[accessor.bufferView];
    assert.equal(accessor.componentType, 5123);
    return Array.from({ length: accessor.count }, (_, index) =>
      view.getUint16(binOffset + bufferView.byteOffset + index * 2, true));
  };
  for (const mapping of report.shells) {
    const node = json.nodes[mapping.gltfNodeIndex];
    assert.equal(node.name, mapping.derivedNodeName);
    assert.equal(node.extras.barocss.shellId, mapping.shellId);
    assert.equal(node.extras.barocss.meshId, native.mesh.id);
    assert.equal(node.extras.barocss.extrusionEvaluationId, native.mesh.binding.extrusionEvaluationId);
    assert.equal(node.extras.barocss.booleanEvaluationId, native.mesh.binding.booleanEvaluationId);
    assert.deepEqual(node.extras.barocss.sourceAssetIds, native.mesh.binding.sourceAssetIds);
    assert.deepEqual(node.extras.barocss.faces.map(face => face.faceId), mapping.faceIds);
    assert.deepEqual(node.extras.barocss.faces.flatMap(face => face.triangleIds), mapping.triangleIds);
    assert.deepEqual(node.extras.barocss.faces.flatMap(face => face.internalEdges.map(edge => edge.id)), mapping.internalEdgeIds);
    const nativeShell = native.shellRanges.find(shell => shell.shellId === mapping.shellId);
    assert.deepEqual(mapping.trueEdgeIds, nativeShell.edgePathIndices.map(index => native.edgePaths[index].edgeId));
    const primitive = json.meshes[node.mesh].primitives[0];
    assert.equal(primitive.mode, 4);
    assert.equal(primitive.attributes.TEXCOORD_0, undefined);
    const positions = readFloat(primitive.attributes.POSITION);
    const normals = readFloat(primitive.attributes.NORMAL);
    const uv = readFloat(primitive.attributes._CAD_UV);
    const expectedIndices = nativeShell.faceRangeIndices.flatMap(index => {
      const face = native.faceRanges[index];
      return native.mesh.indices.slice(face.indexStart, face.indexStart + face.indexCount);
    });
    assert.deepEqual(readIndices(primitive.indices), expectedIndices);
    for (let index = 0; index < positions.length; index++) {
      assert.ok(Object.is(positions[index], Math.fround(native.mesh.positionsMM[index] * 0.001)));
      assert.ok(Object.is(normals[index], Math.fround(native.mesh.normals[index])));
      checkedPositions++; checkedNormals++;
    }
    for (let index = 0; index < uv.length; index++) {
      assert.ok(Object.is(uv[index], Math.fround(native.mesh.parametersUV[index])));
      checkedUV++;
    }
  }
  for (const mapping of report.edges) {
    const node = json.nodes[mapping.gltfNodeIndex];
    assert.equal(node.name, mapping.derivedNodeName);
    assert.equal(node.extras.barocss.kind, 'native-true-curve-sample-display');
    assert.equal(node.extras.barocss.edgeId, mapping.edgeId);
    assert.equal(node.extras.barocss.shellId, mapping.shellId);
    assert.equal(node.extras.barocss.curveId, mapping.curveId);
    const nativePath = native.edgePaths.find(path => path.edgeId === mapping.edgeId);
    assert.deepEqual(mapping.source, nativePath.source);
    assert.deepEqual(mapping.adjacentFaceIds, nativePath.adjacentFaces.map(face => face.faceId));
    assert.ok(!native.faceRanges.some(face => face.internalEdges.some(edge => edge.id === mapping.edgeId)));
    const primitive = json.meshes[node.mesh].primitives[0];
    assert.equal(primitive.mode, 3);
    assert.deepEqual(readIndices(primitive.indices), [0, 1, 2]);
    const points = readFloat(primitive.attributes.POSITION);
    const expected = nativePath.samples.flatMap(sample => sample.curveD1.point);
    assert.equal(points.length, expected.length);
    for (let index = 0; index < points.length; index++) {
      assert.ok(Object.is(points[index], Math.fround(expected[index] * 0.001)));
      checkedCurvePoints++;
    }
  }
  assert.deepEqual(native, before);
  const filename = `${name}.display.glb`;
  writeFileSync(join(output, filename), Buffer.from(glb));
  accepted.set(name, { native, glb, report, filename });
  observations.push({ name, inputBytes: size, inputSha256: sha256, glbBytes: glb.byteLength,
    glbSha256: createHash('sha256').update(Buffer.from(glb)).digest('hex'),
    shellCount, faceCount, edgeCount, triangleCount });
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
  for (const [name, , , shells, , edges] of fixtures) {
    const { filename, report } = accepted.get(name);
    const loaded = await new GLTFLoader().loadAsync(`http://127.0.0.1:${server.address().port}/${filename}`);
    const meshObjects = [], lineObjects = [];
    loaded.scene.traverse(object => { if (object.isMesh) meshObjects.push(object); if (object.isLine) lineObjects.push(object); });
    assert.equal(meshObjects.length, shells, name);
    assert.equal(lineObjects.length, edges, name);
    assert.deepEqual(meshObjects.map(object => object.userData.barocss.shellId),
      report.shells.map(mapping => mapping.shellId));
    assert.deepEqual(lineObjects.map(object => object.userData.barocss.edgeId),
      report.edges.map(mapping => mapping.edgeId));
    assert.ok(meshObjects.every(object => object.geometry.getAttribute('uv') === undefined));
  }
} finally { server.closeAllConnections(); server.close(); await once(server, 'close'); }

const hole = accepted.get('containment_hole');
const acceptedBytes = Buffer.from(hole.glb);
let refused = 0;
const refuse = action => { assert.throws(action); refused++; };
const forged = structuredClone(hole.native); forged.mesh.positionsMM[0] += 1;
refuse(() => exportBaroCadBooleanExtrusionDisplayGlb(forged, options));
refuse(() => exportBaroCadBooleanExtrusionDisplayGlb(hole.native, { ...options, basis: 'unknown' }));
refuse(() => exportBaroCadBooleanExtrusionDisplayGlb(hole.native, { ...options, unitsPerMillimeter: 0.01 }));
const hidden = { ...options }; Object.defineProperty(hidden, 'hidden', { value: 1 });
refuse(() => exportBaroCadBooleanExtrusionDisplayGlb(hole.native, hidden));
let getterCalls = 0;
const getter = { ...options };
Object.defineProperty(getter, 'basis', { enumerable: true, get() { getterCalls++; return options.basis; } });
refuse(() => exportBaroCadBooleanExtrusionDisplayGlb(hole.native, getter));
assert.equal(getterCalls, 0);
assert.deepEqual(Buffer.from(hole.glb), acceptedBytes);
const oldSource = readFileSync(new URL('./two-surfaces.barocad', import.meta.url), 'utf8');
const oldGlb = baroCadSourceToGLB(oldSource, {
  sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
  curveDisplay: { chordToleranceMM: 0.1, maxSegments: 128, maxDepth: 16 },
}, { includeSourceText: false });
const oldGlbHash = createHash('sha256').update(Buffer.from(oldGlb)).digest('hex');
assert.equal(oldGlbHash, '61a4cd623dc6080a81c110835356d7b6841d7feac4383d0beb0b17ecbbe90604');
console.log(JSON.stringify({ fixtures: observations, checkedPositions, checkedNormals, checkedUV,
  checkedCurvePoints, importedShells: fixtures.map(value => value[3]),
  importedTrueEdges: fixtures.map(value => value[5]), refused, oldGlbHash,
  outputDirectory: output, originalInputUnchanged: true }));
