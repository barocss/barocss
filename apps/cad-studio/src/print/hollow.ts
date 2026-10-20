// Hollowing a part for printing (AM7a, O53): the body's signed depth sampled on a grid of spacing h (point–triangle
// distance, triangles binned; the sign by ray parity along +X per grid row), the cavity φ = depth − t > 0 meshed by
// marching tetrahedra (six a cell: no ambiguous case, a closed manifold) and subtracted from the body as a facet mesh
// (the kernel's own difference: the part's outside stays exact), with a drain from the part's bottom into each
// cavity component's floor. The kernel's mesh Boolean takes 16 000 triangles until F3: the cavity is simplified first
// (R9's decimate, within e). Loops over typed arrays; no closures per node or cell.
import { withNode, type BodyRef, type ModelNode, type StudioDoc } from '../engine/doc';
import { positionsArray, putKnownBlob, type BlobArray } from '../engine/blobs';
import { evaluatePart, type BodyResult } from '../engine/evaluate';
import type { DisplayMesh, Vec3 } from '../engine/mesh';
import { refOf } from '../app/bodyRef';
import { sha256Hex } from '../team/sha256';

export type HollowCode = 'CURVED_BODY' | 'ONE_BODY' | 'DIRECTION_NOT_AXIS' | 'NOTHING_TO_HOLLOW' | 'GRID_TOO_FINE' | 'BAD_VALUES' | 'DRAIN_NO_ROOM' | 'BOOLEAN_REFUSED';
export class HollowError extends Error { constructor(public code: HollowCode, message: string) { super(`[${code}] ${message}`); this.name = 'HollowError'; } }
/** `route`: 'auto' (the kernel's exact closed shell first, the voxel cavity when it refuses) or 'voxel' (the voxel cavity only). */
export interface HollowOptions { t: number; h?: number; drain?: number; route?: 'auto' | 'voxel' }
/** `route`: which made the cavity — the kernel's exact shell (R11), or the voxel cavity — and `why` the voxel route ran. `wall`: measured against t. */
export interface HollowReport { route: 'exact' | 'voxel'; why?: string; wall: Wall; t: number; h: number; drain: number; nodes: number; /** The voxel cavity's simplification bound (mm; 0 on the exact route). */ error: number; cavities: { nodes: number; lowest: Vec3 }[]; drains: { at: Vec3; depth: number }[] }

export const MAX_NODES = 4e6;
/** The grid's offset per axis, a different irrational fraction of h each: equal ones put every row with j = k on the plane
 * y = z, the diagonal of a square face's two triangles, where a ray hits their shared edge twice (the parity broken). */
const OFFSETS: readonly number[] = [1 / Math.PI, 1 / Math.E, Math.SQRT2 - 1];

