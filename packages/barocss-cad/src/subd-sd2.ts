// SD2 (R7): extraordinary vertices, n-gons and darts.
//
// A cage that is not regular everywhere takes one Catmull–Clark step (OpenSubdiv's rules for infinitely sharp creases,
// "edge and corner" boundaries) — a second when a quad would then hold two irregular corners (an n-gon's face point
// beside an irregular vertex). Every quad whose corners are regular stays the exact bicubic B-spline of SD1. Each quad
// at an irregular vertex becomes a cap: a bicubic patch split once each way (interior double knots at τ = ¼: 2 × 2
// Bézier pieces, C1 inside), its far rows those of the B-spline beside it (C1 there), its points near the vertex the least
// points near the vertex fitted to the limit surface within the conditions that make every edge out of it G1:
//   ∂_cross(left) + ∂_cross(right) = α(t)·b′(t), α = 2·cos θ·(1 − t/τ)² on the half at the vertex, 0 on the other
// (C1 at τ, as the cross derivatives are there), that half of the edge quadratic (so α·b′ is cubic); θ the sector's
// angle step (2π/n inside, π/k between the two edges of a crease, φ/k at a corner). Crease and
// boundary edges keep their B-spline curve exactly (G0 there); a dart's sharp edge is shared, not G1. Promised: C2
// away from irregular vertices, G1 at and around them, G0 across creases; never G2.
import type { Point, Surface } from './types.js';
import { evaluateSurfaceD1 } from './derivatives.js';
import { evaluateSurface } from './math.js';

export class SubdError extends Error {
  constructor(readonly code: 'INPUT' | 'CAPABILITY', detail: string) { super(`SubD: ${detail}`); this.name = 'SubdError'; }
}
export interface PolyCage { readonly positions: ArrayLike<number>; readonly faces: readonly (readonly number[])[]; readonly creases?: readonly (readonly [number, number])[] }
type P3 = [number, number, number];

/** The most edges at a vertex (and sides of a face) SD2 takes. */
export const SUBD_MAX_VALENCE = 32;

// ---- Topology of a polygon cage --------------------------------------------------------------------------------------

export type VertexKind = 'smooth' | 'dart' | 'crease' | 'corner';
/** A vertex's faces in order round it (each the next across the previous one's second edge), its edges between them. */
export interface Fan {
  readonly faces: { readonly face: number; readonly side: number }[];
  /** The other ends of the edges in order: edge k is face k's first edge (and face k − 1's second); K + 1 of them when open. */
  readonly ends: number[];
  readonly sharp: boolean[];
  readonly closed: boolean;
  readonly kind: VertexKind;
  readonly regular: boolean;
}
export interface PolyMesh {
  readonly P: Float64Array; readonly nv: number; readonly F: number[][];
  /** Half-edges: face k side s (F[k][s] → F[k][s + 1]) is start[k] + s; its twin, −1 on a boundary. */
  readonly start: Int32Array; readonly twin: Int32Array; readonly heFace: Int32Array; readonly heSide: Int32Array;
  /** Sharp: a boundary edge or a crease. */
  readonly sharp: Uint8Array; readonly crease: Set<number>;
  readonly fans: (Fan | null)[];
}
const ekey = (a: number, b: number, nv: number) => Math.min(a, b) * nv + Math.max(a, b);

/** The cage checked and its topology: half-edges, sharp edges and each vertex's fan, kind and regularity. */
export function polyMesh(cage: PolyCage, allowNgons = true, lenient = false): PolyMesh {
  const P = Float64Array.from(cage.positions), nv = P.length / 3;
  if (!Number.isInteger(nv) || nv < 3) throw new SubdError('INPUT', 'the cage needs x, y, z for at least three vertices');
  for (let i = 0; i < P.length; i++) if (!Number.isFinite(P[i])) throw new SubdError('INPUT', 'a cage position is not a finite number');
  const F = cage.faces.map(f => [...f]);
  if (!F.length) throw new SubdError('INPUT', 'the cage has no faces');
  F.forEach((f, k) => {
    if (f.length < 3) throw new SubdError('INPUT', `face ${k} has ${f.length} sides (at least 3)`);
    if (f.length !== 4 && !allowNgons) throw new SubdError('CAPABILITY', `face ${k} has ${f.length} sides`);
    if (f.length > SUBD_MAX_VALENCE) throw new SubdError('CAPABILITY', `face ${k} has ${f.length} sides (at most ${SUBD_MAX_VALENCE})`);
    for (const v of f) if (!Number.isInteger(v) || v < 0 || v >= nv) throw new SubdError('INPUT', `face ${k} names vertex ${v}, not one of the ${nv}`);
    for (let i = 1; i < f.length; i++) for (let j = 0; j < i; j++) if (f[i] === f[j]) throw new SubdError('INPUT', `face ${k} repeats a vertex`);
  });
  const start = new Int32Array(F.length + 1);
  for (let k = 0; k < F.length; k++) start[k + 1] = start[k] + F[k].length;
  // Half-edges by their start vertex (CSR), so a twin or a repeat is found among a vertex's few outgoing ones (PERF3
  // A4: a Map of every half-edge was most of the one-ring meshes' cost).
  const H = start[F.length], heFace = new Int32Array(H), heSide = new Int32Array(H), heEndV = new Int32Array(H);
  const outStart = new Int32Array(nv + 1);
  for (let k = 0; k < F.length; k++) { const f = F[k]; for (let s = 0; s < f.length; s++) { const h = start[k] + s; heFace[h] = k; heSide[h] = s; heEndV[h] = f[(s + 1) % f.length]; outStart[f[s] + 1]++; } }
  for (let v = 0; v < nv; v++) outStart[v + 1] += outStart[v];
  const outHe = new Int32Array(H), fill = outStart.slice(0, nv);
  for (let h = 0; h < H; h++) outHe[fill[F[heFace[h]][heSide[h]]]++] = h;
  const halfOf = (a: number, b: number) => { for (let i = outStart[a]; i < outStart[a + 1]; i++) if (heEndV[outHe[i]] === b) return outHe[i]; return -1; };
  for (let v = 0; v < nv; v++) for (let i = outStart[v]; i < outStart[v + 1]; i++) for (let j = outStart[v]; j < i; j++) if (heEndV[outHe[i]] === heEndV[outHe[j]])
    throw new SubdError('INPUT', `edge ${v}–${heEndV[outHe[i]]} is used twice the same way: the faces are not wound one way, or more than two faces meet there`);
  const twin = new Int32Array(H).fill(-1);
  for (let k = 0; k < F.length; k++) { const f = F[k]; for (let s = 0; s < f.length; s++) { const h = start[k] + s, t = halfOf(heEndV[h], f[s]); if (t >= 0) { if (heFace[t] === k) throw new SubdError('INPUT', `face ${k} meets itself`); twin[h] = t; } } }
  const crease = new Set<number>();
  for (const [a, b] of cage.creases ?? []) {
    if (!(a >= 0 && a < nv && b >= 0 && b < nv) || (halfOf(a, b) < 0 && halfOf(b, a) < 0)) throw new SubdError('INPUT', `crease ${a}–${b} is not an edge of the cage`);
    crease.add(ekey(a, b, nv));
  }
  const sharp = new Uint8Array(H);
  for (let h = 0; h < H; h++) { const f = F[heFace[h]], s = heSide[h]; if (twin[h] < 0 || (crease.size && crease.has(ekey(f[s], f[(s + 1) % f.length], nv)))) sharp[h] = 1; }
  const m: PolyMesh = { P, nv, F, start, twin, heFace, heSide, sharp, crease, fans: new Array<Fan | null>(nv).fill(null) };
  // Each vertex's outgoing half-edges (in half-edge order), then its fan.
  for (let v = 0; v < nv; v++) if (outStart[v + 1] > outStart[v]) {
    const outs: number[] = new Array(outStart[v + 1] - outStart[v]);
    for (let i = 0; i < outs.length; i++) outs[i] = outHe[outStart[v] + i];
    // (Lenient, for a one-ring cut out of a cage: a vertex on its rim whose faces there are not one fan is held as a
    // corner — it lies outside the region that is evaluated.)
    m.fans[v] = fanOf(m, v, outs, lenient) ?? RIM_CORNER;
  }
  return m;
}
const prevHe = (m: PolyMesh, h: number) => { const k = m.heFace[h], n = m.F[k].length; return m.start[k] + (m.heSide[h] + n - 1) % n; };
const heEnd = (m: PolyMesh, h: number) => { const f = m.F[m.heFace[h]]; return f[(m.heSide[h] + 1) % f.length]; };

