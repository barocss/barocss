import { OrthographicCamera, Scene, SphereGeometry, Mesh, MeshBasicMaterial, WebGLRenderer, Line, LineBasicMaterial } from 'three';
import { PINS, loadSectionAsset, assertNative } from './section-uniform-curve-three-fixture.mjs';
import { createSectionUniformThreeHost } from './section-uniform-curve-three-checkpoint.mjs';
performance.setResourceTimingBufferSize(2048);
const width = 900, height = 640, scene = new Scene(), renderer = new WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(width, height); renderer.setClearColor(0x101b2c); document.querySelector('#view').append(renderer.domElement);
const camera = new OrthographicCamera(-.0065, .0065, .004622222222222222, -.004622222222222222, .0001, 1);
camera.position.set(.005, .040, .025); camera.up.set(0, 1, 0); camera.lookAt(.005, .003, .0108); camera.updateMatrixWorld(true);
const cameraState = { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), projection: camera.projectionMatrix.toArray(), matrix: camera.matrixWorld.toArray() };
const geometry = new SphereGeometry(.00012, 8, 6), material = new MeshBasicMaterial({ color: 0x00ff00 }), marker = new Mesh(geometry, material);
marker.position.set(.0105, -.0005, .0108); scene.add(marker);
const callerDisposals = { geometry: 0, material: 0, renderer: 0, canvasRemoval: 0 };
geometry.addEventListener('dispose', () => callerDisposals.geometry++); material.addEventListener('dispose', () => callerDisposals.material++);
const rendererDispose = renderer.dispose; renderer.dispose = function (...args) { callerDisposals.renderer++; return rendererDispose.apply(this, args); };
const canvas = renderer.domElement, canvasRemove = canvas.remove; canvas.remove = function (...args) { callerDisposals.canvasRemoval++; return canvasRemove.apply(this, args); };
const gl = renderer.getContext(), worldURL = new URL('./section-uniform-curve-three-data/polynomial.actual-world.source0.css', location.href).href;
const evidence = { ready: false, status: 'loading', error: null, HTTPpins: [], history: [], refusals: null, transport: null, cold: null, cleanup: null, glErrors: [], consoleErrors: [], callbacks: 0, camera: cameraState };
let host, busy = true, originalFrame, originalRecord, originalReadout;
function fact(value, message) { if (!value) throw new Error(message); }
function equalArray(a, b) { return a.length === b.length && a.every((value, index) => Object.is(value, b[index])); }
function frame() {
  renderer.render(scene, camera); const pixels = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const error = gl.getError(); evidence.glErrors.push(error); fact(error === gl.NO_ERROR, `WebGL error ${error}`); return pixels;
}
function hash(bytes) { let value = 2166136261; for (const byte of bytes) value = Math.imul(value ^ byte, 16777619) >>> 0; return value; }
function caller() {
  assertNative(camera.position.toArray(), cameraState.position); assertNative(camera.quaternion.toArray(), cameraState.quaternion);
  assertNative(camera.projectionMatrix.toArray(), cameraState.projection); assertNative(camera.matrixWorld.toArray(), cameraState.matrix);
  return { retained: marker.parent === scene && canvas.isConnected && !gl.isContextLost() && Object.values(callerDisposals).every(value => value === 0), disposals: { ...callerDisposals }, sceneChildren: scene.children.length };
}
function resources() { return host.allResources.map(row => ({ geometryUuid: row.geometry.uuid, materialUuid: row.material.uuid,
  geometryDisposals: row.geometryDisposals, materialDisposals: row.materialDisposals, positions: [...row.positions], currentPositions: Array.from(row.geometry.attributes.position.array) })); }
