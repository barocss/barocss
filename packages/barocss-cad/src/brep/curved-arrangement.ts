// Planar arrangement of line segments and circular arcs, and Booleans of the regions they bound
// (brep-core step 5). Circle intersections are irrational, so this one works in binary64 with a
// scale-relative tolerance: points within it are one vertex, and tangency is resolved by curvature.
// The structure matches the exact line arrangement (step 3): split, merge coincident pieces with
// their signed per-polygon counts, sort half-edges by tangent (then curvature) around vertices,
// trace faces, propagate windings from the unbounded face, select, trace boundaries.
//
// Tolerance: eps = CadNumericPolicy linear tolerance at the input scale. Points within eps are one
// vertex. Two carriers whose gap stays within eps across their near-touch are tangent: one vertex.
//
// Besides lines and arcs, a segment may be any smooth parametric curve (an ellipse, a sinusoid in a
// cylinder's domain, a quartic intersection): its crossings come from polylines refined by Newton's
// method, its area and crossings with a horizontal line by Gauss–Legendre and bisection.
import { linearToleranceMM } from '../numeric-policy.js';

export type XY = [number, number];
/**
 * A line from a to b, or an arc about c with radius r from angle t0 through the signed sweep. `tag`
 * (optional) names where the segment came from; pieces of it keep the tag through every Boolean.
 */
export type CurveSegment2 =
  | { readonly kind: 'line'; readonly a: XY; readonly b: XY; readonly tag?: string }
  | { readonly kind: 'arc'; readonly c: XY; readonly r: number; readonly t0: number; readonly sweep: number; readonly tag?: string }
  /** f over t0 → t1 (either order); `src` (optional) is the same curve in 3D, on the same parameter. */
  | { readonly kind: 'curve'; readonly f: (t: number) => XY; readonly t0: number; readonly t1: number; readonly tag?: string; readonly src?: (t: number) => readonly [number, number, number] };
/** A region: closed rings (material on the left: outer counter-clockwise, holes clockwise). */
export type CurveRegion2 = { readonly outer: readonly CurveSegment2[]; readonly holes: readonly (readonly CurveSegment2[])[] };
export type CurveBooleanOperation = 'union' | 'intersection' | 'difference' | 'xor';
export class CurvedArrangementError extends Error { constructor(detail: string) { super('Curved arrangement: ' + detail); this.name = 'CurvedArrangementError'; } }

const TWO_PI = 2 * Math.PI;
type ParamCurve = Extract<CurveSegment2, { kind: 'curve' }>;
const curveT = (s: ParamCurve, u: number) => s.t0 + (s.t1 - s.t0) * u;
export const segStart = (s: CurveSegment2): XY => s.kind === 'line' ? s.a : s.kind === 'curve' ? s.f(s.t0) : [s.c[0] + s.r * Math.cos(s.t0), s.c[1] + s.r * Math.sin(s.t0)];
export const segEnd = (s: CurveSegment2): XY => s.kind === 'line' ? s.b : s.kind === 'curve' ? s.f(s.t1) : [s.c[0] + s.r * Math.cos(s.t0 + s.sweep), s.c[1] + s.r * Math.sin(s.t0 + s.sweep)];
export const segAt = (s: CurveSegment2, u: number): XY => s.kind === 'line' ? [s.a[0] + (s.b[0] - s.a[0]) * u, s.a[1] + (s.b[1] - s.a[1]) * u]
  : s.kind === 'curve' ? s.f(curveT(s, u)) : [s.c[0] + s.r * Math.cos(s.t0 + s.sweep * u), s.c[1] + s.r * Math.sin(s.t0 + s.sweep * u)];
/** The same piece traversed the other way. */
export const segReverse = (s: CurveSegment2): CurveSegment2 => s.kind === 'line' ? { ...s, a: s.b, b: s.a } : s.kind === 'curve' ? { ...s, t0: s.t1, t1: s.t0 } : { ...s, t0: s.t0 + s.sweep, sweep: -s.sweep };
/** The sub-piece between parameters u0 < u1. */
function segPart(s: CurveSegment2, u0: number, u1: number, a: XY, b: XY): CurveSegment2 {
  return s.kind === 'line' ? { ...s, a, b } : s.kind === 'curve' ? { ...s, t0: curveT(s, u0), t1: curveT(s, u1) } : { ...s, t0: s.t0 + s.sweep * u0, sweep: s.sweep * (u1 - u0) };
}
// Gauss–Legendre on [0, 1] (8 points).
const GL8 = (() => {
  const x = [0.1834346424956498, 0.5255324099163290, 0.7966664774136267, 0.9602898564975363], w = [0.3626837833783620, 0.3137066458778873, 0.2223810344533745, 0.1012285362903763];
  return [...x.map((v, i) => [(1 - v) / 2, w[i] / 2]), ...x.map((v, i) => [(1 + v) / 2, w[i] / 2])] as [number, number][];
})();
/** ∫ g(point, derivative) du over [0, 1] of a segment (16 pieces × 8 points). */
export function segIntegral(s: CurveSegment2, g: (p: XY, d: XY) => number): number { return integrate(s, g); }
function integrate(s: CurveSegment2, g: (p: XY, d: XY) => number): number {
  let acc = 0; const pieces = 16, h = 1e-6;
  for (let k = 0; k < pieces; k++) for (const [x, w] of GL8) {
    const u = (k + x) / pieces, p = segAt(s, u), a = segAt(s, Math.max(0, u - h)), b = segAt(s, Math.min(1, u + h)), du = Math.min(1, u + h) - Math.max(0, u - h);
    acc += g(p, [(b[0] - a[0]) / du, (b[1] - a[1]) / du]) * w / pieces;
  }
  return acc;
}
/** Points along a parametric curve's polyline (n pieces, both ends included). */
const areas = new WeakMap<CurveSegment2, number>();
const polyline = (s: CurveSegment2, n: number) => s.kind === 'curve' && n === CURVE_SAMPLES ? samplesOf(s) : Array.from({ length: n + 1 }, (_, k) => segAt(s, k / n));
/** A general curve's CURVE_SAMPLES + 1 samples and their box padded by the longest chord, once per segment. */
const sampled = new WeakMap<CurveSegment2, { ps: XY[]; lo: XY; hi: XY }>();
function samples(s: CurveSegment2) {
  let r = sampled.get(s);
  if (!r) {
    const ps = Array.from({ length: CURVE_SAMPLES + 1 }, (_, k) => segAt(s, k / CURVE_SAMPLES)), lo: XY = [Infinity, Infinity], hi: XY = [-Infinity, -Infinity];
    let pad = 0;
    for (let k = 0; k <= CURVE_SAMPLES; k++) {
      for (const a of [0, 1]) { lo[a] = Math.min(lo[a], ps[k][a]); hi[a] = Math.max(hi[a], ps[k][a]); }
      if (k) pad = Math.max(pad, Math.hypot(ps[k][0] - ps[k - 1][0], ps[k][1] - ps[k - 1][1]));
    }
    r = { ps, lo: [lo[0] - pad, lo[1] - pad], hi: [hi[0] + pad, hi[1] + pad] }; sampled.set(s, r);
  }
  return r;
}
const samplesOf = (s: CurveSegment2) => samples(s).ps;
/** A general curve's 2 CURVE_SAMPLES + 1 samples (crossings with horizontal lines), once per segment. */
const denseSampled = new WeakMap<CurveSegment2, XY[]>();
function denseSamples(s: CurveSegment2): XY[] {
  let r = denseSampled.get(s);
  if (!r) { r = Array.from({ length: CURVE_SAMPLES * 2 + 1 }, (_, k) => segAt(s, k / (CURVE_SAMPLES * 2))); denseSampled.set(s, r); }
  return r;
}
/** Whether p is surely farther than eps from a general curve (outside its padded sample box). */
const surelyOff = (s: CurveSegment2, p: XY, eps: number) => { if (s.kind !== 'curve') return false; const { lo, hi } = samples(s); return p[0] < lo[0] - eps || p[1] < lo[1] - eps || p[0] > hi[0] + eps || p[1] > hi[1] + eps; };
const CURVE_SAMPLES = 64;
/** Area contribution ½∮(x dy − y dx) of a segment. */
export function segArea(s: CurveSegment2): number {
  if (s.kind === 'line') return (s.a[0] * s.b[1] - s.b[0] * s.a[1]) / 2;
  if (s.kind === 'curve') { let a = areas.get(s); if (a === undefined) { a = integrate(s, (p, d) => (p[0] * d[1] - p[1] * d[0]) / 2); areas.set(s, a); } return a; }
  const t1 = s.t0 + s.sweep;
  return (s.r * s.r * s.sweep + s.c[0] * s.r * (Math.sin(t1) - Math.sin(s.t0)) - s.c[1] * s.r * (Math.cos(t1) - Math.cos(s.t0))) / 2;
}
export const ringArea = (ring: readonly CurveSegment2[]) => ring.reduce((a, s) => a + segArea(s), 0);
export const regionArea = (r: CurveRegion2) => ringArea(r.outer) + r.holes.reduce((a, h) => a + ringArea(h), 0);
/** Points along a ring (arcs every ≤ 5°), end points excluded. */
export function sampleRing(ring: readonly CurveSegment2[], step = Math.PI / 36): XY[] {
  return ring.flatMap(s => { const n = s.kind === 'line' ? 1 : s.kind === 'curve' ? CURVE_SAMPLES : Math.max(2, Math.ceil(Math.abs(s.sweep) / step)); return Array.from({ length: n }, (_, k) => segAt(s, k / n)); });
}
/** Even–odd point in a polygon (sampled rings). */
export const pointInPolygon = (p: XY, poly: readonly XY[]) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };

