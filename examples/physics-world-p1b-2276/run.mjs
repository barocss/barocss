// Bounded, local source/emitted proof. Parent holds the heavy-lane gate.
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const physics = join(root, 'packages/barocss-physics');
const cad = join(root, 'packages/barocss-cad');
const sha = data => createHash('sha256').update(data).digest('hex');
const slash = path => path.split(sep).join('/');
const within = (parent, path) => path === parent || path.startsWith(parent + sep);
const json = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const manifest = readJson(join(physics, 'package.json'));
function mappedEntry(packageRoot, packageManifest, name, emitted, allowSourceFallback = false) {
  const subpath = name === '' ? '.' : './' + name;
  const map = emitted ? packageManifest.publishConfig?.exports : packageManifest.exports;
  const item = map?.[subpath];
  const target = typeof item === 'string' ? item : emitted ? item?.import : item?.['barocss-source'] ?? item?.import;
  if (typeof target !== 'string') throw new Error(`missing actual ${emitted ? 'publish' : 'source'} map: ${packageManifest.name}${subpath}`);
  const path = resolve(packageRoot, target);
  if (!within(packageRoot, path)) throw new Error('package map escapes its owner');
  if (existsSync(path)) return path;
  if (emitted && allowSourceFallback) return mappedEntry(packageRoot, packageManifest, name, false);
  throw new Error(`mapped provider is absent: ${path}`);
}

