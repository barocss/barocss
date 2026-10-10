import { evaluateSurfaceCurvature, evaluateSurfaceD2 } from '@barocss/cad';
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Camera } from '@babylonjs/core/Cameras/camera.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Constants } from '@babylonjs/core/Engines/constants.js';
import { FIXTURES, PINS, REFUSAL_KINDS, loadFixtures, refusalAction } from './native-surface-curvature-babylon-fixture.mjs';
import { options, ANNOTATION_DIMENSIONS, createInspection } from './native-surface-curvature-babylon-checkpoint.mjs';

const width = 840, height = 560, canvas = document.querySelector('#view');
const engine = new Engine(canvas, false, { preserveDrawingBuffer: true, stencil: true }); engine.setHardwareScalingLevel(1);
const scene = new Scene(engine); scene.useRightHandedSystem = true; scene.clearColor = new Color4(16 / 255, 27 / 255, 44 / 255, 1);
const camera = new FreeCamera('caller-camera', new Vector3(0.008, 0.008, 0.008), scene);
camera.upVector = new Vector3(0, 1, 0); camera.setTarget(new Vector3(0.001, 0.001, 0.0015));
camera.mode = Camera.ORTHOGRAPHIC_CAMERA; camera.orthoLeft = -0.0035; camera.orthoRight = 0.0035;
camera.orthoTop = 0.0023333333333333335; camera.orthoBottom = -0.0023333333333333335;
camera.minZ = 0.0001; camera.maxZ = 1; scene.activeCamera = camera;
const cameraState = { position: camera.position.asArray(), rotation: camera.rotation.asArray(), projection: Array.from(camera.getProjectionMatrix().asArray()),
  bounds: [camera.orthoLeft, camera.orthoRight, camera.orthoTop, camera.orthoBottom], minZ: camera.minZ, maxZ: camera.maxZ };
const marker = MeshBuilder.CreateSphere('caller-green-marker', { diameter: 0.00018, segments: 8 }, scene); marker.position.set(0.001, -0.0008, 0.0005);
const markerMaterial = new StandardMaterial('caller-marker-material', scene);
markerMaterial.emissiveColor = new Color3(0, 1, 0); markerMaterial.diffuseColor = Color3.Black(); markerMaterial.specularColor = Color3.Black(); marker.material = markerMaterial;
const markerGeometry = marker.geometry;
const callerDisposals = { engine: 0, scene: 0, camera: 0, marker: 0, geometry: 0, material: 0 };
for (const [key, object] of Object.entries({ engine, scene, camera, marker, material: markerMaterial })) object.onDisposeObservable.add(() => callerDisposals[key]++);
const originalGeometryDispose = markerGeometry.dispose;
markerGeometry.dispose = function (...args) { callerDisposals.geometry++; return originalGeometryDispose.apply(this, args); };
const gl = canvas.getContext('webgl2'), inspection = createInspection(scene);
window.__baroBabylonSurfaceCurvatureInspection = inspection;
const evidence = { target: 'Babylon9.29.0 WebGL2', sourceFrame: 'original authored XYZ/mm, caller right-handed Y-up', unitsPerMillimeter: 0.001,
  fixedCamera: cameraState, annotationDimensions: ANNOTATION_DIMENSIONS, overlayPolicy: { renderingGroupId: 1, depthFunction: 519, disableDepthWrite: true },
  artifacts: [], nativeQueries: [], queries: [], refusals: [], glErrors: [], ready: false, disposed: false };
window.__baroBabylonSurfaceCurvatureEvidence = evidence;
let fixtures, busy = true, queryIndex = -1;
const identityMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const requireFact = (fact, message) => { if (!fact) throw new Error(message); };
const same = (a, b) => Object.is(a, b) || (a !== null && b !== null && typeof a === 'object' && typeof b === 'object' &&
  Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => Object.hasOwn(b, key) && same(a[key], b[key])));