/** Parameter u ∈ [0, 1] of a point known to lie on the segment's carrier (line or circle). */
export function paramOf(s: CurveSegment2, p: XY): number {
  if (s.kind === 'curve') {
    // Nearest polyline sample, then golden-section search on the squared distance around it.
    const d2 = (u: number) => { const q = segAt(s, u); return (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2; };
    const ps = samplesOf(s);
    let best = 0, bd = Infinity; for (let k = 0; k <= CURVE_SAMPLES; k++) { const q = ps[k], v = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2; if (v < bd) { bd = v; best = k; } }
    let lo = Math.max(0, (best - 1) / CURVE_SAMPLES), hi = Math.min(1, (best + 1) / CURVE_SAMPLES);
    for (let i = 0; i < 60; i++) { const m1 = hi - (hi - lo) * 0.6180339887, m2 = lo + (hi - lo) * 0.6180339887; if (d2(m1) < d2(m2)) hi = m2; else lo = m1; }
    // (A point on a curve sampled sparsely against its turn — a plane's ellipse on a cylinder nearly along its axis, 25 mm
    // a sample — can lie nearer a sample of another of its branches, and the search beside that sample ends far off: a
    // crossing found exactly was taken for 6.7 mm off the curve. Then the spans of the chords nearer p than that are
    // searched, nearest first, and the first point where p lies on the curve (within 1e-6 of its size) is kept. A point
    // off the curve keeps the search beside its nearest sample, and so does a point by a closed curve's ends: there the
    // chord across from its nearest end is not searched — the arrangement takes such a point at the end it is nearest.
    // L4 fuzz 73, D197.)
    const u0 = (lo + hi) / 2, d0 = d2(u0), on = 1e-6 * (1 + Math.abs(p[0]) + Math.abs(p[1])), N = CURVE_SAMPLES;
    const closed = Math.hypot(ps[0][0] - ps[N][0], ps[0][1] - ps[N][1]) <= on;
    if (d0 > on * on) for (const k of nearerChords(ps, p, d0)) {
      if (closed && ((best === N && k === 0) || (best === 0 && k === N - 1))) continue;
      lo = Math.max(0, (k - 0.5) / CURVE_SAMPLES); hi = Math.min(1, (k + 1.5) / CURVE_SAMPLES);
      for (let i = 0; i < 60; i++) { const m1 = hi - (hi - lo) * 0.6180339887, m2 = lo + (hi - lo) * 0.6180339887; if (d2(m1) < d2(m2)) hi = m2; else lo = m1; }
      if (d2((lo + hi) / 2) <= on * on) return (lo + hi) / 2;
    }
    return u0;
  }
  if (s.kind === 'line') { const d = [s.b[0] - s.a[0], s.b[1] - s.a[1]], l2 = d[0] * d[0] + d[1] * d[1]; return ((p[0] - s.a[0]) * d[0] + (p[1] - s.a[1]) * d[1]) / l2; }
  // Angle from the start along the sweep direction in [0, 2π); past the end it is the nearer of the
  // two readings (slightly before the start or slightly after the end).
  const dir = Math.sign(s.sweep), w = Math.abs(s.sweep);
  let dt = (Math.atan2(p[1] - s.c[1], p[0] - s.c[0]) - s.t0) * dir;
  dt = ((dt % TWO_PI) + TWO_PI) % TWO_PI;
  if (dt > w && TWO_PI - dt < dt - w) dt -= TWO_PI;
  return dt / w;
}
/** The chords k (samples k to k + 1) of a polyline whose squared distance from p is below d2, nearest first. */
function nearerChords(ps: readonly XY[], p: XY, d2: number): number[] {
  const out: { k: number; d: number }[] = [];
  for (let k = 0; k + 1 < ps.length; k++) {
    const a = ps[k], b = ps[k + 1], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0, ex = a[0] + t * dx - p[0], ey = a[1] + t * dy - p[1], d = ex * ex + ey * ey;
    if (d < d2) out.push({ k, d });
  }
  return out.sort((x, y) => x.d - y.d).map(x => x.k);
}
/** Distance from p to the segment. */
export function segDistance(s: CurveSegment2, p: XY): number {
  const q = segAt(s, Math.min(1, Math.max(0, paramOf(s, p)))); return Math.hypot(q[0] - p[0], q[1] - p[1]);
}
/** Intersection points of two segments (crossings, tangencies, endpoints touching, overlap ends). */
/** Points shared by two segments (crossings, tangencies, touching ends, overlap ends) within eps. */
/**
 * Whether m (at u on s) is a point of a touch at an end e of s lying on t (t's end, or a point inside it): s from e
 * stays within eps of t up to m and past it, then leaves t away from t's ends — a curve meeting a line to second order
 * (a G2 fillet's section at a planar face, R10.5b) lies that close to it for a while, and Newton, slow at a triple root,
 * stops anywhere in there. e is a vertex already. (Where s leaves t at an end of t, or never, the two overlap: m is a
 * point of the overlap. Nor at an end of either.)
 */
function touchOfEnd(s: CurveSegment2, t: CurveSegment2, u: number, m: XY, eps: number): boolean {
  if ([segStart(s), segEnd(s), segStart(t), segEnd(t)].some(q => Math.hypot(q[0] - m[0], q[1] - m[1]) <= eps)) return false;
  for (const [e, ue] of [[segStart(s), 0], [segEnd(s), 1]] as const) {
    if (Math.abs(u - ue) > 0.25 || segDistance(t, e) > eps) continue;
    let hug = true;
    for (let k = 1; k < 8 && hug; k++) hug = segDistance(t, segAt(s, ue + (u - ue) * k / 8)) <= eps;
    if (hug && leavesAwayFromEnds(s, t, e, ue, Math.abs(u - ue), eps)) return true;
  }
  return false;
}
/** Whether s, walked from its end e (at ue), leaves t (by eps) past `from` of its parameter, and not at an end of t (other than e). */
function leavesAwayFromEnds(s: CurveSegment2, t: CurveSegment2, e: XY, ue: number, from: number, eps: number): boolean {
  const dir = ue === 0 ? 1 : -1;
  let prev = segAt(s, ue + dir * from);
  for (let k = 1; k <= 64; k++) {
    const x = from + (1 - from) * k / 64, q = segAt(s, ue + dir * x);
    if (segDistance(t, q) > eps) {
      const step = Math.hypot(q[0] - prev[0], q[1] - prev[1]) + eps;
      return ![segStart(t), segEnd(t)].some(w => Math.hypot(w[0] - e[0], w[1] - e[1]) > eps && Math.hypot(w[0] - prev[0], w[1] - prev[1]) <= step);
    }
    prev = q;
  }
  return false;
}
/**
 * Points shared by two segments where they run along each other (a curve and its copy over part of its length: two faces'
 * sections by one plane, D152): only the ends of each such run. Between consecutive points along s, the middle of s lying on t
 * makes them one run; its inner points were "crossings" found all along it, each a split of both curves into slivers.
 */
function overlapEnds(s: CurveSegment2, t: CurveSegment2, points: XY[], eps: number): XY[] {
  if (points.length < 3) return points;
  const at = points.map(p => ({ p, u: paramOf(s, p) })).sort((a, b) => a.u - b.u);
  const along = at.slice(0, -1).map((a, i) => { const q = segAt(s, (a.u + at[i + 1].u) / 2); return segDistance(t, q) <= eps; });
  return at.filter((_, i) => !(i > 0 && i < at.length - 1 && along[i - 1] && along[i])).map(a => a.p);
}
/**
 * A curve's polyline (n chords, `P`) with each chord within its own length of `line` (its middle beside the line's
 * length) cut in eighths, and the parameters of its points (RB K9, D187).
 */
function grazePolyline(seg: CurveSegment2, P: readonly XY[], n: number, line: Extract<CurveSegment2, { kind: 'line' }>): { points: XY[]; us: number[] } {
  const dx = line.b[0] - line.a[0], dy = line.b[1] - line.a[1], l = Math.hypot(dx, dy), points: XY[] = [P[0]], us: number[] = [0];
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l > 0 && L > 0) {
      const sa = (dx * (a[1] - line.a[1]) - dy * (a[0] - line.a[0])) / l, sb = (dx * (b[1] - line.a[1]) - dy * (b[0] - line.a[0])) / l;
      // (Along the line's own length, not its extension: the chord's middle projects within it.)
      const f = ((a[0] + b[0]) / 2 - line.a[0]) * dx / (l * l) + ((a[1] + b[1]) / 2 - line.a[1]) * dy / (l * l);
      if (Math.min(Math.abs(sa), Math.abs(sb)) <= L && f >= 0 && f <= 1) for (let k = 1; k < 8; k++) { const u = (i + k / 8) / n; points.push(segAt(seg, u)); us.push(u); }
    }
    points.push(b); us.push((i + 1) / n);
  }
  return { points, us };
}
/**
 * The points where `curve` crosses `line`: its signed distance bisected between the refined points where it changes sign
 * (D187). Where both sides lie within `eps` of the line the curve runs along it (an overlap, its ends found apart): no
 * crossing there; a sample exactly on the line, coming from off it, is one.
 */
