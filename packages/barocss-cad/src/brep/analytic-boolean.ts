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
import { revolutionOf, profileCrossings, onPatch, patchMargin, type Revolution } from '../nurbs/surfaces/surface-revolution.js';
import { curvePiece, curveReversed } from '../nurbs/curves/curve-segment.js';
import { BrepError, buildBrep, checkBrep, isFacetFace, lineCurve, nurbsOf as surfaceOfFace, type Brep, type BrepFace } from './brep-core.js';
import { facetPlane } from '../mesh/facet-patch.js';
import { circleOf, polesOf, tessellateBrep } from './brep-tessellate.js';
import { booleanCurveRegions, regionBox, curveFaceRegions, intersectSegments, segmentsApart, segAt as segAtAny, locateInRegion, paramOf as paramOfCurve, regionArea, regionInteriorPoint, segDistance, segIntegral, segReverse, type CurveRegion2, type CurveSegment2, type XY } from './curved-arrangement.js';
import { nameEdges } from '../features/prismatic-solid.js';
import { baseName } from './polyhedral-boolean.js';
import { evaluateCurve, evaluateSurface, curveDomain, curveEvaluator, surfaceDomain, surfaceEvaluator, validateCurve } from '../core/math.js';
import { catmullRom, chainNeighbours, surfaceIsoclines } from '../nurbs/surfaces/surface-isocline.js';
import { chainCurve, intersectPatches, SurfaceIntersectionError, type IntersectionChain } from '../intersect/surface-intersection.js';
import { triangulatePolygonWithHoles } from './brep-tessellate.js';
import { linearToleranceMM } from '../numeric-policy.js';
import { add, cross, dot, len, scale, sub, unit } from '../core/vec3.js';
import type { Curve, Point, Surface } from '../types.js';
import { maxAt, minAt } from '../core/extent.js';

export type AnalyticBooleanOperation = 'union' | 'intersection' | 'difference';

type P3 = Point;
const TWO_PI = 2 * Math.PI;
// Fractions along a curve where it is checked (sample points, fixed).
const AT_QUARTERS: readonly number[] = [0, 0.25, 0.5, 0.75, 1], AT_FIFTHS: readonly number[] = [0, 0.2, 0.4, 0.6, 0.8, 1], AT_TENTHS: readonly number[] = [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1];
const INNER_QUARTERS: readonly number[] = [0.25, 0.5, 0.75], INNER_3: readonly number[] = [0.2, 0.5, 0.8], INNER_TENTHS: readonly number[] = [0.1, 0.3, 0.5, 0.7, 0.9], NEAR_ENDS_3: readonly number[] = [0.1, 0.5, 0.9];

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
  let Lu = 0, Lv = 0; for (let i = 0; i < 8; i++) { const a = U[0] + (U[1] - U[0]) * (i + 0.5) / 8, b = V[0] + (V[1] - V[0]) * (i + 0.5) / 8; for (let k = 0; k < 8; k++) { Lu += len(sub(at(k === 7 ? U[1] : U[0] + (U[1] - U[0]) * (k + 1) / 8, b), at(U[0] + (U[1] - U[0]) * k / 8, b))) / 8; Lv += len(sub(at(a, k === 7 ? V[1] : V[0] + (V[1] - V[0]) * (k + 1) / 8), at(a, V[0] + (V[1] - V[0]) * k / 8))) / 8; } }
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
  // (The last row at the domain's end itself: U0 + (U1 − U0)·24/24 can round past it.)
  for (let i = 0; i <= 24; i++) for (let j = 0; j <= 24; j++) { const a = i === 24 ? U[1] : U[0] + (U[1] - U[0]) * i / 24, b = j === 24 ? V[1] : V[0] + (V[1] - V[0]) * j / 24; grid.push({ p: [a, b], x: at(a, b) }); }
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
  /** The source face's id. */
  id: string;
}
/** A 3D curve piece: a segment, or an arc about c in the plane ⊥ n from u through `sweep` (≥ 0, CCW about n). */
type Curve3 = { kind: 'line'; p: P3; q: P3 } | { kind: 'arc'; c: P3; n: P3; r: number; u: P3; sweep: number }
  /** A smooth curve on the parameter range t0 → t1 (either order). */
  | { kind: 'param'; at: (t: number) => P3; t0: number; t1: number; /** `at` is an exact curve (a line or arc's map onto a general face), not a fit. */ exact?: boolean; /** `at` is this input edge's curve (t its own parameter): its pieces stay it, exactly (D90). */ src?: Curve };
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
  const S = surfaceOfFace(face, 'analytic Boolean'), sign = face.sense === 'forward' ? 1 : -1, [u0, u1] = surfaceDomain(S).u, [v0, v1] = surfaceDomain(S).v;
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
  if (!k) { const at = curveEvaluator(c); return { kind: 'param', at, t0: forward ? t0 : t1, t1: forward ? t1 : t0, src: c }; }
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
    // (The source curve's interior knots as fractions of the range: its pieces' joins, D150.)
    const breaks = k.kind === 'param' && k.src ? [...new Set(k.src.knots)].map(x => (x - t0) / (t1 - t0)).filter(u => u > 0 && u < 1) : [];
    return { kind: 'curve', f: tabulated(s, g, at3, t0, t1, breaks), t0, t1, src: at3, ...t, ...(k.kind !== 'param' || k.exact ? { exact: true } : {}), ...(k.kind === 'param' && k.src ? { srcCurve: k.src } : {}) } as CurveSegment2;
  }
  if (k.kind === 'param') return { kind: 'curve', f: cached(x => to2(f, k.at(x))), t0: k.t0, t1: k.t1, src: k.at, ...t, ...(k.src ? { srcCurve: k.src } : {}) } as CurveSegment2;
  if (k.kind === 'line') {
    const a = to2(f, k.p), b = to2(f, k.q);
    if (s.kind === 'cylinder' && Math.abs(a[0] - b[0]) > Math.max(tol, 1e-9 * s.r)) throw new BrepError('GEOMETRY', 'analytic Boolean: a straight edge on a cylinder runs across its axis direction');
    return { kind: 'line', a, b: s.kind === 'cylinder' ? [a[0], b[1]] : b, ...t };
  }
  const start = arcAt(k, 0);
  if (s.kind === 'plane') {
    const c2 = to2(f, k.c), a = to2(f, start), turn = dot(k.n, s.n);
    // (A short arc tilted off its face's plane, its points within the stitch's merge radius of it — rebuilt through end
    // vertices the stitch moved — maps into the plane as a curve, as one on a cylinder's wall does (D202). One farther
    // off is refused. L4 fuzz 20261024 #112, D262.)
    if (Math.abs(Math.abs(turn) - 1) > 1e-9) {
      if (!arcNearPlane(k, s, 20 * tol)) throw new BrepError('GEOMETRY', 'analytic Boolean: an arc does not lie in its plane');
      const at = (x: number) => arcAt(k, x); return { kind: 'curve', f: cached(x => to2(f, at(x))), t0: 0, t1: k.sweep, src: at, ...t } as CurveSegment2;
    }
    return { kind: 'arc', c: c2, r: k.r, t0: Math.atan2(a[1] - c2[1], a[0] - c2[0]), sweep: k.sweep * Math.sign(turn), ...t };
  }
  const along = dot(k.n, s.a);
  // (An arc on the wall that is no cross-section — a short piece of a traced curve made an exact arc within the tolerance,
  // as any curve's is: a sphere's meeting with the cylinder, 0.06 mm of it — maps into the domain as a curve does.
  // L4 fuzz 176, D202.)
  if (Math.abs(Math.abs(along) - 1) > 1e-9) { const at = (x: number) => arcAt(k, x); return { kind: 'curve', f: cached(x => to2(f, at(x))), t0: 0, t1: k.sweep, src: at, ...t } as CurveSegment2; }
  const a = to2(f, start);
  return { kind: 'line', a, b: [a[0] + s.s * s.r * k.sweep * Math.sign(along), a[1]], ...t };
}
/** Whether an arc's points (17 along it) all lie within `reach` of a plane. */
function arcNearPlane(k: Extract<Curve3, { kind: 'arc' }>, P: Plane, reach: number): boolean {
  for (let i = 0; i <= 16; i++) if (Math.abs(dot(sub(arcAt(k, k.sweep * i / 16), P.o), P.n)) > reach) return false;
  return true;
}
/**
 * A curve's map into a general patch's domain, tabulated once at 129 exact projections with exact
 * derivatives (the surface Jacobian's pseudo-inverse applied to the curve's tangent) and evaluated by
 * cubic Hermite interpolation: about (span / 128)⁴ off, far below tolerance, where every exact
 * evaluation would cost a Newton projection. Curves through a pole (a singular map) stay exact.
 * `breaks` (fractions of the range): the source curve's interior knots, made samples too, each with its
 * tangent from either side — a curve of C0 pieces (an edge of two fitted spans meeting at a corner) is
 * interpolated piece by piece; one sample's tangent averaged across such a knot put both intervals beside
 * it up to 4e-4 mm off (a bevel pair's toe edges, D150).
 */
function tabulated(s: Nurbs, g: (x: number) => XY, at3: (x: number) => P3, t0: number, t1: number, breaks: readonly number[] = []): (x: number) => XY {
  const exact = memo(g), N = 128, span = t1 - t0;
  // Sample fractions: the uniform 128 with the breaks among them (a uniform one within 1e-9 of a break gives way).
  const inner = breaks.filter(b => b > 1e-9 && b < 1 - 1e-9).sort((a, b) => a - b);
  const F: number[] = [], isBreak: boolean[] = [];
  for (let i = 0, k = 0; i <= N; i++) {
    const u = i / N;
    while (k < inner.length && inner[k] < u - 1e-9) { F.push(inner[k]); isBreak.push(true); k++; }
    if (k < inner.length && Math.abs(inner[k] - u) <= 1e-9) { F.push(inner[k]); isBreak.push(true); k++; continue; }
    F.push(u); isBreak.push(false);
  }
  let table: { p: XY[]; dl: XY[]; dr: XY[] } | null | false = null, n = F.length - 1;
  const build = () => {
    // (Beside a pole the map turns fast — much of a turn of u where a curve passes a ball's pole 0.02 mm off, between two
    // of the 128 samples — and the Hermite pieces overshoot there, a loop in the domain. Samples are added where the curve
    // passes nearer a pole than twice their spacing. L4 fuzz 20261024 #138, D250.)
    if (s.poles.length) { nearPoles(F, isBreak, s.poles, at3, t0, span, s.size); n = F.length - 1; }
    const p: XY[] = [], dl: (XY | null)[] = [], dr: (XY | null)[] = [];
    const lo = Math.min(t0, t1), hi = Math.max(t0, t1);
    /**
     * The domain rate of the curve for its tangent dP at the domain point q (null where the Jacobian is singular). `toward`:
     * the side of the domain the curve leaves q into, the surface's derivatives taken on that side (across a C0 knot line of
     * the surface — a flank of two spans — the two sides' Jacobians differ).
     */
    const rate = (q: XY, dP: P3, toward?: XY): XY | null => {
      const u = Math.min(s.U[1], Math.max(s.U[0], q[0] / s.ku)), v = Math.min(s.V[1], Math.max(s.V[0], q[1] / s.kv)), hu = 1e-7 * (s.U[1] - s.U[0]), hv = 1e-7 * (s.V[1] - s.V[0]);
      const su = toward && toward[0] * s.ku < 0 ? -1 : 1, sv = toward && toward[1] * s.kv < 0 ? -1 : 1;
      const ua = u + su * hu <= s.U[1] && u + su * hu >= s.U[0] ? u + su * hu : u - su * hu, va = v + sv * hv <= s.V[1] && v + sv * hv >= s.V[0] ? v + sv * hv : v - sv * hv, Q = s.ev(u, v);
      const Su = scale(sub(s.ev(ua, v), Q), 1 / (ua - u)), Sv = scale(sub(s.ev(u, va), Q), 1 / (va - v));
      const g11 = dot(Su, Su), g12 = dot(Su, Sv), g22 = dot(Sv, Sv), det = g11 * g22 - g12 * g12, r1 = dot(Su, dP), r2 = dot(Sv, dP);
      if (!(det > 1e-24 * (g11 + g22) ** 2)) return null;
      return [(r1 * g22 - r2 * g12) / det * s.ku, (g11 * r2 - g12 * r1) / det * s.kv];
    };
    for (let i = 0; i <= n; i++) {
      const x = t0 + span * F[i], q = exact(x), P = at3(x);
      p.push(q);
      // At a pole the map's derivative comes from the neighbouring samples (below).
      if (s.poles.some(o => len(sub(P, o.point)) <= 1e-6 * (s.size + 1))) { dl.push(null); dr.push(null); continue; }
      const h = 1e-6 * span;
      if (isBreak[i]) {
        // Either side's tangent by a one-sided second-order difference, within that side's piece.
        const side = (sg: 1 | -1): XY | null => {
          const a = at3(x + sg * h), b = at3(x + sg * 2 * h), qa = exact(x + sg * 2 * h);
          return rate(q, scale(add(scale(P, -3), sub(scale(a, 4), b)), 1 / (2 * sg * h)), [qa[0] - q[0], qa[1] - q[1]]);
        };
        dl.push(side(-1)); dr.push(side(1));
        continue;
      }
      const xa = Math.max(lo, Math.min(hi, x - h)), xb = Math.max(lo, Math.min(hi, x + h));
      const d = rate(q, scale(sub(at3(xb), at3(xa)), 1 / (xb - xa)));
      dl.push(d); dr.push(d);
    }
    // Second-order one-sided differences over the (uneven) samples where the Jacobian is singular.
    const fill = (d: (XY | null)[]): XY[] | false => {
      const out: XY[] = [];
      for (let i = 0; i <= n; i++) {
        const di = d[i]; if (di) { out.push(di); continue; }
        const [j1, j2] = i + 2 <= n && (i === 0 || i < n / 2) ? [i + 1, i + 2] : i - 2 >= 0 ? [i - 1, i - 2] : [-1, -1];
        if (j1 < 0) return false;
        const h1 = span * (F[j1] - F[i]), h2 = span * (F[j2] - F[i]);
        out.push([0, 1].map(k => ((p[j1][k] - p[i][k]) * h2 * h2 - (p[j2][k] - p[i][k]) * h1 * h1) / (h1 * h2 * (h2 - h1))) as XY);
      }
      return out;
    };
    const L = fill(dl), R = fill(dr);
    return L && R ? { p, dl: L, dr: R } : false;
  };
  return x => {
    if (table === null) table = build();
    if (table === false || !(span !== 0)) return exact(x);
    const f = (x - t0) / span;
    // The interval holding f (binary search over the sample fractions).
    let a = 0, b = n;
    while (b - a > 1) { const m = (a + b) >> 1; if (F[m] <= f) a = m; else b = m; }
    const h = F[b] - F[a], u = (f - F[a]) / h;
    if (u <= 0) return table.p[a];
    if (u >= 1) return table.p[b];
    const u2 = u * u, u3 = u2 * u, H = h * span, P0 = table.p[a], P1 = table.p[b], D0 = table.dr[a], D1 = table.dl[b];
    const h00 = 2 * u3 - 3 * u2 + 1, h10 = (u3 - 2 * u2 + u) * H, h01 = -2 * u3 + 3 * u2, h11 = (u3 - u2) * H;
    return [P0[0] * h00 + D0[0] * h10 + P1[0] * h01 + D1[0] * h11, P0[1] * h00 + D0[1] * h10 + P1[1] * h01 + D1[1] * h11];
  };
}
/**
 * The sample fractions F (with `isBreak` alongside), each interval where the curve passes nearer a pole than twice its
 * length cut in up to 64, so the pieces there are a quarter of the way to the pole at most. Not where it reaches the pole
 * (within 1e-6 of the surface's size): the pole's parameter is the free one's limit there (D235), and samples beside it
 * would each take whatever u the projection settles on.
 */
