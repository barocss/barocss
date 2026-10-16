// Extrusion with draft: a closed line + arc profile in the XY plane swept from z0 to z1 while every
// wall leans into the material by the draft angle (the section shrinks by (z1 − z0)·tan θ, a hole
// grows). A straight wall becomes a sloping plane, an arc a cone patch about the arc's centre. Tangent
// joints stay tangent; two straight walls meet in a sloping edge through their offset lines' meeting
// point. Joints between a line and an arc (or two arcs) that are not tangent are refused (yet), as is
// a draft steep enough to collapse a wall.
import { BrepError, buildBrep, loopVectorArea, surfaceNormalAtCentre, type Brep } from './brep-core.js';
import { buildProfileLoop, segmentCurve, type ProfileSegment, type ProfileSegmentInput, type XY } from './extruded-profile-solid.js';
import { dot } from './vec3.js';
import type { Curve, Point, Surface } from './types.js';

export interface DraftedExtrusionInput {
  readonly profile: readonly ProfileSegmentInput[];
  readonly z0: number; readonly z1: number;
  /** Degrees, |θ| < 89: positive leans the walls into the material towards z1. */
  readonly draftDegrees: number;
  /** Face names: `${tag}.side{i}`, `${tag}.top`, `${tag}.bottom` (as an upright extrusion's). */
  readonly tag: string;
  readonly id?: string;
}

const fail = (detail: string): never => { throw new BrepError('GEOMETRY', 'drafted extrusion: ' + detail); };

/** The profile's segments moved `d` into the material (to the left of each), joints re-met. */
function offsetLoop(loop: readonly ProfileSegment[], d: number): ProfileSegment[] {
  const n = loop.length, left = (s: ProfileSegment, at: 'start' | 'end'): XY => {
    if (s.kind === 'line') { const l = s.lengthMM; return [-(s.end[1] - s.start[1]) / l, (s.end[0] - s.start[0]) / l]; }
    const p = at === 'start' ? s.start : s.end, r: XY = [(p[0] - s.center[0]) / s.radiusMM, (p[1] - s.center[1]) / s.radiusMM];
    return s.sweep > 0 ? [-r[0], -r[1]] : r; // counter-clockwise: the centre side
  };
  const dir = (s: ProfileSegment, at: 'start' | 'end'): XY => { const l = left(s, at); return [l[1], -l[0]]; };
  const corners: XY[] = [];
  for (let i = 0; i < n; i++) {
    const a = loop[(i - 1 + n) % n], b = loop[i], v = b.start, da = dir(a, 'end'), db = dir(b, 'start');
    const cross = da[0] * db[1] - da[1] * db[0], dotp = da[0] * db[0] + da[1] * db[1];
    if (Math.abs(cross) <= 1e-9 && dotp > 0) { const l = left(b, 'start'); corners.push([v[0] + l[0] * d, v[1] + l[1] * d]); continue; }
    if (a.kind !== 'line' || b.kind !== 'line') fail(`the joint at (${+v[0].toFixed(6)}, ${+v[1].toFixed(6)}) between a curve and another wall is not tangent (not supported yet)`);
    // Two straight walls: their offset lines meet.
    const la = left(a, 'end'), lb = left(b, 'start'), pa: XY = [v[0] + la[0] * d, v[1] + la[1] * d], pb: XY = [v[0] + lb[0] * d, v[1] + lb[1] * d];
    const s = ((pb[0] - pa[0]) * db[1] - (pb[1] - pa[1]) * db[0]) / cross;
    corners.push([pa[0] + da[0] * s, pa[1] + da[1] * s]);
  }
  return loop.map((s, i) => {
    const start = corners[i], end = corners[(i + 1) % n];
    if (s.kind === 'line') {
      const len = Math.hypot(end[0] - start[0], end[1] - start[1]), along = (end[0] - start[0]) * (s.end[0] - s.start[0]) + (end[1] - start[1]) * (s.end[1] - s.start[1]);
      if (!(len > 1e-9 && along > 0)) fail('the draft closes a straight wall before the top (steeper than the profile allows)');
      return { kind: 'line', start, end, lengthMM: len };
    }
    const r = s.radiusMM - Math.sign(s.sweep) * d;
    if (!(r > 1e-9)) fail('the draft closes an arc before the top (steeper than the profile allows)');
    return { ...s, start, end, radiusMM: r, lengthMM: Math.abs(s.sweep) * r };
  });
}

