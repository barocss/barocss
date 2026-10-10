import { Scene, WebGLRenderer, OrthographicCamera, Mesh, SphereGeometry, MeshBasicMaterial, REVISION } from 'three';
import { CASE_KEYS, PINS, loadCase, requireFact, assertNative, assertBuffer } from './multispan-section-three-fixture.mjs';
import { createMultiSpanSectionThreeHost } from './multispan-section-three-checkpoint.mjs';

const width = 900, height = 640, mode = document.documentElement.dataset.loader1213Mode ?? 'source';
performance.setResourceTimingBufferSize(2048);
const renderer = new WebGLRenderer({ antialias: false, preserveDrawingBuffer: true }); renderer.setPixelRatio(1); renderer.setSize(width, height); renderer.setClearColor(0x101b2c, 1);
const canvas = renderer.domElement; document.querySelector('#view').append(canvas);
const scene = new Scene(), halfY = .042, aspect = width / height;
const camera = new OrthographicCamera(-halfY * aspect, halfY * aspect, halfY, -halfY, .0001, 1);
camera.position.set(.08, -.07, .09); camera.up.set(0, 1, 0); camera.lookAt(.02, .03, .004); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
const markerGeometry = new SphereGeometry(.0007, 8, 6), markerMaterial = new MeshBasicMaterial({ color: 0x00ff00 }), marker = new Mesh(markerGeometry, markerMaterial);
marker.position.set(0, .055, .018); scene.add(marker);
const callerDisposals = { geometry: 0, material: 0, renderer: 0, canvasRemoval: 0 };
markerGeometry.addEventListener('dispose', () => callerDisposals.geometry++); markerMaterial.addEventListener('dispose', () => callerDisposals.material++);
const rendererDispose = renderer.dispose; renderer.dispose = function (...args) { callerDisposals.renderer++; return rendererDispose.apply(this, args); };
const canvasRemove = canvas.remove; canvas.remove = function (...args) { callerDisposals.canvasRemoval++; return canvasRemove.apply(this, args); };
const gl = renderer.getContext(), rawTexts = new Map(), assets = new Map();
const evidence = { mode, ready: false, phase: 'boot', error: null, HTTPpins: [], history: [], refusals: null, transport: null, requestDeltas: [], callbacks: 0, glErrors: [], runtimeErrors: [], cold: null, cleanup: null };
let host, busy = true, coldBefore;
const nativeJSON = value => JSON.stringify(value, (_key, item) => typeof item === 'number' && Object.is(item, -0) ? JSON.rawJSON('-0') : item, 2);
const same = (a, b) => a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
function negativeZeroPaths(value, path = '') {
  if (typeof value === 'number') return Object.is(value, -0) ? [path] : [];
  if (value === null || typeof value !== 'object') return [];
  return Object.keys(value).flatMap(key => negativeZeroPaths(value[key], Array.isArray(value) || ArrayBuffer.isView(value) ? `${path}[${key}]` : path ? `${path}.${key}` : key));
}
function cameraState() { return { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), projection: camera.projectionMatrix.toArray(), world: camera.matrixWorld.toArray(), view: camera.matrixWorldInverse.toArray(),
  bounds: [camera.left, camera.right, camera.top, camera.bottom, camera.near, camera.far] }; }
