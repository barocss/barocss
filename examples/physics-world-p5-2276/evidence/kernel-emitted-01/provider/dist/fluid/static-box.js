import { FLUID_PARTICLE_RADIUS_M } from './constants.js';
export function inflatedBoxBounds(centerM, halfExtentsM) {
globalThis.__p5Kernel.hit('inflatedBoxBounds');

    return { low: centerM.map((value, axis) => value - halfExtentsM[axis] - FLUID_PARTICLE_RADIUS_M),
        high: centerM.map((value, axis) => value + halfExtentsM[axis] + FLUID_PARTICLE_RADIUS_M) };
}
export function confineStaticBox(positions, velocities, index, box) {
    const offset = index * 3;
    const { low, high } = box;
    if (![0, 1, 2].every(axis => positions[offset + axis] > low[axis] && positions[offset + axis] < high[axis]))
        return 0;
    let selectedAxis = 0;
    let selectedFace = low[0];
    let smallestDistance = Infinity;
    for (let axis = 0; axis < 3; axis++) {
        for (const face of [low[axis], high[axis]]) {
            const distance = Math.abs(positions[offset + axis] - face);
            if (distance < smallestDistance) {
                smallestDistance = distance;
                selectedAxis = axis;
                selectedFace = face;
            }
        }
    }
    positions[offset + selectedAxis] = selectedFace;
    velocities[offset + selectedAxis] = 0;
    return 1;
}
export function stopIntoStaticBox(positions, velocities, index, box) {
    const offset = index * 3;
    const { low, high } = box;
    for (let axis = 0; axis < 3; axis++) {
        const first = (axis + 1) % 3, second = (axis + 2) % 3;
        if (positions[offset + first] <= low[first] || positions[offset + first] >= high[first]
            || positions[offset + second] <= low[second]
            || positions[offset + second] >= high[second])
            continue;
        const point = offset + axis;
        if ((Math.abs(positions[point] - low[axis]) < 1e-9 && velocities[point] > 0)
            || (Math.abs(positions[point] - high[axis]) < 1e-9 && velocities[point] < 0)) {
            velocities[point] = 0;
        }
    }
}
export function insideStaticBox(positions, box) {
    const { low, high } = box;
    for (let index = 0; index < positions.length / 3; index++) {
        if ([0, 1, 2].every(axis => positions[index * 3 + axis] > low[axis] + 1e-9
            && positions[index * 3 + axis] < high[axis] - 1e-9))
            return true;
    }
    return false;
}
