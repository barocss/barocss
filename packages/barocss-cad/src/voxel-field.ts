// K6 (D145): a closed triangle mesh sampled on a voxel grid, and a field's zero surface meshed — moved down from the
// studio's hollowing (AM7a, O53) and lattice (AM7b). Inside flags by ray parity along +X, one grid row at a time (the
// triangles binned by the rows their YZ boxes cover); the depth of an inside node below the surface, capped, by the
// kernel's triangle hierarchy (K2); and marching tetrahedra — six a cell about its diagonal, so no ambiguous case and a
// closed manifold surface, its vertices shared by grid edge. Loops over typed arrays; no closure per node or cell.
import { nearestDistance2, triangleBvh } from './triangle-bvh.js';

export type VoxelPoint = [number, number, number];
/** A scalar field on a grid: node (i, j, k) at o + h(i, j, k), its value phi[(k·n₁ + j)·n₀ + i]. */
export interface VoxelField { readonly o: VoxelPoint; readonly h: number; readonly n: readonly [number, number, number]; readonly phi: Float64Array }

/**
 * Whether each node of the grid (o, h, n) is inside a closed mesh, by the parity of a ray along +X: each row's crossings
 * with the triangles (the row's (y, z) against each triangle's YZ projection, barycentric), sorted, counted below each
 * node. A row through an edge or a vertex is the caller's to avoid (an irrational offset of the grid).
 */
export function voxelInsideFlags(positions: ArrayLike<number>, indices: ArrayLike<number>, o: readonly number[], h: number, n: readonly number[]): Uint8Array {
  const T = packed(positions, indices), out = new Uint8Array(n[0] * n[1] * n[2]), nt = T.length / 9, xs: number[] = [];
  // (Triangles binned by row: each in the rows its YZ box covers.)
  const rows = new Map<number, number[]>();
  for (let t = 0; t < nt; t++) {
    const b = t * 9, y0 = Math.min(T[b + 1], T[b + 4], T[b + 7]), y1 = Math.max(T[b + 1], T[b + 4], T[b + 7]), z0 = Math.min(T[b + 2], T[b + 5], T[b + 8]), z1 = Math.max(T[b + 2], T[b + 5], T[b + 8]);
    for (let k = Math.max(0, Math.ceil((z0 - o[2]) / h)); k < n[2] && o[2] + k * h <= z1; k++) for (let j = Math.max(0, Math.ceil((y0 - o[1]) / h)); j < n[1] && o[1] + j * h <= y1; j++) { const key = k * n[1] + j; let r = rows.get(key); if (!r) { r = []; rows.set(key, r); } r.push(t); }
  }
  for (const [key, tris] of rows) {
    const j = key % n[1], k = (key - j) / n[1], y = o[1] + j * h, z = o[2] + k * h;
    xs.length = 0;
    for (const t of tris) {
      const b = t * 9, ay = T[b + 1], az = T[b + 2], by = T[b + 4], bz = T[b + 5], cy = T[b + 7], cz = T[b + 8];
      const d = (by - ay) * (cz - az) - (bz - az) * (cy - ay); if (Math.abs(d) < 1e-300) continue;
      const u = ((y - ay) * (cz - az) - (z - az) * (cy - ay)) / d, v = ((by - ay) * (z - az) - (bz - az) * (y - ay)) / d;
      if (u < 0 || v < 0 || u + v > 1) continue;
      xs.push(T[b] + u * (T[b + 3] - T[b]) + v * (T[b + 6] - T[b]));
    }
    xs.sort(ascending);
    let c = 0;
    for (let i = 0; i < n[0]; i++) { const x = o[0] + i * h; while (c < xs.length && xs[c] < x) c++; if (c % 2 === 1) out[(k * n[1] + j) * n[0] + i] = 1; }
  }
  return out;
}
const ascending = (p: number, q: number) => p - q;
/** The mesh's triangles, nine coordinates each (double precision). */
function packed(P: ArrayLike<number>, I: ArrayLike<number>): Float64Array {
  const T = new Float64Array(I.length * 3);
  for (let t = 0; t < I.length; t++) { const v = I[t]; T[t * 3] = P[v * 3]; T[t * 3 + 1] = P[v * 3 + 1]; T[t * 3 + 2] = P[v * 3 + 2]; }
  return T;
}

/**
 * Each inside node's depth below the mesh's surface — its distance to the nearest triangle — capped at `cap` (past it a
 * node is as deep as matters); `inside` the flags (`voxelInsideFlags`), outside nodes 0. Through the K2 hierarchy's
 * nearest query bounded by the cap.
 */
export function voxelDepth(positions: ArrayLike<number>, indices: ArrayLike<number>, o: readonly number[], h: number, n: readonly number[], cap: number, inside: Uint8Array): Float64Array {
  const bvh = triangleBvh(positions, indices), out = new Float64Array(n[0] * n[1] * n[2]), cap2 = cap * cap;
  for (let k = 0; k < n[2]; k++) for (let j = 0; j < n[1]; j++) for (let i = 0; i < n[0]; i++) {
    const id = (k * n[1] + j) * n[0] + i; if (!inside[id]) continue;
    out[id] = Math.sqrt(nearestDistance2(bvh, o[0] + i * h, o[1] + j * h, o[2] + k * h, cap2));
  }
  return out;
}