const RIM_CORNER: Fan = { faces: [], ends: [], sharp: [], closed: false, kind: 'corner', regular: false };
/** A vertex's fan; null when lenient and its faces are not one fan (a one-ring's rim). */
function fanOf(m: PolyMesh, v: number, outs: number[], lenient = false): Fan | null {
  // An open fan starts at its boundary edge (a face on its left only); a closed one at a sharp edge when it has one.
  let h0 = outs.find(h => m.twin[h] < 0) ?? -1;
  const closed = h0 < 0;
  if (closed) h0 = outs.find(h => m.sharp[h]) ?? Math.min(...outs);
  const faces: { face: number; side: number }[] = [], ends: number[] = [], sharp: boolean[] = [];
  let h = h0;
  for (;;) {
    faces.push({ face: m.heFace[h], side: m.heSide[h] }); ends.push(heEnd(m, h)); sharp.push(!!m.sharp[h]);
    const p = prevHe(m, h), t = m.twin[p];
    if (t < 0) { ends.push(m.F[m.heFace[p]][m.heSide[p]]); sharp.push(true); break; }
    if (t === h0) break;
    h = t;
    if (faces.length > outs.length) break;
  }
  if (faces.length !== outs.length) { if (lenient) return null; throw new SubdError('INPUT', `vertex ${v} joins faces that do not form one fan round it (not a manifold)`); }
  if (faces.length > SUBD_MAX_VALENCE) throw new SubdError('CAPABILITY', `vertex ${v} has ${faces.length} faces round it (at most ${SUBD_MAX_VALENCE})`);
  const s = sharp.filter(Boolean).length, K = faces.length;
  // OpenSubdiv: 0 or 1 sharp edges smooth (1: a dart), 2 a crease, 3 or more a corner; a boundary vertex of one face a corner.
  const kind: VertexKind = !closed && K === 1 ? 'corner' : s === 0 ? 'smooth' : s === 1 ? 'dart' : s === 2 ? 'crease' : 'corner';
  const sectors = sectorSizes(sharp, closed);
  const regular = kind === 'smooth' ? K === 4 && faces.every(f => m.F[f.face].length === 4)
    : kind === 'crease' ? sectors.every(n => n === 2) && faces.every(f => m.F[f.face].length === 4)
    : kind === 'corner' ? sectors.every(n => n === 1) && faces.every(f => m.F[f.face].length === 4) : false;
  return { faces, ends, sharp, closed, kind, regular };
}
/** The faces between consecutive sharp edges (the whole cycle, closed and with none). */
function sectorSizes(sharp: boolean[], closed: boolean): number[] {
  const E = sharp.length, K = closed ? E : E - 1, idx = sharp.flatMap((x, i) => x && (closed || i < E) ? [i] : []);
  if (closed) {
    if (!idx.length) return [K];
    return idx.map((a, i) => ((idx[(i + 1) % idx.length] - a + K) % K) || K);
  }
  const out: number[] = [];
  for (let i = 0; i + 1 < idx.length; i++) out.push(idx[i + 1] - idx[i]);
  return out;
}

// ---- One Catmull–Clark step ------------------------------------------------------------------------------------------

export interface Refined { readonly cage: { positions: number[]; faces: number[][]; creases: [number, number][] }; readonly labels: string[] }
/** One Catmull–Clark step of a polygon cage: each face of n sides n quads (labelled `<face label>_<corner>`). */
export function refine(m: PolyMesh, labels?: readonly string[]): Refined {
  const { P, nv, F } = m, positions: number[] = [];
  const add = (x: number, y: number, z: number) => { positions.push(x, y, z); return positions.length / 3 - 1; };
  // Face points.
  const fp = F.map(f => { let x = 0, y = 0, z = 0; for (const v of f) { x += P[3 * v]; y += P[3 * v + 1]; z += P[3 * v + 2]; } return [x / f.length, y / f.length, z / f.length] as P3; });
  const facePt = fp.map(p => add(p[0], p[1], p[2]));
  // Edge points, one per undirected edge.
  const edgePt = new Map<number, number>();
  for (let h = 0; h < m.twin.length; h++) {
    const f = F[m.heFace[h]], a = f[m.heSide[h]], b = f[(m.heSide[h] + 1) % f.length], key = ekey(a, b, nv);
    if (edgePt.has(key)) continue;
    if (m.sharp[h]) edgePt.set(key, add((P[3 * a] + P[3 * b]) / 2, (P[3 * a + 1] + P[3 * b + 1]) / 2, (P[3 * a + 2] + P[3 * b + 2]) / 2));
    else {
      const g = m.heFace[m.twin[h]], p = fp[m.heFace[h]], q = fp[g];
      edgePt.set(key, add((P[3 * a] + P[3 * b] + p[0] + q[0]) / 4, (P[3 * a + 1] + P[3 * b + 1] + p[1] + q[1]) / 4, (P[3 * a + 2] + P[3 * b + 2] + p[2] + q[2]) / 4));
    }
  }
  // Vertex points.
  const vertPt = new Int32Array(nv).fill(-1);
  for (let v = 0; v < nv; v++) {
    const fan = m.fans[v]; if (!fan) continue;
    const x = P[3 * v], y = P[3 * v + 1], z = P[3 * v + 2];
    if (fan.kind === 'corner') { vertPt[v] = add(x, y, z); continue; }
    if (fan.kind === 'crease') {
      const ends = fan.ends.filter((_, i) => fan.sharp[i] && (fan.closed ? i < fan.faces.length : true)), a = ends[0], b = ends[1];
      vertPt[v] = add((P[3 * a] + 6 * x + P[3 * b]) / 8, (P[3 * a + 1] + 6 * y + P[3 * b + 1]) / 8, (P[3 * a + 2] + 6 * z + P[3 * b + 2]) / 8);
      continue;
    }
    // Smooth or dart: (Q + 2R + (n − 3)·v) / n, Q the faces' points' mean, R the edges' midpoints' mean.
    const n = fan.faces.length;
    let qx = 0, qy = 0, qz = 0, rx = 0, ry = 0, rz = 0;
    for (const f of fan.faces) { const p = fp[f.face]; qx += p[0]; qy += p[1]; qz += p[2]; }
    for (let i = 0; i < n; i++) { const e = fan.ends[i]; rx += (x + P[3 * e]) / 2; ry += (y + P[3 * e + 1]) / 2; rz += (z + P[3 * e + 2]) / 2; }
    vertPt[v] = add((qx / n + 2 * rx / n + (n - 3) * x) / n, (qy / n + 2 * ry / n + (n - 3) * y) / n, (qz / n + 2 * rz / n + (n - 3) * z) / n);
  }
  const faces: number[][] = [], out: string[] = [];
  F.forEach((f, k) => f.forEach((v, i) => {
    const next = f[(i + 1) % f.length], prev = f[(i + f.length - 1) % f.length];
    faces.push([vertPt[v], edgePt.get(ekey(v, next, nv))!, facePt[k], edgePt.get(ekey(prev, v, nv))!]);
    out.push(`${labels ? labels[k] : String(k)}_${i}`);
  }));
  const creases: [number, number][] = [];
  for (const key of m.crease) { const a = Math.floor(key / nv), b = key % nv, e = edgePt.get(key)!; creases.push([vertPt[a], e], [e, vertPt[b]]); }
  return { cage: { positions, faces, creases }, labels: out };
}

