// Mesh repair (M3, R3.4): what is wrong with an imported triangle mesh, and its repair as explicit steps — never a
// silent change: the caller keeps the original and stores the repaired arrays with their report.
//
//   weld        corners within the weld size are one vertex (numeric cell hashes)
//   degenerate  triangles with a repeated corner or no area, and the same triangle twice, dropped
//   fins        pieces joined to the rest only through edges of more than two triangles, enclosing no volume
//               (a fin, a doubled sheet), dropped
//   orient      every piece wound one way (across each two-triangle edge), then outward (positive volume)
//   fill        each hole (a loop of edges with one triangle) closed by our own Liepa fill: a minimum-area
//               triangulation (dynamic programming; a projected ear clipping past 120 corners), refined by
//               centroid splits to the density of its rim, relaxed by Delaunay edge flips, and faired (umbrella
//               smoothing of the new vertices, the rim fixed); the patches are reported so they can be shown
//   floaters    closed pieces under a share of the largest one's volume, dropped
//
// Self-intersections (two triangles of the mesh crossing, not sharing a corner) are found through a BVH and
// reported with where they are; repair does not fix them (D46).
import { triangulatePolygonWithHoles } from './brep-tessellate.js';
import { weldVertices } from './facet-brep.js';
import { MeshBrepError } from './mesh-brep.js';
import type { Point } from './types.js';

export interface MeshRepairSteps {
  readonly weld?: boolean; readonly degenerate?: boolean; readonly fins?: boolean; readonly orient?: boolean;
  /**
   * Fill holes; `skip`: the holes (by their number in the diagnosis) left open; `coarseness`: the fill's edge length
   * against its rim's (1, the default: as dense as the rim; 2: half the resolution — a quarter of the triangles).
   */
  readonly fill?: boolean | { readonly skip?: readonly number[]; readonly coarseness?: number };
  /** Drop closed pieces under this share of the largest one's volume (default 0.01; false: keep them). */
  readonly floaters?: false | { readonly minFraction: number };
  /** Corners closer than this are one vertex (mm; default 1e-6 of the mesh's size). */
  readonly weldMM?: number;
}
export const DEFAULT_REPAIR: Required<Omit<MeshRepairSteps, 'weldMM'>> = { weld: true, degenerate: true, fins: true, orient: true, fill: true, floaters: { minFraction: 0.01 } };

export interface MeshHole { readonly index: number; readonly edges: number; readonly perimeterMM: number; readonly centre: Point }
export interface MeshDiagnosis {
  readonly triangles: number; readonly vertices: number;
  /** Input corners merged by the weld. */
  readonly welded: number;
  readonly degenerate: number; readonly duplicates: number;
  /** Edges of more than two triangles. */
  readonly nonManifoldEdges: number;
  /** Two-triangle edges both triangles run the same way (before orienting). */
  readonly inconsistentEdges: number;
  readonly holes: readonly MeshHole[];
  /** Edge-connected pieces (through two-triangle edges), and those that are closed with their volumes. */
  readonly pieces: number; readonly pieceVolumesMM3: readonly number[];
  /** Pieces under 1% of the largest volume. */
  readonly floaters: number;
  readonly selfIntersections: number;
  /** Where (up to 64): the midpoint of each crossing pair's centroids. */
  readonly selfIntersectionAt: readonly Point[];
  /** Whether the mesh would import as a closed solid as it is (no hole, no edge of more than two, wound one way). */
  readonly closed: boolean;
}
export interface MeshRepairReport {
  readonly welded: number; readonly degenerateRemoved: number; readonly duplicatesRemoved: number;
  readonly finsRemoved: number; readonly finTriangles: number; readonly flipped: number;
  readonly holesFilled: number; readonly fillTriangles: number; readonly largestFilledPerimeterMM: number; readonly filledAreaMM2: number;
  readonly holesLeft: number; readonly floatersRemoved: number; readonly floaterVolumeMM3: number;
  readonly nonManifoldEdgesLeft: number; readonly selfIntersections: number;
  /** After repair: closed and manifold (a solid), or open (it imports as a sheet). */
  readonly closed: boolean;
}
export interface MeshRepairResult {
  readonly positions: Float64Array; readonly indices: Uint32Array; readonly report: MeshRepairReport;
  /** Per output triangle: the fill patch it belongs to (its hole's number), or −1. */
  readonly fill: Int32Array;
}

