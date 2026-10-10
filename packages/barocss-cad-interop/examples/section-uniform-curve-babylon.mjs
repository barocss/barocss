import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Camera } from '@babylonjs/core/Cameras/camera.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { LinesMesh } from '@babylonjs/core/Meshes/linesMesh.js';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { PINS, loadSectionAsset, assertNative } from './section-uniform-curve-babylon-fixture.mjs';
import { createSectionUniformBabylonHost } from './section-uniform-curve-babylon-checkpoint.mjs';
performance.setResourceTimingBufferSize(4096);
const width = 900, height = 640, canvas = document.createElement('canvas');
canvas.width = width; canvas.height = height; document.querySelector('#view').append(canvas);
const engine = new Engine(canvas, false, { preserveDrawingBuffer: true, stencil: true });
engine.setHardwareScalingLevel(1); engine.setSize(width, height);
const scene = new Scene(engine); scene.useRightHandedSystem = true;
scene.clearColor = new Color4(16 / 255, 27 / 255, 44 / 255, 1);
const camera = new FreeCamera('caller-camera', new Vector3(.005, .040, .025), scene);
camera.upVector = new Vector3(0, 1, 0); camera.setTarget(new Vector3(.005, .003, .0108));
camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
camera.orthoLeft = -.0065; camera.orthoRight = .0065;
camera.orthoTop = .004622222222222222; camera.orthoBottom = -.004622222222222222;
camera.minZ = .0001; camera.maxZ = 1; scene.activeCamera = camera;
const cameraState = { position: camera.position.asArray(), rotation: camera.rotation.asArray(),
  projection: camera.getProjectionMatrix(true).asArray(), view: camera.getViewMatrix(true).asArray(),
  ortho: [camera.orthoLeft, camera.orthoRight, camera.orthoTop, camera.orthoBottom, camera.minZ, camera.maxZ] };
const marker = MeshBuilder.CreateSphere('caller-marker', { diameter: .00024, segments: 8 }, scene);
marker.position.set(.0105, -.0005, .0108);
const geometry = marker.geometry, material = new StandardMaterial('caller-green', scene);
material.disableLighting = true; material.emissiveColor = new Color3(0, 1, 0); marker.material = material;
const callerDisposals = { geometry: 0, material: 0, mesh: 0, engine: 0, scene: 0, camera: 0, canvasRemoval: 0 };
const callerGeometryDispose = geometry.dispose;
geometry.dispose = function (...args) { callerDisposals.geometry++; return callerGeometryDispose.apply(this, args); };
for (const [name, value] of Object.entries({ material, mesh: marker, engine, scene, camera })) value.onDisposeObservable.add(() => callerDisposals[name]++);
const canvasRemove = canvas.remove; canvas.remove = function (...args) { callerDisposals.canvasRemoval++; return canvasRemove.apply(this, args); };
const gl = canvas.getContext('webgl2'), worldURL = new URL('./section-uniform-curve-babylon-data/polynomial.actual-world.source0.css', location.href).href;
const evidence = { ready: false, status: 'loading', error: null, HTTPpins: [], history: [], refusals: null, transport: null, cold: null, cleanup: null, glErrors: [], consoleErrors: [], callbacks: 0, camera: cameraState };
let host, busy = true, originalFrame, originalRecord, originalReadout;
function fact(value, message) { if (!value) throw new Error(message); }
function equalArray(a, b) { return a.length === b.length && a.every((value, index) => Object.is(value, b[index])); }
function frame() {
  scene.render(); const pixels = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const error = gl.getError(); evidence.glErrors.push(error); fact(error === gl.NO_ERROR, `WebGL error ${error}`); return pixels;
}
function hash(bytes) { let value = 2166136261; for (const byte of bytes) value = Math.imul(value ^ byte, 16777619) >>> 0; return value; }
function caller() {
  assertNative(camera.position.asArray(), cameraState.position); assertNative(camera.rotation.asArray(), cameraState.rotation);
  assertNative(camera.getProjectionMatrix().asArray(), cameraState.projection); assertNative(camera.getViewMatrix().asArray(), cameraState.view);
  assertNative([camera.orthoLeft, camera.orthoRight, camera.orthoTop, camera.orthoBottom, camera.minZ, camera.maxZ], cameraState.ortho);
  return { retained: scene.activeCamera === camera && scene.useRightHandedSystem && scene.meshes.includes(marker) && marker.geometry === geometry && marker.material === material &&
    canvas.isConnected && !gl.isContextLost() && !engine.isDisposed && !scene.isDisposed && Object.values(callerDisposals).every(value => value === 0),
    disposals: { ...callerDisposals }, sceneMeshes: scene.meshes.length };
}
function resources() { return host.allResources.map(row => ({ meshId: row.mesh.uniqueId, geometryId: row.geometry.id, materialId: row.material.uniqueId,
  meshDisposals: row.meshDisposals, geometryDisposals: row.geometryDisposals, materialDisposals: row.materialDisposals,
  positions: [...row.positions], indices: [...row.indices], retainedPositionData: Array.from(row.positionArray), retainedIndexData: Array.from(row.indexArray) })); }
