// R9 (M4, D85): a triangle mesh simplified by edge collapse under the quadric error metric (Garland & Heckbert 1997),
// our own TypeScript in typed arrays. Each vertex carries the sum of the squared-distance quadrics of the planes of its
// triangles (unweighted: the cost of a collapse is a sum of squared distances, mm², so its square root bounds the
// distance to every plane it gathered); each vertex's cheapest collapse is kept in an indexed min-heap.
//
// What the mesh's attributes say is kept: open boundaries, groups (per triangle: a repair's fill patches, a facet
// body's regions) and creases (a dihedral angle past `featureDegrees`) are feature lines. A feature line's vertices
// slide only along it (both ends on it and the edge itself a feature), a vertex off it collapses onto it (placed at
// the feature vertex), corners and ends of feature lines never move; penalty planes through each feature edge, square
// to its triangles, hold the line where it was. A collapse is made only when the mesh stays a manifold (the link
// condition) and no triangle turns over or degenerates. Triangles keep their winding and their group.
//
// The error is measured, not estimated: the distance from the original's vertices and triangle centres to the
// simplified mesh, and from the simplified mesh's to the original (meshDistance, a triangle hierarchy).
import { meshDistance } from './mesh-distance.js';

export interface DecimateOptions {
  /** Stop at this many triangles or fewer. */
  readonly targetTriangles?: number;
  /** Or at this share of the triangles (0–1); with neither, as far as `maxErrorMM` lets it go. */
  readonly ratio?: number;
  /** Make no collapse whose quadric bound (the square root of its cost) passes this (mm). */
  readonly maxErrorMM?: number;
  /** A dihedral angle past this (degrees, default 40) makes an edge a crease, kept as a feature line. */
  readonly featureDegrees?: number;
  /** Per triangle, a group (any integer); edges between groups are feature lines, and every triangle keeps its group. */
  readonly groups?: ArrayLike<number>;
  /** Measure the distance between the original and the result (default true). */
  readonly measure?: boolean;
}
export interface DecimateReport {
  readonly trianglesBefore: number; readonly trianglesAfter: number; readonly verticesBefore: number; readonly verticesAfter: number;
  readonly collapses: number;
  /** Collapses not made: they would turn a triangle over or flatten it; they would break the manifold. */
  readonly refused: { readonly flip: number; readonly topology: number };
  /** Why it stopped: the target reached, the error bound reached, or nothing left that it may collapse. */
  readonly stoppedBy: 'target' | 'error' | 'exhausted';
  /** The largest quadric bound of a collapse made (mm): no vertex is further than it from any plane it gathered. */
  readonly boundMM: number;
  /** Measured (when asked): from the original to the result, from the result to the original, the larger, and the RMS of both. */
  readonly distance?: { readonly toResultMaxMM: number; readonly toOriginalMaxMM: number; readonly hausdorffMM: number; readonly rmsMM: number; readonly samples: number };
  readonly ms: number;
}
export interface DecimateResult { readonly positions: Float64Array; readonly indices: Uint32Array; readonly groups: Int32Array | null; readonly report: DecimateReport }

/** Penalty weight of a feature edge's planes, against 1 for a triangle's own. */
const FEATURE_WEIGHT = 100;
/** A feature edge whose two triangles turn by less than this (cos 20°) is a smooth seam: no penalty planes. */
const SMOOTH_COS = 0.94;
/** A triangle is refused when its normal turns by more than this (cos 75°) or its area falls to nothing. */
const FLIP_COS = 0.26;

interface State {
  P: Float64Array; T: Uint32Array; G: Int32Array | null; nv: number; nt: number;
  alive: Uint8Array; vAlive: Uint8Array; head: Int32Array; next: Int32Array;
  Q: Float64Array; cosFeature: number; tiny2: number;
  // Each vertex's cheapest collapse: its partner, where the kept vertex goes, its cost; the heap of vertices by cost.
  best: Int32Array; at: Float64Array; cost: Float64Array; heap: Int32Array; pos: Int32Array; size: number;
  mark: Int32Array; stamp: number; ring: Int32Array; ringN: number;
  /** Scratch copies of a ring, for loops whose calls fill s.ring again: a refresh's, a collapse's. */
  ringR: Int32Array; ringU: Int32Array;
  /** Each vertex's feature degree, or −1 when it must be counted again (its neighbourhood changed). */
  fdeg: Int8Array;
  /** A feature scan of one vertex, per ring slot: triangles on the edge, their unit normals, the first's group, feature. */
  slot: Int32Array; fCount: Int32Array; fN: Float64Array; fG: Int32Array; fFeat: Uint8Array;
  /** Each triangle's unit normal (0, 0, 0 with no area), kept as its corners move. */
  N: Float64Array;
  /** Each vertex's sum of the area-weighted normals of the original triangles it stands for (merged as it merges): the way the surface it replaces faces. */
  R: Float64Array;
  flips: number; topology: number;
}

