// K3 (D142): the clearance between two triangle meshes — the least distance between their surfaces, exactly (0 where
// they cross), and the two closest points. Not the one-way sampled `meshDistance` (R9: from one mesh's vertices and
// triangle centres to the other's surface, its largest): this is the least over every pair of triangles. A dual
// descent of the two meshes' triangle hierarchies (K2), the pair of nodes whose boxes are nearest first; a pair of
// boxes as far apart as the best found is skipped (a box gap never exceeds its triangles' distance). Two triangles'
// distance is 0 when an edge of one crosses the other, else the least of the six corner–triangle and nine edge–edge
// distances (Ericson 5.1.5 and 5.1.9). It replaces the studio's box-pruned all-pairs search (RM6) and its vertex-only
// clearance (A2.2). No allocation per pair.
import { triangleBvh, type TriangleBvh } from './triangle-bvh.js';

export interface MeshClearance {
  /** The least distance between the two surfaces, mm (0 when they touch or cross; Infinity when either has no triangle). */
  readonly distance: number;
  /** The closest points, on A and on B (equal where they cross); null when either has no triangle. */
  readonly pointA: readonly [number, number, number] | null; readonly pointB: readonly [number, number, number] | null;
  /** The two triangles they lie on (indices into each mesh), or −1. */
  readonly triangleA: number; readonly triangleB: number;
}
export interface MeshClearanceOptions {
  /** Prebuilt hierarchies of the two meshes (`triangleBvh` of the same positions and indices), to reuse. */
  readonly bvhA?: TriangleBvh; readonly bvhB?: TriangleBvh;
}

// (Module scratch: two triangles' corners, the current pair's closest points, the best pair's.)
const TA = new Float64Array(9), TB = new Float64Array(9), CP = new Float64Array(6), BEST = new Float64Array(6);
let stack = new Int32Array(512);

/** The least distance between two meshes' surfaces (squared internally; exact up to rounding), with the closest points. */
export function meshClearance(pa: ArrayLike<number>, ia: ArrayLike<number>, pb: ArrayLike<number>, ib: ArrayLike<number>, options: MeshClearanceOptions = {}): MeshClearance {
  if (!(ia.length >= 3 && ib.length >= 3)) return { distance: Infinity, pointA: null, pointB: null, triangleA: -1, triangleB: -1 };
  const A = options.bvhA ?? triangleBvh(pa, ia), B = options.bvhB ?? triangleBvh(pb, ib);
  let best = Infinity, bestA = -1, bestB = -1, top = 0;
  stack[top++] = 0; stack[top++] = 0;
  while (top) {
    const nb = stack[--top], na = stack[--top];
    if (boxGap2(A.box, 6 * na, B.box, 6 * nb) >= best) continue;
    const la = A.left[na], lb = B.left[nb];
    if (la < 0 && lb < 0) {
      for (let i = A.start[na], ie = i + A.count[na]; i < ie; i++) {
        const ta = A.order[i]; load(TA, A.positions, A.indices, ta);
        for (let j = B.start[nb], je = j + B.count[nb]; j < je; j++) {
          const tb = B.order[j]; load(TB, B.positions, B.indices, tb);
          const d = triangleTriangle2(best);
          if (d < best) { best = d; bestA = ta; bestB = tb; BEST.set(CP); if (d === 0) return result(0, bestA, bestB); }
        }
      }
      continue;
    }
    // Split the node with the larger box (or the one that is not a leaf); the nearer child pair is pushed last.
    if (top + 4 > stack.length) { const s = new Int32Array(stack.length * 2); s.set(stack); stack = s; }
    const splitA = lb < 0 || (la >= 0 && extent(A.box, 6 * na) >= extent(B.box, 6 * nb));
    if (splitA) {
      const g0 = boxGap2(A.box, 6 * la, B.box, 6 * nb), g1 = boxGap2(A.box, 6 * (la + 1), B.box, 6 * nb);
      if (g0 <= g1) { if (g1 < best) { stack[top++] = la + 1; stack[top++] = nb; } if (g0 < best) { stack[top++] = la; stack[top++] = nb; } }
      else { if (g0 < best) { stack[top++] = la; stack[top++] = nb; } if (g1 < best) { stack[top++] = la + 1; stack[top++] = nb; } }
    } else {
      const g0 = boxGap2(A.box, 6 * na, B.box, 6 * lb), g1 = boxGap2(A.box, 6 * na, B.box, 6 * (lb + 1));
      if (g0 <= g1) { if (g1 < best) { stack[top++] = na; stack[top++] = lb + 1; } if (g0 < best) { stack[top++] = na; stack[top++] = lb; } }
      else { if (g0 < best) { stack[top++] = na; stack[top++] = lb; } if (g1 < best) { stack[top++] = na; stack[top++] = lb + 1; } }
    }
  }
  return result(best, bestA, bestB);
}
function result(d2: number, ta: number, tb: number): MeshClearance {
  return { distance: Math.sqrt(d2), pointA: [BEST[0], BEST[1], BEST[2]], pointB: [BEST[3], BEST[4], BEST[5]], triangleA: ta, triangleB: tb };
}
/** The squared gap between two boxes (0 when they overlap). */
function boxGap2(X: Float64Array, a: number, Y: Float64Array, b: number): number {
  const dx = Math.max(Y[b] - X[a + 3], X[a] - Y[b + 3], 0), dy = Math.max(Y[b + 1] - X[a + 4], X[a + 1] - Y[b + 4], 0), dz = Math.max(Y[b + 2] - X[a + 5], X[a + 2] - Y[b + 5], 0);
  return dx * dx + dy * dy + dz * dz;
}
const extent = (X: Float64Array, a: number) => Math.max(X[a + 3] - X[a], X[a + 4] - X[a + 1], X[a + 5] - X[a + 2]);
function load(T: Float64Array, P: ArrayLike<number>, I: ArrayLike<number>, k: number): void {
  for (let v = 0; v < 3; v++) { const p = 3 * I[3 * k + v]; T[3 * v] = P[p]; T[3 * v + 1] = P[p + 1]; T[3 * v + 2] = P[p + 2]; }
}

