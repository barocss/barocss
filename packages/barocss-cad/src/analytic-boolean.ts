// Booleans of B-reps bounded by planes and circular cylinders of any axis (brep-core step 7): cross
// holes, pins lying along X, bodies turned about X or Y together with cylinders. Every intersection
// of two such faces handled here is a straight line or a circle:
//
//   plane × plane          a line (coplanar faces cut each other along their boundaries)
//   plane × cylinder       lines along the axis (plane parallel to it) or a circle (plane across it)
//   cylinder × cylinder    lines along the axes (parallel axes); one cylinder: boundaries cut each other
//   plane at an angle      an ellipse (a sinusoid in the cylinder's domain), as a parametric curve
//   crossing cylinders     when the smaller passes through the larger: two closed quartic branches,
//                          parametrised by the angle on the smaller cylinder
//
// Crossing cylinders that only partly pass through each other (branch points: equal radii, grazing)
// are refused with the reason. Edges along parametric curves are stored as C¹ cubic Bézier chains
// fitted to within the tolerance. Each face is split in its own 2D domain: a plane in an
// orthonormal frame (lines and arcs), a cylinder in (U, V) = (±r·θ, height) where its boundaries are
// straight; both use the line + arc arrangement. Pieces are classified at an interior point (on a face
// of the other solid, or inside / outside by ray parity, retried on a degenerate ray), kept by the
// operation's rule, split at shared vertices and stitched into shells; negative shells are cavities.
// Works in binary64 with the numeric policy's tolerance at the inputs' scale.
import { revolutionOf, profileCrossings, onPatch, type Revolution } from './surface-revolution.js';
import { BrepError, buildBrep, checkBrep, lineCurve, type Brep, type BrepFace } from './brep-core.js';
import { circleOf, polesOf } from './brep-tessellate.js';
import { booleanCurveRegions, curveFaceRegions, intersectSegments, segAt as segAtAny, locateInRegion, paramOf as paramOfCurve, regionArea, regionInteriorPoint, segIntegral, segReverse, type CurveRegion2, type CurveSegment2, type XY } from './curved-arrangement.js';
import { nameEdges } from './prismatic-solid.js';
import { baseName } from './polyhedral-boolean.js';
import { evaluateCurve, evaluateSurface, curveDomain, curveEvaluator, surfaceDomain, surfaceEvaluator } from './math.js';
import { chainCurve, intersectPatches, SurfaceIntersectionError } from './surface-intersection.js';
import { triangulatePolygonWithHoles } from './brep-tessellate.js';
import { linearToleranceMM } from './numeric-policy.js';
import { add, cross, dot, len, scale, sub, unit } from './vec3.js';
import type { Curve, Point, Surface } from './types.js';

export type AnalyticBooleanOperation = 'union' | 'intersection' | 'difference';

type P3 = Point;
const TWO_PI = 2 * Math.PI;

// ---- surfaces and face domains ------------------------------------------------------------------
type Plane = { kind: 'plane'; o: P3; n: P3; e1: P3; e2: P3 };
/** Axis a (canonical sign), frame e1, e2 ⊥ a, U = s·r·θ with θ unwrapped about `ref`, V = height along a from c. */
type Cylinder = { kind: 'cylinder'; c: P3; a: P3; e1: P3; e2: P3; r: number; s: 1 | -1; ref: number };
// (ref is reassigned for a full-turn wall: its domain is centred opposite the seam.)
/**
 * Any other smooth surface patch: domain coordinates (ku·u, kv·v), scaled to arc length, with ku < 0 for
 * a reversed face so loops run counter-clockwise in the domain. Points map back by Newton projection.
 */
type Nurbs = { kind: 'nurbs'; S: Surface; rev?: Revolution | null; ev: (u: number, v: number) => P3; ku: number; kv: number; U: [number, number]; V: [number, number]; sense: 1 | -1;
  /** 25 × 25 samples of the patch (made on first use). */
  readonly grid: { p: XY; x: P3; pole?: boolean }[]; last: { p: XY }; size: number;
  /** The box of the control points: the patch lies inside it (positive weights). */
  hullMin: P3; hullMax: P3;
  /** Domain sides collapsed to a point: `along` is the free coordinate (0: x, 1: y), `at` the fixed one (scaled). */
  poles: { along: 0 | 1; at: number; point: P3 }[] };
type Surf = Plane | Cylinder | Nurbs;
function nurbsOf(S: Surface, sense: 1 | -1): Nurbs {
  const { u: U, v: V } = surfaceDomain(S), at = surfaceEvaluator(S);
  let Lu = 0, Lv = 0; for (let i = 0; i < 8; i++) { const a = U[0] + (U[1] - U[0]) * (i + 0.5) / 8, b = V[0] + (V[1] - V[0]) * (i + 0.5) / 8; for (let k = 0; k < 8; k++) { Lu += len(sub(at(U[0] + (U[1] - U[0]) * (k + 1) / 8, b), at(U[0] + (U[1] - U[0]) * k / 8, b))) / 8; Lv += len(sub(at(a, V[0] + (V[1] - V[0]) * (k + 1) / 8), at(a, V[0] + (V[1] - V[0]) * k / 8))) / 8; } }
  const ku = sense * (Lu || 1) / (U[1] - U[0]), kv = (Lv || 1) / (V[1] - V[0]);
  const poles = polesOf(S).map(q => ({ along: q.along, at: q.along === 0 ? q.at * kv : q.at * ku, point: q.point as P3 }));
  const hullMin: P3 = [Infinity, Infinity, Infinity], hullMax: P3 = [-Infinity, -Infinity, -Infinity];
  for (const row of S.controlPoints) for (const q of row) for (let k = 0; k < 3; k++) { if (q[k] < hullMin[k]) hullMin[k] = q[k]; if (q[k] > hullMax[k]) hullMax[k] = q[k]; }
  let grid: { p: XY; x: P3; pole?: boolean }[] | null = null;
  return { kind: 'nurbs', S, ev: at, ku, kv, U: [U[0], U[1]], V: [V[0], V[1]], sense, last: { p: [(U[0] + U[1]) / 2, (V[0] + V[1]) / 2] }, size: Math.max(Lu, Lv), poles, hullMin, hullMax,
    get grid() { return grid ??= gridOf(at, U, V, poles, Math.max(Lu, Lv)); } };
}
/** 25 × 25 samples of a patch, those at a collapsed side marked (their free parameter is arbitrary). */
function gridOf(at: (u: number, v: number) => P3, U: readonly number[], V: readonly number[], poles: readonly { point: P3 }[], size: number): { p: XY; x: P3; pole?: boolean }[] {
  const grid: { p: XY; x: P3; pole?: boolean }[] = [];
  for (let i = 0; i <= 24; i++) for (let j = 0; j <= 24; j++) { const a = U[0] + (U[1] - U[0]) * i / 24, b = V[0] + (V[1] - V[0]) * j / 24; grid.push({ p: [a, b], x: at(a, b) }); }
  for (const g of grid) g.pole = poles.some(o => len(sub(o.point, g.x)) <= 1e-12 * (size + 1));
  return grid;
}
/**
 * Surface parameters of the point of a NURBS patch nearest x. Newton from the last answer; a point it
 * puts on the surface is accepted at once (the parameters of a surface point are unique), anything
 * else is retried from the nearest grid point.
 */
function nurbsParam(s: Nurbs, x: P3, hint?: { p: XY }): XY {
  const newton = (start: XY): XY => {
    let a = start[0], b = start[1];
    for (let it = 0; it < 30; it++) {
      const h = 1e-7, ia = a + h * (s.U[1] - s.U[0]) <= s.U[1] ? a + h * (s.U[1] - s.U[0]) : a - h * (s.U[1] - s.U[0]), ib = b + h * (s.V[1] - s.V[0]) <= s.V[1] ? b + h * (s.V[1] - s.V[0]) : b - h * (s.V[1] - s.V[0]);
      const q = s.ev(a, b), Su = scale(sub(s.ev(ia, b), q), 1 / (ia - a)), Sv = scale(sub(s.ev(a, ib), q), 1 / (ib - b)), r = sub(x, q);
      const g11 = dot(Su, Su), g12 = dot(Su, Sv), g22 = dot(Sv, Sv), r1 = dot(r, Su), r2 = dot(r, Sv), det = g11 * g22 - g12 * g12;
      if (!(Math.abs(det) > 1e-300)) break;
      const da = (r1 * g22 - r2 * g12) / det, db = (g11 * r2 - g12 * r1) / det;
      a = Math.min(s.U[1], Math.max(s.U[0], a + da)); b = Math.min(s.V[1], Math.max(s.V[0], b + db));
      if (Math.abs(da) < 1e-14 * (s.U[1] - s.U[0]) && Math.abs(db) < 1e-14 * (s.V[1] - s.V[0])) break;
    }
    return [a, b];
  };
  const near = (p: XY) => len(sub(s.ev(p[0], p[1]), x));
  const from = hint ?? s.last;
  let p = newton(from.p);
  if (near(p) > 1e-9 * s.size) {
    // (Grid points at a pole are skipped: their free parameter is arbitrary.)
    let best = s.grid[0], d = Infinity;
    for (const g of s.grid) { if (g.pole) continue; const e = (g.x[0] - x[0]) ** 2 + (g.x[1] - x[1]) ** 2 + (g.x[2] - x[2]) ** 2; if (e < d) { d = e; best = g; } }
    const q = newton(best.p); if (near(q) < near(p)) p = q;
  }
  from.p = p; if (hint) s.last.p = p;
  return p;
}
const nurbsNormal = (s: Nurbs, p: XY): P3 => {
  const h = 1e-6, a = p[0] + h * (s.U[1] - s.U[0]) <= s.U[1] ? p[0] + h * (s.U[1] - s.U[0]) : p[0] - h * (s.U[1] - s.U[0]), b = p[1] + h * (s.V[1] - s.V[0]) <= s.V[1] ? p[1] + h * (s.V[1] - s.V[0]) : p[1] - h * (s.V[1] - s.V[0]);
  const q = s.ev(p[0], p[1]);
  return unit(scale(cross(sub(s.ev(a, p[1]), q), sub(s.ev(p[0], b), q)), Math.sign(a - p[0]) * Math.sign(b - p[1])));
};
interface GFace {
  solid: 0 | 1; surf: Surf; region: CurveRegion2; out: 1 | -1; min: P3; max: P3; name?: string; cuts: CurveSegment2[];
}
/** A 3D curve piece: a segment, or an arc about c in the plane ⊥ n from u through `sweep` (≥ 0, CCW about n). */
type Curve3 = { kind: 'line'; p: P3; q: P3 } | { kind: 'arc'; c: P3; n: P3; r: number; u: P3; sweep: number }
  /** A smooth curve on the parameter range t0 → t1 (either order). */
  | { kind: 'param'; at: (t: number) => P3; t0: number; t1: number; /** `at` is an exact curve (a line or arc's map onto a general face), not a fit. */ exact?: boolean };
const paramAt = (k: Extract<Curve3, { kind: 'param' }>, u: number) => k.at(k.t0 + (k.t1 - k.t0) * u);
const arcAt = (k: Extract<Curve3, { kind: 'arc' }>, phi: number): P3 => add(k.c, add(scale(k.u, k.r * Math.cos(phi)), scale(cross(k.n, k.u), k.r * Math.sin(phi))));

