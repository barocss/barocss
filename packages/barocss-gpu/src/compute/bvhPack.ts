// G25 (G-R10), EXPERIMENTAL: may change without a version bump. The kernel's triangle hierarchy (`triangleBvh`, K2) packed
// for WGSL storage buffers, and a CPU mirror of the two queries the GPU analyses run on it — the nearest hit along a ray
// and the nearest surface distance — reading the packed f32 data exactly as the shaders will, so the packing can be
// checked in Node against the kernel's own queries before any GPU runs it.
//
// Layout (little-endian, 32-bit words):
// - nodes: 8 words a node — box low x, y, z (f32, rounded down), `link` (i32), box high x, y, z (f32, rounded up),
//   `count` (i32). An inner node has link ≥ 0, its first child (the second is link + 1) and count 0; a leaf has
//   link = −1 − start and count ≥ 1: its triangles are packed triangles [start, start + count).
// - triangles: 12 words a triangle, in leaf order — a.xyz and the source triangle's index (u32), b.xyz and 0, c.xyz
//   and 0 (vertices f32, as the mesh gives them rounded to nearest).
// Boxes are rounded outward from f64, so a triangle's f32 vertices never fall outside its node's f32 box.

import { triangleBvh, type TriangleBvh } from '@barocss/cad';
import { GpuInputError } from '../core/input-error.js';

export const BVH_NODE_WORDS = 8;
export const BVH_TRIANGLE_WORDS = 12;
/** The WGSL traversal's fixed stack; a deeper hierarchy is refused when packed. */
export const BVH_STACK = 64;

export interface PackedBvh {
  /** Node words (f32 and i32 views of one buffer). */
  readonly nodes: ArrayBuffer;
  readonly triangles: ArrayBuffer;
  readonly nodeCount: number;
  readonly triangleCount: number;
  /** The deepest leaf's depth (the root's is 0); the traversal's stack holds at most depth + 1 entries. */
  readonly depth: number;
}

const scratch = new DataView(new ArrayBuffer(4));
/** The largest f32 not above x. */
export function f32Down(x: number): number {
  const f = Math.fround(x);
  if (f <= x || !Number.isFinite(f)) return f;
  scratch.setFloat32(0, f);
  const bits = scratch.getUint32(0);
  scratch.setUint32(0, f > 0 ? bits - 1 : f === 0 ? 0x80000001 : bits + 1);
  return scratch.getFloat32(0);
}
/** The smallest f32 not below x. */
export function f32Up(x: number): number { return -f32Down(-x); }

/** The hierarchy (built here when given a mesh) packed for the GPU. Refused, typed, when deeper than the shaders' stack. */
export function packBvh(source: TriangleBvh | { positions: ArrayLike<number>; indices: ArrayLike<number> }): PackedBvh {
  const bvh: TriangleBvh = 'box' in source ? source : triangleBvh(source.positions, source.indices);
  const nodes = new ArrayBuffer(4 * BVH_NODE_WORDS * Math.max(1, bvh.nodes)), nf = new Float32Array(nodes), ni = new Int32Array(nodes);
  const tri = bvh.order.length, triangles = new ArrayBuffer(4 * BVH_TRIANGLE_WORDS * tri), tf = new Float32Array(triangles), tu = new Uint32Array(triangles);
  const P = bvh.positions, I = bvh.indices, B = bvh.box;
  for (let i = 0; i < tri; i++) {
    const t = bvh.order[i], w = BVH_TRIANGLE_WORDS * i;
    for (let v = 0; v < 3; v++) { const p = 3 * I[3 * t + v]; tf[w + 4 * v] = P[p]; tf[w + 4 * v + 1] = P[p + 1]; tf[w + 4 * v + 2] = P[p + 2]; }
    tu[w + 3] = t; tu[w + 7] = 0; tu[w + 11] = 0;
  }
  // (Depth by walking the links: a node's children are deeper by one.)
  const depthOf = new Int32Array(Math.max(1, bvh.nodes));
  let depth = 0;
  for (let n = 0; n < bvh.nodes; n++) {
    const w = BVH_NODE_WORDS * n, b = 6 * n, l = bvh.left[n];
    nf[w] = f32Down(B[b]); nf[w + 1] = f32Down(B[b + 1]); nf[w + 2] = f32Down(B[b + 2]);
    nf[w + 4] = f32Up(B[b + 3]); nf[w + 5] = f32Up(B[b + 4]); nf[w + 6] = f32Up(B[b + 5]);
    if (l >= 0) { ni[w + 3] = l; ni[w + 7] = 0; depthOf[l] = depthOf[l + 1] = depthOf[n] + 1; }
    else { ni[w + 3] = -1 - bvh.start[n]; ni[w + 7] = bvh.count[n]; if (depthOf[n] > depth) depth = depthOf[n]; }
  }
  if (depth + 1 > BVH_STACK) throw new GpuInputError('GPU_BVH_DEPTH', `the hierarchy is ${depth} deep; the GPU traversal's stack holds ${BVH_STACK}`);
  return { nodes, triangles, nodeCount: bvh.nodes, triangleCount: tri, depth };
}

