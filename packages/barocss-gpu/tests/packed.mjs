// The packed package as a consumer installs it (G18): @barocss/gpu's tarball and its one dependency's, @barocss/cad's,
// unpacked under a scratch folder's node_modules — the GPU bundle keeps CAD external (REVIEW G9), so CAD comes as the
// dependency npm would install, not inlined.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cad = path.resolve(root, '../barocss-cad');

async function unpack(dir, scratch, name) {
  const dest = path.join(scratch, 'packs', name);
  await mkdir(dest, { recursive: true });
  await exec('pnpm', ['pack', '--pack-destination', dest], { cwd: dir, timeout: 60_000 });
  const archives = (await readdir(dest)).filter((f) => f.endsWith('.tgz'));
  assert.equal(archives.length, 1);
  const installed = path.join(scratch, 'node_modules/@barocss', name);
  await mkdir(installed, { recursive: true });
  await exec('tar', ['-xzf', path.join(dest, archives[0]), '--strip-components=1', '-C', installed], { timeout: 30_000 });
  return { installed, archive: path.join(dest, archives[0]) };
}

/** A scratch folder with the packed gpu and cad installed; gpu's packed manifest (its publishConfig applied) and its tarball. */
export async function packedConsumer(prefix) {
  const scratch = await mkdtemp(path.join(tmpdir(), prefix));
  const { installed, archive } = await unpack(root, scratch, 'gpu');
  await unpack(cad, scratch, 'cad');
  assert(!(await readdir(installed)).includes('src'), 'Packed consumer must not contain source');
  const manifest = JSON.parse(await readFile(path.join(installed, 'package.json'), 'utf8'));
  // (Public since #657: its compiled entries, CAD a versioned dependency — not the workspace's.)
  assert.equal(manifest.private, false);
  assert.equal(manifest.main, './dist/index.js');
  assert.match(manifest.dependencies['@barocss/cad'], /^\d/);
  return { scratch, installed, manifest, archive };
}
