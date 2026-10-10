// Read-only copy of adopted face clipping. Instrumentation reports branch/stages only.
import type { Body, BoxShape, Hit, Vec3 } from '../../packages/barocss-physics/src/types.js';
import { add, dot, rotate, scale, sub } from '../../packages/barocss-physics/src/math.js';

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
    const a = dot(sub(current, centre), axis) - limit;
    const b = dot(sub(next, centre), axis) - limit;
    const insideA = a <= 1e-9, insideB = b <= 1e-9;
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
export function inspectFaceManifold(a: Body, b: Body, hit: Hit) {
  const stages: Array<{axis: number; side: number; before: number; after: number}> = [];
  if (a.shape.kind !== 'box' || b.shape.kind !== 'box') throw new Error('inspector requires boxes');
  const axesA = basis(a), axesB = basis(b);
  const faceA = referenceFace(a, axesA, hit.normal);
  const faceB = referenceFace(b, axesB, scale(hit.normal, -1));
  const reference = faceA ?? faceB;
  const alignments = {a: axesA.map(axis => dot(axis,hit.normal)), b: axesB.map(axis => dot(axis,scale(hit.normal,-1)))};
  if (!reference) return {reason:'no-reference-face', points:null, alignments, axes:{a:axesA,b:axesB}, stages};
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
    let before=polygon.length;
    polygon = clip(polygon, centre, reference.axes[axis], reference.extents[axis]);
    stages.push({axis,side:1,before,after:polygon.length});
    before=polygon.length;
    polygon = clip(polygon, centre, scale(reference.axes[axis], -1), reference.extents[axis]);
    stages.push({axis,side:-1,before,after:polygon.length});
  }
  const allCandidates = polygon.map((point) => {
    const separation = dot(sub(point, centre), normal);
    const midpoint = sub(point, scale(normal, separation / 2));
    return { pointM: midpoint, separation,
      u: dot(sub(midpoint, centre), reference.axes[tangents[0]]),
      v: dot(sub(midpoint, centre), reference.axes[tangents[1]]) };
  });
  const candidates = allCandidates.filter((point) => point.separation <= 1e-6);
  const metadata = {alignments, axes:{a:axesA,b:axesB}, stages, reference:{bodyId:reference.body.id,axis:reference.axis,side:reference.side}, incident:{bodyId:incidentBody.id,axis:incidentAxis,side:incident.side}, clippedPolygon:polygon, candidateSeparations:allCandidates.map(point=>point.separation), retainedCandidates:candidates};
  if (!candidates.length) return {reason:'no-clipped-candidate', points:null, ...metadata};
  const selected = candidates.length <= 4 ? candidates :
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) =>
      candidates.reduce((best, point) => u * point.u + v * point.v > u * best.u + v * best.v
        ? point : best, candidates[0]));
  const unique = selected.filter((point, index) => selected.findIndex((other) =>
    Math.hypot(...sub(point.pointM, other.pointM)) <= 1e-9) === index);
  unique.sort((first, second) => first.u - second.u || first.v - second.v);
  return {reason:'face-points', ...metadata, points:unique.map((point, index) => ({ id: `${reference.body.id}:${reference.axis}:`
      + `${reference.side}:${index}`, pointM: point.pointM }))};
}
