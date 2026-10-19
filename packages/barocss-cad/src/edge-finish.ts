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
//   translational    (R10.1, fillets) straight edges between planes along the edge and cylinders whose axis
//                    runs along it (a rod on a plate, a groove's rim): the section solved with circles
//                    (fillet-section.ts) and extruded
//   coaxial          (R10.1, fillets) circular edges between surfaces of revolution about the circle's axis
//                    (planes square to it, cylinders, cones, spheres, tori): the meridian solved and revolved
//   chain ends       where the body ends beyond the edge (every other face there faces onward), the
//                    tool runs past the end and the Boolean trims it; elsewhere it stops at the vertex
//
// Two finished edges meeting at a corner meet in their mitre (the intersection of the two surfaces);
// other edges are refused with a typed reason (TANGENT_FACES, RADIUS_EXCEEDS_FACE, RADIUS_EXCEEDS_CURVATURE,
// NOT_ANALYTIC_PAIR). Every finish must fit on its faces: its contact at most each face's true reach across
// the edge, the least over the edge's length (D88; it replaced the farthest control point, an upper bound).
import { BrepError, buildBrep, lineCurve, type Brep } from './brep-core.js';
import { booleanAnalytic, faceGeometry, type FaceGeometry } from './analytic-boolean.js';
import { brepFromPrismatic, nameEdges, prismaticFromProfile } from './prismatic-solid.js';
import { revolveProfile } from './revolve.js';
import { transformBrep } from './brep-transform.js';
import { circleOf } from './brep-tessellate.js';
import { curveDomain, evaluateCurve, evaluateSurface, surfaceDomain } from './math.js';
import { revolutionOf, type Revolution } from './surface-revolution.js';
import { acrossOf, filletSection, refuseFillet, type SectionSide } from './fillet-section.js';
import { contactFacesOf, invertOn, normalOn, ringFillet, sheetOf, type CornerInput, type EndPlane, type FilletReport } from './rolling-ball.js';
import { add, cross, dot, len, scale, sub, unit } from './vec3.js';
import { linearToleranceMM } from './numeric-policy.js';
import type { Curve, Point, Surface } from './types.js';
import type { ProfileSegmentInput } from './extruded-profile-solid.js';

type XY = [number, number];
export type EdgeFinishKind = 'fillet' | 'chamfer';
const refuse = (code: 'SELECTION' | 'CAPABILITY' | 'PARAMETER', detail: string): never => { throw new BrepError(code === 'PARAMETER' ? 'INPUT' : 'GEOMETRY', `${code}: ${detail}`); };

/** A face's geometry: a plane or cylinder (FaceGeometry), or another surface of revolution (its outward side `sign`). */
type Geo = FaceGeometry | { kind: 'revolution'; R: Revolution; sign: number };
interface Use { face: Brep['faces'][number]; geometry: Geo; sense: 'forward' | 'reversed' }

/**
 * Fillets (radius) or chamfers (distance) the named edges of `body` and the edges continuing them
 * tangentially. Tool faces are named `${id}.face` (the fillet or chamfer surface).
 */
