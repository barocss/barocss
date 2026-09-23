import assert from 'node:assert/strict';

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
