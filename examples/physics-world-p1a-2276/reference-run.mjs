// Reruns unchanged independent numerical fixtures with current source or actual emitted providers.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync, realpathSync, readdirSync } from 'node:fs';
import { resolve, join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
const [mode, id] = process.argv.slice(2);
assert.ok(['source', 'emitted'].includes(mode) && /^[a-z0-9-]+$/.test(id ?? ''));
const out = join(here, 'evidence', id);
assert.ok(!existsSync(out), 'preserve prior run');
mkdirSync(out, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const records = [];
function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? sourceFiles(join(dir, entry.name)) : entry.name.endsWith('.ts') ? [join(dir, entry.name)] : []);
}
const sources = sourceFiles(join(root, 'packages/barocss-physics/src')).map(path =>
  ({ path: relative(root, path), sha256: hash(readFileSync(path)) }));
const provider = join(out, 'physics');
const save = () => writeFileSync(join(out, 'commands.json'), JSON.stringify({
  mode, id, node: process.version, platform: process.platform, arch: process.arch,
  head: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim(),
  sourceSnapshot: sources, proof: 'unchanged independent fixtures; no provider instrumentation', records,
}, null, 2) + '\n');
function run(name, args) {
  const started = new Date().toISOString();
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 180000,
    maxBuffer: 16 * 1024 * 1024 });
  writeFileSync(join(out, `${name}.stdout`), result.stdout ?? '');
  writeFileSync(join(out, `${name}.stderr`), result.stderr ?? '');
  records.push({ name, command: [process.execPath, ...args], started, finished: new Date().toISOString(),
    exit: result.status, signal: result.signal, error: result.error?.message ?? null,
    stdoutSha256: hash(result.stdout ?? ''), stderrSha256: hash(result.stderr ?? '') });
  save();
  assert.equal(result.status, 0, `${name} failed; raw output retained`);
}
try {
  if (mode === 'emitted') {
    run('emit', ['node_modules/typescript/bin/tsc', 'packages/barocss-physics/src/index.ts',
      'packages/barocss-physics/src/replay.ts', '--target', 'ES2022', '--module', 'NodeNext',
      '--moduleResolution', 'NodeNext', '--strict', '--declaration', '--skipLibCheck',
      '--rootDir', 'packages/barocss-physics/src', '--outDir', provider]);
    writeFileSync(join(out, 'package.json'), '{"type":"module"}\n');
  }
  for (const name of ['world', 'contact']) {
    const fixture = `examples/physics-motion-foundations-2276/${name}.test.ts`;
    // The independent oracle and gates must remain byte-identical to the recorded foundation.
    const original = spawnSync('git', ['show', `66df02f8e7d5a3a7ab7b8ff7a0184bf34d978713:${fixture}`], { cwd: root });
    assert.equal(original.status, 0);
    assert.ok(original.stdout.equals(readFileSync(join(root, fixture))));
    const output = join(out, `${name}.test.mjs`);
    const result = await build({ entryPoints: [join(root, fixture)], outfile: output, bundle: true,
      platform: 'node', format: 'esm', target: 'node22', logLevel: 'silent', metafile: true,
      ...(mode === 'emitted' ? { alias: { '@barocss/physics': join(provider, 'index.js') } } : {}) });
    const inputs = Object.keys(result.metafile.inputs).map(path => {
      const real = realpathSync(resolve(root, path));
      assert.ok(real.startsWith(root + '/'), 'cross-worktree provider');
      return { path: relative(root, real), sha256: hash(readFileSync(real)) };
    });
    if (mode === 'emitted') assert.ok(inputs.every(x => !x.path.startsWith('packages/barocss-physics/src/')));
    writeFileSync(join(out, `${name}-graph.json`), JSON.stringify({ fixture,
      fixtureSha256: hash(original.stdout), emitted: mode === 'emitted', bundleSha256: hash(readFileSync(output)), inputs }, null, 2) + '\n');
    run(name, ['--test', output]);
  }
  for (const s of sources) assert.equal(hash(readFileSync(join(root, s.path))), s.sha256, 'source changed during execution');
  console.log(JSON.stringify({ result: 'PASS', mode, fixtures: 2, independentTests: 5,
    originalGatesUnchanged: true, publicStackActivated: false, hardwareValidated: false }));
} catch (error) {
  writeFileSync(join(out, 'runner-failure.txt'), `${error.stack ?? error}\n`);
  process.exitCode = 1;
} finally { save(); }
