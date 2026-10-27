import { compileCadModel, editSourceCurveControlPolygon, validateSourceCurveControlPolygonEdit, sampleCurve } from '@barocss/cad';
import { parseBaroCadSelectedUniformCurveSource } from '@barocss/cad-interop/native-selected-uniform-curve';
import { BaroCADSelectedUniformCurveBabylonLoader } from '@barocss/cad-interop/babylon-selected-uniform-curve';
import { createNativeOptions, requireFact, assertNative, assertBuffer, proveCurveEditAsset, SourceCurveEditBabylonHostError } from './source-curve-control-polygon-babylon-fixture.mjs';
import { Scene } from '@babylonjs/core/scene.js';
import { observeSourceCurveEditBabylonResult } from './source-curve-control-polygon-babylon-observer.mjs';

const NATIVE_KEYS = ['format', 'version', 'mode', 'source', 'model', 'curveId', 'options', 'domain', 'parameters', 'pointsMM', 'intervals', 'positions', 'quality',
  'selectedObjectIndex', 'curve', 'unrenderedObjectIds'];
const clone = value => structuredClone(value);
const nativeFields = result => Object.fromEntries(NATIVE_KEYS.map(key => [key, result[key]]));
function receipt(name, error) {
  return { name, errorName: error.name, code: error.code ?? null, message: error.message, diagnostics: error.diagnostics ?? [],
    causeName: error.cause?.name ?? null, causeCode: error.cause?.code ?? null, causeMessage: error.cause?.message ?? null };
}
function compiled(source) {
  const result = compileCadModel(source, { sourceVersion: 0 });
  requireFact(result.ok, 'Negative recipe requires an actual valid original compiler AST'); return result;
}
function pose(object) { return { position: object.position.asArray(), rotation: object.rotation?.asArray() ?? null, quaternion: object.rotationQuaternion?.asArray() ?? null, scale: object.scaling?.asArray() ?? null, enabled: object.isEnabled() }; }

