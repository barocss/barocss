// Shell of a body whose smooth regions hold freeform or trimmed faces and meet at sharp edges (R11.2c-2, D113): the wall
// as the union of a slab per piece of the boundary, and the shell the body within it (the slab route's way, D105–D108),
// with two kinds of slab that need no growth across an edge:
//
//   a plane that bounds the body (every point of the body on its inner side): its band, from the wall inside to 1.37
//     walls out, unbounded along the plane. Inside the body, a point within the wall of the plane is within the wall of
//     the boundary (the segment to the plane leaves the body), so the band needs neither the face's outline nor any
//     growth — a plane bounded by a conic or a trimmed curve is as any other;
//   a smooth region of the offset route's faces (untrimmed patches, planes and cylinders however trimmed): its slab, the
//     region offset in by the wall and out by its reach, closed along its edges by bands ruled along its normals.
//
// At a sharp edge between a region and a bounding plane, the region's end lies inside the plane's band (its normal there
// lies in the plane, or near it); so every face of the union inside the body is the hollow's, and the slabs, the body
// and each other meet transversally. A face opened next to a region: the body is first extended through it (a prism
// on the face glued to it), the slabs are those of the extended body — the region's run out past the opening — and the
// shell is the original body within them. Refused by name: a sharp edge between two regions, a plane that does not
// bound the body beside a region, a face of another kind, an opened face beside a region that is not a plane.
import { BrepError, buildBrep, nurbsOf, type Brep, type BrepFace } from '../brep/brep-core.js';
import { booleanAnalytic, faceGeometry } from '../brep/analytic-boolean.js';
import { glueAtSharedFace, withCavities } from '../brep/brep-glue.js';
import { tessellateBrep } from '../brep/brep-tessellate.js';
import { brepFromPrismatic, prismaticExtrude } from '../features/prismatic-solid.js';
import { transformBrep } from '../brep/brep-transform.js';
import { joined } from './general-shell.js';
import { edgeAngles, offsetFace, regionSlab, SMOOTH_EDGE } from './offset-cavity.js';
import { curveDomain, evaluateCurve } from '../core/math.js';
import { add, cross, dot, len, scale, sub, unit } from '../core/vec3.js';
import type { CurveSegment2, XY } from '../brep/curved-arrangement.js';
import type { Curve, Point, Surface } from '../types.js';

const refuse = (detail: string): never => { throw new BrepError('GEOMETRY', `CAPABILITY: shell: ${detail}`); };
/** How far a slab reaches out of the body, in walls (the slab route's). */
const OUT = 1.37;

/** The shell of `body` t thick, the faces named in `open` opened, by bounding planes' bands and regions' slabs. */
export function regionShell(body: Brep, t: number, open: ReadonlySet<string>, id: string): Brep {
  try { return shellBy(body, t, open, id); }
  catch (cause) {
    if (cause instanceof BrepError && /CAPABILITY: shell:/.test(cause.message)) throw cause;
    return refuse(`[SHELL_NOT_CLOSED] a wall of ${t} mm cannot be closed on this body by its regions' slabs: ${cause instanceof Error ? cause.message.replace(/^B-rep: /, '') : String(cause)}`);
  }
}

