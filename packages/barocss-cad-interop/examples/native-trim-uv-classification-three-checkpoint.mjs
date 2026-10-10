import { classifyVLinearSurfacePlaneTrimUV, validateVLinearSurfacePlaneTrimUVClassification,
  compileCadModel } from '@barocss/cad';
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import { BaroCADLoader } from '@barocss/cad-interop/three';
import { Mesh } from 'three';
import { assertNative, assertBuffer, createNativeOptions, proveCase, requireFact, sameNative } from './native-trim-uv-classification-three-fixture.mjs';
import { observeTrimResult } from './native-trim-uv-classification-three-observer.mjs';

// Private example guards; these are not public CAD diagnostic codes.
export class LoaderTrimUVHostBindingError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'LoaderTrimUVHostBindingError';
    this.code = code;
  }
}

export function createTrimUVHost({ scene, onChange = () => {} }) {
  const records = [], events = [], allResources = [];
  let accepted = null, currentAsset = null, disposed = false, targetParseCalls = 0, peakLivePairs = 0;
  const options = createNativeOptions();
  function active() { requireFact(!disposed, 'Trim example host has been disposed'); }
  function guardBindings(asset) {
    if (asset.source !== asset.request.trim.world.source) throw new LoaderTrimUVHostBindingError(
      'SOURCE_BINDING', 'Complete source differs from the authoritative stored trim world source');
    const edges = asset.request.trim.edges;
    if (!(asset.sidecars instanceof Map) || asset.sidecars.size !== edges.length ||
      edges.some(edge => !sameNative(asset.sidecars.get(edge.role), edge.pcurve))) {
      throw new LoaderTrimUVHostBindingError('UV_SIDECAR_BINDING',
        'Dimensionless sidecars differ from the original stored trim edge pcurves');
    }
  }
  function readout(proof, result) {
    const { classification, trim, controls } = proof;
    return { displayRole: 'untrimmed-original-support', sourceId: classification.report.sourceId,
      surfaceId: classification.report.surfaceId, modelName: result.model.name,
      objectCount: result.model.objects.length, unrenderedCurveIds: [...result.unrenderedCurveIds],
      uvLengthUnit: 'dimensionless',
      queries: classification.queries.map(query => {
        const value = classification.classifications.find(item => item.queryId === query.queryId);
        const witness = classification.proof.queries.find(item => item.queryId === query.queryId);
        return { ...query, chart: value.chart, chartBoundaries: [...value.chartBoundaries],
          cutRelation: value.cutRelation, faces: structuredClone(value.faces),
          method: witness.method, subdivisions: witness.steps.length };
      }),
      graph: { vertices: trim.vertices.length, edges: trim.edges.length, loops: trim.loops.length, faces: trim.faces.length },
      report: classification.report, quality: classification.report.quality, trimReport: trim.report, controls };
  }
  function parseTarget(source, settings) {
    targetParseCalls++;
    const result = new BaroCADLoader(settings).parse(source);
    const resources = observeTrimResult(result);
    allResources.push(...resources);
    const livePairs = allResources.filter(row => row.geometryDisposals === 0 && row.materialDisposals === 0).length;
    peakLivePairs = Math.max(peakLivePairs, livePairs);
    events.push({ type: 'prepared', livePairs });
    return { result, resources };
  }
  function stage(asset, state) {
    guardBindings(asset);
    const proof = proveCase(asset);
    const neutral = parseBaroCadSource(asset.source, options);
    assertNative(neutral.model, proof.model, 'Complete native source differs from classified trim');
    requireFact(neutral.curves.length === 0 && neutral.surfaces.length === 1 &&
      neutral.unrenderedCurveIds.length === 7, 'Expected one untrimmed Support and seven unrendered native Curves');
    const prepared = parseTarget(asset.source, options);
    try {
      const { result } = prepared;
      requireFact(result.source === asset.source && result.group.parent === null, 'Candidate must retain complete source and be detached');
      assertNative(result.model, proof.model, 'Three native Model differs');
      assertNative(result.unrenderedCurveIds, proof.model.objects.filter(object => object.kind === 'curve').map(object => object.id),
        'Seven original Curve IDs changed');
      requireFact(result.curves.length === 0 && result.group.children.length === 1, 'Only original Support is displayed');
      const object = result.group.children[0], preview = neutral.surfaces[0];
      requireFact(object instanceof Mesh && object.name === proof.classification.report.surfaceId &&
        preview.report.vertexCount === 64 && preview.report.triangleCount === 98, 'Original Surface binding/grid differs');
      assertBuffer(object.geometry.getAttribute('position').array, preview.mesh.positions, 'Actual positions differ from neutral');
      assertBuffer(object.geometry.getAttribute('normal').array, preview.mesh.normals, 'Actual normals differ from neutral');
      assertBuffer(object.geometry.getAttribute('_CAD_UV').array, preview.mesh.parameters, 'Original native UV differs');
      assertBuffer(object.geometry.getIndex().array, preview.mesh.indices, 'Actual indices differ from neutral');
      requireFact(result.group.position.x === 0 && result.group.position.y === 0 && result.group.position.z === 0 &&
        result.group.scale.x === 1 && result.group.scale.y === 1 && result.group.scale.z === 1 &&
        result.group.quaternion.x === 0 && result.group.quaternion.y === 0 && result.group.quaternion.z === 0 && result.group.quaternion.w === 1 &&
        object.position.x === 0 && object.position.y === 0 && object.position.z === 0 &&
        object.scale.x === 1 && object.scale.y === 1 && object.scale.z === 1, 'Original authored pose changed');
      return { assetKey: asset.key, state, source: asset.source, model: result.model,
        result, proof, resources: prepared.resources, readout: readout(proof, result) };
    } catch (error) {
      prepared.result.dispose();
      throw error;
    }
  }
  function commit(record, asset) {
    const previous = accepted;
    scene.add(record.result.group);
    accepted = record; currentAsset = asset;
    records.push(record);
    previous?.result.dispose();
    events.push({ type: 'admitted', assetKey: asset.key, state: record.state, previousDisposed: previous !== null });
    onChange(record);
    return record;
  }
  function allocationState() {
    return { targetParseCalls, observedAllocatedPairs: allResources.length, peakLivePairs,
      livePairs: allResources.filter(row => row.geometryDisposals === 0 && row.materialDisposals === 0).length,
      geometryDisposals: allResources.reduce((sum, row) => sum + row.geometryDisposals, 0),
      materialDisposals: allResources.reduce((sum, row) => sum + row.materialDisposals, 0) };
  }
  return {
    get accepted() { return accepted; },
    get records() { return records; },
    get events() { return events; },
    get allResources() { return allResources; },
    get targetParseCalls() { return targetParseCalls; },
    get peakLivePairs() { return peakLivePairs; },
    load(asset) { active(); return commit(stage(asset, 'original'), asset); },
    coldReopen() {
      active(); requireFact(accepted !== null, 'Load an original complete asset before reopening');
      const record = stage(currentAsset, 'cold-reopen');
      requireFact(record.source === accepted.source, 'Cold reopen changed complete source');
      assertNative(record.model, accepted.model, 'Cold reopen changed original native Model');
      return commit(record, currentAsset);
    },
    runRefusals(asset) {
      active();
      requireFact(accepted?.assetKey === 'dyadic_exact' && accepted.state === 'original' && asset.key === 'dyadic_exact',
        'Frozen refusal flow begins with original dyadic');
      const record = accepted, source = record.source, model = structuredClone(record.model),
        proof = structuredClone(record.proof), dataReadout = structuredClone(record.readout);
      const requestBefore = structuredClone(asset.request), ownedBefore = structuredClone(asset.owned);
      const sourceBefore = asset.source, parentSourcesBefore = [...asset.parentSources],
        sidecarsBefore = structuredClone(Array.from(asset.sidecars.entries()));
      const sceneChildren = [...scene.children], objects = [...record.result.group.children];
      let getterCalls = 0;
      const classify = request => classifyVLinearSurfacePlaneTrimUV(request.trim, request.queries, request.options);
      const changed = mutate => {
        const input = structuredClone(asset.request); mutate(input); return () => classify(input);
      };
      const getterOptions = { ...asset.request.options };
      Object.defineProperty(getterOptions, 'maxQueries', { enumerable: true, get() { getterCalls++; return 4; } });
      const badOwned = structuredClone(asset.owned);
      badOwned.classifications[0].faces[0].faceId = 'foreign_face';
      const wrongSource = { ...asset, source: asset.source + '/* complete-source identity negative */' };
      const wrongSidecar = { ...asset, sidecars: new Map(asset.sidecars) };
      const alteredUV = structuredClone(wrongSidecar.sidecars.get('sharedCut'));
      alteredUV.curve.controlPoints[0][0] += 0.125;
      wrongSidecar.sidecars.set('sharedCut', alteredUV);
      const actions = [
        { name: 'subdivision17', code: 'BUDGET', run: changed(input => input.options.maxSubdivisions = 17) },
        { name: 'fourQueriesDeclaredThree', code: 'BUDGET', run: changed(input => input.options.maxQueries = 3) },
        { name: 'nonfiniteQuery', code: 'INPUT', run: changed(input => input.queries[0].u = Infinity) },
        { name: 'queryIdCollidesOriginalSurface', code: 'IDENTITY', run: changed(input => input.queries[0].queryId = asset.owned.report.surfaceId) },
        { name: 'getterOptionsWithoutInvocation', code: 'INPUT', run: () => classify({ ...asset.request, options: getterOptions }) },
        { name: 'changedWholeTrimQuality', code: 'TRIM', causeCode: 'OWNED', run: changed(input => input.trim.report.quality.solid = true) },
        { name: 'changedOwnedQualifiedFaceBinding', code: 'OWNED', run: () => validateVLinearSurfacePlaneTrimUVClassification(badOwned) },
        { name: 'capacityMaximum15', errorName: 'RangeError', code: null,
          run: () => parseBaroCadSource(asset.source, { ...createNativeOptions(), nativeCapacity: { version: 1, maximumObjects: 15 } }) },
        { name: 'malformedColdSource', errorName: 'BaroCadSourceError', code: null,
          run: () => parseBaroCadSource('@model {', createNativeOptions()) },
        { name: 'validCompleteSourceIdentity', errorName: 'LoaderTrimUVHostBindingError', code: 'SOURCE_BINDING', host: true,
          run() {
            const cold = compileCadModel(wrongSource.source, { sourceVersion: 0 });
            requireFact(cold.ok, 'Complete source identity negative must be compiler-valid');
            assertNative(cold.model, model, 'Source comment negative changed native Model');
            return guardBindings(wrongSource);
          } },
        { name: 'changedUVSidecarIdentity', errorName: 'LoaderTrimUVHostBindingError', code: 'UV_SIDECAR_BINDING', host: true,
          run: () => guardBindings(wrongSidecar) },
        { name: 'targetCountU18', errorName: 'RangeError', code: null,
          run() {
            const candidate = parseTarget(asset.source, { ...createNativeOptions(), countU: 18 });
            candidate.result.dispose();
            return candidate;
          } },
      ];
      const refusals = [];
      for (const action of actions) {
        const before = allocationState();
        let error;
        try { action.run(); } catch (cause) { error = cause; }
        requireFact(error instanceof Error && error.name === (action.errorName ?? 'VLinearSurfacePlaneTrimUVError') &&
          (error.code ?? null) === action.code, 'Actual refusal differs: ' + action.name);
        requireFact((error.cause?.code ?? null) === (action.causeCode ?? null), 'Actual cause differs: ' + action.name);
        if (action.name === 'malformedColdSource') requireFact(error.diagnostics?.[0]?.code === 'SYNTAX', 'Compiler cause must remain actual SYNTAX');
        const after = allocationState();
        requireFact(before.observedAllocatedPairs === after.observedAllocatedPairs &&
          before.geometryDisposals === after.geometryDisposals && before.materialDisposals === after.materialDisposals,
        'Refusal created or disposed successful target resources');
        requireFact(accepted === record && accepted.source === source && accepted.result.group.parent === scene &&
          scene.children.length === sceneChildren.length && sceneChildren.every((child, index) => scene.children[index] === child) &&
          objects.every((object, index) => record.result.group.children[index] === object), 'Accepted Scene/source/objects changed');
        assertNative(record.model, model, 'Accepted native Model changed');
        assertNative(record.proof, proof, 'Accepted complete classification proof changed');
        assertNative(record.readout, dataReadout, 'Accepted native readout changed');
        assertNative(asset.request, requestBefore, 'Original request changed');
        assertNative(asset.owned, ownedBefore, 'Original owned file changed');
        requireFact(asset.source === sourceBefore, 'Original complete source text changed');
        assertNative(asset.parentSources, parentSourcesBefore, 'Original parent sources changed');
        assertNative(Array.from(asset.sidecars.entries()), sidecarsBefore, 'Original dimensionless sidecars changed');
        for (const row of record.resources) {
          requireFact(row.geometryDisposals === 0 && row.materialDisposals === 0 &&
            row.object.geometry === row.geometry && row.object.material === row.material, 'Accepted resource identity changed');
          assertBuffer(row.geometry.getAttribute('position').array, row.positions, 'Accepted positions changed');
          assertBuffer(row.geometry.getAttribute('normal').array, row.normals, 'Accepted normals changed');
          assertBuffer(row.geometry.getAttribute('_CAD_UV').array, row.parameters, 'Accepted UV changed');
          assertBuffer(row.geometry.getIndex().array, row.indices, 'Accepted indices changed');
        }
        refusals.push({ name: action.name, scope: action.host ? 'example-host-only' : action.errorName ? 'public-native-or-Three' : 'public-CAD',
          error: { name: error.name, code: error.code ?? null, message: error.message, diagnostics: error.diagnostics ?? null },
          cause: error.cause ? { name: error.cause.name, code: error.cause.code ?? null, message: error.cause.message } : null,
          allocations: { before, after }, retained: true });
      }
      requireFact(refusals.length === 12 && getterCalls === 0, 'Frozen refusal/getter count differs');
      events.push({ type: 'refusals', count: refusals.length, getterCalls });
      return { refusals, getterCalls, acceptedRetained: true };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      accepted?.result.dispose();
      accepted = null; currentAsset = null;
      events.push({ type: 'disposed' });
      onChange(null);
    },
  };
}
