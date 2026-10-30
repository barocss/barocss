// R5.3 (D225): the part model's shell and thicken features, moved out of part-model.ts's operation() as they were
// there. Since D361 the shell helpers (`shellOf` and the rest) live here too and reach part-model.ts's values through a
// function-level import. The dispatcher calls `shellOperation` for those kinds.
import { BrepError, isFacetFace, mergeBreps, type Brep } from '../brep/brep-core.js';
import { isMeshBrepError } from '../mesh/mesh-brep.js';
import { booleanPrismatic, prismaticExtrude, type PrismaticSolid } from '../features/prismatic-solid.js';
import { erodeSection } from '../features/section-offset.js';
import { booleanCurveRegions, curveTolerance, regionMoments, segReverse, type CurveRegion2, type CurveSegment2, type XY } from '../brep/curved-arrangement.js';
import { faceGeometry } from '../brep/analytic-boolean.js';
import { facetBrepFromTriangles } from '../mesh/facet-brep.js';
import { buildProfileLoop, type ProfileSegmentInput } from '../features/extruded-profile-solid.js';
import { revolveProfile, revolveMassProperties, type RevolveInput } from '../features/revolve.js';
import { transformBrep } from '../brep/brep-transform.js';
import { unsupportedNativeMass } from '../internal/native-si-mass-state.js';
import { withCavities } from '../brep/brep-glue.js';
import { generalShell } from '../blend/general-shell.js';
import { offsetCavity, offsetShell, smoothOffsetBody } from '../blend/offset-cavity.js';
import { regionShell } from '../blend/region-shell.js';
import { meshInnerOffset } from '../mesh/mesh-offset.js';
import { type MassProperties } from '../brep/solid-mass.js';
import { cross, dot, len, sub, unit } from '../core/vec3.js';
import { type Point } from '../types.js';
import { thickenSolid } from '../brep/thicken-solid.js';
import { validateSurface } from '../core/math.js';
import type { CadPartDim, Solid, CadPartFeature, Result, Tools, PartHelpers, Part, Finish, SweepStep } from './part-model.js';
import { CadPartError, CadPartLimits, affine, boolean, brepOf, facetTriangles, movedMass, profiling, sweepBrep } from './part-model.js';
import { finishEdges } from './part-finish.js';

/** A shell or thicken feature's evaluation (part-model.ts's operation() for these kinds). */
export function shellOperation(f: CadPartFeature & Record<string, unknown>, t: Tools, k: PartHelpers): () => Result {
  const { dim, solids, fail, at } = t;
  const { isRecord } = k;
  const one = (s: Solid): Result => ({ kind: 'solid', parts: [{ solid: s }] });
  switch (f.kind) {
    case 'thicken': {
      const g = f.surface as Record<string, unknown>, t = dim(f.thickness as CadPartDim, 'thickness', true), side = f.side ?? 'normal';
      if (!isRecord(g)) fail('INPUT', 'surface must be a NURBS surface { degreeU, degreeV, knotsU, knotsV, controlPoints, weights }');
      if (side !== 'normal' && side !== 'reverse' && side !== 'both') fail('INPUT', 'side must be normal, reverse or both');
      const surface = { kind: 'surface' as const, id: 'surface', degreeU: g.degreeU as number, degreeV: g.degreeV as number, knotsU: g.knotsU as number[], knotsV: g.knotsV as number[], controlPoints: g.controlPoints as Point[][], weights: g.weights as number[][] };
      try { validateSurface(surface); } catch (cause) { fail('INPUT', `surface: ${cause instanceof Error ? cause.message : String(cause)}`); }
      return () => {
        try { return one({ kind: 'brep', brep: thickenSolid({ id: at, surface, thickness: t, side: side as 'normal' }) }); }
        catch (cause) {
          const m = cause instanceof BrepError ? /CAPABILITY: shell: (.*)$/s.exec(cause.message) : null;
          if (m) fail('CAPABILITY', m[1]);
          if (cause instanceof RangeError || isMeshBrepError(cause)) fail('GEOMETRY', cause.message);
          throw cause;
        }
      };
    }
    case 'shell': {
      const target = solids(f.target, 'target'), t = dim(f.thickness as CadPartDim, 'thickness', true);
      const open = f.open === undefined ? [] : f.open as unknown;
      if (!Array.isArray(open) || open.length > CadPartLimits.edges || !open.every(x => typeof x === 'string')) fail('INPUT', 'open must list up to 64 face names');
      if (target.length !== 1) fail('REFERENCE', 'shell one part at a time (name it as id/k)');
      return () => ({ kind: 'solid', parts: [shellOf(target[0], t, open as string[], at, fail)] });
    }
  }
  throw new Error(`shellOperation: ${f.kind} is not one of its features`);
}

