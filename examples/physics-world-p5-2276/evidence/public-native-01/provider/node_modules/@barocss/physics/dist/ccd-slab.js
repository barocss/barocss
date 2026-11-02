import { sub } from './math.js';
export function sweepBox(start, end, halfExtents) {
    if (start.every((value, axis) => Math.abs(value) <= halfExtents[axis]))
        return null;
    const travel = sub(end, start);
    let entry = 0;
    let exit = 1;
    let normalLocal = null;
    for (let axis = 0; axis < 3; axis++) {
        const velocity = travel[axis];
        if (velocity === 0) {
            if (Math.abs(start[axis]) > halfExtents[axis])
                return null;
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
        if (entry > exit)
            return null;
    }
    return normalLocal && entry <= 1 && exit >= 0 ? { fraction: entry, normalLocal } : null;
}
