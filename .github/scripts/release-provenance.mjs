import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

export function verifyMainAncestry(previousMain, candidateSha, cwd = process.cwd()) {
  assert.notEqual(candidateSha, previousMain, 'Release candidate must contain a new commit beyond previous main');
  const result = spawnSync(
    'git', ['merge-base', '--is-ancestor', previousMain, candidateSha],
    { cwd, stdio: 'ignore' },
  );
  assert.equal(result.status, 0, 'Release candidate must contain the previous main commit');
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

export function verifySameSourceTree(mainTree, candidateTree) {
  assert.match(mainTree || '', /^[0-9a-f]{40}$/, 'main release tree must be a full Git tree SHA');
  assert.match(candidateTree || '', /^[0-9a-f]{40}$/, 'tested candidate tree must be a full Git tree SHA');
  assert.equal(mainTree, candidateTree, 'main release tree differs from the tested develop candidate');
}

export function verifyReleasePullRequestRun(runs, candidateSha) {
  assert.ok(Array.isArray(runs), 'Npm release pull request runs are missing');
  assert.match(candidateSha || '', /^[0-9a-f]{40}$/);

  const matching = runs.filter((run) =>
    run.event === 'pull_request'
      && run.head_branch === 'develop'
      && run.head_sha === candidateSha,
  );
  assert.ok(matching.length > 0, 'No Npm release PR run exists for the exact merged candidate');
  for (const run of matching) {
    assert.ok(Number.isSafeInteger(run.run_number) && run.run_number > 0, 'Npm release PR run number is missing');
    assert.ok(Number.isSafeInteger(run.run_attempt) && run.run_attempt > 0, 'Npm release PR run attempt is missing');
  }
  const [run] = matching.sort((left, right) =>
    right.run_number - left.run_number || right.run_attempt - left.run_attempt,
  );
  assert.equal(run.status, 'completed', 'Npm release PR checks are not complete');
  assert.equal(run.conclusion, 'success', 'Npm release PR checks did not pass');
  assert.ok(Number.isSafeInteger(run.id) && run.id > 0, 'Npm release PR run ID is missing');
  return run.id;
}

export function verifyReleasePullRequestJobs(jobs) {
  assert.ok(Array.isArray(jobs), 'Npm release PR job evidence is missing');
  for (const name of ['build', 'test']) {
    const matching = jobs.filter((job) => job.name === name);
    assert.equal(matching.length, 1, `Expected one ${name} job in the Npm release PR run`);
    assert.equal(matching[0].status, 'completed', `${name} job is not complete`);
    assert.equal(matching[0].conclusion, 'success', `${name} job did not pass`);
  }
}
