import { createViewer } from '../../packages/barocss-viewer/dist/index.js';
import { loadBaroCadModelSet } from '../../packages/barocss-cad-interop/dist/model-set.js';
import { compileMeshMaterial } from '../../packages/barocss-gpu/dist/index.js';

const assert = (value, message) => { if (!value) throw new Error(message); };
const same = (first, second) => JSON.stringify(first) === JSON.stringify(second);
const hash = bytes => bytes.reduce((value, byte) => Math.imul(value ^ byte, 16777619) >>> 0, 2166136261);
const canvas = document.querySelector('#view'), status = document.querySelector('#status');
const contexts = new Set(), errors = [], resources = {};
window.addEventListener('error', event => errors.push(event.message));
window.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
const getContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
  const context = getContext.call(this, kind, ...args);
  if (kind === 'webgl2' && context) contexts.add(context);
  return context;
};
for (const type of ['Buffer', 'Program', 'VertexArray', 'Framebuffer', 'Texture', 'Renderbuffer', 'Shader']) {
  const live = new Set(), prototype = WebGL2RenderingContext.prototype;
  resources[type] = live;
  const create = prototype[`create${type}`], remove = prototype[`delete${type}`];
  prototype[`create${type}`] = function (...args) {
    const value = create.apply(this, args);
    if (value) live.add(value);
    return value;
  };
  prototype[`delete${type}`] = function (value) {
    live.delete(value);
    return remove.call(this, value);
  };
}
const wide = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 1,
  curveDisplay: { version: 1, chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16 } };
