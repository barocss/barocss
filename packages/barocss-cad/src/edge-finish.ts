// Fillets and chamfers of B-rep edges by rolling-ball tools. Every selected edge, with the edges that
// continue it tangentially (a slot's rim, the top of a rounded box), gets a tool: the region between its
// two faces and the fillet surface (or the chamfer plane), grown a little outside that corner so no tool
// face lies on a face of the body. A convex edge loses its tool, a concave one gains it, by one analytic
// Boolean with the union of the tools.
//
//   straight edges   between two planes, at any angle and orientation: the corner profile extruded
//                    along the edge (the fillet surface is a cylinder)
//   circular edges   between a plane and a cylinder standing on it (a hole's rim, a boss's top or foot):
//                    the profile revolved about the cylinder's axis (a torus patch; a cone for a chamfer)
//   chain ends       where the body ends beyond the edge (every other face there faces onward), the
//                    tool runs past the end and the Boolean trims it; elsewhere it stops at the vertex
//
// Two finished edges meeting at a corner meet in their mitre (the intersection of the two surfaces);
// other edges (between curved faces, or where the faces meet tangentially) are refused with the reason.
import { BrepError, type Brep } from './brep-core.js';
import { booleanAnalytic, faceGeometry, type FaceGeometry } from './analytic-boolean.js';
import { brepFromPrismatic, prismaticFromProfile } from './prismatic-solid.js';
import { revolveProfile } from './revolve.js';
import { transformBrep } from './brep-transform.js';
import { circleOf } from './brep-tessellate.js';
import { curveDomain, evaluateCurve } from './math.js';
import { add, cross, dot, len, scale, sub, unit } from './vec3.js';
import type { Point } from './types.js';
import type { ProfileSegmentInput } from './extruded-profile-solid.js';

type XY = [number, number];
export type EdgeFinishKind = 'fillet' | 'chamfer';
const refuse = (code: 'SELECTION' | 'CAPABILITY' | 'PARAMETER', detail: string): never => { throw new BrepError(code === 'PARAMETER' ? 'INPUT' : 'GEOMETRY', `${code}: ${detail}`); };

interface Use { face: Brep['faces'][number]; geometry: FaceGeometry; sense: 'forward' | 'reversed' }

/**
 * Fillets (radius) or chamfers (distance) the named edges of `body` and the edges continuing them
 * tangentially. Tool faces are named `${id}.face` (the fillet or chamfer surface).
 */