function canonicalFrame(axis: P3): { a: P3; e1: P3; e2: P3 } {
  const big = [0, 1, 2].reduce((m, i) => Math.abs(axis[i]) > Math.abs(axis[m]) ? i : m, 0), a = unit(axis[big] > 0 ? axis : scale(axis, -1));
  let e1: P3 = [1 - a[0] * a[0], -a[0] * a[1], -a[0] * a[2]];
  if (len(e1) < 0.5) e1 = [-a[1] * a[0], 1 - a[1] * a[1], -a[1] * a[2]];
  e1 = unit(e1); return { a, e1, e2: cross(a, e1) };
}
/** x in [−π, π). */
const wrap = (x: number) => ((x + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;
function to2(f: { surf: Surf }, x: P3, hint?: { p: XY }): XY {
  const s = f.surf;
  if (s.kind === 'plane') { const d = sub(x, s.o); return [dot(d, s.e1), dot(d, s.e2)]; }
  if (s.kind === 'nurbs') { const p = nurbsParam(s, x, hint); return [p[0] * s.ku, p[1] * s.kv]; }
  const d = sub(x, s.c), th = Math.atan2(dot(d, s.e2), dot(d, s.e1));
  return [s.s * s.r * (s.ref + wrap(th - s.ref)), dot(d, s.a)];
}
function to3(f: { surf: Surf }, p: XY): P3 {
  const s = f.surf;
  if (s.kind === 'plane') return add(s.o, add(scale(s.e1, p[0]), scale(s.e2, p[1])));
  if (s.kind === 'nurbs') return s.ev(Math.min(s.U[1], Math.max(s.U[0], p[0] / s.ku)), Math.min(s.V[1], Math.max(s.V[0], p[1] / s.kv)));
  const th = p[0] / (s.s * s.r);
  return add(add(s.c, scale(s.a, p[1])), add(scale(s.e1, s.r * Math.cos(th)), scale(s.e2, s.r * Math.sin(th))));
}
/**
 * A patch continued past its domain by its tangent plane at the nearest domain point (C¹ across the
 * edge, so Newton's method converges on points just outside; marching then stops at the edge itself).
 */
function to3Extended(f: { surf: Surf }, p: XY): P3 {
  const s = f.surf;
  if (s.kind !== 'nurbs') return to3(f, p);
  const u = p[0] / s.ku, v = p[1] / s.kv, cu = Math.min(s.U[1], Math.max(s.U[0], u)), cv = Math.min(s.V[1], Math.max(s.V[0], v));
  const x = s.ev(cu, cv);
  if (cu === u && cv === v) return x;
  const h = 1e-7, hu = h * (s.U[1] - s.U[0]), hv = h * (s.V[1] - s.V[0]), ia = cu + hu <= s.U[1] ? cu + hu : cu - hu, ib = cv + hv <= s.V[1] ? cv + hv : cv - hv;
  const Su = scale(sub(s.ev(ia, cv), x), 1 / (ia - cu)), Sv = scale(sub(s.ev(cu, ib), x), 1 / (ib - cv));
  return add(x, add(scale(Su, u - cu), scale(Sv, v - cv)));
}
/** Outward normal of the face's material at x. */
function normalOut(f: GFace, x: P3): P3 {
  const s = f.surf;
  if (s.kind === 'plane') return scale(s.n, f.out);
  if (s.kind === 'nurbs') return scale(nurbsNormal(s, nurbsParam(s, x)), s.sense * f.out);
  const d = sub(x, s.c), radial = unit(sub(d, scale(s.a, dot(d, s.a))));
  return scale(radial, s.s * f.out);
}

function surfaceOf(face: BrepFace, tol: number): Surf {
  const S = face.surface, sign = face.sense === 'forward' ? 1 : -1, [u0, u1] = surfaceDomain(S).u, [v0, v1] = surfaceDomain(S).v;
  const centre = evaluateSurface(S, (u0 + u1) / 2, (v0 + v1) / 2), du = 1e-6 * (u1 - u0), dv = 1e-6 * (v1 - v0);
  const nParam = unit(cross(sub(evaluateSurface(S, (u0 + u1) / 2 + du, (v0 + v1) / 2), centre), sub(evaluateSurface(S, (u0 + u1) / 2, (v0 + v1) / 2 + dv), centre)));
  const outward = scale(nParam, sign);
  if (S.degreeU === 1 && S.degreeV === 1 && S.controlPoints.length === 2 && S.controlPoints[0].length === 2) {
    // (The normal from the corners, ∂u × ∂v at the centre: a difference quotient over a sliver's width loses
    // digits, and a tilted plane no longer closes the shell.)
    const [[p00, p01], [p10, p11]] = S.controlPoints as P3[][], e1 = unit(sub(p10, p00));
    const n = scale(unit(cross(add(sub(p10, p00), sub(p11, p01)), add(sub(p01, p00), sub(p11, p10)))), sign), e2 = cross(n, e1);
    if (Math.abs(dot(sub(p11, p00), n)) > tol) throw new BrepError('GEOMETRY', `analytic Boolean: face ${face.id} is a twisted bilinear patch`);
    return { kind: 'plane', o: p00, n, e1, e2: unit(e2) };
  }
  if (S.degreeV === 1 && S.controlPoints[0]?.length === 2) {
    const base: Curve = { kind: 'curve', id: 'base', degree: S.degreeU, knots: S.knotsU, controlPoints: S.controlPoints.map(r => r[0]), weights: S.weights.map(w => w[0]) };
    const circle = circleOf(base);
    const axis = sub(S.controlPoints[0][1] as P3, S.controlPoints[0][0] as P3);
    // An extrusion only when every row moves by the same vector (a loft between circles is not one).
    const translate = S.controlPoints.every((r, i) => len(sub(sub(r[1] as P3, r[0] as P3), axis)) <= tol && S.weights[i][0] === S.weights[i][1]);
    if (circle && len(axis) > 0 && translate) {
      const { a, e1, e2 } = canonicalFrame(axis), cplane = unit(cross(sub(base.controlPoints[0] as P3, circle.c), sub(base.controlPoints[2] as P3, circle.c)));
      // A circle swept along its axis is a cylinder; any other sweep (a cone, an oblique extrusion) is general.
      if (Math.abs(Math.abs(dot(cplane, a)) - 1) > 1e-9) return nurbsOf(S, sign as 1 | -1);
      const d = sub(centre, circle.c), radial = unit(sub(d, scale(a, dot(d, a))));
      return { kind: 'cylinder', c: circle.c, a, e1, e2, r: circle.r, s: dot(outward, radial) > 0 ? 1 : -1, ref: Math.atan2(dot(d, e2), dot(d, e1)) };
    }
  }
  return nurbsOf(S, sign as 1 | -1);
}

/** A B-rep edge (oriented by a coedge) as a 3D line or arc. */
function curve3(c: Curve, forward: boolean): Curve3 {
  const [t0, t1] = curveDomain(c), p = evaluateCurve(c, t0), q = evaluateCurve(c, t1);
  if (c.degree === 1 && c.controlPoints.length === 2) return forward ? { kind: 'line', p, q } : { kind: 'line', p: q, q: p };
  const k = circleOf(c);
  if (!k) { const at = curveEvaluator(c); return { kind: 'param', at, t0: forward ? t0 : t1, t1: forward ? t1 : t0 }; }
  // The turning direction from the circle's own frame (robust for a full turn, where start = end).
  const total = k.spans.reduce((s, x) => s + x.phi, 0), n = scale(cross(k.e1, k.e2), k.sign);
  const from = forward ? p : q;
  return { kind: 'arc', c: k.c, n: forward ? n : scale(n, -1), r: k.r, u: unit(sub(from, k.c)), sweep: total };
}
/** A 3D curve in a face's 2D domain. */
function curve2(f: { surf: Surf }, k: Curve3, tol: number, tag?: string): CurveSegment2 {
  const t = tag === undefined ? {} : { tag };
  const s = f.surf;
  // On a general surface every boundary is a curve in the domain; at a pole it takes the free
  // coordinate it arrives with (the pole is a whole side of the domain).
  if (s.kind === 'nurbs') {
    const at3 = k.kind === 'param' ? k.at : k.kind === 'line' ? (x: number) => add(k.p, scale(sub(k.q, k.p), x)) : (x: number) => arcAt(k, x);
    const t0 = k.kind === 'param' ? k.t0 : 0, t1 = k.kind === 'param' ? k.t1 : k.kind === 'line' ? 1 : k.sweep, span = t1 - t0;
    // Projections warm-start from this curve's last one (nearby: searches along a curve are local).
    const hint = { p: nurbsParam(s, at3((t0 + t1) / 2)) };
    const g = (x: number): XY => {
      const P = at3(x), q = s.poles.find(o => len(sub(P, o.point)) <= 1e-9 * (s.size + 1));
      if (!q) return to2(f, P, hint);
      // The limit along the curve: extrapolated from two points a little inside it.
      const toward = Math.abs(x - t0) < Math.abs(x - t1) ? 1 : -1, n1 = to2(f, at3(x + toward * 1e-3 * span), hint), n2 = to2(f, at3(x + toward * 2e-3 * span), hint);
      return q.along === 0 ? [2 * n1[0] - n2[0], q.at] : [q.at, 2 * n1[1] - n2[1]];
    };
    return { kind: 'curve', f: tabulated(s, g, at3, t0, t1), t0, t1, src: at3, ...t, ...(k.kind !== 'param' || k.exact ? { exact: true } : {}) } as CurveSegment2;
  }
  if (k.kind === 'param') return { kind: 'curve', f: memo(x => to2(f, k.at(x))), t0: k.t0, t1: k.t1, src: k.at, ...t };
  if (k.kind === 'line') {
    const a = to2(f, k.p), b = to2(f, k.q);
    if (s.kind === 'cylinder' && Math.abs(a[0] - b[0]) > Math.max(tol, 1e-9 * s.r)) throw new BrepError('GEOMETRY', 'analytic Boolean: a straight edge on a cylinder runs across its axis direction');
    return { kind: 'line', a, b: s.kind === 'cylinder' ? [a[0], b[1]] : b, ...t };
  }
  const start = arcAt(k, 0);
  if (s.kind === 'plane') {
    const c2 = to2(f, k.c), a = to2(f, start), turn = dot(k.n, s.n);
    if (Math.abs(Math.abs(turn) - 1) > 1e-9) throw new BrepError('GEOMETRY', 'analytic Boolean: an arc does not lie in its plane');
    return { kind: 'arc', c: c2, r: k.r, t0: Math.atan2(a[1] - c2[1], a[0] - c2[0]), sweep: k.sweep * Math.sign(turn), ...t };
  }
  const along = dot(k.n, s.a);
  if (Math.abs(Math.abs(along) - 1) > 1e-9) throw new BrepError('GEOMETRY', 'analytic Boolean: an arc on a cylinder is not a cross-section circle');
  const a = to2(f, start);
  return { kind: 'line', a, b: [a[0] + s.s * s.r * k.sweep * Math.sign(along), a[1]], ...t };
}
/**
 * A curve's map into a general patch's domain, tabulated once at 129 exact projections with exact
 * derivatives (the surface Jacobian's pseudo-inverse applied to the curve's tangent) and evaluated by
 * cubic Hermite interpolation: about (span / 128)⁴ off, far below tolerance, where every exact
 * evaluation would cost a Newton projection. Curves through a pole (a singular map) stay exact.
 */
function tabulated(s: Nurbs, g: (x: number) => XY, at3: (x: number) => P3, t0: number, t1: number): (x: number) => XY {
  const exact = memo(g), N = 128, span = t1 - t0;
  let table: { p: XY[]; d: XY[] } | null | false = null;
  const build = () => {
    const p: XY[] = [], d: (XY | null)[] = [];
    for (let i = 0; i <= N; i++) {
      const x = t0 + span * i / N, q = exact(x), P = at3(x);
      p.push(q);
      // At a pole the map's derivative comes from the neighbouring samples (below).
      if (s.poles.some(o => len(sub(P, o.point)) <= 1e-6 * (s.size + 1))) { d.push(null); continue; }
      const h = 1e-6 * span, xa = Math.max(Math.min(t0, t1), Math.min(Math.max(t0, t1), x - h)), xb = Math.max(Math.min(t0, t1), Math.min(Math.max(t0, t1), x + h));
      const dP = scale(sub(at3(xb), at3(xa)), 1 / (xb - xa));
      const u = q[0] / s.ku, v = q[1] / s.kv, hu = 1e-7 * (s.U[1] - s.U[0]), hv = 1e-7 * (s.V[1] - s.V[0]);
      const ua = u + hu <= s.U[1] ? u + hu : u - hu, va = v + hv <= s.V[1] ? v + hv : v - hv, Q = s.ev(u, v);
      const Su = scale(sub(s.ev(ua, v), Q), 1 / (ua - u)), Sv = scale(sub(s.ev(u, va), Q), 1 / (va - v));
      const g11 = dot(Su, Su), g12 = dot(Su, Sv), g22 = dot(Sv, Sv), det = g11 * g22 - g12 * g12, r1 = dot(Su, dP), r2 = dot(Sv, dP);
      if (!(det > 1e-24 * (g11 + g22) ** 2)) { d.push(null); continue; }
      d.push([(r1 * g22 - r2 * g12) / det * s.ku, (g11 * r2 - g12 * r1) / det * s.kv]);
    }
    // Second-order one-sided (or central) differences where the Jacobian is singular.
    const h = span / N, out: XY[] = [];
    for (let i = 0; i <= N; i++) {
      const di = d[i]; if (di) { out.push(di); continue; }
      const diff = (a: XY, b: XY, c: XY, k: number): XY => [(-3 * a[0] + 4 * b[0] - c[0]) / (2 * h * k), (-3 * a[1] + 4 * b[1] - c[1]) / (2 * h * k)];
      if (i + 2 <= N && (i === 0 || i < N / 2)) out.push(diff(p[i], p[i + 1], p[i + 2], 1));
      else if (i - 2 >= 0) out.push(diff(p[i], p[i - 1], p[i - 2], -1));
      else return false;
    }
    return { p, d: out };
  };
  return x => {
    if (table === null) table = build();
    if (table === false || !(span !== 0)) return exact(x);
    const f = (x - t0) / span * N, i = Math.min(N - 1, Math.max(0, Math.floor(f))), u = f - i;
    if (u === 0) return table.p[i];
    if (i === N - 1 && u === 1) return table.p[N];
    const u2 = u * u, u3 = u2 * u, h = span / N, a = table.p[i], b = table.p[i + 1], da = table.d[i], db = table.d[i + 1];
    const h00 = 2 * u3 - 3 * u2 + 1, h10 = (u3 - 2 * u2 + u) * h, h01 = -2 * u3 + 3 * u2, h11 = (u3 - u2) * h;
    return [a[0] * h00 + da[0] * h10 + b[0] * h01 + db[0] * h11, a[1] * h00 + da[1] * h10 + b[1] * h01 + db[1] * h11];
  };
}
/** A curve's domain map, remembered per parameter (each one costs a surface projection on a general surface). */
function memo(g: (x: number) => XY): (x: number) => XY {
  const seen = new Map<number, XY>();
  return x => { let r = seen.get(x); if (!r) { r = g(x); if (seen.size < 1 << 16) seen.set(x, r); } return r; };
}
/** A 2D segment of a face's domain as a 3D curve. */
function curve3Of(f: { surf: Surf }, g: CurveSegment2): Curve3 {
  const s = f.surf;
  if (g.kind === 'curve') { const src = g.src as ((t: number) => P3) | undefined; return { kind: 'param', at: src ?? (x => to3(f, g.f(x))), t0: g.t0, t1: g.t1, ...(src && (g as { exact?: boolean }).exact ? { exact: true } : {}) }; }
  if (s.kind === 'nurbs') { const seg = g; return { kind: 'param', at: x => to3(f, segAtAny(seg, x)), t0: 0, t1: 1 }; }
  if (s.kind === 'plane') {
    if (g.kind === 'line') return { kind: 'line', p: to3(f, g.a), q: to3(f, g.b) };
    return { kind: 'arc', c: to3(f, g.c), n: scale(s.n, Math.sign(g.sweep)), r: g.r, u: unit(add(scale(s.e1, Math.cos(g.t0)), scale(s.e2, Math.sin(g.t0)))), sweep: Math.abs(g.sweep) };
  }
  if (g.kind !== 'line') throw new BrepError('GEOMETRY', 'analytic Boolean: a curved segment in a cylinder domain');
  // Cylinder boundaries are horizontal (cross-section arcs) or vertical (generators) in (U, V); vertices
  // merged within tolerance can tilt them slightly, so the dominant direction decides.
  if (Math.abs(g.b[0] - g.a[0]) > Math.abs(g.b[1] - g.a[1])) {
    const th0 = g.a[0] / (s.s * s.r), th1 = g.b[0] / (s.s * s.r), c = add(s.c, scale(s.a, (g.a[1] + g.b[1]) / 2));
    return { kind: 'arc', c, n: scale(s.a, Math.sign(th1 - th0)), r: s.r, u: unit(add(scale(s.e1, Math.cos(th0)), scale(s.e2, Math.sin(th0)))), sweep: Math.abs(th1 - th0) };
  }
  const u = (g.a[0] + g.b[0]) / 2;
  return { kind: 'line', p: to3(f, [u, g.a[1]]), q: to3(f, [u, g.b[1]]) };
}

function facesOf(brep: Brep, solid: 0 | 1, tol: number): GFace[] {
  const edges = new Map(brep.edges.map(e => [e.id, e])), coedges = new Map(brep.coedges.map(c => [c.id, c])), loops = new Map(brep.loops.map(l => [l.id, l]));
  return brep.faces.map(face => {
    const surf = surfaceOf(face, tol), g = { surf };
    const outer = face.loops.find(l => loops.get(l)!.kind === 'outer')!, ordered = [outer, ...face.loops.filter(l => l !== outer)];
    // A full-turn wall uses its seam (a generator) twice. Its domain is centred opposite the seam, so the
    // seam lies on both domain edges: the coedge going up (V increasing) on the right, down on the left
    // (loops run counter-clockwise in the domain), and curves leaving the seam start on the side they run into.
    const seam = new Set<string>();
    if (surf.kind === 'cylinder') for (const lid of ordered) { const used = loops.get(lid)!.coedges.map(cid => coedges.get(cid)!.edge); for (const e of used) if (used.indexOf(e) !== used.lastIndexOf(e)) seam.add(e); }
    if (surf.kind === 'cylinder' && seam.size) {
      const e = edges.get([...seam][0])!, d = sub(evaluateCurve(e.curve, curveDomain(e.curve)[0]), surf.c);
      surf.ref = Math.atan2(dot(d, surf.e2), dot(d, surf.e1)) + Math.PI;
    }
    const window = surf.kind === 'cylinder' ? [surf.s * surf.r * (surf.ref - Math.PI), surf.s * surf.r * (surf.ref + Math.PI)].sort((a, b) => a - b) : [0, 0];
    const onSeam = (u: number) => seam.size > 0 && (Math.abs(u - window[0]) <= tol || Math.abs(u - window[1]) <= tol);
    const map = (k: Curve3, edge: string): CurveSegment2 => {
      const g2 = curve2(g, k, tol);
      if (!seam.size) return g2;
      if (seam.has(edge) && g2.kind === 'line') { const u = g2.b[1] > g2.a[1] ? window[1] : window[0]; return { ...g2, a: [u, g2.a[1]], b: [u, g2.b[1]] }; }
      if (g2.kind === 'line' && onSeam(g2.a[0]) && (g2.b[0] < window[0] - tol || g2.b[0] > window[1] + tol)) {
        const shift = g2.b[0] > window[1] ? -(window[1] - window[0]) : window[1] - window[0];
        return { ...g2, a: [g2.a[0] + shift, g2.a[1]], b: [g2.b[0] + shift, g2.b[1]] };
      }
      if (g2.kind === 'curve') {
        // Points on the seam take the side of their neighbours along the curve.
        const f0 = g2.f, span = g2.t1 - g2.t0;
        return { ...g2, f: t => { const q = f0(t); if (!onSeam(q[0])) return q; const n = f0(t + (t - g2.t0 < span / 2 ? 1 : -1) * 1e-4 * span); return [Math.abs(n[0] - window[0]) < Math.abs(n[0] - window[1]) ? window[0] : window[1], q[1]]; } };
      }
      return g2;
    };
    let rings = ordered.map(lid => loops.get(lid)!.coedges.map(cid => { const c = coedges.get(cid)!; return map(curve3(edges.get(c.edge)!.curve, c.sense === 'forward'), c.edge); }));
    // A loop through a pole jumps along that side of the domain: the side joins the two ends.
    if (surf.kind === 'nurbs' && surf.poles.length) rings = rings.map(ring => ring.flatMap((seg, i) => {
      const a = segAtAny(seg, 1), b = segAtAny(ring[(i + 1) % ring.length], 0);
      return Math.hypot(a[0] - b[0], a[1] - b[1]) > tol ? [seg, { kind: 'line' as const, a, b }] : [seg];
    }));
    const min: P3 = [Infinity, Infinity, Infinity], max: P3 = [-Infinity, -Infinity, -Infinity];
    for (const lid of ordered) for (const cid of loops.get(lid)!.coedges) for (const p of edges.get(coedges.get(cid)!.edge)!.curve.controlPoints) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]); }
    // A general patch bulges past its edges (a hemisphere bounded by two meridians in one plane): its
    // control net bounds it.
    if (surf.kind === 'nurbs') for (const row of face.surface.controlPoints) for (const p of row) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]); }
    return { solid, surf, region: { outer: rings[0], holes: rings.slice(1) }, out: 1 as const, min, max, ...(face.name === undefined ? {} : { name: baseName(face.name) }), cuts: [] };
  });
}

