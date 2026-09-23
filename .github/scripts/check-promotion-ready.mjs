import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { verifyLinkedSourceVersions } from './release-manifests.mjs';

const repository = 'barocss/barocss';
const sha = process.env.CANDIDATE_SHA;
const version = process.env.EXPECTED_VERSION;
const commentUrl = process.env.READINESS_COMMENT_URL;
const token = process.env.GITHUB_TOKEN;

assert.match(sha || '', /^[0-9a-f]{40}$/, 'CANDIDATE_SHA must be a full commit SHA');
assert.match(version || '', /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, 'EXPECTED_VERSION must be exact');
assert.equal(process.env.GITHUB_REPOSITORY, repository);
assert.equal(process.env.GITHUB_REF, 'refs/heads/develop');
assert.equal(process.env.GITHUB_ACTOR, 'easylogic', 'Only the release owner can dispatch promotion');
assert.ok(token, 'GITHUB_TOKEN is required');

const match = commentUrl?.match(
  /^https:\/\/github\.com\/barocss\/barocss\/(?:issues|pull)\/(\d+)#issuecomment-(\d+)$/,
);
assert.ok(match, 'READINESS_COMMENT_URL must point to a BaroCSS issue or PR comment');

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
assert.equal(localSha, sha, 'Checkout must match the selected commit');
const branch = await api('branches/develop');
assert.equal(branch.commit.sha, sha, 'develop moved after the release signal');

const directories = ['barocss', 'barocss-browser', 'barocss-server'];
const manifests = directories.map((directory) =>
  JSON.parse(readFileSync(`packages/${directory}/package.json`, 'utf8')),
);
verifyLinkedSourceVersions(manifests, version);
const pending = readdirSync('.changeset').filter((name) => name.endsWith('.md') && name !== 'README.md');
assert.deepEqual(pending, [], 'Pending changesets must be versioned before promotion');

const comment = await api(`issues/comments/${match[2]}`);
assert.equal(comment.issue_url, `https://api.github.com/repos/${repository}/issues/${match[1]}`);
assert.equal(comment.user?.login, 'easylogic', 'Release-ready record must be posted by the owner');
assert.ok(
  comment.body?.includes(`BAROCSS_RELEASE_READY SHA=${sha} VERSION=${version}`),
  'Release-ready record must name the exact commit and version',
);
for (const role of ['Guard', 'Ship']) {
  assert.match(
    comment.body,
    new RegExp(`${role}: https://github\\.com/barocss/barocss/[^\\s]+`),
    `Release-ready record needs a ${role} evidence link`,
  );
}

const runs = await api(
  `actions/workflows/ci.yml/runs?branch=develop&event=push&head_sha=${sha}&per_page=30`,
);
const successfulRuns = runs.workflow_runs.filter(
  (run) => run.head_sha === sha && run.head_branch === 'develop' && run.conclusion === 'success',
);
assert.ok(successfulRuns.length > 0, 'No successful develop push CI run for this exact commit');
const jobs = await api(`actions/runs/${successfulRuns[0].id}/jobs?per_page=100`);
assert.ok(
  jobs.jobs.some((job) => job.name === 'Test and Build' && job.conclusion === 'success'),
  'Test and Build did not pass on the selected commit',
);

console.log(`Release-ready record and develop CI match ${sha} at ${version}.`);
