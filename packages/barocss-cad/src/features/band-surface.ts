// B2: a ruled band surface between two edge chains of bodies (an associative sheet). Each side is the B-rep edges that
// carry the stored names, chained through shared vertices into one simple open chain or one closed loop; the two chains
// are paired piece by piece (equal counts) or by normalized arc length (each chain split, exactly, at the other's joints);
// every pair becomes one exact ruled NURBS patch (the aligned rational ruled surface of section-knot-alignment.ts), and
// the patches are one sheet body (band-sheet.ts). Nothing is approximated: splits are exact knot insertions, a common
// degree is exact elevation, the parameter of each piece is an affine map to [0, 1]. `boundaryDeviation` measures it.
import { curveEvaluator, surfaceEvaluator } from '../core/math.js';
import { KernelError } from '../core/barocss-error.js';
import { isFacetFace, type Brep, type BrepEdge } from '../brep/brep-core.js';
import { bandSheetBrep } from '../brep/band-sheet.js';
import { buildAlignedRationalRuledSurface, SectionKnotAlignmentError } from './section-knot-alignment.js';
import { cross, dist, dot, len, sub } from '../core/vec3.js';
import type { Curve, Point, Surface } from '../types.js';

/** A band's report (the output's `band`): what was joined, how exactly, and the measured distance of the patches' boundary from the source edges. */
export interface CadBandReport {
  /** Exact ruled patches (`${id}.band<k>`). */
  readonly pairs: number;
  readonly closed: boolean;
  readonly exact: true;
  /** The largest distance (mm) of a patch boundary sample from the unmodified source edge, over 33 samples per patch and side. */
  readonly boundaryDeviation: number;
  /** `pieces`: equal piece counts paired k↔k; `length`: split at normalized arc length. */
  readonly pairing: 'pieces' | 'length';
  /** Source pieces on side A and side B. */
  readonly pieces: readonly [number, number];
  /** The sentence the Studio shows. */
  readonly note: string;
}
export type BandRefusal = 'BAND_EDGE_LOST' | 'BAND_CHAIN' | 'BAND_OBLIQUE' | 'BAND_PROFILE' | 'BAND_TOUCH' | 'BAND_DEGENERATE';
export type BandCode = 'INPUT' | 'SELECTION' | 'CAPABILITY' | 'GEOMETRY';
/** A band refusal: the kernel code part-band.ts reports it under, and the `[BAND_*]` tag its message starts with. */
export class BandError extends KernelError {
  readonly refusal: BandCode; readonly tag: BandRefusal | null;
  constructor(refusal: BandCode, tag: BandRefusal | null, detail: string) {
    super(tag ? `[${tag}] ${detail}` : detail); this.name = 'BandError'; this.refusal = refusal; this.tag = tag;
  }
}
export interface BandSideInput {
  /** The body's feature id (for messages). */
  readonly body: string; readonly brep: Brep; readonly names: readonly string[];
}
export interface BandInput { readonly id: string; readonly a: BandSideInput; readonly b: BandSideInput; readonly flip?: boolean }
export interface BandResult { readonly brep: Brep; readonly report: CadBandReport }

const MAX_PIECES = 32, MAX_POLES = 16;
/** Joints (normalized length) closer than this are one break. */
const MERGE = 1e-4;
/** The least ruling (mm) a band takes. */
const TOUCH = 1e-4;
const fmt = (p: readonly number[]) => `(${p.map(x => +x.toFixed(4)).join(', ')})`;
const refuse = (refusal: BandCode, tag: BandRefusal, detail: string): never => { throw new BandError(refusal, tag, detail); };

// ---- rational B-spline pieces ---------------------------------------------------------------------------------------
/**
 * A curve piece in homogeneous coefficients [wx, wy, wz, w]. `ev` is the unmodified source edge at a parameter of this
 * piece's domain (the deviation's reference); cutting keeps it, reversing mirrors it.
 */
interface Piece { readonly degree: number; readonly knots: readonly number[]; readonly h: readonly (readonly number[])[]; readonly ev: (s: number) => Point }
const lo = (c: Piece) => c.knots[0], hi = (c: Piece) => c.knots[c.knots.length - 1];

