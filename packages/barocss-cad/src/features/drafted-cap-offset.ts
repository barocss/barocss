import { faceGeometry } from '../brep/analytic-boolean.js';
import { BrepError, checkBrep, type Brep, type BrepFace, type BrepVertex } from '../brep/brep-core.js';
import { CadNumericPolicy, linearToleranceMM } from '../numeric-policy.js';
import type { Point, Surface } from '../types.js';
import { capSurface } from './extruded-profile-solid.js';

type Axis = 0 | 1;
type End = 0 | 1;
type Range = [number, number];
type Rectangle = [Range, Range];
type Section = { readonly z: number; readonly ranges: Rectangle };
type FaceRole = { readonly axis: Axis | 2; readonly end: End };
type Plane = Extract<ReturnType<typeof faceGeometry>, { kind: 'plane' }>;
type Wall = { readonly axis: Axis; readonly end: End; readonly plane: Plane; readonly slope: number };
type DraftedCap = {
  readonly sections: readonly [Section, Section];
  readonly end: End;
  readonly named: BrepFace;
  readonly opposite: BrepFace;
  readonly walls: ReadonlyMap<string, Wall>;
};

const XY_AXES = [0, 1] as const;
const ENDS = [0, 1] as const;
const LINEAR_KNOTS = [0, 0, 1, 1];

/** Exact corner incidence in a horizontal rectangle. Includes four independent vertices. */
function sectionOf(vertices: readonly BrepVertex[], z: number): Section | undefined {
  const points = vertices.filter(vertex => vertex.point[2] === z).map(vertex => vertex.point);
  if (points.length !== 4 || new Set(points.map(p => p.join(','))).size !== 4) return undefined;
  const levels = (axis: Axis) => [...new Set(points.map(p => p[axis]))].sort((a, b) => a - b);
  const x = levels(0), y = levels(1);
  if (x.length !== 2 || y.length !== 2) return undefined;
  return { z, ranges: [[x[0], x[1]], [y[0], y[1]]] };
}

function endOf(section: Section, point: Point, axis: Axis): End {
  return point[axis] === section.ranges[axis][0] ? 0 : 1;
}

function roleOf(corners: readonly Point[], base: Section, top: Section): FaceRole | undefined {
  if (corners.length !== 4 || new Set(corners).size !== 4) return undefined;
  const low = corners.filter(point => point[2] === base.z), high = corners.filter(point => point[2] === top.z);
  if (low.length === 4) return { axis: 2, end: 0 };
  if (high.length === 4) return { axis: 2, end: 1 };
  if (low.length !== 2 || high.length !== 2) return undefined;
  for (const axis of XY_AXES) for (const end of ENDS) {
    if (low.every(point => point[axis] === base.ranges[axis][end]) && high.every(point => point[axis] === top.ranges[axis][end]))
      return { axis, end };
  }
  return undefined;
}

function planeOf(face: BrepFace): Plane | undefined {
  const s = face.surface;
  if (s.kind !== 'surface' || s.degreeU !== 1 || s.degreeV !== 1 || s.controlPoints.length !== 2
    || s.controlPoints.some(row => row.length !== 2)) return undefined;
  try {
    const plane = faceGeometry(face);
    return plane.kind === 'plane' ? plane : undefined;
  } catch { return undefined; }
}

function wallAt(wall: Wall, z: number): number {
  return wall.plane.o[wall.axis] + (z - wall.plane.o[2]) * wall.slope;
}

/** A rounding allowance for agreeing on the native support, separate from general trim tolerances. */
function roundoffAt(points: readonly Point[]): number {
  return 64 * Number.EPSILON * Math.max(1, ...points.flatMap(p => p.map(Math.abs)));
}

