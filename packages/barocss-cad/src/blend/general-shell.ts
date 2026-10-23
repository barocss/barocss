// Shell of a general B-rep of planes and cylinders: the body's wall is the union of a slab per face —
// the face's region, from the wall's depth inside to a little outside, grown across its sharp edges by
// the wall within its own surface — and the shell is the body within that union. Every point inside the
// body within the wall of its boundary lies in the slab of the face nearest it, so the wall is nowhere
// thinner. Opened faces get no slab. Slabs reach out by a factor of the wall unlike any of their own
// sizes, so their outer faces never lie on the body's.
//
// Edges (R11.1, D106) decide the growth: across a convex edge a slab grows by the wall (it lies outside
// the body there, or within the wall of the face beyond); across a smooth (tangent) edge it does not
// grow — the two slabs meet in the plane of their common normal, and grown they would reach under a
// concave neighbour deeper than the wall (D105). Across a sharp concave edge between two planes they
// grow by the wall and fill the corner, as offset faces meeting there do; where a curved face meets the
// edge, neither grows and the corner is filled by itself: the region beyond both faces' normals at the
// edge that is within the wall of both faces' offsets extended (their sharp join), solved in the plane
// across a straight edge (faces along it) or the meridian of a circular one (faces about its axis).
//
// Faces: planes bounded by lines and arcs (any region, holes included) and cylinders whose domain is a
// rectangle (bounded by lines along the axis and circles across it). Others are refused by name.
import { BrepError, isFacetFace, nurbsOf, type Brep, type BrepFace } from '../brep/brep-core.js';
import { booleanAnalytic, faceGeometry } from '../brep/analytic-boolean.js';
import { circleOf } from '../brep/brep-tessellate.js';
import { curveDomain, evaluateCurve, evaluateSurface } from '../core/math.js';
import { brepFromPrismatic, prismaticExtrude } from '../features/prismatic-solid.js';
import { growSection } from '../features/section-offset.js';
import { transformBrep } from '../brep/brep-transform.js';
import { revolveProfile } from '../features/revolve.js';
import { revolutionOf, type Revolution } from '../nurbs/surfaces/surface-revolution.js';
import { add, cross, dot, len, scale, sub, unit } from '../core/vec3.js';
import { booleanCurveRegions, segReverse, type CurveRegion2, type CurveSegment2, type XY } from '../brep/curved-arrangement.js';
import type { Curve, Point } from '../types.js';

const TAU = 2 * Math.PI;
const wrap = (a: number) => ((a % TAU) + TAU) % TAU;
const refuse = (detail: string): never => { throw new BrepError('GEOMETRY', `CAPABILITY: shell: ${detail}`); };
/** Below this angle (rad) between two faces' normals their edge is smooth (tangent). */
const SMOOTH = 1e-6;
/**
 * How far a concave face's slab reaches out (towards its centre), in walls: unlike the 1.37 of other
 * faces, so it never meets a plane's slab tangentially (a concave round's slab beside its plane's, D106).
 */
const CONCAVE_REACH = 1.29;

/** A face as the shell sees it: a plane, a cylinder or a surface of revolution (with its outward side in the meridian), or another. */
interface Shape {
  readonly face: BrepFace; readonly name: string;
  readonly plane?: { readonly n: Point; readonly o: Point };
  readonly cylinder?: { readonly c: Point; readonly a: Point; readonly r: number; readonly out: number };
  readonly rev?: { readonly R: Revolution; readonly nm: XY; readonly m0: XY };
}
/** How an edge's two faces meet: `a` is the face whose loop runs along `T` (the other runs against it). */
interface EdgeMeet { readonly kind: 'smooth' | 'convex' | 'concave'; readonly a: Shape; readonly b: Shape; readonly p: Point; readonly T: Point; readonly nA: Point; readonly nB: Point }

const meridianOf = (R: Revolution, p: Point): XY => { const d = sub(p, R.c), h = dot(d, R.a); return [len(sub(d, scale(R.a, h))), h]; };
function shapeOf(f: BrepFace, size: number): Shape {
  const name = f.name ?? f.id;
  if (isFacetFace(f)) return { face: f, name };
  let g: ReturnType<typeof faceGeometry>;
  try { g = faceGeometry(f, size); } catch { g = { kind: 'other' }; }
  if (g.kind === 'plane') return { face: f, name, plane: { n: g.n, o: g.o } };
  if (g.kind === 'cylinder') return { face: f, name, cylinder: { c: g.c, a: unit(g.a), r: g.r, out: g.out } };
  const R = revolutionOf(nurbsOf(f), size);
  if (!R) return { face: f, name };
  // The outward side in the meridian plane, from the face's normal at its middle.
  const S = nurbsOf(f), u0 = S.knotsU[0], u1 = S.knotsU[S.knotsU.length - 1], v0 = S.knotsV[0], v1 = S.knotsV[S.knotsV.length - 1], um = (u0 + u1) / 2, vm = (v0 + v1) / 2;
  const P0 = evaluateSurface(S, um, vm), Pu = evaluateSurface(S, um + 1e-6 * (u1 - u0), vm), Pv = evaluateSurface(S, um, vm + 1e-6 * (v1 - v0));
  const N = scale(cross(sub(Pu, P0), sub(Pv, P0)), f.sense === 'forward' ? 1 : -1), radial = unit(sub(sub(P0, R.c), scale(R.a, dot(sub(P0, R.c), R.a))));
  return { face: f, name, rev: { R, nm: [dot(N, radial), dot(N, R.a)], m0: meridianOf(R, P0) } };
}
/** The outward unit normal of a shape at a point on it, or null for a face of another kind. */
function normalAt(s: Shape, p: Point): Point | null {
  if (s.plane) return s.plane.n;
  if (s.cylinder) { const { c, a, out } = s.cylinder, d = sub(p, c); return scale(unit(sub(d, scale(a, dot(d, a)))), out > 0 ? 1 : -1); }
  if (s.rev) {
    const { R, nm, m0 } = s.rev, d = sub(p, R.c), radial = unit(sub(d, scale(R.a, dot(d, R.a))));
    let n2: XY;
    if (R.profile.kind === 'line') { const { p: P, q: Q } = R.profile, L = Math.hypot(Q[0] - P[0], Q[1] - P[1]); n2 = [-(Q[1] - P[1]) / L, (Q[0] - P[0]) / L]; if (n2[0] * nm[0] + n2[1] * nm[1] < 0) n2 = [-n2[0], -n2[1]]; }
    else { const C = R.profile.c, m = meridianOf(R, p), convex = (m0[0] - C[0]) * nm[0] + (m0[1] - C[1]) * nm[1] > 0, l = Math.hypot(m[0] - C[0], m[1] - C[1]) * (convex ? 1 : -1); n2 = [(m[0] - C[0]) / l, (m[1] - C[1]) / l]; }
    return add(scale(radial, n2[0]), scale(R.a, n2[1]));
  }
  return null;
}
const curved = (s: Shape) => !s.plane;

