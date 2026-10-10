import { Application, Graphics, DRAW_MODES, VERSION } from 'pixi.js';
import { Camera, LightingEnvironment, Container3D, Mesh3D, MeshGeometry3D, StandardMaterial } from 'pixi3d/pixi7';
import { PINS, CASE_KEYS, createNativeOptions, loadCase, assertNative, assertBuffer, requireFact } from './xy-angle-arc-pixi3d-fixture.mjs';
import { createXYAngleArcPixi3DHost } from './xy-angle-arc-pixi3d-checkpoint.mjs';

const width = 900, height = 640, mode = document.documentElement.dataset.loader1200Mode ?? 'source';
performance.setResourceTimingBufferSize(2048);
const app = new Application({ width, height, resolution: 1, antialias: false, preserveDrawingBuffer: true, autoStart: false, background: 0x101b2c }); app.stop();
const stage = app.stage, renderer = app.renderer, canvas = app.view; document.querySelector('#view').append(canvas);
const lighting = renderer.plugins.lighting, priorLightingMain = LightingEnvironment.main, priorMain = Camera.main;
const camera = new Camera(renderer); Camera.main = priorMain;
camera.position.set(.0035, -.0015, .025); camera.rotationQuaternion.setEulerAngles(0, 180, 0);
camera.orthographic = true; camera.orthographicSize = .006 * height / width; camera.aspect = width / height; camera.near = .001; camera.far = .1;
const marker = new Graphics().beginFill(0x00ff00).drawRect(16, 16, 14, 14).endFill(); stage.addChild(marker); renderer.render(stage);
const markerGeometry = marker.geometry;
const callerDisposals = { application: 0, stage: 0, renderer: 0, camera: 0, marker: 0, markerGeometry: 0, lighting: 0, canvasRemoval: 0 };
for (const [name, object] of Object.entries({ application: app, stage, renderer, camera, marker, markerGeometry, lighting })) {
  const originalDestroy = object.destroy; object.destroy = function (...args) { callerDisposals[name]++; return originalDestroy.apply(this, args); };
}
const canvasRemove = canvas.remove; canvas.remove = function (...args) { callerDisposals.canvasRemoval++; return canvasRemove.apply(this, args); };
const gl = renderer.gl, rawTexts = new Map(), assets = new Map(), originalFrames = new Map();
const evidence = { mode, ready: false, phase: 'boot', error: null, HTTPpins: [], history: [], refusals: null, transport: null, cold: null,
  requestDeltas: [], callbacks: 0, controls: [], glErrors: [], runtimeErrors: [], cleanup: null };
let host, busy = true, coldBefore;
const nativeJSON = value => JSON.stringify(value, (_key, item) => typeof item === 'number' && Object.is(item, -0) ? '-0 (negative zero)' : item, 2);
const same = (a, b) => a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
const normalize = result => Array.isArray(result) ? result : result.refusals;
function cameraState() { return { position: Array.from(camera.position.array), quaternion: Array.from(camera.rotationQuaternion.array), scale: Array.from(camera.scale.array),
  projection: Array.from(camera.projection.array), view: Array.from(camera.view.array), world: Array.from(camera.worldTransform.array), viewProjection: Array.from(camera.viewProjection.array),
  orthographic: camera.orthographic, orthographicSize: camera.orthographicSize, aspect: camera.aspect, near: camera.near, far: camera.far }; }
