import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { collect, delta, parseArguments, validateCurrentBaseline } from './public-api.mjs';
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(app, '../..');
const historicalText = await readFile(resolve(app, 'evidence/public-api.json'), 'utf8');
const baseline = JSON.parse(await readFile(resolve(app, 'evidence/current-public-api.json'), 'utf8'));
const clone = () => structuredClone(baseline);
const validate = value => validateCurrentBaseline(value, historicalText, baseline.packageTrees);

test('current inventory preserves historical bytes and every nine-package entry', () => {
  validate(baseline);
  assert.equal(baseline.historicalSha256, createHash('sha256').update(historicalText).digest('hex'));
  assert.equal(baseline.packages.length, 9);
  assert.deepEqual(delta(baseline.packages, structuredClone(baseline.packages)), { added: [], removed: [], changed: [] });
});
test('all current source trees are genuine trees at the exact recorded commit', () => {
  const actual = Object.fromEntries(Object.keys(baseline.packageTrees).map(path => [path,
    execFileSync('git', ['rev-parse', `${baseline.sourceCommit}:${path}`], { cwd: root, encoding: 'utf8', env: { ...process.env, GIT_NO_LAZY_FETCH: '1' } }).trim()]));
  assert.deepEqual(actual, baseline.packageTrees);
  const historical = JSON.parse(historicalText);
  const wrongTrees = Object.fromEntries(Object.keys(baseline.packageTrees).map(path => [path,
    execFileSync('git', ['rev-parse', `${historical.sourceCommit}:${path}`], { cwd: root, encoding: 'utf8', env: { ...process.env, GIT_NO_LAZY_FETCH: '1' } }).trim()]));
  const wrongPin = clone(); wrongPin.sourceCommit = historical.sourceCommit;
  assert.throws(() => validateCurrentBaseline(wrongPin, historicalText, wrongTrees), /pin\/tree mismatch/);
});
test('requires an explicit immutable SHA and rejects conflicting or unknown arguments', () => {
  assert.deepEqual(parseArguments(['--write-current', '--commit', baseline.sourceCommit]), { mode: '--write-current', commit: baseline.sourceCommit });
  for (const args of [[], ['--check', '--write'], ['--check', '--unknown'], ['--write-current'], ['--write-current', '--commit', 'develop'], ['--write-current', '--commit', 'abcdef'], ['--write-current', '--commit', baseline.sourceCommit, '--check']]) assert.throws(() => parseArguments(args));
});
test('rejects wrong source trees, missing coverage, compiler drift and stale digest data', () => {
  const mutations = [v => { v.packageTrees[Object.keys(v.packageTrees)[0]] = '0'.repeat(40); },
    v => { v.packages.pop(); }, v => { v.typescriptVersion = '0.0.0'; },
    v => { v.sourceCommit = 'develop'; }, v => { v.historicalSourceCommit = '0'.repeat(40); },
    v => { v.historicalSha256 = '0'.repeat(64); }, v => { v.changesFromHistorical.added.push('forged'); },
    v => { const s = v.packages.flatMap(p => p.entries).flatMap(e => e.symbols)[0]; s.signatures[0] += ' changed'; }];
  for (const mutate of mutations) { const value = clone(); mutate(value); assert.throws(() => validate(value)); }
  assert.throws(() => validateCurrentBaseline(baseline, historicalText + ' ', baseline.packageTrees), /Historical/);
});
test('real declaration extraction detects additions, removals and signature changes', async () => {
  const dir = await mkdtemp(resolve(tmpdir(), 'barocss-current-api-test-'));
  try {
    const path = resolve(dir, 'index.ts');
    const packages = [{ slug: 'fixture', name: 'fixture', version: '1', entries: [{ key: '.', path, provenance: 'temporary test source' }] }];
    await writeFile(path, 'export function keep(x: number): number { return x; }\nexport const removed = 1;\n');
    const before = collect(packages, dir);
    await writeFile(path, 'export function keep(x: string): string { return x; }\nexport const added = 2;\n');
    const diff = delta(before, collect(packages, dir));
    assert.ok(diff.added.includes('fixture.:added'));
    assert.ok(diff.removed.includes('fixture.:removed'));
    assert.ok(diff.changed.includes('fixture.:keep'));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('manifest and re-export group drift remain detectable', () => {
  for (const mutate of [v => { v[0].version += '-changed'; }, v => { v[0].developmentExports = {}; }, v => { v[0].entries[0].groups = []; }]) {
    const next = structuredClone(baseline.packages); mutate(next);
    assert.ok(delta(baseline.packages, next).changed.length > 0);
  }
});
