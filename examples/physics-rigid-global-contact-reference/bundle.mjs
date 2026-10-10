import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
export const here = dirname(fileURLToPath(import.meta.url));
export const root = resolve(here, '../..');
export async function bundle(graph, out) {
  assert.ok(['source', 'compiled-dependencies'].includes(graph));
  const frozen = JSON.parse(await readFile(resolve(here, 'frozen-hashes.json'), 'utf8'));
  for (const [path, sha256] of Object.entries(frozen)) {
    assert.equal(createHash('sha256').update(await readFile(resolve(here, path))).digest('hex'), sha256, path);
  }
  const ledger = JSON.parse(await readFile(resolve(here, '../physics-rigid-contact-reference/dependency-ledger.json'), 'utf8'));
  for (const row of ledger.imports) assert.equal(createHash('sha256').update(await readFile(resolve(root, row.path))).digest('hex'), row.sha256, row.path);
  const compiled = { name: 'frozen-original-compiled-helpers', setup(builder) {
    builder.onResolve({ filter: /^\.\.\/\.\.\/packages\/barocss-physics\/src\// }, args => ({ path: resolve(root, args.path.replace('../../packages/barocss-physics/src/', 'packages/barocss-physics/dist/')) }));
  } };
  await mkdir(out, { recursive: true });
  const result = await build({ absWorkingDir: root, entryPoints: [resolve(here, 'entry.mjs')], outfile: resolve(out, `${graph}.mjs`), bundle: true, write: true, format: 'esm', platform: 'node', target: 'node22', metafile: true, plugins: graph === 'compiled-dependencies' ? [compiled] : [] });
  const inputs = Object.keys(result.metafile.inputs);
  const src = inputs.filter(p => p.startsWith('packages/barocss-physics/src/'));
  const dist = inputs.filter(p => p.startsWith('packages/barocss-physics/dist/'));
  assert.ok(graph === 'source' ? src.length > 0 && dist.length === 0 : src.length === 0 && dist.length > 0);
  const audit = { graph, originalSourceCount: src.length, originalDistCount: dist.length, privateCandidateIsSource: true, projectionModuleIsSource: true, globalIslandModuleIsSource: true, cacheModuleIsSource: true, compiledPublicCandidate: false, inputs };
  await writeFile(resolve(out, `${graph}-graph.json`), JSON.stringify(audit, null, 2) + '\n');
  return { modulePath: resolve(out, `${graph}.mjs`), audit };
}