// ---- shared analysis ------------------------------------------------------------------------------------------
interface Mesh { P: number[]; T: number[]; nv: number }
/** Welded (or not) positions and triangle corners, without the degenerate and duplicate triangles when asked. */
function prepare(positions: ArrayLike<number>, indices: ArrayLike<number> | null, s: MeshRepairSteps, counts: { welded: number; degenerate: number; duplicates: number }): Mesh {
  const n = positions.length / 3, count = indices ? indices.length / 3 : n / 3;
  if (!Number.isInteger(n) || !Number.isInteger(count)) throw new MeshBrepError('the mesh needs three numbers per vertex and three vertices per triangle');
  let size = 0;
  for (let i = 0; i < positions.length; i++) { const x = positions[i]; if (!Number.isFinite(x)) throw new MeshBrepError('the mesh has a coordinate that is not a finite number'); if (Math.abs(x) > size) size = Math.abs(x); }
  const weld = s.weldMM ?? Math.max(1e-9, size * 1e-6);
  let P: Float64Array, remap: Uint32Array;
  if (s.weld !== false) ({ P, remap } = weldVertices(positions, n, weld));
  else { P = Float64Array.from(positions); remap = new Uint32Array(n); for (let v = 0; v < n; v++) remap[v] = v; }
  counts.welded = n - P.length / 3;
  const nv = P.length / 3, T: number[] = [], seen = new Map<number, number[]>();
  for (let t = 0; t < count; t++) {
    const a = remap[indices ? indices[3 * t] : 3 * t], b = remap[indices ? indices[3 * t + 1] : 3 * t + 1], c = remap[indices ? indices[3 * t + 2] : 3 * t + 2];
    if (a === b || b === c || a === c || !(area2(P, a, b, c) > weld * weld)) { counts.degenerate++; if (s.degenerate !== false) continue; }
    // (The same three corners, either winding: one is kept.)
    const lo = Math.min(a, b, c), hi = Math.max(a, b, c), mid = a + b + c - lo - hi, key = lo * nv + mid, list = seen.get(key);
    if (list?.includes(hi)) { counts.duplicates++; if (s.degenerate !== false) continue; }
    if (list) list.push(hi); else seen.set(key, [hi]);
    T.push(a, b, c);
  }
  return { P: Array.from(P), T, nv };
}
/** Sides of each undirected edge (half-edge ids 3t + k), keyed lo·nv + hi. */
function edgeSides(T: number[], nv: number): Map<number, number[]> {
  const sides = new Map<number, number[]>();
  for (let h = 0; h < T.length; h++) {
    const a = T[h], b = T[h - h % 3 + (h % 3 + 1) % 3], key = Math.min(a, b) * nv + Math.max(a, b), list = sides.get(key);
    if (list) list.push(h); else sides.set(key, [h]);
  }
  return sides;
}
const from = (T: number[], h: number) => T[h], to = (T: number[], h: number) => T[h - h % 3 + (h % 3 + 1) % 3];
/** Pieces through two-triangle edges: each triangle's piece. */
function pieces(T: number[], sides: Map<number, number[]>): { of: Int32Array; count: number } {
  const nt = T.length / 3, of = new Int32Array(nt).fill(-1), across = new Int32Array(T.length).fill(-1), queue = new Int32Array(nt);
  for (const list of sides.values()) if (list.length === 2) { across[list[0]] = list[1]; across[list[1]] = list[0]; }
  let count = 0;
  for (let s = 0; s < nt; s++) {
    if (of[s] >= 0) continue;
    let head = 0, tail = 0; queue[tail++] = s; of[s] = count;
    while (head < tail) { const t = queue[head++]; for (let k = 0; k < 3; k++) { const o = across[3 * t + k]; if (o < 0) continue; const u = (o / 3) | 0; if (of[u] < 0) { of[u] = count; queue[tail++] = u; } } }
    count++;
  }
  return { of, count };
}
function volumesOf(P: number[], T: number[], of: Int32Array, count: number): number[] {
  const v = new Array<number>(count).fill(0);
  for (let t = 0; t < T.length / 3; t++) v[of[t]] += det(P, T[3 * t], T[3 * t + 1], T[3 * t + 2]) / 6;
  return v;
}
/** Hole loops (in fill order: the rim's edges run backwards), from the edges with one triangle. */
function holeLoops(T: number[], sides: Map<number, number[]>): number[][] {
  const out = new Map<number, number[]>();
  for (const list of sides.values()) if (list.length === 1) { const h = list[0], a = to(T, h), b = from(T, h); const l = out.get(a); if (l) l.push(b); else out.set(a, [b]); }
  const loops: number[][] = [];
  for (const start of [...out.keys()].sort((x, y) => x - y)) {
    while (out.get(start)?.length) {
      const loop = [start]; let at = out.get(start)!.pop()!;
      for (let guard = 0; at !== start; guard++) {
        if (guard > T.length) break;
        loop.push(at); const next = out.get(at); if (!next?.length) break; at = next.pop()!;
      }
      if (at === start && loop.length >= 3) loops.push(loop);
    }
  }
  return loops;
}

