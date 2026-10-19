// A closed mesh's inner offset (R11.3, D114): the cavity of a mesh body's shell, on the mesh's own triangles. Each vertex
// moves in to the point nearest, in least squares, to every incident triangle's plane moved in by the wall (weighted by
// the triangle's angle there) — where up to three planes meet, the sharp join of their offsets exactly (a box's corner, an
// edge between two planes, a flat point); round a smooth vertex, the wall within the spread of its normals. The wall it
// achieves is measured, not assumed: the least and largest distance from the offset (its vertices and triangles'
// centres) to the mesh's surface. Refused by name: a triangle the offset turns over (`OFFSET_FOLDS`), an inner surface that
// meets itself or the mesh (`WALL_TOO_THIN`, through mesh repair's grid), a wall more than 1 % thinner than asked
// (`MESH_WALL_THIN`), a mesh that is not closed (`SHELL_MESH_NOT_CLOSED`).
import { BrepError } from './brep-core.js';
import { selfIntersections } from './mesh-repair.js';
import { meshDistanceRange } from './mesh-distance.js';

const refuse = (detail: string): never => { throw new BrepError('GEOMETRY', `CAPABILITY: shell: ${detail}`); };
const at = (p: readonly number[]) => p.map(x => +x.toFixed(4)).join(', ');

export interface MeshShellReport {
  /** The wall asked for (mm). */
  readonly wallMM: number;
  /** The wall the offset achieves: the least and largest distance from it to the mesh's surface (mm). */
  readonly wallMinMM: number;
  readonly wallMaxMM: number;
  /** Triangles of the cavity (the mesh's own). */
  readonly triangles: number;
}

/**
 * The inner offset of a closed, outward-wound mesh (positions P, triangles I) by t: its points on the same triangles,
 * and the wall it achieves.
 */
export function meshInnerOffset(P: Float64Array, I: Uint32Array, t: number): { positions: Float64Array; report: MeshShellReport } {
  if (!(t > 0)) refuse('the wall must be positive');
  const nv = P.length / 3, nt = I.length / 3;
  // Closed and wound one way: every edge used twice, once each way.
  const uses = new Map<number, number>(), key = (a: number, b: number) => a * nv + b;
  for (let k = 0; k < nt; k++) for (let j = 0; j < 3; j++) { const a = I[3 * k + j], b = I[3 * k + (j + 1) % 3], c = key(a, b); uses.set(c, (uses.get(c) ?? 0) + 1); }
  for (const [c, n] of uses) { const a = Math.floor(c / nv), b = c % nv; if (n !== 1 || uses.get(key(b, a)) !== 1) refuse(`[SHELL_MESH_NOT_CLOSED] the mesh is not closed and wound one way at its edge (${at([P[3 * a], P[3 * a + 1], P[3 * a + 2]])}) to (${at([P[3 * b], P[3 * b + 1], P[3 * b + 2]])}): repair it first`); }
  // Each triangle's unit normal, and its angle at each corner.
  const N = new Float64Array(3 * nt), W = new Float64Array(3 * nt);
  for (let k = 0; k < nt; k++) {
    const a = 3 * I[3 * k], b = 3 * I[3 * k + 1], c = 3 * I[3 * k + 2];
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
    if (!(l > 0)) refuse(`[SHELL_MESH_NOT_CLOSED] the mesh has a degenerate triangle at (${at([P[a], P[a + 1], P[a + 2]])}): repair it first`);
    N[3 * k] = nx / l; N[3 * k + 1] = ny / l; N[3 * k + 2] = nz / l;
    for (let j = 0; j < 3; j++) W[3 * k + j] = cornerAngle(P, I[3 * k + j], I[3 * k + (j + 1) % 3], I[3 * k + (j + 2) % 3]);
  }
  // Each vertex: Σ w n nᵀ d = −t Σ w n, solved through the matrix's eigenvectors (directions it barely spans left out:
  // a flat point moves along its normal, a point on an edge between two planes to their mitre).
  const M = new Float64Array(9 * nv), B = new Float64Array(3 * nv);
  for (let k = 0; k < nt; k++) for (let j = 0; j < 3; j++) {
    const v = I[3 * k + j], w = W[3 * k + j], x = N[3 * k], y = N[3 * k + 1], z = N[3 * k + 2], m = 9 * v;
    M[m] += w * x * x; M[m + 1] += w * x * y; M[m + 2] += w * x * z; M[m + 4] += w * y * y; M[m + 5] += w * y * z; M[m + 8] += w * z * z;
    B[3 * v] -= t * w * x; B[3 * v + 1] -= t * w * y; B[3 * v + 2] -= t * w * z;
  }
  const Q = new Float64Array(3 * nv), A = new Float64Array(9), V = new Float64Array(9), d = new Float64Array(3);
  for (let v = 0; v < nv; v++) {
    const m = 9 * v;
    A[0] = M[m]; A[1] = M[m + 1]; A[2] = M[m + 2]; A[3] = M[m + 1]; A[4] = M[m + 4]; A[5] = M[m + 5]; A[6] = M[m + 2]; A[7] = M[m + 5]; A[8] = M[m + 8];
    jacobi3(A, V);
    const top = Math.max(A[0], A[4], A[8]);
    d[0] = 0; d[1] = 0; d[2] = 0;
    for (let e = 0; e < 3; e++) {
      const lam = A[4 * e];
      if (!(lam > 1e-4 * top)) continue;
      const ex = V[e], ey = V[3 + e], ez = V[6 + e], c = (ex * B[3 * v] + ey * B[3 * v + 1] + ez * B[3 * v + 2]) / lam;
      d[0] += c * ex; d[1] += c * ey; d[2] += c * ez;
    }
    Q[3 * v] = P[3 * v] + d[0]; Q[3 * v + 1] = P[3 * v + 1] + d[1]; Q[3 * v + 2] = P[3 * v + 2] + d[2];
  }
  // Turned over: an offset triangle facing against its own.
  for (let k = 0; k < nt; k++) {
    const a = 3 * I[3 * k], b = 3 * I[3 * k + 1], c = 3 * I[3 * k + 2];
    const ux = Q[b] - Q[a], uy = Q[b + 1] - Q[a + 1], uz = Q[b + 2] - Q[a + 2], vx = Q[c] - Q[a], vy = Q[c + 1] - Q[a + 1], vz = Q[c + 2] - Q[a + 2];
    const f = (uy * vz - uz * vy) * N[3 * k] + (uz * vx - ux * vz) * N[3 * k + 1] + (ux * vy - uy * vx) * N[3 * k + 2];
    if (!(f > 0)) refuse(`[OFFSET_FOLDS] the mesh's offset turns over at its triangle ${k} near (${at([(P[a] + P[b] + P[c]) / 3, (P[a + 1] + P[b + 1] + P[c + 1]) / 3, (P[a + 2] + P[b + 2] + P[c + 2]) / 3])}): the wall ${t} mm is deeper than the mesh curves there, or than half its thickness`);
  }
  // Turned inside out as a whole (each triangle facing its own way, the sheet through the middle — a ball shelled past
  // its radius): the offset encloses no volume the right way round.
  let vol = 0;
  for (let k = 0; k < nt; k++) { const a = 3 * I[3 * k], b = 3 * I[3 * k + 1], c = 3 * I[3 * k + 2]; vol += Q[a] * (Q[b + 1] * Q[c + 2] - Q[b + 2] * Q[c + 1]) - Q[a + 1] * (Q[b] * Q[c + 2] - Q[b + 2] * Q[c]) + Q[a + 2] * (Q[b] * Q[c + 1] - Q[b + 1] * Q[c]); }
  if (!(vol > 0)) refuse(`[OFFSET_FOLDS] the mesh's offset turns inside out: the wall ${t} mm is deeper than the body is thick`);
  // The inner surface meeting itself or the mesh: the two together, crossing pairs (they share no corner).
  const both = new Float64Array(6 * nv), J = new Uint32Array(6 * nt);
  both.set(P); both.set(Q, 3 * nv); J.set(I);
  for (let k = 0; k < 3 * nt; k++) J[3 * nt + k] = I[k] + nv;
  const crossing = selfIntersections(both, J);
  if (crossing.count) refuse(`[WALL_TOO_THIN] the wall's inner surface meets itself or the mesh's surface at (${at(crossing.at[0])}) (${crossing.count} crossings): the body is thinner than twice the wall there`);
  const wall = meshDistanceRange(Q, I, P, I);
  if (wall.minMM < 0.99 * t) refuse(`[MESH_WALL_THIN] the offset comes ${+wall.minMM.toPrecision(6)} mm from the mesh at (${at(wall.minAt!)}), more than 1 % thinner than the wall ${t} mm: the mesh is too coarse there for its offset`);
  return { positions: Q, report: { wallMM: t, wallMinMM: wall.minMM, wallMaxMM: wall.maxMM, triangles: nt } };
}