export function decimateMesh(positions: ArrayLike<number>, indices: ArrayLike<number>, options: DecimateOptions = {}): DecimateResult {
  const t0 = performance.now(), nv = positions.length / 3, nt = indices.length / 3;
  if (!Number.isInteger(nv) || !Number.isInteger(nt)) throw new RangeError('decimate: three numbers a vertex, three vertices a triangle');
  const target = options.targetTriangles !== undefined ? Math.max(0, Math.floor(options.targetTriangles)) : options.ratio !== undefined ? Math.max(0, Math.floor(options.ratio * nt)) : 0;
  const maxCost = options.maxErrorMM !== undefined ? options.maxErrorMM * options.maxErrorMM : Infinity;
  const P = Float64Array.from(positions), T = Uint32Array.from(indices);
  const G = options.groups ? Int32Array.from(options.groups) : null;
  if (G && G.length !== nt) throw new RangeError('decimate: one group a triangle');
  let lo0 = Infinity, hi0 = -Infinity;
  for (let i = 0; i < P.length; i++) { if (P[i] < lo0) lo0 = P[i]; if (P[i] > hi0) hi0 = P[i]; }
  const scale = Math.max(1e-9, hi0 - lo0);
  const s: State = {
    P, T, G, nv, nt, alive: new Uint8Array(nt).fill(1), vAlive: new Uint8Array(nv), head: new Int32Array(nv).fill(-1), next: new Int32Array(3 * nt).fill(-1),
    Q: new Float64Array(10 * nv), cosFeature: Math.cos((options.featureDegrees ?? 40) * Math.PI / 180), tiny2: (scale * 1e-9) ** 2,
    best: new Int32Array(nv).fill(-1), at: new Float64Array(3 * nv), cost: new Float64Array(nv).fill(Infinity), heap: new Int32Array(nv), pos: new Int32Array(nv).fill(-1), size: 0,
    mark: new Int32Array(nv), stamp: 0, ring: new Int32Array(64), ringN: 0, ringR: new Int32Array(64), ringU: new Int32Array(64), fdeg: new Int8Array(nv).fill(-1),
    N: new Float64Array(3 * nt), R: new Float64Array(3 * nv), slot: new Int32Array(nv), fCount: new Int32Array(64), fN: new Float64Array(6 * 64), fG: new Int32Array(64), fFeat: new Uint8Array(64), flips: 0, topology: 0,
  };
  // Corners in each vertex's list (a linked list through the corner index 3t + k), and the planes' quadrics.
  for (let c = 3 * nt - 1; c >= 0; c--) { const v = T[c]; s.next[c] = s.head[v]; s.head[v] = c; s.vAlive[v] = 1; }
  for (let t = 0; t < nt; t++) {
    unitNormal(s, t); addPlane(s, t);
    const n = normalOf(P, T[3 * t], T[3 * t + 1], T[3 * t + 2], n1);
    for (let j = 0; j < 3; j++) { const v = 3 * T[3 * t + j]; s.R[v] += n[0]; s.R[v + 1] += n[1]; s.R[v + 2] += n[2]; }
  }
  addFeaturePenalties(s);
  for (let v = 0; v < nv; v++) if (s.vAlive[v]) { refresh(s, v); }
  let triangles = nt, collapses = 0, bound = 0, stoppedBy: DecimateReport['stoppedBy'] = 'exhausted';
  while (s.size) {
    if (triangles <= target) { stoppedBy = 'target'; break; }
    const v = s.heap[0];
    // (Infinity: nothing left that may be collapsed — also when no error bound is set.)
    if (s.cost[v] === Infinity) { stoppedBy = 'exhausted'; break; }
    if (!(s.cost[v] <= maxCost)) { stoppedBy = 'error'; break; }
    const u = s.best[v];
    // (Checked when it comes to be made: the neighbourhood may have changed since it was priced.)
    const ok = allowed(s, v, u);
    if (ok === 'stale') { refresh(s, v); continue; }
    if (ok === 'no') { refreshValid(s, v); continue; }
    bound = Math.max(bound, Math.sqrt(Math.max(0, s.cost[v])));
    triangles -= collapse(s, v, u);
    collapses++;
  }
  if (stoppedBy === 'exhausted' && triangles <= target) stoppedBy = 'target';
  // The result: the vertices still used, renumbered in their order; the triangles alive, with their groups.
  const remap = new Int32Array(nv).fill(-1);
  let m = 0;
  const outT = new Uint32Array(3 * triangles), outG = G ? new Int32Array(triangles) : null;
  let k = 0;
  for (let t = 0; t < nt; t++) {
    if (!s.alive[t]) continue;
    for (let j = 0; j < 3; j++) { const v = T[3 * t + j]; if (remap[v] < 0) remap[v] = m++; outT[3 * k + j] = remap[v]; }
    if (outG) outG[k] = G![t];
    k++;
  }
  const outP = new Float64Array(3 * m);
  for (let v = 0; v < nv; v++) if (remap[v] >= 0) { outP[3 * remap[v]] = P[3 * v]; outP[3 * remap[v] + 1] = P[3 * v + 1]; outP[3 * remap[v] + 2] = P[3 * v + 2]; }
  const measured = options.measure === false ? undefined : (() => {
    const a = meshDistance(positions, indices, outP, outT), b = meshDistance(outP, outT, positions, indices);
    const samples = a.samples + b.samples;
    return { toResultMaxMM: a.maxMM, toOriginalMaxMM: b.maxMM, hausdorffMM: Math.max(a.maxMM, b.maxMM), rmsMM: Math.sqrt((a.sumSq + b.sumSq) / samples), samples };
  })();
  return {
    positions: outP, indices: outT, groups: outG,
    report: { trianglesBefore: nt, trianglesAfter: triangles, verticesBefore: nv, verticesAfter: m, collapses, refused: { flip: s.flips, topology: s.topology }, stoppedBy, boundMM: bound, ...(measured ? { distance: measured } : {}), ms: performance.now() - t0 },
  };
}