function grazeCrossings(curve: CurveSegment2, line: Extract<CurveSegment2, { kind: 'line' }>, R: { points: XY[]; us: number[] }, eps: number): XY[] {
  const dx = line.b[0] - line.a[0], dy = line.b[1] - line.a[1], l = Math.hypot(dx, dy), out: XY[] = [];
  if (!(l > 0)) return out;
  let lastU = R.us[0], lastD = (dx * (R.points[0][1] - line.a[1]) - dy * (R.points[0][0] - line.a[0])) / l;
  for (let i = 1; i < R.points.length; i++) {
    const p = R.points[i], d = (dx * (p[1] - line.a[1]) - dy * (p[0] - line.a[0])) / l, u = R.us[i];
    if (Math.abs(d) <= eps && Math.abs(lastD) <= eps) { lastU = u; lastD = d; continue; }
    if (d === 0) out.push(p);
    else if (lastD !== 0 && (d > 0) !== (lastD > 0)) {
      let lo = lastU, hi = u, dl = lastD;
      for (let it = 0; it < 60; it++) {
        const m = (lo + hi) / 2, q = segAt(curve, m), dm = (dx * (q[1] - line.a[1]) - dy * (q[0] - line.a[0])) / l;
        if (dm === 0) { lo = hi = m; break; }
        if ((dm > 0) === (dl > 0)) { lo = m; dl = dm; } else hi = m;
      }
      out.push(segAt(curve, (lo + hi) / 2));
    }
    lastU = u; lastD = d;
  }
  return out;
}
/**
 * Whether s crosses t at (u on s, v on t): s's points a little before and after u (1e-3 of its parameter, inside it) lie
 * on opposite sides of t's tangent line there, each more than eps off it.
 */
