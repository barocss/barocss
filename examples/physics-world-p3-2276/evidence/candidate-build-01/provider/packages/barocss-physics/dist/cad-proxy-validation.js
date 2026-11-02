import { PhysicsError } from './index.js';
export function proxyError(code, message) {
    throw new PhysicsError(code, message);
}
export function proxyRecord(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
        proxyError('INVALID_CONFIG', 'CAD proxy request must be a plain object');
    }
    return value;
}
export function proxyFields(value, allowed) {
    if (Reflect.ownKeys(value).some((key) => typeof key !== 'string' || !allowed.includes(key))) {
        proxyError('INVALID_CONFIG', 'CAD proxy request has an unsupported field');
    }
}
export function proxyFinite(value, min, max, label) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
        proxyError('INVALID_CONFIG', `${label} must be finite and in [${min}, ${max}]`);
    }
    return value;
}
export function proxyVector(value, min, max, label) {
    if (!Array.isArray(value) || value.length !== 3 || Reflect.ownKeys(value).length !== 4 ||
        ![0, 1, 2].every((index) => Object.hasOwn(value, index))) {
        proxyError('INVALID_CONFIG', `${label} must be a dense 3-vector`);
    }
    return [0, 1, 2].map((index) => proxyFinite(value[index], min, max, `${label}[${index}]`));
}
