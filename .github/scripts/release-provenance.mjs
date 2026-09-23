import assert from 'node:assert/strict';

export function verifyCandidateAncestry(compare) {
  assert.equal(compare.behind_by, 0, 'Candidate is behind main; sync main into develop and issue a new GO');
  assert.ok(compare.ahead_by > 0, 'Candidate must contain a new commit beyond main');
}

export function verifyPromotion(pr, mainSha, version, parents) {
  assert.ok(pr.merged_at, 'Promotion PR is not merged');
  assert.equal(pr.merge_commit_sha, mainSha);
  assert.equal(pr.base.ref, 'main');
  assert.match(pr.head.ref, /^release\/promote-/);
  const marker = pr.body?.match(/<!-- barocss-promotion sha=([0-9a-f]{40}) version=([^\s]+) -->/);
  assert.ok(marker, 'Promotion PR marker is missing');
  assert.equal(marker[2], version, 'Promotion PR version differs from main');
  assert.equal(pr.head.sha, marker[1], 'Promotion branch changed after readiness checks');
  assert.equal(parents.length, 2, 'main must contain an ordinary two-parent PR merge');
  assert.equal(parents[1], marker[1], 'main merge second parent is not the pinned candidate');
  return marker[1];
}

export function hasOwnerApproval(reviews, candidateSha, authorLogin) {
  if (authorLogin === 'easylogic') return false;
  const latest = reviews.filter((review) => review.user?.login === 'easylogic')
    .sort((a, b) => b.id - a.id)[0];
  return Boolean(latest?.state === 'APPROVED' && latest.commit_id === candidateSha);
}

export function verifyOwnerReviewEvent(event, pr, candidateSha, reviews) {
  assert.equal(event.action, 'submitted');
  assert.equal(event.review?.state, 'approved');
  assert.equal(event.review?.user?.login, 'easylogic');
  assert.equal(event.review?.commit_id, candidateSha);
  assert.equal(event.pull_request?.number, pr.number);
  const submitted = reviews.find((review) => review.id === event.review.id);
  assert.equal(submitted?.state, 'APPROVED', 'Submitted approval was dismissed or changed');
  assert.equal(submitted?.user?.login, 'easylogic');
  assert.equal(submitted?.commit_id, candidateSha);
  assert.ok(
    hasOwnerApproval(reviews, candidateSha, pr.user?.login),
    'Latest easylogic review must approve the exact candidate SHA',
  );
}