function sourceGraph() {
  const urls = [...new Set(performance.getEntriesByType('resource').map(entry => entry.name).filter(url => /\/packages\/barocss-(cad|cad-interop)\//.test(url)))];
  const source = urls.filter(url => /\/src\//.test(url)), dist = urls.filter(url => /\/dist\//.test(url));
  fact(source.length > 0 && dist.length === 0, 'Actual public source graph required'); return { source, dist, observedSourceURLs: source.length };
}
function snapshot() { return structuredClone({ ...evidence, caller: caller(), counts: host?.counts ?? {}, resources: host ? resources() : [],
  accepted: host?.accepted ? { state: host.accepted.state, section: host.accepted.section, native: host.accepted.native, readout: host.accepted.readout } : null,
  events: host?.events ?? [], sourceGraph: evidence.ready ? sourceGraph() : null }); }
Object.defineProperty(window, 'loader1089', { value: Object.freeze({ snapshot }), writable: false, configurable: false });
function status(value) { evidence.status = value; document.querySelector('#status').textContent = value; }
function details() {
  document.querySelector('#full-proof').textContent = document.querySelectorAll('details')[0].open && host?.accepted ? JSON.stringify(host.accepted.readout, null, 2) : '';
  document.querySelector('#lifetime').textContent = document.querySelectorAll('details')[1].open ? JSON.stringify({ counts: host.counts, resources: resources(), refusals: evidence.refusals, transport: evidence.transport, cleanup: evidence.cleanup }, null, 2) : '';
}
function readout(record) {
  const section = record.section, native = record.native;
  document.querySelector('#context').textContent = `World: ${native.model.name} / ${native.curveId} / degree ${native.model.objects[0].degree} / original mm\n` +
    `Native domain: ${JSON.stringify(native.domain)}; uniform parameters ${native.parameters.length}; intervals ${native.intervals.length}\n` +
    `Complete original Surface parent: ${section.surfaceAsset.sourceId} / ${section.originalModels[0].name} / ${section.originalModels[0].objects.map(object => `${object.kind}:${object.id}`).join(', ')}\n` +
    `Complete original Plane parent: ${section.planeAsset.sourceId} / ${section.originalModels[1].name} / ${section.originalModels[1].objects.map(object => `${object.kind}:${object.id}`).join(', ')}\n` +
    `Surface UV: ${section.pcurves.surface.coordinateSystem} / ${section.pcurves.surface.lengthUnit} / ${section.pcurves.surface.curve.id} / degree ${section.pcurves.surface.curve.degree}\n` +
    `Plane UV: ${section.pcurves.plane.coordinateSystem} / ${section.pcurves.plane.lengthUnit} / ${section.pcurves.plane.curve.id} / degree ${section.pcurves.plane.curve.degree}\n` +
    `Only the world Curve is drawn. Parents and UV charts retain their complete native data. Original XYZ and identity poses; .001 scene units/mm once.`;
  const rows = document.querySelector('#observations'); rows.replaceChildren();
  for (const observation of section.observations) { const row = document.createElement('tr');
    for (const value of [observation.parameter, JSON.stringify(observation.world.d0), JSON.stringify(observation.surfacePcurve.d0), JSON.stringify(observation.planePcurve.d0), JSON.stringify(observation.residuals)]) {
      const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
    } rows.append(row);
  }
  document.querySelector('#quality').textContent = JSON.stringify({ nativeDisplay: native.quality, sectionQuality: section.report.quality, nativePolicy: section.report.numericPolicy, exactRepresentationBounds: section.proof.bounds }, null, 2); details();
}
function observe(record) {
  fact(host.accepted === record, 'Observe current accepted record');
  fact(record.result.group.parent === scene && record.result.group.children.length === 1 && record.result.line instanceof Line && record.result.line.material instanceof LineBasicMaterial, 'Actual single world Line required');
  const line = record.result.line, buffer = line.geometry.attributes.position.array;
  fact(buffer.length === 387 && line.geometry.index === null && equalArray(buffer, record.native.positions), 'Original uniform Float32 positions differ');
  fact(equalArray(line.position.toArray(), [0, 0, 0]) && equalArray(line.quaternion.toArray(), [0, 0, 0, 1]) && equalArray(line.scale.toArray(), [1, 1, 1]), 'Original pose differs');
  const combined = frame(); line.visible = false; let background;
  try { background = frame(); } finally { line.visible = true; }
  fact(equalArray(frame(), combined), 'Complete frame not restored'); let visiblePixels = 0;
  for (let index = 0; index < combined.length; index += 4) if (combined[index] !== background[index] || combined[index + 1] !== background[index + 1] || combined[index + 2] !== background[index + 2]) visiblePixels++;
  fact(visiblePixels > 0 && caller().retained, 'Original world Line or caller invisible');
  if (!originalRecord) { originalRecord = record; originalFrame = combined; originalReadout = structuredClone(record.readout); }
  else { assertNative(record.readout, originalReadout, 'Full cold context/readout'); fact(equalArray(combined, originalFrame), 'Cold full RGBA changed');
    evidence.cold = { fullRGBAExact: true, fullNativeContextExact: true, fullReadoutExact: true, targetBuffersExact: equalArray(buffer, originalRecord.native.positions) };
  }
  evidence.history.push({ state: record.state, frameHash: hash(combined), visiblePixels, section: structuredClone(record.section), native: structuredClone(record.native), readout: structuredClone(record.readout) }); readout(record);
}
host = createSectionUniformThreeHost({ scene, onChange(record) { evidence.callbacks++; if (record) observe(record); else frame(); } });
function retained() { const record = host.accepted; return { record, result: record.result, section: record.section, native: record.native, readout: structuredClone(record.readout),
  geometry: record.result.line.geometry, material: record.result.line.material, buffer: record.result.line.geometry.attributes.position.array, data: Array.from(record.result.line.geometry.attributes.position.array), pixels: frame(), children: [...scene.children], callbacks: evidence.callbacks }; }
function checkRetained(before) {
  const record = host.accepted; fact(record === before.record && record.result === before.result && record.section === before.section && record.native === before.native &&
    record.result.line.geometry === before.geometry && record.result.line.material === before.material && record.result.line.geometry.attributes.position.array === before.buffer &&
    equalArray(before.buffer, before.data) && equalArray(frame(), before.pixels) && before.children.length === scene.children.length && before.children.every((child, index) => child === scene.children[index]) &&
    evidence.callbacks === before.callbacks && caller().retained, 'Refusal changed accepted context/Scene/resource/buffer/full RGBA/caller'); assertNative(record.readout, before.readout);
}
async function originalAsset() {
  const texts = new Map(); await Promise.all(PINS.map(async pin => {
    const response = await fetch(new URL(`./section-uniform-curve-three-data/${pin.file}`, location.href)); fact(response.ok && response.body, 'Original HTTP failed');
    const reader = response.body.getReader(), chunks = []; let count = 0;
    try { for (;;) { const { done, value } = await reader.read(); if (done) break; count += value.byteLength; fact(count <= 2 * 1024 * 1024, 'Original file too large'); chunks.push(value); } } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(count); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
    fact(count === pin.bytes && sha256 === pin.sha256, `Original pin changed ${pin.file}`);
    const contentType = response.headers.get('content-type'), contentLength = response.headers.get('content-length');
    if (pin.file.endsWith('.css')) fact(/^text\/plain\b/.test(contentType ?? '') && Number(contentLength) === pin.bytes, 'Original CSS headers changed');
    evidence.HTTPpins.push({ file: pin.file, status: response.status, bytes: count, sha256, contentType, contentLength, streamed: true }); texts.set(pin.file, new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  })); return loadSectionAsset(file => texts.get(file));
}
function controls() {
  const stop = busy || !!evidence.error || !!evidence.cleanup;
  document.querySelector('#run-refusals').disabled = stop || !!evidence.refusals;
  document.querySelector('#run-transport-refusals').disabled = stop || !evidence.refusals || !!evidence.transport;
  document.querySelector('#cold-reopen').disabled = stop || !evidence.transport || !!evidence.cold;
  document.querySelector('#dispose').disabled = stop || !evidence.cold;
}
async function run(action) { if (busy || evidence.error || evidence.cleanup) return; busy = true; controls();
  try { await action(); } catch (error) { evidence.error = { name: error.name, message: error.message, stack: error.stack }; evidence.consoleErrors.push(evidence.error); status(`Failed: ${error.message}`); console.error(error); }
  finally { busy = false; controls(); }
}
document.querySelector('#run-refusals').addEventListener('click', () => run(() => { const before = retained(); evidence.refusals = host.runRefusals(host.accepted.asset);
  fact(evidence.refusals.refusals.length === 16, 'Sixteen actual refusals required'); checkRetained(before); status('16 native/core/example refusals retained the complete accepted context and exact full frame.'); details(); }));
document.querySelector('#run-transport-refusals').addEventListener('click', () => run(async () => { const before = retained(); evidence.transport = await host.runTransportRefusals(worldURL);
  fact(evidence.transport.refusals.length === 5, 'Five actual transport refusals required'); checkRetained(before); status('Five actual bounded loadAsync refusals retained native data, GPU resources and full frame.'); details(); }));
document.querySelector('#cold-reopen').addEventListener('click', () => run(async () => { await host.coldReopen(await originalAsset(), worldURL); status('Cold original files, complete native context, target buffers and full frame are exact.'); }));
document.querySelector('#dispose').addEventListener('click', () => run(() => { host.dispose(); host.dispose(); fact(host.accepted === null && host.records.length === 2 && host.allResources.length === 3 && evidence.callbacks === 3, 'Actual collection/resource counts differ');
  fact(host.allResources.every(row => row.geometryDisposals === 1 && row.materialDisposals === 1 && equalArray(row.geometry.attributes.position.array, row.positions)), 'Owned disposal/CPU data changed');
  fact(scene.children.length === 1 && caller().retained, 'Caller lost after disposal'); const pixels = frame(); let greenPixels = 0;
  for (let index = 0; index < pixels.length; index += 4) if (pixels[index] < 40 && pixels[index + 1] > 200 && pixels[index + 2] < 40) greenPixels++;
  fact(greenPixels > 0, 'Caller marker lost'); evidence.cleanup = { pairs: 3, geometryDisposals: 3, materialDisposals: 3, doubleCall: true, greenPixels, fullNativeCPUReadable: true, frameHash: hash(pixels) };
  for (const record of host.records) assertNative(record.native.positions, record.result.positions);
  status('Three owned pairs released once. Full native context stays readable; caller Scene/camera/renderer/canvas/green marker survive.'); details(); }));
for (const detail of document.querySelectorAll('details')) detail.addEventListener('toggle', details);
window.addEventListener('error', event => evidence.consoleErrors.push({ message: event.message }));
window.addEventListener('unhandledrejection', event => evidence.consoleErrors.push({ message: String(event.reason) }));
controls(); try { fact(gl instanceof WebGL2RenderingContext, 'WebGL2 required'); host.load(await originalAsset()); evidence.ready = true; document.documentElement.dataset.loader1089Ready = 'true'; sourceGraph(); status('Original quartic world Curve and complete section context loaded.'); }
catch (error) { evidence.error = { name: error.name, message: error.message, stack: error.stack }; evidence.consoleErrors.push(evidence.error); status(`Failed: ${error.message}`); console.error(error); }
finally { busy = false; controls(); }
