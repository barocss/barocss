// Booleans of B-reps bounded by planes and circular cylinders of any axis (brep-core step 7): cross
// holes, pins lying along X, bodies turned about X or Y together with cylinders. Every intersection
// of two such faces handled here is a straight line or a circle:
//
//   plane × plane          a line (coplanar faces cut each other along their boundaries)
//   plane × cylinder       lines along the axis (plane parallel to it) or a circle (plane across it)
//   cylinder × cylinder    lines along the axes (parallel axes); one cylinder: boundaries cut each other
//
// Other cases — a plane oblique to an axis (an ellipse), cylinders with crossing axes that meet (a
// quartic) — are refused with the reason. Each face is split in its own 2D domain: a plane in an
// orthonormal frame (lines and arcs), a cylinder in (U, V) = (±r·θ, height) where its boundaries are
// straight; both use the line + arc arrangement. Pieces are classified at an interior point (on a face
// of the other solid, or inside / outside by ray parity, retried on a degenerate ray), kept by the
// operation's rule, split at shared vertices and stitched into shells; negative shells are cavities.
// Works in binary64 with the numeric policy's tolerance at the inputs' scale.
import { BrepError, buildBrep, checkBrep, lineCurve, type Brep, type BrepFace } from './brep-core.js';
import { circleOf } from './brep-tessellate.js';
import { curveFaceRegions, intersectSegments, locateInRegion, regionArea, regionInteriorPoint, type CurveRegion2, type CurveSegment2, type XY } from './curved-arrangement.js';
import { nameEdges } from './prismatic-solid.js';
import { baseName } from './polyhedral-boolean.js';
import { evaluateCurve, evaluateSurface, curveDomain, surfaceDomain } from './math.js';
import { linearToleranceMM } from './numeric-policy.js';
import type { Curve, Point, Surface } from './types.js';

export type AnalyticBooleanOperation = 'union' | 'intersection' | 'difference';

type P3 = Point;
const sub = (a: P3, b: P3): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: P3, b: P3): P3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: P3, k: number): P3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: P3, b: P3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: P3, b: P3): P3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: P3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: P3): P3 => mul(a, 1 / (len(a) || 1));
const TWO_PI = 2 * Math.PI;

// ---- surfaces and face domains ------------------------------------------------------------------
type Plane = { kind: 'plane'; o: P3; n: P3; e1: P3; e2: P3 };
/** Axis a (canonical sign), frame e1, e2 ⊥ a, U = s·r·θ with θ unwrapped about `ref`, V = height along a from c. */
type Cylinder = { kind: 'cylinder'; c: P3; a: P3; e1: P3; e2: P3; r: number; s: 1 | -1; ref: number };
type Surf = Plane | Cylinder;
interface GFace {
  solid: 0 | 1; surf: Surf; region: CurveRegion2; out: 1 | -1; min: P3; max: P3; name?: string; cuts: CurveSegment2[];
}
/** A 3D curve piece: a segment, or an arc about c in the plane ⊥ n from u through `sweep` (≥ 0, CCW about n). */
type Curve3 = { kind: 'line'; p: P3; q: P3 } | { kind: 'arc'; c: P3; n: P3; r: number; u: P3; sweep: number };
const arcAt = (k: Extract<Curve3, { kind: 'arc' }>, phi: number): P3 => add(k.c, add(mul(k.u, k.r * Math.cos(phi)), mul(cross(k.n, k.u), k.r * Math.sin(phi))));

