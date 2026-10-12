import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, symlinkSync, realpathSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// This one newer CAD profile never changes the historical gallery/API pins.
const pin = '31b3033f9db55cab3aa61e3a15e755546d49823a';
assert.equal(process.versions.node.split('.')[0], '22', 'Run with Node 22');
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(app, '../..');
const cache = resolve(app, 'docs/.vitepress/cache/exact-prism-modeling', pin);
const paths = ['packages/barocss-cad/package.json', 'packages/barocss-cad/src'];
const git = args => execFileSync('git', args, { cwd: root, maxBuffer: 32 * 1024 * 1024 });
assert.equal(git(['rev-parse', `${pin}^{commit}`]).toString().trim(), pin);
const files = new Map(git(['ls-tree', '-r', '-z', pin, '--', ...paths]).toString().split('\0').filter(Boolean).map(record => {
  const [info, path] = record.split('\t'), [mode, kind, hash] = info.split(' ');
  assert.equal(kind, 'blob'); assert.ok(['100644', '100755'].includes(mode));
  return [path, hash];
}));
assert.ok(files.has('packages/barocss-cad/src/index.ts'));
const algorithm = git(['rev-parse', '--show-object-format']).toString().trim();
for (const [path, expected] of files) {
  const target = resolve(cache, path);
  if (!existsSync(target)) {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, git(['show', `${pin}:${path}`]));
  }
  const bytes = readFileSync(target);
  assert.equal(createHash(algorithm).update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), expected, `Pinned source mismatch: ${path}`);
}
const namespace = resolve(cache, 'node_modules/@barocss');
mkdirSync(namespace, { recursive: true });
const link = resolve(namespace, 'cad'), target = resolve(cache, 'packages/barocss-cad');
if (!existsSync(link)) symlinkSync(relative(namespace, target), link, 'dir');
assert.equal(realpathSync(link), target);
const consumer = readFileSync(resolve(app, 'scripts/snippets/exact-prism-modeling.mjs'));
const entry = resolve(cache, 'consumer.mjs'); writeFileSync(entry, consumer);
const result = await build({ absWorkingDir: cache, entryPoints: [entry], bundle: true,
  platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true });
const inputs = Object.keys(result.metafile.inputs).filter(p => p.startsWith('packages/'));
assert.ok(inputs.length > 0);
for (const path of inputs) assert.ok(files.has(path) && !path.includes('/dist/'), `Unexpected provider input ${path}`);
assert.ok(result.outputFiles[0].contents.length < 16 * 1024 * 1024);
const output = resolve(cache, 'consumer-bundle.mjs'); writeFileSync(output, result.outputFiles[0].contents);
const stdout = execFileSync(process.execPath, ['--max-old-space-size=2048', output], {
  cwd: cache, timeout: 180000, maxBuffer: 1024 * 1024, encoding: 'utf8',
});
console.log(stdout.trim());
console.log(JSON.stringify({ sourcePin: pin, node: process.versions.node, pinnedBlobs: files.size,
  ownSourceInputs: inputs.length, ownDistInputs: 0,
  consumerSha256: createHash('sha256').update(consumer).digest('hex'),
  bundleSha256: createHash('sha256').update(result.outputFiles[0].contents).digest('hex'),
  scope: 'one public-source consumer; no native suite, browser, GPU or registry acceptance',
}));