/**
 * The squared distance between the triangles in TA and TB (their closest points into CP: A's, then B's): 0 when an edge
 * of one crosses the other; else the least of the corner–triangle and edge–edge distances, stopping early below `best`
 * only in that nothing nearer than `best` is missed.
 */
function triangleTriangle2(best: number): number {
  for (let e = 0; e < 3; e++) if (edgeCrosses(TA, e, TB) || edgeCrosses(TB, e, TA)) return 0;
  let d = best, ax = 0, ay = 0, az = 0, bx = 0, by = 0, bz = 0;
  for (let v = 0; v < 3; v++) {
    let q = cornerTriangle2(TA[3 * v], TA[3 * v + 1], TA[3 * v + 2], TB);
    if (q < d) { d = q; ax = TA[3 * v]; ay = TA[3 * v + 1]; az = TA[3 * v + 2]; bx = Q[0]; by = Q[1]; bz = Q[2]; }
    q = cornerTriangle2(TB[3 * v], TB[3 * v + 1], TB[3 * v + 2], TA);
    if (q < d) { d = q; ax = Q[0]; ay = Q[1]; az = Q[2]; bx = TB[3 * v]; by = TB[3 * v + 1]; bz = TB[3 * v + 2]; }
  }
  for (let e = 0; e < 3; e++) for (let f = 0; f < 3; f++) {
    const q = segmentSegment2(TA, e, (e + 1) % 3, TB, f, (f + 1) % 3);
    if (q < d) { d = q; ax = S[0]; ay = S[1]; az = S[2]; bx = S[3]; by = S[4]; bz = S[5]; }
  }
  CP[0] = ax; CP[1] = ay; CP[2] = az; CP[3] = bx; CP[4] = by; CP[5] = bz;
  return d;
}

/** Whether edge e of triangle T (corners e, e + 1) crosses triangle U — its ends on opposite sides (or one on it) and the crossing inside; the point into CP[0..2] and CP[3..5]. */
function edgeCrosses(T: Float64Array, e: number, U: Float64Array): boolean {
  const f = (e + 1) % 3, px = T[3 * e], py = T[3 * e + 1], pz = T[3 * e + 2], qx = T[3 * f], qy = T[3 * f + 1], qz = T[3 * f + 2];
  const e1x = U[3] - U[0], e1y = U[4] - U[1], e1z = U[5] - U[2], e2x = U[6] - U[0], e2y = U[7] - U[1], e2z = U[8] - U[2];
  const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
  const sp = nx * (px - U[0]) + ny * (py - U[1]) + nz * (pz - U[2]), sq = nx * (qx - U[0]) + ny * (qy - U[1]) + nz * (qz - U[2]);
  if ((sp > 0 && sq > 0) || (sp < 0 && sq < 0) || sp === sq) return false;
  const t = sp / (sp - sq), x = px + t * (qx - px), y = py + t * (qy - py), z = pz + t * (qz - pz);
  // Inside: on the inner side of each of U's edges (with its normal).
  for (let k = 0; k < 3; k++) {
    const l = (k + 1) % 3, ux = U[3 * l] - U[3 * k], uy = U[3 * l + 1] - U[3 * k + 1], uz = U[3 * l + 2] - U[3 * k + 2], wx = x - U[3 * k], wy = y - U[3 * k + 1], wz = z - U[3 * k + 2];
    if ((uy * wz - uz * wy) * nx + (uz * wx - ux * wz) * ny + (ux * wy - uy * wx) * nz < 0) return false;
  }
  CP[0] = x; CP[1] = y; CP[2] = z; CP[3] = x; CP[4] = y; CP[5] = z;
  return true;
}