function shellBy(body: Brep, t: number, open: ReadonlySet<string>, id: string): Brep {
  if (!(t > 0)) refuse('the wall must be positive');
  let parts = partsOf(body, open);
  // A face opened beside a region: the body run out through it (a prism on it, 2 walls deep), the parts the extended body's.
  let work = body;
  const opened = new Set(open);
  const besideRegion = (b: Brep, p: ReturnType<typeof partsOf>) => b.faces.filter(f => f.name && opened.has(f.name) && p.neighbours(f).some(g => p.regionOf.has(g.id)));
  const exits = besideRegion(body, parts);
  if (exits.length) {
    for (const f0 of exits) {
      // (Each on the body as extended so far: an earlier prism's glue renames its faces.)
      const f = work.faces.find(x => x.name === f0.name)!, g = planeOf(f) ?? refuse(`[SHELL_OPENING_NOT_PLANAR] the opened face ${f.name} lies beside a smooth region and is not a plane: opening there is not supported yet`);
      const prism = prismOn(work, f, g.n, 2 * t, `${id}_x${exits.indexOf(f0)}`);
      work = glueAtSharedFace(work, prism, work.source) ?? refuse(`[SHELL_OPENING_NOT_PLANAR] the opened face ${f.name} could not be extended through`);
      opened.delete(f.name!); opened.add(`${f.name}.ext`);
    }
    parts = partsOf(work, opened);
  }
  const size = parts.size, slabs: Brep[] = [];
  parts.bands.forEach((P, k) => slabs.push(bandOf(P.n, P.o, t, 4 * size * (1 + 0.013 * k), `${id}_p${k}`)));
  parts.regions.forEach((R, k) => slabs.push(regionSlab(work, R, t, `${id}_g${k}`, id).slab));
  if (!slabs.length) refuse('every face is opened');
  const wall = joined(slabs, `${id}_wall`);
  // Nothing opened: the union's voids are the hollow (its slabs reach out of the body everywhere), the body's cavities.
  if (!open.size) return wall.bodies.flatMap(b => b.shells.slice(1)).reduce((acc, sh, k) => withCavities(acc, voidSolid(wall, sh, `${id}_h${k}`), { family: 'shell', id }), body);
  return booleanAnalytic(body, wall, 'intersection', { id, exactEdges: true });
}

/** A void of a solid (one of its inner shells) as a solid of its own: its faces turned to face out of it. */
function voidSolid(b: Brep, shellId: string, id: string): Brep {
  const sh = b.shells.find(x => x.id === shellId)!, faces = sh.faces.map(fid => b.faces.find(f => f.id === fid)!);
  const loops = new Map(b.loops.map(l => [l.id, l])), coedges = new Map(b.coedges.map(c => [c.id, c]));
  const usedEdges = new Set(faces.flatMap(f => f.loops.flatMap(lid => loops.get(lid)!.coedges.map(cid => coedges.get(cid)!.edge))));
  const edges = b.edges.filter(e => usedEdges.has(e.id)), usedVerts = new Set(edges.flatMap(e => [...e.vertices]));
  return buildBrep({
    source: { family: 'shell', id },
    vertices: b.vertices.filter(v => usedVerts.has(v.id)).map(v => ({ id: v.id, point: v.point, toleranceMM: v.toleranceMM })),
    edges: edges.map(e => ({ id: e.id, curve: e.curve, vertices: [e.vertices[0], e.vertices[1]] as [string, string], toleranceMM: e.toleranceMM, ...(e.name === undefined ? {} : { name: e.name }) })),
    bodies: [{ id, kind: 'solid', shells: [{ id: `${id}_s`, closed: true, faces: faces.map(f => ({ id: f.id, surface: f.surface as Surface, sense: (f.sense === 'forward' ? 'reversed' : 'forward') as 'forward' | 'reversed', ...(f.name === undefined ? {} : { name: f.name }),
      loops: f.loops.map(lid => { const l = loops.get(lid)!; return { kind: l.kind, uses: [...l.coedges].reverse().map(cid => { const c = coedges.get(cid)!; return { edge: c.edge, sense: (c.sense === 'forward' ? 'reversed' : 'forward') as 'forward' | 'reversed' }; }) }; }) })) }] }],
  });
}

/** A face's plane (outward unit normal, a point on it), or null. */
function planeOf(f: BrepFace): { n: Point; o: Point } | null {
  try { const g = faceGeometry(f); return g.kind === 'plane' ? { n: unit(g.n), o: g.o } : null; } catch { return null; }
}

/**
 * The kept faces in their parts: smooth components (faces joined by edges within SMOOTH_EDGE) that are faces of one
 * bounding plane (bands), or regions of the offset route's faces. Every sharp edge between kept faces has a band on a
 * side.
 */
