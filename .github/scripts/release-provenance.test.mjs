import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyCandidateAncestry, verifyPromotion } from './release-provenance.mjs';

const candidate = 'a'.repeat(40);
const main = 'b'.repeat(40);
const previous = 'c'.repeat(40);
const version = '0.0.4';
const pr = {
  merged_at: '2026-09-23T00:00:00Z',
  merge_commit_sha: main,
  base: { ref: 'main' },
  head: { ref: `release/promote-${version}-${candidate.slice(0, 12)}`, sha: candidate },
  body: `<!-- barocss-promotion sha=${candidate} version=${version} -->`,
};

test('release source is the approved second parent of the exact main merge', () => {
  assert.equal(verifyPromotion(pr, main, version, [previous, candidate]), candidate);
});

test('changed promotion ref or main merge cannot publish', () => {
  assert.throws(
    () => verifyPromotion({ ...pr, head: { ...pr.head, sha: previous } }, main, version, [previous, candidate]),
    /Promotion branch changed/,
  );
  assert.throws(() => verifyPromotion(pr, main, version, [previous, previous]), /second parent/);
  assert.throws(() => verifyPromotion(pr, previous, version, [previous, candidate]));
});

test('strict main protection rejects a candidate behind main', () => {
  assert.doesNotThrow(() => verifyCandidateAncestry({ ahead_by: 3, behind_by: 0 }));
  assert.throws(() => verifyCandidateAncestry({ ahead_by: 8, behind_by: 1 }), /behind main/);
  assert.throws(() => verifyCandidateAncestry({ ahead_by: 0, behind_by: 0 }), /new commit/);
});
