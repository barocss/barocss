import { createViewer } from '../../packages/barocss-viewer/dist/index.js';
import { loadBaroCadModelSet } from '../../packages/barocss-cad-interop/dist/model-set.js';
import { compileMeshMaterial } from '../../packages/barocss-gpu/dist/index.js';

const assert = (value, message) => { if (!value) throw new Error(message); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hash = bytes => bytes.reduce((value, byte) => Math.imul(value ^ byte, 16777619) >>> 0, 2166136261);
const canvas = document.querySelector('#view'), status = document.querySelector('#status');
const errors = [];
window.addEventListener('error', event => errors.push(event.message));
window.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
const leftSource = '@shader #left { @uniform timeSeconds: float(0,2,0); '
  + '@fragment { color: mix(#204080,#E08020,sin(timeSeconds*1.5707963267948966)*0.5+0.5); } }';
const rightSource = '@shader #right { @fragment { color: #30C0A0; } }';
const leftRGB = time => {
  const a = [32, 64, 128].map(value => Math.pow(value / 255, 2.2));
  const b = [224, 128, 32].map(value => Math.pow(value / 255, 2.2));
  const t = (Math.sin(time * Math.PI / 2) + 1) / 2;
  return a.map((value, index) => Math.round(Math.pow(a[index] * (1 - t) + b[index] * t, 1 / 2.2) * 255));
};
const rightRGB = [48, 192, 160];
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
const retained = async (viewer, action, label) => {
  const state = viewer.getState(), pixels = hash(await viewer.readPixels());
  let refused = false;
  try { action(); } catch { refused = true; }
  assert(refused && same(viewer.getState(), state) && hash(await viewer.readPixels()) === pixels,
    `${label} changed accepted state or pixels`);
};
const wide = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 1,
  curveDisplay: { version: 1, chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16 } };