export function finishBrepEdges(body: Brep, names: readonly string[], size: number, kind: EdgeFinishKind, id: string, options: FinishOptions = {}): Brep {
  // (Where a closed-form tool cut at a cylinder its end runs across — R10.3c — leaves the analytic Boolean a result it
  // cannot close, the finish is made again with those ends stopped at their vertices, as before R10.3c, D94.)
  if (options.squareAtCylinders) return finishEdges(body, names, size, kind, id, options);
  const used = { cylinder: false };
  try { return finishEdges(body, names, size, kind, id, options, used); }
  catch (cause) {
    if (!(cause instanceof BrepError) || !used.cylinder) throw cause;
    return finishEdges(body, names, size, kind, id, { ...options, squareAtCylinders: true });
  }
}
interface FinishOptions { readonly reports?: FilletReport[]; readonly general?: boolean; readonly phased?: boolean; readonly squareAtCylinders?: boolean }
function finishEdges(body: Brep, names: readonly string[], size: number, kind: EdgeFinishKind, id: string, options: FinishOptions, used: { cylinder: boolean } = { cylinder: false }): Brep {
  let usedCylinder = false;
  try {
  // (`general`: every closed loop by the rolling ball, even where a closed form exists — to check one against the other.)
  const reports = options.reports;
  let scaleMM = 1; for (const v of body.vertices) for (const x of v.point) scaleMM = Math.max(scaleMM, Math.abs(x));
  const tol = 1e-9 * scaleMM;
  const faces = new Map(body.faces.map(f => [f.id, f])), loopFace = new Map(body.loops.map(l => [l.id, l.face]));
  const usesOf = new Map<string, Use[]>(), geometry = new Map<string, Geo>();
  const geom = (fid: string) => { let g = geometry.get(fid); if (!g) { g = geoOf(faces.get(fid)!, scaleMM); geometry.set(fid, g); } return g; };
  for (const c of body.coedges) { const f = faces.get(loopFace.get(c.loop)!)!; usesOf.set(c.edge, [...(usesOf.get(c.edge) ?? []), { face: f, geometry: geom(f.id), sense: c.sense }]); }
  const atVertex = new Map<string, Brep['edges'][number][]>();
  for (const e of body.edges) for (const v of new Set(e.vertices)) atVertex.set(v, [...(atVertex.get(v) ?? []), e]);
  const byName = new Map(body.edges.map(e => [e.name, e]));
  // (Where the body's faces on a cylinder meet each other: the straight edges along its axis between two of them, as
  // vectors from its axis, D94.)
  const seamsOf = (g: Extract<FaceGeometry, { kind: 'cylinder' }>): Point[] => {
    const a = unit(g.a), on = (f: string) => { const h = geom(f); return h.kind === 'cylinder' && len(cross(unit(h.a), a)) < 1e-9 && Math.abs(h.r - g.r) < 1e3 * tol && len(cross(sub(h.c, g.c), a)) < 1e3 * tol; };
    const out: Point[] = [];
    for (const e of body.edges) {
      const fs = facesOf(e); if (fs.length !== 2 || !fs.every(on)) continue;
      const p = e.curve.controlPoints, d = sub(p[p.length - 1], p[0]);
      if (e.curve.degree !== 1 || len(cross(unit(d), a)) > 1e-9) continue;
      const q = sub(p[0], g.c); out.push(sub(q, scale(a, dot(q, a))));
    }
    return out;
  };

  // Ends and end tangents (pointing away from the vertex, along the edge).
  const ends = (e: Brep['edges'][number]) => {
    const [t0, t1] = curveDomain(e.curve), h = 1e-6 * (t1 - t0);
    const p = evaluateCurve(e.curve, t0), q = evaluateCurve(e.curve, t1);
    return [{ v: e.vertices[0], x: p, out: unit(sub(evaluateCurve(e.curve, t0 + h), p)) }, { v: e.vertices[1], x: q, out: unit(sub(evaluateCurve(e.curve, t1 - h), q)) }];
  };
  const facesOf = (e: Brep['edges'][number]) => (usesOf.get(e.id) ?? []).map(u => u.face.id);

  // Tangent chains: at a vertex, an edge sharing a face and leaving in the opposite direction continues it; a
  // curved edge also continues across a seam between halves of its faces (R10.1: a revolve's rim, whose halves
  // share no face) when the faces there have the same normals.
  const chain = new Map<string, Brep['edges'][number]>();
  const normalsAt = (e: Brep['edges'][number], x: Point) => (usesOf.get(e.id) ?? []).map(u => normalOf(u.geometry, x));
  const sameSection = (e: Brep['edges'][number], o: Brep['edges'][number], x: Point) => {
    if (e.curve.degree === 1 || o.curve.degree === 1) return false;
    const a = normalsAt(e, x), b = normalsAt(o, x);
    return a.length === 2 && b.length === 2 && [...a, ...b].every(n => n) && b.every(n => a.some(m => len(sub(m!, n!)) < 1e-9));
  };
  for (const name of names) {
    const e = byName.get(name);
    if (!e) refuse('SELECTION', `no edge named ${name}; edges: ${body.edges.slice(0, 12).map(x => x.name).join(', ')}${body.edges.length > 12 ? ', …' : ''}`);
    chain.set(e!.id, e!);
  }
  // (Not onto a smooth edge — its faces tangent there, a seam or a split of one surface: there is no corner to go on.)
  const smoothAt = (o: Brep['edges'][number], x: Point) => { const ns = (usesOf.get(o.id) ?? []).map(u => normalOf(u.geometry, x) ?? sheetNormal(u.face, x)); return ns.length === 2 && len(sub(ns[0], ns[1])) < 1e-9; };
  const continues = (e: Brep['edges'][number], end: { v: string; x: Point; out: Point }) => (atVertex.get(end.v) ?? []).filter(o => {
    if (o.id === e.id || !(facesOf(o).some(f => facesOf(e).includes(f)) || sameSection(e, o, end.x)) || smoothAt(o, end.x)) return false;
    return ends(o).some(oe => oe.v === end.v && dot(oe.out, end.out) <= -1 + 1e-9);
  });
  for (const queue = [...chain.values()]; queue.length;) {
    const e = queue.pop()!;
    for (const end of ends(e)) for (const o of continues(e, end)) if (!chain.has(o.id)) { chain.set(o.id, o); queue.push(o); }
  }

  // R10.3b (D93): a corner where three finished edges meet the two ways round — a boss's upright edge and its foot, an
  // L-plate's inner upright edge and its top — is blended in two passes: the odd one out first (rounding the boss's
  // upright edge down to the plate), then the others, which now run tangentially round the first's round (the foot round
  // the rounded corner: R10.1's or the rolling ball's). More edges at a corner, or an edge odd at one corner and not at
  // another, are refused.
  if (kind === 'fillet' && !options.phased) {
    const convexOf = new Map<string, boolean>(), convex = (e: Brep['edges'][number]) => {
      let c = convexOf.get(e.id);
      if (c === undefined) { const [E0] = ends(e); c = convexAt((usesOf.get(e.id) ?? []).map(u => { const n = sheetNormal(u.face, E0.x); return { n, w: unit(cross(n, u.sense === 'forward' ? E0.out : scale(E0.out, -1))) }; })); convexOf.set(e.id, c); }
      return c;
    };
    const first = new Set<string>(), later = new Set<string>();
    for (const [v, incident] of atVertex) {
      const here = [...new Set(incident.filter(e => chain.has(e.id)))];
      if (here.length < 3) continue;
      const cs = here.map(convex), nConvex = cs.filter(c => c).length;
      if (nConvex === 0 || nConvex === here.length) continue;
      const where = body.vertices.find(x => x.id === v)!.point.map(x => +x.toFixed(3)).join(', ');
      if (here.length > 3) refuse('CAPABILITY', `[VERTEX_BLEND_UNSUPPORTED] ${here.length} finished edges meet at (${where}), the two ways round; blending more than three there is not supported yet`);
      const odd = nConvex === 1 ? cs.indexOf(true) : cs.indexOf(false);
      here.forEach((e, k) => (k === odd ? first : later).add(e.id));
    }
    if (first.size) {
      for (const x of first) if (later.has(x)) refuse('CAPABILITY', `[VERTEX_BLEND_UNSUPPORTED] edge ${body.edges.find(e => e.id === x)!.name} is the odd one out at one corner and not at another; blending those corners is not supported yet`);
      const pass1 = finishBrepEdges(body, [...first].map(x => { const e = body.edges.find(q => q.id === x)!; return e.name ?? e.id; }), size, kind, id, { ...options, phased: true });
      // (The rest by their faces: an edge keeps the names of the faces it joins; the first pass may have cut it shorter or
      // in pieces, and the edges round its round continue it.)
      const pairOfNames = (n: string) => n.split('|').map(x => x.replace(/#\d+$/, '')).sort().join('|');
      const rest = new Set([...chain.values()].filter(e => !first.has(e.id)).map(e => pairOfNames(e.name ?? e.id)));
      const names2 = pass1.edges.filter(e => rest.has(pairOfNames(e.name ?? e.id))).map(e => e.name ?? e.id);
      if (!names2.length) return pass1;
      return finishBrepEdges(pass1, names2, size, kind, id, { ...options, phased: true });
    }
  }

  // Arcs covering a whole circle between the same plane and cylinder make one closed tool (the first of
  // them stands for the rest).
  const skip = new Set<string>(), closedCircle = new Set<string>();
  const circleKey = (e: Brep['edges'][number]) => {
    const k = circleOf(e.curve), us = usesOf.get(e.id) ?? [];
    if (!k || e.curve.degree === 1) return null;
    const pl = us.find(u => u.geometry.kind === 'plane')?.geometry as Extract<FaceGeometry, { kind: 'plane' }> | undefined;
    const cy = us.find(u => u.geometry.kind === 'cylinder')?.geometry as Extract<FaceGeometry, { kind: 'cylinder' }> | undefined;
    const r = (x: number) => Math.round(x / (1e3 * tol));
    if (pl && cy) return [...k.c.map(r), r(k.r), r(dot(pl.n, pl.o)), ...pl.n.map(x => Math.round(x * 1e9)), r(cy.r)].join(',');
    // (R10.1, coaxial: the pieces of one circle between the halves of two surfaces of revolution — the same
    // section at every point of it, into each face and out of it, about the circle's axis.)
    if (us.length !== 2 || us.some(u => u.geometry.kind === 'other')) return null;
    const [E0] = ends(e), axis0 = unit(cross(k.e1, k.e2)), a = axis0.find(x => Math.abs(x) > 1e-9)! > 0 ? axis0 : scale(axis0, -1);
    const radial = unit(sub(E0.x, k.c)), q = (x: number) => Math.round(x * 1e9);
    const sides = intoFaces(e, us, E0.x, E0.out).map(x => [dot(x.w, radial), dot(x.w, a), dot(x.n, radial), dot(x.n, a)].map(q).join(':')).sort();
    return ['coaxial', ...k.c.map(r), r(k.r), ...a.map(q), ...sides].join(',');
  };
  const groups = new Map<string, Brep['edges'][number][]>();
  if (!options.general) for (const e of chain.values()) { const key = circleKey(e); if (key) groups.set(key, [...(groups.get(key) ?? []), e]); }
  for (const list of groups.values()) {
    const total = list.reduce((acc, e) => { const k = circleOf(e.curve)!; return acc + k.spans.reduce((a, x) => a + x.phi, 0); }, 0);
    if (Math.abs(total - 2 * Math.PI) <= 1e-9) { closedCircle.add(list[0].id); for (const e of list.slice(1)) skip.add(e.id); }
  }

  const convexTools: Brep[] = [], concaveTools: Brep[] = [], cornerTools: Brep[] = [], concaveCorners: Brep[] = [], handled = new Set<string>(), rings: { brep: Brep; convex: boolean; contactFaces: string[]; sides: string[]; report: FilletReport }[] = [];
  // Corner blends: where three filleted straight edges between three planes meet at a convex vertex,
  // the rolling ball rounds the corner with a sphere about the point r from all three planes. Each
  // edge's tool then stops at the plane through that centre square to the edge (where its cylinder
  // touches the sphere), and a corner tool (the cone from the centre to the vertex, less the ball)
  // fills the corner.
  const trims = new Map<string, number[]>();
  if (kind === 'fillet') for (const [v, incident] of atVertex) {
    const here = incident.filter(e => chain.has(e.id) && !skip.has(e.id));
    if (here.length !== 3 || !here.every(e => e.curve.degree === 1 && e.curve.controlPoints.length === 2)) continue;
    const fids = [...new Set(here.flatMap(facesOf))];
    if (fids.length !== 3 || !fids.every(f => geom(f).kind === 'plane')) continue;
    const V = body.vertices.find(x => x.id === v)!.point;
    // (All convex: the ball inside the material, r in from each plane; all concave — a pocket's corner, R10.3b, D93 — in
    // the air, r out from each, its corner tool added. Mixed corners are blended in two passes, below.)
    const convexity = here.map(e => convexAt(intoFaces(e, usesOf.get(e.id)!, ends(e)[0].x, ends(e)[0].out)));
    if (!(convexity.every(c => c) || convexity.every(c => !c))) continue;
    const inward = convexity[0], ns = fids.map(f => (geom(f) as Extract<FaceGeometry, { kind: 'plane' }>).n), C = solve3(ns, ns.map(n => dot(n, V) + (inward ? -size : size)));
    if (!C) continue;
    const outs = here.map(e => ends(e).find(x => x.v === v)!.out), setbacks = outs.map(d => dot(sub(C, V), d));
    here.forEach((e, k) => {
      const L = len(sub(ends(e)[1].x, ends(e)[0].x));
      if (!(setbacks[k] > 0) || setbacks[k] >= L) refuse('PARAMETER', `edge ${e.name}: a fillet of ${size} mm does not fit (the corner needs ${+setbacks[k].toFixed(6)} mm of a ${+L.toFixed(6)} mm edge)`);
      const t = trims.get(e.id) ?? [0, 0]; t[ends(e)[0].v === v ? 0 : 1] = setbacks[k]; trims.set(e.id, t);
    });
    // (Added, a concave corner's tool is kept within g of the air side of each face: its cone reaches well past V, and
    // past a wall thinner than that it would add material outside the body.)
    let ct = cornerTool(V, C, outs, size, id);
    if (!inward) for (const n of ns) ct = booleanAnalytic(ct, halfSpace(sub(V, scale(n, size / 2)), scale(n, -1), 8 * (len(sub(V, C)) + size), `${id}_k`), 'difference', { id: `${id}_c` });
    (inward ? cornerTools : concaveCorners).push(ct);
  }
  // Corner blends at both ends of one edge must leave some of it between them.
  for (const [eid, [t0, t1]] of trims) {
    const e = body.edges.find(x => x.id === eid)!, [E0, E1] = ends(e), L = len(sub(E1.x, E0.x));
    if (t0 + t1 >= L - tol) refuse('PARAMETER', `edge ${e.name}: a fillet of ${size} mm is too large (the corners at its ends need ${+(t0 + t1).toFixed(6)} mm of a ${+L.toFixed(6)} mm edge)`);
  }
  // R10.3a (D92): two finished edges meeting at an inside corner of the face they share, where the edge between their
  // other faces (not finished) turns the other way to the fillet — convex for a concave fillet (a lug's corner standing
  // on a tube), concave for a convex one: the ball rolls round that edge from one to the other, and they are one chain.
  const cornerOf = new Map<string, CornerJoin>();
  if (kind === 'fillet') for (const e of chain.values()) for (const end of ends(e)) for (const o of atVertex.get(end.v) ?? []) {
    if (o.id === e.id || !chain.has(o.id) || skip.has(o.id) || skip.has(e.id) || cornerOf.has(`${e.id}|${o.id}`)) continue;
    const c = cornerJoin(e, o, end.v, usesOf, atVertex, ends, chain);
    if (c) { cornerOf.set(`${e.id}|${o.id}`, c); cornerOf.set(`${o.id}|${e.id}`, c); }
  }
  // R10.2a (D89): a closed loop of the chain with an edge no closed form finishes gets one rolling-ball tool.
  for (const comp of components([...chain.values()].filter(e => !skip.has(e.id)), (e, o) => ends(e).some(end => continues(e, end).some(x => x.id === o.id)) || cornerOf.has(`${e.id}|${o.id}`))) {
    for (const e of comp) if ((usesOf.get(e.id) ?? []).length !== 2) refuse('SELECTION', `edge ${e.name} does not join exactly two faces`);
    const straightOf = (e: Brep['edges'][number]) => e.curve.degree === 1 && e.curve.controlPoints.length === 2;
    // (A chain rolling round an edge at a corner is the rolling ball's whole, whatever its edges' own classes.)
    const rolls = comp.some(e => comp.some(o => cornerOf.has(`${e.id}|${o.id}`)));
    const general = (options.general || rolls) && kind === 'fillet' && (closedLoop(comp) || openChain(comp)) ? comp : comp.filter(e => !(straightOf(e) && usesOf.get(e.id)!.every(u => u.geometry.kind === 'plane')) && pairOf(e, usesOf.get(e.id)!, straightOf(e), kind, tol, true) === 'general');
    if (!general.length) continue;
    if (kind === 'chamfer') refuse('CAPABILITY', `edge ${general[0].name}: chamfers between general faces are not supported yet`);
    // A closed loop makes a ring; an open chain (R10.2b) a capped tool, run on past an end where the body ends there
    // (a convex finish) or into a wall (a concave one), else stopped at it.
    const loop = closedLoop(comp), open = loop ? null : openChain(comp);
    if (!loop && !open) refuse('CAPABILITY', `edge ${general[0].name}: its chain branches; finishing it there is not supported yet`);
    // (Each joint of the chain carries it on tangentially or rolls round a corner: anything else — a corner where a third
    // finished edge leaves, so no ball rolls round it — is a vertex blend, R10.3b.)
    const seq = (loop ?? open)!;
    for (let k = 0; k < (loop ? seq.length : seq.length - 1); k++) {
      const a = seq[k], b = seq[(k + 1) % seq.length], v = a.reversed ? a.e.vertices[0] : a.e.vertices[1], end = ends(a.e).find(x => x.v === v)!;
      if (!cornerOf.has(`${a.e.id}|${b.e.id}`) && !continues(a.e, end).some(x => x.id === b.e.id)) refuse('CAPABILITY', `[VERTEX_BLEND_UNSUPPORTED] edges ${a.e.name} and ${b.e.name} meet at a corner with another finished edge; blending three there arrives with R10.3b`);
    }
    // Each end runs past: where the body ends there a convex tool's run is trimmed by the Boolean, a concave one's (it
    // would add material beyond the end) is clipped by the end face's plane; into a wall a concave tool's run adds
    // nothing, a convex one's (it would cut the wall) is clipped by the wall's plane. A clip needs one plane there.
    let past: (EndPlane | null)[] = [null, null];
    const clips: EndClip[] = [];
    if (open) {
      const sideFaces = new Set(comp.flatMap(facesOf)), convex0 = convexAt(generalInto(open[0], usesOf, ends));
      past = [0, 1].map(i => {
        const o = open[i === 0 ? 0 : open.length - 1], E = ends(o.e), end = i === 0 ? (o.reversed ? E[1] : E[0]) : (o.reversed ? E[0] : E[1]);
        // Another finished edge at the end: where it shares a face with this one at a convex corner of that face, the
        // same way round (a rounded top's corner, its upright edge left sharp), both run past and the Boolean makes the
        // mitre between them — this one until its section clears the other's own face (R10.3a, D92); a corner of three
        // finished edges is a vertex blend (R10.3b).
        const meet = (atVertex.get(end.v) ?? []).filter(x => !comp.includes(x) && chain.has(x.id));
        if (meet.length) {
          const x = meet[0], shared = facesOf(x).filter(f => facesOf(o.e).includes(f)), ownDir = end === E[0] ? E[0].out : scale(E[1].out, -1);
          const into = usesOf.get(o.e.id)!.map(u => { const nn = sheetNormal(u.face, end.x); return { f: u.face.id, n: nn, w: unit(cross(nn, u.sense === 'forward' ? ownDir : scale(ownDir, -1))) }; });
          const ex = ends(x), xe = ex.find(q => q.v === end.v)!, sw = into.find(q => q.f === shared[0]), xOwn = xe === ex[0] ? xe.out : scale(xe.out, -1);
          const xs = usesOf.get(x.id)!.map(u => { const nn = sheetNormal(u.face, end.x); return { n: nn, w: unit(cross(nn, u.sense === 'forward' ? xOwn : scale(xOwn, -1))) }; });
          const across = facesOf(x).find(f => f !== shared[0]);
          // (Planes only for now: the end edge's faces and the other's own face — a rolling-ball tool mitred with a curved
          // face's tool, an oblique groove's rim meeting the plate's end, leaves the analytic Boolean a sliver.)
          const planar = [...facesOf(o.e), ...(across ? [across] : [])].every(f => geom(f).kind === 'plane');
          if (meet.length > 1 || shared.length !== 1 || !sw || !(dot(xe.out, sw.w) > 1e-6) || convexAt(xs) !== convex0 || !across || !planar) refuse('CAPABILITY', `edge ${o.e.name}: it meets another finished edge at its end; blending them there arrives with R10.3b`);
          const ga = geom(across!);
          return ga.kind === 'plane' ? { o: ga.o, n: ga.n } : { o: end.x, n: normalOf(ga, end.x) ?? sheetNormal(faces.get(across!)!, end.x) };
        }
        // (The end's other faces: not the sides, nor a side's smooth continuation past the end — the same normal there.)
        const nOf = (f: string) => normalOf(geom(f), end.x) ?? sheetNormal(faces.get(f)!, end.x), sideNs = [...sideFaces].filter(f => (atVertex.get(end.v) ?? []).some(x => facesOf(x).includes(f))).map(nOf);
        const others = [...new Set((atVertex.get(end.v) ?? []).flatMap(facesOf).filter(x => !sideFaces.has(x)))].filter(f => !sideNs.some(n => len(sub(n, nOf(f))) < 1e-9));
        let worst = Infinity;
        for (const f of others) worst = Math.min(worst, -dot(nOf(f), end.out));
        if (worst === Infinity) return null;
        const clip = convex0 ? worst <= 1e-6 : worst >= -1e-6;
        if (clip) {
          // (One plane — square to the chain too since R10.3c, D94 — or one cylinder: the tool runs past and is cut by it.)
          const g = others.length === 1 ? geom(others[0]) : null;
          // (A cylinder there — a general fillet ending on a round plate's rim — not yet: the analytic Boolean cutting a
          // lofted tool by a cylinder fails on the cases tried, D94.)
          if (!g || g.kind !== 'plane') refuse('CAPABILITY', `edge ${o.e.name}: its end meets ${others.length === 1 ? 'a curved face' : 'more than one face'}; ending a general fillet there is not supported yet`);
          const pl = g as Extract<FaceGeometry, { kind: 'plane' }>;
          // (An end plane square to the chain: the tool's end section lies in it, partly on the end face and on along a
          // side face's continuation — the analytic Boolean's arrangement fails there on most radii tried, D90, D94.)
          if (Math.abs(dot(pl.n, end.out)) > 1 - 1e-9) refuse('CAPABILITY', `edge ${o.e.name}: the fillet would end square on a face (its last section in that face's plane); that end is not supported yet`);
          clips.push({ kind: 'plane', o: pl.o, n: pl.n });
          return { o: pl.o, n: pl.n };
        }
        // (Run past where the body ends: until the section clears the end — its one plane, or the end face's tangent
        // plane at the vertex.)
        const g = others.length === 1 ? geom(others[0]) : null;
        return g?.kind === 'plane' ? { o: g.o, n: g.n } : { o: end.x, n: nOf(others[0]) };
      });
    }
    const ring = generalRing(body, (loop ?? open)!, usesOf, ends, size, id, scaleMM, !!loop, past, cornerOf);
    for (const c of clips) {
      // The end face's side away from the chain (the fillet lies on the chain's side) is cut from the tool.
      ring.brep = clipTool(ring.brep, c, ring.mid, 4 * scaleMM + 10, 4 * size, id, id);
      ring.contactFaces = contactFacesOf(ring.brep, id);
    }
    rings.push(ring);
    reports?.push(ring.report);
    for (const e of comp) handled.add(e.id);
  }
  for (const e of chain.values()) {
    if (skip.has(e.id) || handled.has(e.id)) continue;
    const uses = usesOf.get(e.id) ?? [];
    if (uses.length !== 2) refuse('SELECTION', `edge ${e.name} does not join exactly two faces`);
    // A convex finish of a straight edge between two planes must fit on both faces: its setback from the
    // edge (the chamfer distance, or r / tan(half the corner angle)) at most each face's true reach across it.
    if (e.curve.degree === 1 && e.curve.controlPoints.length === 2 && uses.every(u => u.geometry.kind === 'plane')) {
      const [E0, E1] = ends(e), sides = intoFaces(e, uses, E0.x, E0.out);
      if (convexAt(sides)) {
        const half = Math.acos(Math.max(-1, Math.min(1, dot(sides[0].w, sides[1].w)))) / 2;
        const back = kind === 'chamfer' ? size : size / Math.tan(half);
        const walls = uses.map((u, k) => planeReach(body, u.face.id, e, E0.x, E1.x, sides[k].w, scaleMM, true));
        if (walls.some(w => back > w + 1e3 * tol)) refuseFillet('RADIUS_EXCEEDS_FACE', `edge ${e.name}: ${kind} ${size} mm is too large for walls of ${+walls[0].toFixed(6)} and ${+walls[1].toFixed(6)} mm`);
      }
    }
    // How far the tool may run past each end: past the end of the body, else not at all. Where another
    // finished edge leaves the same vertex (a corner of a rounded box top), both tools run past it: with
    // one size, removing (or adding) both is exactly the mitre between the two finishes.
    const [E0, E1] = ends(e), sharedCorner = [false, false], blocked = [false, false], endPlanes: (EndClip | null)[] = [null, null], ends1 = [0, 0], endKind: ('ends' | 'wall' | null)[] = [null, null];
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
      // (Not the edge's faces, nor their smooth continuations past the end — the same normal there, D90.)
      const own = uses.map(u => outwardNormal(u.geometry, end.x) ?? normalOf(u.geometry, end.x));
      const others = new Set((atVertex.get(end.v) ?? []).flatMap(facesOf).filter(f => !facesOf(e).includes(f)).filter(f => { const n = outwardNormal(geom(f), end.x); return !n || !own.some(m => m && len(sub(m, n)) < 1e-9); }));
      if (!others.size) return 0;
      let worst = Infinity;
      for (const f of others) { const n = outwardNormal(geom(f), end.x); if (!n) return 0; worst = Math.min(worst, -dot(n, end.out)); }
      // (One plane across the edge there — faces running along it aside — oblique to it: where the tool must stop at
      // it, it runs past and is cut by it, D90.)
      const across = [...others].filter(f => { const n = outwardNormal(geom(f), end.x)!; return Math.abs(dot(n, end.out)) > 1e-9; });
      // (Pieces of one plane — an end face split where something meets it — are that one plane.)
      const planes = across.map(geom), first0 = planes[0];
      const only = first0?.kind === 'plane' && planes.every(g => g.kind === 'plane' && len(sub(g.n, first0.n)) < 1e-9 && Math.abs(dot(sub(g.o, first0.o), first0.n)) < 1e3 * tol) ? first0 : null;
      if (only?.kind === 'plane' && Math.abs(dot(only.n, end.out)) < 1 - 1e-9) {
        const w = -dot(only.n, end.out);
        endPlanes[i] = { kind: 'plane', o: only.o, n: only.n }; ends1[i] = 1 / Math.max(Math.abs(w), 0.25); endKind[i] = w > 1e-6 ? 'ends' : w < -1e-6 ? 'wall' : null;
      }
      // (One cylinder across it — a round plate's rim, a boss's wall: square to the edge or not, it curves away from the
      // vertex, so a square stop would leave a wedge or a step: the tool runs past and is cut by that cylinder, D94.)
      const cyl = across.map(geom), c0 = cyl[0];
      // (Not where the tool's end would lie across a seam of the body's faces on that cylinder — between its two halves:
      // the analytic Boolean then loses a face there; the tool stops at the vertex as before, D94.)
      if (c0?.kind === 'cylinder' && cyl.every(g => g.kind === 'cylinder' && len(sub(g.a, c0.a)) < 1e-9 && Math.abs(g.r - c0.r) < 1e3 * tol && len(cross(sub(g.c, c0.c), c0.a)) < 1e3 * tol)) {
        const w = -dot(outwardNormal(c0, end.x)!, end.out), run = 1 / Math.max(Math.abs(w), 0.25), seams = seamsOf(c0), a = unit(c0.a);
        // (The tool's end on the cylinder spans, about its axis, from the edge to its section's reach into each face:
        // its setback there and its growth, with a margin.)
        const angleOf = (q: Point) => { const d = sub(q, c0.c), r0 = sub(d, scale(a, dot(d, a))); return r0; }, tangent = sub(E1.x, E0.x), sd = intoFaces(e, uses, end.x, len(tangent) > 0 ? unit(tangent) : end.out);
        const halfAngle = Math.acos(Math.max(-1, Math.min(1, dot(sd[0].w, sd[1].w)))) / 2, reachLat = size / Math.max(Math.tan(halfAngle), 1e-3) + size;
        const ref = unit(angleOf(end.x)), side = cross(a, ref), ang = (q: Point) => { const v = angleOf(q); return Math.atan2(dot(v, side), dot(v, ref)); };
        const span = [0, ...sd.flatMap(x => [x.w, x.n, scale(x.n, -1)].map(d => ang(add(end.x, scale(d, reachLat)))))], lo = Math.min(...span) - 0.1 * size / c0.r, hi = Math.max(...span) + 0.1 * size / c0.r;
        const clear = seams.every(q => { const t = ang(add(c0.c, q)); return t < lo || t > hi; });
        if (clear && !options.squareAtCylinders) { usedCylinder = true; endPlanes[i] = { kind: 'cylinder', c: c0.c, a: c0.a, r: c0.r, seams }; ends1[i] = run; endKind[i] = w > 1e-6 ? 'ends' : w < -1e-6 ? 'wall' : null; }
      }
      if (worst > 1e-6) return 1 / Math.max(worst, 0.25); // the body ends there
      if (worst < -1e-6) blocked[i] = true; // a wall faces back along the edge
      return 0;
    });
    // A concave finish adds material: past an end where the body stops it would add it to the air, so
    // it stops there; where the edge runs into a wall it runs on into the wall.
    const convex = convexAt(intoFaces(e, uses, E0.x, E0.out));
    // Stopped at an oblique end face — a concave finish where the body ends, a convex one at a wall — a square stop
    // would leave a wedge (added beyond the end, or left unrounded): it runs past and is cut by that face's plane.
    // (Straight tools: their sections are the same along the edge, so a cut at the plane is the fillet's own end there.)
    const curve = e.curve, straight = curve.degree === 1 && curve.controlPoints.length === 2, pair = pairOf(e, uses, straight, kind, tol);
    const clipAt = [0, 1].map(i => (pair === 'planes' || pair === 'translational') && !sharedCorner[i] && !continues(e, i === 0 ? E0 : E1).some(o => chain.has(o.id)) && endPlanes[i] && endKind[i] === (convex ? 'wall' : 'ends') ? endPlanes[i] : null);
    const run = (convex ? reach : reach.map((_, i) => sharedCorner[i] || blocked[i] ? 1 : 0)).map((x, i) => clipAt[i] ? ends1[i] : x);
    const trim = trims.get(e.id), runs = trim ? run.map((r, i) => trim[i] ? 0 : r) : run;
    const tool = pair === 'planes' ? straightTool(e, uses, E0.x, E1.x, runs, size, kind, id, trim)
      : pair === 'translational' ? translationalTool(body, e, uses, E0.x, E1.x, runs, size, id, scaleMM)
      : pair === 'plane-cylinder' ? arcTool(body, e, uses, E0.x, closedCircle.has(e.id) ? E0.x : E1.x, run, size, kind, id, tol, scaleMM)
      : coaxialTool(body, e, uses, E0.x, closedCircle.has(e.id) ? E0.x : E1.x, run, size, id, tol, scaleMM);
    for (const [i, pl] of clipAt.entries()) if (pl && !(trim && trim[i])) {
      const end = i === 0 ? E0 : E1, kept = add(end.x, scale(end.out, 1e-3 * len(sub(E1.x, E0.x))));
      tool.brep = clipTool(tool.brep, pl.kind === 'plane' ? { kind: 'plane', o: end.x, n: pl.n } : pl, kept, 4 * scaleMM + 10, ends1[i] * 4 * size, id, `${id}_t`, { x: end.x, out: end.out, back: Math.min(0.45 * len(sub(E1.x, E0.x)), 4 * size) });
    }
    (tool.convex ? convexTools : concaveTools).push(tool.brep);
  }
  // Tools apart from the others (touching at most along lines: a corner blend's trimmed tools) are applied
  // together, as one B-rep of several bodies; those sharing a face or volume with another (a tangent
  // chain's pieces, mitred tools) one by one, else joined by Booleans; the corner tools (apart from each
  // other) after them.
  let out = body;
  const apply = (tools: Brep[], op: 'difference' | 'union') => {
    if (!tools.length) return;
    const groups = touchingGroups(tools), apart = groups.filter(g => g.length === 1).map(g => g[0]), was = out;
    if (!groups.some(g => g.length > 1)) { out = booleanAnalytic(out, combine(apart, id), op, { id }); return; }
    // Overlapping tools each on its own (cheaper than joining them first, the result the same); where
    // that fails (a step meets the last along an edge, a drafted wall), joined first as before.
    try {
      if (apart.length) out = booleanAnalytic(out, combine(apart, id), op, { id });
      for (const g of groups) if (g.length > 1) for (const t of g) out = booleanAnalytic(out, t, op, { id });
      out = renumbered(out, id);
    } catch (cause) {
      if (!(cause instanceof BrepError)) throw cause;
      out = booleanAnalytic(was, combine(groups.map(g => g.length === 1 ? g[0] : g.reduce((acc, t) => booleanAnalytic(acc, t, 'union', { id: `${id}_tools` }))), id), op, { id });
    }
  };
  // The rolling-ball tools first, each on its own: its contact faces meet the body along their contacts only.
  // (A result in more bodies than the part had: the fillet ran off its faces near an end and cut a piece free — it would
  // have rolled onto the face there, R10.4: refused, D90.)
  for (const ring of rings) {
    const was = out.bodies.length;
    out = booleanAnalytic(out, ring.brep, ring.convex ? 'difference' : 'union', { id, contactFaces: ring.contactFaces, contactWith: ring.sides });
    if (out.bodies.length > was) refuseFillet('CONTACT_LEAVES_FACE', `edge ${ring.report.edges[0]}: a fillet of ${size} mm runs off its faces near its end and cuts a piece free; rolling over the next face arrives with R10.4`);
  }
  apply(convexTools, 'difference');
  apply(cornerTools, 'difference');
  apply(concaveTools, 'union');
  apply(concaveCorners, 'union');
  return out;
  } finally { if (usedCylinder) used.cylinder = true; }
}