// ---- The CPU mirror (the shaders' algorithm on the packed words) ----------------------------------------------------------

const stack = new Int32Array(BVH_STACK);

/**
 * The nearest crossing of o + t·d beyond `minT` (Möller–Trumbore, a determinant within `detTol` of zero passed), skipping
 * source triangle `skip`; Infinity for none. The same slab test and order as the kernel's `rayHit`, on the packed data.
 */
export function packedRayHit(p: PackedBvh, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, minT = 1e-6, skip = -1, detTol = 1e-14): number {
  const nf = new Float32Array(p.nodes), ni = new Int32Array(p.nodes), tf = new Float32Array(p.triangles), tu = new Uint32Array(p.triangles);
  const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz, fx = dx === 0, fy = dy === 0, fz = dz === 0;
  let best = Infinity, top = 0; stack[top++] = 0;
  while (top) {
    const n = stack[--top], w = BVH_NODE_WORDS * n;
    let lo = -Infinity, hi = Infinity, t0: number, t1: number;
    if (fx) { if (ox < nf[w] || ox > nf[w + 4]) continue; } else { t0 = (nf[w] - ox) * ix; t1 = (nf[w + 4] - ox) * ix; lo = Math.min(t0, t1); hi = Math.max(t0, t1); }
    if (fy) { if (oy < nf[w + 1] || oy > nf[w + 5]) continue; } else { t0 = (nf[w + 1] - oy) * iy; t1 = (nf[w + 5] - oy) * iy; lo = Math.max(lo, Math.min(t0, t1)); hi = Math.min(hi, Math.max(t0, t1)); }
    if (fz) { if (oz < nf[w + 2] || oz > nf[w + 6]) continue; } else { t0 = (nf[w + 2] - oz) * iz; t1 = (nf[w + 6] - oz) * iz; lo = Math.max(lo, Math.min(t0, t1)); hi = Math.min(hi, Math.max(t0, t1)); }
    if (!(hi >= Math.max(lo, 0)) || lo > best) continue;
    const link = ni[w + 3];
    if (link >= 0) { stack[top++] = link; stack[top++] = link + 1; continue; }
    for (let i = -1 - link, e = i + ni[w + 7]; i < e; i++) {
      const q = BVH_TRIANGLE_WORDS * i;
      if (tu[q + 3] === skip) continue;
      const ax = tf[q], ay = tf[q + 1], az = tf[q + 2];
      const e1x = tf[q + 4] - ax, e1y = tf[q + 5] - ay, e1z = tf[q + 6] - az, e2x = tf[q + 8] - ax, e2y = tf[q + 9] - ay, e2z = tf[q + 10] - az;
      const hx = dy * e2z - dz * e2y, hy = dz * e2x - dx * e2z, hz = dx * e2y - dy * e2x, det = e1x * hx + e1y * hy + e1z * hz;
      if (det > -detTol && det < detTol) continue;
      const sx = ox - ax, sy = oy - ay, sz = oz - az, u = (sx * hx + sy * hy + sz * hz) / det;
      if (u < 0 || u > 1) continue;
      const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x, v = (dx * qx + dy * qy + dz * qz) / det;
      if (v < 0 || u + v > 1) continue;
      const t = (e2x * qx + e2y * qy + e2z * qz) / det;
      if (t > minT && t < best) best = t;
    }
  }
  return best;
}