/** Each edge between two faces with slabs: smooth, convex or concave, from their normals at its middle and the first face's loop direction. */
function edgeMeets(body: Brep, shapes: ReadonlyMap<string, Shape>): Map<string, EdgeMeet> {
  const loops = new Map(body.loops.map(l => [l.id, l])), coedges = new Map(body.coedges.map(c => [c.id, c])), uses = new Map<string, { s: Shape; forward: boolean }[]>();
  for (const f of body.faces) {
    const s = shapes.get(f.id); if (!s) continue;
    for (const lid of f.loops) for (const cid of loops.get(lid)!.coedges) { const c = coedges.get(cid)!, list = uses.get(c.edge) ?? []; list.push({ s, forward: c.sense === 'forward' }); uses.set(c.edge, list); }
  }
  const meets = new Map<string, EdgeMeet>();
  for (const e of body.edges) {
    const u = uses.get(e.id);
    if (!u || u.length !== 2 || u[0].s === u[1].s) continue;
    const [t0, t1] = curveDomain(e.curve), tm = (t0 + t1) / 2, h = 1e-6 * (t1 - t0), p = evaluateCurve(e.curve, tm);
    const T0 = unit(sub(evaluateCurve(e.curve, tm + h), evaluateCurve(e.curve, tm - h))), T = u[0].forward ? T0 : scale(T0, -1);
    const nA = normalAt(u[0].s, p), nB = normalAt(u[1].s, p);
    if (!nA || !nB) continue;
    // (Loops run counter-clockwise about the outward normal: along a convex edge nA × nB runs with the first face's loop.)
    const kind = len(cross(nA, nB)) < SMOOTH && dot(nA, nB) > 0 ? 'smooth' : dot(cross(nA, nB), T) > 0 ? 'convex' : 'concave';
    meets.set(e.id, { kind, a: u[0].s, b: u[1].s, p, T, nA, nB });
  }
  return meets;
}
/** Whether a slab stops at this edge (not grown across it): smooth, or concave beside a curved face (its corner filled apart). */
/**
 * Whether a concave edge's corner is filled apart rather than by its planes' growth: beside a curved face; between two
 * planes whose normals are more than a right angle apart (a band of either, however wide, misses the far corner of
 * their offsets' meeting); every one under an arc join.
 */
const filled = (m: EdgeMeet, join: ShellJoin) => m.kind === 'concave' && (join === 'arc' || curved(m.a) || curved(m.b) || dot(m.nA, m.nB) < -1e-12);
/** Whether a slab stops at this edge (not grown across it): smooth, or a concave edge whose corner is filled apart. */
const stopsAt = (m: EdgeMeet | undefined, join: ShellJoin) => !!m && (m.kind === 'smooth' || filled(m, join));
/**
 * How far a plane's slab grows across an edge in its plane: the wall across a convex edge (it lies outside
 * the body there); across a sharp concave edge between two planes, as far as the two offsets reach before they
 * meet — t·tan(θ/2), θ the angle between the normals (the wall at a right angle); not at all where it stops.
 */
function growthAcross(m: EdgeMeet | undefined, t: number, join: ShellJoin): number {
  if (!m) return t;
  if (stopsAt(m, join)) return 0;
  if (m.kind === 'convex') return t;
  // (At most a right angle here: the band beyond the edge lies within both walls. At a right angle, the wall exactly.)
  const c = dot(m.nA, m.nB);
  return Math.abs(c) < 1e-12 ? t : t * Math.tan(Math.acos(Math.min(1, c)) / 2);
}

/**
 * How the hollow meets itself at a concave edge of the body: 'sharp', its faces' offsets extended until they meet (as
 * offset faces do; the default); 'arc', a round of the wall's radius about the edge (and a ball at a vertex) — every
 * point within the wall of the boundary, and no other. The owner's decision (D106/D107); one switch.
 */
export type ShellJoin = 'sharp' | 'arc';

/** The shell of `body` with walls `t` thick, the faces named in `open` removed. */
export function generalShell(body: Brep, t: number, open: ReadonlySet<string>, id: string, join: ShellJoin = 'sharp'): Brep {
  if (body.faces.some(isFacetFace)) throw new BrepError('GEOMETRY', 'shell of a mesh body: faceted (mesh) faces are not supported yet');
  // (Every failure is a typed refusal: the refusals by name below as they are, any other — a profile, a Boolean that
  // cannot close the result — with its reason, D108.)
  try { return shellBody(body, t, open, id, join); }
  catch (cause) {
    if (cause instanceof BrepError && /CAPABILITY: shell:/.test(cause.message)) throw cause;
    return refuse(`[SHELL_NOT_CLOSED] a wall of ${t} mm cannot be closed on this body: ${cause instanceof Error ? cause.message.replace(/^B-rep: /, '') : String(cause)}`);
  }
}

