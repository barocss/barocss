import { evaluateSurfaceD1 } from '../core/derivatives.js';
import { surfaceDomain } from '../core/math.js';
import { add, cross, dot, len, scale, sub, unit } from '../core/vec3.js';
import { linearToleranceMM } from '../numeric-policy.js';
import { faceGeometry, type FaceGeometry } from './analytic-boolean.js';
import { coedgeVertices, type Brep, type BrepFace } from './brep-core.js';
import { circleOf } from './brep-tessellate.js';

type Cylinder = Extract<FaceGeometry, { kind: 'cylinder' }>;
type RimArc = { start: string; end: string; station: number; sweep: number };
const ANGULAR_TOLERANCE = 1e-8;
const byId = <T extends { readonly id: string }>(items: readonly T[]) => new Map(items.map(item => [item.id, item]));

function inwardCylinder(face: BrepFace): Cylinder | undefined {
  if (face.surface.kind !== 'surface') return;
  const cylinder = faceGeometry(face);
  if (cylinder.kind !== 'cylinder' || cylinder.out !== -1 || !Number.isFinite(cylinder.r) || cylinder.r <= 0
    || !cylinder.c.every(Number.isFinite) || !(Math.abs(len(cylinder.a) - 1) <= ANGULAR_TOLERANCE)) return;

  const { u, v } = surfaceDomain(face.surface);
  // A half cylinder can have a repeated U knot at its center. Evaluate inside a single span.
  const spanEnd = face.surface.knotsU.find(knot => knot > u[0]);
  if (spanEnd === undefined || spanEnd > u[1]) return;
  const atU = u[0] + (spanEnd - u[0]) / 2;
  if (!(u[0] < atU && atU < spanEnd)) return;
  const { point, du, dv } = evaluateSurfaceD1(face.surface, atU, v[0] + (v[1] - v[0]) / 2);
  const normal = cross(du, dv), delta = sub(point, cylinder.c);
  const radial = sub(delta, scale(cylinder.a, dot(delta, cylinder.a)));
  if (!(len(normal) > 0) || !(len(radial) > 0)) return;
  const cosine = dot(unit(normal), unit(radial)) * (face.sense === 'forward' ? 1 : -1);
  // The analytic classifier has only two signs. Require a regular native normal that points toward the axis.
  return Number.isFinite(cosine) && cosine < -1 + ANGULAR_TOLERANCE ? cylinder : undefined;
}

function arcOnCylinder(curve: Brep['edges'][number]['curve'], cylinder: Cylinder, tolerance: number) {
  const circle = circleOf(curve);
  if (!circle || !(Math.abs(circle.r - cylinder.r) <= tolerance)) return;
  const normal = scale(cross(circle.e1, circle.e2), circle.sign);
  const offset = sub(circle.c, cylinder.c), station = dot(offset, cylinder.a), alignment = dot(normal, cylinder.a);
  if (!Number.isFinite(station) || !(Math.abs(alignment) >= 1 - ANGULAR_TOLERANCE)
    || !(len(cross(normal, cylinder.a)) <= ANGULAR_TOLERANCE)
    || !(len(cross(offset, cylinder.a)) <= tolerance)) return;

  // A rim uses rational quadratic circle spans. Check each span's poles and knot interval on the same circle.
  const { controlPoints: points, knots } = curve;
  const first = circle.spans[0], last = circle.spans[circle.spans.length - 1];
  if (knots[0] !== first.k0 || knots[1] !== first.k0 || knots[knots.length - 1] !== last.k1
    || knots[knots.length - 2] !== last.k1) return;
  let sweep = 0;
  for (const [i, span] of circle.spans.entries()) {
    if (!(span.k1 > span.k0) || (i && span.k0 !== circle.spans[i - 1].k1)) return;
    const radial = sub(points[2 * i], circle.c), tangent = cross(normal, radial);
    if (!(Math.abs(len(radial) - cylinder.r) <= tolerance) || !(Math.abs(dot(radial, normal)) <= tolerance)) return;
    const middle = add(radial, scale(tangent, Math.tan(span.phi / 2)));
    const end = add(scale(radial, Math.cos(span.phi)), scale(tangent, Math.sin(span.phi)));
    if (!(len(sub(sub(points[2 * i + 1], circle.c), middle)) <= tolerance)
      || !(len(sub(sub(points[2 * i + 2], circle.c), end)) <= tolerance)) return;
    sweep += span.phi;
  }
  return { station, sweep: sweep * Math.sign(alignment) };
}