function nearPoles(F: number[], isBreak: boolean[], poles: readonly { point: P3 }[], at3: (x: number) => P3, t0: number, span: number, size: number): void {
  const out: number[] = [], brk: boolean[] = [];
  let P0 = at3(t0 + span * F[0]);
  for (let i = 0; i + 1 < F.length; i++) {
    out.push(F[i]); brk.push(isBreak[i]);
    const P1 = at3(t0 + span * F[i + 1]), Pm = at3(t0 + span * (F[i] + F[i + 1]) / 2), seg = len(sub(P1, P0));
    let d = Infinity;
    for (const o of poles) d = Math.min(d, len(sub(P0, o.point)), len(sub(P1, o.point)), len(sub(Pm, o.point)));
    if (d < 2 * seg && d > 1e-6 * (size + 1)) { const m = Math.min(64, Math.ceil(4 * seg / d)); for (let j = 1; j < m; j++) { out.push(F[i] + (F[i + 1] - F[i]) * j / m); brk.push(false); } }
    P0 = P1;
  }
  out.push(F[F.length - 1]); brk.push(isBreak[isBreak.length - 1]);
  F.length = 0; F.push(...out); isBreak.length = 0; isBreak.push(...brk);
}
/** A curve's domain map, remembered per parameter (each one costs a surface projection on a general surface). */
function memo(g: (x: number) => XY): (x: number) => XY {
  const seen = new Map<number, XY>();
  return x => { let r = seen.get(x); if (!r) { r = g(x); if (seen.size < 1 << 16) seen.set(x, r); } return r; };
}
// One direct-mapped cache shared by every curve's analytic domain map (a pure function of the parameter): a slot holds
// the curve's id, the parameter and the point. A fixed size, unlike a Map a curve, so a long Boolean keeps no millions
// of entries alive; a slot taken by another (curve, parameter) only costs a recomputation of the same value.
const CACHE_BITS = 16, cacheX = new Float64Array(1 << CACHE_BITS), cacheId = new Int32Array(1 << CACHE_BITS), cacheP: (XY | undefined)[] = new Array(1 << CACHE_BITS);
const bitsF = new Float64Array(1), bitsU = new Uint32Array(bitsF.buffer);
let cacheNext = 0;
function cacheSlot(id: number, x: number): number {
  bitsF[0] = x;
  return Math.imul(bitsU[0] ^ Math.imul(bitsU[1], 0x85ebca6b) ^ Math.imul(id, 0xc2b2ae35), 0x9e3779b1) >>> (32 - CACHE_BITS);
}
/** g remembered in the shared cache (g pure: a recomputation gives the same point). */
function cached(g: (x: number) => XY): (x: number) => XY {
  const id = cacheNext = cacheNext === 0x7fffffff ? 1 : cacheNext + 1;
  return x => {
    const i = cacheSlot(id, x);
    if (cacheId[i] === id && cacheX[i] === x) return cacheP[i]!;
    const r = g(x); cacheId[i] = id; cacheX[i] = x; cacheP[i] = r; return r;
  };
}
/** A 2D segment of a face's domain as a 3D curve. */
function curve3Of(f: { surf: Surf }, g: CurveSegment2): Curve3 {
  const s = f.surf;
  if (g.kind === 'curve') { const src = g.src as ((t: number) => P3) | undefined, curve = (g as { srcCurve?: Curve }).srcCurve; return { kind: 'param', at: src ?? (x => to3(f, g.f(x))), t0: g.t0, t1: g.t1, ...(src && (g as { exact?: boolean }).exact ? { exact: true } : {}), ...(src && curve ? { src: curve } : {}) }; }
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
    if (surf.kind === 'nurbs') for (const row of surfaceOfFace(face).controlPoints) for (const p of row) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]); }
    return { solid, surf, region: { outer: rings[0], holes: rings.slice(1) }, out: 1 as const, min, max, ...(face.name === undefined ? {} : { name: baseName(face.name) }), cuts: [], id: face.id };
  });
}

/**
 * The intervals of [lo, hi] (sampled at N + 1 points) where `margin` > 0 that lie between samples outside (margin < 0) and
 * inside no interval of `found`: at each sample outside where the margin peaks among its neighbours (one, at an end), its
 * maximum between them (golden section) and, when that is inside, the two crossings (bisection).
 */
function betweenSamples(margin: (t: number) => number, lo: number, hi: number, N: number, found: readonly [number, number][]): [number, number][] {
  const out: [number, number][] = [], at = (i: number) => lo + (hi - lo) * i / N, m = Array.from({ length: N + 1 }, (_, i) => margin(at(i)));
  for (let i = 0; i <= N; i++) {
    // (At an end the bracket is the one chord beside it.)
    const p = Math.max(0, i - 1), q = Math.min(N, i + 1);
    if (!(m[i] < 0 && m[p] < 0 && m[q] < 0 && m[i] >= m[p] && m[i] >= m[q])) continue;
    let a = at(p), b = at(q);
    if (found.some(([x, y]) => x < b && y > a)) continue;
    for (let k = 0; k < 80; k++) { const c = b - (b - a) * 0.6180339887, d = a + (b - a) * 0.6180339887; if (margin(c) > margin(d)) b = d; else a = c; }
    const top = (a + b) / 2; if (!(margin(top) > 0)) continue;
    let l0 = at(p), l1 = top, r0 = top, r1 = at(q);
    for (let k = 0; k < 60; k++) { const x = (l0 + l1) / 2; if (margin(x) > 0) l1 = x; else l0 = x; const y = (r0 + r1) / 2; if (margin(y) > 0) r0 = y; else r1 = y; }
    out.push([(l0 + l1) / 2, (r0 + r1) / 2]);
  }
  return out;
}
/** One root of a crossing-cylinder quadratic as a curve in the smaller cylinder's angle. */
const branchOf = (point: (th: number, sign: number) => P3, sign: number) => (th: number) => point(th, sign);

// ---- intersections ---------------------------------------------------------------------------------
/** Parameter intervals of a curve (line: t along d from p; circle: φ from the frame's e1) inside a face. */
type Probe = { kind: 'line'; p: P3; d: P3; lo: number; hi: number } | { kind: 'circle'; c: P3; n: P3; e1: P3; r: number; lo: number } | { kind: 'param'; at: (t: number) => P3; lo: number; hi: number };
function intervals(f: GFace, k: Probe, tol: number, strict = false): [number, number][] {
  const params: number[] = [];
  let probe: CurveSegment2[], past: CurveSegment2[] = [], param: (x: P3) => number, at: (t: number) => P3;
  if (k.kind === 'param') {
    at = k.at;
    // In a cylinder domain the curve is cut where it crosses the domain's seam (θ = ref ± π), so each
    // piece maps continuously.
    const ranges = seamRanges(f, at, k.lo, k.hi);
    // (On a general face the probe's domain map is tabulated like any curve's.)
    const pieces = ranges.map(([a, b]) => f.surf.kind === 'nurbs' ? { ...(curve2(f, { kind: 'param', at, t0: a, t1: b }, tol) as Extract<CurveSegment2, { kind: 'curve' }>), t0: a, t1: b } : { kind: 'curve' as const, f: (x: number) => to2(f, at(x)), t0: a, t1: b });
    params.push(...ranges.flat());
    const rings = [f.region.outer, ...f.region.holes];
    // (Against a plane face's straight edges a shallow graze inside a chord is looked for too, by bisection: RB K9, D187.
    // Not on a cylinder's domain lines: a cut running along a rounded tube's ruling would cross it at its rounding noise.)
    const graze = f.surf.kind === 'plane';
    for (const pr of pieces) for (const ring of rings) for (const g of ring) if (!segmentsApart(pr, g, tol)) for (const x of intersectSegments(pr, g, tol, graze && g.kind === 'line')) params.push(pr.t0 + (pr.t1 - pr.t0) * paramOfCurve(pr, x));
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
    // (A cross-section's half that runs past the domain's seam — a line in (U, V) beyond the window — goes on from the
    // window's other side: a face over most of a turn has its edges there too, and the line past the window met none of
    // them. The part past the window is probed there too; the halves stay as they are. L4 fuzz 151, D206.)
    if (f.surf.kind === 'cylinder') { const c = f.surf; past = probe.flatMap(g => wrappedPast(g, c)); }
    params.push(k.lo, norm(s0), norm(s0 + Math.PI), k.lo + TWO_PI);
  }
  const rings = [f.region.outer, ...f.region.holes], found: P3[] = [];
  for (const pr of probe) for (const ring of rings) for (const g of ring) if (!segmentsApart(pr, g, tol)) for (const x of intersectSegments(pr, g, tol)) { const y = to3(f, x); found.push(y); params.push(param(y)); }
  // (Only crossings the halves did not find: on a face round the whole turn the seam's is found by both.)
  for (const pr of past) for (const ring of rings) for (const g of ring) if (!segmentsApart(pr, g, tol)) for (const x of intersectSegments(pr, g, tol)) { const y = to3(f, x); if (!found.some(q => len(sub(q, y)) <= 10 * tol)) params.push(param(y)); }
  return insideIntervals(f, params, at, tol);
}
/** The parts of a line along U in a cylinder's domain that run past its window's ends, each moved by a turn into the window. */
function wrappedPast(g: CurveSegment2, c: Cylinder): CurveSegment2[] {
  if (g.kind !== 'line' || g.a[1] !== g.b[1]) return [];
  const w0 = Math.min(c.s * c.r * (c.ref - Math.PI), c.s * c.r * (c.ref + Math.PI)), w1 = Math.max(c.s * c.r * (c.ref - Math.PI), c.s * c.r * (c.ref + Math.PI)), turn = w1 - w0;
  const lo = Math.min(g.a[0], g.b[0]), hi = Math.max(g.a[0], g.b[0]), v = g.a[1], out: CurveSegment2[] = [];
  if (hi > w1) { const b = Math.min(w1, hi - turn); if (b > w0) out.push({ ...g, a: [w0, v], b: [b, v] }); }
  if (lo < w0) { const a = Math.max(w0, lo + turn); if (w1 > a) out.push({ ...g, a: [a, v], b: [w1, v] }); }
  return out;
}
/**
 * A parameter strictly inside a traced curve where it passes within 10 tolerances of a pole of either face's surface
 * (nearest of 64 samples, then a golden-section search), or null; the curve's own ends are left to `toPoles` (D208).
 */
function throughPole(k: Extract<Curve3, { kind: 'param' }>, fa: GFace, fb: GFace, tol: number): number | null {
  const span = k.t1 - k.t0;
  for (const f of [fa, fb]) {
    if (f.surf.kind !== 'nurbs') continue;
    for (const pole of f.surf.poles) {
      let best = 0, bd = Infinity;
      for (let i = 0; i <= 64; i++) { const d = len(sub(k.at(k.t0 + span * i / 64), pole.point)); if (d < bd) { bd = d; best = i; } }
      if (best === 0 || best === 64) continue;
      let lo = k.t0 + span * (best - 1) / 64, hi = k.t0 + span * (best + 1) / 64;
      for (let it = 0; it < 60; it++) { const m1 = hi - (hi - lo) * 0.6180339887, m2 = lo + (hi - lo) * 0.6180339887; if (len(sub(k.at(m1), pole.point)) < len(sub(k.at(m2), pole.point))) hi = m2; else lo = m1; }
      const t = (lo + hi) / 2;
      if (len(sub(k.at(t), pole.point)) <= 10 * tol && len(sub(k.at(t), k.at(k.t0))) > 10 * tol && len(sub(k.at(t), k.at(k.t1))) > 10 * tol) return t;
    }
  }
  return null;
}
/**
 * An open chain whose end stops short of a pole on both surfaces — a cone's apex on the other face — goes on to it.
 * (There one surface's normal is undefined, so the march stops a step's fraction away. The cut then ended 1e-4 short of
 * the domain's side at the pole and did not divide the face. L4 fuzz 158, D208.)
 */
function toPoles(chain: IntersectionChain, fa: GFace, fb: GFace, boxA: readonly [XY, XY], boxB: readonly [XY, XY], reach: number, tol: number): IntersectionChain {
  if (chain.closed || chain.points.length < 2) return chain;
  let { points, tangents, uvA, uvB } = chain;
  for (const end of [0, 1] as const) {
    const i = end ? points.length - 1 : 0, x = points[i];
    for (const [f, g] of [[fa, fb], [fb, fa]] as const) {
      if (f.surf.kind !== 'nurbs') continue;
      const pole = f.surf.poles.find(o => len(sub(o.point, x)) > tol && len(sub(o.point, x)) <= reach && offSurface(g, o.point, 10 * tol) <= tol);
      if (!pole) continue;
      // (A march that ran a little past the pole before it stopped — 4.4e-4 mm, where the patch's side collapses to it — is
      // cut back to its point nearest the pole first. The pole put after the overshoot made a hook: the cut passed the
      // pole, turned and came back to it, and the search for the nearest point on it found its own end 1.8e-4 off, so the
      // end lay on no edge and the piece's ring stayed open. Only a short overshoot, within 1000 tolerances. L4 fuzz
      // 20261024 #154, D269.)
      // (Past it: the pole behind the last point, as the march ran.)
      let k = i;
      const march = points, behind = (j: number, from: number) => dot(sub(march[j], march[from]), sub(pole.point, march[j])) < 0;
      if (len(sub(x, pole.point)) <= 1000 * tol) { if (end) while (k > 1 && behind(k, k - 1)) k--; else while (k < points.length - 2 && behind(k, k + 1)) k++; }
      const own = (f === fa ? uvA : uvB)[k], at: XY = pole.along === 0 ? [own[0], pole.at] : [pole.at, own[1]], other = to2(g, pole.point);
      const [pa, pb] = f === fa ? [at, other] : [other, at];
      if (!inBox(pa, boxA, tol) || !inBox(pb, boxB, tol)) continue;
      if (k !== i) { const [s0, s1] = end ? [0, k + 1] : [k, points.length]; points = points.slice(s0, s1); tangents = tangents.slice(s0, s1); uvA = uvA.slice(s0, s1); uvB = uvB.slice(s0, s1); }
      const y = points[end ? points.length - 1 : 0], t = unit(end ? sub(pole.point, y) : sub(y, pole.point));
      if (end) { points = [...points, pole.point]; tangents = [...tangents, t]; uvA = [...uvA, pa]; uvB = [...uvB, pb]; }
      else { points = [pole.point, ...points]; tangents = [t, ...tangents]; uvA = [pa, ...uvA]; uvB = [pb, ...uvB]; }
      break;
    }
  }
  return points === chain.points ? chain : { points, tangents, closed: false, uvA, uvB };
}
const inBox = (p: XY, box: readonly [XY, XY], tol: number) => p[0] >= box[0][0] - tol && p[0] <= box[1][0] + tol && p[1] >= box[0][1] - tol && p[1] <= box[1][1] + tol;
/**
 * A piece's sampled domain polygon triangulated; one whose outer ring passes a point twice — a piece pinched at a vertex,
 * two lobes meeting there within the tolerance — is cut there into simple rings, each triangulated; a lobe turning
 * the other way (a hole touching the boundary at that point) is triangulated reversed and counts negatively. (Ear clipping failed on the pinch. L4
 * fuzz 137, D209.) A hole goes with the lobe it lies in (a cylinder wall's piece whose cut loop touches the seam, with the
 * ball's own cut as a hole beside it: L4 fuzz 20261023 #110, D270).
 */
