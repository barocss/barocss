import { BufferGeometry, Float32BufferAttribute, Line, LineBasicMaterial,
  OrthographicCamera, Scene, WebGLRenderer } from 'three';
import { ARTIFACTS, NATIVE_IDS, createReplacementHost } from './host-replacement-flow.mjs';

const width = 840, height = 368;
const scene = new Scene();
const renderer = new WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(width, height); renderer.setClearColor(0x101b2c);
document.querySelector('#view').append(renderer.domElement);
// One caller-owned view covers both native sources. It never follows a new result.
const halfX = 0.0085, halfY = halfX * height / width;
const camera = new OrthographicCamera(-halfX, halfX, halfY, -halfY, 0.0001, 1);
camera.position.set(0.007, 0.001, 0.05); camera.up.set(0, 1, 0); camera.lookAt(0.007, 0.001, 0);
camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
const cameraSnapshot = { position: camera.position.toArray(), projection: camera.projectionMatrix.toArray(),
  matrix: camera.matrix.toArray(), near: camera.near, far: camera.far };
const markerGeometry = new BufferGeometry();
markerGeometry.setAttribute('position', new Float32BufferAttribute([-0.001, -0.0005, 0, -0.0007, -0.0005, 0], 3));
const markerMaterial = new LineBasicMaterial({ color: 0xffb454 });
const marker = new Line(markerGeometry, markerMaterial); scene.add(marker);
const callerDisposals = { geometry: 0, material: 0, renderer: 0 };
markerGeometry.addEventListener('dispose', () => callerDisposals.geometry++);
markerMaterial.addEventListener('dispose', () => callerDisposals.material++);
const originalRendererDispose = renderer.dispose;
renderer.dispose = function (...args) { callerDisposals.renderer++; return originalRendererDispose.apply(this, args); };
const gl = renderer.getContext();
const baseURL = new URL('/', location.href).href;
const sessionId = crypto.randomUUID();
const evidence = { engine: 'Three0.186.1', publicEntries: ['@barocss/cad-interop/three', '@barocss/cad-interop/native'],
  baseURL, sessionId, nativeIds: [...NATIVE_IDS], unitsPerMillimeter: 0.001,
  nativeFrame: 'authored XYZ/mm, caller right-handed Y-up; camera +Z/up+Y',
  fixedCamera: cameraSnapshot, actions: [], visible: {}, changes: [], glErrors: [], disposed: false };
window.__baroHostReplacementEvidence = evidence;
let host, firstA, aModelSnapshot, phase = 0, busy = false, gateCounter = 0;
const actionIds = ['load-a', 'abort-b', 'replace-b', 'out-of-order', 'reject', 'dispose'];
const requireFact = (fact, message) => { if (!fact) throw new Error(message); };
const same = (a, b) => Object.is(a, b) || (a !== null && b !== null && typeof a === 'object' &&
  typeof b === 'object' && Object.keys(a).length === Object.keys(b).length &&
  Object.keys(a).every(key => Object.hasOwn(b, key) && same(a[key], b[key])));
const sameBuffer = (a, b) => a?.length === b.length && Array.from(a).every((value, index) => Object.is(value, b[index]));
const hash = bytes => bytes.reduce((value, byte) => Math.imul(value ^ byte, 16777619) >>> 0, 2166136261);
function updateButtons() {
  actionIds.forEach((id, index) => { document.querySelector(`#${id}`).disabled = busy || index !== phase; });
}
function status(message) {
  document.querySelector('#status').textContent = `${message}\nNative Model: quarter_pattern\n${NATIVE_IDS.join('\n')}\nFixed display scale: 0.001 units/mm`;
}
function frame() {
  renderer.render(scene, camera);
  const bytes = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  const error = gl.getError(); evidence.glErrors.push(error);
  requireFact(error === gl.NO_ERROR, `WebGL error ${error}`); return bytes;
}
function changedPixels(a, b) {
  let count = 0;
  for (let index = 0; index < a.length; index += 4)
    if (a[index] !== b[index] || a[index + 1] !== b[index + 1] || a[index + 2] !== b[index + 2]) count++;
  return count;
}
function callerRetained() {
  return marker.parent === scene && renderer.domElement.isConnected && !gl.isContextLost() &&
    Object.values(callerDisposals).every(value => value === 0) &&
    same(camera.position.toArray(), cameraSnapshot.position) && same(camera.projectionMatrix.toArray(), cameraSnapshot.projection);
}
const disposedOnce = record => record.result.group.parent === null && record.resources.every(resource =>
  resource.geometryDisposals === 1 && resource.materialDisposals === 1);
