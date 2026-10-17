// Shell of a general B-rep of planes and cylinders: the body's wall is the union of a slab per face —
// the face's region grown by the wall within its own surface, from the wall's depth inside to a
// little outside — and the shell is the body within that union. Every point inside the body within
// the wall of its boundary lies in the slab of the face nearest it (the region grown by the wall holds
// the foot of any point within it), so the wall is nowhere thinner; at concave edges the grown slabs
// fill the corner, as offset faces meeting there do. Opened faces get no slab. Slabs reach out by a
// factor of the wall unlike any of their own sizes, so their outer faces never lie on the body's.
//
// Faces: planes bounded by lines and arcs (any region, holes included) and cylinders whose domain is a
// rectangle (bounded by lines along the axis and circles across it). Others are refused by name.
import { BrepError, isFacetFace, nurbsOf, type Brep, type BrepFace } from './brep-core.js';
import { booleanAnalytic, faceGeometry } from './analytic-boolean.js';
import { circleOf } from './brep-tessellate.js';
import { curveDomain, evaluateCurve, evaluateSurface } from './math.js';
import { brepFromPrismatic, prismaticExtrude } from './prismatic-solid.js';
import { growSection } from './section-offset.js';
import { transformBrep } from './brep-transform.js';
import { revolveProfile } from './revolve.js';
import { revolutionOf, type Revolution } from './surface-revolution.js';
import { add, cross, dot, len, scale, sub, unit } from './vec3.js';
import { booleanCurveRegions, type CurveRegion2, type CurveSegment2, type XY } from './curved-arrangement.js';
import type { Curve, Point } from './types.js';

const TAU = 2 * Math.PI;
const wrap = (a: number) => ((a % TAU) + TAU) % TAU;
const refuse = (detail: string): never => { throw new BrepError('GEOMETRY', `CAPABILITY: shell: ${detail}`); };

