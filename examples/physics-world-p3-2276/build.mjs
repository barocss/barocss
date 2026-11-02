/** Build staged P3 providers only. Caller holds the repository heavy gate. No World calls. */
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync, copyFileSync, symlinkSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
const original = join(root, 'packages/barocss-physics');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const slash = path => path.split(sep).join('/');
const within = (parent, path) => path === parent || path.startsWith(parent + sep);
const readJSON = path => JSON.parse(readFileSync(path, 'utf8'));
const json = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const owned = ['src/model-admission.ts', 'src/world.ts', 'src/disjoint-hinge/admission.ts', 'src/disjoint-hinge/stage.ts'];
function need(test, message) { if (!test) throw Error(message); }
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    need(!entry.isSymbolicLink(), 'provider source must not contain symlinks');
    return entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)];
  }).sort();
}
function snapshot(directory, base = directory) {
  return Object.fromEntries(files(directory).map(path => [slash(relative(base, path)), sha(readFileSync(path))]));
}
function exactSnapshot(actual, expected, label) {
  need(expected && JSON.stringify(Object.entries(actual).sort()) === JSON.stringify(Object.entries(expected).sort()), label + ' differs from freeze');
}
function references(expected) {
  need(expected && Object.keys(expected).length > 0, 'referenceSources freeze is required');
  for (const [path, hash] of Object.entries(expected)) {
    need(!path.startsWith('/') && !path.split('/').includes('..') && sha(readFileSync(join(root, path))) === hash,
      'reference source freeze mismatch: ' + path);
  }
}

