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
  const original = await readFile(resolve(root, 'packages/barocss-physics/src/world.ts'), 'utf8');
  const candidate = await readFile(resolve(here, 'reference-world.ts'), 'utf8');
  const expected = original.replace('usePersistentBox && input.bodies.length > 4', 'usePersistentBox && input.bodies.length > 9')
    .replace(/from '(\.\/[^']+)'/g, (_, relative) => `from '../../packages/barocss-physics/src/${relative.slice(2)}'`);
  assert.equal(candidate, expected, 'private candidate has an undeclared change');
  assert.equal(createHash('sha256').update(candidate).digest('hex'), '96ed50f8e5f84853ddbe3e45fecbccb453fcb9a62f05968d8717e01a68310341');
  const ledger = JSON.parse(await readFile(resolve(here, 'dependency-ledger.json'), 'utf8'));
  for (const row of ledger.imports) assert.equal(createHash('sha256').update(await readFile(resolve(root, row.path))).digest('hex'), row.sha256, row.path);
  const compiled = { name: 'frozen-original-compiled-helpers', setup(builder) {
    builder.onResolve({ filter: /^\.\.\/\.\.\/packages\/barocss-physics\/src\// }, args => ({ path: resolve(root, args.path.replace('../../packages/barocss-physics/src/', 'packages/barocss-physics/dist/')) }));
  } };
  await mkdir(out, { recursive: true });
  const result = await build({ absWorkingDir: root, entryPoints: [resolve(here, 'consumer-entry.mjs')], outfile: resolve(out, `${graph}.mjs`), bundle: true, write: true, format: 'esm', platform: 'node', target: 'node22', metafile: true, plugins: graph === 'compiled-dependencies' ? [compiled] : [] });
  const inputs = Object.keys(result.metafile.inputs);
  const src = inputs.filter(p => p.startsWith('packages/barocss-physics/src/'));
  const dist = inputs.filter(p => p.startsWith('packages/barocss-physics/dist/'));
  assert.ok(graph === 'source' ? src.length > 0 && dist.length === 0 : src.length === 0 && dist.length > 0);
  const audit = { graph, originalSourceCount: src.length, originalDistCount: dist.length, privateCandidateIsSource: true, compiledPublicCandidate: false, inputs };
  await writeFile(resolve(out, `${graph}-graph.json`), JSON.stringify(audit, null, 2) + '\n');
  return { modulePath: resolve(out, `${graph}.mjs`), audit };
}
