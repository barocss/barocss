import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const packageDir = resolve(root, 'packages/barocss-physics');
const contents = `
  import { createPhysicsWorld } from '@barocss/physics';
  import { admitCadSurfaceProxy } from '@barocss/physics/cad-proxy';
  import { createPhysicsScene } from '@barocss/physics/replay';
  import { createFluidWorld } from '@barocss/physics/fluid';
  import { createCadFluidWorld } from '@barocss/physics/fluid-cad';
  console.log(createPhysicsWorld, admitCadSurfaceProxy, createPhysicsScene, createFluidWorld, createCadFluidWorld);
`;

const published = JSON.parse(readFileSync(resolve(packageDir, 'package.json'), 'utf8')).publishConfig.exports;
async function resolvedInputs(conditions, usePublished = false) {
  const result = await build({
    stdin: { contents, resolveDir: packageDir, sourcefile: 'source-import-probe.ts' },
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
    conditions, external: ['@barocss/cad'], metafile: true,
    plugins: usePublished ? [{ name: 'actual-publish-map', setup(api) { api.onResolve({ filter: /^@barocss\/physics(?:\/.*)?$/ }, ({ path }) => { const key = path === '@barocss/physics' ? '.' : '.' + path.slice('@barocss/physics'.length); return { path: resolve(packageDir, published[key].import) }; }); } }] : [],
  });
  return Object.keys(result.metafile.inputs);
}

const source = await resolvedInputs(['barocss-source']);
const workspaceDefault = await resolvedInputs([]);
const compiled = await resolvedInputs([], true);
for (const entry of ['index', 'cad-proxy', 'replay', 'fluid', 'fluid-cad']) {
  assert.ok(source.some((path) => path.endsWith(`/src/${entry}.ts`)), `${entry} must use source`);
  assert.ok(workspaceDefault.some((path) => path.endsWith(`/src/${entry}.ts`)), `${entry} workspace default must use source`);
  assert.ok(compiled.some((path) => path.endsWith(`/dist/${entry}.js`)), `${entry} must use dist`);
}
assert.ok(source.every((path) => !path.includes('/dist/')));
assert.ok(compiled.every((path) => !path.includes('/src/')));
console.log(JSON.stringify({ result: 'ok', sourceEntries: 5, compiledEntries: 5 }));
