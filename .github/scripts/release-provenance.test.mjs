import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyMainMerge } from './release-provenance.mjs';

const candidate = 'a'.repeat(40);
const main = 'b'.repeat(40);
const previous = 'c'.repeat(40);
const pr = {
  merged_at: '2026-09-23T00:00:00Z',
  merge_commit_sha: main,
  base: { ref: 'main' },
  head: { ref: 'develop', sha: candidate, repo: { full_name: 'barocss/barocss' } },
  merged_by: { login: 'easylogic' },
};

test('release source is the exact develop PR second parent merged by easylogic', () => {
  assert.equal(verifyMainMerge(pr, main, [previous, candidate]), candidate);
});

test('changed source, branch, owner, or merge method cannot publish', () => {
  assert.throws(() => verifyMainMerge({ ...pr, head: { ...pr.head, sha: previous } }, main, [previous, candidate]));
  assert.throws(() => verifyMainMerge({ ...pr, head: { ...pr.head, ref: 'feature' } }, main, [previous, candidate]));
  assert.throws(() => verifyMainMerge({ ...pr, merged_by: { login: 'other' } }, main, [previous, candidate]));
  assert.throws(() => verifyMainMerge(pr, main, [previous]), /two-parent/);
  assert.throws(() => verifyMainMerge(pr, previous, [previous, candidate]));
});