/** One root of a crossing-cylinder quadratic as a curve in the smaller cylinder's angle. */
const branchOf = (point: (th: number, sign: number) => P3, sign: number) => (th: number) => point(th, sign);

// ---- intersections ---------------------------------------------------------------------------------
/** Parameter intervals of a curve (line: t along d from p; circle: φ from the frame's e1) inside a face. */
type Probe = { kind: 'line'; p: P3; d: P3; lo: number; hi: number } | { kind: 'circle'; c: P3; n: P3; e1: P3; r: number; lo: number } | { kind: 'param'; at: (t: number) => P3; lo: number; hi: number };
function intervals(f: GFace, k: Probe, tol: number, strict = false): [number, number][] {
  const params: number[] = [];
  let probe: CurveSegment2[], param: (x: P3) => number, at: (t: number) => P3;
  if (k.kind === 'param') {
    at = k.at;
    // In a cylinder domain the curve is cut where it crosses the domain's seam (θ = ref ± π), so each
    // piece maps continuously.
    const ranges: [number, number][] = [];
    if (f.surf.kind === 'cylinder') {
      const n = 256, U = (t: number) => to2(f, at(t))[0], jump = Math.PI * f.surf.r;
      let start = k.lo, prev = U(k.lo);
      for (let i = 1; i <= n; i++) {
        let t = k.lo + (k.hi - k.lo) * i / n; const u = U(t);
        if (Math.abs(u - prev) > jump) {
          let a = k.lo + (k.hi - k.lo) * (i - 1) / n, b = t; const ua = U(a);
          for (let it = 0; it < 60; it++) { const m = (a + b) / 2; if (Math.abs(U(m) - ua) > jump) b = m; else a = m; }
          ranges.push([start, a]); start = b; t = b;
        }
        prev = U(t);
      }
      ranges.push([start, k.hi]);
    } else ranges.push([k.lo, k.hi]);
    // (On a general face the probe's domain map is tabulated like any curve's.)
    const pieces = ranges.map(([a, b]) => f.surf.kind === 'nurbs' ? { ...(curve2(f, { kind: 'param', at, t0: a, t1: b }, tol) as Extract<CurveSegment2, { kind: 'curve' }>), t0: a, t1: b } : { kind: 'curve' as const, f: (x: number) => to2(f, at(x)), t0: a, t1: b });
    params.push(...ranges.flat());
    const rings = [f.region.outer, ...f.region.holes];
    for (const pr of pieces) for (const ring of rings) for (const g of ring) for (const x of intersectSegments(pr, g, tol)) params.push(pr.t0 + (pr.t1 - pr.t0) * paramOfCurve(pr, x));
    return insideIntervals(f, params, at, tol, strict);
  }
  if (k.kind === 'line') {
    at = t => add(k.p, scale(k.d, t)); param = x => dot(sub(x, k.p), k.d) / dot(k.d, k.d);
    const a = to2(f, at(k.lo)), b = to2(f, at(k.hi));
    probe = [{ kind: 'line', a, b: f.surf.kind === 'cylinder' ? [a[0], b[1]] : b }];
    params.push(k.lo, k.hi);
  } else {
    const e2 = cross(k.n, k.e1); at = t => add(k.c, add(scale(k.e1, k.r * Math.cos(t)), scale(e2, k.r * Math.sin(t))));
    param = x => { const d = sub(x, k.c); let t = Math.atan2(dot(d, e2), dot(d, k.e1)); while (t < k.lo) t += TWO_PI; while (t >= k.lo + TWO_PI) t -= TWO_PI; return t; };
    // On a cylinder the probe's halves end a quarter turn either side of the face's centre: a point on
    // the domain's seam (θ = ref ± π) maps to either side of it, and a half starting there could land on
    // the wrong side whole (missing where the circle crosses the face).
    let s0 = k.lo;
    if (f.surf.kind === 'cylinder') { const c = f.surf; s0 = param(add(k.c, add(scale(c.e1, Math.cos(c.ref)), scale(c.e2, Math.sin(c.ref))))) - Math.PI / 2; }
    const norm = (t: number) => { while (t < k.lo) t += TWO_PI; while (t >= k.lo + TWO_PI) t -= TWO_PI; return t; };
    const arc: Curve3 = { kind: 'arc', c: k.c, n: k.n, r: k.r, u: unit(sub(at(s0), k.c)), sweep: Math.PI };
    const arc2: Curve3 = { ...arc, u: unit(sub(at(s0 + Math.PI), k.c)) };
    probe = [curve2(f, arc, tol), curve2(f, arc2, tol)];
    params.push(k.lo, norm(s0), norm(s0 + Math.PI), k.lo + TWO_PI);
  }
  const rings = [f.region.outer, ...f.region.holes];
  for (const pr of probe) for (const ring of rings) for (const g of ring) for (const x of intersectSegments(pr, g, tol)) params.push(param(to3(f, x)));
  return insideIntervals(f, params, at, tol);
}
/** Sorted parameters → the intervals between them whose middles lie in the face. */
function insideIntervals(f: GFace, params: number[], at: (t: number) => P3, tol: number, strict = false): [number, number][] {
  params.sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < params.length; i++) {
    const a = params[i], b = params[i + 1]; if (b - a <= 1e-12 * Math.max(1, Math.abs(a))) continue;
    const x = at((a + b) / 2);
    if (locateInRegion(to2(f, x), f.region, tol) === 'out') continue;
    // On a general patch a point off it projects onto its edge: only points on the patch count.
    if (strict && f.surf.kind === 'nurbs' && len(sub(to3(f, to2(f, x)), x)) > 10 * tol) continue;
    if (out.length && Math.abs(out[out.length - 1][1] - a) <= 1e-12 * Math.max(1, Math.abs(a))) out[out.length - 1][1] = b; else out.push([a, b]);
  }
  return out;
}
const overlaps = (A: [number, number][], B: [number, number][]) => A.flatMap(([a0, a1]) => B.flatMap(([b0, b1]) => { const lo = Math.max(a0, b0), hi = Math.min(a1, b1); return hi > lo ? [[lo, hi] as [number, number]] : []; }));
const boxesMeet = (f: GFace, g: GFace, tol: number) => [0, 1, 2].every(k => f.min[k] <= g.max[k] + tol && g.min[k] <= f.max[k] + tol);

class Refused extends BrepError { constructor(detail: string) { super('GEOMETRY', 'analytic Boolean: ' + detail); } }

