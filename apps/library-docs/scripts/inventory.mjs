import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(app, '../..');
export const sourceCommit = '5f5ad866205a21510ac69552e704cc162fa253b5';
const slugs = ['kit', 'browser', 'server', 'render', 'gpu', 'cad', 'cad-interop', 'canvas2d', 'viewer', 'physics', 'cad-editor', 'render-editor'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (cwd, ...args) => execFileSync('git', args, { cwd });

// This is a metadata inventory only. It never changes API/example source pins or
// infers package publication, runtime compatibility, or activation of held lanes.
export function createCurrentInventory(repository, historicalBytes, commit) {
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('Manifest inventory requires an explicit full commit SHA');
  if (git(repository, 'rev-parse', `${commit}^{commit}`).toString().trim() !== commit) throw new Error('Invalid manifest commit');
  const historical = JSON.parse(historicalBytes);
  if (historical.commit !== sourceCommit || historical.packages.length !== slugs.length) throw new Error('Historical source inventory changed');
  const packages = slugs.map((slug, index) => {
    const directory = `packages/${slug === 'kit' ? 'barocss' : `barocss-${slug}`}`;
    const path = `${directory}/package.json`;
    const beforeBytes = git(repository, 'show', `${sourceCommit}:${path}`);
    const before = JSON.parse(beforeBytes);
    const expectedHistorical = { slug, directory, name: before.name, version: before.version, private: before.private ?? null, manifestSha256: hash(beforeBytes), developmentExports: before.exports, publishConfig: before.publishConfig ?? null };
    if (!isDeepStrictEqual(historical.packages[index], expectedHistorical)) throw new Error(`Historical manifest evidence changed: ${slug}`);
    const bytes = git(repository, 'show', `${commit}:${path}`);
    const manifest = JSON.parse(bytes);
    const changes = Object.keys({ ...before, ...manifest }).filter(key => !isDeepStrictEqual(before[key], manifest[key])).map(field => ({ field, before: before[field] ?? null, after: manifest[field] ?? null }));
    return { slug, directory, manifestSha256: hash(bytes), manifest, changesFromSourceSnapshot: changes };
  });
  return { schemaVersion: 1, purpose: 'Current checkout manifest metadata only; not an API, runtime, publication, or held-lane activation receipt.', manifestCommit: commit, historicalSourceCommit: sourceCommit, historicalInventorySha256: hash(historicalBytes), packages };
}

export async function checkCurrentInventory(repository = root, application = app) {
  const historicalBytes = await readFile(resolve(application, 'evidence/package-inventory.json'));
  const inventory = JSON.parse(await readFile(resolve(application, 'evidence/current-package-inventory.json'), 'utf8'));
  const expected = createCurrentInventory(repository, historicalBytes, inventory.manifestCommit);
  if (!isDeepStrictEqual(inventory, expected)) throw new Error('Current manifest inventory provenance mismatch; review the recorded commit and metadata changes');
  for (const record of inventory.packages) {
    const bytes = await readFile(resolve(repository, record.directory, 'package.json'));
    if (hash(bytes) !== record.manifestSha256) throw new Error(`Manifest drift: ${record.manifest.name}; review changes and explicitly record a new current manifest commit. Historical source evidence must remain unchanged.`);
  }
  return inventory;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length === 0 || (args.length === 1 && args[0] === '--check')) {
    const inventory = await checkCurrentInventory();
    console.log(`Matched ${inventory.packages.length} current manifests at ${inventory.manifestCommit}; historical source remains ${sourceCommit}.`);
  } else if (args.length === 3 && args[0] === '--write' && args[1] === '--commit') {
    const historicalBytes = await readFile(resolve(app, 'evidence/package-inventory.json'));
    const inventory = createCurrentInventory(root, historicalBytes, args[2]);
    // Refuse to label working-tree bytes with a commit that does not contain them.
    for (const record of inventory.packages) {
      if (hash(await readFile(resolve(root, record.directory, 'package.json'))) !== record.manifestSha256) throw new Error(`Working manifest differs from selected commit: ${record.slug}`);
    }
    await writeFile(resolve(app, 'evidence/current-package-inventory.json'), JSON.stringify(inventory, null, 2) + '\n');
    console.log(`Recorded current manifest metadata at ${inventory.manifestCommit}. Review changesFromSourceSnapshot; historical evidence was not rewritten.`);
  } else {
    throw new Error('Usage: node scripts/inventory.mjs [--check | --write --commit <full-reviewed-commit>]');
  }
}
