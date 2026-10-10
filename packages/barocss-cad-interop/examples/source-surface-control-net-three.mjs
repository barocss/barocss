import { evaluateSurface, surfaceDomain } from '@barocss/cad';
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import { DoubleSide, Mesh, MeshBasicMaterial, MeshNormalMaterial, OrthographicCamera, Scene, SphereGeometry, WebGLRenderer } from 'three';
import { CASE_KEYS, PINS, createNativeOptions, loadCase } from './source-surface-control-net-three-fixture.mjs';
import { createSourceEditHost } from './source-surface-control-net-three-checkpoint.mjs';

const width = 1000, height = 700;
const scene = new Scene(), renderer = new WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(width, height); renderer.setClearColor(0x101b2c); document.querySelector('#view').append(renderer.domElement);
const camera = new OrthographicCamera(-0.0225, 0.0225, 0.01575, -0.01575, 0.0001, 1);
camera.position.set(0.032, 0.037, 0.045); camera.up.set(0, 1, 0); camera.lookAt(0.004, 0.014, 0.002);
camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
const cameraState = { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), projection: camera.projectionMatrix.toArray(), worldMatrix: camera.matrixWorld.toArray() };
const markerGeometry = new SphereGeometry(0.00018, 8, 6), markerMaterial = new MeshBasicMaterial({ color: 0x00ff00 });
const marker = new Mesh(markerGeometry, markerMaterial); marker.position.set(0.016, 0.003, 0.002); scene.add(marker);
const callerDisposals = { geometry: 0, material: 0, renderer: 0, canvasRemoval: 0 };
markerGeometry.addEventListener('dispose', () => callerDisposals.geometry++); markerMaterial.addEventListener('dispose', () => callerDisposals.material++);
const originalRendererDispose = renderer.dispose;
renderer.dispose = function (...args) { callerDisposals.renderer++; return originalRendererDispose.apply(this, args); };
const canvas = renderer.domElement, originalCanvasRemove = canvas.remove;
canvas.remove = function (...args) { callerDisposals.canvasRemoval++; return originalCanvasRemove.apply(this, args); };
const gl = renderer.getContext(), options = createNativeOptions(), texts = new Map(), assets = new Map(), baselines = new Map();
const evidence = { ready: false, completion: false, error: null, target: 'Three0.186.1 WebGL2', sourceFrame: 'original authored XYZ/mm, caller Y-up',
  options, fixedCamera: cameraState, materialPolicy: 'unchanged DoubleSide MeshNormalMaterial, no lights or geometry substitutes',
  artifacts: [], history: [], comparisons: [], refusals: [], getterCalls: null, glErrors: [], disposed: false };
let host, busy = true, refusalsChecked = false, coldReopened = false, mixedCandidateSnapshot;
const requireFact = (fact, message) => { if (!fact) throw new Error(message); };
const same = (a, b) => Object.is(a, b) || (a !== null && b !== null && typeof a === 'object' && typeof b === 'object' &&
  Reflect.ownKeys(a).length === Reflect.ownKeys(b).length && Reflect.ownKeys(a).every(key => Object.hasOwn(b, key) && same(a[key], b[key])));