function cutPair(fa: GFace, fb: GFace, tol: number, span: number): void {
  const addCut = (k: Curve3) => { fa.cuts.push(curve2(fa, k, tol)); fb.cuts.push(curve2(fb, k, tol)); };
  const lineCuts = (p: P3, d: P3) => {
    for (const [lo, hi] of overlaps(intervals(fa, { kind: 'line', p, d, lo: -span, hi: span }, tol), intervals(fb, { kind: 'line', p, d, lo: -span, hi: span }, tol)))
      if ((hi - lo) * len(d) > tol) addCut({ kind: 'line', p: add(p, scale(d, lo)), q: add(p, scale(d, hi)) });
  };
  const circleCuts = (c: P3, n: P3, e1: P3, r: number, lo: number) => {
    const k = { kind: 'circle' as const, c, n, e1, r, lo };
    for (const [a, b] of overlaps(intervals(fa, k, tol), intervals(fb, k, tol))) if ((b - a) * r > tol) {
      const e2 = cross(n, e1), u = unit(add(scale(e1, Math.cos(a)), scale(e2, Math.sin(a))));
      addCut({ kind: 'arc', c, n, r, u, sweep: b - a });
    }
  };
  const paramCuts = (at: (t: number) => P3, lo: number, hi: number) => {
    for (const [a, b] of overlaps(intervals(fa, { kind: 'param', at, lo, hi }, tol), intervals(fb, { kind: 'param', at, lo, hi }, tol)))
      if (len(sub(at(b), at(a))) > tol || b - a > 1e-6 * (hi - lo)) addCut({ kind: 'param', at, t0: a, t1: b });
  };
  const same = (g: GFace, into: GFace) => { for (const ring of [g.region.outer, ...g.region.holes]) for (const seg of ring) into.cuts.push(curve2(into, curve3Of(g, seg), tol)); };
  const A = fa.surf, B = fb.surf;
  // General surfaces (and degenerate cylinder pairs): march the intersection over both faces' domain
  // boxes, then clip as any curve.
  const march = (): void => {
    const box = (f: GFace): [XY, XY] => { const xs: number[] = [], ys: number[] = [];
      for (const ring of [f.region.outer, ...f.region.holes]) for (const g of ring) for (let i = 0; i <= 8; i++) { const q = segAtAny(g, i / 8); xs.push(q[0]); ys.push(q[1]); }
      const mx = (Math.max(...xs) - Math.min(...xs)) * 0.02 + tol, my = (Math.max(...ys) - Math.min(...ys)) * 0.02 + tol;
      const lo: XY = [Math.min(...xs) - mx, Math.min(...ys) - my], hi: XY = [Math.max(...xs) + mx, Math.max(...ys) + my], s = f.surf;
      // A patch ends at its domain: the march stops exactly there (its boundary is the face's edge).
      if (s.kind === 'nurbs') { const u = [s.U[0] * s.ku, s.U[1] * s.ku], v = [s.V[0] * s.kv, s.V[1] * s.kv];
        lo[0] = Math.max(lo[0], Math.min(...u)); hi[0] = Math.min(hi[0], Math.max(...u)); lo[1] = Math.max(lo[1], Math.min(...v)); hi[1] = Math.min(hi[1], Math.max(...v)); }
      return [lo, hi]; };
    const diag = Math.min(len(sub(fa.max, fa.min)), len(sub(fb.max, fb.min)));
    // Two general faces on one surface (a torus and its copy turned about its axis) meet everywhere they
    // overlap: each face's boundary, where it runs inside the other face, cuts that face; nothing is marched.
    if (A.kind === 'nurbs' && B.kind === 'nurbs') {
      const onOther = (f: GFace, g: Nurbs) => {
        const [lo, hi] = box(f); let hits = 0;
        for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
          const x = to3(f, [lo[0] + (hi[0] - lo[0]) * (i + 0.5) / 5, lo[1] + (hi[1] - lo[1]) * (j + 0.5) / 5]), q = nurbsParam(g, x);
          const inner = q[0] > g.U[0] + 1e-9 * (g.U[1] - g.U[0]) && q[0] < g.U[1] - 1e-9 * (g.U[1] - g.U[0]) && q[1] > g.V[0] + 1e-9 * (g.V[1] - g.V[0]) && q[1] < g.V[1] - 1e-9 * (g.V[1] - g.V[0]);
          if (!inner) continue;
          if (len(sub(g.ev(q[0], q[1]), x)) > tol) return false;
          hits++;
        }
        return hits > 0;
      };
      if (onOther(fa, B) && onOther(fb, A)) {
        for (const [g, into] of [[fb, fa], [fa, fb]] as const) for (const ring of [g.region.outer, ...g.region.holes]) for (const seg of ring) {
          // (A boundary only partly on it, or along that face's own boundary, adds nothing.)
          const k = curve3Of(g, seg);
          if (![0, 0.1, 0.3, 0.5, 0.7, 0.9, 1].every(u => offSurface(into, pointOf(k, u), tol) <= tol)) continue;
          if ([0.25, 0.5, 0.75].every(u => locateInRegion(to2(into, pointOf(k, u)), into.region, 10 * tol) === 'boundary')) continue;
          into.cuts.push(curve2(into, k, tol));
        }
        return;
      }
    }
    // An edge of a general face lying on the other surface (a seam in a cutting plane) is part of the
    // intersection as it is: a cut of the other face; the march then skips seeds on it.
    const along: Curve3[] = [];
    for (const [f, g] of [[fa, fb], [fb, fa]] as const) if (f.surf.kind === 'nurbs') for (const ring of [f.region.outer, ...f.region.holes]) for (const seg of ring) {
      const k = exactly(curve3Of(f, seg), tol);
      if ([0, 0.2, 0.4, 0.6, 0.8, 1].every(u => offSurface(g, pointOf(k, u), tol) <= tol)) { g.cuts.push(curve2(g, k, tol)); along.push(k); }
    }
    const alongWithin = (x: P3, r: number) => along.some(k => onCurve(k, x, r) !== null || len(sub(x, startOf(k))) <= r || len(sub(x, endOf(k))) <= r);
    const onAlong = (x: P3) => alongWithin(x, 10 * tol);
    const PA = { at: (p: XY) => to3Extended(fa, p), box: box(fa) }, PB = { at: (p: XY) => to3Extended(fb, p), box: box(fb) };
    let chains;
    // Ends of curves already found on either face (from their other neighbours) that lie on both surfaces.
    const given = [fa, fb].flatMap(f => f.cuts.flatMap(g => [0, 1].map(u => to3(f, segAtAny(g, u))))).filter(x => offSurface(fa, x, 100 * tol) <= 100 * tol && offSurface(fb, x, 100 * tol) <= 100 * tol);
    try { chains = intersectPatches(PA, PB, { step: Math.max(diag / 80, 50 * tol), tolerance: 100 * tol, ...(along.length ? { skip: onAlong, skipNear: alongWithin } : {}), ...(given.length ? { seeds: given } : {}) }); }
    catch (e) { if (e instanceof SurfaceIntersectionError) throw new Refused(`the surfaces of ${fa.name ?? 'a face'} and ${fb.name ?? 'a face'} meet along a curve that cannot be traced (${e.message.replace(/^Surface intersection: /, '')})`); throw e; }
    for (const chain of chains) {
      // A chain running along such an edge is that edge again.
      if (along.length && chain.points.every(onAlong)) continue;
      paramCuts(chainCurve(chain, { A: PA, B: PB }), 0, 1);
    }
  };
  // Surfaces of revolution (cones, spheres, tori) meeting a plane square to their axis or through it,
  // a sphere meeting any plane, and coaxial ones meeting each other: exact circles, lines and arcs.
  /** Whether the meridian point (ρ, h) is at an end of a patch's profile. */
  function atProfileEdge(R: Revolution, rho: number, h: number): boolean {
    if (!R.patch) return false;
    const pr = R.profile, P = R.patch;
    if (pr.kind === 'line') { const L = Math.hypot(pr.q[0] - pr.p[0], pr.q[1] - pr.p[1]), s = ((rho - pr.p[0]) * (pr.q[0] - pr.p[0]) + (h - pr.p[1]) * (pr.q[1] - pr.p[1])) / (L * L); return Math.abs(s - P.s0) * L <= 10 * tol || Math.abs(s - P.s1) * L <= 10 * tol; }
    const a = Math.atan2(h - pr.c[1], rho - pr.c[0]), near = (x: number) => Math.abs(((a - x) % TWO_PI + 3 * Math.PI) % TWO_PI - Math.PI) * pr.r <= 10 * tol;
    return near(P.s0) || near(P.s1);
  }
  function revolutionCuts(): boolean {
    const revOf = (S: Surf): Revolution | null => S.kind === 'cylinder' ? { c: S.c, a: S.a, e1: S.e1, e2: S.e2, profile: { kind: 'line', p: [S.r, -span], q: [S.r, span] } } : S.kind === 'nurbs' ? (S.rev === undefined ? (S.rev = revolutionOf(S.S, S.size + 1)) : S.rev) : null;
    // A curve's parameter ranges on both patches of revolution (off a patch its map into the domain
    // jumps); the faces' own intervals are found within them.
    const onPatches = (at: (t: number) => P3, lo: number, hi: number): [number, number][] => {
      const revs = [A, B].map(S => S.kind === 'nurbs' ? S.rev : null).filter((x): x is Revolution => !!x && !!x.patch);
      const inside = (t: number) => revs.every(R => onPatch(R, at(t), 1e-12));
      const N = 256, out: [number, number][] = []; let start: number | null = inside(lo) ? lo : null, prev = start !== null;
      for (let i = 1; i <= N; i++) {
        const t = lo + (hi - lo) * i / N, now = inside(t);
        if (now !== prev) { let a = lo + (hi - lo) * (i - 1) / N, b = t; for (let k = 0; k < 60; k++) { const m = (a + b) / 2; if (inside(m) === prev) a = m; else b = m; } const x = (a + b) / 2; if (now) start = x; else { out.push([start!, x]); start = null; } }
        prev = now;
      }
      if (start !== null) out.push([start, hi]);
      return out.filter(([a, b]) => b - a > 1e-9 * Math.max(1, hi - lo));
    };
    const piece = (at: (t: number) => P3, lo: number, hi: number, make: (a: number, b: number) => Curve3) => {
      for (const [l, h] of onPatches(at, lo, hi)) for (const [a, b] of overlaps(intervals(fa, { kind: 'param', at, lo: l, hi: h }, tol, true), intervals(fb, { kind: 'param', at, lo: l, hi: h }, tol, true))) if (len(sub(at(b), at(a))) > tol || b - a > 1e-6) addCut(make(a, b));
    };
    const arcAround = (centre: P3, n: P3, e1: P3, r: number) => {
      if (r <= tol) return;
      const e2 = cross(n, e1), at = (t: number) => add(centre, add(scale(e1, r * Math.cos(t)), scale(e2, r * Math.sin(t))));
      piece(at, 0, TWO_PI, (a, b) => ({ kind: 'arc', c: centre, n, r, u: unit(sub(at(a), centre)), sweep: b - a }));
    };
    const circle = (centre: P3, n: P3, r: number) => arcAround(centre, n, unit(Math.abs(n[0]) < 0.9 ? cross([1, 0, 0], n) : cross([0, 1, 0], n)), r);
    // A face's own edges lying on the other surface are cuts of the other (as the general path has it).
    const edgesOn = (g: GFace, into: GFace) => {
      for (const ring of [g.region.outer, ...g.region.holes]) for (const seg of ring) {
        const k = exactly(curve3Of(g, seg), tol);
        if (![0, 0.2, 0.4, 0.6, 0.8, 1].every(u => offSurface(into, pointOf(k, u), tol) <= tol)) continue;
        if ([0.25, 0.5, 0.75].every(u => locateInRegion(to2(into, pointOf(k, u)), into.region, 10 * tol) === 'boundary')) continue;
        into.cuts.push(curve2(into, k, tol));
      }
    };
    const withPlane = (P: Plane, R: Revolution): boolean => {
      const fp = P === A ? fa : fb, fr = P === A ? fb : fa;
      const along = dot(P.n, R.a);
      const reach = Math.max(...(R.profile.kind === 'line' ? [R.profile.p[0], R.profile.q[0]] : [R.profile.c[0] + R.profile.r]), tol);
      if (Math.sqrt(Math.max(0, 1 - along * along)) * reach <= tol) {
        // Square to the axis: circles where the profile reaches the plane's height.
        const h0 = dot(sub(P.o, R.c), R.a), pr = R.profile;
        // (A circle where the profile only touches the plane — a fillet's tangent edge — is no cut.)
        const rs = pr.kind === 'line' ? (Math.abs(pr.q[1] - pr.p[1]) < 1e-12 ? [] : [pr.p[0] + (pr.q[0] - pr.p[0]) * (h0 - pr.p[1]) / (pr.q[1] - pr.p[1])])
          : (() => { const dh = h0 - pr.c[1], w = pr.r * pr.r - dh * dh; return w <= 4 * tol * pr.r ? [] : [pr.c[0] - Math.sqrt(w), pr.c[0] + Math.sqrt(w)]; })();
        // A circle along the patch's own edge (its rim in the plane): that edge is the cut.
        if (rs.some(r => atProfileEdge(R, r, h0))) edgesOn(fr, fp);
        for (const r of rs) if (r > tol && !atProfileEdge(R, r, h0)) circle(add(R.c, scale(R.a, h0)), R.a, r);
        return true;
      }
      const dAxis = dot(sub(R.c, P.o), P.n);
      if (Math.abs(along) <= 1e-9 && Math.abs(dAxis) <= tol) {
        // Through the axis: the profile on the two meridians in the plane.
        const m0 = unit(cross(R.a, P.n)), pr = R.profile;
        // A meridian along a patch's own edge (a seam in the cutting plane) is left to the general path.
        const edgeAngle = (S: Surf) => { if (S.kind !== 'nurbs' || !S.rev?.patch) return false; const pa = S.rev.patch, th = (m: P3) => Math.atan2(dot(m, S.rev!.e2), dot(m, S.rev!.e1)), near = (x: number, y: number) => Math.abs(((x - y) % TWO_PI + 3 * Math.PI) % TWO_PI - Math.PI) < 1e-9; return [m0, scale(m0, -1)].some(m => near(th(m), pa.th0) || near(th(m), pa.th0 + pa.span)); };
        if (edgeAngle(A) || edgeAngle(B)) return false;
        for (const m of [m0, scale(m0, -1)]) {
          const pt = (rho: number, h: number): P3 => add(R.c, add(scale(R.a, h), scale(m, rho)));
          if (pr.kind === 'line') { const at = (t: number) => pt(pr.p[0] + (pr.q[0] - pr.p[0]) * t, pr.p[1] + (pr.q[1] - pr.p[1]) * t); piece(at, -0.01, 1.01, (a, b) => ({ kind: 'line', p: at(a), q: at(b) })); }
          else {
            // The arc in the plane: about its centre, CCW about the normal m × a.
            arcAround(pt(pr.c[0], pr.c[1]), unit(cross(m, R.a)), m, pr.r);
          }
        }
        return true;
      }
      // A cone (a line profile) and any other plane: a conic, at angle θ the height where the ruling
      // meets the plane — n·(c + a h + e(θ)(ρ₀ + k h)) = d, linear in h.
      const pr = R.profile;
      if (pr.kind === 'line' && R.patch) {
        const dh = pr.q[1] - pr.p[1];
        if (Math.abs(dh) > 1e-12) {
          const k = (pr.q[0] - pr.p[0]) / dh, rho0 = pr.p[0] - k * pr.p[1], d = dot(P.n, P.o) - dot(P.n, R.c), na = dot(P.n, R.a);
          // Through the apex the plane meets the cone in rulings, not a curve in θ: the general path.
          if (Math.abs(k) > 1e-12 && Math.abs(dot(sub(add(R.c, scale(R.a, -rho0 / k)), P.o), P.n)) <= 10 * tol) return false;
          // Parallel to the axis a cylinder's plane meets it in rulings too.
          if (Math.abs(k) <= 1e-12 && Math.abs(na) <= 1e-9) return false;
          const at = (th: number): P3 => {
            const e = add(scale(R.e1, Math.cos(th)), scale(R.e2, Math.sin(th))), ne = dot(P.n, e), den = na + k * ne;
            if (Math.abs(den) < 1e-12) return [Infinity, Infinity, Infinity];
            const h = (d - rho0 * ne) / den; return add(R.c, add(scale(R.a, h), scale(e, rho0 + k * h)));
          };
          const th0 = R.patch.th0;
          for (const [l, h] of onPatches(at, th0 - 1e-9, th0 + R.patch.span + 1e-9))
            for (const [a, b] of overlaps(intervals(fa, { kind: 'param', at, lo: l, hi: h }, tol, true), intervals(fb, { kind: 'param', at, lo: l, hi: h }, tol, true)))
              if (len(sub(at(b), at(a))) > tol) addCut({ kind: 'param', at, t0: a, t1: b, exact: true });
          return true;
        }
      }
      // A sphere and any plane: a circle.
      if (R.profile.kind === 'arc' && Math.abs(R.profile.c[0]) <= tol) {
        const C = add(R.c, scale(R.a, R.profile.c[1])), d = dot(sub(C, P.o), P.n), w = R.profile.r ** 2 - d * d;
        if (w > tol * tol) circle(sub(C, scale(P.n, d)), P.n, Math.sqrt(w));
        return true;
      }
      return false;
    };
    const RA = revOf(A), RB = revOf(B);
    if (A.kind === 'plane' && RB) return withPlane(A, RB);
    if (B.kind === 'plane' && RA) return withPlane(B, RA);
    if (RA && RB && len(cross(RA.a, RB.a)) <= 1e-12 && len(cross(sub(RB.c, RA.c), RA.a)) <= tol) {
      // Coaxial: circles where the profiles cross (B's profile in A's meridian coordinates).
      const flip = dot(RA.a, RB.a) < 0 ? -1 : 1, dh = dot(sub(RB.c, RA.c), RA.a), mapB = (p: [number, number]): [number, number] => [p[0], dh + flip * p[1]];
      const pb = RB.profile.kind === 'line' ? { kind: 'line' as const, p: mapB(RB.profile.p), q: mapB(RB.profile.q) } : { kind: 'arc' as const, c: mapB(RB.profile.c), r: RB.profile.r };
      if (pb.kind === RA.profile.kind && (pb.kind === 'arc' ? Math.hypot(pb.c[0] - (RA.profile as typeof pb).c[0], pb.c[1] - (RA.profile as typeof pb).c[1]) <= tol && Math.abs(pb.r - (RA.profile as typeof pb).r) <= tol : false)) return false;
      const crossings = profileCrossings(RA.profile, pb, tol), edge = ([rho, h]: [number, number]) => atProfileEdge(RA, rho, h) || atProfileEdge(RB, rho, (h - dh) * flip);
      if (crossings.some(edge)) { edgesOn(fa, fb); edgesOn(fb, fa); }
      for (const c of crossings) if (!edge(c)) circle(add(RA.c, scale(RA.a, c[1])), RA.a, c[0]);
      return true;
    }
    return false;
  }
  if ((A.kind === 'nurbs' || B.kind === 'nurbs') && revolutionCuts()) return;
  if (A.kind === 'nurbs' || B.kind === 'nurbs') { march(); return; }
  if (A.kind === 'plane' && B.kind === 'plane') {
    const D = cross(A.n, B.n);
    if (len(D) < 1e-12) { if (Math.abs(dot(A.n, sub(B.o, A.o))) <= tol) { same(fb, fa); same(fa, fb); } return; }
    const det = dot(D, D), da = dot(A.n, A.o), db = dot(B.n, B.o);
    lineCuts(scale(add(scale(cross(B.n, D), da), scale(cross(D, A.n), db)), 1 / det), unit(D));
    return;
  }
  if (A.kind === 'cylinder' && B.kind === 'cylinder') {
    if (len(cross(A.a, B.a)) > 1e-9) {
      // Crossing axes: apart, or a quartic. On the smaller cylinder S at angle θ, the points along its
      // axis on the larger cylinder L solve a quadratic in the axial coordinate; when it has two roots
      // for every θ, the curve is two closed branches.
      const w = cross(A.a, B.a), gap = Math.abs(dot(sub(B.c, A.c), unit(w)));
      if (gap >= A.r + B.r - tol) return;
      if (Math.abs(A.r - B.r) <= tol && gap <= tol) {
        // Equal radii, axes meeting at O (two fillets meeting in a mitre): the points equally far from both
        // axes lie on the planes through O normal to a₁ − a₂ and a₁ + a₂ — two ellipses, on either cylinder.
        const d = sub(B.c, A.c), k = dot(A.a, B.a), sa = (dot(d, A.a) - k * dot(d, B.a)) / (1 - k * k), O = add(A.c, scale(A.a, sa));
        for (const n of [unit(sub(A.a, B.a)), unit(add(A.a, B.a))]) {
          const along = dot(n, A.a), dP = dot(n, O);
          paramCuts(th => { const base = add(A.c, scale(add(scale(A.e1, Math.cos(th)), scale(A.e2, Math.sin(th))), A.r)); return add(base, scale(A.a, (dP - dot(n, base)) / along)); }, A.ref - Math.PI, A.ref + Math.PI);
        }
        return;
      }
      const [S, L] = A.r <= B.r ? [A, B] : [B, A], dPerp = sub(S.a, scale(L.a, dot(S.a, L.a))), qa = dot(dPerp, dPerp);
      const coeff = (th: number) => { const q = add(sub(S.c, L.c), add(scale(S.e1, S.r * Math.cos(th)), scale(S.e2, S.r * Math.sin(th)))), wp = sub(q, scale(L.a, dot(q, L.a))); return { q, b: dot(wp, dPerp), c: dot(wp, wp) - L.r * L.r }; };
      const disc = (th: number) => { const { b, c } = coeff(th); return b * b - qa * c; }, N = 720, margin = 1e-6 * L.r * L.r * qa;
      const ds = Array.from({ length: N }, (_, i) => disc(S.ref - Math.PI + TWO_PI * i / N));
      if (Math.max(...ds) < -margin) return;
      const point = (th: number, sign: number): P3 => { const { q, b, c } = coeff(th), t = (-b + sign * Math.sqrt(Math.max(0, b * b - qa * c))) / qa; return add(add(L.c, q), scale(S.a, t)); };
      if (Math.min(...ds) > margin) {
        // The smaller cylinder passes right through: two closed branches over the whole turn.
        for (const sign of [-1, 1]) paramCuts(th => point(th, sign), S.ref - Math.PI, S.ref + Math.PI);
        return;
      }
      if (!ds.some(v => v < -margin)) {
        // The quadratic's discriminant only touches zero (equal radii with meeting axes: two ellipses
        // crossing each other). At each double zero the signed root changes sign, so the two branches
        // ±σ(θ)·√disc are smooth closed curves; they cross at the double zeros.
        const at = (i: number) => S.ref - Math.PI + TWO_PI * i / N, doubles: number[] = [];
        for (let i = 0; i < N; i++) {
          if (!(ds[i] <= ds[(i - 1 + N) % N] && ds[i] <= ds[(i + 1) % N] && ds[i] <= margin)) continue;
          let lo = at(i - 1), hi = at(i + 1);
          for (let it = 0; it < 100; it++) { const m1 = hi - (hi - lo) * 0.6180339887, m2 = lo + (hi - lo) * 0.6180339887; if (disc(m1) < disc(m2)) hi = m2; else lo = m1; }
          const th = (lo + hi) / 2;
          if (Math.abs(disc(th)) > 1e-14 * L.r ** 4 * qa + 1e-300) { march(); return; }
          if (!doubles.some(z => Math.abs(z - th) < 1e-6)) doubles.push(th);
        }
        // Unequal radii (equal ones meeting in a mitre are taken above): the smaller cylinder touches the
        // larger one's wall from inside at each double zero, the curve's two loops meeting there where the
        // walls are tangent. Each root t±(θ) is continuous but turns a corner at the touch, so each is cut
        // into pieces between consecutive double zeros: every piece then ends exactly at a touch point, and
        // the faces' arrangements and the stitch meet the four pieces there, not a curve passing through.
        // (A fillet's tool touching along its tangent edges — on edges of both faces — comes out as the
        // march made it; a touch outside either face is left to the march.)
        if (Math.abs(A.r - B.r) > tol) {
          let inside = false;
          for (const th of doubles) {
            const x = point(th, 1), wa = locateInRegion(to2(fa, x), fa.region, 10 * tol), wb = locateInRegion(to2(fb, x), fb.region, 10 * tol);
            if (wa !== 'out' && wb !== 'out') inside = true;
          }
          if (inside) {
            doubles.sort((a, b) => a - b);
            for (const sign of [-1, 1]) for (let k = 0; k < doubles.length; k++)
              paramCuts(branchOf(point, sign), doubles[k], k + 1 < doubles.length ? doubles[k + 1] : doubles[0] + TWO_PI);
            return;
          }
        }
        if (!doubles.length || doubles.length % 2) { march(); return; }
        doubles.sort((a, b) => a - b);
        const sigma = (th: number) => { let k = 0; const t = ((th - (S.ref - Math.PI)) % TWO_PI + TWO_PI) % TWO_PI + S.ref - Math.PI; for (const z of doubles) if (z < t) k++; return k % 2 ? -1 : 1; };
        for (const sign of [-1, 1]) paramCuts(th => {
          const { q, b, c } = coeff(th), t = (-b + sign * sigma(th) * Math.sqrt(Math.max(0, b * b - qa * c))) / qa;
          return add(add(L.c, q), scale(S.a, t));
        }, S.ref - Math.PI, S.ref + Math.PI);
        return;
      }
      // It passes partly through: one closed loop per angular interval where the quadratic has roots. With
      // θ = θm − Δ·cos ψ the square root at the interval's ends becomes smooth (1 − cos ψ ≈ ψ²/2), and
      // the branch is the sign of sin ψ.
      const zeros: number[] = [];
      for (let i = 0; i < N; i++) {
        const a0 = ds[i], a1 = ds[(i + 1) % N]; if ((a0 > 0) === (a1 > 0)) continue;
        if (Math.min(Math.abs(a0), Math.abs(a1)) < margin && Math.abs(a0 - a1) < 2 * margin) { march(); return; }
        let lo = S.ref - Math.PI + TWO_PI * i / N, hi = lo + TWO_PI / N; const up = a0 < a1;
        for (let it = 0; it < 80; it++) { const m = (lo + hi) / 2; if ((disc(m) > 0) === up) hi = m; else lo = m; }
        zeros.push((lo + hi) / 2);
      }
      if (zeros.length < 2 || zeros.length % 2) { march(); return; }
      // Pair rising and falling zeros (disc > 0 between them, wrapping around the turn).
      const firstUp = disc(zeros[0] + 1e-6) > 0, ordered = firstUp ? zeros : [...zeros.slice(1), zeros[0] + TWO_PI];
      for (let k = 0; k < ordered.length; k += 2) {
        const ta = ordered[k], tb = ordered[k + 1], mid = (ta + tb) / 2, half = (tb - ta) / 2;
        paramCuts(psi => point(mid - half * Math.cos(psi), Math.sin(psi) >= 0 ? 1 : -1), 0, TWO_PI);
      }
      return;
    }
    const d = sub(B.c, A.c), dPerp = sub(d, scale(A.a, dot(d, A.a))), D = len(dPerp);
    if (D <= tol && Math.abs(A.r - B.r) <= tol) { same(fb, fa); same(fa, fb); return; }
    if (D <= tol || D > A.r + B.r + tol || D < Math.abs(A.r - B.r) - tol) return;
    const x = (D * D + A.r * A.r - B.r * B.r) / (2 * D), h = Math.sqrt(Math.max(0, A.r * A.r - x * x)), ux = scale(dPerp, 1 / D), uy = cross(A.a, ux);
    for (const sgn of h > tol ? [-1, 1] : [0]) lineCuts(add(A.c, add(scale(ux, x), scale(uy, sgn * h))), A.a);
    return;
  }
  const [P, C] = (A.kind === 'plane' ? [A, B] : [B, A]) as [Plane, Cylinder];
  const along = dot(P.n, C.a), extent = Math.max(len(sub(fa.max, fa.min)), len(sub(fb.max, fb.min)), C.r);
  // Parallel to the axis to within the tolerance over the faces (a plane turned by rounding meets the
  // cylinder in its rulings, not in an ellipse taller than the model).
  if (Math.abs(along) * extent <= tol) {
    const n = unit(sub(P.n, scale(C.a, along))), delta = dot(n, sub(C.c, P.o));
    if (Math.abs(delta) > C.r + tol) return;
    const foot = sub(C.c, scale(n, delta)), w = unit(cross(C.a, n)), h = Math.sqrt(Math.max(0, C.r * C.r - delta * delta));
    for (const sgn of h > tol ? [-1, 1] : [0]) lineCuts(add(foot, scale(w, sgn * h)), C.a);
    return;
  }
  // Square to the axis to within the tolerance across the cylinder: a cross-section circle.
  if (Math.sqrt(Math.max(0, 1 - along * along)) * C.r <= tol) {
    const h0 = (dot(P.n, P.o) - dot(P.n, C.c)) / along, centre = add(C.c, scale(C.a, h0));
    circleCuts(centre, C.a, C.e1, C.r, C.ref - Math.PI);
    return;
  }
  // A plane at an angle: the ellipse V(θ) = (d − n·(c + r ρ(θ))) / (n·a) over one turn.
  const dP = dot(P.n, P.o);
  paramCuts(th => { const rho = add(scale(C.e1, Math.cos(th)), scale(C.e2, Math.sin(th))), base = add(C.c, scale(rho, C.r)); return add(base, scale(C.a, (dP - dot(P.n, base)) / along)); }, C.ref - Math.PI, C.ref + Math.PI);
}