// ——— the grid and the field
export interface Grid { o: Vec3; h: number; n: [number, number, number]; phi: Float64Array }
const idx = (g: Grid, i: number, j: number, k: number) => (k * g.n[1] + j) * g.n[0] + i;
/** The body's triangles (mm, double precision). */
export function trianglesOf(m: DisplayMesh): Float64Array { const T = new Float64Array(m.indices.length * 3); for (let t = 0; t < m.indices.length; t++) { const v = m.indices[t]; T[t * 3] = m.positions[v * 3]; T[t * 3 + 1] = m.positions[v * 3 + 1]; T[t * 3 + 2] = m.positions[v * 3 + 2]; } return T; }
/** Inside flags of the grid's nodes by ray parity along +X, one row (j, k) at a time. */
export function insideFlags(T: Float64Array, o: Vec3, h: number, n: readonly number[]): Uint8Array {
  const out = new Uint8Array(n[0] * n[1] * n[2]), nt = T.length / 9, xs: number[] = [];
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
    xs.sort((p, q) => p - q);
    let c = 0;
    for (let i = 0; i < n[0]; i++) { const x = o[0] + i * h; while (c < xs.length && xs[c] < x) c++; if (c % 2 === 1) out[(k * n[1] + j) * n[0] + i] = 1; }
  }
  return out;
}
/** The squared distance from p to triangle t (Ericson's closest point). */
export function dist2(T: Float64Array, t: number, px: number, py: number, pz: number): number {
  const b = t * 9, ax = T[b], ay = T[b + 1], az = T[b + 2];
  const abx = T[b + 3] - ax, aby = T[b + 4] - ay, abz = T[b + 5] - az, acx = T[b + 6] - ax, acy = T[b + 7] - ay, acz = T[b + 8] - az;
  const apx = px - ax, apy = py - ay, apz = pz - az, d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  let qx: number, qy: number, qz: number;
  if (d1 <= 0 && d2 <= 0) { qx = ax; qy = ay; qz = az; }
  else {
    const bpx = px - T[b + 3], bpy = py - T[b + 4], bpz = pz - T[b + 5], d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
    const cpx = px - T[b + 6], cpy = py - T[b + 7], cpz = pz - T[b + 8], d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
    const vc = d1 * d4 - d3 * d2, vb = d5 * d2 - d1 * d6, va = d3 * d6 - d5 * d4;
    if (d3 >= 0 && d4 <= d3) { qx = T[b + 3]; qy = T[b + 4]; qz = T[b + 5]; }
    else if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); qx = ax + v * abx; qy = ay + v * aby; qz = az + v * abz; }
    else if (d6 >= 0 && d5 <= d6) { qx = T[b + 6]; qy = T[b + 7]; qz = T[b + 8]; }
    else if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); qx = ax + w * acx; qy = ay + w * acy; qz = az + w * acz; }
    else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / (d4 - d3 + d5 - d6); qx = T[b + 3] + w * (T[b + 6] - T[b + 3]); qy = T[b + 4] + w * (T[b + 7] - T[b + 4]); qz = T[b + 5] + w * (T[b + 8] - T[b + 5]); }
    else { const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; qx = ax + abx * v + acx * w; qy = ay + aby * v + acy * w; qz = az + abz * v + acz * w; }
  }
  return (px - qx) ** 2 + (py - qy) ** 2 + (pz - qz) ** 2;
}
const cellOf = (x: number, k: number, lo: readonly number[], R: number, bn: readonly number[]) => Math.min(bn[k] - 1, Math.max(0, Math.floor((x - lo[k]) / R)));
/** φ = depth − t at each node inside the body (depth capped at t + 2h: past it the node is deep in the cavity); −t outside. */
/** A mesh's triangles binned on a grid of cell R, for a point's depth below it (its distance to the nearest triangle, to R). */
export interface DepthBins { T: Float64Array; lo: readonly number[]; R: number; bn: number[]; bins: Map<number, number[]>; seen: Int32Array; mark: number }
export function depthBins(m: DisplayMesh, R: number): DepthBins {
  const T = trianglesOf(m), lo = m.bounds.min, hi = m.bounds.max, nt = T.length / 9;
  const bn = [0, 1, 2].map(k => Math.max(1, Math.ceil((hi[k] - lo[k]) / R) + 1)), bins = new Map<number, number[]>();
  for (let tr = 0; tr < nt; tr++) {
    const b = tr * 9, c0 = [0, 1, 2].map(k => cellOf(Math.min(T[b + k], T[b + 3 + k], T[b + 6 + k]), k, lo, R, bn)), c1 = [0, 1, 2].map(k => cellOf(Math.max(T[b + k], T[b + 3 + k], T[b + 6 + k]), k, lo, R, bn));
    for (let z = c0[2]; z <= c1[2]; z++) for (let y = c0[1]; y <= c1[1]; y++) for (let x = c0[0]; x <= c1[0]; x++) { const key = (z * bn[1] + y) * bn[0] + x; let l = bins.get(key); if (!l) { l = []; bins.set(key, l); } l.push(tr); }
  }
  return { T, lo, R, bn, bins, seen: new Int32Array(nt).fill(-1), mark: 0 };
}
/** A point's distance to the nearest triangle, if within R (its 27 neighbouring cells); R otherwise. */
export function depthAt(d: DepthBins, px: number, py: number, pz: number): number {
  const { lo, R, bn, bins, seen } = d, mark = ++d.mark, cx = cellOf(px, 0, lo, R, bn), cy = cellOf(py, 1, lo, R, bn), cz = cellOf(pz, 2, lo, R, bn);
  let best = R * R;
  for (let z = Math.max(0, cz - 1); z <= Math.min(bn[2] - 1, cz + 1); z++) for (let y = Math.max(0, cy - 1); y <= Math.min(bn[1] - 1, cy + 1); y++) for (let x = Math.max(0, cx - 1); x <= Math.min(bn[0] - 1, cx + 1); x++) {
    const l = bins.get((z * bn[1] + y) * bn[0] + x); if (!l) continue;
    for (const tr of l) { if (seen[tr] === mark) continue; seen[tr] = mark; const q = dist2(d.T, tr, px, py, pz); if (q < best) best = q; }
  }
  return Math.sqrt(best);
}
export function cavityField(m: DisplayMesh, t: number, h: number): Grid {
  const lo = m.bounds.min, hi = m.bounds.max, R = t + 2 * h;
  const o: Vec3 = [lo[0] - 2 * h + OFFSETS[0] * h, lo[1] - 2 * h + OFFSETS[1] * h, lo[2] - 2 * h + OFFSETS[2] * h];
  const n: [number, number, number] = [0, 1, 2].map(k => Math.ceil((hi[k] - o[k] + 2 * h) / h) + 1) as [number, number, number];
  if (n[0] * n[1] * n[2] > MAX_NODES) throw new HollowError('GRID_TOO_FINE', `${n.join(' × ')} nodes at h ${h} mm, over ${MAX_NODES}: take h ≥ ${(+(h * Math.cbrt(n[0] * n[1] * n[2] / MAX_NODES)).toFixed(3))} mm`);
  // (Triangles binned on a grid of cell R: a node's nearest within R is in its 27 neighbouring cells.)
  const d = depthBins(m, R), inside = insideFlags(d.T, o, h, n), phi = new Float64Array(n[0] * n[1] * n[2]).fill(-t);
  for (let k = 0; k < n[2]; k++) for (let j = 0; j < n[1]; j++) for (let i = 0; i < n[0]; i++) {
    const id = (k * n[1] + j) * n[0] + i; if (!inside[id]) continue;
    phi[id] = depthAt(d, o[0] + i * h, o[1] + j * h, o[2] + k * h) - t;
  }
  return { o, h, n, phi };
}