function triangulatePinched(outer: readonly XY[], holes: readonly (readonly XY[])[], tol: number): [number, number, number][] {
  try { return triangulatePolygonWithHoles(outer, holes); } catch (e) {
    if (!(e instanceof BrepError)) throw e;
    const rings: number[][] = [], stack: number[] = [];
    for (let i = 0; i < outer.length; i++) {
      const at = stack.findIndex(k => Math.hypot(outer[k][0] - outer[i][0], outer[k][1] - outer[i][1]) <= tol);
      if (at >= 0) { rings.push(stack.splice(at)); }
      stack.push(i);
    }
    rings.push(stack);
    if (rings.length < 2) throw e;
    const out: [number, number, number][] = [], areas = rings.map(r => { let area = 0; for (let i = 0; i < r.length; i++) { const a = outer[r[i]], b = outer[r[(i + 1) % r.length]]; area += a[0] * b[1] - b[0] * a[1]; } return area; });
    // (Each hole with the counter-clockwise lobe holding its first point; its indices are the caller's, after the outer ring's.)
    const owner = holes.map(h => rings.findIndex((r, k) => areas[k] > 0 && inRing(h[0], r, outer)));
    if (owner.some(k => k < 0)) throw e;
    const starts: number[] = []; let at = outer.length; for (const h of holes) { starts.push(at); at += h.length; }
    rings.forEach((r, k) => {
      // (A lobe turning the other way is a hole touching the boundary there: its triangles count negatively.)
      const area = areas[k], ring = area < 0 ? [...r].reverse() : r, mine = holes.map((_, j) => j).filter(j => owner[j] === k);
      const index = [...ring, ...mine.flatMap(j => holes[j].map((_, i) => starts[j] + i))];
      for (const [a, b, c] of triangulatePolygonWithHoles(ring.map(q => outer[q]), mine.map(j => holes[j]))) out.push(area < 0 ? [index[a], index[c], index[b]] : [index[a], index[b], index[c]]);
    });
    return out;
  }
}
/** Whether p lies inside the ring of `pts` indexed by `ring` (even-odd). */
function inRing(p: XY, ring: readonly number[], pts: readonly XY[]): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = pts[ring[i]], b = pts[ring[j]]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; }
  return c;
}
/** A curve's parameter range cut where it crosses a cylinder face's domain seam (θ = ref ± π), so each piece maps continuously. */
function seamRanges(f: GFace, at: (t: number) => P3, lo: number, hi: number): [number, number][] {
  if (f.surf.kind !== 'cylinder') return [[lo, hi]];
  const ranges: [number, number][] = [], n = 256, U = (t: number) => to2(f, at(t))[0], jump = Math.PI * f.surf.r;
  let start = lo, prev = U(lo);
  for (let i = 1; i <= n; i++) {
    let t = lo + (hi - lo) * i / n; const u = U(t);
    if (Math.abs(u - prev) > jump) {
      let a = lo + (hi - lo) * (i - 1) / n, b = t; const ua = U(a);
      for (let it = 0; it < 60; it++) { const m = (a + b) / 2; if (Math.abs(U(m) - ua) > jump) b = m; else a = m; }
      ranges.push([start, a]); start = b; t = b;
    }
    prev = U(t);
  }
  ranges.push([start, hi]);
  return ranges;
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

/** Where a cut is tested for lying along its face's boundary, and where, then, for running off it too (D258). */
const ON_BOUNDARY_AT = [0.2, 0.5, 0.8], PARTLY_OFF_AT = [0.05, 0.1, 0.35, 0.65, 0.9, 0.95];
class Refused extends BrepError { constructor(detail: string) { super('GEOMETRY', 'analytic Boolean: ' + detail); } }

/** The source curves already cut into a face along a contact (each once). */
const contactCuts = new WeakMap<GFace, Set<unknown>>();
/** Whether one of f's boundary edges lies on g's surface. */
function edgeOnSurface(f: GFace, g: GFace, tol: number): boolean {
  for (const ring of [f.region.outer, ...f.region.holes]) for (const seg of ring) {
    const k = curve3Of(f, seg);
    if (AT_QUARTERS.every(u => offSurface(g, pointOf(k, u), tol) <= tol)) return true;
  }
  return false;
}
/** A face's domain box for marching (its boundary's samples, padded; a patch's clamped to its domain), made once a face. */
const marchBoxes = new WeakMap<GFace, [XY, XY]>();
/**
 * Whether a patch keeps more than `gap` from a plane or an infinite cylinder: every control point (the patch lies in their
 * hull, weights positive) on one side of the plane; or, about the cylinder's axis, every one inside it by `gap`, or every
 * one beyond a line tangent to its section, pushed out by `gap`, square to their mean direction. Conservative: false
 * whenever it cannot tell.
 */
function patchClearOf(n: Nurbs, s: Plane | Cylinder, gap: number): boolean {
  const P = n.S.controlPoints, W = n.S.weights;
  for (const row of W) for (const w of row) if (!(w > 0)) return false;
  if (s.kind === 'plane') {
    let above = 0, below = 0, count = 0;
    for (const row of P) for (const q of row) { const d = dot(sub(q, s.o), s.n); count++; if (d > gap) above++; else if (d < -gap) below++; else return false; }
    return above === count || below === count;
  }
  // Radial vectors of the control points (off the axis), their mean.
  let inside = true, mx = 0, my = 0, mz = 0; const R: P3[] = [];
  for (const row of P) for (const q of row) {
    const d = sub(q, s.c), w = sub(d, scale(s.a, dot(d, s.a)));
    R.push(w); mx += w[0]; my += w[1]; mz += w[2];
    if (!(len(w) < s.r - gap)) inside = false;
  }
  if (inside) return true;
  const m = Math.hypot(mx, my, mz); if (!(m > 0)) return false;
  const h: P3 = [mx / m, my / m, mz / m];
  for (const w of R) if (!(dot(w, h) > s.r + gap)) return false;
  return true;
}
function cutPair(fa: GFace, fb: GFace, tol: number, span: number, touching = false, touched: P3[] | null = null): void {
  // (Faces the caller says meet only along edges of one lying on the other — a fillet tool's contacts with the faces it
  // rounds, D89 — are cut there, and nothing is computed: their contact is tangent or along a face's own boundary.)
  if (touching) {
    // (As the edges are: made exact arcs, neighbouring pieces' ends would move apart by their fit. An edge shared by
    // two contact faces — the fillet and its wall — is one cut: two copies of a curve would cross all along it.)
    for (const [f, g] of [[fa, fb], [fb, fa]] as const) for (const ring of [f.region.outer, ...f.region.holes]) for (const seg of ring) {
      const k = curve3Of(f, seg), key = (k.kind === 'param' && k.src) || null, seen = contactCuts.get(g) ?? new Set<unknown>();
      if (key && seen.has(key)) continue;
      if (!AT_FIFTHS.every(u => offSurface(g, pointOf(k, u), tol) <= tol)) continue;
      // (Not where it lies wholly off a planar face: a tool's section edge in the plane of a face it ends beside — a lug's
      // end face, where the ball turns its corner, R10.3a — lies on that face's surface but off the face. Planes only:
      // on a curved face a contact's (u, v) can fall a period over, off the region as drawn.)
      const c2 = curve2(g, k, tol);
      if (g.surf.kind === 'plane' && INNER_3.every(u => locateInRegion(segAtAny(c2, u), g.region, 10 * tol) === 'out')) continue;
      g.cuts.push(c2); if (key) { seen.add(key); contactCuts.set(g, seen); }
    }
    return;
  }
  const addCut = (k: Curve3): void => {
    // (A traced curve through a pole of either face — Viviani's curve through a ball's poles — is cut there: on the pole's
    // surface its two halves arrive at the pole's side of the domain at two places, and one curve across it left the face
    // with no region at all. L4 fuzz 110, D235.)
    if (k.kind === 'param') { const tp = throughPole(k, fa, fb, tol); if (tp !== null) { addCut({ ...k, t1: tp }); addCut({ ...k, t0: tp }); return; } }
    fa.cuts.push(curve2(fa, k, tol)); fb.cuts.push(curve2(fb, k, tol)); };
  // (Each probe on fa first: where it misses fa, fb's search — on a cylinder, its seam scan — is skipped; the overlap is empty either way.)
  const lineCuts = (p: P3, d: P3) => {
    const ia = intervals(fa, { kind: 'line', p, d, lo: -span, hi: span }, tol); if (!ia.length) return;
    for (const [lo, hi] of overlaps(ia, intervals(fb, { kind: 'line', p, d, lo: -span, hi: span }, tol)))
      if ((hi - lo) * len(d) > tol) addCut({ kind: 'line', p: add(p, scale(d, lo)), q: add(p, scale(d, hi)) });
  };
  const circleCuts = (c: P3, n: P3, e1: P3, r: number, lo: number) => {
    const k = { kind: 'circle' as const, c, n, e1, r, lo }, ia = intervals(fa, k, tol); if (!ia.length) return;
    for (const [a, b] of overlaps(ia, intervals(fb, k, tol))) if ((b - a) * r > tol) {
      const e2 = cross(n, e1), u = unit(add(scale(e1, Math.cos(a)), scale(e2, Math.sin(a))));
      addCut({ kind: 'arc', c, n, r, u, sweep: b - a });
    }
  };
  const paramCuts = (at: (t: number) => P3, lo: number, hi: number, march = false) => {
    const ia = intervals(fa, { kind: 'param', at, lo, hi }, tol); if (!ia.length) return;
    for (const [a, b] of overlaps(ia, intervals(fb, { kind: 'param', at, lo, hi }, tol)))
      if (len(sub(at(b), at(a))) > tol || b - a > 1e-6 * (hi - lo)) addCut(march && (A.kind === 'plane' || B.kind === 'plane') ? snapEnds(fa, fb, at, a, b, tol) : { kind: 'param', at, t0: a, t1: b });
  };
  const same = (g: GFace, into: GFace) => { for (const ring of [g.region.outer, ...g.region.holes]) for (const seg of ring) into.cuts.push(curve2(into, curve3Of(g, seg), tol)); };
  const A = fa.surf, B = fb.surf;
  // General surfaces (and degenerate cylinder pairs): march the intersection over both faces' domain
  // boxes, then clip as any curve.
  const march = (): void => {
    // (Broad phase: a patch whose control points keep clear of the other surface — a plane, or the infinite cylinder —
    // by 1000 tolerances lies clear of it (the patch lies in their hull), so nothing here can find a point on both: no
    // edge on the other surface, no seed, no traced chain. The march is skipped.)
    if ((A.kind === 'nurbs' && B.kind !== 'nurbs' && patchClearOf(A, B, 1000 * tol)) || (B.kind === 'nurbs' && A.kind !== 'nurbs' && patchClearOf(B, A, 1000 * tol))) return;
    const box = (f: GFace): [XY, XY] => { const kept = marchBoxes.get(f); if (kept) return kept; const xs: number[] = [], ys: number[] = [];
      for (const ring of [f.region.outer, ...f.region.holes]) for (const g of ring) for (let i = 0; i <= 8; i++) { const q = segAtAny(g, i / 8); xs.push(q[0]); ys.push(q[1]); }
      const mx = (Math.max(...xs) - Math.min(...xs)) * 0.02 + tol, my = (Math.max(...ys) - Math.min(...ys)) * 0.02 + tol;
      const lo: XY = [Math.min(...xs) - mx, Math.min(...ys) - my], hi: XY = [Math.max(...xs) + mx, Math.max(...ys) + my], s = f.surf;
      // A patch ends at its domain: the march stops exactly there (its boundary is the face's edge).
      if (s.kind === 'nurbs') { const u = [s.U[0] * s.ku, s.U[1] * s.ku], v = [s.V[0] * s.kv, s.V[1] * s.kv];
        lo[0] = Math.max(lo[0], Math.min(...u)); hi[0] = Math.min(hi[0], Math.max(...u)); lo[1] = Math.max(lo[1], Math.min(...v)); hi[1] = Math.min(hi[1], Math.max(...v)); }
      const made: [XY, XY] = [lo, hi]; marchBoxes.set(f, made); return made; };
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
          if (!AT_TENTHS.every(u => offSurface(into, pointOf(k, u), tol) <= tol)) continue;
          if (INNER_QUARTERS.every(u => locateInRegion(to2(into, pointOf(k, u)), into.region, 10 * tol) === 'boundary')) continue;
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
      if (AT_FIFTHS.every(u => offSurface(g, pointOf(k, u), tol) <= tol)) { g.cuts.push(curve2(g, k, tol)); along.push(k); }
    }
    const alongWithin = (x: P3, r: number) => along.some(k => onCurve(k, x, r) !== null || len(sub(x, startOf(k))) <= r || len(sub(x, endOf(k))) <= r);
    const onAlong = (x: P3) => alongWithin(x, 10 * tol);
    const PA = { at: (p: XY) => to3Extended(fa, p), box: box(fa) }, PB = { at: (p: XY) => to3Extended(fb, p), box: box(fb) };
    let chains;
    // Ends of curves already found on either face (from their other neighbours) that lie on both surfaces.
    const given = [fa, fb].flatMap(f => f.cuts.flatMap(g => [0, 1].map(u => to3(f, segAtAny(g, u))))).filter(x => offSurface(fa, x, 100 * tol) <= 100 * tol && offSurface(fb, x, 100 * tol) <= 100 * tol);
    try { chains = intersectPatches(PA, PB, { step: Math.max(diag / 80, 50 * tol), tolerance: 100 * tol, ...(along.length ? { skip: onAlong, skipNear: alongWithin } : {}), ...(given.length ? { seeds: given } : {}) }); }
    catch (e) { if (e instanceof SurfaceIntersectionError) throw new Refused(`the surfaces of ${fa.name ?? 'a face'} and ${fb.name ?? 'a face'} meet along a curve that cannot be traced (${e.message.replace(/^Surface intersection: /, '')})`); throw e; }
    const reach = Math.max(diag / 80, 50 * tol);
    for (const chain of chains) {
      // A chain running along such an edge is that edge again.
      if (along.length && chain.points.every(onAlong)) continue;
      if (touched && chain.touches) touched.push(...chain.touches);
      paramCuts(chainCurve(toPoles(chain, fa, fb, PA.box, PB.box, reach, tol), { A: PA, B: PB }), 0, 1, true);
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
      // (A curve that dips onto a patch between two samples — a plane's conic across a patch's corner, 0.035 mm of it, under
      // a 256th of the turn: L4 fuzz 2, D203 — is found where the patch's margin peaks between samples outside it.)
      out.push(...betweenSamples(t => Math.min(...revs.map(R => patchMargin(R, at(t)))), lo, hi, N, out));
      out.sort((x, y) => x[0] - y[0]);
      return out.filter(([a, b]) => b - a > 1e-9 * Math.max(1, hi - lo));
    };
    const piece = (at: (t: number) => P3, lo: number, hi: number, make: (a: number, b: number) => Curve3) => {
      for (const [l, h] of onPatches(at, lo, hi)) {
        const ia = intervals(fa, { kind: 'param', at, lo: l, hi: h }, tol, true); if (!ia.length) continue;
        for (const [a, b] of overlaps(ia, intervals(fb, { kind: 'param', at, lo: l, hi: h }, tol, true))) if (len(sub(at(b), at(a))) > tol || b - a > 1e-6) addCut(make(a, b));
      }
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
        if (!AT_FIFTHS.every(u => offSurface(into, pointOf(k, u), tol) <= tol)) continue;
        if (INNER_QUARTERS.every(u => locateInRegion(to2(into, pointOf(k, u)), into.region, 10 * tol) === 'boundary')) continue;
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
            // (The result's boundary can touch itself there: checked strictly at the end, `touchChecked`.)
            if (touched) for (const th of doubles) touched.push(point(th, 1));
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
    // (A plane tangent to the wall touches it along one ruling: on either side the wall lies to one side of the plane, so
    // the ruling divides neither face — cut in, it left a slit in the plane, two uses of one line, its loops touching.
    // L4 fuzz 191, D189. As a circle where a profile only touches a plane, above.)
    if (h <= tol) return;
    for (const sgn of [-1, 1]) lineCuts(add(foot, scale(w, sgn * h)), C.a);
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
/**
 * A marched cut between t0 and t1 with its ends moved onto the exact points where they cross a boundary edge of either
 * face (that edge meeting the other face's surface). The march traces the curve to its own tolerance (100 × tol), so
 * the cuts of two faces sharing an edge — a lofted tool's patches — ended up to that far apart along it, and a loop of
 * cuts across them did not close (R10.B, D99). Within 300 × tol of such a crossing; the rest of the curve is carried
 * along linearly in t.
 */
function snapEnds(fa: GFace, fb: GFace, at: (t: number) => P3, t0: number, t1: number, tol: number): Curve3 {
  const reach = 300 * tol, moves: P3[] = [];
  for (const t of [t0, t1]) {
    const x = at(t); let best: P3 | null = null, bd = reach;
    for (const [f, g] of [[fa, fb], [fb, fa]] as const) for (const ring of [f.region.outer, ...f.region.holes]) for (const seg of ring) {
      const c = edgeCrossing(curve3Of(f, seg), g, x, reach, tol), d = c ? len(sub(c, x)) : Infinity;
      if (c && d <= bd) { best = c; bd = d; }
    }
    moves.push(best ? sub(best, x) : [0, 0, 0]);
  }
  if (moves.every(m => m[0] === 0 && m[1] === 0 && m[2] === 0)) return { kind: 'param', at, t0, t1 };
  const [m0, m1] = moves, w = t1 - t0;
  return { kind: 'param', at: t => add(at(t), add(scale(m0, (t1 - t) / w), scale(m1, (t - t0) / w))), t0, t1 };
}
/** Where the edge k meets g's surface, near x (within r of it, along k); null if it does not, to rounding. */
function edgeCrossing(k: Curve3, g: GFace, x: P3, r: number, tol: number): P3 | null {
  if (!boxNear(g, x, r)) return null;
  const N = 32; let u0 = 0, d0 = Infinity;
  for (let i = 0; i <= N; i++) { const d = len(sub(pointOf(k, i / N), x)); if (d < d0) { d0 = d; u0 = i / N; } }
  if (d0 > r + len(sub(pointOf(k, 1 / N), pointOf(k, 0)))) return null;
  let lo = Math.max(0, u0 - 1 / N), hi = Math.min(1, u0 + 1 / N);
  for (let it = 0; it < 80 && hi - lo > 1e-15; it++) { const m1 = lo + (hi - lo) * 0.382, m2 = lo + (hi - lo) * 0.618; if (len(sub(pointOf(k, m1), x)) < len(sub(pointOf(k, m2), x))) hi = m2; else lo = m1; }
  u0 = (lo + hi) / 2;
  if (len(sub(pointOf(k, u0), x)) > r) return null;
  const h = 1e-6, speed = len(sub(pointOf(k, Math.min(1, u0 + h)), pointOf(k, Math.max(0, u0 - h)))) / (Math.min(1, u0 + h) - Math.max(0, u0 - h));
  if (!(speed > 0)) return null;
  const off = (u: number) => offSurface(g, pointOf(k, u), Infinity);
  lo = Math.max(0, u0 - 2 * r / speed); hi = Math.min(1, u0 + 2 * r / speed);
  // (An edge lying on that surface — a face's edge in the plane it is cut by — crosses it nowhere in particular.)
  if (off(lo) <= tol && off(hi) <= tol) return null;
  for (let it = 0; it < 100 && hi - lo > 1e-16; it++) { const m1 = lo + (hi - lo) * 0.382, m2 = lo + (hi - lo) * 0.618; if (off(m1) < off(m2)) hi = m2; else lo = m1; }
  const u = (lo + hi) / 2, c = pointOf(k, u);
  return off(u) <= tol && len(sub(c, x)) <= r ? c : null;
}
const boxNear = (f: GFace, x: P3, r: number) => [0, 1, 2].every(i => x[i] >= f.min[i] - r && x[i] <= f.max[i] + r);
function cutDistance(g: CurveSegment2, p: XY): number {
  if (g.kind === 'line') { const d = [g.b[0] - g.a[0], g.b[1] - g.a[1]], l2 = d[0] * d[0] + d[1] * d[1], t = l2 ? Math.max(0, Math.min(1, ((p[0] - g.a[0]) * d[0] + (p[1] - g.a[1]) * d[1]) / l2)) : 0; return Math.hypot(p[0] - g.a[0] - d[0] * t, p[1] - g.a[1] - d[1] * t); }
  if (g.kind === 'arc') {
    const a = Math.atan2(p[1] - g.c[1], p[0] - g.c[0]), lo = Math.min(g.t0, g.t0 + g.sweep), rel = ((a - lo) % TWO_PI + TWO_PI) % TWO_PI;
    if (rel <= Math.abs(g.sweep)) return Math.abs(Math.hypot(p[0] - g.c[0], p[1] - g.c[1]) - g.r);
    const e = [segAtAny(g, 0), segAtAny(g, 1)]; return Math.min(...e.map(q => Math.hypot(q[0] - p[0], q[1] - p[1])));
  }
  return Infinity;
}
function dedupeCuts(cuts: CurveSegment2[], tol: number, planar = false): CurveSegment2[] {
  const exact = cuts.filter(g => g.kind !== 'curve'), eps = 10 * tol, at = (g: CurveSegment2, u: number) => segAtAny(g, u);
  const same = (g: CurveSegment2, h: CurveSegment2) => { const d = (x: XY, y: XY) => Math.hypot(x[0] - y[0], x[1] - y[1]) <= eps; return d(at(g, 0.5), at(h, 0.5)) && ((d(at(g, 0), at(h, 0)) && d(at(g, 1), at(h, 1))) || (d(at(g, 0), at(h, 1)) && d(at(g, 1), at(h, 0)))); };
  const curves = cuts.filter(g => g.kind === 'curve'), lengths = new Map(curves.map(g => [g, polyLength(g)])), rank = (g: CurveSegment2) => g.kind !== 'curve' ? 0 : ((g as { exact?: boolean }).exact ? 4 : 0) + ((g as { srcCurve?: Curve }).srcCurve ? 2 : 0) + (g.src ? 1 : 0);
  const apart = (g: CurveSegment2, h: CurveSegment2) => [0, 0.25, 0.5, 0.75, 1].every(u => curveDistance(h, at(g, u)) <= tol);
  return cuts.filter((g, i) => {
    if (g.kind === 'curve') {
      if (exact.length && INNER_TENTHS.every(u => { const p = at(g, u); return exact.some(e => cutDistance(e, p) <= eps); })) return false;
      // (Along a longer curve cut, end to end — a face's edge in the plane, copied whole as the coplanar face's boundary and
      // again up to where it leaves the other face — it is that cut again: two copies of one curve, apart by rounding
      // along it, would cross all along it, R10.B, D99.)
      const lg = lengths.get(g)!;
      // (On a plane, the same length and within rounding all along — one edge copied twice, the coplanar face's boundary
      // and that edge lying in the plane — one copy is kept, the most exact (an exact curve, then one with its own 3D curve, then
      // the earlier): the arrangement cut the two at every sample where they "crossed" and lost the cycles there.)
      return !curves.some(h => h !== g && ((lengths.get(h)! > lg + eps && AT_QUARTERS.every(u => curveDistance(h, at(g, u)) <= eps))
        || (planar && Math.abs(lengths.get(h)! - lg) <= eps && (rank(h) > rank(g) || (rank(h) === rank(g) && cuts.indexOf(h) < i)) && apart(g, h))));
    }
    return !cuts.slice(0, i).some(h => h.kind !== 'curve' && same(h, g));
  });
}
/** A curve cut's length along a 64-point polyline. */
function polyLength(g: CurveSegment2): number {
  let L = 0, p = segAtAny(g, 0);
  for (let i = 1; i <= 64; i++) { const q = segAtAny(g, i / 64); L += Math.hypot(q[0] - p[0], q[1] - p[1]); p = q; }
  return L;
}
/** The distance from p to a curve cut: nearest of 64 samples, refined by golden section either side. */
function curveDistance(g: CurveSegment2, p: XY): number {
  const d = (u: number) => { const q = segAtAny(g, u); return Math.hypot(q[0] - p[0], q[1] - p[1]); };
  let u0 = 0, d0 = Infinity;
  for (let i = 0; i <= 64; i++) { const x = d(i / 64); if (x < d0) { d0 = x; u0 = i / 64; } }
  let lo = Math.max(0, u0 - 1 / 64), hi = Math.min(1, u0 + 1 / 64);
  for (let it = 0; it < 60; it++) { const m1 = lo + (hi - lo) * 0.382, m2 = lo + (hi - lo) * 0.618; if (d(m1) < d(m2)) hi = m2; else lo = m1; }
  return Math.min(d0, d((lo + hi) / 2));
}
/** A parametric curve that is a segment or a circular arc (to within `tol`), as one (exact domain maps, fast arrangements). */
function exactly(k: Curve3, tol: number): Curve3 {
  if (k.kind !== 'param') return k;
  const P = Array.from({ length: 17 }, (_, i) => paramAt(k, i / 16)), a = P[0], b = P[16], m = P[8];
  const ab = sub(b, a), l = len(ab);
  if (l > tol && P.every(p => len(cross(sub(p, a), ab)) / l <= tol)) return { kind: 'line', p: a, q: b };
  // The circle through its ends and middle (a closed curve through a quarter instead).
  // (Turning from the start through the middle to the end; a closed curve through its quarter to its middle — taken the
  // other way round, the turn of a whole circle came out reversed, D149.)
  const closed = len(sub(b, a)) <= tol, u = closed ? sub(P[4], a) : sub(m, a), v = closed ? sub(m, a) : sub(b, a), n = cross(u, v), nn = dot(n, n);
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
/**
 * Whether a result's boundary touches itself at x (normal n of a surface there): the points a step either side along n
 * both outside it, or both inside one body of it.
 */
function selfTouch(result: Brep, x: P3, n: P3, tol: number): boolean {
  const faces = facesOf(result, 0, tol), body = new Map(result.shells.map(s => [s.id, s.body])), step = 1e3 * tol;
  const of = result.faces.map(f => body.get(f.shell)), bodies = [...new Set(of)];
  const sideIn = (p: P3) => bodies.filter(bd => classify(p, null, faces.filter((_, k) => of[k] === bd), tol) === 'in');
  const a = sideIn(add(x, scale(n, step))), b = sideIn(sub(x, scale(n, step)));
  return (!a.length && !b.length) || a.some(bd => b.includes(bd));
}
/** Mesh edges (by position) not used exactly twice within one body's triangles, at 8 segments a quarter: how many. */
function openByBody(brep: Brep): number {
  const mesh = tessellateBrep(brep, { segmentsPerQuarter: 8 }), P = mesh.positions, shellBody = new Map(brep.shells.map(s => [s.id, s.body])), faceBody = new Map(brep.faces.map(f => [f.id, shellBody.get(f.shell)])), uses = new Map<string, number>();
  for (const f of mesh.faces) for (let t = f.indexOffset; t < f.indexOffset + f.indexCount; t += 3) for (let k = 0; k < 3; k++) {
    const i = mesh.indices[t + k], j = mesh.indices[t + (k + 1) % 3], a = `${P[3 * i]},${P[3 * i + 1]},${P[3 * i + 2]}`, b = `${P[3 * j]},${P[3 * j + 1]},${P[3 * j + 2]}`, key = `${faceBody.get(f.faceId)}|${a < b ? a + '|' + b : b + '|' + a}`;
    uses.set(key, (uses.get(key) ?? 0) + 1);
  }
  let open = 0; for (const u of uses.values()) if (u !== 2) open++;
  return open;
}
/** A piece's class at points of a 6 × 6 grid over its domain box that lie in it: the first in or out, or null. */
function clearWhere(f: GFace, region: CurveRegion2, faces: readonly GFace[], tol: number): Where | null {
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const ring of [region.outer, ...region.holes]) for (const g of ring) for (let i = 0; i <= 8; i++) { const q = segAtAny(g, i / 8); u0 = Math.min(u0, q[0]); u1 = Math.max(u1, q[0]); v0 = Math.min(v0, q[1]); v1 = Math.max(v1, q[1]); }
  for (let i = 1; i <= 6; i++) for (let j = 1; j <= 6; j++) {
    const q: XY = [u0 + (u1 - u0) * (i - 0.5) / 6, v0 + (v1 - v0) * (j - 0.5) / 6];
    if (locateInRegion(q, region, 10 * tol) !== 'in') continue;
    const x = to3(f, q), w = classify(x, normalOut(f, x), faces, tol);
    if (w === 'in' || w === 'out') return w;
  }
  return null;
}
/** Whether a domain point lies outside a region's box by more than `pad`. */
const outsideRegionBox = (region: CurveRegion2, q: XY, pad: number) => { const b = regionBox(region); return q[0] < b[0] - pad || q[0] > b[2] + pad || q[1] < b[1] - pad || q[1] > b[3] + pad; };
const RAYS: P3[] = [[0.5377, 0.3138, 0.7832], [-0.2961, 0.8573, 0.4213], [0.6993, -0.5126, 0.4982], [-0.4436, -0.3714, 0.8155], [0.1172, 0.9563, -0.2677], [0.8811, 0.2219, -0.4175]].map(v => unit(v as P3));
function classify(x: P3, normal: P3 | null, faces: readonly GFace[], tol: number): Where {
  if (normal) for (const g of faces) {
    if (![0, 1, 2].every(k => x[k] >= g.min[k] - 10 * tol && x[k] <= g.max[k] + 10 * tol)) continue;
    const dist = offSurface(g, x, 10 * tol);
    if (dist > 10 * tol || locateInRegion(to2(g, x), g.region, 10 * tol) === 'out') continue;
    return dot(normal, normalOut(g, x)) > 0 ? 'same' : 'opposite';
  }
  // (Two rays that agree decide; where they disagree — a ray passing a hair beside a patch it nearly touches, a tool
  // tangent to a cone along a circle, its grid's triangles missing the graze — the majority of all of them, R10.B, D99.)
  const votes: Where[] = [];
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
        // (A hit outside the face's region box, by more than 20 tolerances, is out of the region as locateInRegion reads it.)
        const q = to2(g, add(x, scale(dir, t))), where = outsideRegionBox(g.region, q, 20 * tol) ? 'out' : locateInRegion(q, g.region, 10 * tol);
        // A hit at the origin only matters inside the face (outside it, the ray just starts on its plane).
        if (t <= 10 * tol) { if (where !== 'out') bad = true; continue; }
        if (where === 'boundary') bad = true; else if (where === 'in') count++;
      }
      if (bad) break;
    }
    if (bad) continue;
    votes.push(count % 2 ? 'in' : 'out');
    if (votes.length === 2 && votes[0] === votes[1]) return votes[0];
  }
  if (votes.length) { const ins = votes.filter(w => w === 'in').length; return 2 * ins > votes.length ? 'in' : 2 * ins < votes.length ? 'out' : votes[0]; }
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
      // (A step that is not a number — the patch degenerate there, a ball's pole — makes the ray degenerate: another is
      // cast, not the patch evaluated at NaN, R10.B, D99.)
      if (!Number.isFinite(du) || !Number.isFinite(dv) || !Number.isFinite(dt)) return null;
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
/** A B-rep's faces by id (made once a B-rep). */
const faceMaps = new WeakMap<Brep, Map<string, Brep['faces'][number]>>();
function faceById(b: Brep): Map<string, Brep['faces'][number]> { let m = faceMaps.get(b); if (!m) { m = new Map(b.faces.map(f => [f.id, f])); faceMaps.set(b, m); } return m; }
/** The box of a set of faces. */
function facesBox(F: readonly GFace[]): { min: P3; max: P3 } {
  const min: P3 = [Infinity, Infinity, Infinity], max: P3 = [-Infinity, -Infinity, -Infinity];
  for (const f of F) for (let k = 0; k < 3; k++) { if (f.min[k] < min[k]) min[k] = f.min[k]; if (f.max[k] > max[k]) max[k] = f.max[k]; }
  return { min, max };
}
/** Whether two boxes lie more than `gap` apart along some axis. */
const boxesApart = (a: { min: P3; max: P3 }, b: { min: P3; max: P3 }, gap: number) => a.max[0] + gap < b.min[0] || b.max[0] + gap < a.min[0] || a.max[1] + gap < b.min[1] || b.max[1] + gap < a.min[1] || a.max[2] + gap < b.min[2] || b.max[2] + gap < a.min[2];
/** A piece whose key — its face's point at an interior point of its region — is found on first read, then kept. */
function lazyKeyed<T extends Omit<Piece, 'key'>>(p: T): T & Piece {
  let key: P3 | null = null;
  return Object.defineProperty(p, 'key', { get: () => key ??= to3(p.face, regionInteriorPoint(p.region) ?? [0, 0]), enumerable: true }) as T & Piece;
}

/**
 * The analytic form of a B-rep face's surface: a plane (point and outward normal), a circular
 * cylinder (axis point, unit axis, radius; `out` +1 when the outward normal points away from the axis),
 * or `other` for any other surface.
 */
export type FaceGeometry = { readonly kind: 'plane'; readonly o: P3; readonly n: P3 } | { readonly kind: 'cylinder'; readonly c: P3; readonly a: P3; readonly r: number; readonly out: 1 | -1 } | { readonly kind: 'other' };
export function faceGeometry(face: BrepFace, scaleMM = 1): FaceGeometry {
  // (A facet face: a plane when the whole region is flat — sketches, mates, glue and sections keep working on a
  // flat mesh face — else other. Never thrown on.)
  if (face.surface.kind === 'facets') {
    const plane = facetPlane(face.surface); if (!plane) return { kind: 'other' };
    const s = face.sense === 'forward' ? 1 : -1;
    return { kind: 'plane', o: plane.origin, n: [plane.normal[0] * s, plane.normal[1] * s, plane.normal[2] * s] };
  }
  const s = surfaceOf(face, linearToleranceMM(scaleMM) * 10);
  if (s.kind === 'plane') return { kind: 'plane', o: s.o, n: s.n };
  if (s.kind === 'cylinder') return { kind: 'cylinder', c: s.c, a: s.a, r: s.r, out: s.s };
  return { kind: 'other' };
}

/**
 * Edges that are an exact curve's map onto a general face and lie on a circle are made that arc
 * (`exactEdges: false` keeps them fitted).
 */
/** Each Boolean's pieces and their classes (debugging and tests; unset in use). */
let booleanTrace: ((pieces: { face: string; solid: number; where: string; at: P3; area: number; cuts: number; ends: P3[][]; ring: P3[][]; raw: unknown }[]) => void) | null = null;
export function setBooleanTrace(f: typeof booleanTrace): void { booleanTrace = f; }
export function booleanAnalytic(a: Brep, b: Brep, operation: AnalyticBooleanOperation, options: { readonly id?: string; readonly exactEdges?: boolean; /** A tighter fit for newly created parametric boundary edges only; topology tolerances stay unchanged. */ readonly edgeFitTolerance?: number; /** b's faces (ids) that meet a's faces named in `contactWith` (base names) only along their own edges lying on them (a fillet tool's contact faces and the faces it rounds, D89). */ readonly contactFaces?: readonly string[]; readonly contactWith?: readonly string[] } = {}): Brep {
  return analyticBoolean(a, b, operation, options, true);
}
type AnalyticOptions = { readonly id?: string; readonly exactEdges?: boolean; /** A tighter fit for newly created parametric boundary edges only; topology tolerances stay unchanged. */ readonly edgeFitTolerance?: number; /** b's faces (ids) that meet a's faces named in `contactWith` (base names) only along their own edges lying on them (a fillet tool's contact faces and the faces it rounds, D89). */ readonly contactFaces?: readonly string[]; readonly contactWith?: readonly string[] };
function analyticBoolean(a: Brep, b: Brep, operation: AnalyticBooleanOperation, options: AnalyticOptions, rejudge: boolean): Brep {
  // (An operation not named exactly is refused: it would otherwise fall through to another one's selection.)
  if (operation !== 'union' && operation !== 'intersection' && operation !== 'difference') throw new BrepError('INPUT', `analytic Boolean: operation must be union, intersection or difference, not ${String(operation)}`);
  const id = options.id ?? `analytic-${operation}`;
  for (const br of [a, b]) if (br.faces.some(isFacetFace)) throw new BrepError('GEOMETRY', 'analytic Boolean: faceted (mesh) faces are not supported yet');
  let scale = 1; for (const br of [a, b]) for (const v of br.vertices) for (const x of v.point) scale = Math.max(scale, Math.abs(x));
  const tol = linearToleranceMM(scale) * 10, span = 4 * scale + 1;
  if (options.edgeFitTolerance !== undefined && !(Number.isFinite(options.edgeFitTolerance) && options.edgeFitTolerance > 0)) throw new BrepError('INPUT', 'analytic Boolean: edge fit tolerance must be positive and finite');
  const edgeFit = options.edgeFitTolerance === undefined ? undefined : Math.min(tol / 4, options.edgeFitTolerance);
  const A = facesOf(a, 0, tol), B = facesOf(b, 1, tol);
  // 1. Cuts.
  const contact = new Set(options.contactFaces ?? []), rounded = new Set((options.contactWith ?? []).map(baseName));
  const touchedAt: P3[] = [];
  for (const fa of A) for (const fb of B) if (boxesMeet(fa, fb, tol)) cutPair(fa, fb, tol, span, contact.has(fb.id) && (!options.contactWith || rounded.has(fa.name ?? '')) && edgeOnSurface(fb, fa, tol), touchedAt);
  // A cut running along a face's own boundary (two finished edges meeting in a mitre already edged
  // there) adds nothing but slivers. (One that runs along it for most of its length and across the face for the rest —
  // a coplanar floor's line across a wall's foot, then along the floor's own edge — keeps the parts off the boundary,
  // when a point of it off the boundary is seen at 0.05 … 0.95. A cut wholly on it, as each of a coincident face's edges
  // is, is dropped without that search. L4 fuzz 20261026 #184, D258.)
  for (const f of [...A, ...B]) f.cuts = f.cuts.flatMap(g => !ON_BOUNDARY_AT.every(u => locateInRegion(segAtAny(g, u), f.region, 10 * tol) === 'boundary') ? [g]
    : PARTLY_OFF_AT.every(u => locateInRegion(segAtAny(g, u), f.region, 10 * tol) === 'boundary') ? [] : offBoundary(f, { source: 0, seg: g }, tol).map(c => c.seg));
  // A cut made twice (a face's edge on the other surface, and a coplanar face's boundary) is kept once,
  // the exact copy (a line or an arc) over a fitted one.
  for (const f of [...A, ...B]) f.cuts = dedupeCuts(f.cuts, tol, f.surf.kind === 'plane');
  // 2–3. Pieces and their classes.
  const pieces: (Piece & { where: Where })[] = [], touches: { x: P3; n: P3 }[] = [];
  const boxA = facesBox(A), boxB = facesBox(B), far = new Set<Piece>();
  for (const f of [...A, ...B]) {
    // (Broad phase: a face with no cut whose box lies 1000 tolerances clear of the other solid's box is outside it,
    // whole: no ray is cast, and its point inside — the piece's key, wanted only to number repeated names or vote on a
    // shell's sense — is found if it is asked for.)
    if (!f.cuts.length && boxesApart(f, f.solid === 0 ? boxB : boxA, 1000 * tol)) {
      if (Math.abs(regionArea(f.region)) <= tol * tol) continue;
      const p = lazyKeyed({ face: f, region: f.region, out: 1, where: 'out' as Where }); pieces.push(p); far.add(p);
      continue;
    }
    const regions = f.cuts.length ? curveFaceRegions([f.region.outer, ...f.region.holes], f.cuts, tol) : [f.region];
    for (const region of regions) {
      const p2 = regionInteriorPoint(region); if (!p2 || Math.abs(regionArea(region)) <= tol * tol) continue;
      const x = to3(f, p2), other = f.solid === 0 ? B : A;
      let where = classify(x, normalOut(f, x), other, tol);
      // (A piece whose point lies on the other solid's surface where that surface only touches it — a plane tangent to
      // a cylinder along a ruling, the domain's middle on that line — is judged at other points of it, the first clear
      // one deciding; a piece on a coincident surface stays on it. L4 fuzz 56, D205. Planar pieces too: a box's face
      // the cylinder touches along a line through its middle. L4 fuzz 15, D210.)
      if (rejudge && (where === 'same' || where === 'opposite')) { const w = clearWhere(f, region, other, tol); if (w) { where = w; touches.push({ x, n: normalOut(f, x) }); } }
      pieces.push({ face: f, region, out: 1, key: x, where });
    }
  }
  booleanTrace?.(pieces.map(p => ({ face: p.face.name ?? p.face.id, solid: p.face.solid, where: p.where, at: p.key, area: regionArea(p.region), cuts: p.face.cuts.length, ends: p.face.cuts.map(c => [to3(p.face, segAtAny(c, 0)), to3(p.face, segAtAny(c, 1))]), ring: [p.face.region.outer, ...p.face.region.holes].map(r => r.map(c => to3(p.face, segAtAny(c, 0)))), raw: { region: p.face.region, cuts: p.face.cuts, tol } })));
  // 4. Keep, flip, stitch.
  const keep = (p: { face: GFace; where: Where }): 'keep' | 'flip' | null => {
    const fromA = p.face.solid === 0, w = p.where;
    if (operation === 'union') return w === 'out' || (w === 'same' && fromA) ? 'keep' : null;
    if (operation === 'intersection') return w === 'in' || (w === 'same' && fromA) ? 'keep' : null;
    if (fromA) return w === 'out' || w === 'opposite' ? 'keep' : null;
    return w === 'in' ? 'flip' : null;
  };
  const reverse = (ring: readonly CurveSegment2[]) => [...ring].reverse().map(segReverse);
  const frozen = new Map<Piece, FrozenFace>();
  const kept: Piece[] = pieces.flatMap(p => { const k = keep(p); if (!k) return [];
    // (The key passed on as it is, found when first read.)
    const q = { face: p.face, out: (k === 'flip' ? -1 : 1) as 1 | -1, region: k === 'flip' ? { outer: reverse(p.region.outer), holes: p.region.holes.map(reverse) } : p.region } as Piece;
    Object.defineProperty(q, 'key', { get: () => p.key, enumerable: true });
    // (A far face kept as it is is frozen: stitch takes its loops and edges from its input; not one through a pole.)
    if (k === 'keep' && far.has(p) && !(p.face.surf.kind === 'nurbs' && p.face.surf.poles.length)) { const src = p.face.solid === 0 ? a : b, face = faceById(src).get(p.face.id); if (face) frozen.set(q, { face, brep: src }); }
    return [q]; });
  // (A tolerant input's — a fitted offset's, D110, D113 — pieces keep its tolerance: the result is tolerant as its worst.)
  const inputTol = Math.max(0, ...[a, b].flatMap(x => [...x.edges.map(e => e.tolerance), ...x.vertices.map(v => v.tolerance)]));
  const result = stitch(mergePieces(kept, tol), id, tol, options.exactEdges !== false, inputTol, undefined, edgeFit, frozen);
  if (!touches.length) return touchChecked(result, touchedAt);
  // (A piece re-judged where a surface only touches it leaves the result's boundary touching there. Two lumps meeting
  // there are two bodies, as D204 has them; one lump touching itself — empty on both sides of the touch, or the same
  // body on both — is not a manifold solid: refused as such, even with no vertex there. A result that is not valid or
  // watertight body by body is not trusted: the Boolean as it was without the re-judging decides. L4 fuzz 56, D205.)
  for (const t of touches) {
    const self = selfTouch(result, t.x, t.n, tol);
    if (self) throw new Refused(`the result's boundary touches itself at (${t.x.map(v => +v.toFixed(4)).join(', ')}), where one surface only touches another: not a manifold solid (the inputs touch along an edge or at a vertex)`);
  }
  if (!checkBrep(result, { strict: true }).valid || openByBody(result)) return analyticBoolean(a, b, operation, options, false);
  return touchChecked(result, touchedAt);
}
/**
 * A result whose intersection curve crosses itself where the surfaces touch — a cylinder tangent inside a skew one (their
 * curve's loops cut at the touch, above), or a march through such a point (D238) — checked strictly: its boundary can
 * touch itself at that point alone (L4 fuzz 20261025 case 126, shrunk: a wall's loop touching itself, D248). One lump
 * touching itself is not a manifold solid (D205's ruling): refused, typed. A valid one (lumps meeting there, or no contact
 * left) is returned. (`touchedAt`: the touch points; none, no check.)
 */
function touchChecked(result: Brep, touchedAt: readonly P3[]): Brep {
  if (!touchedAt.length) return result;
  const strict = checkBrep(result, { strict: true });
  if (!strict.valid) throw new Refused(`the inputs touch at (${touchedAt[0].map(v => +v.toFixed(4)).join(', ')}), where their curve crosses itself, and the result there is not a manifold solid: ${strict.issues[0]}`);
  return result;
}

// ---- a face split along curves (D149) ---------------------------------------------------------------
// A face cut along curves lying on it, as the Boolean cuts a face along its intersection curves: the curves clipped to the
// face (`intervals`), mapped into its domain (`curve2`), the domain's region divided (`curveFaceRegions`) and every face
// stitched again (`stitch`) — nothing classified or merged, so only the one face changes. The isocline n·d = 0 is such a
// curve: closed form on a cylinder (two generators), traced on a general face (surface-isocline.ts), refused on a plane.
/**
 * One piece of a split face: its name in the result; `faces`, its result faces — one, or two either side of a closed
 * general face's seam (`name` and `name#2`); for an isocline split, `side` +1 where its outward normal has n·d > 0, −1 below.
 */
export interface FaceSplitPiece { readonly name: string; readonly faces: readonly string[]; readonly side?: 1 | -1 }
export interface FaceSplit { readonly brep: Brep; readonly pieces: readonly FaceSplitPiece[] }
export interface FaceSplitOptions {
  /** The result's id (its edges' and vertices' prefix; default `split`). */
  readonly id?: string;
  /** The pieces' names, in the order of `pieces` (default `<face>#1`, `<face>#2` …: the + side first, then by position). */
  readonly names?: readonly string[];
}
/** A cut in the face's domain and the input curve it comes from (one curve's pieces must not cross each other). */
interface SourcedCut { readonly seg: CurveSegment2; readonly source: number }
const splitError = (code: 'INPUT' | 'GEOMETRY', tag: string, detail: string) => new BrepError(code, `face split: [${tag}] ${detail}`);
const fmt3 = (x: readonly number[]) => `(${x.map(v => +v.toFixed(4)).join(', ')})`;

/**
 * The face (an id, a name, or a base name naming one face) cut along curves lying on it: each curve on its surface within
 * the tolerance (10 × the linear tolerance at the body's scale), clipped to the face, ending on its boundary at an angle
 * (or closed: a hole and a disc), not crossing itself. Every other face, edge name and the volume are kept.
 * Refusals (`face split: [TAG]`): NO_FACE, AMBIGUOUS, NOT_SOLID, CURVES (INPUT); OFF_SURFACE, OFF_FACE, ON_BOUNDARY,
 * OPEN_END, TANGENT (under 0.057° to the boundary, or touching it), SELF_CROSSING, NO_SPLIT (GEOMETRY).
 */
export function splitFaceAlongCurve(brep: Brep, face: string, curves: Curve | readonly Curve[], options: FaceSplitOptions = {}): FaceSplit {
  const list: readonly Curve[] = Array.isArray(curves) ? curves : [curves as Curve];
  if (!list.length || list.length > 64) throw splitError('INPUT', 'CURVES', 'give 1 to 64 curves');
  list.forEach((c, i) => { try { validateCurve(c); } catch (cause) { throw splitError('INPUT', 'CURVES', `curve ${i}: ${cause instanceof Error ? cause.message : String(cause)}`); } });
  return splitFace(brep, face, options, (f, tol) => list.flatMap((c, i) => curveCuts(f, c, i, tol)), null);
}
/**
 * The face cut along its isocline n·d = 0 for the pull `pull`: its pieces each on one side (`side`). Refused on a plane
 * (WALL when it lies along the pull, NO_ISOCLINE otherwise), on a cylinder along the pull (WALL), and where n·d keeps one
 * sign over the face (NO_ISOCLINE); otherwise as `splitFaceAlongCurve` (an isocline crossing itself at a saddle: SELF_CROSSING).
 */
export function splitFaceAlongIsocline(brep: Brep, face: string, pull: readonly number[], options: FaceSplitOptions = {}): FaceSplit {
  const l = Array.isArray(pull) && pull.length === 3 ? Math.hypot(pull[0], pull[1], pull[2]) : NaN;
  if (!(l > 0) || !Number.isFinite(l)) throw splitError('INPUT', 'PULL', 'the pull must be a finite, nonzero [x, y, z]');
  const d: P3 = [pull[0] / l, pull[1] / l, pull[2] / l];
  return splitFace(brep, face, options, (f, tol, span) => isoclineCuts(f, d, tol, span), d);
}

/** A curve's pieces on the face, as domain cuts (lines and arcs kept exact; a piece of the curve itself otherwise). */
function curveCuts(f: GFace, c: Curve, source: number, tol: number): SourcedCut[] {
  const [t0, t1] = curveDomain(c), at = curveEvaluator(c);
  let worst = 0, where: P3 = at(t0);
  for (let k = 0; k <= 64; k++) { const x = at(t0 + (t1 - t0) * k / 64), e = offSurface(f, x, 1e3 * tol); if (e > worst) { worst = e; where = x; } }
  if (worst > tol) throw splitError('GEOMETRY', 'OFF_SURFACE', `curve ${source} is ${worst.toPrecision(3)} mm off the face's surface at ${fmt3(where)} (the tolerance ${tol} mm)`);
  const spans = intervals(f, { kind: 'param', at, lo: t0, hi: t1 }, tol, true);
  if (!spans.length) throw splitError('GEOMETRY', 'OFF_FACE', `curve ${source} lies on the face's surface but outside the face`);
  // (On a cylinder, pieces cut at its domain's seam, a piece of no length — a whole circle through the seam — left out.)
  return spans.flatMap(([a, b]) => seamRanges(f, at, a, b)).filter(([a, b]) => Math.max(len(sub(at(b), at(a))), len(sub(at((a + b) / 2), at(a)))) > tol)
    .map(([a, b]) => ({ source, seg: intoWindow(f, curve2(f, exactly({ kind: 'param', at, t0: a, t1: b, exact: true, src: c }, tol * 1e-3), tol), tol) }));
}
/**
 * A cut on a cylinder face in its domain's window: an end on the seam maps to either side of it, so a line takes the side
 * its middle has (moved whole by a turn), and a curve's points on the seam take their neighbours' side.
 */
function intoWindow(f: GFace, g: CurveSegment2, tol: number): CurveSegment2 {
  const s = f.surf;
  if (s.kind !== 'cylinder') return g;
  const W = TWO_PI * s.r, w = [s.s * s.r * (s.ref - Math.PI), s.s * s.r * (s.ref + Math.PI)].sort((x, y) => x - y);
  if (g.kind === 'line') {
    const mid = segAtAny(g, 0.5), shift = Math.round((to2(f, to3(f, mid))[0] - mid[0]) / W) * W;
    return shift ? { ...g, a: [g.a[0] + shift, g.a[1]], b: [g.b[0] + shift, g.b[1]] } : g;
  }
  if (g.kind !== 'curve') return g;
  const f0 = g.f, t0 = g.t0, span = g.t1 - g.t0;
  return { ...g, f: (t: number): XY => {
    const q = f0(t); if (Math.abs(q[0] - w[0]) > tol && Math.abs(q[0] - w[1]) > tol) return q;
    const n = f0(t + (t - t0 < span / 2 ? 1 : -1) * 1e-4 * span);
    return [Math.abs(n[0] - w[0]) < Math.abs(n[0] - w[1]) ? w[0] : w[1], q[1]];
  } };
}
/** The isocline's pieces on the face, as domain cuts. */
function isoclineCuts(f: GFace, d: P3, tol: number, span: number): SourcedCut[] {
  const s = f.surf;
  if (s.kind === 'plane') {
    const nd = dot(s.n, d);
    if (Math.abs(nd) <= 1e-12) throw splitError('GEOMETRY', 'WALL', 'the face is flat and along the pull (n·d = 0 throughout): no isocline divides it');
    throw splitError('GEOMETRY', 'NO_ISOCLINE', `the face is flat (n·d = ${nd.toPrecision(3)} throughout): it lies wholly on one side`);
  }
  const out: SourcedCut[] = [];
  if (s.kind === 'cylinder') {
    // The generators where the radial direction is square to the pull: ±(a × d⊥).
    const perp = sub(d, scale(s.a, dot(d, s.a)));
    if (len(perp) <= 1e-12) throw splitError('GEOMETRY', 'WALL', 'the face is a cylinder along the pull (n·d = 0 throughout): no isocline divides it');
    const rho = unit(cross(s.a, perp));
    [1, -1].forEach((sg, source) => {
      const p = add(s.c, scale(rho, sg * s.r));
      for (const [lo, hi] of intervals(f, { kind: 'line', p, d: s.a, lo: -span, hi: span }, tol)) if (hi - lo > tol) out.push({ source, seg: curve2(f, { kind: 'line', p: add(p, scale(s.a, lo)), q: add(p, scale(s.a, hi)) }, tol) });
    });
    if (!out.length) throw splitError('GEOMETRY', 'NO_ISOCLINE', 'the isocline misses the face: it lies wholly on one side');
    return out;
  }
  // (n·d ≈ 0 all over: a general wall along the pull, a ruled sweep of the pull.)
  let most = 0; for (let i = 1; i < 8; i++) for (let j = 1; j < 8; j++) { const u = s.U[0] + (s.U[1] - s.U[0]) * i / 8, v = s.V[0] + (s.V[1] - s.V[0]) * j / 8; most = Math.max(most, Math.abs(dot(nurbsNormal(s, [u, v]), d))); }
  if (most <= 1e-9) throw splitError('GEOMETRY', 'WALL', 'the face lies along the pull (n·d = 0 throughout): no isocline divides it');
  surfaceIsoclines(s.S, d, { tolerance: tol / 4 }).forEach((line, source) => {
    const P = line.uv, M = line.closed ? P.length : P.length - 1;
    if (M < 1) return;
    const uvAt = (t: number): XY => {
      const i = Math.min(M - 1, Math.max(0, Math.floor(t))), [p0, p1, p2, p3] = chainNeighbours(P, i, line.closed), q = catmullRom(p0, p1, p2, p3, t - i);
      return [Math.min(s.U[1], Math.max(s.U[0], q[0])), Math.min(s.V[1], Math.max(s.V[0], q[1]))];
    };
    const at3 = (t: number): P3 => { const q = uvAt(t); return s.ev(q[0], q[1]); };
    const seg = { kind: 'curve' as const, f: (t: number): XY => { const q = uvAt(t); return [q[0] * s.ku, q[1] * s.kv]; }, t0: 0, t1: M, src: at3, exact: true } as CurveSegment2 & { kind: 'curve' };
    const params = [0, M];
    for (const ring of [f.region.outer, ...f.region.holes]) for (const g of ring) if (!segmentsApart(seg, g, tol)) for (const x of intersectSegments(seg, g, tol)) params.push(M * paramOfCurve(seg, x));
    for (const [a, b] of insideIntervals(f, params, at3, tol, true)) out.push({ source, seg: { ...seg, t0: a, t1: b } });
  });
  if (!out.length) throw splitError('GEOMETRY', 'NO_ISOCLINE', 'n·d keeps one sign over the face: it lies wholly on one side');
  return out;
}

/** The part of a segment between fractions u0 and u1. */
function subSegment(g: CurveSegment2, u0: number, u1: number): CurveSegment2 {
  if (g.kind === 'line') return { ...g, a: segAtAny(g, u0), b: segAtAny(g, u1) };
  if (g.kind === 'arc') return { ...g, t0: g.t0 + g.sweep * u0, sweep: g.sweep * (u1 - u0) };
  return { ...g, t0: g.t0 + (g.t1 - g.t0) * u0, t1: g.t0 + (g.t1 - g.t0) * u1 };
}
/**
 * A cut without its runs along the face's boundary (an isocline along a face's flat edge, where n·d = 0, before it turns in):
 * 256 samples, a run on the boundary (within 10 × tol) longer than 100 × tol left out, its ends found by bisection to a
 * hundredth of the tolerance so the pieces left still end on the boundary. A cut wholly on it is left out.
 */
function offBoundary(f: GFace, c: SourcedCut, tol: number): SourcedCut[] {
  const rings = [f.region.outer, ...f.region.holes], g = c.seg, N = 256;
  const d = (u: number) => { const p = segAtAny(g, u); let m = Infinity; for (const ring of rings) for (const h of ring) m = Math.min(m, segDistance(h, p)); return m; };
  const on = Array.from({ length: N + 1 }, (_, k) => d(k / N) <= 10 * tol);
  if (!on.some(x => x)) return [c];
  if (on.every(x => x)) return [];
  // Runs on the boundary, by sample index.
  const runs: [number, number][] = [];
  for (let k = 0; k <= N; k++) if (on[k] && (k === 0 || !on[k - 1])) { let e = k; while (e < N && on[e + 1]) e++; runs.push([k, e]); }
  const edge = (a: number, b: number) => { let lo = a, hi = b; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (d(m) <= 1e-2 * tol) lo = m; else hi = m; } return lo; };
  const cuts: [number, number][] = [];
  let from = 0;
  for (const [a, b] of runs) {
    const u0 = a === 0 ? 0 : edge(a / N, (a - 1) / N), u1 = b === N ? 1 : edge(b / N, (b + 1) / N);
    if (len(sub(to3(f, segAtAny(g, u1)), to3(f, segAtAny(g, u0)))) <= 100 * tol) continue;
    if (u0 > from) cuts.push([from, u0]);
    from = u1;
  }
  if (from < 1) cuts.push([from, 1]);
  return cuts.filter(([a, b]) => len(sub(to3(f, segAtAny(g, b)), to3(f, segAtAny(g, a)))) > 10 * tol || len(sub(to3(f, segAtAny(g, (a + b) / 2)), to3(f, segAtAny(g, a)))) > 10 * tol)
    .map(([a, b]) => ({ source: c.source, seg: a === 0 && b === 1 ? g : subSegment(g, a, b) }));
}
/** A 3D tangent of a domain segment at u (∈ [0, 1]), by a central difference through the face's map. */
function tangent3(f: GFace, g: CurveSegment2, u: number): P3 {
  const h = 1e-5, a = Math.max(0, u - h), b = Math.min(1, u + h);
  return sub(to3(f, segAtAny(g, b)), to3(f, segAtAny(g, a)));
}
/** Whether segments ab and cd cross properly (each strictly across the other's line). */
function crossesProperly(a: XY, b: XY, c: XY, d: XY): boolean {
  const o = (p: XY, q: XY, r: XY) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}
