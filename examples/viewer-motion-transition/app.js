import { createViewer } from '../../packages/barocss-viewer/dist/index.js';

const canvas = document.querySelector('#view');
const stateElement = document.querySelector('#state');
const viewer = await createViewer(canvas, { mmToSceneUnit: 0.001, background: [0.035, 0.055, 0.09] });
const source = await (await fetch('/two-surfaces.barocad')).text();
viewer.loadNative(source, { sourceVersion: 0, countU: 8, countV: 8 });
const refs = viewer.getState().surfaces;
const modelId = viewer.getState().native.model.name;
const nativeDistance = viewer.measureNativeSurfacePoints(
  { modelId, surfaceId: refs[0].surfaceId, u: 3.5, v: 15 },
  { modelId, surfaceId: refs[1].surfaceId, u: 0.5, v: 0.5 });
const bindings = [
  { contextId: modelId, targetId: 'panel-a', ref: refs[0] },
  { contextId: modelId, targetId: 'panel-b', ref: refs[1] },
];
const basis = { basis: 'part-xyz-matches-rhyup' };
const frames = [
  [[-30, -10, 0], [30, 10, 0]],
  [[0, 0, 5], [0, 15, 5]],
  [[40, 20, 10], [-40, 25, 10]],
  [[60, 15, 10], [-60, 30, 20]],
  [[65, 10, 10], [-70, 35, 25]],
];
let timeSeconds = 0;
let playing = false;
let disposed = false;

function describe(message = '') {
  const state = viewer.getState();
  stateElement.textContent = [
    `Viewer: ${state.status} · native model: ${state.native?.model.name ?? 'none'}`,
    `Surfaces: ${state.surfaces.map(ref => ref.surfaceId).join(', ')}`,
    `Caller time: ${timeSeconds} s · ${playing ? 'playing' : 'paused'}`,
    `Display translations (mm): ${state.motion?.displayPoses.map(p => p.translation.join(',')).join(' | ') ?? 'identity'}`,
    `Native Surface distance (mm): ${state.measurement?.distanceMM.toFixed(6) ?? 'none'}`,
    `Original source retained: ${state.native?.source === source}`,
    message,
  ].join('\n');
}
function step(nextTime) {
  if (disposed) return;
  timeSeconds = nextTime;
  viewer.applyMotionFrame({ contextId: modelId, timeSeconds, poses: frames[timeSeconds].map((translation, index) =>
    ({ targetId: index === 0 ? 'panel-a' : 'panel-b', translation: [...translation] })) },
  bindings, basis);
  viewer.fit();
  describe('Caller supplied the display frame; native source and distance are unchanged.');
}
document.querySelector('#start').addEventListener('click', () => { playing = true; step(0); });
document.querySelector('#advance').addEventListener('click', () => { if (playing) step(Math.min(4, timeSeconds + 1)); });
document.querySelector('#pause').addEventListener('click', () => { playing = false; describe('Paused caller time.'); });
document.querySelector('#resume').addEventListener('click', () => { if (!disposed) { playing = true; describe('Resumed caller time.'); } });
document.querySelector('#incompatible').addEventListener('click', () => {
  if (disposed) return;
  try { viewer.applyMotionFrame({ contextId: 'foreign_model', timeSeconds,
    poses: [{ targetId: 'panel-a', translation: [0, 0, 0] },
      { targetId: 'panel-b', translation: [0, 0, 0] }] }, bindings, basis); }
  catch (error) { describe(`Wrong context refused: ${error.message}`); }
});
document.querySelector('#reset').addEventListener('click', () => {
  if (disposed) return;
  playing = false; timeSeconds = 0; viewer.resetMotion(); viewer.fit();
  describe('Identity display pose restored.');
});
document.querySelector('#dispose').addEventListener('click', () => {
  if (disposed) return;
  playing = false; viewer.dispose(); disposed = true;
  describe('Viewer disposed; original source remains caller-owned.');
});
describe('The caller owns time. Use Start, then Advance 1 s.');
window.viewerTransitionDemo = { viewer, frames, bindings, basis, source, nativeDistance, step, describe };
