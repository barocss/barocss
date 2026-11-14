import { curveDomain, surfaceDomain } from '../core/math.js';
import { add, cross, dist, dot, len, scale, sub, unit } from '../core/vec3.js';
import { geometryScaleMM, linearToleranceMM } from '../numeric-policy.js';
import type { Curve, Point } from '../types.js';
import type { Brep, BrepEdge, BrepFace } from './brep-core.js';

type Range = readonly [number, number];
type ChartDomain = { readonly u: Range; readonly v: Range };
type PlaneChart = {
  readonly origin: Point;
  readonly u: Point;
  readonly v: Point;
  readonly normal: Point;
  readonly domain: ChartDomain;
};

// The native stitch permits gaps at its edges. Require agreement at the scale of floating-point rounding.
const ROUNDING = 64 * Number.EPSILON;
function roundoffAt(points: readonly Point[]): number {
  return ROUNDING * Math.max(1, geometryScaleMM(points));
}

function affinePlane(face: BrepFace): PlaneChart | undefined {
  const s = face.surface;
  if (s.kind !== 'surface' || s.degreeU !== 1 || s.degreeV !== 1
    || s.controlPoints.length !== 2 || s.controlPoints[0].length !== 2) return undefined;
  const domain = surfaceDomain(s);
  const [[origin, vEnd], [uEnd, diagonal]] = s.controlPoints;
  if (!s.weights.every(row => row.every(weight => weight === s.weights[0][0]))) return undefined;
  const u = sub(uEnd, origin), v = sub(vEnd, origin);
  if (dist(sub(diagonal, uEnd), v) > roundoffAt([origin, vEnd, uEnd, diagonal])) return undefined;
  const n = cross(unit(u), unit(v));
  if (!(len(n) > ROUNDING)) return undefined;
  return { origin, u, v, normal: scale(unit(n), face.sense === 'forward' ? 1 : -1), domain };
}

function admitsBoxPlanes(planes: readonly PlaneChart[]): boolean {
  return planes.length === 6 && planes.every(plane => {
    let oppositeCount = 0;
    for (const other of planes) {
      if (other === plane) continue;
      const alignment = dot(plane.normal, other.normal);
      if (dist(plane.normal, scale(other.normal, -1)) <= ROUNDING) {
        if (!(dot(sub(plane.origin, other.origin), plane.normal) > 0)) return false;
        oppositeCount++;
      } else if (Math.abs(alignment) > ROUNDING) return false;
    }
    return oppositeCount === 1;
  });
}

function quarterCylinder(face: BrepFace) {
  const s = face.surface;
  if (s.kind !== 'surface' || s.degreeU !== 2 || s.degreeV !== 1
    || s.controlPoints.length !== 3 || s.controlPoints[0].length !== 2) return undefined;
  const domain = surfaceDomain(s);
  const [[first, firstEnd], [corner, cornerEnd], [last, lastEnd]] = s.controlPoints;
  const [edgeWeight, middleWeight, lastWeight] = s.weights.map(row => row[0]);
  if (!s.weights.every(row => row[0] === row[1]) || edgeWeight !== lastWeight
    || Math.abs(middleWeight / edgeWeight - Math.SQRT1_2) > ROUNDING) return undefined;

  const axis = sub(firstEnd, first), axisDirection = unit(axis);
  const r0 = sub(last, corner), r1 = sub(first, corner);
  const radius = len(r0), r0Direction = unit(r0), r1Direction = unit(r1);
  const rounding = roundoffAt([first, firstEnd, corner, cornerEnd, last, lastEnd]);
  if (!(len(axis) > rounding && radius > rounding && len(r1) > rounding)
    || Math.abs(radius - len(r1)) > rounding
    || Math.abs(dot(r0Direction, r1Direction)) > ROUNDING
    || Math.abs(dot(r0Direction, axisDirection)) > ROUNDING
    || Math.abs(dot(r1Direction, axisDirection)) > ROUNDING
    || dist(sub(cornerEnd, corner), axis) > rounding
    || dist(sub(lastEnd, last), axis) > rounding) return undefined;

  // A right-angle tangent triangle and the middle weight cos(π/4) define a circular quadrant.
  const outward = face.sense === 'forward' ? 1 : -1;
  return {
    domain,
    generators: [
      { u: domain.u[0], start: first, end: firstEnd, normal: scale(unit(cross(r1, axis)), -outward) },
      { u: domain.u[1], start: last, end: lastEnd, normal: scale(unit(cross(r0, axis)), outward) },
    ],
  };
}

function interpolate([start, end]: Range, fraction: number): number {
  return (1 - fraction) * start + fraction * end;
}

function clampFraction(fraction: number): number {
  return Math.min(1, Math.max(0, fraction));
}

