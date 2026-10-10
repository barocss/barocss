import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Camera } from '@babylonjs/core/Cameras/camera.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { runSelectedUniformCurveBabylonRuntimeCheckpoint } from '../test/selected-uniform-curve-babylon.test.mjs';
import { PINS, FAMILY_NAMES, loadCurveEditAssets, assertNative, assertBuffer, requireFact } from './source-curve-control-polygon-babylon-fixture.mjs';
import { createSourceCurveControlPolygonBabylonHost } from './source-curve-control-polygon-babylon-checkpoint.mjs';
const width = 900, height = 640, mode = document.documentElement.dataset.loader1160Mode ?? 'source';
performance.setResourceTimingBufferSize(2048);
const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
document.querySelector('#view').append(canvas);
const engine = new Engine(canvas, false, { preserveDrawingBuffer: true, stencil: true }); engine.setHardwareScalingLevel(1);
const scene = new Scene(engine); scene.useRightHandedSystem = true; scene.clearColor = new Color4(16 / 255, 27 / 255, 44 / 255, 1);
const camera = new FreeCamera('caller-camera', new Vector3(.110, .065, .110), scene); camera.upVector = new Vector3(0, 1, 0);
camera.setTarget(new Vector3(.031625, -.029, .002875)); camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
camera.orthoLeft = -.0675; camera.orthoRight = .0675; camera.orthoTop = .048; camera.orthoBottom = -.048; camera.minZ = .0001; camera.maxZ = 1; scene.activeCamera = camera;
const marker = MeshBuilder.CreateSphere('caller-marker', { diameter: .001, segments: 8 }, scene); marker.position.set(.068, .003, .003);
const markerGeometry = marker.geometry, markerMaterial = new StandardMaterial('caller-green-material', scene);
markerMaterial.disableLighting = true; markerMaterial.emissiveColor = new Color3(0, 1, 0); markerMaterial.diffuseColor = Color3.Black(); markerMaterial.specularColor = Color3.Black(); marker.material = markerMaterial;
const callerDisposals = { engine: 0, scene: 0, camera: 0, mesh: 0, geometry: 0, material: 0, canvasRemoval: 0 };
for (const [name, object] of Object.entries({ engine, scene, camera, mesh: marker, material: markerMaterial })) object.onDisposeObservable.add(() => { callerDisposals[name]++; });
const geometryDispose = markerGeometry.dispose; markerGeometry.dispose = function (...args) { callerDisposals.geometry++; return geometryDispose.apply(this, args); };
const canvasRemove = canvas.remove; canvas.remove = function (...args) { callerDisposals.canvasRemoval++; return canvasRemove.apply(this, args); };
const gl = canvas.getContext('webgl2'), evidence = { mode, ready: false, error: null, HTTPpins: [], history: [], refusals: [], transport: [], cold: [], requestDeltas: [], callbacks: 0, glErrors: [], runtimeErrors: [], cleanup: null };
const rawTexts = new Map(), originalFrames = new Map(); let assets, host, coldBefore, observationQueue = Promise.resolve();
const same = (a, b) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
function cameraState() { return { position: camera.position.asArray(), rotation: camera.rotation.asArray(), quaternion: camera.rotationQuaternion?.asArray() ?? null,
  projection: Array.from(camera.getProjectionMatrix(true).asArray()), view: Array.from(camera.getViewMatrix(true).asArray()),
  limits: [camera.orthoLeft, camera.orthoRight, camera.orthoTop, camera.orthoBottom, camera.minZ, camera.maxZ], rightHanded: scene.useRightHandedSystem }; }
const fixedCamera = cameraState();
function caller() { return { retained: !engine.isDisposed && !scene.isDisposed && !camera.isDisposed() && !marker.isDisposed() && scene.activeCamera === camera &&
  scene.useRightHandedSystem === true && canvas.isConnected && !gl.isContextLost() && scene.meshes.includes(marker) && marker.geometry === markerGeometry && marker.material === markerMaterial &&
  Object.values(callerDisposals).every(value => value === 0), disposals: { ...callerDisposals }, sceneMeshes: scene.meshes.length, sceneGeometries: scene.geometries.length, sceneMaterials: scene.materials.length }; }
