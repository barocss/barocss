// Generate only the three documented public Part API results from this fixed CAD source.
// node apps/library-docs/scripts/api-result-scenes.mjs [--out /absolute/output.json]
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire, isBuiltin } from 'node:module';
import { constants, copyFileSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const SOURCE_COMMIT = '8cddcd05fd3a388472d5a01b4a43e09cdf8a50aa';
const CAD_PATH = 'packages/barocss-cad';
const CAD_TREE = '61e967638890baeaab74c8b3940f7c8a50333d11';
const repo = resolve(import.meta.dirname, '../../..');
const args = process.argv.slice(2);
assert.ok(args.length === 0 || (args.length === 2 && args[0] === '--out' && args[1]),
  'Usage: node scripts/api-result-scenes.mjs [--out /absolute/output.json]');
const target = args.length ? resolve(args[1]) : join(repo, 'apps/library-docs/docs/.vitepress/components/api-result-scenes.json');
const git = (...arguments_) => execFileSync('git', ['-C', repo, ...arguments_], { encoding: 'utf8' }).trim();
const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex');

const within = (root, path) => {
  const rel = relative(root, path);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`));
};
// Evidence is written only beside an explicitly selected output outside this worktree.
if (args.length) assert.ok(!within(repo, target), '--out must be outside the worktree to preserve producer evidence');
function preserveProducerEvidence(bundle, metafile) {
  const directory = join(dirname(target), 'producer-evidence');
  mkdirSync(directory, { recursive: true });
  copyFileSync(bundle, join(directory, 'source.mjs'), constants.COPYFILE_EXCL);
  writeFileSync(join(directory, 'metafile.json'), JSON.stringify(metafile, null, 2) + '\n', { flag: 'wx' });
  const inputs = [], externalEdges = [], unresolved = [];
  for (const [key, metadata] of Object.entries(metafile.inputs)) {
    const record = { inputKey: key, esbuildBytes: metadata.bytes };
    try {
      if (key.startsWith('<') || /^[a-z][a-z0-9+.-]*:/i.test(key)) throw new Error('virtual or namespaced input is not a filesystem path');
      const path = resolve(repo, key), info = statSync(path);
      if (!info.isFile()) throw new Error('metafile input is not a regular file');
      const data = readFileSync(path), realPath = realpathSync(path), relativePath = relative(repo, path);
      const parts = relativePath.split(sep), inWorktree = within(repo, path);
      Object.assign(record, {
        path, realPath, bytes: data.length,
        sha256: createHash('sha256').update(data).digest('hex'),
        mode: `0o${(info.mode & 0o7777).toString(8)}`,
        packageBoundary: !inWorktree ? 'outside-worktree' : parts[0] === 'packages' || parts[0] === 'apps' ? parts.slice(0, 2).join('/') : parts[0],
        distBoundary: { pathContainsDist: path.split(sep).includes('dist'), realPathContainsDist: realPath.split(sep).includes('dist') },
        pinnedCADSource: within(join(repo, CAD_PATH, 'src'), path),
        physicalPathInsideWorktree: within(repo, realPath),
      });
      if (info.size !== data.length) throw new Error('file size changed while preserving input bytes');
      if (metadata.bytes !== data.length) throw new Error('actual input byte count differs from the esbuild metafile');
      if (within(join(repo, CAD_PATH, 'dist'), path) || within(join(repo, CAD_PATH, 'dist'), realPath)) throw new Error('CAD dist cannot enter this source-only bundle');
      record.status = 'FILE_BOUND';
    } catch (error) {
      record.status = 'UNRESOLVED';
      record.reason = error instanceof Error ? error.message : String(error);
      unresolved.push({ inputKey: key, reason: record.reason });
    }
    inputs.push(record);
    for (const dependency of metadata.imports ?? []) if (dependency.external) {
      const nodeBuiltin = isBuiltin(dependency.path);
      // Input-graph external edges describe the build; they are not retained-output or runtime claims.
      externalEdges.push({ fromInput: key, ...dependency, role: 'INPUT_GRAPH_METADATA',
        classification: nodeBuiltin ? 'NODE_BUILTIN_EXTERNAL' : 'INPUT_EXTERNAL_METADATA' });
    }
  }
  const outputExternalEdges = [];
  for (const [output, metadata] of Object.entries(metafile.outputs)) {
    for (const dependency of metadata.imports ?? []) if (dependency.external) {
      const nodeBuiltin = isBuiltin(dependency.path);
      outputExternalEdges.push({ fromOutput: output, ...dependency, role: 'RETAINED_OUTPUT_EXTERNAL',
        classification: nodeBuiltin ? 'NODE_BUILTIN_EXTERNAL' : 'UNBOUND_EXTERNAL' });
      if (!nodeBuiltin) unresolved.push({ output, externalPath: dependency.path, reason: 'output retains an unbound non-Node external module' });
    }
  }
  for (const edge of externalEdges) {
    edge.matchingOutputExternalSpecifiers = outputExternalEdges
      .filter(output => output.path === edge.path)
      .map(({ fromOutput, path, kind }) => ({ fromOutput, path, kind }));
    edge.outputMatchBasis = 'Exact specifier string match in metafile.outputs imports; not a module-identity or runtime-reachability proof.';
    edge.runtimeReachability = 'UNKNOWN';
  }
  const bundleData = readFileSync(bundle);
  const evidence = {
    format: 'api-result-producer-inputs-v1', sourceRoot: repo,
    pinnedCADSourceCommit: SOURCE_COMMIT, pinnedCADTreeSHA1: CAD_TREE,
    bundle: { savedPath: 'source.mjs', bytes: bundleData.length, sha256: createHash('sha256').update(bundleData).digest('hex') },
    inputs, externalEdges, outputExternalEdges, unresolved,
    boundary: 'Actual esbuild filesystem inputs are bound separately. Input external edges are build metadata; an absent output-specifier match does not prove removal or tree shaking. Retained non-Node output externals are refused. Node builtin edges are not filesystem inputs. Full producer/toolchain/runtime read graph UNKNOWN.',
  };
  writeFileSync(join(directory, 'inputs.json'), JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
  assert.equal(unresolved.length, 0, `Unresolved producer inputs were preserved in inputs.json: ${JSON.stringify(unresolved)}`);
}

// Docs and producer edits may differ; the CAD package used by the source bundle must not.
assert.equal(git('rev-parse', `${SOURCE_COMMIT}:${CAD_PATH}`), CAD_TREE, 'Pinned CAD tree does not match the producer');
assert.equal(git('rev-parse', `HEAD:${CAD_PATH}`), CAD_TREE, 'Current committed CAD tree differs from the pinned source');
execFileSync('git', ['-C', repo, 'diff', '--quiet', SOURCE_COMMIT, '--', CAD_PATH], { stdio: 'pipe' });
assert.equal(git('ls-files', '--others', '--exclude-standard', '--', `${CAD_PATH}/src`), '', 'Untracked CAD source cannot enter this fixed-source generator');

const producerPaths = [
  'apps/library-docs/scripts/api-result-scenes.mjs',
  'apps/library-docs/scripts/api-result-scenes-source.mjs',
];
const provenance = {
  sourceCommit: SOURCE_COMMIT,
  cadPackagePath: CAD_PATH,
  cadTreeSHA1: CAD_TREE,
  sourceVerification: 'Pinned Git tree equals the current CAD tree; tracked CAD files are unchanged and CAD src has no untracked files.',
  producerFiles: producerPaths.map(path => ({ path, sha256: digest(join(repo, path)) })),
  publicAPI: '@barocss/cad/api',
  sample: { path: 'apps/library-docs/samples/cad-api.test.mjs', lines: [16, 24], sourceCommit: SOURCE_COMMIT },
  frame: 'Z-up',
  units: { positions: 'mm', volume: 'mm³', mass: 'g', centroid: 'mm', inertia: 'g·mm² about the centre of mass', density: 'g/cm³' },
  density: 2.7,
  display: {
    source: 'Public Part.meshes() Float32 tessellation',
    packing: 'Public positions, normals and indices are copied without re-tessellation or rounding; display line segment pairs are grouped in arrays of six numbers.',
    boundary: 'Display triangles approximate native surfaces. They do not establish a geometric tolerance guarantee. Mass values come from Part.mass(), not from display triangles.',
  },
};
const { build } = createRequire(join(repo, 'package.json'))('esbuild');
const temp = mkdtempSync(join(tmpdir(), 'api-result-scenes-'));
try {
  const file = join(temp, 'source.mjs');
  const result = await build({
    entryPoints: [join(import.meta.dirname, 'api-result-scenes-source.mjs')], outfile: file,
    bundle: true, platform: 'node', format: 'esm', target: 'node22',
    absWorkingDir: repo, metafile: true,
    alias: { '@barocss/cad': join(repo, `${CAD_PATH}/src`) }, logLevel: 'warning',
  });
  if (args.length) preserveProducerEvidence(file, result.metafile);
  const { buildScenes } = await import(pathToFileURL(file).href);
  const { cases, analyticChecks } = buildScenes();
  const text = JSON.stringify({ format: 'api-result-scenes-v1', provenance: { ...provenance, analyticChecks }, cases }) + '\n';
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
  console.log(`Public API result scenes: ${cases.length} cases, ${Buffer.byteLength(text)} bytes`);
} finally { rmSync(temp, { recursive: true, force: true }); }
