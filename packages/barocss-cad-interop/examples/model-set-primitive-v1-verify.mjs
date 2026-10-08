import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { validateAdaptiveCurveSamples, validateWideAdaptiveCurveSamples } from '@barocss/cad';
import {
  loadBaroCadModelSet, prepareBaroCadModelSetPrimitiveDisplayV1,
} from '@barocss/cad-interop/model-set';

const examples = new URL('./', import.meta.url);
const sources = Object.fromEntries([
  ['left', 'curve-wide-v1.barocad'], ['right', 'curve-wide-v1-peer.barocad'],
  ['surface', 'model-set-primitive-surface.barocad'], ['legacy', 'curve-only.barocad'],
].map(([key, file]) => [key, readFileSync(new URL(file, examples), 'utf8')]));
assert.equal(sources.left, sources.right);
assert.equal(Buffer.byteLength(sources.left), 2631);
const server = createServer((request, response) => {
  const key = request.url?.slice(1);
  if (!Object.hasOwn(sources, key)) { response.writeHead(404).end(); return; }
  const bytes = Buffer.from(sources[key]);
  response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'content-length': bytes.length });
  response.end(bytes);
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
try {
  const baseURL = `http://127.0.0.1:${server.address().port}/`;
  const base = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001 };
  const wide = { ...base, curveDisplay: { version: 1, chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16 } };
  const manifest = { format: 'barocad-model-set', version: 0, entries: [
    { aliasId: 'left', url: 'left', options: wide },
    { aliasId: 'right', url: 'right', options: wide },
    { aliasId: 'floor', url: 'surface', options: base },
  ] };
  const set = await loadBaroCadModelSet(manifest, { baseURL });
  const before = structuredClone(set);
  const display = prepareBaroCadModelSetPrimitiveDisplayV1(set);
  assert.equal(display.length, 4);
  assert.deepEqual(display.map(entry => entry.kind), ['curve', 'curve', 'surface', 'surface']);
  assert.equal(new Set(display.map(entry => entry.binding.displayGeometryId)).size, 4);
  assert.deepEqual(display.slice(0, 2).map(entry => entry.binding.geometryId), ['wide_64', 'wide_64']);
  assert.deepEqual(display.slice(0, 2).map(entry => entry.binding.aliasId), ['left', 'right']);
  assert.ok(display[0].binding.displayGeometryId !== display[1].binding.displayGeometryId);
  for (const entry of display.slice(0, 2)) {
    assert.equal(entry.sampleVersion, 1);
    assert.equal(entry.basis, 'authored-xyz-matches-rhyup');
    assert.equal(entry.sample.curve.id, 'wide_64');
    assert.equal(entry.sample.curve.controlPoints.length, 64);
    assert.equal(entry.sample.pointsMM.length, 40);
    assert.ok(Object.is(entry.sample.curve.controlPoints[0][0], -0));
    validateWideAdaptiveCurveSamples(entry.sample);
  }
  for (const entry of display.slice(2)) {
    assert.equal(entry.packet.surfaceId, entry.binding.displayGeometryId);
    assert.equal(entry.binding.geometryKind, 'surface');
  }
  assert.deepEqual(set, before);
  display[0].sample.curve.controlPoints[0][0] = 999;
  assert.ok(Object.is(set.entries[0].result.model.objects[0].controlPoints[0][0], -0));
  assert.ok(Object.is(set.entries[0].result.curves[0].sample.curve.controlPoints[0][0], -0));
  const accepted = prepareBaroCadModelSetPrimitiveDisplayV1(set);
  const acceptedBefore = structuredClone(accepted);

  const duplicateAlias = { ...set, entries: [...set.entries.slice(0, 1),
    { ...set.entries[1], aliasId: 'left' }, set.entries[2]] };
  assert.throws(() => prepareBaroCadModelSetPrimitiveDisplayV1(duplicateAlias), /alias/);
  const overCapacity = { ...set, entries: [...set.entries,
    { ...set.entries[2], aliasId: 'extra' }] };
  assert.throws(() => prepareBaroCadModelSetPrimitiveDisplayV1(overCapacity), /at most four/);
  const mutated = structuredClone(set);
  mutated.entries[0].result.model.objects[0].controlPoints[0][0] = 999;
  assert.throws(() => prepareBaroCadModelSetPrimitiveDisplayV1(mutated), /differs/);
  const getter = structuredClone(set);
  let getterReads = 0;
  Object.defineProperty(getter.entries[0].result.curves[0].sample, 'curve', {
    enumerable: true, get() { getterReads++; return set.entries[0].result.curves[0].sample.curve; },
  });
  assert.throws(() => prepareBaroCadModelSetPrimitiveDisplayV1(getter));
  assert.equal(getterReads, 0);
  assert.deepEqual(accepted, acceptedBefore);
  assert.deepEqual(set, before);

  const legacy = await loadBaroCadModelSet({ format: 'barocad-model-set', version: 0,
    entries: [{ aliasId: 'old', url: 'legacy', options: { ...base,
      curveDisplay: { chordToleranceMM: 0.1, maxSegments: 128, maxDepth: 16 } } }] }, { baseURL });
  const oldDisplay = prepareBaroCadModelSetPrimitiveDisplayV1(legacy);
  assert.equal(oldDisplay.length, 1);
  assert.equal(oldDisplay[0].sampleVersion, 0);
  validateAdaptiveCurveSamples(oldDisplay[0].sample);
  console.log(JSON.stringify({ sourceBytes: Buffer.byteLength(sources.left), aliases: set.entries.map(entry => entry.aliasId),
    display: accepted.map(entry => ({ kind: entry.kind, binding: entry.binding,
      ...(entry.kind === 'curve' ? { sampleVersion: entry.sampleVersion, points: entry.sample.pointsMM.length } : {}) })),
    legacyV0Accepted: true, duplicateAndCapacityRefused: true, getterReads,
    originalModelAndSamplesRetained: true }));
} finally {
  server.closeAllConnections();
  server.close();
  await once(server, 'close');
}
