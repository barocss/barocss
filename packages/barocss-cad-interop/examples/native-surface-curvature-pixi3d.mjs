import { evaluateSurfaceCurvature, evaluateSurfaceD2 } from '@barocss/cad';
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import { Application, DRAW_MODES, Graphics } from 'pixi.js';
import { Camera, Mesh3D } from 'pixi3d/pixi7';
import { FIXTURES, PINS, REFUSAL_KINDS, loadFixtures, refusalAction } from './native-surface-curvature-pixi3d-fixture.mjs';
import { options, ANNOTATION_DIMENSIONS, ANNOTATION_SPHERE_OPTIONS, createInspection } from './native-surface-curvature-pixi3d-checkpoint.mjs';

const width = 840, height = 560;
const app = new Application({ width, height, resolution: 1, background: '#101b2c', antialias: false,
  preserveDrawingBuffer: true, autoStart: false }); app.stop();
const stage = app.stage, renderer = app.renderer, canvas = app.view;
document.querySelector('#view').append(canvas);
const camera = new Camera(renderer); Camera.main = camera;
camera.position.set(0.008, 0.008, 0.008); camera.rotationQuaternion.setEulerAngles(36.23371869592981, -132.87890360333859, 0);
camera.orthographic = true; camera.orthographicSize = 0.0023333333333333335; camera.near = 0.0001; camera.far = 1;
const cameraState = { position: Array.from(camera.position.array), quaternion: Array.from(camera.rotationQuaternion.array),
  projection: null, halfHeight: camera.orthographicSize, near: camera.near, far: camera.far,
  authoredPosition: [0.008, 0.008, 0.008], target: [0.001, 0.001, 0.0015], euler: [36.23371869592981, -132.87890360333859, 0] };
const marker = new Graphics(); marker.beginFill(0x00ff00).drawCircle(800, 520, 10).endFill(); stage.addChild(marker);
const markerGeometry = marker.geometry;
function observeCaller(key, object) {
  const record = { key, object, calls: 0 }, original = object.destroy;
  object.destroy = function (...args) { record.calls++; return original.apply(this, args); }; return record;
}
const callerResources = Object.entries({ application: app, renderer, stage, camera, marker, markerGeometry }).map(([key, object]) => observeCaller(key, object));
const gl = renderer.gl, inspection = createInspection(stage);
window.__baroPixiSurfaceCurvatureInspection = inspection;
const evidence = { target: 'Pixi3D2.5.0 / PixiJS7.2.4 WebGL2', unitsPerMillimeter: 0.001, sourceFrame: 'original authored XYZ/mm, caller fixed Y-up view',
  fixedCamera: cameraState, annotationDimensions: ANNOTATION_DIMENSIONS, sphereOptions: ANNOTATION_SPHERE_OPTIONS,
  overlayPolicy: { depthTest: false, depthMask: false, unlit: true, doubleSided: true },
  artifacts: [], nativeQueries: [], queries: [], refusals: [], glErrors: [], ready: false, disposed: false };
window.__baroPixiSurfaceCurvatureEvidence = evidence;
let fixtures, busy = true, queryIndex = -1;
const identityMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const requireFact = (fact, message) => { if (!fact) throw new Error(message); };
const same = (a, b) => Object.is(a, b) || (a !== null && b !== null && typeof a === 'object' && typeof b === 'object' &&
  Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => Object.hasOwn(b, key) && same(a[key], b[key])));
