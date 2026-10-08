import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { Scene } from '@babylonjs/core/scene.js';
import { validateCoplanarFaceBooleanMesh } from '@barocss/cad';
import { createBaroCadBooleanBabylonMesh } from '@barocss/cad-interop/babylon-boolean-mesh';

const fixtures = [
  ['containment_hole', 142480, 'd9b7622837d58ef65171ef77b7a723702a25e40f102450b41ac8062bd26e8515', 1, 8, 1],
  ['strip_two_components', 213903, '6ec8ddcdea3f95f570f00d40e926d832407cd7a547c7c1a2a501c5304fa002ad', 2, 4, 0],
  ['reverse_containment_empty', 41292, '44e3ccd0787eed7a01d05b157783d3fa61b02b3f8f0ea00814c1fd4b97405ad8', 0, 0, 0],
];
const options = { unitsPerMillimeter: 0.01, basis: 'authored-xyz-matches-rhyup' };
const read = ([name, size, hash]) => {
  const bytes = readFileSync(new URL(`./boolean-mesh-three-data/${name}.owned-mesh.json`, import.meta.url));
  assert.equal(bytes.length, size);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), hash);
  const result = JSON.parse(bytes.toString('utf8'));
  assert.deepEqual(validateCoplanarFaceBooleanMesh(result), result.report);
  return result;
};
const native = fixtures.map(read);
const engine = new NullEngine();
const scene = new Scene(engine);
scene.useRightHandedSystem = true;
const caller = new Mesh('caller-owned', scene);
let checkedPositions = 0, checkedNormals = 0, checkedUV = 0;
for (const [index, result] of native.entries()) {
  const [name, , , components, triangles, bridges] = fixtures[index];
  const before = structuredClone(result);
  const display = createBaroCadBooleanBabylonMesh(scene, result, options);
  assert.equal(display.bindings.length, components, name);
  assert.equal(display.root.getChildMeshes().length, components, name);
  assert.equal(display.boundaryPaths.length, result.report.boundaryCount);
  assert.equal(display.internalEdges.length, result.report.internalEdgeCount);
  assert.equal(display.bridges.length, bridges);
  assert.ok(display.internalEdges.every(edge => edge.kind.startsWith('display-internal-')));
  assert.ok(display.boundaryPaths.every(path => !display.internalEdges.some(edge => edge.id === path.fragmentId)));
  let drawnTriangles = 0;
  for (const binding of display.bindings) {
    assert.ok(binding.object instanceof Mesh && binding.object.parent === display.root);
    assert.equal(binding.meshId, result.mesh.id);
    assert.equal(binding.evaluationId, result.mesh.binding.evaluationId);
    assert.equal(binding.supportId, result.mesh.binding.supportId);
    assert.deepEqual(binding.sourceAssetIds, result.mesh.binding.sourceAssetIds);
    assert.deepEqual(binding.operands, { a: result.mesh.binding.a, b: result.mesh.binding.b });
    const component = result.triangulation.components.find(value => value.componentId === binding.componentId);
    assert.ok(component);
    assert.equal(binding.outerLoopId, component.outerLoopId);
    assert.deepEqual(binding.holeLoopIds, component.holeLoopIds);
    assert.deepEqual(binding.triangleIds, component.triangleIds);
    assert.deepEqual(binding.vertexIndices, component.vertexIndices);
    assert.equal(binding.object.getVerticesData('uv'), null);
    const positions = binding.object.getVerticesData('position');
    const normals = binding.object.getVerticesData('normal');
    const uv = binding.object.getVerticesData('_CAD_UV');
    assert.equal(positions.length, result.mesh.positionsMM.length);
    assert.equal(normals.length, result.mesh.normals.length);
    assert.equal(uv.length, result.mesh.parametersUV.length);
    for (let i = 0; i < positions.length; i++) {
      assert.ok(Object.is(positions[i], Math.fround(result.mesh.positionsMM[i] * options.unitsPerMillimeter)));
      assert.ok(Object.is(normals[i], Math.fround(result.mesh.normals[i])));
      checkedPositions++; checkedNormals++;
    }
    for (let i = 0; i < uv.length; i++) {
      assert.ok(Object.is(uv[i], Math.fround(result.mesh.parametersUV[i])));
      checkedUV++;
    }
    const expectedIndices = component.triangleIds.flatMap(id =>
      result.triangulation.triangles.find(triangle => triangle.id === id).vertexIndices);
    assert.deepEqual([...binding.object.getIndices()], expectedIndices);
    assert.deepEqual(binding.boundaryPathIds, result.boundaryPaths.filter(path =>
      path.componentId === component.componentId).map(path => path.fragmentId));
    assert.deepEqual(binding.internalEdgeIds, result.triangulation.internalEdges.filter(edge =>
      edge.componentId === component.componentId).map(edge => edge.id));
    drawnTriangles += expectedIndices.length / 3;
  }
  assert.equal(drawnTriangles, triangles);
  const disposed = [];
  for (const binding of display.bindings) {
    binding.object.onDisposeObservable.add(() => disposed.push('mesh'));
    binding.object.material.onDisposeObservable.add(() => disposed.push('material'));
  }
  display.dispose(); display.dispose();
  assert.equal(disposed.length, components * 2);
  assert.ok(display.root.isDisposed() && !caller.isDisposed() && scene.meshes.includes(caller));
  assert.ok(display.bindings.every(binding => !scene.meshes.includes(binding.object)));
  assert.deepEqual(result, before);
}