type Edge = Brep['edges'][number];
type Ends = (e: Edge) => { v: string; x: Point; out: Point }[];
/** The chain's edges in groups joined where one continues another (tangentially, at a vertex they share). */
function components(edges: readonly Edge[], joins: (e: Edge, o: Edge) => boolean): Edge[][] {
  const root = edges.map((_, i) => i), find = (x: number): number => root[x] === x ? x : (root[x] = find(root[x]));
  const at = new Map<string, number[]>();
  edges.forEach((e, i) => { for (const v of new Set(e.vertices)) at.set(v, [...(at.get(v) ?? []), i]); });
  for (const list of at.values()) for (const i of list) for (const j of list) if (i < j && (joins(edges[i], edges[j]) || joins(edges[j], edges[i]))) root[find(i)] = find(j);
  const groups = new Map<number, Edge[]>(); edges.forEach((e, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), e]));
  return [...groups.values()];
}
/** A group of edges as one open chain from one end to the other, in order (each with whether it runs backwards), or null. */
function openChain(comp: readonly Edge[]): { e: Edge; reversed: boolean }[] | null {
  const at = new Map<string, Edge[]>();
  for (const e of comp) for (const v of e.vertices) at.set(v, [...(at.get(v) ?? []), e]);
  const tips = [...at.entries()].filter(([, l]) => l.length === 1).map(([v]) => v);
  if (tips.length !== 2 || [...at.values()].some(l => l.length > 2)) return null;
  const out: { e: Edge; reversed: boolean }[] = [], seen = new Set<string>();
  for (let v = tips[0]; ;) {
    const next = at.get(v)!.find(o => !seen.has(o.id));
    if (!next) break;
    const reversed = next.vertices[1] === v && next.vertices[0] !== v;
    out.push({ e: next, reversed }); seen.add(next.id); v = reversed ? next.vertices[0] : next.vertices[1];
  }
  return out.length === comp.length ? out : null;
}
/** The half-space beyond the plane through o (outward n) as a box of side `size`, its face on the plane. */
/** Where an end face cuts a tool that runs past it (D90, D94): a plane, or a cylinder (its axis point, unit axis, radius). */
type EndClip = { readonly kind: 'plane'; readonly o: Point; readonly n: Point } | { readonly kind: 'cylinder'; readonly c: Point; readonly a: Point; readonly r: number; readonly seams: readonly Point[] };
/**
 * The tool less the end face's side away from `kept` (a point on the fillet's side): beyond a plane, or — keeping
 * `kept`'s side of a cylinder — inside or outside it. Kept outside a cylinder (a hole's wall, a boss's), the tool's run
 * past must not reach across it: refused when the cylinder is narrower than twice the run.
 */
