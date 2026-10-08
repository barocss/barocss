import type { Body, PhysicsCcdHit, Vec3 } from './types.js';
import type { AdmittedCommands } from './validation.js';
import { add, scale, sub } from './math.js';
import { sweepBox } from './ccd-slab.js';
import { error } from './validation.js';

const ANGULAR_TOLERANCE = 1e-12;

export function axisAlignedBox(body: Body): boolean {
  return body.shape.kind === 'box' &&
    body.orientation.slice(0, 3).every((component) => Math.abs(component) <= ANGULAR_TOLERANCE) &&
    Math.abs(body.orientation[3] - 1) <= ANGULAR_TOLERANCE &&
    body.angularVelocityRadps.every((component) => Math.abs(component) <= ANGULAR_TOLERANCE);
}

export function rejectAngularBoxCommand(action?: AdmittedCommands): void {
  if (action?.torqueNm?.some((component) => component !== 0) ||
    action?.angularImpulseNms?.some((component) => component !== 0)) {
    error('INVALID_COMMAND', 'axis-aligned box CCD excludes angular commands');
  }
}

export function sweepDynamicBox(previous: Body, candidate: Body, fixture: Body): PhysicsCcdHit | null {
  if (!axisAlignedBox(previous) || !axisAlignedBox(candidate) || !axisAlignedBox(fixture)) {
    error('NUMERIC_LIMIT', 'box CCD candidate rotated outside the admitted profile');
  }
  if (previous.shape.kind !== 'box' || fixture.shape.kind !== 'box') return null;
  const fixtureHalfExtents = fixture.shape.halfExtentsM;
  const expanded = previous.shape.halfExtentsM.map((extent, axis) =>
    extent + fixtureHalfExtents[axis]) as Vec3;
  const start = sub(previous.positionM, fixture.positionM);
  const end = sub(candidate.positionM, fixture.positionM);
  const hit = sweepBox(start, end, expanded);
  if (!hit) return null;
  const travel = sub(candidate.positionM, previous.positionM);
  candidate.positionM = sub(add(previous.positionM, scale(travel, hit.fraction)),
    scale(hit.normalLocal, 1e-9));
  return { bodyId: previous.id, fixtureId: fixture.id,
    toiFraction: hit.fraction, normalFixtureToBody: hit.normalLocal };
}
