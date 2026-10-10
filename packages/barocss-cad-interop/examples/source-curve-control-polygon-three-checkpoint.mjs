import { compileCadModel, editSourceCurveControlPolygon, validateSourceCurveControlPolygonEdit, sampleCurve } from '@barocss/cad';
import { parseBaroCadSelectedUniformCurveSource } from '@barocss/cad-interop/native-selected-uniform-curve';
import { BaroCADSelectedUniformCurveLoader } from '@barocss/cad-interop/three-selected-uniform-curve';
import { createNativeOptions, requireFact, assertNative, assertBuffer, proveCurveEditAsset, SourceCurveEditThreeHostError } from './source-curve-control-polygon-three-fixture.mjs';
import { observeSourceCurveEditResult } from './source-curve-control-polygon-three-observer.mjs';

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
function pose(object) { return { position: object.position.toArray(), quaternion: object.quaternion.toArray(), scale: object.scale.toArray(), visible: object.visible }; }

/** Full-file example transaction. The Scene and renderer resources belong to the caller. */
export function createSourceCurveControlPolygonThreeHost({ scene, onChange = () => {} }) {
  let accepted = null, peakLivePairs = 0;
  const records = [], allResources = [], events = [];
  const counters = { adapterAttempts: 0, parseAttempts: 0, loadAttempts: 0, acceptedResults: 0, partialResults: 0,
    callbacks: 0, synchronousRefusals: 0, transportRefusals: 0, progressEvents: 0 };
  const livePairs = () => allResources.filter(row => row.geometryDisposals === 0 || row.materialDisposals === 0).length;
  function loader(options) { counters.adapterAttempts++; return new BaroCADSelectedUniformCurveLoader(options); }
  function parse(source, options = createNativeOptions()) { counters.parseAttempts++; return loader(options).parse(source); }
  function loadAsync(url, curveId, transport) { counters.loadAttempts++; return loader(createNativeOptions(curveId)).loadAsync(url, transport); }
  function binding(condition, message) { if (!condition) throw new SourceCurveEditThreeHostError('SOURCE_BINDING', message); }
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
    const { group, line } = result, geometry = line.geometry, material = line.material;
    requireFact(group.isGroup && line.isLine && group.parent === null && group.children.length === 1 && group.children[0] === line && line.parent === group,
      'Selected candidate must be one detached Group and original Line');
    requireFact(group.name === native.model.name && line.name === native.curveId, 'Original target names changed');
    requireFact(geometry.index === null && Object.keys(geometry.attributes).length === 1 && geometry.getAttribute('position').count === 129, 'Only 129 original selected position vertices may be uploaded');
    assertBuffer(geometry.getAttribute('position').array, native.positions);
    requireFact(material.isLineBasicMaterial && material.color.getHex() === 0x28c9eb, 'Default selected cyan material changed');
    assertNative(line.userData.barocss, { role: 'selected-uniform-curve-display-line', sourceVersion: 0, lengthUnit: 'mm', modelName: native.model.name,
      curveId: native.curveId, selectedObjectIndex: native.selectedObjectIndex, unrenderedObjectIds: native.unrenderedObjectIds, mode: native.mode,
      nativeParameters: native.parameters, nativeIntervals: native.intervals, quality: native.quality });
    for (const object of [group, line]) { assertNative(object.position.toArray(), [0, 0, 0]); assertNative(object.quaternion.toArray(), [0, 0, 0, 1]); assertNative(object.scale.toArray(), [1, 1, 1]); }
  }
  function stage(asset, source, edit, preparedNative, result, state) {
    const resources = observeSourceCurveEditResult(result);
    allResources.push(resources); peakLivePairs = Math.max(peakLivePairs, livePairs());
    events.push({ type: 'prepared', family: asset.family, state, livePairs: livePairs(), totalPairs: allResources.length });
    try { verifyTarget(result, preparedNative); }
    catch (error) { result.dispose(); result.dispose(); throw error; }
    return { asset, source, edit, native: preparedNative, result, readout: clone({ source, model: preparedNative.model, native: preparedNative, edit }), state, resources };
  }
  function admit(record) {
    const previous = accepted; scene.add(record.result.group); accepted = record; records.push(record); counters.acceptedResults++;
    if (previous) { previous.result.dispose(); previous.result.dispose(); }
    events.push({ type: 'accepted', family: record.asset.family, state: record.state, livePairs: livePairs() });
    counters.callbacks++; onChange(record); return record;
  }
  function capture() {
    requireFact(accepted, 'An original accepted full file is required');
    const record = accepted, { group, line } = record.result, attribute = line.geometry.getAttribute('position');
    const objects = []; scene.traverse(object => objects.push(object));
    return { record, asset: record.asset, source: record.source, edit: record.edit, native: record.native, result: record.result, readout: record.readout, resources: record.resources,
      cpu: clone({ asset: record.asset, source: record.source, edit: record.edit, native: record.native, readout: record.readout }),
      group, line, geometry: line.geometry, material: line.material, attribute, array: attribute.array, positions: Array.from(attribute.array),
      metadata: line.userData.barocss, metadataCopy: clone(line.userData.barocss), sceneChildren: [...scene.children], groupChildren: [...group.children],
      resourceCounts: [record.resources.geometryDisposals, record.resources.materialDisposals], callbacks: counters.callbacks,
      objects: objects.map(object => ({ object, parent: object.parent, children: [...object.children], pose: pose(object) })) };
  }
  function retained(before) {
    requireFact(accepted === before.record && accepted.asset === before.asset && accepted.source === before.source && accepted.edit === before.edit && accepted.native === before.native &&
      accepted.result === before.result && accepted.readout === before.readout && accepted.resources === before.resources, 'Refusal replaced accepted full-file references');
    assertNative({ asset: accepted.asset, source: accepted.source, edit: accepted.edit, native: accepted.native, readout: accepted.readout }, before.cpu);
    requireFact(scene.children.length === before.sceneChildren.length && scene.children.every((object, index) => object === before.sceneChildren[index]), 'Refusal changed caller Scene order');
    requireFact(accepted.result.group === before.group && accepted.result.line === before.line && before.line.geometry === before.geometry && before.line.material === before.material &&
      before.geometry.getAttribute('position') === before.attribute && before.attribute.array === before.array, 'Refusal changed target/attribute/buffer references');
    assertBuffer(before.array, before.positions);
    requireFact(before.line.userData.barocss === before.metadata, 'Refusal replaced selected metadata'); assertNative(before.metadata, before.metadataCopy);
    assertNative([accepted.resources.geometryDisposals, accepted.resources.materialDisposals], before.resourceCounts);
    requireFact(counters.callbacks === before.callbacks, 'Refusal invoked an admission callback');
    for (const value of before.objects) {
      requireFact(value.object.parent === value.parent && value.object.children.length === value.children.length && value.object.children.every((child, index) => child === value.children[index]), 'Refusal changed original object hierarchy');
      assertNative(pose(value.object), value.pose, 'unchanged-caller-and-target-pose');
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
        assertNative(candidate.readout, previous.readout, 'whole-cold-readout'); assertBuffer(candidate.resources.positionArray, previous.resources.positions);
      } catch (error) { result.dispose(); result.dispose(); throw error; }
      return admit(candidate);
    },
    runRefusals(asset, afterRefusal = () => {}, staleRequest) {
      const before = capture(), inputs = clone(asset), staleInput = clone(staleRequest), refusals = [];
      let getterCalls = 0;
      function refuse(name, action, errorName, code, diagnostic = null, partial = false) {
        const pairsBefore = allResources.length; let error;
        try { action(); } catch (caught) { error = caught; }
        requireFact(error instanceof Error && error.name === errorName && error.code === code, `${name}: actual refusal changed (${error?.name}/${error?.code})`);
        if (diagnostic) requireFact(error.diagnostics?.some(value => value.code === diagnostic), `${name}: actual compiler ${diagnostic} diagnostic required`);
        if (name === 'editorweight0') requireFact(error.cause instanceof Error && error.cause.message === 'Weights must be in [1e-6, 1e6]', 'Actual native weight cause must be retained');
        requireFact(allResources.length === pairsBefore + (partial ? 1 : 0), `${name}: unexpected target pair allocation`);
        if (partial) requireFact(allResources.at(-1).geometryDisposals === 1 && allResources.at(-1).materialDisposals === 1, 'Controlled actual detached pair must be released once');
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
      refuse('stale-reedit-source', () => host.apply(stale), 'SourceCurveEditThreeHostError', 'SOURCE_BINDING');
      refuse('ownedSibling', () => { const owned = clone(asset.owned); owned.model.objects[2].controlPoints[0][0][0] = 1; return validateSourceCurveControlPolygonEdit(owned); }, editorName, 'OWNED');
      refuse('ownedPatch', () => { const owned = clone(asset.owned); owned.patches[0].startUTF16++; return validateSourceCurveControlPolygonEdit(owned); }, editorName, 'OWNED');
      refuse('staged-partial', () => {
        const proof = proveCurveEditAsset(asset), native = neutral(asset.originalSource, proof.originalModel, asset.request.curveId);
        const candidate = stage(asset, asset.originalSource, null, native, parse(asset.originalSource), 'original'); counters.partialResults++;
        try { throw new SourceCurveEditThreeHostError('STAGED_PREPARATION_REFUSAL', 'Controlled example refusal after one genuine detached selected Line pair'); }
        finally { candidate.result.dispose(); candidate.result.dispose(); }
      }, 'SourceCurveEditThreeHostError', 'STAGED_PREPARATION_REFUSAL', null, true);
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
