import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Camera } from '@babylonjs/core/Cameras/camera.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { CASE_KEYS, PINS, loadCase, proveCase, requireFact, assertNative, assertBuffer } from './multispan-section-babylon-fixture.mjs';
import { createMultiSpanSectionBabylonHost } from './multispan-section-babylon-checkpoint.mjs';
const width = 900, height = 640, mode = document.documentElement.dataset.loader1222Mode ?? 'source';
performance.setResourceTimingBufferSize(2048);
const rawTexts = new Map(), assets = new Map();
const callerDisposals = { engine: 0, scene: 0, camera: 0, light: 0, marker: 0, geometry: 0, material: 0, canvasRemoval: 0 };
const evidence = { mode, ready: false, phase: 'boot', error: null, HTTPpins: [], history: [], refusals: null, transport: null, requestDeltas: [], callbacks: 0, glErrors: [], runtimeErrors: [], cold: null, cleanup: null };
let host, busy = true, coldBefore, engine, scene, camera, light, marker, markerGeometry, markerMaterial, canvas, gl, fixedCamera, observationQueue = Promise.resolve();
async function waitAdmission() { await observationQueue; }
function setupCaller() {
  // Same once-derived caller setup as the actual private prerequisite, from both original native preview families.
  const proofs = CASE_KEYS.map(key => proveCase(assets.get(key)));
  canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; canvas.style.width = `${width}px`; canvas.style.height = `${height}px`; document.querySelector('#view').append(canvas);
  engine = new Engine(canvas, false, { preserveDrawingBuffer: true, stencil: true }); engine.setHardwareScalingLevel(1);
  scene = new Scene(engine); scene.useRightHandedSystem = true; scene.clearColor = new Color4(16 / 255, 27 / 255, 44 / 255, 1);
  const points = proofs.flatMap(proof => [proof.nativeWorld.positions, ...proof.nativeParents.flatMap(parent => parent.surfaces.map(surface => surface.mesh.positions))].flatMap(array => Array.from({ length: array.length / 3 }, (_, index) => new Vector3(array[index * 3], array[index * 3 + 1], array[index * 3 + 2]))));
  const min = [0, 1, 2].map(axis => Math.min(...points.map(point => [point.x, point.y, point.z][axis]))), max = [0, 1, 2].map(axis => Math.max(...points.map(point => [point.x, point.y, point.z][axis])));
  const center = new Vector3(...min.map((value, axis) => (value + max[axis]) / 2)), span = Math.max(...min.map((value, axis) => max[axis] - value));
  camera = new FreeCamera('caller-camera', center.add(new Vector3(span * 1.4, -span * 1.2, span * 1.6)), scene); camera.upVector = new Vector3(0, 1, 0); camera.setTarget(center); camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  camera.minZ = Math.max(span / 10000, .000001); camera.maxZ = span * 20 + 1; scene.activeCamera = camera;
  light = new HemisphericLight('caller-light', new Vector3(0, 1, 0), scene); light.intensity = .9;
  marker = MeshBuilder.CreateSphere('caller-marker', { diameter: span * .018, segments: 8 }, scene); marker.position = center.add(new Vector3(-span * .55, span * .4, span * .35));
  markerGeometry = marker.geometry; markerMaterial = new StandardMaterial('caller-green', scene); markerMaterial.disableLighting = true; markerMaterial.diffuseColor = Color3.Black(); markerMaterial.specularColor = Color3.Black(); markerMaterial.emissiveColor = new Color3(0, 1, 0); marker.material = markerMaterial;
  const matrix = marker.computeWorldMatrix(true), vertices = marker.getVerticesData('position');
  for (let index = 0; index < vertices.length; index += 3) points.push(Vector3.TransformCoordinates(new Vector3(vertices[index], vertices[index + 1], vertices[index + 2]), matrix));
  const view = camera.getViewMatrix(true), projected = points.map(point => Vector3.TransformCoordinates(point, view)), halfY = 1.15 * Math.max(...projected.map(point => Math.max(Math.abs(point.y), Math.abs(point.x) * height / width)));
  camera.orthoLeft = -halfY * width / height; camera.orthoRight = halfY * width / height; camera.orthoTop = halfY; camera.orthoBottom = -halfY; camera.getProjectionMatrix(true);
  fixedCamera = cameraState(); evidence.cameraDerivation = { originalBounds: { min, max }, center: center.asArray(), span, projectionSites: points.length, fixedAcrossFamiliesAndCold: true };
  for (const [name, object] of Object.entries({ engine, scene, camera, light, marker, material: markerMaterial })) object.onDisposeObservable.add(() => callerDisposals[name]++);
  const originalGeometryDispose = markerGeometry.dispose; markerGeometry.dispose = function (...args) { callerDisposals.geometry++; return originalGeometryDispose.apply(this, args); };
  const originalRemove = canvas.remove; canvas.remove = function (...args) { callerDisposals.canvasRemoval++; return originalRemove.apply(this, args); };
  gl = canvas.getContext('webgl2'); requireFact(gl instanceof WebGL2RenderingContext, 'Actual Babylon WebGL2 required');
}
const nativeJSON = value => JSON.stringify(value, (_key, item) => typeof item === 'number' && Object.is(item, -0) ? JSON.rawJSON('-0') : item, 2);
const same = (a, b) => a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
function negativeZeroPaths(value, path = '') {
  if (typeof value === 'number') return Object.is(value, -0) ? [path] : [];
  if (value === null || typeof value !== 'object') return [];
  return Object.keys(value).flatMap(key => negativeZeroPaths(value[key], Array.isArray(value) || ArrayBuffer.isView(value) ? `${path}[${key}]` : path ? `${path}.${key}` : key));
}
function cameraState() { return camera ? { position: camera.position.asArray(), rotation: camera.rotation.asArray(), quaternion: camera.rotationQuaternion?.asArray() ?? null,
  projection: Array.from(camera.getProjectionMatrix(true).asArray()), view: Array.from(camera.getViewMatrix(true).asArray()), bounds: [camera.orthoLeft, camera.orthoRight, camera.orthoTop, camera.orthoBottom, camera.minZ, camera.maxZ], rightHanded: scene.useRightHandedSystem } : null; }