function crossesAt(s: CurveSegment2, t: CurveSegment2, u: number, v: number, eps: number): boolean {
  const Q = segAt(t, v), Q1 = segAt(t, Math.min(1, v + 1e-6)), Q0 = segAt(t, Math.max(0, v - 1e-6)), tx = Q1[0] - Q0[0], ty = Q1[1] - Q0[1], l = Math.hypot(tx, ty);
  if (!(l > 0)) return false;
  const a = segAt(s, Math.max(0, u - 1e-3)), b = segAt(s, Math.min(1, u + 1e-3));
  const da = (tx * (a[1] - Q[1]) - ty * (a[0] - Q[0])) / l, db = (tx * (b[1] - Q[1]) - ty * (b[0] - Q[0])) / l;
  return Math.abs(da) > eps && Math.abs(db) > eps && (da > 0) !== (db > 0);
}
export function intersectSegments(s: CurveSegment2, t: CurveSegment2, eps: number, graze = false): XY[] {
  const out: XY[] = [], on = (x: CurveSegment2, p: XY) => !surelyOff(x, p, eps) && segDistance(x, p) <= eps;
  const push = (p: XY) => { if (on(s, p) && on(t, p)) out.push(p); };
  // (Each end is tested against the other segment first: it lies on its own nearly always, and the other test — a general
  // curve's nearest-point search — mostly fails at once. The same points, in the same order: K13, D242.)
  const ends = () => { for (const p of [segStart(s), segEnd(s)]) if (on(t, p) && on(s, p)) out.push(p); for (const p of [segStart(t), segEnd(t)]) push(p); };
  if (s.kind === 'curve' || t.kind === 'curve') {
    // Polyline crossings refined by Newton's method on A(u) − B(v) = 0.
    const n = (x: CurveSegment2) => x.kind === 'line' ? 1 : x.kind === 'curve' ? CURVE_SAMPLES : Math.max(4, Math.ceil(Math.abs(x.sweep) / (Math.PI / 32)));
    const ns = n(s), nt = n(t), A0 = polyline(s, ns), B0 = polyline(t, nt);
    // (`graze`, a curve against a line: the curve's signed distance from the line, on its polyline with each chord within
    // its own length of the line cut in eighths, bisected at each change of sign. The curve can cross the line twice
    // inside one chord — a shallow graze of 10 µm over 0.6 mm, 1 µm over 0.16 mm, crossing at 3e-5 rad — where the
    // chord misses both and Newton, so near tangency, lands both seeds on one root. RB K9, D187.)
    if (graze && (s.kind === 'line') !== (t.kind === 'line')) {
      const curve = s.kind === 'line' ? t : s, line = (s.kind === 'line' ? s : t) as Extract<CurveSegment2, { kind: 'line' }>;
      const R = grazePolyline(curve, curve === s ? A0 : B0, curve === s ? ns : nt, line);
      for (const p of grazeCrossings(curve, line, R, eps)) push(p);
      ends(); return overlapEnds(s, t, out, eps);
    }
    const A = A0, B = B0;
    for (let i = 0; i < ns; i++) for (let j = 0; j < nt; j++) {
      const p = A[i], q = A[i + 1], r = B[j], w = B[j + 1], d1 = [q[0] - p[0], q[1] - p[1]], d2 = [w[0] - r[0], w[1] - r[1]], den = d1[0] * d2[1] - d1[1] * d2[0];
      if (Math.abs(den) < 1e-300) continue;
      const e = [r[0] - p[0], r[1] - p[1]], a = (e[0] * d2[1] - e[1] * d2[0]) / den, b = (e[0] * d1[1] - e[1] * d1[0]) / den;
      if (a < -0.25 || a > 1.25 || b < -0.25 || b > 1.25) continue;
      let u = (i + Math.min(1, Math.max(0, a))) / ns, v = (j + Math.min(1, Math.max(0, b))) / nt;
      const fromEnd = u === 1 || v === 1;
      for (let it = 0; it < 30; it++) {
        const P = segAt(s, u), Q = segAt(t, v), F = [P[0] - Q[0], P[1] - Q[1]], h = 1e-7;
        // (Started at an end that already meets the other segment, it stays there: the end is the point.)
        if (it === 0 && (u === 1 || v === 1) && Math.hypot(F[0], F[1]) <= eps) break;
        // (At a segment's end the difference is taken back from it: forward, it was taken at the end itself and came out
        // zero, and Newton stopped before its first step — a crossing just inside the end, the chords meeting past it, was
        // lost. L4 fuzz 20261026 #184, D259.)
        const hu = Math.min(1, u + h) - u || -h, hv = Math.min(1, v + h) - v || -h, Pu = segAt(s, u + hu), Qv = segAt(t, v + hv);
        const J = [(Pu[0] - P[0]) / hu, -(Qv[0] - Q[0]) / hv, (Pu[1] - P[1]) / hu, -(Qv[1] - Q[1]) / hv], det = J[0] * J[3] - J[1] * J[2];
        if (Math.abs(det) < 1e-300) break;
        const du = (F[0] * J[3] - F[1] * J[1]) / det, dv = (J[0] * F[1] - J[2] * F[0]) / det;
        // (Held where it is by the clamp — the step points past an end — it would only repeat itself: done.)
        const nu = Math.min(1, Math.max(0, u - du)), nv = Math.min(1, Math.max(0, v - dv)), held = nu === u && nv === v;
        u = nu; v = nv;
        if (held || (Math.abs(du) < 1e-15 && Math.abs(dv) < 1e-15)) break;
      }
      const P = segAt(s, u), Q = segAt(t, v);
      // (Found from an end — searched on from it since D259 — a point counts only where the two cross: a near-tangent
      // touch beside an end, as a fillet's section along its wall, was a point the search from there never reached.)
      if (fromEnd && u !== 1 && v !== 1 && !crossesAt(s, t, u, v, eps)) continue;
      if (Math.hypot(P[0] - Q[0], P[1] - Q[1]) <= eps) { const m: XY = [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2]; if (!out.some(o => Math.hypot(o[0] - m[0], o[1] - m[1]) <= eps) && !touchOfEnd(s, t, u, m, eps) && !touchOfEnd(t, s, v, m, eps)) push(m); }
    }
    ends(); return overlapEnds(s, t, out, eps);
  }
  if (s.kind === 'line' && t.kind === 'line') {
    const d1 = [s.b[0] - s.a[0], s.b[1] - s.a[1]], d2 = [t.b[0] - t.a[0], t.b[1] - t.a[1]], den = d1[0] * d2[1] - d1[1] * d2[0];
    const len = Math.hypot(...d1) * Math.hypot(...d2);
    if (Math.abs(den) <= 1e-12 * len) { ends(); return out; } // parallel (and possibly overlapping)
    const w = [t.a[0] - s.a[0], t.a[1] - s.a[1]], u = (w[0] * d2[1] - w[1] * d2[0]) / den;
    push([s.a[0] + d1[0] * u, s.a[1] + d1[1] * u]); ends(); return out;
  }
  if (s.kind === 'arc' && t.kind === 'arc') {
    const dx = t.c[0] - s.c[0], dy = t.c[1] - s.c[1], d = Math.hypot(dx, dy);
    if (d <= eps) { ends(); return out; } // concentric: overlap only if same radius; ends cover touching
    const a = (s.r * s.r - t.r * t.r + d * d) / (2 * d), h2 = s.r * s.r - a * a, band = 2 * eps * Math.min(s.r, t.r);
    if (h2 < -band) { ends(); return out; }
    const h = h2 > band ? Math.sqrt(h2) : 0, mx = s.c[0] + a * dx / d, my = s.c[1] + a * dy / d;
    push([mx + h * dy / d, my - h * dx / d]); if (h > 0) push([mx - h * dy / d, my + h * dx / d]);
    ends(); return out;
  }
  const line = (s.kind === 'line' ? s : t) as Extract<CurveSegment2, { kind: 'line' }>, arc = (s.kind === 'arc' ? s : t) as Extract<CurveSegment2, { kind: 'arc' }>;
  const d = [line.b[0] - line.a[0], line.b[1] - line.a[1]], l = Math.hypot(...d), ux = d[0] / l, uy = d[1] / l;
  const f = [line.a[0] - arc.c[0], line.a[1] - arc.c[1]], proj = f[0] * ux + f[1] * uy, dist2 = f[0] * f[0] + f[1] * f[1] - proj * proj, h2 = arc.r * arc.r - dist2;
  const band = 2 * eps * arc.r;
  if (h2 >= -band) { const h = h2 > band ? Math.sqrt(h2) : 0; for (const sgn of h > 0 ? [-1, 1] : [0]) { const k = -proj + sgn * h; push([line.a[0] + ux * k, line.a[1] + uy * k]); } }
  ends(); return out;
}

/**
 * A segment's box into `out` (x0, y0, x1, y1): a line's ends, an arc's whole circle, a general curve's samples padded by its
 * longest chord (the box `surelyOff` tests against).
 */
function boxInto(s: CurveSegment2, out: Float64Array): void {
  if (s.kind === 'line') { out[0] = Math.min(s.a[0], s.b[0]); out[1] = Math.min(s.a[1], s.b[1]); out[2] = Math.max(s.a[0], s.b[0]); out[3] = Math.max(s.a[1], s.b[1]); return; }
  if (s.kind === 'arc') { out[0] = s.c[0] - s.r; out[1] = s.c[1] - s.r; out[2] = s.c[0] + s.r; out[3] = s.c[1] + s.r; return; }
  const { lo, hi } = samples(s); out[0] = lo[0]; out[1] = lo[1]; out[2] = hi[0]; out[3] = hi[1];
}
const boxS = new Float64Array(4), boxT = new Float64Array(4);
/**
 * Whether two segments' boxes lie more than 4 eps apart, so that `intersectSegments(s, t, eps)` finds nothing: every point
 * it keeps lies within eps of both (and inside a general curve's box padded by eps). 4 eps rather than 2 leaves room for
 * the rounding of the nearest points it measures to. (K13, D242.)
 */
export function segmentsApart(s: CurveSegment2, t: CurveSegment2, eps: number): boolean {
  boxInto(s, boxS); boxInto(t, boxT);
  const m = 4 * eps;
  return boxT[0] - boxS[2] > m || boxS[0] - boxT[2] > m || boxT[1] - boxS[3] > m || boxS[1] - boxT[3] > m;
}