function canonicalFrame(axis: P3): { a: P3; e1: P3; e2: P3 } {
  const big = [0, 1, 2].reduce((m, i) => Math.abs(axis[i]) > Math.abs(axis[m]) ? i : m, 0), a = unit(axis[big] > 0 ? axis : mul(axis, -1));
  let e1: P3 = [1 - a[0] * a[0], -a[0] * a[1], -a[0] * a[2]];
  if (len(e1) < 0.5) e1 = [-a[1] * a[0], 1 - a[1] * a[1], -a[1] * a[2]];
  e1 = unit(e1); return { a, e1, e2: cross(a, e1) };
}
/** x in [−π, π). */
const wrap = (x: number) => ((x + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;
function to2(f: { surf: Surf }, x: P3): XY {
  const s = f.surf;
  if (s.kind === 'plane') { const d = sub(x, s.o); return [dot(d, s.e1), dot(d, s.e2)]; }
  const d = sub(x, s.c), th = Math.atan2(dot(d, s.e2), dot(d, s.e1));
  return [s.s * s.r * (s.ref + wrap(th - s.ref)), dot(d, s.a)];
}
function to3(f: { surf: Surf }, p: XY): P3 {
  const s = f.surf;
  if (s.kind === 'plane') return add(s.o, add(mul(s.e1, p[0]), mul(s.e2, p[1])));
  const th = p[0] / (s.s * s.r);
  return add(add(s.c, mul(s.a, p[1])), add(mul(s.e1, s.r * Math.cos(th)), mul(s.e2, s.r * Math.sin(th))));
}
/** Outward normal of the face's material at x. */
function normalOut(f: GFace, x: P3): P3 {
  const s = f.surf;
  if (s.kind === 'plane') return mul(s.n, f.out);
  const d = sub(x, s.c), radial = unit(sub(d, mul(s.a, dot(d, s.a))));
  return mul(radial, s.s * f.out);
}

function surfaceOf(face: BrepFace, tol: number): Surf {
  const S = face.surface, sign = face.sense === 'forward' ? 1 : -1, [u0, u1] = surfaceDomain(S).u, [v0, v1] = surfaceDomain(S).v;
  const centre = evaluateSurface(S, (u0 + u1) / 2, (v0 + v1) / 2), du = 1e-6 * (u1 - u0), dv = 1e-6 * (v1 - v0);
  const nParam = unit(cross(sub(evaluateSurface(S, (u0 + u1) / 2 + du, (v0 + v1) / 2), centre), sub(evaluateSurface(S, (u0 + u1) / 2, (v0 + v1) / 2 + dv), centre)));
  const outward = mul(nParam, sign);
  if (S.degreeU === 1 && S.degreeV === 1 && S.controlPoints.length === 2 && S.controlPoints[0].length === 2) {
    const [[p00], [p10]] = S.controlPoints as P3[][], e1 = unit(sub(p10, p00)), n = outward, e2 = cross(n, e1);
    const p11 = S.controlPoints[1][1] as P3;
    if (Math.abs(dot(sub(p11, p00), n)) > tol) throw new BrepError('GEOMETRY', `analytic Boolean: face ${face.id} is a twisted bilinear patch`);
    return { kind: 'plane', o: p00, n, e1, e2: unit(e2) };
  }
  if (S.degreeV === 1 && S.controlPoints[0]?.length === 2) {
    const base: Curve = { kind: 'curve', id: 'base', degree: S.degreeU, knots: S.knotsU, controlPoints: S.controlPoints.map(r => r[0]), weights: S.weights.map(w => w[0]) };
    const circle = circleOf(base);
    const axis = sub(S.controlPoints[0][1] as P3, S.controlPoints[0][0] as P3);
    if (circle && len(axis) > 0) {
      const { a, e1, e2 } = canonicalFrame(axis), cplane = unit(cross(sub(base.controlPoints[0] as P3, circle.c), sub(base.controlPoints[2] as P3, circle.c)));
      if (Math.abs(Math.abs(dot(cplane, a)) - 1) > 1e-9) throw new BrepError('GEOMETRY', `analytic Boolean: face ${face.id} is an oblique (elliptic) extrusion`);
      const d = sub(centre, circle.c), radial = unit(sub(d, mul(a, dot(d, a))));
      return { kind: 'cylinder', c: circle.c, a, e1, e2, r: circle.r, s: dot(outward, radial) > 0 ? 1 : -1, ref: Math.atan2(dot(d, e2), dot(d, e1)) };
    }
  }
  throw new BrepError('GEOMETRY', `analytic Boolean: face ${face.id} is neither a plane nor a circular cylinder`);
}

/** A B-rep edge (oriented by a coedge) as a 3D line or arc. */
function curve3(c: Curve, forward: boolean): Curve3 {
  const [t0, t1] = curveDomain(c), p = evaluateCurve(c, t0), q = evaluateCurve(c, t1);
  if (c.degree === 1 && c.controlPoints.length === 2) return forward ? { kind: 'line', p, q } : { kind: 'line', p: q, q: p };
  const k = circleOf(c);
  if (!k) throw new BrepError('GEOMETRY', `analytic Boolean: edge curve ${c.id} is neither straight nor circular`);
  const mid = evaluateCurve(c, (t0 + t1) / 2), total = k.spans.reduce((s, x) => s + x.phi, 0);
  let n = unit(cross(sub(p, k.c), sub(mid, k.c)));
  if (len(cross(sub(p, k.c), sub(mid, k.c))) < 1e-12 * k.r * k.r) n = unit(cross(sub(mid, k.c), sub(q, k.c)));
  const from = forward ? p : q;
  return { kind: 'arc', c: k.c, n: forward ? n : mul(n, -1), r: k.r, u: unit(sub(from, k.c)), sweep: total };
}
/** A 3D curve in a face's 2D domain. */
function curve2(f: { surf: Surf }, k: Curve3, tol: number, tag?: string): CurveSegment2 {
  const t = tag === undefined ? {} : { tag };
  const s = f.surf;
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
/** A 2D segment of a face's domain as a 3D curve. */
function curve3Of(f: { surf: Surf }, g: CurveSegment2): Curve3 {
  const s = f.surf;
  if (s.kind === 'plane') {
    if (g.kind === 'line') return { kind: 'line', p: to3(f, g.a), q: to3(f, g.b) };
    return { kind: 'arc', c: to3(f, g.c), n: mul(s.n, Math.sign(g.sweep)), r: g.r, u: unit(add(mul(s.e1, Math.cos(g.t0)), mul(s.e2, Math.sin(g.t0)))), sweep: Math.abs(g.sweep) };
  }
  if (g.kind !== 'line') throw new BrepError('GEOMETRY', 'analytic Boolean: a curved segment in a cylinder domain');
  // Cylinder boundaries are horizontal (cross-section arcs) or vertical (generators) in (U, V); vertices
  // merged within tolerance can tilt them slightly, so the dominant direction decides.
  if (Math.abs(g.b[0] - g.a[0]) > Math.abs(g.b[1] - g.a[1])) {
    const th0 = g.a[0] / (s.s * s.r), th1 = g.b[0] / (s.s * s.r), c = add(s.c, mul(s.a, (g.a[1] + g.b[1]) / 2));
    return { kind: 'arc', c, n: mul(s.a, Math.sign(th1 - th0)), r: s.r, u: unit(add(mul(s.e1, Math.cos(th0)), mul(s.e2, Math.sin(th0)))), sweep: Math.abs(th1 - th0) };
  }
  const u = (g.a[0] + g.b[0]) / 2;
  return { kind: 'line', p: to3(f, [u, g.a[1]]), q: to3(f, [u, g.b[1]]) };
}

function facesOf(brep: Brep, solid: 0 | 1, tol: number): GFace[] {
  const edges = new Map(brep.edges.map(e => [e.id, e])), coedges = new Map(brep.coedges.map(c => [c.id, c])), loops = new Map(brep.loops.map(l => [l.id, l]));
  return brep.faces.map(face => {
    const surf = surfaceOf(face, tol), g = { surf };
    const outer = face.loops.find(l => loops.get(l)!.kind === 'outer')!, ordered = [outer, ...face.loops.filter(l => l !== outer)];
    if (surf.kind === 'cylinder') for (const lid of ordered) { const used = loops.get(lid)!.coedges.map(cid => coedges.get(cid)!.edge); if (new Set(used).size !== used.length) throw new BrepError('GEOMETRY', `analytic Boolean: face ${face.id} is a full-turn cylinder with a seam (not supported yet)`); }
    const rings = ordered.map(lid => loops.get(lid)!.coedges.map(cid => { const c = coedges.get(cid)!; return curve2(g, curve3(edges.get(c.edge)!.curve, c.sense === 'forward'), tol); }));
    const min: P3 = [Infinity, Infinity, Infinity], max: P3 = [-Infinity, -Infinity, -Infinity];
    for (const lid of ordered) for (const cid of loops.get(lid)!.coedges) for (const p of edges.get(coedges.get(cid)!.edge)!.curve.controlPoints) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]); }
    return { solid, surf, region: { outer: rings[0], holes: rings.slice(1) }, out: 1 as const, min, max, ...(face.name === undefined ? {} : { name: baseName(face.name) }), cuts: [] };
  });
}