function partsOf(body: Brep, open: ReadonlySet<string>) {
  let size = 1;
  for (const v of body.vertices) for (const x of v.point) size = Math.max(size, Math.abs(x));
  const loops = new Map(body.loops.map(l => [l.id, l])), coedges = new Map(body.coedges.map(c => [c.id, c]));
  const kept = body.faces.filter(f => !(f.name && open.has(f.name))), keptIds = new Set(kept.map(f => f.id));
  const facesOf = new Map<string, BrepFace[]>();
  for (const f of body.faces) for (const lid of f.loops) for (const cid of loops.get(lid)!.coedges) { const e = coedges.get(cid)!.edge; facesOf.set(e, [...(facesOf.get(e) ?? []), f]); }
  const angles = edgeAngles(body, keptIds), planes = new Map(kept.map(f => [f.id, planeOf(f)])), offsetable = new Map(kept.map(f => [f.id, offsetFace(body, f)]));
  // Two kept faces' edge is smooth: its normals within SMOOTH_EDGE (two planes: their normals the same).
  const smooth = (e: string, a: BrepFace, b: BrepFace) => {
    const pa = planes.get(a.id), pb = planes.get(b.id);
    if (pa && pb && !offsetable.get(a.id) && !offsetable.get(b.id)) return len(cross(pa.n, pb.n)) < SMOOTH_EDGE && dot(pa.n, pb.n) > 0;
    const angle = angles.get(e);
    return angle !== undefined ? angle <= SMOOTH_EDGE : !!(pa && pb && len(cross(pa.n, pb.n)) < SMOOTH_EDGE && dot(pa.n, pb.n) > 0);
  };
  // Components by union–find over the smooth edges.
  const root = new Map(kept.map(f => [f.id, f.id])), find = (x: string): string => { let r = x; while (root.get(r) !== r) r = root.get(r)!; root.set(x, r); return r; };
  const sharp: { e: string; a: BrepFace; b: BrepFace }[] = [];
  for (const [e, fs] of facesOf) {
    if (fs.length !== 2 || fs[0] === fs[1] || !keptIds.has(fs[0].id) || !keptIds.has(fs[1].id)) continue;
    if (smooth(e, fs[0], fs[1])) root.set(find(fs[0].id), find(fs[1].id)); else sharp.push({ e, a: fs[0], b: fs[1] });
  }
  const groups = new Map<string, BrepFace[]>();
  for (const f of kept) groups.set(find(f.id), [...(groups.get(find(f.id)) ?? []), f]);
  // The body's points (its tessellation's, on its faces) for the bounding test.
  const P = tessellateBrep(body, { segmentsPerQuarter: 8 }).positionsMM;
  const bounds = (n: Point, o: Point) => { const tol = 1e-6 * size; for (let i = 0; i < P.length; i += 3) if ((P[i] - o[0]) * n[0] + (P[i + 1] - o[1]) * n[1] + (P[i + 2] - o[2]) * n[2] > tol) return false; return true; };
  const bands: { n: Point; o: Point; faces: BrepFace[] }[] = [], regions: Set<string>[] = [], bandOf = new Map<string, number>(), regionOf = new Map<string, number>(), crossed = new Set<string>();
  for (const fs of groups.values()) {
    const p0 = planes.get(fs[0].id);
    const flat = !!p0 && fs.every(f => { const p = planes.get(f.id); return !!p && len(cross(p.n, p0.n)) < SMOOTH_EDGE && Math.abs(dot(sub(p.o, p0.o), p0.n)) < 1e-7 * size; });
    if (flat && bounds(p0!.n, p0!.o)) { for (const f of fs) bandOf.set(f.id, bands.length); bands.push({ n: p0!.n, o: p0!.o, faces: fs }); continue; }
    // (A plane the body crosses — a step, a pocket — is a region of its own: its sharp edges must border bands.)
    if (flat) for (const f of fs) crossed.add(f.id);
    for (const f of fs) if (!offsetable.get(f.id)) refuse(`[SHELL_FACE_KIND] face ${f.name ?? f.id} is not an untrimmed patch, a plane or a cylinder beside a sharp edge: shelling it is not supported yet`);
    for (const f of fs) regionOf.set(f.id, regions.length);
    regions.push(new Set(fs.map(f => f.id)));
  }
  for (const { e, a, b } of sharp) {
    if (bandOf.has(a.id) || bandOf.has(b.id)) continue;
    const at = facesOf.get(e) && body.edges.find(x => x.id === e), p = at ? evaluateCurve(at.curve, (curveDomain(at.curve)[0] + curveDomain(at.curve)[1]) / 2) : [0, 0, 0];
    const flatOne = [a, b].find(f => crossed.has(f.id));
    refuse(flatOne
      ? `[SHELL_PLANE_NOT_BOUNDING] face ${flatOne.name ?? flatOne.id} is a plane the body crosses (a step, a pocket, a boss's base), at a sharp edge beside a smooth region: not supported yet`
      : `[SHELL_REGIONS_SHARP] faces ${a.name ?? a.id} and ${b.name ?? b.id} of two smooth regions meet at a sharp edge (at ${p.map(x => +x.toFixed(4)).join(', ')}): shelling there is not supported yet`);
  }
  const neighbours = (f: BrepFace) => f.loops.flatMap(lid => loops.get(lid)!.coedges.flatMap(cid => (facesOf.get(coedges.get(cid)!.edge) ?? []).filter(g => g !== f)));
  return { size, bands, regions, regionOf, neighbours };
}

