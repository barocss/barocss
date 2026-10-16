import { createViewer } from '../../packages/barocss-viewer/dist/index.js';

const canvas = document.querySelector('#view');
const stateElement = document.querySelector('#state');
const keyboardProofMode = new URLSearchParams(location.search).has('keyboardProof');
const viewer = await createViewer(canvas, { mmToSceneUnit: 0.001, background: [0.035, 0.055, 0.09] });
const sourcePath = new URLSearchParams(location.search).get('weightedCurve') === '1'
  ? '/weighted-curve.barocad' : '/two-surfaces.barocad';
const source = await (await fetch(sourcePath)).text();
viewer.loadNative(source, { sourceVersion: 0, countU: 8, countV: 8 });
const refs = viewer.getState().surfaces;
const curveIds = viewer.getState().native.model.objects.filter(object => object.kind === 'curve')
  .map(curve => curve.id);
for (const id of ['first-surface', 'second-surface', 'mixed-surface']) {
  const select = document.querySelector(`#${id}`);
  for (const ref of refs) select.add(new Option(ref.surfaceId, ref.surfaceId));
}
document.querySelector('#second-surface').value = refs[1]?.surfaceId ?? refs[0].surfaceId;
document.querySelector('#mixed-surface').value = refs[1]?.surfaceId ?? refs[0].surfaceId;
for (const id of ['first-curve', 'second-curve', 'mixed-curve']) {
  const select = document.querySelector(`#${id}`);
  for (const curveId of curveIds) select.add(new Option(curveId, curveId));
}
let nextPick = null;

function parameter(slot) {
  return { modelId: viewer.getState().native.model.name,
    surfaceId: document.querySelector(`#${slot}-surface`).value,
    u: document.querySelector(`#${slot}-u`).valueAsNumber,
    v: document.querySelector(`#${slot}-v`).valueAsNumber };
}
function curveParameter(slot) {
  return { modelId: viewer.getState().native.model.name,
    curveId: document.querySelector(`#${slot}-curve`).value,
    t: document.querySelector(`#${slot}-t`).valueAsNumber };
}

