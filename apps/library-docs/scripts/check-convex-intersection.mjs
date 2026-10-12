// Bounded CPU docs consumer; leaves all existing example/provider pins intact.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(app, '../..');
const pin = '23e6615a8e2c4ad9c9299184a6be5ff2735358b5';
const packagePath = 'packages/barocss-canvas2d';
const git = args => execFileSync('git', args, { cwd: root, maxBuffer: 32 * 1024 * 1024 });
const cache = resolve(app, 'docs/.vitepress/cache/convex-intersection');
await mkdir(cache, { recursive: true });
const snapshot = await mkdtemp(resolve(cache, 'run-'));
const files = {};
for (const record of git(['ls-tree', '-r', '-z', pin, '--', `${packagePath}/src`, `${packagePath}/package.json`, `${packagePath}/tsconfig.json`]).toString().split('\0').filter(Boolean)) {
  const [metadata, path] = record.split('\t');
  const [mode, kind, oid] = metadata.split(' ');
  assert.ok(kind === 'blob' && ['100644', '100755'].includes(mode));
  const bytes = git(['show', `${pin}:${path}`]);
  assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), oid);
  const destination = resolve(snapshot, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
  files[path] = oid;
}
const pkg = resolve(snapshot, packagePath);
const manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
assert.equal(manifest.name, '@barocss/canvas2d');
assert.equal(manifest.exports['.'].import, './src/index.ts');
assert.equal(manifest.publishConfig.exports['.'].import, './dist/index.js');
assert.equal(manifest.publishConfig.exports['.'].types, './dist/index.d.ts');
// Real package declaration emit and the package's ES2022 browser bundle recipe.
const config = ts.readConfigFile(resolve(pkg, 'tsconfig.json'), ts.sys.readFile);
assert.equal(config.error, undefined);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, pkg);
assert.equal(parsed.errors.length, 0);
function check(program, emit = false) {
  const diagnostics = [...ts.getPreEmitDiagnostics(program)];
  if (emit) diagnostics.push(...program.emit().diagnostics);
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: p => p, getCurrentDirectory: () => root, getNewLine: () => '\n',
  }));
}
check(ts.createProgram(parsed.fileNames, parsed.options), true);
await build({ entryPoints: [resolve(pkg, 'src/index.ts')], bundle: true, format: 'esm',
  platform: 'browser', target: 'es2022', outfile: resolve(pkg, 'dist/index.js') });
const snippet = await readFile(resolve(app, 'scripts/snippets/convex-intersection-example.ts'), 'utf8');
const guide = await readFile(resolve(app, 'docs/packages/canvas2d/convex-intersection.md'), 'utf8');
assert.equal(guide.match(/```ts\n([\s\S]*?)```/)[1], snippet, 'guide runs the exact maintained snippet');
const consumer = resolve(snapshot, 'consumer.ts');
await writeFile(consumer, snippet);
const expected = [{ x: 65, y: 55 }, { x: 275 / 4, y: 205 / 4 },
  { x: 650 / 7, y: 370 / 7 }, { x: 120, y: 80 }, { x: 80, y: 120 }, { x: 65, y: 105 }];
const entries = [];
for (const mode of ['source', 'emitted']) {
  const entry = resolve(pkg, mode === 'source' ? manifest.exports['.'].import : manifest.publishConfig.exports['.'].import);
  const types = resolve(pkg, mode === 'source' ? manifest.exports['.'].types : manifest.publishConfig.exports['.'].types);
  check(ts.createProgram([consumer], { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler, strict: true, noEmit: true, skipLibCheck: true,
    paths: { '@barocss/canvas2d': [types] } }));
  const bundle = await build({ entryPoints: [consumer], bundle: true, write: false, format: 'esm',
    platform: 'node', target: 'node22', metafile: true, alias: { '@barocss/canvas2d': entry } });
  const inputs = Object.keys(bundle.metafile.inputs);
  if (mode === 'emitted') {
    assert.ok(inputs.some(p => p.endsWith('/dist/index.js')));
    assert.ok(inputs.every(p => !p.includes('/src/')), 'emitted consumer cannot resolve source');
  }
  const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  assert.deepEqual(api.result, { operation: 'intersection',
    inputIds: { left: ['LeftOperand'], right: ['RightOperand'] },
    contours: [{ id: 'ResultContour1', orientation: 'outer', sourceIds: ['LeftOperand', 'RightOperand'], points: expected }] });
  assert.deepEqual(api.disjoint, { operation: 'intersection', inputIds: { left: ['LeftOperand'], right: ['Far'] }, contours: [] });
  assert.equal(api.contactCode, 'UNSUPPORTED_FEATURE');
  assert.equal(api.inputsUnchanged, true);
  entries.push({ entry: mode, strictTypes: 'PASS', canonicalSixPoints: 'PASS', copiedInputs: 'PASS',
    disjointEmpty: 'PASS', endpointContactRefusal: api.contactCode,
    emittedSourceInputs: mode === 'emitted' ? 0 : null });
}
const receipt = { status: 'PASS', sourcePin: pin, packageVersion: manifest.version,
  verifiedSourceBlobs: Object.keys(files).length, sourceFiles: files,
  packageBuild: 'tsc declarations + esbuild ES2022 bundle', entries,
  actualBrowser: false, rendererCreated: false, publishedPackageClaim: false,
  command: 'node apps/library-docs/scripts/check-convex-intersection.mjs' };
await writeFile(resolve(app, 'evidence/convex-intersection-consumer.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ ...receipt, sourceFiles: undefined }));
