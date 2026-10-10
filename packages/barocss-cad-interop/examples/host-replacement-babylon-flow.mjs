import { BaroCADBabylonLoader } from '@barocss/cad-interop/babylon';
import { parseBaroCadSource } from '@barocss/cad-interop/native';

export const NATIVE_IDS = Object.freeze(['quarter_seed', 'quarter_copy_1', 'quarter_copy_2', 'quarter_copy_3', 'quarter_copy_4']);
export const ARTIFACTS = Object.freeze({
  A: Object.freeze({ key: 'A', file: 'five_quarter_x_copies.barocad', bytes: 819, sha256: 'f40feb68dab3f96e30922c82ab4e872d585154fad33f559bb561bdc223a5b8e2' }),
  B: Object.freeze({ key: 'B', file: 'spacing_edit_same_roles.barocad', bytes: 822, sha256: 'e7937871215c3ee5724fef1e8f9b5707d62151389fe22a167d418d0bcb1c2f0d' }),
  http404: Object.freeze({ key: 'http404' }),
});
export function createNativeOptions() {
  return { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: .001,
    nativeCapacity: { version: 1, maximumObjects: 16 },
    curveDisplay: { version: 1, chordToleranceMM: .1, maxSegments: 512, maxDepth: 16 } };
}
export function requireFact(condition, message) { if (!condition) throw new Error(message); }
export function assertNative(actual, expected, path = 'native') {
  if (Object.is(actual, expected)) return;
  requireFact(actual && expected && typeof actual === 'object' && typeof expected === 'object', 'Native bits differ: ' + path);
  requireFact(Array.isArray(actual) === Array.isArray(expected) && ArrayBuffer.isView(actual) === ArrayBuffer.isView(expected), 'Native array kind differs: ' + path);
  if (ArrayBuffer.isView(actual)) requireFact(actual.constructor === expected.constructor, 'Native buffer type differs: ' + path);
  const keys = Reflect.ownKeys(expected); requireFact(Reflect.ownKeys(actual).length === keys.length && keys.every(key => Object.hasOwn(actual, key)), 'Native fields differ: ' + path);
  for (const key of keys) assertNative(actual[key], expected[key], path + '.' + String(key));
}
export function assertBuffer(actual, expected, path = 'buffer') {
  requireFact(actual?.length === expected.length, 'Buffer length differs: ' + path);
  for (let i = 0; i < expected.length; i++) requireFact(Object.is(actual[i], expected[i]), 'Buffer bits differ: ' + path + '[' + i + ']');
}
function observeResult(result) {
  return result.meshes.map(mesh => {
    const geometry = mesh.geometry, material = mesh.material;
    const row = { mesh, object: mesh, geometry, material, geometryId: mesh.metadata.barocss.curveId,
      positionArray: mesh.getVerticesData('position'), indexArray: mesh.getIndices(),
      positions: Array.from(mesh.getVerticesData('position')), indices: Array.from(mesh.getIndices()),
      nativeParameters: mesh.metadata.barocss.nativeParameters, nativeParameterCopy: structuredClone(mesh.metadata.barocss.nativeParameters),
      nativeIntervals: mesh.metadata.barocss.nativeIntervals, nativeIntervalCopy: structuredClone(mesh.metadata.barocss.nativeIntervals),
      meshDisposals: 0, geometryDisposals: 0, materialDisposals: 0 };
    mesh.onDisposeObservable.add(() => row.meshDisposals++); material.onDisposeObservable.add(() => row.materialDisposals++);
    const dispose = geometry.dispose; geometry.dispose = function (...args) { row.geometryDisposals++; return dispose.apply(this, args); };
    return row;
  });
}
async function qualify(record) {
  const { result, artifact } = record, bytes = new TextEncoder().encode(result.source);
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
  requireFact(bytes.length === artifact.bytes && digest === artifact.sha256, 'Complete original source bytes/SHA differ');
  const native = parseBaroCadSource(result.source, createNativeOptions());
  assertNative(Object.fromEntries(Object.keys(native).map(key => [key, result[key]])), native);
  requireFact(native.model.name === 'quarter_pattern' && native.model.version === 0 && native.model.lengthUnit === 'mm' && native.model.objects.length === 5 && native.curves.length === 5 && native.surfaces.length === 0 && result.meshes.length === 5, 'Complete native five-Curve file required');
  assertNative(native.model.objects.map(object => object.id), NATIVE_IDS);
  for (const [index, row] of record.resources.entries()) {
    const curve = native.model.objects[index], preview = native.curves[index], metadata = row.mesh.metadata.barocss;
    requireFact(curve.kind === 'curve' && curve.degree === 2 && row.geometryId === NATIVE_IDS[index] && metadata.lengthUnit === 'mm' && metadata.coordinateSystem === 'right-handed-y-up', 'Original Curve identity/frame differs');
    assertNative(curve.knots, [-3, -3, -3, 7, 7, 7]);
    requireFact(Object.is(curve.controlPoints[0][1], -0) && curve.controlPoints.every(point => Object.is(point[2], -0)), 'Original signed-zero coefficients differ');
    assertNative(metadata.nativeParameters, preview.sample.parameters); assertNative(metadata.nativeIntervals, preview.sample.segments.map(segment => segment.domain)); assertNative(metadata.sampleReport, preview.sample.report);
    assertBuffer(row.positionArray, preview.positions);
    const indices = []; for (let i = 0; i < preview.sample.parameters.length - 1; i++) indices.push(i, i + 1); assertBuffer(row.indexArray, indices);
    requireFact(row.mesh.getTotalVertices() === 5 && row.positionArray.length === 15 && row.indexArray.length === 8 && row.mesh.isEnabled() === false && row.mesh.rotationQuaternion === null, 'Actual staged LinesMesh profile differs');
    assertNative(row.mesh.position.asArray(), [0, 0, 0]); assertNative(row.mesh.scaling.asArray(), [1, 1, 1]);
    for (let point = 0; point < preview.sample.pointsMM.length; point++) for (let axis = 0; axis < 3; axis++) requireFact(Object.is(row.positionArray[point * 3 + axis], Math.fround(preview.sample.pointsMM[point][axis] * .001)), 'One mm conversion differs');
  }
  record.source = result.source; record.model = result.model; record.native = native; record.sourceSha256 = digest;
  record.readout = structuredClone({ artifact: artifact.key, source: result.source, model: native.model, native });
}