function pieceOf(curve: Curve): Piece {
  const h = curve.controlPoints.map((p, i) => [p[0] * curve.weights[i], p[1] * curve.weights[i], p[2] * curve.weights[i], curve.weights[i]]);
  const base = curveEvaluator(curve), a = curve.knots[0], b = curve.knots[curve.knots.length - 1];
  return { degree: curve.degree, knots: [...curve.knots], h, ev: s => base(Math.min(b, Math.max(a, s))) };
}
/** The piece as a curve on [0, 1] (an affine map of its parameter; the end knots are exactly 0 and 1). */
function curveOf(c: Piece, id: string): Curve {
  const a = lo(c), b = hi(c);
  return { kind: 'curve', id, degree: c.degree, knots: c.knots.map(k => k === a ? 0 : k === b ? 1 : (k - a) / (b - a)), controlPoints: c.h.map(q => [q[0] / q[3], q[1] / q[3], q[2] / q[3]] as Point), weights: c.h.map(q => q[3]) };
}
/** The same curve run the other way (exact: poles and knots mirrored). */
function reversePiece(c: Piece): Piece {
  const a = lo(c), b = hi(c), ev = c.ev;
  return { degree: c.degree, knots: [...c.knots].reverse().map(k => k === a ? b : k === b ? a : a + b - k), h: [...c.h].reverse(), ev: s => ev(Math.min(b, Math.max(a, a + b - s))) };
}
/** One Boehm knot insertion of `u` (strictly inside the domain). */
function insertKnot(c: Piece, u: number): Piece {
  const p = c.degree, U = c.knots, n = c.h.length - 1;
  let k = -1, s = 0;
  for (let i = p; i <= n; i++) if (U[i] <= u && u < U[i + 1]) k = i;
  for (const x of U) if (x === u) s++;
  const h: number[][] = [];
  for (let i = 0; i <= n + 1; i++) {
    if (i <= k - p) h.push([...c.h[i]]);
    else if (i >= k - s + 1) h.push([...c.h[i - 1]]);
    else { const al = (u - U[i]) / (U[i + p] - U[i]); h.push(c.h[i].map((x, j) => (1 - al) * c.h[i - 1][j] + al * x)); }
  }
  return { degree: p, knots: [...U.slice(0, k + 1), u, ...U.slice(k + 1)], h, ev: c.ev };
}
/** The piece cut at `t` (strictly inside its domain), exactly: the part before and the part after, each on its own domain. */
function cutPiece(c: Piece, t: number): [Piece, Piece] {
  let m = 0; for (const k of c.knots) if (k === t) m++;
  let w = c;
  for (let i = m; i < c.degree; i++) w = insertKnot(w, t);
  const i0 = w.knots.indexOf(t), p = w.degree;
  return [{ degree: p, knots: [...w.knots.slice(0, i0 + p), t], h: w.h.slice(0, i0), ev: c.ev }, { degree: p, knots: [t, ...w.knots.slice(i0)], h: w.h.slice(i0 - 1), ev: c.ev }];
}
/** `s`, or the interior knot of the piece it lies within 1e-10 of its span of (a cut a rounding away from a knot would leave a sliver). */
function snapToKnot(c: Piece, s: number): number {
  const tol = 1e-10 * (hi(c) - lo(c));
  for (const k of c.knots) if (k > lo(c) && k < hi(c) && Math.abs(k - s) <= tol) return k;
  return s;
}
/** Degree raised by one on a Bezier segment's homogeneous poles. */
function elevateSegment(q: readonly (readonly number[])[]): number[][] {
  const p = q.length - 1, out: number[][] = [];
  for (let i = 0; i <= p + 1; i++) {
    const f = i / (p + 1), left = i > 0 ? q[i - 1] : null, right = i <= p ? q[i] : null;
    out.push([0, 1, 2, 3].map(j => (left ? f * left[j] : 0) + (right ? (1 - f) * right[j] : 0)));
  }
  return out;
}
/** The piece at degree `q` ≥ its own: a Bezier chain (every interior knot of multiplicity q), each segment elevated exactly. */
function elevatePiece(c: Piece, q: number): Piece {
  if (c.degree === q) return c;
  const p = c.degree, a = lo(c), b = hi(c);
  let w = c;
  const inner = [...new Set(c.knots.filter(k => k > a && k < b))];
  for (const k of inner) { let m = 0; for (const x of w.knots) if (x === k) m++; for (; m < p; m++) w = insertKnot(w, k); }
  const cuts = [a, ...inner, b], h: number[][] = [];
  for (let s = 0; s + 1 < cuts.length; s++) {
    let seg = w.h.slice(s * p, s * p + p + 1) as readonly (readonly number[])[];
    for (let d = p; d < q; d++) seg = elevateSegment(seg);
    for (let i = s === 0 ? 0 : 1; i < seg.length; i++) h.push([...seg[i]]);
  }
  const knots: number[] = Array<number>(q + 1).fill(a);
  for (const k of inner) for (let i = 0; i < q; i++) knots.push(k);
  for (let i = 0; i <= q; i++) knots.push(b);
  return { degree: q, knots, h, ev: c.ev };
}
/** Basis function values of each degree 0..p at `s` (level d holds the degree-d functions). */
function basisLevels(U: readonly number[], p: number, s: number): number[][] {
  const m = U.length - 1, last = U[m];
  let N: number[] = Array.from({ length: m }, (_, i) => (U[i] <= s && s < U[i + 1]) || (s === last && U[i] < U[i + 1] && U[i + 1] === last) ? 1 : 0);
  const out = [N];
  for (let d = 1; d <= p; d++) {
    const M = new Array<number>(m - d).fill(0);
    for (let i = 0; i < m - d; i++) {
      const x = U[i + d] - U[i], y = U[i + d + 1] - U[i + 1];
      M[i] = (x > 0 ? (s - U[i]) / x * N[i] : 0) + (y > 0 ? (U[i + d + 1] - s) / y * N[i + 1] : 0);
    }
    N = M; out.push(N);
  }
  return out;
}
/** A piece's point and first derivative at `s` (the derivative on the right of a knot). */
function pointAndTangent(c: Piece, s: number): { point: Point; d: Point } {
  const p = c.degree, L = basisLevels(c.knots, p, s), N = L[p], low = L[p - 1], U = c.knots;
  const H = [0, 0, 0, 0], D = [0, 0, 0, 0];
  for (let i = 0; i < N.length; i++) {
    const x = U[i + p] - U[i], y = U[i + p + 1] - U[i + 1], dn = p * ((x > 0 ? low[i] / x : 0) - (y > 0 ? low[i + 1] / y : 0));
    for (let j = 0; j < 4; j++) { H[j] += N[i] * c.h[i][j]; D[j] += dn * c.h[i][j]; }
  }
  const point: Point = [H[0] / H[3], H[1] / H[3], H[2] / H[3]];
  return { point, d: [(D[0] - D[3] * point[0]) / H[3], (D[1] - D[3] * point[1]) / H[3], (D[2] - D[3] * point[2]) / H[3]] };
}
const at = (c: Piece, u: number) => u === 0 ? lo(c) : u === 1 ? hi(c) : lo(c) + u * (hi(c) - lo(c));
const pointAt = (c: Piece, s: number): Point => pointAndTangent(c, s).point;

