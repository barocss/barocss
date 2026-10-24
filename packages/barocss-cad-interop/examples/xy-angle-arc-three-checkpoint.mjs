import { buildXYAngleArc, verifyXYAngleArcArtifact, validateXYAngleArcArtifactVerification } from '@barocss/cad';
import { BaroCADUniformCurveLoader } from '@barocss/cad-interop/three-uniform-curve';
import { assertNative, assertBuffer, createNativeOptions, proveCase, requireFact, requireOriginalSourceBinding } from './xy-angle-arc-three-fixture.mjs';
import { observeXYAngleArcResult } from './xy-angle-arc-three-observer.mjs';

const NATIVE_KEYS = ['format', 'version', 'mode', 'source', 'model', 'curveId', 'options', 'domain', 'parameters', 'pointsMM', 'intervals', 'positions', 'quality'];
const clone = value => structuredClone(value);
const nativeFields = result => Object.fromEntries(NATIVE_KEYS.map(key => [key, result[key]]));
function pose(object) {
  return { position: object.position.toArray(), quaternion: object.quaternion.toArray(), scale: object.scale.toArray(),
    matrix: object.matrix.toArray(), matrixWorld: object.matrixWorld.toArray(), visible: object.visible,
    projection: object.projectionMatrix?.toArray() ?? null, inverseProjection: object.projectionMatrixInverse?.toArray() ?? null };
}
function errorReceipt(name, error) {
  return { name, errorName: error.name, code: error.code ?? null, message: error.message, diagnostics: error.diagnostics ?? [],
    cause: error.cause instanceof Error ? { kind:'error', name: error.cause.name, code: error.cause.code ?? null, message: error.cause.message } : Array.isArray(error.cause) ? {kind:'diagnostics',count:error.cause.length,diagnostics:clone(error.cause)} : null };
}