// ——— marching tetrahedra
// (The cube's corners by bit (x, y, z) and its six tetrahedra about the diagonal 0 → 7.)
export const CORNER = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
export const TETS = [[0, 1, 3, 7], [0, 3, 2, 7], [0, 2, 6, 7], [0, 6, 4, 7], [0, 4, 5, 7], [0, 5, 1, 7]];
interface March { g: Grid; positions: number[]; indices: number[]; vert: Map<number, number>; N: number }
/** The vertex where φ crosses 0 on the grid edge a–b, shared by every triangle on that edge. */
function vertexOn(m: March, a: number, b: number): number {
  const key = a < b ? a * m.N + b : b * m.N + a, have = m.vert.get(key); if (have !== undefined) return have;
  // (Strictly inside the edge: a field exactly 0 at a node — a drain's radius a whole number of steps from its axis — would
  // put every edge's vertex there, coincident, and their triangles of no area crack the mesh. 1e-9 of an edge moves nothing.)
  const s = Math.min(1 - 1e-9, Math.max(1e-9, m.g.phi[a] / (m.g.phi[a] - m.g.phi[b]))), pa = nodeAt(m.g, a), pb = nodeAt(m.g, b);
  m.positions.push(pa[0] + s * (pb[0] - pa[0]), pa[1] + s * (pb[1] - pa[1]), pa[2] + s * (pb[2] - pa[2]));
  const v = m.positions.length / 3 - 1; m.vert.set(key, v); return v;
}
const IDS = new Int32Array(4), PIN = new Int32Array(4), POUT = new Int32Array(4);
/** The surface φ = 0 of the region φ > 0 as a closed mesh, outward (towards φ < 0); vertices shared by grid edge. */
export function marchingTetrahedra(g: Grid): { positions: number[]; indices: number[]; edges: Float64Array } {
  const m: March = { g, positions: [], indices: [], vert: new Map(), N: g.n[0] * g.n[1] * g.n[2] };
  for (let k = 0; k + 1 < g.n[2]; k++) for (let j = 0; j + 1 < g.n[1]; j++) for (let i = 0; i + 1 < g.n[0]; i++) {
    for (let tt = 0; tt < 6; tt++) {
      const tet = TETS[tt]; let np = 0, nm = 0;
      for (let q = 0; q < 4; q++) { const c = CORNER[tet[q]]; IDS[q] = idx(g, i + c[0], j + c[1], k + c[2]); if (g.phi[IDS[q]] > 0) PIN[np++] = IDS[q]; else POUT[nm++] = IDS[q]; }
      if (np === 0 || np === 4) continue;
      if (np === 1) emit(g, m.positions, m.indices, vertexOn(m, PIN[0], POUT[0]), vertexOn(m, PIN[0], POUT[1]), vertexOn(m, PIN[0], POUT[2]), PIN[0], POUT[0]);
      else if (np === 3) emit(g, m.positions, m.indices, vertexOn(m, POUT[0], PIN[0]), vertexOn(m, POUT[0], PIN[1]), vertexOn(m, POUT[0], PIN[2]), PIN[0], POUT[0]);
      else {
        const a = vertexOn(m, PIN[0], POUT[0]), b = vertexOn(m, PIN[0], POUT[1]), c = vertexOn(m, PIN[1], POUT[1]), d = vertexOn(m, PIN[1], POUT[0]);
        emit(g, m.positions, m.indices, a, b, c, PIN[0], POUT[0]); emit(g, m.positions, m.indices, a, c, d, PIN[0], POUT[0]);
      }
    }
  }
  // (Each vertex's grid edge, a·N + b with a < b: what a later pass needs to move it along its edge.)
  const edges = new Float64Array(m.positions.length / 3); for (const [key, v] of m.vert) edges[v] = key;
  return { positions: m.positions, indices: m.indices, edges };
}
export const nodeAt = (g: Grid, id: number): Vec3 => { const i = id % g.n[0], r = (id - i) / g.n[0], j = r % g.n[1], k = (r - j) / g.n[1]; return [g.o[0] + i * g.h, g.o[1] + j * g.h, g.o[2] + k * g.h]; };
/** A triangle, turned to face from the inside node `pin` towards the outside node `pout`. */
function emit(g: Grid, P: number[], I: number[], t0: number, t1: number, t2: number, pin: number, pout: number): void {
  const a = t0 * 3, b = t1 * 3, c = t2 * 3, ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, i = nodeAt(g, pin), o = nodeAt(g, pout);
  if (nx * nx + ny * ny + nz * nz < 1e-24) return;
  if (nx * (o[0] - i[0]) + ny * (o[1] - i[1]) + nz * (o[2] - i[2]) >= 0) I.push(t0, t1, t2); else I.push(t0, t2, t1);
}