// ---- arc length -----------------------------------------------------------------------------------------------------
let gauss: { x: number[]; w: number[] } | null = null;
/** 16-point Gauss–Legendre nodes and weights on [-1, 1] (Newton on the Legendre polynomial). */
function gaussLegendre(): { x: number[]; w: number[] } {
  if (gauss) return gauss;
  const n = 16, x: number[] = [], w: number[] = [];
  for (let i = 0; i < n; i++) {
    let z = Math.cos(Math.PI * (i + 0.75) / (n + 0.5)), dp = 1;
    for (let it = 0; it < 100; it++) {
      let p0 = 1, p1 = z;
      for (let k = 2; k <= n; k++) { const p2 = ((2 * k - 1) * z * p1 - (k - 1) * p0) / k; p0 = p1; p1 = p2; }
      dp = n * (z * p1 - p0) / (z * z - 1);
      const dz = p1 / dp; z -= dz; if (Math.abs(dz) < 1e-16) break;
    }
    x.push(z); w.push(2 / ((1 - z * z) * dp * dp));
  }
  gauss = { x, w }; return gauss;
}
/** The length of the piece from its start to `s` (Gauss quadrature on each knot span). */
function lengthTo(c: Piece, s: number): number {
  const g = gaussLegendre(), cuts = [...new Set(c.knots)];
  let total = 0;
  for (let i = 0; i + 1 < cuts.length && cuts[i] < s; i++) {
    const a = cuts[i], b = Math.min(cuts[i + 1], s), mid = (a + b) / 2, half = (b - a) / 2;
    for (let k = 0; k < g.x.length; k++) total += g.w[k] * half * len(pointAndTangent(c, mid + half * g.x[k]).d);
  }
  return total;
}
/** The parameter at which the piece has run `target` from its start (Newton, bisection-safeguarded, to 1e-12 of the length). */
function parameterAtLength(c: Piece, target: number, total: number): number {
  let a = lo(c), b = hi(c), s = a + (b - a) * target / total;
  for (let it = 0; it < 100; it++) {
    const f = lengthTo(c, s) - target;
    if (Math.abs(f) <= 1e-12 * total) return s;
    if (f > 0) b = s; else a = s;
    const next = s - f / len(pointAndTangent(c, s).d);
    s = next > a && next < b ? next : (a + b) / 2;
  }
  return s;
}
/** The parameter of the point of the piece nearest `p`, and its distance (sampled, then bisected on (C − p)·C′). */
function nearestOn(c: Piece, p: Point): { s: number; distance: number } {
  const cuts = [...new Set(c.knots)], samples = 48;
  let best = Infinity, at = lo(c);
  const ss: number[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) for (let k = 0; k < samples; k++) ss.push(cuts[i] + (cuts[i + 1] - cuts[i]) * k / samples);
  ss.push(hi(c));
  let index = 0;
  for (let i = 0; i < ss.length; i++) { const d = dist(pointAt(c, ss[i]), p); if (d < best) { best = d; at = ss[i]; index = i; } }
  let a = ss[Math.max(0, index - 1)], b = ss[Math.min(ss.length - 1, index + 1)];
  const g = (s: number) => { const e = pointAndTangent(c, s); return dot(sub(e.point, p), e.d); };
  if (g(a) < 0 && g(b) > 0) {
    for (let it = 0; it < 80; it++) { const m = (a + b) / 2; if (g(m) > 0) b = m; else a = m; }
    at = (a + b) / 2; best = dist(pointAt(c, at), p);
  }
  return { s: at, distance: best };
}

