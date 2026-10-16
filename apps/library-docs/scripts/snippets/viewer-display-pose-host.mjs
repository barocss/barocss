import * as ViewerPoseAPI from '@barocss/viewer';

const sourceProfile = 'e532fc3037f9c1e13819b61d63de06164c50128f';
const ref = { modelId: 'pose_panel', surfaceId: 'panel' };
const binding = { contextId: 'pose-panel-session', targetId: 'panel-pose', ref };
const basis = { basis: 'part-xyz-matches-rhyup' };
const camera = { eye: [.25, .18, .3], target: [.05, .035, .02], up: [0, 1, 0],
  fovYDegrees: 45, near: .01, far: 10 };
const displayPose = { contextId: 'pose-panel-session', timeSeconds: 0, poses: [
  { targetId: 'panel-pose', translation: [30, 10, 0],
    rotation: [0, 0, Math.SQRT1_2, Math.SQRT1_2], scale: [1, 1, 1] },
] };
const ledger = { created: 0, disposeCalls: 0, pending: 0 };
let lastDisposedLedger = null;

function sameData(first, second) {
  if (Object.is(first, second)) return true;
  if (first === null || second === null || typeof first !== 'object' || typeof second !== 'object') return false;
  if (ArrayBuffer.isView(first) || ArrayBuffer.isView(second)) {
    if (!ArrayBuffer.isView(first) || !ArrayBuffer.isView(second) || first.constructor !== second.constructor || first.length !== second.length) return false;
    return Array.from(first).every((value, index) => Object.is(value, second[index]));
  }
  const keys = Reflect.ownKeys(first), other = Reflect.ownKeys(second);
  return keys.length === other.length && keys.every(key => Object.hasOwn(second, key) && sameData(first[key], second[key]));
}
function equalPixels(first, second) {
  if (!(first instanceof Uint8Array) || !(second instanceof Uint8Array) || first.length !== second.length) return false;
  for (let index = 0; index < first.length; index++) if (first[index] !== second[index]) return false;
  return true;
}
function checksum(pixels) {
  let hash = 2166136261;
  for (const byte of pixels) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  return 'fnv1a32:' + hash.toString(16).padStart(8, '0');
}
function recipeFrom(text) {
  const value = JSON.parse(text);
  if (!value || Object.getPrototypeOf(value) !== Object.prototype ||
    Object.keys(value).length !== 3 || !['nativeSource', 'pose', 'probeUV'].every(key => Object.hasOwn(value, key)) ||
    typeof value.nativeSource !== 'string' || !Array.isArray(value.probeUV) || value.probeUV.length !== 2 ||
    !value.probeUV.every(Number.isFinite)) throw new TypeError('Recipe requires nativeSource, pose and two finite probeUV values');
  // Pose and parameter domains are admitted by the actual public Viewer methods.
  return structuredClone(value);
}
function measure(viewer) {
  return viewer.measureNativeSurfacePoints({ ...ref, u: 0, v: .5 }, { ...ref, u: 1, v: .5 });
}
function canvasElement() {
  const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 420;
  canvas.setAttribute('aria-label', 'Actual Viewer display pose');
  Object.assign(canvas.style, { display: 'block', width: '100%', height: 'auto' });
  return canvas;
}

