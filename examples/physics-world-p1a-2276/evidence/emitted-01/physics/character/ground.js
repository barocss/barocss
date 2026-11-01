import { PhysicsError } from '../capsule-query-error.js';
import { SKIN, SNAP, WALKABLE } from './profile.js';
export function snap(position, candidate, context) {
    const down = context.sweep(position, [0, -SNAP, 0], 'ground-probe', true), hit = down.hit;
    if (!hit || hit.normalFixtureToCapsule[1] < WALKABLE) {
        candidate.grounded = false;
        candidate.support = null;
        return position;
    }
    const targetY = position[1] - SNAP * hit.toiFraction + SKIN / hit.normalFixtureToCapsule[1];
    const delta = [0, targetY - position[1], 0];
    let proof = down.indices;
    if (delta[1] > 0) {
        const up = context.sweep(position, delta, 'positive-snap-validation');
        if (up.hit)
            throw new PhysicsError('INVALID_COMMAND', 'Controller positive snap is blocked');
        proof = up.indices;
    }
    const p = context.commit(position, delta, 'ground-snap', proof);
    candidate.grounded = true;
    candidate.support = { bodyId: hit.bodyId, normal: [...hit.normalFixtureToCapsule] };
    candidate.fallVelocityYMps = 0;
    candidate.assist = null;
    return p;
}
