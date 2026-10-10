import { PhysicsError } from '../../packages/barocss-physics/src/capsule-query-error.js';
import { matrix, dot } from '../../packages/barocss-physics/src/capsule-query/geometry.js';
import { add, sub, scale } from '../../packages/barocss-physics/src/math.js';
import type { Vec3 } from '../../packages/barocss-physics/src/types.js';
import { RADIUS_M, HALF_LENGTH_M, TOLERANCE_M, ERRORS } from './profile.js';
import type { Snapshot, Movement, Hit } from './profile.js';
export function faceCoordinates(s: Snapshot, center: Vec3) {
  const m = matrix(s.box.orientationXYZW), delta = sub(center, s.box.centerM);
  const local = [0, 1, 2].map(j => m[0][j] * delta[0] + m[1][j] * delta[1] + m[2][j] * delta[2]) as Vec3;
  const normal = m.map(row => -row[0]) as Vec3;
  return { m, local, normal, gapM: -local[0] - s.box.halfExtentsM[0] - RADIUS_M };
}
export function numeric(condition: boolean): void { if (!condition) throw new PhysicsError('NUMERIC_LIMIT', ERRORS.numeric); }
export function sweepFace(s: Snapshot, q: Movement): Hit | null {
  const { m, local, normal, gapM } = faceCoordinates(s, q.centerM);
  const localVelocity = [0, 1, 2].map(j => m[0][j] * q.velocityMps[0] + m[1][j] * q.velocityMps[1] + m[2][j] * q.velocityMps[2]);
  if (local[0] > s.box.halfExtentsM[0] || Math.abs(localVelocity[1]) > 1e-12 || Math.abs(localVelocity[2]) > 1e-12 ||
      Math.abs(local[1]) + HALF_LENGTH_M + RADIUS_M > s.box.halfExtentsM[1] || Math.abs(local[2]) + RADIUS_M > s.box.halfExtentsM[2]) throw new PhysicsError('INVALID_QUERY', ERRORS.movement);
  numeric(Number.isFinite(gapM) && Number.isFinite(localVelocity[0]));
  if (gapM < -TOLERANCE_M) throw new PhysicsError('INITIAL_OVERLAP', ERRORS.overlap);
  let toiFraction: number;
  if (Math.abs(gapM) <= TOLERANCE_M) toiFraction = 0;
  else { if (localVelocity[0] <= 0) return null; toiFraction = gapM / localVelocity[0] / q.stepSeconds; if (toiFraction > 1) return null; }
  numeric(Number.isFinite(toiFraction) && toiFraction >= 0 && toiFraction <= 1);
  const segmentPointM = add(q.centerM, scale(q.velocityMps, q.stepSeconds * toiFraction));
  const hitLocal = faceCoordinates(s, segmentPointM).local;
  numeric(Math.abs(hitLocal[1]) + HALF_LENGTH_M + RADIUS_M <= s.box.halfExtentsM[1] && Math.abs(hitLocal[2]) + RADIUS_M <= s.box.halfExtentsM[2] && Math.abs(faceCoordinates(s, segmentPointM).gapM) <= TOLERANCE_M && Math.abs(dot(normal, normal) - 1) <= 1e-12);
  const pointLocal: Vec3 = [-s.box.halfExtentsM[0], hitLocal[1], hitLocal[2]];
  const pointM = m.map((row, i) => dot(row, pointLocal) + s.box.centerM[i]) as Vec3;
  return { bodyId: s.box.id, toiFraction, normalFixtureToCapsule: normal, pointM, segmentPointM };
}