// ---- Limit positions and the caps' starting nets ---------------------------------------------------------------------

const pt = (m: PolyMesh, v: number): P3 => [m.P[3 * v], m.P[3 * v + 1], m.P[3 * v + 2]];
/** A vertex's limit position: smooth and dart (n²·v + 4·Σ edge ends + Σ diagonals) / (n(n + 5)), crease (a + 4v + b)/6, corner v. */
export function limitPosition(m: PolyMesh, v: number): P3 {
  const fan = m.fans[v]!, p = pt(m, v);
  if (fan.kind === 'corner') return p;
  if (fan.kind === 'crease') {
    const ends = fan.ends.filter((_, i) => fan.sharp[i] && (fan.closed ? i < fan.faces.length : true));
    const a = pt(m, ends[0]), b = pt(m, ends[1]);
    return [(a[0] + 4 * p[0] + b[0]) / 6, (a[1] + 4 * p[1] + b[1]) / 6, (a[2] + 4 * p[2] + b[2]) / 6];
  }
  const n = fan.faces.length, s: P3 = [n * n * p[0], n * n * p[1], n * n * p[2]];
  for (let i = 0; i < n; i++) {
    const e = pt(m, fan.ends[i]), f = m.F[fan.faces[i].face], d = pt(m, f[(fan.faces[i].side + 2) % 4]);
    for (let a = 0; a < 3; a++) s[a] += 4 * e[a] + d[a];
  }
  const w = n * (n + 5);
  return [s[0] / w, s[1] / w, s[2] / w];
}
/** A quad's interior Bézier point at its corner `side`: (4·corner + 2·neighbours + opposite) / 9. */
function facePoint(m: PolyMesh, face: number, side: number): P3 {
  const f = m.F[face], c = pt(m, f[side]), a = pt(m, f[(side + 1) % 4]), o = pt(m, f[(side + 2) % 4]), d = pt(m, f[(side + 3) % 4]);
  return [(4 * c[0] + 2 * a[0] + 2 * d[0] + o[0]) / 9, (4 * c[1] + 2 * a[1] + 2 * d[1] + o[1]) / 9, (4 * c[2] + 2 * a[2] + 2 * d[2] + o[2]) / 9];
}
/** The Bézier point on the edge out of a quad's corner `side` along its side `side` (forward) or the one before (back). */
function edgePoint(m: PolyMesh, face: number, side: number, forward: boolean): P3 {
  const f = m.F[face], h = m.start[face] + (forward ? side : (side + 3) % 4), w = pt(m, f[side]), x = pt(m, forward ? f[(side + 1) % 4] : f[(side + 3) % 4]);
  if (m.sharp[h]) return [(2 * w[0] + x[0]) / 3, (2 * w[1] + x[1]) / 3, (2 * w[2] + x[2]) / 3];
  const t = m.twin[h], g = m.heFace[t];
  // (The same corner in the face across: its side there is the twin's start, or the one after it.)
  const gs = forward ? (m.heSide[t] + 1) % 4 : m.heSide[t];
  const p = facePoint(m, face, side), q = facePoint(m, g, gs);
  return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
}
/** A quad's bicubic Bézier net in the frame from corner `r` (u along its first edge, v along the edge before it). */
export function bezierNet(m: PolyMesh, face: number, r: number): P3[][] {
  const B: P3[][] = Array.from({ length: 4 }, () => new Array<P3>(4));
  const f = m.F[face], c = (k: number) => (r + k) % 4;
  B[0][0] = limitPosition(m, f[c(0)]); B[3][0] = limitPosition(m, f[c(1)]); B[3][3] = limitPosition(m, f[c(2)]); B[0][3] = limitPosition(m, f[c(3)]);
  B[1][1] = facePoint(m, face, c(0)); B[2][1] = facePoint(m, face, c(1)); B[2][2] = facePoint(m, face, c(2)); B[1][2] = facePoint(m, face, c(3));
  B[1][0] = edgePoint(m, face, c(0), true); B[2][0] = edgePoint(m, face, c(1), false);
  B[3][1] = edgePoint(m, face, c(1), true); B[3][2] = edgePoint(m, face, c(2), false);
  B[2][3] = edgePoint(m, face, c(2), true); B[1][3] = edgePoint(m, face, c(3), false);
  B[0][2] = edgePoint(m, face, c(3), true); B[0][1] = edgePoint(m, face, c(0), false);
  return B;
}
/**
 * Where a cap is split each way, from its irregular corner: its double knot. The part at the corner carries the G1
 * condition (α from 2 cos θ down to 0 at τ, C1 there); the part beyond meets its regular neighbours C1 (α = 0).
 * Measured (D78): the cube cage 0.0020 mm at τ = 0.2, 0.0033 at ¼, 0.0105 at ½; the half star of 5 0.26, 0.16, 0.21.
 */