/** The cuts' ends on the boundary at an angle (or on another cut), their insides off it, no curve across itself. */
function checkCuts(f: GFace, cuts: readonly SourcedCut[], tol: number, what: string): void {
  const region = f.region, rings = [region.outer, ...region.holes], eps = 10 * tol;
  for (const c of cuts) {
    const k = curve3Of(f, c.seg);
    if (len(sub(startOf(k), endOf(k))) > eps) for (const u of [0, 1]) {
      const p = segAtAny(c.seg, u);
      if (locateInRegion(p, region, eps) === 'boundary') {
        const t1 = tangent3(f, c.seg, u);
        for (const ring of rings) for (const g of ring) if (segDistance(g, p) <= eps) {
          // (A domain side collapsed to a point — a pole — has no direction: nothing to meet at an angle.)
          const t2 = tangent3(f, g, Math.min(1, Math.max(0, paramOfCurve(g, p)))); if (len(t2) <= 1e-9 * len(t1)) continue;
          const sine = len(cross(t1, t2)) / (len(t1) * len(t2));
          if (!(sine >= 1e-3)) throw splitError('GEOMETRY', 'TANGENT', `the ${what} meets the face's boundary at ${fmt3(to3(f, p))} at ${(Math.asin(Math.min(1, sine)) * 180 / Math.PI).toPrecision(3)}° (under 0.057°: a sliver)`);
        }
        continue;
      }
      if (cuts.some(o => o !== c && segDistance(o.seg, p) <= eps)) continue;
      throw splitError('GEOMETRY', 'OPEN_END', `the ${what} ends inside the face at ${fmt3(to3(f, p))}: it must run to the boundary or close on itself`);
    }
    for (let i = 2; i <= 62; i++) {
      const p = segAtAny(c.seg, i / 64);
      if (locateInRegion(p, region, tol) === 'boundary') throw splitError('GEOMETRY', 'TANGENT', `the ${what} touches the face's boundary at ${fmt3(to3(f, p))}`);
    }
  }
  // One curve's pieces, as 64-chord polylines in the domain, crossing each other (not at their ends).
  const sources = [...new Set(cuts.map(c => c.source))];
  for (const s of sources) {
    const mine = cuts.filter(c => c.source === s), polys = mine.map(c => Array.from({ length: 65 }, (_, i) => segAtAny(c.seg, i / 64))), ends = polys.flatMap(p => [p[0], p[64]]);
    for (let a = 0; a < polys.length; a++) for (let b = a; b < polys.length; b++) for (let i = 0; i < 64; i++) for (let j = a === b ? i + 2 : 0; j < 64; j++) {
      if (a === b && i === 0 && j === 63) continue;
      const A = polys[a], B = polys[b];
      if (!crossesProperly(A[i], A[i + 1], B[j], B[j + 1])) continue;
      const m: XY = [(A[i][0] + A[i + 1][0]) / 2, (A[i][1] + A[i + 1][1]) / 2];
      if (ends.some(e => Math.hypot(e[0] - m[0], e[1] - m[1]) <= eps)) continue;
      throw splitError('GEOMETRY', 'SELF_CROSSING', `the ${what} crosses itself near ${fmt3(to3(f, m))}`);
    }
  }
}
/** The fraction along k of the point nearest x, and its distance (64 samples, then a golden-section search). */
function nearestOn(k: Curve3, x: P3): { t: number; d: number } {
  let best = 0, bd = Infinity; for (let i = 0; i <= 64; i++) { const v = distanceOn(k, x, i / 64); if (v < bd) { bd = v; best = i / 64; } }
  let lo = Math.max(0, best - 1 / 64), hi = Math.min(1, best + 1 / 64);
  for (let i = 0; i < 60; i++) { const m1 = hi - (hi - lo) * 0.6180339887, m2 = lo + (hi - lo) * 0.6180339887; if (distanceOn(k, x, m1) < distanceOn(k, x, m2)) hi = m2; else lo = m1; }
  const t = (lo + hi) / 2, dt = distanceOn(k, x, t);
  return dt < bd ? { t, d: dt } : { t: best, d: bd };
}
/** |k(u) − x| (module level, not a closure per call: R5.2, D219). */
const distanceOn = (k: Curve3, x: P3, u: number) => len(sub(pointOf(k, u), x));
/** Domain pieces grouped by meeting across the face's seam (an edge its loops use twice): each group one piece of the face. */
function seamGroups(brep: Brep, target: BrepFace, pieces: readonly Piece[], tol: number): Piece[][] {
  const loops = new Map(brep.loops.map(l => [l.id, l])), coedges = new Map(brep.coedges.map(c => [c.id, c])), edges = new Map(brep.edges.map(e => [e.id, e]));
  const used = target.loops.flatMap(l => loops.get(l)!.coedges.map(c => coedges.get(c)!.edge));
  const seams = [...new Set(used.filter((e, i) => used.indexOf(e) !== i))].map(e => curve3(edges.get(e)!.curve, true));
  const root = pieces.map((_, i) => i), find = (x: number): number => { while (root[x] !== x) x = root[x] = root[root[x]]; return x; };
  if (seams.length) {
    // Each piece's spans along each seam (fractions of the seam edge).
    const spans = pieces.map(p => {
      const out: { seam: number; lo: number; hi: number }[] = [];
      for (const ring of [p.region.outer, ...p.region.holes]) for (const g of ring) {
        const k = curve3Of(p.face, g);
        seams.forEach((sk, si) => {
          if (!NEAR_ENDS_3.every(u => nearestOn(sk, pointOf(k, u)).d <= 10 * tol)) return;
          const a = nearestOn(sk, pointOf(k, 0)).t, b = nearestOn(sk, pointOf(k, 1)).t;
          out.push({ seam: si, lo: Math.min(a, b), hi: Math.max(a, b) });
        });
      }
      return out;
    });
    for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++)
      if (spans[i].some(a => spans[j].some(b => a.seam === b.seam && Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo) > 1e-9))) root[find(i)] = find(j);
  }
  const groups = new Map<number, Piece[]>();
  pieces.forEach((p, i) => { const r = find(i), list = groups.get(r); if (list) list.push(p); else groups.set(r, [p]); });
  return [...groups.values()];
}
const byKey = (a: Piece, b: Piece) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2];

