// D537: build mutations in memory, never edit the checkout. Root runs serially.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { isAbsolute, join, resolve, relative } from 'node:path';

const root = resolve(import.meta.dirname, '../../..'), out = process.argv[2];
assert.ok(out && isAbsolute(out) && relative(root, resolve(out)).startsWith('../'));
await mkdir(out);
const model = 'packages/barocss-cad-model', studio = 'apps/cad-studio';
const modelTests = [`${model}/test/driven-sketch-contract.test.ts`, `${model}/test/driven-sketch-geometry.test.ts`];
const studioTests = [`${studio}/test/named-sketch-guards.test.ts`];
const sha = value => createHash('sha256').update(value).digest('hex');
const mutants = [
  { name: 'solver-bypassed', file: `${model}/src/sketch/driven.ts`,
    from: 'const solved = commitDimension(shape, `len${i}`, parameter(binding.value.parameter, parameters));',
    to: 'const solved = { ok: true as const, shape };', tests: modelTests },
  { name: 'positional-identity', file: `${model}/src/sketch/driven.ts`,
    from: 'const i = shape.ids.indexOf(binding.entity);', to: 'const i = 0;', tests: modelTests },
  { name: 'inherited-parameter', file: `${model}/src/sketch/driven.ts`,
    from: '!Object.hasOwn(parameters, name)', to: '!(name in parameters)', tests: modelTests },
  { name: 'native-stale-seed', file: `${model}/src/engine/part.ts`,
    from: 'featuresOf(resolveDrivenSketch(node, params), i, CadPartLimits.features - features.length)',
    to: "featuresOf({ kind: 'sketch', ...node.seed, id: node.id } as ModelNode, i, CadPartLimits.features - features.length)", tests: modelTests },
  { name: 'reader-validation-bypassed', file: `${model}/src/engine/migrate.ts`,
    from: 'try { assertDrivenDocuments({ ...o, parameters }); }', to: 'try { /* mutation: no driven admission */ }', tests: modelTests },
  { name: 'remove-corrupts-recipe', file: `${model}/src/engine/parameters.ts`,
    from: "doc.nodes.map(n => n.kind === 'driven-sketch' && n.bindings.some(b => b.value.parameter === name) ? unbindSketchLengthNode(n, doc.parameters) : n)",
    to: 'doc.nodes', tests: modelTests },
  { name: 'direct-lowering-bypassed', file: `${model}/src/engine/part.ts`,
    from: "case 'driven-sketch': throw refusal('BAD_REFERENCE', 'Driven sketch requires document parameter resolution before kernel conversion.');",
    to: "case 'driven-sketch': return featureOf({ kind: 'sketch', ...node.seed, id: node.id } as ModelNode, index, nodes);", tests: modelTests },
  { name: 'edit-handler-guard-removed', file: `${studio}/src/sketch/useSketchActions.ts`,
    from: "if (stored?.kind === 'driven-sketch')", to: 'if (false)', tests: studioTests },
  { name: 'finish-guard-removed', file: `${studio}/src/sketch/useSketchActions.ts`,
    from: "if (sketch?.editNode !== undefined && (doc.nodes[sketch.editNode]?.kind === 'driven-sketch' || docNow.current.nodes[sketch.editNode]?.kind === 'driven-sketch'))",
    to: 'if (false)', tests: studioTests },
  { name: 'finish-current-owner-guard-removed', file: `${studio}/src/sketch/useSketchActions.ts`,
    from: "doc.nodes[sketch.editNode]?.kind === 'driven-sketch' || docNow.current.nodes[sketch.editNode]?.kind === 'driven-sketch'",
    to: "doc.nodes[sketch.editNode]?.kind === 'driven-sketch'", tests: studioTests },
];
const receipt = { status: 'RUNNING', authority: 'CONTROLLED_IN_MEMORY_MUTATIONS_NOT_STUDIO', results: [] };
const persist = () => writeFile(join(out, 'receipt.json'), JSON.stringify(receipt, null, 2));
async function run(name, tests, mutation) {
  const entryPoints = tests.map(file => join(root, file)), bundleDir = join(out, name);
  const result = await build({ entryPoints, outdir: bundleDir, bundle: true, platform: 'node', format: 'esm', target: 'node22',
    outExtension: { '.js': '.mjs' }, logLevel: 'warning', metafile: true,
    plugins: mutation ? [{ name: 'one-owned-source-mutation', setup(builder) {
      builder.onLoad({ filter: /\.tsx?$/ }, async args => {
        if (args.path !== join(root, mutation.file)) return;
        const original = await readFile(args.path, 'utf8');
        assert.equal(original.split(mutation.from).length - 1, 1, `${name}: one exact mutation anchor`);
        const changed = original.replace(mutation.from, mutation.to);
        mutation.sourceSHA256 = sha(original); mutation.changedSHA256 = sha(changed);
        await writeFile(join(out, name + '-mutated-source.ts'), changed);
        return { contents: changed, loader: args.path.endsWith('.tsx') ? 'tsx' : 'ts', resolveDir: resolve(args.path, '..') };
      });
    } }] : [] });
  const bundles = Object.keys(result.metafile.outputs).filter(file => file.endsWith('.mjs'));
  const child = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...bundles], { encoding: 'utf8', cwd: root, maxBuffer: 32 * 1024 * 1024 });
  await writeFile(join(out, name + '.stdout.txt'), child.stdout ?? '');
  await writeFile(join(out, name + '.stderr.txt'), child.stderr ?? '');
  assert.equal(child.error, undefined); assert.equal(child.signal, null);
  const stdout = child.stdout ?? '', testsRun = Number(/# tests (\d+)/.exec(stdout)?.[1]), failures = Number(/# fail (\d+)/.exec(stdout)?.[1]);
  assert.ok(testsRun > 0 && Number.isInteger(failures), `${name}: actual test report required`);
  if (mutation) { assert.notEqual(child.status, 0, `${name}: mutant survived`); assert.ok(failures > 0); }
  else { assert.equal(child.status, 0, stdout + child.stderr); assert.equal(failures, 0); }
  receipt.results.push({ name, status: mutation ? 'KILLED' : 'PASS', testsRun, failures, exit: child.status,
    ...(mutation ? { file: mutation.file, sourceSHA256: mutation.sourceSHA256, changedSHA256: mutation.changedSHA256 } : {}) });
  await persist();
}
try {
  await persist();
  await run('baseline-model', modelTests); await run('baseline-studio', studioTests);
  for (const mutant of mutants) await run(mutant.name, mutant.tests, mutant);
  receipt.status = 'PASS'; await persist();
  console.log(JSON.stringify(receipt));
} catch (cause) {
  receipt.status = 'FAIL'; receipt.error = cause instanceof Error ? cause.stack : String(cause); await persist(); throw cause;
}