function nodeBox2(nf: Float32Array, w: number, x: number, y: number, z: number): number {
  const dx = Math.max(nf[w] - x, 0, x - nf[w + 4]), dy = Math.max(nf[w + 1] - y, 0, y - nf[w + 5]), dz = Math.max(nf[w + 2] - z, 0, z - nf[w + 6]);
  return dx * dx + dy * dy + dz * dz;
}
/** The squared distance from the triangle at packed word q to a point (Ericson 5.1.5's regions, as the kernel's). */
function triangle2(tf: Float32Array, q: number, px: number, py: number, pz: number): number {
  const ax = tf[q], ay = tf[q + 1], az = tf[q + 2], bx = tf[q + 4], by = tf[q + 5], bz = tf[q + 6], cx = tf[q + 8], cy = tf[q + 9], cz = tf[q + 10];
  const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az, apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  let qx: number, qy: number, qz: number;
  if (d1 <= 0 && d2 <= 0) { qx = ax; qy = ay; qz = az; }
  else {
    const bpx = px - bx, bpy = py - by, bpz = pz - bz, d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
    const cpx = px - cx, cpy = py - cy, cpz = pz - cz, d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
    const vc = d1 * d4 - d3 * d2, vb = d5 * d2 - d1 * d6, va = d3 * d6 - d5 * d4;
    if (d3 >= 0 && d4 <= d3) { qx = bx; qy = by; qz = bz; }
    else if (d6 >= 0 && d5 <= d6) { qx = cx; qy = cy; qz = cz; }
    else if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); qx = ax + v * abx; qy = ay + v * aby; qz = az + v * abz; }
    else if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); qx = ax + w * acx; qy = ay + w * acy; qz = az + w * acz; }
    else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); qx = bx + w * (cx - bx); qy = by + w * (cy - by); qz = bz + w * (cz - bz); }
    else { const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; qx = ax + abx * v + acx * w; qy = ay + aby * v + acy * w; qz = az + abz * v + acz * w; }
  }
  const dx = px - qx, dy = py - qy, dz = pz - qz;
  return dx * dx + dy * dy + dz * dz;
}
/** The squared distance from a point to the surface when under `bound2` (else `bound2`): branch and bound, the nearer child first. */
export function packedNearestDistance2(p: PackedBvh, x: number, y: number, z: number, bound2 = Infinity): number {
  const nf = new Float32Array(p.nodes), ni = new Int32Array(p.nodes), tf = new Float32Array(p.triangles);
  let best = bound2, top = 0; stack[top++] = 0;
  while (top) {
    const n = stack[--top], w = BVH_NODE_WORDS * n;
    if (nodeBox2(nf, w, x, y, z) >= best) continue;
    const link = ni[w + 3];
    if (link < 0) {
      for (let i = -1 - link, e = i + ni[w + 7]; i < e; i++) { const d = triangle2(tf, BVH_TRIANGLE_WORDS * i, x, y, z); if (d < best) best = d; }
      continue;
    }
    const r = link + 1, dl = nodeBox2(nf, BVH_NODE_WORDS * link, x, y, z), dr = nodeBox2(nf, BVH_NODE_WORDS * r, x, y, z);
    if (dl < dr) { if (dr < best) stack[top++] = r; if (dl < best) stack[top++] = link; }
    else { if (dl < best) stack[top++] = link; if (dr < best) stack[top++] = r; }
  }
  return best;
}