function frame() { scene.render(); const bytes = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  const error = gl.getError(); evidence.glErrors.push(error); requireFact(error === gl.NO_ERROR, 'Actual WebGL error'); assertNative(cameraState(), fixedCamera, 'Fixed actual Babylon camera'); return bytes; }
const nativeJSON = value => JSON.stringify(value, (_key, item) => typeof item === 'number' && Object.is(item, -0) ? '-0 (negative zero)' : item, 2);
async function waitAdmission() { await observationQueue; }
function hash(bytes) { let value = 2166136261; for (const byte of bytes) value = Math.imul(value ^ byte, 16777619) >>> 0; return value; }
function changedPixels(a, b) { let count = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) count++; return count; }
function readout(record) {
  const native = record.native, edit = record.edit;
  document.querySelector('#context').textContent = `File: ${record.asset.family} / ${record.state}\nFull Model: ${native.model.name} / ${native.model.objects.map(value => value.kind + ':' + value.id).join(', ')}\nSelected original ID: ${native.curveId}; ordinal: ${native.selectedObjectIndex}; degree: ${native.curve.degree}; poles: ${native.curve.controlPoints.length}\nOriginal domain: ${nativeJSON(native.domain)}; samples: ${native.parameters.length}; intervals: ${native.intervals.length}\nUnrendered native objects: ${native.unrenderedObjectIds.join(', ')}\nSource patches: ${edit?.patches.length ?? 0}; native first-pole X is -0: ${Object.is(native.curve.controlPoints[0][0], -0)}\nOriginal XYZ, identity poses and .001 scene units/mm once.`;
  document.querySelector('#source').textContent = record.source;
  const rows = document.querySelector('#observations'); rows.replaceChildren();
  for (const observation of edit?.report.observations ?? []) { const row = document.createElement('tr'); for (const value of [observation.parameter, nativeJSON(observation.beforePointMM), nativeJSON(observation.afterPointMM), observation.observedChangeMM]) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); } rows.append(row); }
  document.querySelector('#quality').textContent = nativeJSON({ display: native.quality, sourceEdit: edit?.report.quality ?? null, patches: edit?.patches ?? [], derivativeAttempts: edit?.report.derivativeObservations ?? [] });
  document.querySelector('#evidence').textContent = JSON.stringify({ counts: host.counts, accepted: evidence.history, cleanup: evidence.cleanup, caller: caller() }, null, 2);
}
function observe(record) {
  if (!record) { frame(); return; }
  const result = record.result, native = record.native, line = result.line, positions = line.getVerticesData('position'), indices = line.getIndices();
  requireFact(line.getScene() === scene && scene.meshes.includes(line) && line.parent === null && line.isEnabled(), 'One enabled selected actual Babylon line in caller Scene');
  requireFact(line.getTotalVertices() === 129 && indices.length === 256 && line.geometry.getVerticesDataKinds().length === 1, 'Actual selected line-list topology');
  assertBuffer(positions, native.positions); assertBuffer(indices, Array.from({ length: 128 }, (_, index) => [index, index + 1]).flat());
  requireFact(native.model.objects.length === 3 && native.selectedObjectIndex === 1 && native.curveId === 'target_curve' && native.unrenderedObjectIds.join(',') === 'context_curve,context_plane', 'Whole original Model selection differs');
  assertNative(line.position.asArray(), [0, 0, 0]); assertNative(line.rotation.asArray(), [0, 0, 0]); assertNative(line.scaling.asArray(), [1, 1, 1]);
  const pixels = frame(); line.setEnabled(false); let background;
  try { background = frame(); } finally { line.setEnabled(true); }
  requireFact(same(frame(), pixels), 'Full frame restoration differs'); const visiblePixels = changedPixels(pixels, background); requireFact(visiblePixels > 0 && caller().retained, 'Selected Curve or caller missing');
  if (record.state === 'original') originalFrames.set(record.asset.family, { pixels, positions: Array.from(native.positions) });
  let editPixels;
  if (record.state === 'edited') {
    const original = originalFrames.get(record.asset.family) ?? coldBefore;
    requireFact(original, 'Original qualified frame missing'); editPixels = changedPixels(pixels, original.pixels);
    const expectedEqual = record.asset.family.includes('noop') || record.asset.family.includes('minus_zero');
    requireFact(expectedEqual ? same(pixels, original.pixels) && same(Array.from(native.positions), original.positions) : editPixels > 0 && !same(Array.from(native.positions), original.positions), 'Actual edit display comparison differs');
  }
  if (record.state === 'cold') { requireFact(coldBefore && same(pixels, coldBefore.pixels), 'Cold full RGBA differs'); assertNative(record.readout, coldBefore.readout, 'Cold full source/Model/native/edit readout'); assertBuffer(native.positions, coldBefore.positions); assertBuffer(result.line.getVerticesData('position'), coldBefore.positions); assertBuffer(result.line.getIndices(), coldBefore.indices); evidence.cold.push({ family: record.asset.family, fullRGBAExact: true, fullReadoutExact: true, fullTargetBuffersExact: true }); }
  evidence.history.push({ family: record.asset.family, state: record.state, visiblePixels, frameHash: hash(pixels), editPixels, objectCount: native.model.objects.length, selectedObjectIndex: native.selectedObjectIndex, degree: native.curve.degree, poles: native.curve.controlPoints.length, patchCount: record.edit?.patches.length ?? 0, nativeMinusZero: Object.is(native.curve.controlPoints[0][0], -0) });
  readout(record);
}
function retained() { const record = host.accepted, line = record.result.line, attribute = line.geometry.getVertexBuffer('position'); return { record, result: record.result, native: record.native, edit: record.edit, readout: structuredClone(record.readout), geometry: line.geometry, material: line.material, attribute, vertexData: attribute.getData(), array: line.getVerticesData('position'), positions: Array.from(line.getVerticesData('position')), indexArray: line.getIndices(), indices: Array.from(line.getIndices()), pixels: frame(), meshes: [...scene.meshes], geometries: [...scene.geometries], materials: [...scene.materials], callbacks: evidence.callbacks }; }
function checkRetained(before) { const record = host.accepted, line = record.result.line;
  requireFact(record === before.record && record.result === before.result && record.native === before.native && record.edit === before.edit && line.geometry === before.geometry && line.material === before.material &&
    line.geometry.getVertexBuffer('position') === before.attribute && before.attribute.getData() === before.vertexData && line.getVerticesData('position') === before.array && line.getIndices() === before.indexArray &&
    same(Array.from(before.array), before.positions) && same(Array.from(before.indexArray), before.indices) && same(frame(), before.pixels) && evidence.callbacks === before.callbacks && caller().retained,
    'Refusal changed accepted whole source/native/resource/buffer/camera/frame');
  for (const name of ['meshes', 'materials', 'geometries']) requireFact(scene[name].length === before[name].length && scene[name].every((object, index) => object === before[name][index]), 'Refusal changed actual Scene ' + name);
  assertNative(record.readout, before.readout);
}
async function fetchPin(pin) { const response = await fetch(dataURL(pin.file)); requireFact(response.ok, 'Original HTTP response failed'); const bytes = new Uint8Array(await response.arrayBuffer()), digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join(''); requireFact(bytes.length === pin.bytes && digest === pin.sha256, 'Original byte/SHA pin differs'); const contentType = response.headers.get('content-type'), contentLength = response.headers.get('content-length'); requireFact(contentLength === String(pin.bytes) && (!pin.file.endsWith('.css') || contentType === 'text/plain; charset=utf-8'), 'Original response metadata differs'); evidence.HTTPpins.push({ file: pin.file, bytes: bytes.length, sha256: digest, status: response.status, contentType, contentLength }); return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
function dataURL(file) { return new URL('./source-curve-control-polygon-babylon-data/' + file, location.href).href; }
async function freshAsset(family) { const texts = new Map(rawTexts); await Promise.all(PINS.filter(pin => pin.file.startsWith(family + '.')).map(async pin => texts.set(pin.file, await fetchPin(pin)))); return (await loadCurveEditAssets(file => texts.get(file))).get(family); }
async function ledger() { const response = await fetch('/loader1160-request-log.json', { cache: 'no-store' }); requireFact(response.ok, 'Actual request ledger unavailable'); return response.json(); }
function setButtons(enabled) { for (const id of ['refusals', 'transport', 'edits', 'reedit', 'families', 'cleanup']) document.querySelector('#' + id).disabled = !enabled.includes(id); }
function failed(error) { evidence.error = { name: error.name, message: error.message, stack: error.stack }; evidence.runtimeErrors.push(evidence.error); document.querySelector('#status').textContent = error.message; setButtons([]); console.error(error); }
async function action(operation) { setButtons([]); try { await operation(); } catch (error) { failed(error); } }
window.loader1160 = Object.freeze({ snapshot: () => structuredClone({ ...evidence, counts: host?.counts, caller: caller(), camera: cameraState(), resources: host?.allResources.map(row => ({ meshDisposals: row.meshDisposals, geometryDisposals: row.geometryDisposals, materialDisposals: row.materialDisposals })), sourceURLs: performance.getEntriesByType('resource').filter(row => /packages\/barocss-(cad|cad-interop)\/src\//.test(row.name)).map(row => row.name), publishedBundleURLs: performance.getEntriesByType('resource').filter(row => row.name.includes('loader1160-published.mjs')).map(row => row.name) }) });
document.querySelector('#refusals').addEventListener('click', () => action(async () => { const before = retained(); evidence.refusals = host.runRefusals(assets.get(FAMILY_NAMES[0]), receipt => { checkRetained(before); requireFact(receipt, 'Actual refusal receipt missing'); }, assets.get('cold_candidate_reedit').request); requireFact(evidence.refusals.length === 24, 'Expected 24 genuine refusals'); checkRetained(before); document.querySelector('#status').textContent = 'All 24 refusals retained the complete file, resources, camera and full frame.'; setButtons(['transport']); }));
document.querySelector('#transport').addEventListener('click', () => action(async () => { const before = retained(); let requests = (await ledger()).length; evidence.transport = await host.runTransportRefusals(dataURL(FAMILY_NAMES[0] + '.complete-original.source0.css'), async receipt => { checkRetained(before); const count = (await ledger()).length, delta = count - requests, expected = [0, 1, 1, 1, 0][evidence.requestDeltas.length]; requireFact(delta === expected, 'Actual per-case HTTP request count differs'); evidence.requestDeltas.push({ name: receipt.name, requests: delta }); requests = count; checkRetained(before); }); requireFact(evidence.transport.length === 5, 'Expected five actual transport refusals'); document.querySelector('#status').textContent = 'Transport refusals retained the original accepted data and full frame.'; setButtons(['edits']); }));
document.querySelector('#edits').addEventListener('click', () => action(async () => {
  host.apply(assets.get(FAMILY_NAMES[0])); await waitAdmission(); coldBefore = retained(); let asset = await freshAsset(FAMILY_NAMES[0]); await host.coldReopen(asset, dataURL(asset.family + '.complete-candidate.source0.css')); await waitAdmission();
  document.querySelector('#status').textContent = 'Cold quartic candidate matches the complete native context and frame.'; setButtons(['reedit']);
}));
document.querySelector('#reedit').addEventListener('click', () => action(async () => {
  coldBefore = retained(); host.apply(assets.get('cold_candidate_reedit')); await waitAdmission(); coldBefore = retained(); const asset = await freshAsset('cold_candidate_reedit'); await host.coldReopen(asset, dataURL(asset.family + '.complete-candidate.source0.css')); await waitAdmission();
  document.querySelector('#status').textContent = 'Saved candidate was re-edited and cold reopened. Full context and frame are exact.'; setButtons(['families']);
}));
document.querySelector('#families').addEventListener('click', () => action(async () => {
  for (const name of ['quintic_actual_native_profile', 'exact_noop_unusual_decimal_minus_zero', 'real_minus_zero_coordinate_edit', 'actual_64_poles_all_256_fields_changed']) { host.loadOriginal(assets.get(name)); await waitAdmission(); host.apply(assets.get(name)); await waitAdmission(); }
  requireFact(evidence.history.length === 13 && evidence.cold.length === 2 && evidence.HTTPpins.length === 32, 'Whole-file edit/cold flow count differs'); document.querySelector('#status').textContent = 'All six complete files and their edits are accepted. Both cold reopenings match the complete context and frame.'; setButtons(['cleanup']);
}));
document.querySelector('#cleanup').addEventListener('click', () => action(async () => { const history = host.records.map(record => structuredClone(record.readout)); host.dispose(); host.dispose(); await waitAdmission(); const pixels = frame(); let greenPixels = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 40 && pixels[i + 1] > 200 && pixels[i + 2] < 40) greenPixels++; requireFact(host.accepted === null && host.allResources.length === 14 && host.counts.livePairs === 0 && host.counts.peakLivePairs === 2 && evidence.callbacks === 14 && host.allResources.every(row => row.meshDisposals === 1 && row.geometryDisposals === 1 && row.materialDisposals === 1) && caller().retained && greenPixels > 0, 'Owned cleanup or caller retention differs'); host.records.forEach((record, i) => assertNative(record.readout, history[i], 'Full native CPU readout after dispose')); evidence.serverRequests = await ledger(); requireFact(evidence.serverRequests.length === 37, 'Final actual original-file request count differs'); for (const key of ['line', 'geometry', 'material']) requireFact(new Set(host.allResources.map(row => row[key])).size === 14, 'Fourteen distinct owned ' + key + ' resources required'); evidence.cleanup = { triples: 14, pairs: 14, doubleCall: true, greenPixels, fullNativeCPUReadable: true, callerRetained: true }; document.querySelector('#status').textContent = 'Owned geometry and material released once. Complete native files and edit proofs remain readable; the caller survives.'; document.querySelector('#evidence').textContent = JSON.stringify({ counts: host.counts, cleanup: evidence.cleanup, caller: caller() }, null, 2); setButtons([]); }));
window.addEventListener('error', event => evidence.runtimeErrors.push({ type: 'window-error', message: event.message }));
window.addEventListener('unhandledrejection', event => evidence.runtimeErrors.push({ type: 'promise-error', message: String(event.reason) }));
try { requireFact(gl instanceof WebGL2RenderingContext, 'Actual WebGL2 required'); await Promise.all(PINS.map(async pin => rawTexts.set(pin.file, await fetchPin(pin)))); assets = await loadCurveEditAssets(file => rawTexts.get(file)); evidence.focusedRuntime = await runSelectedUniformCurveBabylonRuntimeCheckpoint(assets.get(FAMILY_NAMES[0]), scene); host = createSourceCurveControlPolygonBabylonHost({ scene, onChange(record) { evidence.callbacks++; observationQueue = observationQueue.then(async () => { if (record) await scene.whenReadyAsync(); observe(record); }); } }); host.loadOriginal(assets.get(FAMILY_NAMES[0])); await waitAdmission(); evidence.ready = true; document.documentElement.dataset.loader1160Ready = 'true'; document.querySelector('#status').textContent = 'Complete original quartic file and selected Curve loaded.'; setButtons(['refusals']); } catch (error) { failed(error); }
