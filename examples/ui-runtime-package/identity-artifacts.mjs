import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const entry = process.env.UI_COMPILER_ENTRY;
const sourcePath = process.env.UI_COMPILER_SOURCE;
const output = process.env.COMPOSED_ARTIFACTS;
if (!entry || !sourcePath || !output) throw new Error('Compiler entry, source and output are required');
const { compileUi } = await import(pathToFileURL(path.resolve(entry)).href);
const source = await fs.readFile(sourcePath, 'utf8');
const base = await compileUi(source, { moduleId: 'counter' });
const different = await compileUi(source, { moduleId: 'other' });
assert.equal(base.sourceDigest, different.sourceDigest);
assert.equal(base.bundleDigest, different.bundleDigest);
assert.deepEqual(base.bundle, different.bundle);
assert.equal(base.css, different.css);
const serialized = Object.fromEntries([['base', base], ['different', different]].map(([name, artifact]) =>
  [name, { ...artifact, bundle: Buffer.from(artifact.bundle).toString('base64') }]));
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify(serialized));
console.log(JSON.stringify({ output, digest: base.bundleDigest, bytes: base.bundle.byteLength,
  moduleIds: [base.moduleId, different.moduleId] }));