const manifest = slow => ({ format: 'barocad-model-set', version: 0, entries: [
  { aliasId: 'asset_a', url: `${slow ? 'slow/' : ''}model-a.barocad`, options: wide },
  { aliasId: 'asset-b', url: `${slow ? 'slow/' : ''}model-b.barocad`, options: wide },
] });
const poseAndFit = viewer => {
  const state = viewer.getState();
  const refs = [...state.curves.map(ref => ({ kind: 'curve', ...ref })),
    ...state.surfaces.map(ref => ({ kind: 'surface', ...ref }))];
  viewer.applyGeometryMotionFrame({ contextId: 'two-files', timeSeconds: 1,
    poses: refs.map((ref, index) => ({ targetId: `object-${index}`,
      translation: [ref.modelId === 'asset_a' ? -18 : 18, 0, 0] })) },
  refs.map((ref, index) => ({ contextId: 'two-files', targetId: `object-${index}`, ref })),
  { basis: 'part-xyz-matches-rhyup' });
  viewer.fit();
};
const abortCode = error => error?.name === 'AbortError' && error?.code === 'ABORT_ERR';
const retained = async (viewer, action, label) => {
  const state = viewer.getState(), pixels = hash(viewer.readPixels());
  let failed = false;
  try { await action(); } catch { failed = true; }
  assert(failed && same(viewer.getState(), state) && hash(viewer.readPixels()) === pixels,
    `${label} changed accepted state or pixels`);
};
let viewer;
try {
  const baseURL = location.href;
  const options = { baseURL };
  const synchronous = await loadBaroCadModelSet(manifest(false), options);
  viewer = createViewer(canvas, { mmToSceneUnit: 0.05, background: [0.015, 0.02, 0.03] });
  viewer.loadModelSet(synchronous);
  poseAndFit(viewer);
  const syncState = viewer.getState(), syncHash = hash(viewer.readPixels());
  const progress = [];
  await viewer.loadModelSetUrls(manifest(false), { baseURL,
    onProgress(event) { progress.push({ ...event }); } });
  poseAndFit(viewer);
  const state = viewer.getState(), pixelsHash = hash(viewer.readPixels());
  assert(same(state, syncState) && pixelsHash === syncHash,
    'URL admission differs from synchronous Loader admission');
  assert(progress.length >= 2 && progress.some(event => event.aliasId === 'asset_a')
    && progress.some(event => event.aliasId === 'asset-b')
    && progress.every((event, index) => index === 0 ||
      event.aggregateLoadedBytes >= progress[index - 1].aggregateLoadedBytes)
    && progress.at(-1).aggregateLoadedBytes === state.modelSet.totalLoadedBytes,
    'Loader alias-aware byte progress was not forwarded');
  assert(state.surfaces.length === 2 && state.curves.length === 2
    && state.surfaces[0].surfaceId === state.surfaces[1].surfaceId
    && state.curves[0].curveId === state.curves[1].curveId
    && state.modelSet.entries[0].url === new URL('model-a.barocad', baseURL).href,
    'Qualified original IDs or URL provenance changed');
  const hits = new Map();
  for (let y = 6; y < canvas.height && hits.size < 4; y += 5) {
    for (let x = 6; x < canvas.width && hits.size < 4; x += 5) {
      const hit = viewer.pickGeometry({ xCss: x, yCss: y }, { curveTolerancePx: 4 });
      if (hit) hits.set(`${hit.kind}:${hit.ref.modelId}`, hit);
    }
  }
  assert(hits.size === 4, `Expected four qualified screen hits, got ${[...hits.keys()].join(', ')}`);
  const curve = state.curves[0];
  const distance = viewer.measureNativeCurvePoints(
    { ...curve, t: 0 }, { ...curve, t: 1 });
  assert(distance.distanceMM > 0 && distance.space === 'native-authored',
    'Native same-alias distance failed');
  let crossRefused = false;
  try { viewer.measureNativeCurvePoints({ ...curve, t: 0 },
    { ...state.curves[1], t: 1 }); } catch { crossRefused = true; }
  assert(crossRefused, 'Cross-alias native distance was accepted');

  const material = compileMeshMaterial('@shader #url { @fragment { color: #30C0A0; } }');
  assert(material.ok, 'Host Surface material compilation failed');
  viewer.setSurfaceMaterial(state.surfaces[0], { material: material.material, uniforms: {} });
  assert(viewer.getState().surfaceMaterials.length === 1, 'Accepted material missing before URL refusals');
  await retained(viewer, () => viewer.loadModelSetUrls(manifest(false), { baseURL,
    onProgress: () => false }), 'Progress cancellation');
  const controller = new AbortController();
  const aborted = viewer.loadModelSetUrls(manifest(true), { baseURL, signal: controller.signal });
  controller.abort();
  await retained(viewer, () => aborted, 'Caller abort');
  await retained(viewer, () => viewer.loadModelSetUrls({ ...manifest(false), entries: [
    manifest(false).entries[0], { ...manifest(false).entries[1], url: 'missing.barocad' }] }, options),
  'HTTP 404 after first model');
  await retained(viewer, () => viewer.loadModelSetUrls({ ...manifest(false), entries: [
    manifest(false).entries[0], { ...manifest(false).entries[1], aliasId: 'asset_a' }] }, options),
  'Invalid duplicate alias');
  await retained(viewer, () => viewer.loadModelSetUrls({ ...manifest(false), entries: [
    ...manifest(false).entries,
    { ...manifest(false).entries[0], aliasId: 'asset_c' }] }, options),
  'Loader-valid set beyond Viewer object limit');

  const slow = viewer.loadModelSetUrls(manifest(true), options).then(() => null, error => error);
  await viewer.loadModelSetUrls(manifest(false), options);
  const fastState = viewer.getState(), fastHash = hash(viewer.readPixels());
  const stale = await slow;
  assert(abortCode(stale) && same(viewer.getState(), fastState)
    && hash(viewer.readPixels()) === fastHash, 'Slow model-set result replaced the newer scene');
  const pendingNative = viewer.loadModelSetUrls(manifest(true), options).then(() => null, error => error);
  await viewer.loadNativeUrl(new URL('model-a.barocad', baseURL).href,
    { sourceVersion: 0, countU: 8, countV: 8 });
  const nativeState = viewer.getState(), nativeHash = hash(viewer.readPixels());
  assert(abortCode(await pendingNative) && same(viewer.getState(), nativeState)
    && hash(viewer.readPixels()) === nativeHash && nativeState.modelSet === null,
    'Pending model set replaced a newer native URL scene');
  await viewer.loadModelSetUrls(manifest(false), options);
  const pendingClear = viewer.loadModelSetUrls(manifest(true), options).then(() => null, error => error);
  viewer.clear();
  const clearHash = hash(viewer.readPixels());
  assert(abortCode(await pendingClear) && viewer.getState().status === 'empty'
    && hash(viewer.readPixels()) === clearHash, 'Pending model set replaced clear');
  await viewer.loadModelSetUrls(manifest(false), options);
  assert(viewer.getState().surfaceMaterials.length === 0 && viewer.getState().modelSet?.entries.length === 2,
    'Successful replacement retained old material state');
  const pendingDispose = viewer.loadModelSetUrls(manifest(true), options).then(() => null, error => error);
  viewer.dispose(); viewer.dispose();
  const disposed = await pendingDispose;
  assert(disposed instanceof Error, 'Disposed Viewer accepted a pending URL result');
  const remaining = Object.fromEntries(Object.entries(resources).map(([type, live]) => [type, live.size]));
  assert(Object.values(remaining).every(count => count === 0),
    `Owned GPU resources remain after disposal: ${JSON.stringify(remaining)}`);
  assert(contexts.size === 1 && contexts.has(getContext.call(canvas, 'webgl2')),
    'Viewer used more than one WebGL2 context');
  assert(errors.length === 0, `Browser errors: ${errors.join(', ')}`);
  const result = { ok: true, originalIDs: { surface: state.surfaces[0].surfaceId,
    curve: state.curves[0].curveId }, aliases: state.surfaces.map(ref => ref.modelId),
    sourceURLs: state.modelSet.entries.map(entry => entry.url),
    totalLoadedBytes: state.modelSet.totalLoadedBytes, progressEvents: progress.length,
    hits: [...hits.keys()], syncHash, urlHash: pixelsHash, distanceMM: distance.distanceMM,
    staleAbort: abortCode(stale), nativeAbort: true, clearAbort: true,
    contextCount: contexts.size, remaining, glError: [...contexts][0].getError(), errors,
    limits: 'Two source0 HTTP files, four qualified objects, Loader 262144-byte per-source and 1048576-byte aggregate limits; local Chromium WebGL2 only.' };
  assert(result.glError === 0, 'WebGL2 reported an error');
  window.viewerModelSetUrlProof = result;
  status.textContent = JSON.stringify(result, null, 2);
  const recorded = await fetch('/result', { method: 'POST', body: JSON.stringify(result) });
  assert(recorded.ok, 'Browser result was not recorded');
} catch (error) {
  viewer?.dispose();
  const result = { ok: false, error: error.stack || error.message, errors };
  window.viewerModelSetUrlProof = result;
  status.textContent = JSON.stringify(result, null, 2);
  try { await fetch('/result', { method: 'POST', body: JSON.stringify(result) }); } catch { /* server failed */ }
}