export function finishBrepEdges(body: Brep, names: readonly string[], size: number, kind: EdgeFinishKind, id: string): Brep {
  let scaleMM = 1; for (const v of body.vertices) for (const x of v.point) scaleMM = Math.max(scaleMM, Math.abs(x));
  const tol = 1e-9 * scaleMM;
  const faces = new Map(body.faces.map(f => [f.id, f])), loopFace = new Map(body.loops.map(l => [l.id, l.face]));
  const usesOf = new Map<string, Use[]>(), geometry = new Map<string, FaceGeometry>();
  const geom = (fid: string) => { let g = geometry.get(fid); if (!g) { g = faceGeometry(faces.get(fid)!, scaleMM); geometry.set(fid, g); } return g; };
  for (const c of body.coedges) { const f = faces.get(loopFace.get(c.loop)!)!; usesOf.set(c.edge, [...(usesOf.get(c.edge) ?? []), { face: f, geometry: geom(f.id), sense: c.sense }]); }
  const atVertex = new Map<string, Brep['edges'][number][]>();
  for (const e of body.edges) for (const v of new Set(e.vertices)) atVertex.set(v, [...(atVertex.get(v) ?? []), e]);
  const byName = new Map(body.edges.map(e => [e.name, e]));

  // Ends and end tangents (pointing away from the vertex, along the edge).
  const ends = (e: Brep['edges'][number]) => {
    const [t0, t1] = curveDomain(e.curve), h = 1e-6 * (t1 - t0);
    const p = evaluateCurve(e.curve, t0), q = evaluateCurve(e.curve, t1);
    return [{ v: e.vertices[0], x: p, out: unit(sub(evaluateCurve(e.curve, t0 + h), p)) }, { v: e.vertices[1], x: q, out: unit(sub(evaluateCurve(e.curve, t1 - h), q)) }];
  };
  const facesOf = (e: Brep['edges'][number]) => (usesOf.get(e.id) ?? []).map(u => u.face.id);

  // Tangent chains: at a vertex, an edge sharing a face and leaving in the opposite direction continues it.
  const chain = new Map<string, Brep['edges'][number]>();
  for (const name of names) {
    const e = byName.get(name);
    if (!e) refuse('SELECTION', `no edge named ${name}; edges: ${body.edges.slice(0, 12).map(x => x.name).join(', ')}${body.edges.length > 12 ? ', …' : ''}`);
    chain.set(e!.id, e!);
  }
  const continues = (e: Brep['edges'][number], end: { v: string; out: Point }) => (atVertex.get(end.v) ?? []).filter(o => {
    if (o.id === e.id || !facesOf(o).some(f => facesOf(e).includes(f))) return false;
    return ends(o).some(oe => oe.v === end.v && dot(oe.out, end.out) <= -1 + 1e-9);
  });
  for (const queue = [...chain.values()]; queue.length;) {
    const e = queue.pop()!;
    for (const end of ends(e)) for (const o of continues(e, end)) if (!chain.has(o.id)) { chain.set(o.id, o); queue.push(o); }
  }

  // Arcs covering a whole circle between the same plane and cylinder make one closed tool (the first of
  // them stands for the rest).
  const skip = new Set<string>(), closedCircle = new Set<string>();
  const circleKey = (e: Brep['edges'][number]) => {
    const k = circleOf(e.curve), us = usesOf.get(e.id) ?? [];
    if (!k || e.curve.degree === 1) return null;
    const pl = us.find(u => u.geometry.kind === 'plane')?.geometry as Extract<FaceGeometry, { kind: 'plane' }> | undefined;
    const cy = us.find(u => u.geometry.kind === 'cylinder')?.geometry as Extract<FaceGeometry, { kind: 'cylinder' }> | undefined;
    if (!pl || !cy) return null;
    const r = (x: number) => Math.round(x / (1e3 * tol));
    return [...k.c.map(r), r(k.r), r(dot(pl.n, pl.o)), ...pl.n.map(x => Math.round(x * 1e9)), r(cy.r)].join(',');
  };
  const groups = new Map<string, Brep['edges'][number][]>();
  for (const e of chain.values()) { const key = circleKey(e); if (key) groups.set(key, [...(groups.get(key) ?? []), e]); }
  for (const list of groups.values()) {
    const total = list.reduce((acc, e) => { const k = circleOf(e.curve)!; return acc + k.spans.reduce((a, x) => a + x.phi, 0); }, 0);
    if (Math.abs(total - 2 * Math.PI) <= 1e-9) { closedCircle.add(list[0].id); for (const e of list.slice(1)) skip.add(e.id); }
  }

  const convexTools: Brep[] = [], concaveTools: Brep[] = [];
  for (const e of chain.values()) {
    if (skip.has(e.id)) continue;
    const uses = usesOf.get(e.id) ?? [];
    if (uses.length !== 2) refuse('SELECTION', `edge ${e.name} does not join exactly two faces`);
    // How far the tool may run past each end: past the end of the body, else not at all. Where another
    // finished edge leaves the same vertex (a corner of a rounded box top), both tools run past it: with
    // one size, removing (or adding) both is exactly the mitre between the two finishes.
    const [E0, E1] = ends(e), sharedCorner = [false, false], blocked = [false, false];
    const reach = [E0, E1].map((end, i) => {
      if (continues(e, end).some(o => chain.has(o.id))) return 0;
      const meeting = (atVertex.get(end.v) ?? []).filter(o => o.id !== e.id && chain.has(o.id) && facesOf(o).some(f => facesOf(e).includes(f)));
      if (meeting.length) {
        // Only where their shared face turns outward (a convex corner of it): at a reflex corner the
        // tools would run on into the material beyond.
        const tangent = sub(E1.x, E0.x), sides = intoFaces(e, uses, end.x, len(tangent) > 0 ? unit(tangent) : end.out);
        for (const o of meeting) {
          const shared = uses.findIndex(u => facesOf(o).includes(u.face.id)), oe = ends(o).find(x => x.v === end.v)!;
          if (dot(oe.out, sides[shared].w) < 1e-9) refuse('CAPABILITY', `edges ${e.name} and ${o.name} meet at an inside corner of their face; finishing both there is not supported yet`);
        }
        sharedCorner[i] = true; return 1;
      }
      const others = new Set((atVertex.get(end.v) ?? []).flatMap(facesOf).filter(f => !facesOf(e).includes(f)));
      if (!others.size) return 0;
      let worst = Infinity;
      for (const f of others) { const n = outwardNormal(geom(f), end.x); if (!n) return 0; worst = Math.min(worst, -dot(n, end.out)); }
      if (worst > 1e-6) return 1 / Math.max(worst, 0.25); // the body ends there
      if (worst < -1e-6) blocked[i] = true; // a wall faces back along the edge
      return 0;
    });
    // A concave finish adds material: past an end where the body stops it would add it to the air, so
    // it stops there; where the edge runs into a wall it runs on into the wall.
    const convex = convexAt(intoFaces(e, uses, E0.x, E0.out));
    const run = convex ? reach : reach.map((_, i) => sharedCorner[i] || blocked[i] ? 1 : 0);
    const curve = e.curve, straight = curve.degree === 1 && curve.controlPoints.length === 2;
    const tool = straight ? straightTool(e, uses, E0.x, E1.x, run, size, kind, id) : arcTool(e, uses, E0.x, closedCircle.has(e.id) ? E0.x : E1.x, run, size, kind, id, tol);
    (tool.convex ? convexTools : concaveTools).push(tool.brep);
  }
  // The tools are joined first (along a tangent chain their end faces meet and vanish), then applied once.
  const unite = (tools: Brep[]) => tools.reduce((acc, t) => booleanAnalytic(acc, t, 'union', { id: `${id}_tools` }));
  let out = body;
  if (convexTools.length) out = booleanAnalytic(out, unite(convexTools), 'difference', { id });
  if (concaveTools.length) out = booleanAnalytic(out, unite(concaveTools), 'union', { id });
  return out;
}

