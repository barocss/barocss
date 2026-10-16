import { createViewer } from '../../packages/barocss-viewer/dist/index.js';
import { loadBaroCadModelSet } from '../../packages/barocss-cad-interop/dist/model-set.js';

const canvas = document.querySelector('#view');
const output = document.querySelector('#status');
const viewer = await createViewer(canvas, { mmToSceneUnit: 0.001, background: [0.025, 0.045, 0.075] });
const hash = bytes => bytes.reduce((value, byte) => Math.imul(value ^ byte, 16777619) >>> 0, 2166136261);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const nativeOptions = { sourceVersion: 0, countU: 8, countV: 8,
  curveDisplay: { chordToleranceMM: 2, maxSegments: 256, maxDepth: 10 } };
const wideOptions = { ...nativeOptions, unitsPerMillimeter: 1,
  curveDisplay: { version: 1, chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16 } };

try {
  assert(viewer.getState().status === 'empty', 'Fresh Viewer must be empty');
  viewer.clear();
  const initial = viewer.getState();
  const blank = await viewer.readPixels();
  const blankHash = hash(blank);
  assert(initial.status === 'empty' && blank.length === 800 * 480 * 4, 'Explicit blank frame missing');
  const pixel = Array.from(blank.slice(0, 4));
  assert(blank.every((value, index) => value === pixel[index % 4]), 'Blank frame is not uniform');

  const nativeSource = await (await fetch('/mixed.barocad')).text();
  viewer.loadNative(nativeSource, nativeOptions);
  const nativeState = viewer.getState();
  const nativeHash = hash(await viewer.readPixels());
  assert(nativeState.status === 'ready' && nativeState.surfaces.length === 2
    && nativeState.curves.length === 2 && nativeHash !== blankHash, 'Native scene did not replace blank');
  const surface = nativeState.surfaces[0];
  const refs = [...nativeState.surfaces.map(ref => ({ kind: 'surface', ...ref })),
    ...nativeState.curves.map(ref => ({ kind: 'curve', ...ref }))];
  viewer.applyGeometryMotionFrame({ contextId: 'clear-flow', timeSeconds: 1,
    poses: refs.map((ref, index) => ({ targetId: `object-${index}`,
      translation: [ref.kind === 'curve' ? 80 : 0, 0, 0] })) },
  refs.map((ref, index) => ({ contextId: 'clear-flow', targetId: `object-${index}`, ref })),
  { basis: 'part-xyz-matches-rhyup' });
  viewer.selectGeometry(refs[2]);
  const measured = viewer.measureNativeSurfacePoints(
    { ...surface, u: 0, v: 0 }, { ...surface, u: 1, v: 1 });
  assert(measured.distanceMM > 0, 'Native measurement missing before clear');
  const cameraBeforeClear = viewer.getState().camera;
  const posedHash = hash(await viewer.readPixels());
  viewer.clear();
  const cleared = viewer.getState();
  const clearedHash = hash(await viewer.readPixels());
  assert(cleared.status === 'empty' && cleared.native === null && cleared.modelSet === null
    && cleared.surfaces.length === 0 && cleared.curves.length === 0 && cleared.packets.length === 0
    && cleared.selected === null && cleared.selectedGeometry === null && cleared.motion === null
    && cleared.geometryMotion === null && cleared.measurement === null
    && cleared.curveMeasurement === null && cleared.surfaceCurveMeasurement === null
    && cleared.nativeMeasurement === null && cleared.curveSampleVersion === null,
  'Clear kept accepted scene state');
  assert(JSON.stringify(cleared.camera) === JSON.stringify(cameraBeforeClear),
    'Clear changed accepted camera');
  assert(clearedHash === blankHash && posedHash !== clearedHash, 'Clear did not restore background pixels');

  viewer.select(null);
  viewer.selectGeometry(null);
  viewer.orbit(0.2, 0.1);
  viewer.resize(640, 400);
  assert((await viewer.readPixels()).length === 640 * 400 * 4
    && viewer.pick(20, 20) === null
    && viewer.pickGeometry({ xCss: 20, yCss: 20 }) === null,
  'Empty viewport controls failed');
  let fitRefused = false;
  try { viewer.fit(); } catch { fitRefused = true; }
  assert(fitRefused, 'Empty fit accepted');
  const beforeInvalid = viewer.getState();
  const pixelsBeforeInvalid = hash(await viewer.readPixels());
  let invalidRefused = false;
  try { viewer.loadNative('invalid', nativeOptions); } catch { invalidRefused = true; }
  assert(invalidRefused && JSON.stringify(viewer.getState()) === JSON.stringify(beforeInvalid)
    && hash(await viewer.readPixels()) === pixelsBeforeInvalid, 'Invalid load changed blank scene');

  const pending = viewer.loadNativeUrl('/slow.barocad', nativeOptions);
  viewer.clear();
  let supersededRefused = false;
  try { await pending; } catch (error) { supersededRefused = error.name === 'AbortError'; }
  assert(supersededRefused && viewer.getState().status === 'empty'
    && hash(await viewer.readPixels()) === pixelsBeforeInvalid, 'Older URL request restored cleared scene');

  const set = await loadBaroCadModelSet({ format: 'barocad-model-set', version: 0,
    entries: [{ aliasId: 'asset_a', url: 'model-a.barocad', options: wideOptions },
      { aliasId: 'asset-b', url: 'model-b.barocad', options: wideOptions }] },
  { baseURL: location.href });
  viewer.loadModelSet(set);
  const modelState = viewer.getState();
  assert(modelState.status === 'ready' && modelState.modelSet?.entries.length === 2
    && modelState.surfaces.length === 2 && modelState.curves.length === 2,
  'Qualified model set did not reload from blank viewport');
  const modelHash = hash(await viewer.readPixels());
  assert(modelHash !== pixelsBeforeInvalid, 'Model set did not change blank pixels');
  viewer.clear();
  const finalBlankHash = hash(await viewer.readPixels());
  assert(viewer.getState().status === 'empty' && viewer.getState().modelSet === null,
    'Model-set clear failed');
  viewer.dispose();
  assert(viewer.getState().status === 'disposed', 'Dispose state missing');
  let disposedRefused = false;
  try { viewer.clear(); } catch { disposedRefused = true; }
  assert(disposedRefused, 'Disposed Viewer accepted clear');
  window.viewerClearProof = { ok: true, initialBlankHash: blankHash, nativeHash, posedHash,
    clearedHash, emptyPixel: pixel, emptyResizePixels: 640 * 400 * 4, fitRefused,
    invalidRefused, pendingUrlSuperseded: true, modelHash, finalBlankHash,
    disposedRefused, sourceBytes: set.entries.map(entry => entry.result.source.length) };
  output.textContent = JSON.stringify(window.viewerClearProof, null, 2);
} catch (error) {
  window.viewerClearProof = { ok: false, error: error.stack || error.message };
  output.textContent = JSON.stringify(window.viewerClearProof, null, 2);
}