// Shell helpers moved from part-model.ts (3b, D361).
// ---- shell -----------------------------------------------------------------------------------------------
/**
 * An upright body of one section, hollowed: the section eroded by the thickness (exact for lines and
 * arcs), extruded from the thickness above the bottom to below the top (or through an open top or
 * bottom), and taken away; open side walls let the hollow run through them.
 */
/** The shell of a part, by how it was made (its mass exact when that can be). */
export function shellOf(part: Part, t: number, open: string[], at: string, fail: Tools['fail']): Part {
  if (profiling) profiling.shells++;
  // A mesh body (facet faces): its cavity its triangles offset in, the wall it achieves measured (R11.3, D114).
  const s = part.solid;
  if (s.kind === 'brep' && s.brep.faces.length && s.brep.faces.every(isFacetFace)) {
    if (open.length) fail('CAPABILITY', `opening a face of a mesh body (${open.join(', ')}) is not supported yet: shell it closed`);
    if (s.brep.bodies.some(b => b.kind === 'sheet')) fail('CAPABILITY', 'a mesh sheet encloses nothing to shell: thicken it instead');
    const mesh = facetTriangles(s.brep);
    try {
      const r = meshInnerOffset(mesh.positions, mesh.indices, t);
      const cavity = facetBrepFromTriangles(r.positions, mesh.indices, { id: `${at}_in`, maximumTriangles: CadPartLimits.meshTriangles, groups: mesh.groups, groupName: g => `${at}.in.${mesh.names[g]}`, crease: 180 });
      return { solid: { kind: 'brep', brep: withCavities(s.brep, cavity, { family: 'shell', id: at }) }, shell: r.report };
    } catch (cause) {
      const m = cause instanceof BrepError ? /CAPABILITY: (.*)$/s.exec(cause.message) : null;
      if (m) fail('CAPABILITY', m[1]);
      if (isMeshBrepError(cause)) fail('GEOMETRY', cause.message);
      throw cause;
    }
  }
  if (part.solid.kind !== 'upright') {
    if (part.revolved) return shellRevolved(part, part.revolved, t, open, at, fail);
    if (part.swept) return shellSwept(part, part.swept, t, open, at, fail);
    // A moved copy: the original's shell, moved (a scaled copy's with the wall scaled back).
    if (!part.history && part.moved) {
      const { from, m, o } = part.moved, k = Math.cbrt(Math.abs(m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6])));
      const inner = shellOf(from, t / k, open, at, fail);
      return { solid: affine(inner.solid, m, o), ...(inner.mass ? { mass: (d: number) => movedMass(inner.mass!(d), m, o) } : {}) };
    }
  }
  return { solid: shellPart(part, t, open, at, fail) };
}