const Q = new Float64Array(3);
/** The squared distance from p to triangle T (9 coordinates), its closest point into Q (Ericson 5.1.5's regions). */
function cornerTriangle2(px: number, py: number, pz: number, T: Float64Array): number {
  const ax = T[0], ay = T[1], az = T[2], abx = T[3] - ax, aby = T[4] - ay, abz = T[5] - az, acx = T[6] - ax, acy = T[7] - ay, acz = T[8] - az;
  const apx = px - ax, apy = py - ay, apz = pz - az, d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  const bpx = px - T[3], bpy = py - T[4], bpz = pz - T[5], d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
  const cpx = px - T[6], cpy = py - T[7], cpz = pz - T[8], d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
  const vc = d1 * d4 - d3 * d2, vb = d5 * d2 - d1 * d6, va = d3 * d6 - d5 * d4;
  let cx: number, cy: number, cz: number;
  if (d1 <= 0 && d2 <= 0) { cx = ax; cy = ay; cz = az; }
  else if (d3 >= 0 && d4 <= d3) { cx = T[3]; cy = T[4]; cz = T[5]; }
  else if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); cx = ax + v * abx; cy = ay + v * aby; cz = az + v * abz; }
  else if (d6 >= 0 && d5 <= d6) { cx = T[6]; cy = T[7]; cz = T[8]; }
  else if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); cx = ax + w * acx; cy = ay + w * acy; cz = az + w * acz; }
  else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); cx = T[3] + w * (T[6] - T[3]); cy = T[4] + w * (T[7] - T[4]); cz = T[5] + w * (T[8] - T[5]); }
  else { const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; cx = ax + abx * v + acx * w; cy = ay + aby * v + acy * w; cz = az + abz * v + acz * w; }
  Q[0] = cx; Q[1] = cy; Q[2] = cz;
  const dx = px - cx, dy = py - cy, dz = pz - cz;
  return dx * dx + dy * dy + dz * dz;
}

const S = new Float64Array(6);
/** The squared distance between segments a[i]a[j] and b[k]b[l] (Ericson 5.1.9), the closest points into S. */
function segmentSegment2(a: Float64Array, i: number, j: number, b: Float64Array, k: number, l: number): number {
  const p1x = a[3 * i], p1y = a[3 * i + 1], p1z = a[3 * i + 2], p2x = b[3 * k], p2y = b[3 * k + 1], p2z = b[3 * k + 2];
  const d1x = a[3 * j] - p1x, d1y = a[3 * j + 1] - p1y, d1z = a[3 * j + 2] - p1z, d2x = b[3 * l] - p2x, d2y = b[3 * l + 1] - p2y, d2z = b[3 * l + 2] - p2z;
  const rx = p1x - p2x, ry = p1y - p2y, rz = p1z - p2z;
  const A = d1x * d1x + d1y * d1y + d1z * d1z, E = d2x * d2x + d2y * d2y + d2z * d2z, F = d2x * rx + d2y * ry + d2z * rz;
  let s: number, t: number;
  if (A <= 1e-18 && E <= 1e-18) { s = 0; t = 0; }
  else if (A <= 1e-18) { s = 0; t = Math.min(1, Math.max(0, F / E)); }
  else {
    const C = d1x * rx + d1y * ry + d1z * rz;
    if (E <= 1e-18) { t = 0; s = Math.min(1, Math.max(0, -C / A)); }
    else {
      const Bd = d1x * d2x + d1y * d2y + d1z * d2z, den = A * E - Bd * Bd;
      s = den > 1e-18 ? Math.min(1, Math.max(0, (Bd * F - C * E) / den)) : 0;
      t = (Bd * s + F) / E;
      if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -C / A)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (Bd - C) / A)); }
    }
  }
  S[0] = p1x + d1x * s; S[1] = p1y + d1y * s; S[2] = p1z + d1z * s; S[3] = p2x + d2x * t; S[4] = p2y + d2y * t; S[5] = p2z + d2z * t;
  const dx = S[0] - S[3], dy = S[1] - S[4], dz = S[2] - S[5];
  return dx * dx + dy * dy + dz * dz;
}