/** Example ownership transaction. Native angle authority is validated before any target admission. */
export function createXYAngleArcThreeHost({ scene, onChange = () => {} }) {
  requireFact(scene?.isScene === true, 'Caller-owned actual Three Scene required');
  let accepted = null, disposed = false, peakLivePairs = 0;
  const records = [], allResources = [], events = [];
  const counters = { acceptedResults: 0, callbacks: 0, parseCalls: 0, loadCalls: 0, synchronousRefusals: 0, transportRefusals: 0, progressEvents: 0 };
  const livePairs = () => allResources.filter(row => row.geometryDisposals === 0 || row.materialDisposals === 0).length;
  function available() { requireFact(!disposed, 'The example host was disposed'); }
  function parse(source, options = createNativeOptions()) {
    const loader = new BaroCADUniformCurveLoader(options); counters.parseCalls++; return loader.parse(source);
  }
  function loadAsync(url, transport) {
    const loader = new BaroCADUniformCurveLoader(createNativeOptions()); counters.loadCalls++; return loader.loadAsync(url, transport);
  }
  function verifyTarget(result, proof) {
    assertNative(nativeFields(result), proof.native, 'complete-public-target-native');
    requireFact(result.group.isGroup && result.group.parent === null && result.group.children.length === 1 && result.group.children[0] === result.line && result.line.parent === result.group && result.line.isLine, 'Detached original Group/Line required');
    const geometry = result.line.geometry, material = result.line.material, attribute = geometry.getAttribute('position');
    requireFact(geometry.isBufferGeometry && Object.keys(geometry.attributes).length === 1 && geometry.index === null && attribute.itemSize === 3 && attribute.count === 129, 'Actual unindexed 129-vertex original Line required');
    requireFact(attribute.array instanceof Float32Array && attribute.array === result.positions && attribute.array !== proof.native.positions, 'Existing adapter uses its own native positions array; neutral parse must remain independent');
    assertBuffer(attribute.array, proof.native.positions, 'target-native-float32');
    requireFact(material.isLineBasicMaterial && material.color.getHex() === 0x28c9eb, 'Existing cyan LineBasicMaterial required');
    for (const object of [result.group, result.line]) {
      assertNative(object.position.toArray(), [0, 0, 0]); assertNative(object.quaternion.toArray(), [0, 0, 0, 1]); assertNative(object.scale.toArray(), [1, 1, 1]);
    }
    const metadata = result.line.userData.barocss;
    for (const [key, value] of Object.entries({ role: 'uniform-curve-display-line', sourceVersion: 0, lengthUnit: 'mm', coordinateSystem: 'right-handed-z-up', modelName: result.model.name,
      curveId: result.curveId, mode: result.mode, nativeParameters: result.parameters, nativeIntervals: result.intervals, quality: result.quality })) assertNative(metadata?.[key], value, 'existing-public-metadata.' + key);
    requireFact(metadata.nativeParameters !== result.parameters && metadata.nativeIntervals !== result.intervals && metadata.quality !== result.quality, 'Public metadata must remain independent copied observations');
  }
  function stage(asset, proof, result, state) {
    const resources = observeXYAngleArcResult(result); allResources.push(...resources);
    peakLivePairs = Math.max(peakLivePairs, livePairs());
    events.push({ type: 'prepared', assetKey: asset.key, state, livePairs: livePairs(), totalPairs: allResources.length });
    try { verifyTarget(result, proof); }
    catch (error) { result.dispose(); result.dispose(); throw error; }
    const readout = clone({ assetKey: asset.key, source: asset.source, sourceVersion: 0, modelName: result.model.name, curveId: result.curveId, model: result.model,
      request: asset.request, artifact:proof.artifact, originalReport:proof.artifact.report, verification:proof.verification, verificationReport:proof.verificationReport, sameRuntimeRebuilt:proof.sameRuntimeRebuilt, sameRuntimeRebuiltReport:proof.sameRuntimeRebuiltReport, legacySavedControl:proof.legacySavedControl, witness: asset.witness, witnessSummary: proof.witnessSummary,
      nativeDomain: result.domain, parameters: result.parameters, pointsMM: result.pointsMM, intervals: result.intervals,
      displayQuality: result.quality, nativeParameterIsAngle: false, periodic: false, endpointClosed: proof.artifact.report.endpointClosed,
      parameterMeaning: 'original dimensionless rational Curve parameter; not authored angle radians', displayRole: 'approximate-uniform-original-curve' });
    return { assetKey: asset.key, state, asset, proof, source: asset.source, model: result.model, result, resources, readout };
  }
  function admit(record) {
    const previous = accepted;
    scene.add(record.result.group); accepted = record; records.push(record); counters.acceptedResults++;
    events.push({ type: 'mounted', assetKey: record.assetKey, state: record.state });
    if (previous) {
      previous.result.dispose(); previous.result.dispose();
      requireFact(previous.resources.every(row => row.geometryDisposals === 1 && row.materialDisposals === 1), 'Previous captured resources must be released before caller render');
      events.push({ type: 'old-disposed', assetKey: previous.assetKey, state: previous.state });
    }
    events.push({ type: 'change', assetKey: record.assetKey, state: record.state, livePairs: livePairs() });
    counters.callbacks++; onChange(record); return record;
  }
  function capture() {
    available(); requireFact(accepted, 'Accepted complete original source required for refusal observation');
    const objects = []; scene.traverse(object => { objects.push({ object, parent: object.parent, children: [...object.children], pose: pose(object) }); });
    const result = accepted.result;
    return { record: accepted, asset: accepted.asset, proof: accepted.proof, readout: accepted.readout, model: accepted.model,
      source: accepted.source, result, group: result.group, line: result.line, geometry: result.line.geometry, material: result.line.material,
      positionAttribute: result.line.geometry.getAttribute('position'), positionArray: result.line.geometry.getAttribute('position').array,
      metadata: result.line.userData.barocss, metadataCopy: clone(result.line.userData.barocss),
      native: clone(nativeFields(result)), inputs: clone(accepted.asset), proofCPU: clone(accepted.proof), readoutCPU: clone(accepted.readout),
      resources: accepted.resources, allResourcesCount: allResources.length, resourceCounts: allResources.map(row => [row.geometryDisposals, row.materialDisposals]),
      callbacks: counters.callbacks, recordCount: records.length, objects };
  }
  function retained(before) {
    requireFact(accepted === before.record && accepted.asset === before.asset && accepted.proof === before.proof && accepted.readout === before.readout && accepted.model === before.model && accepted.source === before.source && accepted.result === before.result && accepted.resources === before.resources,
      'Refusal changed accepted full source/native/proof/readout/resource identity');
    requireFact(accepted.result.group === before.group && accepted.result.line === before.line && before.line.geometry === before.geometry && before.line.material === before.material && before.geometry.getAttribute('position') === before.positionAttribute && before.positionAttribute.array === before.positionArray,
      'Refusal changed actual Group/Line/position resource references');
    assertNative(nativeFields(accepted.result), before.native, 'refusal-retained-full-native'); assertNative(accepted.asset, before.inputs, 'refusal-retained-whole-input');
    assertNative(accepted.proof, before.proofCPU, 'refusal-retained-whole-proof'); assertNative(accepted.readout, before.readoutCPU, 'refusal-retained-readout');
    requireFact(before.line.userData.barocss === before.metadata, 'Refusal changed actual metadata reference'); assertNative(before.metadata, before.metadataCopy, 'retained-metadata');
    requireFact(counters.callbacks === before.callbacks && records.length === before.recordCount && allResources.length === before.allResourcesCount, 'Refusal allocated, disposed, admitted or called render');
    assertNative(allResources.map(row => [row.geometryDisposals, row.materialDisposals]), before.resourceCounts, 'retained-resource-events');
    const objects = []; scene.traverse(object => { objects.push(object); });
    requireFact(objects.length === before.objects.length, 'Refusal changed caller Scene descendants');
    for (const [index, item] of before.objects.entries()) {
      requireFact(objects[index] === item.object && item.object.parent === item.parent && item.object.children.length === item.children.length && item.children.every((child, i) => child === item.object.children[i]), 'Refusal changed caller Scene child identity');
      assertNative(pose(item.object), item.pose, 'refusal-retained-caller-pose');
    }
  }
  function findAsset(assets, key) {
    const asset = assets instanceof Map ? assets.get(key) : Array.isArray(assets) ? assets.find(item => item.key === key) : assets[key];
    requireFact(asset, 'Authentic required refusal case missing'); return asset;
  }
  const host = {
    get accepted() { return accepted; }, get records() { return records; }, get allResources() { return allResources; }, get events() { return events; },
    get counts() { return { ...counters, pairs: allResources.length, livePairs: livePairs(), peakLivePairs,
      geometryDisposals: allResources.reduce((sum, row) => sum + row.geometryDisposals, 0), materialDisposals: allResources.reduce((sum, row) => sum + row.materialDisposals, 0), disposed }; },
    load(asset) {
      available(); const proof = proveCase(asset), result = parse(asset.source); return admit(stage(asset, proof, result, 'original'));
    },
    async coldReopen(freshAsset, url, transport = {}) {
      available(); requireFact(accepted && accepted.assetKey === freshAsset.key, 'Cold reopen must retain the accepted authored family');
      assertNative(freshAsset, accepted.asset, 'fresh-whole-original-files');
      const previous = accepted, proof = proveCase(freshAsset), result = await loadAsync(url, transport);
      // This is the actual successful internal public loadAsync parse, not a transport callback allocation.
      counters.parseCalls++;
      if (disposed || accepted !== previous) { result.dispose(); result.dispose(); throw new TypeError('Accepted original source changed during cold reopen'); }
      try { requireOriginalSourceBinding(result.source, freshAsset.owned); }
      catch (error) { result.dispose(); result.dispose(); throw error; }
      return admit(stage(freshAsset, proof, result, 'cold-reopen'));
    },
    runRefusals(assets, afterRefusal = () => {}) {
      available(); const base = findAsset(assets, 'positive_multispan_native_c0'), seam = findAsset(assets, 'arbitrary_start_full_turn_copied_seam');
      requireFact(accepted?.assetKey === base.key && accepted.state === 'original', 'Synchronous refusals require the initial authentic multispan original');
      const refusals = []; let getterCalls = 0;
      function refuse(name, scope, action, expectedName, expectedCode) {
        const before = capture(); let error; try { action(); } catch (cause) { error = cause; }
        requireFact(error instanceof Error && error.name === expectedName && (error.code ?? null) === expectedCode, `Actual refusal differs: ${name}`);
        if(name==='owned-source')requireFact(Array.isArray(error.cause)&&error.cause.length===1,'Actual native compiler diagnostic array cause required');
        requireFact(getterCalls===0,'Public input accessors must not be invoked');
        retained(before); const observation = { ...errorReceipt(name, error), scope, acceptedRetained: true, getterCalls, pairsBefore: before.allResourcesCount, pairsAfter: allResources.length };
        counters.synchronousRefusals++; events.push({ type: 'refused', ...observation }); refusals.push(observation); afterRefusal(observation);
      }
      refuse('request-unit', 'public-native', () => buildXYAngleArc({ ...base.request, angleUnit: 'deg' }), 'XYAngleArcError', 'UNIT');
      refuse('request-zero-sweep', 'public-native', () => buildXYAngleArc({ ...base.request, sweepAngleRad: 0 }), 'XYAngleArcError', 'RANGE');
      const getter = { ...base.request }; Object.defineProperty(getter, 'radiusMM', { enumerable: true, get() { getterCalls++; return 2; } });
      refuse('request-getter', 'public-native', () => buildXYAngleArc(getter), 'XYAngleArcError', 'INPUT');
      for (const [name, asset, edit] of [
        ['owned-source', base, owned => { owned.source = '@model {invalid'; }], ['owned-curve', base, owned => { owned.curve.controlPoints[0][0] += 1; }],
        ['owned-report-angle', base, owned => { owned.report.angleBreaksRad[1] += 0.1; }],
        ['owned-native-c0-reason', base, owned => { owned.report.observations.find(item => item.d1.status === 'native-refused').d1.reason = 'repaired'; }],
        ['owned-native-parameter-is-angle', base, owned => { owned.report.quality.nativeParameterIsAngle = true; }], ['owned-periodic-seam', seam, owned => { owned.report.periodic = true; }],
      ]) {
        refuse(name, 'public-whole-owned', () => { const owned = clone(asset.owned); edit(owned); return verifyXYAngleArcArtifact(owned); }, 'XYAngleArcArtifactError', name==='owned-source'?'SOURCE':name==='owned-curve'?'BINDING':'STRUCTURE');
      }
      refuse('source-owned-binding', 'example-exact-source-guard', () => requireOriginalSourceBinding(base.source, seam.owned), 'TypeError', null);
      refuse('malformed-source', 'public-three-source', () => parse('@model {invalid'), 'BaroCadUniformCurveSourceError', 'SOURCE');
      refuse('count-one', 'public-three-options', () => parse(base.source, { ...createNativeOptions(), uniformCurveDisplay: { version: 1, count: 1 } }), 'BaroCadUniformCurveSourceError', 'OPTIONS');
      refuse('unsafe-float32-scale', 'public-three-source', () => parse(base.source, { ...createNativeOptions(), unitsPerMillimeter: 1e-50 }), 'BaroCadUniformCurveSourceError', 'POSITIONS');
      refuse('portable-angle-association','public-portable-artifact',()=>{const owned=clone(base.owned);owned.report.observations[0].analyticAngleRad+=.001;return verifyXYAngleArcArtifact(owned);},'XYAngleArcArtifactError','ASSOCIATION');
      refuse('portable-owned-report','public-whole-portable-verification',()=>{const verification=verifyXYAngleArcArtifact(base.owned);verification.report.numericalAssociationAccepted=false;return validateXYAngleArcArtifactVerification(verification);},'XYAngleArcArtifactError','OWNED');
      const artifactGetter=clone(base.owned);Object.defineProperty(artifactGetter,'source',{enumerable:true,get(){getterCalls++;return base.source;}});
      refuse('portable-artifact-getter','public-portable-artifact',()=>verifyXYAngleArcArtifact(artifactGetter),'XYAngleArcArtifactError','INPUT');
      requireFact(getterCalls === 0 && refusals.length === 16, 'Exactly sixteen real synchronous refusals/getter0 required');
      return { refusals, getterCalls, acceptedRetained: true };
    },
    async runTransportRefusals(url, afterRefusal = () => {}) {
      available(); const refusals = []; let getterCalls = 0;
      async function refuse(name, transport, expectedName, expectedCode, expectedRequestDelta, callerError) {
        const before = capture(), progress = [];
        const actual = transport(progress); let error;
        try { await loadAsync(url, actual); } catch (cause) { error = cause; }
        requireFact(error instanceof Error && error.name === expectedName && (error.code ?? null) === expectedCode, `Actual transport refusal differs: ${name}`);
        if (callerError) requireFact(error === callerError, 'Thrown standing caller Error must retain exact identity');
        requireFact(getterCalls===0,'Public input accessors must not be invoked');
        retained(before); const observation = { ...errorReceipt(name, error), scope: 'public-shared-transport', expectedRequestDelta, progress,
          callerErrorIdentityRetained: callerError ? error === callerError : null, acceptedRetained: true, getterCalls, pairsBefore: before.allResourcesCount, pairsAfter: allResources.length };
        counters.transportRefusals++; events.push({ type: 'transport-refused', ...observation }); refusals.push(observation); await afterRefusal(observation);
      }
      const event = (progress, value) => { requireFact(value.loadedBytes > 0, 'Actual nonempty shared transport progress required'); progress.push({ ...value }); counters.progressEvents++; };
      await refuse('preabort', () => { const controller = new AbortController(); controller.abort(); return { signal: controller.signal }; }, 'AbortError', 'ABORT_ERR', 0);
      await refuse('progressfalse', progress => ({ onProgress(value) { event(progress, value); return false; } }), 'AbortError', 'ABORT_ERR', 1);
      await refuse('callbackabort', progress => { const controller = new AbortController(); return { signal: controller.signal, onProgress(value) { event(progress, value); controller.abort(); } }; }, 'AbortError', 'ABORT_ERR', 1);
      const callerError = new Error('standing XY angle arc caller progress error');
      await refuse('standingcallerError', progress => ({ onProgress(value) { event(progress, value); throw callerError; } }), 'Error', null, 1, callerError);
      await refuse('onProgressgetter', () => { const transport = {}; Object.defineProperty(transport, 'onProgress', { enumerable: true, get() { getterCalls++; return () => {}; } }); return transport; }, 'TypeError', null, 0);
      requireFact(getterCalls === 0 && refusals.length === 5 && refusals.slice(1, 4).every(item => item.progress.length >= 1), 'Exactly five actual transport refusals/getter0 required');
      return { refusals, getterCalls, acceptedRetained: true };
    },
    dispose() {
      if (disposed) return; disposed = true;
      const previous = accepted; accepted = null;
      if (previous) { previous.result.dispose(); previous.result.dispose(); }
      requireFact(livePairs() === 0, 'Owned original resources must be released on cleanup');
      events.push({ type: 'disposed', livePairs: livePairs() }); counters.callbacks++; onChange(null);
    },
  };
  return host;
}
