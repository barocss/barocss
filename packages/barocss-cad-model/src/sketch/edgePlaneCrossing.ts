import { CadNumericPolicy } from '@barocss/cad';
import { add, cross, dot, len, scale, sub, type Vec3 } from '../engine/vec3';
import { toLocal, toWorld, type SketchPlane } from './plane';

const { coordinateAbs, linearTolerance } = CadNumericPolicy;
// Keep the existing model snap band around a plane for endpoints and coplanar edges.
const endpointBand = 1e-3;
const basisTolerance = 1e-12;

const inRange = (point: readonly number[]) => Array.from(point).every(value =>
  Number.isFinite(value) && Math.abs(value) <= coordinateAbs);

/** Find a strict interior crossing of an already certified finite native segment. */
export function edgePlaneCrossing(a: Vec3, b: Vec3, plane: SketchPlane): [number, number] | null {
  const { normal, origin, xAxis } = plane;
  if ([a, b, normal, origin, xAxis].some(point => point.length !== 3 || !inRange(point))
    || Math.abs(len(normal) - 1) > basisTolerance || Math.abs(len(xAxis) - 1) > basisTolerance
    || Math.abs(dot(normal, xAxis)) > basisTolerance) return null;

  const edge = sub(b, a), length = len(edge);
  if (!(length > linearTolerance)) return null;

  const distance = (point: Vec3) => dot(sub(point, origin), normal);
  const dA = distance(a), dB = distance(b);
  const extent = Math.max(1, length, ...a.map(Math.abs), ...b.map(Math.abs), ...origin.map(Math.abs));
  // Bound subtraction, the signed-distance dot products and the interpolation at this scale.
  const roundoff = 32 * Number.EPSILON * extent;
  const margin = endpointBand + roundoff;
  if (!(dA < -margin && dB > margin || dB < -margin && dA > margin)) return null;

  const span = Math.abs(dA) + Math.abs(dB);
  // For opposite signs, a signed-distance error of at most roundoff changes the
  // fraction by at most roundoff / (span - 2 * roundoff).
  if (roundoff + length * roundoff / (span - 2 * roundoff) > linearTolerance) return null;
  const t = Math.abs(dA) / span;
  if (!(t > 0 && t < 1)) return null;
  const hit = t <= 0.5 ? add(a, scale(edge, t)) : add(b, scale(edge, -Math.abs(dB) / span));

  const onSegmentAndPlane = (point: Vec3) => {
    const fromA = sub(point, a), along = dot(fromA, edge) / length;
    return along > 0 && along < length && Math.abs(distance(point)) <= linearTolerance
      && len(cross(fromA, edge)) / length <= linearTolerance;
  };
  if (!inRange(hit) || !onSegmentAndPlane(hit)) return null;

  const local = toLocal(plane, hit);
  if (!inRange(local)) return null;
  // The sketch mapping can clean small basis components. Check its actual world point.
  const represented = toWorld(plane, local);
  return inRange(represented) && len(sub(represented, hit)) <= linearTolerance && onSegmentAndPlane(represented)
    ? local : null;
}