/** The slab route's refusals of a face's kind or trim, which the offset route may take instead (other refusals stand). */
const OFFSET_ROUTE = /freeform faces joined to others|trimmed by a curve other than its rulings and circles|bounded by a curve that is not a line or an arc/;
function shellPart(part: Part, t: number, open: string[], at: string, fail: Tools['fail']): Solid {
  if (part.solid.kind === 'upright') { const h = hollowOf(part.solid.solid, t, open, at, fail); return { kind: 'upright', solid: booleanPrismatic(part.solid.solid, h.hollow, 'difference') }; }
  if (!part.history) {
    // Any other body of planes and cylinders: its wall as the union of a slab per face.
    const body = brepOf(part, 'target'), names = new Set(body.faces.map(f => f.name ?? ''));
    for (const n of open) if (!names.has(n)) fail('SELECTION', `no face named ${n} to open; faces: ${[...names].slice(0, 12).join(', ')}`);
    try { return { kind: 'brep', brep: generalShell(body, t, new Set(open), at) }; }
    catch (cause) {
      // A closed body of freeform faces meeting smoothly (a SubD body): its cavity, its faces offset (R11.2a, D110); kept
      // faces trimmed planes and cylinders too, offset exactly, where the opening leaves no sharp edge (R11.2c-1, D112).
      if (cause instanceof BrepError && OFFSET_ROUTE.test(cause.message) && smoothOffsetBody(body, new Set(open))) {
        // Opened faces (R11.2b, D111): the kept faces, their offset and the wall's end at the opening's edges.
        try { return { kind: 'brep', brep: open.length ? offsetShell(body, t, new Set(open), at, at).shell : withCavities(body, offsetCavity(body, t, `${at}_in`, at).cavity, { family: 'shell', id: at }) }; }
        catch (inner) { const m = inner instanceof BrepError ? /CAPABILITY: (.*)$/s.exec(inner.message) : null; if (m) fail('CAPABILITY', m[1]); throw inner; }
      }
      // Sharp edges between such faces' smooth regions and the planes that bound the body: bands and regions' slabs (R11.2c-2, D113).
      if (cause instanceof BrepError && OFFSET_ROUTE.test(cause.message)) {
        try { return { kind: 'brep', brep: regionShell(body, t, new Set(open), at) }; }
        catch (inner) { const m = inner instanceof BrepError ? /CAPABILITY: (.*)$/s.exec(inner.message) : null; if (m) fail('CAPABILITY', m[1]); throw inner; }
      }
      const m = cause instanceof BrepError ? /CAPABILITY: (.*)$/s.exec(cause.message) : null;
      if (m) fail('CAPABILITY', m[1]);
      if (cause instanceof BrepError && /not supported yet/.test(cause.message)) fail('CAPABILITY', cause.message.replace(/^B-rep: (analytic Boolean: )?/, ''));
      throw cause;
    }
  }
  // A finished body: its hollow is the base's hollow with the same finishes, offset by the wall — a
  // rolling ball of radius r less the wall rounds the offset of a convex edge rounded r (sharp when r
  // is not more than the wall); an equal chamfer d on a corner of angle α becomes d + t(1 − 1/sin(α/2))/cos(α/2).
  const { base, finishes } = part.history!;
  if (base.slabs.length !== 1) fail('CAPABILITY', 'shell after finishing edges works on bodies extruded from one section yet');
  const h = hollowOf(base, t, open, at, fail);
  // Walls split in parts (a full circle's halves) keep their `#k` inside.
  const face = (n: string) => { const w = n.replace(/#\d+$/, ''); return h.sides.has(w) ? `${at}.in.${n}` : h.tops.has(n) ? `${at}.ceiling` : h.bottoms.has(n) ? `${at}.floor` : null; };
  const outer = brepOf(part, 'target'), faces = new Map(outer.faces.map(f => [f.name, f]));
  let hollow: Part = { solid: { kind: 'upright', solid: h.hollow } };
  for (const fin of finishes) {
    if (fin.radii) { hollow = varyingHollow(hollow, fin, base, face, t, open, at, fail); continue; }
    // Edges by their offset size (a chamfer's depends on each corner's angle).
    const jobs = new Map<number, string[]>();
    for (const name of fin.edges) {
      let size = fin.size - t;
      const parts = name.split('|');
      if (parts.some(n => open.includes(n))) fail('CAPABILITY', `${name} borders an open face: finish the opening's edges after the shell`);
      const mapped = parts.map(face);
      if (mapped.some(n => n === null)) fail('CAPABILITY', `${fin.id} finishes ${name}, an edge made by an earlier finish: shell before that finish`);
      if (fin.kind === 'chamfer') {
        // The corner's angle from the faces' normals there (a cap meets a wall square).
        const g = parts.map(n => { try { return faces.has(n) ? faceGeometry(faces.get(n)!) : { kind: 'other' as const }; } catch { return { kind: 'other' as const }; } });
        const alpha = g[0].kind === 'plane' && g[1].kind === 'plane' ? Math.PI - Math.acos(Math.max(-1, Math.min(1, dot(g[0].n, g[1].n)))) : Math.PI / 2;
        size = fin.size + t * (1 - 1 / Math.sin(alpha / 2)) / Math.cos(alpha / 2);
      }
      if (!(size > 1e-9)) continue;
      const key = Math.round(size * 1e9) / 1e9;
      jobs.set(key, [...(jobs.get(key) ?? []), (mapped as string[]).sort().join('|')]);
    }
    [...jobs].forEach(([size, edges], k) => {
      const known = new Set(brepOf(hollow, `${at}_hollow`).edges.map(e => e.name)), missing = edges.find(e => !known.has(e));
      if (missing) fail('CAPABILITY', `the wall rounds the inside corner of ${missing} already: shell inside corners finished by ${fin.id} is not supported yet`);
      hollow = { solid: finishEdges(hollow, edges, size, fin.kind, `${at}_in_${fin.id}${k ? `_${k}` : ''}`, fail) };
    });
  }
  // (Ids are identifiers; the hollow's finished faces are named `${at}.in.${finish}.…`.)
  const inner = hollow.solid.kind === 'brep' ? { kind: 'brep' as const, brep: transformBrep(hollow.solid.brep, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1], offset: [0, 0, 0] }, n => n.split(`${at}_in_`).join(`${at}.in.`)) } : hollow.solid;
  return boolean(part.solid, inner, 'difference', at);
}

