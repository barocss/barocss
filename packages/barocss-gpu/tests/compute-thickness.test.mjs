// G25a (G-R11), experimental compute: wall thickness's rays and its CPU mirror on the packed hierarchy (the GPU pass's
// reference; the GPU run itself is compute-thickness-browser.test.mjs). The rays are IM4's: each triangle's centre,
// its normal reversed. Oracle: a 40 × 30 × 8 box's top and bottom triangles read 8 deep and 8 thick; every triangle
// equals the kernel's rayHit + nearestDistance2 composed the same way (1e-5 of the mesh's size); a degenerate one has no ray.
import test from 'node:test';
import assert from 'node:assert/strict';
import { triangleBvh, rayHit, nearestDistance2 } from '@barocss/cad';
import { packBvh } from '../dist/compute/bvhPack.js';
import { cpuWallThickness, wallRays } from '../dist/compute/thickness.js';

function box(lo, hi) {
  const P = []; for (let i = 0; i < 8; i++) P.push(i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]);
  return { positions: P, indices: [0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6, 0, 1, 4, 1, 5, 4, 2, 6, 3, 3, 6, 7, 0, 4, 2, 2, 4, 6, 1, 3, 5, 3, 7, 5] };
}
/** A hollow cylinder (tube) of outer R, inner r, height h about z: outward walls outside, inward inside. */
function tube(R, r, h, n) {
  const P = [], I = [];
  for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; for (const [rad, z] of [[R, 0], [R, h], [r, 0], [r, h]]) P.push(rad * Math.cos(a), rad * Math.sin(a), z); }
  for (let i = 0; i < n; i++) {
    const a = 4 * i, b = 4 * ((i + 1) % n);
    I.push(a, b, a + 1, b, b + 1, a + 1);            // outer wall, outward
    I.push(a + 2, a + 3, b + 2, b + 2, a + 3, b + 3); // inner wall, toward the axis
    I.push(a + 1, b + 1, a + 3, b + 1, b + 3, a + 3); // top ring
    I.push(a, a + 2, b, b, a + 2, b + 2);             // bottom ring
  }
  return { positions: P, indices: I };
}

test('a box: the top and bottom triangles 8 deep and 8 thick; every triangle as the kernel composes it', () => {
  const m = box([100, -20, 3], [140, 10, 11]), bvh = triangleBvh(m.positions, m.indices), p = packBvh(bvh), rays = wallRays(m.positions, m.indices), out = cpuWallThickness(p, rays);
  for (const t of [0, 1, 2, 3]) { assert.ok(Math.abs(out.depth[t] - 8) < 1e-4, `bottom/top ${t}: ${out.depth[t]}`); assert.ok(Math.abs(out.local[t] - 8) < 1e-4, `local ${t}: ${out.local[t]}`); }
  assertLikeKernel(m, bvh, rays, out);
});

test('a tube Ø60/Ø50, 40 high, 96 sides: the wall reads 5 across at its middle; every triangle as the kernel composes it', () => {
  const m = tube(30, 25, 40, 96), bvh = triangleBvh(m.positions, m.indices), p = packBvh(bvh), rays = wallRays(m.positions, m.indices), out = cpuWallThickness(p, rays);
  // (An outer wall triangle's ray goes in radially-ish to the inner wall: about 5, less the chord's sag.)
  const outer = out.local[0];
  assert.ok(outer > 4.9 && outer < 5.1, String(outer));
  assertLikeKernel(m, bvh, rays, out);
});

test('a degenerate triangle has no ray and reads Infinity', () => {
  const m = box([0, 0, 0], [1, 1, 1]); m.positions.push(5, 5, 5, 5, 5, 5, 5, 5, 5); m.indices.push(8, 9, 10);
  const rays = wallRays(m.positions, m.indices), out = cpuWallThickness(packBvh(triangleBvh(m.positions, m.indices)), rays);
  assert.deepEqual([rays.dirs[36], rays.dirs[37], rays.dirs[38]], [0, 0, 0]);
  assert.equal(out.depth[12], Infinity); assert.equal(out.local[12], Infinity);
});

function assertLikeKernel(m, bvh, rays, out) {
  for (let t = 0; t < rays.count; t++) {
    const o = [rays.origins[3 * t], rays.origins[3 * t + 1], rays.origins[3 * t + 2]], d = [rays.dirs[3 * t], rays.dirs[3 * t + 1], rays.dirs[3 * t + 2]];
    const h = rayHit(bvh, o, d, 1e-6, t), l = Number.isFinite(h) ? 2 * Math.sqrt(nearestDistance2(bvh, o[0] + d[0] * h / 2, o[1] + d[1] * h / 2, o[2] + d[2] * h / 2, h * h / 4)) : Infinity;
    assert.ok(Number.isFinite(h) === Number.isFinite(out.depth[t]) && (!Number.isFinite(h) || Math.abs(h - out.depth[t]) <= 1e-5 * bvh.size), `depth ${t}: ${h} vs ${out.depth[t]}`);
    assert.ok(!Number.isFinite(l) || Math.abs(l - out.local[t]) <= 1e-5 * bvh.size, `local ${t}: ${l} vs ${out.local[t]}`);
  }
}