function clipTool(tool: Brep, clip: EndClip, kept: Point, size: number, run: number, id: string, opId: string, end?: { x: Point; out: Point; back: number }): Brep {
  if (clip.kind === 'plane') {
    const away = dot(clip.n, sub(kept, clip.o)) < 0 ? clip.n : scale(clip.n, -1);
    return booleanAnalytic(tool, halfSpace(clip.o, away, size, `${id}_clip`), 'difference', { id: opId });
  }
  const a = unit(clip.a), d = sub(kept, clip.c), inside = len(sub(d, scale(a, dot(d, a)))) < clip.r;
  if (!inside && 2 * clip.r < 2 * run) refuse('CAPABILITY', `the fillet ends at a cylinder of radius ${+clip.r.toFixed(6)} mm, too narrow for its end to run past and be cut there; that end is not supported yet`);
  // (Its faces split where the body's faces on that cylinder are — at their seams — so the pieces the tool lays on the
  // body's cylinder match the body's own, not straddle a seam of it.)
  const e1 = clip.seams.length ? unit(sub(clip.seams[0], scale(a, dot(clip.seams[0], a)))) : unit(Math.abs(a[0]) < 0.9 ? cross([1, 0, 0], a) : cross([0, 1, 0], a)), e2 = cross(a, e1), dc = dot(sub(kept, clip.c), a);
  const angles = [...new Set(clip.seams.map(q => { const x = Math.atan2(dot(q, e2), dot(q, e1)); return Math.round(((x % TAU) + TAU) % TAU * 1e12) / 1e12; }))].sort((p, q) => p - q);
  if (!angles.length) angles.push(0);
  const outer = angles.map(t => ({ kind: 'arc' as const, start: [clip.r * Math.cos(t), clip.r * Math.sin(t)] as XY, center: [0, 0] as XY, direction: 'ccw' as const }));
  const prism = brepFromPrismatic(prismaticFromProfile({ outer, heightMM: size, fromMM: 0, tag: `${id}_cyl` }), { id: `${id}_cyl` });
  const cyl = transformBrep(prism, { matrix: [e1[0], e2[0], a[0], e1[1], e2[1], a[1], e1[2], e2[2], a[2]], offset: add(clip.c, scale(a, dc - size / 2)) as Point });
  // (Only near this end: beyond a plane `back` in from it along the edge, the cylinder's far side — a whole-tool cut would
  // trim the tool's other end too, where it may lie across a seam of the body's faces.)
  if (!end) return booleanAnalytic(tool, cyl, inside ? 'intersection' : 'difference', { id: opId });
  const beyond = halfSpace(add(end.x, scale(end.out, end.back)), scale(end.out, -1), size, `${id}_near`);
  const remove = booleanAnalytic(beyond, cyl, inside ? 'difference' : 'intersection', { id: `${id}_rm` });
  return booleanAnalytic(tool, remove, 'difference', { id: opId });
}
function halfSpace(o: Point, n: Point, size: number, id: string): Brep {
  const m = unit(n), e1 = unit(Math.abs(m[0]) < 0.9 ? cross([1, 0, 0], m) : cross([0, 1, 0], m)), e2 = cross(m, e1), h = size / 2;
  const prism = brepFromPrismatic(prismaticFromProfile({ outer: [{ kind: 'line', start: [-h, -h] }, { kind: 'line', start: [h, -h] }, { kind: 'line', start: [h, h] }, { kind: 'line', start: [-h, h] }], heightMM: size, fromMM: 0, tag: id }), { id });
  return transformBrep(prism, { matrix: [e1[0], e2[0], m[0], e1[1], e2[1], m[1], e1[2], e2[2], m[2]], offset: [o[0], o[1], o[2]] });
}
/** A face's outward normal at x from its surface (any face). */
function sheetNormal(f: Brep['faces'][number], x: Point): Point { const s = sheetOf(f.surface as Surface, f.sense); return normalOn(s, ...invertOn(s, x)); }
/** Into the two faces at a chain piece's start (its own direction turned by each coedge's sense). */
function generalInto(first: { e: Edge; reversed: boolean }, usesOf: Map<string, Use[]>, ends: Ends): { n: Point; w: Point }[] {
  const [E0, E1] = ends(first.e), X0 = first.reversed ? E1.x : E0.x, own = first.reversed ? scale(E1.out, -1) : E0.out;
  return usesOf.get(first.e.id)!.map(u => { const n = sheetNormal(u.face, X0); return { n, w: unit(cross(n, u.sense === 'forward' ? own : scale(own, -1))) }; });
}
/** Two finished edges meeting at an inside corner of their shared face, the ball rolling round `edge` between their other faces. */
interface CornerJoin { readonly e: string; readonly shared: string; readonly edge: Edge; readonly before: string; readonly next: string }
/**
 * Whether e and o (finished, meeting at v) join round a corner (R10.3a, D92): one face shared, their other faces meeting
 * at v along an edge not finished, the corner inside the shared face (o leaves v into the side of e away from that face)
 * and that edge turning the other way to the fillet. `before` is e's other face, `next` o's.
 */