const notDisposed = record => record.resources.every(resource => resource.geometryDisposals === 0 && resource.materialDisposals === 0);
function refreshEvidence() {
  evidence.events = host.events.map(event => ({ ...event }));
  evidence.records = host.records.map(record => ({ generation: record.generation, artifact: record.artifact.key,
    sourceBytes: new TextEncoder().encode(record.source).length, actualSourceSHA: record.sourceSha256, sourceRetained: record.source === record.result.source,
    modelRetained: record.model === record.result.model, nativeIds: record.model.objects.map(object => object.id),
    mounted: record.result.group.parent === scene, resources: record.resources.map(resource => ({ geometryId: resource.geometryId,
      geometry: resource.geometryDisposals, material: resource.materialDisposals })) }));
  evidence.accepted = host.accepted ? { generation: host.accepted.generation, artifact: host.accepted.artifact.key,
    sourceSHA: host.accepted.artifact.sha256, nativeIds: host.accepted.model.objects.map(object => object.id) } : null;
}
host = createReplacementHost({ scene, baseURL, onChange(change) {
  // Host notification follows synchronous mount and previous-result cleanup.
  if (change.accepted) {
    requireFact(change.accepted.result.group.parent === scene && notDisposed(change.accepted), 'Host rendered before adoption');
    const priorRecords = host.records.filter(record => record !== change.accepted);
    requireFact(priorRecords.every(disposedOnce), 'Host rendered before old/stale resources were released');
    const order = host.events.filter(event => event.generation === change.accepted.generation).map(event => event.type);
    const expectedTail = priorRecords.length ? ['mounted', 'old-disposed', 'change'] : ['mounted', 'change'];
    requireFact(same(order.slice(-expectedTail.length), expectedTail) && order.includes('detached-ready'),
      'Render notification did not follow actual detached/mount/old-cleanup ordering');
  }
  const pixels = frame();
  evidence.changes.push({ type: change.type, generation: change.accepted?.generation ?? null,
    artifact: change.accepted?.artifact.key ?? null, frameHash: hash(pixels), eventTypes: host.events.map(event => event.type) });
  refreshEvidence();
} });
function proveVisible(record) {
  const group = record.result.group;
  requireFact(host.accepted === record && group.parent === scene && group.children.length === 5, 'Expected one accepted five-member display');
  group.visible = false; const background = frame(); group.visible = true;
  group.children.forEach(child => { child.visible = false; });
  const members = [];
  for (const child of group.children) {
    child.visible = true; const pixels = changedPixels(frame(), background);
    requireFact(pixels > 0, `Invisible native member ${record.artifact.key}/${child.name}`);
    members.push({ id: child.name, pixels }); child.visible = false;
  }
  group.children.forEach(child => { child.visible = true; });
  const pixels = frame();
  const result = { generation: record.generation, members, combinedPixels: changedPixels(pixels, background), frameHash: hash(pixels) };
  evidence.visible[record.artifact.key] = result;
  evidence.frameHash = result.frameHash;
  requireFact(callerRetained(), 'Caller camera or resources changed');
  return result;
}
function proveRetained(record, pixels) {
  requireFact(host.accepted === record && record.result.group.parent === scene && notDisposed(record) &&
    sameBuffer(frame(), pixels) && callerRetained(), 'Accepted source/Scene/frame or caller ownership changed');
}
async function release(gate) {
  const response = await fetch(new URL(`/__loader991/release?gate=${encodeURIComponent(gate)}`, baseURL), { method: 'POST' });
  requireFact(response.ok, `Release gate HTTP ${response.status}`); return response.json();
}
async function captureServerEvents() {
  const response = await fetch(new URL('/__loader991/events', baseURL));
  requireFact(response.ok, `Server events HTTP ${response.status}`); evidence.serverEvents = await response.json();
  requireFact(Array.isArray(evidence.serverEvents), 'Expected actual server event array'); return evidence.serverEvents;
}
async function loadA() {
  requireFact(gl instanceof WebGL2RenderingContext, 'WebGL2 required');
  const token = host.start(ARTIFACTS.A), outcome = await token.promise;
  requireFact(outcome.status === 'accepted' && outcome.record === host.accepted, 'A was not accepted');
  firstA = outcome.record; aModelSnapshot = structuredClone(firstA.model);
  evidence.sourceA = { sha256: ARTIFACTS.A.sha256, bytes: ARTIFACTS.A.bytes, sourceRetained: true };
  proveVisible(firstA); evidence.actions.push({ action: 'load A', generation: token.generation, status: outcome.status });
  status('A is accepted. All five native Curves are visible.');
}
async function abortB() {
  const current = host.accepted, before = frame(), beforeRecords = host.records.length;
  requireFact(current?.artifact.key === 'A', 'Keep A accepted before aborting B');
  const gate = `abort-${sessionId}-${++gateCounter}`;
  const token = host.start(ARTIFACTS.B, { gate, abortOnProgress: true });
  const progress = await token.firstProgress, outcome = await token.promise;
  requireFact(progress?.loadedBytes === 128 && progress.declaredTotalBytes === ARTIFACTS.B.bytes && outcome.status === 'aborted' && outcome.error?.name === 'AbortError' &&
    outcome.error?.code === 'ABORT_ERR' && host.records.length === beforeRecords, 'Abort did not occur after the real first 128 bytes before result allocation');
  proveRetained(current, before);
  const actualServer = await captureServerEvents();
  const request = actualServer.find(event => event.type === 'request' && event.gate === gate && event.artifact === 'B');
  const chunks = actualServer.filter(event => event.type === 'chunk' && event.requestId === request?.requestId);
  const premature = actualServer.find(event => event.type === 'premature-close' && event.requestId === request?.requestId);
  requireFact(request && same(chunks.map(event => event.bytes), [128]) && premature && chunks[0].sequence < premature.sequence &&
    !actualServer.some(event => event.type === 'end' && event.requestId === request.requestId),
    'Actual abort request did not close after exactly 128 bytes without an end');
  const released = await release(gate);
  requireFact(released.released === false, 'Aborted response remained active at release');
  await captureServerEvents();
  evidence.abort = { generation: token.generation, loadedBytes: progress.loadedBytes, errorName: outcome.error.name,
    errorCode: outcome.error.code, allocatedResults: host.records.length - beforeRecords, acceptedARetained: true,
    serverRequestId: request.requestId, prematureCloseSequence: premature.sequence, actualChunkBytes: [128], serverEnd: false };
  evidence.actions.push({ action: 'abort gated B', generation: token.generation, status: outcome.status });
  status('B aborted after actual 128-byte progress. A and its frame remain accepted.');
}
async function replaceB() {
  const previous = host.accepted, previousFrame = hash(frame());
  const token = host.start(ARTIFACTS.B), outcome = await token.promise;
  requireFact(outcome.status === 'accepted' && outcome.record === host.accepted && host.accepted.artifact.key === 'B' &&
    disposedOnce(previous), 'B replacement or old-result cleanup failed');
  const visible = proveVisible(host.accepted);
  requireFact(visible.frameHash !== previousFrame && firstA.source === firstA.result.source && same(firstA.model, aModelSnapshot) &&
    firstA.model.objects[4].controlPoints[0][0] === 10 && host.accepted.model.objects[4].controlPoints[0][0] === 14,
    'Native spacing edit or A authority/frame comparison failed');
  evidence.replacement = { generation: token.generation, previousGeneration: previous.generation,
    sourceASHA: ARTIFACTS.A.sha256, sourceBSHA: ARTIFACTS.B.sha256, sourceBBytes: ARTIFACTS.B.bytes,
    nativeLastPoleXMM: { A: 10, B: 14 }, previousFrame, nextFrame: visible.frameHash, retainedNativeA: true, oldDisposedOnce: true };
  evidence.actions.push({ action: 'replace B', generation: token.generation, status: outcome.status });
  status('B is accepted with native spacing 3 mm. A resources were released; its original native data remains readable.');
}
async function outOfOrder() {
  const current = host.accepted, before = frame();
  const gate = `slow-a-${sessionId}-${++gateCounter}`;
  const slow = host.start(ARTIFACTS.A, { gate });
  const progress = await slow.firstProgress;
  requireFact(progress?.loadedBytes === 128 && !slow.controller.signal.aborted, 'Earlier A did not remain an independent active request');
  proveRetained(current, before);
  const latest = host.start(ARTIFACTS.B), latestOutcome = await latest.promise;
  requireFact(latestOutcome.status === 'accepted' && latestOutcome.record === host.accepted && latest.generation > slow.generation,
    'Latest host generation was not accepted first');
  const winner = host.accepted, winnerFrame = frame();
  const released = await release(gate); requireFact(released.released === true, 'Slow A response was not actively released');
  const lateOutcome = await slow.promise;
  requireFact(lateOutcome.status === 'stale' && lateOutcome.record && !slow.controller.signal.aborted &&
    disposedOnce(lateOutcome.record) && !host.events.some(event => event.type === 'mounted' && event.generation === slow.generation),
    'Late successful A mounted or was not disposed');
  proveRetained(winner, winnerFrame); proveVisible(winner);
  const actualServer = await captureServerEvents();
  const slowRequest = actualServer.find(event => event.type === 'request' && event.gate === gate && event.artifact === 'A');
  const latestRequests = actualServer.filter(event => event.type === 'request' && event.artifact === 'B' &&
    event.gate === null && event.requestId > slowRequest?.requestId);
  requireFact(slowRequest && latestRequests.length === 1, 'Cannot qualify the two actual overlapping server requests');
  const latestRequest = latestRequests[0];
  const latestEnd = actualServer.find(event => event.type === 'end' && event.requestId === latestRequest.requestId);
  const slowRelease = actualServer.find(event => event.type === 'release' && event.gate === gate && event.active);
  const slowEnd = actualServer.find(event => event.type === 'end' && event.requestId === slowRequest.requestId);
  const slowChunks = actualServer.filter(event => event.type === 'chunk' && event.requestId === slowRequest.requestId);
  requireFact(latestEnd && slowRelease && slowEnd && latestEnd.sequence < slowRelease.sequence && slowRelease.sequence < slowEnd.sequence &&
    latestEnd.totalBytes === ARTIFACTS.B.bytes && slowEnd.totalBytes === ARTIFACTS.A.bytes &&
    same(slowChunks.map(event => event.bytes), [128, ARTIFACTS.A.bytes - 128]),
    'Actual latest B did not finish before explicit slow A release and completion');
  evidence.outOfOrder = { earlierGeneration: slow.generation, latestGeneration: latest.generation,
    earlierSignalAborted: slow.controller.signal.aborted, earlierStatus: lateOutcome.status,
    latestStatus: latestOutcome.status, lateNativeSourceSHA: ARTIFACTS.A.sha256,
    lateDisposedOnce: true, acceptedBRetained: true, acceptedFrameRetained: true,
    serverRequests: { slowA: slowRequest.requestId, latestB: latestRequest.requestId },
    serverSequences: { latestBEnd: latestEnd.sequence, slowARelease: slowRelease.sequence, slowAEnd: slowEnd.sequence } };
  evidence.actions.push({ action: 'out of order', earlierGeneration: slow.generation, latestGeneration: latest.generation });
  status('Latest B was accepted first. Late successful A was disposed without mounting or replacing B.');
}
async function reject() {
  const current = host.accepted, before = frame(), beforeRecords = host.records.length;
  const failures = [];
  for (const artifact of [ARTIFACTS.invalid, ARTIFACTS.http503]) {
    const token = host.start(artifact), outcome = await token.promise;
    requireFact(outcome.status === 'failed' && outcome.error && host.records.length === beforeRecords, 'Invalid source or HTTP failure unexpectedly allocated a result');
    if (artifact.key === 'http503') requireFact(String(outcome.error).includes('503'), 'Expected actual HTTP 503');
    proveRetained(current, before);
    failures.push({ artifact: artifact.key, generation: token.generation, errorName: outcome.error.name, message: outcome.error.message });
  }
  evidence.failures = failures; evidence.failureAcceptedBRetained = true; evidence.finalBFrameHash = hash(frame());
  evidence.actions.push({ action: 'reject invalid and HTTP503', failures: failures.length });
  await captureServerEvents();
  status('Invalid source and actual HTTP 503 refused. B remains accepted. Capture this frame before cleanup.');
}
async function dispose() {
  requireFact(host.accepted?.artifact.key === 'B', 'Keep B accepted before cleanup');
  host.dispose(); host.dispose();
  requireFact(host.accepted === null && host.records.length === 4 && host.records.every(disposedOnce) &&
    firstA.source === firstA.result.source && same(firstA.model, aModelSnapshot) && scene.children.length === 1 && callerRetained(),
    'Final result cleanup crossed caller ownership or lost original native A');
  frame(); evidence.disposed = true; evidence.callerRetained = true; evidence.callerDisposals = { ...callerDisposals };
  evidence.ownedDisposals = { results: host.records.length, geometries: host.records.reduce((sum, record) => sum + record.resources.length, 0),
    materials: host.records.reduce((sum, record) => sum + record.resources.length, 0), allOnce: true };
  evidence.actions.push({ action: 'double cleanup' }); await captureServerEvents();
  status('All accepted, replaced and stale resources released once. Caller Scene, camera, renderer, canvas and marker remain live.');
}
async function runAction(index, action) {
  if (busy || phase !== index) return;
  busy = true; updateButtons();
  try {
    await action(); refreshEvidence(); phase++;
  } catch (error) {
    window.__baroHostReplacementError = error.stack ?? String(error); status(`Failed: ${error.message}`); console.error(error);
  } finally { busy = false; updateButtons(); }
}
[loadA, abortB, replaceB, outOfOrder, reject, dispose].forEach((action, index) => {
  document.querySelector(`#${actionIds[index]}`).addEventListener('click', () => { runAction(index, action); });
});
updateButtons();