function splitFace(brep: Brep, ref: string, options: FaceSplitOptions, cutsOf: (f: GFace, tol: number, span: number) => SourcedCut[], pull: P3 | null): FaceSplit {
  const what = pull ? 'isocline' : 'curve';
  if (typeof ref !== 'string' || !ref) throw splitError('INPUT', 'NO_FACE', 'name the face to split (its id or name)');
  if (brep.faces.some(isFacetFace)) throw new BrepError('GEOMETRY', 'face split: faceted (mesh) faces are not supported yet');
  if (brep.bodies.some(b => b.kind !== 'solid') || brep.shells.some(s => !s.closed)) throw splitError('INPUT', 'NOT_SOLID', 'the body must be a closed solid');
  const byBase = brep.faces.filter(x => x.name !== undefined && baseName(x.name) === ref);
  const target = brep.faces.find(x => x.id === ref) ?? brep.faces.find(x => x.name === ref) ?? (byBase.length === 1 ? byBase[0] : undefined);
  if (!target) throw splitError('INPUT', byBase.length ? 'AMBIGUOUS' : 'NO_FACE', byBase.length ? `${ref} names ${byBase.length} faces (${byBase.map(x => x.name).join(', ')}): name one` : `no face ${ref}`);
  let scaleMM = 1; for (const v of brep.vertices) for (const x of v.point) scaleMM = Math.max(scaleMM, Math.abs(x));
  const tol = linearToleranceMM(scaleMM) * 10, span = 4 * scaleMM + 1, index = brep.faces.indexOf(target);
  const F = facesOf(brep, 0, tol), f = F[index];
  // A cut along the face's own boundary divides nothing: those runs of it are left out.
  const cuts = cutsOf(f, tol, span).flatMap(c => offBoundary(f, c, tol));
  if (!cuts.length) throw splitError('GEOMETRY', 'ON_BOUNDARY', pull ? 'the isocline runs along the face\'s boundary: the face lies wholly on one side' : 'the curve runs along the face\'s boundary');
  checkCuts(f, cuts, tol, what);
  const segs = dedupeCuts(cuts.map(c => c.seg), tol, f.surf.kind === 'plane');
  const regions = curveFaceRegions([f.region.outer, ...f.region.holes], segs, tol).filter(r => regionInteriorPoint(r) !== null && Math.abs(regionArea(r)) > tol * tol);
  const mine: Piece[] = regions.map(region => ({ face: f, region, out: 1 as const, key: to3(f, regionInteriorPoint(region)!) }));
  let groups = seamGroups(brep, target, mine, tol);
  if (groups.length < 2) throw splitError('GEOMETRY', 'NO_SPLIT', `the ${what} does not divide the face (it only opens it along its seam)`);
  // A piece across a cylinder's seam joins in one face (its domain centred in the gap the other pieces leave).
  groups = groups.map(g => (g.length > 1 && f.surf.kind === 'cylinder' ? mergePieces(g, tol) : g).sort(byKey));
  const sideOf = (g: Piece[]): 1 | -1 | undefined => pull ? (dot(normalOut({ ...g[0].face, out: g[0].out }, g[0].key), pull) >= 0 ? 1 : -1) : undefined;
  const sides = new Map(groups.map(g => [g, sideOf(g)]));
  groups.sort((a, b) => (sides.get(b) ?? 0) - (sides.get(a) ?? 0) || byKey(a[0], b[0]));
  const base = target.name ?? target.id, given = options.names;
  if (given !== undefined && (!Array.isArray(given) || given.length !== groups.length || !given.every(n => typeof n === 'string' && n) || new Set(given).size !== given.length))
    throw splitError('INPUT', 'NAMES', `give ${groups.length} distinct names for the ${groups.length} pieces`);
  const names = given ?? groups.map((_, k) => `${base}#${k + 1}`), taken = new Set(brep.faces.filter(x => x !== target).map(x => x.name));
  const pieces: FaceSplitPiece[] = groups.map((g, k) => ({ name: names[k], faces: g.map((_, j) => j ? `${names[k]}#${j + 1}` : names[k]), ...(pull ? { side: sides.get(g)! } : {}) }));
  for (const p of pieces) for (const n of p.faces) if (taken.has(n)) throw splitError('INPUT', 'NAMES', `${n} is already a face's name: give the pieces other names`);
  const others = F.flatMap((g, i) => i === index ? [] : [{ face: g, region: g.region, out: 1 as const, key: to3(g, regionInteriorPoint(g.region) ?? segAtAny(g.region.outer[0], 0)) }]);
  const all: Piece[] = [...others, ...groups.flat()];
  const faceNames = [...brep.faces.filter((_, i) => i !== index).map(x => x.name), ...pieces.flatMap(p => p.faces)];
  const inputTol = Math.max(0, ...brep.edges.map(e => e.tolerance), ...brep.vertices.map(v => v.tolerance));
  return { brep: stitch(all, options.id ?? 'split', tol, true, inputTol, faceNames), pieces };
}