/**
 * The hollow rounded after a variable-radius fillet (D108): the ball's spine is the outer fillet's, its radius the outer
 * one less the wall — exact for a straight chain with its radius linear along it (two points): the radius at the hollow
 * chain's ends from the outer law. Sharp where the wall reaches the radius all along; refused where it does partway, and
 * for a curved chain or more points (their law along the hollow's chain is not the outer one's).
 */
function varyingHollow(hollow: Part, fin: Finish, base: PrismaticSolid, face: (n: string) => string | null, t: number, open: readonly string[], at: string, fail: Tools['fail']): Part {
  const radii = fin.radii!, outer = brepOf({ solid: { kind: 'upright', solid: base } }, 'base');
  const lines = fin.edges.map(name => {
    if (name.split('|').some(n => open.includes(n))) fail('CAPABILITY', `${name} borders an open face: finish the opening's edges after the shell`);
    const e = outer.edges.find(x => x.name === name || x.name === name.split('|').reverse().join('|'));
    if (!e) return fail('CAPABILITY', `${fin.id} rounds ${name}, an edge made by an earlier finish: shell before that finish`);
    if (!(e.curve.degree === 1 && e.curve.controlPoints.length === 2)) return fail('CAPABILITY', `[SHELL_VARIABLE_RADIUS] ${fin.id} varies its radius along a curved edge (${name}): its hollow's radius along the chain is not the outer one's less the wall; not supported yet`);
    return e.curve.controlPoints as Point[];
  });
  if (radii.length !== 2) fail('CAPABILITY', `[SHELL_VARIABLE_RADIUS] ${fin.id} gives ${radii.length} radii: shell after a variable radius takes two (linear along a straight chain) yet`);
  const p0 = radii[0].at, u = unit(sub(lines[0][1], lines[0][0]));
  for (const [a, b] of lines) if (len(cross(sub(b, a), u)) > 1e-9 * Math.max(1, len(b)) || len(cross(sub(a, p0), u)) > 1e-6 * Math.max(1, len(a))) fail('CAPABILITY', `[SHELL_VARIABLE_RADIUS] ${fin.id}'s edges do not lie on one line: shell after a variable radius takes a straight chain yet`);
  const s1 = dot(sub(radii[1].at, p0), u), r = (p: Point) => radii[0].radius + (radii[1].radius - radii[0].radius) * dot(sub(p, p0), u) / s1;
  const names = fin.edges.map(name => { const m = name.split('|').map(face); if (m.some(n => n === null)) fail('CAPABILITY', `${fin.id} rounds ${name}, an edge made by an earlier finish: shell before that finish`); return (m as string[]).sort().join('|'); });
  const inner = brepOf(hollow, `${at}_hollow`), ends = names.flatMap(n => { const e = inner.edges.find(x => x.name === n); if (!e) return fail('CAPABILITY', `the wall rounds the inside corner of ${n} already: shell inside corners finished by ${fin.id} is not supported yet`); return e.curve.controlPoints as Point[]; });
  const along = ends.map(p => dot(sub(p, p0), u)), lo = ends[along.indexOf(Math.min(...along))], hi = ends[along.indexOf(Math.max(...along))];
  const rLo = r(lo) - t, rHi = r(hi) - t;
  if (!(rLo > 1e-9) && !(rHi > 1e-9)) return hollow;
  if (!(rLo > 1e-9) || !(rHi > 1e-9)) fail('CAPABILITY', `[SHELL_VARIABLE_RADIUS] ${fin.id}'s radius falls to the wall (${t} mm) partway along: the hollow's round would run out there; not supported yet`);
  return { solid: finishEdges(hollow, names, Math.max(rLo, rHi), 'fillet', `${at}_in_${fin.id}`, fail, undefined, [{ at: lo, radius: rLo }, { at: hi, radius: rHi }]) };
}

