import { compileCadModel, validateSourceSurfaceControlNetEdit } from '@barocss/cad';
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import { BaroCADLoader } from '@barocss/cad-interop/three';
import { Mesh } from 'three';
import { assertBuffer, assertNative, createNativeOptions, createRefusalActions,
  nativeCenters, proveCase, requireFact } from './source-surface-control-net-three-fixture.mjs';
import { observeSourceEditResult } from './source-surface-control-net-three-observer.mjs';

// Example-only diagnostics; these are not CAD or SDK diagnostic codes.
export class LoaderSurfaceEditHostIdentityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'LoaderSurfaceEditHostIdentityError';
    this.code = code;
  }
}

export function createSourceEditHost({ scene, onChange = () => {} }) {
  const records = [], events = [], allResources = [];
  let accepted = null, currentAsset = null, disposed = false, targetParseCalls = 0;
  const options = createNativeOptions();
  function active() { requireFact(!disposed, 'The example host has been disposed'); }
  function parseTarget(source, settings) {
    targetParseCalls++;
    const result = new BaroCADLoader(settings).parse(source);
    const resources = observeSourceEditResult(result);
    allResources.push(...resources);
    return { result, resources };
  }
  function verifyDisplay(result, neutral) {
    requireFact(result.source === neutral.source, 'Three lost complete source');
    assertNative(result.model, neutral.model, 'Three Model differs from complete neutral Model');
    requireFact(result.curves.length === 0 && result.group.parent === null, 'Expected detached Surface-only result');
    assertNative(result.unrenderedCurveIds, result.model.objects.filter(object =>
      object.kind === 'curve').map(object => object.id), 'Unrendered native Curve IDs changed');
    requireFact(result.group.children.length === neutral.surfaces.length, 'Expected every original Surface');
    for (const [index, object] of result.group.children.entries()) {
      const preview = neutral.surfaces[index];
      requireFact(object instanceof Mesh && object.name === preview.surfaceId, 'Surface binding changed');
      requireFact(preview.report.vertexCount === 64 && preview.report.triangleCount === 98, 'Grid bounds changed');
      assertBuffer(object.geometry.getAttribute('position').array, preview.mesh.positions, 'Position buffer changed');
      assertBuffer(object.geometry.getAttribute('normal').array, preview.mesh.normals, 'Normal buffer changed');
      assertBuffer(object.geometry.getAttribute('_CAD_UV').array, preview.mesh.parameters, 'Native UV buffer changed');
      assertBuffer(object.geometry.getIndex().array, preview.mesh.indices, 'Index buffer changed');
      requireFact(object.position.x === 0 && object.position.y === 0 && object.position.z === 0 &&
        object.scale.x === 1 && object.scale.y === 1 && object.scale.z === 1, 'Authored pose changed');
    }
  }
  function stage(asset, proof, state, source, expectedModel, sourceEdit) {
    const neutral = parseBaroCadSource(source, options);
    assertNative(neutral.model, expectedModel, 'Whole source changed before target preparation');
    const prepared = parseTarget(source, options);
    try {
      verifyDisplay(prepared.result, neutral);
      return { assetKey: asset.key, state, source, model: prepared.result.model, result: prepared.result,
        sourceEdit, resources: prepared.resources, centers: nativeCenters(prepared.result.model, asset.request.surfaceId), proof };
    } catch (error) {
      prepared.result.dispose();
      throw error;
    }
  }
  function commit(record, asset) {
    const previous = accepted;
    scene.add(record.result.group);
    accepted = record;
    currentAsset = asset;
    records.push(record);
    previous?.result.dispose();
    events.push({ type: 'admitted', assetKey: record.assetKey, state: record.state,
      surfaces: record.resources.length, unrenderedCurveIds: [...record.result.unrenderedCurveIds],
      previousDisposed: previous !== null });
    onChange(record);
    return record;
  }
  function guardRequest(request) {
    requireFact(accepted !== null, 'Load a complete original asset first');
    if (request.source !== accepted.source) throw new LoaderSurfaceEditHostIdentityError(
      'STALE_REQUEST_SOURCE', 'Request source differs from accepted complete asset');
    return request;
  }
  function guardCandidate(source, whole) {
    assertNative(validateSourceSurfaceControlNetEdit(whole), whole.report, 'Whole result changed');
    if (source !== whole.source) throw new LoaderSurfaceEditHostIdentityError(
      'INCOMPLETE_CANDIDATE_SOURCE', 'Candidate source differs from full public edit result source');
    const compiled = compileCadModel(source, { sourceVersion: 0 });
    requireFact(compiled.ok, 'Complete candidate compiler refused');
    assertNative(compiled.model, whole.model, 'Complete candidate Model differs from actual whole edit');
    return compiled.model;
  }
  function allocationState() {
    return { targetParseCalls, observedAllocatedPairs: allResources.length,
      geometryDisposals: allResources.reduce((sum, row) => sum + row.geometryDisposals, 0),
      materialDisposals: allResources.reduce((sum, row) => sum + row.materialDisposals, 0) };
  }
  function retained(record, source, model, children, sceneChildren) {
    requireFact(accepted === record && accepted.source === source, 'Accepted source/record changed on refusal');
    assertNative(accepted.model, model, 'Accepted native Model changed on refusal');
    requireFact(accepted.result.group.parent === scene && accepted.result.group.children.length === children.length &&
      children.every((child, index) => accepted.result.group.children[index] === child), 'Accepted Scene changed on refusal');
    requireFact(scene.children.length === sceneChildren.length &&
      sceneChildren.every((child, index) => scene.children[index] === child), 'Caller Scene children changed');
    for (const row of record.resources) {
      requireFact(row.geometryDisposals === 0 && row.materialDisposals === 0, 'Accepted resource disposed on refusal');
      requireFact(row.object.geometry === row.geometry && row.object.material === row.material, 'Accepted resource identity changed');
      assertBuffer(row.geometry.getAttribute('position').array, row.positions, 'Accepted positions changed');
      assertBuffer(row.geometry.getAttribute('normal').array, row.normals, 'Accepted normals changed');
      assertBuffer(row.geometry.getAttribute('_CAD_UV').array, row.parameters, 'Accepted UV changed');
      assertBuffer(row.geometry.getIndex().array, row.indices, 'Accepted indices changed');
    }
  }
  return {
    get accepted() { return accepted; },
    get records() { return records; },
    get events() { return events; },
    loadOriginal(asset) {
      active();
      const proof = proveCase(asset);
      return commit(stage(asset, proof, 'original', asset.originalSource, proof.originalModel, null), asset);
    },
    applyEdit(asset) {
      active();
      guardRequest(asset.request);
      const proof = proveCase(asset);
      guardCandidate(proof.edit.source, proof.edit);
      return commit(stage(asset, proof, 'candidate', proof.edit.source, proof.model, proof.edit), asset);
    },
    coldReopen() {
      active();
      requireFact(accepted?.sourceEdit !== null && accepted?.sourceEdit !== undefined,
        'Cold reopen requires an admitted complete candidate');
      const compiled = compileCadModel(accepted.source, { sourceVersion: 0 });
      requireFact(compiled.ok, 'Cold complete candidate compiler refused');
      assertNative(compiled.model, accepted.model, 'Cold native candidate Model differs');
      const previous = accepted;
      return commit(stage(currentAsset, previous.proof, 'cold-reopen', previous.source,
        compiled.model, previous.sourceEdit), currentAsset);
    },
    runRefusals(asset) {
      active();
      requireFact(accepted?.assetKey === 'mixed_weighted' && accepted.state === 'original',
        'Frozen refusal flow starts from the mixed complete original');
      const record = accepted, source = record.source, model = structuredClone(record.model);
      const children = [...record.result.group.children], sceneChildren = [...scene.children];
      const requestBefore = structuredClone(asset.request), ownedBefore = structuredClone(asset.owned);
      const suite = createRefusalActions(asset, {
        guardRequest, guardCandidate,
        probeTarget(text, settings) {
          const prepared = parseTarget(text, settings);
          prepared.result.dispose();
          return prepared.result;
        },
      });
      const refusals = [];
      for (const action of suite.actions) {
        const before = allocationState();
        let error;
        try { action.run(); } catch (cause) { error = cause; }
        requireFact(error instanceof Error, 'Expected actual refusal: ' + action.name);
        const expectedName = action.scope === 'private-host-only' ? 'LoaderSurfaceEditHostIdentityError' :
          action.scope.startsWith('public-Three') ? 'RangeError' : 'SourceSurfaceControlNetError';
        requireFact(error.name === expectedName && (error.code ?? null) === action.code,
          'Actual error differs for ' + action.name);
        if (action.causeMessage) {
          requireFact(error.cause instanceof Error && error.cause.code === undefined &&
            error.cause.message.includes(action.causeMessage), 'Actual native cause differs');
        } else requireFact(error.cause === undefined, 'Unexpected cause for ' + action.name);
        const after = allocationState();
        requireFact(before.observedAllocatedPairs === after.observedAllocatedPairs &&
          before.geometryDisposals === after.geometryDisposals && before.materialDisposals === after.materialDisposals,
        'Refusal created or disposed successful target resources');
        retained(record, source, model, children, sceneChildren);
        assertNative(asset.request, requestBefore, 'Refusal changed original request');
        assertNative(asset.owned, ownedBefore, 'Refusal changed original whole result');
        refusals.push({ name: action.name, scope: action.scope,
          error: { name: error.name, code: error.code ?? null, message: error.message },
          cause: error.cause ? { name: error.cause.name, code: error.cause.code ?? null, message: error.cause.message } : null,
          allocations: { before, after }, retained: true });
      }
      requireFact(refusals.length === 16 && suite.getterCalls() === 0, 'Frozen refusal/getter count differs');
      const result = { refusals, getterCalls: suite.getterCalls(), acceptedRetained: true };
      events.push({ type: 'refusals', assetKey: asset.key, count: refusals.length, getterCalls: 0 });
      return result;
    },
    observations() {
      return { disposed, targetParseCalls, accepted: accepted ? {
        assetKey: accepted.assetKey, state: accepted.state, source: accepted.source,
        modelName: accepted.model.name, objectIds: accepted.model.objects.map(object => object.id),
        unrenderedCurveIds: [...accepted.result.unrenderedCurveIds], centers: accepted.centers,
        patchCount: accepted.sourceEdit?.patches.length ?? 0,
        report: accepted.sourceEdit?.report ?? null,
        selectedPoleXNegativeZero: Object.is(accepted.model.objects.find(object =>
          object.id === currentAsset.request.surfaceId).controlPoints[0][0][0], -0),
      } : null,
      records: records.map(record => ({ assetKey: record.assetKey, state: record.state, surfaces: record.resources.length,
        sourceRetained: record.source === record.result.source,
        resources: record.resources.map(row => ({ surfaceId: row.surfaceId,
          geometryDisposals: row.geometryDisposals, materialDisposals: row.materialDisposals })) })),
      ...allocationState() };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      accepted?.result.dispose();
      accepted = null;
      currentAsset = null;
      events.push({ type: 'disposed' });
      onChange(null);
    },
  };
}