const CAP_TAU = 0.25;
/** The fit: limit samples on a (2^levels + 1)² grid of each cap, rounds of fitting (each after the first moves the samples' parameters), the pull μ to the start: on the cube cage 0.0105 mm; 0.0116 with one round; 0.0122 with no fit (the least change). */
const CAP_FIT = { levels: 3, rounds: 4, mu: 1e-6 };
/** The deviation's grid: 17 × 17 (finer than the fit's), as the report measures. */
const CAP_DEVIATION_LEVELS = 4;
const lerp = (a: P3, b: P3, t: number): P3 => [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])];
/** A cubic's Bézier points split at τ (de Casteljau). */
function split4(p0: P3, p1: P3, p2: P3, p3: P3, t: number): P3[] {
  const a = lerp(p0, p1, t), b = lerp(p1, p2, t), c = lerp(p2, p3, t), d = lerp(a, b, t), e = lerp(b, c, t), x = lerp(d, e, t);
  return [p0, a, d, x, e, c, p3];
}
/** The 4 × 4 net split at τ both ways: 7 × 7 Bézier points of its 2 × 2 pieces. */
export function splitNet(B: P3[][], t = CAP_TAU): P3[][] {
  const T: P3[][] = Array.from({ length: 7 }, () => new Array<P3>(4));
  for (let j = 0; j < 4; j++) { const col = split4(B[0][j], B[1][j], B[2][j], B[3][j], t); for (let i = 0; i < 7; i++) T[i][j] = col[i]; }
  return T.map(row => split4(row[0], row[1], row[2], row[3], t));
}

// ---- The caps: a constrained least change -----------------------------------------------------------------------------

export interface Cap {
  readonly face: number; readonly r: number; readonly vertex: number; /** 6 × 6 B-spline poles, knots 0 0 0 0 τ τ 1 1 1 1 both ways. */ readonly poles: Point[][]; readonly tau: number;
  /** The largest distance from the limit surface's samples (a 17 × 17 grid, finer than the fit's) to the cap, by closest points. */
  readonly deviationMM: number;
  /** Its vertex's kind: at a crease or a corner (or a boundary) the caps' even angles cost the most (D78). */
  readonly kind: VertexKind;
}
export const capKnots = (tau: number) => [0, 0, 0, 0, tau, tau, 1, 1, 1, 1];

/** A point of a cap's 7 × 7 grid as a linear form: unknowns (index, weight) and a constant. */
interface Form { idx: number[]; w: number[]; c: P3 }
const formConst = (c: P3): Form => ({ idx: [], w: [], c: [c[0], c[1], c[2]] });
function formAdd(a: Form, b: Form, k: number): Form {
  const out: Form = { idx: [...a.idx], w: [...a.w], c: [a.c[0] + k * b.c[0], a.c[1] + k * b.c[1], a.c[2] + k * b.c[2]] };
  for (let i = 0; i < b.idx.length; i++) { const at = out.idx.indexOf(b.idx[i]); if (at >= 0) out.w[at] += k * b.w[i]; else { out.idx.push(b.idx[i]); out.w.push(k * b.w[i]); } }
  return out;
}
const formScale = (a: Form, k: number): Form => ({ idx: [...a.idx], w: a.w.map(x => x * k), c: [a.c[0] * k, a.c[1] * k, a.c[2] * k] });

/** The caps round every irregular vertex of a quad cage (each quad at most one irregular corner). */
export function buildCaps(m: PolyMesh, scale: number): Map<number, Cap> {
  const caps = new Map<number, Cap>();
  for (let v = 0; v < m.nv; v++) { const fan = m.fans[v]; if (fan && !fan.regular) for (const c of keptCapsAt(m, v, scale)) caps.set(c.face, c); }
  return caps;
}

// PERF3 A4: a vertex's caps depend on its 2-ring only (the one-rings of its faces: their Bézier nets and limit grids,
// the G1 angles). Worked out on a copy of that 2-ring with its faces in the cage's order — every fan then starts and
// runs as in the cage, so the caps are the same to the bit — and kept by that copy's content: an edit elsewhere (a
// drag, an extrusion, the editor's next step) finds the caps of every vertex it did not reach. The last CAPS_KEPT.
const CAPS_KEPT = 512;
// (The caps do not depend on the cage's size, only whether they exist does: a G1 condition left dependent must be met
// to the tolerance of the size. So the key leaves the size out — a drag that moves the cage's extreme vertex still
// finds every cap it did not reach, PERF3 C16 — and each dependent condition's miss and norm, in the order they were
// met, are kept with the caps and checked again at the size asked: the same refusal, at the same condition.)
const keptCaps = new Map<string, { caps: Cap[]; checks: number[] }>();
let checksOut: number[] | null = null;
function keptCapsAt(m: PolyMesh, v: number, scale: number): Cap[] {
  const fan = m.fans[v]!, ring = new Set<number>();
  for (const f of fan.faces) for (const c of m.F[f.face]) for (const g of m.fans[c]!.faces) ring.add(g.face);
  const faces = [...ring].sort(ascending), vmap = new Map<number, number>(), positions: number[] = [];
  const sub: number[][] = [];
  for (const f of faces) {
    const F = m.F[f], row: number[] = [];
    for (const x of F) { let i = vmap.get(x); if (i === undefined) { i = positions.length / 3; vmap.set(x, i); positions.push(m.P[3 * x], m.P[3 * x + 1], m.P[3 * x + 2]); } row.push(i); }
    sub.push(row);
  }
  const creases: [number, number][] = [];
  if (m.crease.size) {
    const edges = new Set<number>();
    for (const f of faces) { const F = m.F[f]; for (let s = 0; s < F.length; s++) edges.add(ekey(F[s], F[(s + 1) % F.length], m.nv)); }
    for (const key of m.crease) if (edges.has(key)) creases.push([vmap.get(Math.floor(key / m.nv))!, vmap.get(key % m.nv)!]);
  }
  const at = vmap.get(v)!, key = JSON.stringify([at, positions, sub, creases]);
  let local = keptCaps.get(key);
  if (local) {
    keptCaps.delete(key); keptCaps.set(key, local);
    const tol = 1e-9 * Math.max(scale, 1e-9), c = local.checks;
    for (let i = 0; i < c.length; i += 2) if (c[i] > tol * c[i + 1]) throw missedCondition(at, c[i]);
  } else {
    const L = polyMesh({ positions, faces: sub, creases }, true, true), checks: number[] = [];
    checksOut = checks;
    try { local = { caps: capsAt(L, at, L.fans[at]!, scale), checks }; } finally { checksOut = null; }
    keptCaps.set(key, local); if (keptCaps.size > CAPS_KEPT) keptCaps.delete(keptCaps.keys().next().value!);
  }
  const out: Cap[] = [];
  for (const c of local.caps) out.push({ ...c, face: faces[c.face], vertex: v });
  return out;
}
/**
 * Each fan edge's α at the vertex (2 cos θ), or null for an edge with no G1 condition: θ = 2π/n round a smooth vertex
 * or a dart (the limit's own: its characteristic map is symmetric; the only α that closes the cycle); π/k across the k
 * faces between a crease's two edges or at a boundary; φ/k at a corner (φ the angle between its sharp edges). At a
 * crease or boundary vertex the limit's edges are not evenly spread (4 faces: 59.7°, 30.3°, 30.3°, 59.7°), so even
 * angles cost accuracy there (D78: the largest deviations are at such vertices).
 */