// ——— marching tetrahedra
/** The cube's corners by bit (x, y, z), and its six tetrahedra about the diagonal 0 → 7. */
export const VOXEL_CORNERS: readonly (readonly [number, number, number])[] = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
export const VOXEL_TETRAHEDRA: readonly (readonly [number, number, number, number])[] = [[0, 1, 3, 7], [0, 3, 2, 7], [0, 2, 6, 7], [0, 6, 4, 7], [0, 4, 5, 7], [0, 5, 1, 7]];
/** A node's position. */
export function voxelNode(g: VoxelField, id: number): VoxelPoint { const i = id % g.n[0], r = (id - i) / g.n[0], j = r % g.n[1], k = (r - j) / g.n[1]; return [g.o[0] + i * g.h, g.o[1] + j * g.h, g.o[2] + k * g.h]; }

interface March { g: VoxelField; positions: number[]; indices: number[]; vert: Map<number, number>; N: number }
/** The vertex where φ crosses 0 on the grid edge a–b, shared by every triangle on that edge. */
function vertexOn(m: March, a: number, b: number): number {
  const key = a < b ? a * m.N + b : b * m.N + a, have = m.vert.get(key); if (have !== undefined) return have;
  // (Strictly inside the edge: a field exactly 0 at a node would put every edge's vertex there, coincident, and their
  // triangles of no area crack the mesh. 1e-9 of an edge moves nothing.)
  const s = Math.min(1 - 1e-9, Math.max(1e-9, m.g.phi[a] / (m.g.phi[a] - m.g.phi[b]))), pa = voxelNode(m.g, a), pb = voxelNode(m.g, b);
  m.positions.push(pa[0] + s * (pb[0] - pa[0]), pa[1] + s * (pb[1] - pa[1]), pa[2] + s * (pb[2] - pa[2]));
  const v = m.positions.length / 3 - 1; m.vert.set(key, v); return v;
}
const IDS = new Int32Array(4), PIN = new Int32Array(4), POUT = new Int32Array(4);
/**
 * The surface φ = 0 of the region φ > 0 as a closed mesh, outward (towards φ < 0), its vertices shared by grid edge;
 * `edges` each vertex's grid edge (a·N + b, a < b, N the node count) for a later pass that moves it along its edge.
 */
export function marchingTetrahedra(g: VoxelField): { positions: number[]; indices: number[]; edges: Float64Array } {
  const m: March = { g, positions: [], indices: [], vert: new Map(), N: g.n[0] * g.n[1] * g.n[2] };
  for (let k = 0; k + 1 < g.n[2]; k++) for (let j = 0; j + 1 < g.n[1]; j++) for (let i = 0; i + 1 < g.n[0]; i++) {
    for (let tt = 0; tt < 6; tt++) {
      const tet = VOXEL_TETRAHEDRA[tt]; let np = 0, nm = 0;
      for (let q = 0; q < 4; q++) { const c = VOXEL_CORNERS[tet[q]]; IDS[q] = ((k + c[2]) * g.n[1] + (j + c[1])) * g.n[0] + (i + c[0]); if (g.phi[IDS[q]] > 0) PIN[np++] = IDS[q]; else POUT[nm++] = IDS[q]; }
      if (np === 0 || np === 4) continue;
      if (np === 1) emit(g, m.positions, m.indices, vertexOn(m, PIN[0], POUT[0]), vertexOn(m, PIN[0], POUT[1]), vertexOn(m, PIN[0], POUT[2]), PIN[0], POUT[0]);
      else if (np === 3) emit(g, m.positions, m.indices, vertexOn(m, POUT[0], PIN[0]), vertexOn(m, POUT[0], PIN[1]), vertexOn(m, POUT[0], PIN[2]), PIN[0], POUT[0]);
      else {
        const a = vertexOn(m, PIN[0], POUT[0]), b = vertexOn(m, PIN[0], POUT[1]), c = vertexOn(m, PIN[1], POUT[1]), d = vertexOn(m, PIN[1], POUT[0]);
        emit(g, m.positions, m.indices, a, b, c, PIN[0], POUT[0]); emit(g, m.positions, m.indices, a, c, d, PIN[0], POUT[0]);
      }
    }
  }
  const edges = new Float64Array(m.positions.length / 3); for (const [key, v] of m.vert) edges[v] = key;
  return { positions: m.positions, indices: m.indices, edges };
}
/** A triangle, turned to face from the inside node `pin` towards the outside node `pout`. */
function emit(g: VoxelField, P: number[], I: number[], t0: number, t1: number, t2: number, pin: number, pout: number): void {
  const a = t0 * 3, b = t1 * 3, c = t2 * 3, ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, i = voxelNode(g, pin), o = voxelNode(g, pout);
  if (nx * nx + ny * ny + nz * nz < 1e-24) return;
  if (nx * (o[0] - i[0]) + ny * (o[1] - i[1]) + nz * (o[2] - i[2]) >= 0) I.push(t0, t1, t2); else I.push(t0, t2, t1);
}
