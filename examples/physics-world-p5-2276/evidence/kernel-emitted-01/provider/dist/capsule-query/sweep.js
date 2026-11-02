import { PhysicsError } from '../capsule-query-error.js';
import { closestCandidate, RADIUS_M, dot } from './geometry.js';
// Fixed scalar advancement; no public cap override or movement policy.
export function sweepBox(center, displacement, box) {
    let fraction = 0;
    for (let iteration = 0; iteration < 64; iteration++) {
        const at = center.map((value, i) => value + fraction * displacement[i]);
        const closest = closestCandidate(at, box), gap = closest.distanceM - RADIUS_M;
        if (!Number.isFinite(gap))
            throw new PhysicsError('NUMERIC_LIMIT', 'Nonfinite distance');
        if (iteration === 0 && gap < -1e-12)
            throw new PhysicsError('INITIAL_OVERLAP', 'Initial capsule overlaps a box');
        if (!closest.normalM)
            throw new PhysicsError('NUMERIC_LIMIT', 'No distance normal');
        if ((iteration === 0 && Math.abs(gap) <= 1e-12) || gap <= 1e-14) {
            if (gap < -1e-12)
                throw new PhysicsError('NUMERIC_LIMIT', 'Advancement crossed contact');
            return { bodyId: box.id, toiFraction: fraction, normalFixtureToCapsule: closest.normalM.slice(),
                pointM: closest.pointM.slice(), segmentPointM: closest.segmentM.slice(), iterations: iteration + 1 };
        }
        const closing = -dot(closest.normalM, displacement);
        if (closing <= 0)
            return null;
        const next = fraction + gap / closing;
        if (!Number.isFinite(next))
            throw new PhysicsError('NUMERIC_LIMIT', 'Nonfinite advancement');
        if (next > 1)
            return null;
        if (next <= fraction)
            throw new PhysicsError('ITERATION_LIMIT', 'Advancement cannot make progress');
        fraction = next;
    }
    throw new PhysicsError('ITERATION_LIMIT', 'Fixed advancement cap exhausted');
}
