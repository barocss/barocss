import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { LinesMesh } from '@babylonjs/core/Meshes/linesMesh.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';

/** The calling verifier selects ordinary source or compiled public modules; no autonomous gate runs. */
export async function runUniformBabylonRuntimeCheckpoint(loaderModule, nativeModule, worldSource) {
  const { BaroCADUniformCurveBabylonLoader } = loaderModule;
  const { parseBaroCadUniformCurveSource, BaroCadUniformCurveSourceError } = nativeModule;
  assert.equal(typeof BaroCADUniformCurveBabylonLoader, 'function');
  const options = count => ({ sourceVersion: 0, unitsPerMillimeter: 0.001, uniformCurveDisplay: { version: 1, count } });
  const engine = new NullEngine(), scene = new Scene(engine); scene.useRightHandedSystem = true;
  const caller = new Mesh('uniform_test_caller', scene), data = new VertexData();
  data.positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]); data.indices = [0, 1, 2]; data.applyToMesh(caller);
  const callerGeometry = caller.geometry, callerMaterial = new StandardMaterial('uniform_test_caller_material', scene); caller.material = callerMaterial;
  assert.ok(callerGeometry);
  const callerCounters = { mesh: 0, geometry: 0, material: 0, scene: 0, engine: 0 };
  caller.onDisposeObservable.add(() => callerCounters.mesh++); callerMaterial.onDisposeObservable.add(() => callerCounters.material++);
  const callerGeometryDispose = callerGeometry.dispose;
  callerGeometry.dispose = function (...args) { callerCounters.geometry++; return callerGeometryDispose.apply(this, args); };
  scene.onDisposeObservable.add(() => callerCounters.scene++); engine.onDisposeObservable.add(() => callerCounters.engine++);
  const rows = [], accepted = [], replacements = [], refusals = [], callerMaterials = [];
  let getterCalls = 0;
  function observe(result, scenario) {
    const mesh = result.line, geometry = mesh.geometry, material = mesh.material;
    assert.ok(mesh instanceof LinesMesh && geometry && material instanceof ShaderMaterial);
    const row = { result, scenario, mesh, geometry, material, meshDisposals: 0, geometryDisposals: 0, materialDisposals: 0 };
    mesh.onDisposeObservable.add(() => row.meshDisposals++); material.onDisposeObservable.add(() => row.materialDisposals++);
    const originalDispose = geometry.dispose;
    geometry.dispose = function (...args) { row.geometryDisposals++; return originalDispose.apply(this, args); };
    rows.push(row); return row;
  }
  function callerRetained() {
    assert.ok(scene.meshes.includes(caller) && !caller.isDisposed() && !callerGeometry.isDisposed());
    assert.equal(caller.geometry, callerGeometry); assert.equal(caller.material, callerMaterial); assert.ok(scene.materials.includes(callerMaterial));
    assert.ok(Object.values(callerCounters).every(value => value === 0));
  }
  function once(row) {
    assert.equal(row.meshDisposals, 1); assert.equal(row.geometryDisposals, 1); assert.equal(row.materialDisposals, 1);
    assert.ok(row.mesh.isDisposed() && row.geometry.isDisposed()); assert.ok(!scene.meshes.includes(row.mesh) && !scene.materials.includes(row.material));
  }
  try {
    for (const count of [2, 129]) {
      const input = options(count), loader = new BaroCADUniformCurveBabylonLoader(input);
      if (count === 129) { input.sourceVersion = 1; input.unitsPerMillimeter = 1; input.uniformCurveDisplay.version = 2; input.uniformCurveDisplay.count = 2; }
      const baseline = { meshes: scene.meshes.length, materials: scene.materials.length, geometries: scene.geometries.length };
      const result = loader.parse(worldSource, scene), native = parseBaroCadUniformCurveSource(worldSource, options(count)), row = observe(result, 'count-' + count);
      for (const key of Object.keys(native)) assert.deepEqual(result[key], native[key], `Full native field changed: ${key}`);
      assert.equal(scene.meshes.length, baseline.meshes + 1); assert.equal(scene.materials.length, baseline.materials + 1); assert.equal(scene.geometries.length, baseline.geometries + 1);
      assert.equal(row.mesh.getScene(), scene); assert.equal(row.mesh.parent, null); assert.equal(row.mesh.isEnabled(), false);
      const positions = row.mesh.getVerticesData('position'), indices = row.mesh.getIndices();
      assert.ok(positions instanceof Float32Array); assert.notEqual(positions, result.positions);
      assert.deepEqual(Array.from(positions), Array.from(native.positions)); assert.equal(row.mesh.getTotalVertices(), count);
      assert.deepEqual(Array.from(indices), Array.from({ length: count - 1 }, (_, index) => [index, index + 1]).flat());
      assert.deepEqual(row.mesh.getVerticesDataKinds(), ['position']); assert.equal(result.parameters.length, count); assert.equal(result.intervals.length, count - 1);
      assert.deepEqual(row.mesh.color.asArray(), [40 / 255, 201 / 255, 235 / 255]); assert.equal(row.material.needAlphaBlending(), false);
      assert.deepEqual(row.material.options.attributes, ['position']); assert.deepEqual(row.material.options.uniforms, ['world', 'viewProjection', 'color']);
      assert.deepEqual(row.mesh.metadata.barocss.nativeParameters, result.parameters); assert.deepEqual(row.mesh.metadata.barocss.nativeIntervals, result.intervals);
      assert.deepEqual(row.mesh.metadata.barocss.quality, result.quality); assert.equal(row.mesh.metadata.barocss.mode, 'uniform-original-parameter');
      assert.deepEqual(Array.from(row.mesh.computeWorldMatrix(true).asArray()), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      const retained = structuredClone(native); result.dispose(); result.dispose(); once(row); callerRetained();
      for (const key of Object.keys(retained)) assert.deepEqual(result[key], retained[key], `Native data lost after cleanup: ${key}`);
      assert.equal(row.mesh.geometry, null); assert.equal(row.geometry.getVerticesData('position'), null);
      accepted.push({ count, optionSnapshotPreserved: true, fullNativeExact: true, actualFloat32Copy: true, vertexCount: count, indexCount: 2 * (count - 1),
        initiallyDisabledSceneRegistered: true, meshDisposals: row.meshDisposals, geometryDisposals: row.geometryDisposals, materialDisposals: row.materialDisposals, nativeCPUReadable: true });
    }
    const loader = new BaroCADUniformCurveBabylonLoader(options(129));
    const materialResult = loader.parse(worldSource, scene), materialRow = observe(materialResult, 'caller-material-replacement');
    const replacementMaterial = new StandardMaterial('uniform_test_replacement_material', scene); callerMaterials.push(replacementMaterial);
    let replacementMaterialDisposals = 0; replacementMaterial.onDisposeObservable.add(() => replacementMaterialDisposals++);
    materialResult.line.material = replacementMaterial;
    assert.equal(materialRow.materialDisposals, 0); assert.equal(materialResult.line.material, replacementMaterial);
    materialResult.dispose(); materialResult.dispose(); once(materialRow); callerRetained();
    assert.equal(replacementMaterialDisposals, 0); assert.ok(scene.materials.includes(replacementMaterial));
    replacements.push({ scenario: 'material', ownedMeshDisposals: materialRow.meshDisposals, ownedGeometryDisposals: materialRow.geometryDisposals,
      ownedMaterialDisposals: materialRow.materialDisposals, callerReplacementMaterialDisposals: replacementMaterialDisposals, callerReplacementMaterialRetained: true });
    const geometryResult = loader.parse(worldSource, scene), geometryRow = observe(geometryResult, 'caller-geometry-replacement'), nativePositions = Float32Array.from(geometryResult.positions);
    callerGeometry.applyToMesh(geometryResult.line);
    assert.equal(geometryResult.line.geometry, callerGeometry); assert.equal(geometryRow.geometryDisposals, 0); assert.equal(geometryRow.geometry.isDisposed(), false);
    geometryResult.dispose(); geometryResult.dispose(); once(geometryRow); callerRetained();
    assert.deepEqual(geometryResult.positions, nativePositions); assert.ok(callerGeometry.meshes.includes(caller) && !callerGeometry.meshes.includes(geometryResult.line));
    replacements.push({ scenario: 'geometry', ownedMeshDisposals: geometryRow.meshDisposals, ownedGeometryDisposals: geometryRow.geometryDisposals,
      ownedMaterialDisposals: geometryRow.materialDisposals, callerReplacementGeometryDisposals: callerCounters.geometry, callerReplacementGeometryRetained: true, nativePositionsRetained: true });
    for (const [name, input] of [['count1', options(1)], ['count130', options(130)]]) {
      assert.throws(() => new BaroCADUniformCurveBabylonLoader(input), error => {
        assert.ok(error instanceof BaroCadUniformCurveSourceError); assert.equal(error.code, 'OPTIONS'); refusals.push({ name, errorName: error.name, code: error.code }); return true;
      });
    }
    const rootGetter = options(129); Object.defineProperty(rootGetter, 'unitsPerMillimeter', { enumerable: true, get() { getterCalls++; return 0.001; } });
    const countGetter = options(129); Object.defineProperty(countGetter.uniformCurveDisplay, 'count', { enumerable: true, get() { getterCalls++; return 129; } });
    for (const [name, input] of [['rootGetter', rootGetter], ['countGetter', countGetter]]) {
      assert.throws(() => new BaroCADUniformCurveBabylonLoader(input), error => {
        assert.ok(error instanceof BaroCadUniformCurveSourceError); assert.equal(error.code, 'OPTIONS'); refusals.push({ name, errorName: error.name, code: error.code }); return true;
      }); assert.equal(getterCalls, 0);
    }
    const beforeInvalidScene = { meshes: scene.meshes.length, materials: scene.materials.length, geometries: scene.geometries.length }, left = new Scene(engine), closed = new Scene(engine);
    closed.useRightHandedSystem = true; closed.dispose();
    try {
      for (const [name, candidate] of [['left-handed', left], ['disposed', closed], ['invalid', { useRightHandedSystem: true }]]) {
        assert.throws(() => loader.parse(worldSource, candidate), error => {
          assert.ok(error instanceof RangeError); assert.equal(error.code, undefined); refusals.push({ name, errorName: error.name, code: null }); return true;
        });
      }
      assert.equal(left.meshes.length, 0); assert.equal(left.materials.length, 0); assert.equal(left.geometries.length, 0);
    } finally { left.dispose(); }
    assert.deepEqual({ meshes: scene.meshes.length, materials: scene.materials.length, geometries: scene.geometries.length }, beforeInvalidScene);
    callerRetained();
    assert.equal(new Set(rows.map(row => row.mesh.uniqueId)).size, 4); assert.equal(new Set(rows.map(row => row.geometry.uniqueId)).size, 4); assert.equal(new Set(rows.map(row => row.material.uniqueId)).size, 4);
    return { ok: true, accepted, replacements, refusals, getterCalls, ownedResults: rows.length, distinctMeshes: 4, distinctGeometries: 4, distinctMaterials: 4,
      meshDisposals: rows.reduce((sum, row) => sum + row.meshDisposals, 0), geometryDisposals: rows.reduce((sum, row) => sum + row.geometryDisposals, 0), materialDisposals: rows.reduce((sum, row) => sum + row.materialDisposals, 0),
      caller: { ...callerCounters, retained: true }, callerObservation: 'before this test caller owner teardown',
      scope: 'Focused public uniform/Babylon NullEngine CPU objects/options/value bits/disabled staging/replacements/disposal. No HTTP, WebGL pixels, readiness, constructor-fault or post-parse-abort execution in this helper.' };
  } finally {
    for (const row of rows) row.result.dispose();
    for (const material of callerMaterials) material.dispose();
    scene.dispose(); engine.dispose();
  }
}
