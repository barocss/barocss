import { measureAxisBoxSolidBooleanMass, validateAxisBoxSolidBooleanMass, analyzeAxisBoxSolidPrincipalInertia, validateAxisBoxSolidPrincipalInertia } from '@barocss/cad';
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import { BaroCADLoader } from '@barocss/cad-interop/three';
import { Group, Mesh } from 'three';
import { assertNative, assertBuffer, createNativeOptions, coldModel, panelQualification,
  proveGeometry, provePrincipal, DEFAULT_CASES, requireFact } from './solid-mass-principal-three-fixture.mjs';
import { observeMassPrincipalResult } from './solid-mass-principal-three-observer.mjs';

// These codes belong to the example only, not the public CAD/SDK.
export class LoaderMassPrincipalThreeHostError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'LoaderMassPrincipalThreeHostError';
    this.code = code;
  }
}
export function createMassPrincipalThreeHost({ scene, onChange = () => {} }) {
  const records = [], updates = [], events = [], allResources = [];
  let accepted = null, disposed = false, targetParseCalls = 0, peakLivePairs = 0, partialPairs = 0, selectionUpdates = 0;
  const options = createNativeOptions();
  const livePairs = () => allResources.filter(row => row.geometryDisposals === 0 && row.materialDisposals === 0).length;
  const counts = () => ({ collections: records.length, updates: updates.length, selectionUpdates, pairs: allResources.length,
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
      throw new LoaderMassPrincipalThreeHostError('SOURCE_BINDING', 'Compiler-valid source differs from the original qualified selected panel');
    }
    assertNative(model, expected.model, 'Complete original panel cold Model changed');
    assertNative(model, panel.bundle.geometry, 'Whole original panel FaceBundle geometry changed');
    return model;
  }
  function parseTarget(source, settings, qualification = null, partial = false) {
    targetParseCalls++;
    const result = new BaroCADLoader(settings).parse(source);
    const resources = observeMassPrincipalResult(result);
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
  function readout(principal, proof, assetKey, caseKey) {
    const measure = principal.measure, report = principal.report;
    return { assetKey, caseKey, selection: principal.options.selection, selectedBodyId: measure.bodyId,
      units: report.units, densityKgPerM3: principal.mass.options.densityKgPerM3,
      massKG: measure.massKG, centroidMM: measure.centroidMM, storedTensorKgM2: measure.inertiaCentroidKgM2,
      exact: measure.exact, conversionErrors: measure.conversionErrors, positiveDefinite: measure.positiveDefinite,
      principalMomentsKgM2: principal.principal?.momentsKgM2 ?? null, axesXYZ: principal.principal?.axesXYZ ?? null,
      rotationTrace: report.rotationTrace, rotationCount: report.rotationCount, residuals: report.residuals,
      observedDegenerateClusters: report.observedDegenerateClusters, axesUnique: report.axesUnique, empty: report.empty,
      principalReport: report, massReport: principal.mass.report, booleanReport: proof.boolean.report,
      qualifications: proof.panelModels.map(panel => panel.qualification) };
  }
  function rememberUpdate(record) {
    updates.push({ assetKey: record.assetKey, state: record.state, caseKey: record.caseKey,
      principal: structuredClone(record.principal), readout: structuredClone(record.readout) });
  }
  function stage(asset, state, failAfterPrepared = null) {
    for (const panel of asset.boolean.panels) guardSource(asset, panel, asset.panelSourcesMap.get(panel.id));
    const proof = proveGeometry(asset);
    const caseKey = DEFAULT_CASES[asset.key], principal = provePrincipal(asset, caseKey);
    assertNative(principal.mass, proof.mass, 'Selected native readout must retain complete geometry mass proof');
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
    const candidate = { assetKey: asset.key, state, asset, proof, caseKey, principal, root, results, resources,
      readout: readout(principal, proof, asset.key, caseKey) };
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
          throw new LoaderMassPrincipalThreeHostError('STAGED_PREPARATION_REFUSAL',
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
    rememberUpdate(record);
    onChange(record);
    return record;
  }
  function snapshotAsset(asset) {
    return structuredClone({ boolean: asset.boolean, booleanRequest: asset.booleanRequest,
      panelSourcesMap: Array.from(asset.panelSourcesMap.entries()), operandSources: asset.operandSources,
      principalInputsMap: Array.from(asset.principalInputsMap.entries()), originalTexts: Array.from(asset.originalTexts.entries()) });
  }
  return {
    get accepted() { return accepted; },
    get records() { return records; },
    get updates() { return updates; },
    get allResources() { return allResources; },
    get events() { return events; },
    get counts() { return counts(); },
    get targetParseCalls() { return targetParseCalls; },
    get peakLivePairs() { return peakLivePairs; },
    load(asset, state = 'original') {
      active(); requireFact(state === 'original', 'Only original collection admission uses load');
      return commit(stage(asset, state));
    },
    select(caseKey) {
      active(); requireFact(accepted !== null, 'Load whole geometry before selecting a measure');
      const record = accepted, before = counts();
      const principal = provePrincipal(record.asset, caseKey);
      assertNative(principal.mass, record.proof.mass, 'Selection must preserve same complete mass/Boolean proof');
      const nextReadout = readout(principal, record.proof, record.assetKey, caseKey);
      requireFact(before.pairs === allResources.length && before.geometryDisposals === counts().geometryDisposals &&
        before.materialDisposals === counts().materialDisposals, 'Native selection created/disposed target geometry');
      record.caseKey = caseKey; record.principal = principal; record.readout = nextReadout;
      selectionUpdates++; rememberUpdate(record);
      events.push({ type: 'selection', assetKey: record.assetKey, caseKey });
      onChange(record);
      return record;
    },
    coldReopen(disjointAsset) {
      active(); requireFact(disjointAsset.key === 'disjoint', 'Frozen cold flow reopens whole disjoint geometry');
      return commit(stage(disjointAsset, 'cold-reopen'));
    },
    runRefusals(rectAsset, disjointAsset) {
      active(); requireFact(rectAsset.key === 'rect' && disjointAsset.key === 'disjoint' && accepted?.assetKey === 'rect' &&
        accepted.caseKey === DEFAULT_CASES.rect && accepted.state === 'original', 'Frozen refusals begin from complete rect total');
      const asset = rectAsset, record = accepted, assetBefore = snapshotAsset(rectAsset), disjointBefore = snapshotAsset(disjointAsset),
        proofBefore = structuredClone(record.proof), principalBefore = structuredClone(record.principal), readoutBefore = structuredClone(record.readout);
      const sceneChildren = [...scene.children], groupParents = record.results.map(result => result.group.parent);
      const rectInput = rectAsset.principalInputsMap.get(DEFAULT_CASES.rect), disjointInput = disjointAsset.principalInputsMap.get(DEFAULT_CASES.disjoint);
      const first = rectInput.request, disjoint = disjointInput.request;
      let getterCalls = 0;
      const massGetter = { maximumCells: 27 };
      Object.defineProperty(massGetter, 'densityKgPerM3', { enumerable: true, get() { getterCalls++; return 1000; } });
      const principalGetter = { ...first.options };
      Object.defineProperty(principalGetter, 'maximumRotations', { enumerable: true, get() { getterCalls++; return 0; } });
      const badBoolean = structuredClone(first.mass.boolean); badBoolean.report.panelCount++;
      const badMass = structuredClone(first.mass); badMass.total.massKG += 1;
      const badSelected = structuredClone(rectInput.owned); badSelected.measure.massKG += 1;
      const badAxis = structuredClone(rectInput.owned); badAxis.principal.axesXYZ[0].directionXYZ[0] = 1;
      const badUnique = structuredClone(rectInput.owned); badUnique.report.axesUnique = !badUnique.report.axesUnique;
      const firstSource = rectAsset.panelSourcesMap.get(rectAsset.boolean.panels[0].id);
      function probeTarget(text, settings) {
        const prepared = parseTarget(text, settings); prepared.result.dispose(); prepared.result.dispose(); return prepared.result;
      }
      const actions = [
        { name: 'density0', errorName: 'AxisBoxSolidMassError', code: 'INPUT', run: () => measureAxisBoxSolidBooleanMass(first.mass.boolean, { ...first.mass.options, densityKgPerM3: 0 }) },
        { name: 'maximumCells0', errorName: 'AxisBoxSolidMassError', code: 'BUDGET', run: () => measureAxisBoxSolidBooleanMass(first.mass.boolean, { ...first.mass.options, maximumCells: 0 }) },
        { name: 'massGetter', errorName: 'AxisBoxSolidMassError', code: 'INPUT', run: () => measureAxisBoxSolidBooleanMass(first.mass.boolean, massGetter) },
        { name: 'massBadBoolean', errorName: 'AxisBoxSolidMassError', code: 'BOOLEAN', causeCode: 'OWNED', causeName: 'AxisBoxSolidBooleanError', run: () => measureAxisBoxSolidBooleanMass(badBoolean, first.mass.options) },
        { name: 'directBadMass', errorName: 'AxisBoxSolidMassError', code: 'OWNED', run: () => validateAxisBoxSolidBooleanMass(badMass) },
        { name: 'unknownBody', errorName: 'AxisBoxSolidPrincipalInertiaError', code: 'SELECTION', run: () => analyzeAxisBoxSolidPrincipalInertia(disjoint.mass, { ...disjoint.options, selection: { kind: 'body', bodyId: 'missing_body' } }) },
        { name: 'nonconvergedRotations0', errorName: 'AxisBoxSolidPrincipalInertiaError', code: 'BUDGET', run: () => analyzeAxisBoxSolidPrincipalInertia(disjoint.mass, { ...disjoint.options, maximumRotations: 0 }) },
        { name: 'principalGetter', errorName: 'AxisBoxSolidPrincipalInertiaError', code: 'INPUT', run: () => analyzeAxisBoxSolidPrincipalInertia(first.mass, principalGetter) },
        { name: 'principalBadMass', errorName: 'AxisBoxSolidPrincipalInertiaError', code: 'MASS', causeCode: 'OWNED', causeName: 'AxisBoxSolidMassError', run: () => analyzeAxisBoxSolidPrincipalInertia(badMass, first.options) },
        { name: 'badSelectedMeasure', errorName: 'AxisBoxSolidPrincipalInertiaError', code: 'OWNED', run: () => validateAxisBoxSolidPrincipalInertia(badSelected) },
        { name: 'badStoredAxis', errorName: 'AxisBoxSolidPrincipalInertiaError', code: 'OWNED', run: () => validateAxisBoxSolidPrincipalInertia(badAxis) },
        { name: 'badObservedUniqueness', errorName: 'AxisBoxSolidPrincipalInertiaError', code: 'OWNED', run: () => validateAxisBoxSolidPrincipalInertia(badUnique) },
        { name: 'countU1', errorName: 'RangeError', code: null, run: () => probeTarget(firstSource.source, { ...createNativeOptions(), countU: 1 }) },
        { name: 'capacity15', errorName: 'RangeError', code: null, run: () => probeTarget(firstSource.source, { ...createNativeOptions(), nativeCapacity: { version: 1, maximumObjects: 15 } }) },
        { name: 'syntax', errorName: 'BaroCadSourceError', code: null, run: () => probeTarget('@model {', createNativeOptions()) },
        { name: 'panelSourceAssociationGuard', errorName: 'LoaderMassPrincipalThreeHostError', code: 'SOURCE_BINDING', host: true, run() {
          const other = asset.panelSourcesMap.get(asset.boolean.panels[1].id);
          requireFact(coldModel(other.source).objects.length === 5, 'Source association negative is genuinely compiler-valid');
          return guardSource(asset, asset.boolean.panels[0], { ...firstSource, source: other.source });
        } },
        { name: 'controlledStagedPreparationRefusal', errorName: 'LoaderMassPrincipalThreeHostError', code: 'STAGED_PREPARATION_REFUSAL', host: true, partial: true, run: () => stage(asset, 'controlled-partial', 2) },
      ];
      const refusals = [];
      for (const action of actions) {
        const before = counts(); let error;
        try { action.run(); } catch (cause) { error = cause; }
        requireFact(error instanceof Error && error.name === action.errorName && (error.code ?? null) === action.code, 'Actual frozen refusal differs: ' + action.name);
        requireFact((error.cause?.code ?? null) === (action.causeCode ?? null), 'Actual cause differs');
        if (action.causeName) requireFact(error.cause.name === action.causeName, 'Actual cause name differs');
        if (action.name === 'syntax') requireFact(error.diagnostics?.[0]?.code === 'SYNTAX', 'Actual compiler SYNTAX required');
        const after = counts(), extra = action.partial ? 2 : 0;
        requireFact(after.pairs === before.pairs + extra && after.geometryDisposals === before.geometryDisposals + extra &&
          after.materialDisposals === before.materialDisposals + extra, 'Refusal resource accounting differs');
        requireFact(accepted === record && record.root.parent === scene && records.length === 1 && updates.length === 1 &&
          scene.children.length === sceneChildren.length && sceneChildren.every((child, index) => scene.children[index] === child), 'Accepted complete Scene/readout identity changed');
        assertNative(record.proof, proofBefore, 'Accepted entire mass/geometry proof changed');
        assertNative(record.principal, principalBefore, 'Accepted entire selected principal proof changed');
        assertNative(record.readout, readoutBefore, 'Accepted native readout changed');
        assertNative(snapshotAsset(rectAsset), assetBefore, 'Original rect data changed');
        assertNative(snapshotAsset(disjointAsset), disjointBefore, 'Original disjoint data changed');
        for (const [index, row] of record.resources.entries()) {
          requireFact(row.object.parent === row.result.group && row.result.group.parent === groupParents[index] &&
            row.object.geometry === row.geometry && row.object.material === row.material && row.geometryDisposals === 0 && row.materialDisposals === 0, 'Accepted qualified resource identity changed');
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
      requireFact(refusals.length === 17 && getterCalls === 0, 'Frozen refusal/getter count differs');
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
