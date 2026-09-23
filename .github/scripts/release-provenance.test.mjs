import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyCandidateAncestry } from './release-provenance.mjs';

test('preflight rejects a develop candidate behind main', () => {
  assert.doesNotThrow(() => verifyCandidateAncestry({ ahead_by: 3, behind_by: 0 }));
  assert.throws(() => verifyCandidateAncestry({ ahead_by: 8, behind_by: 1 }), /behind main/);
  assert.throws(() => verifyCandidateAncestry({ ahead_by: 0, behind_by: 0 }), /new commit/);
});