type Piece = { seg: CurveSegment2; polygon: number };
// seg runs u → v. Pieces are added in input order, so a piece shared by both operands keeps the first one's tag.
interface Edge { u: number; v: number; seg: CurveSegment2; count: Map<number, number> }
interface Half { from: number; to: number; edge: number; twin: number; next: number; face: number }

/** Arcs over half a turn are split in two, so no piece starts and ends at one vertex. */
const halves = (s: CurveSegment2): CurveSegment2[] => {
  if (s.kind === 'arc' && Math.abs(s.sweep) > Math.PI) return [{ ...s, sweep: s.sweep / 2 }, { ...s, t0: s.t0 + s.sweep / 2, sweep: s.sweep / 2 }];
  // A closed parametric curve becomes two pieces.
  if (s.kind === 'curve') { const a = segStart(s), b = segEnd(s); if (Math.hypot(a[0] - b[0], a[1] - b[1]) <= 1e-9 * (1 + Math.abs(a[0]) + Math.abs(a[1]))) { const m = (s.t0 + s.t1) / 2; return [{ ...s, t1: m }, { ...s, t0: m }]; } }
  return [s];
};
/** The arrangement tolerance for a set of rings. */
export function curveTolerance(rings: readonly (readonly CurveSegment2[])[]): number {
  let scale = 0;
  for (const ring of rings) for (const s of ring) for (const q of s.kind === 'line' ? [s.a, s.b] : s.kind === 'curve' ? polyline(s, 8) : [[Math.abs(s.c[0]) + s.r, Math.abs(s.c[1]) + s.r] as XY]) scale = Math.max(scale, Math.abs(q[0]), Math.abs(q[1]));
  return linearToleranceMM(scale);
}

/**
 * A cut's end that meets nothing (one edge there) ends at the nearest vertex within 10 tolerances, or else at the nearest
 * point within 10 tolerances of another segment, which is split there; not a stub within 10 tolerances of its own edge's
 * other end, nor onto a vertex at that other end, nor, for a cut within 100 tolerances, onto a segment there (D251). Two
 * loose ends join within 100 tolerances, and an exact cut's loose end a traced curve's segment within 100 (D255). Two cuts meeting where three surfaces meet are
 * each clipped against a different face's map of the same edge, and their ends, or an end and that edge, can land a few
 * tolerances apart: the face was then not divided. 10 tolerances is half the stitch's vertex merge radius, so no feature
 * the stitch keeps is joined away. (L4 fuzz 74, D237.)
 */
