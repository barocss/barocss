// R5.3 (D223): the edge finishes of the part model — fillet and chamfer — moved out of part-model.ts's operation() as
// they were there. Since D361 the finishing helpers (`finishEdges` and what it calls) live here too; they reach
// part-model's values through a function-level import. The dispatcher calls `finishOperation` for those kinds.
import { type FilletReport } from '../blend/rolling-ball.js';
import { BrepError, buildBrep, isFacetFace, lineCurve, type Brep } from '../brep/brep-core.js';
import { brepFromPrismatic, type PrismaticSolid } from '../features/prismatic-solid.js';
import { booleanCurveRegions, curveTolerance, segEnd, type CurveSegment2, type XY } from '../brep/curved-arrangement.js';
import { booleanAnalytic } from '../brep/analytic-boolean.js';
import { faceReach, finishBrepEdges } from '../blend/edge-finish.js';
import { add, cross, dot, len, scale, sub, unit } from '../core/vec3.js';
import { brepOf, profiling, planarBoolean, planarBrep } from './part-model.js';
import type { CadPartDim, CadPartPoint3, CadPartFeature, Result, Tools, PartHelpers, Part, Solid, CadPartErrorCode } from './part-model.js';

/** A fillet or chamfer feature's evaluation (part-model.ts's operation() for these kinds). */
export function finishOperation(f: CadPartFeature & Record<string, unknown>, t: Tools, k: PartHelpers): () => Result {
  const { dim, xyz, solids, fail, at } = t;
  const { CadPartLimits } = k;
  switch (f.kind) {
    case 'chamfer': case 'fillet': {
      const target = solids(f.target, 'target'), varying = f.kind === 'fillet' && f.radii !== undefined;
      if (varying && f.radius !== undefined) fail('INPUT', 'give radius or radii, not both');
      if (varying && (!Array.isArray(f.radii) || f.radii.length < 2 || f.radii.length > 16)) fail('INPUT', 'radii must list 2 to 16 points, each { at: [x, y, z], radius }');
      const authored = varying ? (f.radii as { at: CadPartPoint3; radius: CadPartDim; atEnd?: unknown }[]).map((p, k) => {
        if (p?.atEnd !== undefined && p.atEnd !== true) fail('INPUT', `radii[${k}].atEnd is true or left out`);
        return { at: xyz(p?.at, `radii[${k}].at`), radius: dim(p?.radius as CadPartDim, `radii[${k}].radius`, true), atEnd: p?.atEnd === true };
      }) : undefined;
      if (authored && authored.filter(p => p.atEnd).length > 2) fail('INPUT', 'at most two radii are at the chain\'s ends');
      const sec = f.kind === 'fillet' ? f.section : undefined;
      if (sec !== undefined && (typeof sec !== 'object' || !['circular', 'conic', 'g2'].includes((sec as { kind?: string }).kind ?? ''))) fail('INPUT', 'section must be { kind: circular | conic (rho) | g2 (tension?) }');
      if (sec?.kind === 'conic' && !(typeof sec.rho === 'number' && sec.rho > 0 && sec.rho < 1)) fail('INPUT', 'a conic section needs rho between 0 and 1');
      if (sec?.kind === 'g2' && sec.tension !== undefined && !(typeof sec.tension === 'number' && sec.tension > 0 && sec.tension < 1)) fail('INPUT', 'a G2 section\'s tension lies between 0 and 1');
      const shape = sec?.kind === 'conic' ? { kind: 'conic' as const, rho: sec.rho } : sec?.kind === 'g2' ? { kind: 'g2' as const, tension: sec.tension ?? 0.5 } : undefined;
      const size = authored ? Math.max(...authored.map(p => p.radius)) : dim((f.kind === 'chamfer' ? f.distance : f.radius) as CadPartDim, f.kind === 'chamfer' ? 'distance' : 'radius', true);
      if (Array.isArray(f.edges) && f.edges.length > CadPartLimits.edges && f.edges.every(e => typeof e === 'string')) fail('INPUT', `[FINISH_EDGES_LIMIT] a ${f.kind} takes at most ${CadPartLimits.edges} edges: this one lists ${f.edges.length}`);
      if (!Array.isArray(f.edges) || !f.edges.length || f.edges.length > CadPartLimits.edges || !f.edges.every(e => typeof e === 'string')) fail('INPUT', 'edges must list 1 to 64 edge names');
      if (target.length !== 1) fail('REFERENCE', 'finish one part at a time (name it as id/k)');
      return () => {
        const t = target[0], kind = f.kind as 'chamfer' | 'fillet', reports: FilletReport[] = [];
        const radii = authored && atChainEnds(authored, k.brepOf(t, 'target'), f.edges as string[], fail);
        const solid = finishEdges(t, f.edges as string[], size, kind, at, fail, reports, radii, shape);
        // A body that left the upright family keeps how it was made, so that it can still be shelled — past a
        // variable-radius fillet too (its hollow's radius is the outer one less the wall, D108), not past a conic or G2 one.
        const base = t.solid.kind === 'upright' ? t.solid.solid : t.history?.base, before = t.solid.kind === 'upright' ? [] : t.history?.finishes ?? [];
        const history = solid.kind === 'brep' && base && !shape ? { base, finishes: [...before, { kind, edges: f.edges as string[], size, id: at, ...(radii ? { radii } : {}) }] } : undefined;
        return { kind: 'solid', parts: [{ solid, ...(history ? { history } : {}), ...(reports.length ? { fillet: reports } : {}) }] };
      };
    }
  }
  throw new Error(`finishOperation: ${f.kind} is not one of its features`);
}