function planeParameter(chart: PlaneChart, point: Point, tolerance: number): Point | undefined {
  const offset = sub(point, chart.origin), { u, v, normal } = chart;
  const uAcross = cross(v, normal), vAcross = cross(normal, u);
  const fu = clampFraction(dot(offset, uAcross) / dot(u, uAcross));
  const fv = clampFraction(dot(offset, vAcross) / dot(v, vAcross));
  const lifted = add(chart.origin, add(scale(u, fu), scale(v, fv)));
  if (!(dist(lifted, point) <= tolerance)) return undefined;
  return [interpolate(chart.domain.u, fu), interpolate(chart.domain.v, fv), 0];
}

function generatorParameter(origin: Point, span: Point, point: Point, tolerance: number): number | undefined {
  const fraction = clampFraction(dot(sub(point, origin), unit(span)) / len(span));
  return dist(add(origin, scale(span, fraction)), point) <= tolerance ? fraction : undefined;
}

/** Recover local parameter lines for the two straight interfaces of a single round on a box. */
export function recoverBoxFilletBindings(brep: Brep, edge: BrepEdge, first: BrepFace, second: BrepFace): [Curve, Curve] | undefined {
  const { bodies, shells, faces, loops, coedges, edges, vertices } = brep;
  const line = edge.curve;
  if (brep.source.family !== 'analytic-boolean' || bodies.length !== 1 || bodies[0].kind !== 'solid'
    || shells.length !== 1 || !shells[0].closed || shells[0].body !== bodies[0].id
    || bodies[0].shells.length !== 1 || bodies[0].shells[0] !== shells[0].id || shells[0].faces.length !== 7
    || faces.length !== 7 || loops.length !== 7
    || coedges.length !== 30 || edges.length !== 15 || vertices.length !== 10
    || edge.vertices[0] === edge.vertices[1]
    || line.degree !== 1 || line.controlPoints.length !== 2 || line.weights[0] !== line.weights[1]) return undefined;

  try {
    const domain = curveDomain(line);
    return recoverBindings(brep, edge, first, second, domain);
  } catch {
    return undefined;
  }
}

function recoverBindings(brep: Brep, edge: BrepEdge, first: BrepFace, second: BrepFace, [t0, t1]: Range): [Curve, Curve] | undefined {
  const firstPlane = affinePlane(first), secondPlane = affinePlane(second);
  if (!!firstPlane === !!secondPlane) return undefined;
  const plane = firstPlane ?? secondPlane!;
  const cylinderFace = firstPlane ? second : first;
  const cylinder = quarterCylinder(cylinderFace);
  if (!cylinder) return undefined;
  const planes: PlaneChart[] = [];
  for (const face of brep.faces) {
    const loop = brep.loops.find(loop => loop.id === face.loops[0]);
    if (face.shell !== first.shell || !brep.shells[0].faces.includes(face.id)
      || face.loops.length !== 1 || loop?.kind !== 'outer' || loop.face !== face.id) return undefined;
    if (face === cylinderFace) {
      if (loop.coedges.length !== 4) return undefined;
      continue;
    }
    const chart = affinePlane(face);
    if (!chart) return undefined;
    planes.push(chart);
  }
  if (!admitsBoxPlanes(planes)) return undefined;

  const [start, end] = edge.curve.controlPoints;
  const [startVertex, endVertex] = edge.vertices.map(id => brep.vertices.find(vertex => vertex.id === id));
  const tolerance = Math.min(edge.tolerance, linearToleranceMM(geometryScaleMM(edge.curve.controlPoints)), roundoffAt([start, end]));
  if (!startVertex || !endVertex || !(dist(start, end) > tolerance
    && dist(start, startVertex.point) <= tolerance && dist(end, endVertex.point) <= tolerance)) return undefined;

  const planeStart = planeParameter(plane, start, tolerance), planeEnd = planeParameter(plane, end, tolerance);
  if (!planeStart || !planeEnd) return undefined;
  const pcurve = (start: Point, end: Point): Curve => ({
    kind: 'curve', id: edge.curve.id, degree: 1, knots: [t0, t0, t1, t1], controlPoints: [start, end], weights: [1, 1],
  });
  let cylinderBinding: Curve | undefined;
  for (const generator of cylinder.generators) {
    const axis = sub(generator.end, generator.start);
    const v0 = generatorParameter(generator.start, axis, start, tolerance);
    const v1 = generatorParameter(generator.start, axis, end, tolerance);
    if (v0 === undefined || v1 === undefined || v0 === v1) continue;
    if (cylinderBinding || dist(generator.normal, plane.normal) > ROUNDING) return undefined;
    const vDomain = cylinder.domain.v;
    cylinderBinding = pcurve([generator.u, interpolate(vDomain, v0), 0], [generator.u, interpolate(vDomain, v1), 0]);
  }
  if (!cylinderBinding) return undefined;
  const planeBinding = pcurve(planeStart, planeEnd);
  return firstPlane ? [planeBinding, cylinderBinding] : [cylinderBinding, planeBinding];
}
