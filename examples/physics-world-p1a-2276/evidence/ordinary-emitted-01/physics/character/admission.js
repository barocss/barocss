import { PhysicsError } from '../capsule-query-error.js';
import { DT, PROFILE, STEPS } from './profile.js';
function refuse(code, message) { throw new PhysicsError(code, message); }
function metadata(code, action) {
    try {
        return action();
    }
    catch {
        throw new PhysicsError(code, 'Controller input reflection failed');
    }
}
function record(value, keys, code) {
    if (!value || typeof value !== 'object' || metadata(code, () => Object.getPrototypeOf(value)) !== Object.prototype) {
        refuse(code, 'Expected an ordinary controller record');
    }
    const own = metadata(code, () => Reflect.ownKeys(value));
    if (own.length !== keys.length || own.some(key => typeof key !== 'string' || !keys.includes(key))) {
        refuse(code, 'Unexpected controller fields');
    }
    const copy = {};
    for (const key of keys) {
        const descriptor = metadata(code, () => Object.getOwnPropertyDescriptor(value, key));
        if (!descriptor || !('value' in descriptor))
            refuse(code, 'Controller accessors are not admitted');
        copy[key] = descriptor.value;
    }
    return copy;
}
function tuple(value, bound, code) {
    if (!metadata(code, () => Array.isArray(value)) || metadata(code, () => Object.getPrototypeOf(value)) !== Array.prototype) {
        refuse(code, 'Expected an ordinary controller tuple');
    }
    const length = metadata(code, () => Object.getOwnPropertyDescriptor(value, 'length'));
    if (!length || !('value' in length) || length.value !== 3 || metadata(code, () => Reflect.ownKeys(value)).length !== 4) {
        refuse(code, 'Invalid controller tuple length or fields');
    }
    const copy = [];
    for (let index = 0; index < 3; index++) {
        const descriptor = metadata(code, () => Object.getOwnPropertyDescriptor(value, String(index)));
        if (!descriptor || !('value' in descriptor) || typeof descriptor.value !== 'number' ||
            !Number.isFinite(descriptor.value) || Math.abs(descriptor.value) > bound) {
            refuse(code, 'Invalid controller tuple component');
        }
        copy.push(descriptor.value);
    }
    return copy;
}
export function admitConfig(input) {
    const config = record(input, ['version', 'profile', 'scene', 'positionM'], 'INVALID_CONFIG');
    if (config.version !== 1 || config.profile !== PROFILE)
        refuse('INVALID_CONFIG', 'Unsupported controller profile');
    const positionM = tuple(config.positionM, 5, 'INVALID_CONFIG');
    // The actual query factory admits and copies the scene after outer/start admission.
    return { scene: config.scene, positionM };
}
export function admitCommand(input) {
    const command = record(input, ['dtSeconds', 'sceneRevision', 'desiredVelocityMps'], 'INVALID_COMMAND');
    if (typeof command.dtSeconds !== 'number' || !Number.isFinite(command.dtSeconds))
        refuse('INVALID_COMMAND', 'Invalid controller time');
    if (typeof command.sceneRevision !== 'string' || !/^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,63}$/.test(command.sceneRevision)) {
        refuse('INVALID_COMMAND', 'Invalid controller revision');
    }
    const desiredVelocityMps = tuple(command.desiredVelocityMps, 1, 'INVALID_COMMAND');
    if (desiredVelocityMps[1] !== 0 || Math.hypot(desiredVelocityMps[0], desiredVelocityMps[2]) > 1) {
        refuse('INVALID_COMMAND', 'Controller horizontal request exceeds its bound');
    }
    return { dtSeconds: command.dtSeconds, sceneRevision: command.sceneRevision, desiredVelocityMps };
}
export function admitCoreCommand(dt, velocity, revision, stateRevision, stepIndex) {
    const command = admitCommand({ dtSeconds: dt, sceneRevision: revision, desiredVelocityMps: velocity });
    if (command.dtSeconds !== DT)
        throw new PhysicsError('INVALID_STEP', 'Controller requires exactly 1/120 second');
    if (command.sceneRevision !== stateRevision)
        throw new PhysicsError('STALE_SNAPSHOT', 'Controller revision mismatch');
    if (stepIndex >= STEPS)
        throw new PhysicsError('WORLD_LIMIT', 'Controller step limit exhausted');
    return command.desiredVelocityMps;
}