function edgeAlpha(m: PolyMesh, v: number, fan: Fan): (number | null)[] {
  const E = fan.ends.length, K = fan.faces.length, out: (number | null)[] = new Array(E).fill(null);
  if (fan.kind === 'smooth' || fan.kind === 'dart') { for (let e = 0; e < E; e++) if (!fan.sharp[e] && (fan.closed || (e > 0 && e < K))) out[e] = 2 * Math.cos(2 * Math.PI / K); return out; }
  const sh = fan.sharp.flatMap((x, i) => x && (fan.closed ? i < K : true) ? [i] : []);
  for (let s = 0; s < sh.length; s++) {
    const a = sh[s], b = fan.closed ? sh[(s + 1) % sh.length] : sh[s + 1];
    if (b === undefined) break;
    const k = fan.closed ? ((b - a + K) % K) || K : b - a;
    let theta = Math.PI / k;
    if (fan.kind === 'corner') {
      const p = pt(m, v), x = pt(m, fan.ends[a]), y = pt(m, fan.ends[b % E]), dx = [x[0] - p[0], x[1] - p[1], x[2] - p[2]], dy = [y[0] - p[0], y[1] - p[1], y[2] - p[2]];
      const phi = Math.acos(Math.max(-1, Math.min(1, (dx[0] * dy[0] + dx[1] * dy[1] + dx[2] * dy[2]) / (Math.hypot(dx[0], dx[1], dx[2]) * Math.hypot(dy[0], dy[1], dy[2])))));
      theta = (phi > Math.PI - 1e-9 ? Math.PI : phi) / k;
    }
    for (let i = 1; i < k; i++) out[(a + i) % (fan.closed ? K : E)] = 2 * Math.cos(theta);
  }
  return out;
}
function capsAt(m: PolyMesh, v: number, fan: Fan, scale: number): Cap[] {
  const K = fan.faces.length, E = fan.ends.length;
  const tau = CAP_TAU, grids = fan.faces.map(f => { if (m.F[f.face].length !== 4) throw new SubdError('CAPABILITY', `vertex ${v} touches face ${f.face} of ${m.F[f.face].length} sides after refinement`); return splitNet(bezierNet(m, f.face, f.side)); });
  const uEdge = (k: number) => k, vEdge = (k: number) => fan.closed ? (k + 1) % K : k + 1;
  // Fixed: sharp fan edges (a crease's or a boundary's curve; a dart's edge is shared, not fixed), and the vertex itself.
  const edgeFixed = fan.sharp.map(s => s && fan.kind !== 'dart');
  const keys = new Map<string, number>(), x0: P3[] = [];
  const unknown = (key: string, start: P3) => { let i = keys.get(key); if (i === undefined) { i = x0.length; keys.set(key, i); x0.push(start); } return i; };
  const cache: (Form | undefined)[] = new Array(K * 49);
  const term = (k: number, i: number, j: number): Form => cache[49 * k + 7 * i + j] ??= termOf(k, i, j);
  const termOf = (k: number, i: number, j: number): Form => {
    if (i === 3) return formAdd(formScale(term(k, 2, j), 1 - tau), term(k, 4, j), tau);
    if (j === 3) return formAdd(formScale(term(k, i, 2), 1 - tau), term(k, i, 4), tau);
    const g = grids[k][i][j];
    if (i >= 5 || j >= 5 || (i === 0 && j === 0)) return formConst(g);
    if (j === 0) { const e = uEdge(k); return edgeFixed[e] ? formConst(g) : { idx: [unknown(`e${e}_${i}`, g)], w: [1], c: [0, 0, 0] }; }
    if (i === 0) { const e = vEdge(k); return edgeFixed[e] ? formConst(g) : { idx: [unknown(`e${e}_${j}`, g)], w: [1], c: [0, 0, 0] }; }
    return { idx: [unknown(`c${k}_${i}_${j}`, g)], w: [1], c: [0, 0, 0] };
  };
  // (Every point's unknown made first: one not in any condition keeps its start.)
  for (let k = 0; k < K; k++) for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) term(k, i, j);
  // G1 rows along every fan edge with a sector angle: left cap (its second edge) and right cap (its first).
  const alphas = edgeAlpha(m, v, fan), rows: Form[] = [];
  for (let e = 0; e < E; e++) {
    const alpha = alphas[e]; if (alpha === null) continue;
    const A = fan.closed ? (e - 1 + K) % K : e - 1, B = e % K;
    if (A < 0 || B >= K) continue;
    // α = 2 cos θ (1 − t/τ)² on the half at the vertex, 0 on the other: C1 at τ (value and slope 0), as the cross
    // derivatives are along the edge there (a double knot) — a kink in α where it is 0 would force the edge's
    // derivative to 0 at τ (folded caps). The half at the vertex kept quadratic (third difference 0), so α·b′ is cubic
    // there, as the cross derivatives are; the condition, of degree ≤ 4 on each half, is then 0 at five points of each.
    // (Tried and measured worse: α nonzero on the far half — c (1 − s)², the edge quadratic there — folds or has no
    // solution; the limit's own edge directions for α at a crease vertex deviate more than even angles.)
    rows.push(formAdd(formAdd(formAdd(term(A, 0, 0), term(A, 0, 1), -3), term(A, 0, 2), 3), term(A, 0, 3), -1));
    for (const piece of [0, 1]) {
      const off = 3 * piece, len = piece ? 1 - tau : tau;
      for (const sv of [0, 0.25, 0.5, 0.75, 1]) {
        const al = piece ? 0 : alpha * (1 - sv) * (1 - sv), b3 = bern(sv), b2 = bern2(sv);
        let row = formConst([0, 0, 0]);
        for (let mm = 0; mm < 4; mm++) {
          const g = off + mm, x = formAdd(formAdd(formAdd(term(A, 1, g), term(A, 0, g), -1), term(B, g, 1), 1), term(B, g, 0), -1);
          row = formAdd(row, x, b3[mm] * 3 / tau);
        }
        for (let j = 0; j < 3; j++) row = formAdd(row, formAdd(term(A, 0, off + j + 1), term(A, 0, off + j), -1), -al * 3 / len * b2[j]);
        rows.push(row);
      }
    }
  }
  // The conditions met exactly; within them, the caps fitted to the limit surface itself (sampled on a 9 × 9 grid of
  // each, by refining its one-ring three times), with a slight pull to the starting points for what the samples leave free.
  // Fitted to the surface, not its parametrisation (the limit's at an irregular vertex is not polynomial): each
  // sample's parameters moved to its closest point on the cap just fitted, and fitted again (four rounds).
  const n = x0.length, basis = orthonormalRows(rows, x0, n, scale, v), free = freeDirections(basis.Q, n);
  // (Both from one refinement of each face's one-ring: the fit's samples and the finer grid the deviation is measured on.)
  const limits = fan.faces.map(f => limitGrids(m, f.face, f.side, [CAP_FIT.levels, CAP_DEVIATION_LEVELS]));
  const samples = limits.map(([fit]) => fit.map(g => ({ u: g.u, v: g.v, p: g.p })));
  const formAt = (k: number, u: number, w: number): Form => {
    const pu = u < tau ? 0 : 1, pv = w < tau ? 0 : 1, bu = bern(pu ? (u - tau) / (1 - tau) : u / tau), bv = bern(pv ? (w - tau) / (1 - tau) : w / tau);
    let form: Form = formConst([0, 0, 0]);
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) form = formAdd(form, term(k, 3 * pu + a, 3 * pv + b), bu[a] * bv[b]);
    return form;
  };
  const gridOf = (k: number, x: P3[]): P3[][] => {
    const at = (i: number, j: number): P3 => { const f = term(k, i, j), p: P3 = [f.c[0], f.c[1], f.c[2]]; for (let a = 0; a < f.idx.length; a++) for (let d = 0; d < 3; d++) p[d] += f.w[a] * x[f.idx[a]][d]; return p; };
    return [0, 1, 2, 3, 4, 5, 6].map(i => [0, 1, 2, 3, 4, 5, 6].map(j => at(i, j)));
  };
  const polesOf = (k: number, x: P3[]): Point[][] => {
    const at = (i: number, j: number): Point => { const f = term(k, i, j), p: Point = [f.c[0], f.c[1], f.c[2]]; for (let a = 0; a < f.idx.length; a++) for (let d = 0; d < 3; d++) p[d] += f.w[a] * x[f.idx[a]][d]; return p; };
    return [0, 1, 2, 4, 5, 6].map(i => [0, 1, 2, 4, 5, 6].map(j => at(i, j)));
  };
  let sol = x0;
  for (let round = 0; round < CAP_FIT.rounds; round++) {
    sol = fitWithin(basis, free, samples.flatMap((list, k) => list.map(g => ({ form: formAt(k, g.u, g.v), target: g.p }))), x0, n);
    if (round === CAP_FIT.rounds - 1) break;
    samples.forEach((list, k) => { const G = gridOf(k, sol); for (const g of list) [g.u, g.v] = closestOnGrid(G, tau, g.p, g.u, g.v); });
  }
  // (Each cap's distance from the limit, sampled finer than the fit (17 × 17, as the report does), after the last fit.)
  const deviation = fan.faces.map((_f, k) => { const G = gridOf(k, sol); let worst = 0; for (const g of limits[k][1]) { const [u, w] = closestOnGrid(G, tau, g.p, g.u, g.v); worst = Math.max(worst, gridDistance(G, tau, g.p, u, w)); } return worst; });
  return fan.faces.map((f, k) => {
    const poles = polesOf(k, sol);
    return { face: f.face, r: f.side, vertex: v, poles, tau, deviationMM: deviation[k], kind: fan.kind };
  });
}
const bern = (s: number) => { const t = 1 - s; return [t * t * t, 3 * s * t * t, 3 * s * s * t, s * s * s]; };
const bern2 = (s: number) => { const t = 1 - s; return [t * t, 2 * s * t, s * s]; };
/** The rows made orthonormal (q) with what each asks of the change from x0 (c): x0 + Σ q·c meets them all. */
interface RowBasis { readonly Q: Float64Array[]; readonly C: P3[] }
/** Modified Gram–Schmidt (twice) over the rows; a dependent row must be met already (within 1e-9 of the cage's size). */
const missedCondition = (v: number, miss: number) => new SubdError('CAPABILITY', `the G1 cap at vertex ${v} has no solution (a condition missed by ${miss.toExponential(2)} mm)`);
function orthonormalRows(rows: Form[], x0: P3[], n: number, scale: number, v: number): RowBasis {
  const Q: Float64Array[] = [], C: P3[] = [], tol = 1e-9 * Math.max(scale, 1e-9);
  for (const r of rows) {
    const a = new Float64Array(n);
    for (let i = 0; i < r.idx.length; i++) a[r.idx[i]] += r.w[i];
    // The row's residual at the start: −(a·x0 + c).
    const rhs: P3 = [-r.c[0], -r.c[1], -r.c[2]];
    for (let i = 0; i < n; i++) if (a[i]) for (let d = 0; d < 3; d++) rhs[d] -= a[i] * x0[i][d];
    const norm0 = Math.sqrt(a.reduce((s, x) => s + x * x, 0));
    for (let pass = 0; pass < 2; pass++) for (let q = 0; q < Q.length; q++) {
      let dot = 0; const qq = Q[q]; for (let i = 0; i < n; i++) dot += a[i] * qq[i];
      if (!dot) continue;
      for (let i = 0; i < n; i++) a[i] -= dot * qq[i];
      for (let d = 0; d < 3; d++) rhs[d] -= dot * C[q][d];
    }
    const norm = Math.sqrt(a.reduce((s, x) => s + x * x, 0));
    if (norm <= 1e-10 * Math.max(norm0, 1)) {
      const miss = Math.hypot(rhs[0], rhs[1], rhs[2]);
      checksOut?.push(miss, Math.max(norm0, 1));
      if (miss > tol * Math.max(norm0, 1)) throw missedCondition(v, miss);
      continue;
    }
    for (let i = 0; i < n; i++) a[i] /= norm;
    Q.push(a); C.push([rhs[0] / norm, rhs[1] / norm, rhs[2] / norm]);
  }
  return { Q, C };
}
/**
 * Within the conditions, the least squares fit: x = xp + N·z, xp = x0 + Σ q·c (the least change meeting them), N an
 * orthonormal basis of what they leave free; z minimises Σ |S(x) − target|² + μ·|x − x0|² (μ = 1e-6, for directions
 * the samples do not see).
 */