/** Full-file example transaction. The Scene and renderer resources belong to the caller. */
export function createSourceCurveControlPolygonBabylonHost({ scene, onChange = () => {} }) {
  let accepted = null, peakLivePairs = 0;
  const records = [], allResources = [], events = [];
  const counters = { adapterAttempts: 0, parseAttempts: 0, loadAttempts: 0, acceptedResults: 0, partialResults: 0,
    callbacks: 0, synchronousRefusals: 0, transportRefusals: 0, progressEvents: 0 };
  const livePairs = () => allResources.filter(row => row.meshDisposals === 0 || row.geometryDisposals === 0 || row.materialDisposals === 0).length;
  function loader(options) { counters.adapterAttempts++; return new BaroCADSelectedUniformCurveBabylonLoader(options); }
  function parse(source, options = createNativeOptions(), targetScene = scene) { counters.parseAttempts++; return loader(options).parse(source, targetScene); }
  function loadAsync(url, curveId, transport) { counters.loadAttempts++; return loader(createNativeOptions(curveId)).loadAsync(url, scene, transport); }
  function binding(condition, message) { if (!condition) throw new SourceCurveEditBabylonHostError('SOURCE_BINDING', message); }
  function neutral(source, model, curveId) {
    const native = parseBaroCadSelectedUniformCurveSource(source, createNativeOptions(curveId));
    assertNative(native.model, model, 'complete-native-Model');
    requireFact(native.source === source && native.selectedObjectIndex === 1 && native.curveId === curveId, 'Full source selection lost original qualification');
    assertNative(native.unrenderedObjectIds, ['context_curve', 'context_plane']);
    assertNative(native.curve, model.objects[1]);
    requireFact(native.curve !== native.model.objects[1] && native.curve.controlPoints !== native.model.objects[1].controlPoints, 'Selected occurrence must be independent');
    const samples = sampleCurve(model.objects[1], 129);
    assertNative(native.parameters, samples.map(sample => sample.parameter)); assertNative(native.pointsMM, samples.map(sample => sample.point));
    requireFact(native.intervals.length === 128, 'Exactly 128 original parameter intervals required');
    for (const [index, interval] of native.intervals.entries()) assertNative(interval, [native.parameters[index], native.parameters[index + 1]]);
    for (const [index, sample] of samples.entries()) for (let axis = 0; axis < 3; axis++) requireFact(Object.is(native.positions[index * 3 + axis], Math.fround(sample.point[axis] * 0.001)), 'Native Float32 scale must occur once');
    return native;
  }
  function verifyTarget(result, native) {
    assertNative(nativeFields(result), native, 'public-target-complete-native');
    const line = result.line, geometry = line.geometry, material = line.material;
    requireFact(line.getScene() === scene && scene.meshes.includes(line) && line.parent === null && !line.isEnabled(), 'Selected candidate must be one disabled Scene-registered LinesMesh');
    requireFact(geometry && scene.geometries.includes(geometry) && line.getTotalVertices() === 129 && geometry.getVerticesDataKinds().length === 1 && geometry.getVerticesDataKinds()[0] === 'position', 'Only 129 selected position vertices may be uploaded');
    assertBuffer(line.getVerticesData('position'), native.positions);
    requireFact(line.getVerticesData('position') !== result.positions, 'Target must own a separate Float32 position copy');
    assertBuffer(line.getIndices(), Array.from({ length: 128 }, (_, index) => [index, index + 1]).flat());
    requireFact(material?.getClassName() === 'ShaderMaterial' && scene.materials.includes(material), 'Explicit actual world color ShaderMaterial required');
    assertNative(line.color.asArray(), [40 / 255, 201 / 255, 235 / 255]);
    const metadata = line.metadata?.barocss;
    for (const [key, value] of Object.entries({ role: 'selected-uniform-curve-display-line', sourceVersion: 0, lengthUnit: 'mm', coordinateSystem: 'right-handed-z-up', modelName: native.model.name,
      curveId: native.curveId, selectedObjectIndex: native.selectedObjectIndex, unrenderedObjectIds: native.unrenderedObjectIds, mode: native.mode,
      nativeDomain: native.domain, nativeParameters: native.parameters, nativeIntervals: native.intervals, quality: native.quality })) assertNative(metadata?.[key], value, 'selected-metadata.' + key);
    assertNative(line.position.asArray(), [0, 0, 0]); assertNative(line.rotation.asArray(), [0, 0, 0]); assertNative(line.scaling.asArray(), [1, 1, 1]);
  }

  function stage(asset, source, edit, preparedNative, result, state) {
    const resources = observeSourceCurveEditBabylonResult(result);
    allResources.push(resources); peakLivePairs = Math.max(peakLivePairs, livePairs());
    events.push({ type: 'prepared', family: asset.family, state, livePairs: livePairs(), totalPairs: allResources.length });
    try { verifyTarget(result, preparedNative); }
    catch (error) { result.dispose(); result.dispose(); throw error; }
    return { asset, source, edit, native: preparedNative, result, readout: clone({ source, model: preparedNative.model, native: preparedNative, edit }), state, resources };
  }
  function admit(record) {
    const previous = accepted; record.result.line.setEnabled(true); accepted = record; records.push(record); counters.acceptedResults++;
    if (previous) { previous.result.dispose(); previous.result.dispose(); }
    events.push({ type: 'accepted', family: record.asset.family, state: record.state, livePairs: livePairs() });
    counters.callbacks++; onChange(record); return record;
  }
  function capture() {
    requireFact(accepted, 'An original accepted full file is required');
    const record = accepted, line = record.result.line, geometry = line.geometry, vertexBuffer = geometry.getVertexBuffer('position');
    const objects = [...scene.meshes, ...scene.transformNodes, ...scene.cameras];
    const collections = Object.fromEntries(['meshes', 'materials', 'geometries', 'transformNodes', 'cameras', 'lights'].map(name => [name, [...scene[name]]]));
    return { record, asset: record.asset, source: record.source, edit: record.edit, native: record.native, result: record.result, readout: record.readout, resources: record.resources,
      cpu: clone({ asset: record.asset, source: record.source, edit: record.edit, native: record.native, readout: record.readout }),
      line, geometry, material: line.material, vertexBuffer, vertexData: vertexBuffer.getData(), array: line.getVerticesData('position'), positions: Array.from(line.getVerticesData('position')),
      indexArray: line.getIndices(), indices: Array.from(line.getIndices()), metadata: line.metadata.barocss, metadataCopy: clone(line.metadata.barocss), collections,
      rightHanded: scene.useRightHandedSystem, activeCamera: scene.activeCamera, resourceCounts: [record.resources.meshDisposals, record.resources.geometryDisposals, record.resources.materialDisposals], callbacks: counters.callbacks,
      objects: objects.map(object => ({ object, parent: object.parent, children: [...object.getChildren()], pose: pose(object) })) };
  }
  function retained(before) {
    requireFact(accepted === before.record && accepted.asset === before.asset && accepted.source === before.source && accepted.edit === before.edit && accepted.native === before.native &&
      accepted.result === before.result && accepted.readout === before.readout && accepted.resources === before.resources, 'Refusal replaced accepted full-file references');
    assertNative({ asset: accepted.asset, source: accepted.source, edit: accepted.edit, native: accepted.native, readout: accepted.readout }, before.cpu);
    for (const [name, objects] of Object.entries(before.collections)) requireFact(scene[name].length === objects.length && scene[name].every((object, index) => object === objects[index]), 'Refusal changed Scene ' + name);
    requireFact(scene.useRightHandedSystem === before.rightHanded && scene.activeCamera === before.activeCamera && !scene.isDisposed, 'Refusal changed caller Scene/camera');
    requireFact(accepted.result.line === before.line && before.line.geometry === before.geometry && before.line.material === before.material && before.geometry.getVertexBuffer('position') === before.vertexBuffer &&
      before.vertexBuffer.getData() === before.vertexData && before.line.getVerticesData('position') === before.array && before.line.getIndices() === before.indexArray, 'Refusal changed target/buffer references');
    assertBuffer(before.array, before.positions); assertBuffer(before.indexArray, before.indices);
    requireFact(before.line.metadata.barocss === before.metadata, 'Refusal replaced selected metadata'); assertNative(before.metadata, before.metadataCopy);
    assertNative([accepted.resources.meshDisposals, accepted.resources.geometryDisposals, accepted.resources.materialDisposals], before.resourceCounts);
    requireFact(counters.callbacks === before.callbacks, 'Refusal invoked an admission callback');
    for (const value of before.objects) {
      const children = value.object.getChildren();
      requireFact(value.object.parent === value.parent && children.length === value.children.length && children.every((child, index) => child === value.children[index]), 'Refusal changed caller hierarchy');
      assertNative(pose(value.object), value.pose, 'unchanged-caller-target-pose');
    }
  }

  const host = {
    get accepted() { return accepted; }, get records() { return records; }, get allResources() { return allResources; }, get events() { return events; },
    get counts() { return { ...counters, pairs: allResources.length, livePairs: livePairs(), peakLivePairs }; },
    get peakLivePairs() { return peakLivePairs; },
    loadOriginal(asset) {
      const proof = proveCurveEditAsset(asset), native = neutral(asset.originalSource, proof.originalModel, asset.request.curveId);
      return admit(stage(asset, asset.originalSource, null, native, parse(asset.originalSource, createNativeOptions(asset.request.curveId)), 'original'));
    },
    apply(asset) {
      binding(accepted?.source === asset.request.source, 'The authored edit request must bind the accepted complete original source');
      const proof = proveCurveEditAsset(asset);
      assertNative(accepted.native.model, proof.originalModel, 'accepted-full-original-Model');
      const native = neutral(asset.candidateSource, proof.candidateModel, asset.request.curveId);
      return admit(stage(asset, asset.candidateSource, proof.edited, native, parse(asset.candidateSource, createNativeOptions(asset.request.curveId)), 'edited'));
    },
    async coldReopen(asset, url, transport = {}) {
      binding(accepted?.source === asset.candidateSource && accepted.edit !== null, 'Cold reopen must bind the current complete edited source');
      const previous = accepted, proof = proveCurveEditAsset(asset);
      assertNative(previous.edit, proof.edited, 'accepted-whole-edited-proof');
      const native = neutral(asset.candidateSource, proof.candidateModel, asset.request.curveId);
      assertNative(native, previous.native, 'cold-native-before-target');
      const result = await loadAsync(url, asset.request.curveId, transport);
      let candidate;
      try {
        binding(accepted === previous && result.source === asset.candidateSource, 'Cold target source/accepted qualification changed');
        candidate = stage(asset, asset.candidateSource, proof.edited, native, result, 'cold');
        assertNative(candidate.readout, previous.readout, 'whole-cold-readout'); assertBuffer(candidate.resources.positionArray, previous.resources.positions); assertBuffer(candidate.resources.indexArray, previous.resources.indices);
      } catch (error) { result.dispose(); result.dispose(); throw error; }
      return admit(candidate);
    },
    runRefusals(asset, afterRefusal = () => {}, staleRequest) {
      const before = capture(), inputs = clone(asset), staleInput = clone(staleRequest), refusals = [];
      let getterCalls = 0;
      function refuse(name, action, errorName, code, diagnostic = null, partial = false) {
        const pairsBefore = allResources.length; let error;
        try { action(); } catch (caught) { error = caught; }
        requireFact(error instanceof Error && error.name === errorName && (error.code ?? null) === code, `${name}: actual refusal changed (${error?.name}/${error?.code})`);
        if (diagnostic) requireFact(error.diagnostics?.some(value => value.code === diagnostic), `${name}: actual compiler ${diagnostic} diagnostic required`);
        if (name === 'editorweight0') requireFact(error.cause instanceof Error && error.cause.message === 'Weights must be in [1e-6, 1e6]', 'Actual native weight cause must be retained');
        requireFact(allResources.length === pairsBefore + (partial ? 1 : 0), `${name}: unexpected target pair allocation`);
        if (partial) requireFact(allResources.at(-1).meshDisposals === 1 && allResources.at(-1).geometryDisposals === 1 && allResources.at(-1).materialDisposals === 1, 'Controlled actual disabled triple must be released once');
        retained(before); assertNative(asset, inputs); assertNative(staleRequest, staleInput); requireFact(getterCalls === 0, 'Accessor must not be invoked');
        const observation = { ...receipt(name, error), pairsBefore, pairsAfter: allResources.length, acceptedRetained: true, getterCalls };
        refusals.push(observation); afterRefusal(observation);
      }
      const sdkName = 'BaroCadUniformCurveSourceError', editorName = 'SourceCurveControlPolygonError';
      for (const count of [1, 130]) refuse('count' + count, () => parse(asset.originalSource, { ...createNativeOptions(), uniformCurveDisplay: { version: 1, count } }), sdkName, 'OPTIONS');
      refuse('curveId-getter', () => { const options = createNativeOptions(); Object.defineProperty(options, 'curveId', { enumerable: true, get() { getterCalls++; return 'target_curve'; } }); return parse(asset.originalSource, options); }, sdkName, 'OPTIONS');
      refuse('count-getter', () => { const options = createNativeOptions(); Object.defineProperty(options.uniformCurveDisplay, 'count', { enumerable: true, get() { getterCalls++; return 129; } }); return parse(asset.originalSource, options); }, sdkName, 'OPTIONS');
      refuse('unknownID', () => parse(asset.originalSource, createNativeOptions('missing_curve')), sdkName, 'PROFILE');
      refuse('selectedSurface', () => parse(asset.originalSource, createNativeOptions('context_plane')), sdkName, 'PROFILE');
      refuse('syntax', () => parse('@model {'), sdkName, 'SOURCE', 'SYNTAX');
      const original = compiled(asset.originalSource), target = original.ast.declarations.find(value => value.id === asset.request.curveId);
      const insideModel = text => asset.originalSource.slice(0, original.ast.range.end - 1) + '\n' + text + '\n' + asset.originalSource.slice(original.ast.range.end - 1);
      const duplicate = insideModel(asset.originalSource.slice(target.range.start, target.range.end));
      refuse('duplicateID', () => parse(duplicate), sdkName, 'SOURCE', 'DUPLICATE');
      const sibling = original.ast.declarations.find(value => value.id === 'context_curve'), siblingText = asset.originalSource.slice(sibling.range.start, sibling.range.end);
      const extra = Array.from({ length: 14 }, (_, index) => siblingText.slice(0, sibling.idRange.start - sibling.range.start) + '#context_extra_' + index + siblingText.slice(sibling.idRange.end - sibling.range.start)).join('\n');
      refuse('17decl', () => parse(insideModel(extra)), sdkName, 'SOURCE', 'LIMIT');
      for (const [name, unitsPerMillimeter] of [['F32underflow', 1e-50], ['F64underflow', Number.MIN_VALUE], ['overflow', Number.MAX_VALUE]]) {
        refuse(name, () => parse(asset.originalSource, { ...createNativeOptions(), unitsPerMillimeter }), sdkName, 'POSITIONS');
      }
      const knotNodes = target.fields.find(value => value.name === 'knots').value.items;
      let narrowSource = asset.originalSource;
      for (const [index, node] of knotNodes.entries().toArray().toSorted((a, b) => b[1].range.start - a[1].range.start)) {
        const text = index < 5 ? '1' : '1.0000000000000002'; narrowSource = narrowSource.slice(0, node.range.start) + text + narrowSource.slice(node.range.end);
      }
      const narrowCurve = compiled(narrowSource).model.objects[1], narrowSamples = sampleCurve(narrowCurve, 129);
      requireFact(narrowSamples.slice(1).filter((sample, index) => !(sample.parameter > narrowSamples[index].parameter)).length === 127, 'Genuine tiny-domain parameter duplicate witness changed');
      refuse('tiny-domain', () => parse(narrowSource), sdkName, 'PARAMETERS');
      function negativeEdit(poleEdits) {
        const edited = editSourceCurveControlPolygon({ ...asset.request, edits: { poleEdits } });
        assertNative(validateSourceCurveControlPolygonEdit(edited), edited.report); return edited;
      }
      const constant = negativeEdit(original.model.objects[1].controlPoints.map((_point, index) => ({ index, xMM: 1, yMM: 0, zMM: 0, weight: 1 })));
      const constantSamples = sampleCurve(constant.curve, 129);
      requireFact(constantSamples.every(sample => sample.point[0] === 1 && sample.point[1] === 0 && sample.point[2] === 0), 'Genuine constant Curve witness changed');
      refuse('constant', () => parse(constant.source), sdkName, 'SEGMENTS');
      const collapse = negativeEdit(original.model.objects[1].controlPoints.map((_point, index) => ({ index, xMM: 1 + index * 1e-8 / 4, yMM: 0, zMM: 0, weight: 1 })));
      const collapseSamples = sampleCurve(collapse.curve, 129);
      requireFact(collapseSamples.slice(1).filter((sample, index) => !Object.is(sample.point[0], collapseSamples[index].point[0])).length === 128 &&
        collapseSamples.every(sample => Math.fround(sample.point[0]) === 1), 'Distinct native / collapsed F32 witness changed');
      refuse('distinct-F32collapse', () => parse(collapse.source, { ...createNativeOptions(), unitsPerMillimeter: 1 }), sdkName, 'SEGMENTS');
      refuse('editorweight0', () => editSourceCurveControlPolygon({ ...asset.request, edits: { poleEdits: [{ index: 0, weight: 0 }] } }), editorName, 'NATIVE');
      refuse('editorindex64', () => editSourceCurveControlPolygon({ ...asset.request, edits: { poleEdits: [{ index: 64, xMM: 1 }] } }), editorName, 'INPUT');
      requireFact(staleRequest.source === asset.candidateSource && staleRequest.source !== asset.originalSource, 'The actual saved reedit DTO must bind the authentic quartic candidate');
      const stale = { ...asset, request: staleRequest };
      refuse('stale-reedit-source', () => host.apply(stale), 'SourceCurveEditBabylonHostError', 'SOURCE_BINDING');
      refuse('ownedSibling', () => { const owned = clone(asset.owned); owned.model.objects[2].controlPoints[0][0][0] = 1; return validateSourceCurveControlPolygonEdit(owned); }, editorName, 'OWNED');
      refuse('ownedPatch', () => { const owned = clone(asset.owned); owned.patches[0].startUTF16++; return validateSourceCurveControlPolygonEdit(owned); }, editorName, 'OWNED');
      refuse('staged-partial', () => {
        const proof = proveCurveEditAsset(asset), native = neutral(asset.originalSource, proof.originalModel, asset.request.curveId);
        const candidate = stage(asset, asset.originalSource, null, native, parse(asset.originalSource), 'original'); counters.partialResults++;
        try { throw new SourceCurveEditBabylonHostError('STAGED_PREPARATION_REFUSAL', 'Controlled example refusal after one genuine disabled Scene-registered selected LinesMesh triple'); }
        finally { candidate.result.dispose(); candidate.result.dispose(); }
      }, 'SourceCurveEditBabylonHostError', 'STAGED_PREPARATION_REFUSAL', null, true);
      const sceneMessage = 'BaroCAD selected uniform Babylon loading requires an actual live right-handed Scene';
      refuse('invalid-plain-Scene', () => parse(asset.originalSource, createNativeOptions(), { useRightHandedSystem: true, isDisposed: false }), 'RangeError', null);
      for (const [name, disposed] of [['separate-left-handed-Scene', false], ['separate-disposed-Scene', true]]) {
        refuse(name, () => {
          const engine = scene.getEngine(), previousScenes = [...engine.scenes], candidate = new Scene(engine); let disposals = 0;
          candidate.onDisposeObservable.add(() => { disposals++; }); candidate.useRightHandedSystem = disposed;
          if (disposed) candidate.dispose();
          try { return parse(asset.originalSource, createNativeOptions(), candidate); }
          catch (error) { requireFact(error.message === sceneMessage, 'Genuine selected Babylon Scene guard message changed'); throw error; }
          finally {
            requireFact(candidate.meshes.length === 0 && candidate.materials.length === 0 && candidate.geometries.length === 0, 'Scene guard allocated target resources');
            candidate.dispose(); requireFact(disposals === 1 && engine.scenes.length === previousScenes.length && engine.scenes.every((value, index) => value === previousScenes[index]), 'Temporary Scene cleanup changed caller Engine scenes');
          }
        }, 'RangeError', null);
      }
      counters.synchronousRefusals += refusals.length; events.push({ type: 'sync-refusals', count: refusals.length, getterCalls, livePairs: livePairs() });
      return refusals;
    },
    async runTransportRefusals(url, afterRefusal = () => {}) {
      const before = capture(), refusals = []; let getterCalls = 0;
      async function refuse(name, transport, errorName, code, callerError = null, progressCount = () => 0) {
        const pairsBefore = allResources.length; let error;
        try { await loadAsync(url, before.native.curveId, transport); } catch (caught) { error = caught; }
        requireFact(error instanceof Error && error.name === errorName && (error.code ?? null) === code, `${name}: actual transport error changed`);
        if (callerError) requireFact(error === callerError, 'Actual caller progress error identity changed');
        requireFact(allResources.length === pairsBefore && getterCalls === 0, 'Transport refusal allocated a pair or invoked a getter');
        retained(before); const progressEvents = progressCount();
        if (name.startsWith('progress-')) requireFact(progressEvents > 0, 'Actual progress callback was not observed');
        counters.progressEvents += progressEvents;
        const observation = { ...receipt(name, error), pairsBefore, pairsAfter: allResources.length, progressEvents, getterCalls,
          sameCallerError: callerError ? error === callerError : null, acceptedRetained: true };
        refusals.push(observation); await afterRefusal(observation); retained(before);
      }
      const aborted = new AbortController(); aborted.abort(); await refuse('pre-aborted', { signal: aborted.signal }, 'AbortError', 'ABORT_ERR');
      let stopped = 0; await refuse('progress-stop', { onProgress() { stopped++; return false; } }, 'AbortError', 'ABORT_ERR', null, () => stopped);
      const controller = new AbortController(); let abortedProgress = 0;
      await refuse('progress-abort', { signal: controller.signal, onProgress() { abortedProgress++; controller.abort(); } }, 'AbortError', 'ABORT_ERR', null, () => abortedProgress);
      const callerError = new Error('Actual caller progress refusal'); let thrown = 0;
      await refuse('progress-throw', { onProgress() { thrown++; throw callerError; } }, 'Error', null, callerError, () => thrown);
      const transport = {}; Object.defineProperty(transport, 'onProgress', { enumerable: true, get() { getterCalls++; return () => {}; } });
      await refuse('transport-progress-accessor', transport, 'TypeError', null);
      counters.transportRefusals += refusals.length; events.push({ type: 'transport-refusals', count: refusals.length, getterCalls, livePairs: livePairs() }); return refusals;
    },
    dispose() {
      if (!accepted) return;
      const previous = accepted; accepted = null; previous.result.dispose(); previous.result.dispose();
      events.push({ type: 'disposed', livePairs: livePairs() }); counters.callbacks++; onChange(null);
    },
  };
  return host;
}
