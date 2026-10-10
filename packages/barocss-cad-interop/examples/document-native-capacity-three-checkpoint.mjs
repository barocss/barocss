import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { Line, Object3D, Scene } from 'three';
import { validateCadDocumentResult } from '@barocss/cad';
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import { loadBaroCadDocument, prepareBaroCadDocumentPrimitiveNativeRefsV2 } from '@barocss/cad-interop/document';
import { createBaroCadDocumentThreeDisplay, loadBaroCadDocumentThreeDisplay } from '@barocss/cad-interop/three-document';
import { BaroCADLoader } from '@barocss/cad-interop/three';
import { reproduceDocumentFixture, negativeZeroCount, sha256 } from './document-native-capacity-three-fixture.mjs';
import { observeDocumentPreparation } from './document-native-capacity-three-observer.mjs';

const fixture = reproduceDocumentFixture();
const { manifest, source, owned, documentText, ownedText } = fixture;
const nativeOptions = () => ({ sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
  nativeCapacity: { version: 1, maximumObjects: 16 },
  curveDisplay: { version: 1, chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16 } });
const options = () => ({ native: nativeOptions(), basis: 'authored-xyz-matches-rhyup', bodyIds: [...manifest.selectionIds] });
const neutral = parseBaroCadSource(source, nativeOptions());
assert.deepEqual(neutral.model, owned.compiledAssets[0].model);
assert.equal(neutral.curves.length, 5);
assert.equal(negativeZeroCount(owned), 20);
const publicRefs = prepareBaroCadDocumentPrimitiveNativeRefsV2(owned, options());
assert.equal(publicRefs.length, 4);
assert.deepEqual(publicRefs.map(entry => entry.binding.bodyId), manifest.bodyIds.slice(0, 4));
for (const [index, entry] of publicRefs.entries()) {
  assert.equal(entry.ref.modelId, 'asset.pattern');
  assert.equal(entry.ref.geometryId, manifest.geometryIds[index]);
  assert.equal(entry.binding.modelId, 'quarter_pattern');
  assert.equal(entry.binding.geometryKind, 'curve');
  assert.deepEqual(entry.sample.curve, neutral.model.objects[index]);
  assert.deepEqual(entry.sample, neutral.curves[index].sample);
}

