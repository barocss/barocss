import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const here = dirname(fileURLToPath(import.meta.url));
export const root = resolve(here, '../..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export async function bundle(graph, directory) {
  const compiled = graph === 'compiled-dependencies';
  assert.ok(compiled || graph === 'source' || graph === 'source-repeat');
  assert.equal(sha(await readFile(resolve(here, 'instrumented-world.ts'))), '643ba6a82aa7823d4b5cadf16f642c9662a4e3705405f2e7969b73f5efb5babe');
  assert.equal(sha(await readFile(resolve(here, '../physics-rigid-contact-reference/geometry-reference.py'))), '2c8bc7f6cd809e865c986a859b8614c963c4862296920555eb31c9487411af26');
  const ledger = JSON.parse(await readFile(resolve(here, '../physics-rigid-contact-reference/dependency-ledger.json'), 'utf8'));
  for (const row of ledger.imports) assert.equal(sha(await readFile(resolve(root, row.path))), row.sha256, row.path);
  const plugin = { name: 'actual-compiled-physics-helpers', setup(builder) {
    builder.onResolve({ filter: /^\.\.\/\.\.\/packages\/barocss-physics\/src\// }, args => ({ path: resolve(root, args.path.replace('../../packages/barocss-physics/src/', 'packages/barocss-physics/dist/')) }));
  } };
  await mkdir(directory, { recursive: true });
  const modulePath = resolve(directory, `${graph}.mjs`);
  const result = await build({ absWorkingDir: root, entryPoints: [resolve(here, 'entry.mjs')], outfile: modulePath, bundle: true, format: 'esm', platform: 'node', target: 'node22', metafile: true, plugins: compiled ? [plugin] : [] });
  const inputs = Object.keys(result.metafile.inputs);
  const sourceCount = inputs.filter(path => path.startsWith('packages/barocss-physics/src/')).length;
  const distCount = inputs.filter(path => path.startsWith('packages/barocss-physics/dist/')).length;
  assert.ok(compiled ? sourceCount === 0 && distCount > 0 : sourceCount > 0 && distCount === 0);
  const audit = { graph, sourceCount, distCount, privateCandidateIsSource: true, inputs };
  await writeFile(resolve(directory, `${graph}-graph.json`), JSON.stringify(audit, null, 2) + '\n');
  return { modulePath, audit };
}
