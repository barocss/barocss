import { classifyAxisBoxSolidBooleanPoints, validateAxisBoxSolidBooleanPointClassification,
  validateAxisBoxSolidBoolean } from '@barocss/cad';
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import { BaroCADLoader } from '@barocss/cad-interop/three';
import { Group, Mesh } from 'three';
import { assertNative, assertBuffer, createNativeOptions, coldModel, panelQualification,
  proveCase, requireFact } from './axis-box-boolean-three-fixture.mjs';
import { observeAxisBoxResult } from './axis-box-boolean-three-observer.mjs';

// These codes belong to the example only, not the public CAD/SDK.
export class LoaderBooleanThreeHostError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'LoaderBooleanThreeHostError';
    this.code = code;
  }
}
export function createBooleanThreeHost({ scene, onChange = () => {} }) {
  const records = [], events = [], allResources = [];
  let accepted = null, disposed = false, targetParseCalls = 0, peakLivePairs = 0, partialPairs = 0;
  const options = createNativeOptions();
  const livePairs = () => allResources.filter(row => row.geometryDisposals === 0 && row.materialDisposals === 0).length;
  const counts = () => ({ collections: records.length, pairs: allResources.length,
    acceptedPairs: records.reduce((sum, record) => sum + record.results.length, 0),
    partialPairs, targetParseCalls, peakLivePairs, livePairs: livePairs(),
    geometryDisposals: allResources.reduce((sum, row) => sum + row.geometryDisposals, 0),
    materialDisposals: allResources.reduce((sum, row) => sum + row.materialDisposals, 0) });
  function active() { requireFact(!disposed, 'Boolean example has been disposed'); }
  function guardSource(asset, panel, supplied) {
    const expected = asset.boolean.sources.find(source => source.panelId === panel.id);
    const model = coldModel(supplied.source);
    if (!expected || supplied.panelId !== panel.id || supplied.sourceId !== panel.sourceId ||
      supplied.source !== expected.source) {
      throw new LoaderBooleanThreeHostError('SOURCE_BINDING', 'Compiler-valid source differs from the original qualified selected panel');
    }
    assertNative(model, expected.model, 'Complete original panel cold Model changed');
    assertNative(model, panel.bundle.geometry, 'Whole original panel FaceBundle geometry changed');
    return model;
  }
  function parseTarget(source, settings, qualification = null, partial = false) {
    targetParseCalls++;
    const result = new BaroCADLoader(settings).parse(source);
    const resources = observeAxisBoxResult(result);
    for (const row of resources) Object.assign(row, qualification ?? {}, {
      qualification, result, resultGroup: result.group, partial });
    allResources.push(...resources);
    if (partial) partialPairs += resources.length;
    peakLivePairs = Math.max(peakLivePairs, livePairs());
    events.push({ type: 'prepared', partial, livePairs: livePairs(), pairs: resources.length,
      ...(qualification ? { panelId: qualification.panelId } : {}) });
    return { result, resources };
  }
  function disposeCollection(record) {
    for (const result of record.results) { result.dispose(); result.dispose(); }
    if (record.root) { record.root.removeFromParent(); record.root.clear(); }
  }
  function readout(proof, key) {
    const { boolean, classification, controls } = proof;
    return { caseKey: key, empty: boolean.report.empty, booleanReport: boolean.report,
      queryReport: classification.report,
      queries: classification.queries.map(query => ({ ...query,
        ...classification.classifications.find(value => value.queryId === query.queryId) })),
      bodies: boolean.bodies, shells: boolean.shells,
      qualifications: proof.panelModels.map(panel => panel.qualification), controls,
      localFaceScope: 'Original open FaceBundle display is separate from restricted aggregate Solid proof',
      frame: 'authored-xyz-no-axis-conversion', unitsPerMillimeter: options.unitsPerMillimeter };
  }
  function stage(asset, state, failAfterPrepared = null) {
    for (const panel of asset.boolean.panels) guardSource(asset, panel, asset.panelSources.get(panel.id));
    const proof = proveCase(asset);
    // Validate and prepare neutral data for the entire collection before target allocation.
    const previews = proof.panelModels.map(panel => {
      const neutral = parseBaroCadSource(panel.source, options);
      assertNative(neutral.model, panel.model, 'Whole neutral panel Model changed');
      requireFact(neutral.surfaces.length === 1 && neutral.curves.length === 0 &&
        neutral.unrenderedCurveIds.length === 4, 'Retain four original native Curves without Lines');
      return neutral;
    });
    const root = proof.panelModels.length ? new Group() : null;
    const results = [], resources = [], bodyGroups = new Map(), shellGroups = new Map();
    if (root) {
      root.name = proof.boolean.options.evaluationId;
      for (const body of proof.boolean.bodies) {
        const group = new Group(); group.name = body.id; group.userData = { bodyId: body.id };
        root.add(group); bodyGroups.set(body.id, group);
      }
      for (const shell of proof.boolean.shells) {
        const group = new Group(); group.name = shell.id;
        group.userData = { bodyId: shell.bodyId, shellId: shell.id, shellRole: shell.role, emptyRegionId: shell.emptyRegionId };
        requireFact(bodyGroups.has(shell.bodyId), 'Original Shell must belong to its original Body');
        bodyGroups.get(shell.bodyId).add(group); shellGroups.set(shell.id, group);
      }
    }
    const candidate = { assetKey: asset.key, state, asset, proof, root, results, resources,
      readout: readout(proof, asset.key) };
    try {
      for (const [index, panel] of proof.panelModels.entries()) {
        const neutral = previews[index], preview = neutral.surfaces[0];
        const prepared = parseTarget(panel.source, options, panel.qualification, failAfterPrepared !== null);
        results.push(prepared.result); resources.push(...prepared.resources);
        const { result } = prepared;
        requireFact(result.group.parent === null && result.source === panel.source &&
          result.group.children.length === 1 && result.curves.length === 0, 'Expected complete detached original Surface result');
        assertNative(result.model, panel.model, 'Original target Model5 changed');
        assertNative(result.unrenderedCurveIds, panel.model.objects.filter(object => object.kind === 'curve').map(object => object.id), 'Boundary IDs changed');
        const object = result.group.children[0];
        requireFact(object instanceof Mesh && object.name === panel.qualification.surfaceId &&
          preview.report.vertexCount === 4 && preview.report.triangleCount === 2, 'Qualified original Surface/grid changed');
        assertBuffer(object.geometry.getAttribute('position').array, preview.mesh.positions, 'Actual panel position buffer changed');
        assertBuffer(object.geometry.getAttribute('normal').array, preview.mesh.normals, 'Actual panel normal buffer changed');
        assertBuffer(object.geometry.getAttribute('_CAD_UV').array, preview.mesh.parameters, 'Original native panel UV changed');
        assertBuffer(object.geometry.getIndex().array, preview.mesh.indices, 'Actual panel index buffer changed');
        requireFact(result.group.position.lengthSq() === 0 && result.group.scale.x === 1 && result.group.scale.y === 1 &&
          result.group.scale.z === 1 && result.group.quaternion.x === 0 && result.group.quaternion.y === 0 &&
          result.group.quaternion.z === 0 && result.group.quaternion.w === 1 &&
          object.position.lengthSq() === 0 && object.scale.x === 1 && object.scale.y === 1 && object.scale.z === 1,
        'Original authored coordinate pose changed');
        // The original public result Group remains the owner of its Mesh.
        shellGroups.get(panel.qualification.shellId).add(result.group);
        requireFact(object.parent === result.group, 'Mesh must remain in original result Group');
        if (failAfterPrepared !== null && results.length === failAfterPrepared) {
          throw new LoaderBooleanThreeHostError('STAGED_PREPARATION_REFUSAL',
            'Controlled host refusal after two genuine detached panel results; not a GL allocation failure');
        }
      }
      requireFact(results.length === proof.boolean.panels.length, 'Complete original panel collection required');
      requireFact((root === null) === proof.boolean.report.empty, 'Empty proof must not create a display Group');
      return candidate;
    } catch (error) {
      disposeCollection(candidate);
      events.push({ type: 'candidate-disposed', partial: failAfterPrepared !== null, pairs: resources.length });
      throw error;
    }
  }
  function commit(record) {
    const previous = accepted;
    if (record.root) scene.add(record.root);
    accepted = record; records.push(record);
    if (previous) disposeCollection(previous);
    events.push({ type: 'admitted', assetKey: record.assetKey, state: record.state,
      panels: record.results.length, empty: record.root === null, previousDisposed: previous !== null });
    onChange(record);
    return record;
  }
  function snapshotAsset(asset) {
    return structuredClone({ request: asset.request, owned: asset.owned, boolean: asset.boolean,
      booleanRequest: asset.booleanRequest, panelSources: Array.from(asset.panelSources.entries()),
      operandSources: asset.operandSources, originalTexts: Array.from(asset.originalTexts.entries()) });
  }
  return {
    get accepted() { return accepted; },
    get records() { return records; },
    get allResources() { return allResources; },
    get events() { return events; },
    get counts() { return counts(); },
    get targetParseCalls() { return targetParseCalls; },
    get peakLivePairs() { return peakLivePairs; },
    load(asset, state = 'original') {
      active(); requireFact(state === 'original', 'Only original collection admission uses load');
      return commit(stage(asset, state));
    },
    coldReopen(cavityAsset) {
      active(); requireFact(cavityAsset.key === 'cavity', 'Frozen cold flow reopens complete cavity');
      return commit(stage(cavityAsset, 'cold-reopen'));
    },
    runRefusals(asset) {
      active();
      requireFact(asset.key === 'union' && accepted?.assetKey === 'union' && accepted.state === 'original', 'Frozen refusals begin from original union');
      const record = accepted, assetBefore = snapshotAsset(asset),
        proofBefore = structuredClone(record.proof), readoutBefore = structuredClone(record.readout);
      const sceneChildren = [...scene.children], meshes = record.resources.map(row => row.object);
      const groupParents = record.results.map(result => result.group.parent);
      let getterCalls = 0;
      const request = asset.request;
      const classify = (boolean, queries, settings) => classifyAxisBoxSolidBooleanPoints(boolean, queries, settings);
      const badQueries = structuredClone(request.queries); badQueries[0].pointMM[0] = NaN;
      const identityQueries = structuredClone(request.queries); identityQueries[0].queryId = asset.boolean.panels[0].bundle.geometry.objects[0].id;
      const getterOptions = { evaluationId: request.options.evaluationId };
      Object.defineProperty(getterOptions, 'maximumQueries', { enumerable: true, get() { getterCalls++; return 8; } });
      const badBoolean = structuredClone(asset.boolean); badBoolean.report.panelCount++;
      const badOwnedShell = structuredClone(asset.owned); badOwnedShell.classifications[1].boundaryPanels[0].shellId = 'foreign_shell';
      const badOwnedPoint = structuredClone(asset.owned); badOwnedPoint.queries[1].pointMM[0] = 4 + 2 ** -20;
      const firstSource = asset.panelSources.get(asset.boolean.panels[0].id);
      function probeTarget(source, settings) {
        const prepared = parseTarget(source, settings);
        prepared.result.dispose(); prepared.result.dispose();
        return prepared.result;
      }
      const actions = [
        { name: 'maximumQueries9', errorName: 'AxisBoxSolidBooleanPointError', code: 'BUDGET',
          run: () => classify(asset.boolean, request.queries, { ...request.options, maximumQueries: 9 }) },
        { name: 'nonfiniteWorldPoint', errorName: 'AxisBoxSolidBooleanPointError', code: 'INPUT', run: () => classify(asset.boolean, badQueries, request.options) },
        { name: 'queryIdentityCollision', errorName: 'AxisBoxSolidBooleanPointError', code: 'IDENTITY', run: () => classify(asset.boolean, identityQueries, request.options) },
        { name: 'queryOptionsGetter', errorName: 'AxisBoxSolidBooleanPointError', code: 'INPUT', run: () => classify(asset.boolean, request.queries, getterOptions) },
        { name: 'badBooleanParent', errorName: 'AxisBoxSolidBooleanPointError', code: 'BOOLEAN', causeCode: 'OWNED',
          run: () => classify(badBoolean, request.queries, request.options) },
        { name: 'directBadBooleanOwned', errorName: 'AxisBoxSolidBooleanError', code: 'OWNED', run: () => validateAxisBoxSolidBoolean(badBoolean) },
        { name: 'ownedQualifiedShellTamper', errorName: 'AxisBoxSolidBooleanPointError', code: 'OWNED', run: () => validateAxisBoxSolidBooleanPointClassification(badOwnedShell) },
        { name: 'ownedPointChangesActualBoundary', errorName: 'AxisBoxSolidBooleanPointError', code: 'OWNED', run: () => validateAxisBoxSolidBooleanPointClassification(badOwnedPoint) },
        { name: 'invalidSurfaceGrid', errorName: 'RangeError', code: null, run: () => probeTarget(firstSource.source, { ...createNativeOptions(), countU: 1 }) },
        { name: 'badCapacityProfile', errorName: 'RangeError', code: null, run: () => probeTarget(firstSource.source,
          { ...createNativeOptions(), nativeCapacity: { version: 1, maximumObjects: 15 } }) },
        { name: 'malformedPanelSource', errorName: 'BaroCadSourceError', code: null, run: () => probeTarget('@model {', createNativeOptions()) },
        { name: 'panelSourceAssociationGuard', errorName: 'LoaderBooleanThreeHostError', code: 'SOURCE_BINDING', host: true,
          run() {
            const other = asset.panelSources.get(asset.boolean.panels[1].id);
            requireFact(coldModel(other.source).objects.length === 5, 'Source association negative must be genuinely compiler-valid');
            return guardSource(asset, asset.boolean.panels[0], { ...firstSource, source: other.source });
          } },
        { name: 'controlledStagedPreparationRefusal', errorName: 'LoaderBooleanThreeHostError', code: 'STAGED_PREPARATION_REFUSAL', host: true, partial: true,
          run: () => stage(asset, 'controlled-partial', 2) },
      ];
      const refusals = [];
      for (const action of actions) {
        const before = counts();
        let error;
        try { action.run(); } catch (cause) { error = cause; }
        requireFact(error instanceof Error && error.name === action.errorName && (error.code ?? null) === action.code,
          'Actual frozen refusal differs: ' + action.name);
        requireFact((error.cause?.code ?? null) === (action.causeCode ?? null), 'Actual cause code differs');
        if (action.name === 'badBooleanParent') requireFact(error.cause.name === 'AxisBoxSolidBooleanError', 'Actual Boolean cause name differs');
        if (action.name === 'malformedPanelSource') requireFact(error.diagnostics?.[0]?.code === 'SYNTAX', 'Actual compiler SYNTAX diagnostic required');
        const after = counts(), extra = action.partial ? 2 : 0;
        requireFact(after.pairs === before.pairs + extra && after.geometryDisposals === before.geometryDisposals + extra &&
          after.materialDisposals === before.materialDisposals + extra, 'Refusal resource accounting differs');
        requireFact(accepted === record && record.root.parent === scene && records.length === 1 &&
          scene.children.length === sceneChildren.length && sceneChildren.every((child, index) => scene.children[index] === child),
        'Accepted complete Scene/readout identity changed');
        assertNative(record.proof, proofBefore, 'Accepted entire native proof changed');
        assertNative(record.readout, readoutBefore, 'Accepted entire native readout changed');
        assertNative(snapshotAsset(asset), assetBefore, 'Original asset inputs changed');
        for (const [index, row] of record.resources.entries()) {
          requireFact(row.object === meshes[index] && row.object.parent === row.result.group &&
            row.result.group.parent === groupParents[index] && row.object.geometry === row.geometry && row.object.material === row.material &&
            row.geometryDisposals === 0 && row.materialDisposals === 0, 'Accepted qualified resource identity changed');
          assertBuffer(row.geometry.getAttribute('position').array, row.positions, 'Accepted panel positions changed');
          assertBuffer(row.geometry.getAttribute('normal').array, row.normals, 'Accepted panel normals changed');
          assertBuffer(row.geometry.getAttribute('_CAD_UV').array, row.parameters, 'Accepted native UV changed');
          assertBuffer(row.geometry.getIndex().array, row.indices, 'Accepted panel indices changed');
        }
        refusals.push({ name: action.name, scope: action.host ? 'example-host-only' : 'actual-public-API',
          error: { name: error.name, code: error.code ?? null, message: error.message, diagnostics: error.diagnostics ?? null },
          cause: error.cause ? { name: error.cause.name, code: error.cause.code ?? null, message: error.cause.message } : null,
          allocations: { before, after }, controlledPartialPairs: extra, acceptedRetained: true });
      }
      requireFact(refusals.length === 13 && getterCalls === 0, 'Frozen refusal/getter count differs');
      events.push({ type: 'refusals', count: refusals.length, getterCalls, controlledPartialPairs: 2 });
      return { refusals, getterCalls, acceptedRetained: true };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (accepted) disposeCollection(accepted);
      accepted = null;
      events.push({ type: 'disposed' });
      onChange(null);
    },
  };
}
