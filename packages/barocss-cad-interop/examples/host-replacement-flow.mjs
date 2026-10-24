import { Scene } from 'three';
import { BaroCADLoader } from '@barocss/cad-interop/three';
import { parseBaroCadSource } from '@barocss/cad-interop/native';

export const NATIVE_IDS = Object.freeze(['quarter_seed', 'quarter_copy_1', 'quarter_copy_2', 'quarter_copy_3', 'quarter_copy_4']);
export const ARTIFACTS = Object.freeze({
  A: Object.freeze({ key: 'A', bytes: 819, sha256: 'f40feb68dab3f96e30922c82ab4e872d585154fad33f559bb561bdc223a5b8e2' }),
  B: Object.freeze({ key: 'B', bytes: 822, sha256: 'e7937871215c3ee5724fef1e8f9b5707d62151389fe22a167d418d0bcb1c2f0d' }),
  invalid: Object.freeze({ key: 'invalid' }), http503: Object.freeze({ key: 'http503' }),
});
export function createNativeOptions() {
  return { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
    nativeCapacity: { version: 1, maximumObjects: 16 },
    curveDisplay: { version: 1, chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16 } };
}
function check(condition, detail) { if (!condition) throw new Error(detail); }
function same(left, right) {
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return Object.is(left, right);
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && same(left[key], right[key]));
}
async function validateDisplay(record) {
  const { result, artifact } = record;
  const bytes = new TextEncoder().encode(result.source);
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
  check(bytes.length === artifact.bytes && digest === artifact.sha256, 'Full native source bytes/hash differ');
  const neutral = parseBaroCadSource(result.source, createNativeOptions());
  check(same(result.model, neutral.model), 'Native Model differs from the actual public compiler result');
  check(result.model.name === 'quarter_pattern' && result.model.version === 0 && result.model.lengthUnit === 'mm', 'Native Model identity/units differ');
  check(result.model.objects.length === 5 && result.model.objects.every((object, index) => object.id === NATIVE_IDS[index] && object.kind === 'curve'), 'Full native five-Curve order differs');
  check(result.group.parent === null && result.group.children.length === 5 && result.curves.length === 5 && result.surfaces.length === 0, 'Expected a detached full native display');
  check(result.model.objects.every(object => Object.is(object.controlPoints[0][1], -0) && object.controlPoints.every(point => Object.is(point[2], -0))), 'Original native signed zeros differ');
  for (const [index, resource] of record.resources.entries()) {
    const preview = neutral.curves[index];
    const binding = resource.object.userData.barocss;
    check(resource.geometryId === NATIVE_IDS[index] && binding.curveId === NATIVE_IDS[index] && binding.coordinateSystem === 'right-handed-z-up' && binding.lengthUnit === 'mm', 'Native target identity/frame differs');
    check(same(result.curves[index].sample, preview.sample) && same(binding.nativeParameters, preview.sample.parameters), 'Native sample parameters differ');
    check(same(binding.nativeIntervals, preview.sample.segments.map(segment => segment.domain)), 'Native intervals differ');
    const position = resource.geometry.getAttribute('position').array;
    check(same(position, preview.positions), 'Actual Three positions differ from neutral buffers');
    check(resource.geometry.getAttribute('normal') === undefined && resource.geometry.getAttribute('_CAD_UV') === undefined, 'Curve target unexpectedly has Surface attributes');
    for (const [point, coordinates] of preview.sample.pointsMM.entries()) {
      for (let axis = 0; axis < 3; axis++) check(Object.is(position[point * 3 + axis], Math.fround(coordinates[axis] * 0.001)), 'Target millimetre conversion differs');
    }
  }
  record.source = result.source;
  record.model = result.model;
  record.sourceSha256 = digest;
}
/** Example host arbitration only; all transport/native/target work uses public APIs. */
export function createReplacementHost({ scene, baseURL, onChange }) {
  if (!(scene instanceof Scene)) throw new TypeError('Supply a caller-owned Three Scene');
  const records = [], events = [], pending = new Set();
  let generation = 0, accepted = null, disposed = false;
  const event = (type, data = {}) => { const value = { sequence: events.length + 1, type, ...data }; events.push(value); return value; };
  const disposeRecord = record => { record.result.dispose(); record.result.dispose(); };
  const changed = type => { event(type, { generation, acceptedGeneration: accepted?.generation ?? null }); onChange?.({ type, accepted, events: [...events] }); };
  return {
    get accepted() { return accepted; }, get records() { return records; }, get events() { return events; },
    start(artifact, { gate, abortOnProgress = false } = {}) {
      if (disposed) throw new Error('Replacement host is disposed');
      if (typeof artifact === 'string') artifact = ARTIFACTS[artifact];
      if (!artifact || !Object.values(ARTIFACTS).includes(artifact)) throw new TypeError('Select one frozen artifact');
      const current = ++generation;
      const controller = new AbortController();
      let first;
      const firstProgress = new Promise(resolve => { first = resolve; });
      const token = { generation: current, controller, firstProgress, promise: undefined };
      pending.add(token);
      const url = new URL(`/__loader991/source/${artifact.key}`, baseURL);
      if (gate) url.searchParams.set('gate', gate);
      event('start', { generation: current, artifact: artifact.key, gate: gate ?? null });
      token.promise = (async () => {
        const progress = [];
        let record;
        try {
          // Options are fresh and remain unchanged. Renderer validation still occurs after fetch.
          const result = await new BaroCADLoader(createNativeOptions()).loadAbortable(url.href, {
            signal: controller.signal, onProgress(value) {
              progress.push(value); first(value);
              event('progress', { generation: current, loadedBytes: value.loadedBytes, declaredTotalBytes: value.declaredTotalBytes });
              if (abortOnProgress) controller.abort();
            },
          });
          record = { generation: current, artifact, result, source: result.source, model: result.model, progress,
            resources: result.group.children.map(object => {
              const item = { object, geometry: object.geometry, material: object.material, geometryId: object.name,
                geometryDisposals: 0, materialDisposals: 0 };
              item.geometry.addEventListener('dispose', () => item.geometryDisposals++);
              item.material.addEventListener('dispose', () => item.materialDisposals++);
              return item;
            }) };
          records.push(record);
          await validateDisplay(record);
          event('detached-ready', { generation: current, artifact: artifact.key });
          if (disposed || current !== generation) {
            disposeRecord(record);
            event('stale-disposed', { generation: current, artifact: artifact.key });
            return { status: 'stale', record };
          }
          const previous = accepted;
          scene.add(result.group);
          accepted = record;
          event('mounted', { generation: current, artifact: artifact.key });
          if (previous) {
            disposeRecord(previous);
            event('old-disposed', { generation: current, oldGeneration: previous.generation });
          }
          changed('change');
          return { status: 'accepted', record };
        } catch (error) {
          // A caller render/callback error after adoption is not a transport or
          // native failure. Keep the mounted winner owned and propagate it.
          if (record && accepted === record) throw error;
          if (record) disposeRecord(record);
          const status = error?.name === 'AbortError' ? 'aborted' : 'failed';
          event(status, { generation: current, artifact: artifact.key, errorName: error?.name,
            errorCode: error?.code ?? null, loadedBytes: progress.at(-1)?.loadedBytes ?? 0 });
          return { status, ...(record ? { record } : {}), error };
        } finally { first(null); pending.delete(token); }
      })();
      return token;
    },
    dispose() {
      if (disposed) return;
      disposed = true; generation++;
      for (const token of pending) token.controller.abort();
      if (accepted) disposeRecord(accepted);
      accepted = null;
      changed('disposed');
    },
  };
}