// ---- chains ---------------------------------------------------------------------------------------------------------
interface Chain { readonly pieces: readonly Piece[]; readonly closed: boolean }
const reverseChain = (ch: Chain): Chain => ({ closed: ch.closed, pieces: [...ch.pieces].reverse().map(reversePiece) });
const startOf = (c: Piece) => pointAt(c, lo(c)), endOf = (c: Piece) => pointAt(c, hi(c));
/** ½ Σ pᵢ × pᵢ₊₁ over the chain sampled 16 times a piece (the loop's vector area). */
function areaVector(ch: Chain): Point {
  const ring: Point[] = [];
  for (const c of ch.pieces) for (let k = 0; k < 16; k++) ring.push(pointAt(c, lo(c) + (hi(c) - lo(c)) * k / 16));
  const area: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < ring.length; i++) { const x = cross(ring[i], ring[(i + 1) % ring.length]); area[0] += x[0] / 2; area[1] += x[1] / 2; area[2] += x[2] / 2; }
  return area;
}

/** The edges that carry the side's names (a name may be on several pieces), in name order then B-rep order. */
function piecesOf(side: BandSideInput, label: string): BrepEdge[] {
  if (side.brep.faces.some(isFacetFace)) refuse('CAPABILITY', 'BAND_PROFILE', `band side ${label}: ${side.body} is a mesh body (facet faces); a band takes exact edges`);
  const found: BrepEdge[] = [];
  for (const name of side.names) {
    const list = side.brep.edges.filter(e => e.name === name);
    if (!list.length) refuse('SELECTION', 'BAND_EDGE_LOST', `band side ${label}: no edge named ${name} on ${side.body}`);
    for (const e of list) if (!found.includes(e)) found.push(e);
  }
  if (found.length > MAX_PIECES) refuse('SELECTION', 'BAND_CHAIN', `band side ${label}: ${found.length} edge pieces; a side takes at most ${MAX_PIECES}`);
  return found;
}
/** One chain through shared vertices, the first piece run forward (and the chain from there); refused with where it branches or breaks. */
function chainOf(edges: readonly BrepEdge[], side: BandSideInput, label: string): Chain {
  const point = new Map(side.brep.vertices.map(v => [v.id, v.point])), where = (v: string) => fmt(point.get(v) ?? []);
  const incidence = new Map<string, { i: number; end: 0 | 1 }[]>();
  edges.forEach((e, i) => { for (const end of [0, 1] as const) { const list = incidence.get(e.vertices[end]); if (list) list.push({ i, end }); else incidence.set(e.vertices[end], [{ i, end }]); } });
  for (const [v, list] of incidence) if (list.length > 2) refuse('SELECTION', 'BAND_CHAIN', `band side ${label}: the edges branch at ${where(v)}`);
  const ends = [...incidence].filter(([, list]) => list.length === 1).map(([v]) => v), closed = ends.length === 0;
  if (!closed && ends.length !== 2) refuse('SELECTION', 'BAND_CHAIN', `band side ${label}: the edges are not one chain (a gap at ${where(ends[0])})`);
  const seen = new Set<number>([0]), links: { i: number; rev: boolean }[] = [{ i: 0, rev: false }];
  // Walk on from a vertex: into the other piece there, leaving at its other end.
  const walk = (vertex: string, from: { i: number; end: 0 | 1 }, push: (i: number, entered: 0 | 1) => void): void => {
    for (let cur = vertex, last = from; ;) {
      const next = incidence.get(cur)!.find(x => !(x.i === last.i && x.end === last.end));
      if (!next) return;
      if (seen.has(next.i)) { if (closed && next.i === 0 && next.end === 0) return; refuse('SELECTION', 'BAND_CHAIN', `band side ${label}: the edges are two pieces (a loop through ${where(cur)})`); }
      seen.add(next.i); push(next.i, next.end);
      cur = edges[next.i].vertices[next.end === 0 ? 1 : 0]; last = { i: next.i, end: next.end === 0 ? 1 : 0 };
    }
  };
  walk(edges[0].vertices[1], { i: 0, end: 1 }, (i, entered) => links.push({ i, rev: entered === 1 }));
  if (!closed) { const before: { i: number; rev: boolean }[] = []; walk(edges[0].vertices[0], { i: 0, end: 0 }, (i, entered) => before.push({ i, rev: entered === 0 })); links.unshift(...before.reverse()); }
  if (links.length !== edges.length) { const lost = edges.findIndex((_, i) => !seen.has(i)); refuse('SELECTION', 'BAND_CHAIN', `band side ${label}: the edges are two pieces (one starts at ${where(edges[lost].vertices[0])})`); }
  return { closed, pieces: links.map(l => { const p = pieceOf(edges[l.i].curve); return l.rev ? reversePiece(p) : p; }) };
}

