import { createViewer } from '../../packages/barocss-viewer/dist/index.js';

const canvas = document.querySelector('#view');
const stateElement = document.querySelector('#state');
const viewer = createViewer(canvas, { mmToSceneUnit: 0.001, background: [0.035, 0.055, 0.09] });
const source = await (await fetch('/two-surfaces.barocad')).text();
viewer.loadNative(source, { sourceVersion: 0, countU: 8, countV: 8 });
const refs = viewer.getState().surfaces;
const contextId = viewer.getState().native.model.name;
const sinHalf = Math.sin(Math.PI / 8), cosHalf = Math.cos(Math.PI / 8);
const frames = {
  0: [
    { targetId: 'panel-a', translation: [-30, -10, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
    { targetId: 'panel-b', translation: [30, 10, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
  ],
  2: [
    { targetId: 'panel-a', translation: [17.5, 0, 5], rotation: [0, 0, sinHalf, cosHalf], scale: [1.25, 0.875, 1] },
    { targetId: 'panel-b', translation: [-20, 22.5, 12.5], rotation: [0, sinHalf, 0, cosHalf], scale: [0.825, 1.2, 0.9] },
  ],
  4: [
    { targetId: 'panel-a', translation: [65, 10, 10], rotation: [0, 0, Math.SQRT1_2, Math.SQRT1_2], scale: [1.5, 0.75, 1] },
    { targetId: 'panel-b', translation: [-70, 35, 25], rotation: [0, Math.SQRT1_2, 0, Math.SQRT1_2], scale: [0.65, 1.4, 0.8] },
  ],
};
const frameAt = timeSeconds => ({ contextId, timeSeconds, poses: structuredClone(frames[timeSeconds]) });
const bindings = [
  { contextId, targetId: 'panel-a', ref: refs[0] },
  { contextId, targetId: 'panel-b', ref: refs[1] },
];
const basis = { basis: 'part-xyz-matches-rhyup' };

function describe(message = '') {
  const state = viewer.getState();
  stateElement.textContent = [
    `Status: ${state.status}`,
    `Native model: ${state.native?.model.name ?? 'none'}`,
    `Surfaces: ${state.surfaces.map(ref => ref.surfaceId).join(', ')}`,
    `Motion time: ${state.motion?.frame.timeSeconds ?? 'reset'} s`,
    `Display translations: ${state.motion?.displayPoses.map(pose => pose.translationMm.join(',')).join(' | ') ?? 'identity'}`,
    `Selected: ${state.selected?.surfaceId ?? 'none'}`,
    `Camera target: ${state.camera.target.map(value => value.toFixed(3)).join(', ')}`,
    message,
  ].join('\n');
}
function step(timeSeconds) {
  viewer.applyMotionFrame(frameAt(timeSeconds), bindings, basis);
  viewer.fit();
  describe('The caller supplied a direct pose frame. Viewer has no playback clock.');
}
for (const [id, time] of [['start', 0], ['middle', 2], ['end', 4]]) {
  document.querySelector(`#${id}`).addEventListener('click', () => step(time));
}
document.querySelector('#reset').addEventListener('click', () => { viewer.resetMotion(); viewer.fit(); describe('Identity display pose restored.'); });
document.querySelector('#fit').addEventListener('click', () => { viewer.fit(); describe('Fit includes the current display pose.'); });
canvas.addEventListener('click', event => {
  const rect = canvas.getBoundingClientRect();
  const hit = viewer.pick(event.clientX - rect.left, event.clientY - rect.top);
  viewer.select(hit?.ref ?? null);
  describe(hit ? `Approximate hit: ${hit.ref.surfaceId} · UV ${hit.parameterUV.map(value => value.toFixed(2)).join(', ')}`
    : 'No displayed triangle hit.');
});
describe();
window.viewerMotionDemo = { viewer, frames, frameAt, bindings, basis, source, step, describe };
