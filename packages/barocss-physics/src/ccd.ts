import type { Body, PhysicsCcdHit, Vec3 } from './types.js';
import { add, localPoint, rotate, scale, sub } from './math.js';
import { error } from './validation.js';

export function ccdFixtures(bodies: Body[], jointCount: number): Body[] {
  const selected = bodies.filter((body) => body.ccd);
  if (selected.length === 0) return [];
  const fixtures = bodies.filter((body) => body.kind === 'static' && !body.sensor && body.shape.kind === 'box');
  if (selected.length !== 1 || bodies.length !== fixtures.length + 1 ||
    bodies.filter((body) => body.kind === 'dynamic').length !== 1 ||
    fixtures.length < 1 || fixtures.length > 8 || jointCount !== 0) {
    error('INVALID_CONFIG', 'ccd requires one dynamic sphere, 1..8 static nonsensor boxes and no joints');
  }
  return fixtures.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

interface Sweep { fraction: number; normalLocal: Vec3 }

function sweepBox(start: Vec3, end: Vec3, halfExtents: Vec3): Sweep | null {
  if (start.every((value, axis) => Math.abs(value) <= halfExtents[axis])) return null;
  const travel = sub(end, start);
  let entry = 0;
  let exit = 1;
  let normalLocal: Vec3 | null = null;
  for (let axis = 0; axis < 3; axis++) {
    const velocity = travel[axis];
    if (velocity === 0) {
      if (Math.abs(start[axis]) > halfExtents[axis]) return null;
      continue;
    }
    const first = (-halfExtents[axis] - start[axis]) / velocity;
    const second = (halfExtents[axis] - start[axis]) / velocity;
    const near = Math.min(first, second);
    const far = Math.max(first, second);
    if (near > entry) {
      entry = near;
      normalLocal = [0, 0, 0];
      normalLocal[axis] = velocity > 0 ? -1 : 1;
    }
    exit = Math.min(exit, far);
    if (entry > exit) return null;
  }
  return normalLocal && entry <= 1 && exit >= 0 ? { fraction: entry, normalLocal } : null;
}

export function sweepSphere(previous: Body, candidate: Body, fixtures: Body[]): PhysicsCcdHit | null {
  if (previous.shape.kind !== 'sphere') return null;
  const radius = previous.shape.radiusM;
  const travel = sub(candidate.positionM, previous.positionM);
  let earliest: PhysicsCcdHit | null = null;
  for (const fixture of fixtures) {
    if (fixture.shape.kind !== 'box') continue;
    const expanded = fixture.shape.halfExtentsM.map((extent) => extent + radius) as Vec3;
    const hit = sweepBox(localPoint(fixture, previous.positionM), localPoint(fixture, candidate.positionM), expanded);
    if (!hit || earliest && hit.fraction >= earliest.toiFraction) continue;
    earliest = { bodyId: previous.id, fixtureId: fixture.id, toiFraction: hit.fraction,
      normalFixtureToBody: rotate(fixture.orientation, hit.normalLocal) };
  }
  if (earliest) {
    candidate.positionM = sub(add(previous.positionM, scale(travel, earliest.toiFraction)),
      scale(earliest.normalFixtureToBody, 1e-9));
  }
  return earliest;
}
