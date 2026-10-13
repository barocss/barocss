/** Exercises the REAL source clip function without adding it to the public API.
 * The implementation is bundled unchanged except for a test-only export.
 */
import { build } from 'esbuild';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'physics-clip-boundary-'));
let sourceLoads = 0;
try {
  const outfile = join(dir, 'manifold.mjs');
  await build({
    entryPoints: [resolve('packages/barocss-physics/src/contact-manifold.ts')],
    outfile, bundle: true, format: 'esm', platform: 'node', target: 'node22',
    plugins: [{
      name: 'expose-internal-clip-for-regression',
      setup(api) {
        api.onLoad({ filter: /contact-manifold\.ts$/ }, async (args) => {
          sourceLoads++;
          const source = await readFile(args.path, 'utf8');
          if (source.split('function clip(').length !== 2)
            throw Error('CLIP_BOUNDARY_SOURCE_CHANGED');
          return { loader: 'ts', contents: source + '\nexport { clip as __clipForTest };\n' };
        });
      },
    }],
  });
  if (sourceLoads !== 1) throw Error('CLIP_BOUNDARY_BUNDLE_MISMATCH');
  const { __clipForTest: clip } = await import(pathToFileURL(outfile).href);
  if (typeof clip !== 'function') throw Error('CLIP_BOUNDARY_NOT_EXPORTED');

  // A vertex *inside the 1 nm boundary tolerance* and another just outside
  // used to trigger an intersection at x=0 (off the source edge), because
  // classification used x<=1 nm while interpolation solved for x=0.
  const polygon = [
    [0.5e-9, 0, 0],
    [2e-9, 0, 0],
    [2e-9, 1, 0],
    [0.5e-9, 1, 0],
  ];
  const clipped = clip(polygon, [0, 0, 0], [1, 0, 0], 0);
  if (clipped.length !== 4) throw Error('CLIP_BOUNDARY_VERTEX_COUNT:' + clipped.length);
  for (const [x, y, z] of clipped) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z))
      throw Error('CLIP_BOUNDARY_NONFINITE');
    if (x < 0.5e-9 - 1e-15 || x > 1e-9 + 1e-15)
      throw Error('CLIP_BOUNDARY_INTERSECTION_OUTSIDE_EDGE:' + x);
    if (y < -1e-15 || y > 1 + 1e-15 || Math.abs(z) > 1e-15)
      throw Error('CLIP_BOUNDARY_BAD_TANGENT');
  }
  // Preserve #1876's explicit near-band boundary-count witness as well.
  const nearBoundaryCount = clipped.filter(p => Math.abs(p[0] - 1e-9) < 1e-12).length;
  if (nearBoundaryCount !== 2) throw Error('CLIP_NEAR_TOLERANCE_CROSSING');

  // Repeat with an exact boundary crossing; the 1 nm tolerance plane must
  // locate the intersections at 1 nm on the original polygon segments.
  const exact = clip([[0, 0, 0], [2e-9, 0, 0], [2e-9, 1, 0], [0, 1, 0]],
    [0, 0, 0], [1, 0, 0], 0);
  if (exact.length !== 4 || exact.filter(p => Math.abs(p[0] - 1e-9) <= 1e-15).length !== 2)
    throw Error('CLIP_BOUNDARY_WRONG_PLANE');

  // Preserve #1876's distinct macroscopic crossing using this same actual
  // source function, without its implementation-spelling requirement.
  const wide = clip([[-1, 0, 0], [1, 0, 0], [1, 1, 0], [-1, 1, 0]],
    [0, 0, 0], [1, 0, 0], 0);
  const wideBoundaryCount = wide.filter(p => Math.abs(p[0] - 1e-9) < 1e-12).length;
  if (wide.length !== 4 || wideBoundaryCount !== 2) throw Error('CLIP_BOUNDARY_WITNESS');
  for (const point of wide) {
    if (point[0] > 1e-9 + 1e-12 || !point.every(Number.isFinite))
      throw Error('CLIP_OUTSIDE_TOLERANT_HALFSPACE');
  }
  console.log(JSON.stringify({ status: 'PASS', sourceLoads,
    toleranceM: 1e-9, nearBoundaryVertices: clipped.length,
    exactBoundaryVertices: exact.length, nearBoundaryCount,
    wideBoundaryVertices: wide.length, wideBoundaryCount, clipCalls: 3,
    preservedCompanion: 1876, publicApiChanged: false, physicalEightBoxGO: false }));
} finally {
  await rm(dir, { recursive: true, force: true });
}
