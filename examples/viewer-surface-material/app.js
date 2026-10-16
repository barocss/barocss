import { createViewer } from '../../packages/barocss-viewer/dist/index.js';
import { loadBaroCadModelSet } from '../../packages/barocss-cad-interop/dist/model-set.js';
import { createFluidWorld } from '../../packages/barocss-physics/dist/fluid.js';
import { compileMeshMaterial } from '../../packages/barocss-gpu/dist/index.js';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const hash = bytes => bytes.reduce((value, byte) => Math.imul(value ^ byte, 16777619) >>> 0, 2166136261);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const canvas = document.querySelector('#view'), status = document.querySelector('#status');
const errors = [];
window.addEventListener('error', event => errors.push(event.message));
window.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
const materialSource = '@shader #wave { @uniform timeSeconds: float(0,2,0); '
  + '@fragment { color: mix(#204080,#E08020,sin(timeSeconds*1.5707963267948966)*0.5+0.5); } }';
const expectedColor = time => {
  const first = [32, 64, 128].map(value => Math.pow(value / 255, 2.2));
  const second = [224, 128, 32].map(value => Math.pow(value / 255, 2.2));
  const ratio = (Math.sin(time * Math.PI / 2) + 1) / 2;
  return first.map((value, index) => Math.round(Math.pow(
    value * (1 - ratio) + second[index] * ratio, 1 / 2.2) * 255));
};
// A pixel of the most common colour among the pixels that differ between two captures (an interior one).
const changedProbe = (a, b) => {
  const counts = new Map();
  for (let index = 0; index < a.length; index += 4) {
    if (![0, 1, 2, 3].some(channel => a[index + channel] !== b[index + channel])) continue;
    const key = a.slice(index, index + 4).join(), row = counts.get(key);
    if (row) row.count++; else counts.set(key, { index, count: 1 });
  }
  return [...counts.values()].reduce((best, row) => row.count > best.count ? row : best, { index: -1, count: 0 }).index;
};
const cyanPixels = pixels => {
  let count = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index] < 60 && pixels[index + 1] > 160 && pixels[index + 2] > 245) count++;
  }
  return count;
};
const retained = async (viewer, action, label) => {
  const state = viewer.getState(), pixels = hash(await viewer.readPixels());
  let refused = false;
  try { action(); } catch { refused = true; }
  assert(refused && equal(viewer.getState(), state) && hash(await viewer.readPixels()) === pixels,
    `${label} changed accepted Viewer state or pixels`);
};