/**
 * The cavity's components: flood fill of the nodes with φ > 0 (6-connected), each with its drain node — of its lowest
 * nodes along `up` (its floor), the one nearest the floor's centroid, so a drain opens in the middle of it.
 */
export function cavityComponents(g: Grid, up: number): { nodes: number; lowest: number }[] {
  const N = g.phi.length, label = new Int32Array(N).fill(-1), out: { nodes: number; lowest: number }[] = [], stack: number[] = [], members: number[] = [];
  const step = [1, g.n[0], g.n[0] * g.n[1]], [a, b] = [0, 1, 2].filter(x => x !== up);
  for (let s = 0; s < N; s++) {
    if (g.phi[s] <= 0 || label[s] >= 0) continue;
    const c = out.length; members.length = 0; let low = Infinity;
    label[s] = c; stack.push(s);
    while (stack.length) {
      const v = stack.pop()!; members.push(v);
      const at = nodeAt(g, v); if (at[up] < low) low = at[up];
      const i = v % g.n[0], r = (v - i) / g.n[0], j = r % g.n[1], k = (r - j) / g.n[1], ijk = [i, j, k];
      for (let ax = 0; ax < 3; ax++) for (let d = -1; d <= 1; d += 2) { const q = ijk[ax] + d; if (q < 0 || q >= g.n[ax]) continue; const w = v + d * step[ax]; if (g.phi[w] > 0 && label[w] < 0) { label[w] = c; stack.push(w); } }
    }
    let sa = 0, sb = 0, nf = 0;
    for (const v of members) { const at = nodeAt(g, v); if (at[up] <= low + 1e-9) { sa += at[a]; sb += at[b]; nf++; } }
    const ca = sa / nf, cb = sb / nf; let best = members[0], bestD = Infinity;
    for (const v of members) { const at = nodeAt(g, v); if (at[up] > low + 1e-9) continue; const dd = (at[a] - ca) ** 2 + (at[b] - cb) ** 2; if (dd < bestD) { bestD = dd; best = v; } }
    out.push({ nodes: members.length, lowest: best });
  }
  return out;
}

