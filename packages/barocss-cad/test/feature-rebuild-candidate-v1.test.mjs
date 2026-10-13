import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareBooleanExtrusionRebuildV1 } from '../dist/feature-rebuild-candidate-v1.js';

// Explicit refusal controls; a full native fixture test remains a separate gate.
test('transactional rebuild candidate refuses invalid or absent owned state', () => {
  const edits = { expectedRevision: 0, revision: 1, parameterEdits: [], faceEdits: [], booleanEdits: [], distanceEdits: [] };
  assert.throws(() => prepareBooleanExtrusionRebuildV1(null, edits));
  assert.throws(() => prepareBooleanExtrusionRebuildV1({}, edits));
  assert.throws(() => prepareBooleanExtrusionRebuildV1({ report: { revision: 0 } }, edits));
});


test('transactional candidate refuses accessor edits without invoking caller code', () => {
  let reads = 0;
  const hostile = { expectedRevision: 0, revision: 1, parameterEdits: [], faceEdits: [], booleanEdits: [] };
  Object.defineProperty(hostile, 'distanceEdits', { enumerable: true, get() { reads++; return []; } });
  assert.throws(() => prepareBooleanExtrusionRebuildV1({}, hostile), /Own edit values required/);
  assert.equal(reads, 0);
});

test('transactional candidate refuses cyclic and sparse edit inputs before native execution', () => {
  const cyclic = { expectedRevision: 0, revision: 1, parameterEdits: [], faceEdits: [], booleanEdits: [], distanceEdits: [] };
  cyclic.faceEdits.push(cyclic);
  assert.throws(() => prepareBooleanExtrusionRebuildV1({}, cyclic), /Cyclic edit snapshot refused/);
  const sparse = { expectedRevision: 0, revision: 1, parameterEdits: new Array(1), faceEdits: [], booleanEdits: [], distanceEdits: [] };
  assert.throws(() => prepareBooleanExtrusionRebuildV1({}, sparse), /Sparse edit array refused/);
});
