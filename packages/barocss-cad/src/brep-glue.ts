// Gluing two solids that meet in one shared planar face: both copies of the face are dropped and the
// second solid's boundary of it is merged onto the first's, so the two shells become one. Exact when
// the solids otherwise lie apart (each on its side of the face's plane, as consecutive pieces of a
// sweep do); the caller makes sure of that. Returns null when the faces do not match exactly, for the
// caller to fall back to a Boolean union.
import { buildBrep, type Brep, type BrepFace, type BrepLoopInput } from './brep-core.js';
import { faceGeometry } from './analytic-boolean.js';
import { evaluateCurve } from './math.js';
import { dot, len, sub } from './vec3.js';
import type { Curve, Point } from './types.js';

const domain = (c: Curve): [number, number] => [c.knots[c.degree], c.knots[c.knots.length - c.degree - 1]];
const at = (c: Curve, s: number): Point => { const [a, b] = domain(c); return evaluateCurve(c, a + (b - a) * s); };

/** The one solid of `a` and `b` glued along a planar face they share, or null when they share none exactly. */
export function glueAtSharedFace(a: Brep, b: Brep, source: Brep['source']): Brep | null {
  if (a.bodies.length !== 1 || b.bodies.length !== 1 || a.bodies[0].shells.length !== 1 || b.bodies[0].shells.length !== 1) return null;
  const tol = 10 * Math.max(...a.vertices.map(v => v.toleranceMM), ...b.vertices.map(v => v.toleranceMM));
  const plane = (f: BrepFace) => { try { const g = faceGeometry(f); return g.kind === 'plane' ? g : null; } catch { return null; } };
  const ctx = (x: Brep) => ({ loops: new Map(x.loops.map(l => [l.id, l])), coedges: new Map(x.coedges.map(c => [c.id, c])), edges: new Map(x.edges.map(e => [e.id, e])), vertices: new Map(x.vertices.map(v => [v.id, v])) });
  const A = ctx(a), B = ctx(b);
  const edgesOf = (f: BrepFace, X: typeof A) => f.loops.flatMap(lid => X.loops.get(lid)!.coedges.map(cid => X.edges.get(X.coedges.get(cid)!.edge)!));

  // The pair of faces: coincident planes facing each other, with the same boundary edges.
  let match: { fa: BrepFace; fb: BrepFace; edge: Map<string, { id: string; flip: boolean }>; vertex: Map<string, string> } | null = null;
  for (const fb of b.faces) {
    const pb = plane(fb); if (!pb) continue;
    const eb = edgesOf(fb, B);
    for (const fa of a.faces) {
      const pa = plane(fa);
      if (!pa || fa.loops.length !== fb.loops.length || dot(pa.n, pb.n) > -1 + 1e-9 || Math.abs(dot(sub(pb.o, pa.o), pa.n)) > tol) continue;
      const ea = edgesOf(fa, A);
      if (ea.length !== eb.length) continue;
      const vertex = new Map<string, string>(), edge = new Map<string, { id: string; flip: boolean }>(), used = new Set<string>();
      const near = (p: Point, q: Point) => len(sub(p, q)) <= tol;
      for (const e of eb) {
        const q = [0.25, 0.5, 0.75].map(s => at(e.curve, s));
        const hit = ea.find(f => !used.has(f.id) && (q.every((x, i) => near(x, at(f.curve, [0.25, 0.5, 0.75][i]))) || q.every((x, i) => near(x, at(f.curve, [0.75, 0.5, 0.25][i])))));
        if (!hit) break;
        const flip = !near(q[0], at(hit.curve, 0.25)), [h0, h1] = flip ? [hit.vertices[1], hit.vertices[0]] : hit.vertices;
        if (!near(B.vertices.get(e.vertices[0])!.point, A.vertices.get(h0)!.point) || !near(B.vertices.get(e.vertices[1])!.point, A.vertices.get(h1)!.point)) break;
        if ((vertex.get(e.vertices[0]) ?? h0) !== h0 || (vertex.get(e.vertices[1]) ?? h1) !== h1) break;
        vertex.set(e.vertices[0], h0); vertex.set(e.vertices[1], h1); edge.set(e.id, { id: hit.id, flip }); used.add(hit.id);
      }
      if (edge.size === eb.length) { match = { fa, fb, edge, vertex }; break; }
    }
    if (match) break;
  }
  if (!match) return null;
  const { fa, fb, edge, vertex } = match;

  // Ids are prefixed so that the two B-reps' ids stay apart.
  const ia = (id: string) => `a.${id}`, ib = (id: string) => `b.${id}`;
  const faceInputs = (x: Brep, X: typeof A, skip: BrepFace, id: (s: string) => string, remap?: typeof edge) => x.faces.filter(f => f !== skip).map(f => ({
    id: id(f.id), surface: f.surface, sense: f.sense, ...(f.name === undefined ? {} : { name: f.name }),
    loops: f.loops.map((lid): BrepLoopInput => {
      const l = X.loops.get(lid)!;
      return { kind: l.kind, uses: l.coedges.map(cid => {
        const c = X.coedges.get(cid)!, m = remap?.get(c.edge);
        if (!m) return { edge: id(c.edge), sense: c.sense, pcurve: c.pcurve };
        // A merged edge: the use keeps its way round, on the first solid's edge (its pcurve is dropped when reversed).
        return { edge: ia(m.id), sense: m.flip === (c.sense === 'forward') ? 'reversed' : 'forward', pcurve: m.flip ? null : c.pcurve };
      }) };
    }),
  }));
  const faces = [...faceInputs(a, A, fa, ia), ...faceInputs(b, B, fb, ib, edge)];

  // The merged edges now part the faces on either side: they are named after those.
  const merged = new Set([...edge.values()].map(m => ia(m.id))), around = new Map<string, Set<string>>();
  for (const f of faces) for (const l of f.loops) for (const u of l.uses) if (merged.has(u.edge)) { const s = around.get(u.edge) ?? new Set(); if (f.name) s.add(f.name); around.set(u.edge, s); }
  const keep = (x: Brep, id: (s: string) => string, drop: (e: string) => boolean) => x.edges.filter(e => !drop(e.id)).map(e => {
    const name = merged.has(id(e.id)) && around.get(id(e.id))?.size === 2 ? [...around.get(id(e.id))!].sort().join('|') : e.name;
    const vid = (v: string) => (x === b && vertex.has(v)) ? ia(vertex.get(v)!) : id(v);
    return { id: id(e.id), curve: e.curve, vertices: [vid(e.vertices[0]), vid(e.vertices[1])] as [string, string], ...(name === undefined ? {} : { name }) };
  });
  return buildBrep({
    source,
    vertices: [...a.vertices.map(v => ({ id: ia(v.id), point: v.point })), ...b.vertices.filter(v => !vertex.has(v.id)).map(v => ({ id: ib(v.id), point: v.point }))],
    edges: [...keep(a, ia, () => false), ...keep(b, ib, e => edge.has(e))],
    bodies: [{ id: a.bodies[0].id, kind: 'solid', shells: [{ id: ia(a.shells[0].id), faces, closed: true }] }],
  });
}