let viewer, world;
try {
  const set = await loadBaroCadModelSet({ format: 'barocad-model-set', version: 0, entries: [
    { aliasId: 'material_surface', url: 'occluder.barocad',
      options: { sourceVersion: 0, countU: 5, countV: 5, unitsPerMillimeter: 1 } },
  ] }, { baseURL: location.href });
  const compiled = compileMeshMaterial(materialSource);
  assert(compiled.ok && compiled.material, 'Host material source did not compile');
  const material = compiled.material;
  viewer = await createViewer(canvas, { mmToSceneUnit: 0.001, background: [0.035, 0.065, 0.105],
    lighting: { ambientStrength: 1, directionalStrength: 0, direction: [0, 0, 1] } });
  viewer.loadModelSet(set);
  const initial = viewer.getState(), ref = initial.surfaces[0];
  assert(initial.modelSet && initial.surfaces.length === 1 && initial.curves.length === 0,
    'One qualified native Surface is required');
  const source = set.entries[0].result.source;
  const measurement = viewer.measureNativeSurfacePoints({ ...ref, u: 0, v: 0 }, { ...ref, u: 1, v: 1 });
  const nativeSnapshot = { source: viewer.getState().modelSet.entries[0].result.source,
    packet: viewer.getState().packets[0].packet, pointMM: measurement.first.pointMM,
    distanceMM: measurement.distanceMM };
  const defaultPixels = await viewer.readPixels(), defaultHash = hash(defaultPixels);
  const originalCamera = viewer.getState().camera;
  const binding = timeSeconds => ({ material, uniforms: { timeSeconds } });
  const colors = [];
  let probe = -1;
  for (const timeSeconds of [0, 1, 2]) {
    viewer.setSurfaceMaterial(ref, binding(timeSeconds));
    const pixels = await viewer.readPixels(), expected = expectedColor(timeSeconds);
    // The WebGPU Viewer lights the material colour, so the probe is a Surface pixel the material changed.
    if (probe < 0) probe = changedProbe(pixels, defaultPixels);
    assert(probe >= 0 && pixels[probe + 3] === 255,
      `Compiled material changed no Surface pixel at caller time ${timeSeconds}`);
    assert(viewer.getState().surfaceMaterial?.binding.uniforms.timeSeconds === timeSeconds,
      'Viewer material query did not copy accepted uniform');
    colors.push({ timeSeconds, expected, actual: Array.from(pixels.slice(probe, probe + 4)),
      pixelHash: hash(pixels) });
  }
  assert(colors[0].pixelHash === colors[2].pixelHash && colors[0].pixelHash !== colors[1].pixelHash,
    'Caller time 0/1/2 did not change independent pixels');
  assert([0, 1, 2].every(channel => Math.sign(colors[1].actual[channel] - colors[0].actual[channel])
    === Math.sign(colors[1].expected[channel] - colors[0].expected[channel])),
  'Caller time 1 did not move the material pixel toward the mixed colour');
  const copied = viewer.getState().surfaceMaterial;
  copied.binding.uniforms.timeSeconds = 0;
  assert(viewer.getState().surfaceMaterial.binding.uniforms.timeSeconds === 2,
    'Material query exposes mutable accepted state');
  const callerBinding = binding(1);
  viewer.setSurfaceMaterial(ref, callerBinding);
  callerBinding.uniforms.timeSeconds = 2;
  assert(viewer.getState().surfaceMaterial?.binding.uniforms.timeSeconds === 1,
    'Caller mutated accepted material binding');
  const acceptedHash = hash(await viewer.readPixels());
  await retained(viewer, () => viewer.select(ref), 'Selected bound Surface');
  await retained(viewer, () => viewer.selectGeometry({ kind: 'surface', ...ref }), 'Tagged selected bound Surface');
  await retained(viewer, () => viewer.setVisibleGeometry([]), 'Hidden bound Surface');
  await retained(viewer, () => viewer.setSurfaceMaterial({ ...ref, surfaceId: 'wrong' }, binding(0)), 'Wrong reference');
  await retained(viewer, () => viewer.setSurfaceMaterial(ref, binding(3)), 'Invalid uniform');
  const forged = structuredClone(material);
  forged.expression.args[0].linear[0] = 0.9;
  await retained(viewer, () => viewer.setSurfaceMaterial(ref, { material: forged,
    uniforms: { timeSeconds: 0 } }), 'Forged IR');
  await retained(viewer, () => viewer.loadModelSet({ ...set, entries: [] }), 'Invalid scene replacement');
  assert(hash(await viewer.readPixels()) === acceptedHash, 'Refusal changed material pixels');

  viewer.orbit(0.04, 0.02);
  assert(viewer.getState().surfaceMaterial?.binding.uniforms.timeSeconds === 1,
    'Orbit dropped Surface material');
  viewer.pan(0.01, 0);
  viewer.zoom(1.05);
  viewer.fitGeometry({ kind: 'surface', ...ref });
  viewer.fit();
  viewer.resize(480, 360);
  viewer.resize(640, 480);
  viewer.applyGeometryMotionFrame({ contextId: 'material_pose', timeSeconds: 0,
    poses: [{ targetId: 'surface', translation: [100, 0, 0] }] },
  [{ contextId: 'material_pose', targetId: 'surface', ref: { kind: 'surface', ...ref } }],
  { basis: 'part-xyz-matches-rhyup' });
  assert(viewer.getState().surfaceMaterial?.binding.uniforms.timeSeconds === 1,
    'Pose or resize dropped Surface material');
  viewer.resetMotion();
  viewer.setView(originalCamera);
  assert(hash(await viewer.readPixels()) === acceptedHash, 'Camera/pose round-trip changed material pixels');

  const initialPositionsM = [];
  for (let z = 0; z < 4; z++) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    initialPositionsM.push([0.2 + x * 0.05, 0.45 + y * 0.05, 0.3 + z * 0.05]);
  }
  world = createFluidWorld({ format: 'barocss-fluid-scene', version: 1,
    revision: 'waterRev1', basis: 'right-handed-xyz-metres', fixedStepSeconds: 1 / 120,
    gravityMps2: [0, -9.81, 0], basinM: [0.7, 1.3, 0.5], initialPositionsM });
  const fluid = world.getState();
  assert(fluid.particleCount === 256 && fluid.positionsM.length === 768,
    'Actual Physics initial state is not 256 particles');
  viewer.setFluidFrame({ version: 0, contextId: 'material_water',
    sceneRevision: fluid.sceneRevision, stepIndex: fluid.stepIndex,
    particleCount: fluid.particleCount, positionsM: fluid.positionsM });
  assert(viewer.getState().surfaceMaterial?.binding.uniforms.timeSeconds === 1
    && viewer.getState().fluidFrame?.particleCount === 256,
    'Material and actual Physics particles did not coexist');
  const occluded = cyanPixels(await viewer.readPixels());
  viewer.applyGeometryMotionFrame({ contextId: 'fluid_depth_pose', timeSeconds: 0,
    poses: [{ targetId: 'surface', translation: [2000, 0, 0] }] },
  [{ contextId: 'fluid_depth_pose', targetId: 'surface', ref: { kind: 'surface', ...ref } }],
  { basis: 'part-xyz-matches-rhyup' });
  const exposed = cyanPixels(await viewer.readPixels());
  assert(exposed > occluded && viewer.getState().fluidFrame?.particleCount === 256
    && viewer.getState().surfaceMaterial?.binding.uniforms.timeSeconds === 1,
    `Shared depth or material retention missing: ${occluded} vs ${exposed}`);
  viewer.resetMotion();
  assert(cyanPixels(await viewer.readPixels()) === occluded, 'Shared depth did not restore after pose');
  viewer.orbit(0.01, 0);
  assert(viewer.getState().surfaceMaterial?.binding.uniforms.timeSeconds === 1
    && viewer.getState().fluidFrame?.particleCount === 256,
    'Atomic camera frame dropped material or particles');
  viewer.setView(originalCamera);
  viewer.setFluidFrame(null);
  assert(viewer.getState().surfaceMaterial?.binding.uniforms.timeSeconds === 1
    && hash(await viewer.readPixels()) === acceptedHash,
    'Particle-only clear dropped material or changed material-only pixels');
  viewer.setSurfaceMaterial(ref, null);
  assert(viewer.getState().surfaceMaterial === null && hash(await viewer.readPixels()) === defaultHash,
    'Explicit material clear did not restore default pixels');
  assert(equal(nativeSnapshot, { source: viewer.getState().modelSet.entries[0].result.source,
    packet: viewer.getState().packets[0].packet,
    pointMM: viewer.measureNativeSurfacePoints({ ...ref, u: 0, v: 0 },
      { ...ref, u: 1, v: 1 }).first.pointMM,
    distanceMM: measurement.distanceMM }),
    'Material changed qualified source, UV/packet or native measurement');
  viewer.select(ref);
  await retained(viewer, () => viewer.setSurfaceMaterial(ref, binding(1)), 'Binding selected Surface');
  viewer.select(null);
  viewer.setSurfaceMaterial(ref, binding(1));
  viewer.loadModelSet(set);
  assert(viewer.getState().surfaceMaterial === null && viewer.getState().fluidFrame === null
    && hash(await viewer.readPixels()) === defaultHash,
    'Scene replacement retained material or changed default pixels');
  viewer.setSurfaceMaterial(ref, binding(1));
  viewer.clear();
  assert(viewer.getState().surfaceMaterial === null && viewer.getState().status === 'empty',
    'Viewer clear retained material');
  viewer.loadNative(source, { sourceVersion: 0, countU: 5, countV: 5 });
  await retained(viewer, () => viewer.setSurfaceMaterial(viewer.getState().surfaces[0], binding(1)),
    'Legacy scene material admission');
  const legacyMeasurement = viewer.measureNativeSurfacePoints(
    { ...viewer.getState().surfaces[0], u: 0, v: 0 },
    { ...viewer.getState().surfaces[0], u: 1, v: 1 });
  assert(source === set.entries[0].result.source
    && equal(measurement.first.pointMM, legacyMeasurement.first.pointMM)
    && measurement.distanceMM === legacyMeasurement.distanceMM,
    'Legacy source or native measurement changed');
  viewer.loadModelSet(set);
  viewer.setSurfaceMaterial(ref, binding(1));
  viewer.dispose(); viewer.dispose(); world.dispose();
  assert(viewer.getState().status === 'disposed' && viewer.getState().surfaceMaterial === null,
    'Disposal retained the material binding');
  assert(errors.length === 0, `Browser errors: ${errors.join(', ')}`);
  const result = { ok: true, colors, defaultHash, materialHash: acceptedHash,
    nativeSourceBytes: source.length, measurementMM: measurement.distanceMM,
    particleCount: fluid.particleCount,
    occlusion: { occludedCyanPixels: occluded, exposedCyanPixels: exposed }, errors,
    limits: 'One qualified native Surface, opaque material and actual 256 Physics particles in local Chromium WebGPU. No texture, PBR, overlay, broad performance or publication claim.' };
  window.viewerMaterialProof = result;
  status.textContent = JSON.stringify(result, null, 2);
  const recorded = await fetch('/result', { method: 'POST', body: JSON.stringify(result) });
  assert(recorded.ok, 'Browser result was not recorded');
} catch (error) {
  viewer?.dispose(); world?.dispose();
  const result = { ok: false, error: error.stack || error.message, errors };
  window.viewerMaterialProof = result;
  status.textContent = JSON.stringify(result, null, 2);
  try { await fetch('/result', { method: 'POST', body: JSON.stringify(result) }); } catch { /* server failed */ }
}