/** Distance from x to a face's (untrimmed) surface. */
/** Distance in a domain from a point to a line or arc cut. */
function cutDistance(g: CurveSegment2, p: XY): number {
  if (g.kind === 'line') { const d = [g.b[0] - g.a[0], g.b[1] - g.a[1]], l2 = d[0] * d[0] + d[1] * d[1], t = l2 ? Math.max(0, Math.min(1, ((p[0] - g.a[0]) * d[0] + (p[1] - g.a[1]) * d[1]) / l2)) : 0; return Math.hypot(p[0] - g.a[0] - d[0] * t, p[1] - g.a[1] - d[1] * t); }
  if (g.kind === 'arc') {
    const a = Math.atan2(p[1] - g.c[1], p[0] - g.c[0]), lo = Math.min(g.t0, g.t0 + g.sweep), rel = ((a - lo) % TWO_PI + TWO_PI) % TWO_PI;
    if (rel <= Math.abs(g.sweep)) return Math.abs(Math.hypot(p[0] - g.c[0], p[1] - g.c[1]) - g.r);
    const e = [segAtAny(g, 0), segAtAny(g, 1)]; return Math.min(...e.map(q => Math.hypot(q[0] - p[0], q[1] - p[1])));
  }
  return Infinity;
}
function dedupeCuts(cuts: CurveSegment2[], tol: number): CurveSegment2[] {
  const exact = cuts.filter(g => g.kind !== 'curve'), eps = 10 * tol, at = (g: CurveSegment2, u: number) => segAtAny(g, u);
  const same = (g: CurveSegment2, h: CurveSegment2) => { const d = (x: XY, y: XY) => Math.hypot(x[0] - y[0], x[1] - y[1]) <= eps; return d(at(g, 0.5), at(h, 0.5)) && ((d(at(g, 0), at(h, 0)) && d(at(g, 1), at(h, 1))) || (d(at(g, 0), at(h, 1)) && d(at(g, 1), at(h, 0)))); };
  return cuts.filter((g, i) => {
    if (g.kind === 'curve') return !exact.length || ![0.1, 0.3, 0.5, 0.7, 0.9].every(u => { const p = at(g, u); return exact.some(e => cutDistance(e, p) <= eps); });
    return !cuts.slice(0, i).some(h => h.kind !== 'curve' && same(h, g));
  });
}
/** A parametric curve that is a segment or a circular arc (to within `tol`), as one (exact domain maps, fast arrangements). */
function exactly(k: Curve3, tol: number): Curve3 {
  if (k.kind !== 'param') return k;
  const P = Array.from({ length: 17 }, (_, i) => paramAt(k, i / 16)), a = P[0], b = P[16], m = P[8];
  const ab = sub(b, a), l = len(ab);
  if (l > tol && P.every(p => len(cross(sub(p, a), ab)) / l <= tol)) return { kind: 'line', p: a, q: b };
  // The circle through its ends and middle (a closed curve through a quarter instead).
  const q = len(sub(b, a)) <= tol ? P[4] : b, u = sub(m, a), v = sub(q, a), n = cross(u, v), nn = dot(n, n);
  if (nn <= tol * tol * tol * tol) return k;
  const c = add(a, scale(add(scale(cross(n, u), dot(v, v)), scale(cross(v, n), dot(u, u))), 1 / (2 * nn))), r = len(sub(a, c));
  if (!P.every(p => Math.abs(len(sub(p, c)) - r) <= tol && Math.abs(dot(sub(p, c), unit(n))) <= tol)) return k;
  // CCW about the normal from the start through the curve.
  const N = unit(n), U = unit(sub(a, c)), V = cross(N, U), ang = (p: P3) => { const d = sub(p, c); return Math.atan2(dot(d, V), dot(d, U)); };
  let sweep = ((ang(b) % TWO_PI) + TWO_PI) % TWO_PI; const mid = ((ang(P[8]) % TWO_PI) + TWO_PI) % TWO_PI;
  if (sweep <= tol / r || mid > sweep) sweep = len(sub(b, a)) <= tol ? TWO_PI : sweep;
  if (mid > sweep) return k;
  const arc: Curve3 = { kind: 'arc', c, n: N, r, u: U, sweep };
  // Its ends where the curve's are (a curve closing on itself only through its whole turn).
  if (len(sub(arcAt(arc, sweep), b)) > tol || len(sub(arcAt(arc, sweep / 2), paramAt(k, 0.5))) > tol) return k;
  return arc;
}
/**
 * The distance from x to a face's surface, for a comparison with `limit`: when x is farther than `limit`
 * from a NURBS patch's control-point box (which holds the patch), that box distance is returned instead
 * (a lower bound, also past the limit) without inverting the point.
 */
