import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createReviewFile, readReviewFile, copyNamedViews, REVIEW_FILE_LIMIT } from '../review-file.js';

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

test('assembly review files bind complete authored source and occurrence review', async t => {
  // This exercises the app file boundary only. SDK admission remains authoritative for the scene.
  const original = JSON.parse(await readFile(new URL(
    '../../../examples/gpu-scene/fixtures/assembly-revision0.json', import.meta.url), 'utf8'));
  const assemblySource = () => structuredClone(original);
  const ids = ['child', 'shared_root', 'surface_grandchild'];
  const instance = id => original.instances.find(value => value.id === id);
  const refs = ids.map(id => {
    const reference = instance(id).reference;
    const modelId = 'assembly.' + Array.from(id, character =>
      character.charCodeAt(0).toString(16).padStart(2, '0')).join('');
    return reference.geometryKind === 'surface'
      ? { kind: 'surface', modelId, surfaceId: reference.geometryId }
      : { kind: 'curve', modelId, curveId: reference.geometryId };
  });
  const assemblyReview = () => ({ ...review(),
    scene: { kind: 'assembly', id: original.assemblyId, revision: original.revision, mmToSceneUnit: 0.15,
      members: ids.map(id => JSON.stringify([id, instance(id).reference])) },
    visibleGeometry: structuredClone(refs), selectedGeometry: structuredClone(refs[1]) });
  const makeAssemblyFile = () => createReviewFile(assemblyReview(), null, assemblySource(), lighting());

  await t.test('round trip preserves occurrence identity, camera, visibility, selection and lighting', async () => {
    const file = await makeAssemblyFile();
    assert.deepEqual(Object.keys(file), ['schema', 'version', 'sourceSHA256', 'review', 'measurement', 'lighting']);
    assert.equal(file.sourceSHA256, createHash('sha256').update(JSON.stringify(original)).digest('hex'));
    const text = JSON.stringify(file), restored = await readReviewFile(text, assemblySource());
    assert.equal(restored.legacy, false);
    assert.deepEqual(restored.candidate, { schema: 'barocss-viewer-measured-review', version: 1,
      review: assemblyReview(), measurement: null, lighting: lighting() });
    assert.notEqual(restored.candidate.review.visibleGeometry[0].modelId,
      restored.candidate.review.visibleGeometry[1].modelId);
    assert.equal(restored.candidate.review.visibleGeometry[0].curveId,
      restored.candidate.review.visibleGeometry[1].curveId);
    assert.ok(!text.includes('@model') && !text.includes('worldMatrix') && !text.includes('translationMM'));
    file.review.scene.members.reverse(); file.review.camera.eye[0] = 100;
    file.review.visibleGeometry[0].modelId = 'changed'; file.lighting.direction[0] = 5;
    assert.deepEqual(restored.candidate.review, assemblyReview());
    assert.deepEqual(restored.candidate.lighting, lighting());
  });

  await t.test('same revisions with altered placement, hierarchy, part source or reference are refused', async () => {
    const text = JSON.stringify(await makeAssemblyFile());
    for (const change of [
      value => { value.instances[0].placement.translationMM[0] += 1; },
      value => { value.instances[0].placement.rotationDegreesXYZ[2] = 45; },
      value => { value.instances[0].parentId = null; },
      value => { value.parts[0].assets[0].source += '\nchanged original source'; },
      value => { value.instances[0].reference.assetRevision += 1; },
      value => { value.instances.reverse(); },
    ]) {
      const changed = assemblySource(); change(changed);
      await assert.rejects(readReviewFile(text, changed), /source differs/);
    }
  });

  await t.test('write and read capture the complete assembly before the hash await', async () => {
    const document = assemblySource(), view = assemblyReview();
    const pending = createReviewFile(view, null, document);
    document.parts[0].assets[0].source += ' changed after save';
    document.instances[0].placement.translationMM[0] += 1;
    view.scene.members.reverse(); view.camera.eye[0] = 99;
    const file = await pending, text = JSON.stringify(file);
    assert.deepEqual(file.review, assemblyReview());
    await assert.doesNotReject(readReviewFile(text, assemblySource()));
    await assert.rejects(readReviewFile(text, document), /source differs/);
    const readSource = assemblySource(), reading = readReviewFile(text, readSource);
    readSource.instances[0].placement.translationMM[0] += 1;
    assert.deepEqual((await reading).candidate.review, assemblyReview());
  });

  await t.test('known source schemas must match the review scene kind', async () => {
    await assert.rejects(createReviewFile(review(), null, assemblySource()), /scene kind differs/);
    const document = source(); document.schema = 'barocss-cad-document';
    await assert.rejects(createReviewFile(assemblyReview(), null, document), /scene kind differs/);
    const file = await makeAssemblyFile();
    file.review.scene.kind = 'document';
    await assert.rejects(readReviewFile(JSON.stringify(file), assemblySource()), /scene kind differs/);
    // The existing generic finite JSON source contract is retained for older host fixtures.
    await assert.doesNotReject(createReviewFile(review(), null, source()));
  });

  await t.test('assembly measurement must be null on save and read', async () => {
    await assert.rejects(createReviewFile(assemblyReview(), measurement(), assemblySource()),
      /measurement reviews are unavailable for assemblies/);
    const file = await makeAssemblyFile(); file.measurement = measurement();
    await assert.rejects(readReviewFile(JSON.stringify(file), assemblySource()),
      /measurement reviews are unavailable for assemblies/);
  });

  await t.test('source hash remains mandatory while raw SDK assembly reviews remain compatible', async () => {
    const file = await makeAssemblyFile(), unbound = { ...file }; delete unbound.sourceSHA256;
    await assert.rejects(readReviewFile(JSON.stringify(unbound), assemblySource()), /missing or unsupported fields/);
    await assert.rejects(readReviewFile(JSON.stringify({ ...file, sourceSHA256: '0'.repeat(64) }), assemblySource()),
      /source differs/);
    const old = await createReviewFile(assemblyReview(), null, assemblySource());
    assert.equal(Object.hasOwn(old, 'lighting'), false);
    assert.equal(Object.hasOwn((await readReviewFile(JSON.stringify(old), assemblySource())).candidate, 'lighting'), false);
    const legacy = await readReviewFile(JSON.stringify(assemblyReview()), assemblySource());
    assert.equal(legacy.legacy, true); assert.equal(legacy.candidate.measurement, null);
    assert.equal(Object.hasOwn(legacy.candidate, 'lighting'), false);
    assert.deepEqual(legacy.candidate.review, assemblyReview());
  });

  await t.test('nested source accessors are refused without execution', async () => {
    let calls = 0;
    const document = assemblySource();
    Object.defineProperty(document.instances[0].placement.translationMM, '0', {
      enumerable: true, get() { calls++; throw new Error('placement getter'); } });
    await assert.rejects(createReviewFile(assemblyReview(), null, document), /must be data/);
    assert.equal(calls, 0);
  });
});