// ---- Quadrics --------------------------------------------------------------------------------------------------------

/** The plane (unit normal n, offset d) as a quadric added to vertex v's, `w` times. */
function addQuadric(Q: Float64Array, v: number, a: number, b: number, c: number, d: number, w: number): void {
  const o = 10 * v;
  Q[o] += w * a * a; Q[o + 1] += w * a * b; Q[o + 2] += w * a * c; Q[o + 3] += w * a * d;
  Q[o + 4] += w * b * b; Q[o + 5] += w * b * c; Q[o + 6] += w * b * d;
  Q[o + 7] += w * c * c; Q[o + 8] += w * c * d; Q[o + 9] += w * d * d;
}
/** Triangle t's plane added to its three corners. */
function addPlane(s: State, t: number): void {
  const n = normalOf(s.P, s.T[3 * t], s.T[3 * t + 1], s.T[3 * t + 2], n1), l = Math.hypot(n[0], n[1], n[2]);
  if (!(l > 0)) return;
  const a = n[0] / l, b = n[1] / l, c = n[2] / l, p = 3 * s.T[3 * t], d = -(a * s.P[p] + b * s.P[p + 1] + c * s.P[p + 2]);
  for (let j = 0; j < 3; j++) addQuadric(s.Q, s.T[3 * t + j], a, b, c, d, 1);
}
/** Each feature edge's planes (through the edge, square to each of its triangles) added to both its ends. */
function addFeaturePenalties(s: State): void {
  const P = s.P;
  for (let a = 0; a < s.nv; a++) {
    if (!s.vAlive[a]) continue;
    featureScan(s, a);
    for (let i = 0; i < s.ringN; i++) {
      const b = s.ring[i];
      if (!s.fFeat[i] || b < a) continue;
      // (A seam between groups where the surface is smooth — a region split for its name, not at a crease — gets no
      // penalty: it still only slides along itself, but straightens as cheaply as the surface lets it.)
      if (s.fCount[i] === 2 && s.fN[6 * i] * s.fN[6 * i + 3] + s.fN[6 * i + 1] * s.fN[6 * i + 4] + s.fN[6 * i + 2] * s.fN[6 * i + 5] > SMOOTH_COS) continue;
      const e0 = P[3 * b] - P[3 * a], e1 = P[3 * b + 1] - P[3 * a + 1], e2 = P[3 * b + 2] - P[3 * a + 2];
      for (let k = 0; k < Math.min(2, s.fCount[i]); k++) {
        const o = 6 * i + 3 * k, nx = s.fN[o], ny = s.fN[o + 1], nz = s.fN[o + 2];
        let x = ny * e2 - nz * e1, y = nz * e0 - nx * e2, z = nx * e1 - ny * e0;
        const l = Math.hypot(x, y, z); if (!(l > 0)) continue;
        x /= l; y /= l; z /= l;
        const d = -(x * P[3 * a] + y * P[3 * a + 1] + z * P[3 * a + 2]);
        addQuadric(s.Q, a, x, y, z, d, FEATURE_WEIGHT); addQuadric(s.Q, b, x, y, z, d, FEATURE_WEIGHT);
      }
    }
  }
}
/** The quadric of u and v together at point (x, y, z). */
function costAt(Q: Float64Array, u: number, v: number, x: number, y: number, z: number): number {
  const a = 10 * u, b = 10 * v, q0 = Q[a] + Q[b], q1 = Q[a + 1] + Q[b + 1], q2 = Q[a + 2] + Q[b + 2], q3 = Q[a + 3] + Q[b + 3], q4 = Q[a + 4] + Q[b + 4], q5 = Q[a + 5] + Q[b + 5], q6 = Q[a + 6] + Q[b + 6], q7 = Q[a + 7] + Q[b + 7], q8 = Q[a + 8] + Q[b + 8], q9 = Q[a + 9] + Q[b + 9];
  return x * (q0 * x + q1 * y + q2 * z + q3) + y * (q1 * x + q4 * y + q5 * z + q6) + z * (q2 * x + q5 * y + q7 * z + q8) + (q3 * x + q6 * y + q8 * z + q9);
}

