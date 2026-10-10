import { PhysicsError } from '../../packages/barocss-physics/src/capsule-query-error.js';
import { add, scale, dot } from '../../packages/barocss-physics/src/math.js';
import { admitSnapshot, admitMovement, copyBox, record, tuple } from './admission.js';
import { faceCoordinates, numeric, sweepFace } from './face-sweep.js';
import { ERRORS, TOLERANCE_M } from './profile.js';
import type { Hit, Initial, Result } from './profile.js';
import type { Vec3 } from '../../packages/barocss-physics/src/types.js';
export function advanceHeadOnFaceStep(initial: Initial, hit: Hit | null, stepSeconds: number): Result {
  const raw = record(initial, ['snapshot', 'revision', 'centerM', 'velocityMps', 'stepSeconds'], 'INVALID_QUERY');
  const s = admitSnapshot(raw.snapshot), q = admitMovement({ revision: raw.revision, centerM: raw.centerM, velocityMps: raw.velocityMps, stepSeconds: raw.stepSeconds }, s);
  if (stepSeconds !== q.stepSeconds) throw new PhysicsError('INVALID_QUERY', ERRORS.movement);
  const qualified = sweepFace(s, q);
  numeric((hit === null) === (qualified === null));
  let hitTimeSeconds = 0, remainingTimeSeconds = stepSeconds, centerM: Vec3 = [...q.centerM], velocityMps: Vec3 = [...q.velocityMps];
  if (hit !== null) {
    const h = record(hit, ['bodyId', 'toiFraction', 'normalFixtureToCapsule', 'pointM', 'segmentPointM'], 'INVALID_QUERY');
    const normal = tuple(h.normalFixtureToCapsule, 3, 'INVALID_QUERY') as Vec3;
    const point = tuple(h.pointM, 3, 'INVALID_QUERY'), segment = tuple(h.segmentPointM, 3, 'INVALID_QUERY');
    numeric(qualified !== null && point.every((x, i) => Math.abs(x - qualified.pointM[i]) <= 1e-12) && segment.every((x, i) => Math.abs(x - qualified.segmentPointM[i]) <= 1e-12));
    numeric(qualified !== null && h.toiFraction === qualified.toiFraction);
    numeric(h.bodyId === s.box.id && typeof h.toiFraction === 'number' && Number.isFinite(h.toiFraction) && h.toiFraction >= 0 && h.toiFraction <= 1);
    numeric(Math.abs(dot(normal, normal) - 1) <= 1e-12 && normal.every((x, i) => Math.abs(x - faceCoordinates(s, q.centerM).normal[i]) <= 1e-12));
    hitTimeSeconds = stepSeconds * (h.toiFraction as number); remainingTimeSeconds = stepSeconds - hitTimeSeconds;
    centerM = add(centerM, scale(velocityMps, hitTimeSeconds));
    numeric(Math.abs(faceCoordinates(s, centerM).gapM) <= TOLERANCE_M);
    const closing = dot(velocityMps, normal);
    if (closing < 0) velocityMps = add(velocityMps, scale(normal, -closing));
  }
  centerM = add(centerM, scale(velocityMps, remainingTimeSeconds));
  numeric([...centerM, ...velocityMps, remainingTimeSeconds].every(Number.isFinite) && remainingTimeSeconds >= 0 && remainingTimeSeconds <= stepSeconds && faceCoordinates(s, centerM).gapM >= -TOLERANCE_M);
  return { centerM, velocityMps, hitTimeSeconds, remainingTimeSeconds, orientationXYZW: [...s.capsule.orientationXYZW], box: copyBox(s.box) };
}