/** One solid, two four-edge sections, four matching straight connectors and one support per side. */
function admittedCap(brep: Brep, named: BrepFace): DraftedCap | undefined {
  const { bodies, shells, faces, loops, coedges, edges, vertices } = brep;
  if (bodies.length !== 1 || bodies[0].kind !== 'solid' || bodies[0].shells.length !== 1 || shells.length !== 1
    || !shells[0].closed || faces.length !== 6 || loops.length !== 6 || coedges.length !== 24 || edges.length !== 12 || vertices.length !== 8) return undefined;
  const heights = [...new Set(vertices.map(vertex => vertex.point[2]))].sort((a, b) => a - b);
  if (heights.length !== 2) return undefined;
  const base = sectionOf(vertices, heights[0]), top = sectionOf(vertices, heights[1]);
  if (!base || !top) return undefined;
  const roundoff = roundoffAt(vertices.map(vertex => vertex.point));
  const widths = (s: Section, axis: Axis) => s.ranges[axis][1] - s.ranges[axis][0];
  // A parallel-sided extrusion or pure shear does not have a tapered section.
  if (!XY_AXES.some(axis => Math.abs(widths(base, axis) - widths(top, axis)) > roundoff)) return undefined;

  const point = new Map(vertices.map(vertex => [vertex.id, vertex.point]));
  const edgeById = new Map(edges.map(edge => [edge.id, edge]));
  const coedgeById = new Map(coedges.map(coedge => [coedge.id, coedge]));
  const loopById = new Map(loops.map(loop => [loop.id, loop]));
  const pairs = new Set<string>();
  for (const edge of edges) {
    const [a, b] = edge.vertices.map(id => point.get(id));
    const poles = edge.curve.controlPoints, key = JSON.stringify([...edge.vertices].sort());
    if (!a || !b || pairs.has(key) || edge.curve.degree !== 1 || poles.length !== 2
      || !poles[0].every((value, i) => value === a[i]) || !poles[1].every((value, i) => value === b[i])) return undefined;
    pairs.add(key);
    const endA = a[2] === base.z ? base : top, endB = b[2] === base.z ? base : top;
    const differing = XY_AXES.filter(axis => endOf(endA, a, axis) !== endOf(endB, b, axis)).length;
    if (differing !== (endA === endB ? 1 : 0)) return undefined;
  }

  const walls = new Map<string, Wall>(), occupied = new Set<string>();
  const caps: [BrepFace?, BrepFace?] = [];
  for (const face of faces) {
    const loop = face.loops.length === 1 ? loopById.get(face.loops[0]) : undefined;
    if (loop?.kind !== 'outer' || loop.coedges.length !== 4) return undefined;
    const corners: Point[] = [];
    for (const id of loop.coedges) {
      const use = coedgeById.get(id), edge = use && edgeById.get(use.edge);
      const p = edge && point.get(edge.vertices[use!.sense === 'forward' ? 0 : 1]);
      if (!p) return undefined;
      corners.push(p);
    }
    const role = roleOf(corners, base, top);
    const plane = planeOf(face);
    if (!role || !plane || face.surface.kind !== 'surface') return undefined;
    const { axis, end } = role;
    if (!(plane.n[axis] * (end === 0 ? -1 : 1) > 0)) return undefined;
    const key = `${role.axis}:${role.end}`;
    if (occupied.has(key)) return undefined;
    occupied.add(key);
    const poles = face.surface.controlPoints.flat();
    if (axis === 2) {
      if (!poles.every(p => p[2] === (end === 0 ? base.z : top.z))) return undefined;
      caps[end] = face;
      continue;
    }
    const wall = { axis, end, plane, slope: -plane.n[2] / plane.n[axis] };
    // A generally valid B-rep may tolerate gaps. Require the trim and every pole on the same cardinal wall.
    if (![...poles, ...corners].every(p => Math.abs(p[axis] - wallAt(wall, p[2])) <= roundoff)) return undefined;
    walls.set(face.id, wall);
  }
  const end = caps[0] === named ? 0 : caps[1] === named ? 1 : undefined;
  if (end === undefined || !caps[0] || !caps[1] || !checkBrep(brep, { strict: true }).valid) return undefined;
  return { sections: [base, top], end, named, opposite: caps[1 - end]!, walls };
}