export function draftedExtrusion(input: DraftedExtrusionInput): Brep {
  const { z0, z1, tag } = input, id = input.id ?? tag, theta = input.draftDegrees * Math.PI / 180;
  if (!(Math.abs(input.draftDegrees) < 89)) fail('the draft angle must be below 89°');
  if (!(z1 > z0)) fail('the extrusion needs a positive height');
  const built = buildProfileLoop(input.profile, { maximumSegments: 1024 }).segments;
  // A single circle becomes two halves, so every edge has two vertices.
  const bottom: ProfileSegment[] = built.length > 1 ? [...built] : (() => {
    const arc = built[0]; if (arc.kind !== 'arc') fail('a profile needs at least two segments');
    const a = arc as Extract<ProfileSegment, { kind: 'arc' }>, half = a.sweep / 2, mid = a.startAngle + half, m: XY = [a.center[0] + a.radiusMM * Math.cos(mid), a.center[1] + a.radiusMM * Math.sin(mid)];
    return [{ ...a, end: m, sweep: half, lengthMM: a.lengthMM / 2 }, { ...a, start: m, startAngle: mid, sweep: half, lengthMM: a.lengthMM / 2 }];
  })();
  const top = offsetLoop(bottom, (z1 - z0) * Math.tan(theta)), n = bottom.length;
  const vertices: { id: string; point: Point }[] = [];
  for (let i = 0; i < n; i++) vertices.push({ id: `${id}_b${i}`, point: [bottom[i].start[0], bottom[i].start[1], z0] }, { id: `${id}_t${i}`, point: [top[i].start[0], top[i].start[1], z1] });
  const edges: { id: string; curve: Curve; vertices: [string, string] }[] = [];
  const bc = bottom.map((s, i) => segmentCurve(s, z0, `${id}_be${i}`)), tc = top.map((s, i) => segmentCurve(s, z1, `${id}_te${i}`));
  for (let i = 0; i < n; i++) {
    edges.push({ id: `${id}_be${i}`, curve: bc[i], vertices: [`${id}_b${i}`, `${id}_b${(i + 1) % n}`] });
    edges.push({ id: `${id}_te${i}`, curve: tc[i], vertices: [`${id}_t${i}`, `${id}_t${(i + 1) % n}`] });
    const p = vertices[2 * i].point, q = vertices[2 * i + 1].point;
    edges.push({ id: `${id}_se${i}`, curve: { kind: 'curve', id: `${id}_se${i}`, degree: 1, knots: [0, 0, 1, 1], controlPoints: [p, q], weights: [1, 1] }, vertices: [`${id}_b${i}`, `${id}_t${i}`] });
  }
  // Ends exactly on their vertices (the arc's end computed from its angles differs in the last bits).
  const at = new Map(vertices.map(v => [v.id, v.point]));
  for (const e of edges) { const cp = e.curve.controlPoints as Point[]; cp[0] = at.get(e.vertices[0])!; cp[cp.length - 1] = at.get(e.vertices[1])!; }
  const curveOf = new Map(edges.map(e => [e.id, e.curve]));
  type Use = { edge: string; sense: 'forward' | 'reversed' };
  const orient = (uses: Use[], outward: Point) => dot(loopVectorArea(uses.map(u => ({ curve: curveOf.get(u.edge)!, sense: u.sense }))), outward) >= 0 ? uses
    : [...uses].reverse().map(u => ({ edge: u.edge, sense: (u.sense === 'forward' ? 'reversed' : 'forward') as Use['sense'] }));
  const senseFor = (surface: Surface, outward: Point): 'forward' | 'reversed' => dot(surfaceNormalAtCentre(surface), outward) >= 0 ? 'forward' : 'reversed';
  const faces: { id: string; name: string; surface: Surface; sense: 'forward' | 'reversed'; loops: { kind: 'outer'; uses: Use[] }[] }[] = [];
  const names = built.length > 1 ? bottom.map((_, i) => `${tag}.side${i}`) : [`${tag}.side0#1`, `${tag}.side0#2`];
  for (let i = 0; i < n; i++) {
    const s = bottom[i], b = bc[i], t = tc[i];
    // Outward: to the right of the profile's travel, at the wall's middle.
    const tangent = s.kind === 'line' ? [(s.end[0] - s.start[0]) / s.lengthMM, (s.end[1] - s.start[1]) / s.lengthMM] : (() => { const a = s.startAngle + s.sweep / 2, k = Math.sign(s.sweep); return [-Math.sin(a) * k, Math.cos(a) * k]; })();
    const outward: Point = [tangent[1], -tangent[0], 0];
    const surface: Surface = s.kind === 'line'
      ? { kind: 'surface', id: `${id}_f${i}`, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[b.controlPoints[0], t.controlPoints[0]], [b.controlPoints[1], t.controlPoints[1]]], weights: [[1, 1], [1, 1]] }
      : { kind: 'surface', id: `${id}_f${i}`, degreeU: b.degree, degreeV: 1, knotsU: b.knots, knotsV: [0, 0, 1, 1], controlPoints: b.controlPoints.map((p, k) => [p, t.controlPoints[k]]), weights: b.weights.map(w => [w, w]) };
    const uses = orient([{ edge: `${id}_be${i}`, sense: 'forward' }, { edge: `${id}_se${(i + 1) % n}`, sense: 'forward' }, { edge: `${id}_te${i}`, sense: 'reversed' }, { edge: `${id}_se${i}`, sense: 'reversed' }], outward);
    faces.push({ id: `${id}_f${i}`, name: names[i], surface, sense: senseFor(surface, outward), loops: [{ kind: 'outer', uses }] });
  }
  for (const [z, which, prefix, curves] of [[z0, 'bottom', 'be', bc], [z1, 'top', 'te', tc]] as const) {
    const pts = curves.flatMap(c => c.controlPoints), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), pad = 1;
    const [x0, x1, y0, y1] = [Math.min(...xs) - pad, Math.max(...xs) + pad, Math.min(...ys) - pad, Math.max(...ys) + pad];
    const surface: Surface = { kind: 'surface', id: `${id}_${which}`, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[[x0, y0, z], [x0, y1, z]], [[x1, y0, z], [x1, y1, z]]], weights: [[1, 1], [1, 1]] };
    const outward: Point = [0, 0, which === 'top' ? 1 : -1];
    const uses = orient(curves.map((_, i) => ({ edge: `${id}_${prefix}${i}`, sense: 'forward' as const })), outward);
    faces.push({ id: `${id}_${which}`, name: `${tag}.${which}`, surface, sense: senseFor(surface, outward), loops: [{ kind: 'outer', uses }] });
  }
  const brep = buildBrep({ source: { family: 'drafted-extrusion', id }, vertices, edges, bodies: [{ id: `${id}_body`, kind: 'solid', shells: [{ id: 's', closed: true, faces }] }] });
  // Edge names from their faces, as for any body.
  const faceName = new Map(brep.faces.map(f => [f.id, f.name!])), loopFace = new Map(brep.loops.map(l => [l.id, l.face]));
  const byEdge = new Map<string, string[]>(); for (const c of brep.coedges) byEdge.set(c.edge, [...(byEdge.get(c.edge) ?? []), faceName.get(loopFace.get(c.loop)!)!]);
  const base = (e: Brep['edges'][number]) => [...new Set(byEdge.get(e.id))].sort().join('|'), count = new Map<string, number>(), seen = new Map<string, number>();
  for (const e of brep.edges) count.set(base(e), (count.get(base(e)) ?? 0) + 1);
  return { ...brep, edges: brep.edges.map(e => { const b = base(e), k = (seen.get(b) ?? 0) + 1; seen.set(b, k); return { ...e, name: count.get(b)! > 1 ? `${b}#${k}` : b }; }) };
}
