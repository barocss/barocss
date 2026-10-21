// IM8c (O109): where a casting freezes last, and whether it is fed. The part's distance field on a voxel grid (the
// kernel's K6 inside flags and depth, through K2's nearest query): each inside node's depth is the radius of the largest
// ball about it inside the part. A hot spot is a plateau of the field with no deeper neighbour — the centre of a locally
// largest inscribed ball (IM8 S0: the L junction's 2t(2 − √2), which IM4's per-face sphere misses) — its modulus taken as
// r/2 (a plate's or a long bar's V/A, an estimate). Chvorinov's rule orders freezing by modulus, so metal reaches a hot
// spot while it freezes only through sections at least as thick: its liquid region is the nodes joined to it at depth ≥
// its own (less a quarter cell for the grid). A hot spot whose region reaches the gate the user sets is fed (the ball at
// some node of it touches the gate); one whose region does not is isolated, a shrink-porosity risk, said with where.
import { voxelDepth, voxelInsideFlags } from '@barocss/cad';
import type { BodyResult } from '../engine/evaluate';

export interface HotSpot {
  /** The plateau's centre (mm) and the inscribed ball's radius there. */
  readonly at: readonly [number, number, number]; readonly radiusMM: number;
  /** r/2: a plate's (thickness 2r) or a long bar's (radius r) V/A — an estimate of the section's modulus. */
  readonly modulusMM: number;
  /** Fed through sections at least as thick from the gate; null with no gate. */
  readonly fed: boolean | null;
}
export interface Solidification {
  readonly grid: { readonly h: number; readonly n: readonly [number, number, number]; readonly nodes: number };
  readonly hotSpots: readonly HotSpot[];
  readonly gate: readonly [number, number, number] | null;
  /** The deepest node's radius (the thickest section's half). */
  readonly maxRadiusMM: number;
}

/** The grid's nodes, at most (memory and time: the depth query is K2's per node). */
export const SOLIDIFICATION_NODES = 400_000;
const r3 = (v: number) => Math.round(v * 1e3) / 1e3 + 0;
// (The 26 neighbours' offsets, filled per grid: no closure per node.)
const NB = new Int32Array(26);
function neighbours(n: readonly number[]): void {
  let c = 0;
  for (let dk = -1; dk <= 1; dk++) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (di || dj || dk) NB[c++] = (dk * n[1] + dj) * n[0] + di;
}

