import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { checkPublication } from './check-publication-state.mjs';
import { verifyLinkedSourceVersions } from './release-manifests.mjs';
import { verifyCandidateAncestry, verifyOwnerReviewEvent } from './release-provenance.mjs';

const repository = 'barocss/barocss';
const appToken = process.env.GH_TOKEN;
const readToken = process.env.GITHUB_TOKEN;
assert.equal(process.env.GITHUB_REPOSITORY, repository);
assert.equal(process.env.GITHUB_EVENT_NAME, 'pull_request_review');
assert.equal(process.env.GITHUB_ACTOR, 'easylogic');
assert.ok(appToken, 'GitHub App token is required');
assert.ok(readToken, 'Read-only GITHUB_TOKEN is required');

const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
assert.equal(event.pull_request?.base?.ref, 'main');
assert.equal(event.pull_request?.head?.repo?.full_name, repository);
const number = event.pull_request.number;
assert.ok(Number.isSafeInteger(number) && number > 0);

async function api(path) {
  const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${readToken}`,
      'x-github-api-version': '2022-11-28',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`GitHub API ${path}: HTTP ${response.status}`);
  return response.json();
}

const pr = await api(`pulls/${number}`);
assert.equal(pr.state, 'open');
assert.equal(pr.draft, false);
assert.equal(pr.base.ref, 'main');
assert.equal(pr.head.repo?.full_name, repository);
assert.equal(pr.user?.type, 'Bot', 'Promotion PR must be authored by the GitHub App');
const marker = pr.body?.match(/<!-- barocss-promotion sha=([0-9a-f]{40}) version=([^\s]+) -->/);
assert.ok(marker, 'Promotion PR marker is missing');
const [, sha, version] = marker;
assert.match(version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
assert.equal(pr.head.ref, `release/promote-${version}-${sha.slice(0, 12)}`);
assert.equal(pr.head.sha, sha, 'Promotion branch changed after PM readiness');
const reviews = await api(`pulls/${number}/reviews?per_page=100`);
assert.ok(reviews.length < 100, 'Too many reviews to verify owner approval safely');
verifyOwnerReviewEvent(event, pr, sha, reviews);

const develop = await api('branches/develop');
assert.equal(develop.commit.sha, sha, 'develop moved after PM readiness');
const localSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.equal(localSha, sha, 'Trusted default-branch checkout must match the candidate');
const main = await api('branches/main');
verifyCandidateAncestry(await api(`compare/${main.commit.sha}...${sha}`));

const manifests = ['barocss', 'barocss-browser', 'barocss-server'].map((directory) =>
  JSON.parse(readFileSync(`packages/${directory}/package.json`, 'utf8')),
);
verifyLinkedSourceVersions(manifests, version);
assert.deepEqual(
  readdirSync('.changeset').filter((name) => name.endsWith('.md') && name !== 'README.md'),
  [], 'Pending changesets must be versioned before promotion',
);

const readinessUrl = pr.body.match(
  /Readiness record: (https:\/\/github\.com\/barocss\/barocss\/(?:issues|pull)\/\d+#issuecomment-\d+)/,
)?.[1];
assert.ok(readinessUrl, 'Promotion PR must link its PM readiness record');
const readiness = readinessUrl.match(/\/(?:issues|pull)\/(\d+)#issuecomment-(\d+)$/);
const comment = await api(`issues/comments/${readiness[2]}`);
assert.equal(comment.issue_url, `https://api.github.com/repos/${repository}/issues/${readiness[1]}`);
assert.equal(comment.user?.login, 'easylogic');
assert.ok(comment.body?.includes(`BAROCSS_RELEASE_READY SHA=${sha} VERSION=${version}`));
for (const role of ['Guard', 'Ship']) {
  assert.match(comment.body, new RegExp(`${role}: https://github\\.com/barocss/barocss/[^\\s]+`));
}

const runs = await api(`actions/workflows/ci.yml/runs?branch=develop&event=push&head_sha=${sha}&per_page=30`);
const successfulRun = runs.workflow_runs.find((run) =>
  run.head_sha === sha && run.head_branch === 'develop' && run.conclusion === 'success',
);
assert.ok(successfulRun, 'Exact develop push CI is not successful');
const jobs = await api(`actions/runs/${successfulRun.id}/jobs?per_page=100`);
assert.ok(jobs.jobs.some((job) => job.name === 'Test and Build' && job.conclusion === 'success'));
assert.equal(await checkPublication(version, 'pre', sha, readToken), 'unpublished');

if (!pr.auto_merge) {
  execFileSync('gh', ['pr', 'merge', String(number), '--auto', '--merge', '--match-head-commit', sha], {
    env: { ...process.env, GH_TOKEN: appToken },
    stdio: 'inherit',
  });
}
console.log(`Promotion PR #${number} has easylogic approval for ${sha}; ordinary auto-merge is armed.`);
