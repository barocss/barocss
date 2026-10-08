import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { LinesMesh } from '@babylonjs/core/Meshes/linesMesh.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { parseCadAssembly, queryCadAssemblyInstancePoint, validateCadAssemblyResult } from '@barocss/cad';
import { BaroCADBabylonLoader } from '@barocss/cad-interop/babylon';
import { createBaroCadAssemblyBabylonDisplay } from '@barocss/cad-interop/babylon-assembly';

const bytes = readFileSync(new URL('./assembly-three-data/revision0.cad-assembly.json', import.meta.url));
const sha256 = createHash('sha256').update(bytes).digest('hex');
assert.equal(bytes.length, 4207);
assert.equal(sha256, '4657ece41355db1870447efa0120f30c497ffa1b5b38dbe94de765d53176819b');
const assembly = parseCadAssembly(bytes.toString('utf8'));
const before = structuredClone(assembly);
assert.deepEqual(validateCadAssemblyResult(assembly), assembly.report);
const native = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.01,
  curveDisplay: { version: 1, chordToleranceMM: 0.02, maxSegments: 512, maxDepth: 16 } };
const options = { native, basis: 'authored-xyz-matches-rhyup' };
const engine = new NullEngine();
const scene = new Scene(engine);
scene.useRightHandedSystem = true;
const callerMesh = new Mesh('caller-owned', scene);
const display = createBaroCadAssemblyBabylonDisplay(scene, assembly, options);
assert.equal(display.bindings.length, 6);
assert.deepEqual(display.bindings.map(binding => binding.instanceId),
  assembly.instances.map(instance => instance.instanceId));
assert.ok(display.bindings.every(binding => binding.instanceNode.parent === display.root &&
  binding.assemblyId === 'native_assembly' && binding.assemblyRevision === 0 &&
  (binding.mesh.metadata.barocss.curveId ?? binding.mesh.metadata.barocss.surfaceId) ===
    binding.reference.geometryId));
assert.equal(new Set(display.bindings.map(binding => binding.mesh)).size, 6);
assert.deepEqual(display.bindings.filter(binding => binding.reference.geometryId === 'shared_curve')
  .map(binding => binding.reference.assetId), ['asset_a', 'asset_a', 'asset_b']);
assert.deepEqual(display.bindings.map(binding => binding.mesh instanceof LinesMesh ? 'line' :
  binding.mesh instanceof Mesh ? 'mesh' : 'other'),
['line', 'mesh', 'mesh', 'line', 'line', 'mesh']);

const cases = [
  ['child', { kind: 'curve', parameter: 2 }, [10, 4, 0]],
  ['surface_grandchild', { kind: 'surface', u: 0.5, v: 0.5 }, [8.5, 4, 0]],
  ['shared_root', { kind: 'curve', parameter: 2 }, [-4, 0, 0]],
  ['asset_b_instance', { kind: 'curve', parameter: 2 }, [1, 10, 0]],
  ['xyz_order_root', { kind: 'surface', u: 0.5, v: 0.5 }, [0, 1.5, -1]],
];
for (const [instanceId, query, expectedMM] of cases) {
  const binding = display.bindings.find(value => value.instanceId === instanceId);
  const point = queryCadAssemblyInstancePoint(assembly, {
    assemblyId: 'native_assembly', assemblyRevision: 0, instanceId,
    reference: binding.reference, query,
  });
  assert.deepEqual(point.ancestors, binding.ancestors);
  assert.deepEqual(point.worldMatrix, binding.worldMatrix);
  expectedMM.forEach((value, axis) => assert.ok(Math.abs(point.assemblyPointMM[axis] - value) < 1e-10));
  const scenePoint = Vector3.TransformCoordinates(
    new Vector3(...point.originalLocalPointMM.map(value => value * native.unitsPerMillimeter)),
    binding.instanceNode.computeWorldMatrix(true));
  point.assemblyPointMM.forEach((value, axis) =>
    assert.ok(Math.abs(scenePoint.asArray()[axis] - value * native.unitsPerMillimeter) < 1e-7));
}
const child = display.bindings.find(binding => binding.instanceId === 'child');
display.root.position.x = 0.2;
const childNative = queryCadAssemblyInstancePoint(assembly, {
  assemblyId: 'native_assembly', assemblyRevision: 0, instanceId: 'child',
  reference: child.reference, query: { kind: 'curve', parameter: 2 },
});
const moved = Vector3.TransformCoordinates(
  new Vector3(...childNative.originalLocalPointMM.map(value => value * native.unitsPerMillimeter)),
  child.instanceNode.computeWorldMatrix(true));