// The Viewer draws with WebGPU: creation and readPixels are asynchronous, so update and action are too.
export async function createViewerDisplayPoseExample(panel, text) {
  let accepted = null, disposed = false;
  const pending = new Set();
  const readout = document.createElement('p');
  Object.assign(readout.style, { margin: '8px 0 0', fontSize: '12px', lineHeight: '1.6' });
  readout.setAttribute('aria-label', 'Application native and displayed coordinate readout');
  const roundedVector = point => point ? '[' + point.map(value => value.toFixed(3)).join(', ') + ']' : 'not available';
  function active() { if (disposed) throw new Error('Viewer display pose example is disposed'); }
  function release(candidate) {
    if (!candidate || candidate.released) return;
    candidate.released = true;
    if (candidate.viewer) { ledger.disposeCalls++; candidate.viewer.dispose(); }
    candidate.canvas.remove();
    if (pending.delete(candidate)) ledger.pending--;
  }
  async function retainedBaseline() {
    if (!accepted) return null;
    try { return { state: accepted.viewer.getState(), pixels: await accepted.viewer.readPixels() }; }
    catch (error) { return { unavailable: error.message }; }
  }
  async function withRetention(operation) {
    const before = await retainedBaseline();
    try { return await operation(); }
    catch (error) {
      const after = await retainedBaseline();
      const checked = Boolean(before?.state && after?.state);
      error.retention = checked
        ? { scope: 'Application observation of this live accepted Viewer', checked: true,
          snapshotEqual: sameData(before.state, after.state), pixelBytesEqual: equalPixels(before.pixels, after.pixels),
          comparedPixelBytes: before.pixels.byteLength, comparison: 'Recursive Object.is values and every actual readPixels byte; checksum not used' }
        : { scope: 'Application observation', checked: false, reason: before?.unavailable ?? after?.unavailable ?? 'No accepted Viewer' };
      throw error;
    }
  }
  function project(candidate, u, v) {
    const rect = candidate.canvas.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0)) return null;
    return candidate.viewer.projectNativePoint({ kind: 'surface', ...ref, u, v });
  }
  // The drawn frame of a candidate after its last change (readPixels waits for that frame).
  async function readFrame(candidate) {
    const pixels = await candidate.viewer.readPixels();
    candidate.frame = { width: candidate.canvas.width, height: candidate.canvas.height,
      byteCount: pixels.byteLength, rgbaChecksum: checksum(pixels) };
  }
  function report() {
    const state = accepted?.viewer.getState() ?? null;
    const live = !disposed && state?.status === 'ready';
    const frame = accepted?.frame ?? null;
    let projection = null, midpointProjection = null;
    if (live) {
      projection = project(accepted, ...accepted.recipe.probeUV);
      midpointProjection = project(accepted, .5, .5);
    }
    const result = structuredClone({ backend: 'Public Viewer on the @barocss/gpu WebGPU viewer', sourceProfile,
      recipe: accepted?.recipe ?? null, editorSource: accepted ? JSON.stringify(accepted.recipe, null, 2) : null,
      state, measurement: state?.measurement ?? null,
      nativePoints: state?.measurement ? { first: state.measurement.first, second: state.measurement.second } : null,
      projection, midpointProjection, selected: state?.selected ?? null, camera: state?.camera ?? null,
      lastPick: accepted?.lastPick ?? null, pickedUnderPose: accepted?.pickedUnderPose ?? null,
      lastPickMeaning: 'Last successful public pick; historical after a later pose or camera change',
      frame, available: live, disposed,
      ledger: { ...ledger, lastDisposedLedger, scope: 'Application create/dispose calls; not raw GPU deletion' } });
    readout.textContent = 'Application readout · rounded to 3 decimals. Native width: '
      + (result.measurement ? result.measurement.distanceMM.toFixed(3) + ' mm' : 'not measured')
      + '. Native midpoint: ' + roundedVector(result.midpointProjection?.point.pointMM) + ' mm'
      + '. Displayed midpoint: ' + roundedVector(result.midpointProjection?.displayPositionScene) + ' scene units.';
    return result;
  }
  async function prepare(recipe) {
    const candidate = { recipe, canvas: canvasElement(), viewer: null, released: false, lastPick: null, pickedUnderPose: null };
    pending.add(candidate); ledger.pending++;
    try {
      candidate.viewer = await ViewerPoseAPI.createViewer(candidate.canvas, { mmToSceneUnit: .001, background: [.04, .06, .1] });
      ledger.created++;
      // Released (the example disposed) while the Viewer was being created.
      if (candidate.released) { ledger.disposeCalls++; candidate.viewer.dispose(); throw new Error('Viewer display pose example is disposed'); }
      candidate.viewer.loadNative(recipe.nativeSource, { sourceVersion: 0, countU: 3, countV: 3 });
      const inventory = candidate.viewer.getState().surfaces;
      if (inventory.length !== 1 || inventory[0].modelId !== ref.modelId || inventory[0].surfaceId !== ref.surfaceId) {
        throw new RangeError('This application requires one pose_panel/panel Surface');
      }
      candidate.viewer.setView(structuredClone(camera));
      if (recipe.pose !== null) candidate.viewer.applyMotionFrame(structuredClone(recipe.pose), [structuredClone(binding)], basis);
      // This public query admits U/V before a detached candidate has CSS bounds.
      const probe = { ...ref, u: recipe.probeUV[0], v: recipe.probeUV[1] };
      candidate.viewer.measureNativeSurfacePoints(probe, probe);
      measure(candidate.viewer);
      await readFrame(candidate);
      return candidate;
    } catch (error) { release(candidate); throw error; }
  }
  async function update(nextText) {
    active();
    return withRetention(async () => {
      const candidate = await prepare(recipeFrom(nextText)), prior = accepted;
      active();
      if (prior) prior.canvas.replaceWith(candidate.canvas); else panel.append(candidate.canvas, readout);
      accepted = candidate;
      if (pending.delete(candidate)) ledger.pending--;
      release(prior);
      return report();
    });
  }
  async function action(id) {
    active();
    if (!accepted) throw new Error('An accepted Viewer is required');
    return withRetention(async () => {
      if (id === 'apply-pose') {
        accepted.viewer.applyMotionFrame(structuredClone(displayPose), [structuredClone(binding)], basis);
        accepted.recipe.pose = structuredClone(displayPose);
        await readFrame(accepted);
        return { report: report(), acceptedSource: JSON.stringify(accepted.recipe, null, 2) };
      }
      if (id === 'reset-display') {
        accepted.viewer.resetMotion(); accepted.recipe.pose = null;
        await readFrame(accepted);
        return { report: report(), acceptedSource: JSON.stringify(accepted.recipe, null, 2) };
      }
      if (id === 'measure-native') measure(accepted.viewer);
      else if (id === 'select-probe') {
        const projected = accepted.viewer.projectNativePoint({ kind: 'surface', ...ref,
          u: accepted.recipe.probeUV[0], v: accepted.recipe.probeUV[1] });
        if (!projected) throw new RangeError('Projected probe is clipped');
        const hit = accepted.viewer.pick(projected.xCss, projected.yCss);
        if (!hit) throw new RangeError('Projected probe has no sampled Surface hit');
        accepted.viewer.select(hit.ref);
        accepted.lastPick = structuredClone(hit);
        accepted.pickedUnderPose = accepted.viewer.getState().motion;
        await readFrame(accepted);
        return { report: report(), pick: structuredClone(hit) };
      } else throw new RangeError('Unknown Viewer display pose action');
      await readFrame(accepted);
      return { report: report() };
    });
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const candidate of [...pending]) release(candidate);
    release(accepted); lastDisposedLedger = { ...ledger };
    readout.remove();
  }
  const controller = { update, action, report, dispose };
  try { await update(text); return controller; }
  catch (error) { dispose(); throw error; }
}
