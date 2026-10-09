import { BaroCADBabylonLoader } from '@barocss/cad-interop/babylon';
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Camera } from '@babylonjs/core/Cameras/camera.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';

const sourceURL = new URL('./linear-geometry-pattern-babylon-data/maximum16_by16_surface_five_instances.barocad', import.meta.url);
const sourceSHA = 'a54583f9011c2bc194e5e559bc75356a75bbc1a30f4cdda670d3e9dc4c28048f';
const ids = ['wide_surface_seed', 'wide_surface_copy_1', 'wide_surface_copy_2', 'wide_surface_copy_3', 'wide_surface_copy_4'];
const options = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
  nativeCapacity: { version: 1, maximumObjects: 16 } };
const canvas = document.querySelector('#canvas');
const engine = new Engine(canvas, false, { preserveDrawingBuffer: true, stencil: true });
engine.setHardwareScalingLevel(1);
const scene = new Scene(engine);
scene.useRightHandedSystem = true;
scene.clearColor = new Color4(16 / 255, 27 / 255, 44 / 255, 1);
const camera = new FreeCamera('caller-camera', new Vector3(0, 0, 0.05), scene);
camera.upVector = new Vector3(0, 1, 0);
camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
camera.minZ = 0.0001; camera.maxZ = 1;
scene.activeCamera = camera;
const light = new HemisphericLight('caller-light', new Vector3(0, 0, 1), scene);
light.intensity = 1.3;
const marker = MeshBuilder.CreateBox('caller-marker', { size: 0.00015 }, scene);
marker.position.set(-0.0005, -0.0013, 0);
const markerMaterial = new StandardMaterial('caller-marker-material', scene);
markerMaterial.emissiveColor = new Color3(1, 0.7, 0.33);
marker.material = markerMaterial;
const callerDisposals = { engine: 0, scene: 0, camera: 0, light: 0, marker: 0, markerMaterial: 0 };
for (const [name, resource] of Object.entries({ engine, scene, camera, light, marker, markerMaterial }))
  resource.onDisposeObservable.add(() => callerDisposals[name]++);
const gl = canvas.getContext('webgl2');
const loader = new BaroCADBabylonLoader(scene, options);
const evidence = { engine: 'Babylon9.29.0', publicEntries: ['@barocss/cad-interop/babylon', '@barocss/cad-interop/native'],
  sourceURL: sourceURL.href, sourceSHA, sourceBytes: 23347, ids, unitsPerMillimeter: 0.001,
  nativeFrame: 'authored XYZ/mm, caller right-handed Y-up; camera +Z/up+Y',
  members: [], refusals: [], disposed: false, glErrors: [] };
window.__baroBabylonSDKEvidence = evidence;
let accepted;
let meshResources = [], materialResources = [];
const requireFact = (fact, message) => { if (!fact) throw new Error(message); };
const same = (a, b) => Object.is(a, b) || (a !== null && b !== null && typeof a === 'object' &&
  typeof b === 'object' && Object.keys(a).length === Object.keys(b).length &&
  Object.keys(a).every(key => Object.hasOwn(b, key) && same(a[key], b[key])));
