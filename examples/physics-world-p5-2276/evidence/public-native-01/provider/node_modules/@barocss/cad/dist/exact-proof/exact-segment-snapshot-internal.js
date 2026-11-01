/** Internal, descriptor-only snapshot. External point property gets are never performed. */
export function snapshotExactSegments(a, b, c, d, maxAbsCoordinateMM) {
    if (typeof maxAbsCoordinateMM !== 'number' || !Number.isFinite(maxAbsCoordinateMM) ||
        maxAbsCoordinateMM <= 0 || maxAbsCoordinateMM > 10000)
        return { reason: 'invalid-input' };
    const inputs = [a, b, c, d];
    const points = [];
    for (const input of inputs) {
        if (!input || typeof input !== 'object')
            return { reason: 'invalid-input' };
        try {
            if (Array.isArray(input))
                return { reason: 'invalid-input' };
            const prototype = Object.getPrototypeOf(input);
            if (prototype !== Object.prototype && prototype !== null)
                return { reason: 'invalid-input' };
            const descriptors = Object.getOwnPropertyDescriptors(input);
            const keys = Reflect.ownKeys(descriptors);
            if (keys.length !== 2 || !['x', 'y'].every(key => Object.hasOwn(descriptors, key) && 'value' in descriptors[key] &&
                descriptors[key].enumerable && typeof descriptors[key].value === 'number'))
                return { reason: 'invalid-input' };
            points.push({ x: descriptors.x.value, y: descriptors.y.value });
        }
        catch {
            return { reason: 'invalid-input' };
        }
    }
    if (points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y)))
        return { reason: 'non-finite-coordinate' };
    if (points.some(point => Math.abs(point.x) > maxAbsCoordinateMM || Math.abs(point.y) > maxAbsCoordinateMM))
        return { reason: 'out-of-range-coordinate' };
    const [pa, pb, pc, pd] = points;
    if ((pa.x === pb.x && pa.y === pb.y) || (pc.x === pd.x && pc.y === pd.y))
        return { reason: 'degenerate-segment' };
    return { points: [pa, pb, pc, pd] };
}