function joinLooseEnds(points: readonly XY[], edges: Edge[], eps: number): void {
  const degree = new Int32Array(points.length);
  for (const e of edges) { degree[e.u]++; degree[e.v]++; }
  for (let v = 0; v < points.length; v++) {
    if (degree[v] !== 1) continue;
    let e = 0; while (edges[e].u !== v && edges[e].v !== v) e++;
    const other = edges[e].u === v ? edges[e].v : edges[e].u;
    // (A stub: a cut's tail a hair past a crossing it already has. Joined to the ring beside it, it made a sliver.)
    if (Math.hypot(points[other][0] - points[v][0], points[other][1] - points[v][1]) <= 10 * eps) continue;
    let best = -1, bd = 10 * eps;
    for (let w = 0; w < points.length; w++) {
      if (w === v || w === other || degree[w] === 0) continue;
      const d = Math.hypot(points[w][0] - points[v][0], points[w][1] - points[v][1]);
      if (d <= bd) { bd = d; best = w; }
    }
    // (Two loose ends, each meeting nothing, join within 100 tolerances: the traced curves' own tolerance, within which the
    // stitch takes a ring's consecutive pieces to meet. A ruling clipped against a cylinder's traced trim ended 1e-4 short
    // of the ball's arc that goes on from there, and the box's face was not divided. L4 fuzz 20261025 #148, D255.)
    if (best < 0) for (let w = 0, d0 = 100 * eps; w < points.length; w++) {
      if (w === v || w === other || degree[w] !== 1) continue;
      const d = Math.hypot(points[w][0] - points[v][0], points[w][1] - points[v][1]);
      if (d <= d0) { d0 = d; best = w; }
    }
    if (best >= 0) { if (edges[e].u === v) edges[e].u = best; else edges[e].v = best; degree[v] = 0; degree[best]++; continue; }
    const p = points[v];
    // (A segment at the other end is left out only for a short cut, its other end within 100 tolerances: a long cut whose
    // two ends both stop short of one segment — a ball's circle ending a tolerance short of its patch's seam at both
    // crossings, the first end's join splitting the seam there — ends on it at both. L4 fuzz 20261025 #170, D251.)
    const short = Math.hypot(points[other][0] - p[0], points[other][1] - p[1]) <= 100 * eps;
    // (An exact cut's loose end onto a traced curve's segment within 100 tolerances, the traced curve's own tolerance: a
    // ball's arc ending where a cylinder's traced trim lies 1e-4 off it left the ball's face undivided. L4 fuzz 20261025
    // #148, D255. A traced cut's end keeps 10: joined so, a short traced cut 43 tolerances from a trim made an edge used
    // three times, 20261024 #55.)
    const exactEnd = edges[e].seg.kind !== 'curve' || !!(edges[e].seg as { exact?: boolean }).exact;
    let split = -1, at = 0, sd = 10 * eps;
    for (let f = 0; f < edges.length; f++) {
      const g = edges[f], reach = exactEnd && g.seg.kind === 'curve' && !(g.seg as { exact?: boolean }).exact ? 100 * eps : 10 * eps;
      if (f === e || g.u === v || g.v === v || (short && (g.u === other || g.v === other)) || surelyOff(g.seg, p, Math.max(sd, reach))) continue;
      const d = segDistance(g.seg, p); if (d > reach || (split >= 0 && d > sd)) continue;
      const u = paramOf(g.seg, p); if (u > 0 && u < 1) { sd = d; split = f; at = u; }
    }
    if (split < 0) continue;
    const g = edges[split];
    edges.push({ u: v, v: g.v, seg: segPart(g.seg, at, 1, p, points[g.v]), count: new Map(g.count) });
    g.seg = segPart(g.seg, 0, at, points[g.u], p); g.v = v; degree[v] += 2;
  }
}
function arrange(rings: readonly { polygon: number; ring: readonly CurveSegment2[] }[], tolerance?: number, joinEnds = false) {
  const pieces: Piece[] = [];
  for (const { polygon, ring } of rings) for (const seg of ring) for (const h of halves(seg)) pieces.push({ seg: h, polygon });
  const eps = tolerance ?? curveTolerance(rings.map(r => r.ring));
  // Vertices with a tolerance grid.
  const points: XY[] = [], grid = new Map<string, number[]>(), cell = eps * 64;
  const vid = (p: XY) => {
    const gx = Math.floor(p[0] / cell), gy = Math.floor(p[1] / cell);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const v of grid.get((gx + i) + ',' + (gy + j)) ?? []) if (Math.hypot(points[v][0] - p[0], points[v][1] - p[1]) <= eps) return v;
    const v = points.length; points.push(p); const k = gx + ',' + gy; grid.set(k, [...(grid.get(k) ?? []), v]); return v;
  };
  const cuts = pieces.map(p => [segStart(p.seg), segEnd(p.seg)]);
  // (A general curve's box is its samples' padded by its longest chord: the samples' own box missed a cut that ends on
  // the curve where it bulges between two samples, 3 µm past them, and the crossing was never looked for. L4 fuzz 173,
  // D207.)
  const box = (s: CurveSegment2) => { if (s.kind === 'curve') { const { lo, hi } = samples(s); return [lo[0] - eps, lo[1] - eps, hi[0] + eps, hi[1] + eps]; } const pts = s.kind === 'line' ? [s.a, s.b] : [segStart(s), segEnd(s), [s.c[0] - s.r, s.c[1] - s.r] as XY, [s.c[0] + s.r, s.c[1] + s.r] as XY]; return [Math.min(...pts.map(p => p[0])) - eps, Math.min(...pts.map(p => p[1])) - eps, Math.max(...pts.map(p => p[0])) + eps, Math.max(...pts.map(p => p[1])) + eps]; };
  const boxes = pieces.map(p => box(p.seg));
  for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
    const a = boxes[i], b = boxes[j]; if (a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]) continue;
    for (const p of intersectSegments(pieces[i].seg, pieces[j].seg, eps)) { cuts[i].push(p); cuts[j].push(p); }
  }
  // Coincident pieces share endpoints and a midpoint (within tolerance).
  const edges: Edge[] = [], edgesBetween = new Map<string, number[]>();
  pieces.forEach((pc, i) => {
    const params = cuts[i].map(p => ({ u: Math.min(1, Math.max(0, paramOf(pc.seg, p))), v: vid(p) })).sort((x, y) => x.u - y.u);
    const stops: { u: number; v: number }[] = [];
    for (const st of params) if (!stops.length || stops[stops.length - 1].v !== st.v) stops.push(st);
    for (let k = 0; k + 1 < stops.length; k++) {
      const s0 = stops[k], s1 = stops[k + 1]; if (s1.u - s0.u <= 0) continue;
      const seg = segPart(pc.seg, s0.u, s1.u, points[s0.v], points[s1.v]), mid = segAt(seg, 0.5);
      const forward = s0.v < s1.v, lo = forward ? s0.v : s1.v, hi = forward ? s1.v : s0.v;
      const key = lo + ':' + hi, list = edgesBetween.get(key) ?? [];
      let e = list.find(k => segDistance(edges[k].seg, mid) <= 4 * eps);
      if (e === undefined) { e = edges.length; edges.push({ u: lo, v: hi, seg: forward ? seg : segReverse(seg), count: new Map() }); list.push(e); edgesBetween.set(key, list); }
      if (pc.polygon >= 0) { const c = edges[e].count; c.set(pc.polygon, (c.get(pc.polygon) ?? 0) + (forward ? 1 : -1)); }
    }
  });
  if (joinEnds) joinLooseEnds(points, edges, eps);
  // Half-edges ordered by leaving tangent, then curvature (the more leftward-curving one later).
  const half: Half[] = [];
  edges.forEach((_, i) => { half.push({ from: edges[i].u, to: edges[i].v, edge: i, twin: 2 * i + 1, next: -1, face: -1 }, { from: edges[i].v, to: edges[i].u, edge: i, twin: 2 * i, next: -1, face: -1 }); });
  const leaving = (h: Half) => {
    const s = h.from === edges[h.edge].u ? edges[h.edge].seg : segReverse(edges[h.edge].seg);
    // Angles in (−π + 1e−12, π + 1e−12] so a direction along −x has one reading.
    const norm = (a: number) => a <= -Math.PI + 1e-12 ? a + TWO_PI : a;
    if (s.kind === 'line') return { angle: norm(Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0])), curvature: 0 };
    if (s.kind === 'curve') {
      const d = 1e-4, p0 = segAt(s, 0), p1 = segAt(s, d), p2 = segAt(s, 2 * d), v = [(p1[0] - p0[0]) / d, (p1[1] - p0[1]) / d], a = [(p2[0] - 2 * p1[0] + p0[0]) / (d * d), (p2[1] - 2 * p1[1] + p0[1]) / (d * d)];
      return { angle: norm(Math.atan2(v[1], v[0])), curvature: (v[0] * a[1] - v[1] * a[0]) / Math.hypot(v[0], v[1]) ** 3 };
    }
    const t = s.t0, dir = Math.sign(s.sweep);
    return { angle: norm(Math.atan2(Math.cos(t) * dir, -Math.sin(t) * dir)), curvature: dir / s.r };
  };
  const outgoing = points.map(() => [] as number[]); half.forEach((h, i) => outgoing[h.from].push(i));
  const keyed = half.map(leaving);
  // (Leaving along one tangent to within the data's rounding — a fillet's arc and the line it is tangent to, their
  // shared vertex moved by the vertex tolerance, the arc's tangent then off the line's by eps / r — they are ordered as
  // they lie a little way out, at δ = 10³ eps: by the chord's direction there, angle + κ δ / 2. R10.B, D99.)
  // (Angles are read from the middle of the widest gap between a vertex's directions, not from −π: a direction along
  // −x off by rounding to either side of ±π would otherwise jump to the other end of the order.)
  const delta = 1e3 * eps, rel = new Float64Array(half.length), segLeaving = (h: number) => half[h].from === edges[half[h].edge].u ? edges[half[h].edge].seg : segReverse(edges[half[h].edge].seg);
  for (const list of outgoing) {
    const a = list.map(h => keyed[h].angle).sort((x, y) => x - y);
    let from = -Math.PI, gap = -1;
    for (let i = 0; i < a.length; i++) { const g = (i + 1 < a.length ? a[i + 1] : a[0] + TWO_PI) - a[i]; if (g > gap) { gap = g; from = a[i] + g / 2; } }
    for (const h of list) rel[h] = ((keyed[h].angle - from) % TWO_PI + TWO_PI) % TWO_PI;
    list.sort((x, y) => { const d = rel[x] - rel[y]; return Math.abs(d) > 1e-4 ? d : tangentOrder(segLeaving(x), segLeaving(y), rel[x], rel[y], from, d, keyed[x].curvature, keyed[y].curvature, delta); });
  }
  const pos = new Map<number, number>(); outgoing.forEach(list => list.forEach((h, k) => pos.set(h, k)));
  for (const h of half) { const list = outgoing[h.to], k = pos.get(h.twin)!; h.next = list[(k - 1 + list.length) % list.length]; }
  const cycles: number[][] = [];
  half.forEach((h, i) => { if (h.face >= 0) return; const c: number[] = []; let g = i; do { half[g].face = cycles.length; c.push(g); g = half[g].next; } while (g !== i && c.length <= half.length); cycles.push(c); });
  const segOfHalf = (h: number) => half[h].from === edges[half[h].edge].u ? edges[half[h].edge].seg : segReverse(edges[half[h].edge].seg);
  return { points, edges, half, cycles, segOfHalf, eps };
}

/**
 * Two half-edges leaving one vertex along one tangent (to 1e-4): ordered by their chords to the points a quarter of the
 * shorter one's length out along each — they do not cross before their next vertices (a crossing is a vertex), so the
 * chords keep their order; a curve touching a line to second order (a G2 fillet's section at a planar face, R10.5b)
 * agrees with it in angle and curvature both. Where the chords also agree (a copy), by angle + κδ/2.
 */
function tangentOrder(a: CurveSegment2, b: CurveSegment2, relA: number, relB: number, from: number, d: number, ka: number, kb: number, delta: number): number {
  const L = 0.25 * Math.min(segLength(a), segLength(b)), p0 = segAt(a, 0), pa = pointAlong(a, L), pb = pointAlong(b, L);
  const ang = (q: XY) => ((Math.atan2(q[1] - p0[1], q[0] - p0[0]) - from) % TWO_PI + TWO_PI) % TWO_PI;
  // (The chords' angles read about the same origin as the tangents: near ±π a chord off by rounding would wrap.)
  const fix = (x: number, ref: number) => x - ref > Math.PI ? x - TWO_PI : ref - x > Math.PI ? x + TWO_PI : x;
  const c = fix(ang(pa), relA) - fix(ang(pb), relB);
  if (Math.abs(c) > 1e-12) return c;
  const k = d + (ka - kb) * delta / 2;
  return Math.abs(k) > 1e-15 ? k : ka - kb;
}
/** A segment's length by 64 chords. */
function segLength(g: CurveSegment2): number { let l = 0, p = segAt(g, 0); for (let i = 1; i <= 64; i++) { const q = segAt(g, i / 64); l += Math.hypot(q[0] - p[0], q[1] - p[1]); p = q; } return l; }
/** The point L along a segment from its start (by 64 chords, linearly between them). */
function pointAlong(g: CurveSegment2, L: number): XY {
  let acc = 0, p = segAt(g, 0);
  for (let i = 1; i <= 64; i++) { const q = segAt(g, i / 64), d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (acc + d >= L && d > 0) { const t = (L - acc) / d; return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; } acc += d; p = q; }
  return p;
}

