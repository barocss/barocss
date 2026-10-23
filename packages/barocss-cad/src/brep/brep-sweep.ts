// Extrusion of a line + arc profile with holes, built only from Euler operators (brep-core step 2).
// No fixed vertex / edge caps: a profile may have any number of segments and holes.
//
//   1. lamina      mvfs, mev along the outer loop, mef closes it → top-side face A and bottom face B
//   2. holes       on A: mev a bridge, mev along the hole, mef closes it → plug face; kemr(bridge) → ring of A
//   3. sweep       for every loop of A: mev a vertical strut per vertex, mef per segment → side faces;
//                  A's loops are now the top loops
//   4. through     kfmrh(plug, B) → each plug's loop becomes a ring of B; genus = number of holes
import { BrepEditor } from './brep-euler.js';
import { mergeBreps, type Brep } from './brep-core.js';
import { booleanPolygons, type PlanarBooleanOperation, type PolygonWithHoles } from './planar-arrangement.js';
import { buildProfileLoop, segmentCurve, extrudedSurface, capSurface, ExtrudedProfileError } from '../features/extruded-profile-solid.js';
import type { ProfileSegment, ProfileSegmentInput, XY } from '../features/extruded-profile-solid.js';
import type { Curve, Point } from '../types.js';

export interface ProfileWithHolesInput {
  readonly id?: string;
  /** Outer boundary (any orientation; normalised counter-clockwise). */
  readonly outer: readonly ProfileSegmentInput[];
  /** Holes, each a closed line + arc loop strictly inside the outer boundary and disjoint from each other. */
  readonly holes?: readonly (readonly ProfileSegmentInput[])[];
  readonly heightMM: number;
  readonly fromMM?: number;
}

const fail = (detail: string): never => { throw new ExtrudedProfileError('GEOMETRY', detail); };

/** A single full-circle segment is split into two half arcs (an Euler loop needs at least two edges). */
function atLeastTwo(segments: readonly ProfileSegment[]): ProfileSegment[] {
  if (segments.length > 1) return [...segments];
  const s = segments[0];
  if (s.kind !== 'arc') fail('A loop needs at least two segments');
  const arc = s as Extract<ProfileSegment, { kind: 'arc' }>, half = arc.sweep / 2, mid = arc.startAngle + half;
  const m: XY = [arc.center[0] + arc.radiusMM * Math.cos(mid), arc.center[1] + arc.radiusMM * Math.sin(mid)];
  return [{ ...arc, end: m, sweep: half, lengthMM: arc.lengthMM / 2 }, { ...arc, start: m, startAngle: mid, sweep: half, lengthMM: arc.lengthMM / 2 }];
}
function reverseCurve(c: Curve, id = c.id): Curve {
  const a = c.knots[0], b = c.knots[c.knots.length - 1];
  return { kind: 'curve', id, degree: c.degree, knots: c.knots.map(k => a + b - k).reverse(), controlPoints: [...c.controlPoints].reverse().map(p => [...p] as Point), weights: [...c.weights].reverse() };
}
const lift = (c: Curve, z: number, id: string): Curve => ({ ...c, id, controlPoints: c.controlPoints.map(p => [p[0], p[1], z] as Point) });
function samples(loop: readonly ProfileSegment[]): XY[] {
  return loop.flatMap(s => s.kind === 'line' ? [s.start] : Array.from({ length: 12 }, (_, k) => {
    const t = s.startAngle + s.sweep * k / 12; return [s.center[0] + s.radiusMM * Math.cos(t), s.center[1] + s.radiusMM * Math.sin(t)] as XY;
  }));
}
function inside(p: XY, ring: readonly XY[]): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