function shellBody(body: Brep, t: number, open: ReadonlySet<string>, id: string, join: ShellJoin): Brep {
  const size = Math.max(1, ...body.vertices.flatMap(v => v.point.map(Math.abs))), tol = 1e-9 * size, out = 1.37 * t;
  const loops = new Map(body.loops.map(l => [l.id, l])), coedges = new Map(body.coedges.map(c => [c.id, c])), edges = new Map(body.edges.map(e => [e.id, e]));
  const shapes = new Map<string, Shape>();
  for (const f of body.faces) if (!(f.name && open.has(f.name))) shapes.set(f.id, shapeOf(f, size));
  // A convex round face whose radius the wall all but reaches: its offset a circle of less than 0.01 mm, the kernel's
  // least arc — refused by name rather than made with a sliver core (D108).
  for (const sh of shapes.values()) {
    const r = sh.cylinder && sh.cylinder.out > 0 ? sh.cylinder.r : sh.rev && sh.rev.R.profile.kind === 'arc' && (sh.rev.m0[0] - sh.rev.R.profile.c[0]) * sh.rev.nm[0] + (sh.rev.m0[1] - sh.rev.R.profile.c[1]) * sh.rev.nm[1] > 0 ? sh.rev.R.profile.r : NaN;
    if (r - t > tol && r - t < 0.01) refuse(`[WALL_NEAR_RADIUS] a wall of ${t} mm on ${sh.name} (radius ${+r.toFixed(6)} mm) leaves a core ${+(r - t).toExponential(2)} mm across its offset: make the wall the radius or more (all wall) or at least 0.01 mm less`);
  }
  const meets = edgeMeets(body, shapes);
  /** A face's loops as point chains, each coedge as its curve in its direction (and its edge). */
  const usesOf = (f: BrepFace) => f.loops.map(lid => { const l = loops.get(lid)!; return { outer: l.kind === 'outer', uses: l.coedges.map(cid => { const c = coedges.get(cid)!; return { curve: edges.get(c.edge)!.curve, forward: c.sense === 'forward', edge: c.edge }; }) }; });
  const ends = (u: { curve: Curve; forward: boolean }) => { const [t0, t1] = curveDomain(u.curve), a = evaluateCurve(u.curve, t0), b = evaluateCurve(u.curve, t1), m = evaluateCurve(u.curve, (t0 + t1) / 2); return u.forward ? { s: a, m, e: b } : { s: b, m, e: a }; };
  const stops = (edge: string) => stopsAt(meets.get(edge), join);
  const slabs: Brep[] = [], revolutions: { R: Revolution; face: BrepFace; name: string }[] = [];
  // Faces on one plane (or one cylinder) — a face split by an earlier Boolean — share one slab.
  const planes: { n: Point; o: Point; e1: Point; e2: Point; regions: CurveRegion2[] }[] = [];
  /** A cylinder face's rectangle and which of its sides the slab stops at (angle start, end; height low, high). */
  type Rect = { th0: number; span: number; z0: number; z1: number; stop: [boolean, boolean, boolean, boolean] };
  const cylinders: { c: Point; a: Point; r: number; out: number; e1: Point; e2: Point; rects: Rect[]; name: string }[] = [];
  body.faces.forEach((f) => {
    if (f.name && open.has(f.name)) return;
    const name = f.name ?? f.id, sh = shapes.get(f.id)!;
    if (sh.plane) {
      // The face's region in the plane (e1, e2, n outward), grown by the wall; extruded from −t to out.
      const g = sh.plane;
      let P = planes.find(q => len(sub(q.n, g.n)) < 1e-9 && Math.abs(dot(sub(g.o, q.o), q.n)) < tol);
      if (!P) { const n = g.n, e1 = unit(Math.abs(n[0]) < 0.9 ? cross([1, 0, 0], n) : cross([0, 1, 0], n)); P = { n, o: scale(n, dot(g.o, n)), e1, e2: cross(n, e1), regions: [] }; planes.push(P); }
      const { e1, e2, o } = P;
      const to2 = (p: Point): XY => { const d = sub(p, o); return [dot(d, e1), dot(d, e2)]; };
      const ring = (uses: ReturnType<typeof usesOf>[number]['uses']): CurveSegment2[] => uses.map(u => {
        const c = u.curve, { s, m, e } = ends(u);
        if (c.degree === 1 && c.controlPoints.length === 2) return { kind: 'line', a: to2(s), b: to2(e), tag: u.edge };
        // An arc, exact or fitted (a Boolean's curve on a curved face): the circle through its ends and middle, if it lies on it.
        const circ = circleOf(c);
        let c2: XY, r: number;
        if (circ) { c2 = to2(circ.c); r = circ.r; }
        else {
          const [A, B, C] = [to2(s), to2(m), to2(e)], d = 2 * (A[0] * (B[1] - C[1]) + B[0] * (C[1] - A[1]) + C[0] * (A[1] - B[1]));
          if (Math.abs(d) < 1e-12 * size * size) return refuse(`face ${name} is bounded by a curve that is not a line or an arc`);
          const aa = A[0] ** 2 + A[1] ** 2, bb = B[0] ** 2 + B[1] ** 2, cc = C[0] ** 2 + C[1] ** 2;
          c2 = [(aa * (B[1] - C[1]) + bb * (C[1] - A[1]) + cc * (A[1] - B[1])) / d, (aa * (C[0] - B[0]) + bb * (A[0] - C[0]) + cc * (B[0] - A[0])) / d]; r = Math.hypot(A[0] - c2[0], A[1] - c2[1]);
          const [t0, t1] = curveDomain(c);
          for (let i = 1; i < 16; i++) { const q = to2(evaluateCurve(c, t0 + (t1 - t0) * i / 16)); if (Math.abs(Math.hypot(q[0] - c2[0], q[1] - c2[1]) - r) > 1e-6 * size) return refuse(`face ${name} is bounded by a curve that is not a line or an arc`); }
        }
        const ang = (p: Point) => { const q = to2(p); return Math.atan2(q[1] - c2[1], q[0] - c2[0]); };
        const a0 = ang(s), ccw = wrap(ang(e) - a0) || TAU, viaM = wrap(ang(m) - a0);
        return { kind: 'arc', c: c2, r, t0: a0, sweep: viaM < ccw ? ccw : ccw - TAU, tag: u.edge };
      });
      // Neighbouring arcs on one circle (a circle a Boolean fitted in pieces) share its centre and
      // radius exactly, so the ring closes.
      const unify = (rg: CurveSegment2[]): CurveSegment2[] => {
        const out = rg.map(g => ({ ...g }));
        for (let i = 0; i < out.length; i++) {
          const g = out[i]; if (g.kind !== 'arc') continue;
          const run = [i]; for (let j = i + 1; j < out.length; j++) { const h = out[j]; if (h.kind === 'arc' && Math.hypot(h.c[0] - g.c[0], h.c[1] - g.c[1]) < 1e-5 * size && Math.abs(h.r - g.r) < 1e-5 * size) run.push(j); else break; }
          if (run.length < 2) continue;
          const arcs = run.map(j => out[j] as Extract<CurveSegment2, { kind: 'arc' }>), c: XY = [arcs.reduce((x, a) => x + a.c[0], 0) / arcs.length, arcs.reduce((x, a) => x + a.c[1], 0) / arcs.length], r = arcs.reduce((x, a) => x + a.r, 0) / arcs.length;
          const ang = (p: XY) => Math.atan2(p[1] - c[1], p[0] - c[0]);
          const ends = arcs.map(a => [[a.c[0] + a.r * Math.cos(a.t0), a.c[1] + a.r * Math.sin(a.t0)] as XY, [a.c[0] + a.r * Math.cos(a.t0 + a.sweep), a.c[1] + a.r * Math.sin(a.t0 + a.sweep)] as XY]);
          run.forEach((j, k) => { const a = arcs[k], t0 = ang(ends[k][0]), t1 = k + 1 < run.length ? ang(ends[k + 1][0]) : ang(ends[k][1]), d = ((t1 - t0) % TAU + TAU) % TAU; out[j] = { ...a, c, r, t0, sweep: a.sweep >= 0 ? (d || TAU) : -(((t0 - t1) % TAU + TAU) % TAU || TAU) }; });
          i = run[run.length - 1];
        }
        return out;
      };
      const L = usesOf(f), rings = L.map(l => unify(ring(l.uses)));
      P.regions.push({ outer: rings[L.findIndex(l => l.outer)], holes: rings.filter((_, k) => !L[k].outer) });
      return;
    }
    if (sh.cylinder) {
      // A rectangle in (angle, height): every edge a line along the axis or a circle across it.
      const g = sh.cylinder, a0 = g.a;
      let C = cylinders.find(q => Math.abs(q.r - g.r) < tol && q.out === g.out && len(cross(q.a, a0)) < 1e-9 && len(cross(sub(g.c, q.c), q.a)) < 1e-7 * size);
      if (!C) { const e1 = unit(Math.abs(a0[0]) < 0.9 ? cross([1, 0, 0], a0) : cross([0, 1, 0], a0)); C = { c: g.c, a: a0, r: g.r, out: g.out, e1, e2: cross(a0, e1), rects: [], name }; cylinders.push(C); }
      const { a, e1, e2 } = C, cc = C.c;
      const angle = (p: Point) => { const d = sub(p, cc); return Math.atan2(dot(d, e2), dot(d, e1)); }, height = (p: Point) => dot(sub(p, cc), a);
      const pts: Point[] = [], sides: { along: boolean; at: Point; stop: boolean }[] = [];
      for (const l of usesOf(f)) for (const u of l.uses) {
        const c = u.curve, [t0, t1] = curveDomain(c), P = [0, 0.25, 0.5, 0.75, 1].map(x => evaluateCurve(c, t0 + (t1 - t0) * x));
        const straight = c.degree === 1 && c.controlPoints.length === 2, circ = straight ? null : circleOf(c);
        const along = straight && len(cross(unit(sub(P[4], P[0])), a)) < 1e-9, across = circ && Math.abs(Math.abs(dot(unit(cross(circ.e1, circ.e2)), a)) - 1) < 1e-9 && len(sub(sub(circ.c, cc), scale(a, dot(sub(circ.c, cc), a)))) < 1e-7 * size;
        if (!along && !across) refuse(`face ${name} (a cylinder) is trimmed by a curve other than its rulings and circles (not supported yet)`);
        pts.push(...P); sides.push({ along: !!along, at: P[2], stop: stops(u.edge) });
      }
      const hs = pts.map(height), angs = [...new Set(pts.map(p => wrap(angle(p))))].sort((x, y) => x - y);
      const gaps = angs.map((x, i) => ({ size: i ? x - angs[i - 1] : x + TAU - angs[angs.length - 1], start: x })).sort((x, y) => y.size - x.size);
      const R: Rect = { th0: gaps[0].start, span: TAU - gaps[0].size, z0: Math.min(...hs), z1: Math.max(...hs), stop: [false, false, false, false] };
      // Each side's edges: a ruling at the start or end angle, a circle at the low or high end.
      for (const s of sides) {
        const k = s.along ? (wrap(angle(s.at) - R.th0 + 1e-9) < 1e-6 ? 0 : 1) : (Math.abs(height(s.at) - R.z0) < Math.abs(height(s.at) - R.z1) ? 2 : 3);
        if (s.stop) R.stop[k] = true;
      }
      C.rects.push(R);
      return;
    }
    if (!sh.rev) return refuse(`face ${name} is not a plane, a cylinder or a surface of revolution (shell of bodies with freeform faces joined to others is not supported yet)`);
    revolutions.push({ R: sh.rev.R, face: f, name });
  });
  planes.forEach((P, k) => {
    // (Its sides keep their edges as tags through the union of the faces on the plane.)
    const regions = booleanCurveRegions(P.regions.flatMap(r => [r.outer, ...r.holes]), [], 'union', tol);
    const grown = grownRegion(regions, tag => growthAcross(tag === undefined ? undefined : meets.get(tag), t, join), tag => { const m = tag === undefined ? undefined : meets.get(tag); return !!m && m.kind === 'concave'; }, t, tol);
    const { n, e1, e2, o } = P;
    const prism = brepFromPrismatic(prismaticExtrude(ringsOf(grown), -t, out), { id: `${id}_p${k}` });
    slabs.push(transformBrep(prism, { matrix: [e1[0], e2[0], n[0], e1[1], e2[1], n[1], e1[2], e2[2], n[2]], offset: [o[0], o[1], o[2]] }));
  });
  cylinders.forEach((C, k) => {
    // Pieces of one turn with one height range join (two halves: the whole ring); others stay apart.
    const rs = [...C.rects], same = rs.every(r => Math.abs(r.z0 - rs[0].z0) < tol && Math.abs(r.z1 - rs[0].z1) < tol), total = rs.reduce((acc, r) => acc + r.span, 0);
    const parts: Rect[] = same && total >= TAU - 1e-6 ? [{ th0: 0, span: TAU, z0: rs[0].z0, z1: rs[0].z1, stop: [false, false, rs.some(r => r.stop[2]), rs.some(r => r.stop[3])] }] : rs;
    parts.forEach((R, j) => {
      // A convex cylinder no wider than the wall is wall throughout: its slab reaches the axis (no inner band left).
      const inner = C.out > 0 ? (C.r - t > tol ? C.r - t : 0) : Math.max(C.r - CONCAVE_REACH * t, C.r / 2), outer = C.out > 0 ? C.r + out : C.r + t;
      const dth = Math.min(t / Math.max(inner, C.r / 4), Math.PI / 2), g0 = R.stop[0] ? 0 : dth, g1 = R.stop[1] ? 0 : dth;
      const full = R.span >= TAU - 1e-6 || R.span + g0 + g1 >= TAU - 1e-9, span = full ? TAU : R.span + g0 + g1, start = full ? 0 : R.th0 - g0, sid = `${id}_c${k}_${j}`;
      const z0 = R.z0 - (R.stop[2] ? 0 : t), z1 = R.z1 + (R.stop[3] ? 0 : t);
      // A rectangle (ρ, h) turned about the local Y axis, then placed: Y → the axis, X → the start angle.
      const profile = (inner > 0 ? [[inner, z0], [outer, z0], [outer, z1], [inner, z1]] : [[0, z0], [outer, z0], [outer, z1], [0, z1]]).map(p => ({ kind: 'line' as const, start: p as XY }));
      slabs.push(placeTurned(revolveProfile({ id: sid, profile, axis: { origin: [0, 0], direction: [0, 1] }, angleDegrees: span * 180 / Math.PI }), sid, span, start, C.c, C.a, C.e1, C.e2));
    });
  });
  revolutions.forEach((x, k) => slabs.push(...revolutionSlab(x.R, x.face, x.name, usesOf(x.face).flatMap(l => l.uses).map(u => ({ curve: u.curve, stop: stops(u.edge) })), t, out, size, `${id}_v${k}`)));
  // The corners at concave edges, and at vertices where two or more of them meet.
  const corners: Corner[] = [];
  for (const [eid, m] of meets) if (filled(m, join)) { const c = concaveCorner(m, edges.get(eid)!.curve, t, size, join); if (c) corners.push(c); }
  slabs.push(...cornerSolids(corners, size, id));
  // (Under the sharp join two planes' growth meets at a vertex, mitred. An arc join's vertex would take a ball, which
  // meets its edges' rounds tangentially along their end circles: refused for now.)
  if (join === 'arc') {
    const concaveAt = new Map<string, number>();
    for (const e of body.edges) if (meets.get(e.id)?.kind === 'concave') for (const v of e.vertices) concaveAt.set(v, (concaveAt.get(v) ?? 0) + 1);
    if ([...concaveAt.values()].some(n => n >= 2)) refuse('an arc join at a vertex where concave edges meet is not supported yet');
  }
  if (!slabs.length) refuse('every face is opened');
  return booleanAnalytic(body, joined(slabs, `${id}_wall`), 'intersection', { id, exactEdges: true });
}

