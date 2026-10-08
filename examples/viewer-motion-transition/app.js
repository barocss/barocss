import { createViewer } from '../../packages/barocss-viewer/dist/index.js';
import { createMotionClip, createMotionTransitionPlayer } from '../../packages/barocss-motion/dist/index.js';

const canvas = document.querySelector('#view');
const stateElement = document.querySelector('#state');
const viewer = createViewer(canvas, { mmToSceneUnit: 0.001, background: [0.035, 0.055, 0.09] });
const source = await (await fetch('/two-surfaces.barocad')).text();
viewer.loadNative(source, { sourceVersion: 0, countU: 8, countV: 8 });
const refs = viewer.getState().surfaces;
const modelId = viewer.getState().native.model.name;
const nativeDistance = viewer.measureNativeSurfacePoints(
  { modelId, surfaceId: refs[0].surfaceId, u: 3.5, v: 15 },
  { modelId, surfaceId: refs[1].surfaceId, u: 0.5, v: 0.5 });
const track = (targetId, property, interpolation, first, last) => ({
  targetId, property, interpolation, keys: [
    { timeSeconds: 0, value: first }, { timeSeconds: 4, value: last },
  ],
});
const q = Math.SQRT1_2;
const sourceClip = createMotionClip({ version: 0, contextId: modelId, durationSeconds: 4, tracks: [
  track('panel-a', 'translation', 'LINEAR', [-30, -10, 0], [65, 10, 10]),
  track('panel-a', 'rotation', 'SLERP', [0, 0, 0, 1], [0, 0, q, q]),
  track('panel-a', 'scale', 'LINEAR', [1, 1, 1], [1.5, 0.75, 1]),
  track('panel-b', 'translation', 'LINEAR', [30, 10, 0], [-70, 35, 25]),
  track('panel-b', 'rotation', 'SLERP', [0, 0, 0, 1], [0, q, 0, q]),
  track('panel-b', 'scale', 'LINEAR', [1, 1, 1], [0.65, 1.4, 0.8]),
] });
const destinationClip = createMotionClip({ version: 0, contextId: modelId, durationSeconds: 4, tracks: [
  track('panel-a', 'translation', 'LINEAR', [65, 10, 10], [-40, 35, 30]),
  track('panel-a', 'rotation', 'SLERP', [0, 0, q, q], [0, 0, 0, 1]),
  track('panel-a', 'scale', 'LINEAR', [1.5, 0.75, 1], [1, 1.2, 1]),
  track('panel-b', 'translation', 'LINEAR', [-70, 35, 25], [45, -20, 20]),
  track('panel-b', 'rotation', 'SLERP', [0, q, 0, q], [0, 0, 0, 1]),
  track('panel-b', 'scale', 'LINEAR', [0.65, 1.4, 0.8], [1.1, 0.9, 1]),
] });
const wrongContextClip = createMotionClip({ version: 0, contextId: 'foreign_model',
  durationSeconds: 4, tracks: structuredClone(destinationClip.tracks) });
const bindings = [
  { contextId: modelId, targetId: 'panel-a', ref: refs[0] },
  { contextId: modelId, targetId: 'panel-b', ref: refs[1] },
];
const basis = { basis: 'part-xyz-matches-rhyup' };
let player = createMotionTransitionPlayer(sourceClip, { mode: 'clamp' });
let disposed = false;

function describe(message = '') {
  const scene = viewer.getState();
  const state = disposed ? null : player.getState();
  stateElement.textContent = [
    `Viewer: ${scene.status} · native model: ${scene.native?.model.name ?? 'none'}`,
    `Surfaces: ${scene.surfaces.map(ref => ref.surfaceId).join(', ')}`,
    `Transition: ${state?.phase ?? 'disposed'} · ${state?.playing ? 'playing' : 'paused'}`,
    `Source time: ${state?.sourceTimeSeconds ?? 'none'} s · destination time: ${state?.destinationTimeSeconds ?? 'none'} s`,
    `Fade progress: ${state?.fadeProgress ?? 'none'} · weight: ${state?.weight ?? 'none'}`,
    `Display translations (mm): ${scene.motion?.displayPoses.map(p => p.translationMm.map(v => v.toFixed(3)).join(',')).join(' | ') ?? 'identity'}`,
    `Native Surface distance (mm): ${scene.measurement?.distanceMM.toFixed(6) ?? 'none'}`,
    `Original source retained: ${scene.native?.source === source}`,
    message,
  ].join('\n');
}
function display(state, message) {
  viewer.applyMotionFrame({ contextId: state.contextId, timeSeconds: state.sourceTimeSeconds,
    poses: state.poses }, bindings, basis);
  viewer.fit();
  describe(message);
}
function act(callback, label) {
  try { display(callback(), label); }
  catch (error) { describe(`${label} refused: ${error.code ?? error.name} · ${error.message}`); }
}
document.querySelector('#start').addEventListener('click', () => act(() => player.play(), 'Start'));
document.querySelector('#advance').addEventListener('click', () => act(() => player.advance(1), 'Advance 1 s'));
document.querySelector('#pause').addEventListener('click', () => act(() => player.pause(), 'Pause'));
document.querySelector('#resume').addEventListener('click', () => act(() => player.play(), 'Resume'));
document.querySelector('#transition').addEventListener('click', () => act(() => player.transitionTo(
  destinationClip, { destinationTimeSeconds: 0, fadeDurationSeconds: 2 }), 'Clip change'));
document.querySelector('#incompatible').addEventListener('click', () => act(() => player.transitionTo(
  wrongContextClip, { destinationTimeSeconds: 0, fadeDurationSeconds: 2 }), 'Wrong context'));
document.querySelector('#second-fade').addEventListener('click', () => act(() => player.transitionTo(
  destinationClip, { destinationTimeSeconds: 0, fadeDurationSeconds: 2 }), 'Second fade'));
document.querySelector('#reset').addEventListener('click', () => {
  if (disposed) return;
  player.dispose();
  player = createMotionTransitionPlayer(sourceClip, { mode: 'clamp' });
  viewer.resetMotion();
  viewer.fit();
  describe('Reset to source clip at 0 s and identity display pose.');
});
document.querySelector('#dispose').addEventListener('click', () => {
  if (disposed) return;
  player.dispose();
  viewer.dispose();
  disposed = true;
  describe('Host player and Viewer disposed; caller clips and source stay owned by the host.');
});
describe('Caller owns the transition clock. Use Start, then Advance 1 s.');
window.viewerTransitionDemo = { viewer, getPlayer: () => player, sourceClip, destinationClip,
  wrongContextClip, bindings, basis, source, nativeDistance };
