import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, symlink, lstat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
assert.ok(process.version.startsWith('v22.'), 'Use Node 22');
const depsRoot = process.env.REPO_DEPS_ROOT;
assert.ok(depsRoot, 'REPO_DEPS_ROOT must name an existing installed checkout');
async function linkMissing(path, target) {
  try { await lstat(path); }
  catch(e) { if (e.code !== 'ENOENT') throw e; await symlink(target, path, 'dir'); }
}
await linkMissing(resolve(root, 'node_modules'), resolve(depsRoot, 'node_modules'));
function build(name) {
  const result = spawnSync('pnpm', ['--filter', '@barocss/' + name, 'build:library'], { cwd: root, stdio: 'inherit' });
  assert.equal(result.status, 0, `${name} build failed`);
}
build('cad');
// Ignored local dependency lease. Use genuine emitted CAD declarations so Physics tsc
// does not include CAD source outside its rootDir. Preserve the source runtime import.
const cad = resolve(root, 'packages/barocss-cad');
const manifest = JSON.parse(await readFile(resolve(cad, 'package.json'), 'utf8'));
manifest.types = manifest.publishConfig.types;
manifest.exports['.'].types = manifest.publishConfig.exports['.'].types;
const lease = resolve(root, 'packages/barocss-physics/node_modules/@barocss/cad');
try { await lstat(resolve(lease, 'package.json')); }
catch(e) {
  if (e.code !== 'ENOENT') throw e;
  await mkdir(lease, { recursive: true });
  await writeFile(resolve(lease, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
  await linkMissing(resolve(lease, 'src'), resolve(cad, 'src'));
  await linkMissing(resolve(lease, 'dist'), resolve(cad, 'dist'));
}
build('physics');
