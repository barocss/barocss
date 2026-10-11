// Maintainer-only bounded consumer. This does not change the general examples pin.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, readlink, symlink } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

// Maintainer evidence serialization only; no new public CAD codec.
function nativeJSON(value) {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value)); return Object.is(value,-0) ? '-0' : JSON.stringify(value);
  }
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return '['+value.map(nativeJSON).join(',')+']';
  assert.ok(value && typeof value === 'object');
  return '{'+Object.entries(value).filter(([,child])=>child !== undefined)
    .map(([key,child])=>JSON.stringify(key)+':'+nativeJSON(child)).join(',')+'}';
}

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(app, '../..');
const profile = JSON.parse(await readFile(resolve(app, 'scripts/profiles/surface-knot-insertion-v0.json'), 'utf8'));
const snapshot = resolve(app, 'docs/.vitepress/cache/surface-knot-insertion-v0', profile.sourcePin);
const git = args => execFileSync('git', args, { cwd: root, maxBuffer: 64 * 1024 * 1024 });
const hash = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
if (git(['rev-parse', '--show-object-format']).toString().trim() !== 'sha1') throw Error('Unexpected Git object format');
const tree = Object.fromEntries(git(['ls-tree', '-r', '-z', profile.sourcePin, '--', ...profile.sourcePaths])
  .toString().split('\0').filter(Boolean).map(record => {
    const [info, path] = record.split('\t');
    const [mode, kind, oid] = info.split(' ');
    if (kind !== 'blob' || !['100644', '100755'].includes(mode)) throw Error('Unsupported source blob');
    return [path, oid];
  }));
if (JSON.stringify(tree) !== JSON.stringify(profile.files)) throw Error('Source profile tree mismatch');
await mkdir(snapshot, { recursive: true });
for (const [path, oid] of Object.entries(profile.files)) {
  const destination = resolve(snapshot, path);
  let bytes;
  try { bytes = await readFile(destination); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    bytes = git(['show', `${profile.sourcePin}:${path}`]);
    if (hash(bytes) !== oid) throw Error(`Source blob mismatch: ${path}`);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, bytes);
  }
  if (hash(bytes) !== oid) throw Error(`Cached source mismatch: ${path}`);
}
const namespace = resolve(snapshot, 'node_modules/@barocss');
await mkdir(namespace, { recursive: true });
for (const name of profile.packages) {
  const link = resolve(namespace, name), target = resolve(snapshot, `packages/barocss-${name}`);
  try { await symlink(relative(namespace, target), link, 'dir'); }
  catch (error) {
    if (error.code !== 'EEXIST' || resolve(namespace, await readlink(link)) !== target) throw error;
  }
}
const consumers = resolve(snapshot, 'consumers');
await mkdir(consumers, { recursive: true });
const entry = resolve(consumers, 'cad-surface-knot-insertion-example.ts');
await writeFile(entry, await readFile(resolve(app, 'scripts/snippets/cad-surface-knot-insertion-example.ts')));
const result = await build({ absWorkingDir: snapshot, entryPoints: [entry], bundle: true,
  platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true });
const inputs = Object.keys(result.metafile.inputs).filter(path => path.includes('packages/barocss-'));
for (const path of inputs) {
  if (!profile.files[path] || path.includes('/dist/') || hash(await readFile(resolve(snapshot, path))) !== profile.files[path]) {
    throw Error(`Consumer escaped the frozen source profile: ${path}`);
  }
}
if (!inputs.length) throw Error('No own source consumed');
const unexpected = Object.keys(result.metafile.inputs).filter(path => !path.startsWith('packages/') && path !== relative(snapshot, entry));
if (unexpected.length) throw Error('Unexpected consumer input: ' + unexpected.join(', '));
await writeFile(resolve(snapshot, 'selected-consumer-metafile.json'), JSON.stringify(result.metafile, null, 2) + '\n');
process.chdir(app);
await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
const receiptPath = resolve(app, 'evidence/cad-surface-knot-insertion-consumer.json');
const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
receipt.sourceProfile = { sourcePin: profile.sourcePin, verifiedBlobs: Object.keys(profile.files).length,
  ownSourceInputs: inputs.length, ownDistInputs: 0, packageVersions: profile.packageVersions,
  publicImports: ['@barocss/cad'] };
await writeFile(receiptPath, nativeJSON(receipt) + '\n');
const physical = JSON.parse(await readFile(receiptPath,'utf8'));
assert.deepEqual(physical,receipt);
assert.ok(Object.is(physical.result.originalModel.objects[0].controlPoints[0][0],-0));
assert.ok(Object.is(physical.result.model.objects[2].controlPoints[0][0][2],-0));
console.log(JSON.stringify(receipt.sourceProfile));