/** A body less hollows inside it: masses and moments subtracted (inertia via the origin; mm and g). */
function massLess(outer: MassProperties, inner: readonly MassProperties[]): MassProperties {
  const about = (p: MassProperties) => { const c = p.centroid, cc = c[0] ** 2 + c[1] ** 2 + c[2] ** 2; return p.inertia.map((row, i) => row.map((v, j) => v + p.mass * ((i === j ? cc : 0) - c[i] * c[j]))); };
  const m = outer.mass - inner.reduce((a, p) => a + p.mass, 0), V = outer.volume - inner.reduce((a, p) => a + p.volume, 0);
  const c = [0, 1, 2].map(i => (outer.mass * outer.centroid[i] - inner.reduce((a, p) => a + p.mass * p.centroid[i], 0)) / m) as Point;
  const T = about(outer); for (const p of inner) about(p).forEach((row, i) => row.forEach((v, j) => { T[i][j] -= v; }));
  const cc = c[0] ** 2 + c[1] ** 2 + c[2] ** 2;
  const I = T.map((row, i) => row.map((v, j) => v - m * ((i === j ? cc : 0) - c[i] * c[j]))) as [[number, number, number], [number, number, number], [number, number, number]];
  return unsupportedNativeMass({ volume: V, mass: m, centroid: c, inertia: I, method: outer.method }, 'difference');
}
/** A ring of section segments as profile segments (each from its start). */
const profileOfRing = (ring: readonly CurveSegment2[]): ProfileSegmentInput[] => ring.map(g => {
  if (g.kind === 'line') return { kind: 'line', start: [g.a[0], g.a[1]] };
  if (g.kind === 'arc') return { kind: 'arc', start: [g.c[0] + g.r * Math.cos(g.t0), g.c[1] + g.r * Math.sin(g.t0)], center: [g.c[0], g.c[1]], direction: g.sweep > 0 ? 'ccw' : 'cw' };
  throw new CadPartError('CAPABILITY', 'shell', 'a section with curves other than lines and arcs');
});
/** A profile's segments as a tagged section ring (`side<i>`, as the body's faces are named), and the loop. */
type LineArc = Extract<CurveSegment2, { kind: 'line' } | { kind: 'arc' }>;
function sectionRing(profile: readonly ProfileSegmentInput[], sideTags?: readonly string[]): LineArc[] {
  const loop0 = buildProfileLoop(profile, { maximumSegments: 1024 }), built = loop0.segments;
  // (Tagged: `side[t]`, by the authored segment, as revolve names them; a circle's halves both its one tag.)
  const tagOf = (i: number) => sideTags ? `side[${sideTags[built.length > 1 ? (loop0.reversed ? built.length - 1 - i : i) : 0]}]` : `side${i}`;
  // A single circle is two halves (side0, side1), as the revolved body has it.
  const loop = built.length > 1 ? built : (() => { const a = built[0] as Extract<typeof built[number], { kind: 'arc' }>; return [{ ...a, sweep: a.sweep / 2 }, { ...a, startAngle: a.startAngle + a.sweep / 2, sweep: a.sweep / 2 }]; })();
  return loop.map((g, i): LineArc => g.kind === 'line' ? { kind: 'line', a: g.start, b: g.end, tag: tagOf(i) } : { kind: 'arc', c: g.center, r: g.radius, t0: g.startAngle, sweep: g.sweep, tag: tagOf(i) });
}
const ringsOfRegions = (rs: readonly CurveRegion2[]) => rs.flatMap(r => [r.outer, ...r.holes]);
/** Each body of a B-rep on its own: its shells, faces, loops, coedges, edges and vertices. */
export function brepBodies(b: Brep): Brep[] {
  return b.bodies.map(body => {
    const shells = new Set(body.shells), faces = b.faces.filter(x => shells.has(x.shell)), faceIds = new Set(faces.map(x => x.id));
    const loops = b.loops.filter(l => faceIds.has(l.face)), loopIds = new Set(loops.map(l => l.id));
    const coedges = b.coedges.filter(c => loopIds.has(c.loop)), edgeIds = new Set(coedges.map(c => c.edge));
    const edges = b.edges.filter(e => edgeIds.has(e.id)), vertexIds = new Set(edges.flatMap(e => e.vertices));
    return { ...b, bodies: [body], shells: b.shells.filter(x => shells.has(x.id)), faces, loops, coedges, edges, vertices: b.vertices.filter(v => vertexIds.has(v.id)) };
  });
}
const renamed = (b: Brep, from: string, to: string) => transformBrep(b, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1], offset: [0, 0, 0] }, n => n.split(from).join(to));

/**
 * A body turned a full turn, hollowed: every point's nearest wall lies in its own meridian plane, so
 * the hollow is the meridian section (with its mirror across the axis) eroded, turned again — exact,
 * its mass the body's less the hollow's part inside it (also turned: closed form).
 */
