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
import { BrepError, buildBrep, lineCurve, type Brep } from './brep-core.js';
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

  const convexTools: Brep[] = [], concaveTools: Brep[] = [], cornerTools: Brep[] = [];
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
    if (!here.every(e => convexAt(intoFaces(e, usesOf.get(e.id)!, ends(e)[0].x, ends(e)[0].out)))) continue;
    const ns = fids.map(f => (geom(f) as Extract<FaceGeometry, { kind: 'plane' }>).n), C = solve3(ns, ns.map(n => dot(n, V) - size));
    if (!C) continue;
    const outs = here.map(e => ends(e).find(x => x.v === v)!.out), setbacks = outs.map(d => dot(sub(C, V), d));
    here.forEach((e, k) => {
      const L = len(sub(ends(e)[1].x, ends(e)[0].x));
      if (!(setbacks[k] > 0) || setbacks[k] >= L) refuse('PARAMETER', `edge ${e.name}: a fillet of ${size} mm does not fit (the corner needs ${+setbacks[k].toFixed(6)} mm of a ${+L.toFixed(6)} mm edge)`);
      const t = trims.get(e.id) ?? [0, 0]; t[ends(e)[0].v === v ? 0 : 1] = setbacks[k]; trims.set(e.id, t);
    });
    cornerTools.push(cornerTool(V, C, outs, size, id));
  }
  // Corner blends at both ends of one edge must leave some of it between them.
  for (const [eid, [t0, t1]] of trims) {
    const e = body.edges.find(x => x.id === eid)!, [E0, E1] = ends(e), L = len(sub(E1.x, E0.x));
    if (t0 + t1 >= L - tol) refuse('PARAMETER', `edge ${e.name}: a fillet of ${size} mm is too large (the corners at its ends need ${+(t0 + t1).toFixed(6)} mm of a ${+L.toFixed(6)} mm edge)`);
  }
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
    const trim = trims.get(e.id), runs = trim ? run.map((r, i) => trim[i] ? 0 : r) : run;
    const tool = straight ? straightTool(e, uses, E0.x, E1.x, runs, size, kind, id, trim) : arcTool(e, uses, E0.x, closedCircle.has(e.id) ? E0.x : E1.x, run, size, kind, id, tol);
    (tool.convex ? convexTools : concaveTools).push(tool.brep);
  }
  // Tools that share a face or volume (a tangent chain's pieces, mitred tools) are joined by Booleans;
  // the joined groups touch at most along lines (a corner blend's trimmed tools), so they are applied
  // together, as one B-rep of several bodies; the corner tools (apart from each other) after them.
  let out = body;
  const apply = (tools: Brep[], op: 'difference' | 'union') => { if (tools.length) out = booleanAnalytic(out, combine(joinTouching(tools, id), id), op, { id }); };
  apply(convexTools, 'difference');
  apply(cornerTools, 'difference');
  apply(concaveTools, 'union');
  return out;
}

/** Tools meeting over a face or a volume, joined: bounding boxes overlapping in at least two directions. */
function joinTouching(tools: Brep[], id: string): Brep[] {
  // (Edges bound a tool tightly; a surface's control net only loosely.)
  const tight = (b: Brep) => { const lo: Point = [Infinity, Infinity, Infinity], hi: Point = [-Infinity, -Infinity, -Infinity];
    for (const e of b.edges) for (const q of e.curve.controlPoints) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], q[k]); hi[k] = Math.max(hi[k], q[k]); }
    return { lo, hi }; };
  const boxes = tools.map(tight), size = Math.max(1, ...boxes.flatMap(b => [...b.lo, ...b.hi].map(Math.abs))), eps = 1e-7 * size;
  const meet = (a: { lo: Point; hi: Point }, b: { lo: Point; hi: Point }) => {
    const over = [0, 1, 2].map(k => Math.min(a.hi[k], b.hi[k]) - Math.max(a.lo[k], b.lo[k]));
    return over.every(o => o >= -eps) && over.filter(o => o > eps).length >= 2;
  };
  const root = tools.map((_, i) => i), find = (x: number): number => root[x] === x ? x : (root[x] = find(root[x]));
  for (let i = 0; i < tools.length; i++) for (let j = i + 1; j < tools.length; j++) if (meet(boxes[i], boxes[j])) root[find(i)] = find(j);
  const members = new Map<number, Brep[]>(); tools.forEach((t, i) => members.set(find(i), [...(members.get(find(i)) ?? []), t]));
  return [...members.values()].map(list => list.reduce((acc, t) => booleanAnalytic(acc, t, 'union', { id: `${id}_tools` })));
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
  // plane of the cone).
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

function straightTool(e: Brep['edges'][number], uses: Use[], P: Point, Q: Point, reach: number[], size: number, kind: EdgeFinishKind, id: string, trim: number[] = [0, 0]): { brep: Brep; convex: boolean } {
  const along = unit(sub(Q, P)), sides = intoFaces(e, uses, P, along), L = len(sub(Q, P));
  if (dot(sides[0].w, sides[1].w) < -1 + 1e-9) refuse('SELECTION', `edge ${e.name}: its faces meet tangentially; there is no corner to finish`);
  if (!uses.every(u => u.geometry.kind === 'plane')) refuse('CAPABILITY', `edge ${e.name}: straight edges can be finished between two planes only (yet)`);
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
