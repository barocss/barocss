import { PhysicsError } from '../capsule-query-error.js';
import type { Vec3 } from '../types.js';
import { SKIN, WALKABLE, STEP_HEIGHT, PREVIEW, STEP_DOWN, ASSIST_CAP } from './profile.js';
import { add, scale, norm } from './math.js';
import type { CharacterState, CharacterDiagnostics } from './types.js';
import type { QueryContext } from './query.js';

export function tryStep(position: Vec3, remaining: Vec3, candidate: CharacterState, context: QueryContext): Vec3 | null {
  const horizontal: Vec3 = [remaining[0], 0, remaining[2]], length = norm(horizontal);
  if (length <= 1e-12 || !candidate.grounded) return null;
  const direction = scale(horizontal, 1 / length);
  const up = context.sweep(position, [0, STEP_HEIGHT, 0], 'step-up-probe', true);
  if (up.hit) return null;
  const raised = add(position, [0, STEP_HEIGHT, 0]);
  const forward = context.sweep(raised, scale(direction, PREVIEW), 'step-ahead-probe', true);
  if (forward.hit) return null;
  const preview = add(raised, scale(direction, PREVIEW));
  const down = context.sweep(preview, [0, -STEP_DOWN, 0], 'step-down-probe', true);
  if (!down.hit || down.hit.normalFixtureToCapsule[1] < WALKABLE) return null;
  const targetY = raised[1] - STEP_DOWN * down.hit.toiFraction + SKIN / down.hit.normalFixtureToCapsule[1];
  const rise = targetY - position[1];
  if (rise <= 1e-9 || rise > STEP_HEIGHT + 1e-6) return null;
  const actualRaised = add(position, [0, rise, 0]);
  const actual = context.sweep(actualRaised, horizontal, 'step-actual-forward', false);
  if (actual.hit) return null;
  let moved = context.commit(position, [0, rise, 0], 'step-up', up.indices);
  moved = context.commit(moved, horizontal, 'step-forward', actual.indices);
  candidate.assist = { bodyId: down.hit.bodyId, heightM: targetY, directionXZ: [direction[0], direction[2]], frames: 0 };
  candidate.fallVelocityYMps = 0;
  candidate.grounded = false;
  candidate.support = null;
  return moved;
}
export function validateAssist(position: Vec3, candidate: CharacterState, context: QueryContext,
    diagnostic: CharacterDiagnostics): void {
  if (!candidate.assist) return;
  const direction: Vec3 = [candidate.assist.directionXZ[0], 0, candidate.assist.directionXZ[1]];
  const ahead = context.sweep(position, scale(direction, PREVIEW), 'assist-ahead', true);
  if (ahead.hit) throw new PhysicsError('INVALID_COMMAND', 'Controller assist forward path is blocked');
  const down = context.sweep(add(position, scale(direction, PREVIEW)), [0, -STEP_DOWN, 0], 'assist-support', true);
  const hit = down.hit;
  const target = hit ? position[1] - STEP_DOWN * hit.toiFraction + SKIN / hit.normalFixtureToCapsule[1] : NaN;
  if (!hit || hit.normalFixtureToCapsule[1] < WALKABLE || hit.bodyId !== candidate.assist.bodyId ||
      Math.abs(target - candidate.assist.heightM) > 1e-6) {
    throw new PhysicsError('INVALID_COMMAND', 'Controller assist support is unresolved');
  }
  candidate.assist.frames++;
  if (candidate.assist.frames > (diagnostic.assistCap ?? ASSIST_CAP)) {
    throw new PhysicsError('WORLD_LIMIT', 'Controller assist duration limit exhausted');
  }
}
