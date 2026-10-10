import { parseBaroCadSource } from '@barocss/cad-interop/native';
import { DoubleSide, Mesh, MeshBasicMaterial, MeshNormalMaterial, OrthographicCamera, Scene, SphereGeometry, WebGLRenderer } from 'three';
import { GEOMETRY_KEYS, PINS, createNativeOptions, loadGeometry } from './solid-mass-principal-three-fixture.mjs';
import { createMassPrincipalThreeHost } from './solid-mass-principal-three-checkpoint.mjs';

performance.setResourceTimingBufferSize(4096);
const width = 900, height = 640, scene = new Scene();
const renderer = new WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(width, height); renderer.setClearColor(0x101b2c); document.querySelector('#view').append(renderer.domElement);
const camera = new OrthographicCamera(-0.030937499999999996, 0.030937499999999996, 0.022, -0.022, 0.0001, 1);
camera.position.set(0.025, 0.060, 0.115); camera.up.set(0, 1, 0); camera.lookAt(0.005, 0.010, 0.015); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
const cameraState = { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), projection: camera.projectionMatrix.toArray(), worldMatrix: camera.matrixWorld.toArray(),
  left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom, near: camera.near, far: camera.far };
const markerGeometry = new SphereGeometry(0.0004, 8, 6), markerMaterial = new MeshBasicMaterial({ color: 0x00ff00 });
const marker = new Mesh(markerGeometry, markerMaterial); marker.position.set(0.018, -0.004, 0.004); scene.add(marker);
const callerDisposals = { geometry: 0, material: 0, renderer: 0, canvasRemoval: 0 };
markerGeometry.addEventListener('dispose', () => callerDisposals.geometry++); markerMaterial.addEventListener('dispose', () => callerDisposals.material++);
const originalRendererDispose = renderer.dispose; renderer.dispose = function (...args) { callerDisposals.renderer++; return originalRendererDispose.apply(this, args); };
const canvas = renderer.domElement, originalCanvasRemove = canvas.remove;
canvas.remove = function (...args) { callerDisposals.canvasRemoval++; return originalCanvasRemove.apply(this, args); };
const gl = renderer.getContext(), options = createNativeOptions(), texts = new Map(), assets = new Map(), observations = new WeakMap();
const evidence = { ready: false, status: 'loading', error: null, target: 'Three0.186.1 WebGL2', options, fixedCamera: cameraState, HTTPpins: [], history: [],
  refusals: [], selections: [], glErrors: [], consoleErrors: [], cleanup: null, callbackCount: 0, allNativeCPUReadable: false,
  displayPolicy: 'Complete authored identity Surface panels; MeshNormalMaterial DoubleSide; four native Curves per panel without Lines. Native total/Body selection changes readout only; no lights, axis arrows or physical pose rotation.' };
let host, busy = true, refusalsDone = false, firstDisjoint, selectionBefore = null;
const requireFact = (condition, message) => { if (!condition) throw new Error(message); };
const same = (a, b) => Object.is(a, b) || (a !== null && b !== null && typeof a === 'object' && typeof b === 'object' &&
  Reflect.ownKeys(a).length === Reflect.ownKeys(b).length && Reflect.ownKeys(a).every(key => Object.hasOwn(b, key) && same(a[key], b[key])));
function sameBuffer(a, b) { if (!a || a.length !== b.length) return false; for (let i = 0; i < b.length; i++) if (!Object.is(a[i], b[i])) return false; return true; }
function hash(bytes) { let value = 2166136261; for (const byte of bytes) value = Math.imul(value ^ byte, 16777619) >>> 0; return value; }
const identityMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function frame() {
  renderer.render(scene, camera); const pixels = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const error = gl.getError(); evidence.glErrors.push(error); requireFact(error === gl.NO_ERROR, `WebGL error ${error}`); return pixels;
}
function pixelDifference(a, b) { let count = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) count++; return count; }
function callerRetained() { return marker.parent === scene && canvas.isConnected && !gl.isContextLost() && Object.values(callerDisposals).every(value => value === 0) &&
  same(camera.position.toArray(), cameraState.position) && same(camera.quaternion.toArray(), cameraState.quaternion) &&
  same(camera.projectionMatrix.toArray(), cameraState.projection) && same(camera.matrixWorld.toArray(), cameraState.worldMatrix); }