/** What is wrong with a mesh (nothing changed). */
export function diagnoseMesh(positions: ArrayLike<number>, indices: ArrayLike<number> | null, options: { readonly weldMM?: number } = {}): MeshDiagnosis {
  const counts = { welded: 0, degenerate: 0, duplicates: 0 }, m = prepare(positions, indices, { weldMM: options.weldMM }, counts);
  const sides = edgeSides(m.T, m.nv), { of, count } = pieces(m.T, sides);
  let nonManifold = 0, inconsistent = 0;
  for (const list of sides.values()) { if (list.length > 2) nonManifold++; else if (list.length === 2 && from(m.T, list[0]) === from(m.T, list[1])) inconsistent++; }
  const loops = holeLoops(m.T, sides), vols = volumesOf(m.P, m.T, of, count).map(Math.abs), largest = Math.max(0, ...vols);
  const crossing = selfIntersections(Float64Array.from(m.P), Uint32Array.from(m.T));
  return {
    triangles: m.T.length / 3, vertices: m.nv, welded: counts.welded, degenerate: counts.degenerate, duplicates: counts.duplicates,
    nonManifoldEdges: nonManifold, inconsistentEdges: inconsistent, holes: loops.map((l, index) => holeOf(m.P, l, index)), pieces: count, pieceVolumesMM3: vols,
    floaters: vols.filter(v => v < 0.01 * largest).length, selfIntersections: crossing.count, selfIntersectionAt: crossing.at,
    closed: !loops.length && !nonManifold && !inconsistent,
  };
}
function holeOf(P: number[], loop: number[], index: number): MeshHole {
  let perimeter = 0; const c: Point = [0, 0, 0];
  for (let i = 0; i < loop.length; i++) { const a = loop[i], b = loop[(i + 1) % loop.length]; perimeter += Math.hypot(P[3 * b] - P[3 * a], P[3 * b + 1] - P[3 * a + 1], P[3 * b + 2] - P[3 * a + 2]); for (let k = 0; k < 3; k++) c[k] += P[3 * a + k] / loop.length; }
  return { index, edges: loop.length, perimeterMM: perimeter, centre: c };
}