/** Where along the chain (0..1 of its length) each joint lies. */
function jointFractions(lengths: readonly number[]): number[] {
  const total = lengths.reduce((s, x) => s + x, 0), out: number[] = [];
  let run = 0;
  for (let i = 0; i + 1 < lengths.length; i++) { run += lengths[i]; out.push(run / total); }
  return out;
}
interface Break { readonly a: number; readonly b: number }
/** The breaks that cut both chains into equally many pairs: each chain's joints, those within `MERGE` of the other's one break. */
function breaksOf(fa: readonly number[], fb: readonly number[]): Break[] {
  const out: Break[] = [];
  let i = 0, j = 0;
  while (i < fa.length || j < fb.length) {
    if (i < fa.length && j < fb.length && Math.abs(fa[i] - fb[j]) < MERGE) out.push({ a: fa[i++], b: fb[j++] });
    else if (j >= fb.length || (i < fa.length && fa[i] < fb[j])) { out.push({ a: fa[i], b: fa[i] }); i++; }
    else { out.push({ a: fb[j], b: fb[j] }); j++; }
  }
  return out;
}
/** The chain cut at the given fractions of its length: pieces split exactly at the cut points (a joint within 1e-9 of one is not cut again). */
function cutChain(ch: Chain, fractions: readonly number[]): Piece[] {
  const lengths = ch.pieces.map(c => lengthTo(c, hi(c))), total = lengths.reduce((s, x) => s + x, 0), tol = 1e-9 * total;
  const starts: number[] = [], cuts: number[][] = ch.pieces.map(() => []);
  let run = 0;
  for (const l of lengths) { starts.push(run); run += l; }
  for (const f of fractions) {
    const at = f * total;
    if (Math.abs(total - at) <= tol || starts.some(x => Math.abs(x - at) <= tol)) continue;
    let k = 0; while (k + 1 < starts.length && starts[k + 1] < at) k++;
    cuts[k].push(at - starts[k]);
  }
  const out: Piece[] = [];
  for (let k = 0; k < ch.pieces.length; k++) {
    let rest = ch.pieces[k];
    for (const local of cuts[k]) { const [first, second] = cutPiece(rest, snapToKnot(rest, parameterAtLength(ch.pieces[k], local, lengths[k]))); out.push(first); rest = second; }
    out.push(rest);
  }
  return out;
}

