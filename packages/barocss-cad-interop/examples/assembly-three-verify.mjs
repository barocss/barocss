import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Group, Line, Mesh, Scene, Vector3 } from 'three';
import { parseCadAssembly, queryCadAssemblyInstancePoint, validateCadAssemblyResult } from '@barocss/cad';
import { createBaroCadAssemblyThreeDisplay } from '@barocss/cad-interop/three-assembly';

const bytes = readFileSync(new URL('./assembly-three-data/revision0.cad-assembly.json', import.meta.url));
const sha256 = createHash('sha256').update(bytes).digest('hex');
assert.equal(sha256, '4657ece41355db1870447efa0120f30c497ffa1b5b38dbe94de765d53176819b');
const assembly = parseCadAssembly(bytes.toString('utf8'));
const before = structuredClone(assembly);
assert.deepEqual(validateCadAssemblyResult(assembly), assembly.report);
const native = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.01,
  curveDisplay: { version: 1, chordToleranceMM: 0.02, maxSegments: 512, maxDepth: 16 } };
const options = { native, basis: 'authored-xyz-matches-rhyup' };
const display = createBaroCadAssemblyThreeDisplay(assembly, options);
const scene = new Scene(), marker = new Group();
marker.name = 'caller-marker';
scene.add(marker, display.root);
display.root.updateMatrixWorld(true);
assert.equal(display.bindings.length, 6);
assert.deepEqual(display.bindings.map(binding => binding.instanceId),
  assembly.instances.map(instance => instance.instanceId));
assert.ok(display.bindings.every(binding => binding.instanceGroup.parent === display.root &&
  binding.instanceGroup.matrixAutoUpdate === false &&
  binding.object.name === binding.reference.geometryId &&
  binding.assemblyId === 'native_assembly' && binding.assemblyRevision === 0));
assert.equal(new Set(display.bindings.map(binding => binding.object)).size, 6);
assert.equal(display.bindings.filter(binding => binding.reference.geometryId === 'shared_curve').length, 3);
assert.deepEqual(display.bindings.filter(binding => binding.reference.geometryId === 'shared_curve')
  .map(binding => binding.reference.assetId), ['asset_a', 'asset_a', 'asset_b']);
assert.deepEqual(display.bindings.map(binding => binding.object instanceof Mesh ? 'mesh' :
  binding.object instanceof Line ? 'line' : 'other'),
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
  const scenePoint = new Vector3(...point.originalLocalPointMM.map(value => value * native.unitsPerMillimeter))
    .applyMatrix4(binding.instanceGroup.matrixWorld);
  point.assemblyPointMM.forEach((value, axis) =>
    assert.ok(Math.abs(scenePoint.getComponent(axis) - value * native.unitsPerMillimeter) < 1e-10));
}
assert.deepEqual(assembly, before);

let refused = 0;
const refuse = action => { assert.throws(action); refused++; };
const forgedMatrix = structuredClone(assembly);
forgedMatrix.instances[0].worldMatrix[3] += 1;
refuse(() => createBaroCadAssemblyThreeDisplay(forgedMatrix, options));
const stale = structuredClone(assembly);
stale.assembly.instances[0].reference.documentRevision++;
refuse(() => createBaroCadAssemblyThreeDisplay(stale, options));
const changedSource = structuredClone(assembly);
changedSource.assembly.parts[0].assets[0].source += '\n';
refuse(() => createBaroCadAssemblyThreeDisplay(changedSource, options));
refuse(() => createBaroCadAssemblyThreeDisplay(assembly, { ...options, basis: 'unknown' }));
refuse(() => createBaroCadAssemblyThreeDisplay(assembly, { ...options, native: { ...native, unitsPerMillimeter: 0 } }));
refuse(() => createBaroCadAssemblyThreeDisplay(assembly, { ...options, native: { ...native, unitsPerMillimeter: 1e308 } }));
let getterCalls = 0;
const getter = { ...options };
Object.defineProperty(getter, 'basis', { enumerable: true, get() { getterCalls++; return options.basis; } });
refuse(() => createBaroCadAssemblyThreeDisplay(assembly, getter));
assert.equal(getterCalls, 0);
refuse(() => parseCadAssembly('{"schema":"barocss-cad-assembly","schema":"barocss-cad-assembly"}'));
assert.ok(scene.children.includes(marker) && scene.children.includes(display.root));
assert.deepEqual(assembly, before);

let geometryDisposals = 0;
for (const binding of display.bindings) {
  binding.object.geometry.addEventListener('dispose', () => { geometryDisposals++; });
}
display.dispose();
display.dispose();
assert.equal(geometryDisposals, 6);
assert.ok(scene.children.includes(marker) && !scene.children.includes(display.root));
assert.equal(display.root.children.length, 0);

const empty = structuredClone(assembly.assembly);
empty.instances = [];
const emptyResult = parseCadAssembly(JSON.stringify(empty));
const emptyDisplay = createBaroCadAssemblyThreeDisplay(emptyResult, options);
assert.equal(emptyDisplay.bindings.length, 0);
assert.equal(emptyDisplay.root.children.length, 0);
emptyDisplay.dispose();

console.log(JSON.stringify({ fileBytes: bytes.length, sha256, assemblyId: 'native_assembly',
  assemblyRevision: 0, instanceCount: 6, pointWitnesses: cases.length, refused,
  distinctDisplayObjects: 6, geometryDisposals, emptyAssemblyAccepted: true }));