/** A mesh split into its connected pieces (by shared vertices), each with its own vertex numbering. */
export function meshPieces(m: { positions: number[]; indices: number[] }): { positions: number[]; indices: number[] }[] {
  const nv = m.positions.length / 3, parent = new Int32Array(nv);
  for (let v = 0; v < nv; v++) parent[v] = v;
  for (let t = 0; t < m.indices.length; t += 3) { const a = root(parent, m.indices[t]); union(parent, a, m.indices[t + 1]); union(parent, a, m.indices[t + 2]); }
  const byRoot = new Map<number, { positions: number[]; indices: number[]; map: Map<number, number> }>();
  for (let t = 0; t < m.indices.length; t += 3) {
    const r = root(parent, m.indices[t]); let p = byRoot.get(r); if (!p) { p = { positions: [], indices: [], map: new Map() }; byRoot.set(r, p); }
    for (let j = 0; j < 3; j++) { const v = m.indices[t + j]; let w = p.map.get(v); if (w === undefined) { w = p.positions.length / 3; p.map.set(v, w); p.positions.push(m.positions[v * 3], m.positions[v * 3 + 1], m.positions[v * 3 + 2]); } p.indices.push(w); }
  }
  return [...byRoot.values()].map(p => ({ positions: p.positions, indices: p.indices }));
}
function root(p: Int32Array, v: number): number { while (p[v] !== v) { p[v] = p[p[v]]; v = p[v]; } return v; }
function union(p: Int32Array, a: number, b: number): void { const ra = root(p, a), rb = root(p, b); if (ra !== rb) p[rb] = ra; }

/** The wall as measured (R11.3's way): from each outer face's triangle centroids inward along the face's normal to the next surface. */
export interface Wall { samples: number; min: number; max: number; median: number }
export function wallOf(m: DisplayMesh, target: number): Wall {
  // (The outer surface: the faces a ray from outside meets; inward from a centroid, the first other surface is the wall's inside.
  // Rays leaving through a drain, or crossing much more than the target, are not a wall.)
  // (At most about 400 triangles sampled, evenly through the mesh: each sample casts rays against every triangle.)
  const out: number[] = [], P = m.positions, I = m.indices, stride = 3 * Math.max(1, Math.ceil(I.length / 3 / 400));
  for (let t = 0; t < I.length; t += stride) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3, ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const L = Math.hypot(nx, ny, nz); if (L < 1e-12) continue; nx /= L; ny /= L; nz /= L;
    const ox = (P[a] + P[b] + P[c]) / 3, oy = (P[a + 1] + P[b + 1] + P[c + 1]) / 3, oz = (P[a + 2] + P[b + 2] + P[c + 2]) / 3;
    if (!onOuter(m, ox, oy, oz)) continue;
    const d = rayHit(m, ox, oy, oz, -nx, -ny, -nz, t);
    if (d > 1e-6 && d < 3 * target) out.push(d);
  }
  out.sort((x, y) => x - y);
  return { samples: out.length, min: out[0] ?? NaN, max: out[out.length - 1] ?? NaN, median: out[out.length >> 1] ?? NaN };
}
/** Whether a point on the mesh is on its outer surface: on the bounding box's hull side by a ray to +X meeting nothing else. */
function onOuter(m: DisplayMesh, x: number, y: number, z: number): boolean {
  for (const [dx, dy, dz] of OUT_DIRS) if (rayHit(m, x + dx * 1e-6, y + dy * 1e-6, z + dz * 1e-6, dx, dy, dz, -1) === Infinity) return true;
  return false;
}
const OUT_DIRS: readonly [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
/** The distance along a ray to the nearest triangle (Möller–Trumbore), skipping one; Infinity when none. */
function rayHit(m: DisplayMesh, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, skip: number): number {
  const P = m.positions, I = m.indices; let best = Infinity;
  for (let t = 0; t < I.length; t += 3) {
    if (t === skip) continue;
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3, e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2], e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
    const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, det = e1x * px + e1y * py + e1z * pz; if (Math.abs(det) < 1e-14) continue;
    const inv = 1 / det, tx = ox - P[a], ty = oy - P[a + 1], tz = oz - P[a + 2], u = (tx * px + ty * py + tz * pz) * inv; if (u < 0 || u > 1) continue;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, v = (dx * qx + dy * qy + dz * qz) * inv; if (v < 0 || u + v > 1) continue;
    const d = (e2x * qx + e2y * qy + e2z * qz) * inv; if (d > 1e-7 && d < best) best = d;
  }
  return best;
}
const refusalOf = (e: unknown) => { const x = e as { detail?: string; title?: string } | string; return typeof x === 'string' ? x : x?.detail ?? x?.title ?? JSON.stringify(x); };

