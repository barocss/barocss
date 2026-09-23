import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { verifyLinkedSourceVersions } from './release-manifests.mjs';
import { verifyPromotion } from './release-provenance.mjs';

const repository = 'barocss/barocss';
const sha = process.env.GITHUB_SHA;
const token = process.env.GITHUB_TOKEN;
assert.equal(process.env.GITHUB_REPOSITORY, repository);
assert.equal(process.env.GITHUB_REF, 'refs/heads/main');
assert.match(sha || '', /^[0-9a-f]{40}$/);
assert.ok(token, 'GITHUB_TOKEN is required');

async function api(path) {
  const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`GitHub API ${path}: HTTP ${response.status}`);
  return response.json();
}

const localSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.equal(localSha, sha, 'Checkout must match the main push commit');
const main = await api('branches/main');
assert.equal(main.commit.sha, sha, 'main moved after this workflow started');

const kit = JSON.parse(readFileSync('packages/barocss/package.json', 'utf8'));
const version = kit.version;
assert.match(version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
const manifests = [kit, ...['barocss-browser', 'barocss-server'].map((directory) =>
  JSON.parse(readFileSync(`packages/${directory}/package.json`, 'utf8')),
)];
verifyLinkedSourceVersions(manifests, version);

const pulls = await api(`commits/${sha}/pulls?per_page=100`);
const promotion = pulls.filter((pr) =>
  pr.merged_at && pr.merge_commit_sha === sha && pr.base.ref === 'main'
    && pr.head.ref.startsWith('release/promote-')
    && pr.body?.includes('<!-- barocss-promotion '),
);
assert.equal(promotion.length, 1, 'main must come from exactly one approved promotion PR');
const pr = promotion[0];
const parents = execFileSync('git', ['show', '-s', '--format=%P', 'HEAD'], { encoding: 'utf8' })
  .trim().split(' ');
const candidateSha = verifyPromotion(pr, sha, version, parents);

const reviews = await api(`pulls/${pr.number}/reviews?per_page=100`);
assert.ok(reviews.some((review) =>
  review.state === 'APPROVED' && review.commit_id === candidateSha
    && review.user?.login !== pr.user?.login,
), 'Promotion PR needs an independent approval on the pinned candidate');

const readinessUrl = pr.body.match(
  /Readiness record: (https:\/\/github\.com\/barocss\/barocss\/(?:issues|pull)\/\d+#issuecomment-\d+)/,
)?.[1];
assert.ok(readinessUrl, 'Promotion PR must link its PM readiness record');
const readiness = readinessUrl.match(/\/(?:issues|pull)\/(\d+)#issuecomment-(\d+)$/);
const comment = await api(`issues/comments/${readiness[2]}`);
assert.equal(comment.issue_url, `https://api.github.com/repos/${repository}/issues/${readiness[1]}`);
assert.equal(comment.user?.login, 'easylogic');
assert.ok(
  comment.body?.includes(`BAROCSS_RELEASE_READY SHA=${candidateSha} VERSION=${version}`),
  'PM release-ready signal was removed or changed',
);
for (const role of ['Guard', 'Ship']) {
  assert.match(comment.body, new RegExp(`${role}: https://github\\.com/barocss/barocss/[^\\s]+`));
}

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `release_version=${version}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `candidate_sha=${candidateSha}\n`);
}
console.log(`main ${sha} is approved promotion PR #${pr.number} for ${version}.`);
