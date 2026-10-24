import { createViewer } from '@barocss/viewer';
import { loadBaroCadModelSet } from '@barocss/cad-interop/model-set';
import { createClothWorld } from '@barocss/physics/cloth';
import { createFluidWorld } from '@barocss/physics/fluid';
import { compileMeshMaterial } from '@barocss/gpu';

const check = (condition, message) => { if (!condition) throw new Error(message); };
const hash = bytes => bytes.reduce((value, byte) => Math.imul(value ^ byte, 16777619) >>> 0, 2166136261);
const same = (a, b) => Object.is(a, b) || !!a && !!b && typeof a === 'object' && typeof b === 'object'
  && Object.keys(a).length === Object.keys(b).length
  && Object.keys(a).every(key => Object.hasOwn(b, key) && same(a[key], b[key]));
const clone = value => structuredClone(value);
const sha256 = async view => [...new Uint8Array(await crypto.subtle.digest('SHA-256',
  view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength)))]
  .map(byte => byte.toString(16).padStart(2, '0')).join('');
const canvas = document.querySelector('#view'), status = document.querySelector('#status');
const buttons = Object.fromEntries(['run-proof', 'front', 'back', 'clear-cloth', 'dispose']
  .map(id => [id, document.querySelector('#' + id)]));
const errors = [], warnings = [];
window.addEventListener('error', event => errors.push(event.message));
window.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
const warn = console.warn;
console.warn = (...args) => { warnings.push(args.map(String).join(' ')); warn.apply(console, args); };

const mmToSceneUnit = 0.0013, fixedStep = 1 / 120;
const front = { eye: [0, 2.6, 0], target: [0, 0.39, 0], up: [0, 0, -1],
  fovY: 45, near: 0.01, far: 10 };
const back = { eye: [0, -2.6, 0], target: [0, 0.39, 0], up: [0, 0, 1],
  fovY: 45, near: 0.01, far: 10 };
const frameFromState = state => ({ version: 0, layerId: 'viewer_cloth_sheet', contextId: 'cloth_world_980',
  sceneRevision: state.sceneRevision, stepIndex: state.stepIndex,
  vertexCount: state.vertexCount, triangleCount: state.triangleCount,
  positionsM: state.positionsM.slice(), triangles: state.triangles.slice() });
const world = createClothWorld({ format: 'barocss-cloth-scene', version: 1, revision: 'clothRev980',
  basis: 'right-handed-xyz-metres', fixedStepSeconds: fixedStep, profile: 'pinned-sheet-sphere-v1' });
const states = [world.getState()], frames = [frameFromState(states[0])];
// One bounded public producer run; no RAF loop, numerical acceptance replay or playback controller.
for (let step = 1; step <= 240; step++) {
  const state = world.step(fixedStep); frames.push(frameFromState(state));
  if (step === 60 || step === 240) states.push(state);
}
let viewer = null, nativeSet = null, ref = null, disposed = false, running = false, result = null;
let fluidWorld = null;
const centre = pixels => { const offset = (Math.floor(canvas.height / 2) * canvas.width
  + Math.floor(canvas.width / 2)) * 4; return Array.from(pixels.slice(offset, offset + 4)); };