// ---- Topology --------------------------------------------------------------------------------------------------------

/** Triangle t's unit normal into s.N. */
function unitNormal(s: State, t: number): void {
  const n = normalOf(s.P, s.T[3 * t], s.T[3 * t + 1], s.T[3 * t + 2], n1), l = Math.hypot(n[0], n[1], n[2]);
  s.N[3 * t] = l > 0 ? n[0] / l : 0; s.N[3 * t + 1] = l > 0 ? n[1] / l : 0; s.N[3 * t + 2] = l > 0 ? n[2] / l : 0;
}
/** Triangle a b c's normal (its length twice the area), into `out`. */
function normalOf(P: Float64Array, a: number, b: number, c: number, out: Float64Array): Float64Array {
  const ux = P[3 * b] - P[3 * a], uy = P[3 * b + 1] - P[3 * a + 1], uz = P[3 * b + 2] - P[3 * a + 2], vx = P[3 * c] - P[3 * a], vy = P[3 * c + 1] - P[3 * a + 1], vz = P[3 * c + 2] - P[3 * a + 2];
  out[0] = uy * vz - uz * vy; out[1] = uz * vx - ux * vz; out[2] = ux * vy - uy * vx;
  return out;
}
const n1 = new Float64Array(3), n2 = new Float64Array(3);
/** The alive triangles with both u and v (at most two in a manifold), counted; `out` gets up to two of them. */
function shared(s: State, u: number, v: number, out: Int32Array): number {
  let n = 0;
  for (let c = s.head[u]; c >= 0; c = s.next[c]) {
    const t = (c / 3) | 0; if (!s.alive[t]) continue;
    const T = s.T, o = 3 * t;
    if (T[o] === v || T[o + 1] === v || T[o + 2] === v) { if (n < out.length) out[n] = t; n++; }
  }
  return n;
}
const pair = new Int32Array(4);
/** Edge a–b is a feature: open (one triangle), between groups, or a crease past the angle (as the mesh is now). */
function featureEdge(s: State, a: number, b: number): boolean {
  const n = shared(s, a, b, pair);
  if (n !== 2) return true;
  if (s.G && s.G[pair[0]] !== s.G[pair[1]]) return true;
  const T = s.T, p = normalOf(s.P, T[3 * pair[0]], T[3 * pair[0] + 1], T[3 * pair[0] + 2], n1), q = normalOf(s.P, T[3 * pair[1]], T[3 * pair[1] + 1], T[3 * pair[1] + 2], n2);
  const lp = Math.hypot(p[0], p[1], p[2]), lq = Math.hypot(q[0], q[1], q[2]);
  return !(lp > 0 && lq > 0) || (p[0] * q[0] + p[1] * q[1] + p[2] * q[2]) / (lp * lq) < s.cosFeature;
}
/** Vertex v's neighbours, into s.ring (s.ringN of them), each once. */
function neighbours(s: State, v: number): void {
  const stamp = ++s.stamp; s.ringN = 0;
  for (let c = s.head[v]; c >= 0; c = s.next[c]) {
    const t = (c / 3) | 0; if (!s.alive[t]) continue;
    for (let j = 0; j < 3; j++) {
      const w = s.T[3 * t + j];
      if (w === v || s.mark[w] === stamp) continue;
      s.mark[w] = stamp;
      if (s.ringN === s.ring.length) growScan(s);
      s.ring[s.ringN++] = w;
    }
  }
}
/** How many alive triangles v has. */
function valence(s: State, v: number): number {
  let n = 0;
  for (let c = s.head[v]; c >= 0; c = s.next[c]) if (s.alive[(c / 3) | 0]) n++;
  return n;
}
/** How many feature edges meet at v (0: inside; 2: on a line; else a corner or a line's end). */
function featureDegree(s: State, v: number): number {
  if (s.fdeg[v] >= 0) return s.fdeg[v];
  featureScan(s, v);
  let k = 0, a = -1, b = -1;
  for (let i = 0; i < s.ringN; i++) if (s.fFeat[i]) { if (k === 0) a = s.ring[i]; else if (k === 1) b = s.ring[i]; k++; }
  // (Two feature edges turning past the angle — a sheet's corner, a patch's — are a corner, as three are: counted 3.)
  if (k === 2) {
    const P = s.P, ax = P[3 * v] - P[3 * a], ay = P[3 * v + 1] - P[3 * a + 1], az = P[3 * v + 2] - P[3 * a + 2], bx = P[3 * b] - P[3 * v], by = P[3 * b + 1] - P[3 * v + 1], bz = P[3 * b + 2] - P[3 * v + 2];
    const la = Math.hypot(ax, ay, az), lb = Math.hypot(bx, by, bz);
    if (!(la > 0 && lb > 0) || (ax * bx + ay * by + az * bz) / (la * lb) < s.cosFeature) k = 3;
  }
  s.fdeg[v] = Math.min(k, 127);
  return k;
}
/**
 * v's neighbours (into s.ring) and, for each, whether the edge to it is a feature — in one pass over v's triangles:
 * an edge with other than two triangles, between groups, at a crease, or by a triangle with no area.
 */