function describe(extra = '') {
  const state = viewer.getState();
  stateElement.dataset.camera = JSON.stringify(state.camera);
  stateElement.dataset.selectedGeometry = JSON.stringify(state.selectedGeometry);
  stateElement.textContent = [
    `Status: ${state.status}`,
    `Model: ${state.native?.model.name ?? 'none'}`,
    `Surfaces: ${state.surfaces.map(ref => ref.surfaceId).join(', ')}`,
    `Curves retained, not drawn: ${state.native?.unrenderedCurveIds.join(', ') ?? 'none'}`,
    `Selected: ${state.selected?.surfaceId ?? 'none'}`,
    `Camera eye: ${state.camera.eye.map(n => n.toFixed(3)).join(', ')}`,
    `Native point distance (mm): ${state.measurement?.distanceMM.toFixed(6) ?? 'none'}`,
    `Native Curve chord distance (mm): ${state.curveMeasurement?.distanceMM.toFixed(6) ?? 'none'}`,
    `Native Surface-to-Curve distance (mm): ${state.surfaceCurveMeasurement?.distanceMM.toFixed(6) ?? 'none'}`,
    `Latest typed native distance (mm): ${state.nativeMeasurement?.distanceMM.toFixed(6) ?? 'none'}`,
    extra,
  ].join('\n');
}
describe();
const pointerErrors = [];
const controls = viewer.attachPointerControls({ onError: error => {
  pointerErrors.push(error.message);
  stateElement.textContent = `Pointer controls rejected: ${error.message}`;
} });
const keyboardErrors = [];
let keyboardControls = viewer.attachKeyboardControls({ onError: error => {
  keyboardErrors.push(error.message);
  stateElement.textContent = `Keyboard controls rejected: ${error.message}`;
} });
canvas.addEventListener('keydown', event => {
  stateElement.dataset.lastKey = event.key;
  stateElement.dataset.lastKeyDefaultPrevented = String(event.defaultPrevented);
  if (event.defaultPrevented) describe(`Canvas key ${event.key} accepted.`);
});
canvas.addEventListener('pointerup', () => describe('Pointer input ended.'));
canvas.addEventListener('wheel', () => describe('Wheel input received.'), { passive: true });
function measureTyped(first, second) {
  try {
    const result = viewer.measureNativePoints(first, second);
    describe(`Typed ${result.first.kind} → ${result.second.kind} XYZ (mm): ${result.first.pointMM.map(n => n.toFixed(3)).join(', ')} → ${result.second.pointMM.map(n => n.toFixed(3)).join(', ')} · straight line · ${result.certification}`);
  } catch (error) {
    describe(`Typed native distance rejected: ${error.message}`);
  }
}

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
document.querySelector('#measure-typed-surfaces').addEventListener('click', () => {
  measureTyped({ kind: 'surface', ...parameter('first') },
    { kind: 'surface', ...parameter('second') });
});
document.querySelector('#measure-curve').addEventListener('click', () => {
  try {
    const result = viewer.measureNativeCurvePoints(curveParameter('first'), curveParameter('second'));
    describe(`Native Curve XYZ (mm): ${result.first.pointMM.map(n => n.toFixed(3)).join(', ')} → ${result.second.pointMM.map(n => n.toFixed(3)).join(', ')} · straight chord · ${result.certification}`);
  } catch (error) {
    describe(`Curve chord rejected: ${error.message}`);
  }
});
document.querySelector('#measure-typed-curves').addEventListener('click', () => {
  measureTyped({ kind: 'curve', ...curveParameter('first') },
    { kind: 'curve', ...curveParameter('second') });
});
document.querySelector('#measure-mixed').addEventListener('click', () => {
  try {
    const result = viewer.measureNativeSurfaceCurvePoints(parameter('mixed'), curveParameter('mixed'));
    describe(`Native Surface-to-Curve XYZ (mm): ${result.surface.pointMM.map(n => n.toFixed(3)).join(', ')} → ${result.curve.pointMM.map(n => n.toFixed(3)).join(', ')} · straight line · ${result.certification}`);
  } catch (error) {
    describe(`Surface-to-Curve distance rejected: ${error.message}`);
  }
});
document.querySelector('#measure-typed').addEventListener('click', () => {
  const surface = { kind: 'surface', ...parameter('mixed') };
  const curve = { kind: 'curve', ...curveParameter('mixed') };
  if (document.querySelector('#typed-order').value === 'curve-surface') measureTyped(curve, surface);
  else measureTyped(surface, curve);
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

window.viewerDemo = { viewer, controls, pointerErrors, keyboardControls, keyboardErrors, source, sourcePath,
  describe, createViewer, parameter, curveParameter };

if (keyboardProofMode) {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const same = (first, second) => JSON.stringify(first) === JSON.stringify(second);
  const pixelHash = async () => (await viewer.readPixels()).reduce((value, byte) =>
    Math.imul(value ^ byte, 16777619) >>> 0, 2166136261);
  const send = (key, flags = {}) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...flags });
    canvas.dispatchEvent(event);
    return event.defaultPrevented;
  };
  try {
    viewer.fit();
    const fitted = viewer.getState().camera, fittedPixels = await pixelHash();
    viewer.orbit(0.4, 0.12);
    assert(send('f') && same(viewer.getState().camera, fitted)
      && await pixelHash() === fittedPixels, 'Focused fit did not restore the direct camera and pixels');
    viewer.selectGeometry({ kind: 'surface', ...refs[0] });
    const selectedPixels = await pixelHash();
    assert(send('Escape') && viewer.getState().selectedGeometry === null
      && await pixelHash() !== selectedPixels && viewer.getState().native.source === source,
    'Escape did not clear selection while preserving source');
    const stable = viewer.getState(), stablePixels = await pixelHash();
    for (const [key, flags] of [
      ['f', { shiftKey: true }], ['f', { ctrlKey: true }], ['f', { repeat: true }],
      ['f', { isComposing: true }], ['q', {}],
    ]) assert(!send(key, flags) && same(viewer.getState(), stable) && await pixelHash() === stablePixels,
      `Ignored key ${key} changed accepted Viewer state`);
    const inputEvent = new KeyboardEvent('keydown', { key: 'f', bubbles: true, cancelable: true });
    document.querySelector('#first-u').dispatchEvent(inputEvent);
    assert(!inputEvent.defaultPrevented && same(viewer.getState(), stable),
      'Input-target key changed Viewer state');
    keyboardControls.dispose(); keyboardControls.dispose();
    viewer.orbit(0.2, 0);
    const detached = viewer.getState(), detachedPixels = await pixelHash();
    assert(!send('f') && same(viewer.getState(), detached) && await pixelHash() === detachedPixels,
      'Disposed keyboard adapter handled a key');
    keyboardControls = viewer.attachKeyboardControls({ onError: error => keyboardErrors.push(error.message) });
    window.viewerDemo.keyboardControls = keyboardControls;
    viewer.clear();
    const blank = viewer.getState(), blankPixels = await pixelHash();
    assert(!send('f') && keyboardErrors.length === 1
      && same(viewer.getState(), blank) && await pixelHash() === blankPixels,
    'Empty fit did not report and retain the accepted blank scene');
    viewer.loadNative(source, { sourceVersion: 0, countU: 8, countV: 8 });
    viewer.dispose();
    const disposed = viewer.getState();
    assert(!send('f') && keyboardErrors.length === 1 && same(viewer.getState(), disposed),
      'Disposed Viewer handled a canvas key');
    const result = { ok: true, sourcePath, fitted, fittedPixels, selectedPixels,
      ignored: ['shift', 'ctrl', 'repeat', 'composing', 'other', 'input', 'adapter-disposed'],
      errors: keyboardErrors, status: viewer.getState().status };
    stateElement.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    viewer.dispose();
    stateElement.textContent = JSON.stringify({ ok: false, error: error.stack || error.message }, null, 2);
  }
}
