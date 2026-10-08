import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { validateWideAdaptiveCurveSamples } from '@barocss/cad';
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import {
  loadBaroCadModelSet, prepareBaroCadModelSetPrimitiveDisplayV1,
  prepareBaroCadModelSetPrimitiveNativeRefsV2,
} from '@barocss/cad-interop/model-set';

const files = ['model-set-gpu-v2-a.barocad', 'model-set-gpu-v2-b.barocad'];
const sources = files.map(file => readFileSync(new URL(file, import.meta.url), 'utf8'));
const originalCurve = readFileSync(new URL('curve-wide-v1.barocad', import.meta.url), 'utf8');
const base = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001 };
const wide = { ...base, curveDisplay: { version: 1, chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16 } };
const expectedCurve = parseBaroCadSource(originalCurve, wide).model.objects[0];
const server = createServer((request, response) => {
  const index = Number(request.url?.slice(1));
  if (!Number.isInteger(index) || index < 0 || index > 1) { response.writeHead(404).end(); return; }
  const bytes = Buffer.from(sources[index]);
  response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'content-length': bytes.length });
  response.end(bytes);
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
try {
  const set = await loadBaroCadModelSet({ format: 'barocad-model-set', version: 0,
    entries: [0, 1].map(index => ({ aliasId: index ? 'asset-b' : 'asset_a', url: String(index), options: wide })) },
  { baseURL: `http://127.0.0.1:${server.address().port}/` });
  const before = structuredClone(set);
  const display = prepareBaroCadModelSetPrimitiveDisplayV1(set);
  const native = prepareBaroCadModelSetPrimitiveNativeRefsV2(set);
  assert.equal(native.length, 4);
  assert.deepEqual(native.map(entry => entry.kind), ['curve', 'surface', 'curve', 'surface']);
  assert.deepEqual(native.map(entry => entry.ref.modelId), ['asset_a', 'asset_a', 'asset.b', 'asset.b']);
  assert.deepEqual(native.map(entry => entry.ref.geometryId), ['wide_64', 'shared_panel', 'wide_64', 'shared_panel']);
  assert.equal(new Set(native.map(entry => entry.binding.displayGeometryId)).size, 4);
  assert.deepEqual(native.map(entry => entry.binding), display.map(entry => entry.binding));
  assert.ok(display.filter(entry => entry.kind === 'surface')
    .every(entry => entry.packet.surfaceId === entry.binding.displayGeometryId));
  for (let index = 0; index < 2; index++) {
    const result = set.entries[index].result;
    assert.equal(result.model.name, 'wide_model');
    assert.deepEqual(result.model.objects[0], expectedCurve);
    assert.equal(Buffer.byteLength(result.source), 2816);
    assert.ok(Object.is(result.model.objects[0].controlPoints[0][0], -0));
    assert.equal(result.surfaces[0].packet.surfaceId, 'shared_panel');
    assert.deepEqual(native[index * 2].sample, result.curves[0].sample);
    assert.deepEqual(native[index * 2 + 1].packet, result.surfaces[0].packet);
  }
  for (const entry of native) {
    assert.equal(entry.ref.geometryId, entry.kind === 'surface' ? entry.packet.surfaceId : entry.sample.curve.id);
    if (entry.kind === 'curve') {
      assert.equal(entry.sampleVersion, 1);
      assert.equal(entry.sample.pointsMM.length, 40);
      validateWideAdaptiveCurveSamples(entry.sample);
    }
  }
  assert.deepEqual(set, before);
  native[0].sample.curve.controlPoints[0][0] = 999;
  native[1].packet.positions[0] = 999;
  assert.deepEqual(set, before);
  const accepted = prepareBaroCadModelSetPrimitiveNativeRefsV2(set);
  const acceptedBefore = structuredClone(accepted);
  const duplicateAlias = { ...set, entries: [set.entries[0], { ...set.entries[1], aliasId: 'asset_a' }] };
  assert.throws(() => prepareBaroCadModelSetPrimitiveNativeRefsV2(duplicateAlias), /alias/);
  const overCapacity = { ...set, entries: [...set.entries,
    { ...set.entries[0], aliasId: 'asset_c' }] };
  assert.throws(() => prepareBaroCadModelSetPrimitiveNativeRefsV2(overCapacity), /at most four/);
  const getter = structuredClone(set);
  let getterReads = 0;
  Object.defineProperty(getter.entries[1].result.curves[0].sample, 'curve', {
    enumerable: true, get() { getterReads++; return set.entries[1].result.curves[0].sample.curve; },
  });
  assert.throws(() => prepareBaroCadModelSetPrimitiveNativeRefsV2(getter));
  assert.equal(getterReads, 0);
  assert.deepEqual(accepted, acceptedBefore);
  assert.deepEqual(set, before);
  const hyphenAliases = { ...set, entries: [
    { ...set.entries[0], aliasId: 'asset-a' },
    { ...set.entries[1], aliasId: 'asset_a' },
  ] };
  const encoded = prepareBaroCadModelSetPrimitiveNativeRefsV2(hyphenAliases);
  assert.deepEqual(encoded.map(entry => entry.ref.modelId), ['asset.a', 'asset.a', 'asset_a', 'asset_a']);
  assert.deepEqual(encoded.map(entry => entry.binding.aliasId), ['asset-a', 'asset-a', 'asset_a', 'asset_a']);
  console.log(JSON.stringify({ sourceBytes: sources.map(source => Buffer.byteLength(source)),
    nativeIds: native.map(entry => entry.ref.geometryId), qualifiedRefs: native.map(entry => entry.ref),
    displayIds: native.map(entry => entry.binding.displayGeometryId), originalCurveEqual: true,
    originalSignedZero: true, getterReads, refusalRetained: true }));
} finally {
  server.closeAllConnections();
  server.close();
  await once(server, 'close');
}