/** What the rows leave free: unit vectors made orthogonal to them and to each other. */
function freeDirections(Q: Float64Array[], n: number): Float64Array[] {
  const N: Float64Array[] = [], all = [...Q];
  for (let e = 0; e < n && N.length < n - Q.length; e++) {
    const a = new Float64Array(n); a[e] = 1;
    for (let pass = 0; pass < 2; pass++) for (const q of all) { let dot = 0; for (let i = 0; i < n; i++) dot += a[i] * q[i]; if (dot) for (let i = 0; i < n; i++) a[i] -= dot * q[i]; }
    let norm = 0; for (let i = 0; i < n; i++) norm += a[i] * a[i]; norm = Math.sqrt(norm);
    if (norm < 0.3) continue;
    for (let i = 0; i < n; i++) a[i] /= norm;
    N.push(a); all.push(a);
  }
  return N;
}
const ascending = (a: number, b: number) => a - b;
function fitWithin(basis: RowBasis, N: Float64Array[], fit: { form: Form; target: P3 }[], x0: P3[], n: number): P3[] {
  const { Q, C } = basis, xp = x0.map(p => [p[0], p[1], p[2]] as P3);
  for (let q = 0; q < Q.length; q++) { const qq = Q[q]; for (let i = 0; i < n; i++) if (qq[i]) for (let d = 0; d < 3; d++) xp[i][d] += qq[i] * C[q][d]; }
  const D = N.length;
  if (!D || !fit.length) return xp;
  const mu = CAP_FIT.mu, S = fit.length;
  // MN (samples × D) and the residual at xp, per coordinate.
  const MN = new Float64Array(S * D), r: P3[] = [];
  // (A sample's row has a few nonzero entries of n: summed over those, ascending, as the dense sum skipping zeros was.)
  const row = new Float64Array(n), nz: number[] = [];
  for (let s = 0; s < S; s++) {
    const f = fit[s].form, at: P3 = [f.c[0], f.c[1], f.c[2]];
    for (let a = 0; a < f.idx.length; a++) { const i = f.idx[a]; if (!nz.includes(i)) nz.push(i); row[i] += f.w[a]; for (let d = 0; d < 3; d++) at[d] += f.w[a] * xp[i][d]; }
    nz.sort(ascending);
    for (let c = 0; c < D; c++) { let dot = 0; const col = N[c]; for (const i of nz) if (row[i]) dot += row[i] * col[i]; MN[s * D + c] = dot; }
    for (const i of nz) row[i] = 0;
    nz.length = 0;
    r.push([fit[s].target[0] - at[0], fit[s].target[1] - at[1], fit[s].target[2] - at[2]]);
  }
  // (MNᵀMN + μI) z = MNᵀ r + μ Nᵀ(x0 − xp), by Cholesky.
  const H = new Float64Array(D * D), g: P3[] = Array.from({ length: D }, () => [0, 0, 0] as P3);
  for (let a = 0; a < D; a++) {
    for (let b = a; b < D; b++) { let sum = 0; for (let s = 0; s < S; s++) sum += MN[s * D + a] * MN[s * D + b]; H[a * D + b] = H[b * D + a] = sum; }
    H[a * D + a] += mu;
    for (let s = 0; s < S; s++) { const w = MN[s * D + a]; if (w) for (let d = 0; d < 3; d++) g[a][d] += w * r[s][d]; }
    for (let i = 0; i < n; i++) if (N[a][i]) for (let d = 0; d < 3; d++) g[a][d] += mu * N[a][i] * (x0[i][d] - xp[i][d]);
  }
  const L = cholesky(H, D), z = g.map(() => [0, 0, 0] as P3);
  for (let d = 0; d < 3; d++) { const y = choleskySolve(L, D, g.map(x => x[d])); for (let a = 0; a < D; a++) z[a][d] = y[a]; }
  const x = xp.map(p => [p[0], p[1], p[2]] as P3);
  for (let a = 0; a < D; a++) { const col = N[a]; for (let i = 0; i < n; i++) if (col[i]) for (let d = 0; d < 3; d++) x[i][d] += col[i] * z[a][d]; }
  return x;
}
// (Scratch for gridAt: the closest-point solves evaluate caps hundreds of thousands of times a build, PERF3 A4.)
const GP = new Float64Array(3), GU = new Float64Array(3), GV = new Float64Array(3), BU = new Float64Array(4), BV = new Float64Array(4), DU = new Float64Array(4), DV = new Float64Array(4);
function bernInto(o: Float64Array, s: number) { const t = 1 - s; o[0] = t * t * t; o[1] = 3 * s * t * t; o[2] = 3 * s * s * t; o[3] = s * s * s; }
function dbernInto(o: Float64Array, s: number) { const t = 1 - s; o[0] = -3 * t * t; o[1] = 3 * t * t - 6 * s * t; o[2] = 6 * s * t - 3 * s * s; o[3] = 3 * s * s; }
/** A cap's 7 × 7 Bézier grid at (u, v) (the piece each way split at τ): its point into GP, its first partials into GU and GV. */
function gridAt(G: P3[][], tau: number, u: number, v: number, partials: boolean) {
  const pu = u < tau ? 0 : 1, pv = v < tau ? 0 : 1, su = pu ? (u - tau) / (1 - tau) : u / tau, sv = pv ? (v - tau) / (1 - tau) : v / tau;
  const ku = 1 / (pu ? 1 - tau : tau), kv = 1 / (pv ? 1 - tau : tau);
  bernInto(BU, su); bernInto(BV, sv);
  if (partials) { dbernInto(DU, su); dbernInto(DV, sv); }
  let p0 = 0, p1 = 0, p2 = 0, a0 = 0, a1 = 0, a2 = 0, b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const q = G[3 * pu + i][3 * pv + j], w = BU[i] * BV[j];
    p0 += w * q[0]; p1 += w * q[1]; p2 += w * q[2];
    if (partials) { const wu = DU[i] * BV[j] * ku, wv = BU[i] * DV[j] * kv; a0 += wu * q[0]; a1 += wu * q[1]; a2 += wu * q[2]; b0 += wv * q[0]; b1 += wv * q[1]; b2 += wv * q[2]; }
  }
  GP[0] = p0; GP[1] = p1; GP[2] = p2;
  if (partials) { GU[0] = a0; GU[1] = a1; GU[2] = a2; GV[0] = b0; GV[1] = b1; GV[2] = b2; }
}
function gridDistance(G: P3[][], tau: number, p: readonly number[], u: number, v: number): number { gridAt(G, tau, u, v, false); return Math.hypot(p[0] - GP[0], p[1] - GP[1], p[2] - GP[2]); }
/** The closest point on a cap's grid to p from (u, v): damped Gauss–Newton within [0, 1]². */
function closestOnGrid(G: P3[][], tau: number, p: readonly number[], u: number, v: number): [number, number] {
  let best = gridDistance(G, tau, p, u, v);
  for (let it = 0; it < 30 && best > 0; it++) {
    gridAt(G, tau, u, v, true);
    const r0 = p[0] - GP[0], r1 = p[1] - GP[1], r2 = p[2] - GP[2];
    const aa = GU[0] * GU[0] + GU[1] * GU[1] + GU[2] * GU[2], ab = GU[0] * GV[0] + GU[1] * GV[1] + GU[2] * GV[2], bb = GV[0] * GV[0] + GV[1] * GV[1] + GV[2] * GV[2];
    const ra = r0 * GU[0] + r1 * GU[1] + r2 * GU[2], rb = r0 * GV[0] + r1 * GV[1] + r2 * GV[2], det = aa * bb - ab * ab;
    if (!(det > 1e-30)) break;
    const du = (ra * bb - rb * ab) / det, dv = (rb * aa - ra * ab) / det;
    let k = 1, moved = false;
    for (let h = 0; h < 20; h++, k /= 2) {
      const nu = Math.min(1, Math.max(0, u + k * du)), nv = Math.min(1, Math.max(0, v + k * dv));
      // (A step that no longer moves (u, v) — and every shorter one — finds nothing better: done.)
      if (Math.abs(nu - u) < 1e-13 && Math.abs(nv - v) < 1e-13) break;
      const dd = gridDistance(G, tau, p, nu, nv);
      if (dd < best) { best = dd; u = nu; v = nv; moved = true; break; }
    }
    if (!moved) break;
  }
  return [u, v];
}
/** A cap's poles as its surface (for the fit's closest points). */
export function capSurface(poles: Point[][], tau: number): Surface {
  return { kind: 'surface', id: 'cap', degreeU: 3, degreeV: 3, knotsU: capKnots(tau), knotsV: capKnots(tau), controlPoints: poles, weights: poles.map(r => r.map(() => 1)) };
}
/** The closest point on a cap to p from (u, v): damped Gauss–Newton, kept within [0, 1]². */
export function closestOnCap(S: Surface, p: readonly number[], u: number, v: number): [number, number] {
  const dist = (a: number, b: number) => { const q = evaluateSurface(S, a, b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
  let best = dist(u, v);
  for (let it = 0; it < 30 && best > 0; it++) {
    const d = evaluateSurfaceD1(S, u, v), r = [p[0] - d.point[0], p[1] - d.point[1], p[2] - d.point[2]], a = d.du, b = d.dv;
    const aa = a[0] * a[0] + a[1] * a[1] + a[2] * a[2], ab = a[0] * b[0] + a[1] * b[1] + a[2] * b[2], bb = b[0] * b[0] + b[1] * b[1] + b[2] * b[2];
    const ra = r[0] * a[0] + r[1] * a[1] + r[2] * a[2], rb = r[0] * b[0] + r[1] * b[1] + r[2] * b[2], det = aa * bb - ab * ab;
    if (!(det > 1e-30)) break;
    const du = (ra * bb - rb * ab) / det, dv = (rb * aa - ra * ab) / det;
    let k = 1, moved = false;
    for (let h = 0; h < 20; h++, k /= 2) {
      const nu = Math.min(1, Math.max(0, u + k * du)), nv = Math.min(1, Math.max(0, v + k * dv)), dd = dist(nu, nv);
      if (dd < best) { best = dd; u = nu; v = nv; moved = true; break; }
    }
    if (!moved) break;
  }
  return [u, v];
}
function cholesky(H: Float64Array, D: number): Float64Array {
  const L = new Float64Array(D * D);
  for (let j = 0; j < D; j++) {
    let s = H[j * D + j]; for (let k = 0; k < j; k++) s -= L[j * D + k] * L[j * D + k];
    const d = Math.sqrt(Math.max(s, 1e-300)); L[j * D + j] = d;
    for (let i = j + 1; i < D; i++) { let t = H[i * D + j]; for (let k = 0; k < j; k++) t -= L[i * D + k] * L[j * D + k]; L[i * D + j] = t / d; }
  }
  return L;
}
function choleskySolve(L: Float64Array, D: number, b: number[]): number[] {
  const y = new Array<number>(D);
  for (let i = 0; i < D; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i * D + k] * y[k]; y[i] = s / L[i * D + i]; }
  for (let i = D - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < D; k++) s -= L[k * D + i] * y[k]; y[i] = s / L[i * D + i]; }
  return y;
}