function offSurface(g: { surf: Surf }, x: P3, limit: number): number {
  const s = g.surf;
  if (s.kind === 'plane') return Math.abs(dot(s.n, sub(x, s.o)));
  if (s.kind === 'nurbs') {
    const dx = Math.max(s.hullMin[0] - x[0], 0, x[0] - s.hullMax[0]), dy = Math.max(s.hullMin[1] - x[1], 0, x[1] - s.hullMax[1]), dz = Math.max(s.hullMin[2] - x[2], 0, x[2] - s.hullMax[2]), out = Math.hypot(dx, dy, dz);
    if (out > limit) return out;
    return len(sub(to3(g, to2(g, x)), x));
  }
  const d = sub(x, s.c); return Math.abs(len(sub(d, scale(s.a, dot(d, s.a)))) - s.r);
}

// ---- classification --------------------------------------------------------------------------------
type Where = 'in' | 'out' | 'same' | 'opposite';
const RAYS: P3[] = [[0.5377, 0.3138, 0.7832], [-0.2961, 0.8573, 0.4213], [0.6993, -0.5126, 0.4982], [-0.4436, -0.3714, 0.8155], [0.1172, 0.9563, -0.2677], [0.8811, 0.2219, -0.4175]].map(v => unit(v as P3));
function classify(x: P3, normal: P3 | null, faces: readonly GFace[], tol: number): Where {
  if (normal) for (const g of faces) {
    if (![0, 1, 2].every(k => x[k] >= g.min[k] - 10 * tol && x[k] <= g.max[k] + 10 * tol)) continue;
    const dist = offSurface(g, x, 10 * tol);
    if (dist > 10 * tol || locateInRegion(to2(g, x), g.region, 10 * tol) === 'out') continue;
    return dot(normal, normalOut(g, x)) > 0 ? 'same' : 'opposite';
  }
  for (const dir of RAYS) {
    let count = 0, bad = false;
    for (const g of faces) {
      const s = g.surf, hits: number[] = [];
      if (s.kind === 'plane') {
        const den = dot(s.n, dir); if (Math.abs(den) < 1e-9) { if (Math.abs(dot(s.n, sub(x, s.o))) <= 10 * tol && locateInRegion(to2(g, x), g.region, 10 * tol) !== 'out') bad = true; continue; }
        hits.push(dot(s.n, sub(s.o, x)) / den);
      } else if (s.kind === 'nurbs') {
        const r = rayHits(s, x, dir, tol); if (r === null) { bad = true; break; } hits.push(...r);
      } else {
        const w = sub(x, s.c), wp = sub(w, scale(s.a, dot(w, s.a))), dp = sub(dir, scale(s.a, dot(dir, s.a)));
        const A = dot(dp, dp), B = 2 * dot(wp, dp), C = dot(wp, wp) - s.r * s.r;
        if (A < 1e-12) { if (Math.abs(C) <= 10 * tol * s.r) bad = true; continue; }
        const disc = B * B - 4 * A * C; if (disc < 0) continue;
        if (disc < 1e-12 * B * B + 1e-18) { bad = true; continue; }
        hits.push((-B - Math.sqrt(disc)) / (2 * A), (-B + Math.sqrt(disc)) / (2 * A));
      }
      for (const t of hits) {
        if (t < -10 * tol) continue;
        const where = locateInRegion(to2(g, add(x, scale(dir, t))), g.region, 10 * tol);
        // A hit at the origin only matters inside the face (outside it, the ray just starts on its plane).
        if (t <= 10 * tol) { if (where !== 'out') bad = true; continue; }
        if (where === 'boundary') bad = true; else if (where === 'in') count++;
      }
      if (bad) break;
    }
    if (!bad) return count % 2 ? 'in' : 'out';
  }
  throw new BrepError('GEOMETRY', 'analytic Boolean: every test ray was degenerate');
}

/**
 * Ray parameters where x + t·dir meets a NURBS patch: candidate triangles of its grid, each refined by
 * Newton on (u, v, t). Null when a hit grazes the surface (degenerate ray).
 */
function rayHits(s: Nurbs, x: P3, dir: P3, tol: number): number[] | null {
  // (The patch lies in its control points' box: a ray that misses the box, widened, meets nothing.)
  if (rayMissesBox(s.hullMin, s.hullMax, x, dir, 10 * tol)) return [];
  const n = 24, G = (i: number, j: number) => s.grid[i * 25 + j], out: number[] = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (const tri of [[G(i, j), G(i + 1, j), G(i + 1, j + 1)], [G(i, j), G(i + 1, j + 1), G(i, j + 1)]]) {
    const e1 = sub(tri[1].x, tri[0].x), e2 = sub(tri[2].x, tri[0].x), h = cross(dir, e2), a = dot(e1, h);
    if (Math.abs(a) < 1e-300) continue;
    const f = 1 / a, q0 = sub(x, tri[0].x), u = f * dot(q0, h), q1 = cross(q0, e1), v = f * dot(dir, q1);
    if (u < -0.1 || v < -0.1 || u + v > 1.1) continue;
    let pu = tri[0].p[0] + (tri[1].p[0] - tri[0].p[0]) * u + (tri[2].p[0] - tri[0].p[0]) * v, pv = tri[0].p[1] + (tri[1].p[1] - tri[0].p[1]) * u + (tri[2].p[1] - tri[0].p[1]) * v, t = f * dot(e2, q1);
    // Newton on S(u, v) − (x + t·dir) = 0, from inside the domain.
    pu = Math.min(s.U[1], Math.max(s.U[0], pu)); pv = Math.min(s.V[1], Math.max(s.V[0], pv));
    let ok = false;
    for (let it = 0; it < 30; it++) {
      const H = 1e-7, ia = pu + H * (s.U[1] - s.U[0]) <= s.U[1] ? pu + H * (s.U[1] - s.U[0]) : pu - H * (s.U[1] - s.U[0]), ib = pv + H * (s.V[1] - s.V[0]) <= s.V[1] ? pv + H * (s.V[1] - s.V[0]) : pv - H * (s.V[1] - s.V[0]);
      const P = s.ev(pu, pv), Su = scale(sub(s.ev(ia, pv), P), 1 / (ia - pu)), Sv = scale(sub(s.ev(pu, ib), P), 1 / (ib - pv));
      const F = sub(P, add(x, scale(dir, t))), M = [[Su[0], Sv[0], -dir[0]], [Su[1], Sv[1], -dir[1]], [Su[2], Sv[2], -dir[2]]];
      const det = M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
      if (Math.abs(det) < 1e-12 * len(Su) * len(Sv)) return null; // grazing
      const inv = (r: number, c: number) => { const m = [0, 1, 2].filter(k => k !== r), q = [0, 1, 2].filter(k => k !== c); return ((r + c) % 2 ? -1 : 1) * (M[m[0]][q[0]] * M[m[1]][q[1]] - M[m[0]][q[1]] * M[m[1]][q[0]]) / det; };
      const du = inv(0, 0) * F[0] + inv(1, 0) * F[1] + inv(2, 0) * F[2], dv = inv(0, 1) * F[0] + inv(1, 1) * F[1] + inv(2, 1) * F[2], dt = inv(0, 2) * F[0] + inv(1, 2) * F[1] + inv(2, 2) * F[2];
      // Clamped to the domain (a hit beyond it is no hit: tested below).
      pu = Math.min(s.U[1], Math.max(s.U[0], pu - du)); pv = Math.min(s.V[1], Math.max(s.V[0], pv - dv)); t -= dt;
      if (len(F) < tol * 1e-3) { ok = true; break; }
    }
    if (!ok || pu < s.U[0] - 1e-9 || pu > s.U[1] + 1e-9 || pv < s.V[0] - 1e-9 || pv > s.V[1] + 1e-9) continue;
    if (!out.some(o => Math.abs(o - t) <= 10 * tol)) out.push(t);
  }
  return out;
}

/** Whether the half-line x + t·dir (t ≥ −pad) misses the box [lo − pad, hi + pad]. */
function rayMissesBox(lo: P3, hi: P3, x: P3, dir: P3, pad: number): boolean {
  let near = -pad, far = Infinity;
  for (let k = 0; k < 3; k++) {
    const a = lo[k] - pad, b = hi[k] + pad;
    if (Math.abs(dir[k]) < 1e-300) { if (x[k] < a || x[k] > b) return true; continue; }
    let t0 = (a - x[k]) / dir[k], t1 = (b - x[k]) / dir[k]; if (t0 > t1) { const t = t0; t0 = t1; t1 = t; }
    if (t0 > near) near = t0; if (t1 < far) far = t1;
    if (near > far) return true;
  }
  return false;
}

// ---- the Boolean -------------------------------------------------------------------------------------
interface Piece { face: GFace; region: CurveRegion2; out: 1 | -1; key: P3 }

/**
 * The analytic form of a B-rep face's surface: a plane (point and outward normal), a circular
 * cylinder (axis point, unit axis, radius; `out` +1 when the outward normal points away from the axis),
 * or `other` for any other surface.
 */
export type FaceGeometry = { readonly kind: 'plane'; readonly o: P3; readonly n: P3 } | { readonly kind: 'cylinder'; readonly c: P3; readonly a: P3; readonly r: number; readonly out: 1 | -1 } | { readonly kind: 'other' };
export function faceGeometry(face: BrepFace, scaleMM = 1): FaceGeometry {
  const s = surfaceOf(face, linearToleranceMM(scaleMM) * 10);
  if (s.kind === 'plane') return { kind: 'plane', o: s.o, n: s.n };
  if (s.kind === 'cylinder') return { kind: 'cylinder', c: s.c, a: s.a, r: s.r, out: s.s };
  return { kind: 'other' };
}

/**
 * Edges that are an exact curve's map onto a general face and lie on a circle are made that arc
 * (`exactEdges: false` keeps them fitted).
 */
export function booleanAnalytic(a: Brep, b: Brep, operation: AnalyticBooleanOperation, options: { readonly id?: string; readonly exactEdges?: boolean } = {}): Brep {
  const id = options.id ?? `analytic-${operation}`;
  let scale = 1; for (const br of [a, b]) for (const v of br.vertices) for (const x of v.point) scale = Math.max(scale, Math.abs(x));
  const tol = linearToleranceMM(scale) * 10, span = 4 * scale + 1;
  const A = facesOf(a, 0, tol), B = facesOf(b, 1, tol);
  // 1. Cuts.
  for (const fa of A) for (const fb of B) if (boxesMeet(fa, fb, tol)) cutPair(fa, fb, tol, span);
  // A cut running along a face's own boundary (two finished edges meeting in a mitre already edged
  // there) adds nothing but slivers.
  for (const f of [...A, ...B]) f.cuts = f.cuts.filter(g => ![0.2, 0.5, 0.8].every(u => locateInRegion(segAtAny(g, u), f.region, 10 * tol) === 'boundary'));
  // A cut made twice (a face's edge on the other surface, and a coplanar face's boundary) is kept once,
  // the exact copy (a line or an arc) over a fitted one.
  for (const f of [...A, ...B]) f.cuts = dedupeCuts(f.cuts, tol);
  // 2–3. Pieces and their classes.
  const pieces: (Piece & { where: Where })[] = [];
  for (const f of [...A, ...B]) {
    const regions = f.cuts.length ? curveFaceRegions([f.region.outer, ...f.region.holes], f.cuts, tol) : [f.region];
    for (const region of regions) {
      const p2 = regionInteriorPoint(region); if (!p2 || Math.abs(regionArea(region)) <= tol * tol) continue;
      const x = to3(f, p2), where = classify(x, normalOut(f, x), f.solid === 0 ? B : A, tol);
      pieces.push({ face: f, region, out: 1, key: x, where });
    }
  }
  // 4. Keep, flip, stitch.
  const keep = (p: { face: GFace; where: Where }): 'keep' | 'flip' | null => {
    const fromA = p.face.solid === 0, w = p.where;
    if (operation === 'union') return w === 'out' || (w === 'same' && fromA) ? 'keep' : null;
    if (operation === 'intersection') return w === 'in' || (w === 'same' && fromA) ? 'keep' : null;
    if (fromA) return w === 'out' || w === 'opposite' ? 'keep' : null;
    return w === 'in' ? 'flip' : null;
  };
  const reverse = (ring: readonly CurveSegment2[]) => [...ring].reverse().map(segReverse);
  const kept: Piece[] = pieces.flatMap(p => { const k = keep(p); if (!k) return [];
    return [{ face: p.face, out: k === 'flip' ? -1 : 1, key: p.key, region: k === 'flip' ? { outer: reverse(p.region.outer), holes: p.region.holes.map(reverse) } : p.region }]; });
  return stitch(mergePieces(kept, tol), id, tol, options.exactEdges !== false);
}