test('named review files', async t => {
  const named = (name = 'Detail') => ({ name, review: review(), measurement: measurement(), lighting: lighting() });
  const makeNamedFile = () => createReviewFile(review(), measurement(), source(), lighting(), [named()]);

  await t.test('round trip retains each review, measurement and optional lighting', async () => {
    const detail = named(), overview = { name: 'Overview', review: review(), measurement: null };
    overview.review.camera.eye = [8, 5, 9]; overview.review.selectedGeometry = null;
    const reset = { name: 'Default light', review: review(), measurement: null, lighting: null };
    const entries = [detail, overview, reset];
    const file = await createReviewFile(review(), measurement(), source(), lighting(), entries);
    assert.deepEqual(Object.keys(file), ['schema', 'version', 'sourceSHA256', 'review', 'measurement', 'lighting', 'namedViews']);
    assert.equal(file.sourceSHA256, (await makeFile()).sourceSHA256);
    const text = JSON.stringify(file), restored = await readReviewFile(text, source());
    assert.deepEqual(restored.namedViews, entries);
    assert.deepEqual(restored.candidate, { schema: 'barocss-viewer-measured-review', version: 1,
      review: review(), measurement: measurement(), lighting: lighting() });
    assert.equal(Object.hasOwn(restored.namedViews[1], 'lighting'), false);
    assert.equal(restored.namedViews[2].lighting, null);
    assert.ok(!text.includes('@cad') && !text.includes('pointMM'));
  });

  await t.test('absent lists preserve omission and explicit empty lists remain present', async () => {
    for (const text of [JSON.stringify(await makeFile()), JSON.stringify(review()),
      JSON.stringify(await createReviewFile(review(), null, source(), lighting(), undefined))]) {
      assert.equal(Object.hasOwn(await readReviewFile(text, source()), 'namedViews'), false);
    }
    const file = await createReviewFile(review(), null, source(), undefined, []);
    assert.equal(Object.hasOwn(file, 'lighting'), false);
    assert.deepEqual(file.namedViews, []);
    const restored = await readReviewFile(JSON.stringify(file), source());
    assert.equal(Object.hasOwn(restored, 'namedViews'), true);
    assert.deepEqual(restored.namedViews, []);
    await assert.rejects(readReviewFile(JSON.stringify({ ...review(), namedViews: [] }), source()), /unsupported fields/);
  });

  await t.test('capture detaches all named fields before hashing and does not share output references', async () => {
    const document = source(), entry = named(), entries = [entry, { ...entry, name: 'Second' }];
    const pending = createReviewFile(review(), measurement(), document, lighting(), entries);
    entry.name = 'Changed'; entry.review.camera.eye[0] = 100;
    entry.review.scene.members[0] = 'changed'; entry.review.visibleGeometry[0].modelId = 'changed';
    entry.measurement.first.u = 0.9; entry.lighting.direction[0] = 5;
    entries.push(named('Third')); document.assets[0].source += ' changed';
    const file = await pending;
    assert.deepEqual(file.namedViews, [named(), named('Second')]);
    const text = JSON.stringify(file), restored = await readReviewFile(text, source());
    restored.namedViews[0].review.camera.eye[0] = 42;
    restored.namedViews[0].measurement.first.u = 0.5;
    restored.namedViews[0].lighting.direction[0] = -100;
    assert.deepEqual(restored.namedViews[1], named('Second'));
    assert.deepEqual(restored.candidate.review, review());
    assert.deepEqual(restored.candidate.measurement, measurement());
    assert.deepEqual(restored.candidate.lighting, lighting());
    assert.deepEqual(file.namedViews[0], named());
    assert.deepEqual((await readReviewFile(text, source())).namedViews[0], named());
    await assert.rejects(readReviewFile(text, document), /source differs/);
  });

  await t.test('names use the exact trimmed UTF-16 limit and case-sensitive uniqueness', async () => {
    const entries = [named('a'.repeat(64)), named('Detail'), named('detail'), named('😀'.repeat(32))];
    assert.deepEqual(copyNamedViews(entries, review().scene), entries);
    const eight = Array.from({ length: 8 }, (_, index) => named(`View ${index}`));
    assert.equal(copyNamedViews(eight, review().scene).length, 8);
    const base = await makeFile();
    for (const entries of [null, {}, new Array(1), [...eight, named('Ninth')], [named(), named()],
      ...['', ' ', ' Leading', 'Trailing ', 'a'.repeat(65), '😀'.repeat(33), 'Line\nbreak', 'nul\0',
        'delete\x7f', 'c1\x85', 'c1\x9f', 12].map(name => [named(name)])]) {
      assert.throws(() => copyNamedViews(entries, review().scene));
      await assert.rejects(createReviewFile(review(), null, source(), undefined, entries));
      await assert.rejects(readReviewFile(JSON.stringify({ ...base, namedViews: entries }), source()));
    }
  });

  await t.test('every entry requires the same complete ordered scene pins', async () => {
    const current = review(); current.scene.members = ['member_a', 'member_b'];
    const valid = named(); valid.review = structuredClone(current);
    const file = await createReviewFile(current, null, source(), undefined, [valid]);
    const changes = [
      scene => { scene.kind = 'assembly'; }, scene => { scene.id = 'different'; },
      scene => { scene.revision++; }, scene => { scene.mmToSceneUnit = 0.2; },
      scene => { scene.members.reverse(); }, scene => { scene.members.pop(); },
      scene => { scene.members[0] = 'different'; },
    ];
    for (const change of changes) {
      const stale = structuredClone(valid); change(stale.review.scene);
      assert.throws(() => copyNamedViews([stale], current.scene), /scene differs/);
      await assert.rejects(createReviewFile(current, null, source(), undefined, [stale]), /scene differs/);
      await assert.rejects(readReviewFile(JSON.stringify({ ...file, namedViews: [valid, { ...stale, name: 'Stale' }] }), source()),
        /scene differs/);
    }
  });

  await t.test('unknown or malformed entry fields refuse the whole file', async () => {
    const file = await makeNamedFile(), missing = named(); delete missing.measurement;
    const bad = [null, {}, missing, { ...named(), sourceSHA256: file.sourceSHA256 },
      { ...named(), lighting: undefined }, { ...named(), lighting: { ...lighting(), environment: {} } },
      { ...named(), measurement: { ...measurement(), distanceMM: -1 } },
      { ...named(), measurement: { ...measurement(), pointMM: [0, 0, 0] } },
      { ...named(), review: { ...review(), extra: true } },
      { ...named(), review: { ...review(), camera: { ...review().camera, eye: [0, 1] } } }];
    for (const entry of bad) {
      assert.throws(() => copyNamedViews([entry], review().scene));
      // Explicit undefined disappears from JSON and therefore represents valid lighting omission.
      if (!(entry && Object.hasOwn(entry, 'lighting') && entry.lighting === undefined))
        await assert.rejects(readReviewFile(JSON.stringify({ ...file, namedViews: [named('Valid'), entry] }), source()));
    }
    await assert.rejects(readReviewFile(JSON.stringify({ ...file, unknown: true }), source()), /unsupported fields/);
    await assert.rejects(readReviewFile(JSON.stringify({ ...file, sourceSHA256: '0'.repeat(64) }), source()), /source differs/);
  });

  await t.test('accessors, decorated arrays and non-plain entries refuse without invoking getters', () => {
    let calls = 0;
    const getter = { enumerable: true, get() { calls++; throw Error('getter was invoked'); } };
    const name = named(); Object.defineProperty(name, 'name', getter);
    const light = named(); Object.defineProperty(light, 'lighting', getter);
    const vector = named(); Object.defineProperty(vector.review.camera.eye, '0', getter);
    const symbol = named(); symbol[Symbol('extra')] = true;
    const nonPlain = Object.assign(Object.create(null), named());
    const decorated = [named()]; decorated.extra = true;
    const element = [named()]; Object.defineProperty(element, '0', getter);
    for (const entries of [[name], [light], [vector], [symbol], [nonPlain], decorated, element])
      assert.throws(() => copyNamedViews(entries, review().scene));
    assert.equal(calls, 0);
  });

  await t.test('assembly named views keep occurrence review and reject native measurements', async () => {
    const document = JSON.parse(await readFile(new URL(
      '../../../examples/gpu-scene/fixtures/assembly-revision0.json', import.meta.url), 'utf8'));
    const instance = document.instances.find(value => value.id === 'child');
    const view = review(); view.scene = { kind: 'assembly', id: document.assemblyId,
      revision: document.revision, mmToSceneUnit: 0.15, members: [JSON.stringify(['child', instance.reference])] };
    view.visibleGeometry = [{ kind: 'curve', modelId: 'assembly.6368696c64', curveId: 'shared_curve' }];
    view.selectedGeometry = structuredClone(view.visibleGeometry[0]);
    const entry = { name: 'Occurrence', review: view, measurement: null };
    const file = await createReviewFile(view, null, document, undefined, [entry]);
    assert.deepEqual((await readReviewFile(JSON.stringify(file), document)).namedViews, [entry]);
    const measured = { ...entry, measurement: measurement() };
    assert.throws(() => copyNamedViews([measured], view.scene), /unavailable for assemblies/);
    await assert.rejects(readReviewFile(JSON.stringify({ ...file, namedViews: [measured] }), document),
      /unavailable for assemblies/);
  });

  await t.test('the final compact UTF-8 bound includes every named entry', async () => {
    const view = review(); view.scene.members = ['한'.repeat(1200)];
    const file = await createReviewFile(view, null, source());
    const entries = Array.from({ length: 8 }, (_, index) => ({ name: `View ${index}`, review: view, measurement: null }));
    const text = JSON.stringify({ ...file, namedViews: entries });
    assert.ok(text.length < REVIEW_FILE_LIMIT);
    assert.ok(new TextEncoder().encode(text).length > REVIEW_FILE_LIMIT);
    await assert.rejects(createReviewFile(view, null, source(), undefined, entries), /32 KiB/);
    await assert.rejects(readReviewFile(text, source()), /32 KiB/);
  });
});