// ---- The limit surface, sampled: for the deviation report ------------------------------------------------------------

/**
 * The Catmull–Clark limit surface over a quad of a quad cage at (i / 2^levels, j / 2^levels) in the frame from its
 * corner `r`: its one-ring refined `levels` times (its own region exact: a quad's limit depends on its one-ring only),
 * each vertex over the quad taken to its limit position.
 */
export function limitGrid(m: PolyMesh, face: number, r: number, levels: number): LimitSample[] { return limitGrids(m, face, r, [levels])[0]; }
export interface LimitSample { u: number; v: number; p: P3 }
/** limitGrid at several levels (ascending) from one refinement of the one-ring (PERF3 A4: the fit's 9 × 9 and the deviation's 17 × 17). */
export function limitGrids(m: PolyMesh, face: number, r: number, levels: readonly number[]): LimitSample[][] {
  // The one-ring: every face at one of the quad's corners.
  const ring = new Set<number>([face]);
  for (const c of m.F[face]) for (const f of m.fans[c]!.faces) ring.add(f.face);
  const faces = [...ring], vmap = new Map<number, number>(), positions: number[] = [];
  const local = (v: number) => { let i = vmap.get(v); if (i === undefined) { i = positions.length / 3; vmap.set(v, i); positions.push(m.P[3 * v], m.P[3 * v + 1], m.P[3 * v + 2]); } return i; };
  const sub = faces.map(f => m.F[f].map(local));
  const edges = new Set<number>(), creases: [number, number][] = [];
  for (const f of faces) m.F[f].forEach((a, s, F) => edges.add(ekey(a, F[(s + 1) % F.length], m.nv)));
  for (const key of m.crease) if (edges.has(key)) creases.push([vmap.get(Math.floor(key / m.nv))!, vmap.get(key % m.nv)!]);
  // Parameters of the quad's corners in its frame; carried to its descendants.
  const P0: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  let params: ([number, number][] | null)[] = faces.map(f => f === face ? m.F[face].map((_, s) => P0[(s - r + 4) % 4]) : null);
  let cage: PolyCage = { positions, faces: sub, creases }, mesh = polyMesh(cage, true, true);
  const out: LimitSample[][] = [];
  for (let l = 0; ; l++) {
    if (levels.includes(l)) out.push(gridSamples(mesh, params));
    if (l === levels[levels.length - 1]) return out;
    const next = refine(mesh), np: ([number, number][] | null)[] = [];
    mesh.F.forEach((f, k) => f.forEach((_, i) => {
      const p = params[k]; if (!p) { np.push(null); return; }
      const n = f.length, a = p[i], b = p[(i + 1) % n], d = p[(i + n - 1) % n], c: [number, number] = [p.reduce((s, x) => s + x[0], 0) / n, p.reduce((s, x) => s + x[1], 0) / n];
      np.push([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], c, [(a[0] + d[0]) / 2, (a[1] + d[1]) / 2]]);
    }));
    cage = next.cage; mesh = polyMesh(cage, true, true); params = np;
  }
}
function gridSamples(mesh: PolyMesh, params: readonly ([number, number][] | null)[]): LimitSample[] {
  const seen = new Map<number, [number, number]>();
  mesh.F.forEach((f, k) => { const p = params[k]; if (p) f.forEach((v, s) => seen.set(v, p[s])); });
  return [...seen].map(([v, [u, w]]) => ({ u, v: w, p: limitPosition(mesh, v) }));
}
