import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
const [mode, runId, canonical] = process.argv.slice(2);
assert.ok(['baseline', 'geometry-source', 'geometry-emitted', 'world-source', 'world-emitted', 'error-tests'].includes(mode));
assert.ok(/^[a-z0-9-]+$/.test(runId ?? ''));
const out = join(here, 'evidence', runId);
assert.ok(!existsSync(out), 'keep every earlier attempt'); mkdirSync(out, { recursive: true });
const sha = b => createHash('sha256').update(b).digest('hex'), records = [], snapshots = new Map();
const geometryDir = join(root, 'examples/physics-rigid-feature-geometry');
const solverDir = join(root, 'examples/physics-stack-solver-2276');
const emitted = mode.endsWith('-emitted'), modules = join(out, 'modules');
function save(name, value) { writeFileSync(join(out, name + '.json'), JSON.stringify(value, null, 2) + '\n'); }
function freeze(path) {
  path = resolve(root, path); const hash = sha(readFileSync(path));
  if (snapshots.has(path)) assert.equal(hash, snapshots.get(path), 'source changed before execution');
  snapshots.set(path, hash);
}
function sourceReceipt() { save('source', { mode, parent: '8d7474ba0b4df5367dbeee93b3a95cb777dcac48', node: process.version,
  files: [...snapshots].map(([path, sha256]) => ({ path: relative(root, path), sha256 })) }); }
