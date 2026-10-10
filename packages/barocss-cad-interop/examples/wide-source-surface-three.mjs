import { Scene, OrthographicCamera, WebGLRenderer, Color, Mesh, SphereGeometry, MeshBasicMaterial } from 'three';
import { CASE_KEYS, PINS, loadCase, stringifyNative, assertNative, requireFact } from './wide-source-surface-three-fixture.mjs';
import { createWideSourceSurfaceThreeHost } from './wide-source-surface-three-checkpoint.mjs';

const WIDTH = 900, HEIGHT = 640;
const DATA_BASE = '/packages/barocss-cad-interop/examples/';
const FRAMES = {
  degree5: {
    position: [20.862000274658204, 29.591999816894532, 0.872000389099121],
    quaternion: [0.26267957968900363, 0.2908011371886961, -0.08337125990040256, 0.9162332508956379],
    halfX: 0.48921154960939894, halfY: 0.34788376861112813,
    near: 0.00000510000228881836, far: 10.200004577636719,
    markerCenter: [19.9439998626709, 30.43350019454956, 0.132500057220459], markerRadius: 0.007650003433227539,
  },
  maximum: {
    position: [20.314525000572207, 29.675274999380115, 0.5626500010490417],
    quaternion: [0.26267957968900263, 0.29080113718869693, -0.08337125990040249, 0.916233250895638],
    halfX: 0.19589872917408213, halfY: 0.13930576296823619,
    near: 0.0000025575000047683716, far: 5.115000009536743,
    markerCenter: [19.854174999713898, 30.097262500166895, 0.19181250035762787], markerRadius: 0.0038362500071525574,
  },
};
const elements = Object.fromEntries(['status', 'view', 'readout', 'source-text', 'full-proof', 'refusal-readout', 'run-refusals', 'apply-edit', 'original-maximum', 'cold-reopen', 'dispose'].map(id => [id, document.getElementById(id)]));
const scene = new Scene();
scene.background = new Color(0x101b2c);
const camera = new OrthographicCamera();
const renderer = new WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(WIDTH, HEIGHT);
elements.view.appendChild(renderer.domElement);
const canvas = renderer.domElement, gl = renderer.getContext();
requireFact(gl instanceof WebGL2RenderingContext, 'Actual WebGL2 context is required');
const callerGeometry = new SphereGeometry(1, 8, 6);
const callerMaterial = new MeshBasicMaterial({ color: 0x00ff00 });
const callerMarker = new Mesh(callerGeometry, callerMaterial);
scene.add(callerMarker);
const caller = { geometryDisposals: 0, materialDisposals: 0, rendererDisposals: 0, canvasRemovals: 0 };
callerGeometry.addEventListener('dispose', () => caller.geometryDisposals++);
callerMaterial.addEventListener('dispose', () => caller.materialDisposals++);
const originalRendererDispose = renderer.dispose.bind(renderer);
renderer.dispose = () => { caller.rendererDisposals++; return originalRendererDispose(); };
const originalCanvasRemove = canvas.remove.bind(canvas);
canvas.remove = () => { caller.canvasRemovals++; return originalCanvasRemove(); };
const state = { ready: false, busy: false, error: null, family: null, mode: import.meta.url.includes('loader1340-compiled-browser') ? 'compiled' : 'source', pins: [], phases: [], refusals: [], glErrors: [], runtimeErrors: [], ledger: null, complete: false };
const assets = new Map();
window.addEventListener('error', event => state.runtimeErrors.push({ type: 'error', message: event.message }));
window.addEventListener('unhandledrejection', event => state.runtimeErrors.push({ type: 'unhandledrejection', message: String(event.reason) }));
const host = createWideSourceSurfaceThreeHost({ scene, onChange(record) {
  if (record && state.family !== record.assetKey) setFamily(record.assetKey);
  draw();
} });

