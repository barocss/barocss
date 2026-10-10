import assert from 'node:assert/strict';
import { BufferAttribute, BufferGeometry, Group, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, Scene, SphereGeometry } from 'three';

/** Focused public-entry CPU checkpoint. The calling verifier selects source or compiled modules. */
export async function runUniformThreeRuntimeCheckpoint(loaderModule, nativeModule, worldSource) {
  const { BaroCADUniformCurveLoader } = loaderModule;
  const { parseBaroCadUniformCurveSource, validateBaroCadUniformCurveSourceOptions, BaroCadUniformCurveSourceError } = nativeModule;
  assert.equal(typeof BaroCADUniformCurveLoader, 'function');
  assert.equal(typeof validateBaroCadUniformCurveSourceOptions, 'function');
  const options = count => ({ sourceVersion: 0, unitsPerMillimeter: 0.001, uniformCurveDisplay: { version: 1, count } });
  const scene = new Scene(), callerGeometry = new SphereGeometry(0.00012, 8, 6), callerMaterial = new MeshBasicMaterial({ color: 0x00ff00 }), caller = new Mesh(callerGeometry, callerMaterial);
  scene.add(caller);
  let callerGeometryDisposals = 0, callerMaterialDisposals = 0, getterCalls = 0;
  callerGeometry.addEventListener('dispose', () => callerGeometryDisposals++); callerMaterial.addEventListener('dispose', () => callerMaterialDisposals++);
  const rows = [], accepted = [], refusals = [];
  try {
    const originalOptions = options(129), independent = validateBaroCadUniformCurveSourceOptions(originalOptions);
    assert.deepEqual(independent, originalOptions); assert.notEqual(independent, originalOptions); assert.notEqual(independent.uniformCurveDisplay, originalOptions.uniformCurveDisplay);
    independent.uniformCurveDisplay.count = 2; assert.equal(originalOptions.uniformCurveDisplay.count, 129);
    for (const count of [2, 129]) {
      const input = options(count), expectedOptions = options(count), loader = new BaroCADUniformCurveLoader(input);
      if (count === 129) {
        input.sourceVersion = 1; input.unitsPerMillimeter = 1; input.uniformCurveDisplay.version = 2; input.uniformCurveDisplay.count = 2;
      }
      const result = loader.parse(worldSource), native = parseBaroCadUniformCurveSource(worldSource, expectedOptions);
      const row = { result, geometry: result.line.geometry, material: result.line.material, geometryDisposals: 0, materialDisposals: 0 };
      row.geometry.addEventListener('dispose', () => row.geometryDisposals++); row.material.addEventListener('dispose', () => row.materialDisposals++); rows.push(row);
      for (const key of Object.keys(native)) assert.deepEqual(result[key], native[key], `Full retained native field differs: ${key}`);
      assert.equal(result.source, worldSource); assert.equal(result.model.version, 0); assert.equal(result.model.objects.length, 1); assert.equal(result.model.objects[0].kind, 'curve');
      assert.equal(result.mode, 'uniform-original-parameter'); assert.equal(result.parameters.length, count); assert.equal(result.pointsMM.length, count); assert.equal(result.intervals.length, count - 1);
      assert.equal(result.positions.length, count * 3); assert.ok(result.positions instanceof Float32Array);
      assert.ok(Object.is(result.parameters[0], result.domain[0])); assert.ok(Object.is(result.parameters.at(-1), result.domain[1]));
      assert.ok(result.parameters.slice(1).every((parameter, index) => parameter > result.parameters[index]));
      assert.ok(result.group instanceof Group && result.line instanceof Line && row.geometry instanceof BufferGeometry && row.material instanceof LineBasicMaterial);
      assert.equal(result.group.parent, null); assert.deepEqual(result.group.children, [result.line]); assert.equal(result.line.parent, result.group);
      assert.equal(result.group.name, result.model.name); assert.equal(result.line.name, result.curveId);
      assert.equal(row.geometry.index, null); assert.deepEqual(Object.keys(row.geometry.attributes), ['position']);
      const attribute = row.geometry.getAttribute('position'); assert.ok(attribute instanceof BufferAttribute); assert.equal(attribute.itemSize, 3); assert.equal(attribute.count, count);
      assert.equal(attribute.array, result.positions); assert.deepEqual(Array.from(attribute.array), Array.from(native.positions));
      for (let i = 0; i < count; i++) for (let axis = 0; axis < 3; axis++) assert.ok(Object.is(attribute.array[i * 3 + axis], Math.fround(result.pointsMM[i][axis] * 0.001)));
      assert.equal(row.material.color.getHex(), 0x28c9eb); assert.equal(row.material.depthTest, true); assert.equal(row.material.depthWrite, true);
      assert.deepEqual(result.line.userData.barocss.nativeParameters, result.parameters); assert.deepEqual(result.line.userData.barocss.nativeIntervals, result.intervals);
      assert.equal(result.line.userData.barocss.mode, result.mode); assert.deepEqual(result.line.userData.barocss.quality, result.quality);
      assert.equal(result.quality.approximateDisplay, true); assert.equal(result.quality.adaptiveErrorBound, false); assert.equal(result.quality.topologyCertified, false); assert.equal(result.quality.solid, false);
      scene.add(result.group); scene.updateMatrixWorld(true);
      assert.deepEqual(result.line.matrixWorld.elements, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      const retained = structuredClone(native); result.dispose(); result.dispose();
      assert.equal(row.geometryDisposals, 1); assert.equal(row.materialDisposals, 1); assert.equal(result.group.parent, null); assert.equal(result.line.parent, null); assert.equal(result.group.children.length, 0);
      for (const key of Object.keys(retained)) assert.deepEqual(result[key], retained[key], `Native CPU field changed after disposal: ${key}`);
      assert.equal(caller.parent, scene); assert.deepEqual(scene.children, [caller]); assert.equal(callerGeometryDisposals, 0); assert.equal(callerMaterialDisposals, 0);
      accepted.push({ count, optionsSnapshotPreserved: true, nativeDomain: [...result.domain], nativeModelId: result.model.name, curveId: result.curveId,
        fullNativeFieldsExact: true, targetPositionBitsExact: true, vertexCount: attribute.count, intervalCount: result.intervals.length, unindexedLine: true,
        geometryDisposals: row.geometryDisposals, materialDisposals: row.materialDisposals, nativeCPUReadableAfterDoubleDispose: true });
    }
    for (const [name, input] of [['count1', options(1)], ['count130', options(130)]]) {
      assert.throws(() => new BaroCADUniformCurveLoader(input), error => {
        assert.ok(error instanceof BaroCadUniformCurveSourceError); assert.equal(error.code, 'OPTIONS'); refusals.push({ name, errorName: error.name, code: error.code }); return true;
      });
    }
    const rootGetter = options(129); Object.defineProperty(rootGetter, 'unitsPerMillimeter', { enumerable: true, get() { getterCalls++; return 0.001; } });
    const profileGetter = options(129); Object.defineProperty(profileGetter.uniformCurveDisplay, 'count', { enumerable: true, get() { getterCalls++; return 129; } });
    for (const [name, input] of [['rootGetter', rootGetter], ['profileGetter', profileGetter]]) {
      assert.throws(() => new BaroCADUniformCurveLoader(input), error => {
        assert.ok(error instanceof BaroCadUniformCurveSourceError); assert.equal(error.code, 'OPTIONS'); refusals.push({ name, errorName: error.name, code: error.code }); return true;
      });
      assert.equal(getterCalls, 0);
    }
    assert.equal(new Set(rows.map(row => row.geometry.uuid)).size, 2); assert.equal(new Set(rows.map(row => row.material.uuid)).size, 2);
    assert.equal(caller.parent, scene); assert.equal(callerGeometryDisposals, 0); assert.equal(callerMaterialDisposals, 0);
    return { ok: true, accepted, refusals, getterCalls, results: rows.length, distinctGeometries: 2, distinctMaterials: 2,
      geometryDisposals: rows.reduce((sum, row) => sum + row.geometryDisposals, 0), materialDisposals: rows.reduce((sum, row) => sum + row.materialDisposals, 0),
      callerRetained: true, callerGeometryDisposals, callerMaterialDisposals,
      scope: 'Focused public uniform source/Three CPU objects/options snapshot/value bits/disposal. No HTTP, WebGL, constructor-fault or post-parse-abort execution in this helper.' };
  } finally {
    for (const row of rows) row.result.dispose();
    // This Scene/marker is the test caller. Its resources were observed above before owner teardown.
    caller.removeFromParent(); callerGeometry.dispose(); callerMaterial.dispose();
  }
}