function featureScan(s: State, v: number): void {
  const stamp = ++s.stamp, T = s.T, G = s.G;
  s.ringN = 0;
  for (let c = s.head[v]; c >= 0; c = s.next[c]) {
    const t = (c / 3) | 0; if (!s.alive[t]) continue;
    const nx = s.N[3 * t], ny = s.N[3 * t + 1], nz = s.N[3 * t + 2], flat = nx === 0 && ny === 0 && nz === 0, g = G ? G[t] : 0;
    for (let j = 0; j < 3; j++) {
      const w = T[3 * t + j]; if (w === v) continue;
      let i: number;
      if (s.mark[w] !== stamp) {
        s.mark[w] = stamp;
        if (s.ringN === s.ring.length) growScan(s);
        i = s.ringN++; s.ring[i] = w; s.slot[w] = i; s.fCount[i] = 0; s.fFeat[i] = 0;
      } else i = s.slot[w];
      const k = s.fCount[i]++;
      if (flat) s.fFeat[i] = 1;
      if (k === 0) { s.fN[6 * i] = nx; s.fN[6 * i + 1] = ny; s.fN[6 * i + 2] = nz; s.fG[i] = g; }
      else if (k === 1) {
        s.fN[6 * i + 3] = nx; s.fN[6 * i + 4] = ny; s.fN[6 * i + 5] = nz;
        if ((G && g !== s.fG[i]) || nx * s.fN[6 * i] + ny * s.fN[6 * i + 1] + nz * s.fN[6 * i + 2] < s.cosFeature) s.fFeat[i] = 1;
      }
    }
  }
  for (let i = 0; i < s.ringN; i++) if (s.fCount[i] !== 2) s.fFeat[i] = 1;
}
/** The scan's per-slot arrays (and the ring) twice as long. */
function growScan(s: State): void {
  const n = 2 * s.ring.length, ring = new Int32Array(n), count = new Int32Array(n), N = new Float64Array(6 * n), G = new Int32Array(n), F = new Uint8Array(n);
  ring.set(s.ring); count.set(s.fCount); N.set(s.fN); G.set(s.fG); F.set(s.fFeat);
  s.ring = ring; s.fCount = count; s.fN = N; s.fG = G; s.fFeat = F;
}
/** s.ring copied into `into` (grown when needed); returns the buffer. */
function copyRing(s: State, into: Int32Array): Int32Array {
  const out = into.length >= s.ringN ? into : new Int32Array(2 * s.ringN);
  out.set(s.ring.subarray(0, s.ringN));
  return out;
}

// ---- Pricing ---------------------------------------------------------------------------------------------------------

