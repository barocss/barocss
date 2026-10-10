import { buildVLinearSurfacePlaneSection, validateVLinearSurfacePlaneSection } from '@barocss/cad';
import { parseBaroCadUniformCurveSource } from '@barocss/cad-interop/native-uniform-curve';
import { BaroCADUniformCurveLoader } from '@barocss/cad-interop/three-uniform-curve';
import { createNativeOptions, requireFact, assertNative, assertBuffer, proveSection, SectionUniformThreeHostError } from './section-uniform-curve-three-fixture.mjs';
import { observeSectionUniformResult } from './section-uniform-curve-three-observer.mjs';

const NATIVE_KEYS = ['format', 'version', 'mode', 'source', 'model', 'curveId', 'options', 'domain', 'parameters', 'pointsMM', 'intervals', 'positions', 'quality'];
const nativeFields = result => Object.fromEntries(NATIVE_KEYS.map(key => [key, result[key]]));
const clone = value => structuredClone(value);
function receipt(name, error) {
  return { name, errorName: error.name, code: error.code ?? null, message: error.message,
    diagnostics: error.diagnostics ?? [], causeName: error.cause?.name ?? null, causeCode: error.cause?.code ?? null };
}
export function createSectionUniformThreeHost({ scene, onChange = () => {} }) {
  let accepted = null, peakLivePairs = 0;
  const records = [], allResources = [], events = [];
  const counters = { adapterAttempts: 0, parseAttempts: 0, loadAttempts: 0, acceptedResults: 0, partialResults: 0,
    progressEvents: 0, synchronousRefusals: 0, transportRefusals: 0 };
  const livePairs = () => allResources.filter(row => row.geometryDisposals === 0 || row.materialDisposals === 0).length;
  function loader(options = createNativeOptions()) { counters.adapterAttempts++; return new BaroCADUniformCurveLoader(options); }
  function parse(source, options = createNativeOptions()) { counters.parseAttempts++; return loader(options).parse(source); }
  function loadAsync(url, transport = {}) { counters.loadAttempts++; return loader().loadAsync(url, transport); }
  function observe(result) {
    const resources = observeSectionUniformResult(result);
    requireFact(resources.length === 1, 'One world Line must own exactly one resource pair');
    allResources.push(...resources);
    peakLivePairs = Math.max(peakLivePairs, livePairs());
    events.push({ type: 'prepared', livePairs: livePairs(), totalPairs: allResources.length });
    return resources;
  }
  function verifyResult(result, native, section) {
    assertNative(nativeFields(result), native, 'target-native');
    assertNative(result.model, section.world.model);
    requireFact(result.line.isLine === true && result.group.isGroup === true && result.group.children.length === 1 && result.group.children[0] === result.line, 'World Group/Line changed');
    requireFact(result.group.parent === null, 'Candidate must be detached');
    const geometry = result.line.geometry;
    requireFact(geometry.index === null && Object.keys(geometry.attributes).length === 1 && geometry.getAttribute('position').count === 129, 'World-only unindexed position upload changed');
    assertBuffer(geometry.getAttribute('position').array, native.positions);
    requireFact(result.line.material.isLineBasicMaterial && result.line.material.color.getHex() === 0x28c9eb, 'Default world line material changed');
    for (const object of [result.group, result.line]) {
      assertNative(object.position.toArray(), [0, 0, 0]); assertNative(object.rotation.toArray().slice(0, 3), [0, 0, 0]); assertNative(object.scale.toArray(), [1, 1, 1]);
    }
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
    scene.add(record.result.group);
    accepted = record;
    records.push(record); counters.acceptedResults++;
    if (previous) { previous.result.dispose(); previous.result.dispose(); }
    events.push({ type: 'accepted', state: record.state, livePairs: livePairs() });
    onChange(record);
    return record;
  }
  function snapshotAccepted() {
    requireFact(accepted, 'An accepted result is required');
    const record = accepted, result = record.result;
    return { record, asset: record.asset, section: record.section, native: record.native, readout: record.readout,
      resources: record.resources, cpu: clone({ asset: record.asset, section: record.section, native: record.native, readout: record.readout }),
      children: [...scene.children], groupChildren: [...result.group.children], group: result.group, line: result.line,
      geometry: result.line.geometry, material: result.line.material, positionAttribute: result.line.geometry.getAttribute('position'),
      positionArray: result.line.geometry.getAttribute('position').array,
      positionData: Array.from(result.line.geometry.getAttribute('position').array), resourceCounts: record.resources.map(row => [row.geometryDisposals, row.materialDisposals]),
      scenePoses: scene.children.map(object => ({ object, position: object.position.toArray(), quaternion: object.quaternion.toArray(), scale: object.scale.toArray() })) };
  }
  function retained(before) {
    requireFact(accepted === before.record && accepted.asset === before.asset && accepted.section === before.section && accepted.native === before.native &&
      accepted.readout === before.readout && accepted.resources === before.resources, 'Refusal replaced accepted references');
    assertNative({ asset: accepted.asset, section: accepted.section, native: accepted.native, readout: accepted.readout }, before.cpu);
    requireFact(scene.children.length === before.children.length && scene.children.every((object, index) => object === before.children[index]), 'Refusal changed Scene');
    requireFact(accepted.result.group === before.group && accepted.result.line === before.line && before.line.geometry === before.geometry && before.line.material === before.material,
      'Refusal replaced target objects');
    requireFact(before.group.children.length === before.groupChildren.length && before.group.children.every((object, index) => object === before.groupChildren[index]), 'Refusal changed Group children');
    requireFact(before.geometry.getAttribute('position') === before.positionAttribute && before.positionAttribute.array === before.positionArray, 'Refusal replaced position references');
    assertBuffer(before.positionArray, before.positionData);
    assertNative(accepted.resources.map(row => [row.geometryDisposals, row.materialDisposals]), before.resourceCounts);
    for (const pose of before.scenePoses) {
      assertNative(pose.object.position.toArray(), pose.position); assertNative(pose.object.quaternion.toArray(), pose.quaternion); assertNative(pose.object.scale.toArray(), pose.scale);
    }
  }
  const host = {
    get accepted() { return accepted; }, get records() { return records; }, get allResources() { return allResources; }, get events() { return events; },
    get peakLivePairs() { return peakLivePairs; },
    get counts() { return { ...counters, livePairs: livePairs(), peakLivePairs, pairs: allResources.length }; },
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
        requireFact(caught.name === errorName && caught.code === code, `${name}: unexpected ${caught.name}/${caught.code}`);
        if (name === 'malformed-world-source') requireFact(caught.diagnostics.some(value => value.code === 'SYNTAX'), 'Actual compiler SYNTAX diagnostic required');
        requireFact(allResources.length === resourcesBefore + (partial ? 1 : 0), `${name}: unexpected successful pair allocation`);
        if (partial) {
          const row = allResources.at(-1);
          requireFact(row.geometryDisposals === 1 && row.materialDisposals === 1, 'Controlled detached pair cleanup must happen once');
        }
        retained(before); assertNative(asset, originalAsset); requireFact(getterCalls === 0, 'Accessor was invoked');
        refusals.push({ ...receipt(name, caught), pairsBefore: resourcesBefore, pairsAfter: allResources.length, acceptedRetained: true });
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
      refuse('host-world-source-binding', () => { const candidate = clone(asset); candidate.worldSource = candidate.request.surfaceAsset.source; return prepare(candidate); }, 'SectionUniformThreeHostError', 'SOURCE_BINDING');
      refuse('host-swapped-uv-binding', () => { const candidate = clone(asset); [candidate.surfaceUV, candidate.planeUV] = [candidate.planeUV, candidate.surfaceUV]; return prepare(candidate); }, 'SectionUniformThreeHostError', 'UV_BINDING');
      refuse('controlled-detached-preparation', () => {
        const prepared = prepare(asset), result = parse(asset.worldSource);
        const record = stage(asset, prepared, result, 'controlled-partial'); counters.partialResults++;
        try { throw new SectionUniformThreeHostError('STAGED_PREPARATION_REFUSAL', 'Controlled example refusal after one genuine detached Line pair'); }
        finally { record.result.dispose(); record.result.dispose(); }
      }, 'SectionUniformThreeHostError', 'STAGED_PREPARATION_REFUSAL', true);
      counters.synchronousRefusals += refusals.length;
      events.push({ type: 'sync-refusals', count: refusals.length, getterCalls, livePairs: livePairs() });
      return { refusals, getterCalls, acceptedRetained: true };
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
        requireFact(allResources.length === resourcesBefore, 'Transport refusal allocated a target pair');
        requireFact(getterCalls === 0, 'Transport accessor was invoked');
        retained(before);
        const progressEvents = progressCount();
        if (['progress-stop', 'progress-abort', 'progress-throw'].includes(name)) requireFact(progressEvents > 0, 'Actual progress callback was not observed');
        counters.progressEvents += progressEvents;
        refusals.push({ ...receipt(name, caught), progressEvents, sameCallerError: standingError ? caught === standingError : null,
          pairsBefore: resourcesBefore, pairsAfter: allResources.length, acceptedRetained: true });
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
