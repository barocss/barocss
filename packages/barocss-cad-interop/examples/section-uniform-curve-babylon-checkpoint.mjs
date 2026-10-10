import { buildVLinearSurfacePlaneSection, validateVLinearSurfacePlaneSection } from '@barocss/cad';
import { parseBaroCadUniformCurveSource } from '@barocss/cad-interop/native-uniform-curve';
import { BaroCADUniformCurveBabylonLoader } from '@barocss/cad-interop/babylon-uniform-curve';
import { createNativeOptions, requireFact, assertNative, assertBuffer, proveSection, SectionUniformBabylonHostError } from './section-uniform-curve-babylon-fixture.mjs';
import { Scene } from '@babylonjs/core/scene.js';
import { LinesMesh } from '@babylonjs/core/Meshes/linesMesh.js';
import { observeSectionUniformResult } from './section-uniform-curve-babylon-observer.mjs';

const NATIVE_KEYS = ['format', 'version', 'mode', 'source', 'model', 'curveId', 'options', 'domain', 'parameters', 'pointsMM', 'intervals', 'positions', 'quality'];
const nativeFields = result => Object.fromEntries(NATIVE_KEYS.map(key => [key, result[key]]));
const clone = value => structuredClone(value);
function receipt(name, error) {
  return { name, errorName: error.name, code: error.code ?? null, message: error.message,
    diagnostics: error.diagnostics ?? [], causeName: error.cause?.name ?? null, causeCode: error.cause?.code ?? null };
}
export function createSectionUniformBabylonHost({ scene, onChange = () => {} }) {
  let accepted = null, peakLiveTriples = 0;
  const records = [], allResources = [], events = [];
  const counters = { adapterAttempts: 0, parseAttempts: 0, loadAttempts: 0, acceptedResults: 0, partialResults: 0,
    progressEvents: 0, synchronousRefusals: 0, transportRefusals: 0 };
  const liveTriples = () => allResources.filter(row => row.meshDisposals === 0 || row.geometryDisposals === 0 || row.materialDisposals === 0).length;
  function loader(options = createNativeOptions()) { counters.adapterAttempts++; return new BaroCADUniformCurveBabylonLoader(options); }
  function parse(source, options = createNativeOptions(), targetScene = scene) { counters.parseAttempts++; return loader(options).parse(source, targetScene); }
  function loadAsync(url, transport = {}) { counters.loadAttempts++; return loader().loadAsync(url, scene, transport); }
  function observe(result) {
    const resources = observeSectionUniformResult(result);
    requireFact(resources.length === 1, 'One world Line must own exactly one resource triple');
    allResources.push(...resources);
    peakLiveTriples = Math.max(peakLiveTriples, liveTriples());
    events.push({ type: 'prepared', liveTriples: liveTriples(), totalTriples: allResources.length });
    return resources;
  }
  function verifyResult(result, native, section) {
    assertNative(nativeFields(result), native, 'target-native');
    assertNative(result.model, section.world.model);
    const line = result.line, geometry = line.geometry;
    requireFact(line instanceof LinesMesh && line.getScene() === scene && scene.meshes.includes(line) &&
      line.parent === null && !line.isEnabled(), 'Candidate must be a disabled Scene-registered world LinesMesh');
    requireFact(geometry && scene.geometries.includes(geometry) && line.getTotalVertices() === 129, 'World position upload changed');
    requireFact(geometry.getVerticesDataKinds().length === 1 && geometry.getVerticesDataKinds()[0] === 'position', 'Only native world position data may be uploaded');
    assertBuffer(line.getVerticesData('position'), native.positions);
    const expectedIndices = Array.from({ length: 128 }, (_, index) => [index, index + 1]).flat();
    assertBuffer(line.getIndices(), expectedIndices);
    requireFact(line.material?.getClassName() === 'ShaderMaterial' && scene.materials.includes(line.material), 'Explicit world ShaderMaterial changed');
    const binding = line.metadata?.barocss;
    requireFact(binding?.curveId === native.curveId && binding?.modelName === native.model.name, 'Native world qualification changed');
    assertNative(binding.nativeParameters, native.parameters);
    assertNative(binding.nativeIntervals, native.intervals);
    assertNative(line.position.asArray(), [0, 0, 0]); assertNative(line.rotation.asArray(), [0, 0, 0]); assertNative(line.scaling.asArray(), [1, 1, 1]);
  }

  function prepare(asset) {
    const section = proveSection(asset);
    const native = parseBaroCadUniformCurveSource(asset.worldSource, createNativeOptions());
    assertNative(native.model, section.world.model);
    return { section, native };
  }
  function stage(asset, prepared, result, state) {
    const resources = observe(result);
    try { verifyResult(result, prepared.native, prepared.section); }
    catch (error) { result.dispose(); result.dispose(); throw error; }
    return { asset, section: prepared.section, native: prepared.native, result,
      readout: clone({ section: prepared.section, native: prepared.native }), state, resources };
  }
  function admit(record) {
    const previous = accepted;
    record.result.line.setEnabled(true);
    accepted = record;
    records.push(record); counters.acceptedResults++;
    if (previous) { previous.result.dispose(); previous.result.dispose(); }
    events.push({ type: 'accepted', state: record.state, liveTriples: liveTriples() });
    onChange(record);
    return record;
  }
  function sceneCollections() {
    return { meshes: [...scene.meshes], materials: [...scene.materials], geometries: [...scene.geometries],
      transformNodes: [...scene.transformNodes], cameras: [...scene.cameras], lights: [...scene.lights] };
  }
  function snapshotAccepted() {
    requireFact(accepted, 'An accepted result is required');
    const record = accepted, line = record.result.line;
    const positionBuffer = line.geometry.getVertexBuffer('position');
    return { record, result: record.result, asset: record.asset, section: record.section, native: record.native, readout: record.readout,
      resources: record.resources, cpu: clone({ asset: record.asset, section: record.section, native: record.native, readout: record.readout }),
      collections: sceneCollections(), line, geometry: line.geometry, material: line.material,
      positionBuffer, positionDataReference: positionBuffer.getData(), positionArray: line.getVerticesData('position'), indexArray: line.getIndices(),
      positionData: Array.from(line.getVerticesData('position')), indexData: Array.from(line.getIndices()), enabled: line.isEnabled(), parent: line.parent,
      metadata: line.metadata, metadataCopy: clone(line.metadata),
      rightHanded: scene.useRightHandedSystem, activeCamera: scene.activeCamera,
      resourceCounts: record.resources.map(row => [row.meshDisposals, row.geometryDisposals, row.materialDisposals]),
      scenePoses: [...scene.meshes, ...scene.cameras].map(object => ({ object, position: object.position.asArray(), rotation: object.rotation.asArray(),
        quaternion: object.rotationQuaternion?.asArray() ?? null, scaling: object.scaling?.asArray() ?? null })) };
  }
  function retained(before) {
    requireFact(accepted === before.record && accepted.result === before.result && accepted.asset === before.asset && accepted.section === before.section && accepted.native === before.native &&
      accepted.readout === before.readout && accepted.resources === before.resources, 'Refusal replaced accepted references');
    assertNative({ asset: accepted.asset, section: accepted.section, native: accepted.native, readout: accepted.readout }, before.cpu);
    for (const [name, original] of Object.entries(before.collections)) {
      const actual = scene[name];
      requireFact(actual.length === original.length && actual.every((object, index) => object === original[index]), `Refusal changed Scene ${name}`);
    }
    requireFact(scene.useRightHandedSystem === before.rightHanded && scene.activeCamera === before.activeCamera && !scene.isDisposed, 'Refusal changed caller Scene');
    requireFact(accepted.result.line === before.line && before.line.geometry === before.geometry && before.line.material === before.material &&
      before.line.parent === before.parent && before.line.isEnabled() === before.enabled, 'Refusal replaced or changed target objects');
    requireFact(before.geometry.getVertexBuffer('position') === before.positionBuffer && before.positionBuffer.getData() === before.positionDataReference &&
      before.line.getVerticesData('position') === before.positionArray && before.line.getIndices() === before.indexArray, 'Refusal replaced target buffer references');
    assertBuffer(before.positionArray, before.positionData); assertBuffer(before.indexArray, before.indexData);
    requireFact(before.line.metadata === before.metadata, 'Refusal replaced native metadata'); assertNative(before.line.metadata, before.metadataCopy);
    assertNative(accepted.resources.map(row => [row.meshDisposals, row.geometryDisposals, row.materialDisposals]), before.resourceCounts);
    for (const pose of before.scenePoses) {
      assertNative(pose.object.position.asArray(), pose.position); assertNative(pose.object.rotation.asArray(), pose.rotation);
      assertNative(pose.object.rotationQuaternion?.asArray() ?? null, pose.quaternion); assertNative(pose.object.scaling?.asArray() ?? null, pose.scaling);
    }
  }

  const host = {
    get accepted() { return accepted; }, get records() { return records; }, get allResources() { return allResources; }, get events() { return events; },
    get peakLiveTriples() { return peakLiveTriples; },
    get counts() { return { ...counters, liveTriples: liveTriples(), peakLiveTriples, triples: allResources.length }; },
    load(asset) {
      const prepared = prepare(asset);
      return admit(stage(asset, prepared, parse(asset.worldSource), 'original'));
    },
    async coldReopen(asset, worldURL) {
      const prepared = prepare(asset), result = await loadAsync(worldURL);
      return admit(stage(asset, prepared, result, 'cold-reopen'));
    },
    runRefusals(asset) {
      const before = snapshotAccepted(), originalAsset = clone(asset), refusals = [];
      let getterCalls = 0;
      function refuse(name, action, errorName, code, partial = false) {
        const resourcesBefore = allResources.length;
        let caught;
        try { action(); } catch (error) { caught = error; }
        requireFact(caught instanceof Error, `${name}: expected actual refusal`);
        requireFact(caught.name === errorName && (caught.code ?? null) === code, `${name}: unexpected ${caught.name}/${caught.code}`);
        if (name === 'malformed-world-source') requireFact(caught.diagnostics.some(value => value.code === 'SYNTAX'), 'Actual compiler SYNTAX diagnostic required');
        requireFact(allResources.length === resourcesBefore + (partial ? 1 : 0), `${name}: unexpected successful triple allocation`);
        if (partial) {
          const row = allResources.at(-1);
          requireFact(row.meshDisposals === 1 && row.geometryDisposals === 1 && row.materialDisposals === 1, 'Controlled disabled triple cleanup must happen once');
        }
        retained(before); assertNative(asset, originalAsset); requireFact(getterCalls === 0, 'Accessor was invoked');
        refusals.push({ ...receipt(name, caught), triplesBefore: resourcesBefore, triplesAfter: allResources.length, acceptedRetained: true });
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
      refuse('host-world-source-binding', () => { const candidate = clone(asset); candidate.worldSource = candidate.request.surfaceAsset.source; return prepare(candidate); }, 'SectionUniformBabylonHostError', 'SOURCE_BINDING');
      refuse('host-swapped-uv-binding', () => { const candidate = clone(asset); [candidate.surfaceUV, candidate.planeUV] = [candidate.planeUV, candidate.surfaceUV]; return prepare(candidate); }, 'SectionUniformBabylonHostError', 'UV_BINDING');
      refuse('controlled-disabled-preparation', () => {
        const prepared = prepare(asset), result = parse(asset.worldSource);
        const record = stage(asset, prepared, result, 'controlled-partial'); counters.partialResults++;
        try { throw new SectionUniformBabylonHostError('STAGED_PREPARATION_REFUSAL', 'Controlled example refusal after one genuine disabled Line triple'); }
        finally { record.result.dispose(); record.result.dispose(); }
      }, 'SectionUniformBabylonHostError', 'STAGED_PREPARATION_REFUSAL', true);
      let leftHandedScene;
      refuse('separate-left-handed-scene', () => {
        const engine = scene.getEngine(), previousScenes = [...engine.scenes], candidateScene = new Scene(engine);
        const observation = { sceneDisposals: 0, meshes: 0, geometries: 0, materials: 0 };
        candidateScene.onDisposeObservable.add(() => { observation.sceneDisposals++; });
        try {
          requireFact(candidateScene.useRightHandedSystem === false, 'Separate Scene must be genuinely left-handed');
          return parse(asset.worldSource, createNativeOptions(), candidateScene);
        } finally {
          observation.meshes = candidateScene.meshes.length; observation.geometries = candidateScene.geometries.length; observation.materials = candidateScene.materials.length;
          candidateScene.dispose(); leftHandedScene = observation;
          requireFact(observation.meshes === 0 && observation.geometries === 0 && observation.materials === 0 && observation.sceneDisposals === 1, 'Left-handed Scene guard allocated Loader resources or cleanup changed');
          requireFact(engine.scenes.length === previousScenes.length && engine.scenes.every((value, index) => value === previousScenes[index]), 'Separate Scene cleanup changed caller Engine scenes');
        }
      }, 'RangeError', null);
      counters.synchronousRefusals += refusals.length;
      events.push({ type: 'sync-refusals', count: refusals.length, getterCalls, liveTriples: liveTriples() });
      return { refusals, getterCalls, acceptedRetained: true, leftHandedScene };
    },
    async runTransportRefusals(worldURL) {
      const before = snapshotAccepted(), refusals = [];
      let getterCalls = 0;
      async function refuse(name, transport, expectedName, expectedCode, standingError = null, progressCount = () => 0) {
        const resourcesBefore = allResources.length;
        let caught;
        try { await loadAsync(worldURL, transport); } catch (error) { caught = error; }
        requireFact(caught instanceof Error && caught.name === expectedName && (caught.code ?? null) === expectedCode, `${name}: actual transport refusal changed`);
        if (standingError) requireFact(caught === standingError, 'Caller progress error identity changed');
        requireFact(allResources.length === resourcesBefore, 'Transport refusal allocated a target triple');
        requireFact(getterCalls === 0, 'Transport accessor was invoked');
        retained(before);
        const progressEvents = progressCount();
        if (['progress-stop', 'progress-abort', 'progress-throw'].includes(name)) requireFact(progressEvents > 0, 'Actual progress callback was not observed');
        counters.progressEvents += progressEvents;
        refusals.push({ ...receipt(name, caught), progressEvents, sameCallerError: standingError ? caught === standingError : null,
          triplesBefore: resourcesBefore, triplesAfter: allResources.length, acceptedRetained: true });
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
      events.push({ type: 'transport-refusals', count: refusals.length, getterCalls, liveTriples: liveTriples() });
      return { refusals, getterCalls, acceptedRetained: true };
    },
    dispose() {
      if (!accepted) return;
      const previous = accepted; accepted = null;
      previous.result.dispose(); previous.result.dispose();
      events.push({ type: 'disposed', liveTriples: liveTriples() });
      onChange(null);
    },
  };
  return host;
}