const fixedCamera = cameraState();
function caller() { return { retained: marker.parent === scene && marker.geometry === markerGeometry && marker.material === markerMaterial && canvas.isConnected && !gl.isContextLost() && Object.values(callerDisposals).every(value => value === 0), disposals: { ...callerDisposals }, sceneChildren: scene.children.length }; }
function frame() { renderer.render(scene, camera); const bytes = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, bytes); const error = gl.getError(); evidence.glErrors.push(error); requireFact(error === gl.NO_ERROR && caller().retained, 'Actual WebGL or caller preservation failure'); assertNative(cameraState(), fixedCamera, 'Fixed caller camera'); return bytes; }
function hash(bytes) { let value = 2166136261; for (const byte of bytes) value = Math.imul(value ^ byte, 16777619) >>> 0; return value; }
function changed(a, b) { let count = 0; for (let index = 0; index < a.length; index += 4) if (a[index] !== b[index] || a[index + 1] !== b[index + 1] || a[index + 2] !== b[index + 2]) count++; return count; }
function green(bytes) { let count = 0; for (let index = 0; index < bytes.length; index += 4) if (bytes[index] < 40 && bytes[index + 1] > 200 && bytes[index + 2] < 40) count++; return count; }
function sourceGraph() {
  const urls = [...new Set(performance.getEntriesByType('resource').map(row => row.name))], source = urls.filter(url => /packages\/barocss-(cad|cad-interop)\/src\//.test(url)), dist = urls.filter(url => /packages\/barocss-(cad|cad-interop)\/dist\//.test(url)), published = urls.filter(url => url.includes('/loader1213-published.mjs'));
  const sectionModules = urls.filter(url => /multispan-vlinear-plane-section\.(ts|js)(\?|$)/.test(url));
  if (mode === 'source') requireFact(source.length > 0 && dist.length === 0 && sectionModules.length > 0, 'Observed original public source and actual provider module required'); else requireFact(source.length === 0 && published.length > 0, 'Published bundle with no source fallback required');
  return { mode, source, dist, published, sectionModules };
}
function resourceValues(record) {
  return record.resources.map(row => ({ role: row.role, name: row.object.name, positions: row.attributes.find(value => value.name === 'position').values,
    attributes: row.attributes.map(value => ({ name: value.name, itemSize: value.itemSize, values: Array.from(row.geometry.getAttribute(value.name).array) })), indices: row.geometry.index ? Array.from(row.geometry.index.array) : null }));
}
function updateReadout(record) {
  const native = record.worldNative, report = record.proof.report;
  document.querySelector('#context').textContent = `Original family: ${record.assetKey} / ${record.state}\nWorld Model: ${native.model.name}; Curve: ${native.curveId}; degree ${native.model.objects[0].degree}; poles ${native.model.objects[0].controlPoints.length}\nOriginal native domain: ${nativeJSON(native.domain)}; uniform display samples ${native.parameters.length}; intervals ${native.intervals.length}\nParent full object IDs: ${nativeJSON(record.parentNatives.map(value => value.model.objects.map(object => object.kind + ':' + object.id)))}\nUnrendered original Curve IDs: ${nativeJSON(record.parentNatives.map(value => value.unrenderedCurveIds))}\nNative span count: ${report.spanCount}; derivative unions: ${nativeJSON(record.proof.derivativeCounts)}\nOriginal XYZ, identity pose, .001 scene units/mm once. DualUV stays dimensionless native CPU data. Original signed-zero paths: ${negativeZeroPaths(record.asset.owned).length}`;
  document.querySelector('#sources').textContent = nativeJSON({ world: record.asset.worldSource, surface: record.asset.parentSources[0], plane: record.asset.parentSources[1] });
  document.querySelector('#full-readout').textContent = nativeJSON(record.readout);
  document.querySelector('#quality').textContent = nativeJSON({ uniformDisplay: native.quality, nativeSectionQuality: report.quality ?? null, derivativeCounts: record.proof.derivativeCounts,
    parentDisplay: '17×9 approximate D0 triangle meshes; native _CAD_UV parameter attributes, not texture UV', displayNormalsAreApproximate: true, noAdaptiveOrTopologyCertificate: true });
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
  requireFact(record.groups.length === 3 && record.groups.every(group => group.parent === scene), 'All three original adapter Groups must be attached');
  assertNative(record.proof.section, record.asset.owned, 'Whole original section retained'); assertNative(record.worldNative.model, record.proof.section.world.model);
  const pixels = frame(); record.worldResult.group.visible = false; let withoutWorld;
  try { withoutWorld = frame(); } finally { record.worldResult.group.visible = true; }
  requireFact(same(frame(), pixels), 'World on/off observation must restore complete frame');
  const worldPixels = changed(pixels, withoutWorld), greenPixels = green(pixels); requireFact(worldPixels > 0 && greenPixels > 0, 'Actual World trace or caller marker absent');
  if (record.state === 'cold-reopen') {
    requireFact(coldBefore && same(pixels, coldBefore.pixels), 'Cold complete RGBA differs'); assertNative(record.readout, coldBefore.readout, 'Cold whole original readout'); assertNative(resourceValues(record), coldBefore.values, 'Cold all actual target attributes');
    evidence.cold = { originalReadoutExact: true, targetAttributesExact: true, fullRGBAExact: true, sourceFiles: 7, adapterSourceRequests: 3 };
  } else if (evidence.history.length > 0) requireFact(changed(pixels, evidence.firstPixels) > 0, 'Two original section frames must differ');
  if (evidence.history.length === 0) evidence.firstPixels = pixels;
  evidence.history.push({ key: record.assetKey, state: record.state, frameHash: hash(pixels), worldPixels, greenPixels, pairs: record.resources.length, groups: record.groups.length,
    nativeDomain: [...record.worldNative.domain], derivativeCounts: record.proof.derivativeCounts, originalNegativeZeroPaths: negativeZeroPaths(record.asset.owned) }); updateReadout(record);
}
function retained() { const record = host.accepted; return { record, readout: structuredClone(record.readout), pixels: frame(), values: resourceValues(record), children: [...scene.children], callbacks: evidence.callbacks,
  groups: [...record.groups], resources: record.resources.map(row => ({ row, geometry: row.object.geometry, material: row.object.material, attributes: row.attributes.map(value => ({ name: value.name, attribute: row.geometry.getAttribute(value.name), array: row.geometry.getAttribute(value.name).array })), index: row.geometry.index, indexArray: row.geometry.index?.array ?? null })) }; }
function checkRetained(before) {
  const record = host.accepted; requireFact(record === before.record && before.callbacks === evidence.callbacks && same(frame(), before.pixels) && before.children.length === scene.children.length && before.children.every((object, index) => object === scene.children[index]), 'Refusal changed original/Scene/callback/full RGBA');
  assertNative(record.readout, before.readout); assertNative(resourceValues(record), before.values);
  for (const item of before.resources) { requireFact(item.row.object.geometry === item.geometry && item.row.object.material === item.material && item.geometry.index === item.index && (item.geometry.index?.array ?? null) === item.indexArray, 'Refusal changed actual target resources');
    for (const value of item.attributes) requireFact(item.geometry.getAttribute(value.name) === value.attribute && value.attribute.array === value.array, 'Refusal changed actual attributes'); }
}
function dataURL(file) { return new URL(file, location.href).href; }
async function fetchPin(pin) { const response = await fetch(dataURL(pin.file)); requireFact(response.ok, 'Original HTTP file refused'); const bytes = new Uint8Array(await response.arrayBuffer()), sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join(''); requireFact(bytes.length === pin.bytes && sha256 === pin.sha256, 'Original bytes or SHA differ'); const contentType = response.headers.get('content-type'), contentLength = response.headers.get('content-length'); requireFact(contentLength === String(pin.bytes) && (!pin.file.endsWith('.css') || contentType === 'text/plain; charset=utf-8'), 'Original HTTP metadata differs'); evidence.HTTPpins.push({ file: pin.file, bytes: bytes.length, sha256, status: response.status, contentType, contentLength }); return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
async function ledger() { const response = await fetch('/loader1213-request-log.json', { cache: 'no-store' }); requireFact(response.ok, 'Actual request ledger unavailable'); return response.json(); }
function setButtons(enabled) { for (const id of ['refusals', 'transport', 'nonuniform', 'cold', 'cleanup']) document.querySelector('#' + id).disabled = !enabled.includes(id); }
function failure(error) { evidence.error = { name: error.name, code: error.code ?? null, message: error.message, stack: error.stack }; evidence.runtimeErrors.push(evidence.error); evidence.ready = false; document.documentElement.dataset.loader1213Ready = 'false'; document.querySelector('#status').textContent = error.message; setButtons([]); console.error(error); }
async function action(operation) { if (busy || !evidence.ready || evidence.error || evidence.cleanup) return; busy = true; setButtons([]); try { await operation(); } catch (error) { failure(error); } finally { busy = false; } }
function mark(phase, message, buttons) { evidence.phase = phase; document.querySelector('#status').textContent = message; setButtons(buttons); }
Object.defineProperty(window, 'loader1213', { configurable: false, writable: false, value: Object.freeze({ snapshot: () => {
  const { firstPixels, ...safeEvidence } = evidence;
  return structuredClone({ ...safeEvidence, busy, counts: host?.counts, caller: caller(), camera: cameraState(), sourceGraph: evidence.ready ? sourceGraph() : null,
    environment: { three: REVISION, userAgent: navigator.userAgent, devicePixelRatio, canvasSize: [canvas.width, canvas.height] },
    accepted: host?.accepted ? { assetKey: host.accepted.assetKey, state: host.accepted.state, asset: host.accepted.asset, proof: host.accepted.proof, readout: host.accepted.readout } : null,
    retainedLast: evidence.cleanup ? { asset: host.records.at(-1).asset, proof: host.records.at(-1).proof, readout: host.records.at(-1).readout } : null,
    groups: host?.allGroups.map(group => ({ uuid: group.uuid, name: group.name, parentAttached: group.parent !== null, children: group.children.length })),
    resources: host?.allResources.map(row => ({ role: row.role, name: row.object.name, geometryUuid: row.geometry.uuid, materialUuid: row.material.uuid, geometryDisposals: row.geometryDisposals, materialDisposals: row.materialDisposals,
      attributes: row.attributes.map(value => ({ name: value.name, itemSize: value.itemSize, values: Array.from(row.geometry.getAttribute(value.name).array) })), indices: row.geometry.index ? Array.from(row.geometry.index.array) : null })) });
} }) });
document.querySelector('#refusals').addEventListener('click', () => action(async () => { const before = retained(); evidence.refusals = host.runRefusals(assets.get(CASE_KEYS[0]), () => checkRetained(before)); requireFact(evidence.refusals.refusals.length === 16 && evidence.refusals.getterCalls === 0, 'Sixteen actual refusals/getter0 required'); mark('refusals', 'Sixteen real refusals retain the whole native section, targets and frame.', ['transport']); }));
document.querySelector('#transport').addEventListener('click', () => action(async () => { const before = retained(); let prior = (await ledger()).length; evidence.transport = await host.runTransportRefusals(dataURL(assets.get(CASE_KEYS[0]).pins.find(pin => pin.file.endsWith('.actual-world.source0.css')).file), async receipt => { checkRetained(before); const count = (await ledger()).length, delta = count - prior, expected = [0, 1, 1, 1, 0][evidence.requestDeltas.length]; requireFact(delta === expected, 'Actual per-case source request delta differs'); evidence.requestDeltas.push({ name: receipt.name, requests: delta }); prior = count; }); requireFact(evidence.transport.refusals.length === 5 && evidence.transport.getterCalls === 0, 'Five real transport refusals required'); mark('transport', 'Shared transport retains original section and full frame.', ['nonuniform']); }));
document.querySelector('#nonuniform').addEventListener('click', () => action(async () => { host.load(assets.get(CASE_KEYS[1])); requireFact(evidence.history.length === 2, 'Second original admission required'); mark('nonuniform', 'Nonuniform original section retains complete parent Models and dualUV.', ['cold']); }));
document.querySelector('#cold').addEventListener('click', () => action(async () => {
  const previousAsset = assets.get(CASE_KEYS[1]), texts = new Map(rawTexts); requireFact(previousAsset.pins.length === 7, 'Seven complete original files required');
  await Promise.all(previousAsset.pins.map(async pin => texts.set(pin.file, await fetchPin(pin)))); const asset = await loadCase(CASE_KEYS[1], file => texts.get(file)); coldBefore = retained();
  const sourcePin = suffix => asset.pins.find(pin => pin.file.endsWith(suffix)).file;
  await host.coldReopen(asset, { world: dataURL(sourcePin('.actual-world.source0.css')), surface: dataURL(sourcePin('shifted_source.original.source0.css')), plane: dataURL(sourcePin('shift_plane_source.original.source0.css')) });
  requireFact(evidence.cold && evidence.history.length === 3 && evidence.HTTPpins.length === 21, 'Cold original full-file checkpoint missing'); mark('cold', 'Cold World and both complete parents match native readout, all target attributes and full frame.', ['cleanup']);
}));
document.querySelector('#cleanup').addEventListener('click', () => action(async () => {
  const cpu = host.records.map(record => structuredClone(record.readout)); host.dispose(); host.dispose(); const pixels = frame();
  requireFact(host.accepted === null && host.allResources.length === 10 && host.allGroups.length === 9 && host.counts.peakLivePairs === 7 && host.counts.livePairs === 0 && evidence.callbacks === 4 && green(pixels) > 0 && caller().retained, 'Actual owned/caller cleanup differs');
  requireFact(host.allResources.every(row => row.geometryDisposals === 1 && row.materialDisposals === 1) && host.allGroups.every(group => group.parent === null && group.children.length === 0), 'Captured resources must release once; Groups must detach and clear');
  for (const field of ['geometry', 'material']) requireFact(new Set(host.allResources.map(row => row[field])).size === 10, 'Ten distinct captured resources required');
  host.records.forEach((record, index) => assertNative(record.readout, cpu[index], 'Whole native data after cleanup')); evidence.serverRequests = await ledger(); requireFact(evidence.serverRequests.length === 27, 'Actual original-file request count differs');
  evidence.cleanup = { pairs: 10, adapterGroups: 9, callbacks: 4, doubleCall: true, greenPixels: green(pixels), fullNativeCPUReadable: true, callerRetained: true }; mark('cleanup', 'Ten geometry/material pairs released once; original CPU data and caller remain.', []);
  document.querySelector('#evidence').textContent = nativeJSON({ counts: host.counts, cleanup: evidence.cleanup, caller: caller() });
}));
window.addEventListener('error', event => evidence.runtimeErrors.push({ type: 'window-error', message: event.message })); window.addEventListener('unhandledrejection', event => evidence.runtimeErrors.push({ type: 'promise-error', message: String(event.reason) }));
try { requireFact(gl instanceof WebGL2RenderingContext && typeof JSON.rawJSON === 'function', 'Actual WebGL2 and signed-zero JSON display required'); await Promise.all(PINS.map(async pin => rawTexts.set(pin.file, await fetchPin(pin)))); for (const key of CASE_KEYS) assets.set(key, await loadCase(key, file => rawTexts.get(file))); host = createMultiSpanSectionThreeHost({ scene, onChange(record) { evidence.callbacks++; observe(record); } }); host.load(assets.get(CASE_KEYS[0])); evidence.ready = true; document.documentElement.dataset.loader1213Ready = 'true'; sourceGraph(); mark('initial', 'Original warped four-span section and complete parent previews loaded.', ['refusals']); } catch (error) { failure(error); } finally { busy = false; }