// ---- merging ----------------------------------------------------------------------------------------
/**
 * Pieces on one plane, or one cylinder, facing the same way become one face: their regions are joined
 * in a common domain (the first piece's; for a cylinder, centred so its seam falls in a gap between
 * the pieces). Only pieces that meet are joined (their domain boxes, padded by 10 tolerances, meeting directly or
 * through others): each joined face keeps the name of the first piece in it, and a piece apart from the rest keeps its
 * own — the top faces of a row of bosses, one plane, stay each boss's own (they were all renamed after the first piece
 * at every Boolean, and a union of all of them was made each time). A full turn of pieces stays as it is.
 */
/**
 * A domain box [x0, y0, x1, y1] of rings, padded by `pad`: a line's ends; an arc's ends and the extremes of its circle it
 * passes; a general curve's samples (eighths) padded by its longest chord.
 */
function ringsBox(rings: readonly (readonly CurveSegment2[])[], pad: number): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const take = (q: readonly number[], r: number) => { if (q[0] - r < x0) x0 = q[0] - r; if (q[0] + r > x1) x1 = q[0] + r; if (q[1] - r < y0) y0 = q[1] - r; if (q[1] + r > y1) y1 = q[1] + r; };
  for (const ring of rings) for (const g of ring) {
    if (g.kind === 'line') { take(g.a, 0); take(g.b, 0); continue; }
    if (g.kind === 'arc') {
      take(segAtAny(g, 0), 0); take(segAtAny(g, 1), 0);
      const lo = Math.min(g.t0, g.t0 + g.sweep), hi = Math.max(g.t0, g.t0 + g.sweep);
      for (let k = Math.ceil(lo / (Math.PI / 2)); k * (Math.PI / 2) <= hi; k++) take([g.c[0] + g.r * Math.cos(k * Math.PI / 2), g.c[1] + g.r * Math.sin(k * Math.PI / 2)], 0);
      continue;
    }
    let prev: XY | null = null, chord = 0; const qs: XY[] = [];
    for (let i = 0; i <= 8; i++) { const q = segAtAny(g, i / 8); qs.push(q); if (prev) chord = Math.max(chord, Math.hypot(q[0] - prev[0], q[1] - prev[1])); prev = q; }
    for (const q of qs) take(q, chord);
  }
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
}
/** Whether every ring of a region closes: each segment's end at the next one's start (to 1e-12 of their size). */
function regionCloses(region: CurveRegion2): boolean {
  for (const ring of [region.outer, ...region.holes]) for (let i = 0; i < ring.length; i++) {
    const a = segAtAny(ring[i], 1), b = segAtAny(ring[(i + 1) % ring.length], 0);
    if (!(Math.hypot(a[0] - b[0], a[1] - b[1]) <= 1e-12 * (1 + Math.abs(a[0]) + Math.abs(a[1])))) return false;
  }
  return true;
}
/** Index clusters of boxes that meet, directly or through others; each cluster ascending, clusters by their first index. */
function clustersOf(boxes: readonly (readonly number[])[]): number[][] {
  const n = boxes.length, up = boxes.map((_, i) => i), root = (i: number): number => { while (up[i] !== i) i = up[i] = up[up[i]]; return i; };
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = boxes[i], b = boxes[j];
    // (Apart only when provably apart: a NaN coordinate keeps them together.)
    if (!(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1])) { const x = root(i), y = root(j); if (x !== y) up[Math.max(x, y)] = Math.min(x, y); }
  }
  const byRoot = new Map<number, number[]>(), out: number[][] = [];
  for (let i = 0; i < n; i++) { const r = root(i); let c = byRoot.get(r); if (!c) { c = []; byRoot.set(r, c); out.push(c); } c.push(i); }
  return out;
}
/** A bucket key of four integers (collisions only cost a check). */
const planeKey = (a: number, b: number, c: number, d: number) => (Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791) ^ Math.imul(d, 2654435761)) >>> 0;
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
  // (Planes indexed by their facing normal and offset, quantized coarsely: a piece is checked against the groups in
  // its bucket and the neighbouring ones only, and still joins the earliest group it matches — a mesh-sized body
  // of thousands of planar pieces is not every piece against every group.)
  const groups: Piece[][] = [], others: number[] = [], planes = new Map<number, number[]>();
  let size = 1; for (const p of pieces) if (p.face.surf.kind === 'plane') size = Math.max(size, Math.abs(dot(p.face.surf.n, p.face.surf.o)));
  const qn = 1e-4, qc = Math.max(1e-4 * size, 1000 * tol);
  for (const p of pieces) {
    const S = p.face.surf;
    if (S.kind !== 'plane') {
      let g = -1; for (const i of others) if (same(groups[i][0], p)) { g = i; break; }
      if (g >= 0) groups[g].push(p); else { others.push(groups.length); groups.push([p]); }
      continue;
    }
    const f = facing(p), c = dot(f, S.o), key = [Math.round(f[0] / qn), Math.round(f[1] / qn), Math.round(f[2] / qn), Math.round(c / qc)];
    let g = -1;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let d = -1; d <= 1; d++) for (let e = -1; e <= 1; e++) {
      const list = planes.get(planeKey(key[0] + a, key[1] + b, key[2] + d, key[3] + e)); if (!list) continue;
      for (const i of list) if ((g < 0 || i < g) && same(groups[i][0], p)) g = i;
    }
    if (g >= 0) { groups[g].push(p); continue; }
    const k = planeKey(key[0], key[1], key[2], key[3]), list = planes.get(k);
    if (list) list.push(groups.length); else planes.set(k, [groups.length]);
    groups.push([p]);
  }
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
    const ringsOf = group.map(p => [p.region.outer, ...p.region.holes].map(r => orient(r.map(g => curve2(host, curve3Of(p.face, g), tol)))));
    // (The pieces' rings as `curveFaceRegions` made them: where it joined a cut's loose end, a few tolerances short of a
    // segment, a ring is closed to within that. The union closes them so, or drops the piece: L4 fuzz 20261026 #112, D252,
    // a wall's piece inside the other copy's cavity, its ring 6.7e-6 open. A piece alone goes through it too.)
    return clustersOf(ringsOf.map(rs => ringsBox(rs, 10 * tol))).flatMap(cluster => {
      // (A piece apart from the rest whose rings close is its own face as it is; one left open goes through the union.)
      if (cluster.length === 1 && regionCloses(group[cluster[0]].region)) return [group[cluster[0]]];
      const joined = booleanCurveRegions(cluster.flatMap(i => ringsOf[i]), [], 'union', tol, true);
      return joined.map(region => {
        const back = flipped ? { outer: [...region.outer].reverse().map(segReverse), holes: region.holes.map(h => [...h].reverse().map(segReverse)) } : region;
        const p2 = regionInteriorPoint(region) ?? [0, 0];
        // (Named after the first piece lying in it: a cluster can join into more than one face.)
        const own = cluster.length === 1 ? group[cluster[0]] : cluster.map(i => group[i]).find(p => locateInRegion(to2(host, p.key), region, 10 * tol) === 'in') ?? group[cluster[0]];
        return { face: own.face.name === host.name ? host : { ...host, name: own.face.name }, region: back, out: first.out, key: to3(host, p2) };
      });
    });
  });
}

