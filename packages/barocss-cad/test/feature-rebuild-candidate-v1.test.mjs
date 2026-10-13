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