const pixelInfo = async () => { const pixels = await viewer.readPixels(); return { hash: hash(pixels), centre: centre(pixels) }; };
const nativeSnapshot = () => {
  const state = viewer.getState();
  return { modelSet: state.modelSet, packets: state.packets, surfaces: state.surfaces,
    curves: state.curves, sourceUnit: state.sourceUnit };
};
const controls = () => {
  const ready = viewer?.getState().status === 'ready' && !disposed;
  for (const [id, button] of Object.entries(buttons)) button.disabled = id === 'dispose'
    ? disposed || !viewer : !ready || running;
};
const display = message => { status.textContent = typeof message === 'string' ? message : JSON.stringify(message, null, 2); };
function pose(translation = [0, 0, 0]) {
  viewer.applyGeometryMotionFrame({ contextId: 'cloth_native_pose', timeSeconds: 0,
    poses: [{ targetId: 'panel', translation }] },
  [{ contextId: 'cloth_native_pose', targetId: 'panel', ref }], { basis: 'part-xyz-matches-rhyup' });
}
async function loadNative() {
  if (!nativeSet) nativeSet = await loadBaroCadModelSet({ format: 'barocad-model-set', version: 0,
    entries: [{ aliasId: 'cloth_original', url: '/original-panel.barocad',
      options: { sourceVersion: 0, countU: 3, countV: 3, unitsPerMillimeter: 1 } }] },
  { baseURL: location.href });
  viewer.loadModelSet(nativeSet); ref = { kind: 'surface', ...viewer.getState().surfaces[0] };
  viewer.setView(front); return clone(nativeSet);
}
async function retained(label, action) {
  const before = viewer.getState(), pixels = await pixelInfo();
  let error = null;
  try { action(); } catch (value) { error = value; }
  check(error instanceof Error, label + ' did not refuse');
  check(same(before, viewer.getState()) && same(pixels, await pixelInfo()),
    label + ' changed accepted metadata or pixels');
  result.refusals.push({ label, errorName: error.name, errorCode: error.code ?? null, message: error.message });
}
async function capture(label) {
  const row = { label, ...await pixelInfo(), stepIndex: viewer.getState().clothFrame?.stepIndex ?? null };
  result.cases.push(row); return row;
}
function accept(frame) {
  viewer.setClothFrame(frame);
  check(same(frame, viewer.getState().clothFrame), 'Copied original metre frame differs');
  return { stepIndex: frame.stepIndex, vertexCount: frame.vertexCount, triangleCount: frame.triangleCount,
    scenePositionsSample: Array.from(frame.positionsM.slice(0, 3), value => value * 1000 * mmToSceneUnit) };
}
async function runProof() {
  if (running || disposed || viewer.getState().status !== 'ready') throw new Error('Proof needs a live ready Viewer.');
  running = true; controls();
  result = { ok: false, schema: 'barocss-viewer-cloth-980', cases: [], refusals: [], failures: [],
    producer: 'genuine public createClothWorld pinned-sheet-sphere-v1, one0..240 run',
    conversion: { mmToSceneUnit, operation: 'positionsM * 1000 * mmToSceneUnit' },
    scope: 'bounded Viewer bridge consumption; native-only picking/fits; no playback, collision certification or publication' };
  window.viewerClothProof = result;
  try {
    await loadNative();
    const source = nativeSnapshot();
    check(source.surfaces.length === 1 && source.curves.length === 0 && source.modelSet,
      'Exactly one qualified original Surface required');
    const originalSurface = nativeSet.entries[0].result.model.objects[0];
    check(Object.is(originalSurface.knotsU[0], -0), 'Original authored native signed zero lost');
    const nativeFront = await capture('native-only-front');
    result.accepted0 = accept(frames[0]); const combinedFront = await capture('combined-front');
    const coveredHit = viewer.pickGeometry({ xCss: canvas.clientWidth / 2, yCss: canvas.clientHeight / 2 });
    check(coveredHit?.kind === 'surface' && coveredHit.ref.modelId === ref.modelId
      && coveredHit.ref.surfaceId === ref.surfaceId, 'Native-only covered Surface query changed');
    result.nativeOnlyCoveredHit = coveredHit;
    pose([3000, 0, 0]); const clothFront = await capture('cloth-front-independent-control');
    check(same(combinedFront.centre, clothFront.centre) && !same(nativeFront.centre, clothFront.centre),
      'Near cloth did not occlude native from front');
    viewer.resetMotion(); viewer.setView(back); const combinedBack = await capture('combined-back');
    pose([3000, 0, 0]); const clothBack = await capture('cloth-back-independent-control');
    viewer.resetMotion(); viewer.setClothFrame(null); const nativeBack = await capture('native-only-back');
    check(same(combinedBack.centre, nativeBack.centre) && !same(clothBack.centre, nativeBack.centre),
      'Near native did not occlude cloth from back');
    result.depth = { nativeFront, combinedFront, clothFront, nativeBack, combinedBack, clothBack };
    viewer.setView(front); accept(frames[0]);
    result.snapshots = [];
    for (const step of [0, 60, 240]) {
      if (step !== 0) accept(frames[step]);
      result.snapshots.push({ step, metreSHA256: await sha256(frames[step].positionsM),
        triangleSHA256: await sha256(frames[step].triangles), ...await pixelInfo() });
    }
    check(result.snapshots[0].hash !== result.snapshots[2].hash, 'Actual step0/240 cloth pixels unchanged');
    const sameStepPixels = await pixelInfo();
    viewer.setClothFrame(clone(frames[240]));
    check(same(viewer.getState().clothFrame, frames[240]) && same(sameStepPixels, await pixelInfo()),
      'Same-step exact frame changed the accepted cloth or pixels');
    const copied = viewer.getState().clothFrame; copied.positionsM[0] = 999; copied.triangles[0] = 1;
    check(same(viewer.getState().clothFrame, frames[240]), 'State copy exposed mutable cloth');
    viewer.setClothFrame(null);
    const input = clone(frames[0]); accept(input); input.positionsM[0] = 999; input.triangles[0] = 1;
    check(same(viewer.getState().clothFrame, frames[0]), 'Caller exposed mutable cloth');
    const offset = clone(frames[0]);
    const storage = new Float64Array(869); storage.set(offset.positionsM, 1);
    offset.positionsM = new Float64Array(storage.buffer, 8, 867);
    const triangleStorage = new Uint16Array(1538); triangleStorage.set(offset.triangles, 1);
    offset.triangles = new Uint16Array(triangleStorage.buffer, 2, 1536);
    viewer.setClothFrame(offset); check(same(viewer.getState().clothFrame, frames[0]), 'Offset views changed copied data');
    const bad = mutate => { const value = clone(frames[0]); mutate(value); return value; };
    const zero = frames[0].positionsM.findIndex(value => value === 0); check(zero >= 0, 'Actual original zero unavailable');
    await retained('changed equal signed zero', () => viewer.setClothFrame(bad(value =>
      value.positionsM[zero] = Object.is(value.positionsM[zero], -0) ? 0 : -0)));
    await retained('changed equal metre coefficient', () => viewer.setClothFrame(bad(value => value.positionsM[10] += .001)));
    for (const key of ['layerId', 'contextId', 'sceneRevision'])
      await retained('active different ' + key, () => viewer.setClothFrame(bad(value => value[key] = 'other_identity')));
    await retained('unknown field', () => viewer.setClothFrame({ ...clone(frames[0]), extra: true }));
    await retained('vertex count', () => viewer.setClothFrame(bad(value => value.vertexCount = 288)));
    await retained('wrong typed array', () => viewer.setClothFrame(bad(value => value.positionsM = new Float32Array(value.positionsM))));
    await retained('sparse-like position array', () => viewer.setClothFrame(bad(value => value.positionsM = Array(867))));
    await retained('NaN position', () => viewer.setClothFrame(bad(value => value.positionsM[3] = NaN)));
    await retained('noncanonical topology', () => viewer.setClothFrame(bad(value => value.triangles[0] = 1)));
    let getterCalls = 0; const accessor = clone(frames[0]);
    Object.defineProperty(accessor, 'positionsM', { enumerable: true,
      get() { getterCalls++; return frames[0].positionsM; } });
    await retained('accessor DTO', () => viewer.setClothFrame(accessor)); check(getterCalls === 0, 'Caller getter invoked');
    await retained('typed-array extra accessor', () => viewer.setClothFrame(bad(value =>
      Object.defineProperty(value.positionsM, 'length', { get() { getterCalls++; return 867; } }))));
    check(getterCalls === 0, 'Typed-array caller getter invoked');
    await retained('degenerate triangle', () => viewer.setClothFrame(bad(value => {
      value.stepIndex = 1; value.positionsM.set(value.positionsM.slice(0, 3), 17 * 3);
    })));
    await retained('Float32 collapse', () => viewer.setClothFrame(bad(value => {
      value.stepIndex = 1; value.positionsM = Float64Array.from(value.positionsM, number => number * 1e-50);
    })));
    accept(frames[60]); await retained('stale step', () => viewer.setClothFrame(frames[0]));
    await retained('hide active cloth native Surface', () => viewer.setVisibleGeometry([]));
    await retained('failed native source replacement', () => viewer.loadModelSet({ ...nativeSet, entries: [] }));
    viewer.setVisibleGeometry([ref]); viewer.selectGeometry(ref); viewer.selectGeometry(null);
    viewer.orbit(.01, .01); viewer.pan(.01, 0); viewer.zoom(1.05); viewer.fit();
    viewer.fitGeometry(ref); pose([20, 0, 0]); viewer.resetMotion();
    viewer.resize(480, 360); viewer.resize(640, 480); viewer.setView(front);
    check(same(viewer.getState().clothFrame, frames[60]) && same(nativeSnapshot(), source),
      'Camera/pose/resize/selection changed cloth or original native authority');
    const compiledMaterial = compileMeshMaterial('@shader #cloth_native_only { @fragment { color:#336699; } }');
    check(compiledMaterial.ok, 'Native opaque material failed to compile');
    viewer.setSurfaceMaterial({ modelId: ref.modelId, surfaceId: ref.surfaceId }, { material: compiledMaterial.material, uniforms: {} });
    const initialPositionsM = [];
    for (let z = 0; z < 4; z++) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++)
      initialPositionsM.push([.2 + x * .05, .45 + y * .05, .3 + z * .05]);
    fluidWorld ??= createFluidWorld({ format: 'barocss-fluid-scene', version: 1, revision: 'waterRev980',
      basis: 'right-handed-xyz-metres', fixedStepSeconds: fixedStep, gravityMps2: [0, -9.81, 0],
      basinM: [.7, 1.3, .5], initialPositionsM });
    const fluid = fluidWorld.getState();
    viewer.setFluidFrame({ version: 0, contextId: 'cloth_fluid_world', sceneRevision: fluid.sceneRevision,
      stepIndex: fluid.stepIndex, particleCount: fluid.particleCount, positionsM: fluid.positionsM });
    check(fluid.particleCount === 256 && viewer.getState().fluidFrame?.particleCount === 256,
      'Actual public256-particle frame missing');
    const compatible = viewer.getState(); viewer.orbit(.01, 0); pose([10, 0, 0]);
    check(same(viewer.getState().clothFrame, compatible.clothFrame)
      && same(viewer.getState().fluidFrame, compatible.fluidFrame)
      && same(viewer.getState().surfaceMaterial, compatible.surfaceMaterial), 'Complete FrameV1 dropped a layer');
    viewer.resetMotion(); viewer.setView(front); viewer.setClothFrame(null);
    check(same(viewer.getState().fluidFrame, compatible.fluidFrame)
      && same(viewer.getState().surfaceMaterial, compatible.surfaceMaterial), 'Cloth-only clear dropped other layers');
    accept(frames[0]); viewer.setFluidFrame(null); viewer.setSurfaceMaterial({ modelId: ref.modelId, surfaceId: ref.surfaceId }, null);
    check(same(viewer.getState().clothFrame, frames[0]), 'Dedicated fluid/material clear dropped cloth');
    viewer.loadModelSet(nativeSet); viewer.setView(front);
    check(viewer.getState().clothFrame === null && viewer.getState().fluidFrame === null
      && same(nativeSnapshot(), source), 'Successful native replacement retained stale derived state');
    // Warmup is separate. Every measured candidate has a distinct greater public producer step.
    viewer.setClothFrame(frames[0]);
    const timings = [];
    for (let step = 1; step <= 5; step++) viewer.setClothFrame(frames[step]);
    for (let step = 6; step <= 35; step++) {
      const start = performance.now(); viewer.setClothFrame(frames[step]);
      timings.push({ stepIndex: step, submissionMs: performance.now() - start });
    }
    const sorted = timings.map(row => row.submissionMs).sort((a, b) => a - b);
    result.timing = { warmupSteps: [0, 1, 2, 3, 4, 5], distinctAcceptedSubmissions: timings,
      medianMs: sorted[14], p95Ms: sorted[28], completionWaitMeasured: false,
      scope: 'Viewer setClothFrame wall time; excludes solver, no GPU execution/FPS attribution' };
    viewer.setClothFrame(null); viewer.setClothFrame(frames[0]);
    result.final = await capture('reset0-after-explicit-null');
    result.copyAndExactSameStep = true; result.callerGetterCalls = getterCalls;
    result.errors = [...errors]; result.warnings = [...warnings];
    check(errors.length === 0 && warnings.length === 0, 'Browser error check failed');
    result.ok = true;
  } catch (error) {
    result.error = error.stack || error.message; result.failures.push({ error: result.error,
      casesCompleted: result.cases.length, refusalsCompleted: result.refusals.length });
    result.errors = [...errors]; result.warnings = [...warnings];
  } finally {
    running = false; window.viewerClothProof = result; controls(); display(result);
    try { await fetch('/result', { method: 'POST', body: JSON.stringify(result) }); }
    catch (error) { result.recordingError = error.message; display(result); }
  }
  return result;
}
function dispose() {
  if (disposed) return;
  viewer.dispose(); viewer.dispose(); world.dispose(); fluidWorld?.dispose(); disposed = true;
  const receipt = { status: viewer.getState().status, errors: [...errors], warnings: [...warnings] };
  if (result) result.disposal = receipt;
  controls(); display(receipt); return receipt;
}
try {
  viewer = await createViewer(canvas, { mmToSceneUnit, background: [.035, .065, .105],
    lighting: { ambientStrength: 1, directionalStrength: 0, direction: [0, 1, 0] } });
  await loadNative(); viewer.setClothFrame(frames[0]); controls();
  window.viewerClothProbe = { viewer, world, frames, states, canvas, front, back, mmToSceneUnit,
    frameFromState, loadNative, runProof, pose, ref, retained, pixelInfo,
    errors, warnings, dispose, nativeSnapshot,
    get nativeSet() { return clone(nativeSet); }, get result() { return result; },
    get fluidWorld() { return fluidWorld; } };
  display('Ready: genuine Physics step0, original qualified Surface, scale0.0013. Run proof when ready.');
} catch (error) { display({ ok: false, stage: 'startup', error: error.stack || error.message }); }
buttons['run-proof'].addEventListener('click', runProof);
for (const [id, camera] of [['front', front], ['back', back]]) buttons[id].addEventListener('click', async () => {
  try { viewer.setView(camera); display({ view: id, ...await pixelInfo() }); } catch (error) { display(error.message); }
});
buttons['clear-cloth'].addEventListener('click', async () => {
  try { viewer.setClothFrame(null); display({ cloth: null, ...await pixelInfo() }); } catch (error) { display(error.message); }
});
buttons.dispose.addEventListener('click', dispose);
window.addEventListener('beforeunload', () => { if (viewer) dispose(); });