const place = new Float64Array(3);
/** Where u and v would go (into `place`) and its cost; Infinity when the feature rules forbid the collapse. */
function price(s: State, u: number, v: number): number {
  const fu = featureDegree(s, u), fv = featureDegree(s, v), P = s.P;
  let from = -1;
  if (fu && fv) {
    // Both on feature lines: only along one (the edge itself a feature), and a corner or end stays.
    if (!featureEdge(s, u, v) || (fu !== 2 && fv !== 2)) return Infinity;
    if (fu !== 2) from = u; else if (fv !== 2) from = v;
  } else if (fu) from = u; else if (fv) from = v;
  if (from >= 0) { place[0] = P[3 * from]; place[1] = P[3 * from + 1]; place[2] = P[3 * from + 2]; return costAt(s.Q, u, v, place[0], place[1], place[2]); }
  // Sliding along a feature line: on the edge itself (the quadric's least along it), so the line keeps to where it ran.
  if (fu && fv) return onSegment(s, u, v);
  // The quadric's minimum, when its 3 × 3 part is well conditioned; else the better of the ends and the middle.
  const Q = s.Q, a = 10 * u, b = 10 * v;
  const m0 = Q[a] + Q[b], m1 = Q[a + 1] + Q[b + 1], m2 = Q[a + 2] + Q[b + 2], m4 = Q[a + 4] + Q[b + 4], m5 = Q[a + 5] + Q[b + 5], m7 = Q[a + 7] + Q[b + 7];
  const r0 = -(Q[a + 3] + Q[b + 3]), r1 = -(Q[a + 6] + Q[b + 6]), r2 = -(Q[a + 8] + Q[b + 8]);
  const c0 = m4 * m7 - m5 * m5, c1 = m2 * m5 - m1 * m7, c2 = m1 * m5 - m2 * m4, det = m0 * c0 + m1 * c1 + m2 * c2;
  const tr = m0 + m4 + m7;
  if (Math.abs(det) > 1e-9 * tr * tr * tr) {
    const x = (r0 * c0 + r1 * c1 + r2 * c2) / det;
    const y = (r0 * c1 + r1 * (m0 * m7 - m2 * m2) + r2 * (m1 * m2 - m0 * m5)) / det;
    const z = (r0 * c2 + r1 * (m1 * m2 - m0 * m5) + r2 * (m0 * m4 - m1 * m1)) / det;
    // (Kept near the edge: a minimum far off it is a badly conditioned quadric's.)
    const ex = P[3 * v] - P[3 * u], ey = P[3 * v + 1] - P[3 * u + 1], ez = P[3 * v + 2] - P[3 * u + 2], el = Math.hypot(ex, ey, ez);
    const mx = (P[3 * u] + P[3 * v]) / 2, my = (P[3 * u + 1] + P[3 * v + 1]) / 2, mz = (P[3 * u + 2] + P[3 * v + 2]) / 2;
    if (Math.hypot(x - mx, y - my, z - mz) <= 2 * el) { place[0] = x; place[1] = y; place[2] = z; return costAt(Q, u, v, x, y, z); }
  }
  let bestCost = Infinity;
  for (let k = 0; k < 3; k++) {
    const x = k === 0 ? P[3 * u] : k === 1 ? P[3 * v] : (P[3 * u] + P[3 * v]) / 2, y = k === 0 ? P[3 * u + 1] : k === 1 ? P[3 * v + 1] : (P[3 * u + 1] + P[3 * v + 1]) / 2, z = k === 0 ? P[3 * u + 2] : k === 1 ? P[3 * v + 2] : (P[3 * u + 2] + P[3 * v + 2]) / 2;
    const e = costAt(Q, u, v, x, y, z);
    if (e < bestCost) { bestCost = e; place[0] = x; place[1] = y; place[2] = z; }
  }
  return bestCost;
}
/** The least of u and v's quadric along the segment u–v (into `place`), and its cost. */
function onSegment(s: State, u: number, v: number): number {
  const P = s.P, ux = P[3 * u], uy = P[3 * u + 1], uz = P[3 * u + 2], dx = P[3 * v] - ux, dy = P[3 * v + 1] - uy, dz = P[3 * v + 2] - uz;
  // Q(u + t d) = c0 + c1 t + c2 t²: from three values, at t = 0, 1/2, 1.
  const f0 = costAt(s.Q, u, v, ux, uy, uz), fh = costAt(s.Q, u, v, ux + dx / 2, uy + dy / 2, uz + dz / 2), f1 = costAt(s.Q, u, v, ux + dx, uy + dy, uz + dz);
  const c2 = 2 * (f0 - 2 * fh + f1), c1 = f1 - f0 - c2;
  let t = c2 > 0 ? -c1 / (2 * c2) : f1 < f0 ? 1 : 0;
  t = Math.max(0, Math.min(1, t));
  place[0] = ux + t * dx; place[1] = uy + t * dy; place[2] = uz + t * dz;
  return costAt(s.Q, u, v, place[0], place[1], place[2]);
}
/** v's cheapest collapse (by cost, then the partner's number), into the heap; `valid`: only one that may be made now. */
function refreshWith(s: State, v: number, valid: boolean): void {
  neighbours(s, v);
  const n = s.ringN, ring = s.ringR = copyRing(s, s.ringR);
  let bestCost = Infinity, bestTo = -1, bx = 0, by = 0, bz = 0;
  for (let i = 0; i < n; i++) {
    const w = ring[i], c = price(s, v, w);
    if (!(c < bestCost || (c === bestCost && c < Infinity && w < bestTo))) continue;
    if (valid) { const px = place[0], py = place[1], pz = place[2]; if (!allowedAt(s, v, w, px, py, pz, false)) continue; place[0] = px; place[1] = py; place[2] = pz; }
    bestCost = Math.max(0, c); bestTo = w; bx = place[0]; by = place[1]; bz = place[2];
  }
  s.best[v] = bestTo; s.at[3 * v] = bx; s.at[3 * v + 1] = by; s.at[3 * v + 2] = bz;
  heapSet(s, v, bestTo < 0 ? Infinity : bestCost);
}
const refresh = (s: State, v: number) => refreshWith(s, v, false);
const refreshValid = (s: State, v: number) => refreshWith(s, v, true);

