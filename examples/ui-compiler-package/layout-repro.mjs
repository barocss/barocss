import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileUi as stagedCompileUi } from './.build/consumer.mjs';

const installedEntry = process.env.INSTALLED_COMPILER_ENTRY;
if (!installedEntry || !path.isAbsolute(installedEntry))
  throw new Error('INSTALLED_COMPILER_ENTRY must be an absolute emitted package entry');

const { compileUi: installedCompileUi } = await import(pathToFileURL(installedEntry).href);
const source = await fs.readFile(new URL('./app.jsx', import.meta.url), 'utf8');
const [staged, installed] = await Promise.all([
  stagedCompileUi(source, { moduleId: 'counter' }),
  installedCompileUi(source, { moduleId: 'counter' }),
]);
assert.equal(staged.sourceDigest, installed.sourceDigest);
assert.deepEqual(staged.versions, installed.versions);
assert.equal(staged.css, installed.css);
assert.deepEqual(staged.bundle, installed.bundle);
assert.equal(staged.bundleDigest, installed.bundleDigest);
console.log(JSON.stringify({ status: 'passed', sourceDigest: staged.sourceDigest,
  bundleDigest: staged.bundleDigest, bundleBytes: staged.bundle.byteLength,
  cssDigest: createHash('sha256').update(staged.css).digest('hex'),
  versions: staged.versions }));
