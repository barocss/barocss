import { PhysicsError } from './index.js';
export function replayError(code, message) {
    throw new PhysicsError(code, message);
}
function copyValue(input, label, depth, budget) {
    if (++budget.nodes > 50000 || depth > 32)
        replayError('INVALID_SNAPSHOT', `${label} exceeds JSON depth or size`);
    if (input === null || typeof input === 'string' || typeof input === 'boolean')
        return input;
    if (typeof input === 'number') {
        if (!Number.isFinite(input))
            replayError('INVALID_SNAPSHOT', `${label} contains a nonfinite number`);
        return input;
    }
    if (typeof input !== 'object' || ![Object.prototype, null, Array.prototype].includes(Object.getPrototypeOf(input))) {
        replayError('INVALID_SNAPSHOT', `${label} must be plain JSON-compatible data`);
    }
    if (budget.seen.has(input))
        replayError('INVALID_SNAPSHOT', `${label} has a cycle`);
    budget.seen.add(input);
    let output;
    if (Array.isArray(input)) {
        if (input.length > 4096 || Reflect.ownKeys(input).length !== input.length + 1) {
            replayError('INVALID_SNAPSHOT', `${label} must be a bounded dense array`);
        }
        const copied = [];
        for (let index = 0; index < input.length; index++) {
            const field = Object.getOwnPropertyDescriptor(input, String(index));
            if (!field?.enumerable || !('value' in field))
                replayError('INVALID_SNAPSHOT', `${label}[${index}] must be data`);
            copied.push(copyValue(field.value, `${label}[${index}]`, depth + 1, budget));
        }
        output = copied;
    }
    else {
        const keys = Reflect.ownKeys(input);
        if (keys.length > 64 || keys.some((key) => typeof key !== 'string')) {
            replayError('INVALID_SNAPSHOT', `${label} has unsupported fields`);
        }
        const copied = Object.create(null);
        for (const key of keys) {
            const field = Object.getOwnPropertyDescriptor(input, key);
            if (!field?.enumerable || !('value' in field))
                replayError('INVALID_SNAPSHOT', `${label}.${key} must be data`);
            copied[key] = copyValue(field.value, `${label}.${key}`, depth + 1, budget);
        }
        output = copied;
    }
    budget.seen.delete(input);
    return output;
}
export function copyReplayJson(input, label) {
    return copyValue(input, label, 0, { nodes: 0, seen: new Set() });
}
export function exactFields(value, fields, label) {
    if (value === null || typeof value !== 'object' || Array.isArray(value) ||
        Reflect.ownKeys(value).length !== fields.length ||
        Reflect.ownKeys(value).some((key) => typeof key !== 'string' || !fields.includes(key))) {
        replayError('INVALID_SNAPSHOT', `${label} has missing or unsupported fields`);
    }
}
export function canonicalJson(value) {
    if (Array.isArray(value))
        return `[${value.map(canonicalJson).join(',')}]`;
    if (value !== null && typeof value === 'object') {
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}