function hash(bytes) { let value = 2166136261; for (const byte of bytes) value = Math.imul(value ^ byte, 16777619) >>> 0; return value; }
function byteEqual(a, b) { requireFact(a.length === b.length, 'Frame lengths differ'); for (let i = 0; i < a.length; i++) requireFact(a[i] === b[i], 'Full frame changed at byte ' + i); }
function rgbaBase64(bytes) {
  let text = '';
  for (let i = 0; i < bytes.length; i += 32768) text += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(text);
}
function pixels(bytes, predicate) { let count = 0; for (let i = 0; i < bytes.length; i += 4) if (predicate(bytes[i], bytes[i + 1], bytes[i + 2])) count++; return count; }
function changedPixels(a, b) { let count = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) count++; return count; }
function glCheck(action) {
  const error = gl.getError(); state.glErrors.push({ action, error }); requireFact(error === gl.NO_ERROR, 'Actual GL error after ' + action);
}
function draw() {
  renderer.render(scene, camera);
  glCheck('render');
  const rgba = new Uint8Array(WIDTH * HEIGHT * 4);
  gl.readPixels(0, 0, WIDTH, HEIGHT, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
  glCheck('readPixels');
  return rgba;
}
function cameraState() {
  camera.updateMatrixWorld(true); callerMarker.updateMatrixWorld(true);
  return {
    position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), up: camera.up.toArray(),
    frustum: [camera.left, camera.right, camera.top, camera.bottom, camera.near, camera.far],
    projection: camera.projectionMatrix.toArray(), world: camera.matrixWorld.toArray(), view: camera.matrixWorldInverse.toArray(),
    callerPosition: callerMarker.position.toArray(), callerScale: callerMarker.scale.toArray(), callerMatrix: callerMarker.matrixWorld.toArray(),
  };
}
function setFamily(key) {
  const frame = FRAMES[key]; requireFact(frame, 'Known native family camera required');
  camera.position.fromArray(frame.position); camera.up.set(0, 1, 0); camera.quaternion.fromArray(frame.quaternion);
  camera.left = -frame.halfX; camera.right = frame.halfX; camera.top = frame.halfY; camera.bottom = -frame.halfY;
  camera.near = frame.near; camera.far = frame.far; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  callerMarker.position.fromArray(frame.markerCenter); callerMarker.scale.setScalar(frame.markerRadius); callerMarker.updateMatrixWorld(true);
  state.family = key;
}
function physicalRows() {
  return host.allResources.map(row => {
    const mesh = row.object, geometry = row.geometry, material = row.material;
    return {
      meshId: mesh.name, meshUUID: mesh.uuid, geometryUUID: geometry.uuid, materialUUID: material.uuid,
      visible: mesh.visible, matrix: mesh.matrix.toArray(),
      positions: Array.from(geometry.getAttribute('position').array), normals: Array.from(geometry.getAttribute('normal').array),
      nativeUV: Array.from(geometry.getAttribute('_CAD_UV').array), indices: Array.from(geometry.getIndex().array),
      geometryDisposals: row.geometryDisposals, materialDisposals: row.materialDisposals,
    };
  });
}
function wholeCPU() {
  return host.records.map(record => ({
    assetKey: record.assetKey, state: record.state, asset: record.asset, proof: record.proof,
    sourceEdit: record.sourceEdit, source: record.source, model: record.model, readout: record.readout,
    native: { source: record.result.source, model: record.result.model, diagnostics: record.result.diagnostics, surfaces: record.result.surfaces, curves: record.result.curves, unrenderedCurveIds: record.result.unrenderedCurveIds },
  }));
}
function callerAlive() {
  requireFact(Object.values(caller).every(value => value === 0), 'Caller resources must remain undisposed');
  requireFact(callerMarker.parent === scene && callerMarker.geometry === callerGeometry && callerMarker.material === callerMaterial && canvas.isConnected, 'Caller Scene, Sphere and canvas must remain live');
  requireFact(renderer.getContext() === gl, 'Caller GL context must remain unchanged');
}
function capture() {
  const accepted = host.accepted;
  return {
    accepted, result: accepted?.result, sourceEdit: accepted?.sourceEdit, proof: accepted?.proof, readout: accepted?.readout,
    resourceRefs: host.allResources.map(row => ({ row, mesh: row.object, geometry: row.geometry, material: row.material,
      position: row.geometry.getAttribute('position'), positionArray: row.geometry.getAttribute('position').array,
      normal: row.geometry.getAttribute('normal'), normalArray: row.geometry.getAttribute('normal').array,
      uv: row.geometry.getAttribute('_CAD_UV'), uvArray: row.geometry.getAttribute('_CAD_UV').array,
      index: row.geometry.getIndex(), indexArray: row.geometry.getIndex().array })),
    children: [...scene.children], cpu: structuredClone(wholeCPU()), buffers: structuredClone(physicalRows()), camera: cameraState(), caller: { ...caller }, rgba: draw(),
  };
}
function checkRetained(before, receipt) {
  requireFact(host.accepted === before.accepted && host.accepted.result === before.result && host.accepted.proof === before.proof && host.accepted.sourceEdit === before.sourceEdit && host.accepted.readout === before.readout, 'Accepted native record references changed after refusal');
  requireFact(scene.children.length === before.children.length && scene.children.every((child, i) => child === before.children[i]), 'Accepted Scene children changed after refusal');
  requireFact(host.allResources.length === before.resourceRefs.length, 'Refusal allocated accepted resources');
  for (const refs of before.resourceRefs) {
    requireFact(host.allResources.includes(refs.row) && refs.row.object === refs.mesh && refs.row.geometry === refs.geometry && refs.row.material === refs.material, 'Owned resource references changed');
    requireFact(refs.geometry.getAttribute('position') === refs.position && refs.position.array === refs.positionArray && refs.geometry.getAttribute('normal') === refs.normal && refs.normal.array === refs.normalArray && refs.geometry.getAttribute('_CAD_UV') === refs.uv && refs.uv.array === refs.uvArray && refs.geometry.getIndex() === refs.index && refs.index.array === refs.indexArray, 'Actual attribute or buffer references changed');
  }
  assertNative(wholeCPU(), before.cpu); assertNative(physicalRows(), before.buffers); assertNative(cameraState(), before.camera); assertNative(caller, before.caller);
  const rgba = draw(); byteEqual(rgba, before.rgba); callerAlive();
  state.refusals.push({ receipt, nativeRetained: true, resourcesRetained: true, cameraRetained: true, fullRGBARetained: true, frameBeforeHash: hash(before.rgba), frameHash: hash(rgba), rgba, cpu: before.cpu, buffers: before.buffers, camera: before.camera, caller: { ...caller } });
}
function inspectVisibility() {
  const accepted = host.accepted, rgba = draw(); callerAlive();
  if (!accepted) {
    const callerPixels = pixels(rgba, (r, g, b) => r < 80 && g > 180 && b < 80);
    requireFact(callerPixels > 0, 'Caller Sphere must survive cleanup');
    return { rgba, frameHash: hash(rgba), callerPixels, callerOnly: true };
  }
  const meshes = accepted.resources.map(row => row.object), visibility = meshes.map(mesh => mesh.visible);
  const target = meshes.find(mesh => mesh.name === 'target_surface'); requireFact(target, 'Actual target Mesh required');
  const context = meshes.find(mesh => mesh.name === 'context_plane'); requireFact(context?.visible && context.parent === accepted.result.group, 'Whole context Plane remains attached and visible');
  try {
    for (const mesh of meshes) mesh.visible = mesh === target;
    callerMarker.visible = false;
    const isolated = draw();
    for (let i = 0; i < meshes.length; i++) meshes[i].visible = visibility[i];
    callerMarker.visible = true;
    byteEqual(draw(), rgba);
    target.visible = false;
    const hidden = draw(); target.visible = true; byteEqual(draw(), rgba);
    const targetIsolatedPixels = pixels(isolated, (r, g, b) => r !== 16 || g !== 27 || b !== 44);
    const callerPixels = pixels(rgba, (r, g, b) => r < 80 && g > 180 && b < 80), onOffPixels = changedPixels(rgba, hidden);
    requireFact(targetIsolatedPixels > 0 && callerPixels > 0 && onOffPixels > 0, 'Actual target and caller visibility required');
    return { rgba, frameHash: hash(rgba), targetIsolatedPixels, callerPixels, onOffPixels, fullFrameRestored: true, contextPlaneVisibleAndAttached: true };
  } finally {
    for (let i = 0; i < meshes.length; i++) meshes[i].visible = visibility[i];
    callerMarker.visible = true;
  }
}
function recordPhase(label) {
  const observed = inspectVisibility(), accepted = host.accepted;
  const phase = { label, family: state.family, counts: { ...host.counts }, cpu: structuredClone(wholeCPU()), resources: physicalRows(), camera: cameraState(), caller: { ...caller }, ...observed };
  const original = state.phases.find(row => row.family === state.family && row.label.endsWith('-original'));
  if (accepted?.state === 'edited' && original) { phase.editedDeltaPixels = changedPixels(original.rgba, observed.rgba); requireFact(phase.editedDeltaPixels > 0, 'Actual edit must change the target frame'); }
  if (label === 'maximum-cold') {
    const previous = state.phases.at(-1); byteEqual(observed.rgba, previous.rgba); assertNative(accepted.readout, previous.cpu.at(-1).readout); assertNative(phase.camera, previous.camera);
    phase.coldFullFrameEqual = true; phase.coldPureReadoutEqual = true;
  }
  state.phases.push(phase); updateView(); return phase;
}
function updateView() {
  elements.status.textContent = stringifyNative({ ready: state.ready, busy: state.busy, error: state.error, phase: state.phases.at(-1)?.label, counts: host.counts, refusals: state.refusals.length, pins: state.pins.length });
  const accepted = host.accepted;
  elements.readout.textContent = accepted ? stringifyNative({ family: accepted.assetKey, nativeReport: accepted.proof.edit.report, validationReport: accepted.proof.validationReport, unrenderedCurveIds: accepted.result.unrenderedCurveIds, approximation: accepted.result.surfaces.map(surface => ({ surfaceId: surface.surfaceId, report: surface.report })), counts: host.counts }) : 'Caller Scene remains live. All owned display results have been released.';
  elements['source-text'].value = accepted?.source ?? '';
  elements['full-proof'].textContent = accepted ? stringifyNative(accepted.readout) : stringifyNative(wholeCPU());
  elements['refusal-readout'].textContent = stringifyNative(state.refusals.map(({ receipt, frameHash, nativeRetained, resourcesRetained, cameraRetained, fullRGBARetained }) => ({ receipt, frameHash, nativeRetained, resourcesRetained, cameraRetained, fullRGBARetained })));
  for (const button of document.querySelectorAll('button')) button.disabled = state.busy || !!state.error || !state.ready || !accepted;
  elements['run-refusals'].disabled ||= state.refusals.length > 0 || accepted?.assetKey !== 'degree5' || accepted?.state !== 'original';
  elements['apply-edit'].disabled ||= accepted?.state !== 'original' || (accepted?.assetKey === 'degree5' && state.refusals.length !== 14);
  elements['apply-edit'].textContent = accepted?.assetKey === 'maximum' ? 'Apply maximum-grid edit' : 'Apply degree-five edit';
  elements['original-maximum'].disabled ||= accepted?.assetKey === 'maximum' || accepted?.state !== 'edited';
  elements['cold-reopen'].disabled ||= accepted?.assetKey !== 'maximum' || accepted?.state !== 'edited';
  elements.dispose.disabled ||= state.phases.at(-1)?.label !== 'maximum-cold';
}
async function readText(file, pin) {
  const url = DATA_BASE + file;
  const response = await fetch(url, { cache: 'no-store' }), bytes = new Uint8Array(await response.arrayBuffer());
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
  requireFact(response.status === 200 && bytes.length === pin.bytes && sha256 === pin.sha256, 'Original literal HTTP status/bytes/SHA mismatch: ' + file);
  const contentLength = response.headers.get('content-length'), contentType = response.headers.get('content-type');
  requireFact(contentLength === String(bytes.length), 'Literal Content-Length must match bytes');
  requireFact(contentType?.startsWith(file.endsWith('.css') ? 'text/plain' : 'application/json'), 'Literal MIME required');
  state.pins.push({ ...pin, file, url, status: response.status, actualBytes: bytes.length, actualSHA256: sha256, contentLength, contentType });
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
async function serverLedger() { const response = await fetch('/loader1340-request-log.json', { cache: 'no-store' }); requireFact(response.ok, 'Actual request ledger response required'); return response.json(); }
function candidateURL(asset) { const pin = asset.pins.find(row => row.file.endsWith('.complete-candidate.source0.css')); requireFact(pin, 'Original candidate CSS pin required'); return DATA_BASE + pin.file; }
async function runRefusals() {
  requireFact(host.accepted?.assetKey === 'degree5' && host.accepted.state === 'original' && state.refusals.length === 0, 'Refusals require initial accepted degree-five original');
  let before = capture();
  await host.runRefusals(assets.get('degree5'), receipt => { checkRetained(before, receipt); before = capture(); });
  requireFact(state.refusals.length === 9, 'Exactly nine synchronous native/host/target refusals required');
  let previousLedger = await serverLedger();
  const deltas = [0, 1, 1, 1, 0]; let index = 0;
  await host.runTransportRefusals(candidateURL(assets.get('degree5')), async receipt => {
    const nextLedger = await serverLedger(), delta = nextLedger.requests.length - previousLedger.requests.length;
    requireFact(delta === deltas[index], 'Actual transport request delta mismatch');
    checkRetained(before, { ...receipt, actualRequestDelta: delta });
    previousLedger = nextLedger; index++; before = capture();
  });
  requireFact(index === 5 && state.refusals.length === 14, 'Exactly fourteen actual refusal slots required');
  state.ledger = previousLedger; updateView();
}
async function applyEdit() { requireFact(host.accepted?.state === 'original', 'Original admission required before edit'); const key = host.accepted.assetKey; host.applyEdit(assets.get(key)); recordPhase(key + '-edited'); }
async function originalMaximum() { host.loadOriginal(assets.get('maximum')); recordPhase('maximum-original'); }
async function coldReopen() {
  requireFact(host.accepted?.assetKey === 'maximum' && host.accepted.state === 'edited', 'Accepted maximum edit required before cold reopen');
  const fresh = await loadCase('maximum', readText);
  await host.coldReopen(fresh, candidateURL(fresh), { onProgress: () => true });
  recordPhase('maximum-cold'); state.ledger = await serverLedger();
  requireFact(state.pins.length === 12 && state.ledger.requests.length === 16, 'Actual 12 pin observations and 16 literal requests required');
}
async function dispose() {
  host.dispose(); host.dispose(); callerAlive();
  recordPhase('cleanup');
  requireFact(host.counts.livePairs === 0 && host.counts.pairs === 10 && host.counts.peakLivePairs === 4 && host.counts.callbacks === 6, 'Actual complete five-result resource flow required');
  for (const row of host.allResources) requireFact(row.geometryDisposals === 1 && row.materialDisposals === 1, 'Owned resources must dispose exactly once');
  state.complete = true; document.documentElement.dataset.loader1340Complete = 'true'; state.ledger = await serverLedger(); updateView();
}
async function act(action) {
  requireFact(!state.busy && !state.error, 'Previous action must finish successfully'); state.busy = true; document.documentElement.dataset.loader1340Busy = 'true'; updateView();
  try { await action(); }
  catch (error) { state.error = { name: error.name, code: error.code ?? null, message: error.message, cause: error.cause instanceof Error ? { name: error.cause.name, code: error.cause.code ?? null, message: error.cause.message } : error.cause ?? null }; document.documentElement.dataset.loader1340Error = 'true'; throw error; }
  finally { state.busy = false; document.documentElement.dataset.loader1340Busy = 'false'; updateView(); }
}
for (const [id, action] of [['run-refusals', runRefusals], ['apply-edit', applyEdit], ['original-maximum', originalMaximum], ['cold-reopen', coldReopen], ['dispose', dispose]]) elements[id].addEventListener('click', () => { act(action).catch(() => {}); });
function snapshot(includeRGBA = false) {
  const serialPhase = phase => {
    const { rgba, cpu, resources, ...rest } = phase;
    return includeRGBA ? { ...rest, cpu, resources, frameRGBA: { width: WIDTH, height: HEIGHT, bytes: rgba.length, encoding: 'base64', data: rgbaBase64(rgba) } } : rest;
  };
  const serialRefusal = row => {
    const { rgba, cpu, buffers, ...rest } = row;
    return includeRGBA ? { ...rest, cpu, buffers, frameRGBA: { width: WIDTH, height: HEIGHT, bytes: rgba.length, encoding: 'base64', data: rgbaBase64(rgba) } } : rest;
  };
  const result = { ready: state.ready, busy: state.busy, error: state.error, complete: state.complete, mode: state.mode, family: state.family,
    counts: { ...host.counts }, pins: state.pins, phases: state.phases.map(serialPhase), refusals: state.refusals.map(serialRefusal),
    camera: cameraState(), caller: { ...caller }, callerAlive: callerMarker.parent === scene && canvas.isConnected,
    glErrors: state.glErrors, runtimeErrors: state.runtimeErrors, ledger: state.ledger,
    sourceURLs: performance.getEntriesByType('resource').map(row => row.name).filter(url => url.includes('/packages/') && url.includes('/src/')),
    compiledURLs: performance.getEntriesByType('resource').map(row => row.name).filter(url => url.includes('loader1340-compiled-browser')),
  };
  if (includeRGBA) { result.nativeRecords = wholeCPU(); result.resources = physicalRows(); result.signedNativeJSON = stringifyNative({ nativeRecords: result.nativeRecords, phases: state.phases.map(phase => ({ label: phase.label, family: phase.family, cpu: phase.cpu, camera: phase.camera, buffers: phase.resources.map(({ meshId, positions, normals, nativeUV, indices }) => ({ meshId, positions, normals, nativeUV, indices })) })), camera: result.camera }); }
  return structuredClone(result);
}
const bridge = Object.freeze({ snapshot, stringifySnapshot: (includeRGBA = false) => stringifyNative(snapshot(includeRGBA)), async runAll() {
  await act(async () => { await runRefusals(); await applyEdit(); await originalMaximum(); await applyEdit(); await coldReopen(); await dispose(); });
  return snapshot(false);
} });
Object.defineProperty(window, 'loader1340Evidence', { value: bridge, writable: false, configurable: false });
await act(async () => {
  requireFact(CASE_KEYS.length === 2 && PINS.length === 8, 'Exactly two families/eight literal pins required');
  for (const key of CASE_KEYS) assets.set(key, await loadCase(key, readText));
  host.loadOriginal(assets.get('degree5')); state.ready = true; recordPhase('degree5-original');
  document.documentElement.dataset.loader1340Ready = 'true';
});
