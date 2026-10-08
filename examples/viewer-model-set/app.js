import { createViewer } from '../../packages/barocss-viewer/dist/index.js';
import { loadBaroCadModelSet } from '../../packages/barocss-cad-interop/dist/model-set.js';

const canvas = document.querySelector('#view');
const output = document.querySelector('#status');
const viewer = createViewer(canvas, { mmToSceneUnit: 0.05, background: [0.015, 0.02, 0.03] });
const hash = bytes => bytes.reduce((value, byte) => Math.imul(value ^ byte, 16777619) >>> 0, 2166136261);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const wide = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 1,
  curveDisplay: { version: 1, chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16 } };

try {
  const set = await loadBaroCadModelSet({ format: 'barocad-model-set', version: 0, entries: [
    { aliasId: 'asset_a', url: 'model-a.barocad', options: wide },
    { aliasId: 'asset-b', url: 'model-b.barocad', options: wide },
  ] }, { baseURL: location.href });
  viewer.loadModelSet(set);
  const initial = viewer.getState();
  assert(initial.modelSet?.entries.length === 2 && initial.native === null, 'Model-set state missing');
  assert(initial.surfaces.length === 2 && initial.curves.length === 2 && initial.curveSampleVersion === 1,
    'Four original-ID objects missing');
  assert(initial.surfaces[0].surfaceId === initial.surfaces[1].surfaceId
    && initial.curves[0].curveId === initial.curves[1].curveId, 'Native duplicate IDs changed');
  assert(initial.surfaces[0].modelId === 'asset_a' && initial.surfaces[1].modelId === 'asset.b',
    'Qualified aliases changed');
  assert(initial.modelSet.entries[1].aliasId === 'asset-b'
    && initial.modelSet.entries[0].result.model.name === 'wide_model', 'Native provenance changed');
  const refs = [...initial.curves.map(ref => ({ kind: 'curve', ...ref })),
    ...initial.surfaces.map(ref => ({ kind: 'surface', ...ref }))];
  viewer.applyGeometryMotionFrame({ contextId: 'two-files', timeSeconds: 1,
    poses: refs.map((ref, index) => ({ targetId: `object-${index}`,
      translation: [ref.modelId === 'asset_a' ? -18 : 18, 0, 0] })) },
  refs.map((ref, index) => ({ contextId: 'two-files', targetId: `object-${index}`, ref })),
  { basis: 'part-xyz-matches-rhyup' });
  viewer.fit();
  const posed = hash(viewer.readPixels());
  const hits = new Map();
  for (let y = 6; y < canvas.height && hits.size < 4; y += 5) {
    for (let x = 6; x < canvas.width && hits.size < 4; x += 5) {
      const hit = viewer.pickGeometry({ xCss: x, yCss: y }, { curveTolerancePx: 4 });
      if (hit) hits.set(`${hit.kind}:${hit.ref.modelId}`, hit);
    }
  }
  assert(hits.size === 4, `Expected four qualified screen hits, got ${[...hits.keys()].join(', ')}`);
  const curveHit = hits.get('curve:asset.b');
  viewer.selectGeometry({ kind: 'curve', ...curveHit.ref });
  assert(viewer.getState().selectedGeometry?.modelId === 'asset.b', 'Qualified Curve selection failed');
  const selected = hash(viewer.readPixels());
  assert(selected !== posed, 'Qualified Curve highlight did not change pixels');
  viewer.fitGeometry({ kind: 'surface', ...hits.get('surface:asset_a').ref });
  const singleCamera = viewer.getState().camera;
  viewer.fit();
  assert(JSON.stringify(singleCamera) !== JSON.stringify(viewer.getState().camera), 'One-object fit did not change camera');
  const same = viewer.measureNativeCurvePoints(
    { modelId: 'asset.b', curveId: 'wide_64', t: 0 },
    { modelId: 'asset.b', curveId: 'wide_64', t: 1 });
  assert(same.distanceMM > 0 && same.space === 'native-authored', 'Same-alias native measurement failed');
  let crossRefused = false;
  try {
    viewer.measureNativeCurvePoints(
      { modelId: 'asset_a', curveId: 'wide_64', t: 0 },
      { modelId: 'asset.b', curveId: 'wide_64', t: 1 });
  } catch { crossRefused = true; }
  assert(crossRefused, 'Cross-alias native measurement accepted');
  const beforeRefusal = viewer.getState(), beforePixels = hash(viewer.readPixels());
  let invalidRefused = false;
  try {
    viewer.loadModelSet({ ...set, entries: [set.entries[0],
      { ...set.entries[1], aliasId: 'asset_a' }] });
  } catch { invalidRefused = true; }
  assert(invalidRefused && hash(viewer.readPixels()) === beforePixels
    && JSON.stringify(viewer.getState()) === JSON.stringify(beforeRefusal), 'Invalid candidate changed accepted scene');
  viewer.resetMotion();
  const reset = hash(viewer.readPixels());
  viewer.loadNative(set.entries[0].result.source, { sourceVersion: 0, countU: 8, countV: 8,
    curveDisplay: wide.curveDisplay });
  assert(viewer.getState().native?.model.name === 'wide_model'
    && viewer.getState().modelSet === null, 'Legacy single-source load changed');
  viewer.loadModelSet(set);
  const restored = viewer.getState();
  assert(restored.modelSet?.entries.length === 2 && restored.selectedGeometry === null
    && restored.nativeMeasurement === null, 'Model-set replacement did not reset state');
  viewer.applyGeometryMotionFrame({ contextId: 'two-files', timeSeconds: 1,
    poses: refs.map((ref, index) => ({ targetId: `object-${index}`,
      translation: [ref.modelId === 'asset_a' ? -18 : 18, 0, 0] })) },
  refs.map((ref, index) => ({ contextId: 'two-files', targetId: `object-${index}`, ref })),
  { basis: 'part-xyz-matches-rhyup' });
  viewer.fit();
  window.viewerModelSetProof = { ok: true, sourceBytes: set.entries.map(entry => entry.result.source.length),
    originalIds: restored.curves.map(ref => ref.curveId).concat(restored.surfaces.map(ref => ref.surfaceId)),
    aliases: restored.surfaces.map(ref => ref.modelId), hitKinds: [...hits.keys()],
    posed, selected, reset, sameAliasDistanceMM: same.distanceMM,
    crossRefused, invalidRefused, retainedHash: beforePixels, modelSetRestored: true };
  output.textContent = JSON.stringify(window.viewerModelSetProof, null, 2);
} catch (error) {
  window.viewerModelSetProof = { ok: false, error: error.stack || error.message };
  output.textContent = JSON.stringify(window.viewerModelSetProof, null, 2);
}
