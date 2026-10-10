import { compileCadModel, curveDomain, sampleCurve } from '@barocss/cad';
import { parseBaroCadSelectedUniformCurveSource, BaroCadUniformCurveSourceError } from '@barocss/cad-interop/native-selected-uniform-curve';
import { parseBaroCadUniformCurveSource } from '@barocss/cad-interop/native-uniform-curve';
import { BaroCADSelectedUniformCurveBabylonLoader } from '@barocss/cad-interop/babylon-selected-uniform-curve';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { LinesMesh } from '@babylonjs/core/Meshes/linesMesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';

const fact = (condition, message) => { if (!condition) throw new Error(message); };
function same(a, b) {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) return ArrayBuffer.isView(a) && ArrayBuffer.isView(b) && a.constructor === b.constructor && a.length === b.length && Array.from(a).every((value, index) => Object.is(value, b[index]));
  const keys = Reflect.ownKeys(a); return keys.length === Reflect.ownKeys(b).length && keys.every(key => Object.hasOwn(b, key) && same(a[key], b[key]));
}
const bits = (a, b) => a?.length === b.length && Array.from(a).every((value, index) => Object.is(value, b[index]));

/** Default owns a genuine NullEngine Scene. An optional caller Scene/Engine remains caller-owned. */
export async function runSelectedUniformCurveBabylonRuntimeCheckpoint(asset, suppliedScene) {
  const ownScene = suppliedScene === undefined, engine = ownScene ? new NullEngine() : suppliedScene.getEngine(), scene = ownScene ? new Scene(engine) : suppliedScene;
  if (ownScene) scene.useRightHandedSystem = true;
  fact(scene instanceof Scene && !scene.isDisposed && scene.useRightHandedSystem, 'Focused checkpoint requires an actual live right-handed Scene');
  const baseline = { meshes: [...scene.meshes], materials: [...scene.materials], geometries: [...scene.geometries], nodes: [...scene.transformNodes], cameras: [...scene.cameras], activeCamera: scene.activeCamera };
  const source = asset.originalSource, options = (count = 129, curveId = 'target_curve') => ({ sourceVersion: 0, unitsPerMillimeter: 0.001, uniformCurveDisplay: { version: 1, count }, curveId });
  const compiled = compileCadModel(source, { sourceVersion: 0 }); fact(compiled.ok && same(compiled.model, asset.owned.originalModel), 'Full original source/Model authority differs');
  const selected = compiled.model.objects[1]; fact(selected.kind === 'curve' && selected.id === 'target_curve' && compiled.model.objects.length === 3, 'Genuine selected Curve ordinal differs');
  const caller = new Mesh('selected_uniform_focused_caller', scene); caller.setEnabled(false);
  const data = new VertexData(); data.positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]); data.indices = [0, 1, 2]; data.applyToMesh(caller);
  const callerGeometry = caller.geometry, callerMaterial = new StandardMaterial('selected_uniform_focused_caller_material', scene); caller.material = callerMaterial;
  const child = new TransformNode('selected_uniform_focused_caller_child', scene), callerCounters = { mesh: 0, geometry: 0, material: 0, child: 0, scene: 0, engine: 0 };
  fact(callerGeometry, 'Real focused caller Geometry is required');
  caller.onDisposeObservable.add(() => callerCounters.mesh++); callerMaterial.onDisposeObservable.add(() => callerCounters.material++); child.onDisposeObservable.add(() => callerCounters.child++);
  const callerGeometryDispose = callerGeometry.dispose; callerGeometry.dispose = function (...args) { callerCounters.geometry++; return callerGeometryDispose.apply(this, args); };
  const sceneObserver = scene.onDisposeObservable.add(() => callerCounters.scene++), engineObserver = engine.onDisposeObservable.add(() => callerCounters.engine++);
  const rows = [], accepted = [], replacements = [], refusals = [], extraMaterials = [];
  let getterCalls = 0;
  function observe(result, scenario) {
    const mesh = result.line, geometry = mesh.geometry, material = mesh.material;
    fact(mesh instanceof LinesMesh && geometry && material instanceof ShaderMaterial, 'Actual selected Babylon resources differ');
    const row = { result, scenario, mesh, geometry, material, meshDisposals: 0, geometryDisposals: 0, materialDisposals: 0 };
    mesh.onDisposeObservable.add(() => row.meshDisposals++); material.onDisposeObservable.add(() => row.materialDisposals++);
    const original = geometry.dispose; geometry.dispose = function (...args) { row.geometryDisposals++; return original.apply(this, args); }; rows.push(row); return row;
  }
  function callerLive() { fact(scene.meshes.includes(caller) && !caller.isDisposed() && caller.geometry === callerGeometry && !callerGeometry.isDisposed() && caller.material === callerMaterial && !child.isDisposed() && Object.values(callerCounters).every(value => value === 0), 'Caller resources were disposed or changed'); }
  function dispose(row) { row.result.dispose(); row.result.dispose(); fact(row.meshDisposals === 1 && row.geometryDisposals === 1 && row.materialDisposals === 1 && row.mesh.isDisposed() && row.geometry.isDisposed() && !scene.meshes.includes(row.mesh) && !scene.materials.includes(row.material), 'Owned triple must be disposed once'); callerLive(); }
  function refuse(name, action, code) { let error; try { action(); } catch (cause) { error = cause; } fact(error instanceof BaroCadUniformCurveSourceError && error.code === code, `Actual refusal differs: ${name}`); refusals.push({ name, errorName: error.name, code: error.code }); }
  try {
    for (const count of [2, 129]) {
      const input = options(count), loader = new BaroCADSelectedUniformCurveBabylonLoader(input);
      if (count === 129) { input.curveId = 'context_curve'; input.sourceVersion = 1; input.unitsPerMillimeter = 1; input.uniformCurveDisplay.version = 2; input.uniformCurveDisplay.count = 2; }
      const before = { meshes: scene.meshes.length, materials: scene.materials.length, geometries: scene.geometries.length }, result = loader.parse(source, scene), native = parseBaroCadSelectedUniformCurveSource(source, options(count)), row = observe(result, 'count-' + count), direct = sampleCurve(selected, count);
      for (const key of Object.keys(native)) fact(same(result[key], native[key]), `Full selected native data differs: ${key}`);
      fact(result.source === source && same(result.model, compiled.model) && result.selectedObjectIndex === 1 && result.curve !== result.model.objects[1] && same(result.curve, selected) &&
        same(result.unrenderedObjectIds, ['context_curve', 'context_plane']) && same(result.domain, curveDomain(selected)) && bits(result.parameters, direct.map(sample => sample.parameter)) && same(result.pointsMM, direct.map(sample => sample.point)), 'Whole Model/original Curve/domain/sample authority differs');
      fact(scene.meshes.length === before.meshes + 1 && scene.materials.length === before.materials + 1 && scene.geometries.length === before.geometries + 1 && row.mesh.parent === null && !row.mesh.isEnabled(), 'Returned candidate must be one initially disabled Scene-registered triple');
      const positions = row.mesh.getVerticesData('position'), indices = row.mesh.getIndices();
      fact(positions instanceof Float32Array && positions !== result.positions && bits(positions, native.positions) && row.mesh.getTotalVertices() === count &&
        bits(indices, Array.from({ length: count - 1 }, (_, index) => [index, index + 1]).flat()) && same(row.mesh.getVerticesDataKinds(), ['position']), 'Actual F32 target copy/adjacent line-list indices differ');
      for (let index = 0; index < count; index++) for (let axis = 0; axis < 3; axis++) fact(Object.is(positions[index * 3 + axis], Math.fround(result.pointsMM[index][axis] * 0.001)), 'Coordinates were not converted once');
      const meta = row.mesh.metadata.barocss;
      fact(meta.role === 'selected-uniform-curve-display-line' && meta.modelName === result.model.name && meta.curveId === result.curveId && meta.selectedObjectIndex === 1 &&
        same(meta.unrenderedObjectIds, result.unrenderedObjectIds) && bits(meta.nativeDomain, result.domain) && bits(meta.nativeParameters, result.parameters) && same(meta.nativeIntervals, result.intervals) && same(meta.quality, result.quality), 'Copied selected source-qualified metadata differs');
      fact(meta.nativeDomain !== result.domain && meta.nativeParameters !== result.parameters && meta.unrenderedObjectIds !== result.unrenderedObjectIds && meta.quality !== result.quality && meta.nativeIntervals.every((interval, index) => interval !== result.intervals[index]), 'Metadata aliases native result arrays');
      fact(bits(row.mesh.color.asArray(), [40 / 255, 201 / 255, 235 / 255]) && !row.material.needAlphaBlending() && same(row.material.options.attributes, ['position']) && same(row.material.options.uniforms, ['world', 'viewProjection', 'color']) && bits(Array.from(row.mesh.computeWorldMatrix(true).asArray()), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), 'Explicit material/style or original world identity changed');
      const retained = structuredClone(native); dispose(row); for (const key of Object.keys(retained)) fact(same(result[key], retained[key]), `Native CPU data lost after cleanup: ${key}`);
      fact(row.mesh.geometry === null && row.geometry.getVerticesData('position') === null, 'Disposed target Geometry still presents live position data');
      accepted.push({ count, optionSnapshotPreserved: true, fullModelObjects: 3, selectedObjectIndex: 1, unrenderedObjectIds: [...result.unrenderedObjectIds], directSamplerExact: true, metadataIndependent: true, actualF32Copy: true,
        vertexCount: count, indexCount: 2 * (count - 1), initiallyDisabledSceneRegistered: true, meshDisposals: row.meshDisposals, geometryDisposals: row.geometryDisposals, materialDisposals: row.materialDisposals, nativeCPUReadable: true });
    }
    const first = parseBaroCadSelectedUniformCurveSource(source, options()), second = parseBaroCadSelectedUniformCurveSource(source, options()), secondCopy = structuredClone(second), firstModel = structuredClone(first.model);
    fact(first.curve.controlPoints.every((point, index) => point !== first.model.objects[1].controlPoints[index]) && first.curve.knots !== first.model.objects[1].knots && first.curve.weights !== first.model.objects[1].weights && first.model !== second.model, 'Selected Curve/cross-parse copies alias');
    first.curve.controlPoints[0][0] += 1; first.curve.knots[0] += 1; first.curve.weights[0] += 1; fact(same(first.model, firstModel), 'Copied selected Curve changed whole Model');
    first.model.objects[0].controlPoints[0][0] += 1; first.positions[0] += 1; first.options.uniformCurveDisplay.count = 2;
    fact(same(second, secondCopy) && same(parseBaroCadSelectedUniformCurveSource(source, options()), secondCopy), 'Native return mutation changed another/later parse');
    const loader = new BaroCADSelectedUniformCurveBabylonLoader(options()), materialResult = loader.parse(source, scene), materialRow = observe(materialResult, 'caller-material-replacement');
    const replacementMaterial = new StandardMaterial('selected_uniform_focused_replacement', scene); extraMaterials.push(replacementMaterial); let replacementDisposals = 0; replacementMaterial.onDisposeObservable.add(() => replacementDisposals++);
    materialResult.line.material = replacementMaterial; fact(materialRow.materialDisposals === 0, 'Replacing explicit material unexpectedly disposed captured owned material'); dispose(materialRow);
    fact(replacementDisposals === 0 && scene.materials.includes(replacementMaterial), 'Caller replacement material was disposed');
    replacements.push({ scenario: 'material', ownedMeshDisposals: materialRow.meshDisposals, ownedGeometryDisposals: materialRow.geometryDisposals, ownedMaterialDisposals: materialRow.materialDisposals, callerReplacementMaterialDisposals: replacementDisposals, retained: true });
    const geometryResult = loader.parse(source, scene), geometryRow = observe(geometryResult, 'caller-geometry-and-child-replacement'), retainedPositions = Float32Array.from(geometryResult.positions);
    callerGeometry.applyToMesh(geometryResult.line); child.parent = geometryResult.line;
    fact(geometryResult.line.geometry === callerGeometry && !geometryRow.geometry.isDisposed(), 'Original owned Geometry must remain captured after public replacement'); dispose(geometryRow);
    fact(callerGeometry.meshes.includes(caller) && !callerGeometry.meshes.includes(geometryResult.line) && child.parent === null && !child.isDisposed() && bits(geometryResult.positions, retainedPositions), 'Caller foreign geometry/child/native CPU data lost');
    replacements.push({ scenario: 'geometry-and-child', ownedMeshDisposals: geometryRow.meshDisposals, ownedGeometryDisposals: geometryRow.geometryDisposals, ownedMaterialDisposals: geometryRow.materialDisposals, callerReplacementGeometryDisposals: callerCounters.geometry, callerChildDisposals: callerCounters.child, retained: true });
    for (const [name, input] of [['count1', options(1)], ['count130', options(130)]]) refuse(name, () => new BaroCADSelectedUniformCurveBabylonLoader(input), 'OPTIONS');
    const idGetter = options(); Object.defineProperty(idGetter, 'curveId', { enumerable: true, get() { getterCalls++; return 'target_curve'; } });
    const countGetter = options(); Object.defineProperty(countGetter.uniformCurveDisplay, 'count', { enumerable: true, get() { getterCalls++; return 129; } });
    refuse('curveIdGetter', () => new BaroCADSelectedUniformCurveBabylonLoader(idGetter), 'OPTIONS'); refuse('countGetter', () => new BaroCADSelectedUniformCurveBabylonLoader(countGetter), 'OPTIONS'); fact(getterCalls === 0, 'Constructor read unadmitted accessors');
    const beforeSceneRefusal = { meshes: [...scene.meshes], materials: [...scene.materials], geometries: [...scene.geometries] }, lhs = new Scene(engine), closed = new Scene(engine); closed.useRightHandedSystem = true; closed.dispose();
    try {
      for (const [name, candidate] of [['invalid', { useRightHandedSystem: true }], ['left-handed', lhs], ['disposed', closed]]) {
        let error; try { loader.parse(source, candidate); } catch (cause) { error = cause; }
        fact(error instanceof RangeError && error.code === undefined && error.message === 'BaroCAD selected uniform Babylon loading requires an actual live right-handed Scene', 'Frozen actual Scene guard differs'); refusals.push({ name, errorName: error.name, code: null });
      }
      fact(lhs.meshes.length === 0 && lhs.materials.length === 0 && lhs.geometries.length === 0, 'Invalid Scene refusal allocated target resources');
    } finally { lhs.dispose(); }
    fact(same(scene.meshes, beforeSceneRefusal.meshes) && same(scene.materials, beforeSceneRefusal.materials) && same(scene.geometries, beforeSceneRefusal.geometries), 'Separate Scene refusal changed accepted caller collections');
    refuse('legacyFullModelProfile', () => parseBaroCadUniformCurveSource(source, { sourceVersion: 0, unitsPerMillimeter: 0.001, uniformCurveDisplay: { version: 1, count: 129 } }), 'PROFILE');
    const control = '@model single_control {version:0;length-unit:mm;@curve #single_curve {type:nurbs;degree:1;knots:[-3,-3,7,7];control-points:[[0,-0,0],[2,1,0]];weights:[1,1];}}';
    const legacy = parseBaroCadUniformCurveSource(control, { sourceVersion: 0, unitsPerMillimeter: 0.001, uniformCurveDisplay: { version: 1, count: 129 } }), selectedControl = parseBaroCadSelectedUniformCurveSource(control, options(129, 'single_curve'));
    for (const key of ['source', 'model', 'curveId', 'domain', 'parameters', 'pointsMM', 'intervals', 'positions', 'quality']) fact(same(legacy[key], selectedControl[key]), `Authored one-Curve legacy control changed: ${key}`);
    callerLive(); fact(new Set(rows.map(row => row.mesh.uniqueId)).size === 4 && new Set(rows.map(row => row.geometry.uniqueId)).size === 4 && new Set(rows.map(row => row.material.uniqueId)).size === 4, 'Focused four-triple identities differ');
    return { ok: true, accepted, replacements, refusals, getterCalls, independentNativeCopies: true, legacyOneCurveControlExact: true, legacyWholeModelProfileRetained: true, ownedResults: rows.length,
      distinctMeshes: 4, distinctGeometries: 4, distinctMaterials: 4, meshDisposals: rows.reduce((sum, row) => sum + row.meshDisposals, 0), geometryDisposals: rows.reduce((sum, row) => sum + row.geometryDisposals, 0), materialDisposals: rows.reduce((sum, row) => sum + row.materialDisposals, 0),
      caller: { ...callerCounters, retained: true }, usesSuppliedScene: !ownScene, callerObservation: 'before focused caller teardown; supplied Scene/Engine never disposed by this helper',
      scope: 'Actual selected neutral/compiler/sampler and Babylon objects/copied fields/Scene guards/replacements/disposal. Four focused triples separate from host14; no renderer/pixels/HTTP/fault/late-abort execution here.' };
  } finally {
    for (const row of rows) row.result.dispose();
    for (const material of extraMaterials) material.dispose();
    caller.dispose(true, false); callerMaterial.dispose(); child.dispose();
    scene.onDisposeObservable.remove(sceneObserver); engine.onDisposeObservable.remove(engineObserver);
    fact(same(scene.meshes, baseline.meshes) && same(scene.materials, baseline.materials) && same(scene.geometries, baseline.geometries) && same(scene.transformNodes, baseline.nodes) && same(scene.cameras, baseline.cameras) && scene.activeCamera === baseline.activeCamera, 'Focused helper failed to restore caller Scene collections/camera');
    if (ownScene) { scene.dispose(); engine.dispose(); }
  }
}