/**
 * The slabs' union: in their order; where the analytic Boolean cannot close a step, the same union by halves, then in
 * the reverse order — one solid however it is grouped, only the pieces' meeting in between differs (a box's notched
 * corner at t 3, D108: one wall's slab added last to the end's, the top's and the floor's) — refused typed if none does.
 */
export function joined(slabs: readonly Brep[], id: string): Brep {
  const union = (a: Brep, b: Brep) => booleanAnalytic(a, b, 'union', { id, exactEdges: true });
  const inOrder = (xs: readonly Brep[]) => xs.slice(1).reduce(union, xs[0]);
  const byHalves = (xs: readonly Brep[]): Brep => xs.length === 1 ? xs[0] : union(byHalves(xs.slice(0, xs.length >> 1)), byHalves(xs.slice(xs.length >> 1)));
  let first: unknown;
  for (const way of [inOrder, byHalves, (xs: readonly Brep[]) => inOrder([...xs].reverse())]) {
    try { return way(slabs); }
    catch (cause) { if (!(cause instanceof BrepError)) throw cause; first ??= cause; }
  }
  return refuse(`[SHELL_WALL_UNION] the wall's ${slabs.length} slabs do not join in any order tried: ${(first as Error).message.replace(/^B-rep: /, '')}`);
}

const ringsOf = (rs: readonly CurveRegion2[]) => rs.flatMap(r => [r.outer, ...r.holes]);
const endOf = (g: CurveSegment2, k: 0 | 1): XY => g.kind === 'line' ? (k ? g.b : g.a) : g.kind === 'arc' ? [g.c[0] + g.r * Math.cos(g.t0 + k * g.sweep), g.c[1] + g.r * Math.sin(g.t0 + k * g.sweep)] : g.f(k ? g.t1 : g.t0);
function signedArea(ring: readonly CurveSegment2[]): number {
  return ring.reduce((acc, g) => { const A = endOf(g, 0), B = endOf(g, 1); return acc + (A[0] * B[1] - B[0] * A[1]) / 2 + (g.kind === 'arc' ? g.r * g.r * (g.sweep - Math.sin(g.sweep)) / 2 : 0); }, 0);
}
const ccw = (ring: CurveSegment2[]): CurveSegment2[] => signedArea(ring) < 0 ? [...ring].reverse().map(segReverse) : ring;
const polygon = (pts: readonly XY[]): CurveSegment2[] => ccw(pts.map((p, i) => ({ kind: 'line', a: p, b: pts[(i + 1) % pts.length] })));
const disc = (c: XY, r: number): CurveSegment2[] => [{ kind: 'arc', c, r, t0: 0, sweep: TAU }];
/** The half-plane {(x − p)·m ≤ 0}, as a square of side 8h on that side of p. */
function halfPlane(p: XY, m: XY, h: number): CurveSegment2[] {
  const q: XY = [-m[1], m[0]], at = (u: number, w: number): XY => [p[0] + q[0] * u - m[0] * w, p[1] + q[1] * u - m[1] * w];
  return polygon([at(-4 * h, 0), at(4 * h, 0), at(4 * h, 8 * h), at(-4 * h, 8 * h)]);
}

/**
 * The strip a region's side does not grow into: beyond the segment (on its right, the region being on
 * its left), out to `G`, within its normals — a quadrilateral beyond a line, an annular sector beyond an
 * arc (a whole circle: an annulus, two rings).
 */
