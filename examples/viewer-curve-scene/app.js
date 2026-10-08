import { createViewer } from '../../packages/barocss-viewer/dist/index.js';

const canvas = document.querySelector('#view');
const output = document.querySelector('#state');
const viewer = createViewer(canvas, { mmToSceneUnit: 0.001, background: [0.035, 0.055, 0.09] });
const sources = Object.fromEntries(await Promise.all(['mixed', 'curves-only'].map(async name =>
  [name, await (await fetch(`/${name}.barocad`)).text()])));
const options = { sourceVersion: 0, countU: 8, countV: 8,
  curveDisplay: { chordToleranceMM: 2, maxSegments: 256, maxDepth: 10 } };
let message = '';
let lastHit = null;

function describe(next = message) {
  message = next;
  const state = viewer.getState();
  output.textContent = [
    `Status: ${state.status}`,
    `Native model: ${state.native?.model.name ?? 'none'}`,
    `Surfaces: ${state.surfaces.map(ref => ref.surfaceId).join(', ') || 'none'}`,
    `Displayed Curves: ${state.curves.map(ref => ref.curveId).join(', ') || 'none'}`,
    `Selected Surface: ${state.selected?.surfaceId ?? 'none'}`,
    `Selected geometry: ${state.selectedGeometry
      ? `${state.selectedGeometry.kind} ${state.selectedGeometry.kind === 'curve'
        ? state.selectedGeometry.curveId : state.selectedGeometry.surfaceId}` : 'none'}`,
    `Camera: ${state.camera.eye.map(value => value.toFixed(3)).join(', ')}`,
    next,
  ].join('\n');
}
function load(name) {
  viewer.loadNative(sources[name], options);
  lastHit = null;
  describe(`${name} accepted. Original Curve parameters and native source remain in getState().native.`);
}
load('mixed');

document.querySelector('#mixed').addEventListener('click', () => load('mixed'));
document.querySelector('#curves-only').addEventListener('click', () => load('curves-only'));
document.querySelector('#fit').addEventListener('click', () => { viewer.fit(); describe('Fitted visible geometry.'); });
document.querySelector('#orbit').addEventListener('click', () => { viewer.orbit(0.3, 0.1); describe('Orbited camera.'); });
document.querySelector('#pose').addEventListener('click', () => {
  const refs = viewer.getState().surfaces;
  if (!refs.length) { describe('Load mixed geometry before posing Surfaces.'); return; }
  viewer.applyMotionFrame({ contextId: 'native_mixed', timeSeconds: 1,
    poses: refs.map((ref, index) => ({ targetId: `panel-${index}`,
      translation: [index ? 60 : -60, 0, 0] })) },
  refs.map((ref, index) => ({ contextId: 'native_mixed', targetId: `panel-${index}`, ref })),
  { basis: 'part-xyz-matches-rhyup' });
  describe('Posed Surfaces; native Curves stay in authored XYZ/mm.');
});
document.querySelector('#invalid').addEventListener('click', () => {
  try { viewer.loadNative(sources.mixed, { ...options,
    curveDisplay: { ...options.curveDisplay, maxSegments: 0 } }); }
  catch (error) { describe(`Rejected without scene replacement: ${error.message}`); }
});
document.querySelector('#select-hit').addEventListener('click', () => {
  if (!lastHit) { describe('Click visible geometry first.'); return; }
  viewer.selectGeometry({ kind: lastHit.kind, ...lastHit.ref });
  describe(`Selected displayed ${lastHit.kind}. The native Model is unchanged.`);
});
document.querySelector('#clear-selection').addEventListener('click', () => {
  viewer.selectGeometry(null);
  describe('Display selection cleared.');
});
canvas.addEventListener('click', event => {
  const rect = canvas.getBoundingClientRect();
  const hit = viewer.pickGeometry({ xCss: event.clientX - rect.left, yCss: event.clientY - rect.top });
  lastHit = hit;
  if (hit?.kind === 'surface') describe(`Surface ${hit.ref.surfaceId}: approximate UV ${hit.parameterUV.join(', ')}`);
  else if (hit?.kind === 'curve') describe(`Curve ${hit.ref.curveId}: segment ${hit.segmentIndex}, approximate t ${hit.parameterApprox.toFixed(6)}, native XYZ/mm ${hit.nativePointMM.map(value => value.toFixed(3)).join(', ')}, screen distance ${hit.screenDistancePx.toFixed(2)} CSS px`);
  else describe('No visible geometry near this point.');
});

window.viewerCurveDemo = { viewer, sources, options, load, describe,
  get lastHit() { return lastHit; } };
