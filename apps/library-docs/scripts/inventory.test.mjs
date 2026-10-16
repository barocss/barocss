import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { checkCurrentInventory, createCurrentInventory, sourceCommit } from './inventory.mjs';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(app, '../..');
const inventory = JSON.parse(await readFile(resolve(app, 'evidence/current-package-inventory.json'), 'utf8'));
const historicalBytes = await readFile(resolve(app, 'evidence/package-inventory.json'));

async function fixture(t) {
  const directory = await mkdtemp(resolve(tmpdir(), 'manual-manifests-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  // Only git show/rev-parse read the existing object database. All mutations below
  // affect fixture copies, never the real checkout, index, or package manifests.
  const gitDirectory = execFileSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: root }).toString().trim();
  await writeFile(resolve(directory, '.git'), `gitdir: ${gitDirectory}\n`);
  await mkdir(resolve(directory, 'evidence'));
  for (const name of ['package-inventory.json', 'current-package-inventory.json']) await copyFile(resolve(app, 'evidence', name), resolve(directory, 'evidence', name));
  for (const record of inventory.packages) {
    await mkdir(resolve(directory, record.directory), { recursive: true });
    await copyFile(resolve(root, record.directory, 'package.json'), resolve(directory, record.directory, 'package.json'));
  }
  return directory;
}

async function mutateJson(path, mutate) {
  const json = JSON.parse(await readFile(path, 'utf8'));
  mutate(json);
  await writeFile(path, JSON.stringify(json, null, 2) + '\n');
}

test('all 12 current manifests match; historical source pin and evidence stay separate', async () => {
  const result = await checkCurrentInventory();
  assert.equal(result.packages.length, 12);
  assert.equal(result.historicalSourceCommit, sourceCommit);
  assert.notEqual(result.manifestCommit, sourceCommit);
  assert.deepEqual(result, createCurrentInventory(root, historicalBytes, result.manifestCommit));
});

for (const [label, slug, mutate] of [
  ['version', 'kit', manifest => { manifest.version = '99.0.0'; }],
  ['held Render version', 'render', manifest => { manifest.version = '99.0.0'; }],
  ['development exports', 'cad-interop', manifest => { manifest.exports['./unexpected'] = './src/unexpected.ts'; }],
  ['published exports', 'cad-interop', manifest => { manifest.publishConfig.exports['./unexpected'] = './dist/unexpected.js'; }],
  ['dependencies', 'render-editor', manifest => { manifest.dependencies['@barocss/gpu'] = '99.0.0'; }],
]) {
  test(`refuses unreviewed ${label} drift`, async t => {
    const directory = await fixture(t);
    const record = inventory.packages.find(item => item.slug === slug);
    await mutateJson(resolve(directory, record.directory, 'package.json'), mutate);
    await assert.rejects(checkCurrentInventory(directory, directory), /Manifest drift:/);
  });
}

test('refuses blind hash refresh and current metadata tampering', async t => {
  const directory = await fixture(t);
  await mutateJson(resolve(directory, 'evidence/current-package-inventory.json'), value => { value.packages[0].manifestSha256 = '0'.repeat(64); });
  await assert.rejects(checkCurrentInventory(directory, directory), /provenance mismatch/);
});

test('refuses historical evidence or source pin replacement', async t => {
  const directory = await fixture(t);
  await mutateJson(resolve(directory, 'evidence/package-inventory.json'), value => { value.commit = inventory.manifestCommit; });
  await assert.rejects(checkCurrentInventory(directory, directory), /Historical source inventory changed/);
});

test('records exact changed fields including metadata-only held Render', () => {
  assert.deepEqual(inventory.packages.filter(p => p.changesFromSourceSnapshot.length).map(p => [p.slug, p.changesFromSourceSnapshot.map(change => change.field)]), [
    ['kit', ['version']], ['browser', ['version']], ['server', ['version']], ['render', ['version']],
    ['gpu', ['exports', 'scripts', 'publishConfig']], ['cad-interop', ['publishConfig', 'exports', 'scripts']],
    ['cad-editor', ['scripts']], ['render-editor', ['dependencies']],
  ]);
});

test('requires an immutable full SHA instead of a moving branch or tag', () => {
  assert.throws(() => createCurrentInventory(root, historicalBytes, 'HEAD'), /explicit full commit SHA/);
});

test('refuses a missing package entry instead of silently reducing coverage', async t => {
  const directory = await fixture(t);
  await mutateJson(resolve(directory, 'evidence/current-package-inventory.json'), value => { value.packages.pop(); });
  await assert.rejects(checkCurrentInventory(directory, directory), /provenance mismatch/);
});

test('refuses rewritten historical manifest metadata', async t => {
  const directory = await fixture(t);
  await mutateJson(resolve(directory, 'evidence/package-inventory.json'), value => { value.packages[0].version = '0.12.2'; });
  await assert.rejects(checkCurrentInventory(directory, directory), /Historical manifest evidence changed: kit/);
});
