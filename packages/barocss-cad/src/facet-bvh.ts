// Points against a facet body (F0, R3.2): inside, outside or on it, by the parity of a ray's crossings with its
// triangles, found through the kernel's triangle hierarchy over them (`triangleBvh`, K2; built once per B-rep). A ray
// that grazes an edge or a vertex, or runs in a triangle's plane, says nothing: the next of a fixed set of directions is
// tried, and three clean rays vote. A point within the tolerance of a triangle is on the body. No allocation per
// triangle or per ray.
import { BrepError, type Brep } from './brep-core.js';
import type { FacetPatch, Point } from './types.js';
import { triangleBvh, type TriangleBvh } from './triangle-bvh.js';

export type FacetPointClass = 'inside' | 'outside' | 'on';

/** The triangles of a facet body and the hierarchy over them (K2, D141: the kernel's one triangle hierarchy). */
export type FacetBvh = TriangleBvh;

const built = new WeakMap<Brep, FacetBvh>();
/** The hierarchy over a facet body's triangles (made once per B-rep); refused unless every face is a facet face. */
export function facetBvh(brep: Brep): FacetBvh {
  let b = built.get(brep);
  if (!b) { b = buildFacetBvh(brep); built.set(brep, b); }
  return b;
}

function buildFacetBvh(brep: Brep): FacetBvh {
  let nv = 0, nt = 0;
  for (const f of brep.faces) {
    if (f.surface.kind !== 'facets') throw new BrepError('GEOMETRY', `point classification: only bodies of facet faces yet (face ${f.id} is not one)`);
    nv += f.surface.positions.length / 3; nt += f.surface.indices.length / 3;
  }
  const positions = new Float64Array(3 * nv), indices = new Uint32Array(3 * nt);
  let v0 = 0, t0 = 0;
  for (const f of brep.faces) {
    const F = f.surface as FacetPatch;
    positions.set(F.positions, 3 * v0);
    for (let i = 0; i < F.indices.length; i++) indices[3 * t0 + i] = F.indices[i] + v0;
    v0 += F.positions.length / 3; t0 += F.indices.length / 3;
  }
  return triangleBvh(positions, indices);
}