// ---- intersections ---------------------------------------------------------------------------------
/** Parameter intervals of a curve (line: t along d from p; circle: φ from the frame's e1) inside a face. */
function intervals(f: GFace, k: { kind: 'line'; p: P3; d: P3; lo: number; hi: number } | { kind: 'circle'; c: P3; n: P3; e1: P3; r: number; lo: number }, tol: number): [number, number][] {
  const params: number[] = [];
  let probe: CurveSegment2[], param: (x: P3) => number, at: (t: number) => P3;
  if (k.kind === 'line') {
    at = t => add(k.p, mul(k.d, t)); param = x => dot(sub(x, k.p), k.d) / dot(k.d, k.d);
    const a = to2(f, at(k.lo)), b = to2(f, at(k.hi));
    probe = [{ kind: 'line', a, b: f.surf.kind === 'cylinder' ? [a[0], b[1]] : b }];
    params.push(k.lo, k.hi);
  } else {
    const e2 = cross(k.n, k.e1); at = t => add(k.c, add(mul(k.e1, k.r * Math.cos(t)), mul(e2, k.r * Math.sin(t))));
    param = x => { const d = sub(x, k.c); let t = Math.atan2(dot(d, e2), dot(d, k.e1)); while (t < k.lo) t += TWO_PI; while (t >= k.lo + TWO_PI) t -= TWO_PI; return t; };
    const arc: Curve3 = { kind: 'arc', c: k.c, n: k.n, r: k.r, u: unit(sub(at(k.lo), k.c)), sweep: Math.PI };
    const arc2: Curve3 = { ...arc, u: unit(sub(at(k.lo + Math.PI), k.c)) };
    probe = [curve2(f, arc, tol), curve2(f, arc2, tol)];
    params.push(k.lo, k.lo + Math.PI, k.lo + TWO_PI);
  }
  const rings = [f.region.outer, ...f.region.holes];
  for (const pr of probe) for (const ring of rings) for (const g of ring) for (const x of intersectSegments(pr, g, tol)) params.push(param(to3(f, x)));
  params.sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < params.length; i++) {
    const a = params[i], b = params[i + 1]; if (b - a <= 1e-12 * Math.max(1, Math.abs(a))) continue;
    if (locateInRegion(to2(f, at((a + b) / 2)), f.region, tol) === 'out') continue;
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
      if ((hi - lo) * len(d) > tol) addCut({ kind: 'line', p: add(p, mul(d, lo)), q: add(p, mul(d, hi)) });
  };
  const circleCuts = (c: P3, n: P3, e1: P3, r: number, lo: number) => {
    const k = { kind: 'circle' as const, c, n, e1, r, lo };
    for (const [a, b] of overlaps(intervals(fa, k, tol), intervals(fb, k, tol))) if ((b - a) * r > tol) {
      const e2 = cross(n, e1), u = unit(add(mul(e1, Math.cos(a)), mul(e2, Math.sin(a))));
      addCut({ kind: 'arc', c, n, r, u, sweep: b - a });
    }
  };
  const same = (g: GFace, into: GFace) => { for (const ring of [g.region.outer, ...g.region.holes]) for (const seg of ring) into.cuts.push(curve2(into, curve3Of(g, seg), tol)); };
  const A = fa.surf, B = fb.surf;
  if (A.kind === 'plane' && B.kind === 'plane') {
    const D = cross(A.n, B.n);
    if (len(D) < 1e-12) { if (Math.abs(dot(A.n, sub(B.o, A.o))) <= tol) { same(fb, fa); same(fa, fb); } return; }
    const det = dot(D, D), da = dot(A.n, A.o), db = dot(B.n, B.o);
    lineCuts(mul(add(mul(cross(B.n, D), da), mul(cross(D, A.n), db)), 1 / det), unit(D));
    return;
  }
  if (A.kind === 'cylinder' && B.kind === 'cylinder') {
    if (len(cross(A.a, B.a)) > 1e-9) {
      // Crossing axes: the faces meet in a quartic unless the cylinders are apart.
      const w = cross(A.a, B.a), gap = Math.abs(dot(sub(B.c, A.c), unit(w)));
      if (gap >= A.r + B.r - tol) return;
      throw new Refused('cylinders with crossing axes intersect in a curve that is neither a line nor a circle (not supported yet)');
    }
    const d = sub(B.c, A.c), dPerp = sub(d, mul(A.a, dot(d, A.a))), D = len(dPerp);
    if (D <= tol && Math.abs(A.r - B.r) <= tol) { same(fb, fa); same(fa, fb); return; }
    if (D <= tol || D > A.r + B.r + tol || D < Math.abs(A.r - B.r) - tol) return;
    const x = (D * D + A.r * A.r - B.r * B.r) / (2 * D), h = Math.sqrt(Math.max(0, A.r * A.r - x * x)), ux = mul(dPerp, 1 / D), uy = cross(A.a, ux);
    for (const sgn of h > tol ? [-1, 1] : [0]) lineCuts(add(A.c, add(mul(ux, x), mul(uy, sgn * h))), A.a);
    return;
  }
  const [P, C] = (A.kind === 'plane' ? [A, B] : [B, A]) as [Plane, Cylinder];
  const along = dot(P.n, C.a);
  if (Math.abs(along) <= 1e-12) {
    const delta = dot(P.n, sub(C.c, P.o));
    if (Math.abs(delta) > C.r + tol) return;
    const foot = sub(C.c, mul(P.n, delta)), w = cross(C.a, P.n), h = Math.sqrt(Math.max(0, C.r * C.r - delta * delta));
    for (const sgn of h > tol ? [-1, 1] : [0]) lineCuts(add(foot, mul(w, sgn * h)), C.a);
    return;
  }
  if (Math.abs(Math.abs(along) - 1) <= 1e-12) {
    const h0 = (dot(P.n, P.o) - dot(P.n, C.c)) / along, centre = add(C.c, mul(C.a, h0));
    circleCuts(centre, C.a, C.e1, C.r, C.ref - Math.PI);
    return;
  }
  throw new Refused('a plane cuts a cylinder at an angle (an ellipse; not supported yet)');
}