/** Caller-owned request arbitration and draw boundary; no camera or renderer policy. */
export function createReplacementBabylonHost({ scene, baseURL, onChange }) {
  requireFact(typeof baseURL === 'string' && baseURL.length > 0, 'Caller base URL required');
  const records = [], resources = [], events = [], pending = new Set();
  let generation = 0, accepted = null, disposed = false, callbacks = 0, peakLivePairs = 0;
  const livePairs = () => resources.filter(row => row.geometryDisposals === 0 || row.materialDisposals === 0).length;
  function event(type, data = {}) { const item = { sequence: events.length + 1, type, ...data }; events.push(item); return item; }
  function disposeRecord(record) { record.result.dispose(); record.result.dispose(); requireFact(record.resources.every(row => row.meshDisposals === 1 && row.geometryDisposals === 1 && row.materialDisposals === 1), 'Actual owned triples must release once'); }
  function changed(type) { callbacks++; event(type, { generation, acceptedGeneration: accepted?.generation ?? null }); onChange?.({ type, accepted, events: [...events] }); }
  const host = {
    get accepted() { return accepted; }, get records() { return records; }, get resources() { return resources; }, get events() { return events; },
    get counts() { return { generation, pending: pending.size, completedResults: records.length, pairs: resources.length, livePairs: livePairs(), peakLivePairs, callbacks, disposed,
      meshDisposals: resources.reduce((sum, row) => sum + row.meshDisposals, 0), geometryDisposals: resources.reduce((sum, row) => sum + row.geometryDisposals, 0), materialDisposals: resources.reduce((sum, row) => sum + row.materialDisposals, 0) }; },
    start(artifact, { gate, abortOnProgress = false } = {}) {
      requireFact(!disposed, 'Replacement host disposed'); if (typeof artifact === 'string') artifact = ARTIFACTS[artifact];
      requireFact(Object.values(ARTIFACTS).includes(artifact), 'One original artifact required');
      const current = ++generation, controller = new AbortController(); let resolveProgress;
      const firstProgress = new Promise(resolve => { resolveProgress = resolve; });
      const token = { generation: current, controller, firstProgress, promise: undefined }; pending.add(token);
      const route = gate ? (artifact.key === 'A' ? 'held-A' : 'cancel-B') : artifact.key;
      const url = new URL('/__loader1300/source/' + route, baseURL); if (gate) url.searchParams.set('gate', gate);
      event('start', { generation: current, artifact: artifact.key, gate: gate ?? null });
      token.promise = (async () => {
        const progress = []; let record;
        try {
          const result = await new BaroCADBabylonLoader(scene, createNativeOptions()).loadAbortable(url.href, {
            signal: controller.signal, onProgress(value) { progress.push({ ...value }); resolveProgress(value); event('progress', { generation: current, loadedBytes: value.loadedBytes, declaredTotalBytes: value.declaredTotalBytes }); if (abortOnProgress) controller.abort(); },
          });
          // The first returned-result continuation disables every Scene-registered candidate.
          // No further await or caller draw occurs before this step.
          result.meshes.forEach(mesh => mesh.setEnabled(false));
          record = { generation: current, artifact, result, source: result.source, model: result.model, native: null, readout: null, progress, resources: observeResult(result) };
          records.push(record); resources.push(...record.resources); peakLivePairs = Math.max(peakLivePairs, livePairs());
          event('scene-staged-disabled', { generation: current, artifact: artifact.key, ownedMeshes: record.resources.length });
          await qualify(record); event('qualified', { generation: current, artifact: artifact.key });
          if (disposed || current !== generation) { disposeRecord(record); event('stale-disposed', { generation: current, artifact: artifact.key }); return { status: 'stale', record }; }
          const previous = accepted; result.meshes.forEach(mesh => mesh.setEnabled(true)); accepted = record; event('enabled', { generation: current, artifact: artifact.key });
          if (previous) { disposeRecord(previous); event('old-disposed', { generation: current, oldGeneration: previous.generation }); }
          changed('change'); return { status: 'accepted', record };
        } catch (error) {
          if (record && accepted === record) throw error;
          if (record) disposeRecord(record);
          const status = error?.name === 'AbortError' ? 'aborted' : 'failed';
          event(status, { generation: current, artifact: artifact.key, errorName: error?.name ?? null, errorCode: error?.code ?? null, loadedBytes: progress.at(-1)?.loadedBytes ?? 0 });
          return { status, ...(record ? { record } : {}), error };
        } finally { resolveProgress(null); pending.delete(token); }
      })(); return token;
    },
    async releaseGate(gate) {
      const response = await fetch(new URL('/__loader1300/release/' + encodeURIComponent(gate), baseURL), { method: 'POST' }); requireFact(response.ok, 'Actual held request release failed'); return response.json();
    },
    async serverLedger({ closedGate } = {}) {
      const url = new URL('/__loader1300/ledger', baseURL); if (closedGate !== undefined) url.searchParams.set('closedGate', closedGate);
      const response = await fetch(url, { cache: 'no-store' }); requireFact(response.ok, 'Actual server ledger unavailable'); return response.json();
    },
    dispose() { if (disposed) return; disposed = true; generation++; for (const token of pending) token.controller.abort(); if (accepted) disposeRecord(accepted); accepted = null; changed('disposed'); },
  };
  return host;
}
