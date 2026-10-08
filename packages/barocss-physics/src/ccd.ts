import type { Body, PhysicsCcdHit, Vec3 } from './types.js';
import { add, localPoint, rotate, scale, sub } from './math.js';
import { error } from './validation.js';
import { sweepBox } from './ccd-slab.js';
import { axisAlignedBox } from './ccd-box.js';

export type CcdProfile =
  | { kind: 'none' }
  | { kind: 'static-boxes'; sphereIndex: number; fixtures: Body[] }
  | { kind: 'sphere-pair'; sphereIndex: number; otherIndex: number }
  | { kind: 'box-pair'; boxIndex: number; fixtureIndex: number };

export function admitCcd(bodies: Body[], jointCount: number, gravity: Vec3): CcdProfile {
  const selected = bodies.filter((body) => body.ccd);
  if (selected.length === 0) return { kind: 'none' };
  const sphereIndex = bodies.findIndex((body) => body.ccd);
  if (selected.length === 1 && bodies.length === 2 && jointCount === 0 &&
    gravity.every((component) => component === 0) &&
    bodies.every((body) => body.kind === 'dynamic' && body.shape.kind === 'sphere' && !body.sensor)) {
    return { kind: 'sphere-pair', sphereIndex, otherIndex: 1 - sphereIndex };
  }
  if (selected.length === 1 && selected[0].shape.kind === 'box' &&
    bodies.length === 2 && jointCount === 0) {
    const fixtureIndex = 1 - sphereIndex;
    if (bodies[sphereIndex].kind === 'dynamic' && bodies[fixtureIndex].kind === 'static' &&
      !bodies[fixtureIndex].sensor && axisAlignedBox(bodies[sphereIndex]) &&
      axisAlignedBox(bodies[fixtureIndex])) {
      return { kind: 'box-pair', boxIndex: sphereIndex, fixtureIndex };
    }
  }
  const fixtures = bodies.filter((body) => body.kind === 'static' && !body.sensor && body.shape.kind === 'box');
  if (selected.length !== 1 || bodies.length !== fixtures.length + 1 ||
    bodies.filter((body) => body.kind === 'dynamic').length !== 1 ||
    fixtures.length < 1 || fixtures.length > 8 || jointCount !== 0) {
    error('INVALID_CONFIG', 'unsupported CCD body pair or world profile');
  }
  if (selected[0].shape.kind !== 'sphere') {
    error('INVALID_CONFIG', 'static-box CCD requires a dynamic sphere');
  }
  return { kind: 'static-boxes', sphereIndex,
    fixtures: fixtures.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0) };
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
