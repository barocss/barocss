import { createViewer } from '../../packages/barocss-viewer/dist/index.js';

const canvas = document.querySelector('#view');
const stateElement = document.querySelector('#state');
const viewer = createViewer(canvas, { mmToSceneUnit: 0.001, background: [0.035, 0.055, 0.09] });
const source = await (await fetch('/two-surfaces.barocad')).text();
viewer.loadNative(source, { sourceVersion: 0, countU: 8, countV: 8 });

function describe(extra = '') {
  const state = viewer.getState();
  stateElement.textContent = [
    `Status: ${state.status}`,
    `Model: ${state.native?.model.name ?? 'none'}`,
    `Surfaces: ${state.surfaces.map(ref => ref.surfaceId).join(', ')}`,
    `Curves retained, not drawn: ${state.native?.unrenderedCurveIds.join(', ') ?? 'none'}`,
    `Selected: ${state.selected?.surfaceId ?? 'none'}`,
    `Camera eye: ${state.camera.eye.map(n => n.toFixed(3)).join(', ')}`,
    extra,
  ].join('\n');
}
describe();

document.querySelector('#fit').addEventListener('click', () => { viewer.fit(); describe('Fit camera to both surfaces.'); });
document.querySelector('#orbit').addEventListener('click', () => { viewer.orbit(0.4, 0.12); describe('Orbit changed the camera.'); });
document.querySelector('#pan').addEventListener('click', () => { viewer.pan(0.025, 0); describe('Pan changed the camera.'); });
document.querySelector('#zoom').addEventListener('click', () => { viewer.zoom(1.3); describe('Zoom changed the camera.'); });
canvas.addEventListener('click', event => {
  const rect = canvas.getBoundingClientRect();
  const hit = viewer.pick(event.clientX - rect.left, event.clientY - rect.top);
  viewer.select(hit?.ref ?? null);
  describe(hit ? `Triangle hit: ${hit.ref.surfaceId} · UV ${hit.parameterUV.map(n => n.toFixed(2)).join(', ')} · approximate` : 'No displayed triangle hit.');
});

window.viewerDemo = { viewer, source, describe, createViewer };