type Point = [number, number, number];
/**
 * The radii with the points `atEnd` ones stand for on this body: the two ends of the open chain the edges make, each
 * radius at the end nearest its authored point (a pair: the pairing nearer in all). Other points are kept as given.
 */
function atChainEnds(radii: readonly { at: Point; radius: number; atEnd: boolean }[], brep: ReturnType<PartHelpers['brepOf']>,
  names: readonly string[], fail: Tools['fail']): { at: Point; radius: number }[] {
  const plain = radii.map(p => ({ at: p.at, radius: p.radius })), ending = radii.flatMap((p, i) => p.atEnd ? [i] : []);
  if (!ending.length) return plain;
  const uses = new Map<string, number>();
  for (const name of names) {
    const e = brep.edges.find(x => x.name === name);
    if (!e) fail('SELECTION', `no edge named ${name}`);
    for (const v of e!.vertices) uses.set(v, (uses.get(v) ?? 0) + 1);
  }
  const ends = [...uses].filter(([, n]) => n === 1).map(([v]) => brep.vertices.find(x => x.id === v)!.point as Point);
  if (ends.length !== 2) fail('SELECTION', 'a radius at the chain\'s end needs the edges to make one open chain');
  const d = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  if (ending.length === 1) { const p = radii[ending[0]].at; plain[ending[0]].at = [...(d(p, ends[0]) <= d(p, ends[1]) ? ends[0] : ends[1])]; return plain; }
  const [i, j] = ending, keep = d(radii[i].at, ends[0]) + d(radii[j].at, ends[1]) <= d(radii[i].at, ends[1]) + d(radii[j].at, ends[0]);
  plain[i].at = [...ends[keep ? 0 : 1]]; plain[j].at = [...ends[keep ? 1 : 0]];
  return plain;
}
// Edge-finishing helpers moved from part-model.ts (3b, D361).
// ---- chamfers and fillets ------------------------------------------------------------------------------
export function finishEdges(part: Part, names: string[], size: number, kind: 'chamfer' | 'fillet', at: string, fail: Tools['fail'], reports?: FilletReport[], radii?: readonly { at: Point; radius: number }[], shape?: { kind: 'conic'; rho: number } | { kind: 'g2'; tension: number }): Solid {
  if (profiling) profiling.finishes++;
  // Vertical corners of an upright body keep it upright (its section is finished exactly); straight
  // chamfers elsewhere cut a wedge; every other edge (sloping or curved, on any body) gets a rolling-ball
  // tool (finishBrepEdges).
  const brep = brepOf(part, 'target'), byName = new Map(brep.edges.map(e => [e.name, e]));
  // (F0: a mesh body's region edges cannot be rounded yet; its names would not survive the planar path.)
  if (brep.faces.some(isFacetFace)) fail('CAPABILITY', `${kind} on mesh faces is not supported yet (general fillet and chamfer arrive with R10)`);
  const vertical: { x: number; y: number; z0: number; z1: number; name: string }[] = [], wedges: Brep['edges'][number][] = [], general: string[] = [];
  for (const name of names) {
    const e = byName.get(name);
    if (!e) fail('SELECTION', `no edge named ${name}; edges: ${brep.edges.slice(0, 12).map(x => x.name).join(', ')}${brep.edges.length > 12 ? ', …' : ''}`);
    const p = e!.curve.controlPoints, a = p[0], b = p[p.length - 1], straight = e!.curve.degree === 1 && p.length === 2;
    const tol = 1e-9 * Math.max(1, ...a.map(Math.abs), ...b.map(Math.abs));
    // (A variable radius: every edge the rolling ball's, D100.)
    if (radii || shape) { general.push(name); continue; }
    if (straight && part.solid.kind === 'upright' && Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && uprightCorner(part.solid.solid, a[0], a[1], tol)) vertical.push({ x: a[0], y: a[1], z0: Math.min(a[2], b[2]), z1: Math.max(a[2], b[2]), name: name });
    else if (straight && kind === 'chamfer') wedges.push(e!);
    else general.push(name);
  }
  // A vertical edge meeting another finished edge at a vertex goes with it (their corner is one blend).
  if (general.length || wedges.length) {
    const ends = [...general.map(n => byName.get(n)!), ...wedges].flatMap(e => [e.curve.controlPoints[0], e.curve.controlPoints[e.curve.controlPoints.length - 1]]);
    for (let i = vertical.length - 1; i >= 0; i--) {
      const c = vertical[i], tol = 1e-9 * Math.max(1, Math.abs(c.x), Math.abs(c.y), Math.abs(c.z0), Math.abs(c.z1));
      if (ends.some(p => Math.abs(p[0] - c.x) <= tol && Math.abs(p[1] - c.y) <= tol && (Math.abs(p[2] - c.z0) <= tol || Math.abs(p[2] - c.z1) <= tol))) { general.push(c.name); vertical.splice(i, 1); }
    }
  }
  let solid = part.solid;
  if (vertical.length) solid = { kind: 'upright', solid: cornerFinish((solid as Extract<Solid, { kind: 'upright' }>).solid, vertical, size, kind, at, fail) };
  for (const e of wedges) solid = wedgeChamfer(solid, brep, e, size, at, fail);
  if (general.length) {
    const body = solid.kind === 'upright' ? brepFromPrismatic(solid.solid) : solid.brep;
    try { solid = { kind: 'brep', brep: finishBrepEdges(body, general, size, kind, at, { reports, ...(radii ? { radii } : {}), ...(shape ? { shape } : {}) }) }; }
    catch (cause) {
      const m = cause instanceof BrepError ? /^B-rep: (SELECTION|CAPABILITY|PARAMETER): (.*)$/s.exec(cause.message) : null;
      if (m) fail(m[1] as CadPartErrorCode, m[2]);
      if (cause instanceof BrepError && /not supported yet/.test(cause.message)) fail('CAPABILITY', cause.message.replace(/^B-rep: analytic Boolean: /, ''));
      throw cause;
    }
  }
  return solid;
}
/** Whether (x, y) is a corner between two straight walls in some slab of an upright body. */
function uprightCorner(solid: PrismaticSolid, x: number, y: number, tol: number): boolean {
  return solid.slabs.some(slab => slab.regions.some(r => [r.outer, ...r.holes].some(ring => ring.some((s, i) => {
    const n = ring[(i + 1) % ring.length], p = segEnd(s);
    return Math.hypot(p[0] - x, p[1] - y) <= Math.max(tol, 1e-9) && s.kind === 'line' && n.kind === 'line';
  }))));
}