function rimWinding(arcs: readonly RimArc[]): number | undefined {
  if (!arcs.length) return;
  const byStart = new Map(arcs.map(arc => [arc.start, arc]));
  if (byStart.size !== arcs.length) return;
  const first = arcs[0].start, direction = Math.sign(arcs[0].sweep);
  if (!direction) return;
  let start = first, sweep = 0;
  do {
    const arc = byStart.get(start);
    if (!arc || Math.sign(arc.sweep) !== direction) return;
    byStart.delete(start);
    start = arc.end;
    sweep += arc.sweep;
  } while (start !== first);
  if (!byStart.size && Math.abs(sweep - direction * 2 * Math.PI) <= ANGULAR_TOLERANCE) return direction;
}

/** Reads the diameter of a selected cylindrical wall with two complete circular rims on a closed solid's outer shell. */
export function createCylindricalBoreCheck(brep: Brep): (members: readonly BrepFace[]) => number | undefined {
  const readTopology = () => ({
    faces: byId(brep.faces), shells: byId(brep.shells), bodies: byId(brep.bodies),
    loops: byId(brep.loops), coedges: byId(brep.coedges), edges: byId(brep.edges),
  });
  let topology: ReturnType<typeof readTopology> | undefined;
  return members => {
    const first = members[0];
    if (!first) return;
    const { faces, shells, bodies, loops, coedges, edges } = (topology ??= readTopology());
    const shell = shells.get(first.shell), body = shell && bodies.get(shell.body);
    if (!shell?.closed || body?.kind !== 'solid' || body.shells[0] !== shell.id) return;

    try {
      const cylinder = inwardCylinder(first);
      if (!cylinder || !Number.isFinite(2 * cylinder.r)) return;
      const [x, y, z] = cylinder.c;
      const tolerance = linearToleranceMM(Math.max(cylinder.r, Math.abs(x), Math.abs(y), Math.abs(z)));
      const selected = new Set(members.map(face => face.id));
      if (selected.size !== members.length) return;
      const rims: [RimArc[], RimArc[]] = [[], []];
      for (const face of members) {
        if (faces.get(face.id) !== face || face.shell !== shell.id) return;
        const geometry = face === first ? cylinder : inwardCylinder(face);
        if (!geometry || Math.abs(geometry.r - cylinder.r) > tolerance
          || len(cross(geometry.a, cylinder.a)) > ANGULAR_TOLERANCE
          || len(cross(sub(geometry.c, cylinder.c), cylinder.a)) > tolerance) return;

        for (const loopId of face.loops) {
          const loop = loops.get(loopId);
          if (loop?.face !== face.id) return;
          for (const id of loop.coedges) {
            const use = coedges.get(id), twin = use?.twin && coedges.get(use.twin);
            const twinLoop = twin && loops.get(twin.loop);
            if (use?.loop !== loopId || !twin || !twinLoop || twin.twin !== id || twin.edge !== use.edge || twin.sense === use.sense) return;
            if (selected.has(twinLoop.face)) continue;
            const edge = edges.get(use.edge), arc = edge && arcOnCylinder(edge.curve, cylinder, tolerance);
            if (!arc) return;
            const [start, end] = coedgeVertices(brep, use, edges);
            const rim = !rims[0].length || Math.abs(arc.station - rims[0][0].station) <= tolerance ? rims[0] : rims[1];
            if (rim.length && Math.abs(arc.station - rim[0].station) > tolerance) return;
            rim.push({ start, end, station: arc.station, sweep: use.sense === 'forward' ? arc.sweep : -arc.sweep });
          }
        }
      }
      const firstWinding = rimWinding(rims[0]);
      if (firstWinding !== undefined && rimWinding(rims[1]) === -firstWinding) return 2 * cylinder.r;
    } catch { /* Unrecognized native geometry cannot establish a bore. */ }
  };
}
