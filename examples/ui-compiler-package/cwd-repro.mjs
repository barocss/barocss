import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const stage = path.join(here, '.build');
const source = path.join(here, 'app.jsx');
const entry = path.join(stage, 'consumer.mjs');
const relocated = path.join(stage, 'relocated');
await fs.rm(relocated, { recursive: true, force: true });
await fs.mkdir(relocated, { recursive: true });
await fs.cp(path.join(stage, 'node_modules'), path.join(relocated, 'node_modules'), { recursive: true });
await fs.copyFile(entry, path.join(relocated, 'consumer.mjs'));

const child = `
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const { compileUi } = await import(pathToFileURL(process.env.UI_COMPILER_ENTRY).href);
const artifact = await compileUi(await fs.readFile(process.env.UI_COMPILER_SOURCE, 'utf8'), { moduleId: 'counter' });
const bundle = Buffer.from(artifact.bundle);
if (createHash('sha256').update(bundle).digest('hex') !== artifact.bundleDigest) throw new Error('Bundle digest mismatch');
process.stdout.write(JSON.stringify({ bundle: bundle.toString('base64'), bundleDigest: artifact.bundleDigest,
  css: artifact.css, sourceDigest: artifact.sourceDigest, versions: artifact.versions }));
`;
function compile(cwd, packageEntry) {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', child], {
    cwd, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, UI_COMPILER_ENTRY: packageEntry, UI_COMPILER_SOURCE: source },
  });
  if (result.status !== 0) throw new Error(result.stderr || `Compiler child exited ${result.status}`);
  return JSON.parse(result.stdout);
}
const cases = [
  { cwd: repo, entry },
  { cwd: '/tmp', entry },
  { cwd: relocated, entry: path.join(relocated, 'consumer.mjs') },
];
const outputs = cases.map(({ cwd, entry: packageEntry }) => compile(cwd, packageEntry));
for (const output of outputs.slice(1)) {
  assert.equal(output.bundle, outputs[0].bundle);
  assert.equal(output.bundleDigest, outputs[0].bundleDigest);
  assert.equal(output.css, outputs[0].css);
  assert.equal(output.sourceDigest, outputs[0].sourceDigest);
  assert.deepEqual(output.versions, outputs[0].versions);
}
console.log(JSON.stringify({ status: 'passed', cases: cases.map(({ cwd, entry: packageEntry }) => ({ cwd, entry: packageEntry })),
  sourceDigest: outputs[0].sourceDigest, bundleDigest: outputs[0].bundleDigest,
  bundleBytes: Buffer.from(outputs[0].bundle, 'base64').length,
  cssDigest: createHash('sha256').update(outputs[0].css).digest('hex'), versions: outputs[0].versions }));