const scene = new Scene();
const marker = new Object3D();
marker.name = 'caller-marker';
scene.add(marker);
const originalParse = BaroCADLoader.prototype.parse;
const accepted = [];
let preparedObjects = 0;
let disposalEvents = 0;
function verifyObserved(observation, callerDocument) {
  const { display, prepared } = observation;
  assert.equal(BaroCADLoader.prototype.parse, originalParse);
  assert.deepEqual(Object.keys(display).sort(), ['bindings', 'dispose', 'root']);
  assert.equal(display.cadSource, undefined);
  assert.equal(display.model, undefined);
  assert.equal(callerDocument.document.assets[0].source, source);
  assert.deepEqual(callerDocument.compiledAssets[0].model, neutral.model);
  assert.equal(callerDocument.compiledAssets[0].model.objects.length, 5);
  assert.equal(display.root.name, manifest.documentId);
  assert.equal(display.root.children.length, 1);
  assert.equal(display.bindings.length, 4);
  assert.equal(display.root.children[0].children.length, 4);
  assert.deepEqual(display.bindings.map(binding => binding.bodyId), manifest.bodyIds.slice(0, 4));
  assert.deepEqual(prepared.map(entry => entry.geometryId), manifest.geometryIds);
  for (const [index, entry] of prepared.entries()) {
    assert.ok(entry.object instanceof Line);
    assert.equal(entry.geometry, entry.object.geometry);
    assert.equal(entry.material, entry.object.material);
    assert.equal(entry.geometryDisposals, 0);
    assert.equal(entry.materialDisposals, 0);
    assert.deepEqual(Array.from(entry.geometry.getAttribute('position').array), Array.from(neutral.curves[index].positions));
    assert.deepEqual(entry.object.userData.barocss.nativeParameters, neutral.curves[index].sample.parameters);
    assert.deepEqual(entry.object.userData.barocss.nativeIntervals, neutral.curves[index].sample.segments.map(segment => segment.domain));
    assert.equal(entry.geometry.getAttribute('_CAD_UV'), undefined);
    assert.equal(entry.geometry.getAttribute('normal'), undefined);
    for (const [point, value] of neutral.curves[index].sample.pointsMM.entries()) {
      for (let axis = 0; axis < 3; axis++) assert.equal(entry.geometry.getAttribute('position').array[point * 3 + axis], Math.fround(value[axis] * 0.001));
    }
    if (index < 4) {
      const binding = display.bindings[index];
      assert.equal(binding.object, entry.object);
      assert.equal(binding.assetGroup, display.root.children[0]);
      assert.equal(binding.documentId, manifest.documentId);
      assert.equal(binding.documentRevision, 5);
      assert.equal(binding.assetId, 'asset-pattern');
      assert.equal(binding.assetRevision, 2);
      assert.equal(binding.modelId, 'quarter_pattern');
      assert.equal(binding.geometryId, manifest.geometryIds[index]);
      assert.equal(binding.ref.modelId, 'asset.pattern');
      assert.equal(binding.ref.geometryId, manifest.geometryIds[index]);
      assert.equal(binding.nativeFrame, 'authored-xyz-no-axis-conversion');
      assert.equal(binding.sourceFrame, 'authored-xyz-no-axis-conversion');
    } else {
      assert.equal(entry.object.parent, null, 'Unselected fifth object is detached, with its resources still owned');
      assert.ok(!display.bindings.some(binding => binding.geometryId === entry.geometryId));
    }
  }
  scene.add(display.root);
  accepted.push(observation);
  preparedObjects += prepared.length;
}
const direct = await observeDocumentPreparation(source, () => createBaroCadDocumentThreeDisplay(owned, options()));
verifyObserved(direct, owned);
const acceptedChildren = [...scene.children];
const ownedBefore = structuredClone(owned);
const refusalCases = [
  ['legacy-underlying-five-object-limit', () => { const request = options(); delete request.native.nativeCapacity; return createBaroCadDocumentThreeDisplay(owned, request); }],
  ['missing-explicit-selection', () => { const request = options(); delete request.bodyIds; return createBaroCadDocumentThreeDisplay(owned, request); }],
  ['duplicate-selection', () => createBaroCadDocumentThreeDisplay(owned, { ...options(), bodyIds: ['body_seed', 'body_seed'] })],
  ['unknown-selection', () => createBaroCadDocumentThreeDisplay(owned, { ...options(), bodyIds: ['body_unknown'] })],
  ['five-selected-bodies', () => createBaroCadDocumentThreeDisplay(owned, { ...options(), bodyIds: [...manifest.bodyIds] })],
  ['bad-basis', () => createBaroCadDocumentThreeDisplay(owned, { ...options(), basis: 'left-handed' })],
  ['bad-capacity-profile', () => { const request = options(); request.native.nativeCapacity.maximumObjects = 4; return createBaroCadDocumentThreeDisplay(owned, request); }],
  ['forged-owned-reference', () => { const candidate = structuredClone(owned); candidate.bodyBindings[0].geometryId = 'quarter_copy_4'; return createBaroCadDocumentThreeDisplay(candidate, options()); }],
];
const refusals = [];
for (const [name, action] of refusalCases) {
  assert.throws(action);
  refusals.push(name);
  assert.deepEqual(scene.children, acceptedChildren);
  assert.deepEqual(owned, ownedBefore);
  assert.equal(direct.display.bindings.length, 4);
  assert.ok(direct.prepared.every(entry => entry.geometryDisposals === 0 && entry.materialDisposals === 0));
}
await assert.rejects(observeDocumentPreparation(source, () => Promise.resolve({})), /exactly one five-member asset/);
assert.equal(BaroCADLoader.prototype.parse, originalParse);
await assert.rejects(observeDocumentPreparation(source, () => new BaroCADLoader(nativeOptions()).parse(source + ' ')), /exact pinned source/);
assert.equal(BaroCADLoader.prototype.parse, originalParse);

