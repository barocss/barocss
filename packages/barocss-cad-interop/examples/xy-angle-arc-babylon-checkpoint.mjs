import { Scene } from '@babylonjs/core/scene.js';
import { buildXYAngleArc, verifyXYAngleArcArtifact, validateXYAngleArcArtifactVerification } from '@barocss/cad';
import { BaroCADUniformCurveBabylonLoader } from '@barocss/cad-interop/babylon-uniform-curve';
import { assertNative, assertBuffer, createNativeOptions, proveCase, requireFact, requireOriginalSourceBinding } from './xy-angle-arc-babylon-fixture.mjs';
import { observeXYAngleArcBabylonResult } from './xy-angle-arc-babylon-observer.mjs';

const NATIVE_KEYS = ['format', 'version', 'mode', 'source', 'model', 'curveId', 'options', 'domain', 'parameters', 'pointsMM', 'intervals', 'positions', 'quality'];
const clone = value => structuredClone(value);
const nativeFields = result => Object.fromEntries(NATIVE_KEYS.map(key => [key, result[key]]));
function pose(object) {
  return {position:object.position?.asArray()??null,rotation:object.rotation?.asArray()??null,quaternion:object.rotationQuaternion?.asArray()??null,
    scaling:object.scaling?.asArray()??null,world:object.getWorldMatrix?.().asArray()??null,
    projection:object.getProjectionMatrix?.().asArray()??null,view:object.getViewMatrix?.().asArray()??null,enabled:object.isEnabled?.()??null};
}
function errorReceipt(name, error) {
  return { name, errorName: error.name, code: error.code ?? null, message: error.message, diagnostics: error.diagnostics ?? [],
    cause: error.cause instanceof Error ? { kind:'error', name: error.cause.name, code: error.cause.code ?? null, message: error.cause.message } : Array.isArray(error.cause) ? {kind:'diagnostics',count:error.cause.length,diagnostics:clone(error.cause)} : null };
}