function stripBeyond(g: CurveSegment2, G: number): CurveSegment2[][] {
  if (g.kind === 'line') {
    const d = [g.b[0] - g.a[0], g.b[1] - g.a[1]], l = Math.hypot(d[0], d[1]), o: XY = [d[1] / l * G, -d[0] / l * G];
    return [polygon([g.a, g.b, [g.b[0] + o[0], g.b[1] + o[1]], [g.a[0] + o[0], g.a[1] + o[1]]])];
  }
  if (g.kind !== 'arc') return refuse('a region bounded by a free curve');
  // Left of a counter-clockwise arc is its centre: beyond it is out from the centre; of a clockwise one, in.
  const r0 = g.sweep > 0 ? g.r : Math.max(g.r - G, 0), r1 = g.sweep > 0 ? g.r + G : g.r, a0 = g.sweep > 0 ? g.t0 : g.t0 + g.sweep, sw = Math.abs(g.sweep);
  if (sw >= TAU - 1e-12) return r0 > 0 ? [disc(g.c, r1), [...disc(g.c, r0)].map(segReverse)] : [disc(g.c, r1)];
  const at = (r: number, a: number): XY => [g.c[0] + r * Math.cos(a), g.c[1] + r * Math.sin(a)];
  return [r0 > 0
    ? ccw([{ kind: 'arc', c: g.c, r: r1, t0: a0, sweep: sw }, { kind: 'line', a: at(r1, a0 + sw), b: at(r0, a0 + sw) }, { kind: 'arc', c: g.c, r: r0, t0: a0 + sw, sweep: -sw }, { kind: 'line', a: at(r0, a0), b: at(r1, a0) }])
    : ccw([{ kind: 'arc', c: g.c, r: r1, t0: a0, sweep: sw }, { kind: 'line', a: at(r1, a0 + sw), b: g.c }, { kind: 'line', a: g.c, b: at(r1, a0) }])];
}

/**
 * A plane face's region (its sides tagged by their edges) grown in its plane by `g(tag)` across each side: a band
 * beyond each side that grows; at a corner where two growing sides turn away from each other, a mitre where a concave
 * edge is one of two lines (the offsets meeting there), else a round; the strip beyond each side that does not grow
 * taken off, and the region itself kept whole. Grown by t everywhere it is the region grown by the wall (D106).
 */
function grownRegion(regions: readonly CurveRegion2[], g: (tag: string | undefined) => number, mitre: (tag: string | undefined) => boolean, t: number, tol: number): CurveRegion2[] {
  // Every side grown by the wall or not at all, and no corner of two growing sides at a concave edge: the region grown
  // by the wall (rounds at every corner), less the strips beyond the sides it stops at — as before D107, to the bit.
  const rings = ringsOf(regions), simple = rings.every(ring => ring.every((s, i) => {
    const gs = g(s.tag), n = ring[(i + 1) % ring.length], gn = g(n.tag);
    return (gs === 0 || gs === t) && !(gs > 0 && gn > 0 && s.kind === 'line' && n.kind === 'line' && (mitre(s.tag) || mitre(n.tag)) && turnsLeft(s, n));
  }));
  if (simple) {
    const cut = rings.flatMap(ring => ring.filter(s => g(s.tag) === 0).flatMap(s => stripBeyond(s, 1.5 * t))), grown = growSection(regions, t, tol);
    return cut.length ? booleanCurveRegions(ringsOf(booleanCurveRegions(ringsOf(grown), cut, 'difference', tol)), rings, 'union', tol) : grown;
  }
  const add: CurveSegment2[][] = [], cut: CurveSegment2[][] = [];
  for (const ring of ringsOf(regions)) ring.forEach((s, i) => {
    const gs = g(s.tag);
    if (gs > 0) add.push(...stripBeyond(s, gs)); else cut.push(...stripBeyond(s, 1.5 * Math.max(t, gs)));
    const n = ring[(i + 1) % ring.length], gn = g(n.tag);
    if (!(gs > 0 || gn > 0)) return;
    const d1 = tangentAt(s, 1), d2 = tangentAt(n, 0), v = endOf(s, 1);
    if (d1[0] * d2[1] - d1[1] * d2[0] <= 1e-12) return;
    // Turning left (the region on the left): the bands leave a gap beyond the corner — a round (where one side stops,
    // the strip beyond it then takes off what lies within its normals), or a mitre.
    const o1: XY = [d1[1], -d1[0]], o2: XY = [d2[1], -d2[0]], P1: XY = [v[0] + gs * o1[0], v[1] + gs * o1[1]], P2: XY = [v[0] + gn * o2[0], v[1] + gn * o2[1]];
    if (gs > 0 && gn > 0 && s.kind === 'line' && n.kind === 'line' && (mitre(s.tag) || mitre(n.tag))) {
      const det = d1[0] * d2[1] - d1[1] * d2[0], w = [P2[0] - P1[0], P2[1] - P1[1]], k = (w[0] * d2[1] - w[1] * d2[0]) / det, M: XY = [P1[0] + d1[0] * k, P1[1] + d1[1] * k];
      add.push(Math.hypot(M[0] - v[0], M[1] - v[1]) <= 10 * Math.max(gs, gn) ? polygon([v, P1, M, P2]) : polygon([v, P1, P2]));
    } else add.push(disc(v, Math.max(gs, gn)));
  });
  const whole = booleanCurveRegions([...ringsOf(regions), ...add], [], 'union', tol);
  return cut.length ? booleanCurveRegions(ringsOf(booleanCurveRegions(ringsOf(whole), cut, 'difference', tol)), ringsOf(regions), 'union', tol) : whole;
}
/** Whether the boundary turns left (the region's convex corner) from s into the next n. */
function turnsLeft(s: CurveSegment2, n: CurveSegment2): boolean { const d1 = tangentAt(s, 1), d2 = tangentAt(n, 0); return d1[0] * d2[1] - d1[1] * d2[0] > 1e-12; }
/** A segment's unit direction at its start (0) or end (1). */
function tangentAt(s: CurveSegment2, k: 0 | 1): XY {
  if (s.kind === 'line') return unit2([s.b[0] - s.a[0], s.b[1] - s.a[1]]);
  if (s.kind === 'arc') { const a = s.t0 + k * s.sweep, sg = s.sweep > 0 ? 1 : -1; return [-Math.sin(a) * sg, Math.cos(a) * sg]; }
  return refuse('a region bounded by a free curve');
}

/** A face's section in the plane across an edge (or its meridian): a line through the edge's point, or a circle. */
type Section = { readonly kind: 'line'; readonly n: XY; readonly u: XY } | { readonly kind: 'circle'; readonly c: XY; readonly r: number; readonly convex: boolean; readonly n: XY; readonly u: XY };
const unit2 = (v: XY): XY => { const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l]; };

/** A concave edge's corner region, in its group's frame: across a straight run along `d`, or in the meridian about the axis (c0, a). */
type Corner =
  | { readonly kind: 'line'; readonly key: string; readonly d: Point; readonly e1: Point; readonly e2: Point; readonly s0: number; readonly s1: number; readonly regions: CurveRegion2[] }
  | { readonly kind: 'circle'; readonly key: string; readonly circle: string; readonly a: Point; readonly c0: Point; readonly e1: Point; readonly e2: Point; readonly start: number; readonly span: number; readonly regions: CurveRegion2[] };
/** A direction with its first clear component positive, and a frame square to it (the same for every parallel one). */
function canonical(d: Point): { d: Point; e1: Point; e2: Point } {
  const k = Math.abs(d[0]) > 1e-9 ? 0 : Math.abs(d[1]) > 1e-9 ? 1 : 2, v = d[k] < 0 ? scale(d, -1) : d;
  const e1 = unit(Math.abs(v[0]) < 0.9 ? cross([1, 0, 0], v) : cross([0, 1, 0], v));
  return { d: v, e1, e2: cross(v, e1) };
}
const keyOf = (xs: readonly number[], q: number) => xs.map(x => Math.round(x / q)).join(',');

/**
 * The corner of a concave edge beside a curved face: in the plane across the edge (a straight edge,
 * both faces along it) or its meridian (a circle, both faces about its axis), the region near the
 * edge's point E beyond both faces' normals there and within the wall of both their offsets — the
 * sharp join of the offsets — to be extruded along the edge or turned about the axis.
 */
