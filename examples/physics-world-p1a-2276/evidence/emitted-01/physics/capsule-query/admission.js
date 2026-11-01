import { PhysicsError } from '../capsule-query-error.js';
import { BOX_CAPACITY, PROFILE } from './profile.js';
function refuse(code, message) { throw new PhysicsError(code, message); }
function metadata(code, action) {
    try {
        return action();
    }
    catch (error) {
        throw new PhysicsError(code, 'Input reflection failed');
    }
}
function record(value, keys, code) {
    if (!value || typeof value !== 'object' || metadata(code, () => Object.getPrototypeOf(value)) !== Object.prototype) {
        refuse(code, 'Expected an ordinary record');
    }
    const own = metadata(code, () => Reflect.ownKeys(value));
    if (own.length !== keys.length || own.some(key => typeof key !== 'string' || !keys.includes(key))) {
        refuse(code, 'Unexpected record fields');
    }
    const copied = {};
    for (const key of keys) {
        const descriptor = metadata(code, () => Object.getOwnPropertyDescriptor(value, key));
        if (!descriptor || !('value' in descriptor))
            refuse(code, 'Accessor fields are not admitted');
        copied[key] = descriptor.value;
    }
    return copied;
}
function dense(value, limit, code, exact) {
    if (!metadata(code, () => Array.isArray(value)) || metadata(code, () => Object.getPrototypeOf(value)) !== Array.prototype) {
        refuse(code, 'Expected an ordinary dense array');
    }
    const lengthDescriptor = metadata(code, () => Object.getOwnPropertyDescriptor(value, 'length'));
    if (!lengthDescriptor || !('value' in lengthDescriptor))
        refuse(code, 'Expected array length');
    const length = lengthDescriptor.value;
    if (typeof length !== 'number' || !Number.isInteger(length) || length < 0 || length > limit ||
        (exact !== undefined && length !== exact) || metadata(code, () => Reflect.ownKeys(value)).length !== length + 1) {
        refuse(code, 'Invalid array length or fields');
    }
    const values = [];
    for (let index = 0; index < length; index++) {
        const descriptor = metadata(code, () => Object.getOwnPropertyDescriptor(value, String(index)));
        if (!descriptor || !('value' in descriptor))
            refuse(code, 'Sparse or accessor array');
        values.push(descriptor.value);
    }
    return values;
}
function tuple(value, count, bound, code) {
    return dense(value, count, code, count).map(component => {
        if (typeof component !== 'number' || !Number.isFinite(component) || Math.abs(component) > bound) {
            refuse(code, 'Invalid tuple component');
        }
        return component;
    });
}
function identity(value, code) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,63}$/.test(value)) {
        refuse(code, 'Invalid identity');
    }
    return value;
}
export function admitScene(input) {
    const scene = record(input, ['version', 'profile', 'revision', 'boxes'], 'INVALID_CONFIG');
    if (scene.version !== 1 || scene.profile !== PROFILE)
        refuse('INVALID_CONFIG', 'Unsupported capsule query profile');
    const revision = identity(scene.revision, 'INVALID_CONFIG');
    const boxes = dense(scene.boxes, BOX_CAPACITY, 'INVALID_CONFIG').map(value => {
        const box = record(value, ['id', 'centerM', 'halfExtentsM', 'orientationXYZW'], 'INVALID_CONFIG');
        const id = identity(box.id, 'INVALID_CONFIG');
        const centerM = tuple(box.centerM, 3, 10, 'INVALID_CONFIG');
        const halfExtentsM = tuple(box.halfExtentsM, 3, 5, 'INVALID_CONFIG');
        const orientationXYZW = tuple(box.orientationXYZW, 4, 1, 'INVALID_CONFIG');
        if (halfExtentsM.some(value => value < 0.0001) || Math.abs(Math.hypot(...orientationXYZW) - 1) > 1e-12) {
            refuse('INVALID_CONFIG', 'Invalid box extents or quaternion');
        }
        return { id, centerM, halfExtentsM, orientationXYZW };
    });
    if (new Set(boxes.map(box => box.id)).size !== boxes.length)
        refuse('INVALID_CONFIG', 'Duplicate box ID');
    return { version: 1, profile: PROFILE, revision, boxes };
}
export function admitSweep(input, scene) {
    const query = record(input, ['revision', 'centerM', 'displacementM', 'excludeId'], 'INVALID_QUERY');
    const revision = identity(query.revision, 'INVALID_QUERY');
    const centerM = tuple(query.centerM, 3, 5, 'INVALID_QUERY');
    const displacementM = tuple(query.displacementM, 3, 2, 'INVALID_QUERY');
    if (Math.hypot(...displacementM) > 2)
        refuse('INVALID_QUERY', 'Displacement exceeds 2 metres');
    const excludeId = query.excludeId === null ? null : identity(query.excludeId, 'INVALID_QUERY');
    if (revision !== scene.revision)
        throw new PhysicsError('STALE_SNAPSHOT', 'Revision mismatch');
    if (excludeId !== null && !scene.boxes.some(box => box.id === excludeId))
        refuse('INVALID_QUERY', 'Unknown excluded ID');
    return { revision, centerM, displacementM, excludeId };
}
