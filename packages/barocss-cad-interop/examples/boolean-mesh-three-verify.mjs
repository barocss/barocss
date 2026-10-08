import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validateCoplanarFaceBooleanMesh } from '@barocss/cad';
import { BufferGeometry, Group, Mesh, MeshNormalMaterial, Scene } from 'three';
import { createBaroCadBooleanThreeMesh } from '@barocss/cad-interop/three-boolean-mesh';

const fixtures = [
  ['containment_hole', 142480, 'd9b7622837d58ef65171ef77b7a723702a25e40f102450b41ac8062bd26e8515', 1, 8, 1],
  ['strip_two_components', 213903, '6ec8ddcdea3f95f570f00d40e926d832407cd7a547c7c1a2a501c5304fa002ad', 2, 4, 0],
  ['reverse_containment_empty', 41292, '44e3ccd0787eed7a01d05b157783d3fa61b02b3f8f0ea00814c1fd4b97405ad8', 0, 0, 0],
];
const options = { unitsPerMillimeter: 0.01, basis: 'authored-xyz-matches-rhyup' };
const read = ([name, count, hash]) => {
  const bytes = readFileSync(new URL(`./boolean-mesh-three-data/${name}.owned-mesh.json`, import.meta.url));
  assert.equal(bytes.length, count);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), hash);
  const result = JSON.parse(bytes.toString('utf8'));
  assert.deepEqual(validateCoplanarFaceBooleanMesh(result), result.report);
  return result;
};
const native = fixtures.map(read);
let checkedPositions = 0, checkedNormals = 0, checkedUV = 0;
for (const [index, result] of native.entries()) {
  const [name, , , components, triangles, bridges] = fixtures[index];
  const before = structuredClone(result);
  const scene = new Scene();
  const caller = new Group(); caller.name = 'caller'; scene.add(caller);
  const display = createBaroCadBooleanThreeMesh(result, options);
  scene.add(display.root);
  assert.equal(display.bindings.length, components, name);
  assert.equal(display.root.children.length, components, name);
  assert.equal(display.boundaryPaths.length, result.report.boundaryCount);
  assert.equal(display.internalEdges.length, result.report.internalEdgeCount);
  assert.equal(display.bridges.length, bridges);
  assert.ok(display.internalEdges.every(edge => edge.kind.startsWith('display-internal-')));
  assert.ok(display.boundaryPaths.every(path => !display.internalEdges.some(edge => edge.id === path.fragmentId)));
  let drawnTriangles = 0;
  for (const binding of display.bindings) {
    assert.ok(binding.object instanceof Mesh && binding.object.parent === display.root);
    assert.equal(binding.meshId, result.mesh.id);
    assert.equal(binding.supportId, result.mesh.binding.supportId);
    assert.deepEqual(binding.sourceAssetIds, result.mesh.binding.sourceAssetIds);
    const component = result.triangulation.components.find(value => value.componentId === binding.componentId);
    assert.ok(component);
    assert.deepEqual(binding.holeLoopIds, component.holeLoopIds);
    assert.deepEqual(binding.triangleIds, component.triangleIds);
    assert.deepEqual(binding.vertexIndices, component.vertexIndices);
    const attr = binding.object.geometry.getAttribute('position');
    const normals = binding.object.geometry.getAttribute('normal');
    const uv = binding.object.geometry.getAttribute('_CAD_UV');
    assert.equal(binding.object.geometry.getAttribute('uv'), undefined);
    assert.equal(attr.count, result.report.vertexCount);
    assert.equal(normals.count, result.report.vertexCount);
    assert.equal(uv.count, result.report.vertexCount);
    for (let i = 0; i < result.mesh.positionsMM.length; i++) {
      assert.ok(Object.is(attr.array[i], Math.fround(result.mesh.positionsMM[i] * options.unitsPerMillimeter)));
      assert.ok(Object.is(normals.array[i], Math.fround(result.mesh.normals[i])));
      checkedPositions++; checkedNormals++;
    }
    for (let i = 0; i < result.mesh.parametersUV.length; i++) {
      assert.ok(Object.is(uv.array[i], Math.fround(result.mesh.parametersUV[i])));
      checkedUV++;
    }
    const expectedIndices = component.triangleIds.flatMap(id =>
      result.triangulation.triangles.find(triangle => triangle.id === id).vertexIndices);
    assert.deepEqual([...binding.object.geometry.index.array], expectedIndices);
    assert.deepEqual(binding.boundaryPathIds, result.boundaryPaths.filter(path =>
      path.componentId === component.componentId).map(path => path.fragmentId));
    drawnTriangles += expectedIndices.length / 3;
  }
  assert.equal(drawnTriangles, triangles);
  const disposed = [];
  for (const binding of display.bindings) {
    binding.object.geometry.addEventListener('dispose', () => disposed.push('geometry'));
    binding.object.material.addEventListener('dispose', () => disposed.push('material'));
  }
  display.dispose(); display.dispose();
  assert.equal(disposed.length, components * 2);
  assert.ok(!scene.children.includes(display.root) && scene.children.includes(caller));
  assert.deepEqual(result, before);
  scene.clear();
}

const accepted = createBaroCadBooleanThreeMesh(native[0], options);
let refused = 0;
const refuse = action => { assert.throws(action); refused++; };
const forged = structuredClone(native[0]); forged.mesh.positionsMM[0] += 1;
refuse(() => createBaroCadBooleanThreeMesh(forged, options));
refuse(() => createBaroCadBooleanThreeMesh(native[0], { ...options, basis: 'unknown' }));
refuse(() => createBaroCadBooleanThreeMesh(native[0], { ...options, unitsPerMillimeter: 0 }));
refuse(() => createBaroCadBooleanThreeMesh(native[0], { ...options, unitsPerMillimeter: 1e-50 }));
let getterCalls = 0;
const getter = { ...options };
Object.defineProperty(getter, 'basis', { enumerable: true, get() { getterCalls++; return options.basis; } });
refuse(() => createBaroCadBooleanThreeMesh(native[0], getter));
assert.equal(getterCalls, 0);

let setIndexCalls = 0, stagedGeometriesDisposed = 0, stagedMaterialsDisposed = 0;
const originalSetIndex = BufferGeometry.prototype.setIndex;
const originalMaterialDispose = MeshNormalMaterial.prototype.dispose;
try {
  BufferGeometry.prototype.setIndex = function (indices) {
    this.addEventListener('dispose', () => stagedGeometriesDisposed++);
    if (++setIndexCalls === 2) throw new Error('injected later-component failure');
    return originalSetIndex.call(this, indices);
  };
  MeshNormalMaterial.prototype.dispose = function () {
    stagedMaterialsDisposed++;
    return originalMaterialDispose.call(this);
  };
  refuse(() => createBaroCadBooleanThreeMesh(native[1], options));
} finally {
  BufferGeometry.prototype.setIndex = originalSetIndex;
  MeshNormalMaterial.prototype.dispose = originalMaterialDispose;
}
assert.equal(setIndexCalls, 2);
assert.equal(stagedGeometriesDisposed, 2);
assert.equal(stagedMaterialsDisposed, 1);
assert.ok(accepted.bindings.every(binding => binding.object.geometry.getAttribute('position')));
accepted.dispose();
console.log(JSON.stringify({ fixtures: fixtures.map(value => value[0]),
  componentCounts: fixtures.map(value => value[3]), triangleCounts: fixtures.map(value => value[4]),
  checkedPositions, checkedNormals, checkedUV, refused,
  stagedGeometriesDisposed, stagedMaterialsDisposed, emptyAccepted: true, callerSceneRetained: true }));