/** Outward normal of a face's surface at a point of it (planes and cylinders). */
function outwardNormal(g: FaceGeometry, x: Point): Point | null {
  if (g.kind === 'plane') return g.n;
  if (g.kind === 'cylinder') { const d = sub(x, g.c), radial = unit(sub(d, scale(g.a, dot(d, g.a)))); return scale(radial, g.out); }
  return null;
}

/** Into each face at x, perpendicular to the edge (the face lies left of its coedge seen from outside). */
function intoFaces(e: Brep['edges'][number], uses: Use[], x: Point, tangent: Point): { n: Point; w: Point }[] {
  return uses.map(u => {
    const n = outwardNormal(u.geometry, x);
    if (!n) refuse('CAPABILITY', `edge ${e.name}: only edges between planes and cylinders can be finished yet`);
    const dir = u.sense === 'forward' ? tangent : scale(tangent, -1);
    return { n: n!, w: unit(cross(n!, dir)) };
  });
}

/**
 * The tool's profile in a section across the edge, in 2D coordinates where the edge passes through X
 * and its faces leave along w1, w2: the corner between them and the fillet arc (or chamfer line),
 * grown by g outside that corner. Returns the profile and whether the edge is convex (`material`).
 */
function cornerProfile(X: XY, w1: XY, w2: XY, size: number, kind: EdgeFinishKind, g: number, name: string): ProfileSegmentInput[] {
  const c = Math.max(-1, Math.min(1, w1[0] * w2[0] + w1[1] * w2[1])), alpha = Math.acos(c);
  if (alpha > Math.PI - 1e-6) refuse('SELECTION', `edge ${name}: its faces meet tangentially; there is no corner to finish`);
  const t = kind === 'fillet' ? size / Math.tan(alpha / 2) : size;
  const at = (p: XY, d: XY, k: number): XY => [p[0] + d[0] * k, p[1] + d[1] * k];
  const T1 = at(X, w1, t), T2 = at(X, w2, t);
  const perp = (a: XY, b: XY): XY => { const d = a[0] * b[0] + a[1] * b[1], v: XY = [b[0] - d * a[0], b[1] - d * a[1]], l = Math.hypot(v[0], v[1]); return [-v[0] / l, -v[1] / l]; };
  const n1 = perp(w1, w2), n2 = perp(w2, w1);
  // The corner of the two grown sides: X + n1 g + s w1 = X + n2 g + s' w2.
  const r: XY = [(n2[0] - n1[0]) * g, (n2[1] - n1[1]) * g], det = w1[0] * -w2[1] - -w2[0] * w1[1];
  const s = (r[0] * -w2[1] - -w2[0] * r[1]) / det, O = at(at(X, n1, g), w1, s);
  const segs: ProfileSegmentInput[] = [{ kind: 'line', start: T1 }, { kind: 'line', start: at(T1, n1, g) }, { kind: 'line', start: O }, { kind: 'line', start: at(T2, n2, g) }];
  if (kind === 'chamfer') return [...segs, { kind: 'line', start: T2 }];
  // The arc from T2 back to T1 about the centre, on the side of X.
  const bis = ((): XY => { const v: XY = [w1[0] + w2[0], w1[1] + w2[1]], l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l]; })();
  const C = at(X, bis, size / Math.sin(alpha / 2)), ang = (p: XY) => Math.atan2(p[1] - C[1], p[0] - C[0]), TAU = 2 * Math.PI;
  const sweep = ((ang(T1) - ang(T2)) % TAU + TAU) % TAU, mid = ((ang(X) - ang(T2)) % TAU + TAU) % TAU;
  return [...segs, { kind: 'arc', start: T2, center: C, direction: mid < sweep ? 'ccw' : 'cw' }];
}
const convexAt = (sides: { n: Point; w: Point }[]) => dot(sides[1].w, sides[0].n) < 0;
const finishSize = (sides: { w: Point }[], size: number, kind: EdgeFinishKind) => {
  const alpha = Math.acos(Math.max(-1, Math.min(1, dot(sides[0].w, sides[1].w))));
  return kind === 'fillet' ? size / Math.tan(alpha / 2) : size;
};
/**
 * Tool faces: the finishing surface is `${id}.face`, the rest (outside the body, or inside it) `${id}.tool`.
 * The finishing face is the one through `marker` (a point of the fillet arc or chamfer line), or with no
 * marker the one that is neither a plane nor a cylinder (a revolved fillet or chamfer).
 */
