import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createReviewFile, readReviewFile, ReviewSourceMismatchError, REVIEW_FILE_LIMIT } from '../review-file.js';

// Codec-only synthetic origin based on an existing CAD document fixture. This does not test IGES import.
const original = JSON.parse(await readFile(new URL(
  '../../../packages/barocss-cad-interop/examples/document-gpu-v2.cad-document.json', import.meta.url), 'utf8'));
function source() {
  const value = structuredClone(original);
  value.assets = value.assets.slice(0, 1);
  value.bodies = value.bodies.filter(body => body.assetId === value.assets[0].id);
  return value;
}
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const origin = () => ({ format: 'iges-5.3-126-128', sourceSHA256: digest(Buffer.from('synthetic original bytes')),
  mappings: source().bodies.map((body, index) => ({ directoryPointer: 2 * index + 1,
    nativeId: body.geometryId, bodyId: body.id })) });
const review = () => ({ schema: 'barocss-viewer-review', version: 1,
  scene: { kind: 'document', id: original.documentId, revision: original.revision, mmToSceneUnit: .15, members: ['body'] },
  camera: { eye: [3, 2, 6], target: [0, 0, 0], up: [0, 1, 0], fovY: 45, near: .01, far: 100 },
  visibleGeometry: [], selectedGeometry: null });
const create = (doc = source(), pin = origin(), view = review()) =>
  createReviewFile(view, null, doc, undefined, undefined, undefined, pin);
const mismatch = error => error instanceof ReviewSourceMismatchError && error.code === 'SOURCE_ORIGIN_MISMATCH';

test('IGES origin round trips independently of the generated CAD source hash', async () => {
  const doc = source(), pin = origin(), pending = create(doc, pin);
  pin.mappings[0].nativeId = 'changed'; pin.sourceSHA256 = '0'.repeat(64);
  doc.assets[0].source += ' changed';
  const file = await pending;
  assert.deepEqual(file.origin, origin());
  assert.equal(file.sourceSHA256, digest(Buffer.from(JSON.stringify(source()))));
  const text = JSON.stringify(file), restored = await readReviewFile(text, source(), origin());
  assert.equal(restored.legacy, false); assert.equal(restored.candidate.measurement, null);
  assert.ok(!text.includes('synthetic original bytes') && !text.includes('@model') && !text.includes('directoryPath'));
  file.origin.mappings[0].bodyId = 'changed';
  assert.deepEqual((await readReviewFile(text, source(), origin())).candidate.review, review());
  const readingOrigin = origin(), pendingRead = readReviewFile(text, source(), readingOrigin);
  readingOrigin.mappings[0].bodyId = 'changed_after_read';
  assert.equal((await pendingRead).legacy, false);
});

test('same generated geometry with different original bytes or mappings refuses', async () => {
  const text = JSON.stringify(await create());
  const changedRaw = origin(); changedRaw.sourceSHA256 = digest(Buffer.from('different original bytes'));
  await assert.rejects(readReviewFile(text, source(), changedRaw), mismatch);
  const changedMapping = origin(); changedMapping.mappings[0].bodyId = 'other_body';
  await assert.rejects(readReviewFile(text, source(), changedMapping), mismatch);
  const changedGenerated = source(); changedGenerated.assets[0].source += '\nchanged';
  await assert.rejects(readReviewFile(text, changedGenerated, origin()), /source differs/);
  const mismapped = source(); mismapped.bodies[0].geometryId = 'other_geometry';
  await assert.rejects(create(mismapped, origin()), /mapping differs/);
  await assert.rejects(readReviewFile(text, mismapped, origin()), /mapping differs/);
});

test('origin is mandatory for IGES contexts and forbidden for ordinary CAD and legacy reviews', async () => {
  const doc = source(), view = review(), existing = await createReviewFile(view, null, doc);
  await assert.rejects(readReviewFile(JSON.stringify(existing), doc, origin()), mismatch);
  await assert.rejects(readReviewFile(JSON.stringify(view), doc, origin()), mismatch);
  const imported = await create();
  await assert.rejects(readReviewFile(JSON.stringify(imported), doc), mismatch);
  assert.equal((await readReviewFile(JSON.stringify(existing), doc)).legacy, false);
  assert.equal((await readReviewFile(JSON.stringify(view), doc)).legacy, true);
  const assembly = review(); assembly.scene.kind = 'assembly';
  await assert.rejects(createReviewFile(assembly, null, doc, undefined, undefined, undefined, origin()), /document review/);
});

test('strict origin data rejects malformed mappings, hidden data and accessors', async () => {
  const good = origin();
  const bad = [null, { ...good, path: '/tmp/file.igs' }, { ...good, format: 'step' },
    { ...good, sourceSHA256: 'A'.repeat(64) }, { ...good, mappings: [] },
    { ...good, mappings: [good.mappings[1], good.mappings[0]] },
    { ...good, mappings: [{ ...good.mappings[0], extra: true }] },
    { ...good, mappings: [{ ...good.mappings[0], nativeId: 'bad/id' }] },
    { ...good, mappings: good.mappings.map((row, index) => index === 1 ? { ...row, bodyId: good.mappings[0].bodyId } : row) },
    { ...good, mappings: new Array(1) }];
  for (const pin of bad) await assert.rejects(create(source(), pin));
  let calls = 0;
  const getter = origin(); Object.defineProperty(getter.mappings[0], 'nativeId', { enumerable: true,
    get() { calls++; throw new Error('getter'); } });
  await assert.rejects(create(source(), getter), /must be data/); assert.equal(calls, 0);
});

test('origin is counted in the complete UTF-8 review size limit', async () => {
  const view = review(); view.scene.members = ['한'.repeat(11000)];
  await assert.rejects(create(source(), origin(), view), /32 KiB/);
  const file = await create(); file.review.scene.members = ['한'.repeat(11000)];
  const text = JSON.stringify(file);
  assert.ok(text.length < REVIEW_FILE_LIMIT);
  assert.ok(new TextEncoder().encode(text).length > REVIEW_FILE_LIMIT);
  await assert.rejects(readReviewFile(text, source(), origin()), /32 KiB/);
});
