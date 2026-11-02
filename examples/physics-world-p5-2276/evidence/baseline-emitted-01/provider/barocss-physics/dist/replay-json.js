import { canonicalEncode } from './identity.js';
import { PhysicsError } from './types.js';
export function replayError(code, message) {
    throw new PhysicsError(code, message);
}
function copyValue(input, label, depth, budget) {
    if (++budget.nodes > 50000 || depth > 32)
        replayError('INVALID_SNAPSHOT', `${label} exceeds JSON depth or size`);
    budget.bytes += input === null || typeof input === 'boolean' ? 1 : typeof input === 'number' ? 9 : 5;
    if (budget.bytes + 8 > MAX_RECORDING_BYTES)
        replayError('INVALID_SNAPSHOT', `${label} exceeds byte limit`);
    if (input === null || typeof input === 'boolean')
        return input;
    if (typeof input === 'string') {
        for (const character of input) {
            const point = character.codePointAt(0);
            budget.bytes += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
            if (point >= 0xd800 && point <= 0xdfff)
                replayError('INVALID_SNAPSHOT', `${label} contains malformed Unicode`);
        }
        if (budget.bytes + 8 > MAX_RECORDING_BYTES)
            replayError('INVALID_SNAPSHOT', `${label} string exceeds byte limit`);
        return input;
    }
    if (typeof input === 'number') {
        if (!Number.isFinite(input))
            replayError('INVALID_SNAPSHOT', `${label} contains a nonfinite number`);
        return input;
    }
    if (typeof input !== 'object' || Object.getPrototypeOf(input) !== (Array.isArray(input) ? Array.prototype : Object.prototype)) {
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
        if (keys.length > 64 || keys.some((key) => typeof key !== 'string' || !/^[\x20-\x7e]+$/.test(key))) {
            replayError('INVALID_SNAPSHOT', `${label} has unsupported fields`);
        }
        budget.nodes += keys.length;
        budget.bytes += keys.reduce((total, key) => total + 5 + key.length, 0);
        if (budget.nodes > 50000 || budget.bytes + 8 > MAX_RECORDING_BYTES)
            replayError('INVALID_SNAPSHOT', `${label} exceeds size limit`);
        const copied = {};
        for (const key of keys) {
            const field = Object.getOwnPropertyDescriptor(input, key);
            if (!field?.enumerable || !('value' in field))
                replayError('INVALID_SNAPSHOT', `${label}.${key} must be data`);
            Object.defineProperty(copied, key, { value: copyValue(field.value, `${label}.${key}`, depth + 1, budget), enumerable: true, writable: true, configurable: true });
        }
        output = copied;
    }
    budget.seen.delete(input);
    return output;
}
export function copyReplayJson(input, label) {
    return copyValue(input, label, 0, { nodes: 0, bytes: 0, seen: new Set() });
}
export function exactFields(value, fields, label) {
    if (value === null || typeof value !== 'object' || Array.isArray(value) ||
        Reflect.ownKeys(value).length !== fields.length ||
        Reflect.ownKeys(value).some((key) => typeof key !== 'string' || !fields.includes(key))) {
        replayError('INVALID_SNAPSHOT', `${label} has missing or unsupported fields`);
    }
}
/** Exact input comparison preserves signed zero and record order independence. */
export function equivalentReplayIdentity(left, right) {
    const a = canonicalEncode(left), b = canonicalEncode(right);
    return a.length === b.length && a.every((byte, index) => byte === b[index]);
}
/** BCPHREC1 + P0 canonical typed encoding. No JSON or format migration reader. */
const RECORDING_MAGIC = Uint8Array.of(66, 67, 80, 72, 82, 69, 67, 49);
export const MAX_RECORDING_BYTES = 1024 * 1024;
export function encodeRecordingData(input) {
    const data = canonicalEncode(copyReplayJson(input, 'recording'));
    if (data.length + RECORDING_MAGIC.length > MAX_RECORDING_BYTES)
        replayError('INVALID_SNAPSHOT', 'recording exceeds byte limit');
    const bytes = new Uint8Array(data.length + RECORDING_MAGIC.length);
    bytes.set(RECORDING_MAGIC);
    bytes.set(data, RECORDING_MAGIC.length);
    return bytes;
}
export function decodeRecordingData(input) {
    if (!(input instanceof Uint8Array) || input.length > MAX_RECORDING_BYTES ||
        input.length <= RECORDING_MAGIC.length || !RECORDING_MAGIC.every((byte, index) => input[index] === byte)) {
        replayError('INVALID_SNAPSHOT', 'unsupported recording wire format or byte limit');
    }
    // Own the bytes: decoder must never depend on caller mutations.
    const bytes = Uint8Array.from(input);
    const view = new DataView(bytes.buffer);
    const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
    let offset = RECORDING_MAGIC.length, nodes = 0;
    function take(length) {
        if (length > bytes.length - offset)
            replayError('INVALID_SNAPSHOT', 'truncated recording');
        const start = offset;
        offset += length;
        return start;
    }
    function uint32() { return view.getUint32(take(4), true); }
    function read(depth) {
        if (++nodes > 50000 || depth > 32)
            replayError('INVALID_SNAPSHOT', 'recording exceeds node or depth limit');
        const tag = bytes[take(1)];
        if (tag === 0)
            return null;
        if (tag === 1 || tag === 2)
            return tag === 2;
        if (tag === 3) {
            const length = uint32(), start = take(length);
            return decoder.decode(bytes.subarray(start, start + length));
        }
        if (tag === 4) {
            const value = view.getFloat64(take(8), true);
            if (!Number.isFinite(value))
                replayError('INVALID_SNAPSHOT', 'recording contains nonfinite number');
            return value;
        }
        if (tag === 5) {
            const length = uint32();
            if (length > 4096)
                replayError('INVALID_SNAPSHOT', 'recording array exceeds limit');
            return Array.from({ length }, () => read(depth + 1));
        }
        if (tag === 6) {
            const length = uint32();
            if (length > 64)
                replayError('INVALID_SNAPSHOT', 'recording record exceeds limit');
            const result = {};
            let previous;
            for (let i = 0; i < length; i++) {
                const key = read(depth + 1);
                if (typeof key !== 'string' || !/^[\x20-\x7e]+$/.test(key) || (previous !== undefined && key <= previous)) {
                    replayError('INVALID_SNAPSHOT', 'recording record keys must be unique canonical ASCII');
                }
                Object.defineProperty(result, key, { value: read(depth + 1), enumerable: true, writable: true, configurable: true });
                previous = key;
            }
            return result;
        }
        replayError('INVALID_SNAPSHOT', 'unknown recording data tag');
    }
    try {
        const result = read(0);
        if (offset !== bytes.length)
            replayError('INVALID_SNAPSHOT', 'recording has trailing bytes');
        return result;
    }
    catch (error) {
        if (error instanceof PhysicsError)
            throw error;
        replayError('INVALID_SNAPSHOT', 'invalid recording encoding');
    }
}