if (process.argv[2] === '--bundle-child') {
  const spec = readJSON(process.argv[3]), physics = realpathSync(spec.physics), effective = [];
  const observer = spec.observed ? await import(spec.observerURL) : null;
  const result = await build({ entryPoints: [join(physics, 'src/index.ts')], outfile: spec.outfile,
    bundle: true, format: 'esm', platform: spec.library ? 'browser' : 'node',
    target: spec.library ? 'es2022' : 'node22', logLevel: 'silent', metafile: true,
    external: spec.library ? ['./recording-owner.js', './types.js', './provider-manifest.generated.js'] : [],
    plugins: [{ name: 'owned-staged-physics-only', setup(api) {
      api.onResolve({ filter: /^@barocss\// }, args => { throw Error('numerical root must not resolve external product package: ' + args.path); });
      api.onLoad({ filter: /\.[cm]?[jt]s$/ }, args => {
        const path = realpathSync(args.path);
        need(within(join(physics, 'src'), path), 'cross-provider numerical input: ' + path);
        if (!observer) return;
        const rel = slash(relative(join(physics, 'src'), path)), source = readFileSync(path, 'utf8');
        const transformed = observer.instrumentP3Source(rel, source);
        if (!transformed.changed) return;
        need(transformed.originalSha256 === sha(source) && transformed.effectiveSha256 === sha(transformed.source), 'observer hash mismatch');
        effective.push({ path: rel, originalSha256: transformed.originalSha256,
          effectiveSha256: transformed.effectiveSha256, sites: transformed.sites });
        return { contents: transformed.source, loader: extname(path) === '.ts' ? 'ts' : 'js', resolveDir: dirname(path) };
      });
    } }],
  });
  const inputs = Object.keys(result.metafile.inputs).map(path => {
    const actual = realpathSync(resolve(process.cwd(), path));
    need(within(join(physics, 'src'), actual), 'bundle input escaped staged Physics source');
    return { path: slash(relative(physics, actual)), sha256: sha(readFileSync(actual)),
      effectiveSha256: effective.find(item => item.path === slash(relative(join(physics, 'src'), actual)))?.effectiveSha256 ?? sha(readFileSync(actual)) };
  });
  need(inputs.some(input => input.path === 'src/world.ts'), 'common World absent from root graph');
  if (observer) need(effective.length === 4, 'observed graph must transform exactly four agreed source files');
  json(spec.metafile, result.metafile);
  json(spec.graph, { kind: spec.library ? 'genuine-package-emission' : spec.observed ? 'sourceObserved' : 'sourceRepeat',
    actualEntry: join(physics, 'src/index.ts'), outfile: spec.outfile,
    sha256: sha(readFileSync(spec.outfile)), inputs, effective, modelsRun: 0, referencesRun: 0, cadBoundary: 'NONE' });
  process.exit(0);
}

const [runId, freezeArg] = process.argv.slice(2);
need(process.argv.length === 4 && /^[a-z0-9][a-z0-9-]{0,95}$/.test(runId ?? '') && freezeArg, 'usage: node build.mjs fresh-id absolute-freeze.json');
need(process.versions.node.startsWith('22.'), 'installed Node22 required');
const freezePath = resolve(freezeArg), freeze = readJSON(freezePath);
const out = join(here, 'evidence', runId);
need(!existsSync(out), 'fresh build ID required'); mkdirSync(out, { recursive: true });
const provider = join(out, 'provider'), physics = join(provider, 'packages/barocss-physics');
const commands = [], report = { kind: 'P3_STAGED_PROVIDER_BUILD', runId, status: 'IN_PROGRESS',
  node: process.version, execPath: process.execPath, platform: process.platform, arch: process.arch,
  freezePath, freezeSha256: sha(readFileSync(freezePath)), modelsRun: 0, referencesRun: 0, commands, firstFailure: null };
function fixedBytes() {
  function size(path) { return readdirSync(path, { withFileTypes: true }).reduce((sum, entry) => {
    if (entry.isSymbolicLink()) return sum;
    const file = join(path, entry.name);
    return sum + (entry.isDirectory() ? size(file) : readFileSync(file).length);
  }, 0); }
  const count = size(out); need(count <= 32 * 1024 * 1024, 'build fixed storage exceeded 32MiB'); return count;
}
function command(name, args, cwd = physics) {
  const start = Date.now(), result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', timeout: 180000, maxBuffer: 2 * 1024 * 1024 });
  for (const side of ['stdout', 'stderr']) writeFileSync(join(out, name + '.' + side), result[side] ?? '', { flag: 'wx' });
  commands.push({ name, command: [process.execPath, ...args], cwd, elapsedMs: Date.now() - start,
    exit: result.status, signal: result.signal, error: result.error?.message ?? null,
    stdoutSha256: sha(result.stdout ?? ''), stderrSha256: sha(result.stderr ?? '') });
  fixedBytes(); console.log(name + ': exit=' + result.status);
  need(result.status === 0 && !result.error && !result.signal, name + ' failed');
}
try {
  references(freeze.referenceSources);
  exactSnapshot(snapshot(join(original, 'src'), original), freeze.currentPhysicsSource, 'current Physics source');
  need(sha(readFileSync(join(original, 'package.json'))) === freeze.packageSha256 &&
    sha(readFileSync(join(original, 'tsconfig.json'))) === freeze.tsconfigSha256, 'package/tsconfig freeze mismatch');
  need(sha(readFileSync(join(here, 'candidate.patch'))) === freeze.candidatePatchSha256, 'candidate patch freeze mismatch');
  exactSnapshot(snapshot(join(here, 'candidate/src'), join(here, 'candidate')), freeze.candidateSources, 'candidate overlay');
  exactSnapshot(Object.fromEntries(owned.map(path => [path, freeze.candidateSources[path]])), freeze.candidateSources, 'exact four overlay files');
  for (const [name, expected] of Object.entries(freeze.harnessSources ?? {})) {
    need(!name.includes('/') && sha(readFileSync(join(here, name))) === expected, 'harness freeze mismatch: ' + name);
  }
  mkdirSync(physics, { recursive: true });
  for (const path of [...files(join(original, 'src')), join(original, 'package.json'), join(original, 'tsconfig.json')]) {
    const target = join(physics, relative(original, path)); mkdirSync(dirname(target), { recursive: true }); copyFileSync(path, target);
  }
  symlinkSync(realpathSync(join(root, 'node_modules')), join(provider, 'node_modules'), 'dir');
  for (const path of owned) {
    const target = join(physics, path); mkdirSync(dirname(target), { recursive: true }); copyFileSync(join(here, 'candidate', path), target);
  }
  copyFileSync(freezePath, join(out, 'input-freeze.json'));
  json(join(out, 'staged-before-generation.json'), snapshot(join(physics, 'src'), physics));
  command('generate-source-provider', [join(physics, 'src/generate-provider.mjs')]);
  const sourceHashes = snapshot(join(physics, 'src'), physics);
  json(join(out, 'staged-source-hashes.json'), sourceHashes);
  command('tsc', [join(root, 'node_modules/typescript/bin/tsc'), '-p', physics]);
  for (const [name, observed, library] of [['package-root', false, true], ['source-plain', false, false], ['source-observed', true, false]]) {
    const spec = { physics, observed, library, observerURL: new URL('./observe.mjs', import.meta.url).href,
      outfile: library ? join(physics, 'dist/index.js') : join(out, name + '.mjs'),
      metafile: join(out, name + '.metafile.json'), graph: join(out, name + '.graph.json') };
    const specPath = join(out, name + '.spec.json'); json(specPath, spec);
    command(name, [fileURLToPath(import.meta.url), '--bundle-child', specPath], root);
  }
  command('generate-emitted-provider', [join(physics, 'src/generate-provider.mjs'), '--emitted']);
  exactSnapshot(snapshot(join(physics, 'src'), physics), sourceHashes, 'staged source after build');
  const manifest = readJSON(join(physics, 'package.json'));
  const mapped = manifest.publishConfig?.exports?.['.']?.import;
  need(mapped === './dist/index.js', 'actual publish export is not staged dist/index.js');
  const emittedEntry = realpathSync(resolve(physics, mapped)), emitted = new Map();
  function visit(path) {
    const actual = realpathSync(path); need(within(join(physics, 'dist'), actual) && actual.endsWith('.js'), 'emitted graph escaped staged dist');
    if (emitted.has(actual)) return;
    const bytes = readFileSync(actual); emitted.set(actual, sha(bytes));
    for (const match of bytes.toString('utf8').matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
      need(match[1].startsWith('.'), 'external runtime product dependency in emitted root');
      visit(resolve(dirname(actual), match[1]));
    }
  }
  visit(emittedEntry);
  json(join(out, 'emitted-native.graph.json'), { kind: 'emittedNative', actualEntry: emittedEntry, publishConfigImport: mapped,
    inputs: [...emitted].map(([path, sha256]) => ({ path: slash(relative(physics, path)), sha256 })),
    runtimeMode: 'native ESM import, no source bundle/fallback', modelsRun: 0, referencesRun: 0, cadBoundary: 'NONE' });
  json(join(out, 'staged-emitted-hashes.json'), snapshot(join(physics, 'dist'), physics));
  report.graphs = { sourceObserved: { entry: join(out, 'source-observed.mjs'), graph: join(out, 'source-observed.graph.json') },
    sourceRepeat: { entry: join(out, 'source-plain.mjs'), graph: join(out, 'source-plain.graph.json') },
    emittedNative: { entry: emittedEntry, graph: join(out, 'emitted-native.graph.json') } };
  report.physics = physics; report.sourceHashes = sourceHashes;
  exactSnapshot(snapshot(join(original, 'src'), original), freeze.currentPhysicsSource, 'original Physics after staged build');
  references(freeze.referenceSources);
  report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.firstFailure = { name: error.name, message: error.message, stack: error.stack }; process.exitCode = 1; }
report.fixedBytesBeforeReceipt = fixedBytes();
json(join(out, 'build.json'), report);
console.log(JSON.stringify({ runId, status: report.status, firstFailure: report.firstFailure, modelsRun: 0 }));