function sourceGraph() {
  const urls = [...new Set(performance.getEntriesByType('resource').map(entry => entry.name).filter(url => /\/packages\/barocss-(cad|cad-interop)\//.test(url)))];
  const source = urls.filter(url => /\/src\//.test(url)), dist = urls.filter(url => /\/dist\//.test(url));
  requireFact(source.length > 0 && dist.length === 0, 'Actual public source URLs required, with zero owned dist');
  return { source, dist, observedSourceURLs: source.length, frozenWriteFalseGraph: { ownSource: 161, ownDist: 0 }, scope: 'Browser ResourceTiming URLs and scoped write:false module graph are separate observations' };
}
function resourceSnapshot() { return host.allResources.map(row => ({ qualification: row.qualification, surfaceId: row.object.name, geometryUuid: row.geometry.uuid, materialUuid: row.material.uuid,
  geometryDisposals: row.geometryDisposals, materialDisposals: row.materialDisposals, positions: [...row.positions], normals: [...row.normals], parameters: [...row.parameters], indices: [...row.indices],
  currentCPUPositions: Array.from(row.geometry.attributes.position.array) })); }
function snapshot() {
  const record = host?.accepted;
  return structuredClone({ ...evidence, glChecks: evidence.glErrors.length, caller: { retained: callerRetained(), disposals: callerDisposals, canvasConnected: canvas.isConnected,
    sceneChildren: scene.children.map(child => ({ name: child.name, callerMarker: child === marker })) },
    counts: { geometryCollections: host?.records.length ?? 0, nativeReadouts: host?.updates.length ?? 0, acceptedResults: host?.records.reduce((sum, row) => sum + row.results.length, 0) ?? 0,
      pairs: host?.allResources.length ?? 0, targetParseCalls: host?.targetParseCalls ?? 0, peakLivePairs: host?.peakLivePairs ?? 0 },
    resources: host ? resourceSnapshot() : [], events: host?.events ?? [], updates: host?.updates ?? [],
    accepted: record ? { key: record.assetKey, state: record.state, caseKey: record.caseKey, proof: record.proof, principal: record.principal, readout: record.readout,
      rootAttached: record.root?.parent === scene, results: record.results.map(result => ({ source: result.source, model: result.model, unrenderedCurveIds: result.unrenderedCurveIds, childIds: result.group.children.map(child => child.name) })) } : null,
    sourceGraph: evidence.ready ? sourceGraph() : { source: [], dist: [] } });
}
Object.defineProperty(window, 'loader1131', { value: Object.freeze({ snapshot }), writable: false, configurable: false });
function status(message) { evidence.status = message; document.querySelector('#status').textContent = message; }
function numberText(value) { return Object.is(value, -0) ? '-0' : String(value); }
function vectorText(value) { return value === null ? 'null' : `[${value.map(numberText).join(', ')}]`; }
function matrixText(value) { return value === null ? 'null' : value.map(vectorText).join('\n'); }
function tableRow(table, values) { const row = document.createElement('tr'); for (const value of values) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); } table.append(row); }
function updateReadout(record, observed) {
  const native = record.principal, measure = native.measure, report = native.report, geometry = record.proof.boolean;
  const table = document.querySelector('#measure-rows'); table.replaceChildren();
  tableRow(table, ['Selection', report.selectedBodyId ?? 'Total material', 'Complete geometry stays attached']);
  tableRow(table, ['Density', numberText(report.densityKgPerM3), 'kg/m³ · original requested density; no material certification']);
  tableRow(table, ['Selected mass', numberText(measure.massKG), 'kg · actual native selected measure']);
  tableRow(table, ['Volume', numberText(measure.volumeMM3), 'mm³ · restricted integer-cell proof']);
  tableRow(table, ['Centroid', vectorText(measure.centroidMM), 'mm · original XYZ']);
  tableRow(table, ['Stored centroid inertia tensor', matrixText(measure.inertiaCentroidKgM2), 'kg·m² · selected stored Binary64 tensor']);
  tableRow(table, ['Observed axesUnique', String(report.axesUnique), 'Numerical cluster status; empty remains null']);
  tableRow(table, ['Observed degenerate clusters', JSON.stringify(report.observedDegenerateClusters), 'Native report field; not exact geometry-axis uniqueness']);
  tableRow(table, ['Jacobi rotation count', String(report.rotationCount), 'Actual native report / original rotation budget']);
  const axes = document.querySelector('#axis-rows'); axes.replaceChildren();
  if (native.principal === null) tableRow(axes, ['null', 'null', 'null · no axes for empty material']);
  else for (const axis of native.principal.axesXYZ) tableRow(axes, [String(axis.index), `${numberText(axis.momentKgM2)} kg·m²`, vectorText(axis.directionXYZ)]);
  document.querySelector('#readout').textContent = `Geometry: ${record.assetKey} / ${record.state}\nNative property case: ${record.caseKey}\n` +
    `Complete geometry: ${geometry.panels.length} panels, ${geometry.bodies.length} Bodies, ${geometry.shells.length} Shells\n` +
    `Bodies remain rendered: ${geometry.bodies.map(body => body.id).join(', ') || 'none'}\n` +
    `Whole operand Models: ${record.proof.operandModels.map(model => `${model.name}, version ${model.version}, ${model.objects.length} objects`).join('; ')}\n` +
    `Each panel Model: version 0, one Surface and four native Curves retained without Lines; original 2x2 grid\n` +
    `Original XYZ/mm and identity poses; 0.001 scene units/mm once. No physical reorientation or axis arrows.\n` +
    `Full frame hash ${observed.frameHash}; ${observed.surfaces.length} independently observed genuine panels.\n` +
    `Stored-tensor axesUnique=${report.axesUnique}; clusters=${report.observedDegenerateClusters.length}; empty=${report.empty}.`;
  document.querySelector('#quality').textContent = `Actual native residuals:\n${JSON.stringify(report.residuals, null, 2)}\n` +
    `Actual principal quality:\n${JSON.stringify(report.quality, null, 2)}\nActual native numerical policy:\n${JSON.stringify(report.numericPolicy, null, 2)}\n` +
    'Exact parent moments, conversion errors and positive-definite proof remain in the complete native result. Canonical local axis representatives are not persistent physical axes. The display geometry stays unchanged.';
  fillDetails();
}
function fillDetails() {
  document.querySelector('#full-proof').textContent = document.querySelector('#proof-details').open && host?.accepted ? JSON.stringify({ geometryProof: host.accepted.proof, principal: host.accepted.principal }, null, 2) : '';
  document.querySelector('#lifetime-proof').textContent = document.querySelector('#lifetime-details').open && host ? JSON.stringify({ counts: snapshot().counts,
    resources: resourceSnapshot(), history: evidence.history.map(({ principal, ...entry }) => entry), selections: evidence.selections, events: host.events }, null, 2) : '';
}
function validateNativeReadout(record) {
  const saved = assets.get(record.assetKey).principalInputsMap.get(record.caseKey);
  requireFact(saved && same(record.principal, saved.owned) && same(record.principal.mass, record.proof.mass) && same(record.principal.mass.boolean, record.proof.boolean), 'Full native mass/principal/selected measure differs from the authentic original');
  const report = record.principal.report;
  requireFact(report.units.moment === 'kg*m2' && report.units.centroid === 'mm' && report.selectedBodyId === record.principal.measure.bodyId, 'Native selected measure or units differ');
  if (record.assetKey === 'empty') requireFact(record.principal.measure.massKG === 0 && record.principal.measure.centroidMM === null && record.principal.measure.inertiaCentroidKgM2 === null &&
    record.principal.principal === null && report.sortedMomentsKgM2 === null && report.axesXYZ === null && report.axesUnique === null, 'Genuine empty null data was replaced');
  if (record.assetKey === 'cube') requireFact(report.axesUnique === false && report.observedDegenerateClusters.length > 0, 'Actual cube observed nonunique cluster result differs');
}
function validateGeometry(record) {
  const geometry = record.proof.boolean;
  requireFact(geometry.panels.length === record.results.length && record.resources.length === record.results.length && (record.root === null) === (record.results.length === 0), 'Complete Surface/empty collection count differs');
  requireFact(record.root === null || record.root.parent === scene, 'Whole candidate must be attached before observation');
  requireFact(host.records.filter(previous => previous !== record).every(previous => previous.root?.parent !== scene && previous.resources.every(row => row.geometryDisposals === 1 && row.materialDisposals === 1)), 'Old targets must be released before replacement render');
  for (const row of record.resources) {
    const q = row.qualification, result = row.result, source = geometry.sources.find(value => value.sourceId === q.sourceId), panel = geometry.panels.find(value => value.id === q.panelId),
      shell = geometry.shells.find(value => value.id === q.shellId), neutral = parseBaroCadSource(result.source, options), preview = neutral.surfaces[0], mesh = row.object;
    requireFact(source && panel && shell && source.panelId === panel.id && q.bodyId === panel.bodyId && q.emptyRegionId === panel.emptyRegionId && shell.role === q.shellRole && shell.panelIds.includes(panel.id) &&
      mesh.parent === result.group && result.group.parent?.parent?.parent === record.root && result.source === source.source && same(result.model, source.model) && same(result.model, panel.bundle.geometry) && same(result.model, neutral.model) &&
      result.model.version === 0 && result.model.objects.length === 5 && result.surfaces.length === 1 && result.curves.length === 0 && result.unrenderedCurveIds.length === 4 && result.group.children.length === 1 &&
      mesh instanceof Mesh && mesh.name === q.surfaceId && mesh.userData.surfaceId === q.surfaceId && mesh.material instanceof MeshNormalMaterial && mesh.material.side === DoubleSide &&
      mesh.geometry.attributes.position.count === 4 && mesh.geometry.index.count === 6 && sameBuffer(mesh.geometry.attributes.position.array, preview.mesh.positions) &&
      sameBuffer(mesh.geometry.attributes.normal.array, preview.mesh.normals) && sameBuffer(mesh.geometry.attributes._CAD_UV.array, preview.mesh.parameters) && sameBuffer(mesh.geometry.index.array, preview.mesh.indices) &&
      preview.packet.positions.every((value, index) => Object.is(Math.fround(value * 0.001), preview.mesh.positions[index])) && row.geometryDisposals === 0 && row.materialDisposals === 0,
    'Whole source-qualified Model/Body/Shell/Surface/nativeUV/actual target buffers/material/scale changed');
  }
  frame(); requireFact(record.resources.every(row => row.object.matrixWorld.elements.every((value, index) => value === identityMatrix[index])), 'Original authored world identity changed');
}
function captureGeometry(record) {
  validateGeometry(record); const combined = frame(), savedVisibility = record.resources.map(row => row.object.visible), surfaces = [];
  try {
    record.resources.forEach(row => { row.object.visible = false; }); const background = frame();
    for (const row of record.resources) { row.object.visible = true; const isolated = frame(); row.object.visible = false;
      const pixels = pixelDifference(isolated, background); requireFact(pixels > 0, `Invisible qualified native panel ${row.qualification.sourceId}/${row.qualification.panelId}`);
      surfaces.push({ id: `${row.qualification.sourceId}/${row.qualification.panelId}/${row.qualification.surfaceId}`, qualification: { ...row.qualification }, pixels, hash: hash(isolated), nativeUVExact: true, targetBuffersExact: true, worldIdentity: true }); }
  } finally { record.resources.forEach((row, index) => { row.object.visible = savedVisibility[index]; }); }
  requireFact(record.resources.every(row => row.object.visible) && sameBuffer(frame(), combined) && callerRetained(), 'Independent panel observation did not restore complete visibility/full RGBA/caller');
  const captured = { pixels: combined, surfaces, frameHash: hash(combined), models: record.results.map(result => structuredClone(result.model)),
    buffers: record.resources.map(row => ({ positions: [...row.positions], normals: [...row.normals], parameters: [...row.parameters], indices: [...row.indices] })) };
  if (record.assetKey === 'disjoint') requireFact(record.proof.boolean.bodies.every(body => surfaces.some(row => row.qualification.bodyId === body.id && row.pixels > 0)), 'Both genuine native Bodies must independently contribute observed pixels');
  if (record.assetKey === 'disjoint' && record.state === 'original') firstDisjoint = { ...captured, principal: structuredClone(record.principal), readout: structuredClone(record.readout), proof: structuredClone(record.proof) };
  if (record.state === 'cold-reopen') {
    requireFact(firstDisjoint && sameBuffer(combined, firstDisjoint.pixels) && same(surfaces, firstDisjoint.surfaces) && same(captured.models, firstDisjoint.models) &&
      same(captured.buffers, firstDisjoint.buffers) && same(record.proof, firstDisjoint.proof) && same(record.principal, firstDisjoint.principal) && same(record.readout, firstDisjoint.readout), 'Cold complete disjoint changed Models/buffers/full native/readout/full RGBA');
    evidence.coldReopen = { fullRGBAExact: true, individualContributionsExact: true, wholeModelsExact: true, targetBuffersExact: true, fullNativeExact: true, readoutExact: true };
  }
  observations.set(record, captured); return captured;
}
function observeRecord(record) {
  requireFact(host.accepted === record, 'Callback must observe current accepted geometry/native readout'); validateNativeReadout(record);
  const known = observations.get(record), captured = known ?? captureGeometry(record), kind = known ? 'selection' : 'geometry';
  if (known) {
    const before = selectionBefore, current = frame();
    requireFact(before && before.record === record && record.root === before.root && record.proof === before.proof && record.results === before.results && record.resources === before.resources &&
      host.records.length === before.collections && host.allResources.length === before.pairs && host.targetParseCalls === before.parseCalls && same(record.proof, before.proofCopy) &&
      scene.children.length === before.sceneChildren.length && before.sceneChildren.every((child, index) => child === scene.children[index]) && before.rows.every(({ row, object, geometry, material, parent, buffers, index, indexValues }) =>
        row.object === object && row.geometry === geometry && row.material === material && row.object.geometry === geometry && row.object.material === material && row.object.parent === parent &&
        row.object.matrixWorld.elements.every((value, index) => value === identityMatrix[index]) && row.geometryDisposals === 0 && row.materialDisposals === 0 &&
        buffers.every(buffer => row.geometry.attributes[buffer.name].array === buffer.reference && sameBuffer(buffer.reference, buffer.values)) && row.geometry.index.array === index && sameBuffer(index, indexValues)) &&
      record.caseKey !== before.caseKey && !same(record.principal, before.principal) && sameBuffer(current, before.pixels) && sameBuffer(current, known.pixels) && callerRetained(), 'Native Body update changed complete geometry/source/resource references/buffers/full RGBA or did not change native readout');
    evidence.selections.push({ key: record.assetKey, state: record.state, caseKey: record.caseKey, recordIndex: host.records.indexOf(record), fullRGBAExact: true, rootRetained: true,
      sourceModelBuffersRetained: true, resourcesRetained: true, targetAllocations: 0, targetDisposals: 0, wholeProofRetained: true, nativeReadoutChanged: true, frameHash: hash(current) });
  }
  const entry = { key: record.assetKey, state: record.state, caseKey: record.caseKey, kind, recordIndex: host.records.indexOf(record), frameHash: captured.frameHash,
    surfaces: structuredClone(captured.surfaces), nativeReadoutIndex: host.updates.length - 1, principal: structuredClone(record.principal), readout: structuredClone(record.readout),
    empty: record.results.length === 0, fullCollectionRestored: true };
  evidence.history.push(entry); updateReadout(record, entry); syncControls();
}
host = createMassPrincipalThreeHost({ scene, onChange(record) { evidence.callbackCount++; if (record) observeRecord(record); else frame(); } });
function selectionState(record) {
  return { record, root: record.root, proof: record.proof, proofCopy: structuredClone(record.proof), results: record.results, resources: record.resources,
    principal: structuredClone(record.principal), caseKey: record.caseKey, pixels: frame(), sceneChildren: [...scene.children], collections: host.records.length, pairs: host.allResources.length, parseCalls: host.targetParseCalls,
    rows: record.resources.map(row => ({ row, object: row.object, geometry: row.geometry, material: row.material, parent: row.object.parent,
      buffers: ['position', 'normal', '_CAD_UV'].map(name => ({ name, reference: row.geometry.attributes[name].array, values: Array.from(row.geometry.attributes[name].array) })),
      index: row.geometry.index.array, indexValues: Array.from(row.geometry.index.array) })) };
}
function select(caseKey) { selectionBefore = selectionState(host.accepted); try { host.select(caseKey); } finally { selectionBefore = null; }
  status(`Native ${caseKey} loaded. The same complete two-Body geometry, target references and exact full RGBA are retained.`); }
function syncControls() {
  const count = evidence.history.length, stop = busy || !!evidence.cleanup || !!evidence.error;
  document.querySelector('#run-refusals').disabled = stop || count !== 1 || refusalsDone;
  document.querySelector('#load-disjoint').disabled = stop || count !== 1 || !refusalsDone;
  document.querySelector('#select-body0').disabled = stop || ![2, 7].includes(count);
  document.querySelector('#select-body1').disabled = stop || ![3, 8].includes(count);
  document.querySelector('#load-cube').disabled = stop || count !== 4;
  document.querySelector('#load-empty').disabled = stop || count !== 5;
  document.querySelector('#cold-disjoint').disabled = stop || count !== 6;
  document.querySelector('#dispose').disabled = stop || count !== 9;
}
async function boundedBytes(response, file) {
  requireFact(response.body, `Missing actual HTTP response stream: ${file}`); const reader = response.body.getReader(), chunks = []; let length = 0;
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength;
    if (length > 2 * 1024 * 1024) { await reader.cancel(); throw new RangeError(`Original HTTP file exceeds 2MiB: ${file}`); } chunks.push(value); }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; } return bytes;
}
async function load() {
  requireFact(gl instanceof WebGL2RenderingContext, 'Actual WebGL2 required');
  await Promise.all(PINS.map(async pin => {
    const url = new URL(`./solid-mass-principal-three-data/${pin.file}`, location.href), response = await fetch(url);
    requireFact(response.ok, `HTTP ${response.status}: ${pin.file}`); const bytes = await boundedBytes(response, pin.file), contentType = response.headers.get('content-type'), contentLength = response.headers.get('content-length');
    if (pin.file.endsWith('.css')) requireFact(/^text\/plain\b/i.test(contentType ?? '') && Number(contentLength) === pin.bytes, `Original CSS disk bytes/headers differ: ${pin.file}`);
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
    requireFact(bytes.byteLength === pin.bytes && sha256 === pin.sha256, `Pinned original changed: ${pin.file}`);
    texts.set(pin.file, new TextDecoder('utf-8', { fatal: true }).decode(bytes)); evidence.HTTPpins.push({ file: pin.file, url: url.href, status: response.status, bytes: bytes.byteLength, sha256,
      contentType, contentLength, streamed: true, maximumBytes: 2 * 1024 * 1024 });
  }));
  requireFact(evidence.HTTPpins.length === 51 && evidence.HTTPpins.filter(pin => pin.file.endsWith('.css')).length === 31, 'Expected 51 actual original HTTP pins and 31 original CSS responses');
  for (const key of GEOMETRY_KEYS) assets.set(key, await loadGeometry(key, file => { requireFact(texts.has(file), `Missing fetched original ${file}`); return texts.get(file); }));
  host.load(assets.get('rect')); evidence.ready = true; document.documentElement.dataset.loader1131Ready = 'true'; sourceGraph();
  status('Complete rectangular Solid and native total mass/principal result loaded. Run 17 actual refusals.');
}
function runRefusals() {
  const before = host.accepted, saved = selectionState(before), native = structuredClone(before.principal), readout = structuredClone(before.readout), updates = host.updates.length, callbacks = evidence.callbackCount;
  const receipt = host.runRefusals(assets.get('rect'), assets.get('disjoint'));
  requireFact(receipt.refusals.length === 17 && receipt.getterCalls === 0 && receipt.acceptedRetained && host.accepted === before && same(before.principal, native) && same(before.readout, readout) &&
    same(before.proof, saved.proofCopy) && before.root === saved.root && before.results === saved.results && before.resources === saved.resources && host.records.length === saved.collections &&
    host.updates.length === updates && evidence.callbackCount === callbacks && scene.children.length === saved.sceneChildren.length && saved.sceneChildren.every((child, index) => child === scene.children[index]) &&
    saved.rows.every(({ row, object, geometry, material, parent, buffers, index, indexValues }) => row.object === object && row.geometry === geometry && row.material === material && row.object.parent === parent &&
      row.geometryDisposals === 0 && row.materialDisposals === 0 && buffers.every(buffer => row.geometry.attributes[buffer.name].array === buffer.reference && sameBuffer(buffer.reference, buffer.values)) &&
      row.geometry.index.array === index && sameBuffer(index, indexValues)) && sameBuffer(frame(), saved.pixels) && callerRetained(), 'Actual refusals changed full accepted native/readout/Scene/buffer identities/full RGBA/caller');
  requireFact(host.allResources.length === 8 && host.allResources.filter(row => row.geometryDisposals === 1 && row.materialDisposals === 1).length === 2, 'Controlled partial preparation must release exactly two actual detached pairs');
  evidence.refusals = receipt.refusals; evidence.getterCalls = receipt.getterCalls; evidence.refusalRGBAExact = true; refusalsDone = true;
  document.querySelector('#refusal-readout').textContent = JSON.stringify(receipt, null, 2); status('17 actual refusals retained full rectangular native data, target references and exact full RGBA. Two labelled staged pairs were released once.');
}
function loadGeometryCase(key) { host.load(assets.get(key)); status(`Complete ${key} original geometry and actual total native property result loaded at the same fixed camera.`); }
function coldDisjoint() { host.coldReopen(assets.get('disjoint')); status('Complete disjoint source cold-reopened. Native total result, target buffers and full RGBA are exact. Select both Bodies again.'); }
function dispose() {
  const proofCopies = host.records.map(record => ({ record, proof: structuredClone(record.proof), sources: record.results.map(result => result.source), models: record.results.map(result => structuredClone(result.model)) })), updates = structuredClone(host.updates);
  host.dispose(); host.dispose(); const rows = host.allResources;
  requireFact(host.accepted === null && host.records.length === 5 && host.updates.length === 9 && evidence.history.length === 9 && evidence.selections.length === 4 && evidence.callbackCount === 10 &&
    host.records.reduce((sum, record) => sum + record.results.length, 0) === 36 && rows.length === 38 && host.peakLivePairs === 18 && host.targetParseCalls === 41 &&
    new Set(rows.map(row => row.geometry.uuid)).size === 38 && new Set(rows.map(row => row.material.uuid)).size === 38 && rows.every(row => row.geometryDisposals === 1 && row.materialDisposals === 1 &&
      row.result.model.version === 0 && row.result.model.objects.length === 5 && typeof row.result.source === 'string' && row.result.unrenderedCurveIds.length === 4 &&
      sameBuffer(row.geometry.attributes.position.array, row.positions) && sameBuffer(row.geometry.attributes.normal.array, row.normals) && sameBuffer(row.geometry.attributes._CAD_UV.array, row.parameters) && sameBuffer(row.geometry.index.array, row.indices)) &&
    host.records.every(record => record.root?.parent !== scene && record.results.every(result => result.group.parent === null && result.group.children.length === 0)) &&
    proofCopies.every(({ record, proof, sources, models }) => same(record.proof, proof) && record.results.every((result, index) => result.source === sources[index] && same(result.model, models[index]))) &&
    same(host.updates, updates) && scene.children.length === 1 && callerRetained(), 'Final five geometry/nine native readout/38 actual pair lifetime/caller retention differs');
  const pixels = frame(); let greenPixels = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 40 && pixels[i + 1] > 200 && pixels[i + 2] < 40) greenPixels++;
  requireFact(greenPixels > 0, 'Standing caller green marker lost actual pixels');
  evidence.cleanup = { doubleCall: true, geometryCollections: 5, nativeReadouts: 9, selectionUpdates: 4, callbacks: 10, acceptedResults: 36, partialResults: 2, pairs: 38,
    distinctGeometries: 38, distinctMaterials: 38, geometryDisposals: rows.reduce((sum, row) => sum + row.geometryDisposals, 0), materialDisposals: rows.reduce((sum, row) => sum + row.materialDisposals, 0),
    peakLivePairs: host.peakLivePairs, targetParseCalls: host.targetParseCalls, greenPixels, frameHash: hash(pixels) };
  evidence.allNativeCPUReadable = true; status('38 actual geometry/material pairs released once. All nine full native readouts and original CPU data remain readable; caller Scene/camera/renderer/canvas/green marker survive.'); fillDetails();
}
async function run(action) { if (busy || evidence.cleanup || evidence.error) return; busy = true; syncControls();
  try { await action(); } catch (error) { evidence.error = { name: error.name, message: error.message, stack: error.stack }; evidence.consoleErrors.push(evidence.error); status(`Failed: ${error.message}`); console.error(error); }
  finally { busy = false; syncControls(); } }
for (const [id, action] of [['run-refusals', runRefusals], ['load-disjoint', () => loadGeometryCase('disjoint')], ['select-body0', () => select('disconnected_body_0')],
  ['select-body1', () => select('disconnected_body_1')], ['load-cube', () => loadGeometryCase('cube')], ['load-empty', () => loadGeometryCase('empty')], ['cold-disjoint', coldDisjoint], ['dispose', dispose]])
  document.querySelector(`#${id}`).addEventListener('click', () => run(action));
document.querySelector('#proof-details').addEventListener('toggle', fillDetails); document.querySelector('#lifetime-details').addEventListener('toggle', fillDetails);
window.addEventListener('error', event => { evidence.consoleErrors.push({ name: 'WindowError', message: event.message }); });
window.addEventListener('unhandledrejection', event => { evidence.consoleErrors.push({ name: event.reason?.name ?? 'UnhandledRejection', message: event.reason?.message ?? String(event.reason) }); });
syncControls();
try { await load(); } catch (error) { evidence.error = { name: error.name, message: error.message, stack: error.stack }; evidence.consoleErrors.push(evidence.error); status(`Failed: ${error.message}`); console.error(error); }
finally { busy = false; syncControls(); }
