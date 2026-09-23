import assert from 'node:assert/strict';

export function verifyCandidateAncestry(compare) {
  assert.equal(compare.behind_by, 0, 'Candidate is behind main; sync main into develop and issue a new GO');
  assert.ok(compare.ahead_by > 0, 'Candidate must contain a new commit beyond main');
}