let viewer;
try {
  const set = await loadBaroCadModelSet({ format: 'barocad-model-set', version: 0, entries: [
    { aliasId: 'asset_a', url: 'model-a.barocad', options: wide },
    { aliasId: 'asset-b', url: 'model-b.barocad', options: wide },
  ] }, { baseURL: location.href });
  const leftMaterial = compileMeshMaterial(leftSource), rightMaterial = compileMeshMaterial(rightSource);
  assert(leftMaterial.ok && rightMaterial.ok, 'Host material compilation failed');
  const leftBinding = timeSeconds => ({ material: leftMaterial.material, uniforms: { timeSeconds } });
  const rightBinding = { material: rightMaterial.material, uniforms: {} };
  viewer = await createViewer(canvas, { mmToSceneUnit: 0.05, background: [0.015, 0.02, 0.03],
    lighting: { ambientStrength: 1, directionalStrength: 0, direction: [0, 0, 1] } });
  viewer.loadModelSet(set);
  const initial = viewer.getState(), [left, right] = initial.surfaces, [curveA, curveB] = initial.curves;
  assert(initial.surfaces.length === 2 && initial.curves.length === 2
    && left.surfaceId === right.surfaceId && curveA.curveId === curveB.curveId
    && left.modelId !== right.modelId, 'Four qualified original-ID objects missing');
  const refs = [...initial.curves.map(ref => ({ kind: 'curve', ...ref })),
    ...initial.surfaces.map(ref => ({ kind: 'surface', ...ref }))];
  const poses = refs.map((ref, index) => ({ targetId: `object-${index}`,
    translation: [ref.modelId === 'asset_a' ? -18 : 18, 0, 0] }));
  const bindings = refs.map((ref, index) => ({ contextId: 'two-files', targetId: `object-${index}`, ref }));
  viewer.applyGeometryMotionFrame({ contextId: 'two-files', timeSeconds: 1, poses }, bindings,
    { basis: 'part-xyz-matches-rhyup' });
  viewer.fit();
  const source = initial.modelSet.entries.map(entry => entry.result.source);
  const nativeDistance = [curveA, curveB].map(ref => viewer.measureNativeCurvePoints(
    { ...ref, t: 0 }, { ...ref, t: 1 }).distanceMM);
  const defaultPixels = await viewer.readPixels();
  viewer.setSurfaceMaterial(left, leftBinding(0));
  const leftOnly = await viewer.readPixels();
  viewer.setSurfaceMaterial(right, rightBinding);
  const state0 = viewer.getState();
  assert(state0.surfaceMaterials.length === 2 && state0.surfaceMaterial === null,
    'Two qualified Surface bindings are not copied');
  // The WebGPU Viewer lights material colours, so each probe is a pixel its own binding changed.
  const pixels0 = await viewer.readPixels(), leftProbe = changedProbe(leftOnly, defaultPixels);
  const rightProbe = changedProbe(pixels0, leftOnly);
  assert(leftProbe !== rightProbe && pixels0.slice(leftProbe, leftProbe + 4).every((value, index) =>
    value === leftOnly[leftProbe + index]), 'Right material changed the left material pixels');
  const hits = new Map();
  for (let y = 6; y < canvas.height && hits.size < 4; y += 5) {
    for (let x = 6; x < canvas.width && hits.size < 4; x += 5) {
      const hit = viewer.pickGeometry({ xCss: x, yCss: y }, { curveTolerancePx: 4 });
      if (hit) hits.set(`${hit.kind}:${hit.ref.modelId}`, hit);
    }
  }
  assert(hits.size === 4, `Expected four qualified screen hits, got ${[...hits.keys()].join(', ')}`);
  const curve = { kind: 'curve', ...hits.get('curve:asset.b').ref };
  const beforeSelect = hash(pixels0);
  viewer.selectGeometry(curve);
  const selectedPixels = await viewer.readPixels();
  assert(viewer.getState().selectedGeometry?.kind === 'curve' && viewer.getState().selected === null
    && hash(selectedPixels) !== beforeSelect && viewer.getState().surfaceMaterials.length === 2,
    'Curve selection/highlight dropped Surface materials');
  assert(selectedPixels.slice(leftProbe, leftProbe + 4).every((value, index) => value === pixels0[leftProbe + index])
    && selectedPixels.slice(rightProbe, rightProbe + 4).every((value, index) => value === pixels0[rightProbe + index]),
    'Curve selection changed Surface material pixels');
  await retained(viewer, () => viewer.select(left), 'Bound Surface selection');
  await retained(viewer, () => viewer.setVisibleGeometry(refs.filter(ref =>
    !(ref.kind === 'surface' && ref.modelId === right.modelId))), 'Bound Surface hiding');
  await retained(viewer, () => viewer.setSurfaceMaterial({ modelId: curve.modelId,
    surfaceId: curve.curveId }, leftBinding(0)), 'Curve target material');
  await retained(viewer, () => viewer.setSurfaceMaterial({ ...left, modelId: 'foreign' }, leftBinding(0)),
    'Unknown qualified alias');
  await retained(viewer, () => viewer.setSurfaceMaterial(left, leftBinding(3)), 'Invalid uniform');
  const forged = structuredClone(leftMaterial.material);
  forged.expression.args[0].linear[0] = 0.9;
  await retained(viewer, () => viewer.setSurfaceMaterial(left, { material: forged,
    uniforms: { timeSeconds: 1 } }), 'Forged IR');
  await retained(viewer, () => viewer.loadModelSet({ ...set, entries: [] }), 'Invalid replacement');
  viewer.selectGeometry(null);
  assert(hash(await viewer.readPixels()) === beforeSelect, 'Curve deselection did not restore material scene');
  viewer.setSurfaceMaterial(left, leftBinding(1));
  const pixels1 = await viewer.readPixels();
  assert([0, 1, 2].every(channel => Math.sign(pixels1[leftProbe + channel] - pixels0[leftProbe + channel])
    === Math.sign(leftRGB(1)[channel] - leftRGB(0)[channel]))
    && pixels1.slice(rightProbe, rightProbe + 4).every((value, index) => value === pixels0[rightProbe + index]),
    'One Surface uniform changed the other material');
  viewer.setVisibleGeometry(refs.filter(ref => !(ref.kind === 'curve' && ref.modelId === curve.modelId)));
  assert(viewer.getState().surfaceMaterials.length === 2 && viewer.getState().visibleGeometry.length === 3,
    'Curve hide dropped Surface materials');
  viewer.setVisibleGeometry(refs);
  viewer.fitGeometry(curve);
  viewer.fit(); viewer.orbit(0.03, 0.01); viewer.pan(0.01, 0); viewer.zoom(1.03);
  viewer.resize(800, 480);
  viewer.applyGeometryMotionFrame({ contextId: 'two-files', timeSeconds: 2,
    poses: poses.map((pose, index) => ({ ...pose, translation: [pose.translation[0], index, 0] })) },
  bindings, { basis: 'part-xyz-matches-rhyup' });
  assert(viewer.getState().surfaceMaterials.length === 2 && viewer.getState().curves.length === 2,
    'Camera, Curve fit or pose dropped mixed scene bindings');
  assert(same(viewer.getState().modelSet.entries.map(entry => entry.result.source), source)
    && same([curveA, curveB].map(ref => viewer.measureNativeCurvePoints(
      { ...ref, t: 0 }, { ...ref, t: 1 }).distanceMM), nativeDistance)
    && same(viewer.getState().packets, initial.packets),
    'Material changed native source, original packets or measurements');
  viewer.setSurfaceMaterial(left, null);
  assert(viewer.getState().surfaceMaterials.length === 1
    && viewer.getState().surfaceMaterial?.ref.modelId === right.modelId,
    'Per-target clear changed the other binding');
  viewer.select(left);
  await retained(viewer, () => viewer.setSurfaceMaterial(left, leftBinding(0)),
    'Selected Surface material target');
  viewer.select(null);
  viewer.setVisibleGeometry(refs.filter(ref =>
    !(ref.kind === 'surface' && ref.modelId === left.modelId)));
  await retained(viewer, () => viewer.setSurfaceMaterial(left, leftBinding(0)),
    'Hidden Surface material target');
  viewer.setVisibleGeometry(refs);
  viewer.loadModelSet(set);
  assert(viewer.getState().surfaceMaterials.length === 0, 'Replacement retained old bindings');
  viewer.setSurfaceMaterial(left, leftBinding(0));
  viewer.clear();
  assert(viewer.getState().status === 'empty' && viewer.getState().surfaceMaterials.length === 0,
    'Clear retained material state');
  viewer.loadNative(source[0], { sourceVersion: 0, countU: 8, countV: 8 });
  await retained(viewer, () => viewer.setSurfaceMaterial(viewer.getState().surfaces[0], leftBinding(0)),
    'Legacy native scene material admission');
  viewer.dispose(); viewer.dispose();
  assert(viewer.getState().status === 'disposed', 'Viewer did not dispose');
  assert(errors.length === 0, `Browser errors: ${errors.join(', ')}`);
  const result = { ok: true, aliases: [left.modelId, right.modelId], originalIDs: {
    surface: left.surfaceId, curve: curveA.curveId }, expected: { left0: leftRGB(0),
    left1: leftRGB(1), right: rightRGB }, actual: {
    left0: Array.from(pixels0.slice(leftProbe, leftProbe + 4)),
    left1: Array.from(pixels1.slice(leftProbe, leftProbe + 4)),
    right: Array.from(pixels1.slice(rightProbe, rightProbe + 4)) },
  hits: [...hits.keys()], hashes: { both: beforeSelect, selected: hash(selectedPixels) },
  nativeDistanceMM: nativeDistance, errors,
  limits: 'Two source0 aliases, two Surfaces and two Curves. Local Chromium WebGPU only; Surface materials, no Curve shader or selected-material overlay.' };
  window.viewerMixedMaterialProof = result;
  status.textContent = JSON.stringify(result, null, 2);
  const recorded = await fetch('/result', { method: 'POST', body: JSON.stringify(result) });
  assert(recorded.ok, 'Browser result was not recorded');
} catch (error) {
  viewer?.dispose();
  const result = { ok: false, error: error.stack || error.message, errors };
  window.viewerMixedMaterialProof = result;
  status.textContent = JSON.stringify(result, null, 2);
  try { await fetch('/result', { method: 'POST', body: JSON.stringify(result) }); } catch { /* server failed */ }
}
