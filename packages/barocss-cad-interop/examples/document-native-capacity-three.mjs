import { validateCadDocumentResult } from '@barocss/cad';
import { loadBaroCadDocument, parseBaroCadDocument, prepareBaroCadDocumentPrimitiveNativeRefsV2 } from '@barocss/cad-interop/document';
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import { createBaroCadDocumentThreeDisplay, loadBaroCadDocumentThreeDisplay } from '@barocss/cad-interop/three-document';
import { Box3, BufferGeometry, Float32BufferAttribute, Line, LineBasicMaterial,
  OrthographicCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { observeDocumentPreparation } from './document-native-capacity-three-observer.mjs';

const documentURL = new URL('./document-native-capacity-three-data/expanded.cad-document.json', import.meta.url);
const ownedURL = new URL('./document-native-capacity-three-data/expanded.owned-document.json', import.meta.url);
const sourceURL = new URL('./linear-geometry-pattern-babylon-data/five_quarter_x_copies.barocad', import.meta.url);
const pins = {
  document: { bytes: 2328, sha: 'a832c5c6048da28502e404870bd7d3273fbc80c95bc7698d5a2d763f0222b3e0' },
  owned: { bytes: 9803, sha: 'e987f2504d62ef70d37a1e787a98a95e3397964c7276d2080dd5d839638aae12' },
  source: { bytes: 819, sha: 'f40feb68dab3f96e30922c82ab4e872d585154fad33f559bb561bdc223a5b8e2' },
};
const geometryIds = ['quarter_seed', 'quarter_copy_1', 'quarter_copy_2', 'quarter_copy_3', 'quarter_copy_4'];
const bodyIds = ['body_seed', 'body_copy_1', 'body_copy_2', 'body_copy_3', 'body_copy_4'];
const nativeOptions = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
  curveDisplay: { version: 1, chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16 },
  nativeCapacity: { version: 1, maximumObjects: 16 } };
const options = { native: nativeOptions, basis: 'authored-xyz-matches-rhyup',
  bodyIds: ['body_copy_3', 'body_copy_2', 'body_copy_1', 'body_seed'] };
const scene = new Scene();
const renderer = new WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(800, 350); renderer.setClearColor(0x101b2c);
document.querySelector('#view').append(renderer.domElement);
const camera = new OrthographicCamera(-0.0055, 0.0055, 0.00240625, -0.00240625, 0.0001, 1);
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
const evidence = { engine: 'Three0.186.1', publicEntries: ['@barocss/cad', '@barocss/cad-interop/document',
  '@barocss/cad-interop/native', '@barocss/cad-interop/three-document'],
  sourceAuthority: 'separately retained caller document, owned result and complete source; display wrapper exposes root/bindings/dispose',
  documentURL: documentURL.href, ownedURL: ownedURL.href, sourceURL: sourceURL.href, pins,
  nativeFrame: 'authored XYZ/mm; caller right-handed Y-up, camera +Z/up+Y', unitsPerMillimeter: 0.001,
  requestedBodyIds: [...options.bodyIds], authoredBodyIds: bodyIds, nativeGeometryIds: geometryIds,
  bindings: [], refusals: [], disposed: false, glErrors: [] };
window.__baroDocCapacityEvidence = evidence;
let accepted;
const requireFact = (fact, message) => { if (!fact) throw new Error(message); };
const same = (a, b) => Object.is(a, b) || (a !== null && b !== null && typeof a === 'object' &&
  typeof b === 'object' && Object.keys(a).length === Object.keys(b).length &&
  Object.keys(a).every(key => Object.hasOwn(b, key) && same(a[key], b[key])));
const sameBuffer = (a, b) => a?.length === b.length && Array.from(a).every((value, index) => Object.is(value, b[index]));
const hash = bytes => bytes.reduce((value, byte) => Math.imul(value ^ byte, 16777619) >>> 0, 2166136261);
const negativeZeroCount = value => typeof value === 'number' ? Number(Object.is(value, -0)) :
  value && typeof value === 'object' ? Object.values(value).reduce((sum, child) => sum + negativeZeroCount(child), 0) : 0;
