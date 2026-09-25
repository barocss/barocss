import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyMainAncestry, verifyMainMerge } from './release-provenance.mjs';

const candidate = 'a'.repeat(40);
const main = 'b'.repeat(40);
const previous = 'c'.repeat(40);
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