const requests = [];
const server = createServer((request, response) => {
  requests.push(request.url);
  const bytes = request.url === '/expanded.cad-document.json' ? documentText :
    request.url === '/expanded.owned-document.json' ? ownedText : request.url === '/complete.barocad' ? source : null;
  if (bytes === null) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end(bytes);
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
try {
  const base = `http://127.0.0.1:${server.address().port}`;
  const readHttpPinned = async (url, pin) => {
    const response = await fetch(url);
    assert.equal(response.status, 200);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.length, pin.bytes);
    assert.equal(sha256(bytes), pin.sha256);
    return bytes.toString('utf8');
  };
  assert.equal(await readHttpPinned(`${base}/complete.barocad`, manifest.source), source);
  assert.equal(await readHttpPinned(`${base}/expanded.cad-document.json`, manifest.document), documentText);
  const httpOwned = JSON.parse(await readHttpPinned(`${base}/expanded.owned-document.json`, manifest.owned));
  assert.deepEqual(validateCadDocumentResult(httpOwned), httpOwned.report);
  assert.deepEqual(httpOwned, owned);
  const url = `${base}/expanded.cad-document.json`;
  // The caller's document read and the display-only wrapper's read are separate.
  const callerDocument = await loadBaroCadDocument(url);
  assert.deepEqual(callerDocument, owned);
  const progress = [];
  const request = options();
  const signal = new AbortController().signal;
  const observed = await observeDocumentPreparation(source, () => loadBaroCadDocumentThreeDisplay(url, request,
    { signal, onProgress: event => { progress.push(event.loadedBytes); } }));
  verifyObserved(observed, callerDocument);
  assert.ok(progress.length > 0);
  assert.equal(progress.at(-1), manifest.document.bytes);
  assert.equal(requests.filter(value => value === '/expanded.cad-document.json').length, 3,
    'One explicit hash read, one caller document read, and one target wrapper read');
  assert.deepEqual(request, options());
  assert.deepEqual(callerDocument.document.assets[0].source, source);
} finally {
  server.close();
  await once(server, 'close');
}
for (const { display, prepared } of accepted) {
  display.dispose();
  display.dispose();
  assert.equal(display.root.parent, null);
  assert.equal(display.root.children.length, 0);
  for (const entry of prepared) {
    assert.equal(entry.geometryDisposals, 1);
    assert.equal(entry.materialDisposals, 1);
    disposalEvents += entry.geometryDisposals + entry.materialDisposals;
  }
}
assert.deepEqual(scene.children, [marker]);
assert.equal(marker.parent, scene);
assert.equal(BaroCADLoader.prototype.parse, originalParse);
console.log(JSON.stringify({ result: 'document-native-capacity-source-ok', source: manifest.source,
  document: manifest.document, owned: manifest.owned, nativeObjectCount: 5, selectedBodyCount: 4,
  selectedBodyOrder: manifest.bodyIds.slice(0, 4), requestedBodyOrder: manifest.selectionIds,
  sourceFrame: 'authored-xyz-no-axis-conversion', unitsPerMillimeter: 0.001,
  negativeZeroCount: 20, nativeObjectsPreparedPerAction: 5, nativeObjectsAttachedPerAction: 4,
  preparedObjects, disposalEvents, callerMarkerPreserved: true, refusals, httpRequests: requests,
  costs: { fixturePublicValidatorCalls: fixture.publicValidatorCalls,
    callerAndWrapperDocumentReads: 2, explicitDocumentHashReads: 1,
    publicOwnedValidationRebuildsNativeSources: true,
    documentPrimitiveAndTargetPathsDeriveUnderlyingFiveObjectPreviewsSeparately: true,
    fifthMember: 'prepared-CPU-resources-detached-not-observed-GPU-upload' } }));
