import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const packageDir = resolve(root, 'packages/barocss-physics');
const contents = `
  import { createPhysicsWorld } from '@barocss/physics';
  import { admitCadSurfaceProxy } from '@barocss/physics/cad-proxy';
  import { createPhysicsScene } from '@barocss/physics/replay';
  import { createFluidWorld } from '@barocss/physics/fluid';
  console.log(createPhysicsWorld, admitCadSurfaceProxy, createPhysicsScene, createFluidWorld);
`;

async function resolvedInputs(conditions) {
  const result = await build({
    stdin: { contents, resolveDir: packageDir, sourcefile: 'source-import-probe.ts' },
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
    conditions, external: ['@barocss/cad'], metafile: true,
  });
  return Object.keys(result.metafile.inputs);
}

const source = await resolvedInputs(['barocss-source']);
const compiled = await resolvedInputs([]);
for (const entry of ['index', 'cad-proxy', 'replay', 'fluid']) {
  assert.ok(source.some((path) => path.endsWith(`/src/${entry}.ts`)), `${entry} must use source`);
  assert.ok(compiled.some((path) => path.endsWith(`/dist/${entry}.js`)), `${entry} must use dist`);
}
assert.ok(source.every((path) => !path.includes('/dist/')));
console.log(JSON.stringify({ result: 'ok', sourceEntries: 4, compiledEntries: 4 }));