// ---- Making a collapse -----------------------------------------------------------------------------------------------

/** The collapse priced for v (onto s.best[v], at s.at) may be made now. */
function allowed(s: State, v: number, u: number): 'yes' | 'stale' | 'no' {
  if (u < 0 || !s.vAlive[u] || !s.vAlive[v]) return 'stale';
  // (Priced afresh: its neighbourhood, so its feature rules and place, may have changed — dearer now, it waits its turn.)
  const c = Math.max(0, price(s, v, u));
  if (c === Infinity || c > s.cost[v] + 1e-12 * (1 + s.cost[v])) return 'stale';
  s.at[3 * v] = place[0]; s.at[3 * v + 1] = place[1]; s.at[3 * v + 2] = place[2];
  return allowedAt(s, v, u, place[0], place[1], place[2], true) ? 'yes' : 'no';
}
const two = new Int32Array(3);
/** The link condition (the mesh stays a manifold) and no triangle turned over or flattened, with v and u at (x, y, z). */
function allowedAt(s: State, v: number, u: number, x: number, y: number, z: number, count: boolean): boolean {
  const k = shared(s, v, u, two);
  if (k < 1 || k > 2) { if (count) s.topology++; return false; }
  // Neighbours common to both: one for each shared triangle, no more (else the collapse pinches the surface).
  neighbours(s, v);
  const stamp = s.stamp; let common = 0;
  for (let c = s.head[u]; c >= 0; c = s.next[c]) {
    const t = (c / 3) | 0; if (!s.alive[t]) continue;
    for (let j = 0; j < 3; j++) { const w = s.T[3 * t + j]; if (w !== u && w !== v && s.mark[w] === stamp) { s.mark[w] = -stamp; common++; } }
  }
  if (common !== k) { if (count) s.topology++; return false; }
  // (Two vertices of three triangles each, sharing two: a tetrahedron's edge, or a fold — collapsed, two triangles
  // would lie back to back.)
  if (k === 2 && valence(s, v) === 3 && valence(s, u) === 3) { if (count) s.topology++; return false; }
  if (!flipFree(s, v, u, x, y, z) || !flipFree(s, u, v, x, y, z)) { if (count) s.flips++; return false; }
  return true;
}
/** v's triangles that do not hold u, with v at (x, y, z): none turned past FLIP_COS, none flattened. */
function flipFree(s: State, v: number, u: number, x: number, y: number, z: number): boolean {
  const T = s.T, P = s.P;
  for (let c = s.head[v]; c >= 0; c = s.next[c]) {
    const t = (c / 3) | 0; if (!s.alive[t]) continue;
    const o = 3 * t, a = T[o], b = T[o + 1], d = T[o + 2];
    if (a === u || b === u || d === u) continue;
    const n0 = normalOf(P, a, b, d, n1);
    // The triangle with v moved: its normal from the moved corner.
    const j = a === v ? 0 : b === v ? 1 : 2, p = T[o + (j + 1) % 3], q = T[o + (j + 2) % 3];
    const ux = P[3 * p] - x, uy = P[3 * p + 1] - y, uz = P[3 * p + 2] - z, wx = P[3 * q] - x, wy = P[3 * q + 1] - y, wz = P[3 * q + 2] - z;
    const n1x = uy * wz - uz * wy, n1y = uz * wx - ux * wz, n1z = ux * wy - uy * wx;
    const l0 = Math.hypot(n0[0], n0[1], n0[2]), l1 = Math.hypot(n1x, n1y, n1z);
    if (!(l1 * l1 > s.tiny2 * 4)) return false;
    if (l0 > 0 && (n0[0] * n1x + n0[1] * n1y + n0[2] * n1z) < FLIP_COS * l0 * l1) return false;
    // (Nor facing away from the surface its corners stand for: a fold built up over many collapses. v's corner
    // counts as v and u merged.)
    const R = s.R, rp = 3 * p, rq = 3 * q;
    const rx = R[rp] + R[rq] + R[3 * v] + R[3 * u], ry = R[rp + 1] + R[rq + 1] + R[3 * v + 1] + R[3 * u + 1], rz = R[rp + 2] + R[rq + 2] + R[3 * v + 2] + R[3 * u + 2];
    if (rx * n1x + ry * n1y + rz * n1z <= 0) return false;
  }
  return true;
}
/** v collapsed into u at s.at[v]: the triangles holding both die, v's others take u; returns how many died. */
function collapse(s: State, v: number, u: number): number {
  const T = s.T, P = s.P;
  P[3 * u] = s.at[3 * v]; P[3 * u + 1] = s.at[3 * v + 1]; P[3 * u + 2] = s.at[3 * v + 2];
  let died = 0, last = -1;
  for (let c = s.head[v]; c >= 0; c = s.next[c]) {
    last = c;
    const t = (c / 3) | 0; if (!s.alive[t]) continue;
    const o = 3 * t;
    if (T[o] === u || T[o + 1] === u || T[o + 2] === u) { s.alive[t] = 0; died++; continue; }
    T[c] = u;
  }
  // v's corners join u's list; v is gone.
  if (last >= 0) { s.next[last] = s.head[u]; s.head[u] = s.head[v]; }
  s.head[v] = -1; s.vAlive[v] = 0;
  for (let k = 0; k < 10; k++) s.Q[10 * u + k] += s.Q[10 * v + k];
  for (let k = 0; k < 3; k++) s.R[3 * u + k] += s.R[3 * v + k];
  heapSet(s, v, NaN);
  compactList(s, u);
  for (let c = s.head[u]; c >= 0; c = s.next[c]) unitNormal(s, (c / 3) | 0);
  // Feature degrees counted again round u (its triangles moved: their edges' angles changed); then u and its
  // neighbours priced again (their collapses with u changed).
  neighbours(s, u);
  const n = s.ringN, ring = s.ringU = copyRing(s, s.ringU);
  s.fdeg[u] = -1;
  for (let i = 0; i < n; i++) s.fdeg[ring[i]] = -1;
  refresh(s, u);
  // A neighbour whose cheapest was with v or u priced afresh; any other offered its collapse with u, if cheaper.
  // (A price gone stale since — a feature degree changed round here — is caught when it comes up: allowed().)
  for (let i = 0; i < n; i++) {
    const x = ring[i];
    if (s.best[x] === v || s.best[x] === u || s.best[x] < 0) { refresh(s, x); continue; }
    const c = price(s, x, u);
    if (c < s.cost[x] || (c === s.cost[x] && u < s.best[x])) { s.best[x] = u; s.at[3 * x] = place[0]; s.at[3 * x + 1] = place[1]; s.at[3 * x + 2] = place[2]; heapSet(s, x, Math.max(0, c)); }
  }
  return died;
}
/** u's corner list without its dead triangles' corners. */
function compactList(s: State, u: number): void {
  let prev = -1;
  for (let c = s.head[u]; c >= 0; c = s.next[c]) {
    if (s.alive[(c / 3) | 0]) { prev = c; continue; }
    if (prev < 0) s.head[u] = s.next[c]; else s.next[prev] = s.next[c];
  }
}

