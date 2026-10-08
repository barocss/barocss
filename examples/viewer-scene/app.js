import { createViewer } from '../../packages/barocss-viewer/dist/index.js';

const canvas = document.querySelector('#view');
const stateElement = document.querySelector('#state');
const viewer = createViewer(canvas, { mmToSceneUnit: 0.001, background: [0.035, 0.055, 0.09] });
const source = await (await fetch('/two-surfaces.barocad')).text();
viewer.loadNative(source, { sourceVersion: 0, countU: 8, countV: 8 });
const refs = viewer.getState().surfaces;
for (const id of ['first-surface', 'second-surface']) {
  const select = document.querySelector(`#${id}`);
  for (const ref of refs) select.add(new Option(ref.surfaceId, ref.surfaceId));
}
document.querySelector('#second-surface').value = refs[1]?.surfaceId ?? refs[0].surfaceId;
let nextPick = null;

function parameter(slot) {
  return { modelId: viewer.getState().native.model.name,
    surfaceId: document.querySelector(`#${slot}-surface`).value,
    u: document.querySelector(`#${slot}-u`).valueAsNumber,
    v: document.querySelector(`#${slot}-v`).valueAsNumber };
}

function describe(extra = '') {
  const state = viewer.getState();
  stateElement.textContent = [
    `Status: ${state.status}`,
    `Model: ${state.native?.model.name ?? 'none'}`,
    `Surfaces: ${state.surfaces.map(ref => ref.surfaceId).join(', ')}`,
    `Curves retained, not drawn: ${state.native?.unrenderedCurveIds.join(', ') ?? 'none'}`,
    `Selected: ${state.selected?.surfaceId ?? 'none'}`,
    `Camera eye: ${state.camera.eye.map(n => n.toFixed(3)).join(', ')}`,
    `Native point distance (mm): ${state.measurement?.distanceMM.toFixed(6) ?? 'none'}`,
    extra,
  ].join('\n');
}
describe();

document.querySelector('#fit').addEventListener('click', () => { viewer.fit(); describe('Fit camera to both surfaces.'); });
document.querySelector('#orbit').addEventListener('click', () => { viewer.orbit(0.4, 0.12); describe('Orbit changed the camera.'); });
document.querySelector('#pan').addEventListener('click', () => { viewer.pan(0.025, 0); describe('Pan changed the camera.'); });
document.querySelector('#zoom').addEventListener('click', () => { viewer.zoom(1.3); describe('Zoom changed the camera.'); });
for (const slot of ['first', 'second']) {
  document.querySelector(`#pick-${slot}`).addEventListener('click', () => {
    nextPick = slot;
    describe(`Click a displayed triangle for the ${slot} point. Its selected UV is approximate.`);
  });
}
document.querySelector('#measure').addEventListener('click', () => {
  try {
    const result = viewer.measureNativeSurfacePoints(parameter('first'), parameter('second'));
    describe(`Native XYZ (mm): ${result.first.pointMM.map(n => n.toFixed(3)).join(', ')} → ${result.second.pointMM.map(n => n.toFixed(3)).join(', ')} · ${result.certification}`);
  } catch (error) {
    describe(`Measurement rejected: ${error.message}`);
  }
});
canvas.addEventListener('click', event => {
  const rect = canvas.getBoundingClientRect();
  const hit = viewer.pick(event.clientX - rect.left, event.clientY - rect.top);
  viewer.select(hit?.ref ?? null);
  if (hit && nextPick) {
    document.querySelector(`#${nextPick}-surface`).value = hit.ref.surfaceId;
    document.querySelector(`#${nextPick}-u`).value = String(hit.parameterUV[0]);
    document.querySelector(`#${nextPick}-v`).value = String(hit.parameterUV[1]);
    nextPick = null;
  }
  describe(hit ? `Triangle hit: ${hit.ref.surfaceId} · UV ${hit.parameterUV.map(n => n.toFixed(2)).join(', ')} · approximate` : 'No displayed triangle hit.');
});

window.viewerDemo = { viewer, source, describe, createViewer, parameter };