function named(tool: Brep, id: string, marker: Point | null): Brep {
  const off = (f: Brep['faces'][number]) => {
    const g = faceGeometry(f);
    if (!marker) return g.kind === 'other' ? 0 : Infinity;
    if (g.kind === 'plane') return Math.abs(dot(g.n, sub(marker, g.o)));
    if (g.kind === 'cylinder') { const d = sub(marker, g.c); return Math.abs(len(sub(d, scale(g.a, dot(d, g.a)))) - g.r); }
    return Infinity;
  };
  const d = tool.faces.map(off), least = Math.min(...d), size = Math.max(1, ...tool.vertices.flatMap(v => v.point.map(Math.abs)));
  // (A full turn is two halves: both are the finishing surface.)
  return { ...tool, faces: tool.faces.map((f, i) => ({ ...f, name: d[i] <= least + 1e-9 * size ? `${id}.face` : `${id}.tool` })) };
}

function straightTool(e: Brep['edges'][number], uses: Use[], P: Point, Q: Point, reach: number[], size: number, kind: EdgeFinishKind, id: string): { brep: Brep; convex: boolean } {
  const along = unit(sub(Q, P)), sides = intoFaces(e, uses, P, along), L = len(sub(Q, P));
  if (dot(sides[0].w, sides[1].w) < -1 + 1e-9) refuse('SELECTION', `edge ${e.name}: its faces meet tangentially; there is no corner to finish`);
  if (!uses.every(u => u.geometry.kind === 'plane')) refuse('CAPABILITY', `edge ${e.name}: straight edges can be finished between two planes only (yet)`);
  const u = sides[0].w, v = unit(sub(sides[1].w, scale(u, dot(sides[1].w, u)))), z = cross(u, v);
  const to2 = (w: Point): XY => [dot(w, u), dot(w, v)];
  const t = finishSize(sides, size, kind), g = Math.max(t, size) * 0.5;
  const profile = cornerProfile([0, 0], to2(sides[0].w), to2(sides[1].w), size, kind, g, e.name ?? e.id);
  // The section's extent past each end: enough to clear a cap face leaning back over the tool.
  const extent = (t + 2 * g) * 2, zq = dot(sub(Q, P), z), ext0 = reach[0] * extent, ext1 = reach[1] * extent;
  const [z0, z1] = zq > 0 ? [-ext0, L + ext1] : [-L - ext1, ext0];
  const prism = brepFromPrismatic(prismaticFromProfile({ outer: profile, heightMM: z1 - z0, fromMM: z0, tag: `${id}_t` }), { id: `${id}_t` });
  const tool = transformBrep(prism, { matrix: [u[0], v[0], z[0], u[1], v[1], z[1], u[2], v[2], z[2]], offset: [P[0], P[1], P[2]] });
  // A point of the finishing surface: on the bisector, between the corner and the fillet's centre.
  const alpha = Math.acos(Math.max(-1, Math.min(1, dot(sides[0].w, sides[1].w)))), bis = unit(add(sides[0].w, sides[1].w));
  const depth = kind === 'fillet' ? size / Math.sin(alpha / 2) - size : t * Math.cos(alpha / 2);
  const marker = add(add(P, scale(along, L / 2)), scale(bis, depth));
  return { brep: named(tool, id, marker), convex: convexAt(sides) };
}