// A bounded child owns esbuild so timeout/output limits also apply to compilation.
if (process.argv[2] === '--bundle-child') {
  const spec = readJson(process.argv[3]);
  const effective = [];
  const ownRoot = realpathSync(root);
  const cadManifest = readJson(join(cad, 'package.json'));
  const entry = resolve(spec.entry);
  const result = await build({ entryPoints: [entry], outfile: spec.outfile,
    bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'silent', metafile: true,
    plugins: [{ name: 'exact-owned-physics-provider', setup(api) {
      api.onResolve({ filter: /^@barocss\/physics(?:\/.*)?$/ }, args => ({
        path: mappedEntry(physics, manifest, args.path.slice('@barocss/physics'.length).replace(/^\//, ''), spec.emitted),
      }));
      api.onResolve({ filter: /^@barocss\/cad(?:\/.*)?$/ }, args => ({
        path: mappedEntry(cad, cadManifest, args.path.slice('@barocss/cad'.length).replace(/^\//, ''), spec.emitted, false),
      }));
      api.onResolve({ filter: /(?:^\.|^\/).*\.(?:js|ts)$/ }, args => {
        const path = resolve(args.resolveDir, args.path);
        if (!within(physics, path)) return undefined;
        const local = slash(relative(physics, path));
        if (!/^(?:src|dist)\//.test(local)) return undefined;
        const suffix = local.replace(/^(?:src|dist)\//, '').replace(/\.(?:js|ts)$/, spec.emitted ? '.js' : '.ts');
        const chosen = join(physics, spec.emitted ? 'dist' : 'src', suffix);
        if (!existsSync(chosen)) throw new Error(`missing owned Physics file provider: ${chosen}`);
        return { path: chosen };
      });
      api.onLoad({ filter: /\.(?:mjs|js|ts)$/ }, args => {
        if (resolve(args.path) !== entry) return undefined;
        const original = readFileSync(args.path, 'utf8');
        if (!original.includes('import.meta.url')) return undefined;
        // Preserve each entry's resource URLs when its bundle moves into evidence.
        const contents = original.replaceAll('import.meta.url', JSON.stringify(pathToFileURL(entry).href));
        effective.push({ path: slash(relative(root, entry)), originalSha256: sha(original),
          effectiveSha256: sha(contents), change: 'entry import.meta.url preserves original resource base' });
        return { contents, loader: extname(entry) === '.ts' ? 'ts' : 'js', resolveDir: dirname(entry) };
      });
    } }],
  });
  const inputs = Object.keys(result.metafile.inputs).map(name => {
    const path = realpathSync(resolve(root, name));
    const rel = slash(relative(root, path));
    // Dependency tooling can use the installed shared node_modules. Product
    // providers must come from this worktree, including transitive CAD inputs.
    if (!within(ownRoot, path) && /\/packages\/barocss-[^/]+\//.test(slash(path))) throw new Error(`cross-worktree product input: ${path}`);
    if (within(physics, path)) {
      const expected = join(physics, spec.emitted ? 'dist' : 'src');
      if (!within(expected, path) || (spec.emitted && path.endsWith('.ts'))) throw new Error(`wrong Physics provider graph: ${path}`);
    }
    const transformation = effective.find(item => item.path === rel);
    return { path: rel, absolutePath: path, sha256: sha(readFileSync(path)),
      effectiveSha256: transformation?.effectiveSha256 ?? sha(readFileSync(path)),
      physicsProvider: within(physics, path), cadSourceBoundary: within(join(cad, 'src'), path) };
  });
  const physicsInputs = inputs.filter(input => input.physicsProvider);
  if (physicsInputs.length === 0) throw new Error('bundle did not resolve an actual Physics provider');
  json(spec.metafile, result.metafile);
  json(spec.graph, { emitted: spec.emitted, entry: slash(relative(root, entry)),
    bundleSha256: sha(readFileSync(spec.outfile)), inputs, effective,
    cadBoundary: inputs.some(input => input.cadSourceBoundary) ? 'CAD source adapter boundary; Physics provider is still strictly emitted/source as selected' : 'no CAD TypeScript source' });
  process.exit(0);
}

const mode = process.argv[2], runId = process.argv[3];
const modes = ['source', 'emitted', 'probes-source', 'probes-emitted', 'foundation-source', 'foundation-emitted'];
if (!modes.includes(mode) || !/^[a-z0-9][a-z0-9-]{0,95}$/.test(runId ?? '') || process.argv.length !== 4) {
  throw new Error(`usage: node run.mjs <${modes.join('|')}> <fresh-run-id>`);
}
if (Number(process.versions.node.split('.')[0]) !== 22) throw new Error('Use installed Node22');
const emitted = mode.endsWith('emitted');
const out = join(here, 'evidence', runId);
if (existsSync(out)) throw new Error(`prior attempt must be preserved: ${out}`);
mkdirSync(out, { recursive: true });
const records = [], graphs = [];
const report = { workId: 'physics-world-p1b-2276', mode, runId, node: process.version,
  executable: process.execPath, platform: process.platform, arch: process.arch,
  runnerSha256: sha(readFileSync(fileURLToPath(import.meta.url))), records, graphs,
  status: 'RUNNING', firstFailure: null,
  proofBoundary: 'Selected actual source/emitted consumer graphs only; no stable-stack or two-hinge qualification, install, remote mutation or release.',
  cadence: 'first failure stops the run; each child timeout180s and output16MiB' };
const save = () => json(join(out, 'commands.json'), report);
function command(name, executable, args, cwd = root) {
  const started = new Date().toISOString(), start = Date.now();
  const result = spawnSync(executable, args, { cwd, encoding: 'utf8',
    timeout: 180000, maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, P1B_PROOF_KIND: emitted ? 'emitted' : 'source' } });
  writeFileSync(join(out, `${name}.stdout`), result.stdout ?? '');
  writeFileSync(join(out, `${name}.stderr`), result.stderr ?? '');
  records.push({ name, command: [executable, ...args], cwd, started,
    finished: new Date().toISOString(), elapsedMs: Date.now() - start, exit: result.status,
    signal: result.signal, error: result.error?.message ?? null,
    stdoutSha256: sha(result.stdout ?? ''), stderrSha256: sha(result.stderr ?? '') });
  save();
  console.log(`${name}: exit=${result.status} signal=${result.signal ?? 'none'}`);
  if (result.status !== 0 || result.error || result.signal) throw new Error(`${name} failed; exact streams retained`);
  return result.stdout;
}
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? files(join(directory, entry.name)) : [join(directory, entry.name)]).sort();
}
function snapshot(directory) {
  return Object.fromEntries(files(directory).map(path => [slash(relative(root, path)), sha(readFileSync(path))]));
}
function copyProvider(directory, label) {
  for (const path of files(directory)) {
    const destination = join(out, 'provider', label, relative(directory, path));
    mkdirSync(dirname(destination), { recursive: true }); copyFileSync(path, destination);
  }
}
const regenerate = name => command(name, process.execPath, [join(physics, 'src/generate-provider.mjs')]);
let frozenSource, frozenEmitted;
function unchangedSource(label) {
  const actual = snapshot(join(physics, 'src'));
  json(join(out, `${label}-source-hashes.json`), actual);
  if (JSON.stringify(actual) !== JSON.stringify(frozenSource)) throw new Error(`Physics source changed during ${label}`);
  if (frozenEmitted && JSON.stringify(snapshot(join(physics, 'dist'))) !== JSON.stringify(frozenEmitted)) throw new Error(`Physics emitted provider changed during ${label}`);
}
async function bundleAndRun(name, entry, test = false) {
  if (!emitted) regenerate(`${name}-source-manifest`);
  unchangedSource(`${name}-before-bundle`);
  const outfile = join(out, `${name}.mjs`), metafile = join(out, `${name}.metafile.json`), graph = join(out, `${name}.graph.json`);
  const spec = join(out, `${name}.bundle.json`);
  json(spec, { emitted, entry, outfile, metafile, graph });
  command(`${name}-bundle`, process.execPath, [fileURLToPath(import.meta.url), '--bundle-child', spec]);
  const evidence = readJson(graph);
  for (const input of evidence.inputs) {
    const destination = within(root, input.absolutePath) ? join(out, 'provider', 'inputs', input.path)
      : join(out, 'provider', 'installed-dependencies', input.sha256 + extname(input.absolutePath));
    mkdirSync(dirname(destination), { recursive: true });
    if (!existsSync(destination)) copyFileSync(input.absolutePath, destination);
    if (sha(readFileSync(input.absolutePath)) !== input.sha256) throw new Error(`provider changed after bundle: ${input.path}`);
  }
  graphs.push({ name, graph: relative(out, graph), bundleSha256: evidence.bundleSha256,
    cadBoundary: evidence.cadBoundary, physicsInputs: evidence.inputs.filter(input => input.physicsProvider).length });
  save();
  command(`${name}-run`, process.execPath, [...(test ? ['--test'] : []), outfile]);
  unchangedSource(`${name}-after-run`);
  for (const resource of report.resourceInputs ?? []) {
    if (sha(readFileSync(join(root, resource.path))) !== resource.sha256) throw new Error(`runtime resource changed: ${resource.path}`);
  }
}
const rigidProbes = ['probe', 'controls-probe', 'events-queries-probe', 'rotation-probe',
  'oriented-colliders-probe', 'friction-stack-probe', 'joints-probe', 'ccd-probe', 'broadphase-probe',
  'box-point-probe', 'persistent-box-probe', 'rigid-pairs-probe', 'large-scene-probe', 'ccd-pair-probe',
  'dynamic-fixed-pair-probe', 'dynamic-hinge-motor-probe', 'hinge-motor-probe', 'offset-hinge-probe', 'thin-box-ccd-probe'];
try {
  report.head = command('head', 'git', ['rev-parse', 'HEAD']).trim();
  report.dirty = command('working-tree', 'git', ['status', '--short']);
  json(join(out, 'pre-generation-source-hashes.json'), snapshot(join(physics, 'src')));
  regenerate('provider-source-generation');
  frozenSource = snapshot(join(physics, 'src'));
  json(join(out, 'frozen-source-hashes.json'), frozenSource);
  copyProvider(join(physics, 'src'), 'source');
  copyFileSync(fileURLToPath(import.meta.url), join(out, 'provider', 'runner.mjs'));
  report.resourceInputs = ['packages/barocss-physics/design/p0/encoding-vectors.json',
    'packages/barocss-physics/design/p0/profiles.json', 'examples/physics-cad-scene/two-surfaces.barocad']
    .filter(path => existsSync(join(root, path))).map(path => {
      const destination = join(out, 'provider', 'resources', path);
      mkdirSync(dirname(destination), { recursive: true }); copyFileSync(join(root, path), destination);
      return { path, sha256: sha(readFileSync(join(root, path))) };
    });
  copyFileSync(join(physics, 'package.json'), join(out, 'provider', 'physics-package.json'));
  if (emitted) {
    command('package-tsc', process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', physics]);
    command('package-root-bundle', join(root, 'node_modules/esbuild/bin/esbuild'), [
      join(physics, 'src/index.ts'), '--bundle', '--format=esm', '--platform=browser', '--target=es2022',
      '--external:./types.js', '--external:./provider-manifest.generated.js', '--metafile=' + join(out, 'package-root.metafile.json'),
      '--outfile=' + join(physics, 'dist/index.js')]);
    command('provider-emitted-generation', process.execPath, [join(physics, 'src/generate-provider.mjs'), '--emitted']);
    unchangedSource('post-emission');
    frozenEmitted = snapshot(join(physics, 'dist'));
    json(join(out, 'emitted-hashes.json'), frozenEmitted);
    copyProvider(join(physics, 'dist'), 'emitted');
  }
  if (mode.startsWith('probes-')) {
    report.selectedEntries = [...rigidProbes.map(name => `examples/physics-scene/${name}.mjs`),
      'examples/physics-scene/replay-probe.mjs', 'examples/physics-cad-scene/cad-proxy-probe.mjs'];
    report.excludedProbes = 'packed release-consumer, mapping-only source-import-probe, fluid and cloth campaigns';
    for (const entry of report.selectedEntries) await bundleAndRun(entry.split('/').at(-1).replace('.mjs', ''), join(root, entry));
  } else if (mode.startsWith('foundation-')) {
    report.selectedEntries = ['world', 'contact', 'pendulum', 'baseline', 'units']
      .map(name => `examples/physics-motion-foundations-2276/${name}.test.ts`);
    for (const entry of report.selectedEntries) await bundleAndRun(entry.split('/').at(-1).replace('.test.ts', ''), join(root, entry), true);
  } else {
    report.selectedEntries = ['examples/physics-world-p1b-2276/public.test.mjs'];
    await bundleAndRun('public.test', join(here, 'public.test.mjs'), true);
  }
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL'; report.firstFailure = error.stack ?? String(error);
  writeFileSync(join(out, 'runner-failure.txt'), report.firstFailure + '\n');
  process.exitCode = 1;
} finally { save(); }
