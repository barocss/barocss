import type { Body, PhysicsOverlapSphereQuery, PhysicsRayQuery, PhysicsRayHit } from '../../packages/barocss-physics/src/types.js';
import { error, queryRecord, queryVector, queryNumber, includeSensors } from '../../packages/barocss-physics/src/validation.js';
import { sphereOverlaps, rayDistance } from '../../packages/barocss-physics/src/collision.js';

/** Original query admission and scalar operations; only the accepted body store is supplied. */
export function overlapAccepted(bodies: Body[], input: PhysicsOverlapSphereQuery): string[] {
  const query = queryRecord(input, ['centerM', 'radiusM'], ['includeSensors']);
  const center = queryVector(query.centerM, 10000, 'centerM');
  const radius = queryNumber(query.radiusM, .0001, 1000, 'radiusM');
  const sensors = includeSensors(query);
  return bodies.filter(body => (sensors || !body.sensor) && sphereOverlaps(center, radius, body))
    .map(body => body.id).sort();
}
export function raycastAccepted(bodies: Body[], input: PhysicsRayQuery): PhysicsRayHit | null {
  const query = queryRecord(input, ['originM', 'direction', 'maxDistanceM'], ['includeSensors']);
  const origin = queryVector(query.originM, 10000, 'originM');
  const direction = queryVector(query.direction, 1 + 1e-9, 'direction');
  if (Math.abs(Math.hypot(...direction) - 1) > 1e-9) error('INVALID_QUERY', 'direction must be a unit 3-vector');
  const limit = queryNumber(query.maxDistanceM, .0001, 10000, 'maxDistanceM');
  const sensors = includeSensors(query);
  let best: PhysicsRayHit | null = null;
  for (const body of bodies) {
    if (!sensors && body.sensor) continue;
    const distance = rayDistance(origin, direction, body);
    if (distance === null || distance > limit) continue;
    if (best === null || distance < best.distanceM || distance === best.distanceM && body.id < best.bodyId)
      best = { bodyId: body.id, distanceM: distance };
  }
  return best;
}
