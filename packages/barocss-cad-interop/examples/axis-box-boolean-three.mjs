import { parseBaroCadSource } from '@barocss/cad-interop/native';
import { DoubleSide, Mesh, MeshBasicMaterial, MeshNormalMaterial, OrthographicCamera, PerspectiveCamera, Scene, SphereGeometry, Vector3, WebGLRenderer } from 'three';
import { CASE_KEYS, PINS, createNativeOptions, loadCase } from './axis-box-boolean-three-fixture.mjs';
import { createBooleanThreeHost } from './axis-box-boolean-three-checkpoint.mjs';

performance.setResourceTimingBufferSize(4096);
const width = 900, height = 640, scene = new Scene();
const renderer = new WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(width, height); renderer.setClearColor(0x101b2c); document.querySelector('#view').append(renderer.domElement);
const exterior = new OrthographicCamera(-0.008, 0.008, 0.005688888888888889, -0.005688888888888889, 0.0001, 1);
const front = new OrthographicCamera(-0.006328125, 0.006328125, 0.0045, -0.0045, 0.0001, 1);
const interior = new PerspectiveCamera(75, width / height, 0.00001, 1);
for (const [camera, eye, target] of [[exterior, [0.015, 0.014, 0.018], [0.003, 0.003, 0.003]],
  [front, [0.003, 0.003, 0.018], [0.003, 0.003, 0.003]], [interior, [0.003, 0.003, 0.003], [0.004, 0.004, 0.004]]]) {
  camera.position.fromArray(eye); camera.up.set(0, 1, 0); camera.lookAt(new Vector3().fromArray(target)); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
}
const cameras = { exterior, front, interior }, fixedCameras = Object.fromEntries(Object.entries(cameras).map(([key, camera]) => [key, {
  position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), projection: camera.projectionMatrix.toArray(), worldMatrix: camera.matrixWorld.toArray(),
  near: camera.near, far: camera.far, up: camera.up.toArray(), type: camera.type }]));
let view = 'exterior';
const markerGeometry = new SphereGeometry(0.00018, 8, 6), markerMaterial = new MeshBasicMaterial({ color: 0x00ff00 });
const marker = new Mesh(markerGeometry, markerMaterial); marker.position.set(0.007, -0.0005, 0.001); scene.add(marker);
const callerDisposals = { geometry: 0, material: 0, renderer: 0, canvasRemoval: 0 };
markerGeometry.addEventListener('dispose', () => callerDisposals.geometry++); markerMaterial.addEventListener('dispose', () => callerDisposals.material++);
const originalRendererDispose = renderer.dispose; renderer.dispose = function (...args) { callerDisposals.renderer++; return originalRendererDispose.apply(this, args); };
const canvas = renderer.domElement, originalCanvasRemove = canvas.remove;
canvas.remove = function (...args) { callerDisposals.canvasRemoval++; return originalCanvasRemove.apply(this, args); };
const gl = renderer.getContext(), options = createNativeOptions(), texts = new Map(), assets = new Map();
const evidence = { ready: false, status: 'loading', error: null, target: 'Three0.186.1 WebGL2', options, fixedCameras, HTTPpins: [], history: [],
  refusals: [], controls: [], cameraObservations: [], glErrors: [], consoleErrors: [], cleanup: null, allNativeCPUReadable: false,
  GLqueries: { created: 0, deleted: 0, active: 0 },
  displayPolicy: 'Complete authored identity Surface panels; MeshNormalMaterial DoubleSide; four native Curves per panel retained without Lines; shared depth, no lights or cutaway' };
let host, busy = true, refusalsDone = false, firstCavity;
const requireFact = (condition, message) => { if (!condition) throw new Error(message); };
const same = (a, b) => Object.is(a, b) || (a !== null && b !== null && typeof a === 'object' && typeof b === 'object' &&
  Reflect.ownKeys(a).length === Reflect.ownKeys(b).length && Reflect.ownKeys(a).every(key => Object.hasOwn(b, key) && same(a[key], b[key])));
