import type { Body, PhysicsCcdHit } from './internal-types.js';
import { add, scale, sub } from './math.js';
import { sweepSpherePairExact } from './ccd-sphere-pair-exact.js';

/** Stop two linearly swept dynamic spheres at their first relative entry. */
export function sweepSpherePair(markedStart: Body, markedEnd: Body,
  otherStart: Body, otherEnd: Body): PhysicsCcdHit | null {
  if (markedStart.shape.kind !== 'sphere' || otherStart.shape.kind !== 'sphere') return null;
  const hit = sweepSpherePairExact(markedStart.positionM, markedEnd.positionM,
    otherStart.positionM, otherEnd.positionM, markedStart.shape.radiusM, otherStart.shape.radiusM);
  if (!hit) return null;
  const markedTravel = sub(markedEnd.positionM, markedStart.positionM);
  const otherTravel = sub(otherEnd.positionM, otherStart.positionM);
  const { fraction, normal: normalFixtureToBody } = hit;
  const markedAtHit = add(markedStart.positionM, scale(markedTravel, fraction));
  const otherAtHit = add(otherStart.positionM, scale(otherTravel, fraction));
  markedEnd.positionM = sub(markedAtHit, scale(normalFixtureToBody, 5e-10));
  otherEnd.positionM = add(otherAtHit, scale(normalFixtureToBody, 5e-10));
  return { bodyId: markedStart.id, fixtureId: otherStart.id, toiFraction: fraction,
    normalFixtureToBody };
}