const sameBuffer = (a, b) => a?.length === b.length && Array.from(a).every((value, index) => Object.is(value, b[index]));
const hash = bytes => bytes.reduce((value, byte) => Math.imul(value ^ byte, 16777619) >>> 0, 2166136261);
async function readPinned(file) {
  const pin = PINS.find(value => value.file === file); requireFact(pin, `Unknown producer file ${file}`);
  const url = new URL(`./native-surface-curvature-babylon-data/${file}`, location.href);
  const response = await fetch(url); requireFact(response.ok, `HTTP ${response.status}: ${file}`);
  const bytes = await response.arrayBuffer();
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
  requireFact(bytes.byteLength === pin.bytes && sha256 === pin.sha256, `Original producer file changed: ${file}`);
  evidence.artifacts.push({ file, url: url.href, bytes: bytes.byteLength, sha256 });
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
function frame() {
  scene.render(); const bytes = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  const error = gl.getError(); evidence.glErrors.push(error); requireFact(error === gl.NO_ERROR, `WebGL error ${error}`); return bytes;
}
function changedPixels(a, b) {
  let count = 0;
  for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) count++;
  return count;
}
function callerRetained() {
  return scene.useRightHandedSystem === true && !engine.isDisposed && !scene.isDisposed && !camera.isDisposed() && !marker.isDisposed() &&
    scene.activeCamera === camera && scene.meshes.includes(marker) && scene.materials.includes(markerMaterial) && marker.geometry === markerGeometry &&
    canvas.isConnected && !gl.isContextLost() && Object.values(callerDisposals).every(value => value === 0) &&
    same(camera.position.asArray(), cameraState.position) && same(camera.rotation.asArray(), cameraState.rotation) &&
    same(Array.from(camera.getProjectionMatrix().asArray()), cameraState.projection);
}
function resourceProof() {
  const live = new Set([inspection.result.meshes[0], inspection.annotations.point, inspection.annotations.line]);
  requireFact(inspection.resources.every(row => row.meshDisposals === (live.has(row.mesh) ? 0 : 1) &&
    row.geometryDisposals === (live.has(row.mesh) ? 0 : 1) && row.materialDisposals === (live.has(row.mesh) ? 0 : 1)), 'Replaced actual annotations were not released once');
}
function project(point) {
  const screen = Vector3.Project(new Vector3(...point), Matrix.Identity(), scene.getTransformMatrix(), camera.viewport.toGlobal(width, height));
  requireFact(Number.isFinite(screen.x) && Number.isFinite(screen.y) && screen.z >= 0 && screen.z <= 1, 'Native annotation is clipped in depth');
  return [screen.x, height - screen.y];
}
function colored(bytes, color) {
  const pixels = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = (y * width + x) * 4;
    if (bytes[index] === color[0] && bytes[index + 1] === color[1] && bytes[index + 2] === color[2]) pixels.push([x + 0.5, y + 0.5]);
  }
  return pixels;
}
function segmentDistance(point, start, end) {
  const dx = end[0] - start[0], dy = end[1] - start[1], squared = dx * dx + dy * dy;
  const t = squared === 0 ? 0 : Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / squared));
  return Math.hypot(point[0] - start[0] - t * dx, point[1] - start[1] - t * dy);
}
const numberText = value => Object.is(value, -0) ? '-0' : String(value);
const vectorText = values => `[${values.map(numberText).join(', ')}]`;
function updateReadout() {
  const value = inspection.readout, curvature = value.curvature;
  document.querySelector('#readout').textContent = `Original identity: ${inspection.identity.modelId} / ${inspection.identity.surfaceId}\n` +
    `Original U/V: ${numberText(value.u)} / ${numberText(value.v)}; domains U [-3,7], V [2,5]\n` +
    `Native point (mm): ${vectorText(curvature.derivatives.point)}\nNative unit normal: ${vectorText(curvature.unitNormal)}\n` +
    `Native signed mean curvature (1/mm): ${numberText(curvature.meanCurvaturePerMM)}\n` +
    `Native Gaussian curvature (1/mm²): ${numberText(curvature.gaussianCurvaturePerMM2)}\n` +
    `Native principal curvatures (1/mm): ${vectorText(curvature.principalCurvaturesPerMM)}\n` +
    `Actual normalized metric:\n${JSON.stringify(curvature.normalizedMetric, null, 2)}\n` +
    `Actual second form (1/mm):\n${JSON.stringify(curvature.normalizedSecondFormPerMM, null, 2)}\n` +
    `Actual umbilic discriminant/roundoff disclosure:\n${JSON.stringify(curvature.umbilicDiscriminant, null, 2)}\n` +
    'Native U/V-oriented local observations; display triangles/texture UV do not define curvature or global validity.';
  document.querySelector('#full-native').textContent = JSON.stringify(value, (_key, number) =>
    typeof number === 'number' && Object.is(number, -0) ? '-0 (negative zero)' : number, 2);
}
function refreshEvidence() {
  evidence.checkpoint = inspection.snapshot(); evidence.callerRetained = callerRetained();
  const own = performance.getEntriesByType('resource').map(resource => resource.name).filter(url => /\/packages\/barocss-(cad|cad-interop)\//.test(url));
  evidence.ownSourceURLs = own.filter(url => /\/src\//.test(url)); evidence.ownDistURLs = own.filter(url => /\/dist\//.test(url));
  requireFact(evidence.ownSourceURLs.length > 0 && evidence.ownDistURLs.length === 0, 'Expected actual own source modules with zero dist');
}
async function observeQuery(index) {
  await scene.whenReadyAsync(); requireFact(scene.isReady(), 'Actual Scene/shader readiness failed');
  requireFact(engine.getRenderWidth() === width && engine.getRenderHeight() === height, 'Actual render dimensions changed');
  const result = inspection.result, mesh = result.meshes[0], annotations = inspection.annotations, value = inspection.readout;
  const saved = fixtures.cylinder.results[index];
  requireFact(same(value.curvature, saved.result) && same(value.d2, saved.actualUnchangedD2) && same(value.curvature.derivatives, value.d2), 'Original native query/curvature/D2 differs from producer');
  const start = value.curvature.derivatives.point.map(number => number * 0.001);
  const end = start.map((number, axis) => number + value.curvature.unitNormal[axis] * ANNOTATION_DIMENSIONS.normalLength);
  requireFact(same(annotations.point.position.asArray(), start) && sameBuffer(annotations.line.getVerticesData('position'), [...start, ...end]) &&
    same(annotations.start, start) && same(annotations.end, end), 'Actual annotation buffers do not follow original native point/normal');
  for (const annotation of [annotations.point, annotations.line]) requireFact(annotation.renderingGroupId === 1 &&
    annotation.material.depthFunction === Constants.ALWAYS && annotation.material.disableDepthWrite === true, 'Frozen actual annotation overlay changed');
  resourceProof(); frame();
  requireFact(mesh.getWorldMatrix().asArray().every((number, p) => number === identityMatrix[p]), 'Original preview world identity changed');
  const startPixel = project(start), endPixel = project(end);
  const old = [mesh.isEnabled(), annotations.point.isEnabled(), annotations.line.isEnabled(), marker.isEnabled()];
  let previewPixels, pointPixels, normalPixels;
  try {
    annotations.point.setEnabled(false); annotations.line.setEnabled(false); mesh.setEnabled(false);
    const background = frame(); mesh.setEnabled(true); previewPixels = changedPixels(frame(), background);
    mesh.setEnabled(false); marker.setEnabled(false); annotations.point.setEnabled(true);
    pointPixels = colored(frame(), [255, 0, 255]); annotations.point.setEnabled(false); annotations.line.setEnabled(true);
    normalPixels = colored(frame(), [255, 255, 0]);
  } finally {
    mesh.setEnabled(old[0]); annotations.point.setEnabled(old[1]); annotations.line.setEnabled(old[2]); marker.setEnabled(old[3]);
  }
  const radiusPixels = ANNOTATION_DIMENSIONS.pointRadius * width / (camera.orthoRight - camera.orthoLeft);
  requireFact(previewPixels > 0 && pointPixels.length > 0 && pointPixels.every(pixel => Math.hypot(pixel[0] - startPixel[0], pixel[1] - startPixel[1]) <= radiusPixels + 3),
    'Actual point pixels do not fit the projected native point/radius');
  requireFact(normalPixels.length > 0 && normalPixels.every(pixel => segmentDistance(pixel, startPixel, endPixel) <= 2),
    'Actual normal pixels do not fit the original native normal segment');
  const combined = frame(); requireFact(callerRetained(), 'Caller resources or fixed camera changed');
  const previousHash = evidence.frameHash;
  const observed = { index, u: value.u, v: value.v, previewPixels, pointPixels: pointPixels.length, normalPixels: normalPixels.length,
    projectedNativePoint: startPixel, projectedNormalEndpoint: endPixel, actualPointPosition: annotations.point.position.asArray(),
    actualNormalPositions: Array.from(annotations.line.getVerticesData('position')), nativeCurvature: structuredClone(value.curvature), nativeD2: structuredClone(value.d2),
    gaussianSignedZero: Object.is(value.curvature.gaussianCurvaturePerMM2, -0), frameHash: hash(combined) };
  if (index > 0) requireFact(observed.frameHash !== previousHash, 'Changed original query did not move actual annotation frame');
  evidence.queries.push(observed); evidence.frameHash = observed.frameHash; updateReadout(); refreshEvidence();
}
function syncControls() {
  const beforeRefusals = new Set(evidence.refusals.filter(row => row.queryIndex === 0).map(row => row.kind));
  for (let index = 1; index <= 3; index++) document.querySelector(`#query-${index}`).disabled = busy || evidence.disposed || queryIndex !== index - 1 || beforeRefusals.size !== 7;
  document.querySelector('#dispose').disabled = busy || evidence.disposed || queryIndex !== 3;
  for (const kind of REFUSAL_KINDS) document.querySelector(`#refuse-${kind}`).disabled = busy || evidence.disposed || queryIndex < 0 ||
    (queryIndex !== 0 && !(queryIndex === 3 && kind === 'forged-reference'));
}
async function load() {
  requireFact(gl instanceof WebGL2RenderingContext, 'WebGL2 required');
  fixtures = await loadFixtures(readPinned); requireFact(evidence.artifacts.length === 6, 'Expected six original pinned HTTP files');
  for (const key of ['cylinder', 'sphere']) {
    const fixture = fixtures[key], surface = fixture.model.objects[0];
    for (const [index, query] of fixture.queries.queries.entries()) {
      const curvature = evaluateSurfaceCurvature(surface, query.u, query.v), d2 = evaluateSurfaceD2(surface, query.u, query.v);
      requireFact(same(curvature, fixture.results[index].result) && same(d2, fixture.results[index].actualUnchangedD2) && same(curvature.derivatives, d2), 'Saved original native curvature/D2 differs');
      evidence.nativeQueries.push({ source: key, query, curvature, d2, producerExact: true });
    }
  }
  inspection.admit(fixtures.cylinder.source, -3, 2); queryIndex = 0;
  const result = inspection.result, neutral = parseBaroCadSource(fixtures.cylinder.source, options), mesh = result.meshes[0], preview = neutral.surfaces[0];
  requireFact(result.source === fixtures.cylinder.source && same(result.model, fixtures.cylinder.model) && same(result.model, neutral.model) &&
    result.model.objects.length === 1 && inspection.originalSurface === result.model.objects[0] && mesh.metadata.barocss.surfaceId === FIXTURES.cylinder.surfaceId &&
    mesh.metadata.barocss.modelName === FIXTURES.cylinder.modelId && preview.report.vertexCount === 64 && preview.report.triangleCount === 98 &&
    sameBuffer(mesh.getVerticesData('position'), preview.mesh.positions) && sameBuffer(mesh.getVerticesData('normal'), preview.mesh.normals) &&
    sameBuffer(mesh.getIndices(), preview.mesh.indices) && sameBuffer(mesh.metadata.barocss.nativeParameters, preview.mesh.parameters) &&
    preview.packet.positions.every((number, p) => Object.is(Math.fround(number * 0.001), preview.mesh.positions[p])), 'Complete original source/nativeUV/target buffers/mm association differs');
  evidence.preview = { vertices: 64, triangles: 98, nativeUVExact: true, targetBuffersExact: true, originalSurfaceExactReference: true };
  await observeQuery(0); evidence.ready = true; document.documentElement.dataset.babylonSurfaceCurvatureReady = 'true';
  document.querySelector('#status').textContent = 'Original cylinder and native query loaded; actual Scene shaders ready. Run seven refusals, then three saved queries.';
}
async function query(index) {
  requireFact(index === queryIndex + 1, 'Execute each saved query once in order');
  const saved = fixtures.cylinder.queries.queries[index]; inspection.query(saved.u, saved.v, inspection.originalSurface); queryIndex = index;
  await observeQuery(index); document.querySelector('#status').textContent = 'Original native query and actual point/normal overlays updated. Prior annotation resources released once.';
}
function refuse(kind) {
  const before = inspection.snapshot(), pixels = frame(), meshes = [...scene.meshes], materials = [...scene.materials], geometries = [...scene.geometries];
  let error;
  try { refusalAction(kind, inspection, fixtures)(); } catch (failure) { error = failure; }
  requireFact(error && same(inspection.snapshot(), before) && sameBuffer(frame(), pixels) &&
    meshes.length === scene.meshes.length && meshes.every((mesh, index) => mesh === scene.meshes[index]) &&
    materials.length === scene.materials.length && materials.every((material, index) => material === scene.materials[index]) &&
    geometries.length === scene.geometries.length && geometries.every((geometry, index) => geometry === scene.geometries[index]) && callerRetained(),
    'Actual refused candidate changed original CPU/query/Scene/annotations/resources/frame');
  if (kind === 'sphere') requireFact(error instanceof RangeError && error.message === 'Collapsed or nonfinite preview triangle', 'Expected actual complete sphere preview refusal');
  else if (kind === 'forged-reference') requireFact(error instanceof TypeError && error.message.includes('accepted original object reference'), 'Expected scoped original identity guard');
  else requireFact(error.name === 'NativeCurvatureError' && error.code === 'DERIVATIVE' && error.cause?.name === 'NativeSecondDerivativeError' && error.cause?.code === 'INPUT', 'Expected actual original native derivative guard/cause');
  evidence.refusals.push({ kind, queryIndex, name: error.name, code: error.code ?? null, causeName: error.cause?.name ?? null, causeCode: error.cause?.code ?? null,
    message: error.message, nativeRetained: true, queryRetained: true, frameRetained: true, sceneResourcesRetained: true });
  refreshEvidence(); document.querySelector('#status').textContent = `${kind} refused: ${error.message}\nAccepted original query and actual full frame remain.`;
}
function dispose() {
  const result = inspection.result, surface = inspection.originalSurface, before = inspection.snapshot();
  inspection.dispose(); inspection.dispose();
  requireFact(inspection.resources.length === 9 && inspection.resources.every(row => row.meshDisposals === 1 && row.geometryDisposals === 1 && row.materialDisposals === 1) &&
    result.source === before.source && same(result.model, before.model) && surface === result.model.objects[0] && same(inspection.readout, before.readout) &&
    callerRetained(), 'Final double cleanup crossed original CPU/caller/owned resource boundaries');
  const pixels = frame(); let greenPixels = 0;
  for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 40 && pixels[i + 1] > 200 && pixels[i + 2] < 40) greenPixels++;
  requireFact(greenPixels > 0, 'Standing caller marker lost actual pixels after cleanup');
  evidence.disposed = true; evidence.ownedResourcesOnce = { mesh: 9, geometry: 9, material: 9 }; evidence.callerDisposals = { ...callerDisposals };
  evidence.standingGreenPixelsAfterCleanup = greenPixels; evidence.originalCPUReadable = true; refreshEvidence();
  document.querySelector('#status').textContent = 'Preview and four point/normal pairs released once. Caller Engine, Scene, camera, marker, canvas and original native CPU data remain.';
}
async function run(action) {
  if (busy || evidence.disposed) return;
  busy = true; syncControls();
  try { await action(); }
  catch (error) { window.__baroBabylonSurfaceCurvatureError = error.stack ?? String(error); document.querySelector('#status').textContent = `Failed: ${error.message}`; console.error(error); }
  finally { busy = false; syncControls(); }
}
for (let index = 1; index <= 3; index++) document.querySelector(`#query-${index}`).addEventListener('click', () => run(() => query(index)));
for (const kind of REFUSAL_KINDS) document.querySelector(`#refuse-${kind}`).addEventListener('click', () => run(() => refuse(kind)));
document.querySelector('#dispose').addEventListener('click', () => run(dispose));
syncControls();
try { await load(); }
catch (error) { window.__baroBabylonSurfaceCurvatureError = error.stack ?? String(error); document.querySelector('#status').textContent = `Failed: ${error.message}`; console.error(error); }
finally { busy = false; syncControls(); }