function concaveCorner(m: EdgeMeet, curve: Curve, t: number, size: number, join: ShellJoin): Corner | null {
  const [c0, c1] = curveDomain(curve), P0 = evaluateCurve(curve, c0), P1 = evaluateCurve(curve, c1), Pm = evaluateCurve(curve, (c0 + c1) / 2);
  const uA3 = cross(m.nA, m.T), uB3 = cross(m.nB, scale(m.T, -1)), names = `${m.a.name} and ${m.b.name}`, q = 1e-7 * size;
  const straight = len(cross(sub(Pm, P0), sub(P1, P0))) < 1e-9 * size * size && len(sub(P1, P0)) > 1e-9 * size;
  if (straight) {
    const { d, e1, e2 } = canonical(unit(sub(P1, P0)));
    for (const s of [m.a, m.b]) if (!(s.plane ? Math.abs(dot(s.plane.n, d)) < 1e-9 : s.cylinder ? len(cross(s.cylinder.a, d)) < 1e-9 : false)) refuse(`the concave edge between ${names} is straight, but not along both faces (not supported yet)`);
    const to2 = (p: Point): XY => [dot(p, e1), dot(p, e2)], v2 = (v: Point): XY => [dot(v, e1), dot(v, e2)];
    const sec = (s: Shape, n: Point, u: Point): Section => s.cylinder ? { kind: 'circle', c: to2(s.cylinder.c), r: s.cylinder.r, convex: s.cylinder.out > 0, n: unit2(v2(n)), u: unit2(v2(u)) } : { kind: 'line', n: unit2(v2(n)), u: unit2(v2(u)) };
    const regions = cornerRegion(to2(m.p), sec(m.a, m.nA, uA3), sec(m.b, m.nB, uB3), t, false, names, join);
    if (!regions.length) return null;
    const s0 = Math.min(dot(P0, d), dot(P1, d)), s1 = Math.max(dot(P0, d), dot(P1, d));
    return { kind: 'line', key: `${keyOf(d, 1e-9)}|${keyOf([s0, s1], q)}`, d, e1, e2, s0, s1, regions };
  }
  const circ = circleOf(curve);
  if (!circ) return refuse(`the concave edge between ${names} is neither straight nor a circle (not supported yet)`);
  const { d: a, e1, e2 } = canonical(unit(cross(circ.e1, circ.e2))), cc = circ.c, ca = sub(cc, scale(a, dot(cc, a))), offAxis = (c: Point) => len(sub(sub(c, cc), scale(a, dot(sub(c, cc), a))));
  for (const s of [m.a, m.b]) if (!(s.plane ? len(cross(s.plane.n, a)) < 1e-9 : s.cylinder ? len(cross(s.cylinder.a, a)) < 1e-9 && offAxis(s.cylinder.c) < 1e-7 * size : s.rev ? len(cross(s.rev.R.a, a)) < 1e-9 && offAxis(s.rev.R.c) < 1e-7 * size : false)) refuse(`the concave edge between ${names} is a circle, but not about both faces' axis (not supported yet)`);
  // The meridian (ρ, h) through the edge's point, h from the axis' point nearest the origin.
  const rho = unit(sub(sub(m.p, ca), scale(a, dot(sub(m.p, ca), a)))), to2 = (p: Point): XY => [dot(sub(p, ca), rho), dot(sub(p, ca), a)], v2 = (v: Point): XY => [dot(v, rho), dot(v, a)];
  const E = to2(m.p);
  const sec = (s: Shape, n: Point, u: Point): Section => {
    const n2 = unit2(v2(n)), u2 = unit2(v2(u)), pr = s.rev?.R.profile;
    if (s.rev && pr && pr.kind === 'arc') {
      const R = s.rev.R, sg = dot(R.a, a) > 0 ? 1 : -1, dh = dot(sub(R.c, ca), a), C: XY = [pr.c[0], sg * pr.c[1] + dh];
      return { kind: 'circle', c: C, r: pr.r, convex: (E[0] - C[0]) * n2[0] + (E[1] - C[1]) * n2[1] > 0, n: n2, u: u2 };
    }
    return { kind: 'line', n: n2, u: u2 };
  };
  const regions = cornerRegion(E, sec(m.a, m.nA, uA3), sec(m.b, m.nB, uB3), t, true, names, join);
  if (!regions.length) return null;
  // The turn: the edge's whole circle, or its arc from its start through its middle to its end (angles from e1 towards e2).
  const ang = (p: Point) => wrap(Math.atan2(dot(sub(p, ca), e2), dot(sub(p, ca), e1))), a0 = ang(P0), closed = len(sub(P0, P1)) < 1e-9 * size;
  const toEnd = wrap(ang(P1) - a0) || TAU, ccwWay = wrap(ang(Pm) - a0) < toEnd, span = closed ? TAU : ccwWay ? toEnd : TAU - toEnd, start = closed ? 0 : ccwWay ? a0 : ang(P1);
  return { kind: 'circle', key: `${keyOf(a, 1e-9)}|${keyOf(ca, q)}`, circle: keyOf(E, q), a, c0: ca, e1, e2, start, span, regions };
}

/**
 * The corners as solids: those of one straight run (the same direction and extent) joined in their
 * plane and extruded once; those about one axis whose circles are whole (an edge, or its pieces) joined
 * in the meridian and turned once — so no two corners overlap along a face of theirs; the rest one by one.
 */
