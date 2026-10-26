import test from 'node:test';
import assert from 'node:assert/strict';
import { addNamedReview, renameNamedReview, removeNamedReview, getNamedReview, namedReviewCandidate } from '../named-reviews.js';

const scene = { kind: 'document', id: 'part', revision: 1, mmToSceneUnit: .15, members: ['original-body-pin'] };
const entry = name => ({ name, review: { schema: 'barocss-viewer-review', version: 1, scene: structuredClone(scene),
  camera: { eye: [0, 0, 3], target: [0, 0, 0], up: [0, 1, 0], fovY: 45, near: .01, far: 100 },
  visibleGeometry: [{ kind: 'surface', modelId: 'asset.a', surfaceId: 'surface' }], selectedGeometry: null },
measurement: null, lighting: null });

test('named view lifecycle preserves snapshots and separates list edits from display restore', () => {
  const first = entry('Front'), original = structuredClone(first);
  const one = addNamedReview([], first, scene);
  first.review.camera.eye[0] = 99;
  assert.deepEqual(one, [original]);
  const two = addNamedReview(one, entry('Detail'), scene);
  const renamed = renameNamedReview(two, 'Detail', 'Detail A', scene);
  assert.deepEqual(two.map(value => value.name), ['Front', 'Detail']);
  assert.deepEqual(renamed.map(value => value.name), ['Front', 'Detail A']);
  const selected = getNamedReview(renamed, 'Front', scene);
  assert.deepEqual(namedReviewCandidate(selected), { schema: 'barocss-viewer-measured-review', version: 1,
    review: original.review, measurement: null, lighting: null });
  selected.review.camera.eye[0] = 50;
  assert.deepEqual(getNamedReview(renamed, 'Front', scene), original);
  const remaining = removeNamedReview(renamed, 'Detail A', scene);
  assert.deepEqual(renamed.map(value => value.name), ['Front', 'Detail A']);
  assert.deepEqual(remaining, [original]);
  assert.deepEqual(removeNamedReview(remaining, 'Front', scene), []);
});

test('failed list edits and stale scene context preserve every accepted entry', () => {
  const accepted = [entry('Front'), entry('Detail')], before = structuredClone(accepted);
  for (const action of [
    () => addNamedReview(accepted, entry('Front'), scene),
    () => renameNamedReview(accepted, 'Front', 'Detail', scene),
    () => renameNamedReview(accepted, 'missing', 'New', scene),
    () => removeNamedReview(accepted, 'missing', scene),
    () => getNamedReview(accepted, 'missing', scene),
    () => getNamedReview(accepted, 'Front', { ...scene, revision: 2 }),
    () => renameNamedReview(accepted, 'Front', ' ', scene),
  ]) { assert.throws(action); assert.deepEqual(accepted, before); }
});
