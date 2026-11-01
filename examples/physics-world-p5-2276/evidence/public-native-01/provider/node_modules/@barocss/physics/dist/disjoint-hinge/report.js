import { PhysicsError } from '../internal-types.js';
import { sub, scale } from '../math.js';
const REPORT_KEYS = ['id', 'kind', 'aId', 'bId', 'angleRad', 'linearImpulseNs', 'angularImpulseNms', 'motorImpulseNms'];
const nonempty = (value) => typeof value === 'string' && value.length > 0;
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
/** DATA helper used by the physical flow. Finite report validation does not enforce the cap. */
export function validateHingeMotorReport(value, identity) {
    const ids = ownData(identity, ['id', 'aId', 'bId']);
    const report = ownData(value, REPORT_KEYS);
    if (!ids || !nonempty(ids.id) || !nonempty(ids.aId) || !nonempty(ids.bId) || !report ||
        report.id !== ids.id || report.aId !== ids.aId || report.bId !== ids.bId || report.kind !== 'hinge' ||
        !finite(report.angleRad) || !finite(report.motorImpulseNms))
        reactionError();
    const linear = denseNumbers(report.linearImpulseNs, 3), angular = denseNumbers(report.angularImpulseNms, 3);
    if (!linear || !angular)
        reactionError();
    return { id: ids.id, kind: 'hinge', aId: ids.aId, bId: ids.bId, angleRad: report.angleRad,
        linearImpulseNs: linear, angularImpulseNms: angular, motorImpulseNms: report.motorImpulseNms };
}
/** The only reaction cap is the original fixed .01 N*m*s, with strict greater-than. */
export function enforceHingeMotorReactionCap(jointId, angularImpulseNms) {
    const vector = denseNumbers(angularImpulseNms, 3);
    if (!nonempty(jointId) || !vector)
        reactionError();
    const norm = Math.hypot(...vector);
    if (!Number.isFinite(norm))
        reactionError();
    if (norm > .01)
        throw new PhysicsError('NUMERIC_LIMIT', `${jointId} exceeded motor reaction limit`);
}
export function bodyCorrections(free, projected) {
    return projected.map((body, i) => ({ bodyId: body.id,
        linearImpulseNs: scale(sub(body.velocityMps, free[i].velocityMps), 1 / free[i].inverseMass),
        angularImpulseNms: scale(sub(body.angularVelocityRadps, free[i].angularVelocityRadps), free[i].inertiaKgM2),
    }));
}
export function makeReport(joint, free, projected, targetAngleRad, motorImpulseNms) {
    const corrections = bodyCorrections(free, projected);
    for (const c of corrections)
        if (!denseNumbers(c.linearImpulseNs, 3) || !denseNumbers(c.angularImpulseNms, 3))
            reactionError();
    const identity = { id: joint.id, aId: free[joint.aIndex].id, bId: free[joint.bIndex].id };
    const b = corrections[joint.bIndex];
    const jointReport = validateHingeMotorReport({ ...identity, kind: 'hinge', angleRad: targetAngleRad,
        linearImpulseNs: [...b.linearImpulseNs], angularImpulseNms: [...b.angularImpulseNms], motorImpulseNms }, identity);
    const angularReactionNormNms = Math.hypot(...b.angularImpulseNms);
    if (!Number.isFinite(angularReactionNormNms))
        reactionError();
    return { jointReport, bodyCorrections: copyData(corrections),
        reportCap: { angularReactionNormNms, maxReactionNms: .01, exceedsCap: angularReactionNormNms > .01 } };
}
function reactionError() { throw new PhysicsError('NUMERIC_LIMIT', 'unsafe joint reaction'); }
/** Internal admitted/constructed data only. Each occurrence gets its own copy. */
export function copyData(value) {
    if (value === null || typeof value !== 'object')
        return value;
    if (Array.isArray(value))
        return value.map(item => copyData(item));
    const copied = {};
    for (const key of Object.keys(value)) {
        Object.defineProperty(copied, key, { value: copyData(value[key]),
            enumerable: true, configurable: true, writable: true });
    }
    return copied;
}
/** Guard inputs use descriptors. No accessor is invoked. Reflection errors remain unknown. */
export function ownData(value, keys) {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        return null;
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null)
        return null;
    const actual = Reflect.ownKeys(value);
    if (actual.length !== keys.length || actual.some(k => typeof k !== 'string' || !keys.includes(k)))
        return null;
    const result = {};
    for (const key of keys) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor))
            return null;
        Object.defineProperty(result, key, { value: descriptor.value, enumerable: true, configurable: true, writable: true });
    }
    return result;
}
export function denseNumbers(value, length) {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length !== length ||
        Reflect.ownKeys(value).length !== length + 1)
        return null;
    const result = [];
    for (let i = 0; i < length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor) ||
            typeof descriptor.value !== 'number' || !Number.isFinite(descriptor.value))
            return null;
        result.push(descriptor.value);
    }
    return result;
}
