import * as THREE from 'three';
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import { PINS, CASE_KEYS, loadCase, createParentOptions, assertNative, assertBuffer, requireFact, errorReceipt } from './exact-lower-strip-face-three-fixture.mjs';
import { createExactLowerStripFaceThreeHost } from './exact-lower-strip-face-three-checkpoint.mjs';
import { createExactLowerStripFaceThreeObserver } from './exact-lower-strip-face-three-observer.mjs';

const width = 900, height = 640;
const evidence = { ready: false, busy: false, error: null, sourceMode: document.documentElement.dataset.loader1299Mode ?? 'source', environment: null,
  pins: [], phases: [], sourceRefusals: null, transportRefusals: null, cold: null, cleanup: null, GL: [], runtimeErrors: [] };
const phaseRGBA = new Map(), texts = new Map(), assets = new Map(), controls = ['negatives', 'transport', 'high', 'cold', 'cleanup'];
let nextAction = 'negatives', host, observer, renderer, scene, camera, callerMarker, fixedCamera;
const callerCounters = { geometryDisposals: 0, materialDisposals: 0, rendererDisposals: 0, canvasRemovals: 0 };
const getCallerCounters = () => ({ ...callerCounters });
const getCameraState = () => ({ position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), projection: [...camera.projectionMatrix.elements], matrix: [...camera.matrixWorld.elements], near: camera.near, far: camera.far, left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom });
const hash = values => { let value = 2166136261; for (const byte of values) value = Math.imul(value ^ byte, 16777619) >>> 0; return value; };
function green(values) { let count = 0; for (let i = 0; i < values.length; i += 4) if (values[i] < 40 && values[i + 1] > 200 && values[i + 2] < 40) count++; return count; }
function changed(a, b) { let count = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) count++; return count; }
function encodeRGBA(values) { const parts = []; for (let offset = 0; offset < values.length; offset += 32768) parts.push(String.fromCharCode(...values.subarray(offset, offset + 32768))); return btoa(parts.join('')); }
function draw(label) {
  renderer.render(scene, camera); const gl = renderer.getContext(), values = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, values); const code = gl.getError(); evidence.GL.push({ label, code }); requireFact(code === 0, 'Actual WebGL error'); assertNative(getCameraState(), fixedCamera, 'fixed-caller-camera'); return values;
}
function preview(label) {
  const record = host.accepted, visible = draw(label + ':visible'); record.result.group.visible = false;
  let hidden; try { hidden = draw(label + ':caller-only'); } finally { record.result.group.visible = true; }
  const restored = draw(label + ':restored'); assertBuffer(restored, visible, label + ':full-RGBA-restored');
  const surfacePixels = changed(visible, hidden), callerPixels = green(visible); requireFact(surfacePixels > 0 && callerPixels > 0, 'Original Support and caller must have visible pixels');
  return { values: visible, frame: { width, height, hash: hash(visible), callerOnlyHash: hash(hidden), surfacePixels, callerPixels, fullRGBARestored: true } };
}
function recordPhase(label, rendered = null) {
  const output = rendered ?? preview(label); phaseRGBA.set(label, output.values); evidence.phases.push({ label, frame: output.frame, observation: observer.snapshot() });
  document.getElementById('receipts').textContent = JSON.stringify({ counts: host.counts, sourceRefusals: evidence.sourceRefusals, transportRefusals: evidence.transportRefusals, cold: evidence.cold, cleanup: evidence.cleanup, frames: evidence.phases.map(phase => ({ label: phase.label, ...phase.frame })) }, null, 2);
}
function appendRow(table, values) { const tr = document.createElement('tr'); for (const value of values) { const td = document.createElement('td'); td.textContent = value; td.style.whiteSpace = 'pre-wrap'; tr.append(td); } table.append(tr); }
function d1Text(state) { return state.status === 'evaluated' ? 'evaluated' : 'native-refused\n' + state.nativeErrorName + ': ' + state.reason; }
function displayNative() {
  const record = host.accepted; if (!record) return;
  const wall = record.wall, face = wall.face, uses = document.getElementById('uses'), observations = document.getElementById('observations'); uses.replaceChildren(); observations.replaceChildren();
  document.getElementById('face-summary').textContent = face.sourceId + '/' + face.surfaceId + '/' + face.id + ' · ' + face.orientation + ' · original loop ' + face.outerLoopId + '. The five-object model retains one Support and four unrendered Curves.';
  for (const row of record.proof.edgeRows) appendRow(uses, [face.sourceId + '/' + face.surfaceId + '/' + face.id + '\n' + row.use.id, row.edge.role + ' / ' + row.edge.id + '\nCurve ' + row.edge.curve.id + ', degree ' + row.edge.curve.degree, row.use.sense + '\n[' + row.use.interval.join(', ') + ']\nvertices ' + row.use.vertexIds.join(' → '), row.edge.pcurve.curve.id + '\n' + row.edge.pcurve.coordinateSystem + ' / ' + row.edge.pcurve.lengthUnit]);
  for (const row of wall.observations) appendRow(observations, [row.edgeId + '\nparameter ' + row.parameter, d1Text(row.world.d1), d1Text(row.pcurve.d1), d1Text(row.surface.d1), 'point gap mm: ' + row.residuals.pointGapMM + '\nrelative chain gap: ' + row.residuals.relativeChainGap]);
  document.getElementById('native').textContent = JSON.stringify(record.readout, (_key, value) => typeof value === 'number' && Object.is(value, -0) ? JSON.rawJSON('-0') : value, 2);
}
function updateControls() { for (const id of controls) document.getElementById(id).disabled = !evidence.ready || evidence.busy || evidence.error !== null || id !== nextAction; }
function fail(error) { evidence.error = errorReceipt('browser-flow', error); console.error(error); document.getElementById('status').textContent = error.message; updateControls(); }
window.addEventListener('error', event => evidence.runtimeErrors.push(event.message)); window.addEventListener('unhandledrejection', event => evidence.runtimeErrors.push(String(event.reason)));
Object.defineProperty(window, 'loader1299Evidence', { configurable: false, writable: false, value: Object.freeze({
  snapshot(includeRGBA = false) { const result = structuredClone({ ...evidence, current: observer?.snapshot() ?? null, camera: camera ? getCameraState() : null, caller: getCallerCounters() });
    if (includeRGBA) for (const phase of result.phases) { phase.frame.rgba = encodeRGBA(phaseRGBA.get(phase.label)); phase.frame.rgbaEncoding = 'base64'; }
    return result;
  }
}) });
async function readOriginal(file, pin, fresh = false) {
  if (!fresh && texts.has(file)) return texts.get(file); const index = evidence.pins.length; evidence.pins.push(null);
  const response = await fetch(new URL(file, location.href), { cache: 'no-store' }), bytes = new Uint8Array(await response.arrayBuffer()), sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
  const contentType = response.headers.get('content-type'), expectedType = file.endsWith('.css') ? 'text/plain' : 'application/json';
  requireFact(response.status === 200 && bytes.length === pin.bytes && sha256 === pin.sha256 && response.headers.get('content-length') === String(pin.bytes) && contentType?.startsWith(expectedType), 'Original status/bytes/SHA/length/MIME changed: ' + file);
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); evidence.pins[index] = { ...pin, status: response.status, contentType, contentLength: response.headers.get('content-length'), fresh }; if (!fresh) texts.set(file, text); return text;
}
async function requestCount() { const response = await fetch('/loader1299-request-log.json', { cache: 'no-store' }); requireFact(response.ok, 'Original request ledger unavailable'); const rows = await response.json(); requireFact(Array.isArray(rows), 'Original request ledger must be an array'); return rows.length; }
function setupCamera(natives) {
  const points = natives.flatMap(native => { const positions = native.surfaces[0].mesh.positions; return Array.from({ length: positions.length / 3 }, (_, i) => new THREE.Vector3(...positions.slice(i * 3, i * 3 + 3))); });
  const box = new THREE.Box3().setFromPoints(points), center = box.getCenter(new THREE.Vector3()), span = Math.max(...box.getSize(new THREE.Vector3()).toArray());
  const geometry = new THREE.SphereGeometry(span * .011, 8, 6), material = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); callerMarker = new THREE.Mesh(geometry, material); callerMarker.position.copy(center).add(new THREE.Vector3(-.6, .35, .25).multiplyScalar(span)); scene.add(callerMarker);
  geometry.addEventListener('dispose', () => callerCounters.geometryDisposals++); material.addEventListener('dispose', () => callerCounters.materialDisposals++); const disposeRenderer = renderer.dispose; renderer.dispose = function (...args) { callerCounters.rendererDisposals++; return disposeRenderer.apply(this, args); };
  const canvas = renderer.domElement; new MutationObserver(() => { if (!canvas.isConnected) callerCounters.canvasRemovals++; }).observe(document.body, { childList: true, subtree: true });
  camera = new THREE.OrthographicCamera(-span * width / height, span * width / height, span, -span, .0001, 1); camera.position.copy(center).add(new THREE.Vector3(1.2, -1.3, 1.7).multiplyScalar(span)); camera.lookAt(center); camera.updateMatrixWorld(true);
  const markerPositions = geometry.getAttribute('position'); for (let i = 0; i < markerPositions.count; i++) points.push(new THREE.Vector3().fromBufferAttribute(markerPositions, i).add(callerMarker.position));
  const halfY = 1.18 * Math.max(...points.map(point => { const local = point.clone().applyMatrix4(camera.matrixWorldInverse); return Math.max(Math.abs(local.y), Math.abs(local.x) * height / width); }));
  camera.left = -halfY * width / height; camera.right = halfY * width / height; camera.top = halfY; camera.bottom = -halfY; camera.updateProjectionMatrix(); const ndc = points.map(point => point.clone().project(camera).toArray()); requireFact(ndc.every(point => point.every(value => Math.abs(value) < 1)), 'Actual Supports/caller outside fixed camera'); fixedCamera = structuredClone(getCameraState());
  evidence.cameraProfile = { center: center.toArray(), span, halfY, markerPosition: callerMarker.position.toArray(), markerRadius: span * .011, actualNDCSites: points.length, actualNDCMaxXY: Math.max(...ndc.flatMap(point => [Math.abs(point[0]), Math.abs(point[1])])) };
}
async function action(id, operation, next) { requireFact(nextAction === id && evidence.ready && !evidence.busy, 'Original flow order changed'); evidence.busy = true; updateControls(); try { await operation(); nextAction = next; } catch (error) { fail(error); } finally { evidence.busy = false; updateControls(); } }
try {
  await Promise.all(PINS.map(pin => readOriginal(pin.file, pin))); for (const key of CASE_KEYS) assets.set(key, await loadCase(key, (file, pin) => readOriginal(file, pin)));
  renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true }); renderer.setPixelRatio(1); renderer.setSize(width, height); renderer.setClearColor(0x101b2c); document.getElementById('view').append(renderer.domElement); scene = new THREE.Scene();
  setupCamera(CASE_KEYS.map(key => parseBaroCadSource(assets.get(key).modelSource, createParentOptions()))); host = createExactLowerStripFaceThreeHost({ scene, onChange(record) { draw(record ? record.key + ':change' : 'cleanup:change'); } }); host.load(assets.get('low_wall'));
  const gl = renderer.getContext(); requireFact(gl instanceof WebGL2RenderingContext, 'Actual WebGL2 required'); evidence.environment = { three: THREE.REVISION, userAgent: navigator.userAgent, webGL: gl.getParameter(gl.VERSION), canvas: [width, height] };
  observer = createExactLowerStripFaceThreeObserver({ host, scene, camera, renderer, canvas: renderer.domElement, callerMarker, getCameraState, getCallerCounters }); recordPhase('low_wall'); displayNative(); evidence.ready = true; document.documentElement.dataset.loader1299Ready = 'true'; document.getElementById('status').textContent = 'Original low Face and all forty native observations accepted. The Support preview is untrimmed.'; updateControls();
  document.getElementById('negatives').onclick = () => action('negatives', async () => {
    const before = observer.capture(), rgba = draw('source-refusals:before'), retained = [];
    evidence.sourceRefusals = host.runRefusals(assets.get('low_wall'), receipt => { observer.check(before); const after = draw('source-refusals:' + receipt.name); assertBuffer(after, rgba, 'source-refusal-full-RGBA'); retained.push({ name: receipt.name, fullRGBAExact: true, frameHash: hash(after), cameraExact: true, resourcesExact: true }); });
    evidence.sourceRefusals.observations = retained; requireFact(retained.length === 13, 'Thirteen genuine source refusals required'); recordPhase('source-refusals'); document.getElementById('status').textContent = 'Thirteen genuine refusals preserve complete native evidence and the actual frame.';
  }, 'transport');
  const url = key => new URL('exact-lower-strip-face-three-data/' + key + '.actual-model5.source0.css', location.href).href;
  document.getElementById('transport').onclick = () => action('transport', async () => {
    const before = observer.capture(), rgba = draw('transport-refusals:before'), retained = []; let previousRequests = await requestCount();
    evidence.transportRefusals = await host.runTransportRefusals(url('low_wall'), async receipt => { observer.check(before); const after = draw('transport-refusals:' + receipt.name); assertBuffer(after, rgba, 'transport-refusal-full-RGBA'); const currentRequests = await requestCount(), requestDelta = currentRequests - previousRequests; requireFact(requestDelta === receipt.expectedRequestDelta, 'Actual transport request delta changed'); previousRequests = currentRequests; retained.push({ name: receipt.name, requestDelta, fullRGBAExact: true, frameHash: hash(after), cameraExact: true, resourcesExact: true }); });
    evidence.transportRefusals.observations = retained; requireFact(retained.length === 5, 'Five genuine transport refusals required'); recordPhase('transport-refusals'); document.getElementById('status').textContent = 'Five transport refusals preserve the accepted native Face and caller resources.';
  }, 'high');
  document.getElementById('high').onclick = () => action('high', async () => { host.load(assets.get('high_wall')); recordPhase('high_wall'); displayNative(); document.getElementById('status').textContent = 'Original high Face accepted with its reverse Use cycle. Its distinct Support source remains unchanged.'; }, 'cold');
  document.getElementById('cold').onclick = () => action('cold', async () => {
    const previous = host.accepted, rgba = draw('cold:before'), originalCamera = structuredClone(getCameraState()), requestBefore = await requestCount(), pinBefore = evidence.pins.length;
    const fresh = await loadCase('high_wall', (file, pin) => readOriginal(file, pin, true)); assertNative(fresh, previous.asset, 'fresh-eleven-original-files'); const progress = [], reopened = await host.loadFromUrl(fresh, url('high_wall'), { onProgress(value) { progress.push({ ...value }); } });
    requireFact(reopened.result !== previous.result && reopened.result.group !== previous.result.group && reopened.resources[0].object !== previous.resources[0].object && reopened.resources[0].geometry !== previous.resources[0].geometry && reopened.resources[0].material !== previous.resources[0].material, 'Cold reopen must allocate distinct actual owned resources');
    assertNative(reopened.readout, previous.readout, 'cold-native-readout'); assertNative(reopened.native, previous.native, 'cold-complete-native'); assertNative(getCameraState(), originalCamera, 'cold-fixed-camera'); const rendered = preview('cold-reopen'); assertBuffer(rendered.values, rgba, 'cold-full-RGBA'); const requestDelta = await requestCount() - requestBefore;
    requireFact(evidence.pins.length - pinBefore === 11 && requestDelta === 12 && progress.length > 0, 'Cold reopen requires eleven fresh originals and one public Model5 URL'); evidence.cold = { freshPinCount: 11, requestDelta, progress, distinctOwnedResources: true, wholeNativeExact: true, readoutExact: true, fixedCameraExact: true, fullRGBAExact: true }; recordPhase('cold-reopen', rendered); displayNative(); document.getElementById('status').textContent = 'Eleven fresh originals and the public Source URL preserve native data, buffers, camera and full RGBA.';
  }, 'cleanup');
  document.getElementById('cleanup').onclick = () => action('cleanup', async () => {
    const previous = host.accepted, before = structuredClone({ asset: previous.asset, proof: previous.proof, native: previous.native, readout: previous.readout }); host.dispose(); host.dispose(); assertNative({ asset: previous.asset, proof: previous.proof, native: previous.native, readout: previous.readout }, before, 'native-CPU-after-double-cleanup');
    requireFact(host.counts.callbacks === 4 && host.counts.pairs === 3 && host.counts.groups === 3 && host.counts.peakLivePairs === 2 && host.counts.livePairs === 0 && host.allResources.every(row => row.geometryDisposals === 1 && row.materialDisposals === 1) && host.allGroups.every(group => group.parent === null && group.children.length === 0), 'Three owned pairs/Groups must release once');
    const values = draw('cleanup:final'); requireFact(green(values) > 0 && scene.children.length === 1 && scene.children[0] === callerMarker && Object.values(callerCounters).every(value => value === 0), 'Caller must survive actual double cleanup'); const requestTotal = await requestCount(); requireFact(evidence.pins.length === 33 && requestTotal === 37, 'Exact original HTTP/pin observations required');
    evidence.cleanup = { double: true, nativeCPUReadable: true, callerPixels: green(values), callerRetained: true, requestTotal, pinTotal: evidence.pins.length, counts: host.counts, counters: getCallerCounters() }; recordPhase('cleanup', { values, frame: { width, height, hash: hash(values), callerPixels: green(values), ownedSurfaceRemoved: true } }); document.getElementById('status').textContent = 'Owned Supports were disposed once. The caller and complete original CPU evidence remain.'; document.documentElement.dataset.loader1299Complete = 'true';
  }, null);
} catch (error) { fail(error); }
