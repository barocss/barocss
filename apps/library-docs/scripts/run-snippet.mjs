import { build } from 'esbuild';
import { mkdir, readlink, symlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(app, '../..');
const namespace = resolve(app, 'scripts/snippets/node_modules/@barocss');
await mkdir(namespace, { recursive: true });
for (const name of ['gpu', 'cad']) {
  const link = resolve(namespace, name);
  const target = resolve(root, `packages/barocss-${name}`);
  try { await symlink(relative(namespace, target), link, 'dir'); }
  catch (error) { if (error.code !== 'EEXIST' || resolve(namespace, await readlink(link)) !== target) throw error; }
}
const result = await build({ entryPoints: [resolve(app, 'scripts/snippets/material.mjs')], bundle: true, nodePaths: [resolve(app, 'scripts/snippets/node_modules')], platform: 'node', format: 'esm', write: false, metafile: true, target: 'node22' });
const ownInputs = Object.keys(result.metafile.inputs).filter(p => p.includes('packages/barocss-'));
if (!ownInputs.length || ownInputs.some(p => p.includes('/dist/'))) throw new Error('Expected only own source package inputs');
const { receipt } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
const output = { commit: '5f5ad866205a21510ac69552e704cc162fa253b5', node: process.version, ...receipt, ownSourceInputs: ownInputs.length, ownDistInputs: 0 };
await writeFile(resolve(app, 'evidence/material-snippet.json'), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output, null, 2));