function caller() { return { retained: !!gl && !engine.isDisposed && !scene.isDisposed && !camera.isDisposed() && !light.isDisposed() && !marker.isDisposed() && scene.activeCamera === camera && scene.useRightHandedSystem === true && marker.geometry === markerGeometry && marker.material === markerMaterial && canvas.isConnected && !gl.isContextLost() && Object.values(callerDisposals).every(value => value === 0), disposals: { ...callerDisposals }, sceneMeshes: scene?.meshes.length ?? null }; }
function frame() { requireFact(scene.isReady(), 'Actual Scene shader readiness required'); scene.render(); const bytes = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, bytes); const error = gl.getError(); evidence.glErrors.push(error); requireFact(error === gl.NO_ERROR && caller().retained, 'Actual WebGL/caller preservation failure'); assertNative(cameraState(), fixedCamera, 'Fixed caller camera'); return bytes; }
function hash(bytes) { let value = 2166136261; for (const byte of bytes) value = Math.imul(value ^ byte, 16777619) >>> 0; return value; }
function changed(a, b) { let count = 0; for (let index = 0; index < a.length; index += 4) if (a[index] !== b[index] || a[index + 1] !== b[index + 1] || a[index + 2] !== b[index + 2]) count++; return count; }
function green(bytes) { let count = 0; for (let index = 0; index < bytes.length; index += 4) if (bytes[index] < 40 && bytes[index + 1] > 200 && bytes[index + 2] < 40) count++; return count; }
function sourceGraph() {
  const urls = [...new Set(performance.getEntriesByType('resource').map(row => row.name))], source = urls.filter(url => /packages\/barocss-(cad|cad-interop)\/src\//.test(url)), dist = urls.filter(url => /packages\/barocss-(cad|cad-interop)\/dist\//.test(url)), published = urls.filter(url => url.includes('/loader1222-published.mjs'));
  const sectionModules = urls.filter(url => /multispan-vlinear-plane-section\.(ts|js)(\?|$)/.test(url));
  if (mode === 'source') requireFact(source.length > 0 && dist.length === 0 && sectionModules.length > 0, 'Observed original public source and actual provider module required'); else requireFact(source.length === 0 && published.length > 0, 'Published bundle with no source fallback required');
  return { mode, source, dist, published, sectionModules };
}
function resourceValues(record) {
  return record.resources.map(row => ({ role: row.role, name: row.mesh.name, attributes: row.attributes.map(value => ({ name: value.name, values: Array.from(row.mesh.getVerticesData(value.name)) })),
    indices: Array.from(row.mesh.getIndices()), nativeUVMetadata: row.mesh.metadata?.barocss?.nativeParameters ? Array.from(row.mesh.metadata.barocss.nativeParameters) : null }));
}
function updateReadout(record) {
  const native = record.worldNative, report = record.proof.report;
  document.querySelector('#context').textContent = `Original family: ${record.assetKey} / ${record.state}\nWorld Model: ${native.model.name}; Curve: ${native.curveId}; degree ${native.model.objects[0].degree}; poles ${native.model.objects[0].controlPoints.length}\nOriginal native domain: ${nativeJSON(native.domain)}; uniform display samples ${native.parameters.length}; intervals ${native.intervals.length}\nParent full object IDs: ${nativeJSON(record.parentNatives.map(value => value.model.objects.map(object => object.kind + ':' + object.id)))}\nUnrendered original Curve IDs: ${nativeJSON(record.parentNatives.map(value => value.unrenderedCurveIds))}\nNative span count: ${report.spanCount}; derivative unions: ${nativeJSON(record.proof.derivativeCounts)}\nOriginal XYZ, identity pose, .001 scene units/mm once. DualUV stays dimensionless native CPU data. Original signed-zero paths: ${negativeZeroPaths(record.asset.owned).length}`;
  document.querySelector('#sources').textContent = nativeJSON({ world: record.asset.worldSource, surface: record.asset.parentSources[0], plane: record.asset.parentSources[1] });
  document.querySelector('#full-readout').textContent = nativeJSON(record.readout);
  document.querySelector('#quality').textContent = nativeJSON({ uniformDisplay: native.quality, nativeSectionQuality: report.quality ?? null, derivativeCounts: record.proof.derivativeCounts,
    parentDisplay: '17×9 approximate D0 triangle meshes; native grid UV metadata, no uploaded texture UV', displayNormalsAreApproximate: true, noAdaptiveOrTopologyCertificate: true });
  const rows = document.querySelector('#observations'); rows.replaceChildren();
  for (const observation of record.proof.section.observations) {
    const summary = { worldMM: observation.world.d0, surfaceUV: observation.surfacePcurve.d0, planeUV: observation.planePcurve.d0,
      derivatives: Object.fromEntries(['world', 'surfacePcurve', 'planePcurve', 'surface', 'plane'].map(role => [role, { status: observation[role].d1.status, reason: observation[role].d1.reason ?? null }])) };
    const row = document.createElement('tr'); for (const value of [String(observation.parameter), nativeJSON(summary)]) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); } rows.append(row);
  }
  document.querySelector('#evidence').textContent = nativeJSON({ counts: host.counts, history: evidence.history, cold: evidence.cold, cleanup: evidence.cleanup, caller: caller() });
}
function observe(record) {
  if (!record) { frame(); return; }
  requireFact(record.resources.every(row => scene.meshes.includes(row.mesh) && row.mesh.parent === null && row.mesh.isEnabled() && row.material.isReady(row.mesh)), 'Actual registered original meshes and material shaders must be ready');
  assertNative(record.proof.section, record.asset.owned, 'Whole original section retained'); assertNative(record.worldNative.model, record.proof.section.world.model);
  const pixels = frame(); record.worldResult.line.setEnabled(false); let withoutWorld;
  try { withoutWorld = frame(); } finally { record.worldResult.line.setEnabled(true); }
  requireFact(same(frame(), pixels), 'World on/off observation must restore complete frame');
  const worldPixels = changed(pixels, withoutWorld), greenPixels = green(pixels); requireFact(worldPixels > 0 && greenPixels > 0, 'Actual World trace or caller marker absent');
  if (record.state === 'cold-reopen') {
    requireFact(coldBefore && same(pixels, coldBefore.pixels), 'Cold complete RGBA differs'); assertNative(record.readout, coldBefore.readout, 'Cold whole original readout'); assertNative(resourceValues(record), coldBefore.values, 'Cold all actual target attributes');
    evidence.cold = { originalReadoutExact: true, targetAttributesExact: true, fullRGBAExact: true, sourceFiles: 7, adapterSourceRequests: 3 };
  } else if (evidence.history.length > 0) requireFact(changed(pixels, evidence.firstPixels) > 0, 'Two original section frames must differ');
  if (evidence.history.length === 0) evidence.firstPixels = pixels;
  evidence.history.push({ key: record.assetKey, state: record.state, frameHash: hash(pixels), worldPixels, greenPixels, pairs: record.resources.length, uniqueMaterials: new Set(record.resources.map(row => row.material)).size,
    nativeDomain: [...record.worldNative.domain], derivativeCounts: record.proof.derivativeCounts, originalNegativeZeroPaths: negativeZeroPaths(record.asset.owned) }); updateReadout(record);
}
function retained() {
  const record = host.accepted; return { record, readout: structuredClone(record.readout), pixels: frame(), values: resourceValues(record), callbacks: evidence.callbacks,
    collections: Object.fromEntries(['meshes', 'geometries', 'materials', 'cameras', 'lights'].map(key => [key, [...scene[key]]])),
    targets: record.resources.map(row => ({ row, mesh: row.mesh, geometry: row.mesh.geometry, material: row.mesh.material,
      attributes: row.attributes.map(value => ({ name: value.name, vertexBuffer: row.geometry.getVertexBuffer(value.name), array: row.mesh.getVerticesData(value.name) })), indices: row.mesh.getIndices(), metadata: row.mesh.metadata, nativeUV: row.mesh.metadata?.barocss?.nativeParameters ?? null })) };
}
function checkRetained(before) {
  const record = host.accepted; requireFact(record === before.record && before.callbacks === evidence.callbacks && same(frame(), before.pixels), 'Refusal changed original/callback/full RGBA');
  assertNative(record.readout, before.readout); assertNative(resourceValues(record), before.values);
  for (const [key, list] of Object.entries(before.collections)) requireFact(scene[key].length === list.length && list.every((object, index) => scene[key][index] === object), 'Refusal changed actual Scene ' + key);
  for (const target of before.targets) { requireFact(target.mesh === target.row.mesh && target.mesh.geometry === target.geometry && target.mesh.material === target.material && target.mesh.getIndices() === target.indices && target.mesh.metadata === target.metadata && (target.mesh.metadata?.barocss?.nativeParameters ?? null) === target.nativeUV, 'Refusal changed actual mesh/geometry/material/index/metadata references');
    for (const attribute of target.attributes) requireFact(target.geometry.getVertexBuffer(attribute.name) === attribute.vertexBuffer && target.mesh.getVerticesData(attribute.name) === attribute.array, 'Refusal changed actual vertex references'); }
}
function dataURL(file) { return new URL(file, location.href).href; }
async function fetchPin(pin) { const response = await fetch(dataURL(pin.file)); requireFact(response.ok, 'Original HTTP file refused'); const bytes = new Uint8Array(await response.arrayBuffer()), sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join(''); requireFact(bytes.length === pin.bytes && sha256 === pin.sha256, 'Original bytes or SHA differ'); const contentType = response.headers.get('content-type'), contentLength = response.headers.get('content-length'); requireFact(contentLength === String(pin.bytes) && (!pin.file.endsWith('.css') || contentType === 'text/plain; charset=utf-8'), 'Original HTTP metadata differs'); evidence.HTTPpins.push({ file: pin.file, bytes: bytes.length, sha256, status: response.status, contentType, contentLength }); return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
async function ledger() { const response = await fetch('/loader1222-request-log.json', { cache: 'no-store' }); requireFact(response.ok, 'Actual request ledger unavailable'); return response.json(); }
function setButtons(enabled) { for (const id of ['refusals', 'transport', 'nonuniform', 'cold', 'cleanup']) document.querySelector('#' + id).disabled = !enabled.includes(id); }
function failure(error) { evidence.error = { name: error.name, code: error.code ?? null, message: error.message, stack: error.stack }; evidence.runtimeErrors.push(evidence.error); evidence.ready = false; document.documentElement.dataset.loader1222Ready = 'false'; document.querySelector('#status').textContent = error.message; setButtons([]); console.error(error); }
async function action(operation) { if (busy || !evidence.ready || evidence.error || evidence.cleanup) return; busy = true; setButtons([]); try { await operation(); } catch (error) { failure(error); } finally { busy = false; } }
function mark(phase, message, buttons) { evidence.phase = phase; document.querySelector('#status').textContent = message; setButtons(buttons); }
Object.defineProperty(window, 'loader1222', { configurable: false, writable: false, value: Object.freeze({ snapshot: () => {
  const { firstPixels, ...safeEvidence } = evidence;
  return structuredClone({ ...safeEvidence, busy, counts: host?.counts, caller: caller(), camera: cameraState(), sourceGraph: evidence.ready ? sourceGraph() : null,
    environment: { babylon: '9.29.0', userAgent: navigator.userAgent, devicePixelRatio, canvasSize: canvas ? [canvas.width, canvas.height] : null },
    accepted: host?.accepted ? { assetKey: host.accepted.assetKey, state: host.accepted.state, asset: host.accepted.asset, proof: host.accepted.proof, readout: host.accepted.readout } : null,
    retainedLast: evidence.cleanup ? { asset: host.records.at(-1).asset, proof: host.records.at(-1).proof, readout: host.records.at(-1).readout } : null,
    materials: host?.allMaterials.map(row => ({ uniqueId: row.material.uniqueId, disposals: row.disposals })),
    resources: host?.allResources.map(row => ({ role: row.role, name: row.mesh.name, meshUniqueId: row.mesh.uniqueId, geometryId: row.geometry.id, geometryUniqueId: row.geometry.uniqueId, materialUniqueId: row.material.uniqueId,
      meshDisposals: row.meshDisposals, geometryDisposals: row.geometryDisposals, materialDisposals: row.materialDisposals,
      cachedAttributes: row.attributes.map(value => ({ name: value.name, values: value.values })), indices: row.indices, nativeUVMetadata: row.nativeUV,
      currentPositionData: row.geometry.getVerticesData('position') ? Array.from(row.geometry.getVerticesData('position')) : null })) });
} }) });
document.querySelector('#refusals').addEventListener('click', () => action(async () => { const before = retained(); evidence.refusals = host.runRefusals(assets.get(CASE_KEYS[0]), () => checkRetained(before)); requireFact(evidence.refusals.refusals.length === 18 && evidence.refusals.getterCalls === 0, 'Eighteen actual refusals/getter0 required'); mark('refusals', 'Eighteen real refusals retain the whole native section, targets and frame.', ['transport']); }));
document.querySelector('#transport').addEventListener('click', () => action(async () => { const before = retained(); let prior = (await ledger()).length; evidence.transport = await host.runTransportRefusals(dataURL(assets.get(CASE_KEYS[0]).pins.find(pin => pin.file.endsWith('.actual-world.source0.css')).file), async receipt => { checkRetained(before); const count = (await ledger()).length, delta = count - prior, expected = [0, 1, 1, 1, 0][evidence.requestDeltas.length]; requireFact(delta === expected, 'Actual per-case source request delta differs'); evidence.requestDeltas.push({ name: receipt.name, requests: delta }); prior = count; }); requireFact(evidence.transport.refusals.length === 5 && evidence.transport.getterCalls === 0, 'Five real transport refusals required'); mark('transport', 'Shared transport retains original section and full frame.', ['nonuniform']); }));
document.querySelector('#nonuniform').addEventListener('click', () => action(async () => { host.load(assets.get(CASE_KEYS[1])); await waitAdmission(); requireFact(evidence.history.length === 2, 'Second original admission required'); mark('nonuniform', 'Nonuniform original section retains complete parent Models and dualUV.', ['cold']); }));
document.querySelector('#cold').addEventListener('click', () => action(async () => {
  const previousAsset = assets.get(CASE_KEYS[1]), texts = new Map(rawTexts); requireFact(previousAsset.pins.length === 7, 'Seven complete original files required');
  await Promise.all(previousAsset.pins.map(async pin => texts.set(pin.file, await fetchPin(pin)))); const asset = await loadCase(CASE_KEYS[1], file => texts.get(file)); coldBefore = retained();
  const sourcePin = suffix => asset.pins.find(pin => pin.file.endsWith(suffix)).file;
  await host.coldReopen(asset, { world: dataURL(sourcePin('.actual-world.source0.css')), surface: dataURL(sourcePin('shifted_source.original.source0.css')), plane: dataURL(sourcePin('shift_plane_source.original.source0.css')) }); await waitAdmission();
  requireFact(evidence.cold && evidence.history.length === 3 && evidence.HTTPpins.length === 21, 'Cold original full-file checkpoint missing'); mark('cold', 'Cold World and both complete parents match native readout, all target attributes and full frame.', ['cleanup']);
}));
document.querySelector('#cleanup').addEventListener('click', () => action(async () => {
  const cpu = host.records.map(record => structuredClone(record.readout)); host.dispose(); host.dispose(); await waitAdmission(); const pixels = frame(), counts = host.counts;
  requireFact(host.accepted === null && host.allResources.length === 10 && host.allMaterials.length === 9 && counts.peakLiveMeshes === 7 && counts.peakLiveGeometry === 7 && counts.peakLiveMaterials === 6 && counts.liveMeshes === 0 && counts.liveGeometry === 0 && counts.liveMaterials === 0 && evidence.callbacks === 4 && green(pixels) > 0 && caller().retained, 'Actual shared-material/caller cleanup differs');
  requireFact(host.allResources.every(row => row.meshDisposals === 1 && row.geometryDisposals === 1) && host.allMaterials.every(row => row.disposals === 1), 'Each actual mesh/geometry and unique material must release once');
  for (const field of ['mesh', 'geometry']) requireFact(new Set(host.allResources.map(row => row[field])).size === 10, 'Ten distinct captured mesh/geometry required');
  host.records.forEach((record, index) => assertNative(record.readout, cpu[index], 'Whole native data after cleanup')); evidence.serverRequests = await ledger(); requireFact(evidence.serverRequests.length === 27, 'Actual original-file request count differs');
  evidence.cleanup = { meshes: 10, geometry: 10, uniqueMaterials: 9, callbacks: 4, doubleCall: true, greenPixels: green(pixels), fullNativeCPUReadable: true, callerRetained: true }; mark('cleanup', 'Ten meshes/geometries and nine unique materials released once; original CPU and caller remain.', []);
  document.querySelector('#evidence').textContent = nativeJSON({ counts, cleanup: evidence.cleanup, caller: caller() });
}));
window.addEventListener('error', event => evidence.runtimeErrors.push({ type: 'window-error', message: event.message })); window.addEventListener('unhandledrejection', event => evidence.runtimeErrors.push({ type: 'promise-error', message: String(event.reason) }));
try {
  requireFact(typeof JSON.rawJSON === 'function', 'Actual signed-zero JSON display required');
  await Promise.all(PINS.map(async pin => rawTexts.set(pin.file, await fetchPin(pin)))); for (const key of CASE_KEYS) assets.set(key, await loadCase(key, file => rawTexts.get(file)));
  setupCaller();
  host = createMultiSpanSectionBabylonHost({ scene, onChange(record) { evidence.callbacks++; observationQueue = observationQueue.then(async () => { await scene.whenReadyAsync(); requireFact(scene.isReady(), 'Actual Scene readiness required'); observe(record); }); } });
  host.load(assets.get(CASE_KEYS[0])); await waitAdmission(); evidence.ready = true; document.documentElement.dataset.loader1222Ready = 'true'; sourceGraph(); mark('initial', 'Original warped four-span section and whole parent previews loaded.', ['refusals']);
} catch (error) { failure(error); } finally { busy = false; }