/** The distance field's hot spots and their feeding from `gate`; `h` the grid step (default by the node budget). */
export function solidification(bodies: readonly BodyResult[], gate: readonly number[] | null, options: { h?: number } = {}): Solidification {
  const P: number[] = [], I: number[] = [], lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const b of bodies) {
    const base = P.length / 3, m = b.mesh;
    for (let i = 0; i < m.positions.length; i++) P.push(m.positions[i]);
    for (let i = 0; i < m.indices.length; i++) I.push(m.indices[i] + base);
    for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], m.bounds.min[k]); hi[k] = Math.max(hi[k], m.bounds.max[k]); }
  }
  const size = [0, 1, 2].map(k => hi[k] - lo[k]);
  const h = options.h ?? Math.max(Math.cbrt((size[0] + 1) * (size[1] + 1) * (size[2] + 1) / SOLIDIFICATION_NODES), Math.max(...size) / 400);
  // (An irrational offset: no grid row through a mesh edge or vertex, as the inside flags ask.)
  const o = lo.map(v => v - h * (1 + 1 / Math.PI)), n = size.map(s => Math.ceil(s / h + 2 * (1 + 1 / Math.PI)) + 1) as [number, number, number];
  const N = n[0] * n[1] * n[2], inside = voxelInsideFlags(P, I, o, h, n), cap = Math.min(...size) / 2 + h;
  const depth = voxelDepth(P, I, o, h, n, cap, inside);
  neighbours(n);
  const eps = 1e-9 * Math.max(1, ...size), tol = h / 4;
  // Plateaus with no deeper neighbour: each node not yet seen, flooded at its own depth (within eps).
  const seen = new Uint8Array(N), stack: number[] = [], plateau: number[] = [];
  const spots: { nodes: number[]; r: number }[] = [];
  let maxR = 0;
  for (let id = 0; id < N; id++) {
    if (!inside[id] || seen[id]) continue;
    const d0 = depth[id]; if (d0 > maxR) maxR = d0;
    // (A node with a deeper neighbour heads uphill: not a maximum, and the plateau it is on is decided from its top.)
    if (deeperNeighbour(id, d0, depth, inside, n, eps)) continue;
    plateau.length = 0; stack.length = 0; stack.push(id); seen[id] = 1; let top = true;
    while (stack.length) {
      const v = stack.pop()!; plateau.push(v);
      for (let q = 0; q < 26; q++) {
        const w = v + NB[q]; if (!inBounds(v, w, n) || !inside[w]) continue;
        const dw = depth[w];
        if (dw > d0 + eps) top = false;
        else if (!seen[w] && dw >= d0 - eps) { seen[w] = 1; stack.push(w); }
      }
    }
    if (top && d0 >= h) spots.push({ nodes: [...plateau], r: d0 });
  }
  // The largest first; one whose liquid region holds a larger one's is part of it (fed by it as it freezes).
  spots.sort((a, b) => b.r - a.r);
  const region = new Int32Array(N).fill(-1), kept: { nodes: number[]; r: number; region: number[] }[] = [];
  for (const s of spots) {
    const reach = flood(s.nodes, s.r - tol, depth, inside, n);
    if (reach.some(v => region[v] >= 0)) continue;
    for (const v of reach) region[v] = kept.length;
    kept.push({ ...s, region: reach });
  }
  const g = gate ? [gate[0], gate[1], gate[2]] : null;
  const hotSpots: HotSpot[] = kept.map(s => {
    const c = [0, 0, 0]; for (const v of s.nodes) { const p = node(v, o, h, n); c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
    const at = c.map(x => r3(x / s.nodes.length)) as [number, number, number];
    return { at, radiusMM: r3(s.r), modulusMM: r3(s.r / 2), fed: g ? s.region.some(v => touches(v, g, depth[v] + h, o, h, n)) : null };
  });
  return { grid: { h: r3(h), n, nodes: N }, hotSpots, gate: g as [number, number, number] | null, maxRadiusMM: r3(maxR) };
}

/** Whether a node has a neighbour deeper than d (within eps). */
function deeperNeighbour(id: number, d: number, depth: Float64Array, inside: Uint8Array, n: readonly number[], eps: number): boolean {
  for (let q = 0; q < 26; q++) { const w = id + NB[q]; if (inBounds(id, w, n) && inside[w] && depth[w] > d + eps) return true; }
  return false;
}
/** The nodes joined to `from` through nodes at depth ≥ `floor`. */
function flood(from: readonly number[], floor: number, depth: Float64Array, inside: Uint8Array, n: readonly number[]): number[] {
  const mark = new Set<number>(from), stack = [...from], out: number[] = [];
  while (stack.length) {
    const v = stack.pop()!; out.push(v);
    for (let q = 0; q < 26; q++) { const w = v + NB[q]; if (inBounds(v, w, n) && inside[w] && !mark.has(w) && depth[w] >= floor) { mark.add(w); stack.push(w); } }
  }
  return out;
}
/** Whether w is a true 26-neighbour of v (not wrapped across a row or a layer). */
function inBounds(v: number, w: number, n: readonly number[]): boolean {
  if (w < 0 || w >= n[0] * n[1] * n[2]) return false;
  const vi = v % n[0], wi = w % n[0], vj = ((v - vi) / n[0]) % n[1], wj = ((w - wi) / n[0]) % n[1];
  return Math.abs(vi - wi) <= 1 && Math.abs(vj - wj) <= 1;
}
function node(v: number, o: readonly number[], h: number, n: readonly number[]): [number, number, number] {
  const i = v % n[0], r = (v - i) / n[0], j = r % n[1], k = (r - j) / n[1];
  return [o[0] + i * h, o[1] + j * h, o[2] + k * h];
}
/** Whether the ball of radius r about node v reaches the point g. */
function touches(v: number, g: readonly number[], r: number, o: readonly number[], h: number, n: readonly number[]): boolean {
  const p = node(v, o, h, n);
  return Math.hypot(p[0] - g[0], p[1] - g[1], p[2] - g[2]) <= r;
}
