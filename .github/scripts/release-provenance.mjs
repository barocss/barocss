import assert from 'node:assert/strict';

export function verifyCandidateAncestry(compare) {
  assert.equal(compare.behind_by, 0, 'Candidate is behind main; sync main into develop and issue a new GO');
  assert.ok(compare.ahead_by > 0, 'Candidate must contain a new commit beyond main');
}

export function verifyMainMerge(pr, mainSha, parents) {
  assert.ok(pr.merged_at, 'Release PR is not merged');
  assert.equal(pr.merge_commit_sha, mainSha);
  assert.equal(pr.base.ref, 'main');
  assert.equal(pr.head.ref, 'develop', 'Release PR must merge the develop candidate');
  assert.equal(pr.head.repo?.full_name, 'barocss/barocss');
  assert.equal(pr.merged_by?.login, 'easylogic', 'Only the release owner can merge main');
  assert.match(pr.head.sha || '', /^[0-9a-f]{40}$/);
  assert.equal(parents.length, 2, 'main must contain an ordinary two-parent PR merge');
  assert.equal(parents[1], pr.head.sha, 'main merge second parent is not the PR candidate');
  return pr.head.sha;
}
