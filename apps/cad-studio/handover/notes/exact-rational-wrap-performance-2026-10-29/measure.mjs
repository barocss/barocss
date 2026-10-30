// Run from packages/barocss-cad after node scripts/tool.mjs build.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const dist = pathToFileURL(resolve('dist')).href;
const K = await import(`${dist}/index.js`);
const { buildCylindricalWrapClosedReference } = await import(`${dist}/features/cylindrical-wrap-closed-reference.js`);
const budgets = { volume: 1e-8, mass: 1e-10, centroid: [1e-10, 1e-10, 1e-10], inertia: [1e-7, 1e-7, 1e-7, 1e-7, 1e-7, 1e-7] };
const cases = [
  { label: 'standard', z: 0, u: [1 / 16, 5 / 16], v: [0.25, 0.75], density: 1 },
  { label: 'centered', z: -5, u: [0.125, 0.375], v: [0.25, 0.75], density: 7.85 },
  { label: 'lower', z: -5, u: [0.125, 0.375], v: [0.25, 0.5], density: 1 },
  { label: 'upper', z: -5, u: [0.125, 0.375], v: [0.5, 0.75], density: 1 },
  { label: 'asymmetric', z: -7, u: [0.1, 0.4], v: [0.2, 0.7], density: 7.85 },
  { label: 'asymmetric-mirrored', z: -7, u: [0.1, 0.4], v: [0.3, 0.8], density: 7.85 },
];
const results = [];
for (const input of cases) {
  const solid = K.prismaticFromProfile({ outer: [{ kind: 'arc', start: [10, 0], center: [0, 0], direction: 'ccw' }], height: 30, from: input.z, tag: 'post' });
  const part = { solid: { kind: 'upright', solid }, brep: K.brepFromPrismatic(solid, { id: 'post' }) };
  const [a, b] = input.u, [c, d] = input.v;
  const result = buildCylindricalWrapClosedReference(part, [{ outer: [[a, c], [b, c], [b, d], [a, d]], holes: [] }], { id: 'wrap', height: 10, density: input.density, budgets });
  results.push({ input, counts: result.counts, limits: result.limits, meaning: result.meaning,
    nativeCounts: result.walls.reference.native.nativeBinding.counts, formalCounts: result.walls.reference.formal.counts,
    closure: { maximumNativeToReferenceL1: result.closure.maximumNativeToReferenceL1, tolerance: result.closure.tolerance, topology: result.closure.topology, nativeFaceDomain: result.closure.nativeFaceDomain, closedReferenceCertified: result.closure.closedReferenceCertified },
    mass: result.mass });
}
process.stdout.write(JSON.stringify({ budgets, results }, null, 2) + '\n');
