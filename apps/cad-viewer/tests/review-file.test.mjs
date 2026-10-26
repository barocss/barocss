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
const lighting = () => ({ ambientStrength: 0.2, directionalStrength: 0.7, direction: [1000, -2, 0.125] });
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

test('old app files, explicit undefined and legacy reviews leave lighting absent', async () => {
  const old = await makeFile();
  const explicit = await createReviewFile(review(), measurement(), source(), undefined);
  assert.deepEqual(explicit, old);
  for (const text of [JSON.stringify(old), JSON.stringify(review())]) {
    const restored = await readReviewFile(text, source());
    assert.equal(Object.hasOwn(restored.candidate, 'lighting'), false);
  }
  await assert.rejects(readReviewFile(JSON.stringify({ ...review(), lighting: lighting() }), source()),
    /unsupported fields/);
});

test('new lighting files round trip exact strengths and authored direction without normalization', async () => {
  const file = await createReviewFile(review(), measurement(), source(), lighting());
  assert.deepEqual(Object.keys(file), ['schema', 'version', 'sourceSHA256', 'review', 'measurement', 'lighting']);
  const restored = await readReviewFile(JSON.stringify(file), source());
  assert.equal(restored.legacy, false);
  assert.deepEqual(restored.candidate, { schema: 'barocss-viewer-measured-review', version: 1,
    review: review(), measurement: measurement(), lighting: lighting() });
  file.lighting.direction[0] = 10; file.lighting.ambientStrength = 0.3;
  assert.deepEqual(restored.candidate.lighting, lighting());
  await assert.rejects(readReviewFile(JSON.stringify({ ...file, environment: 'studio' }), source()),
    /unsupported fields/);
});

test('explicit null lighting remains an own field for startup lighting reset', async () => {
  const file = await createReviewFile(review(), null, source(), null);
  assert.equal(Object.hasOwn(file, 'lighting'), true);
  const restored = await readReviewFile(JSON.stringify(file), source());
  assert.equal(Object.hasOwn(restored.candidate, 'lighting'), true);
  assert.equal(restored.candidate.lighting, null);
  assert.equal(restored.candidate.measurement, null);
});

test('lighting is detached before hashing and keeps the original source hash boundary', async () => {
  const lights = lighting(), document = source();
  const pending = createReviewFile(review(), measurement(), document, lights);
  lights.direction[0] = 5; lights.ambientStrength = 0.3; document.assets[0].source += ' changed';
  const file = await pending;
  assert.deepEqual(file.lighting, lighting());
  assert.equal(file.sourceSHA256, (await makeFile()).sourceSHA256);
  const text = JSON.stringify(file), restored = await readReviewFile(text, source());
  restored.candidate.lighting.direction[0] = 99;
  assert.deepEqual((await readReviewFile(text, source())).candidate.lighting, lighting());
  await assert.rejects(readReviewFile(text, document), /source differs/);
  const unbound = { ...file }; delete unbound.sourceSHA256;
  await assert.rejects(readReviewFile(JSON.stringify(unbound), source()), /missing or unsupported fields/);
  await assert.rejects(readReviewFile(JSON.stringify({ ...file, sourceSHA256: '0'.repeat(64) }), source()),
    /source differs/);
});

test('lighting accepts strength and direction limits without changing direction scale', async () => {
  for (const lights of [
    { ambientStrength: 0, directionalStrength: 0, direction: [1000, -1000, 1000] },
    { ambientStrength: 1, directionalStrength: 0, direction: [1, 0, 0] },
    { ambientStrength: 0, directionalStrength: 1, direction: [0, -1, 0] },
    { ambientStrength: 0.5, directionalStrength: 0.5, direction: [0, 0, Number.MIN_VALUE] },
  ]) {
    const file = await createReviewFile(review(), measurement(), source(), lights);
    assert.deepEqual((await readReviewFile(JSON.stringify(file), source())).candidate.lighting, lights);
  }
});

test('lighting refuses unknown fields, invalid strengths and invalid direction coordinates', async () => {
  const missingDirection = { ambientStrength: 0.2, directionalStrength: 0.7 };
  const bad = [
    {}, [], true, missingDirection, { ...lighting(), intensity: 1 },
    { ...lighting(), ambientStrength: -0.01 }, { ...lighting(), ambientStrength: 1.01 },
    { ...lighting(), directionalStrength: -0.01 }, { ...lighting(), directionalStrength: 1.01 },
    { ...lighting(), ambientStrength: 0.4, directionalStrength: 0.7 },
    { ...lighting(), ambientStrength: true }, { ...lighting(), ambientStrength: NaN },
    { ...lighting(), directionalStrength: Infinity }, { ...lighting(), direction: [0, 0, -0] },
    { ...lighting(), direction: [1000.01, 0, 0] }, { ...lighting(), direction: [0, -1000.01, 0] },
    { ...lighting(), direction: [0, 0, Infinity] }, { ...lighting(), direction: [0, NaN, 1] },
    { ...lighting(), direction: [1, 0] }, { ...lighting(), direction: [1, 0, 0, 0] },
    { ...lighting(), direction: [1, '0', 0] }, { ...lighting(), direction: new Array(3) },
  ];
  const file = await makeFile();
  for (const lights of bad) {
    await assert.rejects(createReviewFile(review(), measurement(), source(), lights));
    await assert.rejects(readReviewFile(JSON.stringify({ ...file, lighting: lights }), source()));
  }
});

test('lighting rejects accessors, non-plain objects and decorated arrays without invoking getters', async () => {
  let calls = 0;
  const getter = { enumerable: true, get() { calls++; throw new Error('getter was invoked'); } };
  const strength = lighting(); Object.defineProperty(strength, 'ambientStrength', getter);
  await assert.rejects(createReviewFile(review(), null, source(), strength), /must be data/);
  const vector = lighting(); Object.defineProperty(vector.direction, '0', getter);
  await assert.rejects(createReviewFile(review(), null, source(), vector), /must be data/);
  const nonPlain = Object.assign(Object.create(null), lighting());
  await assert.rejects(createReviewFile(review(), null, source(), nonPlain), /own plain data/);
  const symbol = lighting(); symbol[Symbol('extra')] = true;
  await assert.rejects(createReviewFile(review(), null, source(), symbol), /unsupported fields/);
  const decorated = lighting(); decorated.direction.extra = true;
  await assert.rejects(createReviewFile(review(), null, source(), decorated), /dense plain array/);
  assert.equal(calls, 0);
});

test('the compact 32 KiB save bound includes optional lighting', async () => {
  const view = review(); view.scene.members = [''];
  const base = await createReviewFile(view, null, source());
  const available = REVIEW_FILE_LIMIT - new TextEncoder().encode(JSON.stringify(base)).length;
  view.scene.members = ['x'.repeat(available)];
  const old = await createReviewFile(view, null, source());
  assert.equal(new TextEncoder().encode(JSON.stringify(old)).length, REVIEW_FILE_LIMIT);
  await assert.doesNotReject(readReviewFile(JSON.stringify(old), source()));
  await assert.rejects(createReviewFile(view, null, source(), lighting()), /32 KiB/);
});
