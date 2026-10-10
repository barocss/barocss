import { buildVLinearSurfacePlaneSection, validateVLinearSurfacePlaneSection } from '@barocss/cad';
import { parseBaroCadUniformCurveSource } from '@barocss/cad-interop/native-uniform-curve';
import { BaroCADUniformCurvePixi3DLoader } from '@barocss/cad-interop/pixi3d-uniform-curve';
import { createNativeOptions, requireFact, assertNative, assertBuffer, proveSection, SectionUniformPixi3DHostError } from './section-uniform-curve-pixi3d-fixture.mjs';
import { Camera, Container3D, Mesh3D, MeshGeometry3D, StandardMaterial } from 'pixi3d/pixi7';
import { DRAW_MODES } from 'pixi.js';
import { observeSectionUniformResult } from './section-uniform-curve-pixi3d-observer.mjs';

const NATIVE_KEYS = ['format', 'version', 'mode', 'source', 'model', 'curveId', 'options', 'domain', 'parameters', 'pointsMM', 'intervals', 'positions', 'quality'];
const nativeFields = result => Object.fromEntries(NATIVE_KEYS.map(key => [key, result[key]]));
const clone = value => structuredClone(value);
function receipt(name, error) {
  return { name, errorName: error.name, code: error.code ?? null, message: error.message,
    diagnostics: error.diagnostics ?? [], causeName: error.cause?.name ?? null, causeCode: error.cause?.code ?? null };
}
export function createSectionUniformPixi3DHost({ stage, camera, onChange = () => {} }) {
  let accepted = null, peakLivePairs = 0;
  const records = [], allResources = [], events = [];
  const counters = { adapterAttempts: 0, parseAttempts: 0, loadAttempts: 0, acceptedResults: 0, partialResults: 0,
    progressEvents: 0, synchronousRefusals: 0, transportRefusals: 0 };
  const livePairs = () => allResources.filter(row => row.rootDisposals === 0 || row.meshDisposals === 0 || row.geometryDisposals === 0 || row.materialDisposals === 0).length;
  function loader(options = createNativeOptions()) { counters.adapterAttempts++; return new BaroCADUniformCurvePixi3DLoader(options); }
  function parse(source, options = createNativeOptions()) { counters.parseAttempts++; return loader(options).parse(source); }
  function loadAsync(url, transport = {}) { counters.loadAttempts++; return loader().loadAsync(url, transport); }
  function observe(result) {
    const resources = observeSectionUniformResult(result);
    requireFact(resources.length === 1, 'One world line strip must own exactly one root/mesh/geometry/material set');
    allResources.push(...resources);
    peakLivePairs = Math.max(peakLivePairs, livePairs());
    events.push({ type: 'prepared', livePairs: livePairs(), totalPairs: allResources.length });
    return resources;
  }
  function verifyResult(result, native, section) {
    assertNative(nativeFields(result), native, 'target-native');
    assertNative(result.model, section.world.model);
    const root = result.root, mesh = result.mesh, geometry = mesh.geometry, material = mesh.material;
    requireFact(root instanceof Container3D && mesh instanceof Mesh3D && geometry instanceof MeshGeometry3D && material instanceof StandardMaterial &&
      root.parent === null && root.children.length === 1 && root.children[0] === mesh && mesh.parent === root, 'Candidate must be one detached world Mesh3D root');
    requireFact(geometry.positions?.buffer instanceof Float32Array && geometry.positions.buffer !== native.positions &&
      geometry.positions.componentType === 5126 && geometry.positions.componentCount === 3 && geometry.positions.normalized === false, 'Independent world Float32 position upload changed');
    assertBuffer(geometry.positions.buffer, native.positions);
    assertNative(geometry.positions.min, [0, 1, 2].map(axis => Math.min(...Array.from(native.positions).filter((_, index) => index % 3 === axis))));
    assertNative(geometry.positions.max, [0, 1, 2].map(axis => Math.max(...Array.from(native.positions).filter((_, index) => index % 3 === axis))));
    requireFact(geometry.normals?.buffer instanceof Float32Array && geometry.normals.componentType === 5126 && geometry.normals.componentCount === 3 &&
      geometry.normals.normalized === false, 'Shader-only normal attribute changed');
    const shaderNormals = new Float32Array(387);
    for (let index = 2; index < shaderNormals.length; index += 3) shaderNormals[index] = 1;
    assertBuffer(geometry.normals.buffer, shaderNormals);
    requireFact(geometry.indices?.buffer instanceof Uint16Array && geometry.indices.componentType === 5123 && geometry.indices.componentCount === 1 &&
      geometry.indices.normalized === false, 'World strip index attribute changed');
    assertBuffer(geometry.indices.buffer, Array.from({ length: 129 }, (_, index) => index));
    requireFact(!geometry.uvs && !geometry.tangents && !geometry.colors && !geometry.targets && !geometry.joints && !geometry.weights, 'No Surface/UV/other native upload allowed');
    requireFact(material.drawMode === DRAW_MODES.LINE_STRIP && material.unlit === true && material.doubleSided === true && material.camera === camera,
      'World strip material or explicit caller camera changed');
    assertBuffer(material.baseColor.rgba, Float32Array.from([40 / 255, 201 / 255, 235 / 255, 1]));
    for (const object of [root, mesh]) {
      assertNative([object.position.x, object.position.y, object.position.z], [0, 0, 0]);
      assertNative([object.scale.x, object.scale.y, object.scale.z], [1, 1, 1]);
      assertBuffer(object.rotationQuaternion.array, [0, 0, 0, 1]);
    }
  }

  function prepare(asset) {
    const section = proveSection(asset);
    const native = parseBaroCadUniformCurveSource(asset.worldSource, createNativeOptions());
    assertNative(native.model, section.world.model);
    return { section, native };
  }
  function stageResult(asset, prepared, result, state) {
    requireFact(camera instanceof Camera && !camera.destroyed, 'A real live caller Pixi3D Camera is required');
    result.mesh.material.camera = camera;
    const resources = observe(result);
    try { verifyResult(result, prepared.native, prepared.section); }
    catch (error) { result.dispose(); result.dispose(); throw error; }
    return { asset, section: prepared.section, native: prepared.native, result,
      readout: clone({ section: prepared.section, native: prepared.native }), state, resources };
  }
  function admit(record) {
    const previous = accepted;
    stage.addChild(record.result.root);
    accepted = record;
    records.push(record); counters.acceptedResults++;
    if (previous) { previous.result.dispose(); previous.result.dispose(); }
    events.push({ type: 'accepted', state: record.state, livePairs: livePairs() });
    onChange(record);
    return record;
  }
  function cameraState() {
    return { main: Camera.main, renderer: camera.renderer, position: [camera.position.x, camera.position.y, camera.position.z],
      quaternion: Array.from(camera.rotationQuaternion.array), scale: [camera.scale.x, camera.scale.y, camera.scale.z],
      orthographic: camera.orthographic, orthographicSize: camera.orthographicSize, aspect: camera.aspect ?? null, near: camera.near, far: camera.far,
      projection: Array.from(camera.projection.array), view: Array.from(camera.view.array), viewProjection: Array.from(camera.viewProjection.array) };
  }
  function pose(object) {
    return { position: [object.position.x, object.position.y, object.position.z ?? null], scale: [object.scale.x, object.scale.y, object.scale.z ?? null],
      quaternion: object.rotationQuaternion ? Array.from(object.rotationQuaternion.array) : null, rotation: typeof object.rotation === 'number' ? object.rotation : null,
      visible: object.visible, renderable: object.renderable, alpha: object.alpha };
  }
  function snapshotAccepted() {
    requireFact(accepted, 'An accepted result is required');
    const record = accepted, result = record.result, geometry = result.mesh.geometry;
    return { record, result, asset: record.asset, section: record.section, native: record.native, readout: record.readout,
      resources: record.resources, cpu: clone({ asset: record.asset, section: record.section, native: record.native, readout: record.readout }),
      children: [...stage.children], rootChildren: [...result.root.children], root: result.root, mesh: result.mesh,
      geometry, material: result.mesh.material, materialCamera: result.mesh.material.camera,
      positionAttribute: geometry.positions, normalAttribute: geometry.normals, indexAttribute: geometry.indices,
      positionArray: geometry.positions.buffer, normalArray: geometry.normals.buffer, indexArray: geometry.indices.buffer,
      positionData: Array.from(geometry.positions.buffer), normalData: Array.from(geometry.normals.buffer), indexData: Array.from(geometry.indices.buffer),
      attributeData: clone({ positions: geometry.positions, normals: geometry.normals, indices: geometry.indices }),
      materialData: { color: Array.from(result.mesh.material.baseColor.rgba), unlit: result.mesh.material.unlit, doubleSided: result.mesh.material.doubleSided, drawMode: result.mesh.material.drawMode },
      camera: cameraState(), rootParent: result.root.parent, meshParent: result.mesh.parent,
      resourceCounts: record.resources.map(row => [row.rootDisposals, row.meshDisposals, row.geometryDisposals, row.materialDisposals]),
      poses: [stage, ...stage.children, result.mesh].map(object => ({ object, values: pose(object) })) };
  }
  function retained(before) {
    requireFact(accepted === before.record && accepted.result === before.result && accepted.asset === before.asset && accepted.section === before.section && accepted.native === before.native &&
      accepted.readout === before.readout && accepted.resources === before.resources, 'Refusal replaced accepted references');
    assertNative({ asset: accepted.asset, section: accepted.section, native: accepted.native, readout: accepted.readout }, before.cpu);
    requireFact(stage.children.length === before.children.length && stage.children.every((object, index) => object === before.children[index]), 'Refusal changed caller Stage order');
    requireFact(accepted.result.root === before.root && accepted.result.mesh === before.mesh && before.mesh.geometry === before.geometry && before.mesh.material === before.material &&
      before.root.parent === before.rootParent && before.mesh.parent === before.meshParent && before.material.camera === before.materialCamera, 'Refusal replaced target objects or camera');
    requireFact(before.root.children.length === before.rootChildren.length && before.root.children.every((object, index) => object === before.rootChildren[index]), 'Refusal changed root children');
    requireFact(before.geometry.positions === before.positionAttribute && before.geometry.normals === before.normalAttribute && before.geometry.indices === before.indexAttribute &&
      before.positionAttribute.buffer === before.positionArray && before.normalAttribute.buffer === before.normalArray && before.indexAttribute.buffer === before.indexArray, 'Refusal replaced target attribute/buffer references');
    assertBuffer(before.positionArray, before.positionData); assertBuffer(before.normalArray, before.normalData); assertBuffer(before.indexArray, before.indexData);
    assertNative({ positions: before.geometry.positions, normals: before.geometry.normals, indices: before.geometry.indices }, before.attributeData, 'unchanged-target-attributes');
    assertNative({ color: Array.from(before.material.baseColor.rgba), unlit: before.material.unlit, doubleSided: before.material.doubleSided, drawMode: before.material.drawMode }, before.materialData, 'unchanged-material');
    assertNative(accepted.resources.map(row => [row.rootDisposals, row.meshDisposals, row.geometryDisposals, row.materialDisposals]), before.resourceCounts);
    const currentCamera = cameraState(); requireFact(currentCamera.main === before.camera.main && currentCamera.renderer === before.camera.renderer && !camera.destroyed, 'Caller camera/main/renderer changed');
    for (const field of ['position', 'quaternion', 'scale', 'orthographic', 'orthographicSize', 'aspect', 'near', 'far', 'projection', 'view', 'viewProjection']) assertNative(currentCamera[field], before.camera[field], 'camera.' + field);
    for (const original of before.poses) assertNative(pose(original.object), original.values, 'unchanged-stage-pose');
  }

  const host = {
    get accepted() { return accepted; }, get records() { return records; }, get allResources() { return allResources; }, get events() { return events; },
    get peakLivePairs() { return peakLivePairs; },
    get counts() { return { ...counters, livePairs: livePairs(), peakLivePairs, pairs: allResources.length }; },
    load(asset) {
      const prepared = prepare(asset);
      return admit(stageResult(asset, prepared, parse(asset.worldSource), 'original'));
    },
    async coldReopen(asset, worldURL) {
      const prepared = prepare(asset), result = await loadAsync(worldURL);
      return admit(stageResult(asset, prepared, result, 'cold-reopen'));
    },
    runRefusals(asset, afterRefusal = () => {}) {
      const before = snapshotAccepted(), originalAsset = clone(asset), refusals = [];
      let getterCalls = 0;
      function refuse(name, action, errorName, code, partial = false) {
        const resourcesBefore = allResources.length;
        let caught;
        try { action(); } catch (error) { caught = error; }
        requireFact(caught instanceof Error, `${name}: expected actual refusal`);
        requireFact(caught.name === errorName && caught.code === code, `${name}: unexpected ${caught.name}/${caught.code}`);
        if (name === 'malformed-world-source') requireFact(caught.diagnostics.some(value => value.code === 'SYNTAX'), 'Actual compiler SYNTAX diagnostic required');
        requireFact(allResources.length === resourcesBefore + (partial ? 1 : 0), `${name}: unexpected successful set allocation`);
        if (partial) {
          const row = allResources.at(-1);
          requireFact(row.rootDisposals === 1 && row.meshDisposals === 1 && row.geometryDisposals === 1 && row.materialDisposals === 1, 'Controlled detached set cleanup must happen once');
        }
        retained(before); assertNative(asset, originalAsset); requireFact(getterCalls === 0, 'Accessor was invoked');
        const observation = { ...receipt(name, caught), pairsBefore: resourcesBefore, pairsAfter: allResources.length, acceptedRetained: true };
        refusals.push(observation); afterRefusal(observation);
      }
      const sectionName = 'VLinearSurfacePlaneSectionError', uniformName = 'BaroCadUniformCurveSourceError';
      const builder = request => buildVLinearSurfacePlaneSection(request.surfaceAsset, request.planeAsset, request.options);
      const requestChange = change => { const request = clone(asset.request); change(request); return builder(request); };
      refuse('maximum-observations4', () => requestChange(request => { request.options.maximumObservations = 4; }), sectionName, 'BUDGET');
      refuse('duplicate-parent-source-id', () => requestChange(request => { request.planeAsset.sourceId = request.surfaceAsset.sourceId; }), sectionName, 'IDENTITY');
      refuse('selected-surface-signed-zero', () => requestChange(request => { request.surfaceAsset.surface.controlPoints[0][0][0] = -0; }), sectionName, 'SOURCE');
      refuse('parent-source-accessor', () => {
        const request = clone(asset.request);
        Object.defineProperty(request.surfaceAsset, 'source', { enumerable: true, get() { getterCalls++; return asset.request.surfaceAsset.source; } });
        return builder(request);
      }, sectionName, 'INPUT');
      refuse('unselected-sibling-weight', () => { const owned = clone(asset.owned); owned.originalModels[0].objects[0].weights[0] = 2; return validateVLinearSurfacePlaneSection(owned); }, sectionName, 'OWNED');
      refuse('plane-uv-mm', () => { const owned = clone(asset.owned); owned.pcurves.plane.lengthUnit = 'mm'; return validateVLinearSurfacePlaneSection(owned); }, sectionName, 'OWNED');
      for (const count of [1, 130]) refuse(`uniform-count${count}`, () => parse(asset.worldSource, { ...createNativeOptions(), uniformCurveDisplay: { version: 1, count } }), uniformName, 'OPTIONS');
      refuse('uniform-scale0', () => parse(asset.worldSource, { ...createNativeOptions(), unitsPerMillimeter: 0 }), uniformName, 'OPTIONS');
      refuse('uniform-count-accessor', () => {
        const options = createNativeOptions();
        Object.defineProperty(options.uniformCurveDisplay, 'count', { enumerable: true, get() { getterCalls++; return 129; } });
        return parse(asset.worldSource, options);
      }, uniformName, 'OPTIONS');
      refuse('malformed-world-source', () => parse('@model {'), uniformName, 'SOURCE');
      refuse('whole-parent-profile', () => parse(asset.request.surfaceAsset.source), uniformName, 'PROFILE');
      refuse('world-F32-underflow', () => parse(asset.worldSource, { ...createNativeOptions(), unitsPerMillimeter: 1e-50 }), uniformName, 'POSITIONS');
      refuse('host-world-source-binding', () => { const candidate = clone(asset); candidate.worldSource = candidate.request.surfaceAsset.source; return prepare(candidate); }, 'SectionUniformPixi3DHostError', 'SOURCE_BINDING');
      refuse('host-swapped-uv-binding', () => { const candidate = clone(asset); [candidate.surfaceUV, candidate.planeUV] = [candidate.planeUV, candidate.surfaceUV]; return prepare(candidate); }, 'SectionUniformPixi3DHostError', 'UV_BINDING');
      refuse('controlled-detached-preparation', () => {
        const prepared = prepare(asset), result = parse(asset.worldSource);
        const record = stageResult(asset, prepared, result, 'controlled-partial'); counters.partialResults++;
        try { throw new SectionUniformPixi3DHostError('STAGED_PREPARATION_REFUSAL', 'Controlled example refusal after one genuine detached world root/mesh/geometry/material set'); }
        finally { record.result.dispose(); record.result.dispose(); }
      }, 'SectionUniformPixi3DHostError', 'STAGED_PREPARATION_REFUSAL', true);
      counters.synchronousRefusals += refusals.length;
      events.push({ type: 'sync-refusals', count: refusals.length, getterCalls, livePairs: livePairs() });
      return { refusals, getterCalls, acceptedRetained: true };
    },
    async runTransportRefusals(worldURL, afterRefusal = () => {}) {
      const before = snapshotAccepted(), refusals = [];
      let getterCalls = 0;
      async function refuse(name, transport, expectedName, expectedCode, standingError = null, progressCount = () => 0) {
        const resourcesBefore = allResources.length;
        let caught;
        try { await loadAsync(worldURL, transport); } catch (error) { caught = error; }
        requireFact(caught instanceof Error && caught.name === expectedName && (caught.code ?? null) === expectedCode, `${name}: actual transport refusal changed`);
        if (standingError) requireFact(caught === standingError, 'Caller progress error identity changed');
        requireFact(allResources.length === resourcesBefore, 'Transport refusal allocated a target set');
        requireFact(getterCalls === 0, 'Transport accessor was invoked');
        retained(before);
        const progressEvents = progressCount();
        if (['progress-stop', 'progress-abort', 'progress-throw'].includes(name)) requireFact(progressEvents > 0, 'Actual progress callback was not observed');
        counters.progressEvents += progressEvents;
        const observation = { ...receipt(name, caught), progressEvents, sameCallerError: standingError ? caught === standingError : null,
          pairsBefore: resourcesBefore, pairsAfter: allResources.length, acceptedRetained: true };
        refusals.push(observation); await afterRefusal(observation);
      }
      const aborted = new AbortController(); aborted.abort();
      await refuse('pre-aborted', { signal: aborted.signal }, 'AbortError', 'ABORT_ERR');
      let stoppedProgress = 0;
      await refuse('progress-stop', { onProgress() { stoppedProgress++; return false; } }, 'AbortError', 'ABORT_ERR', null, () => stoppedProgress);
      const controller = new AbortController(); let abortedProgress = 0;
      await refuse('progress-abort', { signal: controller.signal, onProgress() { abortedProgress++; controller.abort(); } }, 'AbortError', 'ABORT_ERR', null, () => abortedProgress);
      const callerError = new Error('Actual caller progress refusal'); let thrownProgress = 0;
      await refuse('progress-throw', { onProgress() { thrownProgress++; throw callerError; } }, 'Error', null, callerError, () => thrownProgress);
      const transport = {}; Object.defineProperty(transport, 'onProgress', { enumerable: true, get() { getterCalls++; return () => {}; } });
      await refuse('transport-progress-accessor', transport, 'TypeError', null);
      counters.transportRefusals += refusals.length;
      events.push({ type: 'transport-refusals', count: refusals.length, getterCalls, livePairs: livePairs() });
      return { refusals, getterCalls, acceptedRetained: true };
    },
    dispose() {
      if (!accepted) return;
      const previous = accepted; accepted = null;
      previous.result.dispose(); previous.result.dispose();
      events.push({ type: 'disposed', livePairs: livePairs() });
      onChange(null);
    },
  };
  return host;
}
