import type { Body, PhysicsCcdHit, Vec3 } from './types.js';
import { add, dot, scale, sub } from './math.js';
import { error } from './validation.js';

/** Stop two linearly swept dynamic spheres at their first relative entry. */
export function sweepSpherePair(markedStart: Body, markedEnd: Body,
  otherStart: Body, otherEnd: Body): PhysicsCcdHit | null {
  if (markedStart.shape.kind !== 'sphere' || otherStart.shape.kind !== 'sphere') return null;
  const radius = markedStart.shape.radiusM + otherStart.shape.radiusM;
  const relativeStart = sub(markedStart.positionM, otherStart.positionM);
  const distanceSquared = dot(relativeStart, relativeStart);
  if (distanceSquared <= radius * radius) return null;
  const markedTravel = sub(markedEnd.positionM, markedStart.positionM);
  const otherTravel = sub(otherEnd.positionM, otherStart.positionM);
  const relativeTravel = sub(markedTravel, otherTravel);
  const a = dot(relativeTravel, relativeTravel);
  if (a === 0) return null;
  const b = 2 * dot(relativeStart, relativeTravel);
  if (b >= 0) return null;
  const discriminant = b * b - 4 * a * (distanceSquared - radius * radius);
  if (!Number.isFinite(discriminant)) error('NUMERIC_LIMIT', 'unsafe sphere-pair sweep');
  if (discriminant < 0) return null;
  const fraction = (-b - Math.sqrt(discriminant)) / (2 * a);
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) return null;
  const markedAtHit = add(markedStart.positionM, scale(markedTravel, fraction));
  const otherAtHit = add(otherStart.positionM, scale(otherTravel, fraction));
  const separation = sub(markedAtHit, otherAtHit);
  const length = Math.hypot(...separation);
  if (!(length > 0) || !Number.isFinite(length)) error('NUMERIC_LIMIT', 'unsafe sphere-pair normal');
  const normalFixtureToBody = scale(separation, 1 / length) as Vec3;
  markedEnd.positionM = sub(markedAtHit, scale(normalFixtureToBody, 5e-10));
  otherEnd.positionM = add(otherAtHit, scale(normalFixtureToBody, 5e-10));
  return { bodyId: markedStart.id, fixtureId: otherStart.id, toiFraction: fraction,
    normalFixtureToBody };
}