/** Every vertex of the arrangement of the rings (crossings, tangencies, touches, ring vertices). */
export function curveArrangementVertices(rings: readonly (readonly CurveSegment2[])[], tolerance?: number): XY[] {
  return rings.length ? arrange(rings.map(ring => ({ polygon: 0, ring })), tolerance).points : [];
}

function regions(arr: ReturnType<typeof arrange>, polygonCount: number) {
  const { points, edges, half, cycles, segOfHalf } = arr;
  const areaOf = (c: number[]) => c.reduce((a, h) => a + segArea(segOfHalf(h)), 0);
  const areas = cycles.map(areaOf), root = points.map((_, i) => i), find = (v: number): number => { while (root[v] !== v) v = root[v] = root[root[v]]; return v; };
  for (const e of edges) root[find(e.u)] = find(e.v);
  const comp = (c: number[]) => find(half[c[0]].from), sampled = cycles.map(c => sampleRing(c.map(segOfHalf)));
  const faceOfCycle = cycles.map((c, i) => {
    if (areas[i] > 0) return i;
    const p = points[half[c[0]].from], mine = comp(c); let best = -1, bestArea = Infinity;
    cycles.forEach((o, k) => { if (areas[k] > 0 && comp(o) !== mine && areas[k] < bestArea && pointInPolygon(p, sampled[k])) { bestArea = areas[k]; best = k; } });
    return best;
  });
  const faceOfHalf = half.map(h => faceOfCycle[h.face]), winding = new Map<number, number[]>([[-1, Array(polygonCount).fill(0)]]), queue = [-1];
  const halvesOf = new Map<number, number[]>(); faceOfHalf.forEach((f, h) => halvesOf.set(f, [...(halvesOf.get(f) ?? []), h]));
  while (queue.length) {
    const f = queue.shift()!, w = winding.get(f)!;
    for (const h of halvesOf.get(f) ?? []) {
      const other = faceOfHalf[half[h].twin]; if (winding.has(other)) continue;
      const e = edges[half[h].edge], fwd = half[h].from === e.u;
      winding.set(other, w.map((x, p) => x - (e.count.get(p) ?? 0) * (fwd ? 1 : -1))); queue.push(other);
    }
  }
  return { faceOfHalf, winding, faceOfCycle, areas };
}

/** Merges consecutive pieces of one line or one circle (same direction). */
function simplify(ring: CurveSegment2[], eps: number): CurveSegment2[] {
  const sameCarrier = (s: CurveSegment2, t: CurveSegment2) => {
    if (s.tag !== t.tag) return false;
    if (s.kind === 'line' && t.kind === 'line') { const d1 = [s.b[0] - s.a[0], s.b[1] - s.a[1]], d2 = [t.b[0] - t.a[0], t.b[1] - t.a[1]]; return Math.abs(d1[0] * d2[1] - d1[1] * d2[0]) <= 1e-12 * Math.hypot(...d1) * Math.hypot(...d2) && d1[0] * d2[0] + d1[1] * d2[1] > 0; }
    if (s.kind === 'arc' && t.kind === 'arc') return Math.hypot(s.c[0] - t.c[0], s.c[1] - t.c[1]) <= eps && Math.abs(s.r - t.r) <= eps && Math.sign(s.sweep) === Math.sign(t.sweep);
    if (s.kind === 'curve' && t.kind === 'curve') return s.f === t.f && s.t1 === t.t0 && Math.sign(s.t1 - s.t0) === Math.sign(t.t1 - t.t0);
    return false;
  };
  const out = [...ring];
  for (let changed = true; changed && out.length > 1;) {
    changed = false;
    for (let i = 0; i < out.length && out.length > 1; i++) {
      const s = out[i], t = out[(i + 1) % out.length];
      if (!sameCarrier(s, t)) continue;
      const merged: CurveSegment2 = s.kind === 'line' ? { ...s, b: (t as typeof s).b } : s.kind === 'curve' ? { ...s, t1: (t as typeof s).t1 } : { ...s, sweep: s.sweep + (t as typeof s).sweep };
      if (merged.kind === 'arc' && Math.abs(merged.sweep) > Math.PI + 1e-12) continue; // arcs stay within half a turn
      if (merged.kind === 'curve' && halves(merged).length > 1) continue; // no closed single pieces
      out.splice(i, 1, merged); out.splice((i + 1) % (out.length), 1); changed = true; break;
    }
  }
  return out;
}

/**
 * Boolean of two sets of closed rings (material left). Regions come back as outer + holes. `joinEnds`: rings closed to
 * within 10 tolerances, as `curveFaceRegions` leaves them where it joined a cut's loose end (`joinLooseEnds`), are
 * closed there.
 */
export function booleanCurveRegions(a: readonly (readonly CurveSegment2[])[], b: readonly (readonly CurveSegment2[])[], operation: CurveBooleanOperation, tolerance?: number, joinEnds = false): CurveRegion2[] {
  const rings = [...a.map(ring => ({ polygon: 0, ring })), ...b.map(ring => ({ polygon: 1, ring }))];
  if (!rings.length) return [];
  const arr = arrange(rings, tolerance, joinEnds), { faceOfHalf, winding } = regions(arr, 2), { half, segOfHalf, eps } = arr;
  const pick = (w: number[]) => { const x = w[0] !== 0, y = w[1] !== 0; return operation === 'union' ? x || y : operation === 'intersection' ? x && y : operation === 'difference' ? x && !y : x !== y; };
  const selected = new Map<number, boolean>(); for (const [f, w] of winding) selected.set(f, f !== -1 && pick(w));
  const boundary = (h: number) => !!selected.get(faceOfHalf[h]) && !selected.get(faceOfHalf[half[h].twin]);
  const used = new Set<number>(), traced: CurveSegment2[][] = [];
  half.forEach((_, h) => {
    if (!boundary(h) || used.has(h)) return;
    const ring: CurveSegment2[] = []; let g = h;
    do { used.add(g); ring.push(segOfHalf(g)); let n = half[g].next; while (!boundary(n)) n = half[half[n].twin].next; g = n; } while (g !== h && ring.length <= half.length);
    traced.push(simplify(ring, eps));
  });
  const outers = traced.filter(r => ringArea(r) > 0).map(outer => ({ outer, holes: [] as CurveSegment2[][], sample: sampleRing(outer) }));
  for (const hole of traced.filter(r => ringArea(r) <= 0)) {
    const probe = sampleRing(hole);
    let best = -1, bestArea = Infinity;
    outers.forEach((o, k) => { const ar = ringArea(o.outer); if (ar < bestArea && probe.some(p => pointInPolygon(p, o.sample)) && pointInPolygon(segAt(hole[0], 0.5), o.sample)) { bestArea = ar; best = k; } });
    if (best < 0) throw new CurvedArrangementError('a result hole has no enclosing ring');
    outers[best].holes.push(hole);
  }
  return outers.map(o => ({ outer: o.outer, holes: o.holes }));
}

/**
 * Area moments of a region by Green's theorem: [∫dA, ∫x, ∫y, ∫x², ∫y², ∫xy]. Lines are integrated
 * exactly; arcs by Gauss–Legendre on pieces of at most 1/16 turn (error far below binary64 rounding).
 */
