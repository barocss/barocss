import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  verifyMainAncestry,
  verifyMainMerge,
  verifyReleasePullRequestJobs,
  verifyReleasePullRequestRun,
  verifySameSourceTree,
} from './release-provenance.mjs';

const candidate = 'a'.repeat(40);
const main = 'b'.repeat(40);
const previous = 'c'.repeat(40);
const tree = 'd'.repeat(40);
const pr = {
  merged_at: '2026-09-23T00:00:00Z',
  merge_commit_sha: main,
  base: { ref: 'main' },
  head: { ref: 'develop', sha: candidate, repo: { full_name: 'barocss/barocss' } },
  merged_by: { login: 'easylogic' },
};

test('release source is the exact develop PR second parent merged by easylogic', () => {
  assert.equal(verifyMainMerge(pr, main, [previous, candidate]), candidate);
});

test('changed source, branch, owner, or merge method cannot publish', () => {
  assert.throws(() => verifyMainMerge({ ...pr, head: { ...pr.head, sha: previous } }, main, [previous, candidate]));
  assert.throws(() => verifyMainMerge({ ...pr, head: { ...pr.head, ref: 'feature' } }, main, [previous, candidate]));
  assert.throws(() => verifyMainMerge({ ...pr, merged_by: { login: 'other' } }, main, [previous, candidate]));
  assert.throws(() => verifyMainMerge(pr, main, [previous]), /two-parent/);
  assert.throws(() => verifyMainMerge(pr, previous, [previous, candidate]));
});

test('release candidate must contain the previous main commit', () => {
  const directory = mkdtempSync(join(tmpdir(), 'barocss-release-ancestry-'));
  const git = (...args) => execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8' }).trim();
  try {
    git('init', '-q');
    git('config', 'user.name', 'Release Test');
    git('config', 'user.email', 'release-test@example.invalid');
    git('config', 'commit.gpgsign', 'false');
    writeFileSync(join(directory, 'file.txt'), 'main\n');
    git('add', 'file.txt');
    git('commit', '-qm', 'main');
    const previousMain = git('rev-parse', 'HEAD');

    writeFileSync(join(directory, 'file.txt'), 'candidate\n');
    git('commit', '-qam', 'candidate');
    const candidateSha = git('rev-parse', 'HEAD');
    assert.doesNotThrow(() => verifyMainAncestry(previousMain, candidateSha, directory));
    assert.throws(() => verifyMainAncestry(previousMain, previousMain, directory), /new commit/);
    assert.throws(() => verifyMainAncestry(candidateSha, previousMain, directory), /previous main/);

    git('checkout', '-q', '--orphan', 'unrelated');
    git('rm', '-rfq', '.');
    writeFileSync(join(directory, 'other.txt'), 'unrelated\n');
    git('add', 'other.txt');
    git('commit', '-qm', 'unrelated');
    const unrelatedSha = git('rev-parse', 'HEAD');
    assert.throws(() => verifyMainAncestry(unrelatedSha, candidateSha, directory), /previous main/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('release main must have the exact tested candidate tree', () => {
  assert.doesNotThrow(() => verifySameSourceTree(tree, tree));
  assert.throws(() => verifySameSourceTree(tree, previous), /differs from the tested/);
  assert.throws(() => verifySameSourceTree('', tree), /full Git tree SHA/);
  assert.throws(() => verifySameSourceTree(tree, undefined), /full Git tree SHA/);
});

test('release PR evidence must be successful for this candidate and merged PR', () => {
  const run = {
    id: 123,
    run_number: 71,
    run_attempt: 1,
    event: 'pull_request',
    head_branch: 'develop',
    head_sha: candidate,
    status: 'completed',
    conclusion: 'success',
    // GitHub returns an empty pull_requests array for this already-merged PR run.
    pull_requests: [],
  };
  assert.equal(verifyReleasePullRequestRun([run], candidate), 123);
  assert.throws(() => verifyReleasePullRequestRun([], candidate), /No Npm release/);
  assert.throws(() => verifyReleasePullRequestRun([{ ...run, conclusion: 'failure' }], candidate), /did not pass/);
  assert.throws(() => verifyReleasePullRequestRun([{ ...run, status: 'in_progress' }], candidate), /not complete/);
  assert.throws(() => verifyReleasePullRequestRun([{ ...run, head_sha: previous }], candidate), /No Npm release/);
  assert.throws(() => verifyReleasePullRequestRun([{ ...run, head_branch: 'feature' }], candidate), /No Npm release/);
  assert.equal(
    verifyReleasePullRequestRun([
      run,
      { ...run, id: 124, run_number: 72, conclusion: 'success' },
    ], candidate),
    124,
  );
  assert.throws(() => verifyReleasePullRequestRun([
    run,
    { ...run, id: 124, run_number: 72, conclusion: 'failure' },
  ], candidate), /did not pass/);

  const jobs = [
    { name: 'build', status: 'completed', conclusion: 'success' },
    { name: 'test', status: 'completed', conclusion: 'success' },
  ];
  assert.doesNotThrow(() => verifyReleasePullRequestJobs(jobs));
  assert.throws(() => verifyReleasePullRequestJobs(jobs.slice(0, 1)), /Expected one test job/);
  assert.throws(() => verifyReleasePullRequestJobs([{ ...jobs[0], conclusion: 'failure' }, jobs[1]]), /build job did not pass/);
});