for (const dir of [here, geometryDir, solverDir]) for (const name of readdirSync(dir).filter(n => /\.(ts|mjs|py|md)$/.test(n))) freeze(join(dir, name));
for (const dir of readdirSync(join(root, 'examples'), { withFileTypes: true }).filter(d => d.isDirectory())) {
  const path = join(root, 'examples', dir.name);
  for (const name of readdirSync(path).filter(n => n.endsWith('.py'))) freeze(join(path, name));
}
sourceReceipt();
function command(name, executable, args, timeout = 180000) {
  const started = new Date().toISOString();
  const result = spawnSync(executable, args, { cwd: root, encoding: 'utf8', timeout, maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  writeFileSync(join(out, name + '.stdout'), result.stdout ?? ''); writeFileSync(join(out, name + '.stderr'), result.stderr ?? '');
  records.push({ name, command: [executable, ...args], started, finished: new Date().toISOString(), exit: result.status,
    signal: result.signal, error: result.error?.message ?? null, stdoutSha256: sha(result.stdout ?? ''), stderrSha256: sha(result.stderr ?? '') });
  save('commands', { node: process.version, executable: process.execPath, records });
  process.stdout.write(name + ': exit ' + result.status + '\n');
  assert.equal(result.status, 0, name + ' failed; attempt retained');
}
function providerPlugin() { return { name: 'actual-emitted-geometry-providers', setup(api) {
  if (emitted) api.onResolve({ filter: /\.(?:js|ts)$/ }, args => {
    const full = resolve(args.resolveDir, args.path);
    if (full.endsWith('/packages/barocss-physics/src/types.js')) return { path: join(root, 'packages/barocss-physics/src/types.ts') };
    if (dirname(full) === geometryDir || dirname(full) === solverDir && /^(candidate|verification|world-adapter)\.(js|ts)$/.test(basename(full))) {
      return { path: join(modules, relative(root, full).replace(/\.ts$/, '.js')) };
    }
  });
} }; }
async function bundle(name, entry, plugins = []) {
  const outfile = join(out, name + '.mjs');
  const result = await build({ absWorkingDir: root, entryPoints: [resolve(here, entry)], outfile, bundle: true,
    format: 'esm', platform: 'node', target: 'node22', metafile: true, logLevel: 'silent', plugins: [providerPlugin(), ...plugins] });
  const inputs = Object.keys(result.metafile.inputs);
  for (const path of inputs) freeze(path);
  if (emitted && ['geometry-tests', 'geometry-consumer', 'world-consumer'].includes(name)) {
    assert.ok(inputs.some(p => p.endsWith('/face-contact.js')), 'emitted face path absent');
    assert.ok(inputs.some(p => p.endsWith('/strict-line.js')), 'emitted exact predicate absent');
    assert.ok(!inputs.some(p => p.startsWith('examples/physics-rigid-feature-geometry/') && p.endsWith('.ts')), 'source geometry in emitted graph');
    if (name === 'world-consumer') for (const provider of ['candidate', 'verification', 'world-adapter']) {
      assert.ok(inputs.some(p => p.endsWith('/' + provider + '.js')), 'emitted solver provider missing: ' + provider);
      assert.ok(!inputs.includes(relative(root, join(solverDir, provider + '.ts'))), 'source solver in emitted graph');
    }
  }
  save(name + '-graph', { emitted, bundleSha256: sha(readFileSync(outfile)),
    inputs: inputs.map(path => ({ path, sha256: sha(readFileSync(resolve(root, path))) })) });
  sourceReceipt(); return outfile;
}
try {
  const fixturePath = join(here, 'evidence/baseline-02/fixtures.json');
  if (mode === 'baseline') {
    command('fixtures', 'python3', ['-B', join(here, 'failure-fixtures.py'), '--output', join(out, 'fixtures.json')]);
    command('baseline', 'python3', ['-B', join(here, 'independent-check.py'), '--fixtures', join(out, 'fixtures.json'), '--baseline', '--output', join(out, 'result.json')]);
    assert.equal(JSON.parse(readFileSync(join(out, 'result.json'))).status, 'BASELINE_STRICT_FAILURES_REPRODUCED');
  } else if (mode === 'error-tests') {
    const file = await bundle('trajectory-errors', 'runner-errors.test.mjs');
    command('trajectory-errors', process.execPath, ['--test', file]);
  } else {
    if (emitted) {
      mkdirSync(modules);
      const files = [join(here, 'geometry-entry.ts'), ...['candidate.ts', 'verification.ts', 'world-adapter.ts'].map(n => join(solverDir, n))];
      command('strict-emission', process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), ...files,
        '--target', 'ES2022', '--module', 'ES2022', '--moduleResolution', 'Bundler', '--strict', '--skipLibCheck',
        '--declaration', '--rootDir', root, '--outDir', modules]);
    }
    if (mode.startsWith('geometry-')) {
      const tests = await bundle('geometry-tests', 'geometry.test.ts');
      command('geometry-tests', process.execPath, ['--test', tests]);
      const consumer = await bundle('geometry-consumer', 'geometry-consumer.mjs');
      command('geometry-consumer', process.execPath, [consumer, fixturePath, out, join(geometryDir, 'witness-reference.py')]);
      command('independent', 'python3', ['-B', join(here, 'independent-check.py'), '--fixtures', fixturePath,
        '--generated', join(out, 'generated.json'), '--output', join(out, 'result.json')]);
      assert.equal(JSON.parse(readFileSync(join(out, 'result.json'))).status, 'REPLACEMENT_STRICT_GEOMETRY_PASS');
      if (canonical) {
        const previous = resolve(root, canonical);
        assert.deepEqual(JSON.parse(readFileSync(join(out, 'generated.json'))), JSON.parse(readFileSync(join(previous, 'generated.json'))), 'generated point/raw parity');
        assert.deepEqual(JSON.parse(readFileSync(join(out, 'controls.json'))), JSON.parse(readFileSync(join(previous, 'controls.json'))), 'feature control parity');
        save('parity', { passed: true, canonical: relative(root, previous), geometrySourceVsActualEmitted: true });
        const qualifiedSources = JSON.parse(readFileSync(join(previous, 'source.json'))).files
          .filter(f => /\.(ts|py|mjs)$/.test(f.path) && !f.path.includes('/evidence/'));
        for (const f of qualifiedSources) assert.equal(sha(readFileSync(resolve(root, f.path))), f.sha256, 'qualification source changed');
        save('qualification', { status: 'SOURCE_AND_ACTUAL_EMITTED_STRICT_GEOMETRY_QUALIFIED',
          fixtureSha256: sha(readFileSync(fixturePath)), sourceResultSha256: sha(readFileSync(join(previous, 'result.json'))),
          emittedResultSha256: sha(readFileSync(join(out, 'result.json'))), source: relative(root, previous),
          qualifiedSources, node: process.version });
      }
    } else {
      // No World run is admitted from a process exit alone: require both fixed-fixture gates.
      for (const name of ['geometry-source-02', 'geometry-emitted-02']) assert.equal(
        JSON.parse(readFileSync(join(here, 'evidence', name, 'result.json'))).status, 'REPLACEMENT_STRICT_GEOMETRY_PASS');
      assert.equal(JSON.parse(readFileSync(join(here, 'evidence/geometry-emitted-02/parity.json'))).passed, true);
      const qualification = JSON.parse(readFileSync(join(here, 'evidence/geometry-emitted-02/qualification.json')));
      assert.equal(qualification.status, 'SOURCE_AND_ACTUAL_EMITTED_STRICT_GEOMETRY_QUALIFIED');
      assert.equal(qualification.node, process.version);
      assert.equal(qualification.fixtureSha256, sha(readFileSync(fixturePath)));
      const numericalProviders = qualification.qualifiedSources.filter(f =>
        f.path.startsWith('examples/physics-rigid-feature-geometry/') && f.path.endsWith('.ts')
        || f.path.startsWith('packages/barocss-physics/src/') && f.path.endsWith('.ts')
        || f.path.startsWith('examples/physics-stack-solver-2276/') && /\/(candidate|verification|world-adapter)\.ts$/.test(f.path)
        || f.path === relative(root, join(here, 'geometry-entry.ts')) || f.path.endsWith('.py'));
      for (const path of ['examples/physics-rigid-feature-geometry/face-contact.ts', 'examples/physics-rigid-feature-geometry/strict-line.ts'])
        assert.ok(numericalProviders.some(f => f.path === path), 'qualified provider absent: ' + path);
      for (const f of numericalProviders) assert.equal(sha(readFileSync(resolve(root, f.path))), f.sha256, 'World admission provider changed since qualification: ' + f.path);
      const runnerChecks = JSON.parse(readFileSync(join(here, 'evidence/error-tests-02/commands.json')));
      assert.equal(runnerChecks.records[0].exit, 0);
      const testedSources = JSON.parse(readFileSync(join(here, 'evidence/error-tests-02/source.json'))).files;
      for (const name of ['step-observation.mjs', 'world-consumer.mjs', 'run.mjs']) {
        const f = testedSources.find(f => f.path === relative(root, join(here, name)));
        assert.ok(f); assert.equal(sha(readFileSync(resolve(root, f.path))), f.sha256, 'runner changed since execution-path tests');
      }
      save('admission', { passed: true, qualificationSha256: sha(readFileSync(join(here, 'evidence/geometry-emitted-02/qualification.json'))),
        qualifiedNumericalSourceCount: numericalProviders.length, runnerErrorTests: 'error-tests-02', selectedSteps: 16, node: process.version });
      const toolPath = await bundle('velocity-transform-tool', '../physics-stack-solver-2276/world-adapter.ts');
      const tool = await import(pathToFileURL(toolPath));
      const original = join(root, 'examples/physics-rigid-full-pair-position-world/global-island.ts');
      const transformed = tool.transformGlobalIslandSource(readFileSync(original, 'utf8'), join(solverDir, 'world-adapter.ts'));
      save('velocity-transform', transformed.receipt);
      writeFileSync(join(out, 'transformed-global-island.ts'), transformed.contents);
      let transformCalls = 0;
      const world = await bundle('world-consumer', 'world-consumer.mjs', [{ name: 'selected-cold-normal-solve', setup(api) {
        api.onLoad({ filter: /\/physics-rigid-full-pair-position-world\/global-island\.ts$/ }, args => {
          assert.equal(args.path, original); transformCalls++;
          return { contents: transformed.contents, loader: 'ts', resolveDir: dirname(original) };
        });
      } }]);
      assert.equal(transformCalls, 1);
      command('world-consumer', process.execPath, [world, out, canonical ? resolve(root, canonical) : '', '16'], 600000);
    }
  }
  for (const [path, hash] of snapshots) {
    if (mode === 'baseline' && !path.endsWith('.py')) continue;
    assert.equal(sha(readFileSync(path)), hash, 'source changed during run');
  }
} catch (error) {
  save('execution-failure', { name: error.name, message: error.message }); process.exitCode = 1;
}