function namedCap(brep: Brep, faceName: string): BrepFace | undefined {
  const faces = brep.faces.filter(face => face.name === faceName);
  return faces.length === 1 ? faces[0] : undefined;
}

/** Locate the exact named end and its signed outward normal. */
export function draftedCapOffsetFrame(brep: Brep, faceName: string): { anchor: Point; normal: Point } | undefined {
  const face = namedCap(brep, faceName);
  if (!face) return undefined;
  try {
    const cap = admittedCap(brep, face);
    if (!cap) return undefined;
    const { z, ranges: [[x0, x1], [y0, y1]] } = cap.sections[cap.end];
    return { anchor: [(x0 + x1) / 2, (y0 + y1) / 2, z], normal: [0, 0, cap.end === 0 ? -1 : 1] };
  } catch { return undefined; }
}

/** Put the wall chart on its continued plane, enclosing the new trim without overhanging poles. */
function sideSurface(id: string, axis: Axis, end: End, base: Section, top: Section): Surface {
  const across: Axis = axis === 0 ? 1 : 0;
  const span = [Math.min(base.ranges[across][0], top.ranges[across][0]), Math.max(base.ranges[across][1], top.ranges[across][1])];
  const controlPoints = span.map(u => [base, top].map(({ z, ranges }): Point => {
    const v = ranges[axis][end];
    return axis === 0 ? [v, u, z] : [u, v, z];
  }));
  return { kind: 'surface', id, degreeU: 1, degreeV: 1, knotsU: LINEAR_KNOTS, knotsV: LINEAR_KNOTS, controlPoints, weights: [[1, 1], [1, 1]] };
}

function polesFit(surface: Surface): boolean {
  return surface.controlPoints.every(row => row.every(p => p.every(value => Math.abs(value) <= CadNumericPolicy.coordinateAbs)));
}

/** A wall chart spanning both sections can remain in place as the trim moves over it. */
function chartCovers(surface: Surface, wall: Wall, base: Section, top: Section): boolean {
  const poles = surface.controlPoints.flat(), across: Axis = wall.axis === 0 ? 1 : 0;
  const lo = Math.min(...poles.map(p => p[2])), hi = Math.max(...poles.map(p => p[2]));
  if (!(hi > lo) || base.z < lo || top.z > hi) return false;
  const atLo = poles.filter(p => p[2] === lo).map(p => p[across]).sort((a, b) => a - b);
  const atHi = poles.filter(p => p[2] === hi).map(p => p[across]).sort((a, b) => a - b);
  if (atLo.length !== 2 || atHi.length !== 2 || !(atLo[0] < atLo[1] && atHi[0] < atHi[1])) return false;
  // Two horizontal boundary edges enclosing the two sections also enclose their connecting lines.
  const at = (z: number, end: End) => atLo[end] + (atHi[end] - atLo[end]) * ((z - lo) / (hi - lo));
  const roundoff = roundoffAt(poles);
  return [base, top].every(({ z, ranges }) => ranges[across][0] >= at(z, 0) - roundoff && ranges[across][1] <= at(z, 1) + roundoff);
}

function fail(code: BrepError['code'], detail: string): never {
  throw new BrepError(code, 'drafted cap offset: ' + detail);
}