function cornerSolids(corners: readonly Corner[], size: number, id: string): Brep[] {
  const tol = 1e-9 * size, out: Brep[] = [], groups = new Map<string, Corner[]>();
  // A circle whose pieces add up to a whole turn is whole.
  const turn = new Map<string, number>();
  for (const c of corners) if (c.kind === 'circle') turn.set(`${c.key}#${c.circle}`, (turn.get(`${c.key}#${c.circle}`) ?? 0) + c.span);
  for (const c of corners) {
    const whole = c.kind === 'line' || (turn.get(`${c.key}#${c.circle}`) ?? 0) >= TAU - 1e-9;
    const k = whole ? `${c.kind}:${c.key}` : `${c.kind}:${c.key}:${c.start}:${c.span}`;
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  let n = 0;
  for (const [k, cs] of groups) {
    const regions = booleanCurveRegions(cs.flatMap(c => ringsOf(c.regions)), [], 'union', tol), c = cs[0], sid = `${id}_k${n++}`;
    if (c.kind === 'line') {
      const prism = brepFromPrismatic(prismaticExtrude(ringsOf(regions), c.s0, c.s1), { id: sid }), { d, e1, e2 } = c;
      out.push(transformBrep(prism, { matrix: [e1[0], e2[0], d[0], e1[1], e2[1], d[1], e1[2], e2[2], d[2]], offset: [0, 0, 0] }));
      continue;
    }
    const whole = !k.endsWith(`:${c.start}:${c.span}`), span = whole ? TAU : c.span, start = whole ? 0 : c.start;
    regions.forEach((reg, j) => {
      if (reg.holes.length) refuse('the corner of a concave edge has a hole in its section');
      const profile = reg.outer.map(g => g.kind === 'line' ? { kind: 'line' as const, start: [g.a[0], g.a[1]] as XY } : g.kind === 'arc' ? { kind: 'arc' as const, start: endOf(g, 0), center: g.c as XY, direction: (g.sweep > 0 ? 'ccw' : 'cw') as 'ccw' | 'cw' } : refuse('a corner profile with a free curve'));
      const pid = `${sid}_${j}`, turned = revolveProfile({ id: pid, profile, axis: { origin: [0, 0], direction: [0, 1] }, angleDegrees: whole ? 360 : span * 180 / Math.PI });
      out.push(placeTurned(turned, pid, span, start, c.c0, c.a, c.e1, c.e2));
    });
  }
  return out;
}

/**
 * In 2D, the corner region at E between two faces' sections: near E (a square), beyond both faces'
 * normals at E, and within the wall of both their offsets (outside a convex circle's offset, inside a
 * concave one's, on the near side of a line's). `meridian`: the half-plane ρ ≥ 0 only.
 */
function cornerRegion(E: XY, A: Section, B: Section, t: number, meridian: boolean, names: string, join: ShellJoin): CurveRegion2[] {
  if (join === 'arc') {
    // The round: the disc of the wall about E, beyond both normals.
    const tol = 1e-9 * Math.max(1, Math.abs(E[0]), Math.abs(E[1]), t);
    let K = booleanCurveRegions([disc(E, t)], [], 'union', tol);
    for (const s of [A, B]) {
      if (!K.length) break;
      const m: XY = s.kind === 'line' ? s.u : (() => { const w = unit2([-(E[1] - s.c[1]), E[0] - s.c[0]]), sg = w[0] * s.u[0] + w[1] * s.u[1] > 0 ? 1 : -1; return [w[0] * sg, w[1] * sg] as XY; })();
      K = booleanCurveRegions(ringsOf(K), [halfPlane(E, m, t)], 'intersection', tol);
    }
    if (meridian && K.length) K = booleanCurveRegions(ringsOf(K), [halfPlane([0, E[1]], [-1, 0], Math.max(t, Math.abs(E[0]) + t))], 'intersection', tol);
    return K;
  }
  // The offsets' meeting point nearest E beyond both normals sizes the square.
  const offsetOf = (s: Section) => s.kind === 'line' ? { kind: 'line' as const, p: [E[0] - t * s.n[0], E[1] - t * s.n[1]] as XY, d: [-s.n[1], s.n[0]] as XY } : { kind: 'circle' as const, c: s.c, r: s.convex ? s.r - t : s.r + t };
  const beyond = (s: Section, x: XY) => s.kind === 'line' ? (x[0] - E[0]) * s.u[0] + (x[1] - E[1]) * s.u[1] <= 1e-9 * t : sideOfRay(s, E, x) <= 1e-9 * t;
  const eps = 1e-9 * Math.max(1, Math.abs(E[0]), Math.abs(E[1]), t), oA = offsetOf(A), oB = offsetOf(B), vanished = (s: Section) => s.kind === 'circle' && s.convex && s.r - t <= eps;
  const meetings = meet(oA, oB).filter(x => beyond(A, x) && beyond(B, x)).sort((x, y) => Math.hypot(x[0] - E[0], x[1] - E[1]) - Math.hypot(y[0] - E[0], y[1] - E[1]));
  let h = 1.25 * t;
  if (meetings.length) h = Math.max(h, 1.25 * Math.hypot(meetings[0][0] - E[0], meetings[0][1] - E[1]));
  // A convex circle's offset gone, or not reaching the other's: the corner runs to its centre.
  const toCentre = (s: Section) => s.kind === 'circle' && s.convex && (vanished(s) || !meetings.length);
  for (const s of [A, B]) if (s.kind === 'circle' && toCentre(s)) h = Math.max(h, 1.05 * Math.hypot(E[0] - s.c[0], E[1] - s.c[1]));
  if (!meetings.length && !toCentre(A) && !toCentre(B)) refuse(`the walls of ${names} do not meet at their concave edge`);
  const tol = 1e-9 * Math.max(1, Math.abs(E[0]), Math.abs(E[1]), h);
  let K = booleanCurveRegions([polygon([[E[0] - h, E[1] - h], [E[0] + h, E[1] - h], [E[0] + h, E[1] + h], [E[0] - h, E[1] + h]])], [], 'union', tol);
  const cut = (ring: CurveSegment2[], op: 'intersection' | 'difference') => { K = K.length ? booleanCurveRegions(ringsOf(K), [ring], op, tol) : K; };
  for (const s of [A, B]) {
    // Beyond its normal at E.
    if (s.kind === 'line') cut(halfPlane(E, s.u, h), 'intersection');
    else { const w = unit2([-(E[1] - s.c[1]), E[0] - s.c[0]]), sg = w[0] * s.u[0] + w[1] * s.u[1] > 0 ? 1 : -1; cut(halfPlane(E, [w[0] * sg, w[1] * sg], h), 'intersection'); }
    // Within its wall.
    if (s.kind === 'line') cut(halfPlane([E[0] - t * s.n[0], E[1] - t * s.n[1]], [-s.n[0], -s.n[1]], h), 'intersection');
    else if (s.convex) { if (s.r - t > eps) cut(disc(s.c, s.r - t), 'difference'); }
    else cut(disc(s.c, s.r + t), 'intersection');
  }
  if (meridian) cut(halfPlane([0, E[1]], [-1, 0], Math.max(h, Math.abs(E[0]) + h)), 'intersection');
  return K;
}
/** Which side of the ray from a circle section's centre through E a point is, signed so the face's side is positive. */
function sideOfRay(s: Extract<Section, { kind: 'circle' }>, E: XY, x: XY): number {
  const w = unit2([-(E[1] - s.c[1]), E[0] - s.c[0]]), sg = w[0] * s.u[0] + w[1] * s.u[1] > 0 ? 1 : -1;
  return sg * ((x[0] - E[0]) * w[0] + (x[1] - E[1]) * w[1]);
}
type Offset2 = { kind: 'line'; p: XY; d: XY } | { kind: 'circle'; c: XY; r: number };
/** Where two offsets (lines and circles) meet. */
function meet(a: Offset2, b: Offset2): XY[] {
  if (a.kind === 'circle' && !(a.r > 0)) return [];
  if (b.kind === 'circle' && !(b.r > 0)) return [];
  if (a.kind === 'line' && b.kind === 'line') {
    const det = a.d[0] * b.d[1] - a.d[1] * b.d[0]; if (Math.abs(det) < 1e-12) return [];
    const w = [b.p[0] - a.p[0], b.p[1] - a.p[1]], s = (w[0] * b.d[1] - w[1] * b.d[0]) / det;
    return [[a.p[0] + a.d[0] * s, a.p[1] + a.d[1] * s]];
  }
  if (a.kind === 'circle' && b.kind === 'line') return meet(b, a);
  if (a.kind === 'line' && b.kind === 'circle') {
    const f = [a.p[0] - b.c[0], a.p[1] - b.c[1]], B = f[0] * a.d[0] + f[1] * a.d[1], C = f[0] * f[0] + f[1] * f[1] - b.r * b.r, disc = B * B - C;
    if (disc < 0) return [];
    const q = Math.sqrt(disc);
    return [-B - q, -B + q].map(s => [a.p[0] + a.d[0] * s, a.p[1] + a.d[1] * s] as XY);
  }
  const A = a as Extract<Offset2, { kind: 'circle' }>, Bc = b as Extract<Offset2, { kind: 'circle' }>, dx = Bc.c[0] - A.c[0], dy = Bc.c[1] - A.c[1], D = Math.hypot(dx, dy);
  if (D < 1e-12 || D > A.r + Bc.r || D < Math.abs(A.r - Bc.r)) return [];
  const x = (A.r * A.r - Bc.r * Bc.r + D * D) / (2 * D), y = Math.sqrt(Math.max(0, A.r * A.r - x * x)), ux = dx / D, uy = dy / D;
  return [[A.c[0] + ux * x - uy * y, A.c[1] + uy * x + ux * y], [A.c[0] + ux * x + uy * y, A.c[1] + uy * x - ux * y]];
}


/** A body turned `span` about local Y placed about the axis (c, a): Y → a, X → the direction `start` from e1 towards e2. */
function placeTurned(turned: Brep, sid: string, span: number, start: number, c: Point, a: Point, e1: Point, e2: Point): Brep {
  // Which way the revolve turns (towards +Z or −Z of its sketch): from its end face.
  const endFace = turned.faces.find(x => x.name === `${sid}.end`), q = endFace ? scale(add(nurbsOf(endFace).controlPoints[0][0] as Point, nurbsOf(endFace).controlPoints[1][1] as Point), 0.5) : null;
  const towards = q && Math.abs(wrap(Math.atan2(q[2], q[0])) - wrap(span)) > Math.abs(wrap(Math.atan2(q[2], q[0])) - wrap(-span)) ? -1 : 1;
  const X = add(scale(e1, Math.cos(start)), scale(e2, Math.sin(start))), Zw = scale(add(scale(e1, -Math.sin(start)), scale(e2, Math.cos(start))), towards);
  return transformBrep(turned, { matrix: [X[0], a[0], Zw[0], X[1], a[1], Zw[1], X[2], a[2], Zw[2]], offset: [c[0], c[1], c[2]] });
}

/**
 * The slab of a face on a surface of revolution: its meridian strip — around a line profile a
 * quadrilateral from the wall inside to the reach outside, grown along it by the wall; around an arc an
 * annular sector, grown in angle — turned over the face's angles, grown by the wall over the smallest
 * radius; not grown at the edges it stops at. Every edge of the face must be a circle about the axis or
 * a meridian.
 */
function revolutionSlab(R: Revolution, f: BrepFace, name: string, uses: { curve: Curve; stop: boolean }[], t: number, out: number, size: number, id: string): Brep[] {
  const { c, a, e1, e2 } = R, tol = 1e-9 * size;
  const angle = (p: Point) => { const d = sub(p, c); return Math.atan2(dot(d, e2), dot(d, e1)); };
  const mer = (p: Point): XY => meridianOf(R, p);
  const pts: Point[] = [], sides: { circle: boolean; at: Point; stop: boolean }[] = [];
  for (const u of uses) {
    const [t0, t1] = curveDomain(u.curve), P = [0, 0.25, 0.5, 0.75, 1].map(x => evaluateCurve(u.curve, t0 + (t1 - t0) * x)), M = P.map(mer);
    const circle = M.every(m => Math.hypot(m[0] - M[0][0], m[1] - M[0][1]) < 1e-6 * size);
    const meridian = P.every(p => mer(p)[0] < 1e-9 * size || Math.abs(wrap(angle(p) - angle(P[2]) + Math.PI) - Math.PI) < 1e-6);
    if (!circle && !meridian) refuse(`face ${name} (a surface of revolution) is trimmed by a curve other than its circles and meridians (not supported yet)`);
    pts.push(...P); sides.push({ circle, at: P[2], stop: u.stop });
  }
  // The outward side in the meridian plane, from the face's normal at its middle.
  const S = nurbsOf(f), u0 = S.knotsU[0], u1 = S.knotsU[S.knotsU.length - 1], v0 = S.knotsV[0], v1 = S.knotsV[S.knotsV.length - 1], um = (u0 + u1) / 2, vm = (v0 + v1) / 2;
  const P0 = evaluateSurface(S, um, vm), Pu = evaluateSurface(S, um + 1e-6 * (u1 - u0), vm), Pv = evaluateSurface(S, um, vm + 1e-6 * (v1 - v0));
  const N = scale(cross(sub(Pu, P0), sub(Pv, P0)), f.sense === 'forward' ? 1 : -1), m0 = mer(P0), radial = unit(sub(sub(P0, c), scale(a, dot(sub(P0, c), a))));
  const nm: XY = [dot(N, radial), dot(N, a)], M = pts.map(mer);
  // Which end of the meridian strip a circle edge is (low, high), and the angular end a meridian edge is.
  const stop = [false, false, false, false];
  let ring: CurveSegment2[];
  if (R.profile.kind === 'line') {
    const { p, q } = R.profile, L = Math.hypot(q[0] - p[0], q[1] - p[1]), d: XY = [(q[0] - p[0]) / L, (q[1] - p[1]) / L];
    let nu: XY = [-d[1], d[0]]; if (nu[0] * nm[0] + nu[1] * nm[1] < 0) nu = [d[1], -d[0]];
    const sOf = (m: XY) => (m[0] - p[0]) * d[0] + (m[1] - p[1]) * d[1], ss = M.map(sOf), lo = Math.min(...ss), hi = Math.max(...ss);
    for (const s of sides) if (s.circle && s.stop) stop[Math.abs(sOf(mer(s.at)) - lo) < Math.abs(sOf(mer(s.at)) - hi) ? 0 : 1] = true;
    const s0 = lo - (stop[0] ? 0 : t), s1 = hi + (stop[1] ? 0 : t);
    const at = (sv: number, w: number): XY => [p[0] + d[0] * sv + nu[0] * w, p[1] + d[1] * sv + nu[1] * w];
    const quad = [at(s0, -t), at(s1, -t), at(s1, out), at(s0, out)];
    ring = quad.map((x, i) => ({ kind: 'line', a: x, b: quad[(i + 1) % 4] }));
  } else {
    const { c: C, r } = R.profile, convex = (m0[0] - C[0]) * nm[0] + (m0[1] - C[1]) * nm[1] > 0;
    const ri = convex ? (r - t > tol ? r - t : 0) : Math.max(r - CONCAVE_REACH * t, 0), ro = convex ? r + out : r + t;
    const phiOf = (m: XY) => wrap(Math.atan2(m[1] - C[1], m[0] - C[0])), phis = [...new Set(M.map(phiOf))].sort((x, y) => x - y);
    const gaps = phis.map((x, i) => ({ size: i ? x - phis[i - 1] : x + TAU - phis[phis.length - 1], start: x })).sort((x, y) => y.size - x.size);
    const dphi = t / Math.max(ri, r / 4), lo = gaps[0].start, sweep0 = TAU - gaps[0].size;
    for (const s of sides) if (s.circle && s.stop) stop[wrap(phiOf(mer(s.at)) - lo + 1e-9) < sweep0 / 2 ? 0 : 1] = true;
    const f0 = lo - (stop[0] ? 0 : dphi), sweep = Math.min(TAU - 1e-6, sweep0 + (stop[0] ? 0 : dphi) + (stop[1] ? 0 : dphi)), f1 = f0 + sweep;
    const pt = (rr: number, ph: number): XY => [C[0] + rr * Math.cos(ph), C[1] + rr * Math.sin(ph)];
    ring = ri > 1e-9 * r ? [{ kind: 'arc', c: C, r: ro, t0: f0, sweep }, { kind: 'line', a: pt(ro, f1), b: pt(ri, f1) }, { kind: 'arc', c: C, r: ri, t0: f1, sweep: -sweep }, { kind: 'line', a: pt(ri, f0), b: pt(ro, f0) }]
      : [{ kind: 'arc', c: C, r: ro, t0: f0, sweep }, { kind: 'line', a: pt(ro, f1), b: C }, { kind: 'line', a: C, b: pt(ro, f0) }];
  }
  // Counter-clockwise, then only the side of the axis the face is on (ρ ≥ 0).
  ring = ccw(ring);
  const big = 4 * size + 10, half: CurveSegment2[] = [[0, -big], [big, -big], [big, big], [0, big]].map((x, i, arr) => ({ kind: 'line', a: x as XY, b: arr[(i + 1) % 4] as XY }));
  const regions = booleanCurveRegions([ring], [half], 'intersection', tol);
  const angs = [...new Set(pts.map(p => wrap(angle(p))))].sort((x, y) => x - y);
  const gaps = angs.map((x, i) => ({ size: i ? x - angs[i - 1] : x + TAU - angs[angs.length - 1], start: x })).sort((x, y) => y.size - x.size);
  const th0 = gaps[0].start, span0 = TAU - gaps[0].size;
  for (const s of sides) if (!s.circle && s.stop) stop[wrap(angle(s.at) - th0 + 1e-9) < span0 / 2 ? 2 : 3] = true;
  return regions.map((reg, j) => {
    const rmin = Math.min(...reg.outer.flatMap(g => g.kind === 'line' ? [g.a[0], g.b[0]] : g.kind === 'arc' ? [Math.max(0, g.c[0] - g.r)] : [0]));
    const dth = rmin > 1e-6 * size ? t / rmin : TAU, g0 = stop[2] ? 0 : dth, g1 = stop[3] ? 0 : dth, span = span0 + g0 + g1, full = span >= TAU - 1e-9, start = full ? 0 : th0 - g0;
    const profile = reg.outer.map(g => g.kind === 'line' ? { kind: 'line' as const, start: [g.a[0], g.a[1]] as XY } : g.kind === 'arc' ? { kind: 'arc' as const, start: endOf(g, 0), center: g.c as XY, direction: (g.sweep > 0 ? 'ccw' : 'cw') as 'ccw' | 'cw' } : refuse('a slab profile with a free curve'));
    const sid = `${id}_${j}`, turned = revolveProfile({ id: sid, profile, axis: { origin: [0, 0], direction: [0, 1] }, angleDegrees: full ? 360 : span * 180 / Math.PI });
    return placeTurned(turned, sid, span, start, c, a, e1, e2);
  });
}