/** The mesh repaired by the steps asked (DEFAULT_REPAIR by default), with what each did. */
export function repairMesh(positions: ArrayLike<number>, indices: ArrayLike<number> | null, steps: MeshRepairSteps = DEFAULT_REPAIR, progress?: (stage: string) => void): MeshRepairResult {
  const s = { ...DEFAULT_REPAIR, ...steps }, counts = { welded: 0, degenerate: 0, duplicates: 0 };
  progress?.('weld');
  const m = prepare(positions, indices, s, counts);
  let T = m.T; const P = m.P;
  let finsRemoved = 0, finTriangles = 0, flipped = 0;
  // Fins: at each edge of more than two triangles, the pieces (through two-triangle edges) meeting there but the
  // largest, when open or enclosing no volume (a fin, a doubled sheet).
  if (s.fins) {
    progress?.('fins');
    const sides = edgeSides(T, m.nv), { of, count } = pieces(T, sides), vols = volumesOf(P, T, of, count), size = new Float64Array(count), open = new Uint8Array(count), fin = new Uint8Array(count);
    for (let t = 0; t < T.length / 3; t++) size[of[t]]++;
    for (const list of sides.values()) if (list.length === 1) open[of[(list[0] / 3) | 0]] = 1;
    let span = 1; for (const x of P) span = Math.max(span, Math.abs(x));
    for (const list of sides.values()) {
      if (list.length <= 2) continue;
      let keep = -1; for (const h of list) { const k = of[(h / 3) | 0]; if (keep < 0 || size[k] > size[keep]) keep = k; }
      for (const h of list) { const k = of[(h / 3) | 0]; if (k !== keep && (open[k] || Math.abs(vols[k]) <= 1e-9 * span ** 3)) fin[k] = 1; }
    }
    const keep: number[] = [];
    for (let t = 0; t < T.length / 3; t++) { if (fin[of[t]]) finTriangles++; else keep.push(T[3 * t], T[3 * t + 1], T[3 * t + 2]); }
    for (let k = 0; k < count; k++) if (fin[k]) finsRemoved++;
    T = keep;
  }
  // Orient: across each two-triangle edge the neighbour runs it the other way (breadth first), then each piece outward.
  if (s.orient) {
    progress?.('orient');
    const sides = edgeSides(T, m.nv), nt = T.length / 3, flip = new Int8Array(nt).fill(-1), queue = new Int32Array(nt), across = new Int32Array(T.length).fill(-1);
    for (const list of sides.values()) if (list.length === 2) { across[list[0]] = list[1]; across[list[1]] = list[0]; }
    for (let s0 = 0; s0 < nt; s0++) {
      if (flip[s0] >= 0) continue;
      let head = 0, tail = 0; queue[tail++] = s0; flip[s0] = 0;
      while (head < tail) {
        const t = queue[head++];
        for (let k = 0; k < 3; k++) {
          const h = 3 * t + k, o = across[h]; if (o < 0) continue;
          const u = (o / 3) | 0; if (flip[u] >= 0) continue;
          // Same direction along the edge (as stored) means one of the two must turn, relative to t's.
          flip[u] = flip[t] ^ (from(T, h) === from(T, o) ? 1 : 0); queue[tail++] = u;
        }
      }
    }
    for (let t = 0; t < nt; t++) if (flip[t]) { const b = T[3 * t + 1]; T[3 * t + 1] = T[3 * t + 2]; T[3 * t + 2] = b; flipped++; }
  }
  // Fill holes.
  const fillOf: number[] = new Array<number>(T.length / 3).fill(-1);
  let holesFilled = 0, fillTriangles = 0, largestPerimeter = 0, filledArea = 0, holesLeft = 0;
  if (s.fill) {
    const skip = new Set(typeof s.fill === 'object' ? s.fill.skip ?? [] : []), coarse = typeof s.fill === 'object' ? Math.max(1, s.fill.coarseness ?? 1) : 1;
    const loops = holeLoops(T, edgeSides(T, m.nv));
    loops.forEach((loop, index) => {
      if (skip.has(index)) { holesLeft++; return; }
      progress?.(`fill ${index + 1} of ${loops.length}`);
      const patch = fillHole(P, loop, coarse);
      if (!patch) { holesLeft++; return; }
      for (let i = 0; i < patch.length; i += 3) { T.push(patch[i], patch[i + 1], patch[i + 2]); fillOf.push(index); filledArea += Math.sqrt(area2(P, patch[i], patch[i + 1], patch[i + 2])) / 2; }
      holesFilled++; fillTriangles += patch.length / 3; largestPerimeter = Math.max(largestPerimeter, holeOf(P, loop, index).perimeterMM);
    });
  }
  // Each closed piece outward; floaters dropped.
  let floatersRemoved = 0, floaterVolume = 0;
  progress?.('floaters');
  {
    const sides = edgeSides(T, m.nv), { of, count } = pieces(T, sides), vols = volumesOf(P, T, of, count), open = new Uint8Array(count);
    for (const list of sides.values()) if (list.length !== 2) for (const h of list) open[of[(h / 3) | 0]] = 1;
    if (s.orient) for (let t = 0; t < T.length / 3; t++) if (!open[of[t]] && vols[of[t]] < 0) { const b = T[3 * t + 1]; T[3 * t + 1] = T[3 * t + 2]; T[3 * t + 2] = b; if (fillOf[t] < 0) flipped++; }
    const largest = Math.max(0, ...vols.map(Math.abs)), drop = new Uint8Array(count);
    if (s.floaters) for (let k = 0; k < count; k++) if (!open[k] && Math.abs(vols[k]) < s.floaters.minFraction * largest) { drop[k] = 1; floatersRemoved++; floaterVolume += Math.abs(vols[k]); }
    if (floatersRemoved) {
      const keep: number[] = [], keepFill: number[] = [];
      for (let t = 0; t < T.length / 3; t++) if (!drop[of[t]]) { keep.push(T[3 * t], T[3 * t + 1], T[3 * t + 2]); keepFill.push(fillOf[t]); }
      T = keep; fillOf.length = 0; for (const x of keepFill) fillOf.push(x);
    }
  }
  // The used vertices, compacted.
  const used = new Int32Array(P.length / 3).fill(-1), outP: number[] = [];
  const outT = new Uint32Array(T.length);
  for (let i = 0; i < T.length; i++) { const v = T[i]; if (used[v] < 0) { used[v] = outP.length / 3; outP.push(P[3 * v], P[3 * v + 1], P[3 * v + 2]); } outT[i] = used[v]; }
  progress?.('check');
  const outList = Array.from(outT), finalSides = edgeSides(outList, outP.length / 3);
  let nonManifoldLeft = 0, openEdges = 0, wrong = 0;
  for (const list of finalSides.values()) { if (list.length > 2) nonManifoldLeft++; else if (list.length === 1) openEdges++; else if (from(outList, list[0]) === from(outList, list[1])) wrong++; }
  const positionsOut = Float64Array.from(outP);
  return {
    positions: positionsOut, indices: outT, fill: Int32Array.from(fillOf),
    report: { welded: counts.welded, degenerateRemoved: s.degenerate ? counts.degenerate : 0, duplicatesRemoved: s.degenerate ? counts.duplicates : 0, finsRemoved, finTriangles, flipped,
      holesFilled, fillTriangles, largestFilledPerimeterMM: largestPerimeter, filledAreaMM2: filledArea, holesLeft, floatersRemoved, floaterVolumeMM3: floaterVolume,
      nonManifoldEdgesLeft: nonManifoldLeft, selfIntersections: selfIntersections(positionsOut, outT).count, closed: !nonManifoldLeft && !openEdges && !wrong },
  };
}