function shellRevolved(part: Part, input: RevolveInput, t: number, open: string[], at: string, fail: Tools['fail']): Part {
  if (input.angle !== 360) fail('CAPABILITY', 'shell works on bodies turned a full turn yet (this one stops at its start and end faces)');
  const id = input.id!, ring = sectionRing(input.profile, input.sideTags), tags = new Set(ring.map(g => g.tag!)), tol = curveTolerance([ring]);
  const openTags = new Set(open.map(n => { const tag = n.startsWith(id + '.') ? n.slice(id.length + 1).replace(/#\d+$/, '') : ''; if (!tags.has(tag)) fail('SELECTION', `no face named ${n} to open; faces: ${[...tags].map(x => `${id}.${x}`).slice(0, 12).join(', ')}`); return tag; }));
  // The axis, its side the profile is on, and the mirror across it.
  const [dx, dy] = input.axis.direction, dl = Math.hypot(dx, dy), d: XY = [dx / dl, dy / dl], A = input.axis.origin, nrm: XY = [-d[1], d[0]];
  const side = Math.sign(ring.reduce((acc, g) => { const p = g.kind === 'line' ? g.a : [g.c[0] + g.r * Math.cos(g.t0 + g.sweep / 2), g.c[1] + g.r * Math.sin(g.t0 + g.sweep / 2)]; return acc + (p[0] - A[0]) * nrm[0] + (p[1] - A[1]) * nrm[1]; }, 0)) || 1;
  const refl = (p: readonly number[]): XY => { const v = [p[0] - A[0], p[1] - A[1]], u = v[0] * d[0] + v[1] * d[1]; return [A[0] + 2 * u * d[0] - v[0], A[1] + 2 * u * d[1] - v[1]]; };
  const phi = Math.atan2(d[1], d[0]);
  const mirror: LineArc[] = [...ring].reverse().map((g): LineArc => g.kind === 'line' ? { kind: 'line', a: refl(g.b), b: refl(g.a), tag: g.tag } : { kind: 'arc', c: refl(g.c), r: g.r, t0: 2 * phi - g.t0 - g.sweep, sweep: g.sweep, tag: g.tag });
  const whole = booleanCurveRegions([ring], [mirror], 'union', tol);
  let inner: CurveRegion2[] = [];
  try { inner = erodeSection(whole, t, tag => !!tag && openTags.has(tag), () => 'wall', tol); }
  catch (cause) { if (cause instanceof Error && /only straight walls/.test(cause.message)) fail('CAPABILITY', cause.message); throw cause; }
  // The profile's half of it.
  const L = 4 * Math.max(1, ...ring.flatMap(g => g.kind === 'line' ? [...g.a, ...g.b].map(Math.abs) : [Math.abs(g.c[0]) + g.r, Math.abs(g.c[1]) + g.r]), Math.abs(A[0]), Math.abs(A[1]));
  const at2 = (u: number, w: number): XY => [A[0] + u * d[0] + w * side * nrm[0], A[1] + u * d[1] + w * side * nrm[1]];
  const corners = [at2(-L, 0), at2(L, 0), at2(L, L), at2(-L, L)], halfPlane: CurveSegment2[] = corners.map((p, k) => ({ kind: 'line', a: p, b: corners[(k + 1) % 4] }));
  const area = (rs: CurveRegion2[]) => rs.reduce((a, r) => a + regionMoments(r)[0], 0);
  const orient = (ring: readonly CurveSegment2[]): CurveSegment2[] => area([{ outer: ring, holes: [] }]) < 0 ? [...ring].reverse().map(segReverse) : [...ring];
  const half = booleanCurveRegions(ringsOfRegions(inner), [orient(halfPlane)], 'intersection', tol);
  if (!half.length || area(half) <= tol * tol) fail('PARAMETER', `a wall of ${t} mm leaves no hollow inside this body`);
  if (half.some(r => r.holes.length)) fail('CAPABILITY', 'shell of a revolved body whose hollow section has islands is not supported yet');
  const pieces = half.map((r, k) => ({ id: `${at}_in${k}`, profile: profileOfRing(r.outer), axis: input.axis, angle: 360 }));
  const hollow = mergeBreps(pieces.map(pc => renamed(revolveProfile(pc), `${at}_in`, `${at}.in`)), { family: 'revolve', id: `${at}_hollow` });
  // The hollow inside the body: the eroded half within the profile (an opening runs out past it).
  const inside = booleanCurveRegions(ringsOfRegions(half), [orient(ring)], 'intersection', tol).map((r, k) => ({ id: `${at}_m${k}`, profile: profileOfRing(r.outer), axis: input.axis, angle: 360 }));
  // Nothing opened: the hollow lies inside, apart from the walls — a cavity, no Boolean needed.
  const solid: Solid = openTags.size ? boolean(part.solid, { kind: 'brep', brep: hollow }, 'difference', at) : { kind: 'brep', brep: withCavities(brepOf(part, 'target'), hollow, { family: 'shell', id: at }) };
  return { solid, mass: d => massLess(revolveMassProperties(input, d), inside.map(pc => revolveMassProperties(pc, d))) };
}

/**
 * A swept body hollowed: its walls' normals lie in the path's cross-sections, so the hollow is the
 * section eroded, swept along the same path (through the same point) — run out past an open end,
 * started a wall's thickness into a closed one (on a straight run); exact, mass included.
 */
function shellSwept(part: Part, swept: NonNullable<Part['swept']>, t: number, open: string[], at: string, fail: Tools['fail']): Part {
  const steps = [...swept.steps], last = steps.length - 1, brep = brepOf(part, 'target');
  const names = new Set(brep.faces.map(f => f.name ?? '')), startName = [`${at}`].length ? [...names].find(n => /\.s0\.(bottom|start)$/.test(n)) : undefined, endName = [...names].find(n => new RegExp(`\\.s${last}\\.(top|end)$`).test(n));
  for (const n of open) if (n !== startName && n !== endName) fail(names.has(n) ? 'CAPABILITY' : 'SELECTION', names.has(n) ? `only a swept body's end faces can be opened yet (${startName}, ${endName})` : `no face named ${n} to open; faces: ${[startName, endName].join(', ')}`);
  const openStart = !!startName && open.includes(startName), openEnd = !!endName && open.includes(endName);
  const ring = sectionRing(swept.profile, swept.sideTags), tol = curveTolerance([ring]), centre = buildProfileLoop(swept.profile, { maximumSegments: 1024 }).centroid;
  const inner = erodeSection([{ outer: ring, holes: [] }], t, () => false, () => 'wall', tol);
  if (!inner.length) fail('PARAMETER', `a wall of ${t} mm leaves no hollow inside this section`);
  if (inner.length > 1 || inner[0].holes.length) fail('CAPABILITY', 'shell of a swept body whose hollow section falls apart is not supported yet');
  const profile = profileOfRing(inner[0].outer);
  // Its ends: a closed end on a straight run starts the hollow a wall into it.
  const trim = (k: number) => { const st = steps[k]; if (st.kind !== 'straight' || !(st.length > t)) fail('CAPABILITY', 'a closed end of a swept body must be a straight run longer than the wall yet (open it, or start with a run)'); return st.length - t; };
  const inside = steps.map(s => ({ ...s }));
  let lift = 0;
  if (!openStart) { inside[0] = { kind: 'straight', length: trim(0) }; lift = t; }
  if (!openEnd) { const k = last; const base = inside[k] as SweepStep; if (k === 0 && !openStart) { if (!(base.kind === 'straight' && base.length > t)) fail('CAPABILITY', 'the run is too short for both closed ends'); inside[0] = { kind: 'straight', length: (base as { length: number }).length - t }; } else inside[k] = { kind: 'straight', length: trim(k) }; }
  const run = 1 + t, path: SweepStep[] = [...(openStart ? [{ kind: 'straight' as const, length: run }] : []), ...inside, ...(openEnd ? [{ kind: 'straight' as const, length: run }] : [])];
  const shift = openStart ? -run : lift;
  const made = sweepBrep(profile, path, `${at}_in`, fail, centre), hollow = transformBrep(renamed(made.brep, `${at}_in`, `${at}.in`), { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1], offset: [0, 0, shift] });
  const within = sweepBrep(profile, inside, `${at}_m`, fail, centre);
  const solid: Solid = openStart || openEnd ? boolean(part.solid, { kind: 'brep', brep: hollow }, 'difference', at) : { kind: 'brep', brep: withCavities(brep, hollow, { family: 'shell', id: at }) };
  return { solid, mass: d => { const m = within.mass(d); return massLess(part.mass!(d), [movedMass(m, [1, 0, 0, 0, 1, 0, 0, 0, 1], [0, 0, lift])]); } };
}

/**
 * The hollow of an upright body (one section, or sections stacked): a point is hollow when it is at
 * least the wall from every wall at its height and at the heights within the wall above and below it
 * — the section at z is the intersection of the sections over [z − t, z + t], eroded (exact for lines
 * and arcs); offset walls and ledges meet sharply, as offset faces do. It runs on through open faces.
 */
function hollowOf(solid: PrismaticSolid, t: number, open: string[], at: string, fail: Tools['fail']): { hollow: PrismaticSolid; sides: Set<string>; tops: Set<string>; bottoms: Set<string> } {
  const slabs = [...solid.slabs].sort((a, b) => a.z0 - b.z0), rings = slabs.flatMap(s => s.regions.flatMap(r => [r.outer, ...r.holes])), tol = curveTolerance(rings);
  for (let k = 1; k < slabs.length; k++) if (slabs[k].z0 > slabs[k - 1].z1 + tol) fail('CAPABILITY', 'shell works on one body at a time (this one has pieces apart along its height)');
  const zmin = slabs[0].z0, zmax = slabs[slabs.length - 1].z1;
  const sides = new Set(rings.flatMap(r => r.map(g => g.tag).filter((x): x is string => !!x)));
  const capAt = (z: number) => (solid.caps ?? []).filter(c => Math.abs(c.z - z) <= tol).map(c => c.tag);
  const tops = new Set(capAt(zmax)), bottoms = new Set(capAt(zmin)), ledges = new Set((solid.caps ?? []).map(c => c.tag).filter(x => !tops.has(x) && !bottoms.has(x)));
  for (const name of open) {
    if (ledges.has(name)) fail('CAPABILITY', `${name} is a step between sections: only the top, the bottom and sides can be opened yet`);
    if (!sides.has(name) && !tops.has(name) && !bottoms.has(name)) fail('SELECTION', `no face named ${name} to open; faces: ${[...tops, ...bottoms, ...sides].slice(0, 12).join(', ')}`);
  }
  const openTop = open.some(n => tops.has(n)), openBottom = open.some(n => bottoms.has(n)), openSides = new Set(open.filter(n => sides.has(n)));
  const lo = openBottom ? zmin - 1 : zmin + t, hi = openTop ? zmax + 1 : zmax - t;
  if (!(hi > lo + tol)) fail('PARAMETER', `a wall of ${t} mm leaves no hollow between the top and the bottom`);
  // Heights where the window [z − t, z + t] takes in another section.
  const cuts = [...new Set([lo, hi, ...slabs.slice(1).flatMap(s => [s.z0 - t, s.z0 + t])].filter(z => z >= lo - tol && z <= hi + tol))].sort((a, b) => a - b);
  const pieces: { z0: number; z1: number; regions: CurveRegion2[] }[] = [];
  for (let k = 0; k + 1 < cuts.length; k++) {
    const z0 = cuts[k], z1 = cuts[k + 1]; if (z1 - z0 <= tol) continue;
    const m = (z0 + z1) / 2, inWindow = slabs.filter(s => s.z0 < m + t - tol && s.z1 > m - t + tol);
    if (!inWindow.length) continue;
    let section: CurveRegion2[] = inWindow[0].regions as CurveRegion2[];
    for (const s of inWindow.slice(1)) section = booleanCurveRegions(section.flatMap(r => [r.outer, ...r.holes]), s.regions.flatMap(r => [r.outer, ...r.holes]), 'intersection', tol);
    let inner: CurveRegion2[] = [];
    try { inner = section.length ? erodeSection(section, t, tag => !!tag && openSides.has(tag), tag => `${at}.in.${tag ?? 'wall'}`, tol) : []; }
    catch (cause) { if (cause instanceof Error && /only straight walls/.test(cause.message)) fail('CAPABILITY', cause.message); throw cause; }
    if (inner.length) pieces.push({ z0, z1, regions: inner });
  }
  if (!pieces.length) fail('PARAMETER', `a wall of ${t} mm leaves no hollow inside this body`);
  let hollow = prismaticExtrude(pieces[0].regions.flatMap(r => [r.outer, ...r.holes]), pieces[0].z0, pieces[0].z1);
  for (const p of pieces.slice(1)) hollow = booleanPrismatic(hollow, prismaticExtrude(p.regions.flatMap(r => [r.outer, ...r.holes]), p.z0, p.z1), 'union');
  // Its floor and ceiling, and the steps between (the offset ledges), are named after the shell.
  const levels = [...new Set(hollow.slabs.flatMap(s => [s.z0, s.z1]))].sort((a, b) => a - b), all = pieces.flatMap(p => p.regions);
  const caps = levels.map((z, k) => ({ z, regions: all, tag: k === 0 ? `${at}.floor` : k === levels.length - 1 ? `${at}.ceiling` : `${at}.step${k}` }));
  return { hollow: { ...hollow, caps }, sides, tops, bottoms };
}