// ---- merging ----------------------------------------------------------------------------------------
/**
 * Pieces on one plane, or one cylinder, facing the same way become one face: their regions are joined
 * in a common domain (the first piece's; for a cylinder, centred so its seam falls in a gap between
 * the pieces). The joined face keeps the first piece's name. A full turn of pieces stays as it is.
 */
function mergePieces(pieces: Piece[], tol: number): Piece[] {
  const facing = (p: Piece): P3 => { const s = p.face.surf; return s.kind === 'plane' ? scale(s.n, p.out) : s.kind === 'cylinder' ? scale(s.a, s.s * p.out) : [0, 0, 0]; };
  const same = (a: Piece, b: Piece) => {
    const A = a.face.surf, B = b.face.surf;
    if (A.kind === 'plane' && B.kind === 'plane') return dot(facing(a), facing(b)) > 1 - 1e-12 && Math.abs(dot(A.n, sub(B.o, A.o))) <= tol;
    if (A.kind === 'nurbs' || B.kind === 'nurbs') return false;
    if (A.kind === 'cylinder' && B.kind === 'cylinder') {
      const d = sub(B.c, A.c);
      return Math.abs(Math.abs(dot(A.a, B.a)) - 1) <= 1e-12 && Math.abs(A.r - B.r) <= tol && len(sub(d, scale(A.a, dot(d, A.a)))) <= tol && dot(facing(a), facing(b)) > 0;
    }
    return false;
  };
  const groups: Piece[][] = [];
  for (const p of pieces) { const g = groups.find(x => same(x[0], p)); if (g) g.push(p); else groups.push([p]); }
  return groups.flatMap(group => {
    if (group.length === 1) return group;
    const first = group[0], s0 = first.face.surf;
    let host: GFace = { ...first.face, cuts: [] };
    if (s0.kind === 'cylinder') {
      // Angular coverage: each piece's θ interval (exact in its own domain), joined around the circle;
      // the domain's seam goes in the middle of the largest uncovered gap.
      const spans = group.map(p => {
        const sf = p.face.surf as Cylinder, us: number[] = [];
        for (const ring of [p.region.outer, ...p.region.holes]) for (const g of ring) for (let i = 0; i <= 16; i++) { const q = segAtAny(g, i / 16); us.push(q[0]); }
        const a = Math.min(...us) / (sf.s * sf.r), b = Math.max(...us) / (sf.s * sf.r);
        return [Math.min(a, b), Math.max(a, b)] as [number, number];
      });
      if (spans.some(([a, b]) => b - a >= TWO_PI - 1e-9)) return group;
      const norm = spans.map(([a, b]) => { const a0 = ((a % TWO_PI) + TWO_PI) % TWO_PI; return [a0, a0 + (b - a)] as [number, number]; }).sort((x, y) => x[0] - y[0]);
      const merged: [number, number][] = [];
      for (const iv of norm) { const last = merged[merged.length - 1]; if (last && iv[0] <= last[1] + 1e-9) last[1] = Math.max(last[1], iv[1]); else merged.push([...iv]); }
      if (merged.length > 1 && merged[merged.length - 1][1] >= merged[0][0] + TWO_PI - 1e-9) { const lastIv = merged.pop()!; merged[0] = [lastIv[0] - TWO_PI, Math.max(merged[0][1], lastIv[1] - TWO_PI)]; }
      let gap = 0, at = 0;
      for (let i = 0; i < merged.length; i++) { const next = i + 1 < merged.length ? merged[i + 1][0] : merged[0][0] + TWO_PI, g = next - merged[i][1]; if (g > gap) { gap = g; at = merged[i][1] + g / 2; } }
      if (gap < 1e-6) return group;
      host = { ...host, surf: { ...s0, ref: at + Math.PI } };
    }
    // Rings in the host domain, made counter-clockwise (material left) for the union.
    const flipped = first.out < 0, orient = (r: CurveSegment2[]) => flipped ? [...r].reverse().map(segReverse) : r;
    const rings = group.flatMap(p => [p.region.outer, ...p.region.holes].map(r => orient(r.map(g => curve2(host, curve3Of(p.face, g), tol)))));
    const joined = booleanCurveRegions(rings, [], 'union', tol);
    return joined.map(region => {
      const back = flipped ? { outer: [...region.outer].reverse().map(segReverse), holes: region.holes.map(h => [...h].reverse().map(segReverse)) } : region;
      const p2 = regionInteriorPoint(region) ?? [0, 0];
      return { face: host, region: back, out: first.out, key: to3(host, p2) };
    });
  });
}

// ---- stitching ---------------------------------------------------------------------------------------
class PointSet3 {
  readonly points: P3[] = []; private readonly grid = new Map<string, number[]>(); private readonly cell: number;
  constructor(readonly eps: number) { this.cell = eps * 16; }
  private k(p: P3, o = [0, 0, 0]) { return [0, 1, 2].map(i => Math.floor(p[i] / this.cell) + o[i]).join(','); }
  find(p: P3): number {
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let m = -1; m <= 1; m++) for (const v of this.grid.get(this.k(p, [i, j, m])) ?? []) if (len(sub(this.points[v], p)) <= this.eps) return v;
    return -1;
  }
  add(p: P3): number { const f = this.find(p); if (f >= 0) return f; const v = this.points.length; this.points.push(p); const k = this.k(p); this.grid.set(k, [...(this.grid.get(k) ?? []), v]); return v; }
}
const pointOf = (k: Curve3, u: number): P3 => k.kind === 'line' ? add(k.p, scale(sub(k.q, k.p), u)) : k.kind === 'param' ? paramAt(k, u) : arcAt(k, k.sweep * u);
const startOf = (k: Curve3): P3 => k.kind === 'line' ? k.p : k.kind === 'param' ? k.at(k.t0) : arcAt(k, 0);
const endOf = (k: Curve3): P3 => k.kind === 'line' ? k.q : k.kind === 'param' ? k.at(k.t1) : arcAt(k, k.sweep);
const midOf = (k: Curve3): P3 => k.kind === 'line' ? scale(add(k.p, k.q), 0.5) : k.kind === 'param' ? paramAt(k, 0.5) : arcAt(k, k.sweep / 2);
/** Parameter in [0, 1] of a point on the curve, or null when it is not on it (within eps). */
const sampled = new WeakMap<Curve3, { ps: P3[]; min: P3; max: P3 }>();
function onCurve(k: Curve3, x: P3, eps: number): number | null {
  if (k.kind === 'param') {
    // Samples and their box, once per curve: most vertices are far from most curves.
    let pre = sampled.get(k);
    if (!pre) { const ps = Array.from({ length: 65 }, (_, i) => paramAt(k, i / 64)), pad = len(sub(ps[1], ps[0])) + len(sub(ps[64], ps[63]));
      pre = { ps, min: [0, 1, 2].map(a => Math.min(...ps.map(p => p[a])) - pad) as P3, max: [0, 1, 2].map(a => Math.max(...ps.map(p => p[a])) + pad) as P3 }; sampled.set(k, pre); }
    if (![0, 1, 2].every(a => x[a] >= pre!.min[a] - eps && x[a] <= pre!.max[a] + eps)) return null;
    const d2 = (u: number) => { const p = paramAt(k, u); return (p[0] - x[0]) ** 2 + (p[1] - x[1]) ** 2 + (p[2] - x[2]) ** 2; };
    let best = 0, bd = Infinity; for (let i = 0; i <= 64; i++) { const p = pre.ps[i], v = (p[0] - x[0]) ** 2 + (p[1] - x[1]) ** 2 + (p[2] - x[2]) ** 2; if (v < bd) { bd = v; best = i; } }
    let lo = Math.max(0, (best - 1) / 64), hi = Math.min(1, (best + 1) / 64);
    for (let i = 0; i < 60; i++) { const m1 = hi - (hi - lo) * 0.6180339887, m2 = lo + (hi - lo) * 0.6180339887; if (d2(m1) < d2(m2)) hi = m2; else lo = m1; }
    const u = (lo + hi) / 2;
    return Math.sqrt(d2(u)) <= eps && len(sub(paramAt(k, u), startOf(k))) > eps && len(sub(paramAt(k, u), endOf(k))) > eps ? u : null;
  }
  if (k.kind === 'line') { const d = sub(k.q, k.p), t = dot(sub(x, k.p), d) / dot(d, d); return t > 0 && t < 1 && len(sub(add(k.p, scale(d, t)), x)) <= eps ? t : null; }
  const d = sub(x, k.c), h = dot(d, k.n), inPlane = sub(d, scale(k.n, h));
  if (Math.abs(h) > eps || Math.abs(len(inPlane) - k.r) > eps) return null;
  let phi = Math.atan2(dot(inPlane, cross(k.n, k.u)), dot(inPlane, k.u)); if (phi < 0) phi += TWO_PI;
  const t = phi / k.sweep; return t > 0 && t < 1 && phi * k.r > eps && (k.sweep - phi) * k.r > eps ? t : null;
}
function part(k: Curve3, t0: number, t1: number, p: P3, q: P3): Curve3 {
  if (k.kind === 'line') return { kind: 'line', p, q };
  if (k.kind === 'param') return { ...k, t0: k.t0 + (k.t1 - k.t0) * t0, t1: k.t0 + (k.t1 - k.t0) * t1 };
  const e2 = cross(k.n, k.u), phi = k.sweep * t0;
  return { ...k, u: unit(add(scale(k.u, Math.cos(phi)), scale(e2, Math.sin(phi)))), sweep: k.sweep * (t1 - t0) };
}
/** A curve as a NURBS edge: lines degree 1; arcs rational quadratic in spans of at most a quarter turn. */
function nurbs(k: Curve3, id: string, p: P3, q: P3, tol = 0): Curve {
  if (k.kind === 'line') return lineCurve(id, p, q);
  if (k.kind === 'param') return fitCubic(k, id, p, q, tol);
  const spans = Math.max(1, Math.ceil(k.sweep / (Math.PI / 2) - 1e-12)), dt = k.sweep / spans, w = Math.cos(dt / 2);
  const cp: P3[] = [p], wt = [1], knots = [0, 0, 0];
  for (let s = 0; s < spans; s++) {
    const mid = arcAt(k, dt * (s + 0.5)), ctr = add(k.c, scale(unit(sub(mid, k.c)), k.r / w));
    cp.push(ctr, s === spans - 1 ? q : arcAt(k, dt * (s + 1))); wt.push(w, 1);
    if (s < spans - 1) knots.push((s + 1) / spans, (s + 1) / spans);
  }
  knots.push(1, 1, 1);
  return { kind: 'curve', id, degree: 2, knots, controlPoints: cp, weights: wt };
}

const FIT_PIECES = 16; // 49 control points: within the kernel's 64-point curve limit
/** A C¹ cubic Bézier chain through the curve (Hermite data at n + 1 points). */
function fitCubic(k: Extract<Curve3, { kind: 'param' }>, id: string, p: P3, q: P3, tol: number): Curve {
  return fitWith(k, id, p, q, FIT_PIECES).curve; void tol;
}
function fitWith(k: Extract<Curve3, { kind: 'param' }>, id: string, p: P3, q: P3, n: number): { curve: Curve; error: number } {
  const at = (u: number) => u <= 0 ? p : u >= 1 ? q : paramAt(k, u), h = 1e-6;
  const d = (u: number) => { const a = paramAt(k, Math.max(0, u - h)), b = paramAt(k, Math.min(1, u + h)); return scale(sub(b, a), 1 / (Math.min(1, u + h) - Math.max(0, u - h))); };
  {
    const cp: P3[] = [at(0)], knots = [0, 0, 0, 0];
    for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = (i + 1) / n, P0 = at(u0), P1 = at(u1), du = (u1 - u0) / 3;
      cp.push(add(P0, scale(d(u0), du)), sub(P1, scale(d(u1), du)), P1);
      if (i < n - 1) knots.push(u1, u1, u1);
    }
    knots.push(1, 1, 1, 1);
    const curve: Curve = { kind: 'curve', id, degree: 3, knots, controlPoints: cp, weights: cp.map(() => 1) };
    const ev = curveEvaluator(curve);
    let err = 0; for (let i = 0; i < n; i++) for (const f of [0.25, 0.5, 0.75]) err = Math.max(err, len(sub(ev((i + f) / n), at((i + f) / n))));
    return { curve, error: err };
  }
}
/** A parametric curve in pieces (halving its parameter range) each of which one fit holds within tol. */
function fitPieces(k: Curve3, tol: number, depth = 0): Curve3[] {
  if (k.kind !== 'param' || depth >= 10 || fitWith(k, 'fit', k.at(k.t0), k.at(k.t1), FIT_PIECES).error <= tol) return [k];
  const m = (k.t0 + k.t1) / 2;
  return [...fitPieces({ ...k, t1: m }, tol, depth + 1), ...fitPieces({ ...k, t0: m }, tol, depth + 1)];
}

/** A region's boundary length (its curves by 16 chords each). */
function regionLength(region: CurveRegion2): number {
  let total = 0;
  for (const ring of [region.outer, ...region.holes]) for (const g of ring) {
    let last = segAtAny(g, 0);
    for (let k = 1; k <= 16; k++) { const q = segAtAny(g, k / 16); total += Math.hypot(q[0] - last[0], q[1] - last[1]); last = q; }
  }
  return total;
}