/** A closed chain turned to start at the point on it nearest `p` (cut there, exactly, unless within 1e-9 of a joint); `cut` says whether a piece was split. */
function startedNear(ch: Chain, p: Point): { chain: Chain; cut: boolean } {
  const n = ch.pieces.length;
  let scale = 1;
  for (const c of ch.pieces) scale = Math.max(scale, Math.hypot(...startOf(c)));
  let best = Infinity, k = 0, s = 0;
  for (let i = 0; i < n; i++) { const r = nearestOn(ch.pieces[i], p); if (r.distance < best) { best = r.distance; k = i; s = r.s; } }
  const piece = ch.pieces[k], at0 = pointAt(piece, s), atStart = dist(at0, startOf(piece)) <= 1e-9 * scale, atEnd = dist(at0, endOf(piece)) <= 1e-9 * scale;
  const rotate = (list: readonly Piece[], at: number) => [...list.slice(at), ...list.slice(0, at)];
  if (atStart) return { chain: { closed: true, pieces: rotate(ch.pieces, k) }, cut: false };
  if (atEnd) return { chain: { closed: true, pieces: rotate(ch.pieces, (k + 1) % n) }, cut: false };
  const [first, second] = cutPiece(piece, snapToKnot(piece, s)), list = [...ch.pieces.slice(0, k), first, second, ...ch.pieces.slice(k + 1)];
  return { chain: { closed: true, pieces: rotate(list, k + 1) }, cut: true };
}

