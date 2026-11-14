import { buildBrep, checkBrep, lineCurve, type Brep, type BrepFaceInput, type BrepLoopInput } from '../brep/brep-core.js';
import { transformBrep } from '../brep/brep-transform.js';
import { CadNumericPolicy, linearToleranceMM } from '../numeric-policy.js';
import { capSurface, segmentCurve, type ProfileSegment } from './extruded-profile-solid.js';
import type { Curve, Point, Surface } from '../types.js';

const LINE = [0, 0, 1, 1], QUADRATIC = [0, 0, 0, 1, 1, 1];
type Use = BrepLoopInput['uses'][number];
type Edge = { id: string; name: string; curve: Curve; vertices: [string, string] };

function withinModelingRange(point: Point): boolean {
  return point.every(value => Math.abs(value) <= CadNumericPolicy.coordinateAbs);
}

/** An exact authored diameter and one semicircle, in a cardinal frame local to the sketch. */
export function draftHalfDisk(profile: readonly ProfileSegment[], names: readonly string[], z0: number, z1: number,
  slope: number, id: string, tag: string, fail: (detail: string) => never): Brep | undefined {
  const index = profile.findIndex(segment => segment.kind === 'arc');
  const arc = profile[index], diameter = profile[1 - index];
  if (arc?.kind !== 'arc' || diameter?.kind !== 'line' || arc.sweep !== Math.PI) return undefined;
  const [cx, cy] = arc.center, [ax, ay] = arc.start, [bx, by] = arc.end, r = arc.radius;
  const dx = ax - cx, dy = ay - cy;
  // Do not snap a nearly semicircular profile or an off-centre chord into this family.
  if (!(dx === 0 || dy === 0) || (dx === 0 && dy === 0) || bx - cx !== -dx || by - cy !== -dy) return undefined;
  const h = z1 - z0, d = h * slope, gap = r - 2 * d;
  if (!(d > 0 && r - d < r)) fail('the angle is too small to move the half-disk walls');
  // At the top, the chord is at d and the arc apex at r - d. The remaining sag must exceed the linear tolerance.
  const size = Math.max(r, h, Math.abs(cx), Math.abs(cy), Math.abs(z0), Math.abs(z1));
  if (!(gap > linearToleranceMM(size))) fail('the draft closes the half-disk at or before the top (steeper than the profile allows)');
  const rt = r - d, q = Math.sqrt(r * gap);
  const points: Record<string, Point> = {
    b0: [r, 0, 0], b1: [0, r, 0], b2: [-r, 0, 0],
    t0: [q, d, h], t1: [0, rt, h], t2: [-q, d, h],
  };
  const [wall, curved] = [names[1 - index], names[index]], right = curved + '#1', left = curved + '#2';
  const bottom = tag + '.bottom', top = tag + '.top';
  const edges: Edge[] = [];
  const edge = (key: string, from: string, to: string, faceA: string, faceB: string, curve?: Curve) => {
    edges.push({ id: key, vertices: [from, to], name: [faceA, faceB].sort().join('|'), curve: curve ?? lineCurve(key, points[from], points[to]) });
  };
  const arcAt = (key: string, from: string, to: string, radius: number, startAngle: number, sweep: number) => {
    const a = points[from], b = points[to];
    return segmentCurve({ kind: 'arc', center: [0, 0], radius, start: [a[0], a[1]], end: [b[0], b[1]], startAngle, sweep, length: radius * sweep }, a[2], key);
  };
  const R90 = Math.PI / 2, angle = Math.atan2(d, q);
  edge('b01', 'b0', 'b1', bottom, right, arcAt('b01', 'b0', 'b1', r, 0, R90));
  edge('b12', 'b1', 'b2', bottom, left, arcAt('b12', 'b1', 'b2', r, R90, R90));
  edge('b20', 'b2', 'b0', bottom, wall);
  edge('t01', 't0', 't1', top, right, arcAt('t01', 't0', 't1', rt, angle, R90 - angle));
  edge('t12', 't1', 't2', top, left, arcAt('t12', 't1', 't2', rt, R90, R90 - angle));
  edge('t20', 't2', 't0', top, wall);
  // The plane y = slope*z meets the cone x²+y² = (r-slope*z)² in x² = r²-2*r*slope*z.
  // In each half use x linear in t and z quadratic. The middle pole follows the derivative at t=0.
  const middleX = (r + q) / 2, middleZ = h * r / (r + q);
  for (const [key, sign, from, to, cone] of [['s0', 1, 'b0', 't0', right], ['s2', -1, 'b2', 't2', left]] as const) {
    edge(key, from, to, wall, cone, { kind: 'curve', id: key, degree: 2, knots: QUADRATIC,
      controlPoints: [points[from], [sign * middleX, slope * middleZ, middleZ], points[to]], weights: [1, 1, 1] });
  }
  edge('s1', 'b1', 't1', right, left);

  // Both sections of a support share the same fixed angular chart. The top trim occupies only part of it.
  const cone = (key: string, sector: readonly (readonly [number, number])[]): Surface => ({
    kind: 'surface', id: key, degreeU: 2, degreeV: 1, knotsU: QUADRATIC, knotsV: LINE,
    controlPoints: sector.map(([x, y]) => [[x * r, y * r, 0], [x * rt, y * rt, h]]),
    weights: [[1, 1], [Math.SQRT1_2, Math.SQRT1_2], [1, 1]],
  });
  const flat: Surface = {
    kind: 'surface', id: 'wall', degreeU: 1, degreeV: 1, knotsU: LINE, knotsV: LINE,
    controlPoints: [[[-r, 0, 0], [-r, d, h]], [[r, 0, 0], [r, d, h]]], weights: [[1, 1], [1, 1]],
  };
  const rise = (edge: string): Use => ({ edge, sense: 'forward' });
  const fall = (edge: string): Use => ({ edge, sense: 'reversed' });
  const face = (name: string, surface: Surface, uses: Use[]): BrepFaceInput => ({
    id: surface.id, name, surface, sense: 'forward', loops: [{ kind: 'outer', uses }],
  });
  const faces = [
    face(bottom, capSurface({ min: [-r, 0], max: [r, r] }, 0, 'bottom', false), [fall('b20'), fall('b12'), fall('b01')]),
    face(top, capSurface({ min: [-q, d], max: [q, rt] }, h, 'top', true), [rise('t01'), rise('t12'), rise('t20')]),
    face(wall, flat, [rise('b20'), rise('s0'), fall('t20'), fall('s2')]),
    face(right, cone('right', [[1, 0], [1, 1], [0, 1]]), [rise('b01'), rise('s1'), fall('t01'), fall('s0')]),
    face(left, cone('left', [[0, 1], [-1, 1], [-1, 0]]), [rise('b12'), rise('s2'), fall('t12'), fall('s1')]),
  ];
  const local = buildBrep({ source: { family: 'drafted-extrusion', id }, vertices: Object.entries(points).map(([key, point]) => ({ id: key, point })),
    edges, bodies: [{ id: id + '_body', kind: 'solid', shells: [{ id: 's', closed: true, faces }] }] });
  const x = dx / r, y = dy / r;
  const brep = transformBrep(local, { matrix: [x, -y, 0, y, x, 0, 0, 0, 1], offset: [cx, cy, z0] });
  if (!brep.vertices.every(vertex => withinModelingRange(vertex.point))
    || !brep.edges.every(({ curve }) => curve.controlPoints.every(withinModelingRange))
    || !brep.faces.every(({ surface }) => surface.kind === 'surface' && surface.controlPoints.every(row => row.every(withinModelingRange))))
    fail('the drafted half-disk exceeds the ±10000 mm modeling coordinate range');
  const report = checkBrep(brep, { strict: true });
  if (!report.valid) fail(`the drafted half-disk is invalid: ${report.issues[0]}`);
  return brep;
}
