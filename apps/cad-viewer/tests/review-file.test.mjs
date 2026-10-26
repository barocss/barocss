import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReviewFile, readReviewFile, REVIEW_FILE_LIMIT } from '../review-file.js';

const source = () => ({ schema: 'original-document', documentId: 'bracket', revision: 3,
  units: { length: 'mm', angle: 'rad' }, assets: [{ id: 'asset_a', revision: 7,
    source: '@cad #original { native source text }' }], bodies: [{ id: 'body_a', assetId: 'asset_a' }] });
const review = () => ({ schema: 'barocss-viewer-review', version: 1,
  scene: { kind: 'document', id: 'bracket', revision: 3, mmToSceneUnit: 0.15,
    members: ['{"bodyId":"body_a","assetId":"asset_a","assetRevision":7}'] },
  camera: { eye: [3, 2, 6], target: [0, 0, 0], up: [0, 1, 0], fovY: 45, near: 0.01, far: 100 },
  visibleGeometry: [{ kind: 'surface', modelId: 'asset_a_r7', surfaceId: 'patch' },
    { kind: 'curve', modelId: 'asset_a_r7', curveId: 'guide' }],
  selectedGeometry: { kind: 'curve', modelId: 'asset_a_r7', curveId: 'guide' } });
const measurement = () => ({ first: { kind: 'surface', modelId: 'asset_a_r7', surfaceId: 'patch', u: 0.125, v: 0.8 },
  second: { kind: 'curve', modelId: 'asset_a_r7', curveId: 'guide', t: 0.375 },
  distanceMM: 0.12345678901234566, metric: 'straight-line', space: 'native-authored', certification: 'not-certified' });
const makeFile = () => createReviewFile(review(), measurement(), source());

test('JSON file round trip retains native parameters, full distance and exact source hash', async () => {
  const file = await makeFile();
  assert.equal(file.sourceSHA256, createHash('sha256').update(JSON.stringify(source())).digest('hex'));
  assert.deepEqual(Object.keys(file), ['schema', 'version', 'sourceSHA256', 'review', 'measurement']);
  const text = JSON.stringify(file), restored = await readReviewFile(text, source());
  assert.equal(restored.legacy, false);
  assert.deepEqual(restored.candidate, { schema: 'barocss-viewer-measured-review', version: 1,
    review: review(), measurement: measurement() });
  assert.equal(restored.candidate.measurement.distanceMM, 0.12345678901234566);
  assert.ok(!text.includes('@cad') && !text.includes('pointMM') && !text.includes('parameterLabel'));
  file.review.camera.eye[0] = 200; file.measurement.first.u = 0.9;
  assert.equal(restored.candidate.review.camera.eye[0], 3);
  assert.equal(restored.candidate.measurement.first.u, 0.125);
});

test('changed source text with unchanged identity and revisions is refused', async () => {
  const file = await makeFile(), other = source();
  other.assets[0].source += ' changed';
  await assert.rejects(readReviewFile(JSON.stringify(file), other), /source differs/);
  const changedUnits = source(); changedUnits.units.length = 'm';
  await assert.rejects(readReviewFile(JSON.stringify(file), changedUnits), /source differs/);
});

test('capture copies source, camera and parameters before the hash await', async () => {
  const view = review(), measured = measurement(), document = source();
  const pending = createReviewFile(view, measured, document);
  view.camera.eye[0] = 200; measured.first.u = 0.9; document.assets[0].source += ' mutated';
  const file = await pending;
  assert.deepEqual(file.review, review()); assert.deepEqual(file.measurement, measurement());
  await assert.doesNotReject(readReviewFile(JSON.stringify(file), source()));
  await assert.rejects(readReviewFile(JSON.stringify(file), document), /source differs/);
});

test('read source is copied before the hash await', async () => {
  const text = JSON.stringify(await makeFile()), document = source();
  const pending = readReviewFile(text, document);
  document.assets[0].source += ' changed after read';
  assert.equal((await pending).legacy, false);
});

test('view-only new files and legacy files produce a null measurement', async () => {
  const file = await createReviewFile(review(), null, source());
  assert.equal((await readReviewFile(JSON.stringify(file), source())).candidate.measurement, null);
  const legacy = await readReviewFile(JSON.stringify(review()), source());
  assert.equal(legacy.legacy, true); assert.equal(legacy.candidate.measurement, null);
  assert.deepEqual(legacy.candidate.review, review());
  assert.equal(Object.hasOwn(legacy.candidate, 'sourceSHA256'), false);
});

