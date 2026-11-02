import { copyData } from '../identity.js';
import { PhysicsError } from '../types.js';
export function invalid(condition, message) {
    if (!condition)
        throw new PhysicsError('INVALID_CONFIG', message);
}
/** Only inert plain data enters definitions; freeze every nested plain object. */
export function immutableCopy(input) {
    const result = copyData(input);
    function freeze(value) {
        if (value !== null && typeof value === 'object') {
            for (const child of Object.values(value))
                freeze(child);
            Object.freeze(value);
        }
    }
    freeze(result);
    return result;
}
export function flat(points, count) {
    invalid(points.length === count, 'Unexpected domain point count');
    invalid(points.every(p => p.length === 3 && p.every(Number.isFinite)), 'Expected finite domain triples');
    return new Float64Array(points.flat());
}
export function validateStatic(data, colliderIds) {
    invalid(data.gravityMps2.length === 3 && data.gravityMps2.every((x, i) => x === [0, -9.81, 0][i]), 'Unsupported domain gravity');
    invalid(new Set(colliderIds).size === colliderIds.length && data.colliders.length === colliderIds.length, 'Static collider population mismatch');
    invalid(data.bodies.length === data.colliders.length, 'Static owner population mismatch');
    const ids = new Set();
    const owners = new Set();
    for (const c of data.colliders) {
        invalid(colliderIds.includes(c.id) && !ids.has(c.id), 'Invalid static collider identity');
        ids.add(c.id);
        invalid(!owners.has(c.bodyId), 'Duplicate static collider owner');
        owners.add(c.bodyId);
        const b = data.bodies.find(b => b.id === c.bodyId);
        invalid(b?.kind === 'static', 'Domain colliders require static bodies');
        invalid(b.initial.orientationXYZW.every((x, i) => x === (i === 3 ? 1 : 0)), 'Unsupported static rotation');
        invalid(c.local.positionM.every(x => x === 0) && c.local.orientationXYZW.every((x, i) => x === (i === 3 ? 1 : 0)), 'Unsupported collider transform');
        invalid(!c.sensor && !c.ccd, 'Unsupported domain sensor or CCD');
    }
}