/** A triangle's angle at corner a (between b and c). */
function cornerAngle(P: Float64Array, a: number, b: number, c: number): number {
  const ux = P[3 * b] - P[3 * a], uy = P[3 * b + 1] - P[3 * a + 1], uz = P[3 * b + 2] - P[3 * a + 2], vx = P[3 * c] - P[3 * a], vy = P[3 * c + 1] - P[3 * a + 1], vz = P[3 * c + 2] - P[3 * a + 2];
  return Math.atan2(Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx), ux * vx + uy * vy + uz * vz);
}

/** A symmetric 3 × 3 matrix's eigenvalues (left on A's diagonal) and eigenvectors (V's columns), by cyclic Jacobi rotations. */
function jacobi3(A: Float64Array, V: Float64Array): void {
  V.fill(0); V[0] = 1; V[4] = 1; V[8] = 1;
  for (let sweep = 0; sweep < 32; sweep++) {
    const off = A[1] * A[1] + A[2] * A[2] + A[5] * A[5];
    if (!(off > 1e-30 * (A[0] * A[0] + A[4] * A[4] + A[8] * A[8]))) return;
    for (let p = 0; p < 2; p++) for (let q = p + 1; q < 3; q++) {
      const apq = A[3 * p + q];
      if (apq === 0) continue;
      const th = (A[3 * q + q] - A[3 * p + p]) / (2 * apq), tt = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(tt * tt + 1), s = tt * c;
      for (let k = 0; k < 3; k++) { const akp = A[3 * k + p], akq = A[3 * k + q]; A[3 * k + p] = c * akp - s * akq; A[3 * k + q] = s * akp + c * akq; }
      for (let k = 0; k < 3; k++) { const apk = A[3 * p + k], aqk = A[3 * q + k]; A[3 * p + k] = c * apk - s * aqk; A[3 * q + k] = s * apk + c * aqk; }
      for (let k = 0; k < 3; k++) { const vkp = V[3 * k + p], vkq = V[3 * k + q]; V[3 * k + p] = c * vkp - s * vkq; V[3 * k + q] = s * vkp + c * vkq; }
    }
  }
}