/** Chamfer or round the ring corners at the selected vertical edges, in every slab the edge spans. */
function cornerFinish(solid: PrismaticSolid, corners: { x: number; y: number; z0: number; z1: number; name: string }[], size: number, kind: 'chamfer' | 'fillet', at: string, fail: Tools['fail']): PrismaticSolid {
  const tol = curveTolerance(solid.slabs.flatMap(s => s.regions.flatMap(r => [r.outer, ...r.holes])));
  const done = new Set<string>();
  const slabs = solid.slabs.map(slab => {
    const here = corners.filter(c => c.z0 <= slab.z0 + tol && c.z1 >= slab.z1 - tol);
    if (!here.length) return slab;
    const rings = slab.regions.flatMap(r => [r.outer, ...r.holes]).map(ring => {
      let out = [...ring];
      for (const c of here) {
        let i = out.findIndex(s => Math.hypot(segEnd(s)[0] - c.x, segEnd(s)[1] - c.y) <= tol);
        if (i < 0) continue;
        // Rotate so the corner's two segments are consecutive without wrapping.
        if (i === out.length - 1) { out = [out[i], ...out.slice(0, i)]; i = 0; }
        const s1 = out[i], s2 = out[(i + 1) % out.length];
        if (s1.kind !== 'line' || s2.kind !== 'line') fail('CAPABILITY', `edge ${c.name}: only corners between two straight walls can be finished yet`);
        const l1 = s1 as Extract<CurveSegment2, { kind: 'line' }>, l2 = s2 as Extract<CurveSegment2, { kind: 'line' }>;
        const L1 = Math.hypot(l1.b[0] - l1.a[0], l1.b[1] - l1.a[1]), L2 = Math.hypot(l2.b[0] - l2.a[0], l2.b[1] - l2.a[1]);
        const u: XY = [(l1.b[0] - l1.a[0]) / L1, (l1.b[1] - l1.a[1]) / L1], v: XY = [(l2.b[0] - l2.a[0]) / L2, (l2.b[1] - l2.a[1]) / L2];
        const cross = u[0] * v[1] - u[1] * v[0], dot = u[0] * v[0] + u[1] * v[1];
        if (Math.abs(cross) < 1e-9) fail('SELECTION', `edge ${c.name} joins two walls in line; there is no corner to finish`);
        const turn = Math.atan2(cross, dot), back = kind === 'chamfer' ? size : size * Math.tan(Math.abs(turn) / 2);
        if (back >= L1 - tol || back >= L2 - tol) fail('PARAMETER', `[RADIUS_EXCEEDS_FACE] edge ${c.name}: ${kind} ${size} mm is too large for walls of ${+L1.toFixed(6)} and ${+L2.toFixed(6)} mm`);
        const p = l1.b, A: XY = [p[0] - u[0] * back, p[1] - u[1] * back], B: XY = [p[0] + v[0] * back, p[1] + v[1] * back];
        let corner: CurveSegment2;
        if (kind === 'chamfer') corner = { kind: 'line', a: A, b: B, tag: `${at}.face` };
        else {
          const n: XY = turn > 0 ? [-u[1], u[0]] : [u[1], -u[0]], centre: XY = [A[0] + n[0] * size, A[1] + n[1] * size];
          corner = { kind: 'arc', c: centre, r: size, t0: Math.atan2(A[1] - centre[1], A[0] - centre[0]), sweep: turn, tag: `${at}.face` };
        }
        out.splice(i, 2, { ...l1, b: A }, corner, { ...l2, a: B });
        done.add(c.name);
      }
      return out;
    });
    return { ...slab, regions: booleanCurveRegions(rings, [], 'union', tol) };
  });
  for (const c of corners) if (!done.has(c.name)) fail('SELECTION', `edge ${c.name} is not a corner of a wall section`);
  return { ...solid, slabs };
}