// ---- the fill (Liepa) -------------------------------------------------------------------------------------------
const DP_LIMIT = 120;
/** Triangles closing a hole loop (corners appended to P for the refinement's new vertices), or null when it cannot be closed. */
function fillHole(P: number[], loop: number[], coarse = 1): number[] | null {
  const n = loop.length;
  let tris: number[] | null = n <= DP_LIMIT ? minimumArea(P, loop) : projected(P, loop);
  if (!tris) return null;
  // Densities: each rim vertex's, the mean length of its two rim edges.
  const sigma = new Map<number, number>();
  // (Coarser than the rim when asked: each density scaled, so the patch's edges come out that much longer.)
  for (let i = 0; i < n; i++) { const a = loop[(i + n - 1) % n], b = loop[i], c = loop[(i + 1) % n]; sigma.set(b, coarse * (dist(P, a, b) + dist(P, b, c)) / 2); }
  const rim = new Set<number>();
  for (let i = 0; i < n; i++) { const a = loop[i], b = loop[(i + 1) % n]; rim.add(Math.min(a, b) * 1e9 + Math.max(a, b)); }
  tris = refine(P, tris, sigma, rim);
  fair(P, tris, new Set(loop));
  return tris;
}
/** Minimum total area triangulation of the loop (dynamic programming over its corners, O(n³)). */
function minimumArea(P: number[], loop: number[]): number[] {
  const n = loop.length, W = new Float64Array(n * n), K = new Int32Array(n * n).fill(-1);
  for (let span = 2; span < n; span++) for (let i = 0; i + span < n; i++) {
    const j = i + span; let best = Infinity, at = -1;
    for (let k = i + 1; k < j; k++) { const w = W[i * n + k] + W[k * n + j] + Math.sqrt(area2(P, loop[i], loop[k], loop[j])); if (w < best) { best = w; at = k; } }
    W[i * n + j] = best; K[i * n + j] = at;
  }
  const out: number[] = [], todo: [number, number][] = [[0, n - 1]];
  while (todo.length) { const [i, j] = todo.pop()!; if (j - i < 2) continue; const k = K[i * n + j]; out.push(loop[i], loop[k], loop[j]); todo.push([i, k], [k, j]); }
  return out;
}
/** A long loop ear-clipped in its best-fitting plane (Newell normal), or null when that fails. */
function projected(P: number[], loop: number[]): number[] | null {
  const n: Point = [0, 0, 0];
  for (let i = 0; i < loop.length; i++) { const a = 3 * loop[i], b = 3 * loop[(i + 1) % loop.length]; n[0] += (P[a + 1] - P[b + 1]) * (P[a + 2] + P[b + 2]); n[1] += (P[a + 2] - P[b + 2]) * (P[a] + P[b]); n[2] += (P[a] - P[b]) * (P[a + 1] + P[b + 1]); }
  const l = Math.hypot(...n); if (!(l > 0)) return null;
  const z: Point = [n[0] / l, n[1] / l, n[2] / l], seed: Point = Math.abs(z[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const x = normalize(crossP(seed, z)), y = crossP(z, x);
  const ring = loop.map(v => [P[3 * v] * x[0] + P[3 * v + 1] * x[1] + P[3 * v + 2] * x[2], P[3 * v] * y[0] + P[3 * v + 1] * y[1] + P[3 * v + 2] * y[2]] as [number, number]);
  try { const tris = triangulatePolygonWithHoles(ring, []); return tris.flatMap(([a, b, c]) => [loop[a], loop[b], loop[c]]); } catch { return null; }
}
/**
 * Liepa's refinement: a triangle whose centroid lies further than its corners' densities allow (√2 × distance) is
 * split there; the new edges are relaxed by flips (an interior edge whose two opposite angles add past π swaps).
 */
function refine(P: number[], tris: number[], sigma: Map<number, number>, rim: Set<number>): number[] {
  const T = tris.slice(), key = (a: number, b: number) => Math.min(a, b) * 1e9 + Math.max(a, b);
  // (A safety cap on the patch: past it, refinement stops — the patch stays coarser than its rim.)
  const cap = 64 * tris.length + 20000;
  relax(P, T, rim, key);
  for (let round = 0, split = true; split && round < 32 && T.length / 3 < cap; round++) {
    split = false;
    const nt = T.length / 3;
    for (let t = 0; t < nt; t++) {
      const a = T[3 * t], b = T[3 * t + 1], c = T[3 * t + 2];
      const cx = (P[3 * a] + P[3 * b] + P[3 * c]) / 3, cy = (P[3 * a + 1] + P[3 * b + 1] + P[3 * c + 1]) / 3, cz = (P[3 * a + 2] + P[3 * b + 2] + P[3 * c + 2]) / 3;
      const sc = (sigma.get(a)! + sigma.get(b)! + sigma.get(c)!) / 3;
      let ok = true;
      for (const v of [a, b, c]) { const d = Math.SQRT2 * Math.hypot(cx - P[3 * v], cy - P[3 * v + 1], cz - P[3 * v + 2]); if (!(d > sc && d > sigma.get(v)!)) { ok = false; break; } }
      if (!ok) continue;
      if (T.length / 3 >= cap) break;
      const m = P.length / 3; P.push(cx, cy, cz); sigma.set(m, sc);
      T[3 * t + 2] = m; T.push(b, c, m, c, a, m);
      split = true;
    }
    relax(P, T, rim, key);
  }
  return T;
}
function relax(P: number[], T: number[], rim: Set<number>, key: (a: number, b: number) => number): void {
  // The edges' half-edges, kept up to date as triangles change; a queue of edges to look at (all, then those round a swap).
  const at = new Map<number, number[]>();
  for (let t = 0; t < T.length / 3; t++) addTriangle(T, t, at, key);
  const queue = [...at.keys()];
  for (let guard = 0; queue.length && guard < 8 * T.length; guard++) {
    const k = queue.pop()!, list = at.get(k);
    if (!list || list.length !== 2 || rim.has(k)) continue;
    const [h1, h2] = list, t1 = (h1 / 3) | 0, t2 = (h2 / 3) | 0;
    const a = T[h1], b = T[h1 - h1 % 3 + (h1 % 3 + 1) % 3], c = T[h1 - h1 % 3 + (h1 % 3 + 2) % 3], d = T[h2 - h2 % 3 + (h2 % 3 + 2) % 3];
    if (T[h2] !== b || c === d || at.has(key(c, d))) continue;
    if (angle(P, c, a, b) + angle(P, d, b, a) <= Math.PI + 1e-12) continue;
    // Edge a–b swapped for c–d: (a, b, c) and (b, a, d) become (c, a, d) and (d, b, c).
    removeTriangle(T, t1, at, key); removeTriangle(T, t2, at, key);
    T[3 * t1] = c; T[3 * t1 + 1] = a; T[3 * t1 + 2] = d; T[3 * t2] = d; T[3 * t2 + 1] = b; T[3 * t2 + 2] = c;
    addTriangle(T, t1, at, key); addTriangle(T, t2, at, key);
    queue.push(key(c, a), key(a, d), key(d, b), key(b, c));
  }
}
function addTriangle(T: number[], t: number, at: Map<number, number[]>, key: (a: number, b: number) => number): void {
  for (let j = 0; j < 3; j++) { const h = 3 * t + j, k = key(T[h], T[3 * t + (j + 1) % 3]), l = at.get(k); if (l) l.push(h); else at.set(k, [h]); }
}
function removeTriangle(T: number[], t: number, at: Map<number, number[]>, key: (a: number, b: number) => number): void {
  for (let j = 0; j < 3; j++) {
    const h = 3 * t + j, k = key(T[h], T[3 * t + (j + 1) % 3]), l = at.get(k); if (!l) continue;
    const i = l.indexOf(h); if (i >= 0) l.splice(i, 1);
    if (!l.length) at.delete(k);
  }
}
/** Umbrella smoothing of the patch's new vertices (the rim fixed): each moved to its neighbours' mean, 30 rounds. */
function fair(P: number[], T: number[], rim: Set<number>): void {
  const nb = new Map<number, Set<number>>();
  for (let i = 0; i < T.length; i += 3) for (let k = 0; k < 3; k++) {
    const v = T[i + k]; if (rim.has(v)) continue;
    let s = nb.get(v); if (!s) nb.set(v, s = new Set());
    s.add(T[i + (k + 1) % 3]); s.add(T[i + (k + 2) % 3]);
  }
  for (let round = 0; round < 30; round++) for (const [v, s] of nb) {
    let x = 0, y = 0, z = 0; for (const u of s) { x += P[3 * u]; y += P[3 * u + 1]; z += P[3 * u + 2]; }
    P[3 * v] = x / s.size; P[3 * v + 1] = y / s.size; P[3 * v + 2] = z / s.size;
  }
}

// ---- self-intersections -----------------------------------------------------------------------------------------
/**
 * Pairs of triangles that cross (sharing no corner): how many, and up to 64 places (the midpoint of each crossing
 * pair's centroids). Through a uniform grid over the triangles' boxes (a cell about twice a mean edge): a pair is
 * tested once, in the first cell their boxes share.
 */
export function selfIntersections(P: Float64Array, I: Uint32Array): { count: number; at: Point[] } {
  const nt = I.length / 3; if (nt < 2) return { count: 0, at: [] };
  const box = new Float64Array(6 * nt), lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  let edge = 0;
  for (let t = 0; t < nt; t++) {
    for (let k = 0; k < 3; k++) { box[6 * t + k] = Infinity; box[6 * t + 3 + k] = -Infinity; }
    for (let j = 0; j < 3; j++) { const v = 3 * I[3 * t + j]; for (let k = 0; k < 3; k++) { const x = P[v + k]; if (x < box[6 * t + k]) box[6 * t + k] = x; if (x > box[6 * t + 3 + k]) box[6 * t + 3 + k] = x; } }
    for (let k = 0; k < 3; k++) { if (box[6 * t + k] < lo[k]) lo[k] = box[6 * t + k]; if (box[6 * t + 3 + k] > hi[k]) hi[k] = box[6 * t + 3 + k]; }
    edge += box[6 * t + 3] - box[6 * t] + box[6 * t + 4] - box[6 * t + 1] + box[6 * t + 5] - box[6 * t + 2];
  }
  const cell = Math.max(1e-12, 2 * edge / (3 * nt)), n = [0, 1, 2].map(k => Math.max(1, Math.min(1024, Math.ceil((hi[k] - lo[k]) / cell) + 1)));
  const at0 = (x: number, k: number) => Math.min(n[k] - 1, Math.max(0, Math.floor((x - lo[k]) / cell)));
  const cells = new Map<number, number[]>();
  for (let t = 0; t < nt; t++) {
    const x0 = at0(box[6 * t], 0), y0 = at0(box[6 * t + 1], 1), z0 = at0(box[6 * t + 2], 2), x1 = at0(box[6 * t + 3], 0), y1 = at0(box[6 * t + 4], 1), z1 = at0(box[6 * t + 5], 2);
    for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const key = x + n[0] * (y + n[1] * z), l = cells.get(key); if (l) l.push(t); else cells.set(key, [t]); }
  }
  let count = 0; const at: Point[] = [];
  for (const [key, list] of cells) {
    const cx = key % n[0], cy = Math.floor(key / n[0]) % n[1], cz = Math.floor(key / (n[0] * n[1]));
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (box[6 * b] > box[6 * a + 3] || box[6 * a] > box[6 * b + 3] || box[6 * b + 1] > box[6 * a + 4] || box[6 * a + 1] > box[6 * b + 4] || box[6 * b + 2] > box[6 * a + 5] || box[6 * a + 2] > box[6 * b + 5]) continue;
      // (Only in the first cell the two boxes share: each pair once.)
      if (at0(Math.max(box[6 * a], box[6 * b]), 0) !== cx || at0(Math.max(box[6 * a + 1], box[6 * b + 1]), 1) !== cy || at0(Math.max(box[6 * a + 2], box[6 * b + 2]), 2) !== cz) continue;
      if (shareCorner(I, a, b) || !trianglesCross(P, I, a, b)) continue;
      count++;
      if (at.length < 64) { const p: Point = [0, 0, 0]; for (let j2 = 0; j2 < 3; j2++) for (let k = 0; k < 3; k++) p[k] += (P[3 * I[3 * a + j2] + k] + P[3 * I[3 * b + j2] + k]) / 6; at.push(p); }
    }
  }
  return { count, at };
}
function shareCorner(I: Uint32Array, a: number, b: number): boolean {
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (I[3 * a + i] === I[3 * b + j]) return true;
  return false;
}
/** Whether two triangles cross: an edge of either passes through the other's interior (strictly). */
function trianglesCross(P: Float64Array, I: Uint32Array, a: number, b: number): boolean {
  for (let k = 0; k < 3; k++) {
    if (segmentThrough(P, I[3 * a + k], I[3 * a + (k + 1) % 3], I, b)) return true;
    if (segmentThrough(P, I[3 * b + k], I[3 * b + (k + 1) % 3], I, a)) return true;
  }
  return false;
}
function segmentThrough(P: Float64Array, p: number, q: number, I: Uint32Array, t: number): boolean {
  const a = 3 * I[3 * t], b = 3 * I[3 * t + 1], c = 3 * I[3 * t + 2], o = 3 * p, e = 3 * q;
  const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2], e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
  const dx = P[e] - P[o], dy = P[e + 1] - P[o + 1], dz = P[e + 2] - P[o + 2];
  const hx = dy * e2z - dz * e2y, hy = dz * e2x - dx * e2z, hz = dx * e2y - dy * e2x, det0 = e1x * hx + e1y * hy + e1z * hz;
  const scale = Math.hypot(e1x, e1y, e1z) * Math.hypot(e2x, e2y, e2z) * Math.hypot(dx, dy, dz);
  if (Math.abs(det0) <= 1e-12 * scale) return false;
  const f = 1 / det0, sx = P[o] - P[a], sy = P[o + 1] - P[a + 1], sz = P[o + 2] - P[a + 2], u = f * (sx * hx + sy * hy + sz * hz);
  if (u <= 1e-9 || u >= 1 - 1e-9) return false;
  const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x, v = f * (dx * qx + dy * qy + dz * qz);
  if (v <= 1e-9 || u + v >= 1 - 1e-9) return false;
  const s = f * (e2x * qx + e2y * qy + e2z * qz);
  return s > 1e-9 && s < 1 - 1e-9;
}

