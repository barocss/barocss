import { PhysicsError } from '../capsule-query-error.js';
import type { Vec3 } from '../types.js';
import { SKIN, WALKABLE, SLIDE_CAP, LOOKAHEAD } from './profile.js';
import { add, scale, dot, norm } from './math.js';
import { tryStep } from './step-assist.js';
import type { CharacterState, CharacterDiagnostics } from './types.js';
import type { QueryContext } from './query.js';

export function move(position: Vec3, delta: Vec3, candidate: CharacterState, context: QueryContext,
    diagnostic: CharacterDiagnostics): Vec3 {
  let p: Vec3 = [...position], remaining: Vec3 = [...delta];
  for (let pass = 0; pass < (diagnostic.slideBudget ?? SLIDE_CAP); pass++) {
    if (norm(remaining) <= 1e-12) return p;
    const length = norm(remaining), direction = scale(remaining, 1 / length), probeLength = length + LOOKAHEAD;
    const result = context.sweep(p, scale(direction, probeLength), 'slide-lookahead', true), hit = result.hit;
    if (!hit) return context.commit(p, remaining, 'travel', result.indices);
    const normal = hit.normalFixtureToCapsule, closingUnit = -dot(normal, direction);
    if (closingUnit <= 1e-12) throw new PhysicsError('INVALID_COMMAND', 'Controller lookahead closing normal is unresolved');
    const contactDistance = probeLength * hit.toiFraction;
    const safeDistance = Math.max(0, contactDistance - SKIN / closingUnit);
    const fraction = Math.min(1, safeDistance / length);
    const travel = scale(remaining, fraction);
    if (norm(travel) > 0) p = context.commit(p, travel, 'travel', result.indices);
    if (fraction === 1) return p;
    remaining = scale(remaining, 1 - fraction);
    if (normal[1] < WALKABLE) {
      const stepped = tryStep(p, remaining, candidate, context);
      if (stepped) return stepped;
      candidate.blocked = true;
      const horizontalNormal: Vec3 = [normal[0], 0, normal[2]], size = norm(horizontalNormal);
      if (size > 1e-12) {
        const unit = scale(horizontalNormal, 1 / size), into = dot(remaining, unit);
        if (into < 0) remaining = add(remaining, scale(unit, -into));
      }
      if (normal[1] > 1e-12 && remaining[1] < 0) { remaining[1] = 0; candidate.fallVelocityYMps = 0; }
      else if (normal[1] < -1e-12 && remaining[1] > 0) remaining[1] = 0;
    } else {
      const into = dot(remaining, normal);
      if (into < 0) remaining = add(remaining, scale(normal, -into));
      candidate.fallVelocityYMps = 0;
    }
  }
  if (norm(remaining) > 1e-12) throw new PhysicsError('WORLD_LIMIT', 'Controller slide limit exhausted');
  return p;
}
