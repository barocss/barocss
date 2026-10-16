import { createViewer } from '../../packages/barocss-viewer/dist/index.js';
import { loadBaroCadModelSet } from '../../packages/barocss-cad-interop/dist/model-set.js';
import { compileMeshMaterial } from '../../packages/barocss-gpu/dist/index.js';

const assert = (value, message) => { if (!value) throw new Error(message); };
const hash = bytes => bytes.reduce((value, byte) => Math.imul(value ^ byte, 16777619) >>> 0, 2166136261);
const same = (first, second) => JSON.stringify(first) === JSON.stringify(second);
const canvas = document.querySelector('#view'), status = document.querySelector('#status');
const errors = [];
window.addEventListener('error', event => errors.push(event.message));
window.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
// A pixel of the most common colour among the pixels that differ between two captures (an interior one).
const changedProbe = (a, b) => {
  const counts = new Map();
  for (let index = 0; index < a.length; index += 4) {
    if (![0, 1, 2, 3].some(channel => a[index + channel] !== b[index + channel])) continue;
    const key = a.slice(index, index + 4).join(), row = counts.get(key);
    if (row) row.count++; else counts.set(key, { index, count: 1 });
  }
  const best = [...counts.values()].reduce((top, row) => row.count > top.count ? row : top, { index: -1, count: 0 });
  if (best.index < 0 || a[best.index + 3] !== 255) throw new Error('Material changed no opaque Surface pixel');
  return best.index;
};
const samePixel = (a, b, index) => [0, 1, 2, 3].every(channel => a[index + channel] === b[index + channel]);
// Each RGB channel moved the way the expected material colour moved.
const towards = (before, after, index, from, to) => [0, 1, 2].every(channel =>
  Math.sign(after[index + channel] - before[index + channel]) === Math.sign(to[channel] - from[channel]));
const retained = async (viewer, action, label) => {
  const state = viewer.getState(), pixels = hash(await viewer.readPixels());
  let refused = false;
  try { action(); } catch { refused = true; }
  assert(refused && same(viewer.getState(), state) && hash(await viewer.readPixels()) === pixels,
    `${label} changed accepted state or pixels`);
};
const leftSource = '@shader #left { @uniform timeSeconds: float(0,2,0); '
  + '@fragment { color: mix(#204080,#E08020,sin(timeSeconds*1.5707963267948966)*0.5+0.5); } }';
const rightSource = '@shader #right { @fragment { color: #30C0A0; } }';
const leftRGB = time => {
  const first = [32, 64, 128].map(value => Math.pow(value / 255, 2.2));
  const second = [224, 128, 32].map(value => Math.pow(value / 255, 2.2));
  const ratio = (Math.sin(time * Math.PI / 2) + 1) / 2;
  return first.map((value, index) => Math.round(Math.pow(
    value * (1 - ratio) + second[index] * ratio, 1 / 2.2) * 255));
};
const rightRGB = [48, 192, 160];