const sameBuffer = (a, b) => a?.length === b.length && Array.from(a).every((value, i) => Object.is(value, b[i]));
const hash = bytes => bytes.reduce((value, byte) => Math.imul(value ^ byte, 16777619) >>> 0, 2166136261);
function frame() {
  scene.render();
  const bytes = new Uint8Array(800 * 500 * 4);
  gl.readPixels(0, 0, 800, 500, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  const error = gl.getError(); evidence.glErrors.push(error);
  requireFact(error === gl.NO_ERROR, `WebGL error ${error}`);
  return bytes;
}
function changedPixels(a, b) {
  let changed = 0;
  for (let i = 0; i < a.length; i += 4)
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) changed++;
  return changed;
}
function status(message) {
  document.querySelector('#status').textContent = `${message}\nNative Model: wide_surface_pattern\n${ids.join('\n')}\nDisplay scale: 0.001 units/mm`;
}
function fail(error) {
  window.__baroBabylonSDKError = error.stack ?? String(error);
  status(`Failed: ${error.message}`);
  console.error(error);
}
function track(resources) {
  return resources.map(resource => {
    const record = { resource, disposals: 0 };
    resource.onDisposeObservable.add(() => record.disposals++);
    return record;
  });
}
function callerRetained() {
  return !engine.isDisposed && !scene.isDisposed && !camera.isDisposed() && !light.isDisposed() &&
    !marker.isDisposed() && scene.meshes.includes(marker) && scene.activeCamera === camera &&
    scene.lights.includes(light) && scene.materials.includes(markerMaterial) && scene.useRightHandedSystem === true &&
    canvas.isConnected && !gl.isContextLost() && Object.values(callerDisposals).every(value => value === 0);
}
async function load() {
  document.querySelector('#load').disabled = true;
  let next;
  try {
    requireFact(gl instanceof WebGL2RenderingContext, 'WebGL2 required');
    next = await loader.loadAbortable(sourceURL.href, {});
    const bytes = new TextEncoder().encode(next.source);
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
      byte => byte.toString(16).padStart(2, '0')).join('');
    requireFact(bytes.length === 23347 && digest === sourceSHA, 'Complete source bytes changed');
    const neutral = parseBaroCadSource(next.source, options);
    requireFact(same(next.model, neutral.model) && next.model.name === 'wide_surface_pattern' &&
      same(next.model.objects.map(object => object.id), ids) && next.surfaces.length === 5 &&
      next.curves.length === 0 && next.meshes.length === 5, 'Native Model or member order changed');
    requireFact(Object.is(next.model.objects[0].knotsU[0], -0), 'Native signed zero changed');
    evidence.members = next.meshes.map((mesh, index) => {
      const preview = next.surfaces[index], reference = neutral.surfaces[index];
      requireFact(mesh instanceof Mesh && mesh.metadata.barocss.surfaceId === ids[index] &&
        preview.surfaceId === ids[index] && same(preview.packet, reference.packet) &&
        sameBuffer(mesh.getVerticesData('position'), reference.mesh.positions) &&
        sameBuffer(mesh.getVerticesData('normal'), reference.mesh.normals) &&
        sameBuffer(mesh.getIndices(), reference.mesh.indices) &&
        sameBuffer(mesh.metadata.barocss.nativeParameters, reference.mesh.parameters), 'Native/target Surface binding mismatch');
      requireFact(reference.report.vertexCount === 64 && reference.report.triangleCount === 98, 'Unexpected Surface grid');
      requireFact(reference.packet.positions.every((value, p) => Object.is(Math.fround(value * 0.001), reference.mesh.positions[p])), 'Incorrect mm conversion');
      return { id: ids[index], nativeParameters: Array.from(reference.mesh.parameters), vertices: 64, triangles: 98, bufferMatches: true };
    });
    const trackedMeshes = track(next.meshes);
    const trackedMaterials = track([...new Set(next.meshes.map(mesh => mesh.material))]);
    requireFact(trackedMaterials.length === 1, 'Expected one shared result material');
    accepted?.dispose(); accepted = next; next = undefined;
    meshResources = trackedMeshes; materialResources = trackedMaterials;
    const positions = neutral.surfaces.flatMap(surface => Array.from(surface.mesh.positions));
    const low = [0, 1, 2].map(axis => Math.min(...positions.filter((_, index) => index % 3 === axis)));
    const high = [0, 1, 2].map(axis => Math.max(...positions.filter((_, index) => index % 3 === axis)));
    const center = low.map((value, axis) => (value + high[axis]) / 2);
    const halfY = Math.max((high[1] - low[1]) * 0.65, (high[0] - low[0]) * 0.65 / 1.6, 0.001);
    camera.position.set(center[0], center[1], high[2] + 0.05);
    camera.setTarget(new Vector3(...center));
    camera.orthoLeft = -halfY * 1.6; camera.orthoRight = halfY * 1.6;
    camera.orthoTop = halfY; camera.orthoBottom = -halfY;
    evidence.cameraFit = { centerSceneUnits: center, halfHeightSceneUnits: halfY, role: 'derived host state' };
    await scene.whenReadyAsync();
    accepted.meshes.forEach(mesh => mesh.setEnabled(false));
    const background = frame();
    for (const [index, mesh] of accepted.meshes.entries()) {
      mesh.setEnabled(true); evidence.members[index].pixels = changedPixels(frame(), background);
      requireFact(evidence.members[index].pixels > 0, `Invisible native Surface ${ids[index]}`);
      mesh.setEnabled(false);
    }
    accepted.meshes.forEach(mesh => mesh.setEnabled(true));
    const pixels = frame();
    evidence.combinedPixels = changedPixels(pixels, background); evidence.frameHash = hash(pixels);
    evidence.sourceRetained = true; evidence.ownedMeshes = meshResources.length; evidence.ownedMaterials = materialResources.length;
    evidence.disposed = false; evidence.refusals = []; evidence.callerRetained = callerRetained();
    document.querySelector('#reject').disabled = false; document.querySelector('#dispose').disabled = false;
    status('Loaded one complete source. Five native Surfaces are visible.');
  } finally {
    next?.dispose(); document.querySelector('#load').disabled = false;
  }
}
function reject() {
  requireFact(accepted && !evidence.disposed, 'Load a source first');
  const before = frame(), original = accepted.source;
  const basis = scene.useRightHandedSystem;
  const legacy = { ...options }; delete legacy.nativeCapacity;
  const attempts = [
    ['legacy capacity', () => new BaroCADBabylonLoader(scene, legacy).parse(original)],
    ['invalid source', () => loader.parse('invalid native CAD')],
    ['invalid capacity', () => new BaroCADBabylonLoader(scene, { ...options, nativeCapacity: { version: 1, maximumObjects: 5 } }).parse(original)],
    ['wrong-handed separate Scene', () => {
      const wrongScene = new Scene(engine);
      try {
        requireFact(wrongScene.useRightHandedSystem === false, 'Separate Scene must start left-handed');
        return new BaroCADBabylonLoader(wrongScene, options).parse(original);
      } finally { wrongScene.dispose(); }
    }],
  ];
  for (const [label, attempt] of attempts) {
    let refused = false;
    try { const unexpected = attempt(); unexpected.dispose(); } catch { refused = true; }
    requireFact(refused && accepted.source === original && scene.useRightHandedSystem === basis &&
      accepted.meshes.every(mesh => scene.meshes.includes(mesh) && !mesh.isDisposed()) &&
      sameBuffer(frame(), before) && [...meshResources, ...materialResources].every(record => record.disposals === 0) && callerRetained(),
      'Refusal changed accepted state');
    evidence.refusals.push(label);
  }
  evidence.refusalSourceRetained = true; evidence.refusalFrameRetained = true; evidence.callerBasisRetained = true;
  status('Four invalid candidates refused. The accepted source and display remain.');
}
function dispose() {
  requireFact(accepted, 'Load a source first');
  const original = accepted.source;
  accepted.dispose(); accepted.dispose();
  requireFact(meshResources.length === 5 && materialResources.length === 1 &&
    [...meshResources, ...materialResources].every(record => record.disposals === 1) &&
    accepted.meshes.every(mesh => mesh.isDisposed() && !scene.meshes.includes(mesh)) &&
    accepted.source === original && callerRetained(), 'Result disposal crossed caller ownership');
  frame(); evidence.disposed = true;
  evidence.meshDisposals = meshResources.map(record => record.disposals);
  evidence.materialDisposals = materialResources.map(record => record.disposals);
  evidence.callerRetained = true; evidence.callerDisposals = { ...callerDisposals };
  document.querySelector('#reject').disabled = true;
  status('Display disposed twice. Caller Scene, engine, camera, light, marker and canvas remain live.');
}
document.querySelector('#load').addEventListener('click', () => { load().catch(fail); });
document.querySelector('#reject').addEventListener('click', () => { try { reject(); } catch (error) { fail(error); } });
document.querySelector('#dispose').addEventListener('click', () => { try { dispose(); } catch (error) { fail(error); } });
await load().catch(fail);
