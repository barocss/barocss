import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const packageDir = resolve(root, 'packages/barocss-physics');

async function resolvedInputs(conditions) {
  const result = await build({
    stdin: {
      contents: "import { createClothWorld } from '@barocss/physics/cloth'; console.log(createClothWorld);",
      resolveDir: packageDir, sourcefile: 'cloth-source-import-probe.ts',
    },
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
    conditions, metafile: true,
  });
  return Object.keys(result.metafile.inputs);
}

const source = await resolvedInputs(['barocss-source']);
const compiled = await resolvedInputs([]);
assert.ok(source.some(path => path.endsWith('/src/cloth.ts')), 'cloth must resolve to source');
assert.ok(source.every(path => !path.includes('/dist/')), 'source resolution must not include dist');
assert.ok(compiled.some(path => path.endsWith('/dist/cloth.js')), 'default cloth must resolve to dist');
assert.ok(compiled.every(path => !path.includes('/src/')), 'default resolution must not include source');
const nodeConsumer = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
  import assert from 'node:assert/strict';
  import { createClothWorld, PhysicsError } from '@barocss/physics/cloth';
  const world = createClothWorld({ format: 'barocss-cloth-scene', version: 1,
    revision: 'namedConsumer1', basis: 'right-handed-xyz-metres',
    fixedStepSeconds: 1 / 120, profile: 'pinned-sheet-sphere-v1' });
  const state = world.step(1 / 120);
  assert.equal(state.stepIndex, 1);
  assert.equal(state.vertexCount, 289);
  world.dispose();
  assert.throws(() => world.getState(), error => error.constructor === PhysicsError && error.code === 'DISPOSED');
  console.log(JSON.stringify({ result: 'ok', stepIndex: state.stepIndex,
    vertexCount: state.vertexCount, physicsErrorIdentity: true }));
`], { cwd: packageDir, encoding: 'utf8' }));
assert.equal(nodeConsumer.result, 'ok');
console.log(JSON.stringify({ result: 'ok', sourceInputs: source, compiledInputs: compiled, nodeConsumer }));