export function extrudeProfileWithHoles(input: ProfileWithHolesInput): Brep {
  const id = input.id ?? 'profile', z0 = input.fromMM ?? 0, z1 = z0 + input.heightMM;
  if (!(input.heightMM > 0) || !Number.isFinite(z1)) fail('A positive finite height is required');
  const budget = { maximumSegments: 1024 }, outerLoop = buildProfileLoop(input.outer, budget), outer = atLeastTwo(outerLoop.segments);
  const holeLoops = (input.holes ?? []).map(h => atLeastTwo(buildProfileLoop(h, budget).segments));
  // Holes strictly inside the outer boundary and pairwise disjoint (sampled; arcs at 30°).
  const outerRing = samples(outer), holeRings = holeLoops.map(samples);
  holeRings.forEach((ring, i) => {
    if (!ring.every(p => inside(p, outerRing))) fail(`Hole ${i} is not strictly inside the outer boundary`);
    holeRings.forEach((other, j) => { if (j !== i && (ring.some(p => inside(p, other)) || other.some(p => inside(p, ring)))) fail(`Holes ${i} and ${j} overlap`); });
  });

  const ed = new BrepEditor(id + '_'), at = (xy: XY, z = z0): Point => [xy[0], xy[1], z];
  // 1. Lamina: struts along the outer loop, closed by mef. The kept loop runs counter-clockwise.
  const root = ed.mvfs(at(outer[0].start)), verts = [root.vertex];
  for (let i = 1; i < outer.length; i++) verts.push(ed.mev(root.loop, verts[i - 1], at(outer[i].start), segmentCurve(outer[i - 1], z0, `${id}_o${i - 1}`)).vertex);
  const closed = ed.mef(ed.outOf(root.loop, verts[outer.length - 1]), ed.outOf(root.loop, verts[0]), segmentCurve(outer[outer.length - 1], z0, `${id}_o${outer.length - 1}`));
  const faceA = root.face, faceB = closed.face;

  // 2. Holes: bridge, hole struts, mef (plug face), kemr(bridge) → a clockwise ring of A.
  const plugs: string[] = [];
  holeLoops.forEach((hole, h) => {
    const bridge = ed.mev(root.loop, verts[0], at(hole[0].start)), hv = [bridge.vertex];
    let firstUp = '';
    for (let j = 1; j < hole.length; j++) {
      const r = ed.mev(root.loop, hv[j - 1], at(hole[j].start), segmentCurve(hole[j - 1], z0, `${id}_h${h}_${j - 1}`));
      if (j === 1) firstUp = r.up; hv.push(r.vertex);
    }
    // The closing edge runs h0 → h_last; its segment runs h_last → h0, so the curve is reversed.
    const plug = ed.mef(firstUp, ed.outOf(root.loop, hv[hole.length - 1]), reverseCurve(segmentCurve(hole[hole.length - 1], z0, `${id}_h${h}_${hole.length - 1}`)));
    plugs.push(plug.face);
    ed.kemr(bridge.edge);
  });

  // 3. Sweep every loop of A upward.
  const loopsOfA = [ed.faces.get(faceA)!.outer, ...ed.faces.get(faceA)!.inner];
  for (const loop of loopsOfA) {
    const cs = ed.loopCoedges(loop), n = cs.length, struts = cs.map(c => { const v = ed.start(c), p = ed.vertices.get(v)!.point; return ed.mev(loop, v, [p[0], p[1], z1], null, c); });
    let firstKept = '';
    cs.forEach((c, i) => {
      const coedge = ed.coedges.get(c)!, base = ed.edges.get(coedge.edge)!.curve!, along = coedge.sense === 'forward' ? base : reverseCurve(base);
      const b = i < n - 1 ? struts[i + 1].down : firstKept;
      const side = ed.mef(struts[i].down, b, lift(along, z1, `${base.id}_top`));
      if (i === 0) firstKept = side.kept;
      // Side face: S(u, v) = base(u) + v·Δz; outward exactly when the coedge runs along the curve.
      ed.setSurface(side.face, extrudedSurface(base, z0, z1, `${base.id}_side`), coedge.sense);
    });
  }

  // 4. Plugs become rings of the bottom face: through holes.
  for (const plug of plugs) ed.kfmrh(plug, faceB);
  ed.setSurface(faceA, capSurface(outerLoop.boundsMM, z1, `${id}_top`, true), 'forward');
  ed.setSurface(faceB, capSurface(outerLoop.boundsMM, z0, `${id}_bottom`, false), 'forward');
  return ed.toBrep({ family: 'profile-with-holes', id });
}

/**
 * Boolean of two prisms over the same height: the planar Boolean of their profiles (exact arrangement,
 * touching and shared edges included), each resulting region extruded with its holes. Several
 * disconnected regions give several bodies in one B-rep.
 */
export function extrudePolygonBoolean(a: readonly PolygonWithHoles[], b: readonly PolygonWithHoles[], operation: PlanarBooleanOperation,
  options: { readonly heightMM: number; readonly fromMM?: number; readonly id?: string }): { brep: Brep; regions: PolygonWithHoles[] } {
  const id = options.id ?? 'boolean', regions = booleanPolygons(a, b, operation), lines = (ring: readonly XY[]) => ring.map(start => ({ kind: 'line' as const, start: [start[0], start[1]] as XY }));
  const breps = regions.map((r, k) => extrudeProfileWithHoles({ id: `${id}${k}`, outer: lines(r.outer), holes: r.holes.map(lines), heightMM: options.heightMM, fromMM: options.fromMM }));
  return { brep: mergeBreps(breps, { family: 'polygon-boolean', id }), regions };
}