// ---- The heap (by cost, then vertex number) --------------------------------------------------------------------------

const before = (s: State, a: number, b: number) => s.cost[a] < s.cost[b] || (s.cost[a] === s.cost[b] && a < b);
/** v's key set (NaN: taken out). */
function heapSet(s: State, v: number, key: number): void {
  const i = s.pos[v];
  if (Number.isNaN(key)) {
    if (i < 0) return;
    const last = s.heap[--s.size]; s.pos[v] = -1;
    if (i < s.size) { s.heap[i] = last; s.pos[last] = i; siftUp(s, i); siftDown(s, s.pos[last]); }
    return;
  }
  s.cost[v] = key;
  if (i < 0) { s.heap[s.size] = v; s.pos[v] = s.size; siftUp(s, s.size++); return; }
  siftUp(s, i); siftDown(s, s.pos[v]);
}
function siftUp(s: State, i: number): void {
  const h = s.heap, v = h[i];
  while (i > 0) { const p = (i - 1) >> 1; if (!before(s, v, h[p])) break; h[i] = h[p]; s.pos[h[i]] = i; i = p; }
  h[i] = v; s.pos[v] = i;
}
function siftDown(s: State, i: number): void {
  const h = s.heap, v = h[i], n = s.size;
  for (;;) {
    let c = 2 * i + 1; if (c >= n) break;
    if (c + 1 < n && before(s, h[c + 1], h[c])) c++;
    if (!before(s, h[c], v)) break;
    h[i] = h[c]; s.pos[h[i]] = i; i = c;
  }
  h[i] = v; s.pos[v] = i;
}