function sameBuffer(a, b) { if (a?.length !== b.length) return false; for (let i = 0; i < b.length; i++) if (!Object.is(a[i], b[i])) return false; return true; }
const hash = bytes => bytes.reduce((value, byte) => Math.imul(value ^ byte, 16777619) >>> 0, 2166136261);
const identityMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function frame() {
  renderer.render(scene, camera); const pixels = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const error = gl.getError(); evidence.glErrors.push(error); requireFact(error === gl.NO_ERROR, `WebGL error ${error}`); return pixels;
}
function pixelDifference(a, b) {
  let total = 0;
  for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) total++;
  return total;
}
function callerRetained() {
  return marker.parent === scene && canvas.isConnected && !gl.isContextLost() && Object.values(callerDisposals).every(value => value === 0) &&
    same(camera.position.toArray(), cameraState.position) && same(camera.quaternion.toArray(), cameraState.quaternion) &&
    same(camera.projectionMatrix.toArray(), cameraState.projection) && same(camera.matrixWorld.toArray(), cameraState.worldMatrix);
}
function currentSourcePin(record) {
  const file = `${record.assetKey}.complete-${record.state === 'original' ? 'original' : 'candidate'}.source0.css`;
  const pin = PINS.find(value => value.file === file);
  requireFact(pin && texts.get(file) === record.source && new TextEncoder().encode(record.source).length === pin.bytes,
    'Accepted complete source differs from actual pinned HTTP source'); return pin;
}
function resourceSnapshot() {
  return host.records.map((record, index) => ({ recordIndex: index, key: record.assetKey, state: record.state,
    groupAttached: record.result.group.parent === scene,
    resources: record.resources.map(row => ({ surfaceId: row.surfaceId, geometryUuid: row.geometry.uuid, materialUuid: row.material.uuid,
      geometryDisposals: row.geometryDisposals, materialDisposals: row.materialDisposals })) }));
}
function sourceGraph() {
  const own = performance.getEntriesByType('resource').map(entry => entry.name).filter(url => /\/packages\/barocss-(cad|cad-interop)\//.test(url));
  const source = own.filter(url => /\/src\//.test(url)), dist = own.filter(url => /\/dist\//.test(url));
  requireFact(source.length > 0 && dist.length === 0, 'Expected actual public source module URLs without own dist'); return { source, dist };
}
function snapshot() {
  const accepted = host?.accepted;
  return structuredClone({ ...evidence, accepted: accepted ? { key: accepted.assetKey, state: accepted.state, source: accepted.source,
      model: accepted.model, unrenderedCurveIds: accepted.result.unrenderedCurveIds, wholeEdit: accepted.sourceEdit,
      centers: accepted.centers, proof: accepted.proof } : null,
    counts: { results: host?.records.length ?? 0, pairs: host?.records.reduce((total, record) => total + record.resources.length, 0) ?? 0 },
    resources: host ? resourceSnapshot() : [], events: host?.events ?? [], callerDisposals, callerRetained: callerRetained(),
    moduleURLs: evidence.ready ? sourceGraph() : { source: [], dist: [] } });
}
Object.defineProperty(window, 'loader1094', { value: Object.freeze({ snapshot }), writable: false, configurable: false });
function selectedSurface(record) {
  const asset = assets.get(record.assetKey); return record.model.objects.find(object => object.kind === 'surface' && object.id === asset.request.surfaceId);
}
function nativeCenter(surface) {
  const domain = surfaceDomain(surface), u = (domain.u[0] + domain.u[1]) / 2, v = (domain.v[0] + domain.v[1]) / 2;
  return { u, v, point: evaluateSurface(surface, u, v) };
}
function updateReadout(record, observed) {
  const pin = currentSourcePin(record), asset = assets.get(record.assetKey), whole = record.sourceEdit;
  const curves = record.model.objects.filter(object => object.kind === 'curve');
  document.querySelector('#readout').textContent = `Family: ${record.assetKey} / ${record.state}\n` +
    `Complete native Model: ${record.model.name}, source version 0, Model version ${record.model.version}, ${record.model.objects.length} original objects\n` +
    `Object order: ${record.model.objects.map(object => `${object.id} (${object.kind})`).join(' → ')}\n` +
    `Selected Surface: ${asset.request.surfaceId}; original native center (mm): ${JSON.stringify(observed.centerMM)}\n` +
    `Native query U/V: ${observed.centerQuery.u} / ${observed.centerQuery.v}; display scale 0.001 units/mm\n` +
    `Unrendered native Curves: ${curves.map(curve => `${curve.id} degree ${curve.degree}`).join(', ') || '(none)'}\n` +
    `Actual complete source: ${pin.bytes} UTF-8 bytes / ${record.source.length} UTF-16 code units; SHA256 ${pin.sha256}\n` +
    (whole ? `Actual changed scalar patches: ${whole.report.patchCount}; noOp=${whole.report.noOp}\nWhole source/model is asset authority; child proof Model has ${whole.edit.model.objects.length} object(s).\nPreservation/direct work scope:\n${JSON.stringify({ preservation: whole.report.preservation, directCounts: whole.report.directCounts, workScope: whole.report.workScope }, null, 2)}\n` :
      'Original complete asset loaded. Candidate editing has not been applied to this admission.\n') +
    'No native Curve is drawn. The source retains Unicode, comments, original literal spelling and siblings; target triangles are display data.';
  document.querySelector('#source-text').value = record.source;
  document.querySelector('#full-proof').textContent = JSON.stringify(whole ?? { originalSource: record.source, originalModel: record.model,
    selectedSurfaceId: asset.request.surfaceId }, (_key, value) => typeof value === 'number' && Object.is(value, -0) ? '-0 (negative zero)' : value, 2);
  const table = document.querySelector('#surface-observations'); table.replaceChildren();
  for (const surface of observed.surfaces) {
    const row = document.createElement('tr');
    for (const value of [surface.id, surface.pixels, surface.hash]) { const cell = document.createElement('td'); cell.textContent = String(value); row.append(cell); }
    table.append(row);
  }
}
function compareMeshes(current, before, label) {
  requireFact(sameBuffer(current.positions, before.positions) && sameBuffer(current.normals, before.normals) &&
    sameBuffer(current.parameters, before.parameters) && sameBuffer(current.indices, before.indices) && sameBuffer(current.pixels, before.pixels), label);
}
function observeRecord(record) {
  requireFact(host.accepted === record && record.result.group.parent === scene && record.resources.every(row => row.geometryDisposals === 0 && row.materialDisposals === 0), 'Candidate must be mounted and live before rendering');
  requireFact(host.records.filter(other => other !== record).every(other => other.result.group.parent === null &&
    other.resources.every(row => row.geometryDisposals === 1 && row.materialDisposals === 1)), 'Old result must be released before a replacement render');
  const asset = assets.get(record.assetKey), result = record.result, neutral = parseBaroCadSource(record.source, options);
  requireFact(same(record.model, result.model) && same(result.model, neutral.model) && result.source === record.source &&
    result.model.version === 0 && result.curves.length === 0 && same(result.unrenderedCurveIds, result.model.objects.filter(object => object.kind === 'curve').map(object => object.id)) &&
    result.group.children.length === result.surfaces.length && record.resources.length === result.surfaces.length, 'Whole source/native siblings/Surface-only binding differs');
  currentSourcePin(record);
  frame();
  for (const row of record.resources) {
    const preview = neutral.surfaces.find(surface => surface.surfaceId === row.surfaceId), object = row.object;
    requireFact(object instanceof Mesh && object.name === row.surfaceId && object.userData.surfaceId === row.surfaceId &&
      object.material instanceof MeshNormalMaterial && object.material.side === DoubleSide && object.matrixWorld.elements.every((value, i) => value === identityMatrix[i]) &&
      preview.report.vertexCount === 64 && preview.report.triangleCount === 98 && sameBuffer(object.geometry.getAttribute('position').array, preview.mesh.positions) &&
      sameBuffer(object.geometry.getAttribute('normal').array, preview.mesh.normals) && sameBuffer(object.geometry.getAttribute('_CAD_UV').array, preview.mesh.parameters) &&
      sameBuffer(object.geometry.index.array, preview.mesh.indices) && preview.packet.positions.every((value, p) => Object.is(Math.fround(value * 0.001), preview.mesh.positions[p])),
      'Actual whole-asset Surface identity/material/buffers/native U/V/mm conversion differs');
  }
  const visibility = record.resources.map(row => row.object.visible), meshes = new Map(), surfaces = [];
  let background;
  try {
    record.resources.forEach(row => { row.object.visible = false; }); background = frame();
    for (const row of record.resources) {
      row.object.visible = true; const pixels = frame(), contribution = pixelDifference(pixels, background);
      requireFact(contribution > 0, `Actual Surface invisible: ${record.assetKey}/${row.surfaceId}`);
      const observed = { id: row.surfaceId, pixels: contribution, hash: hash(pixels) };
      meshes.set(row.surfaceId, { pixels, positions: Float32Array.from(row.object.geometry.getAttribute('position').array),
        normals: Float32Array.from(row.object.geometry.getAttribute('normal').array), parameters: Float32Array.from(row.object.geometry.getAttribute('_CAD_UV').array),
        indices: Uint16Array.from(row.object.geometry.index.array) }); surfaces.push(observed); row.object.visible = false;
    }
  } finally { record.resources.forEach((row, i) => { row.object.visible = visibility[i]; }); }
  const combined = frame(), selected = selectedSurface(record), center = nativeCenter(selected);
  const observed = { key: record.assetKey, state: record.state, recordIndex: host.records.length - 1, frameHash: hash(combined),
    surfaces, centerMM: center.point, centerQuery: { u: center.u, v: center.v }, sourcePin: currentSourcePin(record),
    sourceUTF16: record.source.length, unrenderedCurveIds: [...result.unrenderedCurveIds], wholeSource: record.source,
    targetPositionsAreDerived: true, combinedPixels: pixelDifference(combined, background) };
  if (record.state === 'original') baselines.set(record.assetKey, { source: record.source, model: structuredClone(record.model), meshes, combined, center: center.point });
  if (record.state === 'candidate') {
    const before = baselines.get(record.assetKey); requireFact(before, 'Real original observation missing');
    const selectedId = asset.request.surfaceId;
    for (const object of before.model.objects.filter(object => object.id !== selectedId)) requireFact(same(object, record.model.objects.find(candidate => candidate.id === object.id)), 'Original native sibling bits changed');
    if (meshes.has('context_plane')) compareMeshes(meshes.get('context_plane'), before.meshes.get('context_plane'), 'Unselected context plane changed buffers or actual RGBA');
    if (['signed_zero_only', 'no_op_original_spelling'].includes(record.assetKey)) {
      for (const [id, mesh] of meshes) compareMeshes(mesh, before.meshes.get(id), 'Signed-zero/no-op target buffers or independent RGBA changed');
      requireFact(sameBuffer(combined, before.combined), 'Signed-zero/no-op actual whole frame changed');
      if (record.assetKey === 'signed_zero_only') requireFact(!Object.is(before.model.objects.find(object => object.id === selectedId).controlPoints[0][0][0],
        selected.controlPoints[0][0][0]) && Object.is(selected.controlPoints[0][0][0], -0) && record.source !== before.source && record.sourceEdit.report.patchCount === 1,
        'Actual qualified signed-zero source/native bit change missing');
      else requireFact(record.source === before.source && same(record.model, before.model) && record.sourceEdit.report.patchCount === 0 && record.sourceEdit.report.noOp,
        'Actual no-op source spelling/native state changed');
      evidence.comparisons.push({ key: record.assetKey, buffersExact: true, independentRGBAExact: true, fullRGBAExact: true,
        nativeSignedZeroChange: record.assetKey === 'signed_zero_only', noOpSpellingExact: record.assetKey === 'no_op_original_spelling' });
    } else {
      const oldSelected = before.meshes.get(selectedId), editedSelected = meshes.get(selectedId);
      requireFact(!sameBuffer(editedSelected.positions, oldSelected.positions) && pixelDifference(editedSelected.pixels, oldSelected.pixels) > 0 &&
        pixelDifference(combined, before.combined) > 0, 'Native shape edit did not change actual selected buffers/pixels or whole frame');
      evidence.comparisons.push({ key: record.assetKey, selectedBufferChanged: true, selectedPixelsChanged: true, fullFrameChanged: true,
        contextPlaneExact: meshes.has('context_plane'), nativeBeforeCenterMM: before.center, nativeAfterCenterMM: center.point });
    }
    if (record.assetKey === 'mixed_weighted') mixedCandidateSnapshot = { source: record.source, model: structuredClone(record.model), meshes, combined };
  }
  if (record.state === 'cold-reopen') {
    requireFact(mixedCandidateSnapshot && record.source === mixedCandidateSnapshot.source && same(record.model, mixedCandidateSnapshot.model), 'Cold reopen changed the complete candidate source/Model');
    for (const [id, mesh] of meshes) compareMeshes(mesh, mixedCandidateSnapshot.meshes.get(id), 'Cold reopen changed native-derived buffers or independent RGBA');
    requireFact(sameBuffer(combined, mixedCandidateSnapshot.combined), 'Cold reopen changed actual complete candidate frame');
    evidence.comparisons.push({ key: record.assetKey, coldReopenWholeSourceExact: true, modelExact: true, independentRGBAExact: true, fullRGBAExact: true });
  }
  requireFact(callerRetained(), 'Caller resources or fixed camera changed');
  evidence.history.push(observed); updateReadout(record, observed); syncControls();
}
host = createSourceEditHost({ scene, onChange(record) {
  if (record && record.resources.some(row => row.geometryDisposals === 0)) observeRecord(record);
  else frame();
} });
const status = message => { document.querySelector('#status').textContent = message; };
function syncControls() {
  const count = evidence.history.length, accepted = host?.accepted;
  document.querySelector('#run-refusals').disabled = busy || evidence.disposed || count !== 1 || refusalsChecked;
  document.querySelector('#apply-edit').disabled = busy || evidence.disposed || !accepted || accepted.state !== 'original' || (count === 1 && !refusalsChecked);
  document.querySelector('#cold-reopen').disabled = busy || evidence.disposed || count !== 2 || coldReopened;
  document.querySelector('#original-signed-zero').disabled = busy || evidence.disposed || count !== 3;
  document.querySelector('#original-noop').disabled = busy || evidence.disposed || count !== 5;
  document.querySelector('#original-maximum').disabled = busy || evidence.disposed || count !== 7;
  document.querySelector('#original-cold-reedit').disabled = busy || evidence.disposed || count !== 9;
  document.querySelector('#dispose').disabled = busy || evidence.disposed || count !== 11;
}
async function load() {
  requireFact(gl instanceof WebGL2RenderingContext, 'WebGL2 required');
  await Promise.all(PINS.map(async pin => {
    const url = new URL(`./source-surface-control-net-three-data/${pin.file}`, location.href), response = await fetch(url);
    requireFact(response.ok, `HTTP ${response.status}: ${pin.file}`); const bytes = await response.arrayBuffer();
    const contentType = response.headers.get('content-type'), contentLength = response.headers.get('content-length');
    if (pin.file.endsWith('.source0.css')) requireFact(/^text\/plain\b/i.test(contentType ?? '') && Number(contentLength) === pin.bytes, 'Expected actual unchanged CAD HTTP bytes and headers');
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
    requireFact(bytes.byteLength === pin.bytes && sha256 === pin.sha256, `Original producer bytes changed: ${pin.file}`);
    texts.set(pin.file, new TextDecoder('utf-8', { fatal: true }).decode(bytes)); evidence.artifacts.push({ file: pin.file, url: url.href, status: response.status, contentType, contentLength, bytes: bytes.byteLength, sha256 });
  }));
  requireFact(evidence.artifacts.length === 25, 'Expected all 25 actual original HTTP files');
  for (const key of CASE_KEYS) assets.set(key, await loadCase(key, file => { requireFact(texts.has(file), `Missing actual fetched file ${file}`); return texts.get(file); }));
  await host.loadOriginal(assets.get(CASE_KEYS[0])); evidence.ready = true; document.documentElement.dataset.loader1094Ready = 'true';
  sourceGraph(); status('Complete mixed original loaded. Both actual Surfaces are visible independently; degree-five native Curve is retained without display. Run 16 actual refusals.');
}
async function refusals() {
  const before = host.accepted, source = before.source, model = structuredClone(before.model), children = [...scene.children], frameBefore = frame(), recordsBefore = host.records.length;
  const outcome = await host.runRefusals(assets.get(CASE_KEYS[0]));
  requireFact(outcome.refusals.length === 16 && outcome.getterCalls === 0 && outcome.acceptedRetained && host.accepted === before &&
    before.source === source && same(before.model, model) && host.records.length === recordsBefore && children.length === scene.children.length &&
    children.every((child, i) => child === scene.children[i]) && before.resources.every(row => row.geometryDisposals === 0 && row.materialDisposals === 0) &&
    sameBuffer(frame(), frameBefore) && callerRetained(), 'Actual refusal batch changed accepted complete source/native/Scene/frame/resources');
  evidence.refusals = outcome.refusals; evidence.getterCalls = outcome.getterCalls; evidence.refusalFrameRetained = true; refusalsChecked = true;
  document.querySelector('#refusal-readout').textContent = JSON.stringify(outcome, null, 2); status('All 16 actual refusals retained the accepted source, native Model and exact frame. Accessor getters were not called. Apply the mixed edit.');
}
async function apply() {
  const asset = assets.get(host.accepted.assetKey); await host.applyEdit(asset); status('Complete candidate admitted. Source/native proof and actual Surface frames updated; old display resources released before render.');
}
async function reopen() {
  await host.coldReopen(); coldReopened = true; status('Complete mixed candidate cold-reopened into a fresh public result. Full source, native Model, buffers and actual frames remain exact. Load signed-zero original next.');
}
async function original(key) { await host.loadOriginal(assets.get(key)); status(`Complete ${key} original loaded into fresh Surface resources. Apply this family edit.`); }
function dispose() {
  const cpu = host.records.map(record => ({ record, source: record.source, model: structuredClone(record.model) }));
  host.dispose(); host.dispose();
  const actualResources = host.records.flatMap(record => record.resources);
  requireFact(new Set(actualResources.map(row => row.geometry.uuid)).size === 20 && new Set(actualResources.map(row => row.material.uuid)).size === 20, 'Expected 20 distinct actual geometry/material owners');
  requireFact(host.records.length === 11 && host.records.reduce((total, record) => total + record.resources.length, 0) === 20 &&
    host.records.every(record => record.result.group.parent === null && record.resources.every(row => row.geometryDisposals === 1 && row.materialDisposals === 1)) &&
    cpu.every(item => item.record.source === item.source && same(item.record.model, item.model)) && scene.children.length === 1 && callerRetained(),
    'Final 11-result/20-pair cleanup crossed native/caller/resource boundaries');
  const pixels = frame(); let greenPixels = 0;
  for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 40 && pixels[i + 1] > 200 && pixels[i + 2] < 40) greenPixels++;
  requireFact(greenPixels > 0, 'Caller standing marker lost actual pixels after cleanup');
  evidence.disposed = true; evidence.completion = true; evidence.ownedPairsReleasedOnce = 20; evidence.nativeCPUReadable = true; evidence.standingGreenPixelsAfterCleanup = greenPixels;
  status('All 20 real geometry/material pairs released once after 11 accepted results. Complete native source/Models and caller Scene, camera, renderer, canvas and standing marker remain.');
}
async function run(action) {
  if (busy || evidence.disposed) return; busy = true; syncControls();
  try { await action(); }
  catch (error) { evidence.error = { name: error.name, message: error.message, stack: error.stack }; status(`Failed: ${error.message}`); console.error(error); }
  finally { busy = false; syncControls(); }
}
document.querySelector('#run-refusals').addEventListener('click', () => run(refusals));
document.querySelector('#apply-edit').addEventListener('click', () => run(apply));
document.querySelector('#cold-reopen').addEventListener('click', () => run(reopen));
document.querySelector('#original-signed-zero').addEventListener('click', () => run(() => original('signed_zero_only')));
document.querySelector('#original-noop').addEventListener('click', () => run(() => original('no_op_original_spelling')));
document.querySelector('#original-maximum').addEventListener('click', () => run(() => original('maximum_64_scalar_patches')));
document.querySelector('#original-cold-reedit').addEventListener('click', () => run(() => original('cold_candidate_reedit')));
document.querySelector('#dispose').addEventListener('click', () => run(dispose));
syncControls();
try { await load(); } catch (error) { evidence.error = { name: error.name, message: error.message, stack: error.stack }; status(`Failed: ${error.message}`); console.error(error); }
finally { busy = false; syncControls(); }
