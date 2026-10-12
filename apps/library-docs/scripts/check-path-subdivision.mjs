// Maintainer-only CPU check; public source and genuine publishConfig output.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(app, '../..');
const pkg = resolve(root, 'packages/barocss-canvas2d');
const manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
const snippet = resolve(app, 'scripts/snippets/canvas-path-subdivision.ts');
const cache = resolve(app, 'docs/.vitepress/cache/path-subdivision');
await mkdir(cache, { recursive: true });
const guide = await readFile(resolve(app, 'docs/packages/canvas2d/path-subdivision.md'), 'utf8');
assert.equal(guide.match(/```ts\n([\s\S]*?)```/)[1].trim(), (await readFile(snippet, 'utf8')).trim(), 'Guide executes the exact checked snippet');
// Always rebuild: a stale dist file is not emitted-entry verification.
execFileSync(resolve(root, 'node_modules/.bin/tsc'), ['-p', resolve(pkg, 'tsconfig.json')], { cwd: root, stdio: 'inherit' });
await build({ entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true,
  platform: 'browser', format: 'esm', target: 'es2022', outfile: resolve(pkg, manifest.publishConfig.exports['.'].import) });
const entries = [];
for (const [entry, exports] of [['source', manifest.exports], ['emitted', manifest.publishConfig.exports]]) {
  const publicEntry = resolve(pkg, exports['.'].import);
  const typeConfig = resolve(cache, `${entry}-types.json`);
  await writeFile(typeConfig, JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext',
    moduleResolution: 'Bundler', strict: true, skipLibCheck: true, noEmit: true,
    paths: { '@barocss/canvas2d': [resolve(pkg, exports['.'].types)] } }, files: [snippet] }));
  execFileSync(resolve(root, 'node_modules/.bin/tsc'), ['-p', typeConfig], { cwd: root, stdio: 'inherit' });
  const bundled = await build({ absWorkingDir: root, stdin: { contents: `export * from ${JSON.stringify(snippet)}; export { splitPathSegment, Canvas2DError } from '@barocss/canvas2d';`, resolveDir: root, loader: 'ts' },
    alias: { '@barocss/canvas2d': publicEntry }, bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true });
  const inputs = Object.keys(bundled.metafile.inputs);
  assert.ok(inputs.includes(`packages/barocss-canvas2d/${entry === 'source' ? 'src/index.ts' : 'dist/index.js'}`));
  if (entry === 'emitted') assert.ok(!inputs.some(path => path.includes('/src/')), 'Emitted check must not fall back to source');
  else assert.ok(!inputs.some(path => path.includes('/dist/')), 'Source check must not consume dist');
  const { original, subdivided, expected, splitPathSegment, Canvas2DError } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
  assert.deepEqual(original, [
    { kind: 'M', x: 0, y: 60 },
    { kind: 'C', c1x: 25, c1y: 0, c2x: 75, c2y: 100, x: 110, y: 60 },
    { kind: 'L', x: 110, y: 120 }, { kind: 'L', x: 0, y: 120 }, { kind: 'Z' },
  ], 'The call preserves the original literal fixture');
  const before = structuredClone(original);
  assert.deepEqual(subdivided, expected);
  assert.deepEqual(original, before);
  assert.notStrictEqual(subdivided, original);
  assert.ok(subdivided.every(command => !original.includes(command)), 'Unselected commands are copied too');
  original[0].x = 999;
  assert.deepEqual(subdivided, expected);
  subdivided[0].x = 888;
  assert.equal(original[0].x, 999);
  assert.deepEqual(splitPathSegment(before, 1, 0.5), expected);
  const frozen = Object.freeze(before.map(command => Object.freeze({ ...command })));
  assert.deepEqual(splitPathSegment(frozen, 1, 0.5), expected);
  assert.deepEqual(splitPathSegment([{ kind: 'M', x: 0, y: 0 }, { kind: 'L', x: 10, y: 20 }], 1, 0.5),
    [{ kind: 'M', x: 0, y: 0 }, { kind: 'L', x: 5, y: 10 }, { kind: 'L', x: 10, y: 20 }]);
  assert.deepEqual(splitPathSegment([{ kind: 'M', x: 0, y: 70 }, { kind: 'Q', cx: 45, cy: 5, x: 100, y: 70 }], 1, 0.5),
    [{ kind: 'M', x: 0, y: 70 }, { kind: 'Q', cx: 22.5, cy: 37.5, x: 47.5, y: 37.5 }, { kind: 'Q', cx: 72.5, cy: 37.5, x: 100, y: 70 }]);
  const path = length => Array.from({ length }, (_, i) => i ? { kind: 'L', x: i, y: 0 } : { kind: 'M', x: 0, y: 0 });
  assert.equal(splitPathSegment(path(255), 1, 0.5).length, 256);
  const refusals = [];
  for (const [name, commands, index, t, code] of [
    ['start endpoint', before, 1, 0, 'INVALID_SCENE'],
    ['end endpoint', before, 1, 1, 'INVALID_SCENE'],
    ['nonfinite parameter', before, 1, NaN, 'INVALID_SCENE'],
    ['invalid index', before, -1, 0.5, 'INVALID_SCENE'],
    ['move command', before, 0, 0.5, 'UNSUPPORTED_FEATURE'],
    ['close command', before, 4, 0.5, 'UNSUPPORTED_FEATURE'],
    ['constant selected segment', [{ kind: 'M', x: 0, y: 0 }, { kind: 'L', x: 10, y: 0 }, { kind: 'L', x: 10, y: 0 }], 2, 0.5, 'UNSUPPORTED_FEATURE'],
    ['output 257', path(256), 1, 0.5, 'SCENE_LIMIT'],
    ['rounded half collapse', [{ kind: 'M', x: 1, y: 0 }, { kind: 'L', x: 2, y: 0 }], 1, Number.MIN_VALUE, 'SCENE_LIMIT'],
  ]) {
    const unchanged = structuredClone(commands);
    assert.throws(() => splitPathSegment(commands, index, t), error => error instanceof Canvas2DError && error.code === code, name);
    assert.deepEqual(commands, unchanged, 'Refusal preserves source');
    refusals.push({ name, code });
  }
  entries.push({ entry, publicEntry: exports['.'].import, types: 'passed', inputs, literal: expected, copiedCommands: true, output256: true, refusals });
}
const sha256 = async path => createHash('sha256').update(await readFile(path)).digest('hex');
const receipt = { status: 'passed', revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  node: process.version, packageVersion: manifest.version, snippetSha256: await sha256(snippet),
  emittedSha256: await sha256(resolve(pkg, manifest.publishConfig.exports['.'].import)), entries,
  actualBrowser: false, actualRenderer: false, physicalSaveOpen: false };
await writeFile(resolve(cache, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