const accepted = createBaroCadBooleanBabylonMesh(scene, native[0], options);
let refused = 0;
const refuse = action => { assert.throws(action); refused++; };
const forged = structuredClone(native[0]); forged.mesh.positionsMM[0] += 1;
refuse(() => createBaroCadBooleanBabylonMesh(scene, forged, options));
refuse(() => createBaroCadBooleanBabylonMesh(scene, native[0], { ...options, basis: 'unknown' }));
refuse(() => createBaroCadBooleanBabylonMesh(scene, native[0], { ...options, unitsPerMillimeter: 0 }));
refuse(() => createBaroCadBooleanBabylonMesh(scene, native[0], { ...options, unitsPerMillimeter: 1e-50 }));
scene.useRightHandedSystem = false;
refuse(() => createBaroCadBooleanBabylonMesh(scene, native[0], options));
scene.useRightHandedSystem = true;
let getterCalls = 0;
const getter = { ...options };
Object.defineProperty(getter, 'basis', { enumerable: true, get() { getterCalls++; return options.basis; } });
refuse(() => createBaroCadBooleanBabylonMesh(scene, native[0], getter));
assert.equal(getterCalls, 0);

const previousMeshes = new Set(scene.meshes);
const previousMaterials = new Set(scene.materials);
let setIndicesCalls = 0, stagedMeshesDisposed = 0;
const originalSetIndices = Mesh.prototype.setIndices;
try {
  Mesh.prototype.setIndices = function (indices, ...rest) {
    this.onDisposeObservable.add(() => stagedMeshesDisposed++);
    if (++setIndicesCalls === 2) throw new Error('injected later-component failure');
    return originalSetIndices.call(this, indices, ...rest);
  };
  refuse(() => createBaroCadBooleanBabylonMesh(scene, native[1], options));
} finally { Mesh.prototype.setIndices = originalSetIndices; }
assert.equal(setIndicesCalls, 2);
assert.equal(stagedMeshesDisposed, 2);
assert.deepEqual(new Set(scene.meshes), previousMeshes);
assert.deepEqual(new Set(scene.materials), previousMaterials);
assert.ok(accepted.bindings.every(binding => !binding.object.isDisposed()));
accepted.dispose();
assert.ok(!caller.isDisposed() && scene.meshes.includes(caller) && !scene.isDisposed);
console.log(JSON.stringify({ fixtures: fixtures.map(value => value[0]),
  componentCounts: fixtures.map(value => value[3]), triangleCounts: fixtures.map(value => value[4]),
  checkedPositions, checkedNormals, checkedUV, refused, stagedMeshesDisposed,
  emptyAccepted: true, callerSceneRetained: true }));
scene.dispose(); engine.dispose();
