import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const output = resolve(process.argv[2] ?? '.');
assert.ok(relative(root, output).startsWith('../'), 'Use an external evidence directory');
await mkdir(output);
const model = 'packages/barocss-cad-model';
const entry = resolve(root, model, 'test/rounded-inset-recipe.test.ts');
const recipe = `${model}/src/sketch/internal/roundedInsetRecipe.ts`;
const mutations = [
  ['source-binding', recipe, 'if (!record(source) || source.id !== recipe.sourceFeature)', 'if (!record(source))'],
  ['native-arc-center', recipe,
    'if (!(Math.abs(distance(center, start) - distance(center, end)) <= tolerance && distance(center, rebuilt.center) <= tolerance))',
    'if (false)'],
  ['retired-reference', recipe, 'if (edge) return badRecipe', 'if (false) return badRecipe'],
  ['reader-admission', `${model}/src/engine/migrate.ts`, '    assertRoundedInsetDocuments(o);', '    // Omit raw admission.'],
  ['native-lowering', `${model}/src/engine/part.ts`, 'featuresOf(resolveRoundedInsetRecipe(doc, i), i, CadPartLimits.features - features.length)',
    'featuresOf({ ...doc.nodes[0], id: node.id } as ModelNode, i, CadPartLimits.features - features.length)'],
];

const results = [];
for (const [name, file, from, to] of [['control'], ...mutations]) {
  const bundle = resolve(output, name + '.mjs');
  let applied = false;
  await build({
    entryPoints: [entry], outfile: bundle, bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'warning',
    plugins: file ? [{ name: 'mutate-one-source', setup(builder) {
      builder.onLoad({ filter: /\.ts$/ }, async args => {
        if (args.path !== resolve(root, file)) return;
        const contents = await readFile(args.path, 'utf8');
        assert.equal(contents.split(from).length, 2, name);
        applied = true;
        return { contents: contents.replace(from, to), loader: 'ts', resolveDir: resolve(args.path, '..') };
      });
    } }] : [],
  });
  assert.equal(applied, !!file, name);
  const run = spawnSync(process.execPath, ['--test', bundle], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  await writeFile(resolve(output, name + '.log'), (run.stdout ?? '') + (run.stderr ?? ''));
  assert.equal(run.error, undefined, name);
  assert.equal(run.signal, null, name);
  const count = Number(/^# tests (\d+)$/m.exec(run.stdout)?.[1]);
  const failures = Number(/^# fail (\d+)$/m.exec(run.stdout)?.[1]);
  assert.equal(count, 7, name);
  assert.equal(run.status, file ? 1 : 0, name);
  assert.ok(file ? failures > 0 : failures === 0, name);
  results.push({ name, status: file ? 'KILLED' : 'PASS', tests: count, failures });
}
await writeFile(resolve(output, 'receipt.json'), JSON.stringify({ status: 'PASS', results }, null, 2) + '\n');
