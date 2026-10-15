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
import { BrepError, type Brep, type BrepFace } from './brep-core.js';
import { booleanAnalytic, faceGeometry } from './analytic-boolean.js';
import { circleOf } from './brep-tessellate.js';
import { curveDomain, evaluateCurve } from './math.js';
import { brepFromPrismatic, prismaticExtrude } from './prismatic-solid.js';
import { growSection } from './section-offset.js';
import { transformBrep } from './brep-transform.js';
import { revolveProfile } from './revolve.js';
import { add, cross, dot, len, scale, sub, unit } from './vec3.js';
import { booleanCurveRegions, type CurveRegion2, type CurveSegment2, type XY } from './curved-arrangement.js';
import type { Curve, Point } from './types.js';

const TAU = 2 * Math.PI;
const wrap = (a: number) => ((a % TAU) + TAU) % TAU;
const refuse = (detail: string): never => { throw new BrepError('GEOMETRY', `CAPABILITY: shell: ${detail}`); };

/** The shell of `body` with walls `t` thick, the faces named in `open` removed. */
export function generalShell(body: Brep, t: number, open: ReadonlySet<string>, id: string): Brep {
  const size = Math.max(1, ...body.vertices.flatMap(v => v.point.map(Math.abs))), tol = 1e-9 * size, out = 1.37 * t;
  const loops = new Map(body.loops.map(l => [l.id, l])), coedges = new Map(body.coedges.map(c => [c.id, c])), edges = new Map(body.edges.map(e => [e.id, e]));
  /** A face's loops as point chains, each coedge as its curve in its direction. */
  const usesOf = (f: BrepFace) => f.loops.map(lid => { const l = loops.get(lid)!; return { outer: l.kind === 'outer', uses: l.coedges.map(cid => { const c = coedges.get(cid)!; return { curve: edges.get(c.edge)!.curve, forward: c.sense === 'forward' }; }) }; });
  const ends = (u: { curve: Curve; forward: boolean }) => { const [t0, t1] = curveDomain(u.curve), a = evaluateCurve(u.curve, t0), b = evaluateCurve(u.curve, t1), m = evaluateCurve(u.curve, (t0 + t1) / 2); return u.forward ? { s: a, m, e: b } : { s: b, m, e: a }; };
  const slabs: Brep[] = [];
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
        const circ = circleOf(c);
        if (!circ) return refuse(`face ${name} is bounded by a curve that is not a line or an arc`);
        const c2 = to2(circ.c), ang = (p: Point) => { const q = to2(p); return Math.atan2(q[1] - c2[1], q[0] - c2[0]); };
        const a0 = ang(s), ccw = wrap(ang(e) - a0) || TAU, viaM = wrap(ang(m) - a0);
        return { kind: 'arc', c: c2, r: circ.r, t0: a0, sweep: viaM < ccw ? ccw : ccw - TAU };
      });
      const L = usesOf(f);
      P.regions.push({ outer: ring(L.find(l => l.outer)!.uses), holes: L.filter(l => !l.outer).map(l => ring(l.uses)) });
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
    refuse(`face ${name} is not a plane or a cylinder (shell of such bodies is not supported yet)`);
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
      const endFace = ring.faces.find(x => x.name === `${sid}.end`), q = endFace ? scale(add(endFace.surface.controlPoints[0][0] as Point, endFace.surface.controlPoints[1][1] as Point), 0.5) : null;
      const towards = q && Math.abs(wrap(Math.atan2(q[2], q[0])) - wrap(span)) > Math.abs(wrap(Math.atan2(q[2], q[0])) - wrap(-span)) ? -1 : 1;
      const { a, e1, e2 } = C, X = add(scale(e1, Math.cos(start)), scale(e2, Math.sin(start))), Zw = scale(add(scale(e1, -Math.sin(start)), scale(e2, Math.cos(start))), towards);
      slabs.push(transformBrep(ring, { matrix: [X[0], a[0], Zw[0], X[1], a[1], Zw[1], X[2], a[2], Zw[2]], offset: [C.c[0], C.c[1], C.c[2]] }));
    });
  });
  if (!slabs.length) refuse('every face is opened');
  let wall = slabs[0];
  for (const s of slabs.slice(1)) wall = booleanAnalytic(wall, s, 'union', { id: `${id}_wall` });
  return booleanAnalytic(body, wall, 'intersection', { id });
}
