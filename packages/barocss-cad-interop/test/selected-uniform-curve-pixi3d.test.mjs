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

/** Genuine browser peer objects only. The caller supplies the full original genuine asset; modules initialize lazily in this browser-only function. */
export async function runSelectedUniformCurvePixi3DRuntimeCheckpoint(asset) {
  // The real peer initializer requires a browser. Merely importing this helper in Node must not execute it.
  const [loaderModule, nativeModule, legacyModule, cadModule, pixiModule, pixiJS] = await Promise.all([
    import('@barocss/cad-interop/pixi3d-selected-uniform-curve'), import('@barocss/cad-interop/native-selected-uniform-curve'),
    import('@barocss/cad-interop/native-uniform-curve'), import('@barocss/cad'), import('pixi3d/pixi7'), import('pixi.js'),
  ]);
  const { Container3D, Mesh3D, MeshGeometry3D, StandardMaterial } = pixiModule;
  const { DRAW_MODES } = pixiJS;
  const source = asset.originalSource;
  const compiled = cadModule.compileCadModel(source, { sourceVersion: 0 });
  fact(compiled.ok && same(compiled.model, asset.owned.originalModel), 'Full original Model/source authority differs');
  fact(compiled.model.objects.length === 3 && compiled.model.objects[1].kind === 'curve' && compiled.model.objects[1].id === 'target_curve', 'Genuine selected ordinal differs');
  const { BaroCADSelectedUniformCurvePixi3DLoader } = loaderModule;
  const { parseBaroCadSelectedUniformCurveSource, BaroCadUniformCurveSourceError } = nativeModule;
  fact(typeof BaroCADSelectedUniformCurvePixi3DLoader === 'function', 'Public Pixi uniform loader is missing');
  const options = count => ({ sourceVersion: 0, unitsPerMillimeter: 0.001, uniformCurveDisplay: { version: 1, count }, curveId: 'target_curve' });
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
      const input = options(count), loader = new BaroCADSelectedUniformCurvePixi3DLoader(input);
      if (count === 129) { input.curveId = 'context_curve'; input.sourceVersion = 1; input.unitsPerMillimeter = 1; input.uniformCurveDisplay.version = 2; input.uniformCurveDisplay.count = 2; }
      const result = loader.parse(source), native = parseBaroCadSelectedUniformCurveSource(source, options(count)), row = observe(result, 'count-' + count);
      for (const key of Object.keys(native)) fact(same(result[key], native[key]), `Complete native field differs: ${key}`);
      fact(result.source === source && same(result.model, compiled.model) && result.selectedObjectIndex === 1 && result.curve !== result.model.objects[1] && same(result.curve, result.model.objects[1]) &&
        same(result.unrenderedObjectIds, ['context_curve', 'context_plane']) && same(result.domain, cadModule.curveDomain(result.model.objects[1])), 'Complete Model/independent selected occurrence differs');
      const direct = cadModule.sampleCurve(result.model.objects[1], count);
      fact(same(result.parameters, direct.map(sample => sample.parameter)) && same(result.pointsMM, direct.map(sample => sample.point)), 'Direct original native sampler differs');
      const metadata = result.mesh.barocss;
      for (const [key, value] of Object.entries({ role: 'selected-uniform-curve-display-line', modelName: result.model.name, curveId: result.curveId, sourceVersion: 0,
        lengthUnit: 'mm', coordinateSystem: 'right-handed-z-up', mode: result.mode, selectedObjectIndex: 1, unrenderedObjectIds: result.unrenderedObjectIds,
        nativeDomain: result.domain, nativeParameters: result.parameters, nativeIntervals: result.intervals, quality: result.quality })) fact(same(metadata[key], value), `Copied selected metadata differs: ${key}`);
      fact(metadata.unrenderedObjectIds !== result.unrenderedObjectIds && metadata.nativeDomain !== result.domain && metadata.nativeParameters !== result.parameters && metadata.nativeIntervals !== result.intervals &&
        metadata.nativeIntervals.every((interval, index) => interval !== result.intervals[index]) && metadata.quality !== result.quality, 'Metadata aliases native arrays');
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
    const loader = new BaroCADSelectedUniformCurvePixi3DLoader(options(129));
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
      let error; try { new BaroCADSelectedUniformCurvePixi3DLoader(input); } catch (cause) { error = cause; }
      fact(error instanceof BaroCadUniformCurveSourceError && error.code === 'OPTIONS', 'Actual uniform constructor range refusal differs'); refusals.push({ name, errorName: error.name, code: error.code });
    }
    const rootGetter = options(129); Object.defineProperty(rootGetter, 'curveId', { enumerable: true, get() { getterCalls++; return 'target_curve'; } });
    const countGetter = options(129); Object.defineProperty(countGetter.uniformCurveDisplay, 'count', { enumerable: true, get() { getterCalls++; return 129; } });
    for (const [name, input] of [['curveIdGetter', rootGetter], ['countGetter', countGetter]]) {
      let error; try { new BaroCADSelectedUniformCurvePixi3DLoader(input); } catch (cause) { error = cause; }
      fact(error instanceof BaroCadUniformCurveSourceError && error.code === 'OPTIONS' && getterCalls === 0, 'Actual descriptor-safe constructor refusal differs'); refusals.push({ name, errorName: error.name, code: error.code });
    }
    const first = parseBaroCadSelectedUniformCurveSource(source, options(129)), second = parseBaroCadSelectedUniformCurveSource(source, options(129)), secondBefore = structuredClone(second), firstModel = structuredClone(first.model);
    fact(first.model !== second.model && first.curve.controlPoints.every((point, index) => point !== first.model.objects[1].controlPoints[index]) &&
      first.curve.knots !== first.model.objects[1].knots && first.curve.weights !== first.model.objects[1].weights, 'Selected coefficient/cross-parse copies alias');
    first.curve.controlPoints[0][0] += 1; first.curve.knots[0] += 1; first.curve.weights[0] += 1;
    fact(same(first.model, firstModel), 'Independent copied Curve changed full Model');
    first.model.objects[0].controlPoints[0][0] += 1; first.positions[0] += 1; first.options.uniformCurveDisplay.count = 2;
    fact(same(second, secondBefore) && same(parseBaroCadSelectedUniformCurveSource(source, options(129)), secondBefore), 'Return mutation changed another/later parse');
    let legacyError; try { legacyModule.parseBaroCadUniformCurveSource(source, { sourceVersion: 0, unitsPerMillimeter: 0.001, uniformCurveDisplay: { version: 1, count: 129 } }); } catch (error) { legacyError = error; }
    fact(legacyError instanceof BaroCadUniformCurveSourceError && legacyError.code === 'PROFILE', 'Legacy full Model profile must remain refused');
    refusals.push({ name: 'legacyFullModelProfile', errorName: legacyError.name, code: legacyError.code });
    const control = '@model single_control {version:0;length-unit:mm;@curve #single_curve {type:nurbs;degree:1;knots:[-3,-3,7,7];control-points:[[0,-0,0],[2,1,0]];weights:[1,1];}}';
    const controlOptions = { sourceVersion: 0, unitsPerMillimeter: 0.001, uniformCurveDisplay: { version: 1, count: 129 } };
    const legacy = legacyModule.parseBaroCadUniformCurveSource(control, controlOptions), selectedControl = parseBaroCadSelectedUniformCurveSource(control, { ...controlOptions, curveId: 'single_curve' });
    for (const key of ['source', 'model', 'curveId', 'domain', 'parameters', 'pointsMM', 'intervals', 'positions', 'quality']) fact(same(legacy[key], selectedControl[key]), `Authored single-Curve legacy control differs: ${key}`);
    callerLive();
    fact(new Set(rows.map(row => row.root)).size === 4 && new Set(rows.map(row => row.mesh)).size === 4 && new Set(rows.map(row => row.geometry)).size === 4 && new Set(rows.map(row => row.material)).size === 4, 'Focused resource population must have four distinct actual owned sets');
    return { ok: true, accepted, replacements, refusals, getterCalls, independentNativeCopies: true, legacyFullModelProfileRetained: true, authoredOneCurveControlExact: true, ownedResults: rows.length, distinctRoots: 4, distinctMeshes: 4, distinctGeometries: 4, distinctMaterials: 4,
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