function arcTool(e: Brep['edges'][number], uses: Use[], P: Point, Q: Point, reach: number[], size: number, kind: EdgeFinishKind, id: string, tol: number): { brep: Brep; convex: boolean } {
  const circle = circleOf(e.curve);
  const plane = uses.find(u => u.geometry.kind === 'plane'), wall = uses.find(u => u.geometry.kind === 'cylinder');
  if (!circle || !plane || !wall) refuse('CAPABILITY', `edge ${e.name}: curved edges can be finished where a plane meets a cylinder only (yet)`);
  const cyl = wall!.geometry as Extract<FaceGeometry, { kind: 'cylinder' }>, pl = plane!.geometry as Extract<FaceGeometry, { kind: 'plane' }>;
  if (Math.abs(Math.abs(dot(cyl.a, pl.n)) - 1) > 1e-9 || Math.abs(circle!.r - cyl.r) > 1e3 * tol) refuse('CAPABILITY', `edge ${e.name}: the cylinder must stand square on the plane`);
  // The circle's centre on the axis; the radial direction at the start; the axis oriented so that
  // radial × axis is the edge's direction of travel there (the revolve's frame is right-handed).
  const centre = add(cyl.c, scale(cyl.a, dot(sub(P, cyl.c), cyl.a))), radial = (x: Point) => unit(sub(sub(x, centre), scale(cyl.a, dot(sub(x, centre), cyl.a))));
  const [t0, t1] = curveDomain(e.curve), travel = unit(sub(evaluateCurve(e.curve, t0 + 1e-6 * (t1 - t0)), P));
  const er0 = radial(P), axis = dot(cross(er0, cyl.a), travel) > 0 ? cyl.a : scale(cyl.a, -1), et0 = cross(er0, axis);
  const angleOf = (x: Point) => { const r = radial(x); return ((Math.atan2(dot(r, et0), dot(r, er0)) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); };
  const closed = len(sub(Q, P)) <= tol;
  let sweep = closed ? 2 * Math.PI : angleOf(Q);
  if (!closed && sweep <= 1e-12) sweep = 2 * Math.PI;
  const sides = intoFaces(e, uses, P, travel), R = len(sub(sub(P, centre), scale(axis, dot(sub(P, centre), axis))));
  const to2 = (w: Point): XY => [dot(w, er0), dot(w, axis)];
  const t = finishSize(sides, size, kind);
  // Grown outside the corner, but never across the axis.
  let g = Math.max(t, size) * 0.5;
  const w1 = to2(sides[0].w), w2 = to2(sides[1].w);
  let profile = cornerProfile([R, 0], w1, w2, size, kind, g, e.name ?? e.id);
  const minRho = (p: ProfileSegmentInput[]) => Math.min(...p.map(s => s.start[0]));
  for (let k = 0; k < 8 && minRho(profile) < -1e-9 * R; k++) { g /= 2; profile = cornerProfile([R, 0], w1, w2, size, kind, g, e.name ?? e.id); }
  const tip = Math.min(...[w1, w2].map(w => R + w[0] * t));
  if (tip < 1e-9 * R) refuse('PARAMETER', `edge ${e.name}: a ${kind} of ${size} mm does not fit inside a circle of radius ${+R.toFixed(6)} mm (a full round, as large as the circle, is not supported yet)`);
  if (minRho(profile) < -1e-9 * R) refuse('PARAMETER', `edge ${e.name}: the ${kind} reaches the axis`);
  // Snap points within rounding of the axis onto it (a fillet as large as the boss: a sphere zone).
  profile = profile.map(s => ({ ...s, start: [Math.abs(s.start[0]) <= 1e-9 * R ? 0 : s.start[0], s.start[1]] as XY, ...(s.kind === 'arc' ? { center: [Math.abs(s.center[0]) <= 1e-9 * R ? 0 : s.center[0], s.center[1]] as XY } : {}) })) as ProfileSegmentInput[];
  // Past the ends: by angle, as for a straight edge.
  const extent = (t + 2 * g) * 2 / R, back = closed ? 0 : reach[0] * extent, on = closed ? 0 : reach[1] * extent;
  const total = Math.min(2 * Math.PI, sweep + back + on), start = total >= 2 * Math.PI ? 0 : back;
  const c0 = Math.cos(-start), s0 = Math.sin(-start), erS = add(scale(er0, c0), scale(et0, s0)), etS = cross(erS, axis);
  const turned = revolveProfile({ id: `${id}_t`, profile, axis: { origin: [0, 0], direction: [0, 1] }, angleDegrees: total * 180 / Math.PI });
  const tool = transformBrep(turned, { matrix: [erS[0], axis[0], etS[0], erS[1], axis[1], etS[1], erS[2], axis[2], etS[2]], offset: [centre[0], centre[1], centre[2]] });
  return { brep: named(tool, id, null), convex: convexAt(sides) };
}
