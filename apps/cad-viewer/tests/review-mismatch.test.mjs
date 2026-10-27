import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewFile, readReviewFile, ReviewSourceMismatchError } from '../review-file.js';

const source = () => ({ schema: 'barocss-cad-document', documentId: 'part', revision: 4,
  assets: [{ id: 'asset', revision: 2, source: 'original native geometry' }] });
const review = () => ({ schema: 'barocss-viewer-review', version: 1,
  scene: { kind: 'document', id: 'part', revision: 4, mmToSceneUnit: 0.15, members: ['body'] },
  camera: { eye: [1, 2, 3], target: [0, 0, 0], up: [0, 1, 0], fovY: 45, near: 0.1, far: 100 },
  visibleGeometry: [], selectedGeometry: null });
const makeText = async () => JSON.stringify(await createReviewFile(review(), null, source()));

test('a valid matching source round trips; changed content reports a source hash mismatch', async () => {
  const text = await makeText(), original = source();
  const before = structuredClone(original), result = await readReviewFile(text, original);
  assert.equal(result.legacy, false);
  assert.deepEqual(result.candidate.review, review());
  assert.deepEqual(original, before);

  const changed = source(); changed.assets[0].source += ' changed';
  const changedBefore = structuredClone(changed);
  await assert.rejects(readReviewFile(text, changed), error => {
    assert.ok(error instanceof RangeError);
    assert.ok(error instanceof ReviewSourceMismatchError);
    assert.equal(error.code, 'SOURCE_HASH_MISMATCH');
    assert.match(error.message, /source differs from the loaded CAD source/);
    return true;
  });
  assert.deepEqual(changed, changedBefore);
  assert.equal((await readReviewFile(text, original)).legacy, false);
});

test('a known document versus assembly kind mismatch is classified before hashing', async () => {
  const text = await makeText();
  const other = { schema: 'barocss-cad-assembly', documentId: 'part', revision: 4 };
  const before = structuredClone(other);
  await assert.rejects(readReviewFile(text, other), error => {
    assert.ok(error instanceof ReviewSourceMismatchError);
    assert.equal(error.code, 'SOURCE_KIND_MISMATCH');
    assert.match(error.message, /scene kind differs from the loaded CAD source/);
    return true;
  });
  assert.deepEqual(other, before);
});

test('invalid source data and malformed review files are not classified as source mismatches', async () => {
  const text = await makeText();
  const assertInvalid = promise => assert.rejects(promise, error => {
    assert.ok(error instanceof RangeError);
    assert.ok(!(error instanceof ReviewSourceMismatchError));
    assert.equal(error.code, undefined);
    return true;
  });
  await assertInvalid(readReviewFile(text, null));
  const nonFinite = source(); nonFinite.revision = NaN;
  await assertInvalid(readReviewFile(text, nonFinite));
  const cyclic = source(); cyclic.self = cyclic;
  await assertInvalid(readReviewFile(text, cyclic));
  let calls = 0;
  const accessor = source();
  Object.defineProperty(accessor.assets[0], 'source', { enumerable: true, get() { calls++; return 'bad'; } });
  await assertInvalid(readReviewFile(text, accessor));
  assert.equal(calls, 0);
  await assertInvalid(readReviewFile('{invalid JSON', source()));
  const malformed = JSON.parse(text); malformed.sourceSHA256 = 'invalid';
  await assertInvalid(readReviewFile(JSON.stringify(malformed), source()));
});