// ---- stitching ---------------------------------------------------------------------------------------
class PointSet3 {
  readonly points: P3[] = []; private readonly grid = new Map<string, number[]>(); private readonly cell: number;
  constructor(readonly eps: number) { this.cell = eps * 16; }
  // (A cell's key is its three integer coordinates joined by commas; a point's cell found once. A neighbour cell is looked
  // in only where p lies within 2 eps of the side they share — a cell is 16 eps wide, so a point farther than that side
  // is farther than eps from p and could not be returned (2 eps: room for rounding). The first point within eps in cell
  // order, then insertion order, as before; most lookups now read one cell, not 27.)
  find(p: P3): number {
    const c = this.cell, gx = Math.floor(p[0] / c), gy = Math.floor(p[1] / c), gz = Math.floor(p[2] / c), P = this.points, eps = this.eps, r = 2 * eps;
    const x0 = p[0] - gx * c <= r ? -1 : 0, x1 = (gx + 1) * c - p[0] <= r ? 1 : 0, y0 = p[1] - gy * c <= r ? -1 : 0, y1 = (gy + 1) * c - p[1] <= r ? 1 : 0, z0 = p[2] - gz * c <= r ? -1 : 0, z1 = (gz + 1) * c - p[2] <= r ? 1 : 0;
    for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) for (let m = z0; m <= z1; m++) {
      const g = this.grid.get((gx + i) + ',' + (gy + j) + ',' + (gz + m));
      if (g) for (const v of g) { const q = P[v]; if (Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) <= eps) return v; }
    }
    return -1;
  }
  add(p: P3): number {
    const f = this.find(p); if (f >= 0) return f;
    const v = this.points.length, c = this.cell, k = Math.floor(p[0] / c) + ',' + Math.floor(p[1] / c) + ',' + Math.floor(p[2] / c);
    this.points.push(p); const g = this.grid.get(k); if (g) g.push(v); else this.grid.set(k, [v]); return v;
  }
}
const pointOf = (k: Curve3, u: number): P3 => k.kind === 'line' ? add(k.p, scale(sub(k.q, k.p), u)) : k.kind === 'param' ? paramAt(k, u) : arcAt(k, k.sweep * u);
const startOf = (k: Curve3): P3 => k.kind === 'line' ? k.p : k.kind === 'param' ? k.at(k.t0) : arcAt(k, 0);
const endOf = (k: Curve3): P3 => k.kind === 'line' ? k.q : k.kind === 'param' ? k.at(k.t1) : arcAt(k, k.sweep);
const midOf = (k: Curve3): P3 => k.kind === 'line' ? scale(add(k.p, k.q), 0.5) : k.kind === 'param' ? paramAt(k, 0.5) : arcAt(k, k.sweep / 2);
/** Points in the cells of a uniform grid (about two a cell), for the vertices near a curve. */
interface VertexGrid { readonly points: readonly P3[]; readonly lo: P3; readonly cell: number; readonly n: readonly [number, number, number]; readonly cells: Map<number, number[]> }
function vertexGrid(points: readonly P3[]): VertexGrid {
  const lo: P3 = [Infinity, Infinity, Infinity], hi: P3 = [-Infinity, -Infinity, -Infinity];
  for (const p of points) for (let k = 0; k < 3; k++) { if (p[k] < lo[k]) lo[k] = p[k]; if (p[k] > hi[k]) hi[k] = p[k]; }
  const span = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2], 1e-12), cell = span / Math.max(1, Math.cbrt(points.length / 2));
  const n: [number, number, number] = [0, 1, 2].map(k => Math.max(1, Math.ceil((hi[k] - lo[k]) / cell) + 1)) as [number, number, number], cells = new Map<number, number[]>();
  points.forEach((p, v) => {
    const key = cellOf(p[0], lo[0], cell, n[0]) + n[0] * (cellOf(p[1], lo[1], cell, n[1]) + n[1] * cellOf(p[2], lo[2], cell, n[2]));
    const list = cells.get(key); if (list) list.push(v); else cells.set(key, [v]);
  });
  return { points, lo, cell, n, cells };
}
const cellOf = (x: number, lo: number, cell: number, n: number) => Math.min(n - 1, Math.max(0, Math.floor((x - lo) / cell)));
/** The box lo–hi grown to take p padded by pad. */
function widen(lo: P3, hi: P3, p: P3, pad: number): void { for (let i = 0; i < 3; i++) { if (p[i] - pad < lo[i]) lo[i] = p[i] - pad; if (p[i] + pad > hi[i]) hi[i] = p[i] + pad; } }
/** The vertices whose cells meet the curve's box widened by eps (a line's ends, an arc's circle, a traced curve's samples): every vertex onCurve could take. */
function nearCurve(g: VertexGrid, k: Curve3, eps: number): number[] {
  const lo: P3 = [Infinity, Infinity, Infinity], hi: P3 = [-Infinity, -Infinity, -Infinity];
  if (k.kind === 'line') { widen(lo, hi, k.p, eps); widen(lo, hi, k.q, eps); }
  else if (k.kind === 'arc') widen(lo, hi, k.c, k.r + eps);
  else { const pre = sampledOf(k); widen(lo, hi, pre.min, eps); widen(lo, hi, pre.max, eps); }
  const a = [0, 1, 2].map(i => cellOf(lo[i], g.lo[i], g.cell, g.n[i])), b = [0, 1, 2].map(i => cellOf(hi[i], g.lo[i], g.cell, g.n[i]));
  // (A curve across most of the body: every vertex, as before.)
  if ((b[0] - a[0] + 1) * (b[1] - a[1] + 1) * (b[2] - a[2] + 1) > g.cells.size) return g.points.map((_, v) => v);
  const out: number[] = [];
  for (let z = a[2]; z <= b[2]; z++) for (let y = a[1]; y <= b[1]; y++) for (let x = a[0]; x <= b[0]; x++) {
    const list = g.cells.get(x + g.n[0] * (y + g.n[1] * z)); if (list) for (const v of list) out.push(v);
  }
  return out;
}
/** Parameter in [0, 1] of a point on the curve, or null when it is not on it (within eps). */
const sampled = new WeakMap<Curve3, { ps: P3[]; min: P3; max: P3 }>();
function sampledOf(k: Extract<Curve3, { kind: 'param' }>): { ps: P3[]; min: P3; max: P3 } {
  let pre = sampled.get(k);
  if (!pre) { const ps = Array.from({ length: 65 }, (_, i) => paramAt(k, i / 64)), pad = len(sub(ps[1], ps[0])) + len(sub(ps[64], ps[63]));
    pre = { ps, min: [minAt(ps, 0) - pad, minAt(ps, 1) - pad, minAt(ps, 2) - pad], max: [maxAt(ps, 0) + pad, maxAt(ps, 1) + pad, maxAt(ps, 2) + pad] }; sampled.set(k, pre); }
  return pre;
}
function onCurve(k: Curve3, x: P3, eps: number): number | null {
  if (k.kind === 'param') {
    // Samples and their box, once per curve: most vertices are far from most curves.
    const pre = sampledOf(k);
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
/** An input edge's curve between two of its parameters (either order), exactly, its ends at the stitched vertices p, q. */
function pieceOf(src: Curve, t0: number, t1: number, id: string, p: P3, q: P3): Curve {
  const piece = curvePiece(src, Math.min(t0, t1), Math.max(t0, t1), id), c = t0 <= t1 ? piece : curveReversed(piece), cp = c.controlPoints.map(x => [...x] as P3);
  cp[0] = p; cp[cp.length - 1] = q;
  // (On [0, 1], as the kernel's other edges: a walk back along a coedge then ends on its domain, not an ulp off it.)
  const lo = c.knots[0], span = c.knots[c.knots.length - 1] - lo;
  return { ...c, id, controlPoints: cp, knots: c.knots.map((k, i) => i === c.knots.length - 1 ? 1 : (k - lo) / span) };
}
/** A curve as a NURBS edge: lines degree 1; arcs rational quadratic in spans of at most a quarter turn. */
function nurbs(k: Curve3, id: string, p: P3, q: P3, tol = 0, strict = false): Curve {
  if (k.kind === 'line') return lineCurve(id, p, q);
  if (k.kind === 'param' && k.src) return pieceOf(k.src, k.t0, k.t1, id, p, q);
  if (k.kind === 'param') return fitCubic(k, id, p, q, tol, strict);
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
function fitCubic(k: Extract<Curve3, { kind: 'param' }>, id: string, p: P3, q: P3, tol: number, strict = false): Curve {
  const fit = fitWith(k, id, p, q, FIT_PIECES, strict);
  if (strict && !(fit.error <= tol)) throw new BrepError('GEOMETRY', `analytic Boolean: stitched parametric edge fit exceeds requested accuracy (t0=${k.t0}, t1=${k.t1}, achievedMM=${fit.error}, requestedMM=${tol})`);
  return fit.curve;
}
/** Five-point first-derivative stencils (×12h) at a grid's two ends, next to them, and inside: the strict edge fit's tangents (D175, D182). */
const FIVE_POINT_START = [-25, 48, -36, 16, -3], FIVE_POINT_SECOND = [-3, -10, 18, -6, 1], FIVE_POINT_PENULTIMATE = [-1, 6, -18, 10, 3], FIVE_POINT_END = [3, -16, 36, -48, 25], FIVE_POINT_CENTRAL = [1, -8, 0, 8, -1];
function fitWith(k: Extract<Curve3, { kind: 'param' }>, id: string, p: P3, q: P3, n: number, strict = false): { curve: Curve; error: number } {
  const at = (u: number) => u <= 0 ? p : u >= 1 ? q : paramAt(k, u), h = 1e-6;
  const d = (u: number) => { const a = paramAt(k, Math.max(0, u - h)), b = paramAt(k, Math.min(1, u + h)); return scale(sub(b, a), 1 / (Math.min(1, u + h) - Math.max(0, u - h))); };
  let handles: P3[] | undefined;
  if (strict) {
    const samples: P3[] = [];
    for (let i = 0; i <= n; i++) samples.push(paramAt(k, i / n));
    // Fourth-order five-point tangents on the actual Bezier grid. A handle is
    // (span / 3) * derivative: the grid spacing cancels to 1/36. Subtract the
    // local point before weighting, without dividing coordinate noise by 1e-6.
    // Reuse each handle on both sides of a node to retain the C1 chain.
    // (Plain loops, the stencils at module level: this runs per fitted edge, D182.)
    handles = [];
    for (let i = 0; i <= n; i++) {
      const p0 = samples[i], start = Math.max(0, Math.min(n - 4, i - 2));
      const coefficients = i === 0 ? FIVE_POINT_START : i === 1 ? FIVE_POINT_SECOND : i === n - 1 ? FIVE_POINT_PENULTIMATE : i === n ? FIVE_POINT_END : FIVE_POINT_CENTRAL;
      let hx = 0, hy = 0, hz = 0;
      for (let j = 0; j < 5; j++) { const q = samples[start + j], w = coefficients[j] / 36; hx += (q[0] - p0[0]) * w; hy += (q[1] - p0[1]) * w; hz += (q[2] - p0[2]) * w; }
      handles.push([hx, hy, hz]);
    }
  }
  {
    const cp: P3[] = [at(0)], knots = [0, 0, 0, 0];
    for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = (i + 1) / n, P0 = at(u0), P1 = at(u1), du = (u1 - u0) / 3;
      cp.push(add(P0, handles ? handles[i] : scale(d(u0), du)), sub(P1, handles ? handles[i + 1] : scale(d(u1), du)), P1);
      if (i < n - 1) knots.push(u1, u1, u1);
    }
    knots.push(1, 1, 1, 1);
    const curve: Curve = { kind: 'curve', id, degree: 3, knots, controlPoints: cp, weights: cp.map(() => 1) };
    const ev = curveEvaluator(curve);
    let err = strict ? Math.max(len(sub(p, paramAt(k, 0))), len(sub(q, paramAt(k, 1)))) : 0;
    for (let i = 0; i < n; i++) for (const f of INNER_QUARTERS) err = Math.max(err, len(sub(ev((i + f) / n), at((i + f) / n))));
    return { curve, error: err };
  }
}
/** A parametric curve in pieces (halving its parameter range) each of which one fit holds within tol. */
function fitPieces(k: Curve3, tol: number, depth = 0, strict = false): Curve3[] {
  if (k.kind !== 'param' || (!strict && depth >= 10)) return [k];
  const fit = fitWith(k, 'fit', k.at(k.t0), k.at(k.t1), FIT_PIECES, strict);
  if (fit.error <= tol) return [k];
  if (depth >= 10) throw new BrepError('GEOMETRY', `analytic Boolean: parametric edge fit did not meet the requested accuracy (t0=${k.t0}, t1=${k.t1}, depth=${depth}, achievedMM=${fit.error}, requestedMM=${tol})`);
  const m = (k.t0 + k.t1) / 2;
  return [...fitPieces({ ...k, t1: m }, tol, depth + 1, strict), ...fitPieces({ ...k, t0: m }, tol, depth + 1, strict)];
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

/** `names`: per piece, its face's name as given (a face split keeps every other face's name exactly, D149). */
/**
 * Each edge used by four faces — two forward, two reversed — whose uses fall in two lumps (pieces joined through the
 * edges used once each way), one forward and one reversed in each: the second lump's uses moved to a copy of the edge.
 */
function splitTouchingEdges(loops: { edge: string; sense: string; index: number }[][][], edges: { id: string }[], id: string, count: number): void {
  const uses = new Map<number, { piece: number; use: { edge: string; sense: string; index: number } }[]>();
  loops.forEach((ls, pi) => { for (const ring of ls) for (const u of ring) { const l = uses.get(u.index); if (l) l.push({ piece: pi, use: u }); else uses.set(u.index, [{ piece: pi, use: u }]); } });
  const root = Array.from({ length: count }, (_, i) => i), find = (x: number): number => { while (root[x] !== x) x = root[x] = root[root[x]]; return x; };
  for (const l of uses.values()) if (l.length === 2 && l[0].use.sense !== l[1].use.sense) root[find(l[0].piece)] = find(l[1].piece);
  for (const [e, l] of uses) {
    if (l.length !== 4 || l.filter(u => u.use.sense === 'forward').length !== 2) continue;
    const lumps = [...new Set(l.map(u => find(u.piece)))];
    if (lumps.length !== 2) continue;
    const second = l.filter(u => find(u.piece) === lumps[1]);
    if (second.length !== 2 || second[0].use.sense === second[1].use.sense) continue;
    const copy = { ...edges[e], id: `${id}_e${edges.length}` }, k = edges.length;
    edges.push(copy);
    for (const u of second) { u.use.edge = copy.id; u.use.index = k; }
  }
}
/**
 * A loop's uses of one edge out and straight back (consecutive, either sense first, round its end) taken out, again until
 * none (or `keep` uses are left). With a cylinder's face, an edge on its seam stays: the face meets it both ways.
 */
function unspike(ring: { index: number; sense: string }[], keep: number, seamOf?: { surf: Surf }, edges?: readonly { mid: P3 }[], tol = 0): void {
  for (let again = true; again && ring.length >= Math.max(2, keep);) {
    again = false;
    for (let i = 0; i < ring.length && ring.length >= Math.max(2, keep); i++) {
      const j = (i + 1) % ring.length;
      if (ring[i].index !== ring[j].index || ring[i].sense === ring[j].sense) continue;
      if (seamOf && edges && onCylinderSeam(seamOf, edges[ring[i].index].mid, tol)) continue;
      if (j > i) ring.splice(i, 2); else { ring.splice(i, 1); ring.splice(0, 1); }
      again = true; break;
    }
  }
}
/** A point a face's loops pass at two distinct vertices (within `tol` of each other), or null. */
function twicePassed(rings: readonly (readonly { index: number; sense: string }[])[], edgeList: readonly { vertices: readonly [string, string] }[], vertexList: readonly { id: string; point: P3 }[], tol: number): P3 | null {
  const ids = new Set<string>();
  for (const ring of rings) for (const u of ring) { const v = edgeList[u.index].vertices; ids.add(u.sense === 'forward' ? v[0] : v[1]); }
  const pts = vertexList.filter(v => ids.has(v.id)).map(v => v.point);
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) if (len(sub(pts[i], pts[j])) <= tol) return pts[i];
  return null;
}
/** Whether x lies on a cylinder face's seam (θ = ref ± π), within 100 tolerances along its wall. */
function onCylinderSeam(f: { surf: Surf }, x: P3, tol: number): boolean {
  const s = f.surf; if (s.kind !== 'cylinder') return false;
  const d = sub(x, s.c), th = Math.atan2(dot(d, s.e2), dot(d, s.e1));
  return (Math.PI - Math.abs(wrap(th - s.ref))) * s.r <= 100 * tol;
}
/** Points in order of x, then y, then z, a coordinate within eps of the other's counting as equal. */
function keyOrder(a: P3, b: P3, eps: number): number {
  for (let i = 0; i < 3; i++) if (Math.abs(a[i] - b[i]) > eps) return a[i] - b[i];
  return 0;
}
/** A kept piece that is an input face as it was (`frozen`): its loops and edges are taken from its B-rep, not rebuilt. */
interface FrozenFace { readonly face: BrepFaceRecord; readonly brep: Brep }
type BrepFaceRecord = Brep['faces'][number];
function stitch(pieces: Piece[], id: string, tol: number, exactEdges = false, inputTol = 0, names?: readonly (string | undefined)[], edgeFitTolerance?: number, frozen?: ReadonlyMap<Piece, FrozenFace>): Brep {
  // (Frozen faces — far from the other operand, kept whole — keep their input loops; their edges are put in first, and a
  // neighbour's boundary along one finds it as a copy of a curve is found. If that does not close up, the whole is rebuilt.)
  if (frozen?.size) { try { return stitchWith(pieces, id, tol, exactEdges, inputTol, names, edgeFitTolerance, frozen); } catch (e) { if (!(e instanceof BrepError)) throw e; } }
  return stitchWith(pieces, id, tol, exactEdges, inputTol, names, edgeFitTolerance);
}
function stitchWith(pieces: Piece[], id: string, tol: number, exactEdges = false, inputTol = 0, names?: readonly (string | undefined)[], edgeFitTolerance?: number, frozen?: ReadonlyMap<Piece, FrozenFace>): Brep {
  const frozenAt = pieces.map(p => frozen?.get(p) ?? null);
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
  // (A piece of an input edge's own curve stays that curve: no fit, D90.)
  const fitTol = edgeFitTolerance ?? tol / 4;
  const ringsOf = (p: Piece) => [p.region.outer, ...p.region.holes].map(r => r.flatMap(g => { const k = curve3Of(p.face, g); return point(k) ? [] : open(exactEdges && k.kind === 'param' && k.exact ? exactly(k, tol * 1e-3) : k).flatMap(x => x.kind === 'param' && x.src ? [x] : fitPieces(x, fitTol, 0, edgeFitTolerance !== undefined)); }));
  // (A frozen face's input records, its loops outer first.)
  const recordsOf = new Map<Brep, { edges: Map<string, Brep['edges'][number]>; vertices: Map<string, Brep['vertices'][number]>; loops: Map<string, Brep['loops'][number]>; coedges: Map<string, Brep['coedges'][number]> }>();
  const records = (b: Brep) => { let r = recordsOf.get(b); if (!r) { r = { edges: new Map(b.edges.map(e => [e.id, e])), vertices: new Map(b.vertices.map(v => [v.id, v])), loops: new Map(b.loops.map(l => [l.id, l])), coedges: new Map(b.coedges.map(c => [c.id, c])) }; recordsOf.set(b, r); } return r; };
  const loopsOf = new Map<FrozenFace, Brep['coedges'][number][][]>();
  const frozenLoops = (z: FrozenFace) => { let L = loopsOf.get(z); if (!L) { const R = records(z.brep), outer = z.face.loops.find(l => R.loops.get(l)!.kind === 'outer')!; L = [outer, ...z.face.loops.filter(l => l !== outer)].map(l => R.loops.get(l)!.coedges.map(c => R.coedges.get(c)!)); loopsOf.set(z, L); } return L; };
  // (A frozen face stays frozen only where its rebuilt boundary would be its input loops one for one — no curve left out,
  // halved or fitted in pieces — so the result's edges are the full rebuild's.)
  const rings = pieces.map((p, pi) => {
    const z = frozenAt[pi];
    if (!z) return ringsOf(p);
    const rs = ringsOf(p), L = frozenLoops(z);
    if (rs.length !== L.length || rs.some((r, i) => r.length !== L[i].length)) { frozenAt[pi] = null; return rs; }
    return [];
  });
  // (Frozen faces' vertices go in as their pieces come, at their input points.)
  const addedVertex = new Map<Brep, Set<string>>();
  rings.forEach((ps, pi) => {
    const z = frozenAt[pi];
    if (z) {
      const R = records(z.brep); let seen = addedVertex.get(z.brep); if (!seen) { seen = new Set(); addedVertex.set(z.brep, seen); }
      for (const loop of frozenLoops(z)) for (const c of loop) for (const v of R.edges.get(c.edge)!.vertices) if (!seen.has(v)) { seen.add(v); set.add(R.vertices.get(v)!.point as P3); }
      return;
    }
    for (const ring of ps) for (const k of ring) { set.add(startOf(k)); set.add(endOf(k)); }
  });
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
  const edges: { id: string; k: Curve3; v: [number, number]; mid: P3; by: number; curve?: Curve }[] = [], between = new Map<string, number[]>();
  // (A traced curve met again by the piece that made it is two curves within the tolerance of each other — a lens the
  // inputs' graze left, collapsed into one edge used both ways by one face. Such a result is checked strictly before it
  // is returned: RB K9, D186. A seam met twice only adds that check.)
  let piece = -1, collapsed = 0;
  const edgeOf = (k: Curve3, a: number, b: number) => {
    const mid = midOf(k), key = Math.min(a, b) + ':' + Math.max(a, b), list = between.get(key) ?? [];
    // The same curve from either face: a parametric piece's midpoint depends on the face that
    // parametrized it, so it is looked for on the other copy rather than compared.
    // A traced curve is within its tracing tolerance of the exact one it copies.
    const loose = (x: Curve3) => x.kind === 'param' && !x.exact;
    let e = list.find(i => { const eps = (loose(k) || loose(edges[i].k) ? 100 : 10) * tol; return len(sub(edges[i].mid, mid)) <= eps || onCurve(edges[i].k, mid, eps) !== null; });
    if (e === undefined) { e = edges.length; edges.push({ id: `${id}_e${e}`, k, v: [a, b], mid, by: piece }); list.push(e); between.set(key, list); }
    else if (edges[e].by === piece && (k.kind === 'param' || edges[e].k.kind === 'param')) collapsed++;
    return { edge: edges[e].id, sense: (edges[e].v[0] === a ? 'forward' : 'reversed') as 'forward' | 'reversed', index: e };
  };
  // (Frozen faces' edges first, each once: their input curves, between their vertices.)
  const frozenEdge = new Map<Brep, Map<string, number>>();
  pieces.forEach((_, pi) => {
    const z = frozenAt[pi]; if (!z) return;
    const R = records(z.brep); let seen = frozenEdge.get(z.brep); if (!seen) { seen = new Map(); frozenEdge.set(z.brep, seen); }
    for (const loop of frozenLoops(z)) for (const c of loop) {
      if (seen.has(c.edge)) continue;
      const e = R.edges.get(c.edge)!, a = vertexOf(R.vertices.get(e.vertices[0])!.point as P3), b = vertexOf(R.vertices.get(e.vertices[1])!.point as P3);
      if (a === b) throw new BrepError('TOPOLOGY', 'analytic Boolean: a frozen face has a closed edge');
      const k = curve3(e.curve, true), i = edges.length, key = Math.min(a, b) + ':' + Math.max(a, b), list = between.get(key) ?? [];
      edges.push({ id: `${id}_e${i}`, k, v: [a, b], mid: midOf(k), by: -1, curve: e.curve }); list.push(i); between.set(key, list); seen.set(c.edge, i);
    }
  });
  // (Only the vertices in a curve's box can lie on it: a grid over them, so a mesh-sized body is not every
  // vertex against every curve.)
  const grid = vertexGrid(P);
  const loops = rings.map((ps, pi) => frozenAt[pi] ? frozenLoops(frozenAt[pi]!).map(loop => loop.map(c => { const i = frozenEdge.get(frozenAt[pi]!.brep)!.get(c.edge)!; return { edge: edges[i].id, sense: c.sense, index: i }; })) : (piece = pi, ps).map(ring => ring.flatMap(k => {
    const a = vertexOf(startOf(k)), b = vertexOf(endOf(k)), stops = [{ t: 0, v: a }];
    for (const v of nearCurve(grid, k, tol)) { if (v === a || v === b || alias[v] !== v) continue; const t = onCurve(k, P[v], tol); if (t !== null) stops.push({ t, v }); }
    stops.sort((x, y) => x.t - y.t); stops.push({ t: 1, v: b });
    const out: ReturnType<typeof edgeOf>[] = [];
    for (let i = 0; i + 1 < stops.length; i++) if (stops[i].v !== stops[i + 1].v) out.push(edgeOf(part(k, stops[i].t, stops[i + 1].t, P[stops[i].v], P[stops[i + 1].v]), stops[i].v, stops[i + 1].v));
    return out;
  })));
  // (A planar piece's loop that runs out along an edge and straight back along it — a cut ending inside the face, the tip
  // it cut off too small to keep — bounds nothing there: both uses go, and the edge with them; a hole that is nothing
  // else — a slit where a body touches the face along a line — goes whole. Planes, and cylinders off their seam: a seam
  // of a periodic face is met both ways, a cone's even one after the other at its apex. L4 fuzz seed 20261024 #41,
  // 20261023 #149, D201. On a cylinder: a ruling lying along another face's edge cut the wall there and divided nothing,
  // a slit up the wall; the commutativity check's 20261024 #96, D273.)
  loops.forEach((ls, pi) => {
    const f = pieces[pi].face;
    if (frozenAt[pi] || (f.surf.kind !== 'plane' && f.surf.kind !== 'cylinder')) return;
    ls.forEach((ring, k) => unspike(ring, k > 0 ? 0 : 3, f.surf.kind === 'cylinder' ? f : undefined, edges, tol));
    for (let k = ls.length - 1; k > 0; k--) if (!ls[k].length) ls.splice(k, 1);
  });
  // (Two lumps touching along a curve: one edge used by four faces, two of each lump. Its uses are paired by lump —
  // the pieces joined through every edge used once each way — and the second lump's pair gets an edge of its own, so
  // each lump is a body on its own, as lumps apart are. A lump touching itself there, all four uses in one, stays
  // refused below. L4 fuzz 49, 50, 100, 131, D204.)
  splitTouchingEdges(loops, edges, id, pieces.length);
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
      for (const [a, b, c] of triangulatePinched(outer, holes, tol)) v += dot(pts[a], cross(pts[b], pts[c])) / 6;
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
    // (By their points inside, a coordinate within 100 tolerances counting as equal: a cylinder's two halves have one x
    // to within rounding, and read exactly their order flipped from one Boolean to the next, the earlier boss's
    // `side0#1` becoming `#2`; D282.)
    [...list].sort((x, y) => keyOrder(pieces[x].key, pieces[y].key, 100 * tol)).forEach((i, k) => { faceNames[i] = `${n}#${k + 1}`; });
  }
  if (names) names.forEach((n, i) => { if (n !== undefined) faceNames[i] = n; });
  const edgeList = edges.map((e, i) => ({ id: e.id, curve: e.curve ? { ...e.curve, id: e.id } : nurbs(e.k, e.id, P[e.v[0]], P[e.v[1]], fitTol, edgeFitTolerance !== undefined), vertices: [vertexAt(e.v[0], i), vertexAt(e.v[1], i)] as [string, string],
    name: [...new Set((uses.get(i) ?? []).map(u => faceNames[u.piece]))].sort().join('|') }));
  nameEdges(edgeList);
  // (A planar face whose boundary passes one point at two vertices: two of the inputs touch along a line there, apart,
  // and the body they make touches itself along it — not a manifold solid, though every edge is used once each way. Its
  // face's loops touch there: refused, typed, rather than returned failing the strict check. The commutativity check's
  // 20261024 #51 and 20261023 #114, D275.)
  loops.forEach((ls, pi) => { if (!frozenAt[pi] && pieces[pi].face.surf.kind === 'plane') { const at = twicePassed(ls, edgeList, vertexList, 20 * tol); if (at) throw new BrepError('GEOMETRY', `analytic Boolean: the result touches itself at (${at.map(x => +x.toFixed(4))}): a face's boundary passes that point twice; the inputs touch along a line there`); } });
  const surface = (pi: number): { surface: Surface; sense: 'forward' | 'reversed' } => {
    const p = pieces[pi], s = p.face.surf, pts: XY[] = [], z = frozenAt[pi];
    if (z) return { surface: { ...(z.face.surface as Surface), id: `${id}_s${pi}` }, sense: z.face.sense };
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
  const usedVertices = new Set(edgeList.filter((_, i) => uses.has(i)).flatMap(e => e.vertices));
  const result = buildBrep({ source: { family: 'analytic-boolean', id },
    vertices: vertexList.filter(v => usedVertices.has(v.id)),
    edges: edgeList.filter((_, i) => uses.has(i)),
    bodies: bodies.map((bd, k) => ({ id: `${id}_body${k}`, kind: 'solid' as const, shells: [bd.outer, ...bd.cavities].map((g, si) => ({ id: 's' + si, closed: true,
      faces: g.members.map(pi => ({ id: 'f' + pi, name: faceNames[pi], ...surface(pi), loops: loops[pi].map((uses2, li) => ({ kind: li === 0 ? 'outer' as const : 'inner' as const, uses: uses2.map(u => ({ edge: u.edge, sense: u.sense })) })) })) })) })),
    tolerance: Math.max(tol, inputTol) });
  // Solids that touch at a vertex give a non-manifold result; refuse it plainly (as for edges).
  const report = checkBrep(result);
  if (!report.valid) throw new BrepError('TOPOLOGY', `analytic Boolean: the result is not a manifold solid (the inputs touch along an edge or at a vertex): ${report.issues[0]}`, report);
  // A collapsed sliver (above) can leave a face's loops crossing — a wrong body, its volume off: refused, typed (D186).
  if (collapsed) {
    const strict = checkBrep(result, { strict: true });
    if (!strict.valid) throw new BrepError('GEOMETRY', `analytic Boolean: the inputs graze within ${+(20 * tol).toPrecision(3)} mm (the merge radius) and the sliver between them cannot be built: ${strict.issues[0]}`, strict);
  }
  return result;
}