async function fetchPinned(url, pin) {
  const response = await fetch(url); requireFact(response.ok, `HTTP ${response.status}: ${url}`);
  const bytes = await response.arrayBuffer();
  const sha = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
  requireFact(bytes.byteLength === pin.bytes && sha === pin.sha, `Saved artifact changed: ${url}`);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
function frame() {
  renderer.render(scene, camera);
  const bytes = new Uint8Array(800 * 350 * 4);
  gl.readPixels(0, 0, 800, 350, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
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
    Object.values(callerDisposals).every(value => value === 0);
}
function status(message) {
  document.querySelector('#status').textContent = `${message}\nDocument: native_capacity_document revision 5\nAsset: asset-pattern revision 2\nModel: quarter_pattern\n${bodyIds.map((id, index) => `${id}: ${geometryIds[index]}`).join('\n')}\nDisplay scale: 0.001 units/mm`;
}
function fail(error) {
  window.__baroDocCapacityError = error.stack ?? String(error);
  status(`Failed: ${error.message}`); console.error(error);
}
async function load() {
  for (const id of ['load', 'reject', 'dispose']) document.querySelector(`#${id}`).disabled = true;
  let next;
  try {
    requireFact(gl instanceof WebGL2RenderingContext, 'WebGL2 required');
    const [documentText, ownedText, source] = await Promise.all([
      fetchPinned(documentURL, pins.document), fetchPinned(ownedURL, pins.owned), fetchPinned(sourceURL, pins.source),
    ]);
    const owned = JSON.parse(ownedText); validateCadDocumentResult(owned);
    const parsed = parseBaroCadDocument(documentText); validateCadDocumentResult(parsed);
    const callerDocument = await loadBaroCadDocument(documentURL.href, {}); validateCadDocumentResult(callerDocument);
    requireFact(same(callerDocument, owned) && same(parsed, owned) && negativeZeroCount(owned) === 20 &&
      negativeZeroCount(callerDocument) === 20 && callerDocument.document.documentId === 'native_capacity_document' &&
      callerDocument.document.revision === 5 && callerDocument.document.assets[0].id === 'asset-pattern' &&
      callerDocument.document.assets[0].revision === 2 && callerDocument.document.assets[0].source === source &&
      callerDocument.compiledAssets[0].source === source &&
      same(callerDocument.document.bodies.map(body => body.id), bodyIds), 'Whole document/source authority changed');
    const neutral = parseBaroCadSource(source, nativeOptions);
    requireFact(neutral.model.name === 'quarter_pattern' && same(neutral.model, callerDocument.compiledAssets[0].model) &&
      neutral.model.objects.length === 5 && same(neutral.model.objects.map(object => object.id), geometryIds) &&
      negativeZeroCount(neutral.model) === 20, 'Full native Model or signed zero changed');
    const refs = prepareBaroCadDocumentPrimitiveNativeRefsV2(callerDocument, options);
    next = await observeDocumentPreparation(source, () => loadBaroCadDocumentThreeDisplay(documentURL.href, options, {}));
    const display = next.display;
    requireFact(display.bindings.length === 4 && next.prepared.length === 5 && display.root.children.length === 1 &&
      display.root.children[0].children.length === 4 && same(display.bindings.map(binding => binding.bodyId), bodyIds.slice(0, 4)) &&
      same(next.prepared.map(record => record.geometryId), geometryIds), 'Selected order or full asset preparation changed');
    const bindings = display.bindings.map((binding, index) => {
      const object = binding.object, reference = neutral.curves[index], projection = refs[index];
      requireFact(object instanceof Line && object.name === geometryIds[index] && binding.geometryId === geometryIds[index] &&
        binding.documentId === 'native_capacity_document' && binding.documentRevision === 5 &&
        binding.assetId === 'asset-pattern' && binding.assetRevision === 2 && binding.modelId === 'quarter_pattern' &&
        binding.ref.modelId === 'asset.pattern' && binding.ref.geometryId === geometryIds[index] &&
        binding.sourceFrame === 'authored-xyz-no-axis-conversion' && binding.geometryKind === 'curve' &&
        same(binding.ref, projection.ref) && same(projection.sample.curve, neutral.model.objects[index]) &&
        object.parent === binding.assetGroup && binding.assetGroup.parent === display.root &&
        sameBuffer(object.geometry.getAttribute('position').array, reference.positions) &&
        same(object.userData.barocss.nativeParameters, reference.sample.parameters) &&
        same(object.userData.barocss.nativeIntervals, reference.sample.segments.map(segment => segment.domain)), 'Qualified native/target association changed');
      for (const [p, point] of reference.sample.pointsMM.entries()) requireFact(point.every((value, axis) =>
        Object.is(Math.fround(value * 0.001), reference.positions[p * 3 + axis])), 'Incorrect millimetre conversion');
      return { bodyId: binding.bodyId, geometryId: binding.geometryId, ref: binding.ref,
        documentRevision: binding.documentRevision, assetRevision: binding.assetRevision,
        nativeParameters: [...reference.sample.parameters], bufferMatches: true };
    });
    requireFact(next.prepared[4].object.parent === null && next.prepared.every(record =>
      record.geometryDisposals === 0 && record.materialDisposals === 0), 'Detached fifth member released early or attached');
    scene.add(display.root); accepted?.display.dispose();
    accepted = { ...next, source, owned, callerDocument, documentText, ownedText }; next = undefined;
    const center = new Box3().setFromObject(display.root).getCenter(new Vector3());
    camera.position.set(center.x, center.y, 0.05); camera.up.set(0, 1, 0); camera.lookAt(center); camera.updateProjectionMatrix();
    display.root.visible = false; const background = frame(); display.root.visible = true;
    display.bindings.forEach(binding => { binding.object.visible = false; });
    for (const [index, binding] of display.bindings.entries()) {
      binding.object.visible = true; bindings[index].pixels = changedPixels(frame(), background);
      requireFact(bindings[index].pixels > 0, `Invisible selected body: ${binding.bodyId}`); binding.object.visible = false;
    }
    display.bindings.forEach(binding => { binding.object.visible = true; });
    const pixels = frame(); evidence.bindings = bindings; evidence.combinedPixels = changedPixels(pixels, background); evidence.frameHash = hash(pixels);
    evidence.nativeObjects = 5; evidence.nativeNegativeZeros = 20; evidence.selectedAttachedObjects = 4;
    evidence.preparedResourceCounts = { geometries: 5, materials: 5, detachedMembers: 1 };
    evidence.detachedFifth = { geometryId: accepted.prepared[4].geometryId, parent: null, disposalsBefore: [0, 0], gpuUploadClaim: false };
    evidence.publicReads = ['three pinned HTTP artifact reads', 'public authored document parse', 'public document URL read',
      'public native neutral parse and selected refs', 'public target document URL read and selected display construction'];
    evidence.documentRetained = true; evidence.sourceRetained = true; evidence.disposed = false; evidence.refusals = []; evidence.callerRetained = callerRetained();
    status('Four selected bodies are visible in authored order. The complete native Model still has five objects.');
  } finally {
    next?.display.dispose();
    document.querySelector('#load').disabled = false;
    document.querySelector('#reject').disabled = !accepted || evidence.disposed;
    document.querySelector('#dispose').disabled = !accepted;
  }
}
function reject() {
  requireFact(accepted && !evidence.disposed, 'Load the document first');
  const before = frame(), source = accepted.source, documentSnapshot = structuredClone(accepted.callerDocument);
  const legacy = { ...nativeOptions }; delete legacy.nativeCapacity;
  const missing = { ...options }; delete missing.bodyIds;
  const attempts = [
    ['legacy underlying asset capacity', () => createBaroCadDocumentThreeDisplay(accepted.callerDocument, { ...options, native: legacy })],
    ['missing explicit bodyIds', () => createBaroCadDocumentThreeDisplay(accepted.callerDocument, missing)],
    ['duplicate bodyIds', () => createBaroCadDocumentThreeDisplay(accepted.callerDocument, { ...options, bodyIds: ['body_seed', 'body_seed'] })],
    ['unknown bodyId', () => createBaroCadDocumentThreeDisplay(accepted.callerDocument, { ...options, bodyIds: ['unknown'] })],
    ['five selected bodies', () => createBaroCadDocumentThreeDisplay(accepted.callerDocument, { ...options, bodyIds })],
    ['invalid basis', () => createBaroCadDocumentThreeDisplay(accepted.callerDocument, { ...options, basis: 'z-up' })],
    ['invalid capacity profile', () => createBaroCadDocumentThreeDisplay(accepted.callerDocument, { ...options,
      native: { ...nativeOptions, nativeCapacity: { version: 1, maximumObjects: 5 } } })],
    ['forged native owned binding', () => {
      const forged = structuredClone(accepted.owned); forged.bodyBindings[0].geometryId = 'forged';
      return createBaroCadDocumentThreeDisplay(forged, options);
    }],
  ];
  for (const [label, attempt] of attempts) {
    let refused = false;
    try { const unexpected = attempt(); unexpected.dispose(); } catch { refused = true; }
    requireFact(refused && accepted.source === source && same(accepted.callerDocument, documentSnapshot) &&
      accepted.display.root.parent === scene && sameBuffer(frame(), before) && accepted.prepared.every(record =>
        record.geometryDisposals === 0 && record.materialDisposals === 0) && callerRetained(), 'Refusal changed accepted document/source/Scene/frame');
    evidence.refusals.push(label);
  }
  evidence.refusalSourceRetained = true; evidence.refusalDocumentRetained = true; evidence.refusalFrameRetained = true;
  status('Eight invalid candidates refused. The accepted complete document, source and display remain.');
}
function dispose() {
  requireFact(accepted, 'Load the document first');
  const source = accepted.source, documentSnapshot = structuredClone(accepted.callerDocument);
  accepted.display.dispose(); accepted.display.dispose();
  requireFact(accepted.display.root.parent === null && accepted.prepared.length === 5 && accepted.prepared.every(record =>
    record.geometryDisposals === 1 && record.materialDisposals === 1 && record.object.parent === null) &&
    accepted.source === source && same(accepted.callerDocument, documentSnapshot) && callerRetained(), 'Disposal crossed result ownership');
  frame(); evidence.disposed = true;
  evidence.preparedDisposals = accepted.prepared.map(record => ({ geometryId: record.geometryId,
    geometry: record.geometryDisposals, material: record.materialDisposals }));
  evidence.callerDisposals = { ...callerDisposals }; evidence.callerRetained = true;
  document.querySelector('#reject').disabled = true;
  status('All five prepared geometries and materials released once. Caller Scene, renderer, camera, marker and complete native data remain.');
}
document.querySelector('#load').addEventListener('click', () => { load().catch(fail); });
document.querySelector('#reject').addEventListener('click', () => { try { reject(); } catch (error) { fail(error); } });
document.querySelector('#dispose').addEventListener('click', () => { try { dispose(); } catch (error) { fail(error); } });
await load().catch(fail);