let viewer;
try {
  const set = await loadBaroCadModelSet({ format: 'barocad-model-set', version: 0, entries: [
    { aliasId: 'left_asset', url: 'left.barocad',
      options: { sourceVersion: 0, countU: 5, countV: 5, unitsPerMillimeter: 1 } },
    { aliasId: 'right-asset', url: 'right.barocad',
      options: { sourceVersion: 0, countU: 5, countV: 5, unitsPerMillimeter: 1 } },
  ] }, { baseURL: location.href });
  const leftCompiled = compileMeshMaterial(leftSource), rightCompiled = compileMeshMaterial(rightSource);
  assert(leftCompiled.ok && rightCompiled.ok, 'Host material compilation failed');
  const leftBinding = timeSeconds => ({ material: leftCompiled.material, uniforms: { timeSeconds } });
  const rightBinding = { material: rightCompiled.material, uniforms: {} };
  viewer = await createViewer(canvas, { mmToSceneUnit: 0.001, background: [0.035, 0.065, 0.105],
    lighting: { ambientStrength: 1, directionalStrength: 0, direction: [0, 0, 1] } });
  viewer.loadModelSet(set);
  const initial = viewer.getState(), [left, right] = initial.surfaces;
  assert(initial.surfaces.length === 2 && initial.curves.length === 0
    && left.surfaceId === right.surfaceId && left.modelId !== right.modelId,
    'Two distinct qualified Surfaces with the same original ID are required');
  const sources = set.entries.map(entry => entry.result.source);
  const nativePoint = ref => viewer.measureNativeSurfacePoints(
    { ...ref, u: 0, v: 0 }, { ...ref, u: 1, v: 1 });
  const measurements = [nativePoint(left), nativePoint(right)];
  const originalCamera = viewer.getState().camera, defaultPixels = await viewer.readPixels();
  const defaultHash = hash(defaultPixels);

  const caller = leftBinding(0);
  viewer.setSurfaceMaterial(left, caller);
  caller.uniforms.timeSeconds = 2;
  assert(viewer.getState().surfaceMaterial?.ref.modelId === left.modelId
    && viewer.getState().surfaceMaterials.length === 1
    && viewer.getState().surfaceMaterials[0].binding.uniforms.timeSeconds === 0,
    'One-binding compatibility or caller copy failed');
  viewer.select(right);
  assert(viewer.getState().selected?.modelId === right.modelId
    && viewer.getState().surfaceMaterials.length === 1,
    'Unbound Surface selection lost the other material');
  viewer.select(null);
  viewer.setVisibleGeometry([{ kind: 'surface', ...left }]);
  assert(viewer.getState().visibleGeometry.length === 1
    && viewer.getState().surfaceMaterials.length === 1,
    'Hiding unbound Surface lost the other material');
  viewer.setVisibleGeometry([{ kind: 'surface', ...left }, { kind: 'surface', ...right }]);
  const leftOnly = await viewer.readPixels();
  viewer.setSurfaceMaterial(right, rightBinding);
  const both = viewer.getState();
  assert(both.surfaceMaterial === null && both.surfaceMaterials.length === 2
    && both.surfaceMaterials[0].ref.modelId === left.modelId
    && both.surfaceMaterials[1].ref.modelId === right.modelId,
    'Complete qualified material query is missing or unordered');
  // The WebGPU Viewer lights material colours, so each probe is a pixel its own binding changed.
  const pixels0 = await viewer.readPixels(), leftProbe = changedProbe(leftOnly, defaultPixels);
  const rightProbe = changedProbe(pixels0, leftOnly);
  assert(leftProbe !== rightProbe && samePixel(pixels0, leftOnly, leftProbe),
    'Right material changed the left material pixels');
  const copy = viewer.getState().surfaceMaterials;
  copy[1].binding.material.shaderId = 'changed';
  assert(viewer.getState().surfaceMaterials[1].binding.material.shaderId === 'right',
    'Multi-material query exposes mutable accepted state');

  await retained(viewer, () => viewer.select(left), 'Bound left selection');
  await retained(viewer, () => viewer.selectGeometry({ kind: 'surface', ...right }), 'Bound right selection');
  await retained(viewer, () => viewer.setVisibleGeometry([{ kind: 'surface', ...left }]), 'Bound right hiding');
  await retained(viewer, () => viewer.setSurfaceMaterial({ ...left, modelId: 'foreign' }, leftBinding(1)),
    'Wrong qualified alias');
  await retained(viewer, () => viewer.setSurfaceMaterial(left, leftBinding(3)), 'Out-of-range uniform');
  const forged = structuredClone(leftCompiled.material);
  forged.expression.args[0].linear[0] = 0.9;
  await retained(viewer, () => viewer.setSurfaceMaterial(left, { material: forged,
    uniforms: { timeSeconds: 1 } }), 'Forged material IR');
  await retained(viewer, () => viewer.loadModelSet({ ...set, entries: [] }), 'Invalid scene replacement');

  viewer.setSurfaceMaterial(left, leftBinding(1));
  const pixels1 = await viewer.readPixels();
  assert(towards(pixels0, pixels1, leftProbe, leftRGB(0), leftRGB(1))
    && pixels1.slice(rightProbe, rightProbe + 4).every((value, index) => value === pixels0[rightProbe + index]),
    'Left uniform change altered the right material pixels');
  const acceptedHash = hash(pixels1);
  viewer.orbit(0.04, 0.02); viewer.pan(0.01, 0); viewer.zoom(1.05);
  viewer.fitGeometry({ kind: 'surface', ...left }); viewer.fit();
  viewer.resize(480, 360); viewer.resize(640, 480);
  viewer.applyGeometryMotionFrame({ contextId: 'two_materials', timeSeconds: 0,
    poses: [{ targetId: 'left', translation: [50, 0, 0] }, { targetId: 'right' }] },
  [{ contextId: 'two_materials', targetId: 'left', ref: { kind: 'surface', ...left } },
    { contextId: 'two_materials', targetId: 'right', ref: { kind: 'surface', ...right } }],
  { basis: 'part-xyz-matches-rhyup' });
  assert(viewer.getState().surfaceMaterials.length === 2, 'Camera or pose dropped bindings');
  viewer.resetMotion(); viewer.setView(originalCamera);
  assert(hash(await viewer.readPixels()) === acceptedHash,
    'Camera/pose/resize round-trip changed two-material pixels');
  assert(same(viewer.getState().modelSet.entries.map(entry => entry.result.source), sources)
    && same([nativePoint(left), nativePoint(right)], measurements)
    && same(viewer.getState().packets, initial.packets),
    'Materials changed original sources, IDs/UV packets or measurements');

  viewer.setSurfaceMaterial(left, null);
  const one = viewer.getState(), pixelsRight = await viewer.readPixels();
  assert(one.surfaceMaterials.length === 1 && one.surfaceMaterial?.ref.modelId === right.modelId
    && pixelsRight.slice(rightProbe, rightProbe + 4).every((value, index) =>
      value === pixels1[rightProbe + index]),
    'Clearing one binding changed the other material');
  viewer.select(left); viewer.select(null);
  viewer.setVisibleGeometry([{ kind: 'surface', ...right }]);
  viewer.setVisibleGeometry([{ kind: 'surface', ...left }, { kind: 'surface', ...right }]);
  viewer.setSurfaceMaterial(left, leftBinding(1));
  viewer.loadModelSet(set);
  assert(viewer.getState().surfaceMaterials.length === 0
    && viewer.getState().surfaceMaterial === null && hash(await viewer.readPixels()) === defaultHash,
    'Successful replacement retained old qualified material bindings');
  viewer.setSurfaceMaterial(left, leftBinding(1));
  viewer.clear();
  assert(viewer.getState().surfaceMaterials.length === 0 && viewer.getState().status === 'empty',
    'Viewer clear retained material bindings');
  viewer.loadNative(sources[0], { sourceVersion: 0, countU: 5, countV: 5 });
  await retained(viewer, () => viewer.setSurfaceMaterial(viewer.getState().surfaces[0], leftBinding(1)),
    'Legacy scene material admission');
  viewer.loadModelSet(set);
  viewer.setSurfaceMaterial(left, leftBinding(1));
  viewer.dispose(); viewer.dispose();
  assert(viewer.getState().status === 'disposed' && viewer.getState().surfaceMaterials.length === 0,
    'Disposal retained material bindings');
  assert(errors.length === 0, `Browser errors: ${errors.join(', ')}`);
  const result = { ok: true, originalSurfaceId: left.surfaceId,
    aliases: [left.modelId, right.modelId], expected: { left0: leftRGB(0), left1: leftRGB(1), right: rightRGB },
    actual: { left0: Array.from(pixels0.slice(leftProbe, leftProbe + 4)),
      left1: Array.from(pixels1.slice(leftProbe, leftProbe + 4)),
      right: Array.from(pixels1.slice(rightProbe, rightProbe + 4)) },
    hashes: { default: defaultHash, both0: hash(pixels0), both1: acceptedHash },
    measurementMM: measurements.map(value => value.distanceMM), errors,
    limits: 'Two source0 Surfaces with one shared original ID and distinct aliases. Local Chromium WebGPU only; no Curve material, overlay, performance or publication claim.' };
  window.viewerMultiMaterialProof = result;
  status.textContent = JSON.stringify(result, null, 2);
  const recorded = await fetch('/result', { method: 'POST', body: JSON.stringify(result) });
  assert(recorded.ok, 'Browser result was not recorded');
} catch (error) {
  viewer?.dispose();
  const result = { ok: false, error: error.stack || error.message, errors };
  window.viewerMultiMaterialProof = result;
  status.textContent = JSON.stringify(result, null, 2);
  try { await fetch('/result', { method: 'POST', body: JSON.stringify(result) }); } catch { /* server failed */ }
}
