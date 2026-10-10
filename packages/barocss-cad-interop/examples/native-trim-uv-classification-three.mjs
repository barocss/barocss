import { parseBaroCadSource } from '@barocss/cad-interop/native';
import { DoubleSide, Mesh, MeshBasicMaterial, MeshNormalMaterial, OrthographicCamera, Scene, SphereGeometry, WebGLRenderer } from 'three';
import { CASE_KEYS, PINS, createNativeOptions, loadCase } from './native-trim-uv-classification-three-fixture.mjs';
import { createTrimUVHost } from './native-trim-uv-classification-three-checkpoint.mjs';

const width = 900, height = 640;
const scene = new Scene(), renderer = new WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(width, height); renderer.setClearColor(0x101b2c); document.querySelector('#view').append(renderer.domElement);
const camera = new OrthographicCamera(-0.015, 0.015, 0.010666666666666666, -0.010666666666666666, 0.0001, 1);
camera.position.set(0.025, 0.026, 0.04); camera.up.set(0, 1, 0); camera.lookAt(0.005, 0.005, 0.011);
camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
const cameraState = { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), projection: camera.projectionMatrix.toArray(), worldMatrix: camera.matrixWorld.toArray() };
const markerGeometry = new SphereGeometry(0.00018, 8, 6), markerMaterial = new MeshBasicMaterial({ color: 0x00ff00 });
const marker = new Mesh(markerGeometry, markerMaterial); marker.position.set(0.017, 0.004, 0.012); scene.add(marker);
const callerDisposals = { geometry: 0, material: 0, renderer: 0, canvasRemoval: 0 };
markerGeometry.addEventListener('dispose', () => callerDisposals.geometry++); markerMaterial.addEventListener('dispose', () => callerDisposals.material++);
const originalRendererDispose = renderer.dispose;
renderer.dispose = function (...args) { callerDisposals.renderer++; return originalRendererDispose.apply(this, args); };
const canvas = renderer.domElement, originalCanvasRemove = canvas.remove;
canvas.remove = function (...args) { callerDisposals.canvasRemoval++; return originalCanvasRemove.apply(this, args); };
const gl = renderer.getContext(), options = createNativeOptions(), texts = new Map(), assets = new Map();
const evidence = { ready: false, status: 'loading', error: null, target: 'Three0.186.1 WebGL2', options, fixedCamera: cameraState,
  displayPolicy: 'original untrimmed support MeshNormalMaterial/DoubleSide only; no cut Lines, fill or trimmed mesh',
  HTTPpins: [], history: [], controls: [], refusals: [], glErrors: [], cleanup: null, allNativeCPUReadable: false };