/** A plane's band: from t inside it to 1.37 t out, a square of half-side L round the origin's foot. */
function bandOf(n: Point, o: Point, t: number, L: number, id: string): Brep {
  const e1 = unit(Math.abs(n[0]) < 0.9 ? cross([1, 0, 0], n) : cross([0, 1, 0], n)), e2 = cross(n, e1), foot = scale(n, dot(o, n));
  const sq: XY[] = [[-L, -L], [L, -L], [L, L], [-L, L]], ring: CurveSegment2[] = sq.map((a, i) => ({ kind: 'line' as const, a, b: sq[(i + 1) % 4] }));
  const box = brepFromPrismatic(prismaticExtrude([ring], -t, OUT * t), { id });
  return transformBrep(box, { matrix: [e1[0], e2[0], n[0], e1[1], e2[1], n[1], e1[2], e2[2], n[2]], offset: [foot[0], foot[1], foot[2]] });
}

/**
 * A prism on a planar face, d deep along its outward normal n: the face turned over (to glue onto the body's), its copy
 * moved (named `<face>.ext`), and a side on each edge, ruled between the edge and its copy.
 */
function prismOn(body: Brep, f: BrepFace, n: Point, d: number, id: string): Brep {
  const off = scale(n, d), move = (p: Point): Point => add(p, off);
  const loops = new Map(body.loops.map(l => [l.id, l])), coedges = new Map(body.coedges.map(c => [c.id, c])), edges = new Map(body.edges.map(e => [e.id, e])), vertices = new Map(body.vertices.map(v => [v.id, v]));
  const moveCurve = (c: Curve, cid: string): Curve => ({ ...c, id: cid, controlPoints: c.controlPoints.map(move) });
  const S = nurbsOf(f), top: Surface = { ...S, id: `${id}_top`, controlPoints: S.controlPoints.map(r => r.map(move)) };
  const usedEdges = [...new Set(f.loops.flatMap(lid => loops.get(lid)!.coedges.map(cid => coedges.get(cid)!.edge)))];
  const usedVerts = [...new Set(usedEdges.flatMap(e => [...edges.get(e)!.vertices]))];
  const sides: { id: string; name: string; surface: Surface; sense: 'forward' | 'reversed'; loops: { kind: 'outer'; uses: { edge: string; sense: 'forward' | 'reversed' }[] }[] }[] = [];
  let k = 0;
  for (const lid of f.loops) for (const cid of loops.get(lid)!.coedges) {
    const c = coedges.get(cid)!, e = edges.get(c.edge)!, C = e.curve;
    // u along the edge, v out along n: du × dv faces out of the prism where the face's loop runs with the edge.
    const surface: Surface = { kind: 'surface', id: `${id}_s${k}`, degreeU: C.degree, degreeV: 1, knotsU: [...C.knots], knotsV: [0, 0, 1, 1], controlPoints: C.controlPoints.map(p => [p, move(p)]), weights: C.weights.map(w => [w, w]) };
    const loop = [{ edge: `b_${e.id}`, sense: 'forward' as const }, { edge: `l_${e.vertices[1]}`, sense: 'forward' as const }, { edge: `t_${e.id}`, sense: 'reversed' as const }, { edge: `l_${e.vertices[0]}`, sense: 'reversed' as const }];
    const flipped = loop.slice().reverse().map(u => ({ edge: u.edge, sense: (u.sense === 'forward' ? 'reversed' : 'forward') as 'forward' | 'reversed' }));
    sides.push({ id: `${id}_f${k}`, name: `${f.name}.ext.side${k}`, surface, sense: c.sense, loops: [{ kind: 'outer', uses: c.sense === 'forward' ? loop : flipped }] });
    k++;
  }
  const faceLoops = (pre: string, reverse: boolean) => f.loops.map(lid => {
    const l = loops.get(lid)!, uses = l.coedges.map(cid => { const c = coedges.get(cid)!; return { edge: `${pre}${c.edge}`, sense: c.sense }; });
    return { kind: l.kind, uses: reverse ? uses.reverse().map(u => ({ edge: u.edge, sense: (u.sense === 'forward' ? 'reversed' : 'forward') as 'forward' | 'reversed' })) : uses };
  });
  return buildBrep({
    source: { family: 'shell', id },
    vertices: [...usedVerts.map(v => ({ id: `b_${v}`, point: vertices.get(v)!.point })), ...usedVerts.map(v => ({ id: `t_${v}`, point: move(vertices.get(v)!.point) }))],
    edges: [...usedEdges.map(e => ({ id: `b_${e}`, curve: { ...edges.get(e)!.curve, id: `${id}_b_${e}`.replace(/[^A-Za-z0-9_-]/g, '_') }, vertices: [`b_${edges.get(e)!.vertices[0]}`, `b_${edges.get(e)!.vertices[1]}`] as [string, string] })),
      ...usedEdges.map(e => ({ id: `t_${e}`, curve: moveCurve(edges.get(e)!.curve, `${id}_t_${e}`.replace(/[^A-Za-z0-9_-]/g, '_')), vertices: [`t_${edges.get(e)!.vertices[0]}`, `t_${edges.get(e)!.vertices[1]}`] as [string, string] })),
      ...usedVerts.map(v => ({ id: `l_${v}`, curve: { kind: 'curve' as const, id: `${id}_l_${v}`.replace(/[^A-Za-z0-9_-]/g, '_'), degree: 1, knots: [0, 0, 1, 1], controlPoints: [vertices.get(v)!.point, move(vertices.get(v)!.point)], weights: [1, 1] }, vertices: [`b_${v}`, `t_${v}`] as [string, string] }))],
    bodies: [{ id, kind: 'solid', shells: [{ id: `${id}_s`, closed: true, faces: [
      { id: `${id}_base`, surface: S, sense: (f.sense === 'forward' ? 'reversed' : 'forward') as 'forward' | 'reversed', loops: faceLoops('b_', true) },
      { id: `${id}_top`, name: `${f.name}.ext`, surface: top, sense: f.sense, loops: faceLoops('t_', false) },
      ...sides,
    ] }] }],
  });
}