/** A blob put by its SHA-256 at once (the command's build is synchronous): the hash the store's own would give. */
export function putNow(a: BlobArray): string { const h = sha256Hex(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)); putKnownBlob(h, a); return h; }

/** The hollowing's features appended: the cavity mesh, its difference from the body, a drain into each cavity. */
export function planHollow(doc: StudioDoc, bodies: readonly BodyResult[], o: HollowOptions): { doc: StudioDoc; report: HollowReport } {
  if (bodies.length !== 1) throw new HollowError('ONE_BODY', `hollowing takes a part of one body; this one has ${bodies.length}`);
  const t = o.t, h = o.h ?? t / 4, drain = o.drain ?? 4;
  if (!(t > 0 && h > 0 && h <= t / 2 + 1e-12 && drain > 0)) throw new HollowError('BAD_VALUES', `a wall t > 0, a voxel 0 < h ≤ t/2 and a drain Ø > 0 (t ${t}, h ${h}, drain ${drain})`);
  const d = doc.print?.direction ?? [0, 0, 1], up = d.findIndex(x => Math.abs(x) > 1e-9);
  if (up < 0 || d.some((x, i) => i !== up && Math.abs(x) > 1e-9)) throw new HollowError('DIRECTION_NOT_AXIS', `the print direction (${d.join(', ')}) is not along X, Y or Z`);
  const body = bodies[0];
  const g = cavityField(body.mesh, t, h), comps = cavityComponents(g, up);
  if (!comps.length) throw new HollowError('NOTHING_TO_HOLLOW', `no point of the part is deeper than the wall (${t} mm): it is thinner than ${2 * t} mm everywhere`);
  // (The drains: from the part's bottom (min along up) to each cavity's lowest node, its column inside the bottom.)
  const [a, b] = [0, 1, 2].filter(x => x !== up), floor = body.mesh.bounds.min[up], drains: HollowReport['drains'] = [];
  for (const c of comps) {
    const p = nodeAt(g, c.lowest), inFoot = [a, b].every(x => p[x] - drain / 2 >= body.mesh.bounds.min[x] - 1e-9 && p[x] + drain / 2 <= body.mesh.bounds.max[x] + 1e-9);
    if (!inFoot) throw new HollowError('DRAIN_NO_ROOM', `a drain of Ø${drain} at (${p.map(v => +v.toFixed(2)).join(', ')}) does not fit inside the part's bottom`);
    drains.push({ at: [p[0], p[1], p[2]], depth: p[up] - floor });
  }
  // (The route: the kernel's exact closed shell (R11: shellPart, its general shell and offsets, nothing opened) first — the
  // outside and the inside both exact, curved faces too; the voxel cavity only when it refuses, said why. A curved body
  // the shell refuses waits for the kernel's mixed facet–analytic Booleans (F3): refused with the shell's reason.)
  let out: StudioDoc = doc, error = 0, ref: BodyRef = refOf(body), route: 'exact' | 'voxel' = 'voxel', why: string | undefined;
  if ((o.route ?? 'auto') === 'auto') {
    const shelled = withNode(doc, { kind: 'shell', parent: refOf(body), thickness: t, open: [] } as ModelNode), r = evaluatePart(shelled, 0);
    if (r.ok && r.bodies.length === 1 && (r.bodies[0].innerShells ?? 0) >= 1) { out = shelled; ref = { node: shelled.nodes.length - 1, side: 'solid' }; route = 'exact'; }
    else why = `the kernel's exact shell refused it: ${r.ok ? `it gave ${r.bodies.length} bod${r.bodies.length === 1 ? 'y' : 'ies'} with ${r.bodies[0]?.innerShells ?? 0} cavities` : refusalOf(r.error)}`;
  } else why = 'the voxel route was asked for';
  if (route === 'voxel') {
    const curved = body.mesh.faces.filter(f => f.kind === 'curved' && !f.facet).length;
    if (curved) throw new HollowError('CURVED_BODY', `the part has ${curved} curved face${curved > 1 ? 's' : ''} and ${why}: a mesh cavity in a curved body needs the kernel's mixed facet–analytic Booleans (F3)`);
  // (The kernel's mesh Boolean takes up to 16 000 triangles until F3: each cavity piece simplified first (R9's decimate),
  // within e = h/50 of itself; a result the Boolean refuses as touching, at h/20 then h/10 — e goes into the bounds. A
  // mesh is one closed piece: one mesh node a cavity, each taken from the part in turn.)
  for (const piece of meshPieces(marchingTetrahedra(g))) {
    const P = positionsArray(piece.positions), I = Uint32Array.from(piece.indices), withMesh = withNode(out, { kind: 'mesh', name: 'cavity', unit: 'mm', representation: 'facets', blob: { positions: putNow(P), indices: putNow(I) } } as ModelNode);
    let done: StudioDoc | null = null, why = '';
    for (const e of [h / 50, h / 20, h / 10]) {
      let d = withNode(withMesh, { kind: 'decimate', parent: { node: withMesh.nodes.length - 1, side: 'solid' }, maxError: e } as ModelNode);
      d = withNode(d, { kind: 'difference', parent: ref, tool: { node: d.nodes.length - 1, side: 'solid' } } as ModelNode);
      const r = evaluatePart(d, 0);
      if (r.ok) { done = d; error = Math.max(error, e); break; }
      why = JSON.stringify(r.error).slice(0, 300);
    }
    if (!done) throw new HollowError('BOOLEAN_REFUSED', `a cavity (${piece.indices.length / 3} triangles) could not be taken from the part even simplified to h/10: ${why}; a coarser h makes a smaller cavity mesh`);
    out = done; ref = { node: out.nodes.length - 1, side: 'solid' };
  }
  }
  // (The wall measured on the hollowed part before its drains: a drain's own wall is not the shell's.)
  const hollowed = evaluatePart(out, 0), wall = hollowed.ok ? wallOf(hollowed.bodies[0].mesh, t) : { samples: 0, min: NaN, max: NaN, median: NaN };
  const axis = (['x', 'y', 'z'] as const)[up];
  for (const dr of drains) { out = withNode(out, { kind: 'hole', parent: ref, center: [dr.at[a], dr.at[b]], radius: drain / 2, axis, side: 'min', depth: dr.depth } as ModelNode); ref = { node: out.nodes.length - 1, side: 'solid' }; }
  return { doc: out, report: { route, ...(why ? { why } : {}), wall, t, h, drain, nodes: g.phi.length, error, cavities: comps.map(c => ({ nodes: c.nodes, lowest: nodeAt(g, c.lowest) })), drains } };
}