function cornerJoin(e: Edge, o: Edge, v: string, usesOf: Map<string, Use[]>, atVertex: Map<string, Edge[]>, ends: Ends, chain: ReadonlyMap<string, Edge>): CornerJoin | null {
  const fe = (usesOf.get(e.id) ?? []).map(u => u.face.id), fo = (usesOf.get(o.id) ?? []).map(u => u.face.id), shared = fe.filter(f => fo.includes(f));
  if (fe.length !== 2 || fo.length !== 2 || shared.length !== 1) return null;
  const before = fe.find(f => f !== shared[0])!, next = fo.find(f => f !== shared[0])!;
  if (before === next) return null;
  const k = (atVertex.get(v) ?? []).filter(x => x.id !== e.id && x.id !== o.id && (usesOf.get(x.id) ?? []).length === 2 && (usesOf.get(x.id) ?? []).every(u => u.face.id === before || u.face.id === next));
  if (k.length !== 1 || chain.has(k[0].id)) return null;
  // (Into each face, square to an edge at one of its ends: the edge's own direction there, as `generalInto`.)
  const into = (x: Edge, at: string) => { const [E0, E1] = ends(x), end = E0.v === at ? E0 : E1, own = end === E0 ? E0.out : scale(E1.out, -1);
    return { x: end.x, out: end.out, sides: usesOf.get(x.id)!.map(u => { const n = sheetNormal(u.face, end.x); return { n, w: unit(cross(n, u.sense === 'forward' ? own : scale(own, -1))) }; }) }; };
  const ie = into(e, v), io = into(o, v), ik = into(k[0], v), si = usesOf.get(e.id)!.findIndex(u => u.face.id === shared[0]);
  // (Not where o carries e on, nor across a smooth edge — a seam between halves of one surface — and only where o leaves
  // v clearly into the side away from the shared face.)
  if (dot(io.out, ie.out) <= -1 + 1e-9 || len(sub(ik.sides[0].n, ik.sides[1].n)) < 1e-9 || !(dot(io.out, ie.sides[si].w) < -1e-6)) return null;
  const convex = convexAt(ie.sides);
  if (convexAt(io.sides) !== convex || convexAt(ik.sides) === convex) return null;
  return { e: e.id, shared: shared[0], edge: k[0], before, next };
}
/** A group of edges as one closed loop, in order (each with whether it runs backwards), or null (open, or branching). */
function closedLoop(comp: readonly Edge[]): { e: Edge; reversed: boolean }[] | null {
  const at = new Map<string, Edge[]>();
  for (const e of comp) for (const v of e.vertices) at.set(v, [...(at.get(v) ?? []), e]);
  if ([...at.values()].some(l => l.length !== 2)) return null;
  const out = [{ e: comp[0], reversed: false }], seen = new Set([comp[0].id]);
  for (;;) {
    const last = out.at(-1)!, v = last.reversed ? last.e.vertices[0] : last.e.vertices[1], next = at.get(v)!.find(o => !seen.has(o.id));
    if (!next) break;
    out.push({ e: next, reversed: next.vertices[1] === v && next.vertices[0] !== v }); seen.add(next.id);
  }
  const tail = out.at(-1)!, back = tail.reversed ? tail.e.vertices[0] : tail.e.vertices[1];
  return out.length === comp.length && back === (comp[0].vertices[0]) ? out : null;
}
/**
 * The rolling-ball tool of a closed loop (R10.2a): its faces sorted to the loop's two sides (by the first edge's,
 * then by a shared face or by the normals where consecutive edges meet), its convexity from the first edge.
 */
function generalRing(body: Brep, loop: { e: Edge; reversed: boolean }[], usesOf: Map<string, Use[]>, ends: Ends, r: number, id: string, scaleMM: number, closed = true, past: (EndPlane | null)[] = [null, null], cornerOf: ReadonlyMap<string, CornerJoin> = new Map()): { brep: Brep; convex: boolean; report: FilletReport; contactFaces: string[]; mid: Point; sides: string[] } {
  const normalAt = (f: Brep['faces'][number], x: Point) => { const s = sheetOf(f.surface as Surface, f.sense); return normalOn(s, ...invertOn(s, x)); };
  const first = loop[0], u0 = usesOf.get(first.e.id)!, A = new Set([u0[0].face.id]), B = new Set([u0[1].face.id]), sideA = [u0[0].face], sideB = [u0[1].face];
  // Into each face at the loop's start, square to the edge (the face left of its coedge seen from outside).
  const into = generalInto(first, usesOf, ends);
  const convex = convexAt(into);
  for (let k = 1; k < loop.length; k++) {
    const { e, reversed } = loop[k], us = usesOf.get(e.id)!, [F, G] = [us[0].face, us[1].face];
    let toA: Brep['faces'][number], toB: Brep['faces'][number];
    if (A.has(F.id) || B.has(G.id)) { toA = F; toB = G; }
    else if (A.has(G.id) || B.has(F.id)) { toA = G; toB = F; }
    else {
      const V = reversed ? ends(e)[1].x : ends(e)[0].x, nA = normalAt(sideA.at(-1)!, V);
      [toA, toB] = len(sub(normalAt(F, V), nA)) <= len(sub(normalAt(G, V), nA)) ? [F, G] : [G, F];
    }
    if (!A.has(toA.id)) { A.add(toA.id); sideA.push(toA); }
    if (!B.has(toB.id)) { B.add(toB.id); sideB.push(toB); }
  }
  const tolMM = 0.25 * 10 * linearToleranceMM(scaleMM), names = loop.map(l => l.e.name ?? l.e.id);
  // (The corners where the ball rolls round an edge: after which of the loop's edges, and on which side that edge stands.)
  const faceOf = new Map(body.faces.map(f => [f.id, f])), corners: CornerInput[] = [];
  for (let k = 0; k < (closed ? loop.length : loop.length - 1); k++) {
    const c = cornerOf.get(`${loop[k].e.id}|${loop[(k + 1) % loop.length].e.id}`);
    if (!c) continue;
    const before = c.e === loop[k].e.id ? c.before : c.next, next = c.e === loop[k].e.id ? c.next : c.before;
    corners.push({ after: k, side: B.has(before) ? 'B' : 'A', shared: faceOf.get(c.shared)!, edge: c.edge.curve, before: faceOf.get(before)!, next: faceOf.get(next)! });
  }
  const { brep, report, contactFaces } = ringFillet(body, { loop: loop.map(l => ({ curve: l.e.curve, reversed: l.reversed })), facesOf: loop.map(l => usesOf.get(l.e.id)!.map(u => u.face.id)), names, sideA, sideB, start: { wA: into[0].w, wB: into[1].w }, convex, r, id, scaleMM, tolMM, closed, past, corners });
  // (A point of the chain halfway along it: the side of an end plane the fillet lies on.)
  const m = loop[Math.floor(loop.length / 2)], [t0, t1] = curveDomain(m.e.curve), mid = evaluateCurve(m.e.curve, (t0 + t1) / 2);
  return { brep, convex, report, contactFaces, mid, sides: [...sideA, ...sideB].map(f => f.name ?? f.id) };
}

/**
 * The feature's repeated face names numbered by where the faces lie (their edges' box centre, x then y
 * then z), and every edge named again from its faces: the names do not depend on the order the tools
 * were applied in.
 */
function renumbered(brep: Brep, id: string): Brep {
  const loops = new Map(brep.loops.map(l => [l.id, l])), coedges = new Map(brep.coedges.map(c => [c.id, c])), edges = new Map(brep.edges.map(e => [e.id, e]));
  const centre = (f: Brep['faces'][number]): Point => {
    const lo: Point = [Infinity, Infinity, Infinity], hi: Point = [-Infinity, -Infinity, -Infinity];
    for (const l of f.loops) for (const c of loops.get(l)!.coedges) for (const q of edges.get(coedges.get(c)!.edge)!.curve.controlPoints) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], q[k]); hi[k] = Math.max(hi[k], q[k]); }
    return [0, 1, 2].map(k => (lo[k] + hi[k]) / 2) as Point;
  };
  let size = 1; for (const v of brep.vertices) for (const x of v.point) size = Math.max(size, Math.abs(x));
  const eps = 1e-6 * size, byPlace = (a: Point, b: Point) => { for (let k = 0; k < 3; k++) if (Math.abs(a[k] - b[k]) > eps) return a[k] - b[k]; return 0; };
  const base = (n: string) => n.split('#')[0], groups = new Map<string, Brep['faces'][number][]>();
  for (const f of brep.faces) if (f.name?.startsWith(`${id}.`)) groups.set(base(f.name), [...(groups.get(base(f.name)) ?? []), f]);
  const name = new Map<string, string>();
  for (const [b, list] of groups) {
    if (list.length === 1) { name.set(list[0].id, b); continue; }
    const at = new Map(list.map(f => [f.id, centre(f)]));
    [...list].sort((x, y) => byPlace(at.get(x.id)!, at.get(y.id)!)).forEach((f, k) => name.set(f.id, `${b}#${k + 1}`));
  }
  const faces = brep.faces.map(f => name.has(f.id) ? { ...f, name: name.get(f.id)! } : f), faceName = new Map(faces.map(f => [f.id, f.name ?? '']));
  const facesOf = new Map<string, Set<string>>();
  for (const c of brep.coedges) { const set = facesOf.get(c.edge) ?? new Set<string>(); set.add(faceName.get(loops.get(c.loop)!.face)!); facesOf.set(c.edge, set); }
  const renamed = brep.edges.map(e => ({ ...e, name: [...(facesOf.get(e.id) ?? [])].sort().join('|') }));
  nameEdges(renamed);
  return { ...brep, faces, edges: renamed };
}
/** Tools meeting over a face or a volume, in groups: bounding boxes overlapping in at least two directions. */
function touchingGroups(tools: Brep[]): Brep[][] {
  const tight = (b: Brep) => { const lo: Point = [Infinity, Infinity, Infinity], hi: Point = [-Infinity, -Infinity, -Infinity];
    for (const e of b.edges) for (const q of e.curve.controlPoints) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], q[k]); hi[k] = Math.max(hi[k], q[k]); }
    return { lo, hi }; };
  const boxes = tools.map(tight), size = Math.max(1, ...boxes.flatMap(b => [...b.lo, ...b.hi].map(Math.abs))), eps = 1e-7 * size;
  const meet = (a: { lo: Point; hi: Point }, b: { lo: Point; hi: Point }) => { const over = [0, 1, 2].map(k => Math.min(a.hi[k], b.hi[k]) - Math.max(a.lo[k], b.lo[k])); return over.every(o => o >= -eps) && over.filter(o => o > eps).length >= 2; };
  const root = tools.map((_, i) => i), find = (x: number): number => root[x] === x ? x : (root[x] = find(root[x]));
  for (let i = 0; i < tools.length; i++) for (let j = i + 1; j < tools.length; j++) if (meet(boxes[i], boxes[j])) root[find(i)] = find(j);
  const members = new Map<number, Brep[]>(); tools.forEach((t, i) => members.set(find(i), [...(members.get(find(i)) ?? []), t]));
  return [...members.values()];
}
/** Several B-reps apart from each other (or touching along lines) as one B-rep of several bodies. */
function combine(breps: Brep[], id: string): Brep {
  if (breps.length === 1) return breps[0];
  const parts = breps.map((b, k) => {
    const p = (x: string) => `${id}_${k}_${x}`;
    return {
      bodies: b.bodies.map(x => ({ ...x, id: p(x.id), shells: x.shells.map(p) })), shells: b.shells.map(x => ({ ...x, id: p(x.id), body: p(x.body), faces: x.faces.map(p) })),
      faces: b.faces.map(x => ({ ...x, id: p(x.id), shell: p(x.shell), loops: x.loops.map(p) })), loops: b.loops.map(x => ({ ...x, id: p(x.id), face: p(x.face), coedges: x.coedges.map(p) })),
      coedges: b.coedges.map(x => ({ ...x, id: p(x.id), edge: p(x.edge), loop: p(x.loop), next: p(x.next), prev: p(x.prev), twin: x.twin === null ? null : p(x.twin) })),
      edges: b.edges.map(x => ({ ...x, id: p(x.id), vertices: [p(x.vertices[0]), p(x.vertices[1])] as [string, string] })), vertices: b.vertices.map(x => ({ ...x, id: p(x.id) })),
    };
  });
  return { ...breps[0], bodies: parts.flatMap(x => x.bodies), shells: parts.flatMap(x => x.shells), faces: parts.flatMap(x => x.faces), loops: parts.flatMap(x => x.loops), coedges: parts.flatMap(x => x.coedges), edges: parts.flatMap(x => x.edges), vertices: parts.flatMap(x => x.vertices) };
}

