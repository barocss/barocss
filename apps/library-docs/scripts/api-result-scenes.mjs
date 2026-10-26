// Generate only the three documented public Part API results from this fixed CAD source.
// node apps/library-docs/scripts/api-result-scenes.mjs [--out /absolute/output.json]
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
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
  await build({
    entryPoints: [join(import.meta.dirname, 'api-result-scenes-source.mjs')], outfile: file,
    bundle: true, platform: 'node', format: 'esm', target: 'node22',
    alias: { '@barocss/cad': join(repo, `${CAD_PATH}/src`) }, logLevel: 'warning',
  });
  const { buildScenes } = await import(pathToFileURL(file).href);
  const { cases, analyticChecks } = buildScenes();
  const text = JSON.stringify({ format: 'api-result-scenes-v1', provenance: { ...provenance, analyticChecks }, cases }) + '\n';
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
  console.log(`Public API result scenes: ${cases.length} cases, ${Buffer.byteLength(text)} bytes`);
} finally { rmSync(temp, { recursive: true, force: true }); }
