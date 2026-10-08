import { createViewer } from '../../packages/barocss-viewer/dist/index.js';
import { loadBaroCadModelSet } from '../../packages/barocss-cad-interop/dist/model-set.js';
import { createFluidWorld } from '../../packages/barocss-physics/dist/fluid.js';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const hash = bytes => bytes.reduce((value, byte) => Math.imul(value ^ byte, 16777619) >>> 0, 2166136261);
const sha256 = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
  .map(byte => byte.toString(16).padStart(2, '0')).join('');
const metreHash = state => sha256(state.positionsM.buffer.slice(
  state.positionsM.byteOffset, state.positionsM.byteOffset + state.positionsM.byteLength));
const expectedSHA = new Map([
  [0, '9f3fec9d63e9be9f313857c9591bbe1deda5ffa471382184081e4c18cf8c618b'],
  [60, 'f14b5eaa5b34c074c8ecbe501be5b84af56eabbfdfbbcb823940aa999605e1bc'],
  [240, '6a951b6fe9baeee2d40a5cd2fd4752d7681f484ef07f167a8edc7dd03f8c068b'],
]);
const canvas = document.querySelector('#view'), status = document.querySelector('#status');
const contexts = new Set(), points = [], uploads = [], errors = [];
window.addEventListener('error', event => errors.push(event.message));
window.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
const originalGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
  const context = originalGetContext.call(this, kind, ...args);
  if (kind === 'webgl2' && context) contexts.add(context);
  return context;
};
const originalDrawArrays = WebGL2RenderingContext.prototype.drawArrays;
WebGL2RenderingContext.prototype.drawArrays = function (mode, first, count) {
  if (mode === this.POINTS) points.push(count);
  return originalDrawArrays.call(this, mode, first, count);
};
const originalBufferData = WebGL2RenderingContext.prototype.bufferData;
WebGL2RenderingContext.prototype.bufferData = function (target, data, ...args) {
  if (target === this.ARRAY_BUFFER && data instanceof Float32Array && data.length === 768) {
    uploads.push(hash(new Uint8Array(data.buffer, data.byteOffset, data.byteLength)));
  }
  return originalBufferData.call(this, target, data, ...args);
};
const cyanPixels = pixels => {
  let count = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] < 60 && pixels[i + 1] > 160 && pixels[i + 2] > 245) count++;
  }
  return count;
};