// ---- small helpers ----------------------------------------------------------------------------------------------
function area2(P: ArrayLike<number>, a: number, b: number, c: number): number {
  const ux = P[3 * b] - P[3 * a], uy = P[3 * b + 1] - P[3 * a + 1], uz = P[3 * b + 2] - P[3 * a + 2], vx = P[3 * c] - P[3 * a], vy = P[3 * c + 1] - P[3 * a + 1], vz = P[3 * c + 2] - P[3 * a + 2];
  return (uy * vz - uz * vy) ** 2 + (uz * vx - ux * vz) ** 2 + (ux * vy - uy * vx) ** 2;
}
function det(P: number[], a: number, b: number, c: number): number {
  const ax = P[3 * a], ay = P[3 * a + 1], az = P[3 * a + 2], bx = P[3 * b], by = P[3 * b + 1], bz = P[3 * b + 2], cx = P[3 * c], cy = P[3 * c + 1], cz = P[3 * c + 2];
  return ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
}
const dist = (P: number[], a: number, b: number) => Math.hypot(P[3 * b] - P[3 * a], P[3 * b + 1] - P[3 * a + 1], P[3 * b + 2] - P[3 * a + 2]);
/** The angle at corner v of the triangle v, a, b. */
function angle(P: number[], v: number, a: number, b: number): number {
  const ux = P[3 * a] - P[3 * v], uy = P[3 * a + 1] - P[3 * v + 1], uz = P[3 * a + 2] - P[3 * v + 2], wx = P[3 * b] - P[3 * v], wy = P[3 * b + 1] - P[3 * v + 1], wz = P[3 * b + 2] - P[3 * v + 2];
  const d = (ux * wx + uy * wy + uz * wz) / (Math.hypot(ux, uy, uz) * Math.hypot(wx, wy, wz) || 1);
  return Math.acos(Math.max(-1, Math.min(1, d)));
}
const crossP = (a: Point, b: Point): Point => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = (a: Point): Point => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