/** x with rows·x = b (3 × 3), or null when singular. */
function solve3(rows: Point[], b: number[]): Point | null {
  const det = dot(rows[0], cross(rows[1], rows[2]));
  if (Math.abs(det) < 1e-12) return null;
  const c0 = cross(rows[1], rows[2]), c1 = cross(rows[2], rows[0]), c2 = cross(rows[0], rows[1]);
  return scale(add(add(scale(c0, b[0]), scale(c1, b[1])), scale(c2, b[2])), 1 / det);
}

/**
 * The corner tool of three fillets meeting at V: the cone from the ball's centre C bounded by the planes
 * through C square to the three edges (leaving V along `outs`), capped well beyond V, less the ball.
 */
function cornerTool(V: Point, C: Point, outs: Point[], r: number, id: string): Brep {
  const rays = [[0, 1, 2], [1, 2, 0], [2, 0, 1]].map(([i, j, k]) => { const u = unit(cross(outs[i], outs[j])); return dot(u, outs[k]) < 0 ? u : scale(u, -1); });
  const reach = 4 * (len(sub(V, C)) + r), pts: Point[] = [C, ...rays.map(u => add(C, scale(u, reach)))];
  const cone = tetrahedron(pts, `${id}.tool`);
  // The ball about an axis through the cone towards V (its pole is the corner's apex, its seams lie in no
  // plane of the cone). (Turned so its poles and seam lie off the patch, the patch integrates exactly — 2e-10 on one
  // corner — but the Boolean's march along the ball's tangent circles with the edge tools then fails on some boxes, D93.)
  const axis = unit(sub(V, C)), any = unit(add(outs[0], scale(outs[1], 0.37))), e1 = unit(sub(any, scale(axis, dot(any, axis)))), e3 = cross(e1, axis);
  const ball = revolveProfile({ id: `${id}_b`, profile: [{ kind: 'arc', start: [0, -r], center: [0, 0], direction: 'ccw' }, { kind: 'line', start: [0, r] }], axis: { origin: [0, 0], direction: [0, 1] }, angleDegrees: 360 });
  const placed = transformBrep(ball, { matrix: [e1[0], axis[0], e3[0], e1[1], axis[1], e3[1], e1[2], axis[2], e3[2]], offset: [C[0], C[1], C[2]] });
  return booleanAnalytic(cone, { ...placed, faces: placed.faces.map(f => ({ ...f, name: `${id}.face` })) }, 'difference', { id: `${id}_c` });
}

/** A tetrahedron as a planar B-rep, faces pointing out. */
function tetrahedron(p: Point[], name: string): Brep {
  const faces = [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]].map(f => {
    const opposite = p[[0, 1, 2, 3].find(i => !f.includes(i))!], n = cross(sub(p[f[1]], p[f[0]]), sub(p[f[2]], p[f[0]]));
    return dot(n, sub(opposite, p[f[0]])) > 0 ? [f[0], f[2], f[1]] : f;
  });
  const plane = (ids: number[]) => {
    const q = ids.map(i => p[i]), n = unit(cross(sub(q[1], q[0]), sub(q[2], q[0]))), e1 = unit(sub(q[1], q[0])), e2 = cross(n, e1);
    const uv = q.map(x => [dot(sub(x, q[0]), e1), dot(sub(x, q[0]), e2)]), pad = 1 + Math.max(...uv.flat().map(Math.abs));
    const at = (u: number, v: number): Point => add(q[0], add(scale(e1, u), scale(e2, v)));
    return { kind: 'surface' as const, id: 'tf', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[at(-pad, -pad), at(-pad, pad)], [at(pad, -pad), at(pad, pad)]], weights: [[1, 1], [1, 1]] };
  };
  const edgeIds = new Map<string, { id: string; v: [number, number] }>();
  const use = (i: number, j: number) => { const k = i < j ? `${i}-${j}` : `${j}-${i}`; let e = edgeIds.get(k); if (!e) { e = { id: 'te' + edgeIds.size, v: i < j ? [i, j] : [j, i] }; edgeIds.set(k, e); } return { edge: e.id, sense: (e.v[0] === i ? 'forward' : 'reversed') as 'forward' | 'reversed' }; };
  const faceInputs = faces.map((ids, fi) => ({ id: 'tf' + fi, name, surface: plane(ids), sense: 'forward' as const, loops: [{ kind: 'outer' as const, uses: ids.map((v, k) => use(v, ids[(k + 1) % 3])) }] }));
  return buildBrep({ source: { family: 'corner-tool', id: 'corner' }, vertices: p.map((x, i) => ({ id: 'tv' + i, point: x })),
    edges: [...edgeIds.values()].map(e => ({ id: e.id, curve: lineCurve(e.id, p[e.v[0]], p[e.v[1]]), vertices: ['tv' + e.v[0], 'tv' + e.v[1]] as [string, string] })),
    bodies: [{ id: 'corner', kind: 'solid', shells: [{ id: 's', closed: true, faces: faceInputs }] }] });
}

/** Outward normal of a face's surface at a point of it (planes and cylinders). */
function outwardNormal(g: Geo, x: Point): Point | null {
  if (g.kind === 'plane') return g.n;
  if (g.kind === 'cylinder') { const d = sub(x, g.c), radial = unit(sub(d, scale(g.a, dot(d, g.a)))); return scale(radial, g.out); }
  return null;
}
/** The meridian normal of a surface of revolution at x (away from a profile arc's centre; a profile line's left turned right). */
function meridianNormal(R: Revolution, x: Point): Point {
  const d = sub(x, R.c), h = dot(d, R.a), off = sub(d, scale(R.a, h)), rho = len(off), pr = R.profile;
  const er = rho > 0 ? scale(off, 1 / rho) : R.e1;
  let m: XY;
  if (pr.kind === 'line') { const t = [pr.q[0] - pr.p[0], pr.q[1] - pr.p[1]], l = Math.hypot(t[0], t[1]); m = [t[1] / l, -t[0] / l]; }
  else { const v = [rho - pr.c[0], h - pr.c[1]], l = Math.hypot(v[0], v[1]); m = [v[0] / l, v[1] / l]; }
  return add(scale(er, m[0]), scale(R.a, m[1]));
}
/** A face's geometry, with surfaces of revolution other than planes and cylinders recognised (R10.1). */
function geoOf(face: Brep['faces'][number], scaleMM: number): Geo {
  const g = faceGeometry(face, scaleMM), S = face.surface;
  if (g.kind !== 'other' || S.kind !== 'surface') return g;
  const R = revolutionOf(S, scaleMM);
  if (!R) return g;
  // Which side is out: the parametric normal at the patch's middle (∂u × ∂v, turned by the face's sense).
  const { u: [u0, u1], v: [v0, v1] } = surfaceDomain(S), um = (u0 + u1) / 2, vm = (v0 + v1) / 2, du = 1e-6 * (u1 - u0), dv = 1e-6 * (v1 - v0);
  const c = evaluateSurface(S, um, vm), n = cross(sub(evaluateSurface(S, um + du, vm), c), sub(evaluateSurface(S, um, vm + dv), c));
  const sign = Math.sign(dot(n, meridianNormal(R, c))) * (face.sense === 'forward' ? 1 : -1);
  return sign ? { kind: 'revolution', R, sign } : g;
}
/** Outward normal at x of any face R10.1 finishes (planes, cylinders, surfaces of revolution). */
function normalOf(g: Geo, x: Point): Point | null {
  if (g.kind === 'revolution') return scale(meridianNormal(g.R, x), g.sign);
  return outwardNormal(g, x);
}

/** Into each face at x, perpendicular to the edge (the face lies left of its coedge seen from outside). */
function intoFaces(e: Brep['edges'][number], uses: Use[], x: Point, tangent: Point): { n: Point; w: Point }[] {
  return uses.map(u => {
    const n = normalOf(u.geometry, x);
    if (!n) refuseFillet('NOT_ANALYTIC_PAIR', `edge ${e.name}: a face is neither a plane nor a surface of revolution; finishing it arrives with R10.2`);
    const dir = u.sense === 'forward' ? tangent : scale(tangent, -1);
    return { n: n!, w: unit(cross(n!, dir)) };
  });
}

// ---- the true reach (D88) ------------------------------------------------------------------------------
// How far a face extends across an edge, the least over the edge's length: of the face's boundary edges that do
// not touch the edge (the edge itself, and those at its ends, are where the face starts), the points lying beside
// the edge (along it within its length, or its angle) nearest across, in the face's own measure (a line's
// distance along w, a circle's angle). Lines and arcs and every other curve alike: sampled, then refined (the
// bracketing crossings by bisection, local minima by golden section) to rounding.

/** A chart beside an edge: a straight edge's (along its direction from P, the section across it) or a circle's (angle, meridian). */
type Chart = { kind: 'straight'; P: Point; d: Point; u: Point; v: Point; L: number } | { kind: 'circle'; c: Point; a: Point; er0: Point; et0: Point; sweep: number };
const TAU = 2 * Math.PI;
function alongOf(ch: Chart, q: Point): number {
  if (ch.kind === 'straight') return dot(sub(q, ch.P), ch.d);
  const d = sub(q, ch.c);
  return ((Math.atan2(dot(d, ch.et0), dot(d, ch.er0)) % TAU) + TAU) % TAU;
}
function sectionOf(ch: Chart, q: Point): XY {
  const d = sub(q, ch.kind === 'straight' ? ch.P : ch.c);
  if (ch.kind === 'straight') return [dot(d, ch.u), dot(d, ch.v)];
  const h = dot(d, ch.a);
  return [len(sub(d, scale(ch.a, h))), h];
}
const lengthOf = (ch: Chart) => ch.kind === 'straight' ? ch.L : ch.sweep;
function besideAt(ch: Chart, q: Point, tolAlong: number): boolean {
  const t = alongOf(ch, q);
  return ch.kind === 'circle' && ch.sweep >= TAU - 1e-12 ? true : t >= -tolAlong && t <= lengthOf(ch) + tolAlong;
}
function acrossAt(curve: Curve, t: number, ch: Chart, side: SectionSide, X: XY): number { return acrossOf(side, X, sectionOf(ch, evaluateCurve(curve, t))); }
/** Least `across` (above eps) of the curve's points beside the edge. */
function reachOnCurve(curve: Curve, ch: Chart, side: SectionSide, X: XY, eps: number, tolAlong: number): number {
  const [t0, t1] = curveDomain(curve), N = 64, ts: number[] = [], inside: boolean[] = [], vals: number[] = [];
  for (let i = 0; i <= N; i++) { const t = t0 + (t1 - t0) * i / N, q = evaluateCurve(curve, t); ts.push(t); inside.push(besideAt(ch, q, tolAlong)); vals.push(acrossOf(side, X, sectionOf(ch, q))); }
  let best = Infinity;
  for (let i = 0; i <= N; i++) if (inside[i] && vals[i] > eps) best = Math.min(best, vals[i]);
  // Where the curve comes beside the edge (or leaves it): the crossing by bisection.
  for (let i = 0; i < N; i++) if (inside[i] !== inside[i + 1]) {
    let lo = ts[i], hi = ts[i + 1];
    for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (besideAt(ch, evaluateCurve(curve, m), tolAlong) === inside[i]) lo = m; else hi = m; }
    const t = inside[i] ? lo : hi, v = acrossAt(curve, t, ch, side, X);
    if (v > eps) best = Math.min(best, v);
  }
  // A dip between samples: golden section about each sampled local minimum.
  for (let i = 1; i < N; i++) if (inside[i] && vals[i] <= vals[i - 1] && vals[i] <= vals[i + 1]) {
    let lo = ts[i - 1], hi = ts[i + 1];
    const phi = (Math.sqrt(5) - 1) / 2;
    let x1 = hi - phi * (hi - lo), x2 = lo + phi * (hi - lo), f1 = acrossAt(curve, x1, ch, side, X), f2 = acrossAt(curve, x2, ch, side, X);
    for (let k = 0; k < 80; k++) {
      if (f1 <= f2) { hi = x2; x2 = x1; f2 = f1; x1 = hi - phi * (hi - lo); f1 = acrossAt(curve, x1, ch, side, X); }
      else { lo = x1; x1 = x2; f1 = f2; x2 = lo + phi * (hi - lo); f2 = acrossAt(curve, x2, ch, side, X); }
    }
    const t = (lo + hi) / 2, q = evaluateCurve(curve, t), v = acrossOf(side, X, sectionOf(ch, q));
    if (besideAt(ch, q, tolAlong) && v > eps) best = Math.min(best, v);
  }
  return best;
}
/** A B-rep edge at its middle: convex or concave (its faces' material angle under or over 180°), smooth (the faces
 * tangent there: a seam between halves of one surface, a fillet's tangent edge), or unknown (a face R10.1 cannot read). */
