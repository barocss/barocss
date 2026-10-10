import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const entry = process.env.UI_COMPILER_ENTRY;
const sourcePath = process.env.UI_COMPILER_SOURCE;
const output = process.env.COMPOSED_ARTIFACTS;
if (!entry || !sourcePath || !output) throw new Error('UI_COMPILER_ENTRY, UI_COMPILER_SOURCE and COMPOSED_ARTIFACTS are required');
const { compileUi } = await import(pathToFileURL(path.resolve(entry)).href);
const source = await fs.readFile(sourcePath, 'utf8');
if (!source.includes('const unitPrice = 1800;')) throw new Error('Expected authored compiler source');
const values = {};
for (const [variant, text] of [
  ['base', source],
  ['different', source.replace('const unitPrice = 1800;', 'const unitPrice = 2200;')],
]) {
  const artifact = await compileUi(text, { moduleId: 'counter' });
  const digest = createHash('sha256').update(artifact.bundle).digest('hex');
  if (digest !== artifact.bundleDigest) throw new Error('Compiler bundle digest mismatch');
  values[variant] = { ...artifact, bundle: Buffer.from(artifact.bundle).toString('base64') };
}
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify(values));
console.log(JSON.stringify({ output, base: values.base.bundleDigest, different: values.different.bundleDigest,
  bytes: Buffer.from(values.base.bundle, 'base64').length, versions: values.base.versions }));
