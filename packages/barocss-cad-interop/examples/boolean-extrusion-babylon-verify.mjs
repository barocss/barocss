import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { LinesMesh } from '@babylonjs/core/Meshes/linesMesh.js';
import { Scene } from '@babylonjs/core/scene.js';
import { validateCoplanarFaceBooleanExtrusionMesh } from '@barocss/cad';
import { createBaroCadBooleanExtrusionBabylonMesh } from '@barocss/cad-interop/babylon-boolean-extrusion-mesh';

const sourceFlag = process.argv.indexOf('--source');
if (sourceFlag < 0 || !process.argv[sourceFlag + 1]) {
  throw new Error('Usage: node boolean-extrusion-babylon-verify.mjs --source <saved #896 directory>');
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
const read = ([name, size, hash]) => {
  const bytes = readFileSync(join(source, `${name}.owned-extrusion-mesh.json`));
  assert.equal(bytes.length, size, name);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), hash, name);
  const native = JSON.parse(bytes);
  assert.deepEqual(validateCoplanarFaceBooleanExtrusionMesh(native), native.report);
  return native;
};
const native = fixtures.map(read);
const engine = new NullEngine(), scene = new Scene(engine);
scene.useRightHandedSystem = true;
const caller = new Mesh('caller-owned', scene);
let checkedPositions = 0, checkedNormals = 0, checkedUV = 0, checkedEdgeCoordinates = 0;
for (const [index, result] of native.entries()) {
  const [name, , , shellCount, faceCount, edgeCount, triangleCount] = fixtures[index];
  const before = structuredClone(result);
  const display = createBaroCadBooleanExtrusionBabylonMesh(scene, result, options);
  assert.equal(display.shells.length, shellCount, name);
  assert.equal(display.faces.length, faceCount, name);
  assert.equal(display.edges.length, edgeCount, name);
  assert.equal(display.root.getChildMeshes().length, faceCount, name);
  assert.equal(display.edgeRoot.getChildMeshes().length, edgeCount, name);
  assert.equal(display.edgeRoot.isEnabled(), false);
  display.edgeRoot.setEnabled(true);
  assert.equal(display.edgeRoot.isEnabled(), true);
  display.edgeRoot.setEnabled(false);
  assert.equal(display.internalEdges.length, result.report.internalEdgeCount);
  assert.equal(display.faces.reduce((sum, binding) => sum + binding.face.triangleCount, 0), triangleCount);
  assert.deepEqual(display.shells.map(binding => binding.shellId), result.shellRanges.map(shell => shell.shellId));
  for (const binding of display.faces) {
    assert.ok(binding.object instanceof Mesh && !(binding.object instanceof LinesMesh));
    assert.equal(binding.meshId, result.mesh.id);
    assert.deepEqual(binding.sourceAssetIds, result.mesh.binding.sourceAssetIds);
    const face = result.faceRanges.find(value => value.faceId === binding.face.faceId);
    assert.deepEqual(binding.face, face);
    const object = binding.object;
    assert.equal(object.getVerticesData('uv'), null);
    const positions = object.getVerticesData('position');
    const normals = object.getVerticesData('normal');
    const uv = object.getVerticesData('_CAD_UV');
    assert.deepEqual([...object.getIndices()], result.mesh.indices.slice(face.indexStart, face.indexStart + face.indexCount));
    for (let i = 0; i < positions.length; i++) {
      assert.ok(Object.is(positions[i], Math.fround(result.mesh.positionsMM[i] * 0.001)));
      assert.ok(Object.is(normals[i], Math.fround(result.mesh.normals[i])));
      checkedPositions++; checkedNormals++;
    }
    for (let i = 0; i < uv.length; i++) {
      assert.ok(Object.is(uv[i], Math.fround(result.mesh.parametersUV[i])));
      checkedUV++;
    }
  }
  for (const binding of display.edges) {
    assert.ok(binding.object instanceof LinesMesh);
    assert.ok(!display.internalEdges.some(edge => edge.id === binding.path.edgeId));
    const path = result.edgePaths.find(value => value.edgeId === binding.path.edgeId);
    assert.deepEqual(binding.path, path);
    const positions = binding.object.getVerticesData('position');
    const expected = path.samples.flatMap(sample => sample.curveD1.point);
    assert.equal(positions.length, expected.length);
    for (let i = 0; i < positions.length; i++) {
      assert.ok(Object.is(positions[i], Math.fround(expected[i] * 0.001)));
      checkedEdgeCoordinates++;
    }
  }
  const disposed = [];
  for (const binding of display.faces) {
    binding.object.onDisposeObservable.add(() => disposed.push('face'));
    binding.object.material.onDisposeObservable.add(() => disposed.push('material'));
  }
  for (const binding of display.edges) binding.object.onDisposeObservable.add(() => disposed.push('edge'));
  display.dispose(); display.dispose();
  assert.equal(disposed.length, 2 * faceCount + edgeCount);
  assert.ok(display.root.isDisposed() && display.edgeRoot.isDisposed());
  assert.ok(!caller.isDisposed() && scene.meshes.includes(caller));
  assert.deepEqual(result, before);
}
assert.deepEqual(native[3].extrusion.region, native[4].extrusion.region);
assert.notDeepEqual(native[3].mesh.positionsMM, native[4].mesh.positionsMM);
const accepted = createBaroCadBooleanExtrusionBabylonMesh(scene, native[0], options);
let refused = 0;
const refuse = action => { assert.throws(action); refused++; };
const forged = structuredClone(native[0]); forged.mesh.positionsMM[0] += 1;
refuse(() => createBaroCadBooleanExtrusionBabylonMesh(scene, forged, options));
refuse(() => createBaroCadBooleanExtrusionBabylonMesh(scene, native[0], { ...options, basis: 'unknown' }));
refuse(() => createBaroCadBooleanExtrusionBabylonMesh(scene, native[0], { ...options, unitsPerMillimeter: 0 }));
const hidden = { ...options }; Object.defineProperty(hidden, 'hidden', { value: 1 });
refuse(() => createBaroCadBooleanExtrusionBabylonMesh(scene, native[0], hidden));
scene.useRightHandedSystem = false;
refuse(() => createBaroCadBooleanExtrusionBabylonMesh(scene, native[0], options));
scene.useRightHandedSystem = true;
let getterCalls = 0;
const getter = { ...options };
Object.defineProperty(getter, 'basis', { enumerable: true, get() { getterCalls++; return options.basis; } });
refuse(() => createBaroCadBooleanExtrusionBabylonMesh(scene, native[0], getter));
assert.equal(getterCalls, 0);
const previousMeshes = new Set(scene.meshes), previousMaterials = new Set(scene.materials);
let setIndicesCalls = 0, stagedMeshesDisposed = 0;
const originalSetIndices = Mesh.prototype.setIndices;
try {
  Mesh.prototype.setIndices = function (indices, ...rest) {
    this.onDisposeObservable.add(() => stagedMeshesDisposed++);
    if (++setIndicesCalls === 2) throw new Error('injected later-face failure');
    return originalSetIndices.call(this, indices, ...rest);
  };
  refuse(() => createBaroCadBooleanExtrusionBabylonMesh(scene, native[0], options));
} finally { Mesh.prototype.setIndices = originalSetIndices; }
assert.equal(setIndicesCalls, 2);
assert.equal(stagedMeshesDisposed, 2);
assert.deepEqual(new Set(scene.meshes), previousMeshes);
assert.deepEqual(new Set(scene.materials), previousMaterials);
assert.ok(accepted.faces.every(binding => !binding.object.isDisposed()));
accepted.dispose();
assert.ok(!caller.isDisposed() && scene.meshes.includes(caller) && !scene.isDisposed);
console.log(JSON.stringify({ fixtures: fixtures.map(value => value[0]),
  shells: fixtures.map(value => value[3]), faces: fixtures.map(value => value[4]),
  edges: fixtures.map(value => value[5]), triangles: fixtures.map(value => value[6]),
  checkedPositions, checkedNormals, checkedUV, checkedEdgeCoordinates, refused,
  stagedMeshesDisposed, distanceEditChangedPositions: true, callerSceneRetained: true }));
scene.dispose(); engine.dispose();
