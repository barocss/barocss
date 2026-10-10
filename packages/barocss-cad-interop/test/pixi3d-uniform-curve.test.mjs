import { Container3D, Mesh3D, MeshGeometry3D, StandardMaterial } from 'pixi3d/pixi7';
import { DRAW_MODES } from 'pixi.js';

const fact = (condition, message) => { if (!condition) throw new Error(message); };
function same(a, b) {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) {
    return ArrayBuffer.isView(a) && ArrayBuffer.isView(b) && a.constructor === b.constructor && a.length === b.length && Array.from(a).every((value, index) => Object.is(value, b[index]));
  }
  const keys = Reflect.ownKeys(a);
  return keys.length === Reflect.ownKeys(b).length && keys.every(key => Object.hasOwn(b, key) && same(a[key], b[key]));
}
const bits = (a, b) => a?.length === b.length && Array.from(a).every((value, index) => Object.is(value, b[index]));

/** Genuine browser peer objects only. The caller supplies the source/compiled public module namespaces. */
export async function runUniformPixi3DRuntimeCheckpoint(loaderModule, nativeModule, source) {
  const { BaroCADUniformCurvePixi3DLoader } = loaderModule;
  const { parseBaroCadUniformCurveSource, BaroCadUniformCurveSourceError } = nativeModule;
  fact(typeof BaroCADUniformCurvePixi3DLoader === 'function', 'Public Pixi uniform loader is missing');
  const options = count => ({ sourceVersion: 0, unitsPerMillimeter: 0.001, uniformCurveDisplay: { version: 1, count } });
  const caller = new Container3D(), callerGeometry = new MeshGeometry3D(), callerMaterial = new StandardMaterial();
  const callerChildren = [new Container3D(), new Container3D()];
  callerGeometry.positions = { buffer: new Float32Array([0, 0, 0, 1, 0, 0]), componentType: 5126, componentCount: 3, normalized: false };
  const callerCalls = { container: 0, geometry: 0, material: 0, rootChild: 0, meshChild: 0 };
  const originals = [];
  function wrap(object, method, counters, key) {
    const original = object[method]; originals.push({ object, method, original });
    object[method] = function (...args) { counters[key]++; return original.apply(this, args); };
  }
  wrap(caller, 'destroy', callerCalls, 'container'); wrap(callerGeometry, 'destroy', callerCalls, 'geometry'); wrap(callerMaterial, 'destroy', callerCalls, 'material');
  wrap(callerChildren[0], 'destroy', callerCalls, 'rootChild'); wrap(callerChildren[1], 'destroy', callerCalls, 'meshChild');
  const rows = [], accepted = [], replacements = [], refusals = [];
  let getterCalls = 0;
  function observe(result, scenario) {
    const row = { result, scenario, root: result.root, mesh: result.mesh, geometry: result.mesh.geometry, material: result.mesh.material,
      rootDestroyCalls: 0, meshDestroyCalls: 0, geometryDestroyCalls: 0, materialDestroyCalls: 0 };
    fact(row.root instanceof Container3D && row.mesh instanceof Mesh3D && row.geometry instanceof MeshGeometry3D && row.material instanceof StandardMaterial, 'Actual Pixi resource types differ');
    wrap(row.root, 'destroy', row, 'rootDestroyCalls'); wrap(row.mesh, 'destroy', row, 'meshDestroyCalls');
    wrap(row.geometry, 'destroy', row, 'geometryDestroyCalls'); wrap(row.material, 'destroy', row, 'materialDestroyCalls'); rows.push(row); return row;
  }
  function once(row) {
    fact(row.rootDestroyCalls === 1 && row.meshDestroyCalls === 1 && row.geometryDestroyCalls === 1 && row.materialDestroyCalls === 1, 'Actual owned Pixi destroy calls must each be one');
    fact(row.root.destroyed && row.mesh.destroyed && row.root.parent === null && row.mesh.parent === null, 'Owned root/mesh were not actually destroyed and detached');
  }
  function callerLive() {
    fact(!caller.destroyed && callerChildren.every(child => !child.destroyed) && Object.values(callerCalls).every(value => value === 0), 'Caller resources or children were destroyed by result cleanup');
  }
  function dispose(row) { row.result.dispose(); row.result.dispose(); once(row); callerLive(); }
  try {
    for (const count of [2, 129]) {
      const input = options(count), loader = new BaroCADUniformCurvePixi3DLoader(input);
      if (count === 129) { input.sourceVersion = 1; input.unitsPerMillimeter = 1; input.uniformCurveDisplay.version = 2; input.uniformCurveDisplay.count = 2; }
      const result = loader.parse(source), native = parseBaroCadUniformCurveSource(source, options(count)), row = observe(result, 'count-' + count);
      for (const key of Object.keys(native)) fact(same(result[key], native[key]), `Complete native field differs: ${key}`);
      fact(row.root.parent === null && row.mesh.parent === row.root && row.root.children.length === 1 && row.root.children[0] === row.mesh, 'Initial detached root must own one mesh');
      fact(row.root.name === result.model.name && row.mesh.name === result.curveId, 'Original native names differ');
      const attribute = row.geometry.positions, normals = row.geometry.normals, indices = row.geometry.indices;
      fact(attribute.buffer instanceof Float32Array && attribute.buffer !== result.positions && bits(attribute.buffer, native.positions), 'Actual separate Float32 target buffer changed native bits');
      fact(attribute.componentType === 5126 && attribute.componentCount === 3 && attribute.normalized === false && attribute.buffer.length === count * 3, 'Position attribute contract differs');
      for (let axis = 0; axis < 3; axis++) {
        const values = Array.from({ length: count }, (_, index) => attribute.buffer[index * 3 + axis]);
        fact(Object.is(attribute.min[axis], Math.min(...values)) && Object.is(attribute.max[axis], Math.max(...values)), 'Position bounds are not actual target data');
      }
      fact(normals.buffer instanceof Float32Array && normals.componentType === 5126 && normals.componentCount === 3 && normals.normalized === false &&
        normals.buffer.length === count * 3 && Array.from(normals.buffer).every((value, index) => Object.is(value, index % 3 === 2 ? 1 : 0)), 'Derived shader normals must be constant +Z, not native Curve data');
      fact(indices.buffer instanceof Uint16Array && indices.componentType === 5123 && indices.componentCount === 1 && indices.normalized === false &&
        bits(indices.buffer, Array.from({ length: count }, (_, index) => index)), 'Actual LINE_STRIP indices must be sequential Uint16');
      fact(row.geometry.uvs === undefined && row.material.drawMode === DRAW_MODES.LINE_STRIP && row.material.unlit && row.material.doubleSided, 'Target primitive/material/UV policy differs');
      fact(bits(row.material.baseColor.rgba, [Math.fround(40 / 255), Math.fround(201 / 255), Math.fround(235 / 255), 1]), 'Actual cyan color differs');
      fact(bits(row.root.position.array, [0, 0, 0]) && bits(row.root.scale.array, [1, 1, 1]) && bits(row.root.rotationQuaternion.array, [0, 0, 0, 1]) &&
        bits(row.mesh.position.array, [0, 0, 0]) && bits(row.mesh.scale.array, [1, 1, 1]) && bits(row.mesh.rotationQuaternion.array, [0, 0, 0, 1]), 'Authored root/mesh identity pose changed');
      for (let index = 0; index < count; index++) for (let axis = 0; axis < 3; axis++) fact(Object.is(attribute.buffer[index * 3 + axis], Math.fround(result.pointsMM[index][axis] * 0.001)), 'Display coordinates were not converted once');
      const retained = structuredClone(native); caller.addChild(row.root); dispose(row);
      fact(caller.children.length === 0, 'Owned root was not removed from caller container');
      for (const key of Object.keys(retained)) fact(same(result[key], retained[key]), `Native CPU data lost after cleanup: ${key}`);
      fact(bits(row.geometry.positions.buffer, retained.positions), 'Retained geometry CPU arrays changed; this is not GPU-liveness evidence');
      accepted.push({ count, optionSnapshotPreserved: true, fullNativeExact: true, targetFloat32BitsExact: true, vertexCount: count, sequentialIndices: count, orderedIntervals: count - 1,
        originalIdentity: true, rootDestroyCalls: row.rootDestroyCalls, meshDestroyCalls: row.meshDestroyCalls, geometryDestroyCalls: row.geometryDestroyCalls, materialDestroyCalls: row.materialDestroyCalls, nativeCPUReadable: true });
    }
    const loader = new BaroCADUniformCurvePixi3DLoader(options(129));
    const materialResult = loader.parse(source), materialRow = observe(materialResult, 'caller-material-replacement');
    materialResult.mesh.material = callerMaterial; caller.addChild(materialResult.root); dispose(materialRow);
    fact(materialResult.mesh.material === callerMaterial && callerCalls.material === 0, 'Caller replacement material was destroyed');
    replacements.push({ scenario: 'material', callerMaterialRetained: true, callerMaterialDestroyCalls: callerCalls.material,
      ownedRootDestroyCalls: materialRow.rootDestroyCalls, ownedMeshDestroyCalls: materialRow.meshDestroyCalls, ownedGeometryDestroyCalls: materialRow.geometryDestroyCalls, ownedMaterialDestroyCalls: materialRow.materialDestroyCalls });
    const geometryResult = loader.parse(source), geometryRow = observe(geometryResult, 'caller-geometry-and-children-replacement'), retainedPositions = Float32Array.from(geometryResult.positions);
    geometryResult.mesh.geometry = callerGeometry;
    geometryResult.root.addChild(callerChildren[0]); geometryResult.mesh.addChild(callerChildren[1]); caller.addChild(geometryResult.root);
    dispose(geometryRow);
    fact(geometryResult.mesh.geometry === callerGeometry && callerCalls.geometry === 0 && bits(geometryResult.positions, retainedPositions), 'Caller geometry or native CPU positions were destroyed/changed');
    fact(callerChildren.every(child => child.parent === null && !child.destroyed) && callerCalls.rootChild === 0 && callerCalls.meshChild === 0, 'Caller children must survive detached, without recursive destruction');
    caller.addChild(...callerChildren); fact(caller.children.length === 2, 'Live caller children could not be reattached by their owner');
    replacements.push({ scenario: 'geometry-and-children', callerGeometryRetained: true, callerGeometryDestroyCalls: callerCalls.geometry,
      callerRootChildDestroyCalls: callerCalls.rootChild, callerMeshChildDestroyCalls: callerCalls.meshChild, childrenSurvivedDetached: true, ownerReattachmentSucceeded: true,
      ownedRootDestroyCalls: geometryRow.rootDestroyCalls, ownedMeshDestroyCalls: geometryRow.meshDestroyCalls, ownedGeometryDestroyCalls: geometryRow.geometryDestroyCalls, ownedMaterialDestroyCalls: geometryRow.materialDestroyCalls });
    for (const [name, input] of [['count1', options(1)], ['count130', options(130)]]) {
      let error; try { new BaroCADUniformCurvePixi3DLoader(input); } catch (cause) { error = cause; }
      fact(error instanceof BaroCadUniformCurveSourceError && error.code === 'OPTIONS', 'Actual uniform constructor range refusal differs'); refusals.push({ name, errorName: error.name, code: error.code });
    }
    const rootGetter = options(129); Object.defineProperty(rootGetter, 'unitsPerMillimeter', { enumerable: true, get() { getterCalls++; return 0.001; } });
    const countGetter = options(129); Object.defineProperty(countGetter.uniformCurveDisplay, 'count', { enumerable: true, get() { getterCalls++; return 129; } });
    for (const [name, input] of [['rootGetter', rootGetter], ['countGetter', countGetter]]) {
      let error; try { new BaroCADUniformCurvePixi3DLoader(input); } catch (cause) { error = cause; }
      fact(error instanceof BaroCadUniformCurveSourceError && error.code === 'OPTIONS' && getterCalls === 0, 'Actual descriptor-safe constructor refusal differs'); refusals.push({ name, errorName: error.name, code: error.code });
    }
    callerLive();
    fact(new Set(rows.map(row => row.root)).size === 4 && new Set(rows.map(row => row.mesh)).size === 4 && new Set(rows.map(row => row.geometry)).size === 4 && new Set(rows.map(row => row.material)).size === 4, 'Focused resource population must have four distinct actual owned sets');
    return { ok: true, accepted, replacements, refusals, getterCalls, ownedResults: rows.length, distinctRoots: 4, distinctMeshes: 4, distinctGeometries: 4, distinctMaterials: 4,
      rootDestroyCalls: rows.reduce((sum, row) => sum + row.rootDestroyCalls, 0), meshDestroyCalls: rows.reduce((sum, row) => sum + row.meshDestroyCalls, 0),
      geometryDestroyCalls: rows.reduce((sum, row) => sum + row.geometryDestroyCalls, 0), materialDestroyCalls: rows.reduce((sum, row) => sum + row.materialDestroyCalls, 0), caller: { ...callerCalls, retained: true },
      callerObservation: 'before test-owned caller teardown', scope: 'Focused genuine Pixi browser peer objects/data/options/replacements/children/destruction. No Renderer/DOM mock, rendering/pixels, HTTP, constructor-fault or late-abort execution in this helper.' };
  } finally {
    for (const row of rows) row.result.dispose();
    // Restore observation wrappers before this test caller performs its own teardown.
    for (const { object, method, original } of originals) object[method] = original;
    for (const child of callerChildren) { child.parent?.removeChild(child); if (!child.destroyed) child.destroy({ children: false }); }
    caller.destroy({ children: false }); callerGeometry.destroy(); callerMaterial.destroy();
  }
}