/** Enclosed voids of a body by flood fill: its empty nodes on a grid of spacing hc not reached from outside (6-connected). */
export function enclosedVoids(m: DisplayMesh, hc: number): { voids: number; components: number } {
  const lo = m.bounds.min, hi = m.bounds.max, o: Vec3 = [lo[0] - 2 * hc + OFFSETS[0] * hc, lo[1] - 2 * hc + OFFSETS[1] * hc, lo[2] - 2 * hc + OFFSETS[2] * hc];
  const n = [0, 1, 2].map(k => Math.ceil((hi[k] - o[k] + 2 * hc) / hc) + 1);
  const solid = insideFlags(trianglesOf(m), o, hc, n), N = n[0] * n[1] * n[2], reach = new Uint8Array(N), stack: number[] = [0], step = [1, n[0], n[0] * n[1]];
  reach[0] = 1;
  while (stack.length) {
    const v = stack.pop()!, i = v % n[0], r = (v - i) / n[0], j = r % n[1], k = (r - j) / n[1], ijk = [i, j, k];
    for (let a = 0; a < 3; a++) for (const d of [-1, 1]) { const q = ijk[a] + d; if (q < 0 || q >= n[a]) continue; const w = v + d * step[a]; if (!solid[w] && !reach[w]) { reach[w] = 1; stack.push(w); } }
  }
  let voids = 0; const seen = new Uint8Array(N); let components = 0;
  for (let s = 0; s < N; s++) {
    if (solid[s] || reach[s] || seen[s]) continue;
    components++; seen[s] = 1; stack.push(s);
    while (stack.length) { const v = stack.pop()!; voids++; const i = v % n[0], r = (v - i) / n[0], j = r % n[1], k = (r - j) / n[1], ijk = [i, j, k]; for (let a = 0; a < 3; a++) for (const d of [-1, 1]) { const q = ijk[a] + d; if (q < 0 || q >= n[a]) continue; const w = v + d * step[a]; if (!solid[w] && !reach[w] && !seen[w]) { seen[w] = 1; stack.push(w); } } }
  }
  return { voids, components };
}
