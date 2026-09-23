import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { verifyLinkedSourceVersions } from './release-manifests.mjs';
import { verifyMainMerge } from './release-provenance.mjs';

const repository = 'barocss/barocss';
const sha = process.env.GITHUB_SHA;
const version = process.env.EXPECTED_VERSION;
const token = process.env.GITHUB_TOKEN;
const readinessUrl = process.env.READINESS_COMMENT_URL;

assert.equal(process.env.GITHUB_REPOSITORY, repository);
assert.equal(process.env.GITHUB_EVENT_NAME, 'workflow_dispatch');
assert.equal(process.env.GITHUB_REF, 'refs/heads/main');
assert.equal(process.env.GITHUB_ACTOR, 'easylogic');
assert.match(sha || '', /^[0-9a-f]{40}$/);
assert.equal(process.env.EXPECTED_MAIN_SHA, sha, 'Manual release must pin the exact main SHA');
assert.match(version || '', /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
assert.ok(token, 'GITHUB_TOKEN is required');

const readiness = readinessUrl?.match(
  /^https:\/\/github\.com\/barocss\/barocss\/(?:issues|pull)\/(\d+)#issuecomment-(\d+)$/,
);
assert.ok(readiness, 'READINESS_COMMENT_URL must be a BaroCSS issue or PR comment');

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
assert.equal(localSha, sha, 'Checkout must match the manual main commit');
const main = await api('branches/main');
assert.equal(main.commit.sha, sha, 'main moved after manual release dispatch');

const manifests = ['barocss', 'barocss-browser', 'barocss-server'].map((directory) =>
  JSON.parse(readFileSync(`packages/${directory}/package.json`, 'utf8')),
);
verifyLinkedSourceVersions(manifests, version);

const pulls = await api(`commits/${sha}/pulls?per_page=100`);
assert.ok(pulls.length < 100, 'Too many PRs to identify the main merge safely');
const candidates = pulls.filter((pr) =>
  pr.merged_at && pr.merge_commit_sha === sha && pr.base.ref === 'main'
    && pr.head.ref === 'develop' && pr.head.repo?.full_name === repository,
);
assert.equal(candidates.length, 1, 'main must come from exactly one merged develop PR');
const pr = await api(`pulls/${candidates[0].number}`);
const parents = execFileSync('git', ['show', '-s', '--format=%P', 'HEAD'], { encoding: 'utf8' })
  .trim().split(' ');
const candidateSha = verifyMainMerge(pr, sha, parents);

const comment = await api(`issues/comments/${readiness[2]}`);
assert.equal(comment.issue_url, `https://api.github.com/repos/${repository}/issues/${readiness[1]}`);
assert.equal(comment.user?.login, 'easylogic', 'PM release-ready record must be posted by the owner');
assert.ok(
  comment.body?.includes(`BAROCSS_RELEASE_READY SHA=${candidateSha} VERSION=${version}`),
  'PM release-ready record must match the merged develop SHA and version',
);
for (const role of ['Guard', 'Ship']) {
  assert.match(comment.body, new RegExp(`${role}: https://github\\.com/barocss/barocss/[^\\s]+`));
}

const runs = await api(
  `actions/workflows/ci.yml/runs?branch=develop&event=push&head_sha=${candidateSha}&per_page=30`,
);
const successfulRun = runs.workflow_runs.find((run) =>
  run.head_sha === candidateSha && run.head_branch === 'develop' && run.conclusion === 'success',
);
assert.ok(successfulRun, 'No successful develop push CI run for the merged candidate');
const jobs = await api(`actions/runs/${successfulRun.id}/jobs?per_page=100`);
assert.ok(
  jobs.jobs.some((job) => job.name === 'Test and Build' && job.conclusion === 'success'),
  'Test and Build did not pass on the merged candidate',
);

console.log(`Manual release main ${sha} merges reviewed develop ${candidateSha} at ${version}.`);