export function regionMoments(region: CurveRegion2): [number, number, number, number, number, number] {
  const m: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];
  const add = (x: number, y: number, dx: number, dy: number, w: number) => {
    m[0] += w * (x * dy - y * dx) / 2; m[1] += w * x * x * dy / 2; m[2] -= w * y * y * dx / 2;
    m[3] += w * x * x * x * dy / 3; m[4] -= w * y * y * y * dx / 3; m[5] += w * x * x * y * dy / 2;
  };
  for (const ring of [region.outer, ...region.holes]) for (const s of ring) {
    if (s.kind === 'line') { const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1]; for (const [u, w] of GL8) add(s.a[0] + dx * u, s.a[1] + dy * u, dx, dy, w); continue; }
    if (s.kind === 'curve') { for (let k = 0; k < 16; k++) for (const [u, w] of GL8) { const x = (k + u) / 16, p = segAt(s, x), a = segAt(s, Math.max(0, x - 1e-6)), b = segAt(s, Math.min(1, x + 1e-6)), du = Math.min(1, x + 1e-6) - Math.max(0, x - 1e-6); add(p[0], p[1], (b[0] - a[0]) / du / 16, (b[1] - a[1]) / du / 16, w); } continue; }
    const pieces = Math.max(1, Math.ceil(Math.abs(s.sweep) / (Math.PI / 8)));
    for (let k = 0; k < pieces; k++) for (const [u, w] of GL8) {
      const t = s.t0 + s.sweep * (k + u) / pieces, dt = s.sweep / pieces;
      add(s.c[0] + s.r * Math.cos(t), s.c[1] + s.r * Math.sin(t), -s.r * Math.sin(t) * dt, s.r * Math.cos(t) * dt, w);
    }
  }
  return m;
}

/**
 * A region split by cut segments: the faces of the arrangement of its rings (polygon 0) and the cuts
 * (no winding) that lie inside it, each as outer ring + holes. Cuts outside the region are ignored.
 */
export function curveFaceRegions(rings: readonly (readonly CurveSegment2[])[], cuts: readonly CurveSegment2[], tolerance?: number): CurveRegion2[] {
  const arr = arrange([...rings.map(ring => ({ polygon: 0, ring })), ...cuts.map(c => ({ polygon: -1, ring: [c] }))], tolerance, true);
  const { winding, faceOfCycle, areas } = regions(arr, 1), { cycles, segOfHalf } = arr, out = new Map<number, CurveRegion2 & { holes: CurveSegment2[][] }>();
  cycles.forEach((c, i) => {
    const f = faceOfCycle[i]; if (f < 0 || !(winding.get(f)?.[0])) return;
    const ring = c.map(segOfHalf);
    if (areas[i] > 0 && f === i) out.set(f, { outer: ring, holes: [...(out.get(f)?.holes ?? [])] });
    else { const r = out.get(f) ?? { outer: [], holes: [] }; r.holes.push(ring); out.set(f, r); }
  });
  return [...out.values()].filter(r => r.outer.length);
}

/**
 * Horizontal-line crossings of a ring set at height y (half-open rule). A vertex shared by two
 * segments is read once (the previous segment's end), so both sides agree on which side of the
 * line it lies even when the two segments reach it through slightly different parameters.
 */
function crossingsAt(rings: readonly (readonly CurveSegment2[])[], y: number): number[] {
  const xs: number[] = [];
  const near = 1e-12 * (1 + Math.abs(y)), above = (v: number) => v > y + near;
  for (const ring of rings) for (let si = 0; si < ring.length; si++) {
    const g = ring[si], start = segEnd(ring[(si - 1 + ring.length) % ring.length]);
    // The segment as points at parameters, its first point replaced by the shared vertex.
    const us = g.kind === 'line' ? [0, 1] : g.kind === 'curve' ? Array.from({ length: CURVE_SAMPLES * 2 + 1 }, (_, k) => k / (CURVE_SAMPLES * 2)) : arcCuts(g);
    const dense = g.kind === 'curve' ? denseSamples(g) : null;
    const at = (u: number, k: number): XY => u === 0 ? start : dense ? dense[k] : segAt(g, u);
    for (let k = 0; k + 1 < us.length; k++) {
      let lo = us[k], hi = us[k + 1]; const a = at(lo, k), b = at(hi, k + 1);
      if (above(a[1]) === above(b[1])) continue;
      if (g.kind === 'line') { xs.push(a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1])); continue; }
      const aAbove = above(a[1]);
      for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (above(segAt(g, m)[1]) === aAbove) lo = m; else hi = m; }
      xs.push(segAt(g, (lo + hi) / 2)[0]);
    }
  }
  return xs;
}
/** An arc's parameters at its ends and where it turns in y (its top and bottom): y-monotone pieces. */
function arcCuts(g: Extract<CurveSegment2, { kind: 'arc' }>): number[] {
  const cuts = [0, 1];
  for (const t of [Math.PI / 2, -Math.PI / 2]) { const u = paramOf(g, [g.c[0] + g.r * Math.cos(t), g.c[1] + g.r * Math.sin(t)]); if (u > 0 && u < 1) cuts.push(u); }
  return cuts.sort((a, b) => a - b);
}
/** Whether p is inside the region (boundary points: `boundary`, decided by tolerance). */
export function locateInRegion(p: XY, region: CurveRegion2, tolerance: number): 'in' | 'out' | 'boundary' {
  const rings = [region.outer, ...region.holes];
  for (const ring of rings) for (const g of ring) if (!surelyOff(g, p, tolerance) && segDistance(g, p) <= tolerance) return 'boundary';
  return crossingsAt(rings, p[1]).filter(x => x > p[0]).length % 2 === 1 ? 'in' : 'out';
}
/**
 * A point strictly inside a region: on a few horizontal lines through it, the exact crossings with
 * its lines and arcs (no sampling, so tangent cusps cannot fold the boundary), and the middle of the
 * widest inside interval.
 */
export function regionInteriorPoint(region: CurveRegion2): XY | null {
  const rings = [region.outer, ...region.holes];
  let y0 = Infinity, y1 = -Infinity;
  const extent = (g: CurveSegment2): XY[] => g.kind === 'line' ? [g.a, g.b] : g.kind === 'curve' ? polyline(g, CURVE_SAMPLES)
    : [segStart(g), segEnd(g), ...([[g.c[0], g.c[1] - g.r], [g.c[0], g.c[1] + g.r]] as XY[]).filter(p => { const u = paramOf(g, p); return u >= 0 && u <= 1; })];
  for (const ring of rings) for (const g of ring) for (const p of extent(g)) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  // Candidates: the middles of the inside intervals on several lines; the one farthest from the boundary
  // wins (a line along an edge or through a vertex gives a candidate on the boundary, never chosen).
  let best: XY | null = null, clearance = -1;
  for (const f of [0.5, 0.3819660112501051, 0.6180339887498949, 0.2360679774997897, 0.7639320225002103, 0.1458980337503155, 0.8541019662496845, 0.0901699437494742, 0.9098300562505258]) {
    const y = y0 + (y1 - y0) * f, xs = crossingsAt(rings, y).sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const p: XY = [(xs[k] + xs[k + 1]) / 2, y];
      // (A candidate no farther from the boundary than the best so far is dropped at once; a general
      // curve whose padded sample box is no nearer than the nearest so far is not measured.)
      let d = Infinity;
      scan: for (const ring of rings) for (const g of ring) {
        if (g.kind === 'curve') { const { lo, hi } = samples(g); if (Math.hypot(Math.max(lo[0] - p[0], 0, p[0] - hi[0]), Math.max(lo[1] - p[1], 0, p[1] - hi[1])) >= d) continue; }
        d = Math.min(d, segDistance(g, p)); if (d <= clearance) break scan;
      }
      if (d > clearance) { clearance = d; best = p; }
    }
  }
  return best;
}