assert.ok(Math.abs(moved.x - 0.3) < 1e-7 && Math.abs(moved.y - 0.04) < 1e-7);
assert.deepEqual(childNative.assemblyPointMM, [10, 4, 0]);
display.root.position.x = 0;
assert.deepEqual(assembly, before);

let refused = 0;
const refuse = action => { assert.throws(action); refused++; };
const forged = structuredClone(assembly);
forged.instances[0].worldMatrix[3] += 1;
refuse(() => createBaroCadAssemblyBabylonDisplay(scene, forged, options));
const stale = structuredClone(assembly);
stale.assembly.instances[0].reference.documentRevision++;
refuse(() => createBaroCadAssemblyBabylonDisplay(scene, stale, options));
refuse(() => createBaroCadAssemblyBabylonDisplay(scene, assembly, { ...options, basis: 'unknown' }));
refuse(() => createBaroCadAssemblyBabylonDisplay(scene, assembly,
  { ...options, native: { ...native, unitsPerMillimeter: 0 } }));
scene.useRightHandedSystem = false;
refuse(() => createBaroCadAssemblyBabylonDisplay(scene, assembly, options));
scene.useRightHandedSystem = true;
let getterCalls = 0;
const getter = { ...options };
Object.defineProperty(getter, 'basis', { enumerable: true, get() { getterCalls++; return options.basis; } });
refuse(() => createBaroCadAssemblyBabylonDisplay(scene, assembly, getter));
assert.equal(getterCalls, 0);

const originalParse = BaroCADBabylonLoader.prototype.parse;
const stagedMeshes = [];
let parseCalls = 0;
const priorMeshes = new Set(scene.meshes);
try {
  BaroCADBabylonLoader.prototype.parse = function (source) {
    const staged = originalParse.call(this, source);
    stagedMeshes.push(...staged.meshes);
    if (++parseCalls === 2) staged.model.name = 'forged_second_model';
    return staged;
  };
  refuse(() => createBaroCadAssemblyBabylonDisplay(scene, assembly, options));
} finally { BaroCADBabylonLoader.prototype.parse = originalParse; }
assert.equal(parseCalls, 2);
assert.ok(stagedMeshes.every(mesh => mesh.isDisposed() && !scene.meshes.includes(mesh)));
assert.deepEqual(new Set(scene.meshes), priorMeshes);
assert.ok(display.bindings.every(binding => !binding.mesh.isDisposed()));

const empty = structuredClone(assembly.assembly);
empty.instances = [];
const emptyResult = parseCadAssembly(JSON.stringify(empty));
const emptyDisplay = createBaroCadAssemblyBabylonDisplay(scene, emptyResult, options);
assert.equal(emptyDisplay.bindings.length, 0);
emptyDisplay.dispose();
assert.ok(emptyDisplay.root.isDisposed());

const ownedMeshes = scene.meshes.filter(mesh => mesh !== callerMesh);
display.dispose(); display.dispose();
assert.ok(ownedMeshes.every(mesh => mesh.isDisposed() && !scene.meshes.includes(mesh)));
assert.ok(display.bindings.every(binding => binding.instanceNode.isDisposed()));
assert.ok(display.root.isDisposed());
assert.ok(!callerMesh.isDisposed() && scene.meshes.includes(callerMesh));
assert.ok(!scene.isDisposed && engine.scenes.includes(scene));
assert.deepEqual(assembly, before);
console.log(JSON.stringify({ fileBytes: bytes.length, sha256, instances: 6,
  pointWitnesses: cases.length, sharedCurveAssets: ['asset_a', 'asset_a', 'asset_b'],
  movedChildScenePoint: moved.asArray(), refused, stagedMeshesDisposed: stagedMeshes.length,
  ownedMeshesDisposed: ownedMeshes.length, callerSceneRetained: true, emptyAssemblyAccepted: true }));
scene.dispose(); engine.dispose();