function sameBuffer(a, b) { if (!a || a.length !== b.length) return false; for (let i = 0; i < b.length; i++) if (!Object.is(a[i], b[i])) return false; return true; }
function hash(bytes) { let value = 2166136261; for (const byte of bytes) value = Math.imul(value ^ byte, 16777619) >>> 0; return value; }
const identityMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function frame() {
  renderer.render(scene, cameras[view]); const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels); const error = gl.getError(); evidence.glErrors.push(error);
  requireFact(error === gl.NO_ERROR, `WebGL error ${error}`); return pixels;
}
function pixelDifference(a, b) { let count = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) count++; return count; }
function callerRetained() {
  return marker.parent === scene && canvas.isConnected && !gl.isContextLost() && Object.values(callerDisposals).every(value => value === 0) &&
    Object.entries(cameras).every(([key, camera]) => same(camera.position.toArray(), fixedCameras[key].position) && same(camera.quaternion.toArray(), fixedCameras[key].quaternion) &&
      same(camera.projectionMatrix.toArray(), fixedCameras[key].projection) && same(camera.matrixWorld.toArray(), fixedCameras[key].worldMatrix));
}
function sourceGraph() {
  const urls = [...new Set(performance.getEntriesByType('resource').map(entry => entry.name).filter(url => /\/packages\/barocss-(cad|cad-interop)\//.test(url)))];
  const source = urls.filter(url => /\/src\//.test(url)), dist = urls.filter(url => /\/dist\//.test(url));
  requireFact(source.length > 0 && dist.length === 0, 'Actual public source URLs required, with zero owned dist');
  return { source, dist, observedSourceURLs: source.length, frozenWriteFalseGraph: { ownSource: 160, ownDist: 0 }, scope: 'ResourceTiming URLs are browser observations; write:false graph count is a separate scoped preparation' };
}
function resourceSnapshot() {
  return host.allResources.map(row => ({ qualification: row.qualification, surfaceId: row.object.name, geometryUuid: row.geometry.uuid, materialUuid: row.material.uuid,
    geometryDisposals: row.geometryDisposals, materialDisposals: row.materialDisposals, currentCPUPositions: Array.from(row.geometry.getAttribute('position').array) }));
}
function snapshot() {
  const current = host?.accepted;
  return structuredClone({ ...evidence, view, glChecks: evidence.glErrors.length, caller: { retained: callerRetained(), disposals: callerDisposals,
    sceneChildren: scene.children.map(child => ({ name: child.name, callerMarker: child === marker })), canvasConnected: canvas.isConnected },
    counts: { collections: host?.records.length ?? 0, acceptedResults: host?.records.reduce((count, record) => count + record.results.length, 0) ?? 0,
      pairs: host?.allResources.length ?? 0, targetParseCalls: host?.targetParseCalls ?? 0, peakLivePairs: host?.peakLivePairs ?? 0, livePairs: host?.counts.livePairs ?? 0, partialPairs: host?.counts.partialPairs ?? 0 },
    resources: host ? resourceSnapshot() : [], events: host?.events ?? [],
    accepted: current ? { key: current.assetKey, state: current.state, native: current.proof.classification, boolean: current.proof.boolean,
      operandModels: current.proof.operandModels, panelModels: current.proof.panelModels, readout: current.readout, results: current.results.map(result => ({ source: result.source, model: result.model,
        unrenderedCurveIds: result.unrenderedCurveIds, childIds: result.group.children.map(child => child.name) })), rootAttached: current.root?.parent === scene } : null,
    sourceGraph: evidence.ready ? sourceGraph() : { source: [], dist: [] } });
}
Object.defineProperty(window, 'loader1114', { value: Object.freeze({ snapshot }), writable: false, configurable: false });
function status(message) { evidence.status = message; document.querySelector('#status').textContent = message; }
function appendCell(row, value) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }
function numberText(value) { return Object.is(value, -0) ? '-0' : String(value); }
function queryTable(classification) {
  const rows = document.querySelector('#query-rows'); rows.replaceChildren();
  classification.classifications.forEach((result, index) => {
    const query = classification.queries[index], row = document.createElement('tr');
    appendCell(row, `${query.queryId}\n[${query.pointMM.map(numberText).join(', ')}] mm`); appendCell(row, result.status);
    appendCell(row, `Bodies: ${result.bodyIds.join(', ') || 'none'}\nEmpty regions: ${result.emptyRegionIds.join(', ') || 'none'}`);
    appendCell(row, result.boundaryPanels.map(panel => `${panel.sourceId} / ${panel.panelId}\n${panel.bodyId} / ${panel.shellId} (${panel.shellRole})\n${panel.emptyRegionId} / ${panel.localFaceId} / ${panel.surfaceId}`).join('\n') || 'No boundary panel'); rows.append(row);
  });
}
function readout(record, observed) {
  const native = record.proof.boolean, report = native.report;
  document.querySelector('#readout').textContent = `Case: ${record.assetKey} / ${record.state}\n` +
    `Complete original collection: ${native.panels.length} panels, ${native.bodies.length} Bodies, ${native.shells.length} Shells\n` +
    `Bodies: ${native.bodies.map(body => body.id).join(', ') || 'none'}\nShells: ${native.shells.map(shell => `${shell.id} (${shell.role}, ${shell.panelIds.length} panels)`).join(', ') || 'none'}\n` +
    `Whole operand Models: ${record.proof.operandModels.map(model => `${model.name}, version ${model.version}, ${model.objects.length} objects`).join('; ')}\n` +
    `Each whole panel Model: version 0, one Surface + four unrendered Curves; 2x2 native grid / four vertices / two triangles\n` +
    `Original XYZ/mm, identity world transforms; 0.001 scene units/mm once. No Curve Lines.\n` +
    `Current view: ${view}; combined frame hash ${observed.frameHash}\nIndependently observed genuine panels: ${observed.surfaces.length}; combined depth can occlude panels.\n` +
    `Actual native volume/area and aggregate quality are retained in the complete proof; empty=${native.panels.length === 0}.`;
  queryTable(record.proof.classification);
  document.querySelector('#quality').textContent = `Whole native Boolean report:\n${JSON.stringify(report, null, 2)}\n` +
    `Native point classification numeric policy:\n${JSON.stringify(record.proof.classification.report.numericPolicy, null, 2)}\n` +
    'Each panel FaceBundle remains open and solid:false. The restricted nonempty Boolean aggregate can be certified independently. Neither camera pixels nor display rays are native picking or general curved-Solid authority.';
  fillDetails();
}
function fillDetails() {
  document.querySelector('#full-proof').textContent = document.querySelector('#proof-details').open && host?.accepted ? JSON.stringify({ boolean: host.accepted.proof.boolean,
    classification: host.accepted.proof.classification, originalOperandModels: host.accepted.proof.operandModels }, null, 2) : '';
  document.querySelector('#lifetime-proof').textContent = document.querySelector('#lifetime-details').open && host ? JSON.stringify({ counts: snapshot().counts,
    resources: resourceSnapshot(), events: host.events, cameraObservations: evidence.cameraObservations }, null, 2) : '';
}
function completeVisible(record) { return record.resources.every(row => row.object.visible && row.object.parent?.visible); }
function captureWithVisibility(record, callback) {
  const saved = record.resources.map(row => row.object.visible);
  try { return callback(); } finally { record.resources.forEach((row, index) => { row.object.visible = saved[index]; }); }
}
function validateTargets(record) {
  requireFact(record.proof.boolean.sources.length === record.results.length && record.resources.length === record.results.length && record.resources.length === record.proof.boolean.panels.length,
    'Complete original source/results/Surface collection count differs');
  if (!record.results.length) requireFact(record.root === null, 'Empty proof must allocate no display root or fake Mesh');
  else requireFact(record.root?.parent === scene, 'Whole candidate collection must be attached before observation');
  requireFact(host.records.filter(previous => previous !== record).every(previous => previous.root?.parent !== scene && previous.resources.every(row => row.geometryDisposals === 1 && row.materialDisposals === 1)), 'Previous resources must be released before replacement render');
  for (const row of record.resources) {
    const q = row.qualification, result = record.results.find(value => value.group.children.includes(row.object));
    const panel = record.proof.boolean.panels.find(value => value.id === q.panelId), source = record.proof.boolean.sources.find(value => value.sourceId === q.sourceId);
    requireFact(result && source && panel && source.panelId === panel.id && q.bodyId === panel.bodyId && q.emptyRegionId === panel.emptyRegionId, 'Actual qualified native panel binding differs');
    const shell = record.proof.boolean.shells.find(value => value.id === q.shellId);
    requireFact(shell && shell.panelIds.includes(panel.id) && shell.role === q.shellRole && row.object.parent === result.group &&
      result.group.parent?.parent?.parent === record.root, 'Original Mesh/result/Shell/Body/root hierarchy differs');
    const neutral = parseBaroCadSource(result.source, options), mesh = row.object, preview = neutral.surfaces[0];
    requireFact(result.source === source.source && same(result.model, source.model) && same(result.model, panel.bundle.geometry) && same(result.model, neutral.model) &&
      result.model.version === 0 && result.model.objects.length === 5 && result.surfaces.length === 1 && result.curves.length === 0 && result.unrenderedCurveIds.length === 4 && result.group.children.length === 1 &&
      mesh instanceof Mesh && mesh.name === q.surfaceId && mesh.userData.surfaceId === q.surfaceId && preview.surfaceId === q.surfaceId &&
      mesh.material instanceof MeshNormalMaterial && mesh.material.side === DoubleSide && mesh.geometry.attributes.position.count === 4 && mesh.geometry.index.count === 6 &&
      sameBuffer(mesh.geometry.attributes.position.array, preview.mesh.positions) && sameBuffer(mesh.geometry.attributes.normal.array, preview.mesh.normals) &&
      sameBuffer(mesh.geometry.attributes._CAD_UV.array, preview.mesh.parameters) && sameBuffer(mesh.geometry.index.array, preview.mesh.indices) &&
      preview.packet.positions.every((value, index) => Object.is(Math.fround(value * 0.001), preview.mesh.positions[index])) && row.geometryDisposals === 0 && row.materialDisposals === 0,
    'Whole panel Model/native siblings/actual Surface buffers/UV/material/scale differ');
  }
  frame();
  requireFact(record.resources.every(row => row.object.matrixWorld.elements.every((value, index) => value === identityMatrix[index])), 'Authored native world identity changed');
}
function observeRecord(record) {
  requireFact(host.accepted === record && view === 'exterior', 'Every admission uses the explicitly selected fixed Exterior view'); validateTargets(record);
  const combined = frame(), surfaces = [];
  captureWithVisibility(record, () => {
    record.resources.forEach(row => { row.object.visible = false; }); const background = frame();
    for (const row of record.resources) {
      row.object.visible = true; const isolated = frame(); row.object.visible = false;
      const pixels = pixelDifference(isolated, background); requireFact(pixels > 0, `Invisible genuine qualified panel ${row.qualification.sourceId}/${row.qualification.panelId}`);
      surfaces.push({ id: `${row.qualification.sourceId}/${row.qualification.panelId}/${row.qualification.surfaceId}`, qualification: { ...row.qualification }, pixels, hash: hash(isolated),
        nativeUVExact: true, targetBuffersExact: true, worldIdentity: true });
    }
  });
  const restored = frame(); requireFact(sameBuffer(combined, restored) && completeVisible(record) && callerRetained(), 'Individual observation failed to restore the full collection/frame/caller');
  const observed = { key: record.assetKey, state: record.state, recordIndex: host.records.length - 1, frameHash: hash(restored), view, surfaces,
    panelCount: record.results.length, bodies: record.proof.boolean.bodies.map(body => body.id), shells: record.proof.boolean.shells.map(shell => ({ id: shell.id, role: shell.role, panelCount: shell.panelIds.length })),
    targetBuffersExact: true, fullCollectionRestored: true, empty: record.results.length === 0 };
  if (record.assetKey === 'cavity' && record.state === 'original') firstCavity = { exterior: restored.slice(), surfaces: structuredClone(surfaces), models: record.results.map(result => structuredClone(result.model)),
    buffers: record.resources.map(row => ({ positions: [...row.positions], normals: [...row.normals], parameters: [...row.parameters], indices: [...row.indices] })), interior: null };
  if (record.state === 'cold-reopen') {
    requireFact(firstCavity && sameBuffer(restored, firstCavity.exterior) && same(surfaces, firstCavity.surfaces) &&
      record.results.every((result, index) => same(result.model, firstCavity.models[index])) && record.resources.every((row, index) =>
        ['positions', 'normals', 'parameters', 'indices'].every(key => sameBuffer(row[key], firstCavity.buffers[index][key]))), 'Cold complete cavity changed actual full Exterior RGBA/qualified panel contributions/Models/buffers');
    evidence.coldReopen = { exteriorRGBAExact: true, completeBuffersExact: true, wholePanelModelsExact: true, individualPanelContributionsExact: true, interiorRGBAExact: false };
  }
  for (const control of record.proof.controls) {
    requireFact(control.name === 'cavity-camera-eye' && control.result.queries[0].pointMM.every(value => value === 3) && control.result.classifications[0].status === 'outside' &&
      control.result.classifications[0].emptyRegionIds.includes('cavity_void1'), 'Actual native cavity camera-eye control differs');
    evidence.controls.push({ key: record.assetKey, state: record.state, name: control.name, result: control.result });
  }
  evidence.history.push(observed); evidence.cameraObservations.push({ key: record.assetKey, state: record.state, view, frameHash: observed.frameHash, allPanelsAttached: true });
  readout(record, observed); syncControls();
}
host = createBooleanThreeHost({ scene, onChange(record) { if (record) observeRecord(record); else frame(); } });
async function observeInnerDepth(record, combined) {
  const rows = record.resources.filter(row => row.qualification.shellRole === 'cavity');
  const entries = rows.map(row => ({ row, before: row.object.onBeforeRender, after: row.object.onAfterRender, query: null,
    receipt: { qualification: { ...row.qualification }, drawCalls: 0, queryAllocated: false, queryResultAvailable: null, samplesPassed: null, deleteCalls: 0 } }));
  let active = null, callbacksRestored = false;
  try {
    for (const entry of entries) {
      entry.row.object.onBeforeRender = function (...args) {
        entry.before.apply(this, args); requireFact(active === null && entry.query === null, 'Expected one genuine draw per inner Surface and no overlapping depth queries');
        const query = gl.createQuery(); requireFact(query, 'Real WebGL2 depth query allocation failed'); entry.query = query;
        evidence.GLqueries.created++; evidence.GLqueries.active++; entry.receipt.queryAllocated = true; entry.receipt.drawCalls++;
        gl.beginQuery(gl.ANY_SAMPLES_PASSED, query); active = entry;
      };
      entry.row.object.onAfterRender = function (...args) {
        requireFact(active === entry, 'Actual inner Surface draw query did not match its after-render callback');
        gl.endQuery(gl.ANY_SAMPLES_PASSED); active = null; entry.after.apply(this, args);
      };
    }
    const queried = frame(); requireFact(sameBuffer(queried, combined), 'Genuine depth-query observation changed actual complete Interior RGBA');
    for (const entry of entries) { entry.row.object.onBeforeRender = entry.before; entry.row.object.onAfterRender = entry.after; }
    callbacksRestored = true;
    const deadline = performance.now() + 5000;
    for (let poll = 0; ; poll++) {
      let pending = false;
      for (const entry of entries) {
        if (!entry.query || entry.receipt.queryResultAvailable === true) continue;
        const available = gl.getQueryParameter(entry.query, gl.QUERY_RESULT_AVAILABLE); entry.receipt.queryResultAvailable = available;
        if (available) entry.receipt.samplesPassed = Boolean(gl.getQueryParameter(entry.query, gl.QUERY_RESULT)); else pending = true;
      }
      if (!pending) break;
      requireFact(poll < 120 && performance.now() < deadline, 'Actual inner depth query result did not become available within the bounded observation');
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
    requireFact(entries.some(entry => entry.receipt.samplesPassed === true), 'No actual full-scene inner Surface draw passed shared depth');
    const error = gl.getError(); evidence.glErrors.push(error); requireFact(error === gl.NO_ERROR, `WebGL depth query error ${error}`);
  } finally {
    if (active !== null) { gl.endQuery(gl.ANY_SAMPLES_PASSED); active = null; }
    for (const entry of entries) {
      entry.row.object.onBeforeRender = entry.before; entry.row.object.onAfterRender = entry.after;
      if (entry.query) { gl.deleteQuery(entry.query); entry.receipt.deleteCalls++; evidence.GLqueries.deleted++; evidence.GLqueries.active--; }
    }
  }
  requireFact(callbacksRestored && entries.every(entry => entry.row.object.onBeforeRender === entry.before && entry.row.object.onAfterRender === entry.after) && evidence.GLqueries.active === 0,
    'Actual inner draw callbacks or temporary WebGL query resources were not restored/released');
  const innerDraws = entries.map(entry => ({ ...entry.receipt, status: entry.query ? 'actual-draw-query' : 'not-drawn-by-actual-frustum' }));
  return { innerDraws, passedCount: innerDraws.filter(row => row.samplesPassed === true).length, actualQueries: innerDraws.filter(row => row.queryAllocated).length,
    deleted: innerDraws.reduce((count, row) => count + row.deleteCalls, 0), activeQueries: evidence.GLqueries.active, restoredCallbacks: true, queriedFullRGBAExact: true };
}
async function cameraObservation(name) {
  const record = host.accepted; requireFact(record, 'An actual accepted native collection is required');
  if (name === 'interior') requireFact(record.assetKey === 'cavity', 'Interior applies to the real bounded cavity only');
  view = name; const combined = frame(); let observation = { key: record.assetKey, state: record.state, view, frameHash: hash(combined), allPanelsAttached: true };
  if (name === 'interior') {
    const inner = record.resources.filter(row => row.qualification.shellRole === 'cavity'); requireFact(inner.length === 6 && record.resources.length === 60, 'Complete cavity must retain54 outer + 6 inner panels');
    const withoutInner = captureWithVisibility(record, () => { inner.forEach(row => { row.object.visible = false; }); return frame(); });
    const innerRemovalRGBADifferencePixels = pixelDifference(combined, withoutInner);
    requireFact(sameBuffer(frame(), combined) && completeVisible(record), 'Inner removal observation failed to restore exact complete Interior RGBA');
    const isolated = captureWithVisibility(record, () => {
      record.resources.forEach(row => { row.object.visible = false; }); const background = frame();
      inner.forEach(row => { row.object.visible = true; }); const pixels = frame(); return { pixels, background };
    });
    const innerOnlyPixels = pixelDifference(isolated.pixels, isolated.background); requireFact(innerOnlyPixels > 0 && sameBuffer(frame(), combined), 'Genuine inner-only shell has no pixels or complete frame restoration differs');
    const depthQueries = await observeInnerDepth(record, combined);
    observation = { ...observation, innerShellId: inner[0].qualification.shellId, innerPanels: inner.length, innerRemovalRGBADifferencePixels, innerOnlyPixels,
      innerOnlyFrameHash: hash(isolated.pixels), innerOnlyMatchesCompleteRGBA: sameBuffer(isolated.pixels, combined), restoredFullRGBAExact: true, depthQueries,
      nativeEyeStatus: 'outside-material/cavity_void1',
      scope: 'Actual per-draw WebGL2 depth query proves target fragments only. Removal color difference can be zero for homothetic cubes with default DoubleSide normal colors. All60panels remain attached; normal frustum/depth applies. No native picking certificate.' };
    if (record.state === 'original') firstCavity.interior = combined.slice();
    else { requireFact(firstCavity.interior && sameBuffer(combined, firstCavity.interior), 'Cold cavity Interior full RGBA changed'); evidence.coldReopen.interiorRGBAExact = true; }
  }
  if (name === 'front') observation = { ...observation, ...frontSamples(record, combined) };
  requireFact(callerRetained() && completeVisible(record), 'View control changed camera presets, caller or complete panel attachment');
  evidence.cameraObservations.push(observation); document.querySelector('#camera-readout').textContent = JSON.stringify(observation, null, 2);
  status(`Fixed ${name} view observed for ${record.assetKey}. Original panels and native proof remain unchanged.`); syncControls();
}
function patchDifference(a, b, pointMM) {
  const ndc = new Vector3().fromArray(pointMM).multiplyScalar(0.001).project(front), x = Math.floor((ndc.x + 1) * width / 2), y = Math.floor((ndc.y + 1) * height / 2);
  let pixels = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const i = ((y + dy) * width + x + dx) * 4; if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) pixels++; }
  return { pointMM, raster: { x, y }, patchPixels: pixels, radiusPixels: 1 };
}
function frontSamples(record, combined) {
  requireFact(record.assetKey === 'through' || record.assetKey === 'sever', 'Front gap observations apply to actual through/sever cases');
  const background = captureWithVisibility(record, () => { record.resources.forEach(row => { row.object.visible = false; }); return frame(); });
  const queryIds = record.assetKey === 'through' ? ['through_exterior_void', 'through_material'] : ['severed_exterior_void', 'left_body', 'right_body'];
  const samples = queryIds.map((id, index) => { const at = record.proof.classification.queries.findIndex(query => query.queryId === id), query = record.proof.classification.queries[at], result = record.proof.classification.classifications[at];
    requireFact(query && result.status === (index === 0 ? 'outside' : 'inside'), 'Actual native material control differs');
    const sample = patchDifference(combined, background, query.pointMM); requireFact(index === 0 ? sample.patchPixels === 0 : sample.patchPixels > 0, `Actual Front pixels differ for ${id}`);
    return { queryId: id, nativeStatus: result.status, nativeBodyIds: result.bodyIds, ...sample }; });
  requireFact(sameBuffer(frame(), combined), 'Front observation did not restore the exact full RGBA');
  return { samples, scope: 'Projected fixed-view pixels are target observations, not native ray/picking certification' };
}
function observed(key, state, name) { return evidence.cameraObservations.some(row => row.key === key && row.state === state && row.view === name); }
function syncControls() {
  const count = evidence.history.length, stop = busy || !!evidence.cleanup || !!evidence.error, current = host?.accepted;
  document.querySelector('#run-refusals').disabled = stop || count !== 1 || refusalsDone;
  document.querySelector('#load-cavity').disabled = stop || count !== 1 || !refusalsDone;
  document.querySelector('#view-interior').disabled = stop || current?.assetKey !== 'cavity' || view === 'interior' || observed('cavity', current?.state, 'interior');
  document.querySelector('#view-exterior').disabled = stop || view === 'exterior';
  document.querySelector('#load-through').disabled = stop || count !== 2 || view !== 'exterior' || !observed('cavity', 'original', 'interior');
  document.querySelector('#view-front').disabled = stop || !['through', 'sever'].includes(current?.assetKey) || observed(current?.assetKey, current?.state, 'front');
  document.querySelector('#load-sever').disabled = stop || count !== 3 || !observed('through', 'original', 'front');
  document.querySelector('#load-empty').disabled = stop || count !== 4 || !observed('sever', 'original', 'front');
  document.querySelector('#cold-cavity').disabled = stop || count !== 5;
  document.querySelector('#dispose').disabled = stop || count !== 6 || view !== 'exterior' || !observed('cavity', 'cold-reopen', 'interior');
}
async function load() {
  requireFact(gl instanceof WebGL2RenderingContext, 'Actual WebGL2 required');
  await Promise.all(PINS.map(async pin => {
    const url = new URL(`./axis-box-boolean-three-data/${pin.file}`, location.href), response = await fetch(url);
    requireFact(response.ok && pin.bytes <= 2 * 1024 * 1024, `HTTP or original size differs: ${pin.file}`);
    const contentType = response.headers.get('content-type'), contentLength = response.headers.get('content-length');
    requireFact(contentLength !== null && Number(contentLength) === pin.bytes, `Original length header differs: ${pin.file}`);
    const reader = response.body.getReader(), chunks = []; let length = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        length += value.byteLength;
        requireFact(length <= pin.bytes && length <= 2 * 1024 * 1024, `Original response exceeds its bound: ${pin.file}`);
        chunks.push(value);
      }
    } catch (error) { await reader.cancel(); throw error; } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    if (pin.file.endsWith('.css')) requireFact(/^text\/plain\b/i.test(contentType ?? '') && Number(contentLength) === pin.bytes, `Original CSS bytes/headers differ: ${pin.file}`);
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
    requireFact(bytes.byteLength === pin.bytes && sha256 === pin.sha256, `Pinned original changed: ${pin.file}`);
    texts.set(pin.file, new TextDecoder('utf-8', { fatal: true }).decode(bytes)); evidence.HTTPpins.push({ file: pin.file, url: url.href, status: response.status, bytes: bytes.byteLength, sha256, contentType, contentLength });
  }));
  requireFact(evidence.HTTPpins.length === 175 && evidence.HTTPpins.filter(pin => pin.file.endsWith('.css')).length === 155, 'Expected 175 original HTTP pins / 155 original CSS disk responses');
  for (const key of CASE_KEYS) assets.set(key, await loadCase(key, file => { requireFact(texts.has(file), `Missing original ${file}`); return texts.get(file); }));
  host.load(assets.get('union')); evidence.ready = true; document.documentElement.dataset.loader1114Ready = 'true'; sourceGraph();
  status('Complete union loaded. Run 13 actual refusals before advancing to cavity. Every native panel stays in the collection.');
}
function runRefusals() {
  const before = host.accepted, proof = structuredClone(before.proof), readout = structuredClone(before.readout), children = [...scene.children], pixels = frame(), records = host.records.length;
  const rows = before.resources.map(row => ({ row, buffers: ['position', 'normal', '_CAD_UV'].map(name => ({ name, reference: row.geometry.attributes[name].array, values: Array.from(row.geometry.attributes[name].array) })), index: row.geometry.index.array, indexValues: Array.from(row.geometry.index.array) }));
  const receipt = host.runRefusals(assets.get('union'));
  requireFact(receipt.refusals.length === 13 && receipt.getterCalls === 0 && receipt.acceptedRetained && host.accepted === before && host.records.length === records && same(before.proof, proof) && same(before.readout, readout) &&
    scene.children.length === children.length && children.every((child, index) => child === scene.children[index]) && rows.every(({ row, buffers, index, indexValues }) =>
      buffers.every(buffer => row.geometry.attributes[buffer.name].array === buffer.reference && sameBuffer(buffer.reference, buffer.values)) &&
      row.geometry.index.array === index && sameBuffer(index, indexValues) && row.geometryDisposals === 0 && row.materialDisposals === 0) && sameBuffer(frame(), pixels) && callerRetained(),
  'Actual thirteen refusals changed accepted whole native/readout/Scene/buffer identity/full RGBA/caller');
  requireFact(host.allResources.length === 44 && host.allResources.filter(row => row.geometryDisposals === 1 && row.materialDisposals === 1).length === 2, 'Controlled partial preparation must release exactly two genuine detached Surface pairs');
  evidence.refusals = receipt.refusals; evidence.getterCalls = receipt.getterCalls; evidence.refusalRGBAExact = true; refusalsDone = true;
  document.querySelector('#refusal-readout').textContent = JSON.stringify(receipt, null, 2); status('13 actual refusals retained whole union and exact full RGBA. Two explicitly controlled detached pairs were released once.');
}
function loadCaseExterior(key) { view = 'exterior'; host.load(assets.get(key)); status(`Complete ${key} loaded at fixed Exterior. Original authored coordinates and full native proof are retained.`); }
function coldCavity() { view = 'exterior'; host.coldReopen(assets.get('cavity')); status('Complete cavity cold-reopened: native whole source/Model/buffers and actual Exterior full RGBA are exact. Observe the fixed Interior again.'); }
function dispose() {
  const saved = host.records.map(record => ({ record, proof: structuredClone(record.proof), sources: record.results.map(result => result.source), models: record.results.map(result => structuredClone(result.model)) }));
  host.dispose(); host.dispose(); const rows = host.allResources;
  requireFact(host.accepted === null && host.records.length === 6 && host.records.reduce((count, record) => count + record.results.length, 0) === 206 && rows.length === 208 && host.peakLivePairs === 102 &&
    new Set(rows.map(row => row.geometry.uuid)).size === 208 && new Set(rows.map(row => row.material.uuid)).size === 208 && rows.every(row =>
      row.geometryDisposals === 1 && row.materialDisposals === 1 && typeof row.result.source === 'string' && row.result.model.version === 0 && row.result.model.objects.length === 5 &&
      row.result.unrenderedCurveIds.length === 4 && sameBuffer(row.geometry.attributes.position.array, row.positions) && sameBuffer(row.geometry.attributes.normal.array, row.normals) &&
      sameBuffer(row.geometry.attributes._CAD_UV.array, row.parameters) && sameBuffer(row.geometry.index.array, row.indices)) &&
    host.records.every(record => record.root?.parent !== scene && record.results.every(result => result.group.parent === null && result.group.children.length === 0)) &&
    saved.every(({ record, proof, sources, models }) => same(record.proof, proof) && record.results.every((result, index) => result.source === sources[index] && same(result.model, models[index]))) &&
    scene.children.length === 1 && view === 'exterior' && callerRetained() && evidence.coldReopen.interiorRGBAExact &&
    evidence.GLqueries.created > 0 && evidence.GLqueries.created === evidence.GLqueries.deleted && evidence.GLqueries.active === 0, 'Final whole native lifetime/208 real pair disposal/peak/caller retention differs');
  const pixels = frame(); let greenPixels = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 40 && pixels[i + 1] > 200 && pixels[i + 2] < 40) greenPixels++;
  requireFact(greenPixels > 0, 'Standing caller green marker lost actual pixels');
  evidence.cleanup = { doubleCall: true, collections: 6, acceptedResults: 206, partialResults: 2, pairs: rows.length, distinctGeometries: 208, distinctMaterials: 208,
    geometryDisposals: rows.reduce((sum, row) => sum + row.geometryDisposals, 0), materialDisposals: rows.reduce((sum, row) => sum + row.materialDisposals, 0), peakLivePairs: host.peakLivePairs, greenPixels, frameHash: hash(pixels), GLqueries: { ...evidence.GLqueries } };
  evidence.allNativeCPUReadable = true; status('208 actual Surface geometry/material pairs released once. Six native collections and all original CPU data remain readable. Caller Scene/cameras/renderer/canvas/green marker survive.'); fillDetails();
}
async function run(action) {
  if (busy || evidence.cleanup || evidence.error) return; busy = true; syncControls();
  try { await action(); } catch (error) { evidence.error = { name: error.name, message: error.message, stack: error.stack }; evidence.consoleErrors.push(evidence.error); status(`Failed: ${error.message}`); console.error(error); }
  finally { busy = false; syncControls(); }
}
for (const [id, action] of [['run-refusals', runRefusals], ['load-cavity', () => loadCaseExterior('cavity')], ['view-interior', () => cameraObservation('interior')],
  ['view-exterior', () => cameraObservation('exterior')], ['load-through', () => loadCaseExterior('through')], ['view-front', () => cameraObservation('front')],
  ['load-sever', () => loadCaseExterior('sever')], ['load-empty', () => loadCaseExterior('empty')], ['cold-cavity', coldCavity], ['dispose', dispose]])
  document.querySelector(`#${id}`).addEventListener('click', () => run(action));
document.querySelector('#proof-details').addEventListener('toggle', fillDetails); document.querySelector('#lifetime-details').addEventListener('toggle', fillDetails);
window.addEventListener('error', event => { evidence.consoleErrors.push({ name: 'WindowError', message: event.message }); });
window.addEventListener('unhandledrejection', event => { evidence.consoleErrors.push({ name: event.reason?.name ?? 'UnhandledRejection', message: event.reason?.message ?? String(event.reason) }); });
syncControls();
try { await load(); } catch (error) { evidence.error = { name: error.name, message: error.message, stack: error.stack }; evidence.consoleErrors.push(evidence.error); status(`Failed: ${error.message}`); console.error(error); }
finally { busy = false; syncControls(); }
