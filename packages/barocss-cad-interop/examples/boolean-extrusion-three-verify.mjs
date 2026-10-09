import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateCoplanarFaceBooleanExtrusionMesh } from '@barocss/cad';
import { BufferGeometry, Group, Line, Mesh, MeshNormalMaterial, Scene } from 'three';
import { createBaroCadBooleanExtrusionThreeMesh } from '@barocss/cad-interop/three-boolean-extrusion-mesh';

const sourceFlag = process.argv.indexOf('--source');
if (sourceFlag < 0 || !process.argv[sourceFlag + 1]) {
  throw new Error('Usage: node boolean-extrusion-three-verify.mjs --source <saved #896 directory>');
}
const source = process.argv[sourceFlag + 1];
const fixtures = [
  ['containment_hole', 583468, '8726a4dd003781b7e00a29153fb731ed9f173af8ccf2b0c8920f6152a8aec566', 1, 10, 24, 32],
  ['strip_two_components', 743890, '455050aab11187da1ac21db40f7654f1eb9b7372ee70f2c0d9b530699239a735', 2, 12, 24, 24],
  ['reverse_containment_empty', 84994, '560ac9eff0c24a4a788d5785375e66d0dbf3a2465b8ce447d595ab3428216ea9', 0, 0, 0, 0],
  ['cross_union', 639571, '982a8a2efd0a7ade34d52c4910b9bc0734f7e235fd77c66de48887a17a17557b', 1, 10, 24, 28],
  ['cross_union_distance_edit', 641081, '1c14945aefed0d0a653083dd464e0530cd4583c7d62ffbe974ee6fcebfd29742', 1, 10, 24, 28],
];
const options = { unitsPerMillimeter: 0.001, basis: 'authored-xyz-matches-rhyup' };
const read = ([name, bytes, hash]) => {
  const body = readFileSync(join(source, `${name}.owned-extrusion-mesh.json`));
  assert.equal(body.length, bytes, name);
  assert.equal(createHash('sha256').update(body).digest('hex'), hash, name);
  const native = JSON.parse(body);
  assert.deepEqual(validateCoplanarFaceBooleanExtrusionMesh(native), native.report);
  return native;
};
const native = fixtures.map(read);
let checkedPositions = 0, checkedNormals = 0, checkedUV = 0, checkedEdgeCoordinates = 0;
for (const [index, result] of native.entries()) {
  const [name, , , shellCount, faceCount, edgeCount, triangleCount] = fixtures[index];
  const before = structuredClone(result);
  const scene = new Scene();
  const caller = new Group(); scene.add(caller);
  const display = createBaroCadBooleanExtrusionThreeMesh(result, options);
  scene.add(display.root, display.edgeRoot);
  assert.equal(display.shells.length, shellCount, name);
  assert.equal(display.faces.length, faceCount, name);
  assert.equal(display.edges.length, edgeCount, name);
  assert.equal(display.root.children.length, shellCount, name);
  assert.equal(display.edgeRoot.children.length, shellCount, name);
  assert.equal(display.faces.reduce((total, binding) => total + binding.face.triangleCount, 0), triangleCount);
  assert.equal(display.internalEdges.length, result.report.internalEdgeCount);
  assert.deepEqual(display.shells.map(binding => binding.shellId), result.shellRanges.map(shell => shell.shellId));
  for (const binding of display.faces) {
    assert.ok(binding.object instanceof Mesh && binding.object.parent instanceof Group);
    assert.equal(binding.meshId, result.mesh.id);
    assert.deepEqual(binding.sourceAssetIds, result.mesh.binding.sourceAssetIds);
    assert.equal(binding.face.source.objectId, binding.face.surfaceId);
    const expected = result.faceRanges.find(face => face.faceId === binding.face.faceId);
    assert.deepEqual(binding.face, expected);
    const geometry = binding.object.geometry;
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const uv = geometry.getAttribute('_CAD_UV');
    assert.equal(geometry.getAttribute('uv'), undefined);
    assert.deepEqual([...geometry.index.array], result.mesh.indices.slice(expected.indexStart, expected.indexStart + expected.indexCount));
    for (let i = 0; i < result.mesh.positionsMM.length; i++) {
      assert.ok(Object.is(position.array[i], Math.fround(result.mesh.positionsMM[i] * 0.001)));
      assert.ok(Object.is(normal.array[i], Math.fround(result.mesh.normals[i])));
      checkedPositions++; checkedNormals++;
    }
    for (let i = 0; i < result.mesh.parametersUV.length; i++) {
      assert.ok(Object.is(uv.array[i], Math.fround(result.mesh.parametersUV[i])));
      checkedUV++;
    }
  }
  for (const binding of display.edges) {
    assert.ok(binding.object instanceof Line && binding.object.parent instanceof Group);
    assert.ok(!display.internalEdges.some(edge => edge.id === binding.path.edgeId));
    const expected = result.edgePaths.find(path => path.edgeId === binding.path.edgeId);
    assert.deepEqual(binding.path, expected);
    const coordinates = binding.object.geometry.getAttribute('position').array;
    const sourceCoordinates = expected.samples.flatMap(sample => sample.curveD1.point);
    assert.equal(coordinates.length, sourceCoordinates.length);
    for (let i = 0; i < coordinates.length; i++) {
      assert.ok(Object.is(coordinates[i], Math.fround(sourceCoordinates[i] * 0.001)));
      checkedEdgeCoordinates++;
    }
  }
  const disposed = [];
  for (const binding of [...display.faces, ...display.edges]) {
    binding.object.geometry.addEventListener('dispose', () => disposed.push('geometry'));
    binding.object.material.addEventListener('dispose', () => disposed.push('material'));
  }
  display.dispose(); display.dispose();
  assert.equal(disposed.length, 2 * (faceCount + edgeCount));
  assert.ok(!scene.children.includes(display.root) && !scene.children.includes(display.edgeRoot));
  assert.ok(scene.children.includes(caller));
  assert.deepEqual(result, before);
}
const base = native[3], edited = native[4];
assert.deepEqual(base.extrusion.region, edited.extrusion.region);
assert.notDeepEqual(base.mesh.positionsMM, edited.mesh.positionsMM);
const accepted = createBaroCadBooleanExtrusionThreeMesh(native[0], options);
let refused = 0;
const refuse = action => { assert.throws(action); refused++; };
const forged = structuredClone(native[0]); forged.mesh.positionsMM[0] += 1;
refuse(() => createBaroCadBooleanExtrusionThreeMesh(forged, options));
refuse(() => createBaroCadBooleanExtrusionThreeMesh(native[0], { ...options, basis: 'unknown' }));
refuse(() => createBaroCadBooleanExtrusionThreeMesh(native[0], { ...options, unitsPerMillimeter: 0 }));
const hidden = { ...options }; Object.defineProperty(hidden, 'hidden', { value: 1 });
refuse(() => createBaroCadBooleanExtrusionThreeMesh(native[0], hidden));
let getterCalls = 0;
const getter = { ...options };
Object.defineProperty(getter, 'basis', { enumerable: true, get() { getterCalls++; return options.basis; } });
refuse(() => createBaroCadBooleanExtrusionThreeMesh(native[0], getter));
assert.equal(getterCalls, 0);
let setIndexCalls = 0, stagedGeometriesDisposed = 0, stagedMaterialsDisposed = 0;
const originalSetIndex = BufferGeometry.prototype.setIndex;
const originalMaterialDispose = MeshNormalMaterial.prototype.dispose;
try {
  BufferGeometry.prototype.setIndex = function (indices) {
    this.addEventListener('dispose', () => stagedGeometriesDisposed++);
    if (++setIndexCalls === 2) throw new Error('injected later face failure');
    return originalSetIndex.call(this, indices);
  };
  MeshNormalMaterial.prototype.dispose = function () {
    stagedMaterialsDisposed++;
    return originalMaterialDispose.call(this);
  };
  refuse(() => createBaroCadBooleanExtrusionThreeMesh(native[0], options));
} finally {
  BufferGeometry.prototype.setIndex = originalSetIndex;
  MeshNormalMaterial.prototype.dispose = originalMaterialDispose;
}
assert.equal(setIndexCalls, 2);
assert.equal(stagedGeometriesDisposed, 2);
assert.equal(stagedMaterialsDisposed, 1);
assert.ok(accepted.faces.every(binding => binding.object.geometry.getAttribute('position')));
accepted.dispose();
console.log(JSON.stringify({ fixtures: fixtures.map(value => value[0]),
  shells: fixtures.map(value => value[3]), faces: fixtures.map(value => value[4]),
  edges: fixtures.map(value => value[5]), triangles: fixtures.map(value => value[6]),
  checkedPositions, checkedNormals, checkedUV, checkedEdgeCoordinates, refused,
  stagedGeometriesDisposed, stagedMaterialsDisposed, distanceEditChangedPositions: true,
  callerSceneRetained: true }));