/** A straight edge between two planar faces: cut away (convex) or fill (concave) a triangular prism. */
function wedgeChamfer(solid: Solid, source: Brep, edge: Brep['edges'][number], d: number, at: string, fail: Tools['fail']): Solid {
  const uses = source.coedges.filter(c => c.edge === edge.id);
  if (uses.length !== 2) fail('SELECTION', `edge ${edge.name} does not join exactly two faces`);
  const faceOf = (loopId: string) => source.faces.find(f => f.loops.includes(loopId))!;
  const P = edge.curve.controlPoints[0], Q = edge.curve.controlPoints[1], e = unit(sub(Q, P));
  const sides = uses.map(c => {
    const f = faceOf(c.loop), s = f.surface;
    if (s.kind !== 'surface' || !(s.degreeU === 1 && s.degreeV === 1)) fail('CAPABILITY', `edge ${edge.name}: chamfers along horizontal edges need planar faces`);
    const [[p00, p01], [p10]] = s.controlPoints as Point[][], n0 = cross(sub(p10, p00), sub(p01, p00)), n = unit(f.sense === 'forward' ? n0 : [-n0[0], -n0[1], -n0[2]]);
    const dir: Point = c.sense === 'forward' ? e : [-e[0], -e[1], -e[2]];
    return { n, w: unit(cross(n, dir)) }; // w: into the face, perpendicular to the edge
  });
  const [s1, s2] = sides, convex = dot(s2.w, s1.n) < 0;
  // The chamfer must fit on both faces: d at most each face's reach across the edge — cutting, or filling (where
  // every boundary of the face bounds it: a round already made beside a concave edge too, D97).
  const walls = uses.map((c, k) => faceReach(source, faceOf(c.loop).id, edge, sides[k].w, convex)), tol = 1e-6 * Math.max(1, ...P.map(Math.abs), ...Q.map(Math.abs));
  if (walls.some(w => d > w + tol)) fail('PARAMETER', `[RADIUS_EXCEEDS_FACE] edge ${edge.name}: chamfer ${d} mm is too large for walls of ${+walls[0].toFixed(6)} and ${+walls[1].toFixed(6)} mm`);
  const corner = (X: Point) => {
    const A1 = add(X, scale(s1.w, d)), A2 = add(X, scale(s2.w, d)), M = scale(add(A1, A2), 0.5);
    // Grown about the chamfer line so no wedge face lies on a face of the body.
    return [sub(scale(A1, 2), A2), sub(scale(A2, 2), A1), sub(scale(X, 2), M)];
  };
  // The wedge ends where the edge's end face is — oblique too: its corners carried along the edge onto that face's
  // plane. A cutting one runs past an end where the body ends (the Boolean trims it) but not into a wall there; a filling
  // one stops at either (it stopped square before, adding past an oblique end, and a cutting one notched a wall, D98).
  const planes = [0, 1].map(k => endPlaneOf(source, edge, k as 0 | 1)), away = (k: number) => k ? e : scale(e, -1);
  const ends = planes.map((pl, k) => pl && !(convex && dot(pl.n, away(k)) > 0) ? pl : null), past = planes.map((pl, k) => convex && !ends[k] ? d : 0);
  const onto = (T: Point[], pl: { o: Point; n: Point } | null) => pl ? T.map(X => add(X, scale(e, dot(sub(pl.o, X), pl.n) / dot(e, pl.n)))) : T;
  const T0 = onto(corner(sub(P, scale(e, past[0]))), ends[0]), T1 = onto(corner(add(Q, scale(e, past[1]))), ends[1]);
  const wedge = prismBrep(T0, T1, `${at}.face`);
  const body = solid.kind === 'upright' ? brepFromPrismatic(solid.solid) : solid.brep;
  // (A wedge ending in an end face's plane: the analytic Boolean, which takes the coplanar cap; the polyhedral one does not, D98.)
  if (planarBrep(body) && !ends.some(Boolean)) return { kind: 'brep', brep: planarBoolean(body, wedge, convex ? 'difference' : 'union', at) };
  try { return { kind: 'brep', brep: booleanAnalytic(body, wedge, convex ? 'difference' : 'union', { id: at }) }; }
  catch (cause) { if (cause instanceof BrepError && /not supported yet/.test(cause.message)) fail('CAPABILITY', `edge ${edge.name}: the chamfer would cut a curved face at an angle (not supported yet)`); throw cause; }
}

