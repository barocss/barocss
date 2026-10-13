import type { Body, BoxShape, Hit, Vec3 } from './types.js';
import { add, dot, rotate, scale, sub } from './math.js';

export interface ManifoldPoint { id: string; pointM: Vec3 }
interface Face { body: Body; axes: Vec3[]; extents: Vec3; axis: number; side: number }

const basis = (body: Body): Vec3[] =>
  ([[1, 0, 0], [0, 1, 0], [0, 0, 1]] as Vec3[])
    .map((axis) => rotate(body.orientation, axis));

function referenceFace(body: Body, axes: Vec3[], normal: Vec3): Face | null {
  for (let axis = 0; axis < 3; axis++) {
    const alignment = dot(axes[axis], normal);
    if (Math.abs(alignment) >= 1 - 1e-6) {
      return { body, axes, extents: (body.shape as BoxShape).halfExtentsM,
        axis, side: Math.sign(alignment) };
    }
  }
  return null;
}

function clip(polygon: Vec3[], centre: Vec3, axis: Vec3, limit: number): Vec3[] {
  const result: Vec3[] = [];
  for (let index = 0; index < polygon.length; index++) {
    const current = polygon[index], next = polygon[(index + 1) % polygon.length];
    // Classify and intersect against the *same* tolerance-shifted plane.
    // Using a 1e-9 inside test with an unshifted intersection plane can
    // extrapolate outside the edge when both endpoints lie within the
    // tolerance band on the same side of the true plane.
    const a = dot(sub(current, centre), axis) - limit - 1e-9;
    const b = dot(sub(next, centre), axis) - limit - 1e-9;
    const insideA = a <= 0, insideB = b <= 0;
    if (insideA) result.push(current);
    if (insideA !== insideB) result.push(add(current, scale(sub(next, current), a / (a - b))));
  }
  return result;
}

function faceVertices(face: Face): Vec3[] {
  const tangents = [0, 1, 2].filter((axis) => axis !== face.axis);
  const centre = add(face.body.positionM, scale(face.axes[face.axis],
    face.side * face.extents[face.axis]));
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) =>
    add(add(centre, scale(face.axes[tangents[0]], u * face.extents[tangents[0]])),
      scale(face.axes[tangents[1]], v * face.extents[tangents[1]])));
}

/** Clip an incident box face against a reference box face. Edge axes keep the one-point path. */
export function boxFaceManifold(a: Body, b: Body, hit: Hit): ManifoldPoint[] | null {
  if (a.shape.kind !== 'box' || b.shape.kind !== 'box') return null;
  const axesA = basis(a), axesB = basis(b);
  const faceA = referenceFace(a, axesA, hit.normal);
  const faceB = referenceFace(b, axesB, scale(hit.normal, -1));
  const reference = faceA ?? faceB;
  if (!reference) return null;
  const incidentBody = reference.body === a ? b : a;
  const incidentAxes = reference.body === a ? axesB : axesA;
  const normal = reference.body === a ? hit.normal : scale(hit.normal, -1);
  let incidentAxis = 0, greatest = -Infinity;
  for (let axis = 0; axis < 3; axis++) {
    const alignment = Math.abs(dot(incidentAxes[axis], normal));
    if (alignment > greatest) { greatest = alignment; incidentAxis = axis; }
  }
  const incident: Face = { body: incidentBody, axes: incidentAxes,
    extents: (incidentBody.shape as BoxShape).halfExtentsM, axis: incidentAxis,
    side: dot(incidentAxes[incidentAxis], normal) > 0 ? -1 : 1 };
  const centre = add(reference.body.positionM, scale(reference.axes[reference.axis],
    reference.side * reference.extents[reference.axis]));
  const tangents = [0, 1, 2].filter((axis) => axis !== reference.axis);
  let polygon = faceVertices(incident);
  for (const axis of tangents) {
    polygon = clip(polygon, centre, reference.axes[axis], reference.extents[axis]);
    polygon = clip(polygon, centre, scale(reference.axes[axis], -1), reference.extents[axis]);
  }
  const candidates = polygon.map((point) => {
    const separation = dot(sub(point, centre), normal);
    const midpoint = sub(point, scale(normal, separation / 2));
    return { pointM: midpoint, separation,
      u: dot(sub(midpoint, centre), reference.axes[tangents[0]]),
      v: dot(sub(midpoint, centre), reference.axes[tangents[1]]) };
  }).filter((point) => point.separation <= 1e-6);
  if (!candidates.length) return null;
  const selected = candidates.length <= 4 ? candidates :
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) =>
      candidates.reduce((best, point) => u * point.u + v * point.v > u * best.u + v * best.v
        ? point : best, candidates[0]));
  const unique = selected.filter((point, index) => selected.findIndex((other) =>
    Math.hypot(...sub(point.pointM, other.pointM)) <= 1e-9) === index);
  unique.sort((first, second) => first.u - second.u || first.v - second.v);
  return unique.map((point, index) => ({ id: `${reference.body.id}:${reference.axis}:`
      + `${reference.side}:${index}`, pointM: point.pointM }));
}