// ---- patches --------------------------------------------------------------------------------------------------------
interface Patch { readonly surface: Surface; readonly a: Curve; readonly b: Curve; readonly deviation: number }
const SAMPLES = 33;
/** The aligner's refusal in plain words (it speaks of its own capacity and limits). */
function plainAlignment(message: string): string {
  if (/capacity|Budget|budget|exceeds/.test(message)) return `the band would need more than ${MAX_POLES} poles per direction`;
  if (/10000/.test(message)) return 'coordinates beyond ±10000 mm';
  return 'the two profiles cannot be joined as one exact patch';
}
/** The least ruling length (and where) on a span of a patch where the ruling vector turned over: golden-section on |S(u,1) − S(u,0)|. */
function leastRuling(S: (u: number, v: number) => Point, a: number, b: number): { length: number; at: Point } {
  const f = (u: number) => dist(S(u, 0), S(u, 1)), phi = (Math.sqrt(5) - 1) / 2;
  let x = a, y = b, c = y - phi * (y - x), d = x + phi * (y - x), fc = f(c), fd = f(d);
  for (let it = 0; it < 120; it++) {
    if (fc < fd) { y = d; d = c; fd = fc; c = y - phi * (y - x); fc = f(c); } else { x = c; c = d; fc = fd; d = x + phi * (y - x); fd = f(d); }
  }
  const u = (x + y) / 2;
  return { length: f(u), at: S(u, 0) };
}
/** One exact ruled patch between two pieces. */
function patchOf(a: Piece, b: Piece, id: string, k: number): Patch {
  const where = `pair ${k}`, q = Math.max(a.degree, b.degree);
  if (q > 3) refuse('CAPABILITY', 'BAND_PROFILE', `${where}: degree ${q} is above the exact profile (3)`);
  const ea = elevatePiece(a, q), eb = elevatePiece(b, q);
  const inner = (c: Curve) => { const m = new Map<number, number>(); for (const x of c.knots) if (x > 0 && x < 1) m.set(x, (m.get(x) ?? 0) + 1); return m; };
  let ca = curveOf(ea, 'ca'), cb = curveOf(eb, 'cb');
  if (ca.controlPoints.length > MAX_POLES || cb.controlPoints.length > MAX_POLES) refuse('CAPABILITY', 'BAND_PROFILE', `${where}: more than ${MAX_POLES} poles on a side (exact bands take at most ${MAX_POLES})`);
  // Which side the knot union refines (its aligned id must then differ from the original one).
  const ma = inner(ca), mb = inner(cb), keys = new Set([...ma.keys(), ...mb.keys()]);
  let refineA = false, refineB = false;
  for (const x of keys) { const u = Math.max(ma.get(x) ?? 0, mb.get(x) ?? 0); if ((ma.get(x) ?? 0) < u) refineA = true; if ((mb.get(x) ?? 0) < u) refineB = true; }
  let result;
  try { result = buildAlignedRationalRuledSurface(ca, cb, { surfaceId: 'srf', firstAlignedId: refineA ? 'ca2' : 'ca', secondAlignedId: refineB ? 'cb2' : 'cb', resultIdPrefix: 'br', maximumInsertedKnots: 14, maximumRefinementOperations: 14 }); }
  catch (cause) {
    if (cause instanceof SectionKnotAlignmentError) return refuse('CAPABILITY', 'BAND_PROFILE', `${where}: ${plainAlignment(cause.message)}`);
    throw cause;
  }
  const surface: Surface = { ...result.ruled.surface, id: `${id}_s${k}` };
  ca = result.sections[0].curve; cb = result.sections[1].curve;
  const S = surfaceEvaluator(surface);
  let deviation = 0, previous: Point | null = null, previousNormal: Point | null = null;
  for (let i = 0; i < SAMPLES; i++) {
    const u = i / (SAMPLES - 1), sa = at(a, u), sb = at(b, u), pa = S(u, 0), pb = S(u, 1);
    deviation = Math.max(deviation, dist(pa, a.ev(sa)), dist(pb, b.ev(sb)));
    if (dist(pa, pb) < TOUCH) refuse('GEOMETRY', 'BAND_TOUCH', `${where}: the two sides meet at ${fmt(pa)}; a band needs rulings of at least ${TOUCH} mm`);
    const ruling = sub(pb, pa), normal = cross(sub(S(Math.min(1, u + 1e-6), 0.5), S(Math.max(0, u - 1e-6), 0.5)), ruling);
    // The ruling turned over between two samples: it crossed zero, or came near it, in between.
    if (previous && dot(previous, ruling) <= 0) {
      const least = leastRuling(S, (i - 1) / (SAMPLES - 1), u);
      if (least.length < TOUCH) refuse('GEOMETRY', 'BAND_TOUCH', `${where}: the two sides cross at ${fmt(least.at)} (the ruling shrinks to ${least.length.toExponential(1)} mm there)`);
    }
    if (previousNormal && dot(previousNormal, normal) < 0) refuse('GEOMETRY', 'BAND_DEGENERATE', `${where}: the surface folds over near ${fmt(S(u, 0.5))} (its normal turns over)`);
    previous = ruling; previousNormal = normal;
  }
  // A normal at 9 × 3 samples: the u-tangent against the ruling.
  const h = 1e-5;
  for (let i = 0; i <= 8; i++) for (const v of [0, 0.5, 1]) {
    const u = i / 8, u0 = Math.max(0, u - h), u1 = Math.min(1, u + h), v0 = Math.max(0, v - h), v1 = Math.min(1, v + h);
    const su = sub(S(u1, v), S(u0, v)), sv = sub(S(u, v1), S(u, v0)), n = len(cross(su, sv));
    if (!(n > 1e-7 * len(su) * len(sv))) refuse('GEOMETRY', 'BAND_DEGENERATE', `${where}: the surface has no normal at ${fmt(S(u, v))} (a ruling runs along its side's tangent there)`);
  }
  return { surface, a: ca, b: cb, deviation };
}

