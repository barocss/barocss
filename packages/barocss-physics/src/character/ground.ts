import { PhysicsError } from '../capsule-query-error.js';
import type { Vec3 } from '../types.js';
import { SKIN, SNAP, WALKABLE } from './profile.js';
import type { CharacterState } from './types.js';
import type { QueryContext } from './query.js';

export function snap(position: Vec3, candidate: CharacterState, context: QueryContext): Vec3 {
  const down = context.sweep(position, [0, -SNAP, 0], 'ground-probe', true), hit = down.hit;
  if (!hit || hit.normalFixtureToCapsule[1] < WALKABLE) {
    candidate.grounded = false; candidate.support = null; return position;
  }
  const targetY = position[1] - SNAP * hit.toiFraction + SKIN / hit.normalFixtureToCapsule[1];
  const delta: Vec3 = [0, targetY - position[1], 0];
  let proof = down.indices;
  if (delta[1] > 0) {
    const up = context.sweep(position, delta, 'positive-snap-validation');
    if (up.hit) throw new PhysicsError('INVALID_COMMAND', 'Controller positive snap is blocked');
    proof = up.indices;
  }
  const p = context.commit(position, delta, 'ground-snap', proof);
  candidate.grounded = true;
  candidate.support = { bodyId: hit.bodyId, normal: [...hit.normalFixtureToCapsule] };
  candidate.fallVelocityYMps = 0;
  candidate.assist = null;
  return p;
}