function stitch(pieces: Piece[], id: string, tol: number, exactEdges = false): Brep {
  // Vertices merge a little more loosely than curves are fitted: an edge meeting a surface it touches
  // (a double root, as where a fillet meets a sloping side) lands within √ε of its true point.
  const set = new PointSet3(20 * tol);
  // A closed curve (a full circle as one edge) starts and ends at one vertex: split it in halves.
  const open = (k: Curve3): Curve3[] => {
    if (len(sub(startOf(k), endOf(k))) > tol) return [k];
    if (k.kind === 'arc') return [{ ...k, sweep: k.sweep / 2 }, { ...k, u: unit(sub(arcAt(k, k.sweep / 2), k.c)), sweep: k.sweep / 2 }];
    if (k.kind === 'param') { const m = (k.t0 + k.t1) / 2; return [{ ...k, t1: m }, { ...k, t0: m }]; }
    return [k];
  };
  // Curves of no length (a domain side at a pole) are not edges.
  const point = (k: Curve3) => [0.25, 0.5, 0.75, 1].every(u => len(sub(pointOf(k, u), startOf(k))) <= tol);
  const rings = pieces.map(p => [p.region.outer, ...p.region.holes].map(r => r.flatMap(g => { const k = curve3Of(p.face, g); return point(k) ? [] : open(exactEdges && k.kind === 'param' && k.exact ? exactly(k, tol * 1e-3) : k).flatMap(x => fitPieces(x, tol / 4)); })));
  for (const ps of rings) for (const ring of ps) for (const k of ring) { set.add(startOf(k)); set.add(endOf(k)); }
  const P = set.points;
  // Consecutive pieces of one ring meet at one vertex: a traced curve's end lands within its tracing
  // tolerance of the exact curve it meets, more loosely than vertices merge.
  const alias = P.map((_, i) => i), canon = (i: number): number => { while (alias[i] !== i) i = alias[i] = alias[alias[i]]; return i; };
  for (const ps of rings) for (const ring of ps) ring.forEach((k, i) => {
    const n = ring[(i + 1) % ring.length], a = canon(set.find(endOf(k))), b = canon(set.find(startOf(n)));
    if (a !== b && len(sub(P[a], P[b])) <= 100 * tol) alias[b] = a;
  });
  const vertexOf = (x: P3) => canon(set.find(x));
  // Split at every vertex lying on a curve (T-junctions between neighbouring pieces).
  const edges: { id: string; k: Curve3; v: [number, number]; mid: P3 }[] = [], between = new Map<string, number[]>();
  const edgeOf = (k: Curve3, a: number, b: number) => {
    const mid = midOf(k), key = Math.min(a, b) + ':' + Math.max(a, b), list = between.get(key) ?? [];
    // The same curve from either face: a parametric piece's midpoint depends on the face that
    // parametrized it, so it is looked for on the other copy rather than compared.
    // A traced curve is within its tracing tolerance of the exact one it copies.
    const loose = (x: Curve3) => x.kind === 'param' && !x.exact;
    let e = list.find(i => { const eps = (loose(k) || loose(edges[i].k) ? 100 : 10) * tol; return len(sub(edges[i].mid, mid)) <= eps || onCurve(edges[i].k, mid, eps) !== null; });
    if (e === undefined) { e = edges.length; edges.push({ id: `${id}_e${e}`, k, v: [a, b], mid }); list.push(e); between.set(key, list); }
    return { edge: edges[e].id, sense: (edges[e].v[0] === a ? 'forward' : 'reversed') as 'forward' | 'reversed', index: e };
  };
  const loops = rings.map(ps => ps.map(ring => ring.flatMap(k => {
    const a = vertexOf(startOf(k)), b = vertexOf(endOf(k)), stops = [{ t: 0, v: a }];
    P.forEach((x, v) => { if (v === a || v === b || alias[v] !== v) return; const t = onCurve(k, x, tol); if (t !== null) stops.push({ t, v }); });
    stops.sort((x, y) => x.t - y.t); stops.push({ t: 1, v: b });
    const out: ReturnType<typeof edgeOf>[] = [];
    for (let i = 0; i + 1 < stops.length; i++) if (stops[i].v !== stops[i + 1].v) out.push(edgeOf(part(k, stops[i].t, stops[i + 1].t, P[stops[i].v], P[stops[i + 1].v]), stops[i].v, stops[i + 1].v));
    return out;
  })));
  // Vertices: one per disc of faces around a point (two solids touching at a point keep two vertices).
  const vroot = new Map<string, string>(), vfind = (x: string): string => { let r = x; while (vroot.has(r) && vroot.get(r) !== r) r = vroot.get(r)!; return r; };
  const endsOf = (u: { index: number; sense: string }) => { const v = edges[u.index].v; return u.sense === 'forward' ? [v[0], v[1]] : [v[1], v[0]]; };
  for (const ls of loops) for (const ring of ls) ring.forEach((u, k) => {
    const n = ring[(k + 1) % ring.length], a = `${endsOf(u)[1]}|${u.index}`, b = `${endsOf(n)[0]}|${n.index}`, ra = vfind(a), rb = vfind(b);
    if (ra !== rb) vroot.set(ra, rb);
  });
  const vertexIds = new Map<string, string>(), vertexList: { id: string; point: P3 }[] = [];
  const vertexAt = (p: number, e: number) => { const r = vfind(`${p}|${e}`); let v = vertexIds.get(r); if (!v) { v = `${id}_v${vertexList.length}`; vertexIds.set(r, v); vertexList.push({ id: v, point: P[p] }); } return v; };
  // Every edge is used once in each direction.
  const uses = new Map<number, { piece: number; sense: string }[]>();
  loops.forEach((ls, pi) => ls.flat().forEach(u => { const list = uses.get(u.index), use = { piece: pi, sense: u.sense }; if (list) list.push(use); else uses.set(u.index, [use]); }));
  for (const [e, list] of uses) if (list.length !== 2 || list[0].sense === list[1].sense)
    throw new BrepError('TOPOLOGY', `analytic Boolean: the result is not a manifold solid (edge ${e} from ${P[edges[e].v[0]].map(x => +x.toFixed(4))} to ${P[edges[e].v[1]].map(x => +x.toFixed(4))} has ${list.length} uses; the inputs touch along an edge or at a vertex)`);
  // Shells by connectivity, signed volume by the divergence theorem (exact on these pieces).
  const root = pieces.map((_, i) => i), find = (x: number): number => { while (root[x] !== x) x = root[x] = root[root[x]]; return x; };
  for (const list of uses.values()) root[find(list[0].piece)] = find(list[1].piece);
  const volume = (pi: number) => {
    const p = pieces[pi], s = p.face.surf, region = p.region;
    if (s.kind === 'plane') return dot(s.n, s.o) * regionArea(region) / 3;
    if (s.kind === 'nurbs') {
      // Tetrahedra from the origin over the piece triangulated in its domain (the shell's sign and size).
      const sample = (r: readonly CurveSegment2[]) => r.flatMap(g => Array.from({ length: 16 }, (_, k) => segAtAny(g, k / 16)));
      let outer = sample(region.outer), holes = region.holes.map(sample);
      let area = 0; for (let i = 0; i < outer.length; i++) { const a = outer[i], b = outer[(i + 1) % outer.length]; area += a[0] * b[1] - b[0] * a[1]; }
      const flip = area < 0; if (flip) { outer = [...outer].reverse(); holes = holes.map(h => [...h].reverse()); }
      const pts = [...outer, ...holes.flat()].map(q => to3(p.face, q)); let v = 0;
      for (const [a, b, c] of triangulatePolygonWithHoles(outer, holes)) v += dot(pts[a], cross(pts[b], pts[c])) / 6;
      return flip ? -v : v;
    }
    // ∫ x·n dA over the piece by Green's theorem in (U, V): only generators (dU = 0) contribute.
    const cperpA = dot(s.c, s.e1), cperpB = dot(s.c, s.e2);
    const F = (U: number) => { const th = U / (s.s * s.r); return s.s * s.r * (cperpA * Math.sin(th) - cperpB * Math.cos(th)) + s.r * U; };
    let acc = 0;
    for (const ring of [region.outer, ...region.holes]) for (const g of ring) {
      if (g.kind === 'line') acc += F(g.a[0]) * (g.b[1] - g.a[1]);
      else if (g.kind === 'curve') acc += segIntegral(g, (x, dx) => F(x[0]) * dx[1]);
    }
    return s.s * acc / 3;
  };
  const shells = new Map<number, number[]>(); pieces.forEach((_, i) => { const r = find(i), list = shells.get(r); if (list) list.push(i); else shells.set(r, [i]); });
  const asFaces = (members: number[]): GFace[] => members.map(i => ({ ...pieces[i].face, region: pieces[i].region, out: pieces[i].out }));
  // With general surfaces the volume is approximate (domain-triangulated pieces): its sign comes from
  // whether a point just outside a face lies within the shell (a cavity's faces face its void).
  const reach = P.reduce((r, x) => Math.max(r, len(x)), 1);
  const groups = [...shells.values()].map(m => {
    const v = m.reduce((acc, i) => acc + volume(i), 0);
    // (The pieces' traced boundaries are good to the tolerance, so the volume about the origin is good to about
    // tol × reach × their length: a shell thinner than that — a sliver where an edge grazes a wall — has no
    // sign of its own. Its nesting decides it below.)
    if (!m.some(i => pieces[i].face.surf.kind === 'nurbs')) return { members: m, volume: v, unsure: Math.abs(v) <= tol * reach * m.reduce((acc, i) => acc + regionLength(pieces[i].region), 0) };
    // (A point by a seam or an edge can be misjudged: several pieces vote, the volume's sign breaks a tie.)
    const faces = asFaces(m), voters = m.filter((_, k) => k % Math.max(1, Math.floor(m.length / 7)) === 0).slice(0, 7);
    const votes = voters.reduce((acc, i) => { const p = pieces[i], x = p.key, n = normalOut({ ...p.face, out: p.out }, x); return acc + (classify(add(x, scale(n, 1000 * tol)), null, faces, tol) === 'in' ? 1 : -1); }, 0);
    const inward = votes > 0 || (votes === 0 && v < 0);
    return { members: m, volume: (inward ? -1 : 1) * Math.max(Math.abs(v), tol), unsure: false };
  });
  // A shell without a sure sign is a cavity when an odd number of the other shells enclose it, else an outer one.
  for (const g of groups) {
    if (!g.unsure) continue;
    const x = pieces[g.members[0]].key, depth = groups.filter(o => o !== g && classify(x, null, asFaces(o.members), tol) === 'in').length;
    g.volume = (depth % 2 ? -1 : 1) * Math.max(Math.abs(g.volume), tol * tol * tol);
  }
  const bodies = groups.filter(g => g.volume > 0).map(g => ({ outer: g, cavities: [] as typeof groups }));
  for (const c of groups.filter(g => g.volume <= 0)) {
    const x = pieces[c.members[0]].key; let best = -1;
    bodies.forEach((bd, k) => { if (classify(x, null, asFaces(bd.outer.members), tol) === 'in' && (best < 0 || bd.outer.volume < bodies[best].outer.volume)) best = k; });
    if (best < 0) throw new BrepError('TOPOLOGY', 'analytic Boolean: a cavity lies in no outer shell');
    bodies[best].cavities.push(c);
  }
  // Names: the piece's face name (numbered by position when repeated); edges by their two faces.
  const faceNames: string[] = [], byName = new Map<string, number[]>();
  pieces.forEach((p, i) => { const n = p.face.name ?? `${id}.face`, list = byName.get(n); if (list) list.push(i); else byName.set(n, [i]); });
  for (const [n, list] of byName) {
    if (list.length === 1) { faceNames[list[0]] = n; continue; }
    [...list].sort((x, y) => { const a = pieces[x].key, b = pieces[y].key; return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]; }).forEach((i, k) => { faceNames[i] = `${n}#${k + 1}`; });
  }
  const edgeList = edges.map((e, i) => ({ id: e.id, curve: nurbs(e.k, e.id, P[e.v[0]], P[e.v[1]], tol / 4), vertices: [vertexAt(e.v[0], i), vertexAt(e.v[1], i)] as [string, string],
    name: [...new Set((uses.get(i) ?? []).map(u => faceNames[u.piece]))].sort().join('|') }));
  nameEdges(edgeList);
  const surface = (pi: number): { surface: Surface; sense: 'forward' | 'reversed' } => {
    const p = pieces[pi], s = p.face.surf, pts: XY[] = [];
    if (s.kind === 'nurbs') return { surface: s.S, sense: s.sense * p.out > 0 ? 'forward' : 'reversed' };
    // (A plane or cylinder piece is spanned over its edges' control points in its own coordinates.)
    for (const ring of loops[pi]) for (const u of ring) for (const x of edgeList[u.index].curve.controlPoints) pts.push(to2(p.face, x));
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const x of pts) { if (x[0] < u0) u0 = x[0]; if (x[0] > u1) u1 = x[0]; if (x[1] < v0) v0 = x[1]; if (x[1] > v1) v1 = x[1]; }
    if (s.kind === 'plane') {
      const at = (u: number, v: number) => to3(p.face, [u, v]), pad = tol;
      // ∂S/∂u × ∂S/∂v = e1 × e2 = n.
      return { surface: { kind: 'surface', id: `${id}_s${pi}`, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1],
        controlPoints: [[at(u0 - pad, v0 - pad), at(u0 - pad, v1 + pad)], [at(u1 + pad, v0 - pad), at(u1 + pad, v1 + pad)]], weights: [[1, 1], [1, 1]] }, sense: p.out > 0 ? 'forward' : 'reversed' };
    }
    // An arc of the cylinder from the smallest to the largest θ (CCW about a) extruded along a: ∂u × ∂v is radial.
    const th0 = Math.min(u0, u1) / (s.s * s.r), th1 = Math.max(u0, u1) / (s.s * s.r), lo = Math.min(th0, th1), hi = Math.max(th0, th1);
    const base: Curve3 = { kind: 'arc', c: add(s.c, scale(s.a, v0)), n: s.a, r: s.r, u: unit(add(scale(s.e1, Math.cos(lo)), scale(s.e2, Math.sin(lo)))), sweep: Math.max(hi - lo, 1e-9) };
    const curve = nurbs(base, `${id}_b${pi}`, arcAt(base, 0), arcAt(base, base.sweep));
    return { surface: { kind: 'surface', id: `${id}_s${pi}`, degreeU: curve.degree, degreeV: 1, knotsU: [...curve.knots], knotsV: [0, 0, 1, 1],
      controlPoints: curve.controlPoints.map(q => [q, add(q, scale(s.a, v1 - v0))]), weights: curve.weights.map(w => [w, w]) }, sense: s.s * p.out > 0 ? 'forward' : 'reversed' };
  };
  const result = buildBrep({ source: { family: 'analytic-boolean', id },
    vertices: vertexList,
    edges: edgeList.filter((_, i) => uses.has(i)),
    bodies: bodies.map((bd, k) => ({ id: `${id}_body${k}`, kind: 'solid' as const, shells: [bd.outer, ...bd.cavities].map((g, si) => ({ id: 's' + si, closed: true,
      faces: g.members.map(pi => ({ id: 'f' + pi, name: faceNames[pi], ...surface(pi), loops: loops[pi].map((uses2, li) => ({ kind: li === 0 ? 'outer' as const : 'inner' as const, uses: uses2.map(u => ({ edge: u.edge, sense: u.sense })) })) })) })) })),
    toleranceMM: tol });
  // Solids that touch at a vertex give a non-manifold result; refuse it plainly (as for edges).
  const report = checkBrep(result);
  if (!report.valid) throw new BrepError('TOPOLOGY', `analytic Boolean: the result is not a manifold solid (the inputs touch along an edge or at a vertex): ${report.issues[0]}`, report);
  return result;
}