/** The shell of `body` with walls `t` thick, the faces named in `open` removed. */
export function generalShell(body: Brep, t: number, open: ReadonlySet<string>, id: string): Brep {
  if (body.faces.some(isFacetFace)) throw new BrepError('GEOMETRY', 'shell of a mesh body: faceted (mesh) faces are not supported yet');
  const size = Math.max(1, ...body.vertices.flatMap(v => v.point.map(Math.abs))), tol = 1e-9 * size, out = 1.37 * t;
  const loops = new Map(body.loops.map(l => [l.id, l])), coedges = new Map(body.coedges.map(c => [c.id, c])), edges = new Map(body.edges.map(e => [e.id, e]));
  /** A face's loops as point chains, each coedge as its curve in its direction. */
  const usesOf = (f: BrepFace) => f.loops.map(lid => { const l = loops.get(lid)!; return { outer: l.kind === 'outer', uses: l.coedges.map(cid => { const c = coedges.get(cid)!; return { curve: edges.get(c.edge)!.curve, forward: c.sense === 'forward' }; }) }; });
  const ends = (u: { curve: Curve; forward: boolean }) => { const [t0, t1] = curveDomain(u.curve), a = evaluateCurve(u.curve, t0), b = evaluateCurve(u.curve, t1), m = evaluateCurve(u.curve, (t0 + t1) / 2); return u.forward ? { s: a, m, e: b } : { s: b, m, e: a }; };
  const slabs: Brep[] = [], revolutions: { R: Revolution; face: BrepFace; name: string }[] = [];
  // Faces on one plane (or one cylinder) — a face split by an earlier Boolean — share one slab.
  const planes: { n: Point; o: Point; e1: Point; e2: Point; regions: CurveRegion2[] }[] = [];
  const cylinders: { c: Point; a: Point; r: number; out: number; e1: Point; e2: Point; rects: { th0: number; span: number; z0: number; z1: number }[]; name: string }[] = [];
  body.faces.forEach((f) => {
    if (f.name && open.has(f.name)) return;
    const name = f.name ?? f.id, g = (() => { try { return faceGeometry(f, size); } catch { return { kind: 'other' as const }; } })();
    if (g.kind === 'plane') {
      // The face's region in the plane (e1, e2, n outward), grown by the wall; extruded from −t to out.
      let P = planes.find(q => len(sub(q.n, g.n)) < 1e-9 && Math.abs(dot(sub(g.o, q.o), q.n)) < tol);
      if (!P) { const n = g.n, e1 = unit(Math.abs(n[0]) < 0.9 ? cross([1, 0, 0], n) : cross([0, 1, 0], n)); P = { n, o: scale(n, dot(g.o, n)), e1, e2: cross(n, e1), regions: [] }; planes.push(P); }
      const { e1, e2, o } = P;
      const to2 = (p: Point): XY => { const d = sub(p, o); return [dot(d, e1), dot(d, e2)]; };
      const ring = (uses: ReturnType<typeof usesOf>[number]['uses']): CurveSegment2[] => uses.map(u => {
        const c = u.curve, { s, m, e } = ends(u);
        if (c.degree === 1 && c.controlPoints.length === 2) return { kind: 'line', a: to2(s), b: to2(e) };
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
        return { kind: 'arc', c: c2, r, t0: a0, sweep: viaM < ccw ? ccw : ccw - TAU };
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
      const L = usesOf(f);
      P.regions.push({ outer: unify(ring(L.find(l => l.outer)!.uses)), holes: L.filter(l => !l.outer).map(l => unify(ring(l.uses))) });
      return;
    }
    if (g.kind === 'cylinder') {
      // A rectangle in (angle, height): every edge a line along the axis or a circle across it.
      const a0 = unit(g.a);
      let C = cylinders.find(q => Math.abs(q.r - g.r) < tol && q.out === g.out && len(cross(q.a, a0)) < 1e-9 && len(cross(sub(g.c, q.c), q.a)) < 1e-7 * size);
      if (!C) { const e1 = unit(Math.abs(a0[0]) < 0.9 ? cross([1, 0, 0], a0) : cross([0, 1, 0], a0)); C = { c: g.c, a: a0, r: g.r, out: g.out, e1, e2: cross(a0, e1), rects: [], name }; cylinders.push(C); }
      const { a, e1, e2 } = C, cc = C.c;
      const angle = (p: Point) => { const d = sub(p, cc); return Math.atan2(dot(d, e2), dot(d, e1)); }, height = (p: Point) => dot(sub(p, cc), a);
      const pts: Point[] = [];
      for (const l of usesOf(f)) for (const u of l.uses) {
        const c = u.curve, [t0, t1] = curveDomain(c), P = [0, 0.25, 0.5, 0.75, 1].map(x => evaluateCurve(c, t0 + (t1 - t0) * x));
        const straight = c.degree === 1 && c.controlPoints.length === 2, circ = straight ? null : circleOf(c);
        const along = straight && len(cross(unit(sub(P[4], P[0])), a)) < 1e-9, across = circ && Math.abs(Math.abs(dot(unit(cross(circ.e1, circ.e2)), a)) - 1) < 1e-9 && len(sub(sub(circ.c, cc), scale(a, dot(sub(circ.c, cc), a)))) < 1e-7 * size;
        if (!along && !across) refuse(`face ${name} (a cylinder) is trimmed by a curve other than its rulings and circles (not supported yet)`);
        pts.push(...P);
      }
      const hs = pts.map(height), angs = [...new Set(pts.map(p => wrap(angle(p))))].sort((x, y) => x - y);
      const gaps = angs.map((x, i) => ({ size: i ? x - angs[i - 1] : x + TAU - angs[angs.length - 1], start: x })).sort((x, y) => y.size - x.size);
      C.rects.push({ th0: gaps[0].start, span: TAU - gaps[0].size, z0: Math.min(...hs), z1: Math.max(...hs) });
      return;
    }
    const rev = revolutionOf(nurbsOf(f), size);
    if (!rev) return refuse(`face ${name} is not a plane, a cylinder or a surface of revolution (shell of bodies with freeform faces joined to others is not supported yet)`);
    revolutions.push({ R: rev, face: f, name });
  });
  planes.forEach((P, k) => {
    const grown = growSection(booleanCurveRegions(P.regions.flatMap(r => [r.outer, ...r.holes]), [], 'union', tol), t, tol), { n, e1, e2, o } = P;
    const prism = brepFromPrismatic(prismaticExtrude(grown.flatMap(r => [r.outer, ...r.holes]), -t, out), { id: `${id}_p${k}` });
    slabs.push(transformBrep(prism, { matrix: [e1[0], e2[0], n[0], e1[1], e2[1], n[1], e1[2], e2[2], n[2]], offset: [o[0], o[1], o[2]] }));
  });
  cylinders.forEach((C, k) => {
    // Pieces of one turn with one height range join (two halves: the whole ring); others stay apart.
    const rs = [...C.rects], same = rs.every(r => Math.abs(r.z0 - rs[0].z0) < tol && Math.abs(r.z1 - rs[0].z1) < tol), total = rs.reduce((acc, r) => acc + r.span, 0);
    const parts = same && total >= TAU - 1e-6 ? [{ th0: 0, span: TAU, z0: rs[0].z0, z1: rs[0].z1 }] : rs;
    parts.forEach((R, j) => {
      const inner = C.out > 0 ? Math.max(C.r - t, 1e-3 * C.r) : Math.max(C.r - out, C.r / 2), outer = C.out > 0 ? C.r + out : C.r + t;
      const dth = t / Math.max(inner, 1e-9), full = R.span >= TAU - 1e-6 || R.span + 2 * dth >= TAU - 1e-9, span = full ? TAU : R.span + 2 * dth, start = full ? 0 : R.th0 - dth, sid = `${id}_c${k}_${j}`;
      // A rectangle (ρ, h) turned about the local Y axis, then placed: Y → the axis, X → the start angle.
      const profile = [[inner, R.z0 - t], [outer, R.z0 - t], [outer, R.z1 + t], [inner, R.z1 + t]].map(p => ({ kind: 'line' as const, start: p as XY }));
      const ring = revolveProfile({ id: sid, profile, axis: { origin: [0, 0], direction: [0, 1] }, angleDegrees: span * 180 / Math.PI });
      // Which way the revolve turns (towards +Z or −Z of its sketch): from its end face.
      const endFace = ring.faces.find(x => x.name === `${sid}.end`), q = endFace ? scale(add(nurbsOf(endFace).controlPoints[0][0] as Point, nurbsOf(endFace).controlPoints[1][1] as Point), 0.5) : null;
      const towards = q && Math.abs(wrap(Math.atan2(q[2], q[0])) - wrap(span)) > Math.abs(wrap(Math.atan2(q[2], q[0])) - wrap(-span)) ? -1 : 1;
      const { a, e1, e2 } = C, X = add(scale(e1, Math.cos(start)), scale(e2, Math.sin(start))), Zw = scale(add(scale(e1, -Math.sin(start)), scale(e2, Math.cos(start))), towards);
      slabs.push(transformBrep(ring, { matrix: [X[0], a[0], Zw[0], X[1], a[1], Zw[1], X[2], a[2], Zw[2]], offset: [C.c[0], C.c[1], C.c[2]] }));
    });
  });
  revolutions.forEach((x, k) => slabs.push(...revolutionSlab(x.R, x.face, x.name, usesOf(x.face).flatMap(l => l.uses), t, out, size, `${id}_v${k}`)));
  if (!slabs.length) refuse('every face is opened');
  let wall = slabs[0];
  for (const s of slabs.slice(1)) wall = booleanAnalytic(wall, s, 'union', { id: `${id}_wall`, exactEdges: true });
  return booleanAnalytic(body, wall, 'intersection', { id, exactEdges: true });
}

/**
 * The slab of a face on a surface of revolution: its meridian strip — around a line profile a
 * quadrilateral from the wall inside to the reach outside, grown along it by the wall; around an arc an
 * annular sector, grown in angle — turned over the face's angles, grown by the wall over the smallest
 * radius. Every edge of the face must be a circle about the axis or a meridian.
 */
function revolutionSlab(R: Revolution, f: BrepFace, name: string, uses: { curve: Curve }[], t: number, out: number, size: number, id: string): Brep[] {
  const { c, a, e1, e2 } = R, tol = 1e-9 * size;
  const angle = (p: Point) => { const d = sub(p, c); return Math.atan2(dot(d, e2), dot(d, e1)); };
  const mer = (p: Point): XY => { const d = sub(p, c), h = dot(d, a); return [len(sub(d, scale(a, h))), h]; };
  const pts: Point[] = [];
  for (const u of uses) {
    const [t0, t1] = curveDomain(u.curve), P = [0, 0.25, 0.5, 0.75, 1].map(x => evaluateCurve(u.curve, t0 + (t1 - t0) * x)), M = P.map(mer);
    const circle = M.every(m => Math.hypot(m[0] - M[0][0], m[1] - M[0][1]) < 1e-6 * size);
    const meridian = P.every(p => mer(p)[0] < 1e-9 * size || Math.abs(wrap(angle(p) - angle(P[2]) + Math.PI) - Math.PI) < 1e-6);
    if (!circle && !meridian) refuse(`face ${name} (a surface of revolution) is trimmed by a curve other than its circles and meridians (not supported yet)`);
    pts.push(...P);
  }
  // The outward side in the meridian plane, from the face's normal at its middle.
  const S = nurbsOf(f), u0 = S.knotsU[0], u1 = S.knotsU[S.knotsU.length - 1], v0 = S.knotsV[0], v1 = S.knotsV[S.knotsV.length - 1], um = (u0 + u1) / 2, vm = (v0 + v1) / 2;
  const P0 = evaluateSurface(S, um, vm), Pu = evaluateSurface(S, um + 1e-6 * (u1 - u0), vm), Pv = evaluateSurface(S, um, vm + 1e-6 * (v1 - v0));
  const N = scale(cross(sub(Pu, P0), sub(Pv, P0)), f.sense === 'forward' ? 1 : -1), m0 = mer(P0), radial = unit(sub(sub(P0, c), scale(a, dot(sub(P0, c), a))));
  const nm: XY = [dot(N, radial), dot(N, a)], M = pts.map(mer);
  let ring: CurveSegment2[];
  if (R.profile.kind === 'line') {
    const { p, q } = R.profile, L = Math.hypot(q[0] - p[0], q[1] - p[1]), d: XY = [(q[0] - p[0]) / L, (q[1] - p[1]) / L];
    let nu: XY = [-d[1], d[0]]; if (nu[0] * nm[0] + nu[1] * nm[1] < 0) nu = [d[1], -d[0]];
    const ss = M.map(m => (m[0] - p[0]) * d[0] + (m[1] - p[1]) * d[1]), s0 = Math.min(...ss) - t, s1 = Math.max(...ss) + t;
    const at = (sv: number, w: number): XY => [p[0] + d[0] * sv + nu[0] * w, p[1] + d[1] * sv + nu[1] * w];
    const quad = [at(s0, -t), at(s1, -t), at(s1, out), at(s0, out)];
    ring = quad.map((x, i) => ({ kind: 'line', a: x, b: quad[(i + 1) % 4] }));
  } else {
    const { c: C, r } = R.profile, convex = (m0[0] - C[0]) * nm[0] + (m0[1] - C[1]) * nm[1] > 0;
    const ri = convex ? Math.max(r - t, 0) : Math.max(r - out, 0), ro = convex ? r + out : r + t;
    const phis = [...new Set(M.map(m => wrap(Math.atan2(m[1] - C[1], m[0] - C[0]))))].sort((x, y) => x - y);
    const gaps = phis.map((x, i) => ({ size: i ? x - phis[i - 1] : x + TAU - phis[phis.length - 1], start: x })).sort((x, y) => y.size - x.size);
    const dphi = t / Math.max(ri, r / 4), f0 = gaps[0].start - dphi, sweep = Math.min(TAU - 1e-6, TAU - gaps[0].size + 2 * dphi), f1 = f0 + sweep;
    const pt = (rr: number, ph: number): XY => [C[0] + rr * Math.cos(ph), C[1] + rr * Math.sin(ph)];
    ring = ri > 1e-9 * r ? [{ kind: 'arc', c: C, r: ro, t0: f0, sweep }, { kind: 'line', a: pt(ro, f1), b: pt(ri, f1) }, { kind: 'arc', c: C, r: ri, t0: f1, sweep: -sweep }, { kind: 'line', a: pt(ri, f0), b: pt(ro, f0) }]
      : [{ kind: 'arc', c: C, r: ro, t0: f0, sweep }, { kind: 'line', a: pt(ro, f1), b: C }, { kind: 'line', a: C, b: pt(ro, f0) }];
  }
  // Counter-clockwise, then only the side of the axis the face is on (ρ ≥ 0).
  const end = (g: CurveSegment2, k: 0 | 1): XY => g.kind === 'line' ? (k ? g.b : g.a) : g.kind === 'arc' ? [g.c[0] + g.r * Math.cos(g.t0 + k * g.sweep), g.c[1] + g.r * Math.sin(g.t0 + k * g.sweep)] : [0, 0];
  const area = ring.reduce((acc, g) => { const A = end(g, 0), B = end(g, 1); return acc + (A[0] * B[1] - B[0] * A[1]) / 2 + (g.kind === 'arc' ? g.r * g.r * (g.sweep - Math.sin(g.sweep)) / 2 : 0); }, 0);
  if (area < 0) ring = [...ring].reverse().map(g => g.kind === 'line' ? { ...g, a: g.b, b: g.a } : g.kind === 'arc' ? { ...g, t0: g.t0 + g.sweep, sweep: -g.sweep } : g);
  const big = 4 * size + 10, half: CurveSegment2[] = [[0, -big], [big, -big], [big, big], [0, big]].map((x, i, arr) => ({ kind: 'line', a: x as XY, b: arr[(i + 1) % 4] as XY }));
  const regions = booleanCurveRegions([ring], [half], 'intersection', tol);
  const angs = [...new Set(pts.map(p => wrap(angle(p))))].sort((x, y) => x - y);
  const gaps = angs.map((x, i) => ({ size: i ? x - angs[i - 1] : x + TAU - angs[angs.length - 1], start: x })).sort((x, y) => y.size - x.size);
  return regions.map((reg, j) => {
    const rmin = Math.min(...reg.outer.flatMap(g => g.kind === 'line' ? [g.a[0], g.b[0]] : g.kind === 'arc' ? [Math.max(0, g.c[0] - g.r)] : [0]));
    const dth = rmin > 1e-6 * size ? t / rmin : TAU, span = TAU - gaps[0].size + 2 * dth, full = span >= TAU - 1e-9, start = full ? 0 : gaps[0].start - dth;
    const profile = reg.outer.map(g => g.kind === 'line' ? { kind: 'line' as const, start: [g.a[0], g.a[1]] as XY } : g.kind === 'arc' ? { kind: 'arc' as const, start: end(g, 0), center: g.c as XY, direction: (g.sweep > 0 ? 'ccw' : 'cw') as 'ccw' | 'cw' } : refuse('a slab profile with a free curve'));
    const sid = `${id}_${j}`, turned = revolveProfile({ id: sid, profile, axis: { origin: [0, 0], direction: [0, 1] }, angleDegrees: full ? 360 : span * 180 / Math.PI });
    const endFace = turned.faces.find(x => x.name === `${sid}.end`), q = endFace ? scale(add(nurbsOf(endFace).controlPoints[0][0] as Point, nurbsOf(endFace).controlPoints[1][1] as Point), 0.5) : null;
    const towards = q && Math.abs(wrap(Math.atan2(q[2], q[0])) - wrap(span)) > Math.abs(wrap(Math.atan2(q[2], q[0])) - wrap(-span)) ? -1 : 1;
    const X = add(scale(e1, Math.cos(start)), scale(e2, Math.sin(start))), Zw = scale(add(scale(e1, -Math.sin(start)), scale(e2, Math.cos(start))), towards);
    return transformBrep(turned, { matrix: [X[0], a[0], Zw[0], X[1], a[1], Zw[1], X[2], a[2], Zw[2]], offset: [c[0], c[1], c[2]] });
  });
}