const fixedCamera = cameraState();
function caller() {
  const globalsRetained = Camera.main === priorMain && camera.renderer === renderer && renderer.plugins.lighting === lighting && lighting.renderer === renderer && LightingEnvironment.main === priorLightingMain;
  assertNative(cameraState(), fixedCamera, 'Fixed actual caller Pixi camera');
  return { retained: !stage.destroyed && renderer.gl === gl && !camera.destroyed && !marker.destroyed && marker.parent === stage && marker.geometry === markerGeometry && canvas.isConnected && !gl.isContextLost() &&
    globalsRetained && Object.values(callerDisposals).every(value => value === 0), globalsRetained, disposals: { ...callerDisposals }, stageChildren: stage.children.length };
}
function frame() {
  renderer.render(stage); const pixels = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const error = gl.getError(); evidence.glErrors.push(error); requireFact(error === gl.NO_ERROR && caller().retained, 'Actual WebGL or caller preservation failure'); return pixels;
}
function hash(bytes) { let value = 2166136261; for (const byte of bytes) value = Math.imul(value ^ byte, 16777619) >>> 0; return value; }
function changed(a, b) { let count = 0; for (let index = 0; index < a.length; index += 4) if (a[index] !== b[index] || a[index + 1] !== b[index + 1] || a[index + 2] !== b[index + 2]) count++; return count; }
function sourceGraph() {
  const urls = [...new Set(performance.getEntriesByType('resource').map(row => row.name))], source = urls.filter(url => /packages\/barocss-(cad|cad-interop)\/src\//.test(url)), dist = urls.filter(url => /packages\/barocss-(cad|cad-interop)\/dist\//.test(url)), published = urls.filter(url => url.includes('/loader1200-published.mjs'));
  if (mode === 'source') requireFact(source.length > 0 && dist.length === 0, 'Actual own source graph required'); else requireFact(source.length === 0 && published.length > 0, 'Actual emitted public bundle with no source fallback required');
  return { mode, source, dist, published, artifactModules: urls.filter(url => /\/src\/xy-angle-arc-artifact\.(ts|js)(\?|$)/.test(url)) };
}
function updateReadout(record) {
  const native = record.proof.native, report = record.proof.artifact.report, request = record.asset.request;
  document.querySelector('#context').textContent = `Original file: ${record.assetKey} / ${record.state}\nWhole Model: ${record.model.name}; Curve: ${native.curveId}; degree ${record.model.objects[0].degree}\nAuthored XY centre (mm): ${nativeJSON(request.centerMM)}; radius: ${request.radiusMM} mm\nAuthored start/signed sweep (rad): ${Object.is(request.startAngleRad, -0) ? '-0' : request.startAngleRad} / ${request.sweepAngleRad}; direction: ${report.direction}\nOriginal native domain: ${nativeJSON(native.domain)}; uniform samples ${native.parameters.length}; intervals ${native.intervals.length}\nSpan count: ${report.spanCount}; native parameter is an angle: false\nEndpoint closed: ${report.endpointClosed}; periodic: ${report.periodic}; native C0 D1 refusals: ${report.derivativeRefusalCount}\nOriginal XYZ/Z0, identity poses, .001 scene units/mm once. Full-turn endpoint copy is separate from a periodic spline. +Z normals are derived unlit shader inputs, not native CAD normals.`;
  const portable = record.proof.verificationReport, strict = record.proof.legacySavedControl;
  document.querySelector('#portable-summary').textContent = `Original artifact retained: ${portable.originalArtifactRetained}; exact original source binding: ${portable.originalSourceBindingExact}\nPortable numerical association: ${portable.numericalAssociationAccepted}; original D1 evaluated/refused: ${portable.originalD1EvaluatedCount}/${portable.originalD1RefusalCount}\nField rules: ${portable.fieldCount} total, ${portable.exactFieldCount} exact, ${portable.associatedFieldCount} associated\nProducer authentication: ${portable.provenanceAuthenticated}; same-runtime bit replay: ${portable.sameRuntimeBitReplay}; global exact circle: ${portable.globalExactCircleCertified}\nSaved original strict control in this runtime: ${strict.status}${strict.status === 'refused' ? ` (${strict.errorName}/${strict.code})` : ''}\nFresh same-runtime construction is a separate strict control. The display uses the unchanged original artifact.`;
  document.querySelector('#portable-report').textContent = nativeJSON({ originalArtifact: record.proof.artifact, verification: record.proof.verification,
    verificationReport: portable, legacySavedControl: strict, sameRuntimeRebuiltReport: record.proof.sameRuntimeRebuiltReport });
  document.querySelector('#source').textContent = record.source; document.querySelector('#full-readout').textContent = nativeJSON(record.readout);
  document.querySelector('#quality').textContent = nativeJSON({ display: native.quality, originalNative: report.quality, portable: { numericalAssociationAccepted: record.proof.verificationReport.numericalAssociationAccepted, limits: record.proof.verificationReport.limits, provenanceAuthenticated: false, sameRuntimeBitReplay: false }, originalNativeDerivativeGuards: report.observations, trigPolicy: report.trigPolicy, closurePolicy: report.closurePolicy, witnessSummary: record.proof.witnessSummary });
  const rows = document.querySelector('#observations'); rows.replaceChildren();
  for (const witness of record.asset.witness) { const row = document.createElement('tr'); for (const value of [witness.parameter, witness.rationalAngleRad, witness.linearAngleRad, witness.angleDifferenceRad, nativeJSON(witness.independentPointMM)]) { const cell = document.createElement('td'); cell.textContent = String(value); row.append(cell); } rows.append(row); }
  document.querySelector('#evidence').textContent = nativeJSON({ counts: host.counts, history: evidence.history, refusals: evidence.refusals, transport: evidence.transport, cold: evidence.cold, cleanup: evidence.cleanup, caller: caller() });
}
function observe(record) {
  if (!record) { frame(); return; }
  const native = record.proof.native, { root, mesh } = record.result, geometry = mesh.geometry, material = mesh.material;
  const positions = geometry.positions.buffer, normals = geometry.normals.buffer, indices = geometry.indices.buffer, report = record.proof.artifact.report;
  requireFact(root instanceof Container3D && mesh instanceof Mesh3D && geometry instanceof MeshGeometry3D && material instanceof StandardMaterial && root.parent === stage && root.children.length === 1 && root.children[0] === mesh && mesh.parent === root, 'One actual original Mesh3D root required');
  requireFact(positions instanceof Float32Array && positions.length === 387 && positions !== record.result.positions && positions !== native.positions && indices instanceof Uint16Array && indices.length === 129, 'Independent actual original Float32 LINE_STRIP buffers required');
  requireFact(geometry.positions.componentType === 5126 && geometry.positions.componentCount === 3 && geometry.positions.normalized === false &&
    geometry.normals.componentType === 5126 && geometry.normals.componentCount === 3 && geometry.normals.normalized === false &&
    geometry.indices.componentType === 5123 && geometry.indices.componentCount === 1 && geometry.indices.normalized === false, 'Actual attribute formats changed');
  assertNative(record.proof.artifact, record.asset.owned, 'Complete unchanged original artifact');
  requireFact(record.source === record.proof.artifact.source && record.proof.verification.artifact !== record.asset.owned, 'Original Source0/artifact copy authority changed');
  assertNative(record.proof.verification.artifact, record.asset.owned, 'Portable original artifact retention'); assertNative(record.proof.verification.report, record.proof.verificationReport, 'Separate whole portable report');
  assertBuffer(positions, native.positions); assertBuffer(indices, Uint16Array.from({ length: 129 }, (_, index) => index));
  requireFact(normals instanceof Float32Array && normals.length === 387, 'Derived shader normal array required');
  assertBuffer(normals, Float32Array.from({ length: 387 }, (_, index) => index % 3 === 2 ? 1 : 0));
  for (const axis of [0, 1, 2]) {
    const values = Array.from({ length: 129 }, (_, index) => positions[index * 3 + axis]);
    requireFact(Object.is(geometry.positions.min[axis], Math.min(...values)) && Object.is(geometry.positions.max[axis], Math.max(...values)), 'Actual position bounds changed');
  }
  requireFact(!geometry.uvs && !geometry.tangents && !geometry.colors && !geometry.targets && !geometry.joints && !geometry.weights, 'Only original Curve display attributes are admitted');
  requireFact(material.drawMode === DRAW_MODES.LINE_STRIP && material.unlit && material.doubleSided && material.camera === camera && material.lightingEnvironment === lighting, 'Actual material or explicit caller context changed');
  assertBuffer(material.baseColor.rgba, Float32Array.from([40 / 255, 201 / 255, 235 / 255, 1])); assertNative(record.model, native.model);
  for (const object of [root, mesh]) { assertBuffer(object.position.array, [0, 0, 0]); assertBuffer(object.scale.array, [1, 1, 1]); assertBuffer(object.rotationQuaternion.array, [0, 0, 0, 1]); }
  const pixels = frame(); root.visible = false; let background; try { background = frame(); } finally { root.visible = true; } requireFact(same(frame(), pixels), 'Full line frame restoration failed');
  const visiblePixels = changed(pixels, background); let greenMarkerPixels = 0;
  for (let index = 0; index < pixels.length; index += 4) if (pixels[index] < 40 && pixels[index + 1] > 200 && pixels[index + 2] < 40) greenMarkerPixels++;
  requireFact(visiblePixels > 0 && greenMarkerPixels > 0 && caller().retained, 'Original native trace or caller missing');
  if (record.state === 'original') {
    const compareKey = record.assetKey === 'same_request_deterministic_rebuild' || record.assetKey === 'center_radius_angle_changed_request_rebuild' ? 'noncardinal_positive_single_span' : record.assetKey === 'authored_minus_zero_cardinal_start' ? 'exact_authored_cardinal_quarter' : null;
    if (compareKey) { const previous = originalFrames.get(compareKey); requireFact(previous, 'Qualified comparison frame missing'); const equal = record.assetKey !== 'center_radius_angle_changed_request_rebuild'; requireFact(equal ? same(pixels, previous.pixels) && same(Array.from(native.positions), previous.positions) : changed(pixels, previous.pixels) > 0 && !same(Array.from(native.positions), previous.positions), 'Authored rebuild/signed intent display comparison failed'); }
    originalFrames.set(record.assetKey, { pixels, positions: Array.from(native.positions) });
  } else {
    requireFact(record.state === 'cold-reopen' && coldBefore && same(pixels, coldBefore.pixels), 'Cold full RGBA differs'); assertNative(record.readout, coldBefore.readout, 'Whole cold original artifact and separate portable authority'); assertBuffer(positions, coldBefore.positions); assertBuffer(indices, coldBefore.indices); assertBuffer(normals, coldBefore.normals); evidence.cold = { key: record.assetKey, wholeReadoutExact: true, positionsExact: true, indicesExact: true, shaderNormalsExact: true, fullRGBAExact: true };
  }
  requireFact(report.periodic === false, 'Copied seam does not grant periodic spline');
  if (report.endpointClosed) assertNative(native.pointsMM[0], native.pointsMM.at(-1), 'Full-turn native endpoint bits');
  evidence.controls.push({ key: record.assetKey, state: record.state, originalStrict: {
    status: record.proof.legacySavedControl.status, errorName: record.proof.legacySavedControl.errorName ?? null, code: record.proof.legacySavedControl.code ?? null,
  }, portable: { originalArtifactRetained: record.proof.verificationReport.originalArtifactRetained, originalSourceBindingExact: record.proof.verificationReport.originalSourceBindingExact,
    numericalAssociationAccepted: record.proof.verificationReport.numericalAssociationAccepted, sameRuntimeBitReplay: record.proof.verificationReport.sameRuntimeBitReplay,
    fieldCount: record.proof.verificationReport.fieldCount, associatedFieldCount: record.proof.verificationReport.associatedFieldCount } });
  evidence.history.push({ key: record.assetKey, state: record.state, frameHash: hash(pixels), visiblePixels, greenMarkerPixels, vertexCount: positions.length / 3, indexCount: indices.length, normalCount: normals.length, positionType: positions.constructor.name, indexType: indices.constructor.name, normalType: normals.constructor.name, derivedNormalsAreCADNormals: false, pose: { position: Array.from(root.position.array), quaternion: Array.from(root.rotationQuaternion.array), scale: Array.from(root.scale.array) }, nativeDomain: [...native.domain], sampleCount: native.parameters.length, intervals: native.intervals.length, spanCount: report.spanCount, endpointClosed: report.endpointClosed, periodic: report.periodic, D1Refusals: report.derivativeRefusalCount, nativeParameterIsAngle: false }); updateReadout(record);
}
function retained() {
  const record = host.accepted, { root, mesh } = record.result, geometry = mesh.geometry, material = mesh.material;
  return { record, proof: record.proof, result: record.result, source: record.source, model: record.model, readout: structuredClone(record.readout), root, mesh, geometry, material,
    positionAttribute: geometry.positions, normalAttribute: geometry.normals, indexAttribute: geometry.indices,
    positionArray: geometry.positions.buffer, normalArray: geometry.normals.buffer, indexArray: geometry.indices.buffer,
    positions: Array.from(geometry.positions.buffer), normals: Array.from(geometry.normals.buffer), indices: Array.from(geometry.indices.buffer),
    attributes: structuredClone({ positions: geometry.positions, normals: geometry.normals, indices: geometry.indices }),
    materialCamera: material.camera, materialLighting: material.lightingEnvironment, pixels: frame(), children: [...stage.children], rootChildren: [...root.children], callbacks: evidence.callbacks };
}
function checkRetained(before) {
  const record = host.accepted, { root, mesh } = record.result, geometry = mesh.geometry, material = mesh.material;
  requireFact(record === before.record && record.proof === before.proof && record.result === before.result && record.source === before.source && record.model === before.model && root === before.root && mesh === before.mesh && geometry === before.geometry && material === before.material &&
    geometry.positions === before.positionAttribute && geometry.normals === before.normalAttribute && geometry.indices === before.indexAttribute &&
    geometry.positions.buffer === before.positionArray && geometry.normals.buffer === before.normalArray && geometry.indices.buffer === before.indexArray &&
    material.camera === before.materialCamera && material.lightingEnvironment === before.materialLighting && same(frame(), before.pixels) && before.callbacks === evidence.callbacks && caller().retained,
    'Refusal changed original artifact/portable proof/native/buffer/camera/lighting/full frame');
  assertBuffer(before.positionArray, before.positions); assertBuffer(before.normalArray, before.normals); assertBuffer(before.indexArray, before.indices);
  assertNative({ positions: geometry.positions, normals: geometry.normals, indices: geometry.indices }, before.attributes, 'Retained actual attributes');
  requireFact(stage.children.length === before.children.length && stage.children.every((object, index) => object === before.children[index]) && root.children.length === before.rootChildren.length && root.children.every((object, index) => object === before.rootChildren[index]), 'Refusal changed caller Stage/owned root children');
  assertNative(record.readout, before.readout);
}
function dataURL(file) { return new URL(file, location.href).href; }
async function fetchPin(pin) { const response = await fetch(dataURL(pin.file)); requireFact(response.ok, 'Original file request failed'); const bytes = new Uint8Array(await response.arrayBuffer()), sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join(''); requireFact(bytes.length === pin.bytes && sha256 === pin.sha256, 'Original byte/SHA pin differs'); requireFact(response.headers.get('content-length') === String(pin.bytes) && (!pin.file.endsWith('.css') || response.headers.get('content-type') === 'text/plain; charset=utf-8'), 'Original byte metadata differs'); evidence.HTTPpins.push({ file: pin.file, bytes: bytes.length, sha256, status: response.status, contentType: response.headers.get('content-type'), contentLength: response.headers.get('content-length') }); return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
async function ledger() { const response = await fetch('/loader1200-request-log.json', { cache: 'no-store' }); requireFact(response.ok, 'Actual file ledger unavailable'); return response.json(); }
function setButtons(ids) { for (const id of ['refusals', 'transport', 'families', 'cold', 'cleanup']) document.querySelector('#' + id).disabled = !ids.includes(id); }
function failure(error) { evidence.error = { name: error.name, message: error.message, stack: error.stack }; evidence.runtimeErrors.push(evidence.error); evidence.ready = false; document.documentElement.dataset.loader1200Ready = 'false'; document.querySelector('#status').textContent = error.message; setButtons([]); console.error(error); }
async function action(operation) { if (busy || !evidence.ready || evidence.error || evidence.cleanup) return; busy = true; setButtons([]); try { await operation(); } catch (error) { failure(error); } finally { busy = false; } }
function mark(phase, message, buttons) { evidence.phase = phase; document.querySelector('#status').textContent = message; setButtons(buttons); }
Object.defineProperty(window, 'loader1200', { configurable: false, writable: false, value: Object.freeze({ snapshot: () => structuredClone({
  ...evidence, busy, environment: { pixiJS: VERSION, userAgent: navigator.userAgent, devicePixelRatio, canvasSize: [canvas.width, canvas.height], webGL: gl.getParameter(gl.VERSION) }, counts: host?.counts, caller: caller(), camera: cameraState(), sourceGraph: evidence.ready ? sourceGraph() : null,
  accepted: host?.accepted ? { assetKey: host.accepted.assetKey, state: host.accepted.state, source: host.accepted.source, model: host.accepted.model,
    artifact: host.accepted.proof.artifact, verification: host.accepted.proof.verification, proof: host.accepted.proof, readout: host.accepted.readout } : null,
  retainedLast: evidence.cleanup && host?.records.length ? { source: host.records.at(-1).source, model: host.records.at(-1).model, artifact: host.records.at(-1).proof.artifact, verification: host.records.at(-1).proof.verification, readout: host.records.at(-1).readout } : null,
  resources: host?.allResources.map((row, index) => ({ recordIndex: index, rootName: row.root.name, meshName: row.mesh.name,
    rootDisposals: row.rootDisposals, meshDisposals: row.meshDisposals, geometryDisposals: row.geometryDisposals, materialDisposals: row.materialDisposals,
    positions: [...row.positions], normals: [...row.normals], indices: [...row.indices],
    currentCPUPositions: Array.from(row.geometry.positions.buffer), currentCPUShaderNormals: Array.from(row.geometry.normals.buffer), currentCPUIndices: Array.from(row.geometry.indices.buffer),
    rootDestroyed: row.root.destroyed, meshDestroyed: row.mesh.destroyed, nativeParameters: row.nativeParameters, nativeIntervals: row.nativeIntervals })),
}) }) });
document.querySelector('#refusals').addEventListener('click', () => action(async () => { const before = retained(); evidence.refusals = host.runRefusals(assets, () => checkRetained(before)); requireFact(normalize(evidence.refusals).length === 16, 'Sixteen real refusals required'); checkRetained(before); mark('refusals', 'All 16 native/portable/core/binding refusals retained the full accepted trace and native authority.', ['transport']); }));
document.querySelector('#transport').addEventListener('click', () => action(async () => { const before = retained(); let prior = (await ledger()).length; evidence.transport = await host.runTransportRefusals(dataURL(assets.get(CASE_KEYS[0]).pins.find(pin => pin.file.endsWith('.css')).file), async receipt => { checkRetained(before); const count = (await ledger()).length, delta = count - prior; requireFact(delta === receipt.expectedRequestDelta, 'Actual per-case source request delta differs'); evidence.requestDeltas.push({ name: receipt.name, requests: delta }); prior = count; checkRetained(before); }); requireFact(normalize(evidence.transport).length === 5, 'Five real transport refusals required'); mark('transport', 'Real transport error identities and request counts observed.', ['families']); }));
document.querySelector('#families').addEventListener('click', () => action(async () => { for (const key of CASE_KEYS.slice(1)) { host.load(assets.get(key)); } requireFact(evidence.history.length === 10, 'Exactly ten authored Arc admissions required'); mark('authored', 'All ten original authored sources retain their real native domains and visible traces.', ['cold']); }));
document.querySelector('#cold').addEventListener('click', () => action(async () => { const key = CASE_KEYS.at(-1), pins = PINS.filter(pin => pin.file.includes('/' + key + '.')); const fresh = new Map(rawTexts); await Promise.all(pins.map(async pin => fresh.set(pin.file, await fetchPin(pin)))); requireFact(pins.length === 4, 'Exactly four fresh cold artifacts required'); coldBefore = retained(); const asset = await loadCase(key, file => fresh.get(file)); await host.coldReopen(asset, dataURL(asset.pins.find(pin => pin.file.endsWith('.css')).file)); requireFact(evidence.cold && evidence.HTTPpins.length === 44 && evidence.history.length === 11, 'Whole cold checkpoint missing'); mark('cold', 'Fresh original source, complete original artifact, separate portable proof, target positions and whole RGBA match.', ['cleanup']); }));
document.querySelector('#cleanup').addEventListener('click', () => action(async () => { const cpu = host.records.map(record => structuredClone(record.readout)); host.dispose(); host.dispose(); const pixels = frame(); let greenPixels = 0; for (let index = 0; index < pixels.length; index += 4) if (pixels[index] < 40 && pixels[index + 1] > 200 && pixels[index + 2] < 40) greenPixels++; requireFact(host.accepted === null && host.allResources.length === 11 && host.counts.livePairs === 0 && host.counts.peakLivePairs === 2 && evidence.callbacks === 12 && greenPixels > 0 && caller().retained && host.allResources.every(row => row.rootDisposals === 1 && row.meshDisposals === 1 && row.geometryDisposals === 1 && row.materialDisposals === 1), 'Actual pair cleanup/caller retention differs'); for (const key of ['root', 'mesh', 'geometry', 'material']) requireFact(new Set(host.allResources.map(row => row[key])).size === 11, 'Eleven distinct captured resources required'); host.records.forEach((record, index) => assertNative(record.readout, cpu[index], 'Complete native CPU after disposal')); evidence.serverRequests = await ledger(); requireFact(evidence.serverRequests.length === 48, 'Exact original-file traffic differs'); evidence.cleanup = { sets: 11, pairs: 11, callbacks: 12, doubleCall: true, greenPixels, fullNativeCPUReadable: true, callerRetained: true }; mark('cleanup', 'Eleven owned root/mesh/geometry/material sets released once; complete native Arc data and caller resources survive.', []); document.querySelector('#evidence').textContent = nativeJSON({ counts: host.counts, cleanup: evidence.cleanup, caller: caller() }); }));
window.addEventListener('error', event => evidence.runtimeErrors.push({ type: 'window-error', message: event.message })); window.addEventListener('unhandledrejection', event => evidence.runtimeErrors.push({ type: 'promise-error', message: String(event.reason) }));
try { requireFact(gl instanceof WebGL2RenderingContext, 'Genuine WebGL2 required'); await Promise.all(PINS.map(async pin => rawTexts.set(pin.file, await fetchPin(pin)))); for (const key of CASE_KEYS) assets.set(key, await loadCase(key, file => rawTexts.get(file))); host = createXYAngleArcPixi3DHost({ stage, camera, lighting, onChange(record) { evidence.callbacks++; observe(record); } }); host.load(assets.get(CASE_KEYS[0])); evidence.ready = true; document.documentElement.dataset.loader1200Ready = 'true'; sourceGraph(); mark('initial', 'Original multispan Curve loaded with native C0 observations and separate portable verification.', ['refusals']); } catch (error) { failure(error); } finally { busy = false; }