let viewer, world, worldDisposed = false;
try {
  const initialPositionsM = [];
  for (let z = 0; z < 4; z++) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    initialPositionsM.push([0.2 + x * 0.05, 0.45 + y * 0.05, 0.3 + z * 0.05]);
  }
  world = createFluidWorld({ format: 'barocss-fluid-scene', version: 1,
    revision: 'waterRev1', basis: 'right-handed-xyz-metres', fixedStepSeconds: 1 / 120,
    gravityMps2: [0, -9.81, 0], basinM: [0.7, 1.3, 0.5], initialPositionsM });
  const set = await loadBaroCadModelSet({ format: 'barocad-model-set', version: 0, entries: [
    { aliasId: 'fluid_surface', url: 'occluder.barocad',
      options: { sourceVersion: 0, countU: 5, countV: 5, unitsPerMillimeter: 1 } },
  ] }, { baseURL: location.href });
  viewer = createViewer(canvas, { mmToSceneUnit: 0.001, background: [0.035, 0.065, 0.105] });
  viewer.loadModelSet(set);
  const originalSource = set.entries[0].result.source;
  const camera = { eye: [0.35, 0.65, 2], target: [0.35, 0.5, 0], up: [0, 1, 0],
    fovYDegrees: 45, near: 0.01, far: 10 };
  viewer.setView(camera);
  const nativeOnly = hash(viewer.readPixels());
  const ref = { kind: 'surface', ...viewer.getState().surfaces[0] };
  assert(viewer.getState().surfaces.length === 1 && viewer.getState().curves.length === 0,
    'Qualified native Surface missing');
  const frame = (state, contextId = 'water_generation_1') => ({ version: 0, contextId,
    sceneRevision: state.sceneRevision, stepIndex: state.stepIndex,
    particleCount: state.particleCount, positionsM: state.positionsM });
  const receipts = [];
  const accept = async state => {
    assert(state.particleCount === 256 && state.positionsM.length === 768,
      'Actual Physics state is not 256 particles');
    if (expectedSHA.has(state.stepIndex)) assert(await metreHash(state) === expectedSHA.get(state.stepIndex),
      `Physics metre SHA changed at step ${state.stepIndex}`);
    const input = frame(state);
    viewer.setFluidFrame(input);
    const accepted = viewer.getState().fluidFrame;
    assert(accepted?.stepIndex === state.stepIndex && accepted.positionsM instanceof Float64Array
      && accepted.positionsM.length === 768, 'Viewer copied frame query missing');
    const expectedUpload = hash(new Uint8Array(Float32Array.from(state.positionsM,
      value => value * 1000 * 0.001).buffer));
    assert(points.at(-1) === 256 && uploads.at(-1) === expectedUpload,
      `Actual 256 POINTS or converted Float32 upload missing at step ${state.stepIndex}`);
    receipts.push({ stepIndex: state.stepIndex, rawMetreSHA256: await metreHash(state),
      uploadHash: expectedUpload, pixelHash: hash(viewer.readPixels()),
      density: state.diagnostics, submitted: points.at(-1) });
  };
  const initial = world.getState();
  await accept(initial);
  const initialPixels = hash(viewer.readPixels());
  const callerCopy = { ...frame(initial), positionsM: initial.positionsM.slice() };
  viewer.setFluidFrame(callerCopy);
  callerCopy.positionsM[0] = 999;
  assert(viewer.getState().fluidFrame.positionsM[0] !== 999,
    'Caller mutated the accepted Viewer frame');
  const query = viewer.getState().fluidFrame;
  query.positionsM[0] = 888;
  assert(viewer.getState().fluidFrame.positionsM[0] !== 888,
    'Viewer query returned mutable accepted positions');
  const retained = candidate => {
    const before = viewer.getState(), beforePixels = hash(viewer.readPixels());
    let refused = false;
    try { viewer.setFluidFrame(candidate); } catch { refused = true; }
    const after = viewer.getState();
    assert(refused && beforePixels === hash(viewer.readPixels())
      && before.fluidFrame.stepIndex === after.fluidFrame.stepIndex
      && before.fluidFrame.positionsM.every((value, index) => Object.is(value, after.fluidFrame.positionsM[index]))
      && JSON.stringify(before.camera) === JSON.stringify(after.camera),
    'Invalid fluid frame changed accepted state or pixels');
  };
  retained({ ...frame(initial), positionsM: new Float64Array(3) });
  const nan = frame(initial); nan.positionsM = nan.positionsM.slice(); nan.positionsM[1] = NaN;
  retained(nan);
  retained({ ...frame(initial), contextId: 'other_generation' });
  retained({ ...frame(initial), sceneRevision: 'wrongRevision' });
  const changed = frame(initial); changed.positionsM = changed.positionsM.slice(); changed.positionsM[0] += 0.01;
  retained(changed);
  let hiddenRefused = false;
  try { viewer.setVisibleGeometry([]); } catch { hiddenRefused = true; }
  assert(hiddenRefused && hash(viewer.readPixels()) === initialPixels,
    'Hiding the sole native Surface changed active fluid scene');
  let cameraRefused = false;
  try { viewer.setView({ ...camera, near: 0 }); } catch { cameraRefused = true; }
  assert(cameraRefused && hash(viewer.readPixels()) === initialPixels
    && viewer.getState().fluidFrame?.stepIndex === 0,
  'Invalid camera changed the accepted native and fluid frame');
  viewer.selectGeometry(ref);
  assert(viewer.getState().fluidFrame?.stepIndex === 0 && points.at(-1) === 256,
    'Selection dropped particles');
  viewer.selectGeometry(null);
  viewer.orbit(0.02, 0);
  assert(viewer.getState().fluidFrame?.stepIndex === 0 && points.at(-1) === 256,
    'Camera orbit dropped particles');
  viewer.setView(camera);
  const occluded = cyanPixels(viewer.readPixels());
  viewer.applyGeometryMotionFrame({ contextId: 'display_pose_1', timeSeconds: 0,
    poses: [{ targetId: 'surface', translation: [2000, 0, 0] }] },
  [{ contextId: 'display_pose_1', targetId: 'surface', ref }],
  { basis: 'part-xyz-matches-rhyup' });
  const exposed = cyanPixels(viewer.readPixels());
  assert(exposed > occluded && points.at(-1) === 256,
    `Shared-depth occlusion missing: ${occluded} vs ${exposed}`);
  viewer.resetMotion();
  assert(cyanPixels(viewer.readPixels()) === occluded,
    'Native Surface pose restoration changed shared depth');
  viewer.resize(480, 360);
  assert(viewer.getState().fluidFrame?.stepIndex === 0 && points.at(-1) === 256,
    'Resize dropped particles');
  viewer.resize(640, 480);
  const one = world.step(1 / 120);
  viewer.setFluidFrame(frame(one));
  assert(viewer.getState().fluidFrame.stepIndex === 1, 'One host step missing');
  const pausedStep = viewer.getState().fluidFrame.stepIndex;
  viewer.setView(camera);
  assert(viewer.getState().fluidFrame.stepIndex === pausedStep,
    'Paused host frame advanced without a Physics step');
  let state = one;
  for (let step = 2; step <= 240; step++) {
    state = world.step(1 / 120);
    if (step === 60 || step === 240) await accept(state);
  }
  assert(state.stepIndex === 240, 'Host did not reach step 240');
  retained(frame(one));
  viewer.setFluidFrame(null);
  assert(viewer.getState().fluidFrame === null && hash(viewer.readPixels()) === nativeOnly,
    'Layer-only clear did not restore exact native-only pixels');
  const reset = world.reset();
  viewer.setFluidFrame(frame(reset, 'water_generation_2'));
  assert(viewer.getState().fluidFrame?.stepIndex === 0, 'Explicit host reset missing');
  viewer.loadModelSet(set);
  assert(viewer.getState().fluidFrame === null && viewer.getState().modelSet !== null,
    'Successful scene replacement retained stale fluid layer');
  assert(viewer.getState().modelSet.entries[0].result.source === originalSource,
    'Fluid display changed the original native source');
  viewer.setFluidFrame(frame(reset, 'water_generation_3'));
  viewer.clear();
  assert(viewer.getState().status === 'empty' && viewer.getState().fluidFrame === null,
    'Viewer clear retained fluid frame');
  viewer.loadNative(originalSource, { sourceVersion: 0, countU: 5, countV: 5 });
  let legacyRefused = false;
  try { viewer.setFluidFrame(frame(reset, 'water_generation_2')); } catch { legacyRefused = true; }
  assert(legacyRefused && viewer.getState().fluidFrame === null,
    'Legacy unqualified scene accepted a fluid frame');
  viewer.clear();
  viewer.dispose(); world.dispose(); worldDisposed = true;
  assert(contexts.size === 1 && contexts.has(originalGetContext.call(canvas, 'webgl2')),
    'Viewer used more than one WebGL2 context');
  assert(errors.length === 0, `Browser errors: ${errors.join(', ')}`);
  const result = { ok: true, receipts, occlusion: { occludedCyanPixels: occluded,
    exposedCyanPixels: exposed, submittedCount: 256 }, canvasCount: 1,
    contextCount: contexts.size, pointDraws: points.length, uploads: uploads.length,
    nativeSourceBytes: originalSource.length, glError: [...contexts][0].getError(), errors,
    limits: 'Actual Physics 256 state, native display occlusion, local Chromium WebGL2 only. No CFD/collision/performance/publication certificate.' };
  assert(result.glError === 0, 'WebGL2 reported an error');
  window.viewerFluidProof = result;
  status.textContent = JSON.stringify(result, null, 2);
  const recorded = await fetch('/result', { method: 'POST', body: JSON.stringify(result) });
  assert(recorded.ok, 'Browser result was not recorded');
} catch (error) {
  viewer?.dispose();
  if (world && !worldDisposed) world.dispose();
  const result = { ok: false, error: error.stack || error.message, errors };
  window.viewerFluidProof = result;
  status.textContent = JSON.stringify(result, null, 2);
  try { await fetch('/result', { method: 'POST', body: JSON.stringify(result) }); } catch { /* server failed */ }
}