function edgeKind(body: Brep, o: Brep['edges'][number], scaleMM: number): 'convex' | 'concave' | 'smooth' | 'unknown' {
  const loopFace = new Map(body.loops.map(l => [l.id, l.face])), uses: Use[] = [];
  for (const c of body.coedges) if (c.edge === o.id) { const f = body.faces.find(x => x.id === loopFace.get(c.loop))!; uses.push({ face: f, geometry: geoOf(f, scaleMM), sense: c.sense }); }
  const [t0, t1] = curveDomain(o.curve), tm = (t0 + t1) / 2, h = 1e-6 * (t1 - t0), x = evaluateCurve(o.curve, tm);
  const tangent = unit(sub(evaluateCurve(o.curve, tm + h), evaluateCurve(o.curve, tm - h)));
  if (uses.length !== 2 || uses.some(u => !normalOf(u.geometry, x))) return 'unknown';
  const sides = intoFaces(o, uses, x, tangent);
  if (len(sub(sides[0].n, sides[1].n)) < 1e-9) return 'smooth';
  return convexAt(sides) ? 'convex' : 'concave';
}
/** Whether a curve lies in the plane (or meridian) where the edge ends: its start, middle and end all beside one end. */
function atAnEnd(curve: Curve, ch: Chart, tolAlong: number): boolean {
  const [t0, t1] = curveDomain(curve), L = lengthOf(ch), a = [t0, (t0 + t1) / 2, t1].map(t => alongOf(ch, evaluateCurve(curve, t)));
  if (ch.kind === 'circle' && ch.sweep >= TAU - 1e-12) return false;
  const near = (x: number, y: number) => Math.abs(x - y) <= tolAlong || (ch.kind === 'circle' && Math.abs(x - y - TAU) <= tolAlong);
  return a.every(x => near(x, 0)) || a.every(x => near(x, L));
}
/**
 * The face's true reach across the edge (Infinity when nothing bounds it beside the edge). Its boundary edges beside
 * the edge limit a finish, except those touching the edge's ends, those lying where the edge ends (the body ends
 * there, not the face across it), and, for a finish that removes material, another loop's convex edges (a hole's
 * rim, a step down: the cut runs into that void, as a chamfer beside a hole in part-model.test "brep-core step 7").
 * A boss's foot (a concave edge) limits it; for a finish that adds material every boundary does. Across a smooth
 * edge (a seam between halves of one surface) the face goes on: its neighbour's boundaries count in its stead.
 */
function trueReach(body: Brep, faceId: string, e: Brep['edges'][number], ch: Chart, side: SectionSide, X: XY, scaleMM: number, removes: boolean): number {
  const own = new Set(e.vertices), eps = side.curve.kind === 'line' ? 1e-7 * scaleMM : 1e-9, tolAlong = ch.kind === 'straight' ? 1e-9 * scaleMM : 1e-12;
  const loopFace = new Map(body.loops.map(l => [l.id, l.face])), edgesOf = new Map<string, { edge: string; loop: string }[]>();
  for (const c of body.coedges) { const f = loopFace.get(c.loop)!; edgesOf.set(f, [...(edgesOf.get(f) ?? []), { edge: c.edge, loop: c.loop }]); }
  const byId = new Map(body.edges.map(x => [x.id, x])), faceOfLoop = (l: string) => loopFace.get(l)!;
  const mine = new Set((edgesOf.get(faceId) ?? []).filter(u => u.edge === e.id).map(u => u.loop)), seen = new Set([faceId]), walked = new Set<string>();
  let reach = Infinity;
  for (const queue = [faceId]; queue.length;) {
    const f = queue.shift()!;
    for (const { edge, loop } of edgesOf.get(f) ?? []) {
      const o = byId.get(edge)!;
      if (o.id === e.id || walked.has(o.id) || o.vertices.some(v => own.has(v)) || atAnEnd(o.curve, ch, tolAlong)) continue;
      const kind = edgeKind(body, o, scaleMM);
      if (kind === 'smooth') {
        // On into the neighbour, its loop through this seam counting as the face's own.
        walked.add(o.id);
        for (const c of body.coedges) if (c.edge === o.id && !seen.has(faceOfLoop(c.loop)) && seen.size < 16) { seen.add(faceOfLoop(c.loop)); mine.add(c.loop); queue.push(faceOfLoop(c.loop)); }
        continue;
      }
      if (removes && !mine.has(loop) && kind === 'convex') continue;
      reach = Math.min(reach, reachOnCurve(o.curve, ch, side, X, eps, tolAlong));
    }
  }
  return reach;
}
/** A plane face's true reach across the straight edge P → Q along w (into the face). */
function planeReach(body: Brep, faceId: string, e: Brep['edges'][number], P: Point, Q: Point, w: Point, scaleMM: number, removes: boolean): number {
  const d = unit(sub(Q, P)), v = cross(d, w), ch: Chart = { kind: 'straight', P, d, u: w, v, L: len(sub(Q, P)) };
  return trueReach(body, faceId, e, ch, { curve: { kind: 'line', p: [0, 0], d: [1, 0] }, w: [1, 0], n: [0, 1] }, [0, 0], scaleMM, removes);
}
/** A plane face's true reach across a straight edge, from it along w, for a finish that removes material (the wedge chamfer's). */
export function faceReach(body: Brep, faceId: string, edge: Brep['edges'][number], w: Point): number {
  const p = edge.curve.controlPoints, P = p[0], Q = p[p.length - 1];
  let s = 1; for (const x of body.vertices) for (const c of x.point) s = Math.max(s, Math.abs(c));
  return planeReach(body, faceId, edge, P, Q, w, s, true);
}
/** Refuses a fillet whose contact on a face lies past the face's true reach. */
function fitsFaces(body: Brep, e: Brep['edges'][number], uses: Use[], ch: Chart, sides: SectionSide[], X: XY, contacts: XY[], what: string, scaleMM: number, removes: boolean): void {
  sides.forEach((side, k) => {
    const need = acrossOf(side, X, contacts[k]), reach = trueReach(body, uses[k].face.id, e, ch, side, X, scaleMM, removes);
    const slack = side.curve.kind === 'line' ? 1e-6 * scaleMM : 1e-9;
    if (need > reach + slack) {
      const unitOf = (x: number) => side.curve.kind === 'line' ? `${+x.toFixed(6)} mm` : `${+(x * 180 / Math.PI).toFixed(6)}°`;
      refuseFillet('RADIUS_EXCEEDS_FACE', `edge ${e.name}: ${what} reaches ${unitOf(need)} into face ${uses[k].face.name ?? uses[k].face.id}, which reaches only ${unitOf(reach)} across the edge`);
    }
  });
}

/**
 * The tool's profile in a section across the edge, in 2D coordinates where the edge passes through X
 * and its faces leave along w1, w2: the corner between them and the fillet arc (or chamfer line),
 * grown by g outside that corner. Returns the profile and whether the edge is convex (`material`).
 */