// ---- classification --------------------------------------------------------------------------------
type Where = 'in' | 'out' | 'same' | 'opposite';
const RAYS: P3[] = [[0.5377, 0.3138, 0.7832], [-0.2961, 0.8573, 0.4213], [0.6993, -0.5126, 0.4982], [-0.4436, -0.3714, 0.8155], [0.1172, 0.9563, -0.2677], [0.8811, 0.2219, -0.4175]].map(v => unit(v as P3));
function classify(x: P3, normal: P3 | null, faces: readonly GFace[], tol: number): Where {
  if (normal) for (const g of faces) {
    if (![0, 1, 2].every(k => x[k] >= g.min[k] - 10 * tol && x[k] <= g.max[k] + 10 * tol)) continue;
    const s = g.surf, dist = s.kind === 'plane' ? Math.abs(dot(s.n, sub(x, s.o))) : (() => { const d = sub(x, s.c); return Math.abs(len(sub(d, mul(s.a, dot(d, s.a)))) - s.r); })();
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
      } else {
        const w = sub(x, s.c), wp = sub(w, mul(s.a, dot(w, s.a))), dp = sub(dir, mul(s.a, dot(dir, s.a)));
        const A = dot(dp, dp), B = 2 * dot(wp, dp), C = dot(wp, wp) - s.r * s.r;
        if (A < 1e-12) { if (Math.abs(C) <= 10 * tol * s.r) bad = true; continue; }
        const disc = B * B - 4 * A * C; if (disc < 0) continue;
        if (disc < 1e-12 * B * B + 1e-18) { bad = true; continue; }
        hits.push((-B - Math.sqrt(disc)) / (2 * A), (-B + Math.sqrt(disc)) / (2 * A));
      }
      for (const t of hits) {
        if (t < -10 * tol) continue;
        const where = locateInRegion(to2(g, add(x, mul(dir, t))), g.region, 10 * tol);
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

// ---- the Boolean -------------------------------------------------------------------------------------
interface Piece { face: GFace; region: CurveRegion2; out: 1 | -1; key: P3 }

export function booleanAnalytic(a: Brep, b: Brep, operation: AnalyticBooleanOperation, options: { readonly id?: string } = {}): Brep {
  const id = options.id ?? `analytic-${operation}`;
  let scale = 1; for (const br of [a, b]) for (const v of br.vertices) for (const x of v.point) scale = Math.max(scale, Math.abs(x));
  const tol = linearToleranceMM(scale) * 10, span = 4 * scale + 1;
  const A = facesOf(a, 0, tol), B = facesOf(b, 1, tol);
  // 1. Cuts.
  for (const fa of A) for (const fb of B) if (boxesMeet(fa, fb, tol)) cutPair(fa, fb, tol, span);
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
  const reverse = (ring: readonly CurveSegment2[]) => [...ring].reverse().map(g => g.kind === 'line' ? { ...g, a: g.b, b: g.a } : { ...g, t0: g.t0 + g.sweep, sweep: -g.sweep });
  const kept: Piece[] = pieces.flatMap(p => { const k = keep(p); if (!k) return [];
    return [{ face: p.face, out: k === 'flip' ? -1 : 1, key: p.key, region: k === 'flip' ? { outer: reverse(p.region.outer), holes: p.region.holes.map(reverse) } : p.region }]; });
  return stitch(kept, id, tol);
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
const startOf = (k: Curve3): P3 => k.kind === 'line' ? k.p : arcAt(k, 0);
const endOf = (k: Curve3): P3 => k.kind === 'line' ? k.q : arcAt(k, k.sweep);
const midOf = (k: Curve3): P3 => k.kind === 'line' ? mul(add(k.p, k.q), 0.5) : arcAt(k, k.sweep / 2);
/** Parameter in [0, 1] of a point on the curve, or null when it is not on it (within eps). */
function onCurve(k: Curve3, x: P3, eps: number): number | null {
  if (k.kind === 'line') { const d = sub(k.q, k.p), t = dot(sub(x, k.p), d) / dot(d, d); return t > 0 && t < 1 && len(sub(add(k.p, mul(d, t)), x)) <= eps ? t : null; }
  const d = sub(x, k.c), h = dot(d, k.n), inPlane = sub(d, mul(k.n, h));
  if (Math.abs(h) > eps || Math.abs(len(inPlane) - k.r) > eps) return null;
  let phi = Math.atan2(dot(inPlane, cross(k.n, k.u)), dot(inPlane, k.u)); if (phi < 0) phi += TWO_PI;
  const t = phi / k.sweep; return t > 0 && t < 1 && phi * k.r > eps && (k.sweep - phi) * k.r > eps ? t : null;
}
function part(k: Curve3, t0: number, t1: number, p: P3, q: P3): Curve3 {
  if (k.kind === 'line') return { kind: 'line', p, q };
  const e2 = cross(k.n, k.u), phi = k.sweep * t0;
  return { ...k, u: unit(add(mul(k.u, Math.cos(phi)), mul(e2, Math.sin(phi)))), sweep: k.sweep * (t1 - t0) };
}
/** A curve as a NURBS edge: lines degree 1; arcs rational quadratic in spans of at most a quarter turn. */
function nurbs(k: Curve3, id: string, p: P3, q: P3): Curve {
  if (k.kind === 'line') return lineCurve(id, p, q);
  const spans = Math.max(1, Math.ceil(k.sweep / (Math.PI / 2) - 1e-12)), dt = k.sweep / spans, w = Math.cos(dt / 2);
  const cp: P3[] = [p], wt = [1], knots = [0, 0, 0];
  for (let s = 0; s < spans; s++) {
    const mid = arcAt(k, dt * (s + 0.5)), ctr = add(k.c, mul(unit(sub(mid, k.c)), k.r / w));
    cp.push(ctr, s === spans - 1 ? q : arcAt(k, dt * (s + 1))); wt.push(w, 1);
    if (s < spans - 1) knots.push((s + 1) / spans, (s + 1) / spans);
  }
  knots.push(1, 1, 1);
  return { kind: 'curve', id, degree: 2, knots, controlPoints: cp, weights: wt };
}

function stitch(pieces: Piece[], id: string, tol: number): Brep {
  const set = new PointSet3(tol);
  const rings = pieces.map(p => [p.region.outer, ...p.region.holes].map(r => r.map(g => curve3Of(p.face, g))));
  for (const ps of rings) for (const ring of ps) for (const k of ring) { set.add(startOf(k)); set.add(endOf(k)); }
  const P = set.points;
  // Split at every vertex lying on a curve (T-junctions between neighbouring pieces).
  const edges: { id: string; k: Curve3; v: [number, number]; mid: P3 }[] = [], between = new Map<string, number[]>();
  const edgeOf = (k: Curve3, a: number, b: number) => {
    const mid = midOf(k), key = Math.min(a, b) + ':' + Math.max(a, b), list = between.get(key) ?? [];
    let e = list.find(i => len(sub(edges[i].mid, mid)) <= 10 * tol);
    if (e === undefined) { e = edges.length; edges.push({ id: `${id}_e${e}`, k, v: [a, b], mid }); list.push(e); between.set(key, list); }
    return { edge: edges[e].id, sense: (edges[e].v[0] === a ? 'forward' : 'reversed') as 'forward' | 'reversed', index: e };
  };
  const loops = rings.map(ps => ps.map(ring => ring.flatMap(k => {
    const a = set.find(startOf(k)), b = set.find(endOf(k)), stops = [{ t: 0, v: a }];
    P.forEach((x, v) => { if (v === a || v === b) return; const t = onCurve(k, x, tol); if (t !== null) stops.push({ t, v }); });
    stops.sort((x, y) => x.t - y.t); stops.push({ t: 1, v: b });
    const out: ReturnType<typeof edgeOf>[] = [];
    for (let i = 0; i + 1 < stops.length; i++) if (stops[i].v !== stops[i + 1].v) out.push(edgeOf(part(k, stops[i].t, stops[i + 1].t, P[stops[i].v], P[stops[i + 1].v]), stops[i].v, stops[i + 1].v));
    return out;
  })));
  // Every edge is used once in each direction.
  const uses = new Map<number, { piece: number; sense: string }[]>();
  loops.forEach((ls, pi) => ls.flat().forEach(u => uses.set(u.index, [...(uses.get(u.index) ?? []), { piece: pi, sense: u.sense }])));
  for (const [e, list] of uses) if (list.length !== 2 || list[0].sense === list[1].sense)
    throw new BrepError('TOPOLOGY', `analytic Boolean: the result is not a manifold solid (edge ${e} from ${P[edges[e].v[0]].map(x => +x.toFixed(4))} to ${P[edges[e].v[1]].map(x => +x.toFixed(4))} has ${list.length} uses; the inputs touch along an edge or at a vertex)`);
  // Shells by connectivity, signed volume by the divergence theorem (exact on these pieces).
  const root = pieces.map((_, i) => i), find = (x: number): number => { while (root[x] !== x) x = root[x] = root[root[x]]; return x; };
  for (const list of uses.values()) root[find(list[0].piece)] = find(list[1].piece);
  const volume = (pi: number) => {
    const p = pieces[pi], s = p.face.surf, region = p.region;
    if (s.kind === 'plane') return dot(s.n, s.o) * regionArea(region) / 3;
    // ∫ x·n dA over the piece by Green's theorem in (U, V): only generators (dU = 0) contribute.
    const cperpA = dot(s.c, s.e1), cperpB = dot(s.c, s.e2);
    const F = (U: number) => { const th = U / (s.s * s.r); return s.s * s.r * (cperpA * Math.sin(th) - cperpB * Math.cos(th)) + s.r * U; };
    let acc = 0;
    for (const ring of [region.outer, ...region.holes]) for (const g of ring) if (g.kind === 'line') acc += F(g.a[0]) * (g.b[1] - g.a[1]);
    return s.s * acc / 3;
  };
  const shells = new Map<number, number[]>(); pieces.forEach((_, i) => shells.set(find(i), [...(shells.get(find(i)) ?? []), i]));
  const groups = [...shells.values()].map(m => ({ members: m, volume: m.reduce((v, i) => v + volume(i), 0) }));
  const asFaces = (members: number[]): GFace[] => members.map(i => ({ ...pieces[i].face, region: pieces[i].region, out: pieces[i].out }));
  const bodies = groups.filter(g => g.volume > 0).map(g => ({ outer: g, cavities: [] as typeof groups }));
  for (const c of groups.filter(g => g.volume <= 0)) {
    const x = pieces[c.members[0]].key; let best = -1;
    bodies.forEach((bd, k) => { if (classify(x, null, asFaces(bd.outer.members), tol) === 'in' && (best < 0 || bd.outer.volume < bodies[best].outer.volume)) best = k; });
    if (best < 0) throw new BrepError('TOPOLOGY', 'analytic Boolean: a cavity lies in no outer shell');
    bodies[best].cavities.push(c);
  }
  // Names: the piece's face name (numbered by position when repeated); edges by their two faces.
  const faceNames: string[] = [], byName = new Map<string, number[]>();
  pieces.forEach((p, i) => { const n = p.face.name ?? `${id}.face`; byName.set(n, [...(byName.get(n) ?? []), i]); });
  for (const [n, list] of byName) {
    if (list.length === 1) { faceNames[list[0]] = n; continue; }
    [...list].sort((x, y) => { const a = pieces[x].key, b = pieces[y].key; return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]; }).forEach((i, k) => { faceNames[i] = `${n}#${k + 1}`; });
  }
  const edgeList = edges.map(e => ({ id: e.id, curve: nurbs(e.k, e.id, P[e.v[0]], P[e.v[1]]), vertices: [`${id}_v${e.v[0]}`, `${id}_v${e.v[1]}`] as [string, string],
    name: [...new Set((uses.get(edges.indexOf(e)) ?? []).map(u => faceNames[u.piece]))].sort().join('|') }));
  nameEdges(edgeList);
  const surface = (pi: number): { surface: Surface; sense: 'forward' | 'reversed' } => {
    const p = pieces[pi], s = p.face.surf, pts: XY[] = [];
    for (const ring of loops[pi]) for (const u of ring) for (const x of edgeList[edges.findIndex(e => e.id === u.edge)].curve.controlPoints) pts.push(to2(p.face, x));
    const u0 = Math.min(...pts.map(x => x[0])), u1 = Math.max(...pts.map(x => x[0])), v0 = Math.min(...pts.map(x => x[1])), v1 = Math.max(...pts.map(x => x[1]));
    if (s.kind === 'plane') {
      const at = (u: number, v: number) => to3(p.face, [u, v]), pad = tol;
      // ∂S/∂u × ∂S/∂v = e1 × e2 = n.
      return { surface: { kind: 'surface', id: `${id}_s${pi}`, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1],
        controlPoints: [[at(u0 - pad, v0 - pad), at(u0 - pad, v1 + pad)], [at(u1 + pad, v0 - pad), at(u1 + pad, v1 + pad)]], weights: [[1, 1], [1, 1]] }, sense: p.out > 0 ? 'forward' : 'reversed' };
    }
    // An arc of the cylinder from the smallest to the largest θ (CCW about a) extruded along a: ∂u × ∂v is radial.
    const th0 = Math.min(u0, u1) / (s.s * s.r), th1 = Math.max(u0, u1) / (s.s * s.r), lo = Math.min(th0, th1), hi = Math.max(th0, th1);
    const base: Curve3 = { kind: 'arc', c: add(s.c, mul(s.a, v0)), n: s.a, r: s.r, u: unit(add(mul(s.e1, Math.cos(lo)), mul(s.e2, Math.sin(lo)))), sweep: Math.max(hi - lo, 1e-9) };
    const curve = nurbs(base, `${id}_b${pi}`, arcAt(base, 0), arcAt(base, base.sweep));
    return { surface: { kind: 'surface', id: `${id}_s${pi}`, degreeU: curve.degree, degreeV: 1, knotsU: [...curve.knots], knotsV: [0, 0, 1, 1],
      controlPoints: curve.controlPoints.map(q => [q, add(q, mul(s.a, v1 - v0))]), weights: curve.weights.map(w => [w, w]) }, sense: s.s * p.out > 0 ? 'forward' : 'reversed' };
  };
  const result = buildBrep({ source: { family: 'analytic-boolean', id },
    vertices: P.map((x, i) => ({ id: `${id}_v${i}`, point: x })),
    edges: edgeList.filter((_, i) => uses.has(i)),
    bodies: bodies.map((bd, k) => ({ id: `${id}_body${k}`, kind: 'solid' as const, shells: [bd.outer, ...bd.cavities].map((g, si) => ({ id: 's' + si, closed: true,
      faces: g.members.map(pi => ({ id: 'f' + pi, name: faceNames[pi], ...surface(pi), loops: loops[pi].map((uses2, li) => ({ kind: li === 0 ? 'outer' as const : 'inner' as const, uses: uses2.map(u => ({ edge: u.edge, sense: u.sense })) })) })) })) })),
    toleranceMM: tol });
  // Solids that touch at a vertex give a non-manifold result; refuse it plainly (as for edges).
  const report = checkBrep(result);
  if (!report.valid) throw new BrepError('TOPOLOGY', `analytic Boolean: the result is not a manifold solid (the inputs touch along an edge or at a vertex): ${report.issues[0]}`, report);
  return result;
}