let host, busy = true, refusalsDone = false, editedPixels;
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
  let count = 0;
  for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) count++;
  return count;
}
function callerRetained() {
  return marker.parent === scene && renderer.domElement.isConnected && !gl.isContextLost() && Object.values(callerDisposals).every(value => value === 0) &&
    same(camera.position.toArray(), cameraState.position) && same(camera.quaternion.toArray(), cameraState.quaternion) &&
    same(camera.projectionMatrix.toArray(), cameraState.projection) && same(camera.matrixWorld.toArray(), cameraState.worldMatrix);
}
function sourceGraph() {
  const own = performance.getEntriesByType('resource').map(entry => entry.name).filter(url => /\/packages\/barocss-(cad|cad-interop)\//.test(url));
  const source = own.filter(url => /\/src\//.test(url)), dist = own.filter(url => /\/dist\//.test(url));
  requireFact(source.length > 0 && dist.length === 0, 'Expected actual own source module URLs with zero dist'); return { source, dist };
}
function resources() {
  return host.records.map((record, index) => ({ recordIndex: index, key: record.assetKey, state: record.state, groupAttached: record.result.group.parent === scene,
    resources: record.resources.map(row => ({ surfaceId: row.object.name, geometryUuid: row.geometry.uuid, materialUuid: row.material.uuid,
      geometryDisposals: row.geometryDisposals, materialDisposals: row.materialDisposals })) }));
}
function snapshot() {
  const current = host?.accepted;
  return structuredClone({ ...evidence, glChecks: evidence.glErrors.length, caller: { retained: callerRetained(), disposals: callerDisposals },
    counts: { results: host?.records.length ?? 0, pairs: host?.allResources.length ?? 0, targetParseCalls: host?.targetParseCalls ?? 0, peakLivePairs: host?.peakLivePairs ?? 0 },
    peakLivePairs: host?.peakLivePairs ?? 0, resources: host ? resources() : [], events: host?.events ?? [],
    accepted: current ? { key: current.assetKey, state: current.state, source: current.source, model: current.model,
      unrenderedCurveIds: current.result.unrenderedCurveIds, readout: current.readout, classification: current.proof.classification,
      trimGraph: current.readout.graph, quality: current.readout.quality, parentSources: assets.get(current.assetKey).parentSources } : null,
    sourceGraph: evidence.ready ? sourceGraph() : { source: [], dist: [] } });
}
Object.defineProperty(window, 'loader1106', { value: Object.freeze({ snapshot }), writable: false, configurable: false });
function appendCell(row, value) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }
function queryTable(readout) {
  const table = document.querySelector('#query-rows'); table.replaceChildren();
  for (const query of readout.queries) {
    const row = document.createElement('tr');
    appendCell(row, `${query.queryId}\nu=${query.u}, v=${query.v}`);
    appendCell(row, `${query.chart}${query.chartBoundaries.length ? ' [' + query.chartBoundaries.join(', ') + ']' : ''}\n${query.cutRelation}${query.cutRelation === 'uncertain' ? ' (successful uncertainty)' : ''}`);
    appendCell(row, query.faces.map(face => `${face.sourceId} / ${face.surfaceId} / ${face.faceId}: ${face.classification}`).join('\n'));
    appendCell(row, `${query.method}\n${query.subdivisions} subdivisions`); table.append(row);
  }
}
function updateReadout(record, observed) {
  const readout = record.readout, curves = record.model.objects.filter(object => object.kind === 'curve'), asset = assets.get(record.assetKey);
  document.querySelector('#readout').textContent = `Group: ${record.assetKey} / ${record.state}\n` +
    `Displayed role: ${readout.displayRole}\nComplete original Model ${record.model.name}: version ${record.model.version}, ${record.model.objects.length} original objects\n` +
    `Original object order: ${record.model.objects.map(object => `${object.id} (${object.kind})`).join(' → ')}\n` +
    `Native Curves retained without display: ${curves.map(curve => `${curve.id} degree ${curve.degree}`).join(', ')}\n` +
    `Support binding: source ${readout.sourceId} / Surface ${readout.surfaceId}\nDimensionless original U/V; display positions use 0.001 scene units/mm\n` +
    `Native graph: ${readout.graph.vertices} vertices / ${readout.graph.edges} edges / ${readout.graph.loops} loops / ${readout.graph.faces} Faces\n` +
    `Preserved original parent sources: ${asset.parentSources.length}; preserved dimensionless sidecars: ${asset.sidecars.size}\n` +
    `Actual untrimmed support contribution: ${observed.surfacePixels} pixels; combined frame hash ${observed.frameHash}`;
  queryTable(readout);
  document.querySelector('#controls').textContent = readout.controls.length ? 'Additional successful native controls:\n' + readout.controls.map(control =>
    `${control.name}: ` + control.result.classifications.map(query => `${query.queryId}, ${query.chart}/${query.cutRelation}, Faces [${query.faces.map(face => face.classification).join(', ')}]`).join('; ')).join('\n') : 'No additional control is defined for this group.';
  document.querySelector('#quality').textContent = `Actual classification quality:\n${JSON.stringify(readout.quality, null, 2)}\n` +
    `Actual bounded numeric policy:\n${JSON.stringify(readout.report.numericPolicy, null, 2)}\n` +
    'The Mesh remains the original untrimmed support. UV classification does not create a trimmed mesh, world cut fill, Solid or ideal Plane-side certificate.';
  const detail = document.querySelector('#full-proof');
  if (detail.parentElement.open) detail.textContent = JSON.stringify(record.proof.classification, null, 2); else detail.textContent = '';
}
function observeRecord(record) {
  requireFact(host.accepted === record && record.result.group.parent === scene && record.resources.length === 1 && record.resources.every(row => row.geometryDisposals === 0 && row.materialDisposals === 0), 'Candidate must be mounted and live before render');
  requireFact(host.records.filter(other => other !== record).every(other => other.result.group.parent === null && other.resources.every(row =>
    row.geometryDisposals === 1 && row.materialDisposals === 1)), 'Old resource must be released before replacement render');
  const asset = assets.get(record.assetKey), result = record.result, neutral = parseBaroCadSource(record.source, options), object = result.group.children[0], preview = neutral.surfaces[0];
  requireFact(record.source === asset.source && record.source === asset.request.trim.world.source && same(record.model, neutral.model) && same(result.model, record.model) &&
    record.model.version === 0 && record.model.objects.length === 8 && result.group.children.length === 1 && result.surfaces.length === 1 && result.curves.length === 0 &&
    result.unrenderedCurveIds.length === 7 &&
    object instanceof Mesh && object.name === preview.surfaceId && object.userData.surfaceId === preview.surfaceId &&
    object.material instanceof MeshNormalMaterial && object.material.side === DoubleSide && preview.report.vertexCount === 64 && preview.report.triangleCount === 98 &&
    sameBuffer(object.geometry.getAttribute('position').array, preview.mesh.positions) && sameBuffer(object.geometry.getAttribute('normal').array, preview.mesh.normals) &&
    sameBuffer(object.geometry.getAttribute('_CAD_UV').array, preview.mesh.parameters) && sameBuffer(object.geometry.index.array, preview.mesh.indices) &&
    preview.packet.positions.every((value, i) => Object.is(Math.fround(value * 0.001), preview.mesh.positions[i])), 'Complete original support/native siblings/target buffers/material/scale differ');
  const actualCut = record.proof.trim.edges.find(edge => edge.role === 'sharedCut').curve;
  const retainedCut = record.model.objects.find(value => value.id === actualCut.id);
  requireFact(actualCut.degree === (record.assetKey === 'dyadic_exact' ? 2 : 4) && same(retainedCut, actualCut), 'Original qualified shared-cut degree/coefficients changed');
  frame(); requireFact(object.matrixWorld.elements.every((value, i) => value === identityMatrix[i]), 'Original support world identity changed');
  const visible = object.visible; let background, isolated;
  try { object.visible = false; background = frame(); object.visible = true; isolated = frame(); } finally { object.visible = visible; }
  const surfacePixels = pixelDifference(isolated, background); requireFact(surfacePixels > 0, 'Actual original untrimmed support Surface has no pixels');
  const combined = frame(); requireFact(callerRetained(), 'Caller resources or fixed camera changed');
  const observed = { key: record.assetKey, state: record.state, recordIndex: host.records.length - 1,
    surfaceId: object.name, surfacePixels, surfaceFrameHash: hash(isolated), frameHash: hash(combined),
    readout: structuredClone(record.readout), trimGraph: { ...record.readout.graph }, originalMeshRole: record.readout.displayRole,
    nativeUVExact: true, targetBuffersExact: true, originalNativeModelExact: true };
  const actualBuffers = { positions: Float32Array.from(object.geometry.getAttribute('position').array), normals: Float32Array.from(object.geometry.getAttribute('normal').array),
    parameters: Float32Array.from(object.geometry.getAttribute('_CAD_UV').array), indices: Uint16Array.from(object.geometry.index.array) };
  if (record.assetKey === 'edited_source_rebuild' && record.state === 'original') editedPixels = { source: record.source, model: structuredClone(record.model), isolated, combined, buffers: actualBuffers };
  if (record.state === 'cold-reopen') {
    requireFact(editedPixels && record.source === editedPixels.source && same(record.model, editedPixels.model) &&
      Object.keys(actualBuffers).every(key => sameBuffer(actualBuffers[key], editedPixels.buffers[key])) &&
      sameBuffer(isolated, editedPixels.isolated) && sameBuffer(combined, editedPixels.combined), 'Edited whole source cold reopen changed buffers or actual full RGBA');
    evidence.coldReopen = { sourceExact: true, modelExact: true, buffersExact: true, isolatedRGBAExact: true, fullRGBAExact: true };
  }
  for (const control of record.proof.controls) {
    if (control.name === 'outside-chart') requireFact(control.result.classifications.every(query => query.chart === 'outside' && query.cutRelation === 'not-applicable'), 'Finite chart-exterior control was not a native success');
    if (control.name === 'zero-subdivision') requireFact(control.result.options.maxSubdivisions === 0 && control.result.classifications.some(query =>
      query.cutRelation === 'uncertain' && query.faces.every(face => face.classification === 'uncertain')), 'Zero-cap control was not successful uncertainty');
    evidence.controls.push({ key: record.assetKey, state: record.state, name: control.name, result: control.result });
  }
  if (record.assetKey === 'primary_cap_sixteen') requireFact(record.readout.queries.some(query => query.u === 0.5 && query.v === 0.30000000000000004 &&
    query.cutRelation === 'uncertain' && query.faces.every(face => face.classification === 'uncertain')), 'Actual primary iteration-limit uncertainty differs');
  evidence.history.push(observed); updateReadout(record, observed); syncControls();
}
host = createTrimUVHost({ scene, onChange(record) { if (record) observeRecord(record); else frame(); } });
const status = message => { evidence.status = message; document.querySelector('#status').textContent = message; };
function syncControls() {
  const count = evidence.history.length;
  document.querySelector('#run-refusals').disabled = busy || !!evidence.cleanup || count !== 1 || refusalsDone;
  document.querySelector('#load-primary').disabled = busy || !!evidence.cleanup || count !== 1 || !refusalsDone;
  document.querySelector('#load-edited').disabled = busy || !!evidence.cleanup || count !== 2;
  document.querySelector('#cold-reopen').disabled = busy || !!evidence.cleanup || count !== 3;
  document.querySelector('#dispose').disabled = busy || !!evidence.cleanup || count !== 4;
}
async function load() {
  requireFact(gl instanceof WebGL2RenderingContext, 'WebGL2 required');
  await Promise.all(PINS.map(async pin => {
    const url = new URL(`./native-trim-uv-classification-three-data/${pin.file}`, location.href), response = await fetch(url);
    requireFact(response.ok, `HTTP ${response.status}: ${pin.file}`); const bytes = await response.arrayBuffer();
    const contentType = response.headers.get('content-type'), contentLength = response.headers.get('content-length');
    if (pin.file.endsWith('.source0.css')) requireFact(/^text\/plain\b/i.test(contentType ?? '') && Number(contentLength) === pin.bytes, 'Expected unchanged CAD CSS disk bytes and headers');
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
    requireFact(bytes.byteLength === pin.bytes && sha256 === pin.sha256, `Original producer bytes changed: ${pin.file}`);
    texts.set(pin.file, new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    evidence.HTTPpins.push({ file: pin.file, url: url.href, status: response.status, contentType, contentLength, bytes: bytes.byteLength, sha256 });
  }));
  requireFact(evidence.HTTPpins.length === 36, 'Expected 36 actual original HTTP pins');
  for (const key of CASE_KEYS) assets.set(key, await loadCase(key, file => { requireFact(texts.has(file), `Missing fetched original ${file}`); return texts.get(file); }));
  host.load(assets.get(CASE_KEYS[0])); evidence.ready = true; document.documentElement.dataset.loader1106Ready = 'true'; sourceGraph();
  status('Original dyadic support loaded. Table and successful chart-exterior control use native UV data. Run twelve actual refusals.');
}
function refusals() {
  const before = host.accepted, model = structuredClone(before.model), proof = structuredClone(before.proof), readout = structuredClone(before.readout),
    source = before.source, children = [...scene.children], pixels = frame(), count = host.records.length;
  const result = host.runRefusals(assets.get(CASE_KEYS[0]));
  requireFact(result.refusals.length === 12 && result.getterCalls === 0 && result.acceptedRetained && host.accepted === before && before.source === source &&
    same(before.model, model) && same(before.proof, proof) && same(before.readout, readout) && host.records.length === count &&
    children.length === scene.children.length && children.every((child, i) => child === scene.children[i]) &&
    before.resources.every(row => row.geometryDisposals === 0 && row.materialDisposals === 0) && sameBuffer(frame(), pixels) && callerRetained(), 'Actual refusal batch changed accepted whole native/readout/Scene/resources/full RGBA');
  evidence.refusals = result.refusals; evidence.getterCalls = result.getterCalls; evidence.refusalRGBAExact = true; refusalsDone = true;
  document.querySelector('#refusal-readout').textContent = JSON.stringify(result, null, 2); status('Twelve actual failures retained the complete native support, readout and exact full RGBA. Getter calls stayed zero. Load primary cap16.');
}
function loadPrimary() { host.load(assets.get(CASE_KEYS[1])); status('Primary cap16 loaded. Its iteration-limited query is a successful uncertain result for both Faces; cap0 control also succeeds with uncertainty.'); }
function loadEdited() { host.load(assets.get(CASE_KEYS[2])); status('Edited-source rebuild loaded through whole original source and native classification. The Mesh remains the untrimmed support.'); }
function reopen() { host.coldReopen(); status('Edited complete source cold-reopened into a fresh public result. Native Model, target buffers and actual full RGBA remain exact.'); }
function dispose() {
  const cpu = host.records.map(record => ({ record, source: record.source, model: structuredClone(record.model), proof: structuredClone(record.proof), readout: structuredClone(record.readout) }));
  host.dispose(); host.dispose();
  requireFact(host.accepted === null && host.records.length === 4 && host.allResources.length === 4 && host.peakLivePairs === 2 &&
    new Set(host.allResources.map(row => row.geometry.uuid)).size === 4 && new Set(host.allResources.map(row => row.material.uuid)).size === 4 &&
    host.allResources.every(row => row.geometryDisposals === 1 && row.materialDisposals === 1) && host.records.every(record => record.result.group.parent === null) &&
    cpu.every(row => row.record.source === row.source && same(row.record.model, row.model) && same(row.record.proof, row.proof) && same(row.record.readout, row.readout)) &&
    scene.children.length === 1 && callerRetained(), 'Final four-result lifetime/native/caller cleanup differs');
  const pixels = frame(); let greenPixels = 0;
  for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 40 && pixels[i + 1] > 200 && pixels[i + 2] < 40) greenPixels++;
  requireFact(greenPixels > 0, 'Caller standing marker lost actual pixels after cleanup');
  evidence.cleanup = { doubleCall: true, pairs: 4, geometryDisposals: 4, materialDisposals: 4, distinctGeometries: 4, distinctMaterials: 4, peakLivePairs: host.peakLivePairs, greenPixels };
  evidence.allNativeCPUReadable = true; status('Four actual geometry/material pairs released once. Caller Scene, renderer, camera, canvas, green marker and complete native CPU data remain.');
}
async function run(action) {
  if (busy || evidence.cleanup) return; busy = true; syncControls();
  try { await action(); } catch (error) { evidence.error = { name: error.name, message: error.message, stack: error.stack }; status(`Failed: ${error.message}`); console.error(error); }
  finally { busy = false; syncControls(); }
}
document.querySelector('#run-refusals').addEventListener('click', () => run(refusals));
document.querySelector('#load-primary').addEventListener('click', () => run(loadPrimary));
document.querySelector('#load-edited').addEventListener('click', () => run(loadEdited));
document.querySelector('#cold-reopen').addEventListener('click', () => run(reopen));
document.querySelector('#dispose').addEventListener('click', () => run(dispose));
document.querySelector('#full-proof').parentElement.addEventListener('toggle', () => {
  const detail = document.querySelector('#full-proof');
  detail.textContent = detail.parentElement.open && host.accepted ? JSON.stringify(host.accepted.proof.classification, null, 2) : '';
});
syncControls();
try { await load(); } catch (error) { evidence.error = { name: error.name, message: error.message, stack: error.stack }; status(`Failed: ${error.message}`); console.error(error); }
finally { busy = false; syncControls(); }