function cornerProfile(X: XY, w1: XY, w2: XY, size: number, kind: EdgeFinishKind, g: number, name: string): ProfileSegmentInput[] {
  const c = Math.max(-1, Math.min(1, w1[0] * w2[0] + w1[1] * w2[1])), alpha = Math.acos(c);
  if (alpha > Math.PI - 1e-6) refuseFillet('TANGENT_FACES', `edge ${name}: its faces meet tangentially; there is no corner to finish`);
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

function straightTool(e: Brep['edges'][number], uses: Use[], P: Point, Q: Point, reach: number[], size: number, kind: EdgeFinishKind, id: string, trim: number[] = [0, 0]): { brep: Brep; convex: boolean } {
  const along = unit(sub(Q, P)), sides = intoFaces(e, uses, P, along), L = len(sub(Q, P));
  if (dot(sides[0].w, sides[1].w) < -1 + 1e-9) refuseFillet('TANGENT_FACES', `edge ${e.name}: its faces meet tangentially; there is no corner to finish`);
  const u = sides[0].w, v = unit(sub(sides[1].w, scale(u, dot(sides[1].w, u)))), z = cross(u, v);
  const to2 = (w: Point): XY => [dot(w, u), dot(w, v)];
  const t = finishSize(sides, size, kind), g = Math.max(t, size) * 0.5;
  const profile = cornerProfile([0, 0], to2(sides[0].w), to2(sides[1].w), size, kind, g, e.name ?? e.id);
  // The section's extent past each end: enough to clear a cap face leaning back over the tool.
  // (A corner blend takes over the last stretch before a vertex: there the tool is cut back by `trim`.)
  const extent = (t + 2 * g) * 2, zq = dot(sub(Q, P), z), ext0 = reach[0] * extent - trim[0], ext1 = reach[1] * extent - trim[1];
  const [z0, z1] = zq > 0 ? [-ext0, L + ext1] : [-L - ext1, ext0];
  const prism = brepFromPrismatic(prismaticFromProfile({ outer: profile, heightMM: z1 - z0, fromMM: z0, tag: `${id}_t` }), { id: `${id}_t` });
  const tool = transformBrep(prism, { matrix: [u[0], v[0], z[0], u[1], v[1], z[1], u[2], v[2], z[2]], offset: [P[0], P[1], P[2]] });
  // A point of the finishing surface: on the bisector, between the corner and the fillet's centre.
  const alpha = Math.acos(Math.max(-1, Math.min(1, dot(sides[0].w, sides[1].w)))), bis = unit(add(sides[0].w, sides[1].w));
  const depth = kind === 'fillet' ? size / Math.sin(alpha / 2) - size : t * Math.cos(alpha / 2);
  const marker = add(add(P, scale(along, trim[0] + (L - trim[0] - trim[1]) / 2)), scale(bis, depth));
  return { brep: named(tool, id, marker), convex: convexAt(sides) };
}

/** Which closed form finishes the edge: two planes, the translational or coaxial pair, or a plane and a cylinder square to it. */
function pairOf(e: Brep['edges'][number], uses: Use[], straight: boolean, kind: EdgeFinishKind, tol: number, soft = false): 'planes' | 'translational' | 'plane-cylinder' | 'coaxial' | 'general' {
  const gs = uses.map(u => u.geometry), none = (detail: string) => soft ? 'general' as const : refuseFillet('NOT_ANALYTIC_PAIR', detail);
  if (straight) {
    if (gs.every(g => g.kind === 'plane')) return 'planes';
    const p = e.curve.controlPoints, d = unit(sub(p[p.length - 1] as Point, p[0] as Point));
    if (!gs.every(g => g.kind === 'plane' ? Math.abs(dot(g.n, d)) < 1e-9 : g.kind === 'cylinder' && len(cross(g.a, d)) < 1e-9)) return none(`edge ${e.name}: its faces do not both run along it (planes along the edge, cylinders with their axis along it), and its chain is not closed; open general chains arrive with R10.2b`);
    if (kind === 'chamfer') refuse('CAPABILITY', `edge ${e.name}: chamfers along a straight edge of a curved face are not supported yet`);
    return 'translational';
  }
  const k = circleOf(e.curve);
  if (!k) return none(`edge ${e.name}: the edge is neither a line nor a circle, and its chain is not closed; open general chains arrive with R10.2b`);
  const pl = gs.find(g => g.kind === 'plane') as Extract<FaceGeometry, { kind: 'plane' }> | undefined, cy = gs.find(g => g.kind === 'cylinder') as Extract<FaceGeometry, { kind: 'cylinder' }> | undefined;
  if (pl && cy && Math.abs(Math.abs(dot(cy.a, pl.n)) - 1) <= 1e-9 && Math.abs(k.r - cy.r) <= 1e3 * tol) return 'plane-cylinder';
  const axis = unit(cross(k.e1, k.e2)), onAxis = (c: Point, a: Point) => len(cross(a, axis)) < 1e-9 && len(cross(sub(c, k.c), axis)) <= 1e3 * tol;
  const coaxial = gs.every(g => g.kind === 'plane' ? Math.abs(dot(g.n, axis)) > 1 - 1e-9 : g.kind === 'cylinder' ? onAxis(g.c, g.a) : g.kind === 'revolution' && onAxis(g.R.c, g.R.a));
  if (!coaxial) return none(`edge ${e.name}: its faces are not surfaces of revolution about the circle's axis, and its chain is not closed; open general chains arrive with R10.2b`);
  if (kind === 'chamfer') refuse('CAPABILITY', `edge ${e.name}: chamfers along a circle between curved faces other than a plane and a cylinder are not supported yet`);
  return 'coaxial';
}
/** The tool's faces named by the section's tags: the fillet arc's `${id}.face`, every other `${id}.tool`. */
function byTag(tool: Brep, id: string): Brep {
  return { ...tool, faces: tool.faces.map(f => ({ ...f, name: f.name?.includes('.side[f]') ? `${id}.face` : `${id}.tool` })) };
}

/** R10.1 (a): a straight edge between planes along it and cylinders with their axis along it — the section across, extruded. */
function translationalTool(body: Brep, e: Brep['edges'][number], uses: Use[], P: Point, Q: Point, reach: number[], size: number, id: string, scaleMM: number): { brep: Brep; convex: boolean } {
  const along = unit(sub(Q, P)), L = len(sub(Q, P)), sides = intoFaces(e, uses, P, along);
  const u = sides[0].w, across = sub(sides[1].w, scale(u, dot(sides[1].w, u)));
  if (len(across) < 1e-12) refuseFillet('TANGENT_FACES', `edge ${e.name}: its faces meet tangentially; there is no corner to finish`);
  const v = unit(across), z = cross(u, v), to2v = (w: Point): XY => [dot(w, u), dot(w, v)];
  const sec: SectionSide[] = uses.map((us, k) => {
    const g = us.geometry, w = to2v(sides[k].w), n = to2v(sides[k].n);
    return { curve: g.kind === 'cylinder' ? { kind: 'circle', c: to2v(sub(g.c, P)), r: g.r } : { kind: 'line', p: [0, 0], d: w }, w, n };
  });
  const fs = filletSection([0, 0], sec[0], sec[1], size, size * 0.5, e.name ?? e.id, scaleMM);
  fitsFaces(body, e, uses, { kind: 'straight', P, d: along, u, v, L }, sec, [0, 0], fs.contacts, `a fillet of ${size} mm`, scaleMM, fs.convex);
  // Past each end, as a straight edge's tool.
  const t = Math.max(...fs.contacts.map(c => Math.hypot(c[0], c[1]))), extent = (t + 2 * fs.g) * 2, zq = dot(sub(Q, P), z);
  const [z0, z1] = zq > 0 ? [-reach[0] * extent, L + reach[1] * extent] : [-L - reach[1] * extent, reach[0] * extent];
  const prism = brepFromPrismatic(prismaticFromProfile({ outer: fs.profile, heightMM: z1 - z0, fromMM: z0, tag: `${id}_t`, sideTags: { outer: fs.tags } }), { id: `${id}_t` });
  const tool = transformBrep(prism, { matrix: [u[0], v[0], z[0], u[1], v[1], z[1], u[2], v[2], z[2]], offset: [P[0], P[1], P[2]] });
  return { brep: byTag(tool, id), convex: fs.convex };
}

/** The least ρ (first coordinate) of a closed profile of lines and arcs: its points, and each arc's leftmost point when it passes it. */
function leastRho(profile: readonly ProfileSegmentInput[]): number {
  let least = Infinity;
  profile.forEach((s, i) => {
    least = Math.min(least, s.start[0]);
    if (s.kind !== 'arc') return;
    const end = profile[(i + 1) % profile.length].start, c = s.center, r = Math.hypot(s.start[0] - c[0], s.start[1] - c[1]);
    const a0 = Math.atan2(s.start[1] - c[1], s.start[0] - c[0]), a1 = Math.atan2(end[1] - c[1], end[0] - c[0]);
    // The sweep from a0 to a1 the arc's way; whether it passes the angle π (pointing to −ρ).
    const sweep = s.direction === 'ccw' ? ((a1 - a0) % TAU + TAU) % TAU : ((a0 - a1) % TAU + TAU) % TAU, to = s.direction === 'ccw' ? ((Math.PI - a0) % TAU + TAU) % TAU : ((a0 - Math.PI) % TAU + TAU) % TAU;
    if (to <= sweep) least = Math.min(least, c[0] - r);
  });
  return least;
}

/** R10.1 (b): a circular edge between surfaces of revolution about its axis — the meridian section, revolved. */
function coaxialTool(body: Brep, e: Brep['edges'][number], uses: Use[], P: Point, Q: Point, reach: number[], size: number, id: string, tol: number, scaleMM: number): { brep: Brep; convex: boolean } {
  const circle = circleOf(e.curve)!, axis0 = unit(cross(circle.e1, circle.e2)), centre = circle.c;
  const off = (x: Point) => { const d = sub(x, centre); return sub(d, scale(axis0, dot(d, axis0))); };
  const [t0, t1] = curveDomain(e.curve), travel = unit(sub(evaluateCurve(e.curve, t0 + 1e-6 * (t1 - t0)), P));
  const er0 = unit(off(P)), axis = dot(cross(er0, axis0), travel) > 0 ? axis0 : scale(axis0, -1), et0 = cross(er0, axis);
  const angleOf = (x: Point) => { const r = unit(off(x)); return ((Math.atan2(dot(r, et0), dot(r, er0)) % TAU) + TAU) % TAU; };
  const closed = len(sub(Q, P)) <= tol;
  let sweep = closed ? TAU : angleOf(Q);
  if (!closed && sweep <= 1e-12) sweep = TAU;
  const sides = intoFaces(e, uses, P, travel), R = len(off(P)), X: XY = [R, 0];
  const to2v = (w: Point): XY => [dot(w, er0), dot(w, axis)];
  const mer = (x: Point): XY => { const d = sub(x, centre), h = dot(d, axis); return [len(sub(d, scale(axis, h))), h]; };
  const sec: SectionSide[] = uses.map((us, k) => {
    const g = us.geometry, w = to2v(sides[k].w), n = to2v(sides[k].n);
    if (g.kind === 'revolution' && g.R.profile.kind === 'arc') {
      // The profile's circle in this edge's meridian (its centre placed in the meridian through P).
      const pc = g.R.profile.c, C3 = add(add(g.R.c, scale(g.R.a, pc[1])), scale(er0, pc[0]));
      return { curve: { kind: 'circle', c: mer(C3), r: g.R.profile.r }, w, n };
    }
    return { curve: { kind: 'line', p: X, d: w }, w, n };
  });
  // Grown outside the corner, but never across the axis (only the profile turns: the ball's far side may cross it).
  let fs = filletSection(X, sec[0], sec[1], size, size * 0.5, e.name ?? e.id, scaleMM);
  for (let k = 0; k < 8 && leastRho(fs.profile) < -1e-9 * R; k++) fs = filletSection(X, sec[0], sec[1], size, fs.g / 2, e.name ?? e.id, scaleMM);
  if (leastRho(fs.profile) < -1e-9 * R) refuse('PARAMETER', `edge ${e.name}: the fillet reaches the axis`);
  fitsFaces(body, e, uses, { kind: 'circle', c: centre, a: axis, er0, et0, sweep }, sec, X, fs.contacts, `a fillet of ${size} mm`, scaleMM, fs.convex);
  // Snap points within rounding of the axis onto it.
  const snap = (x: XY): XY => [Math.abs(x[0]) <= 1e-9 * R ? 0 : x[0], x[1]];
  const profile = fs.profile.map(s => s.kind === 'arc' ? { ...s, start: snap(s.start as XY), center: snap(s.center as XY) } : { ...s, start: snap(s.start as XY) }) as ProfileSegmentInput[];
  const t = Math.max(...fs.contacts.map(c => Math.hypot(c[0] - X[0], c[1] - X[1]))), extent = (t + 2 * fs.g) * 2 / R;
  const back = closed ? 0 : reach[0] * extent, on = closed ? 0 : reach[1] * extent;
  const total = Math.min(TAU, sweep + back + on), start = total >= TAU ? 0 : back;
  const c0 = Math.cos(-start), s0 = Math.sin(-start), erS = add(scale(er0, c0), scale(et0, s0)), etS = cross(erS, axis);
  const turned = revolveProfile({ id: `${id}_t`, profile, axis: { origin: [0, 0], direction: [0, 1] }, angleDegrees: total * 180 / Math.PI, sideTags: fs.tags });
  const tool = transformBrep(turned, { matrix: [erS[0], axis[0], etS[0], erS[1], axis[1], etS[1], erS[2], axis[2], etS[2]], offset: [centre[0], centre[1], centre[2]] });
  return { brep: byTag(tool, id), convex: fs.convex };
}

function arcTool(body: Brep, e: Brep['edges'][number], uses: Use[], P: Point, Q: Point, reach: number[], size: number, kind: EdgeFinishKind, id: string, tol: number, scaleMM: number): { brep: Brep; convex: boolean } {
  const wall = uses.find(u => u.geometry.kind === 'cylinder')!;
  const cyl = wall.geometry as Extract<FaceGeometry, { kind: 'cylinder' }>;
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
  // It must fit on both faces (D88): its contacts, t along each face from the edge, within their true reach.
  const sec: SectionSide[] = [w1, w2].map((w, k) => ({ curve: { kind: 'line', p: [R, 0], d: w }, w, n: to2(sides[k].n) }));
  fitsFaces(body, e, uses, { kind: 'circle', c: centre, a: axis, er0, et0, sweep: closed ? 2 * Math.PI : sweep }, sec, [R, 0], [w1, w2].map(w => [R + w[0] * t, w[1] * t] as XY), `a ${kind} of ${size} mm`, scaleMM, convexAt(sides));
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