test('unknown top, review, native input and measurement fields are refused', async () => {
  const file = await makeFile();
  const bad = [
    { ...file, geometry: 'source text' }, { ...file, schema: 'other-review' }, { ...file, version: 2 },
    { ...file, sourceSHA256: 'A'.repeat(64) }, { ...file, measurement: { ...file.measurement, pointMM: [0, 0, 0] } },
    { ...file, measurement: { ...file.measurement, first: { ...file.measurement.first, pointMM: [0, 0, 0] } } },
    { ...file, review: { ...file.review, surfaceMaterials: [] } },
    { ...file, review: { ...file.review, camera: { ...file.review.camera, shader: 'text' } } },
    { ...review(), sourceSHA256: file.sourceSHA256 },
  ];
  for (const candidate of bad) await assert.rejects(readReviewFile(JSON.stringify(candidate), source()));
});

test('measurement metadata, non-finite values and omitted native parameters are refused', async () => {
  for (const measured of [
    { ...measurement(), metric: 'arc-length' }, { ...measurement(), space: 'screen-pixels' },
    { ...measurement(), certification: 'certified' }, { ...measurement(), distanceMM: -1 },
    { ...measurement(), distanceMM: Infinity }, { ...measurement(), distanceMM: NaN },
    { ...measurement(), first: { ...measurement().first, u: Infinity } },
    { ...measurement(), second: { ...measurement().second, t: undefined } },
  ]) await assert.rejects(createReviewFile(review(), measured, source()));
  const invalidCamera = review(); invalidCamera.camera.eye[0] = NaN;
  await assert.rejects(createReviewFile(invalidCamera, measurement(), source()));
});

test('getter-shaped inputs are refused without calling any getter', async () => {
  let calls = 0;
  const getter = { enumerable: true, get() { calls++; throw new Error('getter was invoked'); } };
  const measured = measurement(); Object.defineProperty(measured, 'first', getter);
  await assert.rejects(createReviewFile(review(), measured, source()), /must be data/);
  const kind = measurement(); Object.defineProperty(kind.first, 'kind', getter);
  await assert.rejects(createReviewFile(review(), kind, source()), /must be surface or curve data/);
  const view = review(); Object.defineProperty(view.camera.eye, '0', getter);
  await assert.rejects(createReviewFile(view, measurement(), source()), /must be data/);
  const document = source(); Object.defineProperty(document.assets[0], 'source', getter);
  await assert.rejects(createReviewFile(review(), measurement(), document), /must be data/);
  assert.equal(calls, 0);
});

test('non-plain data, sparse arrays, symbol fields and source serialization hooks refuse', async () => {
  const view = review(); view.camera.eye = new Array(3);
  await assert.rejects(createReviewFile(view, null, source()), /dense plain array/);
  const nonPlain = Object.assign(Object.create(null), measurement());
  await assert.rejects(createReviewFile(review(), nonPlain, source()), /own plain data/);
  const symbol = measurement(); symbol[Symbol('extra')] = true;
  await assert.rejects(createReviewFile(review(), symbol, source()), /unsupported fields/);
  let calls = 0;
  const document = source(); document.toJSON = () => { calls++; return {}; };
  await assert.rejects(createReviewFile(review(), null, document), /finite JSON data/);
  assert.equal(calls, 0);
  const cyclic = source(); cyclic.self = cyclic;
  await assert.rejects(createReviewFile(review(), null, cyclic), /finite JSON data/);
});

test('32 KiB limit counts UTF-8 bytes on read and serialized output on save', async () => {
  const file = await makeFile();
  file.review.scene.members = ['한'.repeat(12000)];
  const text = JSON.stringify(file);
  assert.ok(text.length < REVIEW_FILE_LIMIT);
  assert.ok(new TextEncoder().encode(text).length > REVIEW_FILE_LIMIT);
  await assert.rejects(readReviewFile(text, source()), /32 KiB/);
  const oversized = review(); oversized.scene.members = ['x'.repeat(REVIEW_FILE_LIMIT)];
  await assert.rejects(createReviewFile(oversized, null, source()), /32 KiB/);
  await assert.rejects(readReviewFile(' '.repeat(REVIEW_FILE_LIMIT + 1), source()), /32 KiB/);
  await assert.rejects(readReviewFile('{broken', source()), /not valid JSON/);
});