/**
 * The plane of the faces (not the edge's own two) meeting a straight edge at its end k — one face, or several in one
 * plane (a step's two blocks' ends) — when planar and not along the edge, its normal out of the body; else null (the
 * wedge stops square there, a cutting one run past).
 */
function endPlaneOf(source: Brep, edge: Brep['edges'][number], k: 0 | 1): { o: Point; n: Point } | null {
  const v = edge.vertices[k], loopFace = new Map(source.loops.map(l => [l.id, l.face])), facesOf = (id: string) => source.coedges.filter(c => c.edge === id).map(c => loopFace.get(c.loop)!);
  const own = new Set(facesOf(edge.id)), at = [...new Set(source.edges.filter(x => x.vertices.includes(v)).flatMap(x => facesOf(x.id)).filter(f => !own.has(f)))];
  const p = edge.curve.controlPoints, e = unit(sub(p[p.length - 1], p[0])), tol = 1e-9 * Math.max(1, ...p.flat().map(Math.abs));
  let plane: { o: Point; n: Point } | null = null;
  for (const id of at) {
    const face = source.faces.find(x => x.id === id)!, s = face.surface;
    if (s.kind !== 'surface' || !(s.degreeU === 1 && s.degreeV === 1 && s.controlPoints.length === 2 && s.controlPoints[0].length === 2)) return null;
    const [[p00, p01], [p10]] = s.controlPoints as Point[][], n0 = unit(cross(sub(p10, p00), sub(p01, p00))), n = face.sense === 'forward' ? n0 : scale(n0, -1);
    if (!plane) plane = { o: p00, n };
    else if (len(sub(n, plane.n)) > 1e-9 || Math.abs(dot(sub(p00, plane.o), plane.n)) > tol) return null;
  }
  return plane && Math.abs(dot(plane.n, e)) > 1e-6 ? plane : null;
}
/** A triangular prism between triangles T0 and T1 (corresponding corners), faces pointing out. */
function prismBrep(T0: Point[], T1: Point[], name: string): Brep {
  const a = T0[0], A = T1[0];
  let [b, c] = [T0[1], T0[2]], [B, C] = [T1[1], T1[2]];
  // Orient so the T0 triangle faces away from T1.
  if (dot(cross(sub(b, a), sub(c, a)), sub(A, a)) > 0) { [b, c] = [c, b]; [B, C] = [C, B]; }
  const pts = [a, b, c, A, B, C];
  const faces = [[0, 1, 2], [3, 5, 4], [0, 3, 4, 1], [1, 4, 5, 2], [2, 5, 3, 0]];
  const plane = (ids: number[]) => { const p = ids.map(i => pts[i]), n = unit(cross(sub(p[1], p[0]), sub(p[2], p[0]))), e1 = unit(sub(p[1], p[0])), e2 = cross(n, e1);
    const uv = p.map(q => [dot(sub(q, p[0]), e1), dot(sub(q, p[0]), e2)]), u0 = Math.min(...uv.map(x => x[0])) - 1, u1 = Math.max(...uv.map(x => x[0])) + 1, v0 = Math.min(...uv.map(x => x[1])) - 1, v1 = Math.max(...uv.map(x => x[1])) + 1;
    const pt = (u: number, v: number): Point => add(p[0], add(scale(e1, u), scale(e2, v)));
    return { kind: 'surface' as const, id: 'w', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[pt(u0, v0), pt(u0, v1)], [pt(u1, v0), pt(u1, v1)]], weights: [[1, 1], [1, 1]] };
  };
  const edgeIds = new Map<string, { id: string; v: [number, number] }>();
  const use = (i: number, j: number) => { const k = i < j ? `${i}-${j}` : `${j}-${i}`; let e = edgeIds.get(k); if (!e) { e = { id: 'e' + edgeIds.size, v: i < j ? [i, j] : [j, i] }; edgeIds.set(k, e); } return { edge: e.id, sense: (e.v[0] === i ? 'forward' : 'reversed') as 'forward' | 'reversed' }; };
  const faceInputs = faces.map((ids, fi) => ({ id: 'f' + fi, name, surface: plane(ids), sense: 'forward' as const, loops: [{ kind: 'outer' as const, uses: ids.map((v, k) => use(v, ids[(k + 1) % ids.length])) }] }));
  return buildBrepLocal(pts, [...edgeIds.values()], faceInputs);
}
function buildBrepLocal(pts: Point[], edges: { id: string; v: [number, number] }[], faces: Parameters<typeof buildBrep>[0]['bodies'][number]['shells'][number]['faces']): Brep {
  return buildBrep({ source: { family: 'wedge', id: 'wedge' }, vertices: pts.map((p, i) => ({ id: 'v' + i, point: p })),
    edges: edges.map(e => ({ id: e.id, curve: lineCurve(e.id, pts[e.v[0]], pts[e.v[1]]), vertices: ['v' + e.v[0], 'v' + e.v[1]] as [string, string] })),
    bodies: [{ id: 'wedge', kind: 'solid', shells: [{ id: 's', closed: true, faces }] }] });
}
