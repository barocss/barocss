// Facet patches (F0, R3): what the rest of the kernel asks of a facet face's triangles — checks, vector area,
// maps, the divergence-theorem integrals, area, and whether a region is flat. Typed arrays, no allocation per
// triangle. (No import of brep-core: it imports this.)
import type { FacetPatch, Point } from '../types.js';

export function boundsOf(positions: Float64Array): Float64Array {
  const b = new Float64Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
  for (let i = 0; i < positions.length; i += 3) for (let k = 0; k < 3; k++) { const x = positions[i + k]; if (x < b[k]) b[k] = x; if (x > b[k + 3]) b[k + 3] = x; }
  return b;
}

/** Twice the area of triangle a, b, c (vertex numbers into P). */
export function triangleArea2(P: Float64Array, a: number, b: number, c: number): number {
  const ux = P[3 * b] - P[3 * a], uy = P[3 * b + 1] - P[3 * a + 1], uz = P[3 * b + 2] - P[3 * a + 2], vx = P[3 * c] - P[3 * a], vy = P[3 * c + 1] - P[3 * a + 1], vz = P[3 * c + 2] - P[3 * a + 2];
  return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
}
/** Why a patch is not usable (non-finite values, indices out of range, a triangle without area), or null. */
export function facetPatchProblem(f: FacetPatch): string | null {
  const nv = f.positions.length / 3;
  if (!Number.isInteger(nv) || f.indices.length % 3 || f.indices.length === 0) return 'positions or indices are not whole triangles';
  for (let i = 0; i < f.positions.length; i++) if (!Number.isFinite(f.positions[i])) return 'a position is not finite';
  for (let i = 0; i < f.indices.length; i++) if (f.indices[i] >= nv) return `index ${f.indices[i]} is past the ${nv} vertices`;
  for (let t = 0; t < f.indices.length; t += 3) if (!(triangleArea2(f.positions, f.indices[t], f.indices[t + 1], f.indices[t + 2]) > 0)) return `triangle ${t / 3} has no area`;
  return null;
}
/** The patch's vector area Σ ½ (b − a) × (c − a), along its winding. */
export function facetVectorArea(f: FacetPatch): Point {
  const P = f.positions, I = f.indices; let x = 0, y = 0, z = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = 3 * I[t], b = 3 * I[t + 1], c = 3 * I[t + 2];
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    x += (uy * vz - uz * vy) / 2; y += (uz * vx - ux * vz) / 2; z += (ux * vy - uy * vx) / 2;
  }
  return [x, y, z];
}
/** The patch mapped by x' = M·x + t (M row-major); its triangles turned over when det M < 0 is not wanted here (the face's sense is). */
export function transformFacetPatch(f: FacetPatch, m: readonly number[], t: readonly number[]): FacetPatch {
  const P = f.positions, out = new Float64Array(P.length);
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i], y = P[i + 1], z = P[i + 2];
    out[i] = m[0] * x + m[1] * y + m[2] * z + t[0]; out[i + 1] = m[3] * x + m[4] * y + m[5] * z + t[1]; out[i + 2] = m[6] * x + m[7] * y + m[8] * z + t[2];
  }
  return { ...f, positions: out, bounds: boundsOf(out) };
}
/**
 * Adds the patch's part of the ten volume integrals [V, ∫x, ∫y, ∫z, ∫x², ∫y², ∫z², ∫xy, ∫xz, ∫yz] (positions
 * taken about `o`), by tetrahedra from `o` over its triangles (divergence theorem: exact for facets), with the
 * face's sense; and its area at I[10] when I has room.
 */
export function facetIntegrals(f: FacetPatch, sign: 1 | -1, o: readonly number[], I: number[]): void {
  const P = f.positions, X = f.indices, ox = o[0], oy = o[1], oz = o[2];
  for (let t = 0; t < X.length; t += 3) {
    const a = 3 * X[t], b = 3 * X[t + 1], c = 3 * X[t + 2];
    const ax = P[a] - ox, ay = P[a + 1] - oy, az = P[a + 2] - oz, bx = P[b] - ox, by = P[b + 1] - oy, bz = P[b + 2] - oz, cx = P[c] - ox, cy = P[c + 1] - oy, cz = P[c + 2] - oz;
    const D = sign * (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx));
    const sx = ax + bx + cx, sy = ay + by + cy, sz = az + bz + cz;
    I[0] += D / 6; I[1] += D / 24 * sx; I[2] += D / 24 * sy; I[3] += D / 24 * sz;
    I[4] += D / 120 * (ax * ax + bx * bx + cx * cx + sx * sx); I[5] += D / 120 * (ay * ay + by * by + cy * cy + sy * sy); I[6] += D / 120 * (az * az + bz * bz + cz * cz + sz * sz);
    I[7] += D / 120 * (ax * ay + bx * by + cx * cy + sx * sy); I[8] += D / 120 * (ax * az + bx * bz + cx * cz + sx * sz); I[9] += D / 120 * (ay * az + by * bz + cy * cz + sy * sz);
    if (I.length > 10) { const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az; I[10] += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2; }
  }
}
/** The patch's area. */
export function facetArea(f: FacetPatch): number {
  let a = 0; for (let t = 0; t < f.indices.length; t += 3) a += triangleArea2(f.positions, f.indices[t], f.indices[t + 1], f.indices[t + 2]) / 2;
  return a;
}
/** Whether every triangle of the patch lies in one plane (normals within 1e-12, every vertex within 1e-9 of its size): its plane, or null. */
export function facetPlane(f: FacetPatch): { origin: Point; normal: Point } | null {
  const A = facetVectorArea(f), l = Math.hypot(...A); if (!(l > 0)) return null;
  const n: Point = [A[0] / l, A[1] / l, A[2] / l], P = f.positions, o: Point = [P[0], P[1], P[2]];
  const size = Math.max(1, ...Array.from(f.bounds, Math.abs));
  for (let i = 0; i < P.length; i += 3) if (Math.abs((P[i] - o[0]) * n[0] + (P[i + 1] - o[1]) * n[1] + (P[i + 2] - o[2]) * n[2]) > 1e-9 * size) return null;
  return { origin: o, normal: n };
}