/** Move the named Z-facing cap outwards by a signed distance along its existing planar supports. */
export function offsetDraftedCap(brep: Brep, faceName: string, distance: number): Brep {
  if (typeof distance !== 'number' || !Number.isFinite(distance)) fail('INPUT', 'distance must be finite');
  const face = namedCap(brep, faceName);
  if (!face) fail('INPUT', 'the selected face name is missing or ambiguous');
  const cap = admittedCap(brep, face);
  if (!cap) fail('GEOMETRY', 'pick a Z-facing cap of one solid with tapered planar walls and rectangular sections');
  if (distance === 0) return brep;
  const { sections, end, named, opposite, walls } = cap, outward = end === 0 ? -1 : 1;
  const selected = sections[end], fixed = sections[1 - end], z = selected.z + outward * distance;
  if (z === selected.z) fail('GEOMETRY', 'distance is too small to move the cap');
  const far: Section = { z, ranges: [[0, 0], [0, 0]] };
  for (const wall of walls.values()) far.ranges[wall.axis][wall.end] = wallAt(wall, z);
  const extent = Math.max(Math.abs(fixed.z), Math.abs(z), ...fixed.ranges.flat().map(Math.abs), ...far.ranges.flat().map(Math.abs));
  // The retained cap's chart can be padded beyond its four trim corners.
  const fixedFits = opposite.surface.kind === 'surface' && polesFit(opposite.surface);
  if (!Number.isFinite(extent) || extent > CadNumericPolicy.coordinateAbs || !fixedFits)
    fail('GEOMETRY', 'the offset exceeds the modeling coordinate range');
  const linear = linearToleranceMM(extent);
  if ((z - fixed.z) * outward <= linear || far.ranges.some(([lo, hi]) => hi - lo <= linear))
    fail('GEOMETRY', 'the offset would close a wall or cross the opposite cap');
  const [base, top] = end === 0 ? [far, fixed] : [fixed, far];

  const vertices = brep.vertices.map(vertex => {
    const p = vertex.point;
    if (p[2] === fixed.z) return vertex;
    const point: Point = [far.ranges[0][endOf(selected, p, 0)], far.ranges[1][endOf(selected, p, 1)], z];
    return { ...vertex, point };
  });
  const point = new Map(vertices.map(vertex => [vertex.id, vertex.point]));
  const edges = brep.edges.map(edge => {
    const [a, b] = edge.vertices.map(id => point.get(id)!);
    if (a[2] === fixed.z && b[2] === fixed.z) return edge;
    return { ...edge, curve: { ...edge.curve, controlPoints: [a, b] } };
  });
  const faces = brep.faces.map(face => {
    if (face === named) {
      const [[x0, x1], [y0, y1]] = far.ranges;
      return { ...face, sense: 'forward' as const, surface: capSurface({ min: [x0, y0], max: [x1, y1] }, z, face.surface.id, end === 1) };
    }
    const wall = walls.get(face.id);
    if (!wall) return face; // The opposite cap and its own trim are unchanged.
    if (face.surface.kind === 'surface' && polesFit(face.surface) && chartCovers(face.surface, wall, base, top)) return face;
    const { axis, end: wallEnd } = wall;
    const sense = (axis === 1 ? wallEnd === 0 : wallEnd === 1) ? 'forward' as const : 'reversed' as const;
    const adjusted = { ...face, sense, surface: sideSurface(face.surface.id, axis, wallEnd, base, top) };
    const plane = planeOf(adjusted), normalError = plane ? Math.hypot(...plane.n.map((n, i) => n - wall.plane.n[i])) : Infinity;
    const span = Math.max(1, ...base.ranges.map(([lo, hi]) => hi - lo), ...top.ranges.map(([lo, hi]) => hi - lo), top.z - base.z);
    if (normalError * span > linear) fail('GEOMETRY', 'the offset cannot preserve the side wall planes at this distance');
    return adjusted;
  });
  const unchanged = opposite.loops[0];
  const coedges = brep.coedges.map(coedge => coedge.loop === unchanged ? coedge : { ...coedge, pcurve: null });
  const result: Brep = { ...brep, vertices, edges, faces, coedges };
  const report = checkBrep(result, { strict: true });
  if (!report.valid) fail('GEOMETRY', `the offset solid is invalid: ${report.issues[0]}`);
  return result;
}