function sourceGraph() {
  const urls = [...new Set(performance.getEntriesByType('resource').map(entry => entry.name).filter(url => /\/packages\/barocss-(cad|cad-interop)\//.test(url)))];
  const source = urls.filter(url => /\/src\//.test(url)), dist = urls.filter(url => /\/dist\//.test(url));
  fact(source.length > 0 && dist.length === 0, 'Actual public source graph required'); return { source, dist, observedSourceURLs: source.length };
}
function snapshot() { return structuredClone({ ...evidence, caller: caller(), counts: host?.counts ?? {}, resources: host ? resources() : [],
  accepted: host?.accepted ? { state: host.accepted.state, section: host.accepted.section, native: host.accepted.native, readout: host.accepted.readout } : null,
  events: host?.events ?? [], sourceGraph: evidence.ready ? sourceGraph() : null }); }
Object.defineProperty(window, 'loader1138', { value: Object.freeze({ snapshot }), writable: false, configurable: false });
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
  fact(record.result.line instanceof LinesMesh && record.result.line.material instanceof ShaderMaterial && scene.meshes.includes(record.result.line) && record.result.line.isEnabled(), 'Actual enabled world LinesMesh required');
  const line = record.result.line, buffer = line.getVerticesData(VertexBuffer.PositionKind);
  fact(buffer.length === 387 && line.getIndices().length === 256 && equalArray(buffer, record.native.positions), 'Original uniform Float32 positions differ');
  fact(equalArray(line.position.asArray(), [0, 0, 0]) && equalArray((line.rotationQuaternion?.asArray() ?? [0, 0, 0, 1]), [0, 0, 0, 1]) && equalArray(line.scaling.asArray(), [1, 1, 1]), 'Original pose differs');
  const combined = frame(); line.setEnabled(false); let background;
  try { background = frame(); } finally { line.setEnabled(true); }
  fact(equalArray(frame(), combined), 'Complete frame not restored'); let visiblePixels = 0;
  for (let index = 0; index < combined.length; index += 4) if (combined[index] !== background[index] || combined[index + 1] !== background[index + 1] || combined[index + 2] !== background[index + 2]) visiblePixels++;
  fact(visiblePixels > 0 && caller().retained, 'Original world Line or caller invisible');
  if (!originalRecord) { originalRecord = record; originalFrame = combined; originalReadout = structuredClone(record.readout); }
  else { assertNative(record.readout, originalReadout, 'Full cold context/readout'); fact(equalArray(combined, originalFrame), 'Cold full RGBA changed'); fact(equalArray(line.getIndices(), originalRecord.resources[0].indices), 'Cold target indices changed');
    evidence.cold = { fullRGBAExact: true, fullNativeContextExact: true, fullReadoutExact: true, targetBuffersExact: equalArray(buffer, originalRecord.native.positions) };
  }
  evidence.history.push({ state: record.state, frameHash: hash(combined), visiblePixels, section: structuredClone(record.section), native: structuredClone(record.native), readout: structuredClone(record.readout) }); readout(record);
}
host = createSectionUniformBabylonHost({ scene, onChange(record) { evidence.callbacks++; if (!record) frame(); } });
function retained() { const record = host.accepted; return { record, result: record.result, section: record.section, native: record.native, readout: structuredClone(record.readout),
  geometry: record.result.line.geometry, material: record.result.line.material, indexBuffer: record.result.line.getIndices(), indexData: Array.from(record.result.line.getIndices()), buffer: record.result.line.getVerticesData(VertexBuffer.PositionKind), data: Array.from(record.result.line.getVerticesData(VertexBuffer.PositionKind)), pixels: frame(), children: [...scene.meshes], callbacks: evidence.callbacks }; }
function checkRetained(before) {
  const record = host.accepted; fact(record === before.record && record.result === before.result && record.section === before.section && record.native === before.native &&
    record.result.line.geometry === before.geometry && record.result.line.material === before.material && record.result.line.getVerticesData(VertexBuffer.PositionKind) === before.buffer &&
    record.result.line.getIndices() === before.indexBuffer && equalArray(before.indexBuffer, before.indexData) && equalArray(before.buffer, before.data) && equalArray(frame(), before.pixels) && before.children.length === scene.meshes.length && before.children.every((child, index) => child === scene.meshes[index]) &&
    evidence.callbacks === before.callbacks && caller().retained, 'Refusal changed accepted context/Scene/resource/buffer/full RGBA/caller'); assertNative(record.readout, before.readout);
}
async function originalAsset() {
  const texts = new Map(); await Promise.all(PINS.map(async pin => {
    const response = await fetch(new URL(`./section-uniform-curve-babylon-data/${pin.file}`, location.href)); fact(response.ok && response.body, 'Original HTTP failed');
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
  fact(evidence.refusals.refusals.length === 17, 'Seventeen actual refusals required'); checkRetained(before); status('17 native/core/example refusals retained the complete accepted context and exact full frame.'); details(); }));
document.querySelector('#run-transport-refusals').addEventListener('click', () => run(async () => { const before = retained(); evidence.transport = await host.runTransportRefusals(worldURL);
  fact(evidence.transport.refusals.length === 5, 'Five actual transport refusals required'); checkRetained(before); status('Five actual bounded loadAsync refusals retained native data, GPU resources and full frame.'); details(); }));
document.querySelector('#cold-reopen').addEventListener('click', () => run(async () => { await host.coldReopen(await originalAsset(), worldURL); await scene.whenReadyAsync(); observe(host.accepted); status('Cold original files, complete native context, target buffers and full frame are exact.'); }));
document.querySelector('#dispose').addEventListener('click', () => run(() => { host.dispose(); host.dispose(); fact(host.accepted === null && host.records.length === 2 && host.allResources.length === 3 && evidence.callbacks === 3, 'Actual collection/resource counts differ');
  fact(host.allResources.every(row => row.meshDisposals === 1 && row.geometryDisposals === 1 && row.materialDisposals === 1 && equalArray(row.positionArray, row.positions) && equalArray(row.indexArray, row.indices)), 'Owned disposal/CPU data changed');
  fact(scene.meshes.length === 1 && caller().retained, 'Caller lost after disposal'); const pixels = frame(); let greenPixels = 0;
  for (let index = 0; index < pixels.length; index += 4) if (pixels[index] < 40 && pixels[index + 1] > 200 && pixels[index + 2] < 40) greenPixels++;
  fact(greenPixels > 0, 'Caller marker lost'); evidence.cleanup = { triples: 3, meshDisposals: 3, geometryDisposals: 3, materialDisposals: 3, doubleCall: true, greenPixels, fullNativeCPUReadable: true, frameHash: hash(pixels) };
  for (const record of host.records) assertNative(record.native.positions, record.result.positions);
  status('Three owned triples released once. Full native context stays readable; caller Scene/camera/engine/canvas/green marker survive.'); details(); }));
for (const detail of document.querySelectorAll('details')) detail.addEventListener('toggle', details);
window.addEventListener('error', event => evidence.consoleErrors.push({ message: event.message }));
window.addEventListener('unhandledrejection', event => evidence.consoleErrors.push({ message: String(event.reason) }));
controls(); try { fact(gl instanceof WebGL2RenderingContext, 'WebGL2 required'); host.load(await originalAsset()); await scene.whenReadyAsync(); observe(host.accepted); evidence.ready = true; document.documentElement.dataset.loader1138Ready = 'true'; sourceGraph(); status('Original quartic world Curve and complete section context loaded.'); }
catch (error) { evidence.error = { name: error.name, message: error.message, stack: error.stack }; evidence.consoleErrors.push(evidence.error); status(`Failed: ${error.message}`); console.error(error); }
finally { busy = false; controls(); }
