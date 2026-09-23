import assert from 'node:assert/strict';
import { verifyCandidateAncestry } from './release-provenance.mjs';

const repository = 'barocss/barocss';
const sha = process.env.CANDIDATE_SHA;
const version = process.env.EXPECTED_VERSION;
const readiness = process.env.READINESS_COMMENT_URL;
const token = process.env.GH_TOKEN;
assert.match(sha || '', /^[0-9a-f]{40}$/);
assert.match(version || '', /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
assert.match(
  readiness || '',
  /^https:\/\/github\.com\/barocss\/barocss\/(?:issues|pull)\/\d+#issuecomment-\d+$/,
);
assert.ok(token, 'GitHub App token is required');

const branchName = `release/promote-${version}-${sha.slice(0, 12)}`;
const marker = `<!-- barocss-promotion sha=${sha} version=${version} -->`;
const body = `${marker}\n\n` +
  `Promote the pinned BaroCSS ${version} candidate from develop to main.\n\n` +
  `Candidate commit: ${sha}\n` +
  `Readiness record: ${readiness}\n\n` +
  'easylogic must approve this exact candidate commit. The submitted review starts a separate GitHub Actions check that arms ordinary auto-merge. Current build and test checks and resolved conversations remain required. Do not use administrator bypass.\n';

async function api(path, options = {}) {
  const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
    ...options,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub API ${path}: HTTP ${response.status} ${await response.text()}`);
  return response.json();
}

const develop = await api('branches/develop');
assert.equal(develop.commit.sha, sha, 'develop moved before promotion branch creation');
const main = await api('branches/main');
const ancestry = await api(`compare/${main.commit.sha}...${sha}`);
verifyCandidateAncestry(ancestry);
const openMainPulls = await api('pulls?base=main&state=open&per_page=100');
assert.ok(openMainPulls.length < 100, 'Too many main PRs to safely detect an existing promotion');
assert.ok(
  !openMainPulls.some((pr) =>
    pr.head.ref.startsWith('release/promote-') && pr.head.ref !== branchName,
  ),
  'Another promotion PR is already open; reconcile it before starting a new release',
);

const reference = await api(`git/ref/heads/${branchName}`);
if (reference) {
  assert.equal(reference.object.sha, sha, 'Existing promotion branch points to another commit');
} else {
  await api('git/refs', {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
  });
}

const pulls = await api(`pulls?head=barocss:${encodeURIComponent(branchName)}&base=main&state=all&per_page=100`);
assert.ok(pulls.length <= 1, 'Multiple promotion PRs use the same pinned branch');
let pr = pulls[0];
if (pr) {
  assert.equal(pr.state, 'open', 'Promotion PR already closed; stop instead of recreating it');
  assert.equal(pr.head.sha, sha, 'Promotion PR head changed');
  assert.ok(pr.body?.includes(marker), 'Existing promotion PR does not match this release');
  assert.ok(pr.body?.includes(`Readiness record: ${readiness}`));
} else {
  pr = await api('pulls', {
    method: 'POST',
    body: JSON.stringify({
      title: `chore: promote BaroCSS ${version} to main`,
      head: branchName,
      base: 'main',
      body,
    }),
  });
}

assert.equal(pr.user?.type, 'Bot', 'Promotion PR must be authored by the GitHub App');
assert.ok(!pr.auto_merge, 'Promotion PR was armed before easylogic approval');
console.log(`Promotion PR #${pr.number} pins ${sha} at ${version}; wait for easylogic approval before arming auto-merge.`);