const sameBuffer = (a, b) => a?.length === b.length && Array.from(a).every((value, index) => Object.is(value, b[index]));
const hash = bytes => bytes.reduce((value, byte) => Math.imul(value ^ byte, 16777619) >>> 0, 2166136261);
async function readPinned(file) {
  const pin = PINS.find(value => value.file === file); requireFact(pin, `Unknown producer file ${file}`);
  const url = new URL(`./native-surface-curvature-pixi3d-data/${file}`, location.href);
  const response = await fetch(url); requireFact(response.ok, `HTTP ${response.status}: ${file}`);
  const bytes = await response.arrayBuffer();
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
  requireFact(bytes.byteLength === pin.bytes && sha256 === pin.sha256, `Original producer artifact changed: ${file}`);
  evidence.artifacts.push({ file, url: url.href, bytes: bytes.byteLength, sha256 });
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
function frame() {
  renderer.render(stage);
  const bytes = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  const error = gl.getError(); evidence.glErrors.push(error); requireFact(error === gl.NO_ERROR, `WebGL error ${error}`); return bytes;
}
function changedPixels(a, b) {
  let count = 0;
  for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) count++;
  return count;
}
function callerRetained() {
  return app.stage === stage && app.renderer === renderer && app.view === canvas && !stage.destroyed && !camera.destroyed && !marker.destroyed &&
    stage.children.includes(marker) && canvas.isConnected && !gl.isContextLost() && callerResources.every(row => row.calls === 0) &&
    Camera.main === camera && camera.renderer === renderer && same(Array.from(camera.position.array), cameraState.position) &&
    same(Array.from(camera.rotationQuaternion.array), cameraState.quaternion) && same(Array.from(camera.projection.array), cameraState.projection) &&
    camera.orthographicSize === cameraState.halfHeight && camera.near === cameraState.near && camera.far === cameraState.far;
}
function resourceProof() {
  const liveMeshes = new Set([inspection.result.renderedSurfaces[0].mesh, inspection.annotations.point, inspection.annotations.line]);
  const liveRoots = new Set([inspection.result.root, inspection.annotations.root]);
  requireFact(inspection.resources.every(row => row.meshDestroyCalls === (liveMeshes.has(row.mesh) ? 0 : 1) &&
    row.geometryDestroyCalls === (liveMeshes.has(row.mesh) ? 0 : 1) && row.materialDestroyCalls === (liveMeshes.has(row.mesh) ? 0 : 1)) &&
    inspection.roots.every(row => row.rootDestroyCalls === (liveRoots.has(row.root) ? 0 : 1) &&
      (liveRoots.has(row.root) ? row.root.parent === stage : row.root.destroyed && row.root.parent === null)), 'Actual replaced annotation/root ownership differs');
}
function project(point) {
  // A real render/prerender has already updated this caller camera. Public projection uses original scene coordinates.
  const pixel = camera.worldToScreen(...point);
  requireFact(Number.isFinite(pixel.x) && Number.isFinite(pixel.y), 'Native annotation projection is not finite');
  return [pixel.x, height - pixel.y];
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
  const value = inspection.readout, native = value.curvature;
  document.querySelector('#readout').textContent = `Original identity: ${inspection.identity.modelId} / ${inspection.identity.surfaceId}\n` +
    `Original U/V: ${numberText(value.u)} / ${numberText(value.v)}; original domains U [-3,7], V [2,5]\n` +
    `Native point (mm): ${vectorText(native.derivatives.point)}\nOriginal native unit normal: ${vectorText(native.unitNormal)}\n` +
    `Signed mean curvature (1/mm): ${numberText(native.meanCurvaturePerMM)}\nGaussian curvature (1/mm²): ${numberText(native.gaussianCurvaturePerMM2)}\n` +
    `Principal curvatures (1/mm): ${vectorText(native.principalCurvaturesPerMM)}\n` +
    `Actual normalized metric:\n${JSON.stringify(native.normalizedMetric, null, 2)}\n` +
    `Actual normalized second form (1/mm):\n${JSON.stringify(native.normalizedSecondFormPerMM, null, 2)}\n` +
    `Actual umbilic discriminant / roundoff disclosure:\n${JSON.stringify(native.umbilicDiscriminant, null, 2)}\n` +
    'Original U/V-oriented local observations. Triangles, shader normals and texture UV do not define native curvature or global validity.';
  document.querySelector('#full-native').textContent = JSON.stringify(value, (_key, number) =>
    typeof number === 'number' && Object.is(number, -0) ? '-0 (negative zero)' : number, 2);
}
function refreshEvidence() {
  evidence.checkpoint = inspection.snapshot(); evidence.callerRetained = callerRetained();
  const own = performance.getEntriesByType('resource').map(resource => resource.name).filter(url => /\/packages\/barocss-(cad|cad-interop)\//.test(url));
  evidence.ownSourceURLs = own.filter(url => /\/src\//.test(url)); evidence.ownDistURLs = own.filter(url => /\/dist\//.test(url));
  requireFact(evidence.ownSourceURLs.length > 0 && evidence.ownDistURLs.length === 0, 'Expected observed public source modules and zero own dist');
}
function observeQuery(index) {
  requireFact(renderer.width === width && renderer.height === height && renderer.resolution === 1, 'Actual render dimensions changed');
  frame(); // The actual renderer/prerender lifecycle updates camera and world transforms before observations.
  const expectedForward = [-0.5910804632890486, -0.5910804632890486, -0.5488604301969738];
  const forward = Array.from(camera.worldTransform.forward.array);
  requireFact(forward.every((number, axis) => Math.abs(number - expectedForward[axis]) < 1e-6), 'Actual camera direction differs from the fixed native view');
  evidence.cameraForward = forward;
  if (cameraState.projection === null) cameraState.projection = Array.from(camera.projection.array);
  const result = inspection.result, previewMesh = result.renderedSurfaces[0].mesh, annotations = inspection.annotations, value = inspection.readout;
  const saved = fixtures.cylinder.results[index];
  requireFact(same(value.curvature, saved.result) && same(value.d2, saved.actualUnchangedD2) && same(value.curvature.derivatives, value.d2), 'Original full curvature/D2 differs from saved producer values');
  const start = value.curvature.derivatives.point.map(number => number * 0.001);
  const end = start.map((number, axis) => number + value.curvature.unitNormal[axis] * ANNOTATION_DIMENSIONS.normalLength);
  requireFact(annotations.point instanceof Mesh3D && annotations.line instanceof Mesh3D && same(annotations.start, start) && same(annotations.end, end) &&
    same(Array.from(annotations.point.position.array), start.map(Math.fround)) &&
    sameBuffer(annotations.line.geometry.positions.buffer, Float32Array.from([...start, ...end])) &&
    annotations.line.geometry.indices.buffer instanceof Uint16Array && sameBuffer(annotations.line.geometry.indices.buffer, [0, 1]) &&
    sameBuffer(annotations.line.geometry.normals.buffer, [0, 0, 1, 0, 0, 1]) && annotations.line.material.drawMode === DRAW_MODES.LINE_STRIP &&
    same(annotations.sphereOptions, ANNOTATION_SPHERE_OPTIONS), 'Actual derived annotation point/F32 buffers/strip shader input differs');
  for (const mesh of [annotations.point, annotations.line]) requireFact(mesh.material.unlit && mesh.material.doubleSided &&
    mesh.material.state.depthTest === false && mesh.material.state.depthMask === false, 'Frozen actual annotation material overlay differs');
  requireFact(Array.from(annotations.point.material.baseColor.rgba).every((number, p) => number === [1, 0, 1, 1][p]) &&
    Array.from(annotations.line.material.baseColor.rgba).every((number, p) => number === [1, 1, 0, 1][p]), 'Actual annotation colors differ');
  requireFact(Array.from(result.root.worldTransform.array).every((number, p) => number === identityMatrix[p]) &&
    Array.from(previewMesh.worldTransform.array).every((number, p) => number === identityMatrix[p]) &&
    Array.from(annotations.root.worldTransform.array).every((number, p) => number === identityMatrix[p]), 'Original preview or annotation root identity changed');
  const pointWorld = Array.from(annotations.point.worldTransform.array);
  requireFact([12, 13, 14].every((entry, axis) => Object.is(pointWorld[entry], Math.fround(start[axis]))), 'Actual point world translation differs from derived F32 pose');
  resourceProof(); const startPixel = project(start), endPixel = project(end);
  const previous = [previewMesh.visible, annotations.point.visible, annotations.line.visible, marker.visible];
  let previewPixels, pointPixels, normalPixels;
  try {
    annotations.point.visible = false; annotations.line.visible = false; previewMesh.visible = false;
    const background = frame(); previewMesh.visible = true; previewPixels = changedPixels(frame(), background);
    previewMesh.visible = false; marker.visible = false; annotations.point.visible = true; pointPixels = colored(frame(), [255, 0, 255]);
    annotations.point.visible = false; annotations.line.visible = true; normalPixels = colored(frame(), [255, 255, 0]);
  } finally {
    previewMesh.visible = previous[0]; annotations.point.visible = previous[1]; annotations.line.visible = previous[2]; marker.visible = previous[3];
  }
  const radiusPixels = ANNOTATION_DIMENSIONS.pointRadius * height / (2 * camera.orthographicSize);
  requireFact(previewPixels > 0 && pointPixels.length > 0 && pointPixels.every(pixel => Math.hypot(pixel[0] - startPixel[0], pixel[1] - startPixel[1]) <= radiusPixels + 3),
    'Actual point pixels do not fit the projected original native point/radius');
  requireFact(normalPixels.length > 0 && normalPixels.every(pixel => segmentDistance(pixel, startPixel, endPixel) <= 2), 'Actual normal pixels do not fit the original native normal segment');
  const combined = frame(); requireFact(callerRetained(), 'Actual caller resources or fixed camera changed');
  const oldHash = evidence.frameHash;
  const observed = { index, u: value.u, v: value.v, previewPixels, pointPixels: pointPixels.length, normalPixels: normalPixels.length,
    projectedNativePoint: startPixel, projectedNormalEndpoint: endPixel, actualPointF32Position: Array.from(annotations.point.position.array),
    actualNormalF32Positions: Array.from(annotations.line.geometry.positions.buffer), nativeCurvature: structuredClone(value.curvature), nativeD2: structuredClone(value.d2),
    gaussianSignedZero: Object.is(value.curvature.gaussianCurvaturePerMM2, -0), frameHash: hash(combined) };
  if (index > 0) requireFact(observed.frameHash !== oldHash, 'Changed native query did not move the actual annotation frame');
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
      requireFact(same(curvature, fixture.results[index].result) && same(d2, fixture.results[index].actualUnchangedD2) && same(curvature.derivatives, d2), 'Original native saved curvature/D2 differs');
      evidence.nativeQueries.push({ source: key, query, curvature, d2, producerExact: true });
    }
  }
  inspection.admit(fixtures.cylinder.source, -3, 2); queryIndex = 0;
  const result = inspection.result, neutral = parseBaroCadSource(fixtures.cylinder.source, options), binding = result.renderedSurfaces[0], mesh = binding.mesh, preview = neutral.surfaces[0];
  requireFact(result.source === fixtures.cylinder.source && same(result.model, fixtures.cylinder.model) && same(result.model, neutral.model) &&
    result.model.objects.length === 1 && inspection.originalSurface === result.model.objects[0] && binding.surfaceId === FIXTURES.cylinder.surfaceId &&
    result.model.name === FIXTURES.cylinder.modelId && preview.report.vertexCount === 64 && preview.report.triangleCount === 98 &&
    sameBuffer(mesh.geometry.positions.buffer, preview.mesh.positions) && sameBuffer(mesh.geometry.normals.buffer, preview.mesh.normals) &&
    sameBuffer(mesh.geometry.indices.buffer, preview.mesh.indices) && sameBuffer(result.surfaces[0].mesh.parameters, preview.mesh.parameters) &&
    preview.packet.positions.every((number, p) => Object.is(Math.fround(number * 0.001), preview.mesh.positions[p])), 'Complete original source/native U/V/F32 target buffers/mm association differs');
  evidence.preview = { vertices: 64, triangles: 98, nativeUVExact: true, targetBuffersExact: true, originalSurfaceExactReference: true };
  observeQuery(0); evidence.ready = true; document.documentElement.dataset.pixiSurfaceCurvatureReady = 'true';
  document.querySelector('#status').textContent = 'Original cylinder and native query loaded. Actual renderer/prerender camera and pixels verified. Run seven refusals, then three saved queries.';
}
function query(index) {
  requireFact(index === queryIndex + 1, 'Execute each saved original query once in order');
  const saved = fixtures.cylinder.queries.queries[index]; inspection.query(saved.u, saved.v, inspection.originalSurface); queryIndex = index;
  observeQuery(index); document.querySelector('#status').textContent = 'Original native query and actual point/normal overlays updated. Previous annotation resources released once.';
}
function refuse(kind) {
  const before = inspection.snapshot(), pixels = frame(), children = [...stage.children];
  let error;
  try { refusalAction(kind, inspection, fixtures)(); } catch (failure) { error = failure; }
  requireFact(error && same(inspection.snapshot(), before) && sameBuffer(frame(), pixels) && children.length === stage.children.length &&
    children.every((child, index) => child === stage.children[index]) && callerRetained(), 'Actual refused candidate changed original CPU/query/root/resources/fullRGBA/caller');
  if (kind === 'sphere') requireFact(error instanceof RangeError && error.message === 'Collapsed or nonfinite preview triangle', 'Expected actual whole sphere preview refusal');
  else if (kind === 'forged-reference') requireFact(error instanceof TypeError && error.message.includes('accepted original object reference'), 'Expected scoped original identity guard');
  else requireFact(error.name === 'NativeCurvatureError' && error.code === 'DERIVATIVE' && error.cause?.name === 'NativeSecondDerivativeError' && error.cause?.code === 'INPUT', 'Expected original native derivative guard/cause');
  evidence.refusals.push({ kind, queryIndex, name: error.name, code: error.code ?? null, causeName: error.cause?.name ?? null, causeCode: error.cause?.code ?? null,
    message: error.message, nativeRetained: true, queryRetained: true, frameRetained: true, stageChildrenRetained: true });
  refreshEvidence(); document.querySelector('#status').textContent = `${kind} refused: ${error.message}\nAccepted original query and actual full frame remain.`;
}
function dispose() {
  const result = inspection.result, surface = inspection.originalSurface, before = inspection.snapshot(); inspection.dispose(); inspection.dispose();
  requireFact(inspection.roots.length === 5 && inspection.roots.every(row => row.rootDestroyCalls === 1 && row.root.destroyed && row.root.parent === null) &&
    inspection.resources.length === 9 && inspection.resources.every(row => row.meshDestroyCalls === 1 && row.geometryDestroyCalls === 1 && row.materialDestroyCalls === 1) &&
    result.source === before.source && same(result.model, before.model) && surface === result.model.objects[0] && same(inspection.readout, before.readout) &&
    stage.children.length === 1 && callerRetained(), 'Final double cleanup crossed original CPU/caller/owned boundaries');
  const pixels = frame(); let greenPixels = 0;
  for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 40 && pixels[i + 1] > 200 && pixels[i + 2] < 40) greenPixels++;
  requireFact(greenPixels > 0, 'Caller standing green marker lost actual pixels after cleanup');
  evidence.disposed = true; evidence.ownedDestroyCallsOnce = { root: 5, mesh: 9, geometry: 9, material: 9 };
  evidence.callerDestroyCalls = callerResources.map(row => ({ key: row.key, calls: row.calls })); evidence.standingGreenPixelsAfterCleanup = greenPixels;
  evidence.originalCPUReadable = true; refreshEvidence();
  document.querySelector('#status').textContent = 'Preview and four point/normal pairs released once. Caller Application, Stage, renderer, camera, marker and original native CPU data remain.';
}
async function run(action) {
  if (busy || evidence.disposed) return;
  busy = true; syncControls();
  try { await action(); }
  catch (error) { window.__baroPixiSurfaceCurvatureError = error.stack ?? String(error); document.querySelector('#status').textContent = `Failed: ${error.message}`; console.error(error); }
  finally { busy = false; syncControls(); }
}
for (let index = 1; index <= 3; index++) document.querySelector(`#query-${index}`).addEventListener('click', () => run(() => query(index)));
for (const kind of REFUSAL_KINDS) document.querySelector(`#refuse-${kind}`).addEventListener('click', () => run(() => refuse(kind)));
document.querySelector('#dispose').addEventListener('click', () => run(dispose));
syncControls();
try { await load(); }
catch (error) { window.__baroPixiSurfaceCurvatureError = error.stack ?? String(error); document.querySelector('#status').textContent = `Failed: ${error.message}`; console.error(error); }
finally { busy = false; syncControls(); }