/** Example ownership transaction. Native angle authority is validated before any target admission. */
export function createXYAngleArcBabylonHost({ scene, onChange = () => {} }) {
  requireFact(scene instanceof Scene&&!scene.isDisposed&&scene.useRightHandedSystem===true,'Caller-owned actual live right-handed Babylon Scene required');
  let accepted = null, disposed = false, peakLivePairs = 0;
  const records = [], allResources = [], events = [];
  const counters = { acceptedResults: 0, callbacks: 0, parseCalls: 0, loadCalls: 0, synchronousRefusals: 0, transportRefusals: 0, progressEvents: 0 };
  const livePairs = () => allResources.filter(row => row.meshDisposals === 0 || row.geometryDisposals === 0 || row.materialDisposals === 0).length;
  function available() { requireFact(!disposed, 'The example host was disposed'); }
  function parse(source, options = createNativeOptions()) {
    const loader = new BaroCADUniformCurveBabylonLoader(options); counters.parseCalls++; return loader.parse(source,scene);
  }
  function loadAsync(url, transport) {
    const loader = new BaroCADUniformCurveBabylonLoader(createNativeOptions()); counters.loadCalls++; return loader.loadAsync(url,scene,transport);
  }
  function verifyTarget(result, proof) {
    assertNative(nativeFields(result), proof.native, 'complete-public-target-native');
    const line=result.line,geometry=line.geometry,material=line.material,attribute=geometry.getVertexBuffer('position'),positions=line.getVerticesData('position'),indices=line.getIndices();
    requireFact(line.getScene()===scene&&scene.meshes.includes(line)&&line.parent===null&&!line.isEnabled()&&!line.isDisposed(),'Registered initially disabled original LinesMesh required');
    requireFact(line.getClassName()==='LinesMesh'&&line.name===`${result.model.name}:${result.curveId}`&&line.getTotalVertices()===129&&geometry.getVerticesDataKinds().length===1&&geometry.getVerticesDataKinds()[0]==='position','Only original129position vertices may be uploaded');
    requireFact(positions instanceof Float32Array&&positions!==result.positions&&positions!==proof.native.positions&&attribute.getData()===positions,'Actual copied Float32 target data and independent neutral parse required');
    assertBuffer(positions,proof.native.positions,'target-native-float32');
    requireFact(Array.isArray(indices)&&indices.length===256,'Actual Babylon paired indices Array required');
    assertBuffer(indices,Array.from({length:128},(_,index)=>[index,index+1]).flat(),'actual-original-line-list');
    requireFact(material.getClassName()==='ShaderMaterial'&&scene.materials.includes(material)&&scene.geometries.includes(geometry),'One explicit owned ShaderMaterial/Geometry required');
    assertNative(line.color.asArray(),[40/255,201/255,235/255],'Existing cyan line color');
    assertNative(line.position.asArray(),[0,0,0]);assertNative(line.rotation.asArray(),[0,0,0]);assertNative(line.scaling.asArray(),[1,1,1]);requireFact(line.rotationQuaternion===null,'Actual original line has null rotationQuaternion');
    const metadata = result.line.metadata.barocss;
    for (const [key, value] of Object.entries({ role: 'uniform-curve-display-line', sourceVersion: 0, lengthUnit: 'mm', coordinateSystem: 'right-handed-y-up', modelName: result.model.name,
      curveId: result.curveId, mode: result.mode, nativeParameters: result.parameters, nativeIntervals: result.intervals, quality: result.quality })) assertNative(metadata?.[key], value, 'existing-public-metadata.' + key);
    requireFact(metadata.nativeParameters !== result.parameters && metadata.nativeIntervals !== result.intervals && metadata.quality !== result.quality, 'Public metadata must remain independent copied observations');
  }
  function stage(asset, proof, result, state) {
    const resources = observeXYAngleArcBabylonResult(result); allResources.push(...resources);
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
    record.result.line.setEnabled(true); accepted = record; records.push(record); counters.acceptedResults++;
    events.push({ type: 'mounted', assetKey: record.assetKey, state: record.state });
    if (previous) {
      previous.result.dispose(); previous.result.dispose();
      requireFact(previous.resources.every(row => row.meshDisposals === 1 && row.geometryDisposals === 1 && row.materialDisposals === 1), 'Previous captured resources must be released before caller render');
      events.push({ type: 'old-disposed', assetKey: previous.assetKey, state: previous.state });
    }
    events.push({ type: 'change', assetKey: record.assetKey, state: record.state, livePairs: livePairs() });
    counters.callbacks++; onChange(record); return record;
  }
  function capture() {
    available();requireFact(accepted,'Accepted complete original source required for refusal observation');
    const collections=Object.fromEntries(['meshes','transformNodes','materials','geometries','cameras','lights'].map(name=>[name,[...scene[name]]]));
    const nodes=[...new Set([...scene.meshes,...scene.transformNodes,...scene.cameras,...scene.lights])];
    const objects=nodes.map(object=>({object,parent:object.parent,children:[...object.getChildren()],pose:pose(object)}));
    const result=accepted.result,line=result.line,geometry=line.geometry,attribute=geometry.getVertexBuffer('position');
    return {record:accepted,asset:accepted.asset,proof:accepted.proof,readout:accepted.readout,model:accepted.model,source:accepted.source,result,line,geometry,material:line.material,
      positionAttribute:attribute,vertexData:attribute.getData(),positionArray:line.getVerticesData('position'),positions:Array.from(line.getVerticesData('position')),
      indexArray:line.getIndices(),indices:Array.from(line.getIndices()),metadata:line.metadata.barocss,metadataCopy:clone(line.metadata.barocss),
      native:clone(nativeFields(result)),inputs:clone(accepted.asset),proofCPU:clone(accepted.proof),readoutCPU:clone(accepted.readout),
      resources:accepted.resources,allResourcesCount:allResources.length,resourceCounts:allResources.map(row=>[row.meshDisposals,row.geometryDisposals,row.materialDisposals]),
      callbacks:counters.callbacks,recordCount:records.length,collections,activeCamera:scene.activeCamera,rightHanded:scene.useRightHandedSystem,objects};
  }
  function retained(before) {
    requireFact(accepted===before.record&&accepted.asset===before.asset&&accepted.proof===before.proof&&accepted.readout===before.readout&&accepted.model===before.model&&accepted.source===before.source&&accepted.result===before.result&&accepted.resources===before.resources,'Refusal changed complete original/proof/readout refs');
    requireFact(accepted.result.line===before.line&&before.line.geometry===before.geometry&&before.line.material===before.material&&before.geometry.getVertexBuffer('position')===before.positionAttribute&&before.positionAttribute.getData()===before.vertexData&&before.line.getVerticesData('position')===before.positionArray&&before.line.getIndices()===before.indexArray,'Refusal changed actual line/geometry/material/attribute/buffer refs');
    assertBuffer(before.positionArray,before.positions);assertBuffer(before.indexArray,before.indices);
    assertNative(nativeFields(accepted.result),before.native,'retained-full-native');assertNative(accepted.asset,before.inputs,'retained-whole-input');assertNative(accepted.proof,before.proofCPU,'retained-original-plus-portable-proof');assertNative(accepted.readout,before.readoutCPU,'retained-original-plus-portable-readout');
    requireFact(before.line.metadata.barocss===before.metadata,'Refusal replaced metadata');assertNative(before.metadata,before.metadataCopy);
    requireFact(counters.callbacks===before.callbacks&&records.length===before.recordCount&&allResources.length===before.allResourcesCount,'Refusal allocated/disposed/admitted/called render');
    assertNative(allResources.map(row=>[row.meshDisposals,row.geometryDisposals,row.materialDisposals]),before.resourceCounts);
    requireFact(!scene.isDisposed&&scene.activeCamera===before.activeCamera&&scene.useRightHandedSystem===before.rightHanded,'Refusal changed caller Scene/camera');
    for(const [name,objects] of Object.entries(before.collections))requireFact(scene[name].length===objects.length&&scene[name].every((object,index)=>object===objects[index]),'Refusal changed Scene '+name+' collection/order');
    for(const item of before.objects){const children=item.object.getChildren();requireFact(item.object.parent===item.parent&&children.length===item.children.length&&children.every((child,index)=>child===item.children[index]),'Refusal changed actual caller hierarchy');assertNative(pose(item.object),item.pose,'retained-caller-pose');}
  }
  function findAsset(assets, key) {
    const asset = assets instanceof Map ? assets.get(key) : Array.isArray(assets) ? assets.find(item => item.key === key) : assets[key];
    requireFact(asset, 'Authentic required refusal case missing'); return asset;
  }
  const host = {
    get accepted() { return accepted; }, get records() { return records; }, get allResources() { return allResources; }, get events() { return events; },
    get counts() { return { ...counters, pairs: allResources.length, livePairs: livePairs(), peakLivePairs,
      meshDisposals:allResources.reduce((sum,row)=>sum+row.meshDisposals,0), geometryDisposals: allResources.reduce((sum, row) => sum + row.geometryDisposals, 0), materialDisposals: allResources.reduce((sum, row) => sum + row.materialDisposals, 0), disposed }; },
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
      let candidate;
      try {
        candidate=stage(freshAsset,proof,result,'cold-reopen');
        assertNative(candidate.readout,previous.readout,'complete-cold-original-and-portable-readout');
        assertBuffer(result.line.getVerticesData('position'),previous.resources[0].positions,'cold-original-target-positions');
        assertBuffer(result.line.getIndices(),previous.resources[0].indices,'cold-original-target-indices');
      } catch(error) {result.dispose();result.dispose();throw error;}
      return admit(candidate);
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
      refuse('malformed-source', 'public-babylon-source', () => parse('@model {invalid'), 'BaroCadUniformCurveSourceError', 'SOURCE');
      refuse('count-one', 'public-babylon-options', () => parse(base.source, { ...createNativeOptions(), uniformCurveDisplay: { version: 1, count: 1 } }), 'BaroCadUniformCurveSourceError', 'OPTIONS');
      refuse('unsafe-float32-scale', 'public-babylon-source', () => parse(base.source, { ...createNativeOptions(), unitsPerMillimeter: 1e-50 }), 'BaroCadUniformCurveSourceError', 'POSITIONS');
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