/** Ray directions tried in turn (unit, irrational components: not along any axis or common diagonal). */
const DIRECTIONS = [[0.5773, 0.6007, 0.5531], [-0.4352, 0.7934, 0.4256], [0.6913, -0.3418, 0.6366], [-0.2672, -0.5389, 0.7988], [0.8123, 0.4977, -0.3042], [-0.7311, 0.1873, -0.6560], [0.1391, -0.9134, -0.3826], [0.3529, 0.2214, -0.9091]].map(d => { const l = Math.hypot(d[0], d[1], d[2]); return [d[0] / l, d[1] / l, d[2] / l]; });
let stack = new Int32Array(256);
/** The last ray's outcome: crossings, or −1 when it grazed (an edge, a vertex, a triangle edge-on), or −2 when the point is on a triangle. */
function cast(b: FacetBvh, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, tol: number): number {
  const P = b.positions, X = b.indices, ix = 1 / dx, iy = 1 / dy, iz = 1 / dz, eps = 1e-9;
  let hits = 0, top = 0; stack[top++] = 0;
  while (top) {
    const id = stack[--top], B = 6 * id;
    let t0 = (b.box[B] - ox) * ix, t1 = (b.box[B + 3] - ox) * ix; if (t0 > t1) { const x = t0; t0 = t1; t1 = x; }
    let u0 = (b.box[B + 1] - oy) * iy, u1 = (b.box[B + 4] - oy) * iy; if (u0 > u1) { const x = u0; u0 = u1; u1 = x; }
    let w0 = (b.box[B + 2] - oz) * iz, w1 = (b.box[B + 5] - oz) * iz; if (w0 > w1) { const x = w0; w0 = w1; w1 = x; }
    // (A box the point is within tolerance of is entered whatever the ray: the point may be on one of its triangles.)
    if (Math.max(t0, u0, w0) > Math.min(t1, u1, w1) + tol || Math.min(t1, u1, w1) < -tol) continue;
    if (b.left[id] >= 0) {
      if (top + 2 > stack.length) { const s = new Int32Array(stack.length * 2); s.set(stack); stack = s; }
      stack[top++] = b.left[id]; stack[top++] = b.left[id] + 1; continue;
    }
    for (let i = b.start[id], end = i + b.count[id]; i < end; i++) {
      const t = b.order[i], a = 3 * X[3 * t], q = 3 * X[3 * t + 1], r = 3 * X[3 * t + 2];
      const ax = P[a], ay = P[a + 1], az = P[a + 2];
      const e1x = P[q] - ax, e1y = P[q + 1] - ay, e1z = P[q + 2] - az, e2x = P[r] - ax, e2y = P[r + 1] - ay, e2z = P[r + 2] - az;
      // On the triangle: within the tolerance of its plane and inside it (barycentric).
      const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x, nn = Math.hypot(nx, ny, nz);
      if (!(nn > 0)) continue;
      const sx = ox - ax, sy = oy - ay, sz = oz - az, dist = (sx * nx + sy * ny + sz * nz) / nn;
      if (Math.abs(dist) <= tol) {
        const px = sx - dist * nx / nn, py = sy - dist * ny / nn, pz = sz - dist * nz / nn;
        const d11 = e1x * e1x + e1y * e1y + e1z * e1z, d12 = e1x * e2x + e1y * e2y + e1z * e2z, d22 = e2x * e2x + e2y * e2y + e2z * e2z;
        const p1 = px * e1x + py * e1y + pz * e1z, p2 = px * e2x + py * e2y + pz * e2z, den = d11 * d22 - d12 * d12;
        const u = (d22 * p1 - d12 * p2) / den, v = (d11 * p2 - d12 * p1) / den, slack = tol / Math.sqrt(Math.min(d11, d22));
        if (u >= -slack && v >= -slack && u + v <= 1 + slack) return -2;
      }
      // Möller–Trumbore: the crossing ahead of the point, or a graze.
      const hx = dy * e2z - dz * e2y, hy = dz * e2x - dx * e2z, hz = dx * e2y - dy * e2x, det = e1x * hx + e1y * hy + e1z * hz;
      if (Math.abs(det) <= eps * nn) { if (Math.abs(dist) <= 10 * tol) return -1; continue; }
      const f = 1 / det, u = f * (sx * hx + sy * hy + sz * hz);
      if (u < -eps || u > 1 + eps) continue;
      const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x, v = f * (dx * qx + dy * qy + dz * qz);
      if (v < -eps || u + v > 1 + eps) continue;
      const tt = f * (e2x * qx + e2y * qy + e2z * qz);
      if (tt <= 0) continue;
      if (u < eps || v < eps || u + v > 1 - eps) return -1;
      hits++;
    }
  }
  return hits;
}

/**
 * Whether a point is inside, outside or on a facet body (all its faces facets), to `toleranceMM` (default 1e-9
 * of the body's size): three clean rays' parities vote; a point on a triangle is on the body.
 */
export function classifyPointInFacets(brep: Brep, point: Point | readonly number[], toleranceMM?: number): FacetPointClass {
  const b = facetBvh(brep), tol = toleranceMM ?? 1e-9 * b.size;
  let inside = 0, outside = 0;
  for (const d of DIRECTIONS) {
    const h = cast(b, point[0], point[1], point[2], d[0], d[1], d[2], tol);
    if (h === -2) return 'on';
    if (h < 0) continue;
    if (h % 2) inside++; else outside++;
    if (inside === 2 || outside === 2) break;
  }
  if (inside + outside === 0) throw new BrepError('GEOMETRY', 'point classification: every ray grazed the mesh (the point lies on an edge too nearly)');
  return inside > outside ? 'inside' : 'outside';
}