/** A band surface between two edge chains, as one exact sheet body (faces `${id}.band<k>`) and its report. */
export function bandSurface(input: BandInput): BandResult {
  const ea = piecesOf(input.a, 'A'), eb = piecesOf(input.b, 'B');
  const A = chainOf(ea, input.a, 'A');
  let B = chainOf(eb, input.b, 'B');
  if (A.closed !== B.closed) refuse('SELECTION', 'BAND_CHAIN', 'a band joins two open chains or two closed loops, not one of each');
  const closed = A.closed;
  // Orientation: B runs the way that keeps the band untwisted; `flip` then reverses it.
  let reverse = false;
  if (closed) {
    const va = areaVector(A), vb = areaVector(B), c = dot(va, vb) / (len(va) * len(vb));
    if (!(Math.abs(c) >= 0.1)) refuse('SELECTION', 'BAND_OBLIQUE', `the two loops are nearly perpendicular (cos ${Number.isFinite(c) ? c.toFixed(3) : 'undefined'}); a band needs loops facing alike or opposite`);
    reverse = c < 0;
  } else {
    const a0 = startOf(A.pieces[0]), a1 = endOf(A.pieces[A.pieces.length - 1]), b0 = startOf(B.pieces[0]), b1 = endOf(B.pieces[B.pieces.length - 1]);
    const keep = dist(a0, b0) + dist(a1, b1), turned = dist(a0, b1) + dist(a1, b0);
    reverse = turned < keep * (1 - 1e-9);
  }
  if (input.flip) reverse = !reverse;
  if (reverse) B = reverseChain(B);
  const counts: [number, number] = [A.pieces.length, B.pieces.length];
  // A closed B starts at the point on it nearest A's start; piece k joins piece k only when that is one of B's own joints and the counts match.
  let cut = false;
  if (closed) { const seamed = startedNear(B, startOf(A.pieces[0])); B = seamed.chain; cut = seamed.cut; }
  const same = counts[0] === counts[1] && !cut;
  let pa: readonly Piece[] = A.pieces, pb: readonly Piece[] = B.pieces;
  if (same) pb = B.pieces;
  else {
    const fa = jointFractions(A.pieces.map(c => lengthTo(c, hi(c)))), fb = jointFractions(B.pieces.map(c => lengthTo(c, hi(c)))), breaks = breaksOf(fa, fb);
    for (let i = 1; i < breaks.length; i++) if (!(breaks[i].a > breaks[i - 1].a + 1e-9 && breaks[i].b > breaks[i - 1].b + 1e-9)) refuse('CAPABILITY', 'BAND_PROFILE', `pair ${i}: pieces too short to pair by length`);
    pa = cutChain(A, breaks.map(x => x.a)); pb = cutChain(B, breaks.map(x => x.b));
    if (pa.length !== pb.length) refuse('CAPABILITY', 'BAND_PROFILE', `pairing by length gave ${pa.length} and ${pb.length} pieces`);
  }
  const patches = pa.map((c, k) => patchOf(c, pb[k], input.id, k));
  const deviation = patches.reduce((m, p) => Math.max(m, p.deviation), 0);
  const how = same ? 'paired by pieces' : `paired by length ${counts[0]}↔${counts[1]}`;
  const note = `${patches.length} exact ruled patch${patches.length > 1 ? 'es' : ''} (${how}); boundary deviation ≤ ${deviation.toPrecision(2)} mm`;
  const brep = bandSheetBrep({ id: input.id, patches, closed });
  return { brep, report: { pairs: patches.length, closed, exact: true, boundaryDeviation: deviation, pairing: same ? 'pieces' : 'length', pieces: counts, note } };
}
