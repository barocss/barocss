import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createReviewFile, readReviewFile, REVIEW_FILE_LIMIT } from '../review-file.js';

// File codec tests use the actual saved assembly fixture. They do not test Viewer admission.
const original = JSON.parse(await readFile(new URL(
  '../../../examples/gpu-scene/fixtures/assembly-revision0.json', import.meta.url), 'utf8'));
const source = () => structuredClone(original);
const instance = id => original.instances.find(value => value.id === id);
const ids = ['child', 'shared_root'];
const query = id => ({ assemblyId: original.assemblyId, assemblyRevision: original.revision,
  instanceId: id, reference: structuredClone(instance(id).reference), query: { kind: 'curve', parameter: 2 } });
const assemblyMeasurement = () => ({ first: query(ids[0]), second: query(ids[1]),
  distanceMM: Math.sqrt(212), metric: 'straight-line', space: 'assembly-space-xyz', certification: 'not-certified' });
const review = () => ({ schema: 'barocss-viewer-review', version: 1,
  scene: { kind: 'assembly', id: original.assemblyId, revision: original.revision, mmToSceneUnit: .15,
    members: ids.map(id => JSON.stringify([id, instance(id).reference])) },
  camera: { eye: [3, 2, 6], target: [0, 0, 0], up: [0, 1, 0], fovY: 45, near: .01, far: 100 },
  visibleGeometry: ids.map(id => ({ kind: 'curve', modelId: 'assembly.' + Array.from(id,
    character => character.charCodeAt(0).toString(16).padStart(2, '0')).join(''), curveId: 'shared_curve' })),
  selectedGeometry: null });
const create = measured => createReviewFile(review(), null, source(), undefined, undefined, measured);

test('assembly measurement round trips only point queries and distance', async () => {
  const measured = assemblyMeasurement(), file = await create(measured), text = JSON.stringify(file);
  assert.equal(file.sourceSHA256, createHash('sha256').update(JSON.stringify(original)).digest('hex'));
  assert.deepEqual(file.assemblyMeasurement, measured);
  assert.equal(file.measurement, null);
  assert.ok(!text.includes('assemblyPointMM') && !text.includes('worldMatrix') && !text.includes('@model'));
  const result = await readReviewFile(text, source());
  assert.deepEqual(result.assemblyMeasurement, measured);
  assert.equal(result.candidate.measurement, null);
  assert.equal(Object.hasOwn(result.candidate, 'assemblyMeasurement'), false);
  file.assemblyMeasurement.first.query.parameter = 7;
  assert.equal(result.assemblyMeasurement.first.query.parameter, 2);
  const empty = await create(null);
  assert.equal((await readReviewFile(JSON.stringify(empty), source())).assemblyMeasurement, null);
});

test('assembly measurement and source are detached before asynchronous hashing', async () => {
  const measured = assemblyMeasurement(), doc = source();
  const pending = createReviewFile(review(), null, doc, undefined, undefined, measured);
  measured.first.query.parameter = 7; measured.first.reference.bodyId = 'changed';
  doc.instances[0].placement.translationMM[0] += 1;
  const file = await pending;
  assert.deepEqual(file.assemblyMeasurement, assemblyMeasurement());
  assert.deepEqual((await readReviewFile(JSON.stringify(file), source())).assemblyMeasurement, assemblyMeasurement());
  await assert.rejects(readReviewFile(JSON.stringify(file), doc), /source differs/);
});

test('assembly measurement source hash rejects changed geometry, placement, and hierarchy', async () => {
  const file = await create(assemblyMeasurement()), text = JSON.stringify(file);
  for (const change of [
    value => { value.parts[0].assets[0].source += ' changed'; },
    value => { value.instances[0].placement.translationMM[0] += 1; },
    value => { value.instances[0].parentId = null; },
    value => { value.instances[0].reference.assetRevision += 1; },
  ]) {
    const changed = source(); change(changed);
    await assert.rejects(readReviewFile(text, changed), /source differs/);
  }
});

test('document and legacy review formats reject an assembly measurement field', async () => {
  const view = review(); view.scene.kind = 'document';
  for (const measured of [assemblyMeasurement(), null]) {
    await assert.rejects(createReviewFile(view, null, source(), undefined, undefined, measured), /assembly review/);
    const old = await createReviewFile(view, null, { schema: 'fixture-document' });
    await assert.rejects(readReviewFile(JSON.stringify({ ...old, assemblyMeasurement: measured }),
      { schema: 'fixture-document' }), /assembly review/);
  }
  await assert.rejects(readReviewFile(JSON.stringify({ ...review(), assemblyMeasurement: assemblyMeasurement() }), source()),
    /unsupported fields/);
  const old = await createReviewFile(review(), null, source());
  assert.equal(Object.hasOwn(await readReviewFile(JSON.stringify(old), source()), 'assemblyMeasurement'), false);
  assert.equal(Object.hasOwn(await readReviewFile(JSON.stringify(review()), source()), 'assemblyMeasurement'), false);
});

test('malformed assembly measurement data and derived coordinates refuse', async () => {
  const good = assemblyMeasurement();
  const invalid = [
    { ...good, pointMM: [0, 0, 0] }, { ...good, metric: 'arc-length' },
    { ...good, space: 'native-authored' }, { ...good, certification: 'certified' },
    { ...good, distanceMM: -1 }, { ...good, distanceMM: Infinity },
    { ...good, first: { ...good.first, assemblyPointMM: [0, 0, 0] } },
    { ...good, first: { ...good.first, assemblyId: 'other' } },
    { ...good, second: { ...good.second, assemblyRevision: 1 } },
    { ...good, first: { ...good.first, reference: { ...good.first.reference, worldMatrix: [] } } },
    { ...good, first: { ...good.first, reference: { ...good.first.reference, sourceVersion: 1 } } },
    { ...good, first: { ...good.first, query: { kind: 'curve', parameter: NaN } } },
    { ...good, first: { ...good.first, query: { kind: 'surface', u: .5, v: .5 } } },
  ];
  for (const value of invalid) {
    await assert.rejects(create(value));
    const file = await create(good); file.assemblyMeasurement = value;
    await assert.rejects(readReviewFile(JSON.stringify(file), source()));
  }
  let calls = 0;
  const accessed = assemblyMeasurement();
  Object.defineProperty(accessed.first, 'reference', { enumerable: true, get() { calls++; throw Error('getter'); } });
  await assert.rejects(create(accessed), /must be data/);
  assert.equal(calls, 0);
});

test('assembly measurement is included in the UTF-8 size limit', async () => {
  const good = assemblyMeasurement(), huge = assemblyMeasurement();
  huge.first.instanceId = '한'.repeat(12000);
  await assert.rejects(create(huge), /32 KiB/);
  const file = await create(good); file.assemblyMeasurement = huge;
  const text = JSON.stringify(file);
  assert.ok(text.length < REVIEW_FILE_LIMIT);
  assert.ok(new TextEncoder().encode(text).length > REVIEW_FILE_LIMIT);
  await assert.rejects(readReviewFile(text, source()), /32 KiB/);
});
